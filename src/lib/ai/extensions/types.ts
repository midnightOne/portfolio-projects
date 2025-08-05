/**
 * Extension architecture types for AI function calling and system operations
 */

export interface AIFunctionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
  enum?: string[];
}

export interface AIFunctionSchema {
  name: string;
  description: string;
  parameters: AIFunctionParameter[];
  category: 'content' | 'analytics' | 'bulk-edit' | 'system' | 'media';
  permissions: string[];
  version: string;
}

export interface AIFunctionContext {
  userId?: string;
  projectId?: string;
  sessionId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AIFunctionRequest {
  functionName: string;
  parameters: Record<string, any>;
  context: AIFunctionContext;
  model?: string;
  provider?: 'openai' | 'anthropic';
}

export interface AIFunctionResponse {
  success: boolean;
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    executionTime: number;
    tokensUsed?: number;
    cost?: number;
    cacheHit?: boolean;
  };
}

export interface AIFunction {
  schema: AIFunctionSchema;
  execute(request: AIFunctionRequest): Promise<AIFunctionResponse>;
  validate?(parameters: Record<string, any>): Promise<boolean>;
  authorize?(context: AIFunctionContext): Promise<boolean>;
}

export interface AIFunctionRegistryConfig {
  enableCaching: boolean;
  maxCacheSize: number;
  defaultTimeout: number;
  enableLogging: boolean;
  enableMetrics: boolean;
}

export interface AIFunctionExecutionLog {
  id: string;
  functionName: string;
  parameters: Record<string, any>;
  context: AIFunctionContext;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  result?: any;
  error?: string;
  metadata: {
    executionTime: number;
    tokensUsed?: number;
    cost?: number;
  };
}