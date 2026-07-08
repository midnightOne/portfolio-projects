'use client';

/**
 * MCP connection card (mcp-server task 5.1 / Req 5.1) — origin-aware,
 * copy-paste-ready client configs for the public MCP endpoint. Reads
 * window.location.origin so the snippets are correct wherever the site is
 * served (dev, staging, production) without hardcoding a domain.
 */

import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (permissions) — the text is still selectable
    }
  };

  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code>{text}</code>
      </pre>
    </div>
  );
}

export function McpConnectCard() {
  // Origin is only known client-side; render a placeholder until mounted so
  // SSR and the first client paint agree (no hydration mismatch).
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const base = origin ?? 'https://this-site';
  const url = `${base}/api/mcp`;

  const claudeCode = `claude mcp add --transport http portfolio ${url}`;

  const claudeDesktop = `{
  "mcpServers": {
    "portfolio": {
      "command": "npx",
      "args": ["mcp-remote", "${url}"]
    }
  }
}`;

  const rawJsonRpc = `curl -X POST ${url} \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
    "name":"search_portfolio",
    "arguments":{"query":"temperature control","limit":3}}}'`;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 px-4 py-3 font-mono text-sm overflow-x-auto">
        POST {url}
      </div>
      <div className="grid gap-4">
        <CopyBlock label="Claude Code" text={claudeCode} />
        <CopyBlock
          label="Claude Desktop / any stdio MCP client (claude_desktop_config.json, via mcp-remote)"
          text={claudeDesktop}
        />
        <CopyBlock label="Raw JSON-RPC (no client needed)" text={rawJsonRpc} />
      </div>
    </div>
  );
}
