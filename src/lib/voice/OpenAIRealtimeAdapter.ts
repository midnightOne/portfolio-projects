/**
 * OpenAI Realtime Adapter - SDK 0.1.0 Implementation
 * 
 * Modern implementation using @openai/agents SDK 0.1.0 with direct client-side connections.
 * Based on the working openai-realtime-next demo.
 */

import { v4 as uuidv4 } from 'uuid';
import {
    VoiceProvider,
    AdapterInitOptions,
    TranscriptItem,
    ToolCall,
    ToolResult,
    ProviderMetadata,
    VoiceAgentError,
    ConnectionError,
    AudioError,
    ToolError,
    OpenAIRealtimeConfig
} from '@/types/voice-agent';
import { BaseConversationalAgentAdapter } from './IConversationalAgentAdapter';

// OpenAI Realtime SDK 0.1.0 imports
import {
    RealtimeAgent,
    RealtimeSession,
    tool,
    TransportEvent,
    RealtimeItem,
    RealtimeContextData,
    backgroundResult,
} from '@openai/agents/realtime';
import { z } from 'zod';

interface OpenAIRealtimeEvent {
    type: string;
    [key: string]: any;
}

export class OpenAIRealtimeAdapter extends BaseConversationalAgentAdapter {
    private _agent: RealtimeAgent | null = null;
    private _session: RealtimeSession<any> | null = null;
    private _isConnected: boolean = false;
    private _history: RealtimeItem[] = [];
    private _events: TransportEvent[] = [];
    private _mcpTools: string[] = [];
    protected _isRecording: boolean = false;
    protected _isInitialized: boolean = false;

    constructor() {
        const metadata: ProviderMetadata = {
            provider: 'openai',
            model: 'gpt-realtime',
            capabilities: ['streaming', 'interruption', 'toolCalling', 'realTimeAudio'],
            quality: 'high'
        };
        super('openai', metadata);
        this._initializeAgent();
    }

    private _initializeAgent() {
        // Create tools for the agent
        const weatherTool = tool({
            name: 'weather',
            description: 'Get the weather in a given location',
            parameters: z.object({
                location: z.string(),
            }),
            execute: async ({ location }) => {
                return backgroundResult(`The weather in ${location} is sunny.`);
            },
        });

        // Create the main agent
        this._agent = new RealtimeAgent({
            name: 'Portfolio Assistant',
            instructions: 'You are a helpful assistant. Keep responses brief and friendly.',
            tools: [weatherTool],
        });
    }

    async init(options: AdapterInitOptions): Promise<void> {
        try {
            console.log('OpenAIRealtimeAdapter: Initializing with options:', options);
            
            if (!this._agent) {
                throw new Error('Agent not initialized');
            }

            // Store the options for later use
            this._options = options;

            // Create the realtime session
            this._session = new RealtimeSession(this._agent, {
                model: 'gpt-realtime',
                config: {
                    audio: {
                        output: {
                            voice: 'alloy',
                        },
                    },
                },
            });

            // Set up event listeners
            this._setupEventListeners();

            this._isInitialized = true;
            console.log('OpenAIRealtimeAdapter: Initialization complete');
        } catch (error) {
            console.error('OpenAI Realtime initialization failed:', error);
            throw new ConnectionError(
                `Failed to initialize OpenAI Realtime: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'openai'
            );
        }
    }

    private _setupEventListeners() {
        if (!this._session) return;

        this._session.on('transport_event', (event: TransportEvent) => {
            this._events.push(event);
            console.log('Transport event:', event.type);
            
            // Emit connection events based on transport events
            if (event.type === 'session.created') {
                console.log('Emitting connected event from session.created');
                this._emitConnectionEvent('connected');
            } else if (event.type === 'session.updated') {
                // Also emit connected on session.updated to ensure UI gets the event
                console.log('Emitting connected event from session.updated');
                this._emitConnectionEvent('connected');
            } else if (event.type === 'error') {
                console.log('Emitting error event');
                this._emitConnectionEvent('error', (event as any).error?.message || 'Unknown error');
            }
        });

        this._session.on('mcp_tools_changed', (tools: any[]) => {
            this._mcpTools = tools.map((t) => t.name);
            console.log('MCP tools changed:', this._mcpTools);
        });

        this._session.on('history_updated', (history: RealtimeItem[]) => {
            console.log('History updated, items:', history.length);
            this._history = history;
            this._processHistoryUpdate(history);
        });

        this._session.on('tool_approval_requested', (_context, _agent, approvalRequest) => {
            // For now, auto-approve all tools. In production, you might want user confirmation
            this._session?.approve(approvalRequest.approvalItem);
        });
    }

    private _processHistoryUpdate(history: RealtimeItem[]) {
        // Convert RealtimeItem[] to TranscriptItem[] for the interface
        const transcriptItems: TranscriptItem[] = history.map((item, index) => {
            // Determine the type based on the item's role or origin
            let itemType: 'user_speech' | 'ai_response' = 'ai_response';
            
            // Debug log the item structure
            console.log('Processing history item:', {
                index,
                type: item.type,
                role: 'role' in item ? item.role : 'no role',
                object: 'object' in item ? item.object : 'no object',
                hasContent: 'content' in item,
                keys: Object.keys(item)
            });
            
            // Check various properties to determine if it's user input
            if ('role' in item && item.role === 'user') {
                itemType = 'user_speech';
                console.log('Detected user speech via role');
            } else if (item.type === 'message' && 'content' in item) {
                // Check if it's an input audio transcription
                const content = Array.isArray(item.content) ? item.content : [item.content];
                const hasInputAudio = content.some((c: any) => 
                    c?.type === 'input_audio' || 
                    c?.type === 'input_text' ||
                    (typeof c === 'object' && 'input_audio_transcription' in c)
                );
                if (hasInputAudio) {
                    itemType = 'user_speech';
                    console.log('Detected user speech via input audio content');
                }
                
                // Also check if the role is in the item itself
                if ('role' in item && item.role === 'user') {
                    itemType = 'user_speech';
                    console.log('Detected user speech via message role');
                }
            } else if ('object' in item && item.object === 'realtime.item' && 'type' in item) {
                // OpenAI Realtime API structure
                if (item.type === 'message' && 'role' in item && item.role === 'user') {
                    itemType = 'user_speech';
                    console.log('Detected user speech via realtime item structure');
                }
            }
            
            // Additional check for items that might be user input based on their position or context
            // If this is the first item in a conversation turn, it's likely user input
            if (index > 0 && history[index - 1] && 'role' in history[index - 1] && history[index - 1].role === 'assistant') {
                // If the previous item was from assistant, this might be user
                if (item.type === 'message' && !('role' in item && item.role === 'assistant')) {
                    itemType = 'user_speech';
                    console.log('Detected user speech via conversation flow');
                }
            }

            const content = this._extractContentFromItem(item);
            
            console.log('Final item classification:', {
                index,
                type: itemType,
                content: content.substring(0, 50),
                hasContent: content.length > 0
            });
            
            return {
                id: `item-${index}`,
                type: itemType,
                content,
                timestamp: new Date(Date.now()),
                provider: 'openai'
            };
        }).filter(item => item.content.trim().length > 0); // Only include items with actual content

        // Emit transcript events for new items
        const previousLength = this._transcript.length;
        const newItems = transcriptItems.slice(previousLength);
        
        // Update internal transcript
        this._transcript = transcriptItems;
        
        // Emit events for new items
        newItems.forEach(item => {
            console.log('Emitting transcript event for:', item.type, item.content.substring(0, 50));
            this._emitTranscriptEvent(item);
        });
    }

    // Helper methods to emit events to the context
    private _emitConnectionEvent(type: 'connected' | 'disconnected' | 'reconnecting' | 'error', error?: string) {
        console.log('_emitConnectionEvent called:', { type, error, hasCallback: !!this._options?.onConnectionEvent });
        if (this._options?.onConnectionEvent) {
            this._options.onConnectionEvent({
                type,
                provider: 'openai',
                error,
                timestamp: new Date()
            });
            console.log('Connection event emitted successfully');
        } else {
            console.log('No onConnectionEvent callback available');
        }
    }

    private _emitTranscriptEvent(item: TranscriptItem) {
        console.log('_emitTranscriptEvent called:', { item, hasCallback: !!this._options?.onTranscriptEvent });
        if (this._options?.onTranscriptEvent) {
            this._options.onTranscriptEvent({
                type: 'transcript_update',
                item,
                timestamp: new Date()
            });
            console.log('Transcript event emitted successfully');
        } else {
            console.log('No onTranscriptEvent callback available');
        }
    }

    private _emitAudioEvent(type: 'audio_start' | 'audio_end' | 'audio_error', error?: string) {
        if (this._options?.onAudioEvent) {
            this._options.onAudioEvent({
                type,
                error,
                timestamp: new Date()
            });
        }
    }

    private _extractContentFromItem(item: RealtimeItem): string {
        // Extract text content from RealtimeItem
        try {
            console.log('Extracting content from item:', {
                type: item.type,
                hasContent: 'content' in item,
                hasTranscript: 'transcript' in item,
                hasText: 'text' in item,
                keys: Object.keys(item)
            });
            
            // Handle different item structures
            if (item.type === 'message' && 'content' in item) {
                if (Array.isArray(item.content)) {
                    const textContent = item.content
                        .filter((c: any) => {
                            const isTextType = c.type === 'text' || c.type === 'input_text' || c.type === 'input_audio';
                            console.log('Content part:', { type: c.type, isTextType, hasText: !!c.text, hasTranscript: !!c.transcript });
                            return isTextType;
                        })
                        .map((c: any) => {
                            // Try multiple properties for text content
                            const text = c.text || c.transcript || c.audio_transcript || c.content || '';
                            console.log('Extracted text from content part:', text.substring(0, 50));
                            return text;
                        })
                        .filter(text => text && text.trim().length > 0)
                        .join(' ');
                    
                    if (textContent) {
                        return textContent;
                    }
                }
                
                // If content is not an array, try to extract directly
                if (typeof item.content === 'string') {
                    return item.content;
                } else if (typeof item.content === 'object' && item.content !== null) {
                    // Try to extract text from object content
                    const content = item.content as any;
                    return content.text || content.transcript || content.audio_transcript || '';
                }
            }
            
            // Handle audio transcription items directly
            if ('transcript' in item && item.transcript) {
                console.log('Found transcript property:', item.transcript);
                return String(item.transcript);
            }
            
            // Handle text items directly
            if ('text' in item && item.text) {
                console.log('Found text property:', item.text);
                return String(item.text);
            }
            
            // Handle audio_transcript property
            if ('audio_transcript' in item && (item as any).audio_transcript) {
                console.log('Found audio_transcript property:', (item as any).audio_transcript);
                return String((item as any).audio_transcript);
            }
            
            // Handle formatted content
            if ('formatted' in item && item.formatted) {
                if (typeof item.formatted === 'object' && 'text' in item.formatted) {
                    return String(item.formatted.text);
                }
                return String(item.formatted);
            }
            
            // Last resort: try to find any text-like property
            const itemAny = item as any;
            for (const key of ['content', 'message', 'data', 'value']) {
                if (itemAny[key] && typeof itemAny[key] === 'string') {
                    console.log(`Found text in ${key} property:`, itemAny[key]);
                    return itemAny[key];
                }
            }
            
            console.log('No text content found in item');
            return '';
        } catch (error) {
            console.warn('Error extracting content from item:', error, item);
            return '';
        }
    }

    async connect(): Promise<void> {
        console.log('OpenAIRealtimeAdapter: Connect called');
        
        if (!this._session) {
            throw new ConnectionError('Session not initialized', 'openai');
        }

        try {
            console.log('OpenAIRealtimeAdapter: Getting token...');
            // Get token from our API
            const response = await fetch('/api/ai/openai/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get token');
            }

            const { token } = await response.json();
            console.log('OpenAIRealtimeAdapter: Token received, connecting...');

            // Connect to OpenAI Realtime
            await this._session.connect({
                apiKey: token,
            });

            this._isConnected = true;
            this._connectionStatus = 'connected';
            console.log('OpenAIRealtimeAdapter: Connected successfully, emitting event');
            this._emitConnectionEvent('connected');

        } catch (error) {
            console.error('OpenAIRealtimeAdapter: Connection failed:', error);
            this._connectionStatus = 'error';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this._emitConnectionEvent('error', errorMessage);
            throw new ConnectionError(`Failed to connect: ${errorMessage}`, 'openai');
        }
    }

    async disconnect(): Promise<void> {
        if (this._session && this._isConnected) {
            try {
                await this._session.close();
                this._isConnected = false;
                this._connectionStatus = 'disconnected';
                console.log('Disconnected from OpenAI Realtime');
                this._emitConnectionEvent('disconnected');
            } catch (error) {
                console.error('Disconnect failed:', error);
                throw new ConnectionError(
                    `Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    'openai'
                );
            }
        }
    }

    async startListening(): Promise<void> {
        if (!this._isConnected) {
            throw new ConnectionError('Not connected to OpenAI Realtime', 'openai');
        }

        try {
            if (this._isMuted) {
                await this._session?.mute(false);
                this._isMuted = false;
            }
            this._isRecording = true;
            this._sessionStatus = 'listening';
            console.log('Started listening');
            this._emitAudioEvent('audio_start');
        } catch (error) {
            throw new AudioError(
                `Failed to start listening: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'openai'
            );
        }
    }

    async stopListening(): Promise<void> {
        try {
            if (this._session && !this._isMuted) {
                await this._session.mute(true);
                this._isMuted = true;
            }
            this._isRecording = false;
            this._sessionStatus = 'idle';
            console.log('Stopped listening');
            this._emitAudioEvent('audio_end');
        } catch (error) {
            throw new AudioError(
                `Failed to stop listening: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'openai'
            );
        }
    }

    async sendMessage(message: string): Promise<void> {
        if (!this._session || !this._isConnected) {
            throw new ConnectionError('Not connected to OpenAI Realtime', 'openai');
        }

        try {
            // For now, just log the message. The actual method might be different in the SDK
            console.log('Sending message:', message);
            // TODO: Implement actual message sending when the correct API is available
        } catch (error) {
            throw new Error(
                `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async callTool(toolCall: ToolCall): Promise<ToolResult> {
        // Tools are handled automatically by the RealtimeSession
        // This method is kept for interface compatibility
        return {
            id: toolCall.id,
            result: 'Tool calls are handled automatically by the session',
            timestamp: new Date(),
            executionTime: 0
        };
    }

    getProviderMetadata(): ProviderMetadata {
        return {
            provider: 'openai',
            model: 'gpt-realtime',
            capabilities: ['streaming', 'interruption', 'toolCalling', 'realTimeAudio'],
            quality: 'high'
        };
    }

    // Additional methods for the new SDK
    async toggleMute(): Promise<void> {
        if (!this._session || !this._isConnected) {
            throw new ConnectionError('Not connected to OpenAI Realtime', 'openai');
        }

        try {
            if (this._isMuted) {
                await this._session.mute(false);
                this._isMuted = false;
            } else {
                await this._session.mute(true);
                this._isMuted = true;
            }
            console.log('Mute toggled:', this._isMuted);
        } catch (error) {
            throw new AudioError(
                `Failed to toggle mute: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'openai'
            );
        }
    }

    getHistory(): RealtimeItem[] {
        return this._history;
    }

    getEvents(): TransportEvent[] {
        return this._events;
    }

    getMcpTools(): string[] {
        return this._mcpTools;
    }

    addImage(dataUrl: string): void {
        if (this._session && this._isConnected) {
            this._session.addImage(dataUrl, { triggerResponse: false });
        }
    }

    // Required abstract methods from IConversationalAgentAdapter
    async cleanup(): Promise<void> {
        await this.disconnect();
        this._agent = null;
        this._session = null;
        this._history = [];
        this._events = [];
        this._mcpTools = [];
    }

    async startAudioInput(): Promise<void> {
        return this.startListening();
    }

    async stopAudioInput(): Promise<void> {
        return this.stopListening();
    }

    async sendAudioData(audioData: ArrayBuffer): Promise<void> {
        // The RealtimeSession handles audio input automatically through the microphone
        // This method is kept for interface compatibility but not used in this implementation
        console.log('sendAudioData called but not implemented for RealtimeSession');
    }

    async interrupt(): Promise<void> {
        if (this._session && this._isConnected) {
            // The RealtimeSession handles interruption automatically
            console.log('Interrupt requested');
            // TODO: Implement actual interruption when the correct API is available
        }
    }

    async updateConfig(config: Partial<AdapterInitOptions>): Promise<void> {
        // Store the new config for future use
        this._options = { ...this._options, ...config };

        // If we need to update the session config, we would need to reconnect
        // For now, just store the config
        console.log('Config updated:', config);
    }
}