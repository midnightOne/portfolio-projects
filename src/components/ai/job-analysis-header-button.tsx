"use client";

/**
 * Header entry point for the job-description analysis (Req 13.4, G3 — owner
 * 2026-07-11: the pill shows too much already; this belongs in the site
 * header). Opens the same modal the `job_description_form` client tool opens
 * (jd-form store); all spend/abuse protection stays server-side in the
 * gateway. Shown only when the visitor's reflink session has job analysis
 * enabled — read from the session cache the ReflinkSessionProvider maintains
 * (this button renders OUTSIDE that provider), refreshed on the provider's
 * `ai-session-updated` event.
 */

import React, { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setJdFormOpen } from '@/lib/ai/jd-form';

function jobAnalysisEnabled(): boolean {
  try {
    const raw = sessionStorage.getItem('ai_reflink_session');
    if (!raw) return false;
    const session = JSON.parse(raw) as { reflink?: { enableJobAnalysis?: boolean } };
    return session?.reflink?.enableJobAnalysis !== false && !!session?.reflink;
  } catch {
    return false;
  }
}

export function JobAnalysisHeaderButton({ className }: { className?: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const refresh = () => setEnabled(jobAnalysisEnabled());
    refresh();
    window.addEventListener('ai-session-updated', refresh);
    return () => window.removeEventListener('ai-session-updated', refresh);
  }, []);

  if (!enabled) return null;

  return (
    <button
      onClick={() => setJdFormOpen(true)}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
        'hover:bg-accent hover:text-accent-foreground text-foreground',
        className
      )}
      title="Analyze a job posting against this portfolio"
      data-testid="jd-header-button"
    >
      <Briefcase className="h-4 w-4" />
      <span className="hidden lg:inline">Job fit</span>
    </button>
  );
}
