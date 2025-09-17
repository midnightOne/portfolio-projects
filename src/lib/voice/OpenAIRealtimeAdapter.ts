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
            await this._initializeAgent();
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
                instructions: 'You are a helpful voice assistant for a portfolio website. Tell the user the config was loaded from a fallback in the adapter',
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
            await this._initializeAgent();
        }
    }

    private async _initializeAgent() {
        // Import unified tool registry
        const { unifiedToolRegistry } = await import('@/lib/ai/tools/UnifiedToolRegistry');
        
        // Get all tool definitions from unified registry
        const allToolDefinitions = unifiedToolRegistry.getAllToolDefinitions();
        
        // Create OpenAI tools using unified execution pipeline
        const openaiTools = allToolDefinitions.map(toolDef => {
            // Convert unified tool definition to OpenAI tool format
            const parametersSchema = z.object(
                Object.entries(toolDef.parameters.properties).reduce((acc, [key, prop]: [string, any]) => {
                    let zodType: any;
                    
                    switch (prop.type) {
                        case 'string':
                            zodType = z.string();
                            if (prop.enum) {
                                zodType = z.enum(prop.enum);
                            }
                            break;
                        case 'number':
                            zodType = z.number();
                            break;
                        case 'boolean':
                            zodType = z.boolean();
                            break;
                        case 'array':
                            if (prop.items?.type === 'string') {
                                zodType = z.array(z.string());
                            } else if (prop.items?.type === 'object' && prop.items.properties) {
                                // Handle complex object schemas in arrays
                                const itemSchema = z.object(
                                    Object.entries(prop.items.properties).reduce((itemAcc, [itemKey, itemProp]: [string, any]) => {
                                        let itemZodType: any;
                                        
                                        switch (itemProp.type) {
                                            case 'string':
                                                itemZodType = z.string();
                                                if (itemProp.enum) {
                                                    itemZodType = z.enum(itemProp.enum);
                                                }
                                                break;
                                            case 'number':
                                                itemZodType = z.number();
                                                break;
                                            case 'boolean':
                                                itemZodType = z.boolean();
                                                break;
                                            default:
                                                itemZodType = z.any();
                                        }
                                        
                                        // Handle optional fields in array items
                                        if (!prop.items.required?.includes(itemKey)) {
                                            itemZodType = itemZodType.nullable().optional();
                                        }
                                        
                                        // Add description
                                        if (itemProp.description) {
                                            itemZodType = itemZodType.describe(itemProp.description);
                                        }
                                        
                                        itemAcc[itemKey] = itemZodType;
                                        return itemAcc;
                                    }, {} as Record<string, any>)
                                );
                                zodType = z.array(itemSchema);
                            } else {
                                zodType = z.array(z.any());
                            }
                            break;
                        case 'object':
                            if (prop.properties) {
                                // Handle nested object schemas
                                const nestedSchema = z.object(
                                    Object.entries(prop.properties).reduce((nestedAcc, [nestedKey, nestedProp]: [string, any]) => {
                                        let nestedZodType: any;
                                        
                                        switch (nestedProp.type) {
                                            case 'string':
                                                nestedZodType = z.string();
                                                break;
                                            case 'number':
                                                nestedZodType = z.number();
                                                break;
                                            case 'boolean':
                                                nestedZodType = z.boolean();
                                                break;
                                            case 'array':
                                                if (nestedProp.items?.type === 'string') {
                                                    nestedZodType = z.array(z.string());
                                                } else {
                                                    nestedZodType = z.array(z.any());
                                                }
                                                break;
                                            default:
                                                nestedZodType = z.any();
                                        }
                                        
                                        // Handle optional nested fields
                                        if (!prop.required?.includes(nestedKey)) {
                                            nestedZodType = nestedZodType.nullable().optional();
                                        }
                                        
                                        // Add description
                                        if (nestedProp.description) {
                                            nestedZodType = nestedZodType.describe(nestedProp.description);
                                        }
                                        
                                        nestedAcc[nestedKey] = nestedZodType;
                                        return nestedAcc;
                                    }, {} as Record<string, any>)
                                );
                                zodType = nestedSchema;
                            } else {
                                zodType = z.object({});
                            }
                            break;
                        default:
                            zodType = z.any();
                    }
                    
                    // Handle optional fields
                    if (!toolDef.parameters.required?.includes(key)) {
                        zodType = zodType.nullable().optional();
                    }
                    
                    // Add description
                    if (prop.description) {
                        zodType = zodType.describe(prop.description);
                    }
                    
                    acc[key] = zodType;
                    return acc;
                }, {} as Record<string, any>)
            );
            
            return tool({
                name: toolDef.name,
                description: toolDef.description,
                parameters: parametersSchema,
                execute: async (parameters: any) => {
                    console.log(`OpenAI tool execution started: ${toolDef.name}`, parameters);
                    
                    try {
                        let result: string;
                        
                        // Route to specific OpenAI wrapper function based on tool name
                        switch (toolDef.name) {
                            case 'loadProjectContext':
                                result = await this._openaiLoadProjectContext(parameters);
                                break;
                            case 'loadUserProfile':
                                result = await this._openaiLoadUserProfile(parameters);
                                break;
                            case 'searchProjects':
                                result = await this._openaiSearchProjects(parameters);
                                break;
                            case 'getProjectSummary':
                                result = await this._openaiGetProjectSummary(parameters);
                                break;
                            case 'openProject':
                                result = await this._openaiOpenProject(parameters);
                                break;
                            case 'processJobSpec':
                                result = await this._openaiProcessJobSpec(parameters);
                                break;
                            case 'analyzeUserIntent':
                                result = await this._openaiAnalyzeUserIntent(parameters);
                                break;
                            case 'generateNavigationSuggestions':
                                result = await this._openaiGenerateNavigationSuggestions(parameters);
                                break;
                            case 'getNavigationHistory':
                                result = await this._openaiGetNavigationHistory(parameters);
                                break;
                            case 'submitContactForm':
                                result = await this._openaiSubmitContactForm(parameters);
                                break;
                            case 'processUploadedFile':
                                result = await this._openaiProcessUploadedFile(parameters);
                                break;
                            // Client tools
                            case 'navigateTo':
                                result = await this._openaiNavigateTo(parameters);
                                break;
                            case 'showProjectDetails':
                                result = await this._openaiShowProjectDetails(parameters);
                                break;
                            case 'scrollIntoView':
                                result = await this._openaiScrollIntoView(parameters);
                                break;
                            case 'highlightText':
                                result = await this._openaiHighlightText(parameters);
                                break;
                            case 'clearHighlights':
                                result = await this._openaiClearHighlights(parameters);
                                break;
                            case 'focusElement':
                                result = await this._openaiFocusElement(parameters);
                                break;
                            case 'reportUIState':
                                result = await this._openaiReportUIState(parameters);
                                break;
                            case 'fillFormField':
                                result = await this._openaiFillFormField(parameters);
                                break;
                            case 'submitForm':
                                result = await this._openaiSubmitForm(parameters);
                                break;
                            case 'animateElement':
                                result = await this._openaiAnimateElement(parameters);
                                break;
                            default:
                                // Fallback to generic execution for unknown tools
                                const genericResult = await this._executeUnifiedTool(toolDef.name, parameters);
                                result = typeof genericResult === 'string' ? genericResult : JSON.stringify(genericResult);
                        }
                        
                        console.log(`OpenAI tool execution completed: ${toolDef.name}`, result);
                        
                        // Return result to OpenAI and trigger response
                        //const backgroundRes = backgroundResult(result);
                        
                        return result; //or backgroundRes if we need to accumulate more results from tool calls until we want the model to speak
                        
                    } catch (error) {
                        console.error(`OpenAI tool execution failed: ${toolDef.name}`, error);
                        
                        // Return error to OpenAI
                        const errorMessage = `Failed to execute ${toolDef.name}: ${error instanceof Error ? error.message : String(error)}`;
                        return errorMessage;
                    }
                },
            });
        });

        // Create the main agent with configuration from ClientAIModelManager
        const agentName = this._config?.displayName || 'Portfolio Assistant';
        const instructions = this._config?.instructions || `You are a concise, friendly AI narrator for Kirill’s XR/AI portfolio. You can help visitors learn about the portfolio owner's background, projects, and experience. You have access to navigation tools to show relevant content and guide users through the portfolio.

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
            //instructions: instructions, //This overrides the instructions from the server config, we can only upade the fields we want to change
            tools: openaiTools,
        });
        console.log('OpenAIRealtimeAdapter: Created OpenAI agent with the following: ', agentName,openaiTools);
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
            if (event.type === 'response.output_item.added') {
                const item = (event as any).item;
                if (item && item.type === 'function_call') {
                    console.log('Function call item added:', item);
                    // Log the tool call for transcript and debugging
                    this._logToolCallToConversation(item);
                }
            } else if (event.type === 'response.function_call_arguments.done') {
                console.log('Function call arguments completed:', event);
                // Log this for monitoring and debugging (execution happens in tool definition)
                this._logToolCallCompletion(event);
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

    private _logToolCallToConversation(functionCallItem: any) {
        try {
            // Don't emit transcript here - it will be emitted in _executeToolCallUnified
            // This method is just for conversation logging
            const parsedArgs = functionCallItem.arguments ? JSON.parse(functionCallItem.arguments) : {};
            
            const toolCallData = {
                sessionId: this._sessionId || 'unknown',
                provider: 'openai',
                conversationData: {
                    startTime: new Date().toISOString(),
                    entries: [{
                        id: `tool_call_${functionCallItem.call_id || Date.now()}`,
                        timestamp: new Date().toISOString(),
                        type: 'tool_call' as const,
                        provider: 'openai',
                        executionContext: 'server' as const,
                        toolCallId: functionCallItem.call_id,
                        correlationId: `openai_tool_${functionCallItem.call_id}`,
                        data: {
                            phase: 'start',
                            toolName: functionCallItem.name,
                            parameters: parsedArgs,
                            callId: functionCallItem.call_id
                        },
                        metadata: {
                            success: true,
                            executionTime: 0,
                            accessLevel: 'basic'
                        }
                    }],
                    toolCallSummary: {
                        totalCalls: 1,
                        successfulCalls: 1,
                        failedCalls: 0,
                        clientCalls: 0,
                        serverCalls: 1,
                        averageExecutionTime: 0
                    },
                    conversationMetrics: {
                        totalTranscriptItems: 0,
                        totalConnectionEvents: 0,
                        totalContextRequests: 0
                    }
                },
                metadata: {
                    reportType: 'real-time' as const,
                    clientTimestamp: new Date().toISOString()
                }
            };

            // Send to conversation log API
            fetch('/api/ai/conversation/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(toolCallData)
            }).catch(error => {
                console.error('Failed to log tool call to conversation:', error);
            });

        } catch (error) {
            console.error('Error logging tool call to conversation:', error);
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
            
            // Handle function call items separately - log them but don't add to transcript
            if (item.type === 'function_call') {
                console.log('Processing function call item for conversation log:', {
                    index,
                    type: item.type,
                    name: (item as any).name,
                    call_id: (item as any).call_id
                });
                
                // Log the tool call to the conversation system
                this._logToolCallToConversation(item as any);
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
     * Execute tool call using unified execution pipeline
     * This method handles the execution and ensures proper result formatting
     */
    private async _executeToolCallUnified(toolName: string, parameters: any): Promise<string> {
        console.log(`Executing unified tool: ${toolName}`, parameters);
        
        // Emit tool call transcript at the start of execution
        this._emitToolCallTranscript(toolName, parameters, 'unified-execution');
        
        try {
            // Execute via unified system
            const result = await this._executeUnifiedTool(toolName, parameters);
            
            console.log(`Unified tool ${toolName} executed successfully:`, result);
            
            // Emit tool result transcript for monitoring
            this._emitToolResultTranscript(toolName, {
                success: true,
                message: typeof result === 'string' ? result : 'Tool executed successfully',
                data: result
            }, 'unified-execution', 0);
            
            // Return formatted result with explicit instruction to respond
            let formattedResult: string;
            
            if (typeof result === 'string') {
                formattedResult = result;
            } else if (result && typeof result === 'object') {
                // For complex objects, extract key information for conversational response
                if (result.success && result.data) {
                    // If it's a successful API response, extract the data
                    const data = result.data;
                    if (data.recentProjects) {
                        // Format project summary for conversation
                        const projects = data.recentProjects.map((p: any) => `${p.title}: ${p.description}`).join('\n');
                        formattedResult = `I found ${data.totalProjects} projects in this portfolio:\n\n${projects}`;
                    } else if (data.project) {
                        // Format single project for conversation
                        formattedResult = `Here's the project information:\n\n${data.project.title}: ${data.project.description}`;
                    } else {
                        // Generic successful response
                        formattedResult = result.message || 'Tool executed successfully';
                    }
                } else {
                    // Fallback to JSON string
                    formattedResult = JSON.stringify(result);
                }
            } else {
                formattedResult = String(result);
            }
            
            // Return the formatted result directly - the AI should use this to respond
            return formattedResult;
            
        } catch (error) {
            console.error(`Failed to execute unified tool ${toolName}:`, error);
            
            // Emit error result transcript
            this._emitToolResultTranscript(toolName, {
                success: false,
                message: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
                error: error instanceof Error ? error.message : String(error)
            }, 'unified-execution', 0);
            
            // Return error message
            throw error;
        }
    }

    // OpenAI-specific tool wrapper functions
    // These functions handle the client-to-server communication for server tools

    private async _openaiLoadProjectContext(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('loadProjectContext', parameters);
    }

    private async _openaiLoadUserProfile(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('loadUserProfile', parameters);
    }

    private async _openaiSearchProjects(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('searchProjects', parameters);
    }

    private async _openaiGetProjectSummary(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('getProjectSummary', parameters);
    }

    private async _openaiOpenProject(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('openProject', parameters);
    }

    private async _openaiProcessJobSpec(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('processJobSpec', parameters);
    }

    private async _openaiAnalyzeUserIntent(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('analyzeUserIntent', parameters);
    }

    private async _openaiGenerateNavigationSuggestions(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('generateNavigationSuggestions', parameters);
    }

    private async _openaiGetNavigationHistory(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('getNavigationHistory', parameters);
    }

    private async _openaiSubmitContactForm(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('submitContactForm', parameters);
    }

    private async _openaiProcessUploadedFile(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('processUploadedFile', parameters);
    }

    // Client tool wrappers - these execute directly in the browser
    private async _openaiNavigateTo(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('navigateTo', parameters);
    }

    private async _openaiShowProjectDetails(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('showProjectDetails', parameters);
    }

    private async _openaiScrollIntoView(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('scrollIntoView', parameters);
    }

    private async _openaiHighlightText(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('highlightText', parameters);
    }

    private async _openaiClearHighlights(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('clearHighlights', parameters);
    }

    private async _openaiFocusElement(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('focusElement', parameters);
    }

    private async _openaiReportUIState(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('reportUIState', parameters);
    }

    private async _openaiFillFormField(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('fillFormField', parameters);
    }

    private async _openaiSubmitForm(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('submitForm', parameters);
    }

    private async _openaiAnimateElement(parameters: any): Promise<string> {
        return await this._executeToolCallUnified('animateElement', parameters);
    }

    /**
     * Log tool call completion for monitoring
     */
    private _logToolCallCompletion(event: any) {
        try {
            const conversationId = this._conversationId || 'unknown';
            
            // Log to conversation logger for monitoring
            fetch('/api/ai/conversation/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId,
                    type: 'tool_call_completion',
                    message: 'Tool call arguments completed',
                    data: {
                        call_id: event.call_id,
                        arguments: event.arguments,
                        event_type: event.type
                    }
                })
            }).catch(error => {
                console.warn('Failed to log tool call completion:', error);
            });
        } catch (error) {
            console.warn('Error logging tool call completion:', error);
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
            // Request microphone permission explicitly
            console.log('OpenAIRealtimeAdapter: Requesting microphone permission...');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 24000,
                        channelCount: 1
                    } 
                });
                console.log('OpenAIRealtimeAdapter: Microphone permission granted');
                // Stop the stream since OpenAI SDK will handle it
                stream.getTracks().forEach(track => track.stop());
            } catch (micError) {
                console.error('OpenAIRealtimeAdapter: Microphone permission denied:', micError);
                throw new AudioError('Microphone permission required for voice AI', 'openai');
            }
            
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
        console.log('OpenAIRealtimeAdapter: startListening called, isConnected:', this._isConnected);
        
        if (!this._isConnected) {
            throw new ConnectionError('Not connected to OpenAI Realtime', 'openai');
        }

        try {
            console.log('OpenAIRealtimeAdapter: Current mute state:', this._isMuted);
            if (this._isMuted) {
                console.log('OpenAIRealtimeAdapter: Unmuting session...');
                this._session?.mute(false);
                this._isMuted = false;
            }
            
            this._isRecording = true;
            this._sessionStatus = 'listening';
            console.log('OpenAIRealtimeAdapter: Started listening, isRecording:', this._isRecording);
            this._emitAudioEvent('audio_start');
            
            // Check if session is properly set up for audio input
            if (this._session) {
                console.log('OpenAIRealtimeAdapter: Session state:', {
                    sessionExists: !!this._session,
                    isMuted: this._isMuted,
                    isRecording: this._isRecording,
                    isConnected: this._isConnected
                });
            }
        } catch (error) {
            console.error('OpenAIRealtimeAdapter: Error in startListening:', error);
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

            const sessionId = this._generateSessionId();
            const startTime = this._conversationStartTime?.toISOString() || new Date().toISOString();
            const endTime = new Date().toISOString();
            
            // Convert internal data to the expected API format
            const conversationData = {
                sessionId,
                provider: 'openai' as const,
                conversationData: {
                    startTime,
                    endTime,
                    entries: [], // TODO: Convert internal events to entries format
                    toolCallSummary: {
                        totalCalls: this._toolCalls.length,
                        successfulCalls: this._toolCalls.length, // Simplified for now
                        failedCalls: 0, // Simplified for now
                        clientCalls: this._toolCalls.length, // Simplified for now
                        serverCalls: 0, // Simplified for now
                        averageExecutionTime: 0 // Simplified for now
                    },
                    conversationMetrics: {
                        totalTranscriptItems: this._transcript.length,
                        totalConnectionEvents: this._events.filter(e => e.type.includes('connection')).length,
                        totalContextRequests: this._events.filter(e => e.type.includes('context')).length,
                        sessionDuration: this._conversationStartTime ? 
                            Date.now() - this._conversationStartTime.getTime() : 0
                    }
                },
                metadata: {
                    userAgent: navigator.userAgent,
                    clientTimestamp: new Date().toISOString(),
                    reportType: 'session-end' as const
                }
            };

            console.log('Reporting conversation data to server:', {
                sessionId: conversationData.sessionId,
                provider: conversationData.provider,
                entriesCount: conversationData.conversationData.entries.length,
                toolCallCount: conversationData.conversationData.toolCallSummary.totalCalls,
                sessionDuration: conversationData.conversationData.conversationMetrics.sessionDuration
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