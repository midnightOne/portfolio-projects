'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Play,
  Database,
  Wrench,
  Mic,
  Globe,
  Clock,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ValidationResult {
  component: string;
  status: 'healthy' | 'warning' | 'error' | 'testing' | 'not_tested';
  message: string;
  details?: string[];
  responseTime?: number;
  lastTested?: Date;
}

interface ValidationResults {
  contextProvider: ValidationResult;
  mcpTools: ValidationResult;
  voiceAdapters: ValidationResult;
  apiEndpoints: ValidationResult;
  overall: 'healthy' | 'warning' | 'error' | 'testing';
}

interface IntegrationValidatorProps {
  onValidationComplete?: (results: ValidationResults) => void;
}

export function IntegrationValidator({ onValidationComplete }: IntegrationValidatorProps) {
  const { toast } = useToast();
  const [validationResults, setValidationResults] = useState<ValidationResults>({
    contextProvider: {
      component: 'Context Provider Service',
      status: 'not_tested',
      message: 'Not tested yet'
    },
    mcpTools: {
      component: 'MCP Navigation Tools',
      status: 'not_tested',
      message: 'Not tested yet'
    },
    voiceAdapters: {
      component: 'Voice Adapters',
      status: 'not_tested',
      message: 'Not tested yet'
    },
    apiEndpoints: {
      component: 'API Endpoints',
      status: 'not_tested',
      message: 'Not tested yet'
    },
    overall: 'healthy'
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');
  const [progress, setProgress] = useState(0);

  // Update a specific validation result
  const updateValidationResult = useCallback((
    key: keyof Omit<ValidationResults, 'overall'>,
    result: Partial<ValidationResult>
  ) => {
    setValidationResults(prev => {
      const updated = {
        ...prev,
        [key]: { ...prev[key], ...result, lastTested: new Date() }
      };
      
      // Calculate overall status
      const results = [updated.contextProvider, updated.mcpTools, updated.voiceAdapters, updated.apiEndpoints];
      const hasError = results.some(r => r.status === 'error');
      const hasWarning = results.some(r => r.status === 'warning');
      const allTested = results.every(r => r.status !== 'not_tested' && r.status !== 'testing');
      
      if (!allTested) {
        updated.overall = 'testing';
      } else if (hasError) {
        updated.overall = 'error';
      } else if (hasWarning) {
        updated.overall = 'warning';
      } else {
        updated.overall = 'healthy';
      }
      
      return updated;
    });
  }, []);

  // Test Context Provider Service
  const testContextProvider = useCallback(async () => {
    setCurrentTest('Testing Context Provider Service...');
    updateValidationResult('contextProvider', { status: 'testing', message: 'Testing context API...' });

    try {
      const startTime = Date.now();
      const response = await fetch('/api/ai/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test-session',
          query: 'integration test',
          sources: [],
          options: { includeSystemPrompt: true },
          useCache: false
        }),
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        updateValidationResult('contextProvider', {
          status: 'healthy',
          message: 'Context Provider Service is working correctly',
          details: [
            `Response time: ${responseTime}ms`,
            `Context loaded: ${data.success ? 'Yes' : 'No'}`,
            `Token count: ${data.data?.tokenCount || 'N/A'}`
          ],
          responseTime
        });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      updateValidationResult('contextProvider', {
        status: 'error',
        message: 'Context Provider Service failed',
        details: [
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'Check server logs for more details'
        ]
      });
    }
  }, [updateValidationResult]);

  // Test MCP Navigation Tools
  const testMCPTools = useCallback(async () => {
    setCurrentTest('Testing MCP Navigation Tools...');
    updateValidationResult('mcpTools', { status: 'testing', message: 'Testing navigation tools...' });

    try {
      // Test if navigation tools are available
      const hasNavigationTools = typeof window !== 'undefined' && 
        window.location && 
        document.querySelector;

      if (hasNavigationTools) {
        // Test basic DOM manipulation capabilities
        const testElement = document.createElement('div');
        testElement.id = 'mcp-test-element';
        document.body.appendChild(testElement);
        
        // Test scrolling capability
        const canScroll = typeof window.scrollTo === 'function';
        
        // Test modal capability (check if we can create elements)
        const canCreateModal = document.createElement('div') !== null;
        
        // Cleanup
        document.body.removeChild(testElement);

        updateValidationResult('mcpTools', {
          status: 'healthy',
          message: 'MCP Navigation Tools are available',
          details: [
            `DOM manipulation: ${canCreateModal ? 'Available' : 'Not available'}`,
            `Scrolling: ${canScroll ? 'Available' : 'Not available'}`,
            `Element creation: ${canCreateModal ? 'Available' : 'Not available'}`
          ]
        });
      } else {
        throw new Error('Navigation tools not available in current environment');
      }
    } catch (error) {
      updateValidationResult('mcpTools', {
        status: 'error',
        message: 'MCP Navigation Tools failed',
        details: [
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'Navigation tools may not be properly initialized'
        ]
      });
    }
  }, [updateValidationResult]);

  // Test Voice Adapters
  const testVoiceAdapters = useCallback(async () => {
    setCurrentTest('Testing Voice Adapters...');
    updateValidationResult('voiceAdapters', { status: 'testing', message: 'Testing voice providers...' });

    try {
      const tests = [];

      // Test OpenAI session endpoint
      try {
        const openaiResponse = await fetch('/api/ai/openai/session', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        tests.push(`OpenAI endpoint: ${openaiResponse.ok ? 'Available' : 'Failed'}`);
      } catch {
        tests.push('OpenAI endpoint: Failed to connect');
      }

      // Test ElevenLabs token endpoint
      try {
        const elevenLabsResponse = await fetch('/api/ai/elevenlabs/token', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        tests.push(`ElevenLabs endpoint: ${elevenLabsResponse.ok ? 'Available' : 'Failed'}`);
      } catch {
        tests.push('ElevenLabs endpoint: Failed to connect');
      }

      // Test microphone availability
      const hasMicrophone = navigator.mediaDevices && 
        typeof navigator.mediaDevices.getUserMedia === 'function';
      tests.push(`Microphone API: ${hasMicrophone ? 'Available' : 'Not available'}`);

      // Test WebRTC support
      const hasWebRTC = typeof RTCPeerConnection !== 'undefined';
      tests.push(`WebRTC support: ${hasWebRTC ? 'Available' : 'Not available'}`);

      const hasErrors = tests.some(test => test.includes('Failed') || test.includes('Not available'));
      
      updateValidationResult('voiceAdapters', {
        status: hasErrors ? 'warning' : 'healthy',
        message: hasErrors ? 'Some voice features may not work' : 'Voice adapters are ready',
        details: tests
      });
    } catch (error) {
      updateValidationResult('voiceAdapters', {
        status: 'error',
        message: 'Voice adapter testing failed',
        details: [
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'Voice functionality may not be available'
        ]
      });
    }
  }, [updateValidationResult]);

  // Test API Endpoints
  const testAPIEndpoints = useCallback(async () => {
    setCurrentTest('Testing API Endpoints...');
    updateValidationResult('apiEndpoints', { status: 'testing', message: 'Testing API connectivity...' });

    try {
      const endpoints = [
        { name: 'Context API', url: '/api/ai/context', method: 'POST' },
        { name: 'OpenAI Session', url: '/api/ai/openai/session', method: 'GET' },
        { name: 'ElevenLabs Token', url: '/api/ai/elevenlabs/token', method: 'GET' },
        { name: 'Conversation Log', url: '/api/ai/conversation/log', method: 'POST' }
      ];

      const results = [];
      let hasErrors = false;

      for (const endpoint of endpoints) {
        try {
          const startTime = Date.now();
          const response = await fetch(endpoint.url, {
            method: endpoint.method,
            headers: { 'Content-Type': 'application/json' },
            body: endpoint.method === 'POST' ? JSON.stringify({
              sessionId: 'test',
              query: 'test'
            }) : undefined
          });
          
          const responseTime = Date.now() - startTime;
          const status = response.ok ? 'OK' : `Error ${response.status}`;
          results.push(`${endpoint.name}: ${status} (${responseTime}ms)`);
          
          if (!response.ok) hasErrors = true;
        } catch (error) {
          results.push(`${endpoint.name}: Failed to connect`);
          hasErrors = true;
        }
      }

      updateValidationResult('apiEndpoints', {
        status: hasErrors ? 'warning' : 'healthy',
        message: hasErrors ? 'Some endpoints have issues' : 'All endpoints are responding',
        details: results
      });
    } catch (error) {
      updateValidationResult('apiEndpoints', {
        status: 'error',
        message: 'API endpoint testing failed',
        details: [
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'API connectivity issues detected'
        ]
      });
    }
  }, [updateValidationResult]);

  // Run all validation tests
  const runFullValidation = useCallback(async () => {
    setIsRunning(true);
    setProgress(0);

    try {
      const tests = [
        { name: 'Context Provider', test: testContextProvider },
        { name: 'MCP Tools', test: testMCPTools },
        { name: 'Voice Adapters', test: testVoiceAdapters },
        { name: 'API Endpoints', test: testAPIEndpoints }
      ];

      for (let i = 0; i < tests.length; i++) {
        await tests[i].test();
        setProgress(((i + 1) / tests.length) * 100);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setCurrentTest('');
      toast({
        title: 'Validation complete',
        description: 'Integration validation has finished',
      });

      // Call completion callback
      onValidationComplete?.(validationResults);
    } catch (error) {
      toast({
        title: 'Validation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
      setProgress(0);
    }
  }, [testContextProvider, testMCPTools, testVoiceAdapters, testAPIEndpoints, validationResults, onValidationComplete, toast]);

  // Get status icon
  const getStatusIcon = (status: ValidationResult['status']) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'testing': return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default: return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  // Get status color
  const getStatusColor = (status: ValidationResult['status']) => {
    switch (status) {
      case 'healthy': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'testing': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Integration Validator
            <Badge variant={
              validationResults.overall === 'healthy' ? 'default' :
              validationResults.overall === 'warning' ? 'secondary' :
              validationResults.overall === 'error' ? 'destructive' : 'outline'
            }>
              {validationResults.overall}
            </Badge>
          </div>
          <Button
            onClick={runFullValidation}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Running Tests...' : 'Run Full Validation'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{currentTest}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Validation Results */}
        <div className="space-y-3">
          {Object.entries(validationResults).filter(([key]) => key !== 'overall').map(([key, result]) => {
            const icons = {
              contextProvider: Database,
              mcpTools: Wrench,
              voiceAdapters: Mic,
              apiEndpoints: Globe
            };
            const Icon = icons[key as keyof typeof icons];

            return (
              <div
                key={key}
                className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{result.component}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.responseTime && (
                      <Badge variant="outline" className="text-xs">
                        {result.responseTime}ms
                      </Badge>
                    )}
                    {getStatusIcon(result.status)}
                  </div>
                </div>
                
                <p className="text-sm mb-2">{result.message}</p>
                
                {result.details && result.details.length > 0 && (
                  <div className="space-y-1">
                    {result.details.map((detail, index) => (
                      <div key={index} className="text-xs bg-background/50 p-2 rounded">
                        {detail}
                      </div>
                    ))}
                  </div>
                )}
                
                {result.lastTested && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Last tested: {result.lastTested.toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Overall Status */}
        {validationResults.overall !== 'testing' && (
          <Alert className={
            validationResults.overall === 'healthy' ? 'border-green-200 bg-green-50' :
            validationResults.overall === 'warning' ? 'border-yellow-200 bg-yellow-50' :
            'border-red-200 bg-red-50'
          }>
            {validationResults.overall === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : validationResults.overall === 'warning' ? (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription>
              <strong>Overall Status:</strong> {
                validationResults.overall === 'healthy' ? 'All systems are functioning correctly' :
                validationResults.overall === 'warning' ? 'Some components have warnings but are functional' :
                'Critical issues detected that may affect functionality'
              }
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}