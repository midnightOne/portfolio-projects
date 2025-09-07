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
  MessageSquare,
  TestTube,
  Save,
  RotateCcw,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { ButtonLoadingState } from '@/components/ui/loading-indicator';
import { HelpText, HelpSection } from '@/components/ui/help-text';
import { 
  ElevenLabsConfig, 
  DEFAULT_ELEVENLABS_CONFIG
} from '@/types/voice-config';
import { ElevenLabsSerializer } from '@/lib/voice/config-serializers/ElevenLabsSerializer';

interface ElevenLabsConfigPanelProps {
  initialConfig?: ElevenLabsConfig;
  onSave: (config: ElevenLabsConfig) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

const ELEVENLABS_MODELS = [
  { value: 'eleven_turbo_v2_5', label: 'Turbo v2.5', description: 'Latest high-speed model' },
  { value: 'eleven_turbo_v2', label: 'Turbo v2', description: 'Fast, efficient model' },
  { value: 'eleven_multilingual_v2', label: 'Multilingual v2', description: 'Multi-language support' }
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', code: 'en' },
  { value: 'es', label: 'Spanish', code: 'es' },
  { value: 'fr', label: 'French', code: 'fr' },
  { value: 'de', label: 'German', code: 'de' },
  { value: 'it', label: 'Italian', code: 'it' },
  { value: 'pt', label: 'Portuguese', code: 'pt' },
  { value: 'pl', label: 'Polish', code: 'pl' },
  { value: 'tr', label: 'Turkish', code: 'tr' },
  { value: 'ru', label: 'Russian', code: 'ru' },
  { value: 'nl', label: 'Dutch', code: 'nl' },
  { value: 'cs', label: 'Czech', code: 'cs' },
  { value: 'ar', label: 'Arabic', code: 'ar' },
  { value: 'zh', label: 'Chinese', code: 'zh' },
  { value: 'ja', label: 'Japanese', code: 'ja' },
  { value: 'hi', label: 'Hindi', code: 'hi' },
  { value: 'ko', label: 'Korean', code: 'ko' }
];

export function ElevenLabsConfigPanel({
  initialConfig,
  onSave,
  onCancel,
  saving = false
}: ElevenLabsConfigPanelProps) {
  const toast = useToast();
  const serializer = useMemo(() => new ElevenLabsSerializer(), []);
  
  // Configuration state
  const [config, setConfig] = useState<ElevenLabsConfig>(
    initialConfig || DEFAULT_ELEVENLABS_CONFIG
  );
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(true);
  
  // UI state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [availableVoices, setAvailableVoices] = useState<Array<{ id: string; name: string }>>([]);

  // Validate configuration whenever it changes
  useEffect(() => {
    const validation = serializer.validate(config);
    setIsValid(validation.valid);
    setValidationErrors(validation.errors.map(e => `${e.field}: ${e.message}`));
    setValidationWarnings(validation.warnings?.map(w => `${w.field}: ${w.message}`) || []);
  }, [config, serializer]);

  // Load available agents and voices on mount
  useEffect(() => {
    loadAvailableAgents();
    loadAvailableVoices();
  }, []);

  const handleConfigChange = (field: keyof ElevenLabsConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleVoiceSettingsChange = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      voiceSettings: {
        ...prev.voiceSettings,
        [field]: value
      }
    }));
  };

  const handleConversationConfigChange = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      conversationConfig: {
        ...prev.conversationConfig,
        [field]: value
      }
    }));
  };

  const loadAvailableAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await fetch('/api/admin/ai/elevenlabs/agents');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setAvailableAgents(result.data);
        }
      }
    } catch (err) {
      console.warn('Failed to load ElevenLabs agents:', err);
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadAvailableVoices = async () => {
    setLoadingVoices(true);
    try {
      const response = await fetch('/api/admin/ai/elevenlabs/voices');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setAvailableVoices(result.data);
        }
      }
    } catch (err) {
      console.warn('Failed to load ElevenLabs voices:', err);
    } finally {
      setLoadingVoices(false);
    }
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
        body: JSON.stringify({ provider: 'elevenlabs', config })
      });

      const result = await response.json();

      if (result.success) {
        setTestResult({ success: true, message: result.message || 'Configuration test successful' });
        toast.success('Test successful', 'ElevenLabs configuration is working correctly');
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
    setConfig(initialConfig || DEFAULT_ELEVENLABS_CONFIG);
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
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
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
                Essential settings for ElevenLabs Conversational AI
              </CardDescription>
              <HelpText variant="card">
                <HelpSection
                  title="ElevenLabs Setup"
                  links={[
                    { label: 'ElevenLabs Console', href: 'https://elevenlabs.io/app' },
                    { label: 'API Documentation', href: 'https://elevenlabs.io/docs' },
                    { label: 'Conversational AI Guide', href: 'https://elevenlabs.io/docs/conversational-ai/overview' }
                  ]}
                >
                  Configure your ElevenLabs Conversational AI agent and voice settings. You'll need an ElevenLabs account and API key.
                </HelpSection>
              </HelpText>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={config.displayName}
                    onChange={(e) => handleConfigChange('displayName', e.target.value)}
                    placeholder="ElevenLabs Conversational AI"
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
                  placeholder="Natural voice conversations powered by ElevenLabs"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="agentId">Agent ID</Label>
                  <div className="flex gap-2">
                    <Select
                      value={config.agentId}
                      onValueChange={(value) => handleConfigChange('agentId', value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select or enter agent ID" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingAgents ? (
                          <SelectItem value="" disabled>Loading agents...</SelectItem>
                        ) : availableAgents.length > 0 ? (
                          availableAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name} ({agent.id})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="" disabled>No agents found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadAvailableAgents}
                      disabled={loadingAgents}
                    >
                      {loadingAgents ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                    </Button>
                  </div>
                  <Input
                    placeholder="Or enter agent ID manually"
                    value={config.agentId}
                    onChange={(e) => handleConfigChange('agentId', e.target.value)}
                    className="mt-2"
                  />
                  <HelpText>
                    ElevenLabs agent identifier. Create agents in the{' '}
                    <a 
                      href="https://elevenlabs.io/app/conversational-ai" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline inline-flex items-center gap-1"
                    >
                      ElevenLabs Console <ExternalLink className="h-3 w-3" />
                    </a>
                  </HelpText>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="voiceId">Voice ID</Label>
                  <div className="flex gap-2">
                    <Select
                      value={config.voiceId}
                      onValueChange={(value) => handleConfigChange('voiceId', value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select or enter voice ID" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingVoices ? (
                          <SelectItem value="" disabled>Loading voices...</SelectItem>
                        ) : availableVoices.length > 0 ? (
                          availableVoices.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.name} ({voice.id})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="" disabled>No voices found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadAvailableVoices}
                      disabled={loadingVoices}
                    >
                      {loadingVoices ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                    </Button>
                  </div>
                  <Input
                    placeholder="Or enter voice ID manually"
                    value={config.voiceId}
                    onChange={(e) => handleConfigChange('voiceId', e.target.value)}
                    className="mt-2"
                  />
                  <HelpText>
                    ElevenLabs voice identifier. Browse voices in the{' '}
                    <a 
                      href="https://elevenlabs.io/app/voice-library" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline inline-flex items-center gap-1"
                    >
                      Voice Library <ExternalLink className="h-3 w-3" />
                    </a>
                  </HelpText>
                </div>
              </div>

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
                    {ELEVENLABS_MODELS.map((model) => (
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

        {/* Voice Settings */}
        <TabsContent value="voice" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Voice Settings
              </CardTitle>
              <CardDescription>
                Configure voice synthesis parameters for natural speech
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="stability">
                    Stability ({config.voiceSettings.stability})
                  </Label>
                  <Slider
                    id="stability"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[config.voiceSettings.stability]}
                    onValueChange={([value]) => handleVoiceSettingsChange('stability', value)}
                    className="w-full"
                  />
                  <HelpText>
                    Higher values make the voice more consistent but less expressive
                  </HelpText>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="similarityBoost">
                    Similarity Boost ({config.voiceSettings.similarityBoost})
                  </Label>
                  <Slider
                    id="similarityBoost"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[config.voiceSettings.similarityBoost]}
                    onValueChange={([value]) => handleVoiceSettingsChange('similarityBoost', value)}
                    className="w-full"
                  />
                  <HelpText>
                    Enhances similarity to the original voice
                  </HelpText>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="style">
                    Style ({config.voiceSettings.style})
                  </Label>
                  <Slider
                    id="style"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[config.voiceSettings.style]}
                    onValueChange={([value]) => handleVoiceSettingsChange('style', value)}
                    className="w-full"
                  />
                  <HelpText>
                    Controls style exaggeration. 0 = neutral, 1 = exaggerated
                  </HelpText>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="useSpeakerBoost"
                      checked={config.voiceSettings.useSpeakerBoost}
                      onCheckedChange={(checked) => handleVoiceSettingsChange('useSpeakerBoost', checked)}
                    />
                    <Label htmlFor="useSpeakerBoost">Use Speaker Boost</Label>
                  </div>
                  <HelpText>
                    Enhances speaker clarity and reduces artifacts
                  </HelpText>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversation Configuration */}
        <TabsContent value="conversation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversation Settings
              </CardTitle>
              <CardDescription>
                Configure conversation behavior and language settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={config.conversationConfig.language}
                    onValueChange={(value) => handleConversationConfigChange('language', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label} ({lang.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDuration">Max Duration (seconds)</Label>
                  <Input
                    id="maxDuration"
                    type="number"
                    min="60"
                    max="3600"
                    value={config.conversationConfig.maxDuration}
                    onChange={(e) => handleConversationConfigChange('maxDuration', parseInt(e.target.value))}
                  />
                  <HelpText>
                    Maximum conversation duration (60-3600 seconds)
                  </HelpText>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timeoutMs">Timeout (milliseconds)</Label>
                  <Input
                    id="timeoutMs"
                    type="number"
                    min="1000"
                    max="30000"
                    value={config.conversationConfig.timeoutMs}
                    onChange={(e) => handleConversationConfigChange('timeoutMs', parseInt(e.target.value))}
                  />
                  <HelpText>
                    Connection timeout (1000-30000 ms)
                  </HelpText>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enableInterruption"
                      checked={config.conversationConfig.enableInterruption}
                      onCheckedChange={(checked) => handleConversationConfigChange('enableInterruption', checked)}
                    />
                    <Label htmlFor="enableInterruption">Enable Interruption</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enableBackchannel"
                      checked={config.conversationConfig.enableBackchannel}
                      onCheckedChange={(checked) => handleConversationConfigChange('enableBackchannel', checked)}
                    />
                    <Label htmlFor="enableBackchannel">Enable Backchannel</Label>
                  </div>
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
                    placeholder="ELEVENLABS_API_KEY"
                  />
                  <HelpText>
                    Environment variable name for the ElevenLabs API key
                  </HelpText>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseUrlEnvVar">Base URL Environment Variable</Label>
                  <Input
                    id="baseUrlEnvVar"
                    value={config.baseUrlEnvVar || ''}
                    onChange={(e) => handleConfigChange('baseUrlEnvVar', e.target.value)}
                    placeholder="ELEVENLABS_BASE_URL"
                  />
                  <HelpText>
                    Environment variable name for custom ElevenLabs base URL (optional)
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