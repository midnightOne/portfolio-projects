/**
 * IConversationalAgentAdapter Interface
 * 
 * Provider-agnostic interface for voice AI implementations.
 * This interface enables dynamic switching between OpenAI Realtime and ElevenLabs
 * while maintaining consistent behavior and state management.
 */

import {
  VoiceProvider,
  VoiceAgentState,
  AdapterInitOptions,
  ConnectionStatus,
  SessionStatus,
  TranscriptItem,
  ToolCall,
  ToolResult,
  ProviderMetadata,
  VoiceAgentError
} from '@/types/voice-agent';

export interface IConversationalAgentAdapter {
  // Provider identification
  readonly provider: VoiceProvider;
  readonly metadata: ProviderMetadata;
  
  // Lifecycle management
  init(options: AdapterInitOptions): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  cleanup(): Promise<void>;
  
  // Connection state
  getConnectionStatus(): ConnectionStatus;
  getSessionStatus(): SessionStatus;
  isConnected(): boolean;
  
  // Audio management
  startAudioInput(): Promise<void>;
  stopAudioInput(): Promise<void>;
  mute(): void;
  unmute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
  
  // Conversation management
  sendMessage(message: string): Promise<void>;
  sendAudioData(audioData: ArrayBuffer): Promise<void>;
  interrupt(): Promise<void>;
  
  // Tool calling
  registerTool(tool: import('@/types/voice-agent').ToolDefinition): void;
  unregisterTool(toolName: string): void;
  getAvailableTools(): string[];
  
  // Transcript and history
  getTranscript(): TranscriptItem[];
  clearTranscript(): void;
  exportTranscript(): Promise<string>;
  
  // Configuration
  updateConfig(config: Partial<AdapterInitOptions>): Promise<void>;
  getConfig(): AdapterInitOptions;
  
  // Error handling
  getLastError(): VoiceAgentError | null;
  clearErrors(): void;
  
  // Provider-specific methods (optional)
  getProviderSpecificState?(): any;
  executeProviderSpecificAction?(action: string, params?: any): Promise<any>;
  
  // Event handling (internal - called by the adapter implementation)
  _handleConnectionEvent(event: import('@/types/voice-agent').ConnectionEvent): void;
  _handleTranscriptEvent(event: import('@/types/voice-agent').TranscriptEvent): void;
  _handleAudioEvent(event: import('@/types/voice-agent').AudioEvent): void;
  _handleToolEvent(event: import('@/types/voice-agent').ToolEvent): void;
}

/**
 * Base adapter class that provides common functionality
 * for all voice agent implementations
 */
export abstract class BaseConversationalAgentAdapter implements IConversationalAgentAdapter {
  protected _provider: VoiceProvider;
  protected _metadata: ProviderMetadata;
  protected _options: AdapterInitOptions | null = null;
  protected _connectionStatus: ConnectionStatus = 'disconnected';
  protected _sessionStatus: SessionStatus = 'idle';
  protected _transcript: TranscriptItem[] = [];
  protected _tools: Map<string, import('@/types/voice-agent').ToolDefinition> = new Map();
  protected _lastError: VoiceAgentError | null = null;
  protected _audioElement?: HTMLAudioElement;
  protected _isMuted: boolean = false;
  protected _volume: number = 1.0;

  constructor(provider: VoiceProvider, metadata: ProviderMetadata) {
    this._provider = provider;
    this._metadata = metadata;
  }

  // Getters
  get provider(): VoiceProvider {
    return this._provider;
  }

  get metadata(): ProviderMetadata {
    return this._metadata;
  }

  getConnectionStatus(): ConnectionStatus {
    return this._connectionStatus;
  }

  getSessionStatus(): SessionStatus {
    return this._sessionStatus;
  }

  isConnected(): boolean {
    return this._connectionStatus === 'connected';
  }

  isMuted(): boolean {
    return this._isMuted;
  }

  getVolume(): number {
    return this._volume;
  }

  getTranscript(): TranscriptItem[] {
    return [...this._transcript];
  }

  getAvailableTools(): string[] {
    return Array.from(this._tools.keys());
  }

  getLastError(): VoiceAgentError | null {
    return this._lastError;
  }

  getConfig(): AdapterInitOptions {
    if (!this._options) {
      throw new VoiceAgentError('Adapter not initialized', this._provider);
    }
    return { ...this._options };
  }

  // Common implementations
  registerTool(tool: import('@/types/voice-agent').ToolDefinition): void {
    this._tools.set(tool.name, tool);
  }

  unregisterTool(toolName: string): void {
    this._tools.delete(toolName);
  }

  clearTranscript(): void {
    this._transcript = [];
  }

  clearErrors(): void {
    this._lastError = null;
  }

  mute(): void {
    this._isMuted = true;
    if (this._audioElement) {
      this._audioElement.muted = true;
    }
  }

  unmute(): void {
    this._isMuted = false;
    if (this._audioElement) {
      this._audioElement.muted = false;
    }
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this._audioElement) {
      this._audioElement.volume = this._volume;
    }
  }

  async exportTranscript(): Promise<string> {
    const transcript = this._transcript.map(item => ({
      timestamp: item.timestamp.toISOString(),
      type: item.type,
      content: item.content,
      provider: item.provider,
      metadata: item.metadata
    }));
    
    return JSON.stringify(transcript, null, 2);
  }

  // Event handlers
  _handleConnectionEvent(event: import('@/types/voice-agent').ConnectionEvent): void {
    this._connectionStatus = event.type === 'connected' ? 'connected' : 
                           event.type === 'disconnected' ? 'disconnected' :
                           event.type === 'reconnecting' ? 'reconnecting' : 'error';
    
    if (event.error) {
      this._lastError = new VoiceAgentError(event.error, this._provider);
    }
    
    this._options?.onConnectionEvent(event);
  }

  _handleTranscriptEvent(event: import('@/types/voice-agent').TranscriptEvent): void {
    this._transcript.push(event.item);
    this._options?.onTranscriptEvent(event);
  }

  _handleAudioEvent(event: import('@/types/voice-agent').AudioEvent): void {
    this._options?.onAudioEvent(event);
  }

  _handleToolEvent(event: import('@/types/voice-agent').ToolEvent): void {
    this._options?.onToolEvent(event);
  }

  // Protected helper methods
  protected _setConnectionStatus(status: ConnectionStatus): void {
    this._connectionStatus = status;
  }

  protected _setSessionStatus(status: SessionStatus): void {
    this._sessionStatus = status;
  }

  protected _addTranscriptItem(item: TranscriptItem): void {
    this._transcript.push(item);
  }

  protected _setError(error: VoiceAgentError): void {
    this._lastError = error;
  }

  protected async _executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this._tools.get(toolCall.name);
    if (!tool) {
      throw new Error(`Tool '${toolCall.name}' not found`);
    }

    const startTime = Date.now();
    try {
      const result = await tool.handler(toolCall.arguments);
      const executionTime = Date.now() - startTime;
      
      return {
        id: toolCall.id,
        result,
        timestamp: new Date(),
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        id: toolCall.id,
        result: null,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        executionTime
      };
    }
  }

  /**
   * Unified Tool Execution Pipeline
   * 
   * Provides single, predictable execution path for all tools regardless of provider.
   * Routes client tools to UINavigationTools and server tools to /api/ai/tools/execute.
   * Includes comprehensive debug event emission with toolCallId correlation.
   */
  protected async _executeUnifiedTool(toolName: string, args: any): Promise<any> {
    // Import dependencies dynamically to avoid circular imports
    const { unifiedToolRegistry } = await import('@/lib/ai/tools/UnifiedToolRegistry');
    const { debugEventEmitter } = await import('@/lib/debug/debugEventEmitter');
    const { v4: uuidv4 } = await import('uuid');

    const toolDef = unifiedToolRegistry.getToolDefinition(toolName);
    if (!toolDef) {
      throw new Error(`Tool '${toolName}' not found in unified registry.`);
    }

    const toolCallId = uuidv4();
    const sessionId = this._options?.contextId || 'unknown-session';
    const startTime = Date.now();
    
    // Emit debug event for tool call start with correlation ID
    debugEventEmitter.emit('tool_call_start', {
      toolName,
      args,
      sessionId,
      toolCallId,
      executionContext: toolDef.executionContext,
      provider: this._provider
    }, `${this._provider}-adapter`);

    try {
      let result: any;
      
      if (toolDef.executionContext === 'client') {
        // Execute client-side tools using UINavigationTools
        if (typeof window === 'undefined') {
          throw new Error(`Client-side tool '${toolName}' cannot be executed in server environment`);
        }

        const { uiNavigationTools } = await import('./UINavigationTools');
        const uiToolHandler = (uiNavigationTools as any)[toolName];
        
        if (typeof uiToolHandler === 'function') {
          const uiResult = await uiToolHandler(args);
          result = uiResult.data || uiResult.message;
        } else {
          throw new Error(`Client-side UI tool handler for '${toolName}' not found.`);
        }
      } else if (toolDef.executionContext === 'server') {
        // Execute server-side tools via unified API endpoint
        const response = await fetch('/api/ai/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolName: toolName,
            parameters: args,
            sessionId: sessionId,
            toolCallId: toolCallId,
            reflinkId: this._options?.reflinkId
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server tool '${toolName}' failed: ${response.status} - ${errorText}`);
        }

        const serverResult = await response.json();
        if (!serverResult.success) {
          throw new Error(serverResult.error || 'Server tool execution failed');
        }
        
        result = serverResult.data;
      } else {
        throw new Error(`Invalid execution context '${toolDef.executionContext}' for tool '${toolName}'`);
      }

      const executionTime = Date.now() - startTime;

      // Emit debug event for successful tool call completion
      debugEventEmitter.emit('tool_call_complete', {
        toolName,
        result,
        executionTime,
        success: true,
        sessionId,
        toolCallId,
        executionContext: toolDef.executionContext,
        provider: this._provider
      }, `${this._provider}-adapter`);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Emit debug event for failed tool call completion
      debugEventEmitter.emit('tool_call_complete', {
        toolName,
        result: null,
        error: errorMessage,
        executionTime,
        success: false,
        sessionId,
        toolCallId,
        executionContext: toolDef.executionContext,
        provider: this._provider
      }, `${this._provider}-adapter`);

      throw error;
    }
  }

  // Abstract methods that must be implemented by concrete adapters
  abstract init(options: AdapterInitOptions): Promise<void>;
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract cleanup(): Promise<void>;
  abstract startAudioInput(): Promise<void>;
  abstract stopAudioInput(): Promise<void>;
  abstract sendMessage(message: string): Promise<void>;
  abstract sendAudioData(audioData: ArrayBuffer): Promise<void>;
  abstract interrupt(): Promise<void>;
  abstract updateConfig(config: Partial<AdapterInitOptions>): Promise<void>;
}

/**
 * Factory function to create adapter instances
 */
export type AdapterFactory = (provider: VoiceProvider) => Promise<IConversationalAgentAdapter>;

/**
 * Registry for adapter factories
 */
export class AdapterRegistry {
  private static _factories: Map<VoiceProvider, AdapterFactory> = new Map();

  static register(provider: VoiceProvider, factory: AdapterFactory): void {
    this._factories.set(provider, factory);
  }

  static async create(provider: VoiceProvider): Promise<IConversationalAgentAdapter> {
    const factory = this._factories.get(provider);
    if (!factory) {
      throw new VoiceAgentError(`No adapter factory registered for provider: ${provider}`, provider);
    }
    return factory(provider);
  }

  static getAvailableProviders(): VoiceProvider[] {
    return Array.from(this._factories.keys());
  }

  static isProviderSupported(provider: VoiceProvider): boolean {
    return this._factories.has(provider);
  }
}