'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Settings, 
  Mic, 
  Volume2, 
  Zap,
  TestTube,
  Save,
  RotateCcw
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { ButtonLoadingState } from '@/components/ui/loading-indicator';
import { HelpText, HelpSection } from '@/components/ui/help-text';
import { 
  OpenAIRealtimeConfig, 
  DEFAULT_OPENAI_CONFIG,
  OpenAIVoice,
  OpenAIRealtimeModel,
  TransportType
} from '@/types/voice-config';
import { OpenAIRealtimeSerializer } from '@/lib/voice/config-serializers/OpenAIRealtimeSerializer';

interface OpenAIRealtimeConfigPanelProps {
  initialConfig?: OpenAIRealtimeConfig;
  onSave: (config: OpenAIRealtimeConfig) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

const OPENAI_VOICES: { value: OpenAIVoice; label: string; description: string }[] = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral, balanced voice' },
  { value: 'ash', label: 'Ash', description: 'Clear and precise' },
  { value: 'ballad', label: 'Ballad', description: 'Melodic and smooth' },
  { value: 'coral', label: 'Coral', description: 'Warm and friendly' },
  { value: 'echo', label: 'Echo', description: 'Resonant and deep' },
  { value: 'shimmer', label: 'Shimmer', description: 'Bright and energetic' },
  { value: 'sage', label: 'Sage', description: 'Calm and thoughtful' },
  { value: 'verse', label: 'Verse', description: 'Versatile and expressive' },
  { value: 'marin', label: 'Marin', description: 'Newer voice that is more natural and clear' },
  { value: 'cedar', label: 'Cedar', description: 'Newer voice that is more natural and clear' }
];

/*alloy: Neutral and balanced.
ash: Clear and precise.
ballad: Melodic and smooth.
coral: Warm and friendly.
echo: Resonant and deep.
sage: Calm and thoughtful.
shimmer: Bright and energetic.
verse: Versatile and expressive.
marin and cedar: Newer voices that are more natural and clear. 

alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar*/

const OPENAI_MODELS: { value: OpenAIRealtimeModel; label: string; description: string }[] = [
  { value: 'gpt-realtime', label: 'GPT Realtime', description: 'Newest realtime model' },
  { value: 'gpt-4o-realtime-preview-2025-06-03', label: 'GPT-4o Realtime (old model)', description: 'fallback old model' }
];

const TRANSPORT_TYPES: { value: TransportType; label: string; description: string }[] = [
  { value: 'webrtc', label: 'WebRTC', description: 'Low latency, peer-to-peer connection' },
  { value: 'websocket', label: 'WebSocket', description: 'Standard WebSocket connection' }
];

export function OpenAIRealtimeConfigPanel({
  initialConfig,
  onSave,
  onCancel,
  saving = false
}: OpenAIRealtimeConfigPanelProps) {
  const toast = useToast();
  const serializer = useMemo(() => new OpenAIRealtimeSerializer(), []);
  
  // Configuration state
  const [config, setConfig] = useState<OpenAIRealtimeConfig>(
    initialConfig || DEFAULT_OPENAI_CONFIG
  );
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(true);
  
  // UI state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Validate configuration whenever it changes
  useEffect(() => {
    const validation = serializer.validate(config);
    setIsValid(validation.valid);
    setValidationErrors(validation.errors.map(e => `${e.field}: ${e.message}`));
    setValidationWarnings(validation.warnings?.map(w => `${w.field}: ${w.message}`) || []);
  }, [config, serializer]);

  const handleConfigChange = (field: keyof OpenAIRealtimeConfig, value: any) => {
    setConfig(prev => {
      const newConfig = {
        ...prev,
        [field]: value
      };
      
      // CRITICAL FIX: Synchronize voice settings when voice field is changed
      // Ensure sessionConfig.audio.output.voice matches the top-level voice setting
      if (field === 'voice' && newConfig.sessionConfig?.audio?.output) {
        console.log(`Admin UI Voice Sync: Updating sessionConfig.audio.output.voice from '${newConfig.sessionConfig.audio.output.voice}' to '${value}'`);
        newConfig.sessionConfig = {
          ...newConfig.sessionConfig,
          audio: {
            ...newConfig.sessionConfig.audio,
            output: {
              ...newConfig.sessionConfig.audio.output,
              voice: value as OpenAIVoice
            }
          }
        };
      }
      
      return newConfig;
    });
  };

  const handleSessionConfigChange = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      sessionConfig: {
        ...prev.sessionConfig,
        [field]: value
      }
    }));
  };

  const handleAudioConfigChange = (section: 'input' | 'output', field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      sessionConfig: {
        ...prev.sessionConfig,
        audio: {
          ...prev.sessionConfig.audio,
          [section]: {
            ...prev.sessionConfig.audio[section],
            [field]: value
          }
        }
      }
    }));
  };

  const handleTurnDetectionChange = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      sessionConfig: {
        ...prev.sessionConfig,
        audio: {
          ...prev.sessionConfig.audio,
          input: {
            ...prev.sessionConfig.audio.input,
            turnDetection: {
              ...prev.sessionConfig.audio.input.turnDetection,
              [field]: value
            }
          }
        }
      }
    }));
  };

  const handleTestConfiguration = async () => {
    if (!isValid) {
      toast.error('Configuration invalid', 'Please fix validation errors before testing');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/admin/ai/voice-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai', config })
      });

      const result = await response.json();

      if (result.success) {
        setTestResult({ success: true, message: result.message || 'Configuration test successful' });
        toast.success('Test successful', 'OpenAI Realtime configuration is working correctly');
      } else {
        setTestResult({ success: false, message: result.error?.message || 'Configuration test failed' });
        toast.error('Test failed', result.error?.message || 'Configuration test failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error during test';
      setTestResult({ success: false, message: errorMessage });
      toast.error('Test error', errorMessage);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!isValid) {
      toast.error('Configuration invalid', 'Please fix validation errors before saving');
      return;
    }

    try {
      // Add isDefault property to the config when saving
      const configWithDefaults = {
        ...config,
        isDefault: false // Default to false, can be set later via "Set Default" action
      };
      await onSave(configWithDefaults as any);
    } catch (err) {
      // Error handling is done in parent component
    }
  };

  const handleReset = () => {
    setConfig(initialConfig || DEFAULT_OPENAI_CONFIG);
    setTestResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Validation Status */}
      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <div className="space-y-2">
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Configuration Errors:</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {validationWarnings.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Configuration Warnings:</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationWarnings.map((warning, index) => (
                    <li key={index} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <Alert variant={testResult.success ? "default" : "destructive"}>
          {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>
            <div className="font-medium">
              {testResult.success ? 'Configuration Test Passed' : 'Configuration Test Failed'}
            </div>
            <div className="text-sm mt-1">{testResult.message}</div>
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration Form */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="session">Session</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* Basic Configuration */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Basic Configuration
              </CardTitle>
              <CardDescription>
                Essential settings for OpenAI Realtime voice assistant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={config.displayName}
                    onChange={(e) => handleConfigChange('displayName', e.target.value)}
                    placeholder="OpenAI Realtime Assistant"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    value={config.version}
                    onChange={(e) => handleConfigChange('version', e.target.value)}
                    placeholder="1.0.0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={config.description}
                  onChange={(e) => handleConfigChange('description', e.target.value)}
                  placeholder="Real-time voice assistant powered by OpenAI GPT-4o Realtime"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select
                    value={config.model}
                    onValueChange={(value) => handleConfigChange('model', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENAI_MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          <div>
                            <div className="font-medium">{model.label}</div>
                            <div className="text-sm text-muted-foreground">{model.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="voice">Voice</Label>
                  <Select
                    value={config.voice}
                    onValueChange={(value) => handleConfigChange('voice', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENAI_VOICES.map((voice) => (
                        <SelectItem key={voice.value} value={voice.value}>
                          <div>
                            <div className="font-medium">{voice.label}</div>
                            <div className="text-sm text-muted-foreground">{voice.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  value={config.instructions}
                  onChange={(e) => handleConfigChange('instructions', e.target.value)}
                  placeholder="You are a helpful voice assistant for a portfolio website..."
                  rows={4}
                />
                <HelpText>
                  System instructions that define the AI's behavior and personality
                </HelpText>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">
                    Temperature ({config.temperature})
                  </Label>
                  <Slider
                    id="temperature"
                    min={0}
                    max={2}
                    step={0.1}
                    value={[config.temperature]}
                    onValueChange={([value]) => handleConfigChange('temperature', value)}
                    className="w-full"
                  />
                  <HelpText>
                    Controls randomness: 0 = deterministic, 2 = very creative
                  </HelpText>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxTokens">Max Tokens</Label>
                  <Select
                    value={config.maxTokens.toString()}
                    onValueChange={(value) => handleConfigChange('maxTokens', value === 'inf' ? 'inf' : parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inf">Unlimited</SelectItem>
                      <SelectItem value="1000">1,000</SelectItem>
                      <SelectItem value="2000">2,000</SelectItem>
                      <SelectItem value="4000">4,000</SelectItem>
                      <SelectItem value="8000">8,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={config.enabled}
                  onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
                />
                <Label htmlFor="enabled">Enable this configuration</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audio Configuration */}
        <TabsContent value="audio" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Audio Input Settings
              </CardTitle>
              <CardDescription>
                Configure microphone input and voice activity detection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inputFormat">Audio Format</Label>
                  <Select
                    value={config.sessionConfig.audio.input.format.type}
                    onValueChange={(value) => handleAudioConfigChange('input', 'format', {
                      ...config.sessionConfig.audio.input.format,
                      type: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcm16">PCM 16-bit</SelectItem>
                      <SelectItem value="g711_ulaw">G.711 μ-law</SelectItem>
                      <SelectItem value="g711_alaw">G.711 A-law</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inputRate">Sample Rate (Hz)</Label>
                  <Select
                    value={config.sessionConfig.audio.input.format.rate.toString()}
                    onValueChange={(value) => handleAudioConfigChange('input', 'format', {
                      ...config.sessionConfig.audio.input.format,
                      rate: parseInt(value)
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16000">16,000 Hz</SelectItem>
                      <SelectItem value="24000">24,000 Hz</SelectItem>
                      <SelectItem value="48000">48,000 Hz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Voice Activity Detection</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vadType">Detection Type</Label>
                    <Select
                      value={config.sessionConfig.audio.input.turnDetection.type}
                      onValueChange={(value) => handleTurnDetectionChange('type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="server_vad">Server VAD</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vadThreshold">
                      Threshold ({config.sessionConfig.audio.input.turnDetection.threshold})
                    </Label>
                    <Slider
                      id="vadThreshold"
                      min={0}
                      max={1}
                      step={0.1}
                      value={[config.sessionConfig.audio.input.turnDetection.threshold || 0.5]}
                      onValueChange={([value]) => handleTurnDetectionChange('threshold', value)}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prefixPadding">Prefix Padding (ms)</Label>
                    <Input
                      id="prefixPadding"
                      type="number"
                      min="0"
                      max="1000"
                      value={config.sessionConfig.audio.input.turnDetection.prefixPaddingMs || 300}
                      onChange={(e) => handleTurnDetectionChange('prefixPaddingMs', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="silenceDuration">Silence Duration (ms)</Label>
                    <Input
                      id="silenceDuration"
                      type="number"
                      min="100"
                      max="2000"
                      value={config.sessionConfig.audio.input.turnDetection.silenceDurationMs || 200}
                      onChange={(e) => handleTurnDetectionChange('silenceDurationMs', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="createResponse"
                      checked={config.sessionConfig.audio.input.turnDetection.createResponse || true}
                      onCheckedChange={(checked) => handleTurnDetectionChange('createResponse', checked)}
                    />
                    <Label htmlFor="createResponse">Auto-create response</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="interruptResponse"
                      checked={config.sessionConfig.audio.input.turnDetection.interruptResponse || true}
                      onCheckedChange={(checked) => handleTurnDetectionChange('interruptResponse', checked)}
                    />
                    <Label htmlFor="interruptResponse">Allow interruption</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Audio Output Settings
              </CardTitle>
              <CardDescription>
                Configure voice synthesis and audio output
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="outputFormat">Audio Format</Label>
                  <Select
                    value={config.sessionConfig.audio.output.format.type}
                    onValueChange={(value) => handleAudioConfigChange('output', 'format', {
                      ...config.sessionConfig.audio.output.format,
                      type: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pcm16">PCM 16-bit</SelectItem>
                      <SelectItem value="g711_ulaw">G.711 μ-law</SelectItem>
                      <SelectItem value="g711_alaw">G.711 A-law</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outputRate">Sample Rate (Hz)</Label>
                  <Select
                    value={config.sessionConfig.audio.output.format.rate.toString()}
                    onValueChange={(value) => handleAudioConfigChange('output', 'format', {
                      ...config.sessionConfig.audio.output.format,
                      rate: parseInt(value)
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16000">16,000 Hz</SelectItem>
                      <SelectItem value="24000">24,000 Hz</SelectItem>
                      <SelectItem value="48000">48,000 Hz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="speed">
                    Speech Speed ({config.sessionConfig.audio.output.speed || 1.0})
                  </Label>
                  <Slider
                    id="speed"
                    min={0.25}
                    max={4.0}
                    step={0.25}
                    value={[config.sessionConfig.audio.output.speed || 1.0]}
                    onValueChange={([value]) => handleAudioConfigChange('output', 'speed', value)}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Session Configuration */}
        <TabsContent value="session" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Session Settings
              </CardTitle>
              <CardDescription>
                Configure connection and session behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transport">Transport Type</Label>
                  <Select
                    value={config.sessionConfig.transport}
                    onValueChange={(value) => handleSessionConfigChange('transport', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_TYPES.map((transport) => (
                        <SelectItem key={transport.value} value={transport.value}>
                          <div>
                            <div className="font-medium">{transport.label}</div>
                            <div className="text-sm text-muted-foreground">{transport.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="toolChoice">Tool Choice</Label>
                  <Select
                    value={config.sessionConfig.toolChoice || 'auto'}
                    onValueChange={(value) => handleSessionConfigChange('toolChoice', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="required">Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionMaxTokens">Session Max Tokens</Label>
                  <Select
                    value={(config.sessionConfig.maxOutputTokens || 'inf').toString()}
                    onValueChange={(value) => handleSessionConfigChange('maxOutputTokens', value === 'inf' ? 'inf' : parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inf">Unlimited</SelectItem>
                      <SelectItem value="1000">1,000</SelectItem>
                      <SelectItem value="2000">2,000</SelectItem>
                      <SelectItem value="4000">4,000</SelectItem>
                      <SelectItem value="8000">8,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sessionTemperature">
                    Session Temperature ({config.sessionConfig.temperature || 0.7})
                  </Label>
                  <Slider
                    id="sessionTemperature"
                    min={0}
                    max={2}
                    step={0.1}
                    value={[config.sessionConfig.temperature || 0.7]}
                    onValueChange={([value]) => handleSessionConfigChange('temperature', value)}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Configuration */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Environment variables and advanced configuration options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKeyEnvVar">API Key Environment Variable</Label>
                  <Input
                    id="apiKeyEnvVar"
                    value={config.apiKeyEnvVar || ''}
                    onChange={(e) => handleConfigChange('apiKeyEnvVar', e.target.value)}
                    placeholder="OPENAI_API_KEY"
                  />
                  <HelpText>
                    Environment variable name for the OpenAI API key
                  </HelpText>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseUrlEnvVar">Base URL Environment Variable</Label>
                  <Input
                    id="baseUrlEnvVar"
                    value={config.baseUrlEnvVar || ''}
                    onChange={(e) => handleConfigChange('baseUrlEnvVar', e.target.value)}
                    placeholder="OPENAI_BASE_URL"
                  />
                  <HelpText>
                    Environment variable name for custom OpenAI base URL (optional)
                  </HelpText>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Capabilities</Label>
                <div className="flex flex-wrap gap-2">
                  {config.capabilities.map((capability) => (
                    <Badge key={capability} variant="secondary">
                      {capability}
                    </Badge>
                  ))}
                </div>
                <HelpText>
                  Voice capabilities supported by this configuration
                </HelpText>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleTestConfiguration}
            disabled={!isValid || testing}
            className="flex items-center gap-2"
          >
            <ButtonLoadingState
              isLoading={testing}
              loadingText="Testing..."
            >
              {!testing && <TestTube className="h-4 w-4" />}
              Test Configuration
            </ButtonLoadingState>
          </Button>

          <Button
            variant="outline"
            onClick={handleReset}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex items-center gap-2"
          >
            <ButtonLoadingState
              isLoading={saving}
              loadingText="Saving..."
            >
              {!saving && <Save className="h-4 w-4" />}
              Save Configuration
            </ButtonLoadingState>
          </Button>
        </div>
      </div>
    </div>
  );
}