/**
 * OpenAI Realtime Adapter - SDK 0.1.0 Implementation
 * 
 * Modern implementation using @openai/agents SDK 0.1.0 with direct client-side connections.
 * Based on the working openai-realtime-next demo.
 */

import {
    VoiceProvider,
    AdapterInitOptions,
    TranscriptItem,
    ToolCall,
    ToolResult,
    ProviderMetadata,
    ConnectionError,
    AudioError,
    OpenAIRealtimeConfig
} from '@/types/voice-agent';
import { BaseConversationalAgentAdapter } from './IConversationalAgentAdapter';
import { getClientAIModelManager } from './ClientAIModelManager';

// OpenAI Realtime SDK 0.1.0 imports
import {
    RealtimeAgent,
    RealtimeSession,
    tool,
    TransportEvent,
    RealtimeItem,
    backgroundResult,
} from '@openai/agents/realtime';
import { z } from 'zod';
import { debugEventEmitter } from '@/lib/debug/debugEventEmitter';
import { number } from 'framer-motion';



export class OpenAIRealtimeAdapter extends BaseConversationalAgentAdapter {
    private _agent: RealtimeAgent | null = null;
    private _session: RealtimeSession<any> | null = null;
    private _isConnected: boolean = false;
    private _history: RealtimeItem[] = [];
    private _events: TransportEvent[] = [];
    private _mcpTools: string[] = [];
    protected _isRecording: boolean = false;
    protected _isInitialized: boolean = false;
    private _config: OpenAIRealtimeConfig | null = null;
    
    // Analytics and debugging properties
    private _conversationAnalytics: {
        tokensUsed: number;
        costUsd: number;
        messageCount: number;
        lastUpdated: Date;
    } | null = null;
    private _toolCalls: ToolCall[] = [];
    private _guardrailEvents: Array<{
        type: string;
        message: string;
        severity: string;
        timestamp: Date;
        context?: any;
    }> = [];
    private _lastReportedCost: number = 0;
    private _conversationStartTime: Date | null = null;
    private _sessionId: string | null = null;

    constructor() {
        // Initialize with default metadata - will be updated when config is loaded
        const metadata: ProviderMetadata = {
            provider: 'openai',
            model: 'gpt-realtime',
            capabilities: ['streaming', 'interruption', 'toolCalling', 'realTimeAudio'],
            quality: 'high'
        };
        super('openai', metadata);
        // Don't load configuration in constructor - defer to init() method
    }

    /**
     * Load configuration with environment-aware approach
     */
    private async _loadConfiguration(): Promise<void> {
        try {
            // Check if we're on the server side or client side
            if (typeof window === 'undefined') {
                // Server side - use ClientAIModelManager directly
                const modelManager = getClientAIModelManager();
                const configWithMetadata = await modelManager.getProviderConfig('openai');
                this._config = configWithMetadata.config as OpenAIRealtimeConfig;
                
                console.log(`OpenAI Realtime configuration loaded from database: ${configWithMetadata.name}`);
            } else {
                // Client side - use default configuration from serializer
                const { getSerializerForProvider } = await import('./config-serializers');
                const openaiSerializer = getSerializerForProvider('openai');
                this._config = openaiSerializer.getDefaultConfig() as OpenAIRealtimeConfig;
                
                console.log('OpenAI Realtime configuration loaded from defaults (client-side)');
            }
            
            // Update metadata with loaded configuration
            this._metadata = {
                provider: 'openai',
                model: this._config.model,
                capabilities: this._config.capabilities,
                quality: 'high'
            };
            
            // Initialize agent with loaded configuration
            this._initializeAgent();
        } catch (error) {
            console.error('Failed to load OpenAI configuration, using fallback defaults:', error);
            
            // Fallback to hardcoded defaults if everything fails
            this._config = {
                provider: 'openai',
                enabled: true,
                displayName: 'OpenAI Realtime Assistant',
                description: 'Real-time voice assistant powered by OpenAI GPT-4o Realtime',
                version: '1.0.0',
                model: 'gpt-realtime',
                voice: 'alloy',
                temperature: 0.7,
                maxTokens: 'inf',
                instructions: 'You are a helpful voice assistant for a portfolio website.',
                tools: [],
                sessionConfig: {
                    transport: 'webrtc',
                    model: 'gpt-realtime',
                    maxOutputTokens: 'inf',
                    temperature: 0.7,
                    audio: {
                        input: {
                            format: { type: 'pcm16', rate: 24000 },
                            turnDetection: {
                                type: 'server_vad',
                                threshold: 0.5,
                                prefixPaddingMs: 300,
                                silenceDurationMs: 200,
                                createResponse: true,
                                interruptResponse: true,
                            },
                            transcription: { model: 'whisper-1' },
                        },
                        output: {
                            format: { type: 'pcm16', rate: 24000 },
                            voice: 'alloy',
                            speed: 1.0,
                        },
                    },
                    toolChoice: 'auto',
                },
                capabilities: ['streaming', 'interruption', 'toolCalling', 'realTimeAudio', 'voiceActivityDetection'],
                apiKeyEnvVar: 'OPENAI_API_KEY',
                baseUrlEnvVar: 'OPENAI_BASE_URL',
            } as OpenAIRealtimeConfig;
            
            // Initialize with fallback configuration
            this._initializeAgent();
        }
    }

    private _initializeAgent() {
        // Import UI navigation tools (only in browser environment)
        let uiNavigationTools: any = null;
        if (typeof window !== 'undefined') {
            const { uiNavigationTools: tools } = require('./UINavigationTools');
            uiNavigationTools = tools;
        }

        // Create client-side UI navigation tools with direct execution
        const navigateToTool = tool({
            name: 'navigateTo',
            description: 'Navigate to a specific page or URL in the portfolio',
            parameters: z.object({
                path: z.string().describe('The path or URL to navigate to'),
                newTab: z.boolean().nullable().optional().describe('Whether to open in a new tab')
            }),
            execute: async ({ path, newTab }) => {
                const shouldOpenNewTab = newTab ?? false;
                try {
                    if (!uiNavigationTools) {
                        return backgroundResult('Navigation tools not available in this environment');
                    }
                    const result = await uiNavigationTools.navigateTo({ path, newTab: shouldOpenNewTab });
                    return backgroundResult(result.message);
                } catch (error) {
                    return backgroundResult(`Failed to navigate: ${error instanceof Error ? error.message : String(error)}`);
                }
            },
        });

        const showProjectDetailsTool = tool({
            name: 'showProjectDetails',
            description: 'Show details for a specific project, optionally highlighting sections',
            parameters: z.object({
                projectId: z.string().describe('The ID or slug of the project to show'),
                highlightSections: z.array(z.string()).nullable().optional().describe('Array of section IDs to highlight')
            }),
            execute: async ({ projectId, highlightSections }) => {
                const sections = highlightSections ?? [];
                try {
                    if (!uiNavigationTools) {
                        return backgroundResult('Navigation tools not available in this environment');
                    }
                    const result = await uiNavigationTools.showProjectDetails({ projectId, highlightSections: sections });
                    return backgroundResult(result.message);
                } catch (error) {
                    return backgroundResult(`Failed to show project: ${error instanceof Error ? error.message : String(error)}`);
                }
            },
        });

        const scrollIntoViewTool = tool({
            name: 'scrollIntoView',
            description: 'Scroll to bring a specific element into view',
            parameters: z.object({
                selector: z.string().describe('CSS selector for the element to scroll to'),
                behavior: z.enum(['auto', 'smooth']).nullable().optional().describe('Scroll behavior')
            }),
            execute: async (params) => {
                const { selector, behavior } = params;
                const scrollBehavior = behavior ?? 'smooth';
                try {
                    if (!uiNavigationTools) {
                        return backgroundResult('Navigation tools not available in this environment');
                    }
                    const result = await uiNavigationTools.scrollIntoView({ selector, behavior: scrollBehavior });
                    return backgroundResult(result.message);
                } catch (error) {
                    return backgroundResult(`Failed to scroll: ${error instanceof Error ? error.message : String(error)}`);
                }
            },
        });

        const highlightTextTool = tool({
            name: 'highlightText',
            description: 'Highlight specific text or elements on the page',
            parameters: z.object({
                selector: z.string().describe('CSS selector for elements to search within'),
                text: z.string().nullable().optional().describe('Specific text to highlight (optional)'),
                className: z.string().nullable().optional().describe('CSS class name for highlighting')
            }),
            execute: async ({ selector, text, className }) => {
                const cssClass = className ?? 'voice-highlight';
                try {
                    if (!uiNavigationTools) {
                        return backgroundResult('Navigation tools not available in this environment');
                    }
                    const result = await uiNavigationTools.highlightText({ selector, text, className: cssClass });
                    return backgroundResult(result.message);
                } catch (error) {
                    return backgroundResult(`Failed to highlight: ${error instanceof Error ? error.message : String(error)}`);
                }
            },
        });

        const clearHighlightsTool = tool({
            name: 'clearHighlights',
            description: 'Clear all highlights from the page',
            parameters: z.object({
                className: z.string().nullable().optional().describe('CSS class name to remove')
            }),
            execute: async ({ className }) => {
                const cssClass = className ?? 'voice-highlight';
                try {
                    if (!uiNavigationTools) {
                        return backgroundResult('Navigation tools not available in this environment');
                    }
                    const result = await uiNavigationTools.clearHighlights({ className: cssClass });
                    return backgroundResult(result.message);
                } catch (error) {
                    return backgroundResult(`Failed to clear highlights: ${error instanceof Error ? error.message : String(error)}`);
                }
            },
        });

        // Create MCP server tools for Model Context Protocol integration
        const loadProjectContextTool = tool({
            name: 'loadProjectContext',
            description: 'Load detailed context for a specific project',
            parameters: z.object({
                projectId: z.string().describe('The ID of the project to load context for'),
                includeContent: z.boolean().nullable().optional().describe('Whether to include full article content'),
                includeMedia: z.boolean().nullable().optional().describe('Whether to include media information')
            }),
            execute: async ({ projectId, includeContent, includeMedia }) => {
                const includeContentFlag = includeContent ?? false;
                const includeMediaFlag = includeMedia ?? false;
                try {
                    const response = await fetch('/api/ai/mcp/execute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            toolName: 'loadProjectContext', 
                            parameters: { projectId, includeContent: includeContentFlag, includeMedia: includeMediaFlag } 
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`MCP server tool failed: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    return backgroundResult(`Loaded context for project ${projectId}`);
                } catch (error) {
                    return backgroundResult(`Failed to load project context: ${error instanceof Error ? error.message : String(error)}`);
                }
            },
        });

        const processJobSpecTool = tool({
            name: 'processJobSpec',
            description: 'Process and analyze a job specification',
            parameters: z.object({
                jobSpec: z.string().describe('The job specification text to analyze'),
                analysisType: z.string().nullable().optional().describe('Type of analysis to perform')
            }),
            execute: async ({ jobSpec, analysisType }) => {
                const analysis = analysisType ?? 'quick';
                try {
                    const response = await fetch('/api/ai/mcp/execute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            toolName: 'processJobSpec', 
                            parameters: { jobSpec, analysisType: analysis } 
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`MCP server tool failed: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    return backgroundResult(`Analyzed job specification`);
                } catch (error) {
                    return backgroundResult(`Failed to process job spec: ${error instanceof Error ? error.message : String(error)}`);
                }
            },
        });

        // Create client-side backend API tools that make fetch calls to server endpoints
        const loadContextTool = tool({
            name: 'loadContext',
            description: 'Load additional context from the server based on query or topic',
            parameters: z.object({
                query: z.string().describe('The query or topic to load context for'),
                contextType: z.enum(['projects', 'profile', 'skills', 'experience']).nullable().optional().describe('Type of context to load')
            }),
            execute: async ({ query, contextType }) => {
                const type = contextType ?? undefined;
                try {
                    const response = await fetch('/api/ai/context', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query, contextType: type })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Server responded with ${response.status}`);
                    }
                    
                    const contextData = await response.json();
                    return backgroundResult(`Loaded context for "${query}": ${JSON.stringify(contextData).substring(0, 100)}...`);
                } catch (error) {
                    return backgroundResult(`Failed to load context: ${error instanceof Error ? error.message : String(error)}`);
                }
            },
        });

        const analyzeJobSpecTool = tool({
            name: 'analyzeJobSpec',
            description: 'Analyze a job specification against the portfolio owner\'s background',
            parameters: z.object({
                jobDescription: z.string().describe('The job description or requirements to analyze'),
                focusAreas: z.array(z.string()).nullable().optional().describe('Specific areas to focus the analysis on')
            }),
            execute: async ({ jobDescription, focusAreas }) => {
                const areas = focusAreas ?? [];
                try {
                    const response = await fetch('/api/ai/analyze-job', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jobDescription, focusAreas: areas })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Server responded with ${response.status}`);
                    }
                    
                    const analysis = await response.json();
                    return backgroundResult(`Job analysis completed with ${analysis.analysis?.overallMatch || 'unknown'} match score`);
                } catch (error) {
                    return backgroundResult(`Failed to analyze job: ${error instanceof Error ? error.message : String(error)}`);
                }
            },
        });

        const submitContactFormTool = tool({
            name: 'submitContactForm',
            description: 'Submit a contact form on behalf of the user with their provided information',
            parameters: z.object({
                name: z.string().describe('User\'s name'),
                email: z.string().email().describe('User\'s email address'),
                message: z.string().describe('The message to send'),
                subject: z.string().nullable().optional().describe('Optional subject line')
            }),
            execute: async ({ name, email, message, subject }) => {
                const subjectLine = subject ?? undefined;
                try {
                    const response = await fetch('/api/public/contact', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, email, message, subject: subjectLine })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Server responded with ${response.status}`);
                    }
                    
                    const result = await response.json();
                    return backgroundResult('Contact form submitted successfully');
                } catch (error) {
                    return backgroundResult(`Failed to submit contact form: ${error instanceof Error ? error.message : String(error)}`);
                }
            },
        });

        // Create the main agent with configuration from ClientAIModelManager
        const agentName = this._config?.displayName || 'Portfolio Assistant';
        const instructions = this._config?.instructions || `You are a helpful AI assistant for a portfolio website. You can help visitors learn about the portfolio owner's background, projects, and experience. You have access to navigation tools to show relevant content and guide users through the portfolio.

Key capabilities:
- Answer questions about projects and experience using loadContext tool
- Navigate users to relevant portfolio sections using navigation tools
- Highlight important content using highlightText tool
- Provide technical explanations
- Analyze job requirements using analyzeJobSpec tool
- Submit contact forms using submitContactForm tool

Communication guidelines:
- Keep responses conversational and engaging
- Use navigation tools to show relevant content while explaining
- Be helpful, professional, and accurate
- If you don't know something, use loadContext to get more information
- Use a friendly, approachable tone suitable for a professional portfolio`;

        this._agent = new RealtimeAgent({
            name: agentName,
            instructions: instructions,
            tools: [
                navigateToTool,
                showProjectDetailsTool,
                scrollIntoViewTool,
                highlightTextTool,
                clearHighlightsTool,
                loadProjectContextTool,
                processJobSpecTool,
                loadContextTool,
                analyzeJobSpecTool,
                submitContactFormTool
            ],
        });

        // Register tools in the adapter's tool registry for interface compatibility
        const toolDefinitions = [
            {
                name: 'navigateTo',
                description: 'Navigate to a specific page or URL in the portfolio',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        path: { type: 'string', description: 'The path or URL to navigate to' },
                        newTab: { type: 'boolean', description: 'Whether to open in a new tab' }
                    },
                    required: ['path']
                },
                handler: async (args: any) => ({ success: true, message: 'Navigation executed', data: args })
            },
            {
                name: 'showProjectDetails',
                description: 'Show details for a specific project, optionally highlighting sections',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        projectId: { type: 'string', description: 'The ID or slug of the project to show' },
                        highlightSections: { type: 'array', items: { type: 'string' }, description: 'Array of section IDs to highlight' }
                    },
                    required: ['projectId']
                },
                handler: async (args: any) => ({ success: true, message: 'Project details shown', data: args })
            },
            {
                name: 'scrollIntoView',
                description: 'Scroll to bring a specific element into view',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        selector: { type: 'string', description: 'CSS selector for the element to scroll to' },
                        behavior: { type: 'string', enum: ['auto', 'smooth'], description: 'Scroll behavior' }
                    },
                    required: ['selector']
                },
                handler: async (args: any) => ({ success: true, message: 'Scrolled to element', data: args })
            },
            {
                name: 'highlightText',
                description: 'Highlight specific text or elements on the page',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        selector: { type: 'string', description: 'CSS selector for elements to search within' },
                        text: { type: 'string', description: 'Specific text to highlight (optional)' },
                        className: { type: 'string', description: 'CSS class name for highlighting' }
                    },
                    required: ['selector']
                },
                handler: async (args: any) => ({ success: true, message: 'Text highlighted', data: args })
            },
            {
                name: 'clearHighlights',
                description: 'Clear all highlights from the page',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        className: { type: 'string', description: 'CSS class name to remove' }
                    }
                },
                handler: async (args: any) => ({ success: true, message: 'Highlights cleared', data: args })
            },
            {
                name: 'loadProjectContext',
                description: 'Load detailed context for a specific project',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        projectId: { type: 'string', description: 'The ID of the project to load context for' },
                        includeContent: { type: 'boolean', description: 'Whether to include full article content' },
                        includeMedia: { type: 'boolean', description: 'Whether to include media information' }
                    },
                    required: ['projectId']
                },
                handler: async (args: any) => ({ success: true, message: 'Project context loaded', data: args })
            },
            {
                name: 'processJobSpec',
                description: 'Process and analyze a job specification',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        jobSpec: { type: 'string', description: 'The job specification text to analyze' },
                        analysisType: { type: 'string', description: 'Type of analysis to perform' }
                    },
                    required: ['jobSpec']
                },
                handler: async (args: any) => ({ success: true, message: 'Job specification processed', data: args })
            },
            {
                name: 'loadContext',
                description: 'Load additional context from the server based on query or topic',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        query: { type: 'string', description: 'The query or topic to load context for' },
                        contextType: { type: 'string', enum: ['projects', 'profile', 'skills', 'experience'], description: 'Type of context to load' }
                    },
                    required: ['query']
                },
                handler: async (args: any) => ({ success: true, message: 'Context loaded', data: args })
            },
            {
                name: 'analyzeJobSpec',
                description: 'Analyze a job specification against the portfolio owner\'s background',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        jobDescription: { type: 'string', description: 'The job description or requirements to analyze' },
                        focusAreas: { type: 'array', items: { type: 'string' }, description: 'Specific areas to focus the analysis on' }
                    },
                    required: ['jobDescription']
                },
                handler: async (args: any) => ({ success: true, message: 'Job analysis completed', data: args })
            },
            {
                name: 'submitContactForm',
                description: 'Submit a contact form on behalf of the user with their provided information',
                parameters: {
                    type: 'object' as const,
                    properties: {
                        name: { type: 'string', description: 'User\'s name' },
                        email: { type: 'string', description: 'User\'s email address' },
                        message: { type: 'string', description: 'The message to send' },
                        subject: { type: 'string', description: 'Optional subject line' }
                    },
                    required: ['name', 'email', 'message']
                },
                handler: async (args: any) => ({ success: true, message: 'Contact form submitted', data: args })
            }
        ];

        // Register all tools
        toolDefinitions.forEach(tool => {
            this.registerTool(tool);
        });
    }

    async init(options: AdapterInitOptions): Promise<void> {
        try {
            console.log('OpenAIRealtimeAdapter: Initializing with options:', options);
            
            // Load configuration first if not already loaded
            if (!this._config) {
                await this._loadConfiguration();
            }
            
            if (!this._agent) {
                throw new Error('Agent not initialized');
            }

            // Store the options for later use
            this._options = options;

            // Create the realtime session using loaded configuration
            this._session = new RealtimeSession(this._agent, {
                model: this._config?.model || 'gpt-realtime',
                config: {
                    audio: {
                        output: {
                            voice: this._config?.voice || 'alloy',
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

        // Enhanced transport event handling with comprehensive logging
        this._session.on('transport_event', (event: TransportEvent) => {
            this._events.push(event);
            console.log('Transport event:', event.type, event);
            
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
                // Process usage metrics when response is complete
                this._processResponseMetrics(event);
            }
            
            // Handle tool call events
            if (event.type === 'response.function_call_arguments.done') {
                console.log('Function call arguments completed:', event);
                this._processToolCallEvent(event);
                // Try to execute the tool call directly since approval flow might not be working
                this._executeToolCallDirectly(event);
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

        // Enhanced history update handling with analytics processing
        this._session.on('history_updated', (history: RealtimeItem[]) => {
            console.log('History updated, items:', history.length);
            this._history = history;
            this._processHistoryUpdate(history);
            
            // Process conversation analytics from history
            this._processConversationAnalytics(history);
        });

        // Auto-approval flow for seamless UX
        this._session.on('tool_approval_requested', (_context, _agent, approvalRequest) => {
            console.log('Tool approval requested - auto-approving for seamless UX:', approvalRequest);
            
            // Log the tool call for debugging
            this._logToolCall(approvalRequest);
            
            // Automatically approve all tool calls without user confirmation
            this._session?.approve(approvalRequest.approvalItem);
            console.log('Tool call auto-approved:', approvalRequest.approvalItem);
            
            // Note: Tool execution and result reporting is handled automatically by the OpenAI SDK
            // when tools are defined with execute functions using the tool() helper
        });

        // Enhanced guardrail handling
        this._session.on('guardrail_tripped', (guardrailEvent) => {
            console.log('Guardrail tripped:', guardrailEvent);
            this._handleGuardrailEvent(guardrailEvent);
        });

        // Listen for audio interruption events (if available)
        if (typeof (this._session as any).on === 'function') {
            try {
                (this._session as any).on('audio_interrupted', () => {
                    console.log('Audio interrupted event received');
                    this._emitAudioEvent('audio_end');
                });
            } catch (error) {
                console.log('audio_interrupted event not available:', error);
            }
        }
    }

    private _processHistoryUpdate(history: RealtimeItem[]) {
        // Only process new items to avoid duplication
        
        // Convert only new RealtimeItem[] to TranscriptItem[] for the interface
        const newTranscriptItems: TranscriptItem[] = [];
        
        // Keep track of processed items to avoid duplicates
        const processedItemIds = new Set(this._transcript.map(t => t.id));
        
        for (let index = 0; index < history.length; index++) {
            const item = history[index];
            // Use the actual item ID if available, otherwise use index-based ID
            const itemId = (item as any).id || `item-${index}`;
            
            // Skip items we've already processed
            if (processedItemIds.has(itemId)) {
                continue;
            }
            
            // Skip function call items - they should not be processed as transcript items
            if (item.type === 'function_call') {
                console.log('Skipping function call item in transcript processing:', {
                    index,
                    type: item.type,
                    name: (item as any).name,
                    call_id: (item as any).call_id
                });
                continue;
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
                    id: itemId,
                    type: itemType,
                    content,
                    timestamp: new Date(Date.now()),
                    provider: 'openai' as VoiceProvider
                };
                
                // Update existing item or add new one
                const existingIndex = this._transcript.findIndex(t => t.id === itemId);
                if (existingIndex >= 0) {
                    this._transcript[existingIndex] = transcriptItem;
                } else {
                    this._transcript.push(transcriptItem);
                }
                
                newTranscriptItems.push(transcriptItem);
                processedItemIds.add(itemId);
            }
        }
        
        // Emit events for new items with content
        newTranscriptItems.forEach(item => {
            console.log('Emitting transcript event for:', item.type, item.content.substring(0, 50));
            this._emitTranscriptEvent(item);
            
            // Report individual transcript items to server for real-time logging
            this._reportTranscriptItemToServer(item);
        });
    }

    /**
     * Process conversation analytics from history including tokens and cost metrics
     */
    private _processConversationAnalytics(history: RealtimeItem[]) {
        try {
            // Extract usage metrics from the conversation history
            let totalTokensUsed = 0;
            let estimatedCostUsd = 0;
            
            // Look for usage information in the history items
            for (const item of history) {
                if ('usage' in item && item.usage) {
                    const usage = item.usage as any;
                    if (usage.total_tokens) {
                        totalTokensUsed += usage.total_tokens;
                    }
                    if (usage.cost_usd) {
                        estimatedCostUsd += usage.cost_usd;
                    }
                }
                
                // Also check for response-level usage data
                if ('response' in item && item.response && typeof item.response === 'object' && item.response !== null && 'usage' in item.response) {
                    const responseUsage = (item.response as any).usage;
                    if (responseUsage.total_tokens) {
                        totalTokensUsed += responseUsage.total_tokens;
                    }
                    if (responseUsage.cost_usd) {
                        estimatedCostUsd += responseUsage.cost_usd;
                    }
                }
            }
            
            // Store analytics for reporting
            this._conversationAnalytics = {
                tokensUsed: totalTokensUsed,
                costUsd: estimatedCostUsd,
                messageCount: history.length,
                lastUpdated: new Date()
            };
            
            console.log('Conversation analytics updated:', this._conversationAnalytics);
            
            // Report to server periodically (every 10 messages or significant cost increase)
            if (history.length % 10 === 0 || estimatedCostUsd > (this._lastReportedCost || 0) + 0.01) {
                this._reportConversationDataToServer();
            }
            
        } catch (error) {
            console.error('Error processing conversation analytics:', error);
        }
    }

    /**
     * Process response completion metrics
     */
    private _processResponseMetrics(event: TransportEvent) {
        try {
            const eventData = event as any;
            
            // Extract usage data from the response event
            if (eventData.response && eventData.response.usage) {
                const usage = eventData.response.usage;
                console.log('Response usage metrics:', usage);
                
                // Update our analytics
                if (this._conversationAnalytics) {
                    if (usage.total_tokens) {
                        this._conversationAnalytics.tokensUsed += usage.total_tokens;
                    }
                    if (usage.cost_usd) {
                        this._conversationAnalytics.costUsd += usage.cost_usd;
                    }
                    this._conversationAnalytics.lastUpdated = new Date();
                }
            }
            
        } catch (error) {
            console.error('Error processing response metrics:', error);
        }
    }

    /**
     * Process tool call events for logging and debugging
     */
    private _processToolCallEvent(event: TransportEvent) {
        try {
            const eventData = event as any;
            console.log('Processing tool call event:', eventData);
            
            // Extract tool call information
            if (eventData.name && eventData.arguments) {
                const toolCall: ToolCall = {
                    id: eventData.call_id || `tool-${Date.now()}`,
                    name: eventData.name,
                    arguments: eventData.arguments,
                    timestamp: new Date()
                };
                
                console.log('Tool call detected:', toolCall);
                
                // Store for debugging and analytics
                this._toolCalls.push(toolCall);
            }
            
        } catch (error) {
            console.error('Error processing tool call event:', error);
        }
    }

    /**
     * Execute tool call directly when approval flow doesn't work
     */
    private async _executeToolCallDirectly(event: TransportEvent) {
        try {
            const eventData = event as any;
            console.log('Attempting direct tool execution:', eventData);
            console.log('Event keys:', Object.keys(eventData));
            console.log('Event type:', eventData.type);
            console.log('Event call_id:', eventData.call_id);
            console.log('Event arguments:', eventData.arguments);
            
            // Extract function name and arguments from the event
            let functionName = eventData.name;
            let argumentsStr = eventData.arguments;
            
            // The function name is not in the event directly, we need to find it from the conversation history
            if (!functionName && this._history.length > 0) {
                // Find the corresponding function call item in history by call_id
                const functionCallItem = this._history.find(item => 
                    item.type === 'function_call' && 
                    (item as any).call_id === eventData.call_id
                );
                
                if (functionCallItem) {
                    functionName = (functionCallItem as any).name;
                    console.log('Found function name from history:', functionName);
                } else {
                    // If still not found, look for the most recent function call item
                    const recentFunctionCall = this._history
                        .filter(item => item.type === 'function_call')
                        .sort((a, b) => (b as any).timestamp - (a as any).timestamp)[0];
                    
                    if (recentFunctionCall) {
                        functionName = (recentFunctionCall as any).name;
                        console.log('Using most recent function call name:', functionName);
                    }
                }
            }
            
            // If we still don't have a function name, try to infer it from the arguments
            if (!functionName && argumentsStr) {
                try {
                    const args = JSON.parse(argumentsStr);
                    if (args.selector && args.behavior) {
                        functionName = 'scrollIntoView';
                        console.log('Inferred function name as scrollIntoView based on arguments structure');
                    } else if (args.path && !args.projectId) {
                        functionName = 'navigateTo';
                        console.log('Inferred function name as navigateTo based on arguments structure');
                    } else if (args.projectId && (args.includeContent !== undefined || args.includeMedia !== undefined)) {
                        functionName = 'loadProjectContext';
                        console.log('Inferred function name as loadProjectContext based on arguments structure');
                    } else if (args.projectId) {
                        functionName = 'showProjectDetails';
                        console.log('Inferred function name as showProjectDetails based on arguments structure');
                    } else if (args.specPath || args.jobSpec) {
                        functionName = 'processJobSpec';
                        console.log('Inferred function name as processJobSpec based on arguments structure');
                    } else if (args.contextType || args.includeFiles) {
                        functionName = 'loadContext';
                        console.log('Inferred function name as loadContext based on arguments structure');
                    }
                } catch (e) {
                    console.warn('Could not parse arguments to infer function name:', e);
                }
            }
            
            if (!functionName || !argumentsStr) {
                console.error('Missing function name or arguments in tool call event');
                return;
            }
            
            let parsedArgs;
            try {
                parsedArgs = JSON.parse(argumentsStr);
            } catch (parseError) {
                console.error('Failed to parse tool call arguments:', parseError);
                return;
            }
            
            console.log(`Executing tool: ${functionName} with args:`, parsedArgs);
            
            // Emit tool call transcript item
            this._emitToolCallTranscript(functionName, parsedArgs, eventData.call_id);
            
            // Emit debug event for tool call monitor
            const sessionId = this._sessionId || eventData.call_id || 'unknown';
            console.log('Emitting tool call start debug event:', { functionName, parsedArgs, sessionId });
            debugEventEmitter.emitToolCallStart(functionName, parsedArgs, sessionId);
            
            // Import UI navigation tools (only in browser environment)
            if (typeof window !== 'undefined') {
                console.log('Browser environment detected, importing UINavigationTools...');
                const { uiNavigationTools } = require('./UINavigationTools');
                console.log('UINavigationTools imported successfully:', !!uiNavigationTools);
                
                const startTime = Date.now();
                
                // Execute the appropriate tool function
                let result;
                try {
                    // Check if this is an MCP tool first
                    if (this._mcpTools.includes(functionName) || 
                        functionName === 'loadProjectContext' || 
                        functionName === 'processJobSpec' || 
                        functionName === 'loadContext') {
                        console.log(`Executing MCP tool: ${functionName}`);
                        result = await this._executeMcpTool(functionName, parsedArgs);
                    } else {
                        // Handle UI navigation tools
                        switch (functionName) {
                            case 'scrollIntoView':
                                console.log('Calling uiNavigationTools.scrollIntoView...');
                                result = await uiNavigationTools.scrollIntoView(parsedArgs);
                                break;
                            case 'navigateTo':
                                console.log('Calling uiNavigationTools.navigateTo...');
                                result = await uiNavigationTools.navigateTo(parsedArgs);
                                break;
                            case 'showProjectDetails':
                                console.log('Calling uiNavigationTools.showProjectDetails...');
                                result = await uiNavigationTools.showProjectDetails(parsedArgs);
                                break;
                            case 'highlightText':
                                console.log('Calling uiNavigationTools.highlightText...');
                                result = await uiNavigationTools.highlightText(parsedArgs);
                                break;
                            case 'clearHighlights':
                                console.log('Calling uiNavigationTools.clearHighlights...');
                                result = await uiNavigationTools.clearHighlights(parsedArgs);
                                break;
                            case 'focusElement':
                                console.log('Calling uiNavigationTools.focusElement...');
                                result = await uiNavigationTools.focusElement(parsedArgs);
                                break;
                            default:
                                console.warn(`Unknown tool function: ${functionName}`);
                                return;
                        }
                    }
                } catch (toolError) {
                    console.error(`Error executing tool ${functionName}:`, toolError);
                    result = {
                        success: false,
                        message: `Tool execution failed: ${toolError instanceof Error ? toolError.message : String(toolError)}`,
                        error: toolError instanceof Error ? toolError.message : String(toolError)
                    };
                }
                
                const executionTime = Date.now() - startTime;
                console.log(`Tool execution result for ${functionName}:`, result);
                
                // Emit tool result transcript item
                this._emitToolResultTranscript(functionName, result, eventData.call_id, executionTime);
                
                // Emit debug event for tool call monitor
                console.log('Emitting tool call complete debug event:', { functionName, result, executionTime, success: result.success });
                debugEventEmitter.emitToolCallComplete(functionName, result, executionTime, result.success);
                
                // Send the result back to the session if possible
                if (this._session && eventData.call_id) {
                    try {
                        // Try to send function call result back to OpenAI
                        const resultMessage = result.success ? result.message : `Error: ${result.error}`;
                        console.log(`Sending tool result back to OpenAI: ${resultMessage}`);
                        
                        // Note: The exact method to send results back may vary based on SDK version
                        // This is a best-effort attempt to provide feedback to the AI
                    } catch (resultError) {
                        console.error('Failed to send tool result back to session:', resultError);
                    }
                }
            } else {
                console.warn('Tool execution attempted on server side - tools only work in browser');
                const serverError = {
                    success: false,
                    message: 'Tool execution not available on server side',
                    error: 'Server-side execution not supported'
                };
                
                // Emit error result for server-side attempts
                this._emitToolResultTranscript(functionName, serverError, eventData.call_id, 0);
                
                // Emit debug event for tool call monitor
                console.log('Emitting tool call complete debug event (server error):', { functionName, serverError });
                debugEventEmitter.emitToolCallComplete(functionName, serverError, 0, false);
            }
            
        } catch (error) {
            console.error('Error in direct tool execution:', error);
        }
    }

    /**
     * Execute MCP tool by making API call to MCP server
     */
    private async _executeMcpTool(functionName: string, args: any): Promise<any> {
        try {
            console.log(`Executing MCP tool ${functionName} with args:`, args);
            
            const response = await fetch('/api/ai/mcp/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    toolName: functionName, 
                    parameters: args 
                })
            });
            
            if (!response.ok) {
                throw new Error(`MCP server tool failed: ${response.status}`);
            }
            
            const result = await response.json();
            console.log(`MCP tool ${functionName} result:`, result);
            
            return {
                success: result.success,
                message: result.success ? 'MCP tool executed successfully' : result.error,
                data: result.data,
                error: result.error
            };
            
        } catch (error) {
            console.error(`Error executing MCP tool ${functionName}:`, error);
            return {
                success: false,
                message: `MCP tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Log tool call for debugging purposes
     */
    private _logToolCall(approvalRequest: any) {
        try {
            console.log('Tool call approval request details:', {
                item: approvalRequest.approvalItem,
                context: approvalRequest.context,
                timestamp: new Date().toISOString()
            });
            
            // Extract tool information for logging
            const item = approvalRequest.approvalItem;
            if (item && 'name' in item) {
                const toolCall: ToolCall = {
                    id: item.id || `approval-${Date.now()}`,
                    name: item.name,
                    arguments: item.arguments || {},
                    timestamp: new Date()
                };
                
                this._toolCalls.push(toolCall);
                console.log('Tool call logged for debugging:', toolCall);
            }
            
        } catch (error) {
            console.error('Error logging tool call:', error);
        }
    }


    /**
     * Handle guardrail events
     */
    private _handleGuardrailEvent(guardrailEvent: any) {
        try {
            console.log('Guardrail event details:', guardrailEvent);
            
            // Log guardrail violations for debugging and safety monitoring
            const guardrailLog = {
                type: guardrailEvent.type || 'unknown',
                message: guardrailEvent.message || 'Guardrail triggered',
                severity: guardrailEvent.severity || 'warning',
                timestamp: new Date(),
                context: guardrailEvent.context
            };
            
            console.warn('Guardrail triggered:', guardrailLog);
            
            // Store guardrail events for admin review
            this._guardrailEvents.push(guardrailLog);
            
            // Report serious guardrail violations immediately
            if (guardrailLog.severity === 'error' || guardrailLog.severity === 'critical') {
                this._reportGuardrailViolation(guardrailLog);
            }
            
        } catch (error) {
            console.error('Error handling guardrail event:', error);
        }
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
            console.log('OpenAIRealtimeAdapter: Getting session token...');
            // Get session token from our API (which includes context injection)
            const response = await fetch('/api/ai/openai/session', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get session token');
            }

            const { client_secret } = await response.json();
            console.log('OpenAIRealtimeAdapter: Session token received, connecting...');

            // Connect to OpenAI Realtime using the client_secret
            await this._session.connect({
                apiKey: client_secret,
            });

            this._isConnected = true;
            this._connectionStatus = 'connected';
            
            // Initialize conversation tracking
            this._conversationStartTime = new Date();
            this._conversationAnalytics = {
                tokensUsed: 0,
                costUsd: 0,
                messageCount: 0,
                lastUpdated: new Date()
            };
            
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
                // Report final conversation data before disconnecting
                if (this._conversationAnalytics && this._conversationAnalytics.messageCount > 0) {
                    await this._reportConversationDataToServer();
                }
                
                this._session.close();
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
                this._session?.mute(false);
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
                this._session.mute(true);
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
                this._session.mute(false);
                this._isMuted = false;
            } else {
                this._session.mute(true);
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

    async sendAudioData(_audioData: ArrayBuffer): Promise<void> {
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

    /**
     * Report conversation data to server for persistent storage and cost tracking
     */
    private async _reportConversationDataToServer(): Promise<void> {
        try {
            if (!this._conversationAnalytics) {
                console.log('No conversation analytics to report');
                return;
            }

            // Calculate total audio duration from transcript
            const audioInputDuration = this._transcript
                .filter(item => item.type === 'user_speech')
                .reduce((total, item) => total + (item.content.length * 100), 0); // Rough estimate
            
            const audioOutputDuration = this._transcript
                .filter(item => item.type === 'ai_response')
                .reduce((total, item) => total + (item.content.length * 100), 0); // Rough estimate

            const conversationData = {
                sessionId: this._generateSessionId(),
                provider: 'openai' as const,
                timestamp: new Date().toISOString(),
                conversationMetadata: {
                    startTime: this._conversationStartTime?.toISOString(),
                    endTime: new Date().toISOString(),
                    totalDuration: this._conversationStartTime ? 
                        Date.now() - this._conversationStartTime.getTime() : 0,
                    messageCount: this._conversationAnalytics.messageCount,
                    toolCallCount: this._toolCalls.length,
                    interruptionCount: this._events.filter(e => e.type.includes('interrupt')).length,
                    costEstimate: this._conversationAnalytics.costUsd
                },
                usageMetrics: {
                    audioInputDuration,
                    audioOutputDuration,
                    tokensUsed: this._conversationAnalytics.tokensUsed,
                    apiCalls: this._events.filter(e => e.type.includes('response')).length,
                    toolExecutions: this._toolCalls.length
                }
            };

            console.log('Reporting conversation data to server:', {
                tokensUsed: conversationData.usageMetrics.tokensUsed,
                costEstimate: conversationData.conversationMetadata.costEstimate,
                messageCount: conversationData.conversationMetadata.messageCount,
                toolCallCount: conversationData.conversationMetadata.toolCallCount
            });

            const response = await fetch('/api/ai/conversation/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(conversationData)
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }

            // Update last reported cost to avoid duplicate reporting
            this._lastReportedCost = this._conversationAnalytics.costUsd;
            
            console.log('Conversation data reported successfully');

        } catch (error) {
            console.error('Failed to report conversation data to server:', error);
            // Don't throw - this is a background operation that shouldn't break the conversation
        }
    }

    /**
     * Report guardrail violations to server for admin review
     */
    private async _reportGuardrailViolation(guardrailLog: any): Promise<void> {
        try {
            console.log('Reporting guardrail violation to server:', guardrailLog);

            const response = await fetch('/api/ai/guardrail/violation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: 'openai',
                    sessionId: this._generateSessionId(),
                    violation: guardrailLog,
                    context: {
                        recentTranscript: this._transcript.slice(-5), // Last 5 messages for context
                        recentToolCalls: this._toolCalls.slice(-3)    // Last 3 tool calls for context
                    }
                })
            });

            if (!response.ok) {
                console.error('Failed to report guardrail violation:', response.status);
            } else {
                console.log('Guardrail violation reported successfully');
            }

        } catch (error) {
            console.error('Error reporting guardrail violation:', error);
            // Don't throw - this is a background operation
        }
    }

    /**
     * Generate a consistent session ID for tracking
     */
    private _generateSessionId(): string {
        // Use a combination of timestamp and random string for uniqueness
        if (!this._sessionId) {
            this._sessionId = `openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        return this._sessionId;
    }

    /**
     * Get current conversation analytics
     */
    public getConversationAnalytics() {
        return {
            ...this._conversationAnalytics,
            toolCallCount: this._toolCalls.length,
            guardrailEventCount: this._guardrailEvents.length,
            sessionDuration: this._conversationStartTime ? 
                Date.now() - this._conversationStartTime.getTime() : 0
        };
    }

    /**
     * Get tool calls for debugging
     */
    public getToolCalls(): ToolCall[] {
        return [...this._toolCalls];
    }

    /**
     * Get guardrail events for debugging
     */
    public getGuardrailEvents() {
        return [...this._guardrailEvents];
    }

    /**
     * Report individual transcript items to server for real-time logging
     */
    private async _reportTranscriptItemToServer(item: TranscriptItem): Promise<void> {
        try {
            const transcriptData = {
                sessionId: this._generateSessionId(),
                provider: 'openai' as const,
                timestamp: new Date().toISOString(),
                transcriptItem: {
                    id: item.id,
                    type: item.type,
                    content: item.content,
                    timestamp: item.timestamp.toISOString(),
                    provider: item.provider,
                    metadata: {
                        confidence: 0.95, // Default confidence for OpenAI Realtime
                        interrupted: false // Could be enhanced to detect interruptions
                    }
                }
            };

            // Don't await this to avoid blocking the conversation flow
            fetch('/api/ai/conversation/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(transcriptData)
            }).catch(error => {
                console.error('Failed to report transcript item to server:', error);
            });

        } catch (error) {
            console.error('Error preparing transcript item for server:', error);
        }
    }

    /**
     * Emit tool call transcript item
     */
    private _emitToolCallTranscript(toolName: string, args: any, callId: string) {
        if (!this._options?.onTranscriptEvent) return;

        const transcriptItem: TranscriptItem = {
            id: `tool-call-${callId}`,
            type: 'tool_call',
            content: `Calling ${toolName}`,
            timestamp: new Date(),
            provider: 'openai',
            metadata: {
                toolName,
                toolArgs: args
            }
        };

        this._options.onTranscriptEvent({
            type: 'transcript_update',
            item: transcriptItem,
            timestamp: new Date()
        });
    }

    /**
     * Emit tool result transcript item
     */
    private _emitToolResultTranscript(toolName: string, result: any, callId: string, executionTime: number) {
        if (!this._options?.onTranscriptEvent) return;

        const transcriptItem: TranscriptItem = {
            id: `tool-result-${callId}`,
            type: 'tool_result',
            content: result.success ? result.message : `Error: ${result.error}`,
            timestamp: new Date(),
            provider: 'openai',
            metadata: {
                toolName,
                toolResult: result,
                duration: executionTime
            }
        };

        this._options.onTranscriptEvent({
            type: 'transcript_update',
            item: transcriptItem,
            timestamp: new Date()
        });
    }
}