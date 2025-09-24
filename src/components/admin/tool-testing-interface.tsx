'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  RefreshCw, 
  Copy, 
  Download, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Code,
  Eye,
  Wand2,
  Database
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  executionContext: 'server' | 'client';
}

interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata: {
    timestamp: number;
    executionTime: number;
    toolCallId?: string;
    sessionId?: string;
  };
}

export function ToolTestingInterface() {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);
  const [parameters, setParameters] = useState<string>('{}');
  const [result, setResult] = useState<ToolExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoadingTools, setIsLoadingTools] = useState(true);
  const [resultView, setResultView] = useState<'formatted' | 'raw'>('formatted');
  const [savedConfigs, setSavedConfigs] = useState<Record<string, string>>({});
  const toast = useToast();

  // Load available tools and saved configs on component mount
  useEffect(() => {
    loadAvailableTools();
    loadSavedConfigs();
  }, []);

  const loadSavedConfigs = () => {
    try {
      const saved = localStorage.getItem('tool-testing-configs');
      if (saved) {
        setSavedConfigs(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to load saved configs:', error);
    }
  };

  const saveCurrentConfig = () => {
    if (!selectedTool) return;
    
    try {
      const configName = `${selectedTool.name}-${Date.now()}`;
      const newConfigs = {
        ...savedConfigs,
        [configName]: parameters
      };
      setSavedConfigs(newConfigs);
      localStorage.setItem('tool-testing-configs', JSON.stringify(newConfigs));
      toast.success('Configuration saved', `Saved as ${configName}`);
    } catch (error) {
      toast.error('Failed to save configuration', 'Could not save to localStorage');
    }
  };

  const loadSavedConfig = (configName: string) => {
    const config = savedConfigs[configName];
    if (config) {
      setParameters(config);
      toast.success('Configuration loaded', `Loaded ${configName}`);
    }
  };

  const deleteSavedConfig = (configName: string) => {
    const newConfigs = { ...savedConfigs };
    delete newConfigs[configName];
    setSavedConfigs(newConfigs);
    localStorage.setItem('tool-testing-configs', JSON.stringify(newConfigs));
    toast.success('Configuration deleted', `Deleted ${configName}`);
  };

  const loadAvailableTools = async () => {
    try {
      setIsLoadingTools(true);
      const response = await fetch('/api/ai/tools/execute');
      
      if (!response.ok) {
        throw new Error('Failed to load tools');
      }

      const data = await response.json();
      
      if (data.success) {
        setTools(data.tools);
        toast.success('Tools loaded', `Found ${data.tools.length} available tools`);
      } else {
        throw new Error(data.error || 'Failed to load tools');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load tools', errorMessage);
      console.error('Tool loading error:', error);
    } finally {
      setIsLoadingTools(false);
    }
  };

  const generateExampleParameters = (tool: ToolDefinition) => {
    const example: Record<string, any> = {};
    
    if (tool.parameters?.properties) {
      Object.entries(tool.parameters.properties).forEach(([key, schema]: [string, any]) => {
        if (schema.type === 'string') {
          if (schema.enum) {
            example[key] = schema.enum[0];
          } else if (key.toLowerCase().includes('query')) {
            example[key] = 'React TypeScript projects';
          } else if (key.toLowerCase().includes('projectid')) {
            example[key] = 'portfolio-website';
          } else if (key.toLowerCase().includes('projectname')) {
            example[key] = 'portfolio website';
          } else if (key.toLowerCase().includes('usermessage')) {
            example[key] = 'Show me projects with React';
          } else if (key.toLowerCase().includes('jobspec')) {
            example[key] = 'Looking for a React developer with TypeScript experience...';
          } else if (key.toLowerCase().includes('id')) {
            example[key] = 'example-id';
          } else if (key.toLowerCase().includes('name')) {
            example[key] = 'John Doe';
          } else if (key.toLowerCase().includes('email')) {
            example[key] = 'john@example.com';
          } else if (key.toLowerCase().includes('message')) {
            example[key] = 'Hello, I would like to discuss a project opportunity.';
          } else {
            example[key] = schema.description || 'example value';
          }
        } else if (schema.type === 'number') {
          example[key] = schema.default !== undefined ? schema.default : (schema.minimum || 1);
        } else if (schema.type === 'boolean') {
          example[key] = schema.default !== undefined ? schema.default : true;
        } else if (schema.type === 'array') {
          if (key.toLowerCase().includes('tags')) {
            example[key] = ['React', 'TypeScript'];
          } else if (key.toLowerCase().includes('ids')) {
            example[key] = ['example-id-1', 'example-id-2'];
          } else {
            example[key] = [];
          }
        } else if (schema.type === 'object') {
          if (key.toLowerCase().includes('formdata')) {
            example[key] = {
              name: 'John Doe',
              email: 'john@example.com',
              message: 'Hello, I would like to discuss a project opportunity.'
            };
          } else if (key.toLowerCase().includes('uistate')) {
            example[key] = {
              currentRoute: 'projects',
              currentProject: 'portfolio-website',
              breadcrumbPath: 'home.projects.portfolio-website'
            };
          } else {
            example[key] = {};
          }
        }
      });
    }

    return JSON.stringify(example, null, 2);
  };

  const handleToolSelect = (toolName: string) => {
    const tool = tools.find(t => t.name === toolName);
    if (tool) {
      setSelectedTool(tool);
      setParameters(generateExampleParameters(tool));
      setResult(null);
    }
  };

  const handleGenerateExample = () => {
    if (selectedTool) {
      setParameters(generateExampleParameters(selectedTool));
    }
  };

  const executeTool = async () => {
    if (!selectedTool) {
      toast.error('No tool selected', 'Please select a tool to execute');
      return;
    }

    let parsedParameters;
    try {
      parsedParameters = JSON.parse(parameters);
    } catch (error) {
      toast.error('Invalid JSON', 'Parameters must be valid JSON');
      return;
    }

    setIsExecuting(true);
    setResult(null);

    try {
      const startTime = Date.now();
      
      const response = await fetch('/api/ai/tools/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName: selectedTool.name,
          parameters: parsedParameters,
          sessionId: `tool-test-${Date.now()}`,
          toolCallId: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        })
      });

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      // Add our own timing if not provided
      if (!result.metadata?.executionTime) {
        result.metadata = {
          ...result.metadata,
          executionTime
        };
      }

      setResult(result);

      if (result.success) {
        toast.success('Tool executed successfully', `Completed in ${result.metadata.executionTime}ms`);
      } else {
        toast.error('Tool execution failed', result.error || 'Unknown error');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResult: ToolExecutionResult = {
        success: false,
        error: errorMessage,
        metadata: {
          timestamp: Date.now(),
          executionTime: Date.now() - Date.now()
        }
      };
      setResult(errorResult);
      toast.error('Execution error', errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard', 'Content copied successfully');
  };

  const downloadResult = () => {
    if (!result || !selectedTool) return;
    
    const data = {
      tool: selectedTool.name,
      parameters: JSON.parse(parameters),
      result,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tool-test-${selectedTool.name}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatResult = (data: any): string => {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className="space-y-6">
      {/* Tool Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Tool Selection
          </CardTitle>
          <CardDescription>
            Choose a server-side tool to test and configure its parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select 
                value={selectedTool?.name || ''} 
                onValueChange={handleToolSelect}
                disabled={isLoadingTools}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingTools ? "Loading tools..." : "Select a tool to test"} />
                </SelectTrigger>
                <SelectContent>
                  {tools.map((tool) => (
                    <SelectItem key={tool.name} value={tool.name}>
                      <div className="flex items-center gap-2">
                        <span>{tool.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {tool.executionContext}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              variant="outline" 
              onClick={loadAvailableTools}
              disabled={isLoadingTools}
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingTools ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {selectedTool && (
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Description</h4>
                <p className="text-sm text-muted-foreground">{selectedTool.description}</p>
              </div>
              
              {selectedTool.parameters?.required && selectedTool.parameters.required.length > 0 && (
                <div>
                  <h4 className="font-medium">Required Parameters</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedTool.parameters.required.map((param) => (
                      <Badge key={param} variant="destructive" className="text-xs">
                        {param}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedTool.parameters?.properties && (
                <div>
                  <h4 className="font-medium">Available Parameters</h4>
                  <div className="space-y-2 mt-2">
                    {Object.entries(selectedTool.parameters.properties).map(([paramName, paramSchema]: [string, any]) => (
                      <div key={paramName} className="text-xs border rounded p-2">
                        <div className="flex items-center gap-2">
                          <code className="font-mono bg-gray-100 px-1 rounded">{paramName}</code>
                          <Badge variant="outline" className="text-xs">
                            {paramSchema.type}
                          </Badge>
                          {selectedTool.parameters?.required?.includes(paramName) && (
                            <Badge variant="destructive" className="text-xs">required</Badge>
                          )}
                        </div>
                        {paramSchema.description && (
                          <p className="text-muted-foreground mt-1">{paramSchema.description}</p>
                        )}
                        {paramSchema.enum && (
                          <div className="mt-1">
                            <span className="text-muted-foreground">Options: </span>
                            {paramSchema.enum.map((option: string, idx: number) => (
                              <code key={idx} className="font-mono bg-gray-100 px-1 rounded mr-1 text-xs">
                                {option}
                              </code>
                            ))}
                          </div>
                        )}
                        {paramSchema.default !== undefined && (
                          <div className="mt-1">
                            <span className="text-muted-foreground">Default: </span>
                            <code className="font-mono bg-gray-100 px-1 rounded text-xs">
                              {JSON.stringify(paramSchema.default)}
                            </code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parameter Configuration */}
      {selectedTool && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Parameters
            </CardTitle>
            <CardDescription>
              Configure the parameters for the selected tool
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateExample}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Example
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(parameters)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={saveCurrentConfig}
                disabled={!selectedTool}
              >
                Save Config
              </Button>
              
              {Object.keys(savedConfigs).length > 0 && (
                <Select onValueChange={loadSavedConfig}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Load saved config..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(savedConfigs).map((configName) => (
                      <SelectItem key={configName} value={configName}>
                        <div className="flex items-center justify-between w-full">
                          <span className="truncate">{configName}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSavedConfig(configName);
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <Textarea
              value={parameters}
              onChange={(e) => setParameters(e.target.value)}
              placeholder="Enter tool parameters as JSON..."
              className="font-mono text-sm min-h-[200px]"
            />
            
            <div className="flex items-center gap-4">
              <Button 
                onClick={executeTool}
                disabled={isExecuting || !selectedTool}
                className="flex items-center gap-2"
              >
                {isExecuting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isExecuting ? 'Executing...' : 'Execute Tool'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Execution Result
            </CardTitle>
            <CardDescription className="flex items-center gap-4">
              <span>
                {result.success ? 'Success' : 'Failed'}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {result.metadata.executionTime}ms
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(result.metadata.timestamp).toLocaleString()}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Tabs value={resultView} onValueChange={(v) => setResultView(v as 'formatted' | 'raw')}>
                  <TabsList>
                    <TabsTrigger value="formatted" className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      Formatted
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="flex items-center gap-1">
                      <Code className="h-4 w-4" />
                      Raw JSON
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(result, null, 2))}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadResult}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>

              <Tabs value={resultView}>
                <TabsContent value="formatted">
                  <ScrollArea className="h-[400px] w-full border rounded-md p-4">
                    {result.success ? (
                      <div className="space-y-4">
                        {result.data && (
                          <div>
                            <h4 className="font-medium text-green-700 mb-2">Data</h4>
                            <pre className="text-sm bg-green-50 p-3 rounded border">
                              {formatResult(result.data)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-medium text-red-700 mb-2">Error</h4>
                        <div className="text-sm bg-red-50 p-3 rounded border text-red-800">
                          {result.error}
                        </div>
                      </div>
                    )}
                    
                    <Separator className="my-4" />
                    
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">Metadata</h4>
                      <pre className="text-sm bg-gray-50 p-3 rounded border">
                        {formatResult(result.metadata)}
                      </pre>
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="raw">
                  <ScrollArea className="h-[400px] w-full border rounded-md p-4">
                    <pre className="text-sm font-mono">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}