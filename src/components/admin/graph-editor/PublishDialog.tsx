"use client";

/**
 * Publish dialog (Req 8.4 / D3): version note, validation results (errors
 * block, warnings — incl. PRIVATE-content Req 11.2 — don't), and the P6
 * truth: changes apply to NEW conversations only.
 */

import React from 'react';
import type { ValidationIssue } from '@/lib/ai/engine/validation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: ValidationIssue[];
  publishing: boolean;
  onPublish: (note: string) => void;
}

export function PublishDialog({ open, onOpenChange, issues, publishing, onPublish }: PublishDialogProps) {
  const [note, setNote] = React.useState('');
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish graph</DialogTitle>
          <DialogDescription>
            Publishing snapshots the draft as an immutable version and activates it atomically. Intent exemplars are
            embedded now (metered). <strong>Changes apply to new conversations</strong> — live ones keep the version
            they started under.
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 space-y-1 max-h-40 overflow-y-auto">
            <p className="text-xs font-semibold text-destructive">{errors.length} error(s) block publish:</p>
            {errors.map((iss, i) => (
              <p key={i} className="text-[11px] text-destructive leading-snug">✕ {iss.message}</p>
            ))}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 space-y-1 max-h-40 overflow-y-auto">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {warnings.length} warning(s) — publish proceeds:
            </p>
            {warnings.map((iss, i) => (
              <p key={i} className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug">⚠ {iss.message}</p>
            ))}
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs" htmlFor="publish-note">Version note</Label>
          <Textarea
            id="publish-note"
            rows={2}
            className="text-sm"
            placeholder="what changed and why"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            data-testid="publish-note"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            Cancel
          </Button>
          <Button onClick={() => onPublish(note)} disabled={publishing || errors.length > 0} data-testid="publish-confirm">
            {publishing ? 'Publishing…' : 'Publish & activate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
