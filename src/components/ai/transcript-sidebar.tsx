"use client";

/**
 * TranscriptSidebar (ui-system task 3.4) — the chat history graduates from
 * an in-pill scroll area to a proper right sidebar (owner 2026-07-10: "the
 * pill parts moving into a proper position inside of the sidebar"). The pill
 * itself becomes an integrated rounded-rect PANEL at the sidebar's foot
 * (owner 2026-07-12: a shape close to the rectangular sidebar's own, so only
 * the corners give up space) via the GSAP layout timeline in
 * floating-ai-interface.tsx; this component owns the panel, the slide
 * choreography, and the message list.
 *
 * Desktop: the sidebar CO-EXISTS with the page (owner 2026-07-12) — the page
 * content is pushed narrower by the sidebar width (body padding, same
 * timeline), as if the window were resized; nothing is covered.
 *
 * Mobile (below `sidebar.overlayBreakpoint`): no room to co-exist — the
 * history temporarily covers the screen and the pill (fused into the bottom
 * edge) toggles it closed again in one tap (§9.3).
 *
 * An AI surface (task 3.7): sits on the AI z-layer above any modal and is
 * marked data-ai-surface so interacting with it never dismisses one.
 */

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { X, MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIVisualConfig } from '@/lib/ui/ai-visual-config-context';

export interface TranscriptMessage {
  id: string;
  type: 'user_speech' | 'ai_response';
  content: string;
}

export interface TranscriptSidebarProps {
  open: boolean;
  onClose: () => void;
  messages: TranscriptMessage[];
  /** Full-screen overlay mode (phone). */
  compact: boolean;
  /** Vertical room to reserve at the foot for the relocated pill, px. */
  pillDockHeight: number;
}

export function TranscriptSidebar({
  open,
  onClose,
  messages,
  compact,
  pillDockHeight,
}: TranscriptSidebarProps) {
  const config = useAIVisualConfig();
  const panelRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  // Slide choreography (GSAP inherits reduced-motion timeScale — near-instant
  // there). Desktop slides from the right edge; the phone overlay fades.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const closedX = compact ? 0 : 100;
    if (!mountedRef.current) {
      mountedRef.current = true;
      gsap.set(panel, open ? { xPercent: 0, autoAlpha: 1 } : { xPercent: closedX, autoAlpha: 0 });
      return;
    }
    const tween = gsap.to(panel, {
      xPercent: open ? 0 : closedX,
      autoAlpha: open ? 1 : 0,
      duration: config.morph.sidebarDuration,
      ease: config.morph.sidebarEase,
      overwrite: true,
    });
    return () => {
      tween.kill();
    };
  }, [open, compact, config.morph]);

  // Keep the latest turn in view.
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, open]);

  return (
    <div
      ref={panelRef}
      data-ai-surface="true"
      data-testid="transcript-sidebar"
      role="log"
      aria-label="Conversation history"
      aria-hidden={!open}
      className={cn(
        'fixed flex flex-col bg-background/95 backdrop-blur-lg',
        compact ? 'inset-0' : 'top-0 bottom-0 right-0 border-l border-border/60 shadow-2xl'
      )}
      style={{
        zIndex: config.zLayers.aiSidebar,
        width: compact ? undefined : config.sidebar.width,
        visibility: 'hidden', // GSAP autoAlpha owns visibility from the first toggle
        pointerEvents: open ? 'auto' : 'none',
        backgroundColor: compact ? `color-mix(in oklab, var(--background) ${Math.round((1 - config.sidebar.overlayTint) * 100)}%, transparent)` : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MessagesSquare size={15} className="text-primary" />
          Conversation
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          aria-label="Close conversation history"
          data-testid="transcript-sidebar-close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Message list */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2"
        data-testid="chat-transcript"
        style={{ paddingBottom: pillDockHeight + 16 }}
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground/70 text-center mt-8">
            No messages yet — say something or type below.
          </p>
        )}
        {messages.map((msg) => {
          const isUser = msg.type === 'user_speech';
          return (
            <div
              key={msg.id}
              className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
              data-testid={isUser ? 'chat-msg-user' : 'chat-msg-ai'}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                  isUser
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                )}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
