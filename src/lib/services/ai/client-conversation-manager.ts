/**
 * Client-Side Conversation Manager
 * Provides conversation management functionality for browser environments
 * Uses API calls instead of direct database access to avoid Prisma client-side issues
 */

import { 
  type ConversationMessage,
  type ConversationState,
  type ConversationOptions
} from './unified-conversation-manager';

export class ClientConversationManager {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: string): Promise<ConversationMessage[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/conversation/history?sessionId=${encodeURIComponent(sessionId)}`, {
        credentials: 'include' // Include session cookies for authentication
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch conversation history: ${response.statusText}`);
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Failed to get conversation history:', error);
      return [];
    }
  }

  /**
   * Update conversation mode (placeholder - not implemented in API yet)
   */
  async updateConversationMode(sessionId: string, mode: 'text' | 'voice' | 'hybrid'): Promise<void> {
    // For now, this is a no-op since we don't have an API endpoint for this
    // The mode is handled per-message in the conversation API
    console.log(`Mode updated to ${mode} for session ${sessionId}`);
  }

  /**
   * Clear conversation history (placeholder - not implemented in API yet)
   */
  async clearConversationHistory(sessionId: string): Promise<void> {
    // For now, this is a no-op since we don't have an API endpoint for this
    // In a real implementation, this would call DELETE /api/ai/conversation/history
    console.log(`Cleared history for session ${sessionId}`);
  }

  /**
   * Get conversation state
   */
  async getConversationState(sessionId: string): Promise<ConversationState | null> {
    try {
      const messages = await this.getConversationHistory(sessionId);
      
      // Construct state from messages
      return {
        sessionId,
        messages,
        isProcessing: false, // We can't easily determine this from API
        currentMode: 'text', // Default mode
        metadata: {}
      };
    } catch (error) {
      console.error('Failed to get conversation state:', error);
      return null;
    }
  }

  /**
   * Check if conversation is processing (always returns false for client-side)
   */
  isProcessing(sessionId: string): boolean {
    // Client-side can't easily determine processing state
    // This would need to be tracked differently or via WebSocket
    return false;
  }
}

// Export singleton instance
export const clientConversationManager = new ClientConversationManager();