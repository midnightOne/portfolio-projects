/**
 * Content Source Manager (ai-assistant 7.15).
 *
 * The admin face of the ingestion manifest: one list of REAL retrieval
 * sources (projects, config-owned documents, script-ingested entities) with
 * index state, enable/disable toggles (query-time allowlist), document
 * add/edit (paste text/markdown — classic RAG), one-click ingestion through
 * the stage pipeline (scope:'entity'), and document removal.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Database, FileText, Globe, Plus, RefreshCw, Trash2, AlertCircle, CheckCircle } from 'lucide-react';

interface SourceRow {
  sourceId: string;
  kind: 'projects' | 'document' | 'entity';
  title: string;
  entityType: string;
  slug?: string;
  description?: string;
  tags?: string[];
  technologies?: string[];
  uiLocation?: string | null;
  contentLength?: number;
  enabled: boolean;
  ingested?: boolean;
  entities?: number;
  chunks: number;
  embedded: number;
}

interface DocDraft {
  sourceId?: string;
  slug: string;
  entityType: string;
  title: string;
  description: string;
  tags: string;
  technologies: string;
  uiLocation: string;
  content: string;
}

const EMPTY_DRAFT: DocDraft = {
  slug: '', entityType: 'CUSTOM', title: '', description: '', tags: '', technologies: '', uiLocation: '', content: '',
};

export function ContentSourceManager() {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>(['BIO', 'RESUME', 'EXPERIENCE', 'SKILLS', 'CUSTOM']);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<DocDraft>(EMPTY_DRAFT);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); };

  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/ai/content-sources');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to load content sources');
      setSources(data.data?.sources || []);
      if (Array.isArray(data.data?.documentEntityTypes)) setEntityTypes(data.data.documentEntityTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSources(); }, [loadSources]);

  const toggleSource = async (sourceId: string, enabled: boolean) => {
    setBusy(sourceId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai/content-sources/${encodeURIComponent(sourceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Toggle failed');
      setSources(prev => prev.map(s => (s.sourceId === sourceId ? { ...s, enabled } : s)));
      flash(data.data?.message || 'Saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const ingestSource = async (source: SourceRow) => {
    setBusy(source.sourceId);
    setError(null);
    try {
      const stages = ['chunking', 'summaries', 'embeddings', 'validation']
        .map(stage => ({ stage, enabled: true, mode: 'immediate' }));
      const res = await fetch('/api/admin/semantic/processing/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'entity', sourceId: source.sourceId, stages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || 'Ingestion failed to start');
      flash(`Ingestion started (${data.operationId}) — refresh in a moment to see index state.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const deleteSource = async (source: SourceRow) => {
    if (!window.confirm(`Remove "${source.title}" and delete its indexed chunks?`)) return;
    setBusy(source.sourceId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai/content-sources/${encodeURIComponent(source.sourceId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Delete failed');
      flash(data.data?.message || 'Removed');
      await loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const editSource = (source: SourceRow) => {
    setDraft({
      sourceId: source.sourceId,
      slug: source.slug || '',
      entityType: source.entityType,
      title: source.title,
      description: source.description || '',
      tags: (source.tags || []).join(', '),
      technologies: (source.technologies || []).join(', '),
      uiLocation: source.uiLocation || '',
      content: '', // content is fetched lazily? keep simple: must re-paste to change
    });
    setShowForm(true);
  };

  const saveDraft = async () => {
    setBusy('draft');
    setError(null);
    try {
      const body: Record<string, unknown> = {
        sourceId: draft.sourceId,
        slug: draft.slug.trim(),
        entityType: draft.entityType,
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        tags: draft.tags.split(',').map(s => s.trim()).filter(Boolean),
        technologies: draft.technologies.split(',').map(s => s.trim()).filter(Boolean),
        uiLocation: draft.uiLocation.trim() || null,
        content: draft.content,
      };
      const res = await fetch('/api/admin/ai/content-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Save failed');
      flash('Document source saved — use Ingest to index it.');
      setShowForm(false);
      setDraft(EMPTY_DRAFT);
      await loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  };

  const onFilePicked = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setDraft(d => ({
      ...d,
      content: text,
      title: d.title || file.name.replace(/\.[^.]+$/, ''),
      slug: d.slug || file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingIndicator />
        <span className="ml-2">Loading content sources...</span>
      </div>
    );
  }

  const kindBadge = (s: SourceRow) =>
    s.kind === 'projects' ? 'Projects (pipeline)' : s.kind === 'document' ? 'Document' : 'Indexed entity';

  return (
    <div className="space-y-6" data-testid="content-source-manager">
      <div className="flex items-center justify-between">
        <Badge variant="outline">{sources.filter(s => s.enabled).length} of {sources.length} enabled</Badge>
        <div className="flex gap-2">
          <Button onClick={() => { setDraft(EMPTY_DRAFT); setShowForm(v => !v); }} size="sm" data-testid="add-document-source">
            <Plus className="h-4 w-4 mr-2" />Add document
          </Button>
          <Button onClick={loadSources} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
      )}
      {success && (
        <Alert><CheckCircle className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>
      )}

      {showForm && (
        <Card data-testid="document-source-form">
          <CardHeader><CardTitle className="text-lg">Document source</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {draft.sourceId && (
              <p className="text-xs text-muted-foreground">
                Changing slug or type performs an atomic source migration; the owned entity and chunks keep their identity.
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-sm">Slug</Label>
                <Input value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} placeholder="resume-kirill" data-testid="doc-slug" />
              </div>
              <div>
                <Label className="text-sm">Type</Label>
                <select
                  className="w-full h-9 rounded-md border bg-transparent px-3 text-sm"
                  value={draft.entityType}
                  onChange={e => setDraft({ ...draft, entityType: e.target.value })}
                  data-testid="doc-entity-type"
                >
                  {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-sm">Title</Label>
                <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Kirill — Resume" data-testid="doc-title" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">UI location (route path — empty = conversational-only)</Label>
                <Input value={draft.uiLocation} onChange={e => setDraft({ ...draft, uiLocation: e.target.value })} placeholder="/about" />
              </div>
              <div>
                <Label className="text-sm">Tags (comma-separated)</Label>
                <Input value={draft.tags} onChange={e => setDraft({ ...draft, tags: e.target.value })} placeholder="resume, experience" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Content (markdown or plain text) — or pick a .md/.txt file</Label>
              <input
                type="file"
                accept=".md,.markdown,.txt,text/plain,text/markdown"
                className="block my-2 text-sm"
                onChange={e => onFilePicked(e.target.files?.[0] ?? null)}
              />
              <textarea
                className="w-full min-h-48 rounded-md border bg-transparent p-3 text-sm font-mono"
                value={draft.content}
                onChange={e => setDraft({ ...draft, content: e.target.value })}
                placeholder={'# Heading\n\nBody text…'}
                data-testid="doc-content"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveDraft} disabled={busy === 'draft'} data-testid="doc-save">Save source</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {sources.map(source => (
          <Card key={source.sourceId} className={source.enabled ? 'border-green-200 dark:border-green-800' : 'opacity-70'}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-muted shrink-0">
                    {source.kind === 'projects' ? <Database className="h-4 w-4" /> : source.uiLocation ? <Globe className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{source.title}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                      <span>{kindBadge(source)}</span>
                      <span>{source.entityType}{source.slug ? `/${source.slug}` : ''}</span>
                      {source.kind === 'projects'
                        ? <span>{source.entities} projects · {source.chunks} chunks ({source.embedded} embedded)</span>
                        : <span>{source.chunks} chunks ({source.embedded} embedded){source.ingested === false ? ' — NOT INGESTED' : ''}</span>}
                      {source.uiLocation ? <span>page: {source.uiLocation}</span> : <span>conversational-only</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {source.kind === 'document' && (
                    <>
                      <Button size="sm" variant="outline" disabled={busy === source.sourceId} onClick={() => ingestSource(source)} data-testid={`ingest-${source.sourceId}`}>
                        Ingest
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => editSource(source)}>Edit</Button>
                      <Button size="sm" variant="outline" disabled={busy === source.sourceId} onClick={() => deleteSource(source)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Switch
                    checked={source.enabled}
                    onCheckedChange={enabled => toggleSource(source.sourceId, enabled)}
                    disabled={busy === source.sourceId}
                    data-testid={`toggle-${source.sourceId}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Toggles govern retrieval (unticked sources stay indexed but are hidden from search within ~30s).
        Documents ingest through the same stage pipeline as projects; deleting a document also removes its index entity and chunks.
      </p>
    </div>
  );
}
