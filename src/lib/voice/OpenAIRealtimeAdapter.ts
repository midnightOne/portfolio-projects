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
            
            // Handle transcript events
            if (event.type === 'conversation.item.input_audio_transcription.completed') {
                console.log('Input audio transcription completed:', event);
                // The transcript should be in the history update that follows
            } else if (event.type === 'response.output_audio_transcript.done') {
                console.log('Output audio transcript done:', event);
                // The transcript should be in the history update that follows
            }
            
            // Handle audio interruption events
            if (event.type === 'response.audio_transcript.delta') {
                console.log('AI is speaking (audio transcript delta)');
            } else if (event.type === 'response.audio.delta') {
                console.log('AI is generating audio');
            } else if (event.type === 'response.done') {
                console.log('AI response completed');
            }
            
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

        // Listen for audio interruption events (if available)
        if (typeof (this._session as any).on === 'function') {
            try {
                (this._session as any).on('audio_interrupted', () => {
                    console.log('Audio interrupted event received');
                });
            } catch (error) {
                console.log('audio_interrupted event not available:', error);
            }
        }
    }

    private _processHistoryUpdate(history: RealtimeItem[]) {
        // Only process new items to avoid duplication
        const currentLength = this._transcript.length;
        
        // Convert only new RealtimeItem[] to TranscriptItem[] for the interface
        const newTranscriptItems: TranscriptItem[] = [];
        
        for (let index = 0; index < history.length; index++) {
            const item = history[index];
            
            // Skip items we've already processed
            const existingItem = this._transcript.find(t => t.id === `item-${index}`);
            if (existingItem && existingItem.content.trim().length > 0) {
                continue; // Skip items that already have content
            }
            
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
            } else if ('role' in item && item.role === 'assistant') {
                itemType = 'ai_response';
                console.log('Detected AI response via role');
            } else if (item.type === 'message' && 'content' in item) {
                // Check if it's an input audio transcription
                const content = Array.isArray(item.content) ? item.content : [item.content];
                const hasInputAudio = content.some((c: any) => 
                    c?.type === 'input_audio' || 
                    c?.type === 'input_text' ||
                    (typeof c === 'object' && 'input_audio_transcription' in c)
                );
                const hasOutputAudio = content.some((c: any) => 
                    c?.type === 'output_audio' ||
                    (typeof c === 'object' && 'output_audio_transcription' in c)
                );
                
                if (hasInputAudio) {
                    itemType = 'user_speech';
                    console.log('Detected user speech via input audio content');
                } else if (hasOutputAudio) {
                    itemType = 'ai_response';
                    console.log('Detected AI response via output audio content');
                }
            }

            const content = this._extractContentFromItem(item);
            
            console.log('Final item classification:', {
                index,
                type: itemType,
                content: content.substring(0, 50),
                hasContent: content.length > 0
            });
            
            // Only add items with content or update existing items that now have content
            if (content.trim().length > 0) {
                const transcriptItem: TranscriptItem = {
                    id: `item-${index}`,
                    type: itemType,
                    content,
                    timestamp: new Date(Date.now()),
                    provider: 'openai' as VoiceProvider
                };
                
                // Update existing item or add new one
                const existingIndex = this._transcript.findIndex(t => t.id === `item-${index}`);
                if (existingIndex >= 0) {
                    this._transcript[existingIndex] = transcriptItem;
                } else {
                    this._transcript.push(transcriptItem);
                }
                
                newTranscriptItems.push(transcriptItem);
            }
        }
        
        // Emit events for new items with content
        newTranscriptItems.forEach(item => {
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
                            // Include both input and output audio types, plus text types
                            const isTextType = c.type === 'text' || 
                                             c.type === 'input_text' || 
                                             c.type === 'input_audio' ||
                                             c.type === 'output_audio';
                            console.log('Content part:', { 
                                type: c.type, 
                                isTextType, 
                                hasText: !!c.text, 
                                hasTranscript: !!c.transcript,
                                hasAudioTranscript: !!c.audio_transcript 
                            });
                            return isTextType;
                        })
                        .map((c: any) => {
                            // Try multiple properties for text content
                            const text = c.text || 
                                        c.transcript || 
                                        c.audio_transcript || 
                                        c.content ||
                                        (c.type === 'output_audio' && c.transcript) ||
                                        '';
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
            console.log('=== SENDING TEXT MESSAGE ===');
            console.log('Message:', message);
            console.log('Session state before interrupt:', {
                isConnected: this._isConnected,
                sessionStatus: this._sessionStatus,
                isRecording: this._isRecording
            });
            
            // Interrupt any ongoing AI speech before sending the message
            console.log('Calling interrupt...');
            await this.interrupt();
            console.log('Interrupt completed, now sending message...');
            
            // Use the RealtimeSession's sendMessage method with proper typing
            this._session.sendMessage(message);
            console.log('Text message sent successfully to session');
            console.log('=== MESSAGE SEND COMPLETE ===');
        } catch (error) {
            console.error('Failed to send text message:', error);
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
            console.log('Interrupt requested - stopping AI speech');
            console.log('Session state:', {
                isConnected: this._isConnected,
                sessionExists: !!this._session,
                sessionStatus: this._sessionStatus
            });
            this._session.interrupt();
            console.log('Interrupt command sent to session');
        } else {
            console.log('Cannot interrupt - session not available or not connected:', {
                sessionExists: !!this._session,
                isConnected: this._isConnected
            });
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