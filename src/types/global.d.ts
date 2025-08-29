/**
 * Global type declarations for server-side conversation debug data
 */

import { type ConversationDebugData } from '@/lib/services/ai/unified-conversation-manager';

declare global {
  var __unifiedConversationDebugData: {
    lastDebugData: ConversationDebugData | null;
    recentDebugData: ConversationDebugData[];
  } | undefined;
}

export {};