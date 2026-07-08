import type {
  ReasoningAdapter,
  ReasoningChatOptions,
  ReasoningMessage,
  ReasoningResult,
  ReasoningToolCall,
} from './types';

/**
 * Google (Gemini) reasoning adapter (D39). Talks to the native generateContent
 * REST API directly — no SDK dependency; the seam's interface stays ours.
 * Requires GOOGLE_API_KEY (D3: env only).
 */
export class GoogleReasoningAdapter implements ReasoningAdapter {
  readonly provider = 'google';

  constructor(readonly modelId: string) {}

  async chat(messages: ReasoningMessage[], options?: ReasoningChatOptions): Promise<ReasoningResult> {
    // Google's docs use GEMINI_API_KEY; GOOGLE_API_KEY kept as the spec'd name (D3)
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY/GEMINI_API_KEY is not configured');
    }

    const systemText = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    // Gemini contents: roles are 'user' | 'model'; tool results are functionResponse
    // parts on a user turn; prior tool calls are functionCall parts on a model turn.
    type Part = Record<string, unknown>;
    const contents: Array<{ role: 'user' | 'model'; parts: Part[] }> = [];
    for (const m of messages) {
      if (m.role === 'system') continue;
      if (m.role === 'tool') {
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: m.name ?? m.toolCallId ?? 'tool',
                response: { result: m.content },
              },
            },
          ],
        });
        continue;
      }
      if (m.role === 'assistant') {
        const parts: Part[] = [];
        if (m.content) parts.push({ text: m.content });
        for (const tc of m.toolCalls ?? []) {
          parts.push({ functionCall: { name: tc.name, args: safeParseJson(tc.arguments) } });
        }
        if (parts.length) contents.push({ role: 'model', parts });
        continue;
      }
      contents.push({ role: 'user', parts: [{ text: m.content }] });
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options?.maxOutputTokens !== undefined ? { maxOutputTokens: options.maxOutputTokens } : {}),
      },
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      ...(options?.tools?.length
        ? {
            tools: [
              {
                functionDeclarations: options.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  parameters: stripUnsupportedSchemaKeys(t.parameters),
                })),
              },
            ],
          }
        : {}),
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelId)}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Google generateContent failed (${response.status}): ${detail.slice(0, 500)}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<Record<string, any>> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    let content: string | null = null;
    const toolCalls: ReasoningToolCall[] = [];
    for (const part of data.candidates?.[0]?.content?.parts ?? []) {
      if (typeof part.text === 'string') {
        content = (content ?? '') + part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          // Gemini has no call ids; synthesize one so the tool-loop protocol holds.
          id: `${part.functionCall.name}-${toolCalls.length}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args ?? {}),
        });
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      modelId: this.modelId,
      provider: this.provider,
    };
  }
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Merge a `oneOf`/`anyOf` union of object variants into one permissive object
 * schema: properties are unioned (same-key enums combined rather than one
 * overwriting another), `required` is the intersection across variants (only
 * fields every variant needs — e.g. a shared `type` discriminator).
 */
function flattenUnion(node: Record<string, unknown>, variants: unknown[]): Record<string, unknown> {
  const mergedProps: Record<string, any> = {};
  let commonRequired: Set<string> | null = null;

  for (const variant of variants) {
    if (!variant || typeof variant !== 'object') continue;
    const v = variant as Record<string, unknown>;
    const props = (v.properties ?? {}) as Record<string, any>;
    for (const [k, propSchema] of Object.entries(props)) {
      const existing = mergedProps[k];
      if (existing && Array.isArray(existing.enum) && Array.isArray(propSchema?.enum)) {
        existing.enum = Array.from(new Set([...existing.enum, ...propSchema.enum]));
      } else if (!existing) {
        mergedProps[k] = { ...propSchema };
      }
    }
    const req = new Set((v.required as string[] | undefined) ?? []);
    commonRequired = commonRequired === null ? req : new Set(Array.from(commonRequired as Set<string>).filter((x) => req.has(x)));
  }

  const { oneOf: _oneOf, anyOf: _anyOf, ...rest } = node;
  return {
    ...rest,
    type: 'object',
    properties: mergedProps,
    required: Array.from(commonRequired ?? []),
  };
}

/**
 * Gemini's schema dialect rejects some JSON-Schema keys (e.g. additionalProperties,
 * $schema), and its `enum` field is `repeated string` — numeric enums (e.g. a
 * `maxTier` param typed `enum: [1, 2, 3]`) must be coerced to strings or the
 * auth_tokens/generateContent call fails with "Invalid value ... (TYPE_STRING)".
 * It also has no `oneOf`/`anyOf` support — the Live API accepted a `oneOf` union
 * (ui_intent's polymorphic `target`) at token-mint time but crashed server-side
 * (WS close 1011 "Internal error") the moment the model tried to construct a
 * call against it, so unions are flattened into one permissive object schema
 * instead of rejected outright — client-side validation still narrows per
 * target.type afterward, this only loosens what the model itself sees.
 */
export function stripUnsupportedSchemaKeys(schema: Record<string, unknown>): Record<string, unknown> {
  const UNSUPPORTED = new Set(['additionalProperties', '$schema', 'examples', 'default']);
  const walk = (node: unknown, key?: string): unknown => {
    if (Array.isArray(node)) {
      return key === 'enum' ? node.map(v => String(v)) : node.map(v => walk(v));
    }
    if (node && typeof node === 'object') {
      let obj = node as Record<string, unknown>;
      const union = (obj.oneOf ?? obj.anyOf) as unknown[] | undefined;
      if (Array.isArray(union)) {
        obj = flattenUnion(obj, union);
      }
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (UNSUPPORTED.has(k)) continue;
        out[k] = walk(v, k);
      }
      return out;
    }
    return node;
  };
  return walk(schema) as Record<string, unknown>;
}
