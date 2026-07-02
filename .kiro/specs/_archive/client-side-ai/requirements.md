# Unified Serverless Conversational AI Module - Requirements Document

## Introduction

This specification defines a unified serverless conversational AI module for the Next.js portfolio website, enabling real-time, voice-guided interaction and UI navigation. The architecture is specifically designed for serverless hosting environments (like Vercel's free tier), where the Next.js server handles only stateless HTTP requests for obtaining ephemeral access tokens, proxying specific API calls, and receiving asynchronous client-side logs. All real-time bidirectional audio and AI signaling occurs directly between the client browser and AI providers' cloud infrastructure through a provider-agnostic interface that supports dynamic switching between OpenAI Realtime API and ElevenLabs Conversational AI.

## Requirements

### Requirement 1

**User Story:** As a portfolio visitor, I want to interact with an AI assistant that can answer questions about the portfolio owner, so that I can learn about their background and expertise in a conversational way.

#### Acceptance Criteria

1.  WHEN visiting any public page THEN the system SHALL provide an AI chat interface accessible from all pages.
2.  WHEN the AI chat is opened THEN the system SHALL position it on one side with space for modal content in the remaining area.
3.  WHEN interacting with the AI THEN the system SHALL present itself as the portfolio owner's assistant, not speaking as the owner directly.
4.  WHEN the AI responds THEN **our server SHALL have access to all public portfolio content for context**.
5.  WHEN providing responses THEN the system SHALL maintain a professional, helpful tone as an assistant.
6.  WHEN users ask questions THEN the system SHALL provide accurate information based only on available portfolio content.
7.  WHEN the AI cannot answer a question THEN the system SHALL clearly state the limitation rather than hallucinating information.
8.  **WHEN conversations occur THEN our server SHALL save all interactions to a persistent database for analytics and review.**
9.  WHEN displaying the chat interface THEN the system SHALL use consistent theming with the rest of the portfolio.
10. WHEN users close the chat THEN the system SHALL preserve the conversation state **server-side for the session**, allowing seamless continuation.

### Requirement 2

**User Story:** As a portfolio visitor, I want to ask specific questions about projects and background, so that I can get detailed technical information and understand the portfolio owner's expertise.

#### Acceptance Criteria

1.  WHEN asking about projects THEN **our server SHALL use project summaries/indexes for broad context and full content for specific queries**.
2.  WHEN projects are saved THEN the system SHALL automatically generate searchable indexes tied to article structure.
3.  WHEN users ask about specific topics THEN **our server SHALL identify relevant projects and sections using the generated indexes**.
4.  WHEN providing project information THEN the system SHALL offer to show relevant sections with highlighting.
5.  WHEN users request technical details THEN **our server SHALL access full project content for comprehensive answers**.
6.  WHEN discussing background THEN **our server SHALL draw from resume data, about page, and project descriptions**.
7.  WHEN new content sections are added THEN the system SHALL automatically include them in the context system with enable/disable options.
8.  WHEN responding about projects THEN the system SHALL provide a tone selector (technical, casual, professional) for appropriate communication style.
9.  WHEN context becomes too large THEN the **server-side AI agent SHALL intelligently prioritize relevant information**.
10. WHEN users ask follow-up questions THEN the **server-side AI agent SHALL maintain conversation context while managing token usage efficiently**.

### Requirement 3

**User Story:** As a portfolio visitor, I want to submit job specifications for analysis, so that I can understand how well the portfolio owner's background matches the role requirements.

#### Acceptance Criteria

1.  WHEN submitting job specifications THEN the system SHALL accept text paste input for job descriptions.
2.  WHEN analyzing job specs THEN the **server-side AI agent SHALL provide both structured analysis and conversational responses**.
3.  WHEN generating reports THEN the **server-side AI agent SHALL present the portfolio owner in a positive light while remaining truthful**.
4.  WHEN creating analysis THEN the **server-side AI agent SHALL identify skills matches, experience relevance, and highlight strengths**.
5.  WHEN completing analysis THEN the **server-side AI agent SHALL save the job specification, source reflink, timestamp, and AI response to a persistent database**.
6.  WHEN storing job data THEN the system SHALL include metadata about which reflink generated the request.
7.  WHEN saving interactions THEN the system SHALL provide admin access to review all job analysis reports.
8.  WHEN exporting data THEN the system SHALL allow CSV export of job analysis data for further review.
9.  WHEN handling sensitive information THEN the system SHALL include appropriate disclaimers about data usage and privacy.
10. WHEN processing job specs THEN the system SHALL ensure data is used only for analysis and not for LLM training.

### Requirement 4

**User Story:** As a portfolio visitor, I want AI-guided navigation through relevant portfolio sections, so that I can efficiently explore content that matches my interests.

#### Acceptance Criteria

1.  WHEN the **server-side AI agent identifies relevant content THEN it SHALL send navigation commands to the client to open modal windows for relevant projects**.
2.  WHEN displaying relevant sections THEN the system SHALL use tasteful, minimalistic text highlighting.
3.  WHEN multiple relevant sections exist THEN the system SHALL provide next/previous navigation buttons.
4.  WHEN navigating between sections THEN the system SHALL replace modals rather than stacking them.
5.  WHEN showing highlighted content THEN the system SHALL allow user-controlled jumping between relevant parts.
6.  WHEN users navigate through content THEN the **client-side voice agent SHALL remember what has been shown in the session's navigation history and report to the server**.
7.  WHEN managing conversation context THEN the **server-side AI agent SHALL maintain navigation history in the persistent database and efficiently manage token usage**.
8.  WHEN sessions end THEN the **server-side AI agent SHALL save conversation and navigation data for admin review**.
9.  WHEN highlighting text THEN the system SHALL ensure highlights are visually clear but not intrusive.
10. WHEN opening modals THEN the system SHALL position them appropriately relative to the chat interface.

### Requirement 5

**User Story:** As a portfolio owner, I want unique reflink-based access control for premium AI features, so that I can provide special AI capabilities to specific people (like recruiters) while controlling costs and preventing abuse.

#### Acceptance Criteria

1.  WHEN creating reflinks THEN the system SHALL generate unique codes (hash-based or custom text) for individual recipients.
2.  WHEN visitors access the site with reflinks THEN the **server-side system SHALL detect reflink parameters (e.g., example.com?ref=HashOrCustomText)**.
3.  WHEN reflinks are validated THEN the **server-side system SHALL check a persistent database for validity, expiration, and remaining budget**.
4.  WHEN valid reflinks are detected THEN the system SHALL greet users with "You were given special access to enhanced AI features" message.
5.  WHEN expired/invalid reflinks are detected THEN the system SHALL show "Reflink expired, contact me to get a new one" message.
6.  WHEN reflinks are active THEN the system SHALL enable premium AI features (voice interaction, advanced analysis) for that session.
7.  WHEN creating reflinks THEN the system SHALL allow setting token limits, total spend limits (LLM + voice), and expiration dates.
8.  WHEN creating reflinks THEN the system SHALL include recipient name field and custom context notes for personalization.
9.  WHEN reflink budgets are depleted THEN the system SHALL disable premium features and show budget exhausted message.
10. WHEN managing reflinks THEN the system SHALL provide admin interface to track usage, costs, and remaining budgets per reflink.

### Requirement 6

**User Story:** As a portfolio owner, I want efficient performance and caching for AI features, so that users have a responsive experience without unnecessary API calls.

#### Acceptance Criteria

1.  WHEN users access AI features THEN the **server-side system SHALL cache AI status in a distributed, persistent cache for at least 15 minutes**.
2.  WHEN AI settings change THEN the **server-side system SHALL invalidate cached AI status immediately across all instances**.
3.  WHEN users visit the site THEN the **server-side system SHALL preload relevant project data into the AI agent's context without causing client-side lag**.
4.  WHEN loading project content THEN the **server-side system SHALL cache project summaries per session in a distributed, persistent cache to avoid repeated loading by the AI agent**.
5.  WHEN managing context THEN the **server-side AI agent SHALL implement intelligent context caching using a distributed, persistent cache to reduce API calls**.
6.  WHEN users navigate between pages THEN the **server-side AI agent SHALL maintain cached AI status and conversation context across page transitions**.
7.  WHEN sessions are active THEN the **server-side AI agent SHALL preserve conversation state and context efficiently in a persistent store**.
8.  WHEN background loading occurs THEN the system SHALL prioritize critical content and load additional data progressively.
9.  WHEN caching data THEN the system SHALL implement appropriate distributed cache invalidation strategies.
10. WHEN optimizing performance THEN the system SHALL balance responsiveness with API cost management.

### Requirement 7

**User Story:** As a portfolio visitor, I want AI-guided animated navigation through my portfolio, so that the AI can smoothly guide me through relevant content with narrated explanations and synchronized visual demonstrations in both text and voice modes.

#### Acceptance Criteria

1.  WHEN providing responses THEN **the client-side voice agent SHALL execute MCP navigation tools based on AI responses**.
2.  WHEN tool calls are detected THEN **the client-side MCP system SHALL execute structured navigation commands for real-time UI updates**.
3.  WHEN guiding users via voice THEN **the client-side voice agent SHALL coordinate MCP navigation tool execution with its TTS timing for synchronized demonstrations**.
4.  WHEN guiding users via text THEN **the server-side AI agent SHALL send navigation commands to the client for MCP tool execution**.
5.  WHEN navigation sequences occur THEN **the client-side voice agent SHALL track navigation history for previous/next functionality across both text and voice modes, reporting to the server**.
6.  WHEN users request navigation THEN the system SHALL provide previous/next buttons that communicate with **our server through API calls to update session history and context**.
7.  WHEN chaining navigation THEN **the client-side UI system SHALL coordinate with the client-side voice agent's MCP tool sequencing**.
8.  WHEN users interrupt navigation THEN **the client-side voice agent SHALL detect user action notifications (e.g., voice input) and adapt its responses accordingly, reporting to the server**.
9.  WHEN providing guidance THEN **the client-side voice agent SHALL execute appropriate MCP highlighting tools (spotlight, outline, color) with speech-synchronized timing**.
10. WHEN mobile users interact THEN the system SHALL adapt MCP navigation tools for simplified mobile UI interactions while maintaining **client-side processing of voice and navigation**.
11. WHEN using a client-side voice agent architecture THEN **the client SHALL process all navigation commands and execute MCP tools locally via its voice agent**.
12. WHEN client executes navigation THEN the system SHALL send UI state updates back to **our server through API calls for context awareness**.
13. WHEN voice interactions include navigation THEN **the client-side voice agent SHALL synchronize MCP tool execution timing with provider-managed speech output for natural demonstration flow**.
14. WHEN developing the system THEN the system SHALL design navigation command processing as part of the unified conversation pipeline **on our server, which sends MCP tool instructions to the client-side voice agent**.

### Requirement 8

**User Story:** As a portfolio visitor, I want to have conversational voice interactions with the AI assistant using a unified serverless architecture, so that I can naturally speak with the AI in real-time while it guides me through the portfolio with synchronized visual demonstrations.

**CRITICAL IMPLEMENTATION NOTE:** This requirement mandates REAL voice AI implementation using actual OpenAI Realtime API and ElevenLabs Conversational AI with direct client-to-provider connections. The system must implement a provider-agnostic interface allowing dynamic switching between OpenAI and ElevenLabs. NO mock implementations, simulations, or browser TTS are acceptable. Users must be able to actually speak into their microphone and hear real AI voice responses through direct WebRTC connections (OpenAI) and signed URL conversations (ElevenLabs) to AI providers.

**CRITICAL OPENAI TOOL HANDLING ARCHITECTURE:** OpenAI Realtime SDK executes tools automatically on the client, requiring a wrapper system for server control. The server injects tools via `/api/ai/openai/session/route.ts` using `unifiedToolRegistry.getOpenAIToolsArray()`, but the client must redefine these tools in `OpenAIRealtimeAdapter._initializeAgent()` with wrapper functions that call our unified `_executeUnifiedTool()` method. This enables reflink-based tool filtering and server-side access control while maintaining the OpenAI SDK's automatic execution model.

#### Acceptance Criteria

1.  WHEN accessing the AI assistant THEN the system SHALL provide both text chat and voice conversation modes with seamless switching through a unified ConversationalAgentProvider interface.
2.  WHEN using voice mode THEN the system SHALL implement a **provider-agnostic client-side architecture** with dynamic switching between OpenAI Realtime API and ElevenLabs Conversational AI for real-time audio streaming with minimal latency (<2 seconds end-to-end). **IMPLEMENTATION REQUIREMENT: Must use actual @openai/agents SDK for OpenAI Realtime and @elevenlabs/client library for ElevenLabs Conversational AI with native client-side tool support, not mock implementations.**
3.  WHEN processing voice input THEN the system SHALL use direct client-to-provider connections: Client Browser → IConversationalAgentAdapter → Voice AI Provider (OpenAI/ElevenLabs) → Direct WebRTC/WebSocket, with **our server providing only ephemeral token generation and context injection via ContextProviderService**. **IMPLEMENTATION REQUIREMENT: Must establish real connections to actual AI provider APIs through adapter abstraction layer.**
4.  WHEN the AI responds via voice THEN the system SHALL use provider-managed TTS integration through the adapter interface for natural speech synthesis with real-time generation and built-in voice activity detection (VAD). **IMPLEMENTATION REQUIREMENT: Must play actual AI voice responses from OpenAI Realtime (via WebRTC) and ElevenLabs Conversational AI (via @elevenlabs/client WebRTC) through unified audio element management, not browser TTS or mock audio.**
5.  WHEN users speak THEN the system SHALL process audio directly through the voice AI provider **without our server involvement in the audio pipeline, using provider-managed STT and VAD through the adapter interface**. **IMPLEMENTATION REQUIREMENT: Must request real microphone access and stream actual audio data to AI providers through OpenAIRealtimeAdapter (WebRTC) and ElevenLabsAdapter (@elevenlabs/client WebRTC) implementations.**
6.  WHEN initializing voice sessions THEN **our server SHALL generate ephemeral tokens with server-injected system prompts and context via the context provider system that are not visible to the client**.
7.  WHEN voice agents need context THEN **client-side MCP tools SHALL call our server APIs for filtered, access-controlled context loading based on reflink permissions**.
8.  WHEN voice interactions occur THEN **our server SHALL maintain conversation history and provide on-demand context while the voice processing happens entirely client-side**.
9.  WHEN users switch between text and voice THEN the system SHALL preserve conversation state and context without interruption or conversation restart.
10. WHEN users send mixed input (text and voice in same session) THEN **the system SHALL maintain unified conversation context across both modalities with consistent navigation and history**.
11. WHEN providing voice responses THEN **client-side voice agents SHALL execute MCP navigation tools client-side for immediate UI updates while logging interactions server-side**.
12. WHEN demonstrating portfolio features THEN **client-side MCP navigation tools SHALL coordinate with voice agent timing for natural demonstration flow and synchronized visual guidance**.
13. WHEN users interrupt via voice THEN **voice AI providers SHALL manage interruption detection and handling automatically with built-in VAD and conversation management**.
14. WHEN optimizing for latency THEN the system SHALL use direct client-to-provider connections with **our server only providing context and tokens, eliminating server-side audio processing delays**.
15. WHEN handling audio quality THEN the system SHALL use provider-managed echo cancellation, noise suppression, adaptive bitrate, voice activity detection (VAD), and audio processing for optimal voice experience.
16. WHEN implementing the context server THEN the system SHALL run **context injection via context provider system, token generation, and access control on our server with voice AI providers handling all audio services directly**.
17. WHEN managing voice sessions THEN the system SHALL use provider-specific session management with **our server providing ephemeral tokens and secure context injection via context provider system**.
18. WHEN processing continuous speech THEN **voice AI providers SHALL implement real-time voice activity detection (VAD) and streaming STT without requiring user button presses or recording actions**.
19. WHEN users keep the microphone on THEN the **client SHALL continuously stream audio to the voice AI provider, which processes speech in real-time while maintaining conversation context**.
20. WHEN establishing connections THEN the system SHALL set up direct WebSocket connections between client and voice AI providers **with our server providing secure token-based authentication**.
21. WHEN processing navigation commands THEN **client-side voice agents SHALL execute MCP navigation tools immediately for responsive UI updates**.
22. WHEN sending navigation commands THEN **client-side voice agents SHALL call client-side MCP navigation tools that execute UI changes directly without server round-trips**.
23. WHEN receiving context requests THEN **our server SHALL process MCP tool calls from client-side voice agents and return filtered context based on access control and reflink permissions**.
24. WHEN coordinating speech and navigation THEN **client-side voice agents SHALL synchronize MCP navigation tool execution with provider-managed TTS timing for natural demonstrations**.
25. WHEN supporting multiple providers THEN **the system SHALL implement a provider abstraction layer that allows seamless switching between OpenAI GPT Realtime, ElevenLabs Conversational AI, and future providers**.
26. WHEN voice conversations occur THEN **the client-side voice agent SHALL capture and report complete conversation transcripts (user speech, AI responses, tool calls) to our server for storage and analysis**.
27. WHEN conversation transcripts are reported THEN **our server SHALL store transcripts with conversation metadata (timestamps, provider used, reflink context, navigation actions) for admin review and system iteration**.
28. WHEN storing voice transcripts THEN **the system SHALL associate transcripts with the unified conversation history to maintain complete conversation records across text and voice modes**.
29. WHEN voice sessions end or at regular intervals THEN **the client SHALL report conversation transcripts and usage metrics to our server via secure API endpoints**.
30. WHEN transcript reporting fails THEN **the client SHALL queue transcripts locally and retry reporting when connectivity is restored**.

### Requirement 9

**User Story:** As a portfolio visitor, I want the AI to use context-aware navigation during voice conversations, so that the AI can seamlessly show me relevant portfolio content while explaining it.

#### Acceptance Criteria

1.  WHEN the **client-side voice agent mentions projects via voice THEN it SHALL execute MCP navigation tools to open relevant project modals with highlighted sections**.
2.  WHEN providing voice explanations THEN the **client-side voice agent SHALL use MCP tools to access current UI state and navigation history**.
3.  WHEN demonstrating features THEN the **client-side voice agent SHALL use MCP navigation tools to scroll to specific content and apply visual emphasis**.
4.  WHEN voice navigation occurs THEN the system SHALL provide smooth transitions between different portfolio sections.
5.  WHEN highlighting content THEN the **client-side voice agent SHALL coordinate MCP tool execution timing with its speech pacing for natural demonstration flow**.
6.  WHEN users request specific content THEN the **client-side voice agent SHALL execute appropriate MCP navigation tools on the client**.
7.  WHEN managing conversation flow THEN the **client-side voice agent SHALL track what has been shown visually to avoid repetitive demonstrations, reporting history to the server**.
8.  WHEN voice interactions span multiple projects THEN the **client-side voice agent SHALL maintain navigation context across modal transitions, reporting to the server**.
9.  WHEN providing technical explanations THEN the **client-side voice agent SHALL execute MCP tools to show relevant code snippets or technical details while speaking**.
10. WHEN voice sessions end THEN the **server SHALL preserve navigation state for potential continuation in text mode**.

### Requirement 10

**User Story:** As a portfolio owner, I want comprehensive context provider configuration controls, so that I can customize how the AI presents information, manages conversation flow, and utilizes available context.

#### Acceptance Criteria

1.  WHEN configuring context providers THEN the system SHALL provide admin interface for context breadth and depth settings.
2.  WHEN managing conversation templates THEN the system SHALL allow editing of conversation flow templates and AI presentation styles.
3.  WHEN setting context parameters THEN the system SHALL provide controls for key phrases, topic priorities, and response formatting.
4.  WHEN adding hidden context THEN the system SHALL allow injection of background information not visible to visitors.
5.  WHEN configuring AI personality THEN the system SHALL provide template editing for tone, expertise level, and communication style.
6.  WHEN managing context sources THEN the system SHALL allow enabling/disabling specific content types and setting their priority weights.
7.  WHEN setting conversation limits THEN the system SHALL provide controls for context window size, token limits, and conversation length.
8.  WHEN configuring navigation behavior THEN the system SHALL allow customization of when and how the AI suggests portfolio navigation.
9.  WHEN managing response quality THEN the system SHALL provide settings for response depth, technical detail level, and explanation thoroughness.
10. WHEN testing configurations THEN the system SHALL provide preview mode to test context and conversation changes before applying them.

### Requirement 11

**User Story:** As a portfolio owner, I want comprehensive analytics and admin controls for reflink-based AI interactions, so that I can monitor usage, track costs per recipient, and manage personalized AI access effectively.

#### Acceptance Criteria

1.  WHEN creating reflinks THEN the system SHALL allow setting recipient name, custom context notes, token limits, and spend limits.
2.  WHEN reflinks are used THEN the **server-side system SHALL track token usage, API costs (LLM + voice), and remaining budgets per reflink in a persistent database**.
3.  WHEN providing admin interface THEN the system SHALL show reflink usage analytics with cost breakdowns and recipient activity.
4.  WHEN managing reflinks THEN the system SHALL allow editing recipient info, adjusting budgets, and extending expiration dates.
5.  WHEN reflinks expire or budgets deplete THEN the system SHALL provide easy renewal/top-up options in admin interface.
6.  WHEN AI interactions occur THEN the **server-side system SHALL log conversations with reflink attribution and cost tracking to a persistent database**.
7.  WHEN reviewing data THEN the system SHALL provide filtering by recipient, date range, cost thresholds, and usage patterns.
8.  WHEN exporting data THEN the system SHALL support CSV export with reflink attribution and cost analysis.
9.  WHEN monitoring costs THEN the system SHALL provide alerts when reflinks approach budget limits or show unusual usage.
10. WHEN analyzing effectiveness THEN the system SHALL show which reflinks generate most engagement and successful interactions.

### Requirement 12

**User Story:** As a portfolio visitor, I want the AI to interact with forms and UI elements on my behalf, so that I can have the AI fill out contact forms, submit inquiries, and perform actions without manual input.

#### Acceptance Criteria

1.  WHEN the **client-side voice agent suggests form interaction THEN it SHALL send commands to the client UI to provide tools to fill input fields with appropriate data**.
2.  WHEN filling forms THEN the **client-side voice agent SHALL include validation logic for input data and handle form validation errors gracefully, sending feedback to the UI**.
3.  WHEN submitting forms THEN the **client-side voice agent SHALL execute form submissions (e.g., via backend API call to our server) and send feedback on success or failure to the UI**.
4.  WHEN interacting with UI elements THEN the **client-side voice agent SHALL send commands to the client UI to click buttons, select options, and navigate interfaces**.
5.  WHEN form interactions occur THEN the system SHALL ask for user confirmation before submitting sensitive information.
6.  WHEN handling contact forms THEN the **client-side voice agent SHALL pre-populate fields with visitor-provided information from conversation context, potentially retrieved from our server**.
7.  WHEN form submission completes THEN the system SHALL provide confirmation and next steps to the visitor.
8.  WHEN form errors occur THEN the system SHALL explain errors and guide users through correction process.
9.  WHEN multiple forms are available THEN the **client-side voice agent SHALL identify the most appropriate form based on conversation context (potentially aided by server context)**.
10. WHEN form interactions are logged THEN the **server-side system SHALL record all form interactions for admin review and analytics to a persistent database**.

### Requirement 13

**User Story:** As a portfolio visitor, I want the AI to process uploaded files and documents in the background, so that the AI can analyze my job postings, resumes, or other documents and provide contextual responses based on the processed content.

#### Acceptance Criteria

1.  WHEN files are uploaded THEN the system SHALL provide invisible background processing tools for document analysis.
2.  WHEN processing files THEN the system SHALL show processing status to users while maintaining conversation flow.
3.  WHEN file processing completes THEN the **server-side AI agent SHALL automatically integrate processed content into conversation context**.
4.  WHEN processing job postings THEN the **server-side AI agent SHALL extract key requirements, skills, and company information for analysis**.
5.  WHEN processing resumes THEN the **server-side AI agent SHALL compare visitor qualifications against portfolio owner's background**.
6.  WHEN processing fails THEN the system SHALL provide clear error messages and alternative approaches.
7.  WHEN multiple files are uploaded THEN the **server-side AI agent SHALL process them in parallel and combine results intelligently**.
8.  WHEN processing large files THEN the system SHALL provide progress indicators and estimated completion times.
9.  WHEN processed data is available THEN the **server-side AI agent SHALL use the new context to enhance subsequent responses**.
10. WHEN file processing occurs THEN the **server-side system SHALL save processing results for admin review and conversation continuity to a persistent database**.

### Requirement 14

**User Story:** As a portfolio visitor, I want the AI to have immediate contextual awareness of my current location and focus, so that it can provide relevant responses without delays from context-gathering tool calls.

#### Acceptance Criteria

1. WHEN I navigate to different portfolio sections THEN the AI SHALL automatically receive updated context about my current location without making explicit tool calls.
2. WHEN I open project modals THEN the system SHALL immediately provide the AI with project summary and relevant context for that specific project.
3. WHEN the AI responds to my questions THEN it SHALL use the automatically-provided context first before making additional tool calls for deeper information.
4. WHEN I have multiple conversations in the same session THEN the system SHALL cache context information to avoid redundant server requests.
5. WHEN I navigate between projects THEN the system SHALL update the AI's context within 1 second without interrupting ongoing conversations.
6. WHEN the AI needs additional specific information THEN it SHALL still be able to use active tools like content search as a fallback.
7. WHEN I scroll or make minor UI changes THEN the system SHALL update context in a debounced manner to avoid excessive API calls.
8. WHEN my session ends THEN the system SHALL clear cached context information to manage memory usage.
9. WHEN I select text or indicate specific interest THEN the system SHALL optionally enhance context with relevant content search results.
10. WHEN using voice conversations THEN the passive context system SHALL work seamlessly with both OpenAI and ElevenLabs providers.

### Requirement 15

**User Story:** As a portfolio visitor, I want the AI to use declarative navigation and semantic content discovery, so that I can ask about any topic across my portfolio and have the AI efficiently find and show relevant content with minimal tool calls and optimal context management.

#### Acceptance Criteria

1. WHEN asking about portfolio topics THEN the system SHALL use semantic search to find relevant content across all projects and sections without requiring specific project names.
2. WHEN the AI identifies relevant content THEN it SHALL use declarative navigation (`ui.intent`) to show content in a single tool call instead of multiple step-by-step navigation commands.
3. WHEN managing context THEN the system SHALL implement the F-I-D pattern (Frame ≤400 tokens, Index ≤600 tokens, Details ≤1000 tokens) for efficient token usage.
4. WHEN users ask follow-up questions THEN the system SHALL use `content.search` to find semantically related content across different projects and time periods.
5. WHEN displaying content THEN the system SHALL provide navigation targets that work with `ui.intent` for seamless content exploration.
6. WHEN content is not immediately available THEN the system SHALL use `content.get` to fetch specific details within token budget constraints.
7. WHEN UI state changes THEN the system SHALL track epochs to prevent stale navigation commands and ensure reliable declarative navigation.
8. WHEN users request complex navigation THEN the system SHALL use the navigation orchestrator to plan and execute multi-step sequences automatically.
9. WHEN searching content THEN the system SHALL use hybrid search (semantic embeddings + metadata filters) for accurate and relevant results.
10. WHEN managing large portfolios THEN the system SHALL use tiered content (T0-T4) with pgvector for scalable semantic search and controlled context loading.

### Requirement 15

**User Story:** As a portfolio owner, I want comprehensive debugging and testing capabilities for the voice AI system, so that I can monitor all context being provided to AI models, observe all tool calls being made, and troubleshoot integration issues effectively.

#### Acceptance Criteria

1. WHEN debugging voice interactions THEN the system SHALL provide real-time monitoring of all context being sent to AI models during conversations.
2. WHEN AI models make tool calls THEN the system SHALL display all MCP tool calls with parameters, execution time, and results in real-time.
3. WHEN monitoring conversations THEN the system SHALL show conversation state, connection status, and provider information with live updates.
4. WHEN testing integrations THEN the system SHALL validate all integration points including ContextProviderService, MCP tools, and voice adapters.
5. WHEN exporting debug data THEN the system SHALL provide complete conversation transcripts with context and tool call correlation.
6. WHEN troubleshooting issues THEN the system SHALL use production client-side endpoints for accurate testing and validation.
7. WHEN analyzing performance THEN the system SHALL track real API usage, costs, and response times from actual voice sessions.
8. WHEN reviewing conversations THEN the system SHALL provide conversation replay with complete timeline of context and tool executions.
9. WHEN validating functionality THEN the system SHALL test real voice provider connections and authentication without mock implementations.
10. WHEN monitoring system health THEN the system SHALL provide integration health checks and status indicators for all components.

### Requirement 15

**User Story:** As a portfolio owner, I want streamlined architecture with eliminated redundancy and anti-patterns, so that the system is maintainable, performant, and follows best practices.

#### Acceptance Criteria

1. WHEN managing context layers THEN the system SHALL consolidate ContextInjector functionality into ContextProvider to reduce abstraction layers.
2. WHEN accessing content sources THEN the system SHALL use direct Prisma database access on server-side instead of internal fetch calls.
3. WHEN generating tokens THEN the system SHALL implement real ephemeral token generation instead of mock implementations.
4. WHEN logging conversations THEN the system SHALL establish UnifiedConversationManager as the canonical logger to eliminate redundancy.
5. WHEN collecting telemetry THEN the system SHALL redefine conversation log endpoint as telemetry/debug endpoint for granular client-side events.
6. WHEN managing conversations THEN the system SHALL remove redundant conversation managers and use conversation-history-manager as the comprehensive solution.
7. WHEN debugging system components THEN the system SHALL instrument components with debugEventEmitter for comprehensive event tracking.
8. WHEN monitoring conversations THEN the system SHALL implement decoupled debugging that reads from server-persisted logs instead of live client state.
9. WHEN managing public access THEN the system SHALL persist PublicAccessManager settings in database instead of temporary storage.
10. WHEN using WebRTC transport THEN the system SHALL complete WebRTCConversationTransport.sendMessage implementation for full transport support.

### Requirement 16

**User Story:** As a portfolio visitor, I want AI feature access to be controlled by reflinks, so that only invited users can access AI capabilities while others see appropriate messaging based on admin settings.

#### Acceptance Criteria

1.  WHEN visiting the portfolio without reflink THEN the **server-side system SHALL check admin settings for public AI access permissions**.
2.  WHEN admin has disabled public AI access THEN the system SHALL hide AI interface and show "AI assistant available by invitation only" message.
3.  WHEN admin allows limited public access THEN the system SHALL show basic AI interface with restricted features and clear upgrade messaging.
4.  WHEN visiting with reflink parameter THEN the **server-side system SHALL detect and parse reflink from URL (e.g., ?ref=abc123)**.
5.  WHEN reflink is detected THEN the **server-side system SHALL validate it against a persistent database and check expiration/budget status**.
6.  WHEN valid reflinks are found THEN the **server-side system SHALL store reflink context in the user's session (server-side)** and display a personalized welcome message.
7.  WHEN invalid/expired reflinks are found THEN the system SHALL display "Reflink expired, contact me to get a new one" message.
8.  WHEN reflink session is active THEN the system SHALL enable all premium features (voice AI, advanced analysis, unlimited usage).
9.  WHEN reflink budget is exhausted THEN the system SHALL disable premium features and show "Budget exhausted, contact for renewal" message.
10. WHEN reflink context exists THEN the **server-side AI agent SHALL include recipient name and custom context in AI conversations for personalization**.

### Requirement 17

**User Story:** As a portfolio owner, I want granular control over AI feature availability for public visitors versus reflink holders, so that I can protect my API costs while providing appropriate access levels.

#### Acceptance Criteria

1.  WHEN configuring AI access THEN the system SHALL provide admin settings for "Public AI Access" with options: "Disabled", "Basic Only", "Limited Features".
2.  WHEN "Disabled" is selected THEN the system SHALL completely hide AI interface from non-reflink visitors.
3.  WHEN "Basic Only" is selected THEN the system SHALL show text-only AI chat with strict rate limits and no premium features.
4.  WHEN "Limited Features" is selected THEN the system SHALL allow basic AI interaction but disable voice, job analysis, and advanced navigation.
5.  WHEN reflink holders access the site THEN the system SHALL always provide full premium feature access regardless of public settings.
6.  WHEN public visitors exceed basic limits THEN the system SHALL show "Upgrade to premium access" message with contact information.
7.  WHEN admin changes public access settings THEN the system SHALL immediately apply changes to new sessions without restart.
8.  WHEN displaying AI interface THEN the system SHALL clearly indicate access level ("Basic Access" vs "Premium Access via invitation").
9.  WHEN public users attempt premium features THEN the system SHALL show "This feature requires an invitation code" message.
10. WHEN tracking usage THEN the **server-side system SHALL separately track public usage vs reflink usage for cost analysis (in a persistent database)**.

### Requirement 18

**User Story:** As a system administrator, I want all AI admin interfaces to be properly integrated into the existing admin system, so that I have a consistent and unified admin experience.

#### Acceptance Criteria

1.  WHEN creating admin pages for AI features THEN the system SHALL use the existing AdminLayout and AdminPageLayout components.
2.  WHEN adding new admin functionality THEN the system SHALL add proper navigation entries to the AdminSidebar component.
3.  WHEN routing admin pages THEN the system SHALL follow the existing /admin/[section]/[page] URL pattern.
4.  WHEN displaying admin pages THEN the system SHALL include proper breadcrumb navigation using AdminPageLayout.
5.  WHEN styling admin interfaces THEN the system SHALL use the existing admin theme and UI component library.
6.  WHEN grouping admin features THEN the system SHALL organize AI-related pages under the "AI Assistant" section in the sidebar.
7.  WHEN creating admin forms THEN the system SHALL use consistent form styling and validation patterns.
8.  WHEN implementing admin actions THEN the system SHALL follow existing admin interaction patterns and feedback mechanisms.
9.  WHEN adding admin pages THEN the system SHALL ensure proper authentication and authorization using existing admin middleware.
10. WHEN testing admin features THEN the system SHALL verify integration with existing admin layout and navigation works correctly.

### Requirement 19

**User Story:** As a system administrator, I want a comprehensive AI debug panel at /admin/ai/debug, so that I can test conversation strategies, inspect AI interactions, and troubleshoot system issues with full visibility into AI processing.

#### Acceptance Criteria

1.  WHEN accessing the debug panel THEN the system SHALL require admin authentication to protect sensitive AI data.
2.  WHEN testing conversations THEN the system SHALL provide a conversation tester that allows real-time AI interaction with different models and modes.
3.  WHEN debugging AI responses THEN the system SHALL display the complete system prompt being sent to the LLM (as configured server-side for injection).
4.  WHEN analyzing context THEN the system SHALL show the full context string provided to the AI for each request.
5.  WHEN inspecting AI requests THEN the system SHALL display the complete request payload including messages, temperature, and model settings.
6.  WHEN reviewing AI responses THEN the system SHALL show the full AI response including token usage, cost, and processing time.
7.  WHEN switching between sessions THEN the system SHALL provide session synchronization between the conversation tester and debug data display **from the persistent database and active server-side sessions**.
8.  WHEN selecting models THEN the system SHALL allow testing with different AI models and conversation modes (text, voice, hybrid).
9.  WHEN monitoring conversations THEN the system SHALL provide real-time updates of debug data as conversations progress **(from active server-side sessions)**.
10. WHEN troubleshooting issues THEN the system SHALL maintain debug data persistence through **database storage for reliable access and analysis**.

### Requirement 20

**User Story:** As a portfolio visitor, I want seamless conversation mode switching between text and voice, so that I can choose my preferred interaction method at any time while maintaining conversation continuity.

#### Acceptance Criteria

1.  WHEN using the AI assistant THEN the system SHALL allow real-time mode switching between text, voice, and hybrid modes at any moment.
2.  WHEN switching modes THEN the **server-side AI agent SHALL preserve complete conversation context, message history, and navigation state in the persistent database without interruption**.
3.  WHEN transitioning from text to voice THEN the **server-side AI agent SHALL maintain the same conversation thread and AI personality consistency**.
4.  WHEN transitioning from voice to text THEN the **server-side AI agent SHALL preserve all spoken context and continue the conversation seamlessly in text format**.
5.  WHEN using hybrid mode THEN the system SHALL allow simultaneous text and voice input with intelligent processing prioritization.
6.  WHEN processing hybrid input THEN the **server-side AI agent SHALL handle simultaneous text typing and voice speaking by prioritizing the most recent or complete input**.
7.  WHEN mode switching occurs THEN the system SHALL provide smooth UI transitions with visual feedback and progress indicators.
8.  WHEN voice activity is detected THEN the system SHALL automatically offer to switch to voice mode if currently in text mode (with user preference controls).
9.  WHEN text input is detected during voice mode THEN the system SHALL allow seamless switching to text without interrupting ongoing voice processing.
10. WHEN switching modes THEN the **server-side AI agent SHALL maintain unified conversation state that works identically across all transport types (HTTP for text, WebRTC/WebSocket for voice/data channels, hybrid)**.
11. WHEN preserving context THEN the **server-side AI agent SHALL ensure navigation commands, project context, and user preferences transfer seamlessly between modes**.
12. WHEN handling interruptions THEN the **server-side AI agent SHALL gracefully manage mode switches during AI responses, allowing users to interrupt voice with text or vice versa**.
13. WHEN optimizing user experience THEN the **server-side AI agent SHALL provide intelligent response mode selection based on input type, content complexity, and user preferences**.
14. WHEN managing conversation flow THEN the **server-side AI agent SHALL ensure the same internal conversation pipeline processes all inputs regardless of transport method for consistent AI behavior**.
15. WHEN tracking conversation continuity THEN the **server-side AI agent SHALL log all mode switches and maintain conversation analytics across all transport types in the persistent database**.

### Requirement 21 (New: General System Security and Data Protection)

**User Story:** As a portfolio owner, I want the AI assistant system to be secure and protect sensitive data, so that I can trust its operation and comply with privacy regulations.

#### Acceptance Criteria

1.  WHEN accessing any admin or sensitive API endpoint THEN the system SHALL require proper authentication and granular authorization.
2.  WHEN storing sensitive data (e.g., conversation history, job specifications, user IDs) THEN the system SHALL encrypt data at rest.
3.  WHEN transmitting any data over networks THEN the system SHALL use TLS/SSL encryption for all HTTP/API traffic and secure WebRTC/WebSocket connections.
4.  WHEN receiving user input THEN the system SHALL validate and sanitize all inputs to prevent common web vulnerabilities (e.g., XSS, SQL injection).
5.  WHEN processing data THEN the system SHALL adhere to a strict principle of least privilege, ensuring components only access necessary data.
6.  WHEN managing secrets (e.g., API keys, database credentials) THEN the system SHALL store them securely in environment variables or a dedicated secret management service, never hardcoded or exposed to the client.
7.  WHEN handling errors THEN the system SHALL avoid exposing sensitive system information or stack traces to the client.