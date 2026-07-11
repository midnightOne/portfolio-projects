"use client";

/**
 * Job-description intake modal (conversation-engine Req 13.4 expanded, Block
 * G3; behavior: design-ux-and-behavior §2.5/§9.4).
 *
 * The ONE purpose-built form (scoped D18 exception): paste field + file-drop
 * area. File handling is STRICTLY client-side — files are read in the browser
 * and only extracted TEXT ever leaves it (v1: plain-text files; PDF/DOCX
 * extraction is task G5). The submission feeds the existing job-analysis
 * pipeline (reflink-gated + enableJobAnalysis, enforced server-side); the
 * result renders in-modal as the LLM-written compatibility document, followed
 * by the delivery menu: spoken summary / read aloud / read in peace / email
 * me a copy (address captured against the analysis row — the send ships with
 * the H2 email channel).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Upload, Mail, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { subscribeJdForm, isJdFormOpen, setJdFormOpen } from '@/lib/ai/jd-form';

const MAX_JD_CHARS = 20_000; // mirrors the analyze-job route cap
const TEXT_FILE_RE = /\.(txt|md|markdown|text)$/i;

interface JobDescriptionModalProps {
  reflinkId?: string;
  /** Send a visitor-visible turn (delivery-menu choices speak through the conversation). */
  onVisitorTurn?: (text: string) => void;
  /** Publish assistant-facing context (analysis completion / dismissal) into the floating block. */
  onAssistantContext?: (text: string) => void;
}

type Phase = 'input' | 'processing' | 'result' | 'error';

interface AnalysisResult {
  document: string;
  overallMatch: number | null;
  analysisId: string | null;
  positionTitle: string | null;
  companyName: string | null;
}

export function JobDescriptionModal({ reflinkId, onVisitorTurn, onAssistantContext }: JobDescriptionModalProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('input');
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const submittedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOpen(isJdFormOpen());
    return subscribeJdForm((next) => {
      setOpen(next);
      if (next) {
        // fresh session per open
        setPhase('input');
        setError(null);
        setResult(null);
        setEmailState('idle');
        setEmailMessage(null);
        submittedRef.current = false;
      }
    });
  }, []);

  const close = useCallback(() => {
    if (!submittedRef.current) {
      // Honest dismissal signal (§2.5): the agent offers the read-aloud path.
      onAssistantContext?.(
        'The visitor closed the job-description form WITHOUT submitting. Do not reopen it unasked — offer to listen if they would rather read the posting aloud.'
      );
    }
    setJdFormOpen(false);
  }, [onAssistantContext]);

  const ingestFile = useCallback((file: File) => {
    if (!TEXT_FILE_RE.test(file.name)) {
      setError('For now, drop a plain-text file (.txt / .md) — or paste the posting directly. PDF/Word support is coming.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '').slice(0, MAX_JD_CHARS);
      setText((prev) => (prev.trim() ? `${prev}\n\n${content}` : content));
      setError(null);
    };
    reader.onerror = () => setError('Could not read that file — try pasting the text instead.');
    reader.readAsText(file);
  }, []);

  const submit = async () => {
    const jobDescription = text.trim();
    if (jobDescription.length < 80) {
      setError('That looks too short to be a job posting — paste the full description.');
      return;
    }
    setPhase('processing');
    setError(null);
    try {
      const res = await fetch('/api/ai/analyze-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription, reflinkId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Analysis failed — please try again.');
      }
      const analysis = data.analysis ?? {};
      const doc: string =
        typeof analysis.document === 'string' && analysis.document.trim()
          ? analysis.document
          : [
              // Fallback document assembled from the structured shape (older model outputs)
              `Overall match: ${Math.round((analysis.overallMatch ?? 0) * 100)}%`,
              analysis.strengths?.length ? `\nStrengths:\n${analysis.strengths.map((s: string) => `• ${s}`).join('\n')}` : '',
              analysis.gaps?.length ? `\nGaps:\n${analysis.gaps.map((g: string) => `• ${g}`).join('\n')}` : '',
            ].join('\n');
      const r: AnalysisResult = {
        document: doc,
        overallMatch: typeof analysis.overallMatch === 'number' ? analysis.overallMatch : null,
        analysisId: data.metadata?.analysisId ?? null,
        positionTitle: data.metadata?.positionTitle ?? null,
        companyName: data.metadata?.companyName ?? null,
      };
      submittedRef.current = true;
      setResult(r);
      setPhase('result');
      // The agent learns the outcome through the floating block and offers the
      // delivery menu conversationally (Req 13.4; the modal buttons are the
      // visitor's direct rail to the same choices).
      onAssistantContext?.(
        `JOB ANALYSIS COMPLETED (the visitor sees the compatibility document in a modal right now). Role: ${r.positionTitle ?? 'unknown'} at ${r.companyName ?? 'unknown'}; overall match ${r.overallMatch !== null ? Math.round(r.overallMatch * 100) + '%' : 'n/a'}. Offer — without pushing — a spoken summary, a full read-aloud, or to let them read in peace; they can also have the document emailed from the modal.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed — please try again.');
      setPhase('error');
    }
  };

  const requestEmail = async () => {
    if (!result?.analysisId || emailState === 'sending') return;
    setEmailState('sending');
    try {
      const res = await fetch('/api/ai/analyze-job/email-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // reflinkId authorizes the tier (the gateway reads it from the body,
        // same as the analysis call) — the ownership check then binds the
        // analysisId to this same reflink server-side.
        body: JSON.stringify({ analysisId: result.analysisId, email: email.trim(), reflinkId }),
      });
      if (!res.ok) throw new Error('bad response');
      // G6: the server says what actually happened — sent now vs. recorded
      // for later dispatch. Show its copy verbatim (honest, under-promising).
      const data = await res.json().catch(() => ({}));
      if (typeof data.message === 'string') setEmailMessage(data.message);
      setEmailState('done');
    } catch {
      setEmailState('error');
    }
  };

  const copyDocument = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.document);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is selectable */
    }
  };

  const deliveryChoice = (utterance: string) => {
    onVisitorTurn?.(utterance);
    setJdFormOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
          onClick={close}
          data-testid="jd-form-modal"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-foreground">
                  {phase === 'result' ? 'Compatibility analysis' : 'Analyze a job posting'}
                </h2>
              </div>
              <button onClick={close} className="text-muted-foreground hover:text-foreground" aria-label="Close" data-testid="jd-form-close">
                <X size={18} />
              </button>
            </div>

            {(phase === 'input' || phase === 'error') && (
              <div className="p-5 space-y-3">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) ingestFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition-colors',
                    dragOver ? 'border-primary bg-primary/5' : 'border-border/70 hover:border-primary/50'
                  )}
                  data-testid="jd-form-drop"
                >
                  <Upload className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-foreground">Drop a text file here (.txt / .md) or click to pick one</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Files are read in your browser — only the text is sent for analysis.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.markdown,.text,text/plain,text/markdown"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) ingestFile(file);
                      e.target.value = '';
                    }}
                  />
                </div>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_JD_CHARS))}
                  placeholder="…or paste the job description here"
                  rows={8}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/60 resize-y"
                  data-testid="jd-form-text"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{text.length.toLocaleString()} / {MAX_JD_CHARS.toLocaleString()}</span>
                  <button
                    onClick={submit}
                    disabled={text.trim().length === 0}
                    className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    data-testid="jd-form-submit"
                  >
                    Analyze fit
                  </button>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            )}

            {phase === 'processing' && (
              <div className="p-10 text-center space-y-4" data-testid="jd-form-processing">
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Comparing the posting against real portfolio evidence — this takes a few seconds.
                </p>
              </div>
            )}

            {phase === 'result' && result && (
              <div className="p-5 space-y-4">
                {result.overallMatch !== null && (
                  <div className="text-sm text-muted-foreground">
                    {result.positionTitle && <span className="text-foreground font-medium">{result.positionTitle}</span>}
                    {result.companyName && <span> at {result.companyName}</span>}
                    <span> — overall match {Math.round(result.overallMatch * 100)}%</span>
                  </div>
                )}
                <div
                  className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto"
                  data-testid="jd-form-document"
                >
                  {result.document}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => deliveryChoice('Give me a quick spoken summary of the analysis.')}
                    className="px-3 py-1.5 rounded-md border border-border text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    Quick summary
                  </button>
                  <button
                    onClick={() => deliveryChoice('Please read the full analysis to me.')}
                    className="px-3 py-1.5 rounded-md border border-border text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    Read it to me
                  </button>
                  <button
                    onClick={close}
                    className="px-3 py-1.5 rounded-md border border-border text-sm text-foreground hover:bg-muted/50 transition-colors"
                  >
                    I&apos;ll read it myself
                  </button>
                  <button
                    onClick={copyDocument}
                    className="px-3 py-1.5 rounded-md border border-border text-sm text-foreground hover:bg-muted/50 transition-colors inline-flex items-center gap-1.5"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="border-t border-border/50 pt-3">
                  {emailState === 'done' ? (
                    <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                      <Check size={14} className="text-green-500" />{' '}
                      {emailMessage ?? 'Noted — the analysis will be emailed to you.'}
                    </p>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <Mail size={14} className="text-muted-foreground flex-shrink-0" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email me a copy"
                        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/60"
                        data-testid="jd-form-email"
                      />
                      <button
                        onClick={requestEmail}
                        disabled={!email.includes('@') || emailState === 'sending'}
                        className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                        data-testid="jd-form-email-send"
                      >
                        {emailState === 'sending' ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  )}
                  {emailState === 'error' && (
                    <p className="text-xs text-red-500 mt-1">Could not record that address — try again.</p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
