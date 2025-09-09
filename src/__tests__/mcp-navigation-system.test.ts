/**
 * MCP Navigation System Tests
 * 
 * Comprehensive tests for the MCP (Model Context Protocol) navigation tools system.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { mcpClient } from '@/lib/mcp/client';
import { mcpServer } from '@/lib/mcp/server';
import { navigationTools } from '@/lib/mcp/navigation-tools';
import { serverTools } from '@/lib/mcp/server-tools';
import type { MCPToolCall, MCPToolResult, NavigationState } from '@/lib/mcp/types';

// Mock DOM methods
const mockScrollIntoView = jest.fn();
const mockClick = jest.fn();
const mockFocus = jest.fn();

// Mock fetch for server tools
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock DOM elements
const createMockElement = (id: string, attributes: Record<string, string> = {}) => {
  const element = {
    id,
    scrollIntoView: mockScrollIntoView,
    click: mockClick,
    focus: mockFocus,
    style: {},
    setAttribute: jest.fn(),
    removeAttribute: jest.fn(),
    getAttribute: jest.fn(),
    getBoundingClientRect: () => ({
      left: 100,
      top: 100,
      right: 200,
      bottom: 200,
      width: 100,
      height: 100
    }),
    ...attributes
  };
  
  // Make it behave more like a real HTMLElement
  Object.defineProperty(element, 'tagName', { value: 'DIV' });
  Object.defineProperty(element, 'nodeType', { value: 1 });
  
  return element as unknown as HTMLElement;
};

// Mock document methods
Object.defineProperty(document, 'getElementById', {
  value: jest.fn((id: string) => {
    if (id === 'test-section') return createMockElement('test-section');
    if (id === 'project-1') return createMockElement('project-1');
    return null;
  })
});

Object.defineProperty(document, 'querySelector', {
  value: jest.fn((selector: string) => {
    if (selector === '[data-project-id="project-1"]') {
      return createMockElement('project-trigger', { 'data-project-id': 'project-1' });
    }
    if (selector === '#test-section') return createMockElement('test-section');
    return null;
  })
});

Object.defineProperty(document, 'querySelectorAll', {
  value: jest.fn((selector: string) => {
    if (selector === '.test-elements') {
      return [
        createMockElement('element-1'),
        createMockElement('element-2')
      ];
    }
    return [];
  })
});

Object.defineProperty(document, 'body', {
  value: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
});

// Mock window methods
Object.defineProperty(window, 'scrollY', {
  value: 0,
  writable: true
});

// Mock location
delete (window as any).location;
(window as any).location = {
  href: 'http://localhost:3000'
};

describe('MCP Navigation System', () => {
  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Initialize MCP client
    await mcpClient.initialize();
    
    // Mock successful fetch responses
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { message: 'Mock server response' },
        metadata: {
          timestamp: Date.now(),
          executionTime: 100,
          source: 'server'
        }
      })
    });
  });

  afterEach(() => {
    // Clear execution history
    mcpClient.clearHistory();
  });

  describe('MCP Client', () => {
    it('should initialize successfully', async () => {
      expect(mcpClient).toBeDefined();
      
      const availableTools = mcpClient.getAvailableTools();
      expect(availableTools.navigation.length).toBeGreaterThan(0);
      expect(availableTools.server.length).toBeGreaterThan(0);
    });

    it('should execute navigation tools', async () => {
      const toolCall: MCPToolCall = {
        name: 'scrollToSection',
        arguments: { sectionId: 'test-section' }
      };

      const result = await mcpClient.executeTool(toolCall);
      
      expect(result.success).toBe(true);
      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('should execute server tools via API', async () => {
      const toolCall: MCPToolCall = {
        name: 'loadProjectContext',
        arguments: { projectId: 'project-1' }
      };

      const result = await mcpClient.executeTool(toolCall);
      
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai/tools/execute', // Updated to use unified endpoint
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should handle tool execution errors', async () => {
      const toolCall: MCPToolCall = {
        name: 'nonexistent-tool',
        arguments: {}
      };

      const result = await mcpClient.executeTool(toolCall);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should track execution history', async () => {
      const toolCall: MCPToolCall = {
        name: 'focusElement',
        arguments: { selector: '#test-section' }
      };

      await mcpClient.executeTool(toolCall);
      
      const history = mcpClient.getExecutionHistory();
      expect(history.length).toBe(1);
      expect(history[0].toolName).toBe('focusElement');
    });
  });

  describe('Navigation Tools', () => {
    it('should open project modal', async () => {
      const tool = navigationTools.get('openProjectModal');
      expect(tool).toBeDefined();

      const result = await tool!.executor({
        projectId: 'project-1',
        highlightSections: ['section-1']
      });

      expect(result.success).toBe(true);
      expect(mockClick).toHaveBeenCalled();
    });

    it('should scroll to section', async () => {
      const tool = navigationTools.get('scrollToSection');
      expect(tool).toBeDefined();

      const result = await tool!.executor({
        sectionId: 'test-section',
        behavior: 'smooth'
      });

      expect(result.success).toBe(true);
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
      });
    });

    it('should highlight text elements', async () => {
      const tool = navigationTools.get('highlightText');
      expect(tool).toBeDefined();

      const result = await tool!.executor({
        selector: '.test-elements',
        type: 'outline',
        intensity: 'medium'
      });

      expect(result.success).toBe(true);
      expect(result.data?.elementsHighlighted).toBe(2);
    });

    it('should clear highlights', async () => {
      // First add highlights
      const highlightTool = navigationTools.get('highlightText');
      await highlightTool!.executor({
        selector: '.test-elements',
        type: 'outline'
      });

      // Then clear them
      const clearTool = navigationTools.get('clearHighlights');
      const result = await clearTool!.executor({});

      expect(result.success).toBe(true);
    });

    it('should focus elements', async () => {
      const tool = navigationTools.get('focusElement');
      expect(tool).toBeDefined();

      const result = await tool!.executor({
        selector: '#test-section'
      });

      expect(result.success).toBe(true);
      expect(mockFocus).toHaveBeenCalled();
    });

    it('should animate elements', async () => {
      const tool = navigationTools.get('animateElement');
      expect(tool).toBeDefined();

      const result = await tool!.executor({
        selector: '.test-elements',
        animation: {
          type: 'pulse',
          duration: 500
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.elementsAnimated).toBe(2);
    });

    it('should handle missing elements gracefully', async () => {
      const tool = navigationTools.get('scrollToSection');
      
      const result = await tool!.executor({
        sectionId: 'nonexistent-section'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should use fallback for failed operations', async () => {
      const tool = navigationTools.get('openProjectModal');
      
      // Mock querySelector to return null (no trigger found)
      (document.querySelector as jest.MockedFunction<typeof document.querySelector>).mockReturnValueOnce(null);
      
      const result = await tool!.executor({
        projectId: 'nonexistent-project'
      });

      // Should use fallback (navigate to page)
      expect(result.success).toBe(true);
      expect(result.data?.fallbackUsed).toBe(true);
    });
  });

  describe('Server Tools', () => {
    it('should have correct tool definitions', () => {
      const loadProjectTool = serverTools.get('loadProjectContext');
      expect(loadProjectTool).toBeDefined();
      expect(loadProjectTool!.definition.name).toBe('loadProjectContext');
      expect(loadProjectTool!.endpoint).toBe('/api/ai/tools/execute'); // Updated to use unified endpoint
      expect(loadProjectTool!.method).toBe('POST');
    });

    it('should validate tool arguments', () => {
      const loadProjectTool = serverTools.get('loadProjectContext');
      
      expect(loadProjectTool!.validation!({ projectId: 'test' })).toBe(true);
      expect(loadProjectTool!.validation!({ projectId: '' })).toBe(false);
      expect(loadProjectTool!.validation!({})).toBe(false);
    });
  });

  describe('MCP Server', () => {
    it('should provide available tools', () => {
      const tools = mcpServer.getAvailableTools();
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('loadProjectContext');
      expect(toolNames).toContain('searchProjects');
    });

    it('should execute server tools', async () => {
      const toolCall: MCPToolCall = {
        name: 'loadProjectContext',
        arguments: { projectId: 'test-project' }
      };

      const result = await mcpServer.executeTool(toolCall);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle unknown tools', async () => {
      const toolCall: MCPToolCall = {
        name: 'unknown-tool',
        arguments: {}
      };

      const result = await mcpServer.executeTool(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should manage client registration', () => {
      const clientId = 'test-client';
      
      mcpServer.registerClient(clientId);
      expect(mcpServer.getRegisteredClients()).toContain(clientId);
      
      mcpServer.unregisterClient(clientId);
      expect(mcpServer.getRegisteredClients()).not.toContain(clientId);
    });

    it('should sync navigation state', async () => {
      const clientId = 'test-client';
      const state: NavigationState = {
        currentModal: 'project-modal',
        currentSection: 'test-section',
        activeHighlights: {},
        scrollPosition: 100,
        history: [],
        timestamp: Date.now()
      };

      mcpServer.registerClient(clientId);
      await mcpServer.syncNavigationState(clientId, state);
      
      const retrievedState = mcpServer.getClientState(clientId);
      expect(retrievedState).toEqual(state);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors for server tools', async () => {
      // Mock fetch to reject
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(new Error('Network error'));

      const toolCall: MCPToolCall = {
        name: 'loadProjectContext',
        arguments: { projectId: 'test' }
      };

      const result = await mcpClient.executeTool(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle server errors', async () => {
      // Mock fetch to return error response
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const toolCall: MCPToolCall = {
        name: 'loadProjectContext',
        arguments: { projectId: 'test' }
      };

      const result = await mcpClient.executeTool(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should handle validation errors', async () => {
      const toolCall: MCPToolCall = {
        name: 'loadProjectContext',
        arguments: { projectId: '' } // Invalid: empty string
      };

      const result = await mcpClient.executeTool(toolCall);
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });
  });

  describe('Navigation State Management', () => {
    it('should track navigation state changes', async () => {
      const initialState = mcpClient.getNavigationState();
      expect(initialState).toBeDefined();

      // Execute a navigation tool
      await mcpClient.executeTool({
        name: 'scrollToSection',
        arguments: { sectionId: 'test-section' }
      });

      const updatedState = mcpClient.getNavigationState();
      expect(updatedState.currentSection).toBe('test-section');
      expect(updatedState.history.length).toBeGreaterThanOrEqual(initialState.history.length);
    });

    it('should manage highlight state', async () => {
      // Add highlight
      await mcpClient.executeTool({
        name: 'highlightText',
        arguments: {
          selector: '.test-elements',
          type: 'outline',
          duration: 'persistent'
        }
      });

      const stateWithHighlight = mcpClient.getNavigationState();
      expect(Object.keys(stateWithHighlight.activeHighlights).length).toBeGreaterThan(0);

      // Clear highlights
      await mcpClient.executeTool({
        name: 'clearHighlights',
        arguments: {}
      });

      const stateWithoutHighlight = mcpClient.getNavigationState();
      expect(Object.keys(stateWithoutHighlight.activeHighlights).length).toBe(0);
    });
  });
});