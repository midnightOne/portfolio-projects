/**
 * AI System Communication Layer - UI System Task 14
 * 
 * Handles bidirectional communication between UI System and AI System,
 * including message passing, event coordination, and state synchronization.
 * 
 * Requirements: 8.7, 8.8
 */

'use client';

import type { 
  UserActionEvent, 
  AISystemEvent,
  NavigationCommand,
  UIState 
} from './types';
import { getAISystemIntegration } from './ai-system-integration';

// Communication Message Types
export interface AIMessage {
  id: string;
  type: 'command' | 'query' | 'notification' | 'response';
  source: 'ui_system' | 'ai_system';
  target: 'ui_system' | 'ai_system';
  data: any;
  timestamp: number;
  sessionId: string;
  correlationId?: string; // For request/response correlation
}

export interface AICommandMessage extends AIMessage {
  type: 'command';
  data: {
    action: string;
    parameters: any;
    options?: any;
  };
}

export interface AIQueryMessage extends AIMessage {
  type: 'query';
  data: {
    query: string;
    context?: any;
  };
}

export interface AINotificationMessage extends AIMessage {
  type: 'notification';
  data: {
    event: UserActionEvent | AISystemEvent;
  };
}

export interface AIResponseMessage extends AIMessage {
  type: 'response';
  data: {
    success: boolean;
    result?: any;
    error?: string;
  };
}

// Communication Channel Interface
export interface CommunicationChannel {
  send: (message: AIMessage) => Promise<void>;
  subscribe: (callback: (message: AIMessage) => void) => () => void;
  close: () => void;
  isConnected: () => boolean;
}

// WebSocket-based Communication Channel
export class WebSocketChannel implements CommunicationChannel {
  private ws: WebSocket | null = null;
  private callbacks: Array<(message: AIMessage) => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isClosing = false;
  
  constructor(private url: string) {
    this.connect();
  }
  
  private connect(): void {
    if (this.isClosing) return;
    
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('AI Communication: WebSocket connected');
        this.reconnectAttempts = 0;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message: AIMessage = JSON.parse(event.data);
          this.callbacks.forEach(callback => {
            try {
              callback(message);
            } catch (error) {
              console.error('AI Communication: Callback error:', error);
            }
          });
        } catch (error) {
          console.error('AI Communication: Message parsing error:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('AI Communication: WebSocket disconnected');
        this.ws = null;
        
        if (!this.isClosing && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => {
            console.log(`AI Communication: Reconnecting (attempt ${this.reconnectAttempts})`);
            this.connect();
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('AI Communication: WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('AI Communication: Connection failed:', error);
    }
  }
  
  async send(message: AIMessage): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('AI Communication: Send failed:', error);
        throw error;
      }
    } else {
      throw new Error('AI Communication: WebSocket not connected');
    }
  }
  
  subscribe(callback: (message: AIMessage) => void): () => void {
    this.callbacks.push(callback);
    
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }
  
  close(): void {
    this.isClosing = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// PostMessage-based Communication Channel (for iframe/worker communication)
export class PostMessageChannel implements CommunicationChannel {
  private callbacks: Array<(message: AIMessage) => void> = [];
  private messageListener: ((event: MessageEvent) => void) | null = null;
  
  constructor(private targetWindow: Window, private targetOrigin: string = '*') {
    this.setupMessageListener();
  }
  
  private setupMessageListener(): void {
    this.messageListener = (event: MessageEvent) => {
      // Validate origin if specified
      if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) {
        return;
      }
      
      // Validate message format
      if (event.data && typeof event.data === 'object' && event.data.type && event.data.source) {
        const message = event.data as AIMessage;
        this.callbacks.forEach(callback => {
          try {
            callback(message);
          } catch (error) {
            console.error('AI Communication: PostMessage callback error:', error);
          }
        });
      }
    };
    
    window.addEventListener('message', this.messageListener);
  }
  
  async send(message: AIMessage): Promise<void> {
    try {
      this.targetWindow.postMessage(message, this.targetOrigin);
    } catch (error) {
      console.error('AI Communication: PostMessage send failed:', error);
      throw error;
    }
  }
  
  subscribe(callback: (message: AIMessage) => void): () => void {
    this.callbacks.push(callback);
    
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }
  
  close(): void {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }
    this.callbacks = [];
  }
  
  isConnected(): boolean {
    return this.messageListener !== null;
  }
}

// In-Memory Communication Channel (for same-process communication)
export class InMemoryChannel implements CommunicationChannel {
  private static channels: Map<string, InMemoryChannel> = new Map();
  private callbacks: Array<(message: AIMessage) => void> = [];
  private isActive = true;
  
  constructor(private channelId: string) {
    InMemoryChannel.channels.set(channelId, this);
  }
  
  static getChannel(channelId: string): InMemoryChannel | undefined {
    return InMemoryChannel.channels.get(channelId);
  }
  
  async send(message: AIMessage): Promise<void> {
    if (!this.isActive) {
      throw new Error('AI Communication: InMemory channel is closed');
    }
    
    // Send to all other channels (broadcast)
    InMemoryChannel.channels.forEach((channel, id) => {
      if (id !== this.channelId && channel.isActive) {
        channel.callbacks.forEach(callback => {
          try {
            // Use setTimeout to make it async
            setTimeout(() => callback(message), 0);
          } catch (error) {
            console.error('AI Communication: InMemory callback error:', error);
          }
        });
      }
    });
  }
  
  subscribe(callback: (message: AIMessage) => void): () => void {
    this.callbacks.push(callback);
    
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }
  
  close(): void {
    this.isActive = false;
    this.callbacks = [];
    InMemoryChannel.channels.delete(this.channelId);
  }
  
  isConnected(): boolean {
    return this.isActive;
  }
}

// AI Communication Manager
export class AICommunicationManager {
  private channel: CommunicationChannel | null = null;
  private messageHandlers: Map<string, (message: AIMessage) => Promise<void>> = new Map();
  private pendingRequests: Map<string, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private sessionId: string;
  private unsubscribe: (() => void) | null = null;
  
  constructor(sessionId?: string) {
    this.sessionId = sessionId || `comm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.setupDefaultHandlers();
  }
  
  // Initialize communication channel
  connect(channel: CommunicationChannel): void {
    if (this.channel) {
      this.disconnect();
    }
    
    this.channel = channel;
    this.unsubscribe = channel.subscribe(this.handleMessage.bind(this));
    
    console.log('AI Communication: Manager connected');
  }
  
  // Disconnect from communication channel
  disconnect(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    
    // Clear pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Communication disconnected'));
    });
    this.pendingRequests.clear();
    
    console.log('AI Communication: Manager disconnected');
  }
  
  // Send command to AI system
  async sendCommand(action: string, parameters: any, options?: any): Promise<any> {
    const message: AICommandMessage = {
      id: this.generateMessageId(),
      type: 'command',
      source: 'ui_system',
      target: 'ai_system',
      data: { action, parameters, options },
      timestamp: Date.now(),
      sessionId: this.sessionId,
      correlationId: this.generateCorrelationId()
    };
    
    return this.sendAndWaitForResponse(message);
  }
  
  // Send query to AI system
  async sendQuery(query: string, context?: any): Promise<any> {
    const message: AIQueryMessage = {
      id: this.generateMessageId(),
      type: 'query',
      source: 'ui_system',
      target: 'ai_system',
      data: { query, context },
      timestamp: Date.now(),
      sessionId: this.sessionId,
      correlationId: this.generateCorrelationId()
    };
    
    return this.sendAndWaitForResponse(message);
  }
  
  // Send notification to AI system
  async sendNotification(event: UserActionEvent | AISystemEvent): Promise<void> {
    const message: AINotificationMessage = {
      id: this.generateMessageId(),
      type: 'notification',
      source: 'ui_system',
      target: 'ai_system',
      data: { event },
      timestamp: Date.now(),
      sessionId: this.sessionId
    };
    
    await this.sendMessage(message);
  }
  
  // Register message handler
  registerHandler(messageType: string, handler: (message: AIMessage) => Promise<void>): void {
    this.messageHandlers.set(messageType, handler);
  }
  
  // Unregister message handler
  unregisterHandler(messageType: string): void {
    this.messageHandlers.delete(messageType);
  }
  
  // Private methods
  private async handleMessage(message: AIMessage): Promise<void> {
    try {
      // Handle responses to pending requests
      if (message.type === 'response' && message.correlationId) {
        const pending = this.pendingRequests.get(message.correlationId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.correlationId);
          
          if (message.data.success) {
            pending.resolve(message.data.result);
          } else {
            pending.reject(new Error(message.data.error || 'Unknown error'));
          }
          return;
        }
      }
      
      // Handle other message types
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        await handler(message);
      } else {
        console.warn(`AI Communication: No handler for message type: ${message.type}`);
      }
      
    } catch (error) {
      console.error('AI Communication: Message handling error:', error);
    }
  }
  
  private async sendMessage(message: AIMessage): Promise<void> {
    if (!this.channel || !this.channel.isConnected()) {
      throw new Error('AI Communication: Not connected');
    }
    
    await this.channel.send(message);
  }
  
  private async sendAndWaitForResponse(message: AIMessage, timeout = 10000): Promise<any> {
    if (!message.correlationId) {
      message.correlationId = this.generateCorrelationId();
    }
    
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(message.correlationId!);
        reject(new Error('AI Communication: Request timeout'));
      }, timeout);
      
      this.pendingRequests.set(message.correlationId, {
        resolve,
        reject,
        timeout: timeoutHandle
      });
      
      this.sendMessage(message).catch(reject);
    });
  }
  
  private setupDefaultHandlers(): void {
    // Handle AI system commands
    this.registerHandler('command', async (message: AIMessage) => {
      const commandMessage = message as AICommandMessage;
      const aiIntegration = getAISystemIntegration();
      const { action, parameters, options } = commandMessage.data;
      
      try {
        let result: any;
        
        switch (action) {
          case 'navigateToSection':
            await aiIntegration.navigateToSection(parameters.target, options);
            result = { success: true };
            break;
            
          case 'navigateToProject':
            await aiIntegration.navigateToProject(parameters.projectSlug, options);
            result = { success: true };
            break;
            
          case 'openProjectModal':
            await aiIntegration.openProjectModal(parameters.projectId, parameters.data, options);
            result = { success: true };
            break;
            
          case 'closeProjectModal':
            await aiIntegration.closeProjectModal(parameters.modalId);
            result = { success: true };
            break;
            
          case 'highlightElement':
            await aiIntegration.highlightElement(parameters.target, parameters.options);
            result = { success: true };
            break;
            
          case 'removeHighlight':
            await aiIntegration.removeHighlight(parameters.target);
            result = { success: true };
            break;
            
          case 'setFocus':
            await aiIntegration.setFocus(parameters.target);
            result = { success: true };
            break;
            
          case 'getUIState':
            result = aiIntegration.getUIState();
            break;
            
          case 'updateUIState':
            await aiIntegration.updateUIState(parameters.updates);
            result = { success: true };
            break;
            
          default:
            throw new Error(`Unknown action: ${action}`);
        }
        
        // Send response
        if (message.correlationId) {
          const response: AIResponseMessage = {
            id: this.generateMessageId(),
            type: 'response',
            source: 'ui_system',
            target: 'ai_system',
            data: { success: true, result },
            timestamp: Date.now(),
            sessionId: this.sessionId,
            correlationId: message.correlationId
          };
          
          await this.sendMessage(response);
        }
        
      } catch (error) {
        console.error('AI Communication: Command execution failed:', error);
        
        // Send error response
        if (message.correlationId) {
          const response: AIResponseMessage = {
            id: this.generateMessageId(),
            type: 'response',
            source: 'ui_system',
            target: 'ai_system',
            data: { success: false, error: error.message },
            timestamp: Date.now(),
            sessionId: this.sessionId,
            correlationId: message.correlationId
          };
          
          await this.sendMessage(response);
        }
      }
    });
    
    // Handle AI system queries
    this.registerHandler('query', async (message: AIQueryMessage) => {
      const aiIntegration = getAISystemIntegration();
      const { query, context } = message.data;
      
      try {
        let result: any;
        
        // Handle different query types
        if (query === 'getUIState') {
          result = aiIntegration.getUIState();
        } else if (query === 'isAnimating') {
          const { isAnimating } = await import('./animation');
          result = isAnimating();
        } else if (query === 'getDebugInfo') {
          const { getAISystemDebugInfo } = await import('./ai-system-integration');
          result = getAISystemDebugInfo();
        } else {
          throw new Error(`Unknown query: ${query}`);
        }
        
        // Send response
        if (message.correlationId) {
          const response: AIResponseMessage = {
            id: this.generateMessageId(),
            type: 'response',
            source: 'ui_system',
            target: 'ai_system',
            data: { success: true, result },
            timestamp: Date.now(),
            sessionId: this.sessionId,
            correlationId: message.correlationId
          };
          
          await this.sendMessage(response);
        }
        
      } catch (error) {
        console.error('AI Communication: Query execution failed:', error);
        
        // Send error response
        if (message.correlationId) {
          const response: AIResponseMessage = {
            id: this.generateMessageId(),
            type: 'response',
            source: 'ui_system',
            target: 'ai_system',
            data: { success: false, error: error.message },
            timestamp: Date.now(),
            sessionId: this.sessionId,
            correlationId: message.correlationId
          };
          
          await this.sendMessage(response);
        }
      }
    });
  }
  
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Getters
  get isConnected(): boolean {
    return this.channel !== null && this.channel.isConnected();
  }
  
  get currentSessionId(): string {
    return this.sessionId;
  }
}

// Global communication manager instance
let globalCommunicationManager: AICommunicationManager | null = null;

// Get or create communication manager
export function getCommunicationManager(): AICommunicationManager {
  if (!globalCommunicationManager) {
    globalCommunicationManager = new AICommunicationManager();
  }
  return globalCommunicationManager;
}

// React Hook for AI Communication
export function useAICommunication(): {
  manager: AICommunicationManager;
  isConnected: boolean;
  sendCommand: (action: string, parameters: any, options?: any) => Promise<any>;
  sendQuery: (query: string, context?: any) => Promise<any>;
  sendNotification: (event: UserActionEvent | AISystemEvent) => Promise<void>;
} {
  const manager = getCommunicationManager();
  
  return {
    manager,
    isConnected: manager.isConnected,
    sendCommand: manager.sendCommand.bind(manager),
    sendQuery: manager.sendQuery.bind(manager),
    sendNotification: manager.sendNotification.bind(manager),
  };
}

// Utility functions
export function createWebSocketChannel(url: string): WebSocketChannel {
  return new WebSocketChannel(url);
}

export function createPostMessageChannel(targetWindow: Window, targetOrigin?: string): PostMessageChannel {
  return new PostMessageChannel(targetWindow, targetOrigin);
}

export function createInMemoryChannel(channelId: string): InMemoryChannel {
  return new InMemoryChannel(channelId);
}

// Export types
export type {
  AIMessage,
  AICommandMessage,
  AIQueryMessage,
  AINotificationMessage,
  AIResponseMessage,
  CommunicationChannel
};