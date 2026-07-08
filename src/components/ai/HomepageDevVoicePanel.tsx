'use client';

/**
 * Dev-only fake-mic drill affordance for the LIVE homepage (owner, 2026-07-07).
 * Reuses the same FakeMicPanel/SyntheticMicDriver already built for
 * /admin/ai/voice-debug — no separate OS-level device driver — so ui_intent
 * and content tools can be exercised against REAL portfolio UI state
 * (routes/projects/sections), which the isolated admin debug page doesn't have.
 * Rendered only when the server has confirmed an admin session (see
 * src/app/page.tsx); FakeMicPanel itself additionally self-hides in production
 * via SyntheticMicDriver.isAvailable().
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Mic, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useConversationalAgent } from '@/components/providers/conversational-agent-provider';
import { FakeMicPanel } from '@/components/admin/FakeMicPanel';
import type { VoiceProvider } from '@/types/voice-agent';

export function HomepageDevVoicePanel() {
  const { state, switchProvider, isConnected } = useConversationalAgent();
  const [collapsed, setCollapsed] = useState(true);
  const selectedProvider = state.activeProvider || 'openai';

  const handleSwitch = async (provider: VoiceProvider) => {
    if (selectedProvider === provider || isConnected) return;
    try {
      await switchProvider(provider);
    } catch (error) {
      console.error('Dev panel: provider switch failed:', error);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-[9999] max-w-sm" data-testid="homepage-dev-voice-panel">
      <div className="bg-background border rounded-lg shadow-lg">
        <button
          className="w-full flex items-center justify-between gap-2 p-2 text-xs font-medium text-muted-foreground"
          onClick={() => setCollapsed(c => !c)}
        >
          <span>Dev: Fake Mic (homepage, admin-only)</span>
          {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {!collapsed && (
          <div className="p-2 pt-0 space-y-2">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={selectedProvider === 'openai' ? 'default' : 'outline'}
                onClick={() => handleSwitch('openai')}
                disabled={isConnected}
                className="flex-1 text-xs h-7"
              >
                <Bot className="w-3 h-3 mr-1" /> OpenAI
              </Button>
              <Button
                size="sm"
                variant={selectedProvider === 'google' ? 'default' : 'outline'}
                onClick={() => handleSwitch('google')}
                disabled={isConnected}
                className="flex-1 text-xs h-7"
              >
                <Sparkles className="w-3 h-3 mr-1" /> Gemini
              </Button>
              <Button
                size="sm"
                variant={selectedProvider === 'cascade' ? 'default' : 'outline'}
                onClick={() => handleSwitch('cascade')}
                disabled={isConnected}
                className="flex-1 text-xs h-7"
                data-testid="homepage-provider-cascade"
              >
                <Mic className="w-3 h-3 mr-1" /> Cascade
              </Button>
            </div>
            <Badge variant="outline" className="text-xs">{selectedProvider}</Badge>
            <FakeMicPanel />
          </div>
        )}
      </div>
    </div>
  );
}
