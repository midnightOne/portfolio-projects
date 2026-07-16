/**
 * Individual content-source management (ai-assistant 7.15).
 *  - POST   toggle enabled/disabled (the query-time allowlist — an unticked
 *           source stays in the index but is hidden from retrieval)
 *  - DELETE remove a document source AND its ingested entity + chunks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-utils';
import {
  deleteDocumentSource,
  isDocSourceId,
  setSourceEnabled,
} from '@/lib/content/source-registry';

interface RouteParams {
  params: Promise<{ sourceId: string }>;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }
  return null;
}

/**
 * POST /api/admin/ai/content-sources/[sourceId] — toggle enabled.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { sourceId } = await params;
  try {
    const { enabled } = await request.json();
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: { message: 'enabled must be a boolean' } }, { status: 400 });
    }
    await setSourceEnabled(decodeURIComponent(sourceId), enabled);
    return NextResponse.json({
      success: true,
      data: { message: `Source ${enabled ? 'enabled' : 'disabled'} — retrieval filter updates within ~30s.` },
    });
  } catch (error) {
    console.error(`Error toggling content source ${sourceId}:`, error);
    return NextResponse.json(
      { error: { message: 'Failed to toggle content source' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/ai/content-sources/[sourceId] — remove a document source
 * (config row + ingested entity/chunks).
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const { sourceId: raw } = await params;
  const sourceId = decodeURIComponent(raw);
  try {
    if (!isDocSourceId(sourceId)) {
      return NextResponse.json(
        { error: { message: 'Only document sources (doc:<slug>) can be deleted here' } },
        { status: 400 }
      );
    }
    const slug = sourceId.slice('doc:'.length);
    const { deletedEntity } = await deleteDocumentSource(slug);
    return NextResponse.json({
      success: true,
      data: { message: `Document source removed${deletedEntity ? ' (index entity + chunks deleted)' : ''}.` },
    });
  } catch (error) {
    console.error(`Error deleting content source ${sourceId}:`, error);
    return NextResponse.json(
      { error: { message: 'Failed to delete content source' } },
      { status: 500 }
    );
  }
}
