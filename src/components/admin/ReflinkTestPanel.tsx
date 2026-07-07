'use client';

/**
 * Reflink test-session panel for /admin/ai/voice-debug (owner request, 2026-07-07)
 *
 * Runs the voice-debug session under a specific reflink — or creates a fresh
 * test reflink with a chosen tier — by applying `?ref=<code>` and reloading.
 * That drives the REAL production reflink flow (ReflinkSessionProvider reads
 * the URL param), not a parallel debug path (D56).
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReflinkRow {
  id: string;
  code: string;
  name?: string | null;
  rateLimitTier: string;
  enableVoiceAI: boolean;
  isActive: boolean;
}

const TIERS = ['BASIC', 'STANDARD', 'PREMIUM', 'UNLIMITED'];

export function ReflinkTestPanel() {
  const { toast } = useToast();
  const [reflinks, setReflinks] = useState<ReflinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [newTier, setNewTier] = useState<string>('PREMIUM');
  const [activeRef, setActiveRef] = useState<string | null>(null);

  useEffect(() => {
    setActiveRef(new URLSearchParams(window.location.search).get('ref'));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai/reflinks?limit=50');
      const data = await res.json();
      const rows: ReflinkRow[] = data.data?.reflinks ?? data.data ?? [];
      setReflinks(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Failed to load reflinks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyRef = (code: string | null) => {
    const url = new URL(window.location.href);
    if (code) {
      url.searchParams.set('ref', code);
    } else {
      url.searchParams.delete('ref');
    }
    // Full reload on purpose: the reflink session initializes from the URL at
    // mount — same path a visitor's reflink takes.
    window.location.href = url.toString();
  };

  const createTestReflink = async () => {
    setCreating(true);
    try {
      const code = `voice-test-${newTier.toLowerCase()}-${Date.now().toString(36)}`;
      const res = await fetch('/api/admin/ai/reflinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name: `Voice debug test (${newTier})`,
          description: 'Created from /admin/ai/voice-debug for session testing',
          rateLimitTier: newTier,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
      }
      toast({ title: 'Test reflink created', description: code });
      applyRef(code);
    } catch (error) {
      toast({
        title: 'Create failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Test session reflink
          {activeRef ? (
            <Badge variant="default" className="font-mono text-xs">ref: {activeRef}</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">admin session (no reflink)</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Run this page&apos;s voice session under a specific reflink (applies <code>?ref=</code> and
          reloads — the exact flow a visitor&apos;s reflink takes).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedCode} onValueChange={setSelectedCode} disabled={loading}>
            <SelectTrigger className="w-72 h-8">
              <SelectValue placeholder={loading ? 'Loading reflinks…' : 'Select an existing reflink'} />
            </SelectTrigger>
            <SelectContent>
              {reflinks.map((r) => (
                <SelectItem key={r.id} value={r.code}>
                  <span className="font-mono text-xs">{r.code}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.rateLimitTier}{r.enableVoiceAI ? ' · voice' : ''}{r.isActive ? '' : ' · inactive'}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" disabled={!selectedCode} onClick={() => applyRef(selectedCode)}>
            Use reflink
          </Button>
          {activeRef && (
            <Button size="sm" variant="outline" className="h-8" onClick={() => applyRef(null)}>
              <X className="h-3 w-3 mr-1" /> Clear (back to admin session)
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">or create a fresh test reflink:</span>
          <Select value={newTier} onValueChange={setNewTier}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIERS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8" disabled={creating} onClick={createTestReflink}>
            {creating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
            Create &amp; use
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
