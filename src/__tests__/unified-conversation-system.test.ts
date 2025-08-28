/**
 * Unified Conversation System Tests
 * Tests for mode-agnostic conversation pipeline and transport layer
 */

import { 
  UnifiedConversationManager,
  type ConversationInput,
  type ConversationOptions,
  type ConversationMessage
} from '@/lib/services/ai/unified-conversation-manager';
import {
  HTTPConversationTransport,
  ConversationTransportManager,
  type TransportError,
  type TransportState
} from '@/lib/services/ai/conversation-transport';

// Mock fetch for Node.js environment
global.fetch = jest.fn();

// Mock the AI service manager
jest.mock('@/lib/ai/service-manager', () => ({
  AIServiceManager: jest.fn().mockImplementation(() => ({
    getProviderForModel: jest.fn().mockReturnValue('openai'),
    providers: new Map([
      ['openai', {
        chat: jest.fn().mockResolvedValue({
          content: 'This is a test AI response',
          model: 'gpt-4',
          tokensUsed: 50,
          cost: 0.001,
          finishReason: 'stop'
        })
      }]
    ])
  }))
}));

// Mock the context manager
jest.mock('@/lib/services/ai/context-manager', () => ({
  contextManager: {
    buildContextWithCaching: jest.fn().mockResolvedValue({
      context: 'Test context about portfolio projects',
      fromCache: false
    })
  }
}));

describe('UnifiedConversationManager', () => {
  let conversationManager: UnifiedConversationManager;
  let sessionId: string;

  beforeEach(() => {
    conversationManager = new UnifiedConversationManager();
    sessionId = `test_session_${Date.now()}`;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Mode-Agnostic Processing', () => {
    test('should process text input correctly', async () => {
      const input: ConversationInput = {
        content: 'Tell me about your projects',
        mode: 'text',
        sessionId
      };

      const response = await conversationManager.processInput(input);

      expect(response.message.role).toBe('assistant');
      expect(response.message.content).toBe('This is a test AI response');
      expect(response.message.inputMode).toBe('text');
      expect(response.navigationCommands).toEqual([]);
      expect(response.suggestions).toHaveLength(3);
    });

    test('should process voice input correctly', async () => {
      const input: ConversationInput = {
        content: 'What technologies do you use?',
        mode: 'voice',
        sessionId,
        metadata: {
          voiceData: {
            duration: 3000,
            transcription: 'What technologies do you use?'
          }
        }
      };

      const response = await conversationManager.processInput(input);

      expect(response.message.role).toBe('assistant');
      expect(response.message.inputMode).toBe('voice');
      expect(response.message.metadata?.voiceData).toBeUndefined(); // Voice response not implemented yet
    });

    test('should process hybrid input correctly', async () => {
      const input: ConversationInput = {
        content: 'Show me your experience',
        mode: 'hybrid',
        sessionId
      };

      const response = await conversationManager.processInput(input);

      expect(response.message.role).toBe('assistant');
      expect(response.message.inputMode).toBe('hybrid');
      expect(response.message.content).toBe('This is a test AI response');
    });
  });

  describe('Conversation State Management', () => {
    test('should maintain conversation history across modes', async () => {
      // Send text message
      const textInput: ConversationInput = {
        content: 'Hello',
        mode: 'text',
        sessionId
      };
      await conversationManager.processInput(textInput);

      // Send voice message
      const voiceInput: ConversationInput = {
        content: 'How are you?',
        mode: 'voice',
        sessionId
      };
      await conversationManager.processInput(voiceInput);

      // Get conversation history
      const history = await conversationManager.getConversationHistory(sessionId);

      expect(history).toHaveLength(4); // 2 user messages + 2 assistant messages
      expect(history[0].content).toBe('Hello');
      expect(history[0].inputMode).toBe('text');
      expect(history[2].content).toBe('How are you?');
      expect(history[2].inputMode).toBe('voice');
    });

    test('should allow mode switching', async () => {
      // Create a conversation first
      const input: ConversationInput = {
        content: 'Initial message',
        mode: 'text',
        sessionId
      };
      await conversationManager.processInput(input);

      // Get initial state
      const state1 = await conversationManager.getConversationState(sessionId);
      expect(state1?.activeMode).toBe('text');

      // Switch to voice mode
      await conversationManager.updateConversationMode(sessionId, 'voice');
      const state2 = await conversationManager.getConversationState(sessionId);
      expect(state2?.activeMode).toBe('voice');

      // Switch to hybrid mode
      await conversationManager.updateConversationMode(sessionId, 'hybrid');
      const state3 = await conversationManager.getConversationState(sessionId);
      expect(state3?.activeMode).toBe('hybrid');
    });

    test('should clear conversation history', async () => {
      // Add some messages
      const input: ConversationInput = {
        content: 'Test message',
        mode: 'text',
        sessionId
      };
      await conversationManager.processInput(input);

      // Verify messages exist
      let history = await conversationManager.getConversationHistory(sessionId);
      expect(history.length).toBeGreaterThan(0);

      // Clear history
      await conversationManager.clearConversationHistory(sessionId);

      // Verify messages are cleared
      history = await conversationManager.getConversationHistory(sessionId);
      expect(history).toHaveLength(0);
    });

    test('should track processing state', async () => {
      expect(conversationManager.isProcessing(sessionId)).toBe(false);

      // Processing state is managed internally during processInput
      // We can't easily test the intermediate state without mocking delays
    });
  });

  describe('Context Preservation', () => {
    test('should maintain context across different input modes', async () => {
      const options: ConversationOptions = {
        includeContext: true,
        contextOptions: {
          includeProjects: true,
          includeAbout: true
        }
      };

      // Send text message with context
      const textInput: ConversationInput = {
        content: 'Tell me about your projects',
        mode: 'text',
        sessionId
      };
      await conversationManager.processInput(textInput, options);

      // Send voice message - should maintain same context
      const voiceInput: ConversationInput = {
        content: 'What about your skills?',
        mode: 'voice',
        sessionId
      };
      await conversationManager.processInput(voiceInput, options);

      const state = await conversationManager.getConversationState(sessionId);
      expect(state?.currentContext).toContain('Test context about portfolio projects');
    });
  });

  describe('Navigation Command Parsing', () => {
    test('should parse navigation commands from AI responses', async () => {
      // Create a new conversation manager instance to avoid shared state
      const testConversationManager = new UnifiedConversationManager();
      
      // Mock the AI service for this specific test
      const mockAIService = require('@/lib/ai/service-manager').AIServiceManager;
      const mockInstance = new mockAIService();
      
      // Override the getAIResponse method to return our test response
      const originalGetAIResponse = (testConversationManager as any).getAIResponse;
      (testConversationManager as any).getAIResponse = jest.fn().mockResolvedValue({
        content: 'Here are my projects [NavigateTo:project1&section=overview]. You can also see [NavigateTo:project2&section=details].',
        model: 'gpt-4',
        tokensUsed: 75,
        cost: 0.0015,
        finishReason: 'stop'
      });

      const input: ConversationInput = {
        content: 'Show me your projects',
        mode: 'text',
        sessionId: `nav_test_${Date.now()}`
      };

      const response = await testConversationManager.processInput(input);

      expect(response.navigationCommands).toHaveLength(2);
      expect(response.navigationCommands[0]).toEqual({
        type: 'navigate',
        target: 'project1',
        parameters: { section: 'overview' },
        timing: 'immediate'
      });
      expect(response.navigationCommands[1]).toEqual({
        type: 'navigate',
        target: 'project2',
        parameters: { section: 'details' },
        timing: 'immediate'
      });

      // Response content should have navigation commands removed
      expect(response.message.content).toBe('Here are my projects . You can also see .');
      
      // Restore original method
      (testConversationManager as any).getAIResponse = originalGetAIResponse;
    });
  });

  describe('Error Handling', () => {
    test('should handle AI service errors gracefully', async () => {
      // Create a new conversation manager instance to avoid shared state
      const testConversationManager = new UnifiedConversationManager();
      
      // Override the getAIResponse method to throw an error
      (testConversationManager as any).getAIResponse = jest.fn().mockRejectedValue(new Error('AI service unavailable'));

      const input: ConversationInput = {
        content: 'Test message',
        mode: 'text',
        sessionId: `error_test_${Date.now()}`
      };

      const response = await testConversationManager.processInput(input);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe('PROCESSING_ERROR');
      expect(response.error?.recoverable).toBe(true);
      expect(response.message.content).toContain('I apologize, but I encountered an error');
    });
  });
});

describe('HTTPConversationTransport', () => {
  let transport: HTTPConversationTransport;
  let messageCallback: jest.Mock;
  let errorCallback: jest.Mock;
  let stateCallback: jest.Mock;

  beforeEach(() => {
    transport = new HTTPConversationTransport();
    messageCallback = jest.fn();
    errorCallback = jest.fn();
    stateCallback = jest.fn();

    transport.onMessage(messageCallback);
    transport.onError(errorCallback);
    transport.onStateChange(stateCallback);
  });

  test('should connect successfully', async () => {
    await transport.connect();

    expect(transport.isConnected).toBe(true);
    expect(stateCallback).toHaveBeenCalledWith({
      transport: 'http',
      connected: true,
      lastActivity: expect.any(Date)
    });
  });

  test('should send messages successfully', async () => {
    await transport.connect();

    const input: ConversationInput = {
      content: 'Test message',
      mode: 'text',
      sessionId: 'test_session'
    };

    const response = await transport.sendMessage(input);

    expect(response.message.content).toBe('This is a test AI response');
    expect(messageCallback).toHaveBeenCalledWith(response);
    expect(stateCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: 'http',
        connected: true,
        latency: expect.any(Number),
        quality: expect.any(String)
      })
    );
  });

  test('should handle transport errors', async () => {
    // Create a new transport instance to avoid shared state
    const testTransport = new HTTPConversationTransport();
    const testErrorCallback = jest.fn();
    testTransport.onError(testErrorCallback);

    // Mock the unified conversation manager to throw an error
    const originalProcessInput = require('@/lib/services/ai/unified-conversation-manager').unifiedConversationManager.processInput;
    require('@/lib/services/ai/unified-conversation-manager').unifiedConversationManager.processInput = jest.fn().mockRejectedValue(new Error('Transport error'));

    await testTransport.connect();

    const input: ConversationInput = {
      content: 'Test message',
      mode: 'text',
      sessionId: 'test_session'
    };

    try {
      await testTransport.sendMessage(input);
      fail('Expected sendMessage to throw an error');
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as any).code).toBe('HTTP_REQUEST_FAILED');
    }

    expect(testErrorCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'HTTP_REQUEST_FAILED',
        message: 'Transport error',
        recoverable: true,
        transport: 'http'
      })
    );

    // Restore original function
    require('@/lib/services/ai/unified-conversation-manager').unifiedConversationManager.processInput = originalProcessInput;
  });
});

describe('ConversationTransportManager', () => {
  let transportManager: ConversationTransportManager;
  let httpTransport: HTTPConversationTransport;

  beforeEach(() => {
    transportManager = new ConversationTransportManager();
    httpTransport = new HTTPConversationTransport();
    transportManager.registerTransport(httpTransport);
  });

  test('should register and manage transports', () => {
    const availableTransports = transportManager.getAvailableTransports();
    expect(availableTransports).toContain('http');
  });

  test('should set active transport', async () => {
    await transportManager.setActiveTransport('http');

    expect(transportManager.getActiveTransportName()).toBe('http');
    expect(transportManager.isConnected()).toBe(true);
  });

  test('should send messages through active transport', async () => {
    await transportManager.setActiveTransport('http');

    const input: ConversationInput = {
      content: 'Test message',
      mode: 'text',
      sessionId: 'test_session_transport'
    };

    const response = await transportManager.sendMessage(input);

    expect(response).toBeDefined();
    expect(response.message).toBeDefined();
    expect(response.message.content).toBe('This is a test AI response');
  });

  test('should handle transport switching', async () => {
    await transportManager.setActiveTransport('http');
    expect(transportManager.getActiveTransportName()).toBe('http');

    // Register another transport
    const anotherTransport = new HTTPConversationTransport();
    anotherTransport.name = 'http2';
    transportManager.registerTransport(anotherTransport);

    await transportManager.setActiveTransport('http2');
    expect(transportManager.getActiveTransportName()).toBe('http2');
  });

  test('should throw error when no active transport', async () => {
    const input: ConversationInput = {
      content: 'Test message',
      mode: 'text',
      sessionId: 'test_session'
    };

    await expect(transportManager.sendMessage(input)).rejects.toThrow('No active transport');
  });
});

describe('Integration Tests', () => {
  test('should handle complete conversation flow', async () => {
    const conversationManager = new UnifiedConversationManager();
    const sessionId = `integration_test_${Date.now()}`;

    // Start conversation with text
    const textInput: ConversationInput = {
      content: 'Hello, tell me about your projects',
      mode: 'text',
      sessionId
    };

    const textResponse = await conversationManager.processInput(textInput);
    expect(textResponse.message.role).toBe('assistant');
    expect(textResponse.message.inputMode).toBe('text');

    // Switch to voice mode and continue conversation
    await conversationManager.updateConversationMode(sessionId, 'voice');

    const voiceInput: ConversationInput = {
      content: 'What technologies do you use?',
      mode: 'voice',
      sessionId
    };

    const voiceResponse = await conversationManager.processInput(voiceInput);
    expect(voiceResponse.message.inputMode).toBe('voice');

    // Verify conversation history contains both messages
    const history = await conversationManager.getConversationHistory(sessionId);
    expect(history).toHaveLength(4); // 2 user + 2 assistant messages

    // Verify conversation state
    const state = await conversationManager.getConversationState(sessionId);
    expect(state?.activeMode).toBe('voice');
    expect(state?.messages).toHaveLength(4);
    expect(state?.metadata.messageCount).toBe(2); // Only assistant messages counted
  });
});