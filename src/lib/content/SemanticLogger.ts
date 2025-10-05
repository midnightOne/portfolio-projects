/**
 * Semantic System Enhanced Logger
 * 
 * Provides detailed logging capabilities for all semantic system components
 * with structured logging, performance tracking, and error context collection.
 * 
 * Features:
 * - Structured logging with context
 * - Performance timing and metrics
 * - Error context collection
 * - Component-specific log levels
 * - Log aggregation and analysis
 * - Debug mode with verbose output
 */

import { EventEmitter } from 'events';

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

// Log entry interface
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  operation: string;
  message: string;
  context: Record<string, any>;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  performance?: {
    memoryUsage: NodeJS.MemoryUsage;
    timing: Record<string, number>;
  };
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enablePerformanceTracking: boolean;
  maxLogEntries: number;
  components: {
    [component: string]: {
      level: LogLevel;
      enabled: boolean;
    };
  };
}

// Performance timer interface
interface PerformanceTimer {
  startTime: number;
  marks: Record<string, number>;
}

/**
 * Enhanced Semantic Logger
 */
export class SemanticLogger extends EventEmitter {
  private config: LoggerConfig;
  private logEntries: LogEntry[] = [];
  private performanceTimers = new Map<string, PerformanceTimer>();

  constructor(config: Partial<LoggerConfig> = {}) {
    super();
    
    this.config = {
      level: 'info',
      enableConsole: true,
      enableFile: false,
      enablePerformanceTracking: true,
      maxLogEntries: 10000,
      components: {
        'SmartContentGenerator': { level: 'info', enabled: true },
        'StageBasedProcessingService': { level: 'info', enabled: true },
        'VectorOperations': { level: 'info', enabled: true },
        'SemanticHealthMonitor': { level: 'info', enabled: true },
        'SemanticDiagnosticService': { level: 'debug', enabled: true },
        'T3Generation': { level: 'debug', enabled: true },
        'SSEConnection': { level: 'debug', enabled: true },
        'ChunkPersistence': { level: 'debug', enabled: true },
        'QueueDisplay': { level: 'debug', enabled: true }
      },
      ...config
    };
  }

  /**
   * Log debug message
   */
  debug(component: string, operation: string, message: string, context: Record<string, any> = {}): void {
    this.log('debug', component, operation, message, context);
  }

  /**
   * Log info message
   */
  info(component: string, operation: string, message: string, context: Record<string, any> = {}): void {
    this.log('info', component, operation, message, context);
  }

  /**
   * Log warning message
   */
  warn(component: string, operation: string, message: string, context: Record<string, any> = {}): void {
    this.log('warn', component, operation, message, context);
  }

  /**
   * Log error message
   */
  error(component: string, operation: string, message: string, context: Record<string, any> = {}, error?: Error): void {
    const errorContext = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : undefined;

    this.log('error', component, operation, message, context, undefined, errorContext);
  }

  /**
   * Log critical message
   */
  critical(component: string, operation: string, message: string, context: Record<string, any> = {}, error?: Error): void {
    const errorContext = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : undefined;

    this.log('critical', component, operation, message, context, undefined, errorContext);
  }

  /**
   * Start performance timer
   */
  startTimer(timerId: string): void {
    if (!this.config.enablePerformanceTracking) return;

    this.performanceTimers.set(timerId, {
      startTime: Date.now(),
      marks: {}
    });
  }

  /**
   * Add performance mark
   */
  mark(timerId: string, markName: string): void {
    if (!this.config.enablePerformanceTracking) return;

    const timer = this.performanceTimers.get(timerId);
    if (timer) {
      timer.marks[markName] = Date.now() - timer.startTime;
    }
  }

  /**
   * End performance timer and log result
   */
  endTimer(
    timerId: string, 
    component: string, 
    operation: string, 
    message: string, 
    context: Record<string, any> = {}
  ): number {
    if (!this.config.enablePerformanceTracking) return 0;

    const timer = this.performanceTimers.get(timerId);
    if (!timer) return 0;

    const duration = Date.now() - timer.startTime;
    this.performanceTimers.delete(timerId);

    const performance = {
      memoryUsage: process.memoryUsage(),
      timing: {
        total: duration,
        ...timer.marks
      }
    };

    this.log('info', component, operation, message, context, duration, undefined, performance);
    return duration;
  }

  /**
   * Log T3 generation diagnostics
   */
  logT3Generation(
    projectId: string,
    sectionAnalysis: any,
    generationResult: any,
    validationResult: any
  ): void {
    this.info('T3Generation', 'generate', 'T3 chunk generation completed', {
      projectId,
      sectionsAnalyzed: sectionAnalysis.totalSections,
      contentSections: sectionAnalysis.contentSections,
      chunksGenerated: generationResult.tiers.filter((t: any) => t.tier === 3).length,
      validationErrors: validationResult.validationErrors.length,
      processingTime: generationResult.processingStats.processingTime
    });

    // Log detailed section analysis if debug enabled
    if (this.shouldLog('debug', 'T3Generation')) {
      this.debug('T3Generation', 'sectionAnalysis', 'Section filtering analysis', {
        projectId,
        sectionAnalysis,
        filteredOutReasons: sectionAnalysis.filteredOutReasons
      });
    }

    // Log validation errors if any
    if (validationResult.validationErrors.length > 0) {
      this.warn('T3Generation', 'validation', 'T3 chunk validation issues found', {
        projectId,
        validationErrors: validationResult.validationErrors,
        invalidChunks: validationResult.invalidChunks
      });
    }
  }

  /**
   * Log SSE connection events
   */
  logSSEConnection(operationId: string, event: string, details: Record<string, any> = {}): void {
    this.info('SSEConnection', event, `SSE ${event} for operation ${operationId}`, {
      operationId,
      ...details
    });
  }

  /**
   * Log SSE connection errors
   */
  logSSEError(operationId: string, error: Error, context: Record<string, any> = {}): void {
    this.error('SSEConnection', 'error', `SSE connection error for operation ${operationId}`, {
      operationId,
      ...context
    }, error);
  }

  /**
   * Log chunk persistence events
   */
  logChunkPersistence(
    chunkId: string,
    event: 'created' | 'updated' | 'deleted' | 'failed',
    details: Record<string, any> = {}
  ): void {
    const level = event === 'failed' ? 'error' : 'info';
    this.log(level, 'ChunkPersistence', event, `Chunk ${chunkId} ${event}`, {
      chunkId,
      ...details
    });
  }

  /**
   * Log foreign key constraint issues
   */
  logForeignKeyIssue(
    operation: string,
    constraint: string,
    details: Record<string, any>,
    error?: Error
  ): void {
    this.error('ChunkPersistence', 'foreignKeyViolation', 
      `Foreign key constraint violation: ${constraint}`, {
        operation,
        constraint,
        ...details
      }, error);
  }

  /**
   * Log queue display events
   */
  logQueueDisplay(event: string, details: Record<string, any> = {}): void {
    this.info('QueueDisplay', event, `Queue display ${event}`, details);
  }

  /**
   * Log operation lifecycle events
   */
  logOperationLifecycle(
    operationId: string,
    stage: string,
    event: string,
    details: Record<string, any> = {}
  ): void {
    this.info('StageBasedProcessingService', 'lifecycle', 
      `Operation ${operationId} ${stage} ${event}`, {
        operationId,
        stage,
        event,
        ...details
      });
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    component: string,
    operation: string,
    message: string,
    context: Record<string, any> = {},
    duration?: number,
    error?: { name: string; message: string; stack?: string },
    performance?: { memoryUsage: NodeJS.MemoryUsage; timing: Record<string, number> }
  ): void {
    // Check if logging is enabled for this component and level
    if (!this.shouldLog(level, component)) return;

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      component,
      operation,
      message,
      context,
      duration,
      error,
      performance
    };

    // Add to log entries
    this.logEntries.push(logEntry);

    // Trim log entries if exceeding max
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.config.maxLogEntries);
    }

    // Console output
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry);
    }

    // Emit log event
    this.emit('log', logEntry);

    // Emit critical events separately
    if (level === 'critical') {
      this.emit('critical', logEntry);
    }
  }

  /**
   * Check if logging should occur for component and level
   */
  private shouldLog(level: LogLevel, component: string): boolean {
    const componentConfig = this.config.components[component];
    if (!componentConfig || !componentConfig.enabled) return false;

    const levelPriority = this.getLevelPriority(level);
    const configLevelPriority = this.getLevelPriority(componentConfig.level);
    const globalLevelPriority = this.getLevelPriority(this.config.level);

    return levelPriority >= Math.max(configLevelPriority, globalLevelPriority);
  }

  /**
   * Get numeric priority for log level
   */
  private getLevelPriority(level: LogLevel): number {
    const priorities: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      critical: 4
    };
    return priorities[level];
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = entry.level.toUpperCase().padEnd(8);
    const componentStr = entry.component.padEnd(25);
    
    let output = `[${timestamp}] ${levelStr} ${componentStr} ${entry.message}`;

    // Add duration if available
    if (entry.duration !== undefined) {
      output += ` (${entry.duration}ms)`;
    }

    // Add context if not empty
    if (Object.keys(entry.context).length > 0) {
      output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
    }

    // Add performance info if available
    if (entry.performance) {
      output += `\n  Performance: ${JSON.stringify(entry.performance.timing, null, 2)}`;
      output += `\n  Memory: ${this.formatMemoryUsage(entry.performance.memoryUsage)}`;
    }

    // Add error info if available
    if (entry.error) {
      output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack && entry.level === 'debug') {
        output += `\n  Stack: ${entry.error.stack}`;
      }
    }

    // Use appropriate console method based on level
    switch (entry.level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'critical':
        console.error(output);
        break;
    }
  }

  /**
   * Format memory usage for display
   */
  private formatMemoryUsage(memUsage: NodeJS.MemoryUsage): string {
    const formatBytes = (bytes: number) => {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(1)}MB`;
    };

    return `RSS: ${formatBytes(memUsage.rss)}, Heap: ${formatBytes(memUsage.heapUsed)}/${formatBytes(memUsage.heapTotal)}`;
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count: number = 100, level?: LogLevel, component?: string): LogEntry[] {
    let filtered = this.logEntries;

    if (level) {
      const levelPriority = this.getLevelPriority(level);
      filtered = filtered.filter(entry => this.getLevelPriority(entry.level) >= levelPriority);
    }

    if (component) {
      filtered = filtered.filter(entry => entry.component === component);
    }

    return filtered.slice(-count);
  }

  /**
   * Get log statistics
   */
  getLogStats(): {
    totalEntries: number;
    entriesByLevel: Record<LogLevel, number>;
    entriesByComponent: Record<string, number>;
    recentErrors: LogEntry[];
    performanceMetrics: {
      averageDuration: number;
      slowestOperations: Array<{ component: string; operation: string; duration: number }>;
    };
  } {
    const entriesByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      critical: 0
    };

    const entriesByComponent: Record<string, number> = {};
    const durations: number[] = [];
    const slowestOperations: Array<{ component: string; operation: string; duration: number }> = [];

    this.logEntries.forEach(entry => {
      entriesByLevel[entry.level]++;
      entriesByComponent[entry.component] = (entriesByComponent[entry.component] || 0) + 1;

      if (entry.duration !== undefined) {
        durations.push(entry.duration);
        if (entry.duration > 1000) { // Operations slower than 1 second
          slowestOperations.push({
            component: entry.component,
            operation: entry.operation,
            duration: entry.duration
          });
        }
      }
    });

    const recentErrors = this.logEntries
      .filter(entry => entry.level === 'error' || entry.level === 'critical')
      .slice(-10);

    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;

    slowestOperations.sort((a, b) => b.duration - a.duration);

    return {
      totalEntries: this.logEntries.length,
      entriesByLevel,
      entriesByComponent,
      recentErrors,
      performanceMetrics: {
        averageDuration,
        slowestOperations: slowestOperations.slice(0, 10)
      }
    };
  }

  /**
   * Clear log entries
   */
  clearLogs(): void {
    this.logEntries = [];
    this.emit('logsCleared');
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  /**
   * Enable debug mode for specific components
   */
  enableDebugMode(components: string[] = []): void {
    if (components.length === 0) {
      // Enable debug for all components
      Object.keys(this.config.components).forEach(component => {
        this.config.components[component].level = 'debug';
      });
    } else {
      // Enable debug for specific components
      components.forEach(component => {
        if (this.config.components[component]) {
          this.config.components[component].level = 'debug';
        }
      });
    }

    this.emit('debugModeEnabled', components);
  }

  /**
   * Disable debug mode
   */
  disableDebugMode(): void {
    Object.keys(this.config.components).forEach(component => {
      this.config.components[component].level = 'info';
    });

    this.emit('debugModeDisabled');
  }
}

// Export singleton instance
let semanticLogger: SemanticLogger | null = null;

export function getSemanticLogger(): SemanticLogger {
  if (!semanticLogger) {
    semanticLogger = new SemanticLogger({
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      enableConsole: true,
      enablePerformanceTracking: true
    });
  }
  return semanticLogger;
}

// Export convenience functions
export const logger = {
  debug: (component: string, operation: string, message: string, context?: Record<string, any>) => 
    getSemanticLogger().debug(component, operation, message, context),
  
  info: (component: string, operation: string, message: string, context?: Record<string, any>) => 
    getSemanticLogger().info(component, operation, message, context),
  
  warn: (component: string, operation: string, message: string, context?: Record<string, any>) => 
    getSemanticLogger().warn(component, operation, message, context),
  
  error: (component: string, operation: string, message: string, context?: Record<string, any>, error?: Error) => 
    getSemanticLogger().error(component, operation, message, context, error),
  
  critical: (component: string, operation: string, message: string, context?: Record<string, any>, error?: Error) => 
    getSemanticLogger().critical(component, operation, message, context, error),

  startTimer: (timerId: string) => getSemanticLogger().startTimer(timerId),
  mark: (timerId: string, markName: string) => getSemanticLogger().mark(timerId, markName),
  endTimer: (timerId: string, component: string, operation: string, message: string, context?: Record<string, any>) => 
    getSemanticLogger().endTimer(timerId, component, operation, message, context),

  // Specialized logging functions
  t3Generation: (projectId: string, sectionAnalysis: any, generationResult: any, validationResult: any) =>
    getSemanticLogger().logT3Generation(projectId, sectionAnalysis, generationResult, validationResult),

  sseConnection: (operationId: string, event: string, details?: Record<string, any>) =>
    getSemanticLogger().logSSEConnection(operationId, event, details),

  sseError: (operationId: string, error: Error, context?: Record<string, any>) =>
    getSemanticLogger().logSSEError(operationId, error, context),

  chunkPersistence: (chunkId: string, event: 'created' | 'updated' | 'deleted' | 'failed', details?: Record<string, any>) =>
    getSemanticLogger().logChunkPersistence(chunkId, event, details),

  foreignKeyIssue: (operation: string, constraint: string, details: Record<string, any>, error?: Error) =>
    getSemanticLogger().logForeignKeyIssue(operation, constraint, details, error),

  queueDisplay: (event: string, details?: Record<string, any>) =>
    getSemanticLogger().logQueueDisplay(event, details),

  operationLifecycle: (operationId: string, stage: string, event: string, details?: Record<string, any>) =>
    getSemanticLogger().logOperationLifecycle(operationId, stage, event, details)
};