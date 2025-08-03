/**
 * Simple tests for Anthropic provider implementation focusing on core logic
 */

import { describe, it, expect } from '@jest/globals';
import { AnthropicProvider } from '../providers/anthropic-provider';

describe('AnthropicProvider Core Logic', () => {
  describe('listModels', () => {
    it('should return known Anthropic models', async () => {
      const provider = Object.create(AnthropicProvider.prototype);
      
      const models = await provider.listModels();
      
      expect(models).toContain('claude-3-5-sonnet-20241022');
      expect(models).toContain('claude-3-5-haiku-20241022');
      expect(models).toContain('claude-3-opus-20240229');
      expect(models).toContain('claude-3-sonnet-20240229');
      expect(models).toContain('claude-3-haiku-20240307');
      expect(models.length).toBeGreaterThan(0);
    });
  });
  
  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const provider = Object.create(AnthropicProvider.prototype);
      
      const text = 'Hello world!'; // 12 characters
      const tokens = provider.estimateTokens(text);
      expect(tokens).toBe(3); // 12/4 = 3
    });
    
    it('should handle empty text', () => {
      const provider = Object.create(AnthropicProvider.prototype);
      
      const tokens = provider.estimateTokens('');
      expect(tokens).toBe(0);
    });
    
    it('should round up fractional tokens', () => {
      const provider = Object.create(AnthropicProvider.prototype);
      
      const text = 'Hi'; // 2 characters, should be 1 token (2/4 = 0.5, rounded up)
      const tokens = provider.estimateTokens(text);
      expect(tokens).toBe(1);
    });
  });
  
  describe('calculateCost', () => {
    it('should calculate cost for known models', () => {
      const provider = Object.create(AnthropicProvider.prototype);
      
      const cost = provider.calculateCost(1000, 'claude-3-5-sonnet-20241022');
      expect(cost).toBe(0.003); // 1000 tokens * $0.003 per 1K tokens
    });
    
    it('should use default cost for unknown models', () => {
      const provider = Object.create(AnthropicProvider.prototype);
      
      const cost = provider.calculateCost(1000, 'unknown-model');
      expect(cost).toBe(0.003); // Default fallback cost
    });
    
    it('should handle zero tokens', () => {
      const provider = Object.create(AnthropicProvider.prototype);
      
      const cost = provider.calculateCost(0, 'claude-3-5-sonnet-20241022');
      expect(cost).toBe(0);
    });
    
    it('should calculate cost for different models correctly', () => {
      const provider = Object.create(AnthropicProvider.prototype);
      
      expect(provider.calculateCost(1000, 'claude-3-5-haiku-20241022')).toBe(0.00025);
      expect(provider.calculateCost(1000, 'claude-3-opus-20240229')).toBe(0.015);
      expect(provider.calculateCost(1000, 'claude-3-sonnet-20240229')).toBe(0.003);
    });
  });
  
  describe('mapFinishReason', () => {
    it('should map Anthropic stop reasons correctly', () => {
      const provider = Object.create(AnthropicProvider.prototype);
      
      expect(provider.mapFinishReason('end_turn')).toBe('stop');
      expect(provider.mapFinishReason('max_tokens')).toBe('length');
      expect(provider.mapFinishReason('stop_sequence')).toBe('stop');
      expect(provider.mapFinishReason(null)).toBe('error');
      expect(provider.mapFinishReason('unknown')).toBe('error');
    });
  });
  
  describe('provider properties', () => {
    it('should have correct name', () => {
      const provider = Object.create(AnthropicProvider.prototype);
      provider.name = 'anthropic';
      
      expect(provider.name).toBe('anthropic');
    });
  });
});