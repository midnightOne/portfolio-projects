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
            instructions: 'You are a helpful assistant for the portfolio website. You can help with questions about projects, skills, and general information.',
            tools: [weatherTool],
        });
    }

    async init(options: AdapterInitOptions): Promise<void> {
        try {
            if (!this._agent) {
                throw new Error('Agent not initialized');
            }

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
        });

        this._session.on('mcp_tools_changed', (tools: any[]) => {
            this._mcpTools = tools.map((t) => t.name);
            console.log('MCP tools changed:', this._mcpTools);
        });

        this._session.on('history_updated', (history: RealtimeItem[]) => {
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
        const transcriptItems: TranscriptItem[] = history.map((item, index) => ({
            id: `item-${index}`,
            type: item.type === 'message' ? 'user_speech' : 'ai_response',
            content: this._extractContentFromItem(item),
            timestamp: new Date(Date.now()),
            provider: 'openai'
        }));

        // Update internal transcript
        this._transcript = transcriptItems;
    }

    private _extractContentFromItem(item: RealtimeItem): string {
        // Extract text content from RealtimeItem
        if (item.type === 'message' && 'content' in item) {
            if (Array.isArray(item.content)) {
                return item.content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text)
                    .join(' ');
            }
            return String(item.content);
        }
        return '';
    }

    async connect(): Promise<void> {
        if (!this._session) {
            throw new ConnectionError('Session not initialized', 'openai');
        }

        try {
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

            // Connect to OpenAI Realtime
            await this._session.connect({
                apiKey: token,
            });

            this._isConnected = true;
            this._connectionStatus = 'connected';
            console.log('Connected to OpenAI Realtime');

        } catch (error) {
            console.error('Connection failed:', error);
            this._connectionStatus = 'error';
            throw new ConnectionError(
                `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'openai'
            );
        }
    }

    async disconnect(): Promise<void> {
        if (this._session && this._isConnected) {
            try {
                await this._session.close();
                this._isConnected = false;
                this._connectionStatus = 'disconnected';
                console.log('Disconnected from OpenAI Realtime');
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