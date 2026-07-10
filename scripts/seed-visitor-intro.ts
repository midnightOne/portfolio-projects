/**
 * Visitor-intro starter content (conversation-engine Req 18.5, Block G2).
 *
 * Creates the `CUSTOM/visitor-intro` entity with a T1 `intro` chunk that
 * start-frame assembly injects into every fresh conversation's grounding
 * (src/lib/ai/start-frame.ts). CONTENT, NOT CODE (D48): the owner edits the
 * live text in the admin semantic chunk editor — this script only creates the
 * starter version and NEVER overwrites an existing chunk (create-if-missing),
 * so owner edits survive re-runs. Delete the chunk to disable the intro.
 *
 * No embedding: the intro is read deterministically by (entity, tier,
 * chunkId), never retrieved semantically — zero spend.
 *
 * Run: npm run seed:visitor-intro
 */

import { PrismaClient } from '@prisma/client';
import { estimateTokensFromChars } from '../src/lib/ai/token-estimate';

const prisma = new PrismaClient();

const STARTER_INTRO = `This is Kirill's portfolio site, and you are its voice — the site itself is the flagship project. What a visitor can do here: browse the projects (each opens into a full write-up), read about Kirill's background, and talk to you by voice or text. What YOU can do for them: answer questions grounded in the portfolio's real content, search across projects, and navigate the site for them — opening projects, scrolling to sections, highlighting passages while you talk. Navigation is consent-based: an auto-navigation toggle sits on the pill, OFF by default. Early in a conversation, when it fits naturally, mention that you can show things directly and offer the option ("want me to just take you there as we talk?") — if they agree, flip the toggle with the set_auto_navigation tool. First-time visitors usually want a quick sense of what's here: offer a short overview or the suggested questions rather than an interrogation.`;

async function main() {
  const entity = await prisma.contentEntity.upsert({
    where: { entityType_slug: { entityType: 'CUSTOM', slug: 'visitor-intro' } },
    create: {
      entityType: 'CUSTOM',
      slug: 'visitor-intro',
      title: 'Visitor intro (start-frame injection)',
      description:
        'Owner-authored intro injected into every fresh conversation (Req 18.5). Edit the T1 "intro" chunk; delete it to disable.',
      tags: [],
      technologies: [],
    },
    update: {}, // entity metadata is stable; the chunk below is the content
  });

  const existing = await prisma.contextChunk.findUnique({
    where: { entityId_tier_chunkId: { entityId: entity.id, tier: 1, chunkId: 'intro' } },
    select: { id: true },
  });
  if (existing) {
    console.log('visitor-intro chunk already exists — left untouched (owner content).');
    return;
  }

  await prisma.contextChunk.create({
    data: {
      entityId: entity.id,
      tier: 1,
      chunkId: 'intro',
      title: 'Visitor intro',
      content: STARTER_INTRO,
      tokenCount: estimateTokensFromChars(STARTER_INTRO.length),
      metadata: { type: 'visitor-intro', source: 'seed-starter' },
      generationMode: 'manual',
      importanceSource: 'manual',
    },
  });
  console.log(`visitor-intro created (entity ${entity.id}) — edit it in the admin chunk editor.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
