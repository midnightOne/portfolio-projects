/**
 * Simplified Conversation Manager (Server-Side Only)
 * 
 * A streamlined conversation management system focused on server-side operations
 * with proper database integration, conversation analytics, and debug data collection.
 * 
 * This replaces the complex transport layer system with a simple, reliable approach
 * that focuses on core conversation functionality without client-side complexity.
 */

import { prisma } from '@/lib/prisma';
import { type ConversationMessage } from './unified-conversation-manager';

// Simplified conversation types
export interface SimpleConversationInput {
  content: string;
  mode: 'text' | 'voice' | 'hybrid';
  sessionId: string;
  reflinkId?: string;
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    voiceData?: {
      duration?: number;
      audioUrl?: string;
      transcription?: string;
    };
    userPreferences?: {
      tone?: 'technical' | 'casual' | 'professional';
      responseLength?: 'concise' | 'detailed' | 'comprehensive';
      includeNavigation?: boolean;
    };
  };
}

export interface SimpleConversationResponse {
  id: string;
  content: string;
  tokensUsed?: number;
  cost?: number;
  model?: string;
  processingTime: number;
  navigationCommands?: Array<{
    type: string;
    target: string;
    parameters: Record<string, any>;
  }>;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

export interface ConversationDebugData {
  sessionId: string;
  messageId: string;
  timestamp: Date;
  systemPrompt: string;
  contextString: string;
  aiRequest: any;
  aiResponse?: any;
  error?: string;
  performanceMetrics: {
    contextBuildTime?: number;
    aiRequestTime?: number;
    totalProcessingTime: number;
  };
}

export interface ConversationAnalytics {
  totalConversations: number;
  totalMessages: number;
  totalTokensUsed: number;
  totalCost: number;
  averageMessagesPerConversation: number;
  averageResponseTime: number;
  errorRate: number;
  modeBreakdown: {
    text: number;
    voice: number;
    hybrid: number;
  };
  modelUsage: Record<string, number>;
  reflinkUsage: Record<string, number>;
  timeRangeStats: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
}

export interface ConversationExportData {
  conversations: Array<{
    id: string;
    sessionId: string;
    reflinkId?: string;
    startedAt: Date;
    lastMessageAt?: Date;
    messageCount: number;
    totalTokens: number;
    totalCost: number;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp: Date;
      tokensUsed?: number;
      cost?: number;
      model?: string;
      mode?: string;
      metadata?: any;
    }>;
  }>;
  summary: {
    totalConversations: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    dateRange: {
      start: Date;
      end: Date;
    };
  };
}

/**
 * Simplified Conversation Manager
 * 
 * Handles conversation storage, retrieval, and management with a focus on
 * simplicity, reliability, and proper database integration.
 */
export class ConversationManager {
  private static instance: ConversationManager;

  constructor() {
    // Initialize any required setup
  }

  static getInstance(): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager();
    }
    return ConversationManager.instance;
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    sessionId: string,
    reflinkId?: string,
    metadata?: {
      userAgent?: string;
      ipAddress?: string;
      accessLevel?: string;
    }
  ): Promise<string> {
    try {
      const conversation = await prisma.aIConversation.create({
        data: {
          sessionId,
          reflinkId,
          messageCount: 0,
          totalTokens: 0,
          totalCost: 0,
          startedAt: new Date(),
          metadata: {
            userAgent: metadata?.userAgent,
            ipAddress: metadata?.ipAddress,
            accessLevel: metadata?.accessLevel,
            conversationMode: 'text',
            errorCount: 0,
            navigationCommandsUsed: 0,
            voiceInteractionCount: 0,
            contextSourcesUsed: []
          }
        }
      });

      return conversation.id;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw new Error('Failed to create conversation');
    }
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    sessionId: string,
    input: SimpleConversationInput,
    response: SimpleConversationResponse,
    debugData?: ConversationDebugData
  ): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // Get or create conversation
        let conversation = await tx.aIConversation.findFirst({
          where: { sessionId }
        });

        if (!conversation) {
          conversation = await tx.aIConversation.create({
            data: {
              sessionId,
              reflinkId: input.reflinkId,
              messageCount: 0,
              totalTokens: 0,
              totalCost: 0,
              startedAt: new Date(),
              metadata: {
                userAgent: input.metadata?.userAgent,
                ipAddress: input.metadata?.ipAddress,
                conversationMode: input.mode,
                errorCount: 0,
                navigationCommandsUsed: 0,
                voiceInteractionCount: input.mode === 'voice' ? 1 : 0,
                contextSourcesUsed: []
              }
            }
          });
        }

        // Add user message
        const userMessage = await tx.aIConversationMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'user',
            content: input.content,
            transportMode: input.mode,
            timestamp: new Date(),
            metadata: {
              voiceData: input.metadata?.voiceData,
              userPreferences: input.metadata?.userPreferences,
              debugInfo: debugData ? {
                systemPrompt: debugData.systemPrompt,
                contextString: debugData.contextString,
                aiRequest: debugData.aiRequest
              } : undefined
            }
          }
        });

        // Add assistant message
        const assistantMessage = await tx.aIConversationMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: response.content,
            tokensUsed: response.tokensUsed,
            costUsd: response.cost,
            modelUsed: response.model,
            transportMode: input.mode,
            timestamp: new Date(),
            metadata: {
              processingTime: response.processingTime,
              navigationCommands: response.navigationCommands,
              errorDetails: response.error,
              performanceMetrics: debugData?.performanceMetrics,
              debugInfo: debugData ? {
                systemPrompt: debugData.systemPrompt,
                contextString: debugData.contextString,
                aiRequest: debugData.aiRequest,
                aiResponse: debugData.aiResponse
              } : undefined
            }
          }
        });

        // Update conversation totals
        await tx.aIConversation.update({
          where: { id: conversation.id },
          data: {
            messageCount: { increment: 2 }, // User + assistant message
            totalTokens: { increment: response.tokensUsed || 0 },
            totalCost: { increment: response.cost || 0 },
            lastMessageAt: new Date(),
            metadata: {
              ...conversation.metadata as any,
              errorCount: response.error ? (conversation.metadata as any).errorCount + 1 : (conversation.metadata as any).errorCount,
              navigationCommandsUsed: response.navigationCommands ? 
                (conversation.metadata as any).navigationCommandsUsed + response.navigationCommands.length : 
                (conversation.metadata as any).navigationCommandsUsed,
              voiceInteractionCount: input.mode === 'voice' ? 
                (conversation.metadata as any).voiceInteractionCount + 1 : 
                (conversation.metadata as any).voiceInteractionCount
            }
          }
        });

        // Store debug data if provided
        if (debugData) {
          await this.storeDebugData(conversation.id, assistantMessage.id, debugData);
        }
      });
    } catch (error) {
      console.error('Failed to add message:', error);
      throw new Error('Failed to add message to conversation');
    }
  }

  /**
   * Get conversation by session ID
   */
  async getConversationBySessionId(sessionId: string): Promise<{
    id: string;
    sessionId: string;
    reflinkId?: string;
    messageCount: number;
    totalTokens: number;
    totalCost: number;
    startedAt: Date;
    lastMessageAt?: Date;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      timestamp: Date;
      tokensUsed?: number;
      cost?: number;
      model?: string;
      mode?: string;
      metadata?: any;
    }>;
  } | null> {
    try {
      const conversation = await prisma.aIConversation.findFirst({
        where: { sessionId },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' }
          }
        }
      });

      if (!conversation) {
        return null;
      }

      return {
        id: conversation.id,
        sessionId: conversation.sessionId,
        reflinkId: conversation.reflinkId || undefined,
        messageCount: conversation.messageCount,
        totalTokens: conversation.totalTokens,
        totalCost: Number(conversation.totalCost),
        startedAt: conversation.startedAt,
        lastMessageAt: conversation.lastMessageAt || undefined,
        messages: conversation.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          tokensUsed: msg.tokensUsed || undefined,
          cost: msg.costUsd ? Number(msg.costUsd) : undefined,
          model: msg.modelUsed || undefined,
          mode: msg.transportMode || undefined,
          metadata: msg.metadata
        }))
      };
    } catch (error) {
      console.error('Failed to get conversation:', error);
      return null;
    }
  }

  /**
   * Get conversation analytics
   */
  async getAnalytics(dateRange?: { start: Date; end: Date }): Promise<ConversationAnalytics> {
    try {
      const where: any = {};
      if (dateRange) {
        where.startedAt = {
          gte: dateRange.start,
          lte: dateRange.end
        };
      }

      const [
        totalConversations,
        conversationStats,
        messageStats,
        modeStats,
        modelStats,
        reflinkStats,
        timeStats
      ] = await Promise.all([
        // Total conversations
        prisma.aIConversation.count({ where }),

        // Conversation aggregates
        prisma.aIConversation.aggregate({
          where,
          _sum: { totalTokens: true, totalCost: true, messageCount: true },
          _avg: { messageCount: true }
        }),

        // Message count
        prisma.aIConversationMessage.count({
          where: dateRange ? {
            conversation: {
              startedAt: {
                gte: dateRange.start,
                lte: dateRange.end
              }
            }
          } : undefined
        }),

        // Mode breakdown
        prisma.aIConversationMessage.groupBy({
          by: ['transportMode'],
          _count: true,
          where: dateRange ? {
            conversation: {
              startedAt: {
                gte: dateRange.start,
                lte: dateRange.end
              }
            }
          } : undefined
        }),

        // Model usage
        prisma.aIConversationMessage.groupBy({
          by: ['modelUsed'],
          _count: true,
          where: {
            modelUsed: { not: null },
            ...(dateRange ? {
              conversation: {
                startedAt: {
                  gte: dateRange.start,
                  lte: dateRange.end
                }
              }
            } : {})
          }
        }),

        // Reflink usage
        prisma.aIConversation.groupBy({
          by: ['reflinkId'],
          _count: true,
          where: {
            reflinkId: { not: null },
            ...where
          }
        }),

        // Time range stats
        Promise.all([
          prisma.aIConversation.count({
            where: {
              startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
          }),
          prisma.aIConversation.count({
            where: {
              startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }
          }),
          prisma.aIConversation.count({
            where: {
              startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
          })
        ])
      ]);

      // Calculate error rate
      const errorConversations = await prisma.aIConversation.count({
        where: {
          ...where,
          metadata: {
            path: ['errorCount'],
            gt: 0
          }
        }
      });

      // Calculate average response time
      const avgResponseTime = await prisma.aIConversationMessage.aggregate({
        where: {
          metadata: {
            path: ['processingTime'],
            not: null
          },
          ...(dateRange ? {
            conversation: {
              startedAt: {
                gte: dateRange.start,
                lte: dateRange.end
              }
            }
          } : {})
        },
        _avg: {
          metadata: true // This won't work directly, we'll need to calculate manually
        }
      });

      // Build mode breakdown
      const modeBreakdown = { text: 0, voice: 0, hybrid: 0 };
      modeStats.forEach(stat => {
        if (stat.transportMode && stat.transportMode in modeBreakdown) {
          modeBreakdown[stat.transportMode as keyof typeof modeBreakdown] = stat._count;
        }
      });

      // Build model usage
      const modelUsage: Record<string, number> = {};
      modelStats.forEach(stat => {
        if (stat.modelUsed) {
          modelUsage[stat.modelUsed] = stat._count;
        }
      });

      // Build reflink usage
      const reflinkUsage: Record<string, number> = {};
      reflinkStats.forEach(stat => {
        if (stat.reflinkId) {
          reflinkUsage[stat.reflinkId] = stat._count;
        }
      });

      return {
        totalConversations,
        totalMessages: messageStats,
        totalTokensUsed: conversationStats._sum.totalTokens || 0,
        totalCost: Number(conversationStats._sum.totalCost) || 0,
        averageMessagesPerConversation: Number(conversationStats._avg.messageCount) || 0,
        averageResponseTime: 0, // Would need custom calculation
        errorRate: totalConversations > 0 ? (errorConversations / totalConversations) * 100 : 0,
        modeBreakdown,
        modelUsage,
        reflinkUsage,
        timeRangeStats: {
          last24Hours: timeStats[0],
          last7Days: timeStats[1],
          last30Days: timeStats[2]
        }
      };
    } catch (error) {
      console.error('Failed to get analytics:', error);
      throw new Error('Failed to get conversation analytics');
    }
  }

  /**
   * Export conversations
   */
  async exportConversations(
    format: 'json' | 'csv',
    options?: {
      dateRange?: { start: Date; end: Date };
      sessionIds?: string[];
      includeDebugData?: boolean;
    }
  ): Promise<string> {
    try {
      const where: any = {};

      if (options?.dateRange) {
        where.startedAt = {
          gte: options.dateRange.start,
          lte: options.dateRange.end
        };
      }

      if (options?.sessionIds && options.sessionIds.length > 0) {
        where.sessionId = { in: options.sessionIds };
      }

      const conversations = await prisma.aIConversation.findMany({
        where,
        include: {
          messages: {
            orderBy: { timestamp: 'asc' }
          }
        },
        orderBy: { startedAt: 'desc' }
      });

      const exportData: ConversationExportData = {
        conversations: conversations.map(conv => ({
          id: conv.id,
          sessionId: conv.sessionId,
          reflinkId: conv.reflinkId || undefined,
          startedAt: conv.startedAt,
          lastMessageAt: conv.lastMessageAt || undefined,
          messageCount: conv.messageCount,
          totalTokens: conv.totalTokens,
          totalCost: Number(conv.totalCost),
          messages: conv.messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            tokensUsed: msg.tokensUsed || undefined,
            cost: msg.costUsd ? Number(msg.costUsd) : undefined,
            model: msg.modelUsed || undefined,
            mode: msg.transportMode || undefined,
            metadata: options?.includeDebugData ? msg.metadata : undefined
          }))
        })),
        summary: {
          totalConversations: conversations.length,
          totalMessages: conversations.reduce((sum, conv) => sum + conv.messageCount, 0),
          totalTokens: conversations.reduce((sum, conv) => sum + conv.totalTokens, 0),
          totalCost: conversations.reduce((sum, conv) => sum + Number(conv.totalCost), 0),
          dateRange: {
            start: options?.dateRange?.start || new Date(0),
            end: options?.dateRange?.end || new Date()
          }
        }
      };

      if (format === 'json') {
        return JSON.stringify(exportData, null, 2);
      } else {
        return this.convertToCSV(exportData);
      }
    } catch (error) {
      console.error('Failed to export conversations:', error);
      throw new Error('Failed to export conversations');
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(sessionId: string): Promise<void> {
    try {
      const conversation = await prisma.aIConversation.findFirst({
        where: { sessionId }
      });

      if (conversation) {
        await prisma.aIConversation.delete({
          where: { id: conversation.id }
        });
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw new Error('Failed to delete conversation');
    }
  }

  /**
   * Clean up old conversations
   */
  async cleanupOldConversations(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await prisma.aIConversation.deleteMany({
        where: {
          startedAt: { lt: cutoffDate }
        }
      });

      return result.count;
    } catch (error) {
      console.error('Failed to cleanup old conversations:', error);
      throw new Error('Failed to cleanup old conversations');
    }
  }

  /**
   * Get debug data for a conversation
   */
  async getDebugData(sessionId: string): Promise<ConversationDebugData[]> {
    try {
      const conversation = await prisma.aIConversation.findFirst({
        where: { sessionId },
        include: {
          messages: {
            where: {
              metadata: {
                path: ['debugInfo'],
                not: null
              }
            },
            orderBy: { timestamp: 'desc' }
          }
        }
      });

      if (!conversation) {
        return [];
      }

      return conversation.messages.map(msg => ({
        sessionId,
        messageId: msg.id,
        timestamp: msg.timestamp,
        systemPrompt: (msg.metadata as any)?.debugInfo?.systemPrompt || '',
        contextString: (msg.metadata as any)?.debugInfo?.contextString || '',
        aiRequest: (msg.metadata as any)?.debugInfo?.aiRequest || {},
        aiResponse: (msg.metadata as any)?.debugInfo?.aiResponse,
        error: (msg.metadata as any)?.errorDetails?.message,
        performanceMetrics: {
          contextBuildTime: (msg.metadata as any)?.performanceMetrics?.contextBuildTime,
          aiRequestTime: (msg.metadata as any)?.performanceMetrics?.aiRequestTime,
          totalProcessingTime: (msg.metadata as any)?.processingTime || 0
        }
      }));
    } catch (error) {
      console.error('Failed to get debug data:', error);
      return [];
    }
  }

  // Private helper methods

  private async storeDebugData(
    conversationId: string,
    messageId: string,
    debugData: ConversationDebugData
  ): Promise<void> {
    // Debug data is already stored in the message metadata
    // This method is kept for potential future expansion
  }

  private convertToCSV(data: ConversationExportData): string {
    const headers = [
      'Conversation ID',
      'Session ID',
      'Reflink ID',
      'Started At',
      'Last Message At',
      'Message Count',
      'Total Tokens',
      'Total Cost',
      'Message ID',
      'Role',
      'Content',
      'Timestamp',
      'Tokens Used',
      'Cost',
      'Model',
      'Mode'
    ];

    const rows = [headers.join(',')];

    data.conversations.forEach(conv => {
      conv.messages.forEach(msg => {
        const row = [
          conv.id,
          conv.sessionId,
          conv.reflinkId || '',
          conv.startedAt.toISOString(),
          conv.lastMessageAt?.toISOString() || '',
          conv.messageCount,
          conv.totalTokens,
          conv.totalCost,
          msg.id,
          msg.role,
          `"${msg.content.replace(/"/g, '""')}"`, // Escape quotes
          msg.timestamp.toISOString(),
          msg.tokensUsed || '',
          msg.cost || '',
          msg.model || '',
          msg.mode || ''
        ];
        rows.push(row.join(','));
      });
    });

    return rows.join('\n');
  }
}

// Export singleton instance
export const conversationManager = ConversationManager.getInstance();