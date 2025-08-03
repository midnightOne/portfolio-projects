/**
 * Comprehensive test to verify Task 1: Environment Configuration Setup
 * This test verifies all requirements from the task are met
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { EnvironmentValidator } from '../environment';

describe('Task 1: Environment Configuration Setup', () => {
  describe('Requirement: Update .env.example to include API keys', () => {
    it('should include OPENAI_API_KEY and ANTHROPIC_API_KEY in .env.example', () => {
      const envExamplePath = join(process.cwd(), '.env.example');
      const envExampleContent = readFileSync(envExamplePath, 'utf-8');
      
      expect(envExampleContent).toContain('OPENAI_API_KEY=');
      expect(envExampleContent).toContain('ANTHROPIC_API_KEY=');
      expect(envExampleContent).toContain('# AI Configuration');
    });
  });

  describe('Requirement: Create environment validation utilities', () => {
    it('should provide EnvironmentValidator class with required methods', () => {
      expect(EnvironmentValidator.validateAIConfig).toBeDefined();
      expect(EnvironmentValidator.hasAnyAIProvider).toBeDefined();
      expect(EnvironmentValidator.getConfiguredProviders).toBeDefined();
      expect(EnvironmentValidator.getEnvironmentStatus).toBeDefined();
    });

    it('should validate AI configuration correctly', () => {
      // Test with no environment variables
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const config = EnvironmentValidator.validateAIConfig();
      expect(config.openai.configured).toBe(false);
      expect(config.anthropic.configured).toBe(false);
      expect(config.openai.keyPreview).toBe('Not configured');
      expect(config.anthropic.keyPreview).toBe('Not configured');
    });

    it('should provide comprehensive environment status', () => {
      const status = EnvironmentValidator.getEnvironmentStatus();
      
      expect(status).toHaveProperty('openai');
      expect(status).toHaveProperty('anthropic');
      expect(status).toHaveProperty('hasAnyProvider');
      expect(status).toHaveProperty('configuredProviders');
      expect(status).toHaveProperty('isFullyConfigured');
      expect(status).toHaveProperty('warnings');
      
      expect(Array.isArray(status.configuredProviders)).toBe(true);
      expect(Array.isArray(status.warnings)).toBe(true);
    });

    it('should mask API keys for security', () => {
      const originalEnv = process.env;
      process.env.OPENAI_API_KEY = 'sk-test1234567890abcdef';
      
      const config = EnvironmentValidator.validateAIConfig();
      expect(config.openai.keyPreview).toBe('sk-t...cdef');
      expect(config.openai.keyPreview).not.toContain('1234567890');
      
      process.env = originalEnv;
    });
  });

  describe('Requirement: Database schema migration', () => {
    it('should have migration file for AI architecture redesign', () => {
      const migrationPath = join(process.cwd(), 'prisma', 'migrations', '005_ai_architecture_redesign.sql');
      const migrationContent = readFileSync(migrationPath, 'utf-8');
      
      // Check that old tables are dropped
      expect(migrationContent).toContain('DROP TABLE IF EXISTS "ai_messages"');
      expect(migrationContent).toContain('DROP TABLE IF EXISTS "content_versions"');
      expect(migrationContent).toContain('DROP TABLE IF EXISTS "ai_conversations"');
      expect(migrationContent).toContain('DROP TABLE IF EXISTS "ai_settings"');
      
      // Check that new tables are created
      expect(migrationContent).toContain('CREATE TABLE "ai_model_config"');
      expect(migrationContent).toContain('CREATE TABLE "ai_general_settings"');
      
      // Check that default data is inserted
      expect(migrationContent).toContain('INSERT INTO "ai_model_config"');
      expect(migrationContent).toContain('INSERT INTO "ai_general_settings"');
    });
  });

  describe('Requirement: Database setup utilities', () => {
    it('should provide database setup functions', async () => {
      const { initializeAIConfiguration, validateAIConfiguration, getAIConfiguration } = 
        await import('../database-setup');
      
      expect(initializeAIConfiguration).toBeDefined();
      expect(validateAIConfiguration).toBeDefined();
      expect(getAIConfiguration).toBeDefined();
      expect(typeof initializeAIConfiguration).toBe('function');
      expect(typeof validateAIConfiguration).toBe('function');
      expect(typeof getAIConfiguration).toBe('function');
    });

    it('should provide default AI configuration', async () => {
      const { DEFAULT_AI_CONFIG } = await import('../database-setup');
      
      expect(DEFAULT_AI_CONFIG).toBeDefined();
      expect(DEFAULT_AI_CONFIG.modelConfig).toBeDefined();
      expect(DEFAULT_AI_CONFIG.generalSettings).toBeDefined();
      
      expect(DEFAULT_AI_CONFIG.modelConfig.openai).toContain('gpt-4o');
      expect(DEFAULT_AI_CONFIG.modelConfig.anthropic).toContain('claude-3-5-sonnet');
      
      expect(DEFAULT_AI_CONFIG.generalSettings.defaultProvider).toBe('openai');
      expect(DEFAULT_AI_CONFIG.generalSettings.temperature).toBe(0.7);
      expect(DEFAULT_AI_CONFIG.generalSettings.maxTokens).toBe(4000);
    });
  });

  describe('Integration: Complete environment configuration setup', () => {
    it('should handle the complete workflow from environment to database', async () => {
      // 1. Environment validation should work
      const envStatus = EnvironmentValidator.getEnvironmentStatus();
      expect(envStatus).toBeDefined();
      
      // 2. Database configuration should be accessible
      const { getAIConfiguration } = await import('../database-setup');
      const config = await getAIConfiguration();
      expect(config).toBeDefined();
      expect(config.modelConfig).toBeDefined();
      expect(config.generalSettings).toBeDefined();
      
      // 3. Configuration should have expected structure
      expect(config.modelConfig.openai).toBeTruthy();
      expect(config.modelConfig.anthropic).toBeTruthy();
      expect(config.generalSettings.defaultProvider).toBeTruthy();
    });
  });
});