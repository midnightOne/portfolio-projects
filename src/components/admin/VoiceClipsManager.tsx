'use client';

/**
 * D50 voice-clip management (ai-assistant 9b.2, owner-shaped 2026-07-08):
 * categories hold several randomized phrase variants; clips render per
 * configured provider voice (strict voice match — openai/google/cascade each
 * get their own set through their own TTS engine). Phrases are editable here;
 * "Regenerate" renders every enabled phrase for one or all voices.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Mic2, Plus, RefreshCw, Trash2, Volume2 } from 'lucide-react';

interface Phrase { id: string; text: string; tag: string; enabled: boolean; sortOrder: number }
interface Target { sessionProvider: string; voiceId: string; ttsModel: string }
interface ClipRow { voiceId: string; phraseId: string; provider: string; modelId: string; updatedAt: string; stale: boolean }

const TRIGGER_TAGS = ['filler', 'disruption', 'resume_failed', 'greeting'];
const TAG_HINTS: Record<string, string> = {
  filler: 'Plays when a tool call runs and the model is silent (~1.2s). Randomized per play.',
  disruption: 'Plays client-side while the D49 reconnect runs — no model exists to speak.',
  resume_failed: 'Plays when the reconnect gives up.',
  greeting: 'Optional cold-start greeting (disabled phrases are never rendered).',
};

export function VoiceClipsManager() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [clips, setClips] = useState<ClipRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [regenBusy, setRegenBusy] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [newTag, setNewTag] = useState('filler');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ai/voice-clips').then((r) => r.json());
      if (!res.success) throw new Error(res.error || 'Failed to load');
      setPhrases(res.phrases);
      setTargets(res.targets);
      setClips(res.clips);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const savePhrase = async (phrase: Partial<Phrase> & { id: string }) => {
    const existing = phrases.find((p) => p.id === phrase.id);
    const res = await fetch('/api/admin/ai/voice-clips', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...existing, ...phrase }),
    }).then((r) => r.json());
    if (!res.success) {
      setError(res.error || 'Save failed');
      return;
    }
    await load();
  };

  const addPhrase = async () => {
    const text = newText.trim();
    if (!text) return;
    const slugBase = newTag.replace(/[^a-z0-9_]/g, '');
    const id = `${slugBase}_${Date.now().toString(36)}`;
    await savePhrase({ id, text, tag: newTag, enabled: true, sortOrder: phrases.filter((p) => p.tag === newTag).length });
    setNewText('');
  };

  const deletePhrase = async (id: string) => {
    if (!confirm(`Delete phrase "${id}" and its rendered clips?`)) return;
    await fetch(`/api/admin/ai/voice-clips?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  };

  const regenerate = async (provider?: string) => {
    setRegenBusy(provider ?? 'all');
    setError(null);
    try {
      const res = await fetch('/api/admin/ai/voice-clips/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provider ? { provider } : {}),
      }).then((r) => r.json());
      if (!res.success) {
        const failures = (res.targets ?? [])
          .flatMap((t: { voiceId: string; failed: Array<{ phraseId: string; error: string }> }) =>
            t.failed.map((f) => `${t.voiceId}/${f.phraseId}: ${f.error}`));
        setError(failures.length ? `Some clips failed: ${failures.slice(0, 3).join(' | ')}` : res.error || 'Regeneration failed');
      }
      await load();
    } finally {
      setRegenBusy(null);
    }
  };

  const tags = [...new Set([...TRIGGER_TAGS, ...phrases.map((p) => p.tag)])];
  const clipCount = (voiceId: string) => clips.filter((c) => c.voiceId === voiceId).length;
  const staleCount = (voiceId: string) => clips.filter((c) => c.voiceId === voiceId && c.stale).length;
  const clipFor = (phraseId: string, voiceId: string) => clips.find((c) => c.phraseId === phraseId && c.voiceId === voiceId);

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded p-2" data-testid="clips-error">
          {error}
        </div>
      )}

      {/* Voices (one per configured session provider) + regeneration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Voices
            <span className="text-xs font-normal text-muted-foreground">
              one clip set per configured provider voice — a session only ever plays its own voice
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {targets.map((t) => (
              <div key={t.sessionProvider} className="rounded border p-3 space-y-2" data-testid={`clip-target-${t.sessionProvider}`}>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{t.sessionProvider}</Badge>
                  <span className="text-xs text-muted-foreground">{t.ttsModel}</span>
                </div>
                <div className="text-sm font-mono truncate" title={t.voiceId}>{t.voiceId}</div>
                <div className="text-xs text-muted-foreground">
                  {clipCount(t.voiceId)} clips
                  {staleCount(t.voiceId) > 0 && (
                    <span className="text-amber-600 dark:text-amber-400"> · {staleCount(t.voiceId)} stale</span>
                  )}
                </div>
                <Button size="sm" variant="outline" disabled={!!regenBusy} onClick={() => regenerate(t.sessionProvider)}>
                  {regenBusy === t.sessionProvider ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                  Regenerate
                </Button>
              </div>
            ))}
          </div>
          <Button size="sm" disabled={!!regenBusy} onClick={() => regenerate()} data-testid="clips-regenerate-all">
            {regenBusy === 'all' ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Regenerate all voices
          </Button>
        </CardContent>
      </Card>

      {/* Phrase script, grouped by category */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic2 className="h-4 w-4" />
            Phrases
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Add */}
          <div className="flex gap-2 items-center flex-wrap">
            <select
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              data-testid="clips-new-tag"
            >
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Input
              placeholder="New phrase text…"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPhrase()}
              className="flex-1 min-w-[240px]"
              data-testid="clips-new-text"
            />
            <Button size="sm" onClick={addPhrase} disabled={!newText.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          {tags.filter((tag) => phrases.some((p) => p.tag === tag) || TRIGGER_TAGS.includes(tag)).map((tag) => (
            <div key={tag} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm font-medium">{tag}</h3>
                <span className="text-xs text-muted-foreground">{TAG_HINTS[tag] ?? 'Custom category (not trigger-wired yet).'}</span>
              </div>
              <div className="space-y-1.5">
                {phrases.filter((p) => p.tag === tag).map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded border px-2 py-1.5" data-testid="clip-phrase-row">
                    <button
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${p.enabled ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300' : 'bg-muted text-muted-foreground'}`}
                      onClick={() => savePhrase({ id: p.id, enabled: !p.enabled })}
                      title="Toggle enabled"
                    >
                      {p.enabled ? 'on' : 'off'}
                    </button>
                    <span className="flex-1 text-sm">{p.text}</span>
                    <span className="flex gap-1">
                      {targets.map((t) => {
                        const clip = clipFor(p.id, t.voiceId);
                        return (
                          <span
                            key={t.sessionProvider}
                            title={clip ? `${t.sessionProvider}: rendered ${new Date(clip.updatedAt).toLocaleString()}${clip.stale ? ' (text changed since — stale)' : ''}` : `${t.sessionProvider}: no clip yet`}
                            className={`h-2 w-2 rounded-full ${clip ? (clip.stale ? 'bg-amber-400' : 'bg-green-500') : 'bg-muted-foreground/30'}`}
                          />
                        );
                      })}
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600 dark:text-red-400" onClick={() => deletePhrase(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {phrases.filter((p) => p.tag === tag).length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No phrases yet.</p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
