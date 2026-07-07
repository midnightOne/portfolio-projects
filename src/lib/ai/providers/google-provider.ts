/**
 * Google (Gemini) provider: key validation + model listing (registry refresh
 * source, D4). Chat runs through `lib/ai/reasoning/google-adapter` (D39).
 * Native REST — no SDK dependency.
 */

import { BaseProvider } from './base-provider';
import { AIProviderType } from '../types';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export class GoogleProvider extends BaseProvider {
  name: AIProviderType = 'google';

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/models?pageSize=1`, {
        headers: { 'x-goog-api-key': this.apiKey },
      });
      return res.ok;
    } catch (error) {
      console.error('Google connection test failed:', error);
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    const models: string[] = [];
    let pageToken: string | undefined;
    try {
      do {
        const url = `${BASE_URL}/models?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const res = await fetch(url, { headers: { 'x-goog-api-key': this.apiKey } });
        if (!res.ok) {
          throw new Error(`Google models list failed (${res.status})`);
        }
        const data = (await res.json()) as {
          models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
          nextPageToken?: string;
        };
        for (const m of data.models ?? []) {
          if (m.supportedGenerationMethods?.includes('generateContent')) {
            // API returns 'models/gemini-…'; the registry stores bare ids
            models.push(m.name.replace(/^models\//, ''));
          }
        }
        pageToken = data.nextPageToken;
      } while (pageToken);
      return models.sort();
    } catch (error) {
      console.error('Failed to list Google models:', error);
      throw new Error(this.parseProviderError(error));
    }
  }
}
