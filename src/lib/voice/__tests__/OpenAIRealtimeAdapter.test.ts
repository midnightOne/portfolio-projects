/**
 * OpenAI Realtime Adapter Tests
 * 
 * Tests for the OpenAI Realtime adapter implementation with proper tool definitions.
 */

import { OpenAIRealtimeAdapter } from '../OpenAIRealtimeAdapter';
import { AdapterInitOptions } from '@/types/voice-agent';

// Mock the OpenAI agents SDK
jest.mock('@openai/agents/realtime', () => ({
  RealtimeAgent: jest.fn().mockImplementation(() => ({
    name: 'Portfolio Assistant',
    instructions: 'Test instructions',
    tools: []
  })),
  RealtimeSession: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
    mute: jest.fn(),
    sendMessage: jest.fn(),
    interrupt: jest.fn()
  })),
  tool: jest.fn().mockImplementation((config) => config),
  backgroundResult: jest.fn().mockImplementation((message) => ({ message }))
}));

// Mock UI Navigation Tools
jest.mock('../UINavigationTools', () => ({
  uiNavigationTools: {
    navigateTo: jest.fn().mockResolvedValue({ success: true, message: 'Navigation successful' }),
    showProjectDetails: jest.fn().mockResolvedValue({ success: true, message: 'Project shown' }),
    scrollIntoView: jest.fn().mockResolvedValue({ success: true, message: 'Scrolled to element' }),
    highlightText: jest.fn().mockResolvedValue({ success: true, message: 'Text highlighted' }),
    clearHighlights: jest.fn().mockResolvedValue({ success: true, message: 'Highlights cleared' })
  }
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('OpenAIRealtimeAdapter', () => {
  let adapter: OpenAIRealtimeAdapter;
  let mockOptions: AdapterInitOptions;

  beforeEach(() => {
    adapter = new OpenAIRealtimeAdapter();
    
    mockOptions = {
      onConnectionEvent: jest.fn(),
      onTranscriptEvent: jest.fn(),
      onAudioEvent: jest.fn(),
      onToolEvent: jest.fn(),
      audioElement: document.createElement('audio') as HTMLAudioElement
    };

    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct provider metadata', () => {
      expect(adapter.provider).toBe('openai');
      expect(adapter.metadata.provider).toBe('openai');
      expect(adapter.metadata.model).toBe('gpt-realtime');
      expect(adapter.metadata.capabilities).toContain('streaming');
      expect(adapter.metadata.capabilities).toContain('toolCalling');
    });

    it('should create agent with proper tool definitions', async () => {
      await adapter.init(mockOptions);
      
      // Verify that the agent was created with tools
      const { RealtimeAgent } = require('@openai/agents/realtime');
      expect(RealtimeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Portfolio Assistant',
          instructions: expect.stringContaining('You are a helpful AI assistant'),
          tools: expect.arrayContaining([
            expect.objectContaining({ name: 'navigateTo' }),
            expect.objectContaining({ name: 'showProjectDetails' }),
            expect.objectContaining({ name: 'scrollIntoView' }),
            expect.objectContaining({ name: 'highlightText' }),
            expect.objectContaining({ name: 'clearHighlights' }),
            expect.objectContaining({ name: 'loadContext' }),
            expect.objectContaining({ name: 'analyzeJobSpec' }),
            expect.objectContaining({ name: 'submitContactForm' })
          ])
        })
      );
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      await adapter.init(mockOptions);
    });

    it('should connect using session API endpoint', async () => {
      // Mock successful session response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          client_secret: 'test-client-secret',
          session_id: 'test-session-id'
        })
      });

      await adapter.connect();

      expect(global.fetch).toHaveBeenCalledWith('/api/ai/openai/session', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should handle connection errors gracefully', async () => {
      // Mock failed session response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'API key not configured'
        })
      });

      await expect(adapter.connect()).rejects.toThrow('Failed to connect');
    });
  });

  describe('Tool Execution', () => {
    beforeEach(async () => {
      await adapter.init(mockOptions);
    });

    it('should execute UI navigation tools correctly', async () => {
      const { tool } = require('@openai/agents/realtime');
      
      // Get the navigateTo tool from the created tools
      const toolCalls = (tool as jest.Mock).mock.calls;
      const navigateToTool = toolCalls.find(call => call[0].name === 'navigateTo');
      
      expect(navigateToTool).toBeDefined();
      expect(navigateToTool[0]).toMatchObject({
        name: 'navigateTo',
        description: expect.stringContaining('Navigate to a specific page'),
        parameters: expect.objectContaining({
          properties: expect.objectContaining({
            path: expect.objectContaining({
              type: 'string'
            })
          })
        })
      });
    });

    it('should execute backend API tools correctly', async () => {
      const { tool } = require('@openai/agents/realtime');
      
      // Get the loadContext tool from the created tools
      const toolCalls = (tool as jest.Mock).mock.calls;
      const loadContextTool = toolCalls.find(call => call[0].name === 'loadContext');
      
      expect(loadContextTool).toBeDefined();
      expect(loadContextTool[0]).toMatchObject({
        name: 'loadContext',
        description: expect.stringContaining('Load additional context'),
        parameters: expect.objectContaining({
          properties: expect.objectContaining({
            query: expect.objectContaining({
              type: 'string'
            })
          })
        })
      });
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await adapter.init(mockOptions);
      
      // Mock successful connection
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          client_secret: 'test-client-secret'
        })
      });
      
      await adapter.connect();
    });

    it('should send text messages correctly', async () => {
      const testMessage = 'Hello, can you show me the projects?';
      
      await adapter.sendMessage(testMessage);
      
      // Verify that the session's sendMessage was called
      const { RealtimeSession } = require('@openai/agents/realtime');
      const sessionInstance = (RealtimeSession as jest.Mock).mock.results[0].value;
      expect(sessionInstance.sendMessage).toHaveBeenCalledWith(testMessage);
    });

    it('should handle interruption correctly', async () => {
      await adapter.interrupt();
      
      // Verify that the session's interrupt was called
      const { RealtimeSession } = require('@openai/agents/realtime');
      const sessionInstance = (RealtimeSession as jest.Mock).mock.results[0].value;
      expect(sessionInstance.interrupt).toHaveBeenCalled();
    });
  });

  describe('Audio Management', () => {
    beforeEach(async () => {
      await adapter.init(mockOptions);
    });

    it('should start and stop listening correctly', async () => {
      // Mock connection
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          client_secret: 'test-client-secret'
        })
      });
      
      await adapter.connect();
      
      await adapter.startListening();
      expect(adapter.getSessionStatus()).toBe('listening');
      
      await adapter.stopListening();
      expect(adapter.getSessionStatus()).toBe('idle');
    });

    it('should handle mute/unmute correctly', async () => {
      // Mock connection
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          client_secret: 'test-client-secret'
        })
      });
      
      await adapter.connect();
      
      await adapter.toggleMute();
      expect(adapter.isMuted()).toBe(true);
      
      await adapter.toggleMute();
      expect(adapter.isMuted()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when connecting without initialization', async () => {
      const uninitializedAdapter = new OpenAIRealtimeAdapter();
      
      await expect(uninitializedAdapter.connect()).rejects.toThrow('Session not initialized');
    });

    it('should handle API errors gracefully', async () => {
      await adapter.init(mockOptions);
      
      // Mock API error
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({
          error: 'Internal server error'
        })
      });

      await expect(adapter.connect()).rejects.toThrow('Failed to connect');
    });
  });
});