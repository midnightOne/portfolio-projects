/**
 * MCP Demo Component
 * 
 * Demonstration component for testing MCP navigation tools.
 * Shows how AI agents can control UI navigation and highlighting.
 */

"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMCPClient } from '@/hooks/use-mcp-client';
import type { MCPToolResult } from '@/lib/mcp/types';

export function MCPDemo() {
  const {
    // Tool execution
    executeTool,
    openProjectModal,
    navigateToProject,
    scrollToSection,
    highlightText,
    clearHighlights,
    focusElement,
    animateElement,
    loadProjectContext,
    searchProjects,
    
    // State
    navigationState,
    executionHistory,
    availableTools,
    isInitialized,
    isExecuting,
    lastError
  } = useMCPClient();

  // Demo state
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [toolArgs, setToolArgs] = useState<Record<string, any>>({});
  const [lastResult, setLastResult] = useState<MCPToolResult | null>(null);

  // Handle tool execution
  const handleExecuteTool = async () => {
    if (!selectedTool) return;

    try {
      const result = await executeTool({
        name: selectedTool,
        arguments: toolArgs
      });
      setLastResult(result);
    } catch (error) {
      console.error('Tool execution failed:', error);
    }
  };

  // Demo navigation tools
  const handleDemoNavigation = async () => {
    try {
      // Demo sequence: highlight, scroll, then clear
      await highlightText('#demo-section', {
        type: 'outline',
        intensity: 'medium',
        duration: 'timed',
        timing: 3000
      });

      setTimeout(async () => {
        await scrollToSection('demo-section', {
          behavior: 'smooth',
          block: 'center'
        });
      }, 500);

      setTimeout(async () => {
        await animateElement('#demo-section', {
          type: 'pulse',
          duration: 1000
        });
      }, 1500);
    } catch (error) {
      console.error('Demo navigation failed:', error);
    }
  };

  // Demo server tools
  const handleDemoServerTools = async () => {
    try {
      // Demo sequence: search projects, load context
      const searchResult = await searchProjects('react', { limit: 3 });
      console.log('Search result:', searchResult);

      if (searchResult.success && searchResult.data?.results?.length > 0) {
        const firstProject = searchResult.data.results[0];
        const contextResult = await loadProjectContext(firstProject.id, {
          includeContent: true,
          includeMedia: true
        });
        console.log('Context result:', contextResult);
      }
    } catch (error) {
      console.error('Demo server tools failed:', error);
    }
  };

  if (!isInitialized) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>MCP System</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Initializing MCP client...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* MCP Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            MCP Navigation Tools Demo
            <Badge variant={isInitialized ? 'default' : 'secondary'}>
              {isInitialized ? 'Ready' : 'Initializing'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Navigation Tools</Label>
              <p className="text-sm text-muted-foreground">
                {availableTools.navigation.length} available
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {availableTools.navigation.map(tool => (
                  <Badge key={tool} variant="outline" className="text-xs">
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Server Tools</Label>
              <p className="text-sm text-muted-foreground">
                {availableTools.server.length} available
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {availableTools.server.map(tool => (
                  <Badge key={tool} variant="outline" className="text-xs">
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {lastError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">
                Error: {lastError.message}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demo Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Navigation Demo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test client-side navigation tools: highlighting, scrolling, and animations.
            </p>
            <Button 
              onClick={handleDemoNavigation}
              disabled={isExecuting}
              className="w-full"
            >
              {isExecuting ? 'Executing...' : 'Run Navigation Demo'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Server Tools Demo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test server-side tools: project search and context loading.
            </p>
            <Button 
              onClick={handleDemoServerTools}
              disabled={isExecuting}
              className="w-full"
            >
              {isExecuting ? 'Executing...' : 'Run Server Demo'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Manual Tool Execution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manual Tool Execution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tool-select">Select Tool</Label>
              <Select value={selectedTool} onValueChange={setSelectedTool}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a tool..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select a tool</SelectItem>
                  {[...availableTools.navigation, ...availableTools.server].map(tool => (
                    <SelectItem key={tool} value={tool}>
                      {tool}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tool-args">Arguments (JSON)</Label>
              <Input
                id="tool-args"
                placeholder='{"selector": "#example"}'
                value={JSON.stringify(toolArgs)}
                onChange={(e) => {
                  try {
                    setToolArgs(JSON.parse(e.target.value || '{}'));
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
              />
            </div>
          </div>

          <Button 
            onClick={handleExecuteTool}
            disabled={!selectedTool || isExecuting}
            className="w-full"
          >
            {isExecuting ? 'Executing...' : 'Execute Tool'}
          </Button>

          {lastResult && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <Label className="text-sm font-medium">Last Result:</Label>
              <pre className="text-xs mt-1 overflow-auto">
                {JSON.stringify(lastResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demo Target Section */}
      <Card id="demo-section" data-section="demo-section">
        <CardHeader>
          <CardTitle className="text-lg">Demo Target Section</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This section can be highlighted, scrolled to, and animated by the MCP navigation tools.
            Try the demo buttons above to see the tools in action.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted rounded-md" data-testid="demo-element-1">
              <p className="text-sm">Demo Element 1</p>
            </div>
            <div className="p-3 bg-muted rounded-md" data-testid="demo-element-2">
              <p className="text-sm">Demo Element 2</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation State */}
      {navigationState && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Navigation State</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <Label className="text-sm font-medium">Current Section:</Label>
                <p className="text-sm text-muted-foreground">
                  {navigationState.currentSection || 'None'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Active Highlights:</Label>
                <p className="text-sm text-muted-foreground">
                  {Object.keys(navigationState.activeHighlights).length} active
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">History Entries:</Label>
                <p className="text-sm text-muted-foreground">
                  {navigationState.history.length} entries
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution History */}
      {executionHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Execution History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-auto">
              {executionHistory.slice(-5).reverse().map((execution, index) => (
                <div key={index} className="p-2 bg-muted rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{execution.toolName}</span>
                    <Badge variant={execution.result.success ? 'default' : 'destructive'}>
                      {execution.result.success ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {execution.executionTime}ms • {execution.source}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}