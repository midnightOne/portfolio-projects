/**
 * Admin: safety-tripwire config (conversation-engine Req 22.4, task L4).
 * GET/PUT the singleton SafetyConfig row: module on/off, word lists by
 * category (owner-tuned data — P34), investigation policy text, and the
 * severity→action map (Req 22.3). Upserts so a fresh clone needs no seed
 * step — a missing row reads as the defaults (disabled). Pure config CRUD:
 * no model calls, no gateway (D33 does not apply); the metered investigation
 * runs from the logging pipeline, never from here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { __clearSafetyConfigCache, getSafetyConfig } from '@/lib/services/ai/safety-config';
import { SAFETY_ACTIONS, SAFETY_SEVERITIES } from '@/lib/ai/safety/investigation';

const MAX_CATEGORIES = 50;
const MAX_WORDS_PER_CATEGORY = 300;
const MAX_WORD_CHARS = 64;
const MAX_POLICY_CHARS = 4000;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  // fresh: the panel must show what is saved, not a ≤30s-stale memo.
  const config = await getSafetyConfig({ fresh: true });
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (typeof body.enabled === 'boolean') data.enabled = body.enabled;

  if (body.wordLists !== undefined) {
    if (!body.wordLists || typeof body.wordLists !== 'object' || Array.isArray(body.wordLists)) {
      return NextResponse.json({ error: 'wordLists must be an object of category → word arrays' }, { status: 400 });
    }
    const lists: Record<string, string[]> = {};
    const entries = Object.entries(body.wordLists as Record<string, unknown>).slice(0, MAX_CATEGORIES);
    for (const [category, words] of entries) {
      const name = category.trim().slice(0, 64);
      if (!name || !Array.isArray(words)) continue;
      const clean = words
        .filter((w): w is string => typeof w === 'string')
        .map((w) => w.trim().toLowerCase().slice(0, MAX_WORD_CHARS))
        .filter((w) => w.length > 0)
        .slice(0, MAX_WORDS_PER_CATEGORY);
      // Empty categories are dropped, not stored — a category with no words
      // can never flag and only clutters the scan.
      if (clean.length > 0) lists[name] = [...new Set(clean)];
    }
    data.wordLists = lists;
  }

  if (body.investigationPolicy !== undefined) {
    if (body.investigationPolicy !== null && typeof body.investigationPolicy !== 'string') {
      return NextResponse.json({ error: 'investigationPolicy must be a string or null' }, { status: 400 });
    }
    const trimmed = typeof body.investigationPolicy === 'string' ? body.investigationPolicy.trim().slice(0, MAX_POLICY_CHARS) : '';
    data.investigationPolicy = trimmed || null;
  }

  if (body.severityActionMap !== undefined) {
    if (!body.severityActionMap || typeof body.severityActionMap !== 'object' || Array.isArray(body.severityActionMap)) {
      return NextResponse.json({ error: 'severityActionMap must be an object' }, { status: 400 });
    }
    const map: Record<string, string> = {};
    for (const [severity, action] of Object.entries(body.severityActionMap as Record<string, unknown>)) {
      if (!(SAFETY_SEVERITIES as readonly string[]).includes(severity)) continue;
      if (typeof action !== 'string' || !(SAFETY_ACTIONS as readonly string[]).includes(action)) {
        return NextResponse.json({ error: `invalid action '${String(action)}' for severity '${severity}'` }, { status: 400 });
      }
      map[severity] = action;
    }
    data.severityActionMap = map;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  await prisma.safetyConfig.upsert({
    where: { id: 'safety' },
    create: { id: 'safety', ...data },
    update: data,
  });
  __clearSafetyConfigCache();
  return NextResponse.json(await getSafetyConfig({ fresh: true }));
}
