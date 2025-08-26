'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AnimationDevTools,
  type AnimationPreviewOptions,
  type AnimationPerformanceMetrics,
  type AnimationTestResult,
  type AnimationDebugSession,
} from '@/lib/ui/animation-dev-tools';
import { getAvailableAnimations } from '@/lib/ui/custom-animations';

export default function TestAnimationDevToolsPage() {
  const [selectedAnimation, setSelectedAnimation] = useState('ipad-grid-select');
  const [previewOptions, setPreviewOptions] = useState<Partial<AnimationPreviewOptions>>({
    loop: false,
    speed: 1,
    showBounds: true,
    showTimeline: true,
  });
  const [performanceMetrics, setPerformanceMetrics] = useState<AnimationPerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [testResults, setTestResults] = useState<AnimationTestResult[]>([]);
  const [debugSessions, setDebugSessions] = useState<AnimationDebugSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [systemInfo, setSystemInfo] = useState(AnimationDevTools.getSystemInfo());

  const testGridRef = useRef<HTMLDivElement>(null);
  const testTargetRef = useRef<HTMLDivElement>(null);

  const availableAnimations = getAvailableAnimations();

  useEffect(() => {
    // Refresh system info periodically
    const interval = setInterval(() => {
      setSystemInfo(AnimationDevTools.getSystemInfo());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handlePreviewAnimation = async () => {
    if (!testTargetRef.current) return;

    const options: AnimationPreviewOptions = {
      target: testTargetRef.current,
      animationName: selectedAnimation,
      options: {
        selectedIndex: 1,
        intensity: 'medium',
        direction: 'center',
      },
      ...previewOptions,
    };

    await AnimationDevTools.previewAnimation(options);
  };

  const handleStartPerformanceMonitoring = () => {
    AnimationDevTools.startPerformanceMonitoring();
    setIsMonitoring(true);
  };

  const handleStopPerformanceMonitoring = () => {
    const metrics = AnimationDevTools.stopPerformanceMonitoring();
    setPerformanceMetrics(metrics);
    setIsMonitoring(false);
  };

  const handleRunSingleTest = async () => {
    if (!testTargetRef.current) return;

    const result = await AnimationDevTools.testAnimation(
      selectedAnimation,
      testTargetRef.current,
      {
        selectedIndex: 1,
        intensity: 'medium',
      }
    );

    setTestResults([result, ...testResults]);
  };

  const handleRunFullTestSuite = async () => {
    const results = await AnimationDevTools.runFullTestSuite();
    setTestResults(results);
  };

  const handleStartDebugSession = () => {
    const sessionId = AnimationDevTools.startDebugSession(`test-session-${Date.now()}`);
    setActiveSessionId(sessionId);
    refreshDebugSessions();
  };

  const handleEndDebugSession = () => {
    if (activeSessionId) {
      AnimationDevTools.endDebugSession(activeSessionId);
      setActiveSessionId(null);
      refreshDebugSessions();
    }
  };

  const refreshDebugSessions = () => {
    setDebugSessions(AnimationDevTools.getAllDebugSessions());
  };

  const handleExportSession = (sessionId: string) => {
    try {
      const sessionData = AnimationDevTools.exportDebugSession(sessionId);
      const blob = new Blob([sessionData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `animation-debug-session-${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export session:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Animation Development Tools</h1>
          <p className="text-muted-foreground text-lg">
            Comprehensive tools for previewing, debugging, testing, and monitoring custom animations
          </p>
        </div>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>Current state of the animation system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Performance</h4>
                <div className="text-sm space-y-1">
                  <div>Registered: {systemInfo.performance.registeredCount}</div>
                  <div>Executed: {systemInfo.performance.executionCount}</div>
                  <div>Errors: {systemInfo.performance.errorCount}</div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Browser Support</h4>
                <div className="text-sm space-y-1">
                  {Object.entries(systemInfo.browserSupport).map(([key, supported]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${supported ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      {key}: {supported ? 'Yes' : 'No'}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Available Plugins</h4>
                <div className="space-y-1">
                  {systemInfo.availablePlugins.map(plugin => (
                    <Badge key={plugin} variant="secondary" className="text-xs">{plugin}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Available Animations</h4>
                <div className="space-y-1">
                  {systemInfo.availableAnimations.slice(0, 5).map(animation => (
                    <Badge key={animation} variant="outline" className="text-xs">{animation}</Badge>
                  ))}
                  {systemInfo.availableAnimations.length > 5 && (
                    <Badge variant="outline" className="text-xs">+{systemInfo.availableAnimations.length - 5} more</Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
            <TabsTrigger value="debugging">Debugging</TabsTrigger>
            <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          </TabsList>

          {/* Animation Preview Tab */}
          <TabsContent value="preview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Animation Preview System</CardTitle>
                <CardDescription>
                  Preview animations with real-time controls, bounds visualization, and timeline display
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Animation</label>
                    <select 
                      value={selectedAnimation} 
                      onChange={(e) => setSelectedAnimation(e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      {availableAnimations.map(animation => (
                        <option key={animation} value={animation}>{animation}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Speed</label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={previewOptions.speed || 1}
                      onChange={(e) => setPreviewOptions({
                        ...previewOptions,
                        speed: parseFloat(e.target.value)
                      })}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Speed: {previewOptions.speed || 1}x
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={previewOptions.loop || false}
                      onChange={(e) => setPreviewOptions({
                        ...previewOptions,
                        loop: e.target.checked
                      })}
                    />
                    Loop Animation
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={previewOptions.showBounds || false}
                      onChange={(e) => setPreviewOptions({
                        ...previewOptions,
                        showBounds: e.target.checked
                      })}
                    />
                    Show Bounds
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={previewOptions.showTimeline || false}
                      onChange={(e) => setPreviewOptions({
                        ...previewOptions,
                        showTimeline: e.target.checked
                      })}
                    />
                    Show Timeline
                  </label>
                </div>

                <div className="flex gap-4">
                  <Button onClick={handlePreviewAnimation}>
                    Preview Animation
                  </Button>
                  <Button onClick={AnimationDevTools.closePreview} variant="outline">
                    Close Preview
                  </Button>
                </div>

                {/* Test Target */}
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center">
                  <div 
                    ref={testTargetRef}
                    className="inline-block w-32 h-32 bg-primary/20 rounded-lg flex items-center justify-center"
                  >
                    <span className="text-sm font-medium">Test Target</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    This element will be used for animation previews
                  </p>
                </div>

                {/* Grid Test Target */}
                <div 
                  ref={testGridRef}
                  className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg"
                >
                  {Array.from({ length: 8 }, (_, index) => (
                    <div
                      key={index}
                      className="project-card bg-card border rounded-lg p-4 text-center"
                    >
                      <div className="aspect-square bg-primary/10 rounded mb-2"></div>
                      <div className="text-sm font-medium">Item {index + 1}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Monitoring Tab */}
          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Monitoring</CardTitle>
                <CardDescription>
                  Monitor animation performance, FPS, memory usage, and get optimization recommendations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button 
                    onClick={handleStartPerformanceMonitoring}
                    disabled={isMonitoring}
                  >
                    {isMonitoring ? 'Monitoring...' : 'Start Monitoring'}
                  </Button>
                  <Button 
                    onClick={handleStopPerformanceMonitoring}
                    disabled={!isMonitoring}
                    variant="outline"
                  >
                    Stop Monitoring
                  </Button>
                  <Button 
                    onClick={AnimationDevTools.clearPerformanceMetrics}
                    variant="outline"
                  >
                    Clear History
                  </Button>
                </div>

                {isMonitoring && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Performance monitoring active...</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Run some animations to collect performance data
                    </p>
                  </div>
                )}

                {performanceMetrics && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">Performance Metrics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>FPS:</span>
                          <Badge variant={performanceMetrics.fps >= 50 ? 'default' : performanceMetrics.fps >= 30 ? 'secondary' : 'destructive'}>
                            {performanceMetrics.fps}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Frame Time:</span>
                          <span>{performanceMetrics.frameTime.toFixed(2)}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Animation Count:</span>
                          <span>{performanceMetrics.animationCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Active Timelines:</span>
                          <span>{performanceMetrics.activeTimelines}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Dropped Frames:</span>
                          <Badge variant={performanceMetrics.droppedFrames === 0 ? 'default' : 'destructive'}>
                            {performanceMetrics.droppedFrames}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Execution Time:</span>
                          <span>{performanceMetrics.averageExecutionTime.toFixed(2)}ms</span>
                        </div>
                        {performanceMetrics.memoryUsage && (
                          <div className="flex justify-between">
                            <span>Memory Usage:</span>
                            <span>{(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(2)}MB</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">Recommendations</h4>
                      <div className="space-y-2">
                        {performanceMetrics.recommendations.map((rec, index) => (
                          <div key={index} className="text-sm p-2 bg-muted rounded">
                            {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Animation Testing System</CardTitle>
                <CardDescription>
                  Test individual animations or run comprehensive test suites with coverage analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button onClick={handleRunSingleTest}>
                    Test Selected Animation
                  </Button>
                  <Button onClick={handleRunFullTestSuite} variant="outline">
                    Run Full Test Suite
                  </Button>
                  <Button 
                    onClick={() => {
                      const report = AnimationDevTools.generateTestReport();
                      console.log(report);
                      alert('Test report generated in console');
                    }}
                    variant="outline"
                  >
                    Generate Report
                  </Button>
                  <Button 
                    onClick={AnimationDevTools.clearTestResults}
                    variant="outline"
                  >
                    Clear Results
                  </Button>
                </div>

                {testResults.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold">Test Results</h4>
                    <div className="grid gap-4">
                      {testResults.slice(0, 5).map((result, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium">{result.animationName}</h5>
                            <Badge variant={result.success ? 'default' : 'destructive'}>
                              {result.success ? 'PASS' : 'FAIL'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="font-medium mb-1">Performance</div>
                              <div>Duration: {result.duration.toFixed(2)}s</div>
                              <div>Execution: {result.performance.executionTime.toFixed(2)}ms</div>
                              <div>FPS: {result.performance.frameRate}</div>
                            </div>
                            
                            <div>
                              <div className="font-medium mb-1">Coverage</div>
                              <div>Variants: {result.coverage.variants.length}</div>
                              <div>Intensities: {result.coverage.intensities.length}</div>
                              <div>Directions: {result.coverage.directions.length}</div>
                            </div>
                            
                            <div>
                              <div className="font-medium mb-1">Issues</div>
                              <div className="text-red-600">Errors: {result.errors.length}</div>
                              <div className="text-yellow-600">Warnings: {result.warnings.length}</div>
                            </div>
                          </div>

                          {(result.errors.length > 0 || result.warnings.length > 0) && (
                            <div className="mt-3 space-y-1">
                              {result.errors.map((error, i) => (
                                <div key={i} className="text-xs text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
                                  Error: {error}
                                </div>
                              ))}
                              {result.warnings.map((warning, i) => (
                                <div key={i} className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-950 p-2 rounded">
                                  Warning: {warning}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {testResults.length > 5 && (
                        <div className="text-center text-sm text-muted-foreground">
                          ... and {testResults.length - 5} more results
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Debug Sessions Tab */}
          <TabsContent value="debugging" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Debug Session Management</CardTitle>
                <CardDescription>
                  Create debug sessions to track animation execution, performance, and conflicts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button 
                    onClick={handleStartDebugSession}
                    disabled={activeSessionId !== null}
                  >
                    Start Debug Session
                  </Button>
                  <Button 
                    onClick={handleEndDebugSession}
                    disabled={activeSessionId === null}
                    variant="outline"
                  >
                    End Session
                  </Button>
                  <Button 
                    onClick={refreshDebugSessions}
                    variant="outline"
                  >
                    Refresh
                  </Button>
                  <Button 
                    onClick={AnimationDevTools.clearDebugSessions}
                    variant="outline"
                  >
                    Clear All
                  </Button>
                </div>

                {activeSessionId && (
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Active Debug Session: {activeSessionId}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      All animation activity is being logged to this session
                    </p>
                  </div>
                )}

                {debugSessions.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold">Debug Sessions</h4>
                    <div className="grid gap-4">
                      {debugSessions.map((session) => (
                        <div key={session.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium">{session.id}</h5>
                            <div className="flex gap-2">
                              <Badge variant={session.isActive ? 'default' : 'secondary'}>
                                {session.isActive ? 'Active' : 'Completed'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExportSession(session.id)}
                              >
                                Export
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="font-medium">Duration</div>
                              <div>
                                {session.isActive 
                                  ? `${((performance.now() - session.startTime) / 1000).toFixed(1)}s (ongoing)`
                                  : 'Completed'
                                }
                              </div>
                            </div>
                            <div>
                              <div className="font-medium">Animations</div>
                              <div>{session.animations.length} logged</div>
                            </div>
                            <div>
                              <div className="font-medium">Performance</div>
                              <div>{session.performance.length} snapshots</div>
                            </div>
                            <div>
                              <div className="font-medium">Conflicts</div>
                              <div>{session.conflicts.length} detected</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conflicts Tab */}
          <TabsContent value="conflicts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Animation Conflict Management</CardTitle>
                <CardDescription>
                  Monitor and resolve conflicts between competing animations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button 
                    onClick={() => {
                      const conflicts = AnimationDevTools.getConflictHistory();
                      console.log('Conflict History:', conflicts);
                      alert(`Found ${conflicts.length} conflicts. Check console for details.`);
                    }}
                  >
                    Show Conflict History
                  </Button>
                  <Button 
                    onClick={() => {
                      const activeAnimations = AnimationDevTools.getActiveAnimations();
                      console.log('Active Animations:', activeAnimations);
                      alert(`${activeAnimations.size} elements have active animations. Check console for details.`);
                    }}
                    variant="outline"
                  >
                    Show Active Animations
                  </Button>
                  <Button 
                    onClick={AnimationDevTools.clearConflictHistory}
                    variant="outline"
                  >
                    Clear History
                  </Button>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Conflict Resolution Strategies</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium mb-1">Override</div>
                      <div>Higher priority animation cancels lower priority ones</div>
                    </div>
                    <div>
                      <div className="font-medium mb-1">Queue</div>
                      <div>Animations wait for current ones to complete</div>
                    </div>
                    <div>
                      <div className="font-medium mb-1">Compose</div>
                      <div>Compatible animations run simultaneously</div>
                    </div>
                    <div>
                      <div className="font-medium mb-1">Cancel</div>
                      <div>New animation is cancelled in favor of existing</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <h4 className="font-semibold mb-2">Priority Levels</h4>
                  <div className="space-y-1 text-sm">
                    <div>• Override (1000): Highest priority, cancels all others</div>
                    <div>• High (100): Important animations like user interactions</div>
                    <div>• iPad Grid Select (80): Grid selection animations</div>
                    <div>• iPad Grid Reset (70): Grid reset animations</div>
                    <div>• Slide Transition (60): Page/component transitions</div>
                    <div>• Normal (50): Default priority level</div>
                    <div>• Particle Burst (30): Decorative effects</div>
                    <div>• Glow Pulse (20): Ambient effects</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}