/**
 * Job Analysis API Route
 * 
 * Analyzes job specifications against the portfolio owner's background.
 * Provides structured analysis and recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAIGateway, type GatewayContext } from '@/lib/ai/gateway';

interface JobAnalysisRequest {
  jobDescription: string;
  focusAreas?: string[];
  reflinkId?: string;
  accessLevel?: 'basic' | 'limited' | 'premium';
}

interface JobAnalysisResponse {
  analysis: {
    overallMatch: number;
    strengths: string[];
    gaps: string[];
    recommendations: string[];
    skillsMatch: {
      skill: string;
      match: number;
      evidence: string[];
    }[];
    experienceMatch: {
      area: string;
      match: number;
      relevantProjects: string[];
    }[];
  };
  metadata: {
    analysisId: string;
    timestamp: string;
    processingTime: string;
    reflinkId?: string;
  };
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
    const { jobDescription, focusAreas = [], reflinkId, accessLevel = 'basic' } = body;

    if (!jobDescription || typeof jobDescription !== 'string') {
      return NextResponse.json(
        { error: 'Job description is required and must be a string' },
        { status: 400 }
      );
    }

    // TODO: Implement actual job analysis using AI service
    // TODO: Load portfolio owner's background from context system
    // TODO: Apply access control based on reflink permissions
    // TODO: Store analysis results for admin review

    const startTime = Date.now();

    // Mock analysis for now
    const mockAnalysis = {
      overallMatch: 0.87,
      strengths: [
        'Strong React and TypeScript experience matches frontend requirements',
        'Next.js expertise aligns with modern web development needs',
        'Full-stack capabilities cover both frontend and backend requirements',
        'Experience with modern development practices and tools'
      ],
      gaps: [
        'Limited experience with specific cloud platform mentioned (AWS/Azure)',
        'No direct experience with the specific industry domain',
        'Team leadership experience could be stronger for senior role'
      ],
      recommendations: [
        'Highlight React and TypeScript projects in portfolio',
        'Emphasize full-stack development capabilities',
        'Consider obtaining cloud platform certifications',
        'Showcase any team collaboration or mentoring experience'
      ],
      skillsMatch: [
        {
          skill: 'React Development',
          match: 0.95,
          evidence: ['Multiple React projects in portfolio', '5+ years experience', 'Modern hooks and patterns']
        },
        {
          skill: 'TypeScript',
          match: 0.90,
          evidence: ['All recent projects use TypeScript', 'Strong type safety practices']
        },
        {
          skill: 'Node.js',
          match: 0.80,
          evidence: ['Backend API development', 'Full-stack project experience']
        }
      ],
      experienceMatch: [
        {
          area: 'Frontend Development',
          match: 0.92,
          relevantProjects: ['Portfolio Website', 'E-commerce Platform', 'Dashboard Application']
        },
        {
          area: 'Full-Stack Development',
          match: 0.85,
          relevantProjects: ['Portfolio Website', 'API Integration Project']
        }
      ]
    };

    const processingTime = `${Date.now() - startTime}ms`;
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const response: JobAnalysisResponse = {
      analysis: mockAnalysis,
      metadata: {
        analysisId,
        timestamp: new Date().toISOString(),
        processingTime,
        reflinkId
      }
    };

    // TODO: Store analysis in database for admin review (Phase 4.4 productization)
    console.log(`Job analysis completed: ${analysisId} (${processingTime})`);

    // Mock analysis makes no model call today — $0 ledger row records the event
    // (real reasoning-model spend meters here when Phase 4.4 lands).
    await ctx.meter({
      usageType: 'job_analysis',
      costUsd: 0,
      metadata: { analysisId, mock: true },
    });

    return NextResponse.json(response);

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