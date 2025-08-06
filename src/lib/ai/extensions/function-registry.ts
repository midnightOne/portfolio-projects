/**
 * AI Function Registry for MCP-like function calling
 */

import { 
  AIFunction, 
  AIFunctionRequest, 
  AIFunctionResponse, 
  AIFunctionRegistryConfig,
  AIFunctionExecutionLog,
  AIFunctionSchema
} from './types';

export class AIFunctionRegistry {
  private functions: Map<string, AIFunction> = new Map();
  private executionLogs: AIFunctionExecutionLog[] = [];
  private cache: Map<string, { result: any; timestamp: Date }> = new Map();
  private config: AIFunctionRegistryConfig;

  constructor(config: Partial<AIFunctionRegistryConfig> = {}) {
    this.config = {
      enableCaching: config.enableCaching ?? true,
      maxCacheSize: config.maxCacheSize ?? 1000,
      defaultTimeout: config.defaultTimeout ?? 30000,
      enableLogging: config.enableLogging ?? true,
      enableMetrics: config.enableMetrics ?? true,
      ...config
    };
  }

  /**
   * Register a new AI function
   */
  register(func: AIFunction): void {
    if (this.functions.has(func.schema.name)) {
      throw new Error(`Function ${func.schema.name} is already registered`);
    }

    // Validate function schema
    this.validateSchema(func.schema);
    
    this.functions.set(func.schema.name, func);
    
    if (this.config.enableLogging) {
      console.log(`Registered AI function: ${func.schema.name} (${func.schema.category})`);
    }
  }

  /**
   * Unregister an AI function
   */
  unregister(functionName: string): boolean {
    const removed = this.functions.delete(functionName);
    
    if (removed && this.config.enableLogging) {
      console.log(`Unregistered AI function: ${functionName}`);
    }
    
    return removed;
  }

  /**
   * Get all registered functions
   */
  getFunctions(): AIFunctionSchema[] {
    return Array.from(this.functions.values()).map(func => func.schema);
  }

  /**
   * Get functions by category
   */
  getFunctionsByCategory(category: string): AIFunctionSchema[] {
    return this.getFunctions().filter(schema => schema.category === category);
  }

  /**
   * Check if a function is registered
   */
  hasFunction(functionName: string): boolean {
    return this.functions.has(functionName);
  }

  /**
   * Execute an AI function
   */
  async execute(request: AIFunctionRequest): Promise<AIFunctionResponse> {
    const startTime = new Date();
    const logId = this.generateLogId();

    try {
      // Check if function exists
      const func = this.functions.get(request.functionName);
      if (!func) {
        throw new Error(`Function ${request.functionName} not found`);
      }

      // Check cache if enabled
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(request);
        const cached = this.cache.get(cacheKey);
        if (cached && this.isCacheValid(cached.timestamp)) {
          return {
            success: true,
            result: cached.result,
            metadata: {
              executionTime: 0,
              cacheHit: true
            }
          };
        }
      }

      // Validate parameters
      if (func.validate) {
        const isValid = await func.validate(request.parameters);
        if (!isValid) {
          throw new Error('Parameter validation failed');
        }
      }

      // Check authorization
      if (func.authorize) {
        const isAuthorized = await func.authorize(request.context);
        if (!isAuthorized) {
          throw new Error('Authorization failed');
        }
      }

      // Execute function with timeout
      const response = await this.executeWithTimeout(func, request);
      
      // Cache result if successful and caching is enabled
      if (this.config.enableCaching && response.success) {
        const cacheKey = this.generateCacheKey(request);
        this.cache.set(cacheKey, {
          result: response.result,
          timestamp: new Date()
        });
        this.cleanupCache();
      }

      // Log execution
      if (this.config.enableLogging) {
        this.logExecution({
          id: logId,
          functionName: request.functionName,
          parameters: request.parameters,
          context: request.context,
          startTime,
          endTime: new Date(),
          success: response.success,
          result: response.result,
          error: response.error?.message,
          metadata: {
            executionTime: Date.now() - startTime.getTime(),
            tokensUsed: response.metadata?.tokensUsed,
            cost: response.metadata?.cost
          }
        });
      }

      return response;

    } catch (error) {
      const errorResponse: AIFunctionResponse = {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error
        },
        metadata: {
          executionTime: Date.now() - startTime.getTime()
        }
      };

      // Log error
      if (this.config.enableLogging) {
        this.logExecution({
          id: logId,
          functionName: request.functionName,
          parameters: request.parameters,
          context: request.context,
          startTime,
          endTime: new Date(),
          success: false,
          error: errorResponse.error?.message,
          metadata: {
            executionTime: Date.now() - startTime.getTime()
          }
        });
      }

      return errorResponse;
    }
  }

  /**
   * Get execution logs
   */
  getExecutionLogs(limit?: number): AIFunctionExecutionLog[] {
    const logs = [...this.executionLogs].reverse();
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * Clear execution logs
   */
  clearLogs(): void {
    this.executionLogs = [];
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const totalExecutions = this.executionLogs.length;
    const successfulExecutions = this.executionLogs.filter(log => log.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    
    const functionUsage = this.executionLogs.reduce((acc, log) => {
      acc[log.functionName] = (acc[log.functionName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      registeredFunctions: this.functions.size,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      cacheSize: this.cache.size,
      functionUsage
    };
  }

  private validateSchema(schema: AIFunctionSchema): void {
    if (!schema.name || !schema.description) {
      throw new Error('Function schema must have name and description');
    }

    if (!schema.parameters || !Array.isArray(schema.parameters)) {
      throw new Error('Function schema must have parameters array');
    }

    for (const param of schema.parameters) {
      if (!param.name || !param.type || !param.description) {
        throw new Error('Each parameter must have name, type, and description');
      }
    }
  }

  private async executeWithTimeout(
    func: AIFunction, 
    request: AIFunctionRequest
  ): Promise<AIFunctionResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Function execution timed out after ${this.config.defaultTimeout}ms`));
      }, this.config.defaultTimeout);

      func.execute(request)
        .then(response => {
          clearTimeout(timeout);
          resolve(response);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private generateCacheKey(request: AIFunctionRequest): string {
    return `${request.functionName}:${JSON.stringify(request.parameters)}`;
  }

  private isCacheValid(timestamp: Date): boolean {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    return Date.now() - timestamp.getTime() < maxAge;
  }

  private cleanupCache(): void {
    if (this.cache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      
      const toRemove = entries.slice(0, entries.length - this.config.maxCacheSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  private logExecution(log: AIFunctionExecutionLog): void {
    this.executionLogs.push(log);
    
    // Keep only last 1000 logs
    if (this.executionLogs.length > 1000) {
      this.executionLogs = this.executionLogs.slice(-1000);
    }
  }

  private generateLogId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const aiRegistry = new AIFunctionRegistry();