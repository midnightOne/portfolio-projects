/**
 * Job Analysis API Route (ai-assistant task 8, roadmap 4.4 — first concrete D39 deep tool).
 *
 * Analyzes a job specification against the portfolio owner's background:
 * grounded in the semantic store (start frame + content_search hits), reasoned by
 * the admin-selectable `default-reasoning` alias, persisted to `AIJobAnalysis`
 * for the admin review view. Reflink-gated (D31): anonymous callers are rejected
 * by the gateway; reflinks additionally need `enableJobAnalysis`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';
import { getReasoningAdapter, type ReasoningMessage } from '@/lib/ai/reasoning';
import { assembleStartFrame } from '@/lib/ai/start-frame';
import { BackendToolService } from '@/lib/ai/tools/BackendToolService';
import { prisma } from '@/lib/prisma';

const MAX_JOB_SPEC_CHARS = 20_000;

interface JobAnalysisRequest {
  jobDescription: string;
  focusAreas?: string[];
  reflinkId?: string;
}

interface AnalysisShape {
  overallMatch: number;
  companyName?: string | null;
  positionTitle?: string | null;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  skillsMatch: Array<{ skill: string; match: number; evidence: string[] }>;
  experienceMatch: Array<{ area: string; match: number; relevantProjects: string[] }>;
  /** G3 (Req 13.4 expanded): visitor-facing compatibility document — rendered
   *  in the job-description modal; covers experience fit AND preferred-work
   *  fit (against the owner's work-preferences record when present). */
  document?: string;
}

const SYSTEM_PROMPT = `You are an analyst comparing a job specification against a software engineer's ACTUAL portfolio evidence (provided as grounding). Be honest and specific:
- Only claim strengths the grounding supports; cite project names as evidence.
- Name real gaps — missing skills are informative, not embarrassing.
- Scores are 0..1 and should vary meaningfully (never all the same value).
- When "Owner work preferences" appear in the grounding, judge PREFERRED-WORK fit too (does this role match what he wants to do?) — separately from capability fit. Never quote the preferences verbatim; paraphrase professionally.
- "document" is a visitor-facing compatibility write-up in plain prose (350-600 words, markdown headings allowed): open with the overall verdict, then experience fit with cited project evidence, then preferred-work fit (when preferences were provided), then honest gaps. Written ABOUT the engineer in third person, for the recruiter reading it.
Respond with ONLY a JSON object (no markdown fences) of this exact shape:
{
  "overallMatch": number 0..1,
  "companyName": string | null,
  "positionTitle": string | null,
  "strengths": string[],
  "gaps": string[],
  "recommendations": string[],
  "skillsMatch": [{ "skill": string, "match": number 0..1, "evidence": string[] }],
  "experienceMatch": [{ "area": string, "match": number 0..1, "relevantProjects": string[] }],
  "document": string
}`;

function parseAnalysis(raw: string | null): AnalysisShape | null {
  if (!raw) return null;
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.overallMatch !== 'number' || !Array.isArray(parsed.strengths)) return null;
    return parsed as AnalysisShape;
  } catch {
    return null;
  }
}

async function assembleGrounding(jobDescription: string, ctx: GatewayContext): Promise<string> {
  const frame = await assembleStartFrame();

  // G3: the owner's work-preferences record (admin-edited, server-side only —
  // never a content chunk, P13) joins the grounding so fit is judged against
  // preferred work too. Absent/empty = capability-fit-only, as before.
  let preferences = '';
  try {
    const prefs = await prisma.aIOwnerPreferences.findUnique({ where: { id: 'owner' } });
    if (prefs?.workPreferences?.trim()) {
      preferences = `\n\nOwner work preferences (server-side context — paraphrase, never quote verbatim):\n${prefs.workPreferences.trim()}`;
    }
  } catch (error) {
    console.error('[analyze-job] preferences read failed (continuing without):', error);
  }

  // Retrieval grounding: search the semantic store with the job spec's own text
  // (same chain the assistant uses — D39). Reflink/admin tiers see full content.
  let hits = '';
  try {
    const backend = BackendToolService.getInstance();
    const result = await backend.executeTool(
      'content_search',
      { query: jobDescription.slice(0, 500), k: 8, maxTier: 2 },
      `job_${ctx.requestId}`,
      ctx.tier === 'public' ? 'basic' : 'premium',
      ctx.reflink?.id
    );
    if (result.success && result.data) {
      const items = (result.data as { items?: Array<Record<string, unknown>> }).items ?? [];
      hits = items
        .map((i) => `- [${i.project ?? 'portfolio'}] ${i.title}: ${i.oneLiner ?? ''}`)
        .join('\n');
      for (const i of items.slice(0, 10)) {
        ctx.debug.retrieval.push({ chunkId: i.id, title: i.title, project: i.project, score: i.score });
      }
    }
  } catch (error) {
    console.error('[analyze-job] grounding search failed (continuing with frame only):', error);
  }

  return `${frame}\n\nRelevant portfolio evidence for this job spec:\n${hits || '(no additional retrieval hits)'}${preferences}`;
}

async function handlePOST(request: NextRequest, ctx: GatewayContext) {
  try {
    // Job analysis is a reflink feature (D31): the gateway rejects anonymous callers
    // (publicAllowed: false); reflinks additionally need the feature enabled.
    if (ctx.tier === 'reflink' && ctx.reflink && !ctx.reflink.enableJobAnalysis) {
      return NextResponse.json(
        { error: 'Job analysis is not enabled for this invitation.', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
    }

    const body: JobAnalysisRequest = await request.json();
    const { jobDescription, focusAreas = [] } = body;

    if (!jobDescription || typeof jobDescription !== 'string') {
      return NextResponse.json(
        { error: 'Job description is required and must be a string' },
        { status: 400 }
      );
    }
    if (jobDescription.length > MAX_JOB_SPEC_CHARS) {
      return NextResponse.json(
        { error: `Job description too long (max ${MAX_JOB_SPEC_CHARS} characters)` },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Deep tool → the admin-selectable reasoning model (D39)
    const adapter = await getReasoningAdapter('default-reasoning');
    ctx.debug.model = { alias: 'default-reasoning', resolved: `${adapter.provider}/${adapter.modelId}` };

    const grounding = await assembleGrounding(jobDescription, ctx);
    const focusNote = focusAreas.length ? `\nFocus areas requested: ${focusAreas.slice(0, 10).join(', ')}` : '';

    const messages: ReasoningMessage[] = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nPortfolio grounding:\n${grounding}` },
      { role: 'user', content: `Job specification:\n\n${jobDescription}${focusNote}` },
    ];

    const modelStart = Date.now();
    const result = await adapter.chat(messages, { temperature: 0.3, maxOutputTokens: 2000 });
    ctx.debug.modelMs = Date.now() - modelStart;

    const analysis = parseAnalysis(result.content);
    if (!analysis) {
      console.error('[analyze-job] unparseable model output');
      await ctx.meter({
        usageType: 'job_analysis',
        provider: result.provider,
        modelId: result.modelId,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        metadata: { ok: false, reason: 'unparseable' },
      });
      return NextResponse.json(
        { error: 'Analysis could not be completed — please try again.', code: 'ANALYSIS_FAILED' },
        { status: 502 }
      );
    }

    const metered = await ctx.meter({
      usageType: 'job_analysis',
      provider: result.provider,
      modelId: result.modelId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      metadata: { ok: true },
    });

    // Persist for the admin review view (Req 8.1); failures must not fail the response
    let analysisId = `analysis_${randomUUID()}`;
    try {
      const row = await prisma.aIJobAnalysis.create({
        data: {
          reflinkId: ctx.reflink?.id,
          sessionId: ctx.sessionId ?? `req_${ctx.requestId}`,
          jobSpecification: jobDescription,
          companyName: analysis.companyName ?? null,
          positionTitle: analysis.positionTitle ?? null,
          analysisResult: analysis as never,
          tokensUsed: result.usage.inputTokens + result.usage.outputTokens,
          costUsd: metered.costUsd,
          metadata: {
            provider: result.provider,
            modelId: result.modelId,
            ledgerId: metered.ledgerId,
            focusAreas,
            tier: ctx.tier,
          },
        },
      });
      analysisId = row.id;
    } catch (error) {
      console.error('[analyze-job] persistence failed (response still served):', error);
    }

    const { companyName, positionTitle, ...analysisBody } = analysis;
    return NextResponse.json({
      analysis: analysisBody,
      metadata: {
        analysisId,
        companyName,
        positionTitle,
        timestamp: new Date().toISOString(),
        processingTime: `${Date.now() - startTime}ms`,
        reflinkId: ctx.reflink?.id,
      },
    });
  } catch (error) {
    console.error('Error analyzing job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Reflink/admin only (D31) — anonymous visitors have no job-analysis access.
export const POST = withAIGateway({ feature: 'tools', publicAllowed: false }, handlePOST);
