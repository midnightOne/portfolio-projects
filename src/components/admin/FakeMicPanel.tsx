'use client';

/**
 * Fake Mic panel (D53 / verification task 4.4) — drives the REAL OpenAI Realtime
 * voice path with synthesized speech: TTS audio is played into an emulated
 * microphone track (SyntheticMicDriver) that the adapter uses as its input.
 * Lets an automated agent (or a mic-less owner) exercise mic → provider STT →
 * model → TTS out end-to-end. Renders only when the dev TTS route is available
 * (never in production — the route 404s there).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Radio, Square } from 'lucide-react';
import { useConversationalAgent } from '@/components/providers/conversational-agent-provider';
import { SyntheticMicDriver } from '@/lib/voice/dev/SyntheticMicDriver';

const DEFAULT_SCRIPT = 'How does the kiln project regulate its temperature?';

export function FakeMicPanel() {
  const { connect, disconnect, resumeOnProvider, isConnected, audioInputMode } = useConversationalAgent();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [status, setStatus] = useState<string>('idle');
  const [busy, setBusy] = useState(false);
  const driverRef = useRef<SyntheticMicDriver | null>(null);

  useEffect(() => {
    let cancelled = false;
    SyntheticMicDriver.isAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
      driverRef.current?.close();
      driverRef.current = null;
    };
  }, []);

  if (available === false || available === null) {
    return null; // production or probe failed — the panel simply doesn't exist
  }

  const connectedSynthetic = isConnected && audioInputMode === 'synthetic';

  const handleConnect = async () => {
    setBusy(true);
    setStatus('connecting with synthetic mic…');
    try {
      if (!driverRef.current) {
        driverRef.current = new SyntheticMicDriver();
        // Dev-only hook for automated e2e drivers (Playwright / agent preview tools).
        (window as unknown as { __syntheticMic?: SyntheticMicDriver }).__syntheticMic = driverRef.current;
      }
      await connect({ audioInput: false, syntheticInputStream: driverRef.current.stream });
      setStatus('connected (synthetic mic)');
    } catch (error) {
      setStatus(`connect failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSpeak = async () => {
    const driver = driverRef.current;
    if (!driver || !script.trim()) return;
    setBusy(true);
    setStatus('synthesizing + speaking into the session…');
    try {
      const { durationMs } = await driver.speak(script.trim());
      setStatus(`spoke ${Math.round(durationMs / 100) / 10}s of audio — awaiting model turn`);
    } catch (error) {
      setStatus(`speak failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = () => {
    driverRef.current?.stop();
    setStatus('utterance stopped');
  };

  return (
    <Card data-testid="fake-mic-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Radio className="h-4 w-4" />
          Fake Mic — synthesized-audio voice e2e (D53, dev only)
          <Badge variant="outline" className="text-xs">real provider path</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Speaks TTS-generated audio into an emulated microphone track feeding the real
          OpenAI Realtime session — mic → provider STT → model → TTS out, no human speaker.
          Turns persist to conversation history like any voice session.
        </p>
        <div className="flex gap-2">
          {!connectedSynthetic ? (
            <Button
              onClick={handleConnect}
              disabled={busy || isConnected}
              size="sm"
              data-testid="fake-mic-connect"
            >
              <Mic className="h-4 w-4 mr-2" />
              Connect with fake mic
            </Button>
          ) : (
            <Button onClick={() => disconnect()} variant="destructive" size="sm" data-testid="fake-mic-disconnect">
              Disconnect
            </Button>
          )}
          {isConnected && !connectedSynthetic && (
            <span className="text-xs text-amber-600 self-center">
              already connected in {audioInputMode ?? 'unknown'} mode — disconnect first
            </span>
          )}
        </div>
        <Textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Scripted question to speak into the session…"
          rows={2}
          data-testid="fake-mic-text"
        />
        <div className="flex gap-2">
          <Button
            onClick={handleSpeak}
            disabled={busy || !connectedSynthetic || !script.trim()}
            size="sm"
            data-testid="fake-mic-speak"
          >
            <Radio className="h-4 w-4 mr-2" />
            Speak into session
          </Button>
          <Button onClick={handleStop} variant="outline" size="sm" disabled={!connectedSynthetic}>
            <Square className="h-4 w-4 mr-2" />
            Stop utterance
          </Button>
        </div>
        <div className="text-xs font-mono bg-muted/40 rounded p-2" data-testid="fake-mic-status">
          {status}
        </div>

        {/* D49 resume drills (verification 7.3b) */}
        <div className="border-t pt-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Resume drills (D49) — disruption is auto-detected and auto-resumed by the adapter
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!isConnected}
              data-testid="drill-force-drop"
              onClick={() => {
                const adapter = (globalThis as any).getGlobalOpenAIAdapter?.();
                if (adapter?.forceDropConnection) {
                  adapter.forceDropConnection();
                  setStatus('connection force-dropped — watching for auto-resume');
                } else {
                  setStatus('force-drop unavailable (no OpenAI adapter)');
                }
              }}
            >
              Force drop (drill)
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!isConnected}
              data-testid="drill-resume-elevenlabs"
              onClick={async () => {
                setStatus('switching to ElevenLabs with resume…');
                try {
                  await resumeOnProvider('elevenlabs');
                  setStatus('resumed on ElevenLabs');
                } catch (error) {
                  setStatus(`cross-provider resume failed: ${error instanceof Error ? error.message : String(error)}`);
                }
              }}
            >
              Resume on ElevenLabs
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
