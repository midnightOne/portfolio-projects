/**
 * API Route: Semantic System Diagnostics
 * GET /api/admin/semantic/diagnostics - Get diagnostic status and available tests
 * POST /api/admin/semantic/diagnostics - Run diagnostic tests
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-utils';
import { getDiagnosticTestSuite, TEST_SUITES, TestSuiteResult } from '@/lib/content/DiagnosticTestSuite';
import { DiagnosticConfig } from '@/lib/content/SemanticDiagnosticService';
import { getSemanticLogger } from '@/lib/content/SemanticLogger';

const logger = getSemanticLogger();

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const diagnosticSuite = getDiagnosticTestSuite();
    const availableTestSuites = diagnosticSuite.getAvailableTestSuites();

    // Get recent diagnostic results from logger if available
    const recentLogs = logger.getRecentLogs(50, 'info', 'DiagnosticTestSuite');
    const logStats = logger.getLogStats();

    return NextResponse.json({
      availableTestSuites,
      recentActivity: {
        recentDiagnostics: recentLogs.slice(-5).map(log => ({
          timestamp: log.timestamp,
          operation: log.operation,
          message: log.message,
          context: log.context
        })),
        systemStats: {
          totalLogEntries: logStats.totalEntries,
          recentErrors: logStats.recentErrors.length,
          averageOperationTime: logStats.performanceMetrics.averageDuration
        }
      },
      systemStatus: {
        healthy: logStats.recentErrors.length === 0,
        lastDiagnostic: recentLogs.length > 0 ? recentLogs[recentLogs.length - 1].timestamp : null
      }
    });

  } catch (error) {
    logger.error('DiagnosticAPI', 'GET', 'Failed to get diagnostic status', {
      error: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { 
        error: 'Failed to get diagnostic status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      testSuite, 
      customConfig, 
      projectId, 
      verbose = false,
      quickCheck = false 
    } = body;

    const diagnosticSuite = getDiagnosticTestSuite();

    logger.info('DiagnosticAPI', 'POST', 'Starting diagnostic test', {
      testSuite,
      projectId,
      verbose,
      quickCheck,
      hasCustomConfig: !!customConfig
    });

    let result: TestSuiteResult | any;

    if (quickCheck) {
      // Run quick health check
      const quickResult = await diagnosticSuite.quickHealthCheck(projectId);
      
      return NextResponse.json({
        type: 'quickCheck',
        result: quickResult,
        timestamp: new Date().toISOString()
      });

    } else if (testSuite && TEST_SUITES[testSuite as keyof typeof TEST_SUITES]) {
      // Run predefined test suite
      result = await diagnosticSuite.runTestSuite(
        testSuite as keyof typeof TEST_SUITES,
        projectId,
        verbose
      );

      logger.info('DiagnosticAPI', 'POST', 'Test suite completed', {
        testSuite,
        success: result.success,
        executionTime: result.executionTime,
        overallHealth: result.summary.overallHealth
      });

      return NextResponse.json({
        type: 'testSuite',
        suiteName: testSuite,
        result,
        formattedReport: diagnosticSuite.generateFormattedReport(result),
        timestamp: new Date().toISOString()
      });

    } else if (customConfig) {
      // Run custom diagnostic configuration
      const config: DiagnosticConfig = {
        tests: customConfig.tests || ['system_health'],
        projectId: customConfig.projectId || projectId,
        includePerformanceBenchmarks: customConfig.includePerformanceBenchmarks || false,
        includeSystemHealth: customConfig.includeSystemHealth || true,
        verbose: customConfig.verbose || verbose,
        timeoutMs: customConfig.timeoutMs || 60000
      };

      const report = await diagnosticSuite.runCustomDiagnostic(config);

      logger.info('DiagnosticAPI', 'POST', 'Custom diagnostic completed', {
        testsCount: config.tests.length,
        duration: report.duration,
        overallStatus: report.summary.overallStatus
      });

      return NextResponse.json({
        type: 'customDiagnostic',
        config,
        report,
        timestamp: new Date().toISOString()
      });

    } else {
      return NextResponse.json(
        { 
          error: 'Invalid request. Specify testSuite, customConfig, or set quickCheck=true',
          availableTestSuites: Object.keys(TEST_SUITES)
        },
        { status: 400 }
      );
    }

  } catch (error) {
    logger.error('DiagnosticAPI', 'POST', 'Diagnostic test failed', {
      error: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { 
        error: 'Diagnostic test failed',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/semantic/diagnostics - Update diagnostic configuration
 */
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { logLevel, enableDebugMode, components } = body;

    const semanticLogger = getSemanticLogger();

    if (enableDebugMode !== undefined) {
      if (enableDebugMode) {
        semanticLogger.enableDebugMode(components);
        logger.info('DiagnosticAPI', 'PUT', 'Debug mode enabled', { components });
      } else {
        semanticLogger.disableDebugMode();
        logger.info('DiagnosticAPI', 'PUT', 'Debug mode disabled');
      }
    }

    if (logLevel) {
      semanticLogger.updateConfig({ level: logLevel });
      logger.info('DiagnosticAPI', 'PUT', 'Log level updated', { logLevel });
    }

    return NextResponse.json({
      message: 'Diagnostic configuration updated',
      config: {
        debugModeEnabled: enableDebugMode,
        logLevel,
        components
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('DiagnosticAPI', 'PUT', 'Failed to update diagnostic configuration', {
      error: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { 
        error: 'Failed to update diagnostic configuration',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}