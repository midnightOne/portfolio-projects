/**
 * Reasoning-adapter factory (D39). Selection: `AI_FAKE_MODE=reasoning` → FakeReasoningAdapter
 * (refused in production by fake-mode); otherwise the alias resolves via the model
 * registry (D4) to a provider adapter. Providers: OpenAI, Anthropic (D40), Google.
 */

import { isFakeMode } from '../fake-mode';
import { resolveModelAlias, resolveAliasOrModelId, type ModelAliasName } from '../model-registry';
import { FakeReasoningAdapter } from './fake-adapter';
import { OpenAIReasoningAdapter } from './openai-adapter';
import { AnthropicReasoningAdapter } from './anthropic-adapter';
import { GoogleReasoningAdapter } from './google-adapter';
import type { ReasoningAdapter } from './types';

export * from './types';
export { FakeReasoningAdapter } from './fake-adapter';
export { OpenAIReasoningAdapter } from './openai-adapter';
export { AnthropicReasoningAdapter } from './anthropic-adapter';
export { GoogleReasoningAdapter } from './google-adapter';

export function getReasoningAdapterForModel(provider: string, modelId: string): ReasoningAdapter {
  if (isFakeMode('reasoning')) {
    return new FakeReasoningAdapter();
  }
  switch (provider) {
    case 'openai':
      return new OpenAIReasoningAdapter(modelId);
    case 'anthropic':
      return new AnthropicReasoningAdapter(modelId);
    case 'google':
      return new GoogleReasoningAdapter(modelId);
    default:
      throw new Error(`No reasoning adapter for provider '${provider}'`);
  }
}

export async function getReasoningAdapter(alias: ModelAliasName): Promise<ReasoningAdapter> {
  if (isFakeMode('reasoning')) {
    return new FakeReasoningAdapter();
  }
  const resolved = await resolveModelAlias(alias);
  return getReasoningAdapterForModel(resolved.provider, resolved.modelId);
}

/**
 * Resolve a config/request-supplied value that may be a role alias or a pinned
 * model id (D4), then return the matching adapter. Admin editing endpoints use
 * this so an alias switch in ModelAliasPanel needs no deploy.
 */
export async function getReasoningAdapterForAliasOrModel(value: string): Promise<ReasoningAdapter> {
  if (isFakeMode('reasoning')) {
    return new FakeReasoningAdapter();
  }
  const resolved = await resolveAliasOrModelId(value);
  return getReasoningAdapterForModel(resolved.provider, resolved.modelId);
}
