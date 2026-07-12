/**
 * Shared fixtures/helpers for the semantic reliability drills
 * (drill-scope-all.ts — task 6.2.2; drill-semantic-reliability.ts — task 10).
 *
 * Three small PUBLIC drill projects with distinctive marker vocabulary so
 * cross-project contamination is detectable by substring, plus blast-radius
 * helpers that temporarily privatize every other PUBLIC project so scope:'all'
 * enumerates exactly the drill set (restore in a finally block!).
 */

import type { PrismaClient } from '@prisma/client';

export const FIXTURE_SLUG = 'verification-fixture-kiln';

export interface DrillProject {
  slug: string;
  title: string;
  marker: string;
  article: string;
}

export const DRILL_PROJECTS: DrillProject[] = [
  {
    slug: 'drill-alpha',
    title: 'Drill Alpha Telescope Mount',
    marker: 'drillmarker-alpha',
    article: `# Drill Alpha Telescope Mount\n\nAn equatorial telescope mount with harmonic drive gearing, drillmarker-alpha vocabulary anchor.\n\n## Alpha Drive Electronics\n\nThe drillmarker-alpha drive electronics use closed-loop stepper control with encoder feedback for periodic error correction below two arcseconds.`,
  },
  {
    slug: 'drill-beta',
    title: 'Drill Beta Hydroponic Tower',
    marker: 'drillmarker-beta',
    article: `# Drill Beta Hydroponic Tower\n\nA vertical hydroponic tower with peristaltic nutrient dosing, drillmarker-beta vocabulary anchor.\n\n## Beta Nutrient Loop\n\nThe drillmarker-beta nutrient loop measures electrical conductivity and pH every minute and doses stock solutions through calibrated peristaltic pumps.`,
  },
  {
    slug: 'drill-gamma',
    title: 'Drill Gamma Loom Controller',
    marker: 'drillmarker-gamma',
    article: `# Drill Gamma Loom Controller\n\nA jacquard loom controller with solenoid heddle selection, drillmarker-gamma vocabulary anchor.\n\n## Gamma Pattern Memory\n\nThe drillmarker-gamma pattern memory streams weave drafts from an SD card as run-length encoded lift plans, drillmarker-gamma keeps sixteen sheds ahead.`,
  },
  {
    // Fourth project so drill:scope-all never has to ingest the REAL kiln
    // fixture (clobbering its real summaries/embeddings with drill output);
    // carries a nested H2→H3 subtree so the drill covers cumulative parents
    slug: 'drill-delta',
    title: 'Drill Delta Weather Station',
    marker: 'drillmarker-delta',
    article: `# Drill Delta Weather Station\n\nA solar-powered alpine weather station with LoRa telemetry, drillmarker-delta vocabulary anchor.\n\n## Delta Sensor Suite\n\nThe drillmarker-delta sensor suite samples wind, irradiance, and snow depth on a ten-second cadence with sensor-fault voting.\n\n### Delta Anemometer Calibration\n\nThe drillmarker-delta anemometer calibration maps ultrasonic transit times against a reference cup rotor across icing conditions.`,
  },
];

export const ALL_MARKERS = DRILL_PROJECTS.map(p => p.marker);
export const DRILL_SLUGS = DRILL_PROJECTS.map(p => p.slug);

export function toTiptap(text: string) {
  return {
    type: 'doc',
    content: text.split('\n\n').filter(p => p.trim()).map(paragraph => {
      const h = paragraph.match(/^(#{1,3}) ([\s\S]*)$/);
      if (h) {
        return { type: 'heading', attrs: { level: h[1].length }, content: [{ type: 'text', text: h[2] }] };
      }
      return { type: 'paragraph', content: [{ type: 'text', text: paragraph }] };
    })
  };
}

export async function seedDrillProjects(prisma: PrismaClient): Promise<void> {
  for (const dp of DRILL_PROJECTS) {
    const project = await prisma.project.upsert({
      where: { slug: dp.slug },
      update: { visibility: 'PUBLIC' },
      create: {
        title: dp.title,
        slug: dp.slug,
        description: `Semantic drill project (${dp.marker})`,
        briefOverview: `Semantic drill project (${dp.marker})`,
        workDate: new Date('2025-12-01'),
        visibility: 'PUBLIC',
      },
    });
    await prisma.articleContent.upsert({
      where: { projectId: project.id },
      update: { content: dp.article, jsonContent: toTiptap(dp.article), contentType: 'json' },
      create: { projectId: project.id, content: dp.article, jsonContent: toTiptap(dp.article), contentType: 'json' },
    });
  }
}

export async function cleanupDrillProjects(prisma: PrismaClient): Promise<void> {
  const slugs = DRILL_PROJECTS.map(p => p.slug);
  await prisma.contentEntity.deleteMany({ where: { entityType: 'PROJECT', slug: { in: slugs } } });
  await prisma.project.deleteMany({ where: { slug: { in: slugs } } });
  await prisma.semanticProcessingOperation.deleteMany({ where: { id: { contains: 'drill' } } });
}

/**
 * Blast-radius containment: privatize every PUBLIC project outside the drill
 * set so scope:'all' sees exactly the drill projects. Returns a restore
 * function — call it in a finally block. By default even the REAL kiln
 * fixture is excluded (a fake-mode drill must never overwrite its real
 * summaries/embeddings); pass extra `keepPublicSlugs` when a drill
 * deliberately re-ingests it with real AI (drill-semantic-reliability).
 */
export async function privatizeNonDrillProjects(
  prisma: PrismaClient,
  keepPublicSlugs: string[] = DRILL_SLUGS
): Promise<() => Promise<void>> {
  const others = await prisma.project.findMany({
    where: { visibility: 'PUBLIC', slug: { notIn: keepPublicSlugs } },
    select: { id: true },
  });
  console.log(`ℹ️  Temporarily privatizing ${others.length} non-drill PUBLIC project(s)`);
  await prisma.project.updateMany({
    where: { id: { in: others.map(p => p.id) } },
    data: { visibility: 'PRIVATE' },
  });
  return async () => {
    await prisma.project.updateMany({
      where: { id: { in: others.map(p => p.id) } },
      data: { visibility: 'PUBLIC' },
    });
    console.log(`ℹ️  Restored visibility for ${others.length} project(s)`);
  };
}
