'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Bug, Copy, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface DebugData {
  sessionId: string;
  timestamp: string;
  input: {
    content: string;
    mode: string;
    metadata?: any;
  };
  systemPrompt: string;
  contextString: string;
  aiRequest: {
    model: string;
    temperature: number;
    messages: any[];
  };
  aiResponse?: {
    content: string;
    tokensUsed?: number;
    cost?: number;
  };
  error?: string;
}

function AIDebugContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();
  
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['request-info']));

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      router.push('/admin/login');
      return;
    }
  }, [session, status, router]);

  const loadDebugData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/ai/conversation/debug');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setDebugData(data.data);
        toast.success('Debug data loaded', 'Latest conversation debug data retrieved successfully');
      } else {
        throw new Error(data.error?.message || 'Failed to load debug data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load debug data';
      setError(errorMessage);
      toast.error('Failed to load debug data', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard', `${label} copied successfully`);
    } catch (error) {
      toast.error('Copy failed', 'Failed to copy to clipboard');
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            AI Conversation Debug Panel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={loadDebugData}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Load Latest Debug Data'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Retrieves debug information from the most recent AI conversation request
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => setError(null)}>
              Clear
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Debug Data Display */}
      {debugData ? (
        <div className="space-y-4">
          {/* Request Information */}
          <Card>
            <Collapsible 
              open={expandedSections.has('request-info')} 
              onOpenChange={() => toggleSection('request-info')}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {expandedSections.has('request-info') ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Request Information
                    <Badge variant="outline" className="ml-auto">
                      {formatTimestamp(debugData.timestamp)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium">Session ID:</span>
                        <div className="font-mono text-xs bg-muted p-2 rounded mt-1 break-all">
                          {debugData.sessionId}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm font-medium">Input Mode:</span>
                        <Badge className="ml-2">{debugData.input.mode}</Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm font-medium">Model:</span>
                        <div className="font-mono text-xs">{debugData.aiRequest.model}</div>
                      </div>
                      <div>
                        <span className="text-sm font-medium">Temperature:</span>
                        <div className="font-mono text-xs">{debugData.aiRequest.temperature}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* User Input */}
          <Card>
            <Collapsible 
              open={expandedSections.has('user-input')} 
              onOpenChange={() => toggleSection('user-input')}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {expandedSections.has('user-input') ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    User Input
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(debugData.input.content, 'User input');
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <pre className="text-sm bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap">
                    {debugData.input.content}
                  </pre>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* System Prompt */}
          <Card>
            <Collapsible 
              open={expandedSections.has('system-prompt')} 
              onOpenChange={() => toggleSection('system-prompt')}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {expandedSections.has('system-prompt') ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    System Prompt
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(debugData.systemPrompt, 'System prompt');
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <pre className="text-sm bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {debugData.systemPrompt}
                  </pre>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Context String */}
          <Card>
            <Collapsible 
              open={expandedSections.has('context-string')} 
              onOpenChange={() => toggleSection('context-string')}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {expandedSections.has('context-string') ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Context String
                    <Badge variant="outline" className="ml-auto mr-2">
                      {debugData.contextString.length} chars
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(debugData.contextString, 'Context string');
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {debugData.contextString ? (
                    <pre className="text-sm bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {debugData.contextString}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground italic p-4">No context provided</p>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Full AI Request */}
          <Card>
            <Collapsible 
              open={expandedSections.has('ai-request')} 
              onOpenChange={() => toggleSection('ai-request')}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {expandedSections.has('ai-request') ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Full AI Request
                    <Badge variant="outline" className="ml-auto mr-2">
                      {debugData.aiRequest.messages.length} messages
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(JSON.stringify(debugData.aiRequest, null, 2), 'AI request');
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <pre className="text-sm bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {JSON.stringify(debugData.aiRequest, null, 2)}
                  </pre>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* AI Response */}
          {debugData.aiResponse && (
            <Card>
              <Collapsible 
                open={expandedSections.has('ai-response')} 
                onOpenChange={() => toggleSection('ai-response')}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {expandedSections.has('ai-response') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      AI Response
                      <div className="ml-auto flex items-center gap-2">
                        {debugData.aiResponse.tokensUsed && (
                          <Badge variant="outline">
                            {debugData.aiResponse.tokensUsed} tokens
                          </Badge>
                        )}
                        {debugData.aiResponse.cost && (
                          <Badge variant="outline">
                            ${debugData.aiResponse.cost.toFixed(4)}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(debugData.aiResponse!.content, 'AI response');
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <pre className="text-sm bg-muted p-4 rounded overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                      {debugData.aiResponse.content}
                    </pre>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}

          {/* Error */}
          {debugData.error && (
            <Card className="border-destructive">
              <Collapsible 
                open={expandedSections.has('error')} 
                onOpenChange={() => toggleSection('error')}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-destructive/5 transition-colors">
                    <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                      {expandedSections.has('error') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <AlertCircle className="h-4 w-4" />
                      Error
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(debugData.error!, 'Error details');
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <pre className="text-sm bg-destructive/5 p-4 rounded overflow-x-auto whitespace-pre-wrap text-destructive">
                      {debugData.error}
                    </pre>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Bug className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Debug Data Available</h3>
            <p className="text-muted-foreground mb-4">
              Debug data will appear here after AI conversations are made. 
              Click "Load Latest Debug Data" to retrieve the most recent conversation debug information.
            </p>
            <Button onClick={loadDebugData} disabled={loading}>
              Load Debug Data
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AIDebugPage() {
  return (
    <AdminLayout>
      <AdminPageLayout
        title="AI Debug Panel"
        description="Debug AI conversation requests, system prompts, and context data"
        breadcrumbs={[
          { label: 'AI Assistant', href: '/admin/ai' },
          { label: 'Debug Panel', href: '/admin/ai/debug' }
        ]}
      >
        <AIDebugContent />
      </AdminPageLayout>
    </AdminLayout>
  );
}