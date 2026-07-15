/**
 * UnifiedToolRegistry Tests
 * 
 * Tests for the centralized tool registry functionality
 */

import { UnifiedToolRegistry, unifiedToolRegistry } from '../UnifiedToolRegistry';
import { UnifiedToolDefinition } from '../types';

describe('UnifiedToolRegistry', () => {
  let registry: UnifiedToolRegistry;

  beforeEach(() => {
    // Create a fresh instance for each test
    registry = new (UnifiedToolRegistry as any)();
    (registry as any).initialize();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = UnifiedToolRegistry.getInstance();
      const instance2 = UnifiedToolRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should have the exported singleton instance', () => {
      expect(unifiedToolRegistry).toBeInstanceOf(UnifiedToolRegistry);
    });
  });

  describe('Tool Registration', () => {
    it('should register tools during initialization', () => {
      const stats = registry.getRegistryStats();
      expect(stats.totalTools).toBeGreaterThan(0);
      expect(stats.clientTools).toBeGreaterThan(0);
      expect(stats.serverTools).toBeGreaterThan(0);
    });

    it('should register a valid tool definition', () => {
      const testTool: UnifiedToolDefinition = {
        name: 'testTool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string' }
          },
          required: ['param1']
        },
        executionContext: 'client'
      };

      registry.registerTool(testTool);
      expect(registry.hasToolDefinition('testTool')).toBe(true);
      expect(registry.getToolDefinition('testTool')).toEqual(testTool);
    });

    it('should throw error for invalid tool definition', () => {
      const invalidTool = {
        name: '',
        description: 'Invalid tool',
        parameters: { type: 'string' }, // Invalid - should be object
        executionContext: 'invalid'
      } as any;

      expect(() => registry.registerTool(invalidTool)).toThrow();
    });
  });

  describe('Tool Retrieval', () => {
    it('should get tool definition by name', () => {
      // ui_intent is the D18 declarative navigation tool (imperative
      // navigateTo & friends are deleted).
      const tool = registry.getToolDefinition('ui_intent');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('ui_intent');
      expect(tool?.executionContext).toBe('client');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = registry.getToolDefinition('nonExistentTool');
      expect(tool).toBeUndefined();
    });

    it('registers ui_details as a client tool with the no-repeat rule (7.1e)', () => {
      const tool = registry.getToolDefinition('ui_details');
      expect(tool).toBeDefined();
      expect(tool?.executionContext).toBe('client');
      expect(tool?.description).toContain('NAV_CONTEXT has not changed');
      expect(tool?.description).toContain('do not call again');
    });

    it('registers portfolio_overview as a server tool with the tiny depth-only schema (7.13/7.2b)', () => {
      const tool = registry.getToolDefinition('portfolio_overview');
      expect(tool).toBeDefined();
      expect(tool?.executionContext).toBe('server');
      expect(Object.keys(tool?.parameters.properties ?? {})).toEqual(['depth']);
      expect(tool?.parameters.required ?? []).toEqual([]);
    });

    it('drops the five deprecated legacy tools from every mint but keeps them executable (7.2b)', () => {
      const legacy = [
        'loadUserProfile',
        'getProjectSummary',
        'submitContactForm',
        'processUploadedFile',
        'processJobSpec',
      ];
      const exposed = registry.getModelExposedToolDefinitions().map((t) => t.name);
      const openai = registry.getOpenAIToolsArray().map((t) => t.name);
      const google = registry.getGoogleToolsArray().map((t) => t.name);
      for (const name of legacy) {
        // Still registered — /api/ai/tools/execute keeps working
        // (PassiveFIDManager.getUserProfile is a live loadUserProfile consumer).
        expect(registry.hasToolDefinition(name)).toBe(true);
        // But never minted to any model.
        expect(exposed).not.toContain(name);
        expect(openai).not.toContain(name);
        expect(google).not.toContain(name);
      }
    });

    it('should filter tools by execution context', () => {
      const clientTools = registry.getClientToolDefinitions();
      const serverTools = registry.getServerToolDefinitions();

      expect(clientTools.length).toBeGreaterThan(0);
      expect(serverTools.length).toBeGreaterThan(0);

      clientTools.forEach(tool => {
        expect(tool.executionContext).toBe('client');
      });

      serverTools.forEach(tool => {
        expect(tool.executionContext).toBe('server');
      });
    });

    it('should get all tool definitions', () => {
      const allTools = registry.getAllToolDefinitions();
      const clientTools = registry.getClientToolDefinitions();
      const serverTools = registry.getServerToolDefinitions();

      expect(allTools.length).toBe(clientTools.length + serverTools.length);
    });
  });

  describe('Provider-Specific Formatters', () => {
    it('should format tools for OpenAI', () => {
      const openAITools = registry.getOpenAIToolsArray();
      
      expect(Array.isArray(openAITools)).toBe(true);
      expect(openAITools.length).toBeGreaterThan(0);

      openAITools.forEach(tool => {
        expect(tool).toHaveProperty('type', 'function');
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.parameters).toBe('object');
      });
    });

    it('should format tools for ElevenLabs', () => {
      const mockExecutor = jest.fn().mockResolvedValue({ success: true });
      const elevenLabsTools = registry.getElevenLabsClientToolsExecutor(mockExecutor);

      expect(typeof elevenLabsTools).toBe('object');
      expect(Object.keys(elevenLabsTools).length).toBeGreaterThan(0);

      // Test that each tool is a function
      Object.values(elevenLabsTools).forEach(toolFunc => {
        expect(typeof toolFunc).toBe('function');
      });
    });

    it('should execute ElevenLabs tool function', async () => {
      const mockExecutor = jest.fn().mockResolvedValue({ success: true, data: 'test result' });
      const elevenLabsTools = registry.getElevenLabsClientToolsExecutor(mockExecutor);

      // Get a tool function and execute it
      const toolNames = Object.keys(elevenLabsTools);
      expect(toolNames.length).toBeGreaterThan(0);

      const firstToolName = toolNames[0];
      const toolFunc = elevenLabsTools[firstToolName];
      
      const result = await toolFunc({ param1: 'test' });
      
      expect(mockExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          name: firstToolName,
          arguments: { param1: 'test' },
          id: expect.any(String),
          timestamp: expect.any(Date)
        })
      );
      expect(result).toEqual({ success: true, data: 'test result' });
    });
  });

  describe('Registry Statistics', () => {
    it('should provide accurate registry statistics', () => {
      const stats = registry.getRegistryStats();

      expect(stats).toHaveProperty('totalTools');
      expect(stats).toHaveProperty('clientTools');
      expect(stats).toHaveProperty('serverTools');
      expect(stats).toHaveProperty('toolNames');

      expect(typeof stats.totalTools).toBe('number');
      expect(typeof stats.clientTools).toBe('number');
      expect(typeof stats.serverTools).toBe('number');
      expect(Array.isArray(stats.toolNames)).toBe(true);

      expect(stats.totalTools).toBe(stats.clientTools + stats.serverTools);
      expect(stats.toolNames.length).toBe(stats.totalTools);
    });
  });

  describe('Utility Methods', () => {
    it('should check if tool exists', () => {
      expect(registry.hasToolDefinition('ui_intent')).toBe(true);
      expect(registry.hasToolDefinition('navigateTo')).toBe(false); // deleted (D18)
      expect(registry.hasToolDefinition('nonExistentTool')).toBe(false);
    });

    it('should get tool names by context', () => {
      const clientToolNames = registry.getToolNamesByContext('client');
      const serverToolNames = registry.getToolNamesByContext('server');

      expect(Array.isArray(clientToolNames)).toBe(true);
      expect(Array.isArray(serverToolNames)).toBe(true);
      expect(clientToolNames.length).toBeGreaterThan(0);
      expect(serverToolNames.length).toBeGreaterThan(0);

      // Verify no overlap
      const overlap = clientToolNames.filter(name => serverToolNames.includes(name));
      expect(overlap.length).toBe(0);
    });

    it('should get tools by execution context', () => {
      const clientTools = registry.getToolsByExecutionContext('client');
      const serverTools = registry.getToolsByExecutionContext('server');

      expect(clientTools).toEqual(registry.getClientToolDefinitions());
      expect(serverTools).toEqual(registry.getServerToolDefinitions());
    });
  });
});