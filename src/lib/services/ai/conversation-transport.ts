/**
 * Conversation Transport Layer
 * Provides transport-agnostic interfaces for different communication methods
 * Supports HTTP, WebSocket, and WebRTC transports for unified conversation management
 */

import { 
  type ConversationInput, 
  type ConversationResponse, 
  type ConversationOptions,
  type ConversationMessage
} from './unified-conversation-manager';

// Transport layer interfaces
export interface ConversationTransport {
  name: string;
  isConnected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(input: ConversationInput, options?: ConversationOptions): Promise<ConversationResponse>;
  onMessage(callback: (response: ConversationResponse) => void): void;
  onError(callback: (error: TransportError) => void): void;
  onStateChange(callback: (state: TransportState) => void): void;
}

export interface TransportError {
  code: string;
  message: string;
  recoverable: boolean;
  transport: string;
  timestamp: Date;
}

export interface TransportState {
  transport: string;
  connected: boolean;
  latency?: number;
  quality?: 'excellent' | 'good' | 'fair' | 'poor';
  lastActivity: Date;
}

export interface TransportConfig {
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableLogging: boolean;
}

/**
 * HTTP Transport for text-based conversations
 * Simple request/response pattern for basic chat functionality
 */
export class HTTPConversationTransport implements ConversationTransport {
  name = 'http';
  isConnected = true; // HTTP is always "connected"
  
  private messageCallback?: (response: ConversationResponse) => void;
  private errorCallback?: (error: TransportError) => void;
  private stateCallback?: (state: TransportState) => void;
  private config: TransportConfig;

  constructor(config: Partial<TransportConfig> = {}) {
    this.config = {
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000,
      enableLogging: false,
      ...config
    };
  }

  async connect(): Promise<void> {
    // HTTP doesn't need explicit connection
    this.notifyStateChange({
      transport: this.name,
      connected: true,
      lastActivity: new Date()
    });
  }

  async disconnect(): Promise<void> {
    // HTTP doesn't need explicit disconnection
    this.notifyStateChange({
      transport: this.name,
      connected: false,
      lastActivity: new Date()
    });
  }

  async sendMessage(input: ConversationInput, options?: ConversationOptions): Promise<ConversationResponse> {
    const startTime = Date.now();

    try {
      // Make HTTP request to the conversation API endpoint
      const response = await fetch('/api/ai/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies for authentication
        body: JSON.stringify({
          input,
          options
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || 'API request failed');
      }

      // Calculate latency
      const latency = Date.now() - startTime;
      
      // Notify state change with latency
      this.notifyStateChange({
        transport: this.name,
        connected: true,
        latency,
        quality: this.getQualityFromLatency(latency),
        lastActivity: new Date()
      });

      // Extract the conversation response from the API response
      const conversationResponse: ConversationResponse = data.data;

      // Notify message callback if set
      if (this.messageCallback) {
        this.messageCallback(conversationResponse);
      }

      return conversationResponse;

    } catch (error) {
      const transportError: TransportError = {
        code: 'HTTP_REQUEST_FAILED',
        message: error instanceof Error ? error.message : 'Unknown HTTP error',
        recoverable: true,
        transport: this.name,
        timestamp: new Date()
      };

      if (this.errorCallback) {
        this.errorCallback(transportError);
      }

      throw transportError;
    }
  }

  onMessage(callback: (response: ConversationResponse) => void): void {
    this.messageCallback = callback;
  }

  onError(callback: (error: TransportError) => void): void {
    this.errorCallback = callback;
  }

  onStateChange(callback: (state: TransportState) => void): void {
    this.stateCallback = callback;
  }

  private notifyStateChange(state: TransportState): void {
    if (this.stateCallback) {
      this.stateCallback(state);
    }
  }

  private getQualityFromLatency(latency: number): TransportState['quality'] {
    if (latency < 500) return 'excellent';
    if (latency < 1000) return 'good';
    if (latency < 2000) return 'fair';
    return 'poor';
  }
}

/**
 * WebSocket Transport for real-time conversations
 * Enables bidirectional communication and real-time updates
 */
export class WebSocketConversationTransport implements ConversationTransport {
  name = 'websocket';
  isConnected = false;
  
  private ws?: WebSocket;
  private messageCallback?: (response: ConversationResponse) => void;
  private errorCallback?: (error: TransportError) => void;
  private stateCallback?: (state: TransportState) => void;
  private config: TransportConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private wsUrl: string, config: Partial<TransportConfig> = {}) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableLogging: false,
      ...config
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.notifyStateChange({
            transport: this.name,
            connected: true,
            lastActivity: new Date()
          });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const response: ConversationResponse = JSON.parse(event.data);
            if (this.messageCallback) {
              this.messageCallback(response);
            }
          } catch (error) {
            this.notifyError({
              code: 'WEBSOCKET_PARSE_ERROR',
              message: 'Failed to parse WebSocket message',
              recoverable: true,
              transport: this.name,
              timestamp: new Date()
            });
          }
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.notifyStateChange({
            transport: this.name,
            connected: false,
            lastActivity: new Date()
          });
          
          // Attempt reconnection
          this.attemptReconnection();
        };

        this.ws.onerror = (error) => {
          this.notifyError({
            code: 'WEBSOCKET_CONNECTION_ERROR',
            message: 'WebSocket connection error',
            recoverable: true,
            transport: this.name,
            timestamp: new Date()
          });
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.isConnected = false;
  }

  async sendMessage(input: ConversationInput, options?: ConversationOptions): Promise<ConversationResponse> {
    if (!this.isConnected || !this.ws) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      const message = {
        id: messageId,
        type: 'conversation_input',
        data: { input, options }
      };

      // Set up response handler
      const responseHandler = (response: ConversationResponse) => {
        if ((response as any).messageId === messageId) {
          resolve(response);
        }
      };

      this.onMessage(responseHandler);

      // Send message
      this.ws!.send(JSON.stringify(message));

      // Set timeout
      setTimeout(() => {
        reject(new Error('WebSocket message timeout'));
      }, this.config.timeout);
    });
  }

  onMessage(callback: (response: ConversationResponse) => void): void {
    this.messageCallback = callback;
  }

  onError(callback: (error: TransportError) => void): void {
    this.errorCallback = callback;
  }

  onStateChange(callback: (state: TransportState) => void): void {
    this.stateCallback = callback;
  }

  private notifyStateChange(state: TransportState): void {
    if (this.stateCallback) {
      this.stateCallback(state);
    }
  }

  private notifyError(error: TransportError): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  private attemptReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect().catch(() => {
          // Reconnection failed, will try again
        });
      }, this.config.retryDelay * this.reconnectAttempts);
    }
  }

  private generateMessageId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * WebRTC Transport for voice conversations
 * Enables real-time audio communication with low latency
 */
export class WebRTCConversationTransport implements ConversationTransport {
  name = 'webrtc';
  isConnected = false;
  
  private peerConnection?: RTCPeerConnection;
  private dataChannel?: RTCDataChannel;
  private messageCallback?: (response: ConversationResponse) => void;
  private errorCallback?: (error: TransportError) => void;
  private stateCallback?: (state: TransportState) => void;
  private config: TransportConfig;

  constructor(config: Partial<TransportConfig> = {}) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableLogging: false,
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      // Create data channel for text communication
      this.dataChannel = this.peerConnection.createDataChannel('conversation', {
        ordered: true
      });

      this.dataChannel.onopen = () => {
        this.isConnected = true;
        this.notifyStateChange({
          transport: this.name,
          connected: true,
          quality: 'excellent', // WebRTC typically has excellent quality
          lastActivity: new Date()
        });
      };

      this.dataChannel.onmessage = (event) => {
        try {
          const response: ConversationResponse = JSON.parse(event.data);
          if (this.messageCallback) {
            this.messageCallback(response);
          }
        } catch (error) {
          this.notifyError({
            code: 'WEBRTC_PARSE_ERROR',
            message: 'Failed to parse WebRTC message',
            recoverable: true,
            transport: this.name,
            timestamp: new Date()
          });
        }
      };

      this.dataChannel.onclose = () => {
        this.isConnected = false;
        this.notifyStateChange({
          transport: this.name,
          connected: false,
          lastActivity: new Date()
        });
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        if (state === 'failed' || state === 'disconnected') {
          this.notifyError({
            code: 'WEBRTC_CONNECTION_FAILED',
            message: `WebRTC connection ${state}`,
            recoverable: true,
            transport: this.name,
            timestamp: new Date()
          });
        }
      };

    } catch (error) {
      throw new Error(`Failed to initialize WebRTC: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = undefined;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = undefined;
    }
    
    this.isConnected = false;
  }

  async sendMessage(input: ConversationInput, options?: ConversationOptions): Promise<ConversationResponse> {
    if (!this.isConnected || !this.dataChannel) {
      throw new Error('WebRTC not connected');
    }

    // For WebRTC, we'll process the message locally and send the response
    // In a full implementation, this might involve server-side processing
    const response = await unifiedConversationManager.processInput(input, options);
    
    // Send response through data channel (for demonstration)
    this.dataChannel.send(JSON.stringify(response));
    
    return response;
  }

  onMessage(callback: (response: ConversationResponse) => void): void {
    this.messageCallback = callback;
  }

  onError(callback: (error: TransportError) => void): void {
    this.errorCallback = callback;
  }

  onStateChange(callback: (state: TransportState) => void): void {
    this.stateCallback = callback;
  }

  private notifyStateChange(state: TransportState): void {
    if (this.stateCallback) {
      this.stateCallback(state);
    }
  }

  private notifyError(error: TransportError): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }
}

/**
 * Transport Manager
 * Manages multiple transport types and provides unified interface
 */
export class ConversationTransportManager {
  private transports = new Map<string, ConversationTransport>();
  private activeTransport?: ConversationTransport;
  private messageCallbacks: Array<(response: ConversationResponse) => void> = [];
  private errorCallbacks: Array<(error: TransportError) => void> = [];
  private stateCallbacks: Array<(state: TransportState) => void> = [];

  /**
   * Register a transport
   */
  registerTransport(transport: ConversationTransport): void {
    this.transports.set(transport.name, transport);
    
    // Set up event forwarding
    transport.onMessage((response) => {
      this.messageCallbacks.forEach(callback => callback(response));
    });
    
    transport.onError((error) => {
      this.errorCallbacks.forEach(callback => callback(error));
    });
    
    transport.onStateChange((state) => {
      this.stateCallbacks.forEach(callback => callback(state));
    });
  }

  /**
   * Set active transport
   */
  async setActiveTransport(transportName: string): Promise<void> {
    const transport = this.transports.get(transportName);
    if (!transport) {
      throw new Error(`Transport ${transportName} not found`);
    }

    // Disconnect current transport
    if (this.activeTransport) {
      await this.activeTransport.disconnect();
    }

    // Connect new transport
    await transport.connect();
    this.activeTransport = transport;
  }

  /**
   * Send message using active transport
   */
  async sendMessage(input: ConversationInput, options?: ConversationOptions): Promise<ConversationResponse> {
    if (!this.activeTransport) {
      throw new Error('No active transport');
    }

    return this.activeTransport.sendMessage(input, options);
  }

  /**
   * Get available transports
   */
  getAvailableTransports(): string[] {
    return Array.from(this.transports.keys());
  }

  /**
   * Get active transport name
   */
  getActiveTransportName(): string | undefined {
    return this.activeTransport?.name;
  }

  /**
   * Check if transport is connected
   */
  isConnected(): boolean {
    return this.activeTransport?.isConnected || false;
  }

  /**
   * Event handlers
   */
  onMessage(callback: (response: ConversationResponse) => void): void {
    this.messageCallbacks.push(callback);
  }

  onError(callback: (error: TransportError) => void): void {
    this.errorCallbacks.push(callback);
  }

  onStateChange(callback: (state: TransportState) => void): void {
    this.stateCallbacks.push(callback);
  }
}

// Classes are already exported above with 'export class' declarations