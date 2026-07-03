/**
 * Verification fixture seed (verification spec, Requirement 2 / task 1.2)
 *
 * Creates a deterministic dataset for agentic e2e verification:
 *  - the fixture project (known markdown + Tiptap structure, 4 H2 sections)
 *  - a known reflink (`fixture-verify`) with a small budget
 *  - relies on env-based admin auth (ADMIN_USERNAME/ADMIN_PASSWORD) — no DB user exists by design
 *
 * NOTE (Phase 2 gap): "public tier on" cannot be seeded yet — publicAIAccess is
 * hardcoded 'disabled' in PublicAccessManager until the access-and-cost spec lands
 * DB-backed AIPublicAccessSettings (D31). Reflink access is the testable tier today.
 *
 * Expected semantic output for this content lives in fixtures/expected-semantic.json
 * and is asserted by `npm run check:semantic` after ingestion.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const FIXTURE_SLUG = 'verification-fixture-kiln';
export const FIXTURE_REFLINK_CODE = 'fixture-verify';

// Deterministic content with distinctive vocabulary so retrieval assertions are unambiguous.
// Structure: H1 title, intro paragraph, then exactly 4 H2 sections.
const FIXTURE_ARTICLE = `# Chrono Kiln Controller

The Chrono Kiln Controller is a purpose-built ceramics kiln automation system combining a custom firing-schedule engine, real-time thermal regulation, and a glaze chemistry database. It was built to make reproducible crystalline glaze firings possible in a small studio without commercial lab equipment.

## Thermal Control System

Temperature regulation uses a dual-thermocouple arrangement inside a zirconia muffle, sampled at 4 Hz. A PID control loop with gain scheduling drives the silicon carbide heating elements through zero-crossing solid state relays. The controller holds ramp segments to within 1.5 degrees Celsius of the programmed firing schedule, and the crash-cooling segment for crystalline glazes is managed by a proportional vent servo. Thermal runaway protection trips a mechanical contactor independently of the microcontroller.

## Firmware Architecture

The firmware runs on an ESP32 with FreeRTOS tasks separated into sensing, control, logging, and connectivity. A hardware watchdog restarts the control task if a loop deadline is missed twice in a row. Firing schedules are stored as piecewise ramp-and-hold segment graphs and validated before execution. Over-the-air updates are staged with an A/B partition scheme so a failed flash can never brick an active firing.

## Glaze Chemistry Database

The glaze module stores unity molecular formulas for every recipe, including the celadon and crystalline zinc-silicate families. Each recipe records flux ratios, silica-to-alumina ratio, and observed cone behavior across firings. A lookup interface suggests firing schedules based on past results for glazes with similar chemistry, which turned trial-and-error glaze development into a queryable dataset.

## Results and Lessons

Across forty-two logged firings the controller achieved segment tracking within specification on all but two runs, both traced to a failing thermocouple junction. Crystalline glaze yield improved from roughly one in five pots to four in five once crash-cooling became reproducible. The main lesson: deterministic logging of every input beats cleverness — the glaze database only became useful once every firing wrote a complete record.`;

// Same converter idiom as prisma/seed.ts (headings, paragraphs).
function convertToTiptapJSON(text: string) {
  return {
    type: 'doc',
    content: text.split('\n\n').filter(p => p.trim()).map(paragraph => {
      if (paragraph.startsWith('# ')) {
        return {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: paragraph.replace('# ', '') }]
        };
      } else if (paragraph.startsWith('## ')) {
        return {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: paragraph.replace('## ', '') }]
        };
      }
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: paragraph }]
      };
    })
  };
}

async function main() {
  console.log('🧪 Seeding verification fixture...');

  const fixtureTag = await prisma.tag.upsert({
    where: { name: 'Verification Fixture' },
    update: {},
    create: { name: 'Verification Fixture', color: '#8B5CF6' },
  });

  const project = await prisma.project.upsert({
    where: { slug: FIXTURE_SLUG },
    update: {},
    create: {
      title: 'Chrono Kiln Controller',
      slug: FIXTURE_SLUG,
      description: 'Verification fixture: ceramics kiln automation with thermal regulation, ESP32 firmware, and a glaze chemistry database.',
      briefOverview: 'Deterministic verification fixture project (kiln controller)',
      workDate: new Date('2025-11-01'),
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      tags: { connect: [{ id: fixtureTag.id }] },
    },
  });

  await prisma.articleContent.upsert({
    where: { projectId: project.id },
    update: {
      content: FIXTURE_ARTICLE,
      jsonContent: convertToTiptapJSON(FIXTURE_ARTICLE),
      contentType: 'json',
    },
    create: {
      projectId: project.id,
      content: FIXTURE_ARTICLE,
      jsonContent: convertToTiptapJSON(FIXTURE_ARTICLE),
      contentType: 'json',
    },
  });

  await prisma.aIReflink.upsert({
    where: { code: FIXTURE_REFLINK_CODE },
    update: {},
    create: {
      code: FIXTURE_REFLINK_CODE,
      name: 'Verification Fixture Reflink',
      description: 'Known reflink for agentic e2e verification (verification spec Req 2.4)',
      rateLimitTier: 'STANDARD',
      dailyLimit: 50,
      isActive: true,
      enableVoiceAI: true,
      enableJobAnalysis: true,
      enableAdvancedNavigation: true,
      recipientName: 'Verification Agent',
      customContext: 'Session used for automated end-to-end verification runs.',
      tokenLimit: 20000,
      spendLimit: 5.0,
    },
  });

  console.log(`✅ Fixture project ready: ${project.id} (slug: ${FIXTURE_SLUG})`);
  console.log(`✅ Fixture reflink ready: ${FIXTURE_REFLINK_CODE}`);
  console.log('ℹ️  Admin auth is env-based (ADMIN_USERNAME/ADMIN_PASSWORD) — nothing to seed.');
  console.log('⚠️  Public tier cannot be enabled yet (hardcoded disabled until access-and-cost Phase 2, D31).');
  console.log('➡️  Next: ingest via POST /api/admin/semantic/processing/start, then `npm run check:semantic`.');
}

main()
  .catch((e) => { console.error('❌ Fixture seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
