'use client';

/**
 * Default voice provider panel (owner, 2026-07-09): which voice adapter family
 * the public pill serves by default — OpenAI Realtime, Gemini Live, or the D45
 * cascade. Stored on AIPublicAccessSettings; the pill reads it at mount via
 * GET /api/ai/voice-config (no provider param). Per-provider model/voice
 * details stay in Voice Configuration; this is only the site-wide default.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

const VOICE_PROVIDERS: Array<{ id: 'openai' | 'google' | 'cascade'; label: string; hint: string }> = [
  { id: 'openai', label: 'OpenAI Realtime', hint: 'native speech-to-speech (default-realtime alias)' },
  { id: 'google', label: 'Google Gemini Live', hint: 'native speech-to-speech' },
  { id: 'cascade', label: 'Cascade (STT → LLM → TTS)', hint: 'text-pipeline brain with a voice layered on (D45)' },
];

export function DefaultVoiceProviderPanel() {
  const toast = useToast();
  const [value, setValue] = useState<string>('');
  const [savedValue, setSavedValue] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/public-access-settings');
      const row = await res.json();
      if (res.ok && row.defaultVoiceProvider) {
        setValue(row.defaultVoiceProvider);
        setSavedValue(row.defaultVoiceProvider);
      }
    } catch (error) {
      console.error('Failed to load default voice provider:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai/public-access-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultVoiceProvider: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Save failed');
      }
      setSavedValue(value);
      const label = VOICE_PROVIDERS.find((p) => p.id === value)?.label ?? value;
      toast.success('Default voice provider saved', `Visitors now get ${label} by default`);
    } catch (error) {
      toast.error('Save failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const selected = VOICE_PROVIDERS.find((p) => p.id === value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default voice provider</CardTitle>
        <CardDescription>
          The voice adapter family visitors get when they open the assistant. Per-provider models,
          voices, and VAD live in Voice Configuration; sessions can still switch providers where allowed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="w-72 h-8">
                <SelectValue placeholder="Pick a provider" />
              </SelectTrigger>
              <SelectContent>
                {VOICE_PROVIDERS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8" disabled={saving || !value || value === savedValue} onClick={save}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </Button>
            {value === savedValue && value && (
              <Badge variant="outline" className="text-xs">active</Badge>
            )}
            {selected && <span className="text-xs text-muted-foreground">{selected.hint}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
