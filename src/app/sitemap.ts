/**
 * Sitemap (portfolio-core task 4, Req 12.3).
 *
 * Phase 3 finding: the spec claimed a sitemap existed — it never did. This is
 * the real one: static public pages + every PUBLIC project's deep link
 * (`/projects?project=<slug>` — the project browser's canonical modal URL).
 * Test/debug routes no longer exist to exclude (D16/D42).
 */

import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();

  let projects: Array<{ slug: string; updatedAt: Date }> = [];
  try {
    projects = await prisma.project.findMany({
      where: { visibility: 'PUBLIC' },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  } catch (error) {
    console.error('[sitemap] failed to load projects (emitting static pages only):', error);
  }

  return [
    {
      url: `${base}/`,
      lastModified: projects[0]?.updatedAt ?? new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/projects`,
      lastModified: projects[0]?.updatedAt ?? new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...projects.map((p) => ({
      url: `${base}/projects?project=${encodeURIComponent(p.slug)}`,
      lastModified: p.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
