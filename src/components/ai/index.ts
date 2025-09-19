/**
 * AI Components - Task 8.1 Implementation
 * 
 * Export all AI-related components with REAL voice integration and reflink-based access control.
 */

export { FloatingAIInterface, type FloatingAIInterfaceProps, type QuickAction } from './floating-ai-interface';
export { AIInterfaceWrapper } from './ai-interface-wrapper';
export { useConversationalAgent } from '@/components/providers/conversational-agent-provider';
export { useReflinkSession } from '@/components/providers/reflink-session-provider';