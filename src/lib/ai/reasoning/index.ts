/**
 * Reasoning-adapter factory (D39). Selection: `AI_FAKE_MODE=reasoning` → FakeReasoningAdapter
 * (refused in production by fake-mode); otherwise the alias resolves via the model
 * registry (D4) to a provider adapter.
 */

import { isFakeMode } from '../fake-mode';
import { resolveModelAlias, type ModelAliasName } from '../model-registry';
import { FakeReasoningAdapter } from './fake-adapter';
import { OpenAIReasoningAdapter } from './openai-adapter';
import type { ReasoningAdapter } from './types';

export * from './types';
export { FakeReasoningAdapter } from './fake-adapter';
export { OpenAIReasoningAdapter } from './openai-adapter';

export async function getReasoningAdapter(alias: ModelAliasName): Promise<ReasoningAdapter> {
  if (isFakeMode('reasoning')) {
    return new FakeReasoningAdapter();
  }
  const resolved = await resolveModelAlias(alias);
  switch (resolved.provider) {
    case 'openai':
      return new OpenAIReasoningAdapter(resolved.modelId);
    default:
      throw new Error(`No reasoning adapter for provider '${resolved.provider}' yet (D39 Phase 4 adds Anthropic/Google)`);
  }
}
