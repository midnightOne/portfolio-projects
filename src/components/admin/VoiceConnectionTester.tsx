'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertCircle, 
  Wifi, 
  Mic, 
  Volume2,
  Activity,
  Clock,
  Zap
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { connectionDiagnostics } from '@/lib/voice/connectionDiagnostics';

interface ConnectionTest {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  result?: any;
  error?: string;
  duration?: number;
}

interface ProviderTestResults {
  provider: 'openai' | 'elevenlabs';
  tests: ConnectionTest[];
  overallStatus: 'pending' | 'running' | 'passed' | 'failed';
  startTime?: Date;
  endTime?: Date;
}

export function VoiceConnectionTester() {
  const toast = useToast();
  const [testResults, setTestResults] = useState<{
    openai: ProviderTestResults;
    elevenlabs: ProviderTestResults;
  }>({
    openai: {
      provider: 'openai',
      overallStatus: 'pending',
      tests: [
        {
          id: 'token-generation',
          name: 'Token Generation',
          description: 'Test ephemeral token generation from server',
          status: 'pending'
        },
        {
          id: 'webrtc-support',
          name: 'WebRTC Support',
          description: 'Check browser WebRTC capabilities',
          status: 'pending'
        },
        {
          id: 'microphone-access',
          name: 'Microphone Access',
          description: 'Test microphone permissions and audio capture',
          status: 'pending'
        },
        {
          id: 'api-connectivity',
          name: 'API Connectivity',
          description: 'Test connection to OpenAI Realtime API',
          status: 'pending'
        },
        {
          id: 'audio-streaming',
          name: 'Audio Streaming',
          description: 'Test real-time audio streaming capabilities',
          status: 'pending'
        }
      ]
    },
    elevenlabs: {
      provider: 'elevenlabs',
      overallStatus: 'pending',
      tests: [
        {
          id: 'token-generation',
          name: 'Token Generation',
          description: 'Test conversation token generation from server',
          status: 'pending'
        },
        {
          id: 'websocket-support',
          name: 'WebSocket Support',
          description: 'Check browser WebSocket capabilities',
          status: 'pending'
        },
        {
          id: 'microphone-access',
          name: 'Microphone Access',
          description: 'Test microphone permissions and audio capture',
          status: 'pending'
        },
        {
          id: 'api-connectivity',
          name: 'API Connectivity',
          description: 'Test connection to ElevenLabs Conversational AI',
          status: 'pending'
        },
        {
          id: 'conversation-interface',
          name: 'Conversation Interface',
          description: 'Test signed URL conversation interface',
          status: 'pending'
        }
      ]
    }
  });

  const [isRunningTests, setIsRunningTests] = useState(false);
  const [currentTest, setCurrentTest] = useState<string | null>(null);
  const [testProgress, setTestProgress] = useState(0);

  const runProviderTests = async (provider: 'openai' | 'elevenlabs') => {
    setIsRunningTests(true);
    setTestProgress(0);
    
    const startTime = new Date();
    
    // Update provider status to running
    setTestResults(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        overallStatus: 'running',
        startTime
      }
    }));

    const tests = testResults[provider].tests;
    let passedTests = 0;
    let failedTests = 0;

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      setCurrentTest(test.name);
      
      // Update test status to running
      setTestResults(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          tests: prev[provider].tests.map(t => 
            t.id === test.id ? { ...t, status: 'running' } : t
          )
        }
      }));

      const testStartTime = Date.now();
      
      try {
        let result;

        // Run the actual test based on test ID and provider
        switch (test.id) {
          case 'token-generation':
            result = await connectionDiagnostics.testTokenGeneration(provider);
            break;
          case 'webrtc-support':
            result = await connectionDiagnostics.testWebRTCSupport();
            break;
          case 'websocket-support':
            result = await connectionDiagnostics.testWebSocketSupport();
            break;
          case 'microphone-access':
            result = await connectionDiagnostics.testMicrophoneAccess();
            break;
          case 'api-connectivity':
            result = await connectionDiagnostics.testAPIConnectivity(provider);
            break;
          case 'audio-streaming':
            result = await connectionDiagnostics.testAudioStreaming(provider);
            break;
          case 'conversation-interface':
            result = await connectionDiagnostics.testConversationInterface();
            break;
          default:
            throw new Error(`Unknown test: ${test.id}`);
        }

        const duration = Date.now() - testStartTime;
        
        // Update test status to passed
        setTestResults(prev => ({
          ...prev,
          [provider]: {
            ...prev[provider],
            tests: prev[provider].tests.map(t => 
              t.id === test.id ? { 
                ...t, 
                status: 'passed', 
                result,
                duration 
              } : t
            )
          }
        }));

        passedTests++;
        
      } catch (error) {
        const duration = Date.now() - testStartTime;
        
        // Update test status to failed
        setTestResults(prev => ({
          ...prev,
          [provider]: {
            ...prev[provider],
            tests: prev[provider].tests.map(t => 
              t.id === test.id ? { 
                ...t, 
                status: 'failed', 
                error: error instanceof Error ? error.message : String(error),
                duration 
              } : t
            )
          }
        }));

        failedTests++;
      }

      // Update progress
      setTestProgress(((i + 1) / tests.length) * 100);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const endTime = new Date();
    const overallStatus = failedTests === 0 ? 'passed' : 'failed';
    
    // Update provider overall status
    setTestResults(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        overallStatus,
        endTime
      }
    }));

    setCurrentTest(null);
    setIsRunningTests(false);
    setTestProgress(100);

    // Show toast notification
    if (overallStatus === 'passed') {
      toast.success('Tests completed', `All ${provider} tests passed successfully`);
    } else {
      toast.error('Tests completed', `${failedTests} out of ${tests.length} tests failed for ${provider}`);
    }
  };

  const runAllTests = async () => {
    await runProviderTests('openai');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await runProviderTests('elevenlabs');
  };

  const resetTests = () => {
    setTestResults(prev => ({
      openai: {
        ...prev.openai,
        overallStatus: 'pending',
        startTime: undefined,
        endTime: undefined,
        tests: prev.openai.tests.map(test => ({
          ...test,
          status: 'pending',
          result: undefined,
          error: undefined,
          duration: undefined
        }))
      },
      elevenlabs: {
        ...prev.elevenlabs,
        overallStatus: 'pending',
        startTime: undefined,
        endTime: undefined,
        tests: prev.elevenlabs.tests.map(test => ({
          ...test,
          status: 'pending',
          result: undefined,
          error: undefined,
          duration: undefined
        }))
      }
    }));
    setTestProgress(0);
    setCurrentTest(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed': return <Badge className="bg-green-100 text-green-800">Passed</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      case 'running': return <Badge className="bg-blue-100 text-blue-800">Running</Badge>;
      default: return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    return `${duration}ms`;
  };

  const getTestIcon = (testId: string) => {
    switch (testId) {
      case 'token-generation': return <Zap className="h-4 w-4" />;
      case 'webrtc-support':
      case 'websocket-support': return <Wifi className="h-4 w-4" />;
      case 'microphone-access': return <Mic className="h-4 w-4" />;
      case 'api-connectivity': return <Activity className="h-4 w-4" />;
      case 'audio-streaming':
      case 'conversation-interface': return <Volume2 className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Voice Provider Connection Testing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Button
              onClick={runAllTests}
              disabled={isRunningTests}
              className="flex items-center gap-2"
            >
              {isRunningTests ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Run All Tests
                </>
              )}
            </Button>
            
            <Button
              onClick={() => runProviderTests('openai')}
              disabled={isRunningTests}
              variant="outline"
            >
              Test OpenAI Only
            </Button>
            
            <Button
              onClick={() => runProviderTests('elevenlabs')}
              disabled={isRunningTests}
              variant="outline"
            >
              Test ElevenLabs Only
            </Button>
            
            <Button
              onClick={resetTests}
              disabled={isRunningTests}
              variant="ghost"
            >
              Reset
            </Button>
          </div>

          {isRunningTests && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress: {Math.round(testProgress)}%</span>
                {currentTest && <span>Running: {currentTest}</span>}
              </div>
              <Progress value={testProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OpenAI Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                OpenAI Realtime Tests
              </div>
              {getStatusBadge(testResults.openai.overallStatus)}
            </CardTitle>
            {testResults.openai.startTime && (
              <div className="text-sm text-muted-foreground">
                Started: {testResults.openai.startTime.toLocaleTimeString()}
                {testResults.openai.endTime && (
                  <span className="ml-4">
                    Duration: {Math.round((testResults.openai.endTime.getTime() - testResults.openai.startTime.getTime()) / 1000)}s
                  </span>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.openai.tests.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getTestIcon(test.id)}
                    <div>
                      <div className="font-medium text-sm">{test.name}</div>
                      <div className="text-xs text-muted-foreground">{test.description}</div>
                      {test.error && (
                        <div className="text-xs text-red-600 mt-1">{test.error}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {test.duration && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(test.duration)}
                      </span>
                    )}
                    {getStatusIcon(test.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ElevenLabs Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                ElevenLabs Tests
              </div>
              {getStatusBadge(testResults.elevenlabs.overallStatus)}
            </CardTitle>
            {testResults.elevenlabs.startTime && (
              <div className="text-sm text-muted-foreground">
                Started: {testResults.elevenlabs.startTime.toLocaleTimeString()}
                {testResults.elevenlabs.endTime && (
                  <span className="ml-4">
                    Duration: {Math.round((testResults.elevenlabs.endTime.getTime() - testResults.elevenlabs.startTime.getTime()) / 1000)}s
                  </span>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {testResults.elevenlabs.tests.map((test) => (
                <div key={test.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getTestIcon(test.id)}
                    <div>
                      <div className="font-medium text-sm">{test.name}</div>
                      <div className="text-xs text-muted-foreground">{test.description}</div>
                      {test.error && (
                        <div className="text-xs text-red-600 mt-1">{test.error}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {test.duration && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(test.duration)}
                      </span>
                    )}
                    {getStatusIcon(test.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium mb-1">Browser</div>
              <div className="text-muted-foreground">{navigator.userAgent.split(' ').slice(-1)[0]}</div>
            </div>
            <div>
              <div className="font-medium mb-1">WebRTC Support</div>
              <div className="text-muted-foreground">
                {typeof RTCPeerConnection !== 'undefined' ? 'Available' : 'Not Available'}
              </div>
            </div>
            <div>
              <div className="font-medium mb-1">WebSocket Support</div>
              <div className="text-muted-foreground">
                {typeof WebSocket !== 'undefined' ? 'Available' : 'Not Available'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}