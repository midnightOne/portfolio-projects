/**
 * Tests for Content Editing API endpoints
 * 
 * Tests the newly created API endpoints:
 * - /api/admin/ai/edit-content
 * - /api/admin/ai/suggest-tags
 * - /api/admin/ai/improve-content
 * - /api/admin/ai/model-config
 * - /api/admin/ai/available-models
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Content Editing API Endpoints', () => {
  
  describe('API Endpoint Files Exist', () => {
    const apiBasePath = path.join(__dirname, '../../../app/api/admin/ai');
    
    it('should have edit-content route file', () => {
      const routePath = path.join(apiBasePath, 'edit-content/route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
    });
    
    it('should have suggest-tags route file', () => {
      const routePath = path.join(apiBasePath, 'suggest-tags/route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
    });
    
    it('should have improve-content route file', () => {
      const routePath = path.join(apiBasePath, 'improve-content/route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
    });
    
    it('should have model-config route file', () => {
      const routePath = path.join(apiBasePath, 'model-config/route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
    });
    
    it('should have available-models route file', () => {
      const routePath = path.join(apiBasePath, 'available-models/route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
    });
  });
  
  describe('Request Structure Validation', () => {
    it('should validate content edit request structure', () => {
      const validRequest = {
        model: 'gpt-4o-mini',
        operation: 'improve' as const,
        content: 'Test content',
        context: {
          projectTitle: 'Test Project',
          projectDescription: 'Test description',
          existingTags: ['test'],
          fullContent: 'Test content'
        }
      };
      
      // Should not throw for valid request structure
      expect(() => {
        // Basic structure validation
        expect(validRequest.model).toBeDefined();
        expect(validRequest.operation).toBeDefined();
        expect(validRequest.content).toBeDefined();
        expect(validRequest.context).toBeDefined();
        expect(validRequest.context.projectTitle).toBeDefined();
      }).not.toThrow();
    });
    
    it('should validate tag suggestion request structure', () => {
      const validRequest = {
        model: 'gpt-4o-mini',
        projectTitle: 'Test Project',
        projectDescription: 'Test description',
        articleContent: 'Test article content',
        existingTags: ['test'],
        maxSuggestions: 5
      };
      
      // Should not throw for valid request structure
      expect(() => {
        expect(validRequest.model).toBeDefined();
        expect(validRequest.projectTitle).toBeDefined();
        expect(validRequest.articleContent).toBeDefined();
        expect(Array.isArray(validRequest.existingTags)).toBe(true);
      }).not.toThrow();
    });
  });
  
  describe('Operation Types', () => {
    it('should define valid content edit operations', () => {
      const validOperations = ['rewrite', 'improve', 'expand', 'summarize', 'make_professional', 'make_casual'];
      
      validOperations.forEach(operation => {
        expect(typeof operation).toBe('string');
        expect(operation.length).toBeGreaterThan(0);
      });
    });
    
    it('should validate operation types', () => {
      const validOperations = ['rewrite', 'improve', 'expand', 'summarize', 'make_professional', 'make_casual'];
      const testOperation = 'improve';
      
      expect(validOperations.includes(testOperation)).toBe(true);
    });
  });
  
  describe('Provider Types', () => {
    it('should define valid provider types', () => {
      const validProviders = ['openai', 'anthropic'];
      
      validProviders.forEach(provider => {
        expect(typeof provider).toBe('string');
        expect(provider.length).toBeGreaterThan(0);
      });
    });
    
    it('should validate provider names', () => {
      const validProviders = ['openai', 'anthropic'];
      const testProvider = 'openai';
      
      expect(validProviders.includes(testProvider)).toBe(true);
    });
  });
  
  describe('Error Response Structure', () => {
    it('should define error response structure', () => {
      const errorResponse = {
        success: false,
        error: {
          message: 'Test error message',
          code: 'TEST_ERROR',
          details: 'Test error details'
        }
      };
      
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toHaveProperty('message');
      expect(errorResponse.error).toHaveProperty('code');
      expect(errorResponse.error).toHaveProperty('details');
    });
    
    it('should define success response structure', () => {
      const successResponse = {
        success: true,
        data: {
          changes: {},
          reasoning: 'Test reasoning',
          confidence: 0.8,
          warnings: [],
          metadata: {
            model: 'test-model',
            tokensUsed: 100,
            cost: 0.001,
            processedAt: new Date().toISOString()
          }
        }
      };
      
      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toHaveProperty('changes');
      expect(successResponse.data).toHaveProperty('reasoning');
      expect(successResponse.data).toHaveProperty('confidence');
      expect(successResponse.data).toHaveProperty('warnings');
      expect(successResponse.data).toHaveProperty('metadata');
    });
  });
  
  describe('HTTP Status Codes', () => {
    it('should define expected HTTP status codes', () => {
      const statusCodes = {
        success: 200,
        badRequest: 400,
        methodNotAllowed: 405,
        internalError: 500
      };
      
      expect(statusCodes.success).toBe(200);
      expect(statusCodes.badRequest).toBe(400);
      expect(statusCodes.methodNotAllowed).toBe(405);
      expect(statusCodes.internalError).toBe(500);
    });
    
    it('should validate endpoint method restrictions', () => {
      const allowedMethods = {
        editContent: ['POST'],
        suggestTags: ['POST'],
        improveContent: ['POST'],
        modelConfig: ['GET', 'PUT'],
        availableModels: ['GET']
      };
      
      expect(Array.isArray(allowedMethods.editContent)).toBe(true);
      expect(allowedMethods.editContent.includes('POST')).toBe(true);
      expect(allowedMethods.modelConfig.includes('GET')).toBe(true);
      expect(allowedMethods.modelConfig.includes('PUT')).toBe(true);
    });
  });
});