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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, TestTube, Save, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { ButtonLoadingState } from '@/components/ui/loading-indicator';
import { HelpText } from '@/components/ui/help-text';
import { GoogleLiveConfig } from '@/types/voice-config';
import { GoogleLiveSerializer } from '@/lib/voice/config-serializers/GoogleLiveSerializer';

interface GoogleLiveConfigPanelProps {
  initialConfig?: GoogleLiveConfig;
  onSave: (config: GoogleLiveConfig) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

// Live-capable model availability is account-specific and shifts often (verify via
// "Test Configuration", which lists every model supporting bidiGenerateContent).
const GOOGLE_LIVE_MODELS = [
  { value: 'gemini-2.5-flash-native-audio-latest', label: 'Gemini 2.5 Flash (Native Audio)' },
];

const GOOGLE_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'];

export function GoogleLiveConfigPanel({
  initialConfig,
  onSave,
  onCancel,
  saving = false
}: GoogleLiveConfigPanelProps) {
  const toast = useToast();
  const serializer = useMemo(() => new GoogleLiveSerializer(), []);

  const [config, setConfig] = useState<GoogleLiveConfig>(
    initialConfig || serializer.getDefaultConfig()
  );

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const validation = serializer.validate(config);
    setIsValid(validation.valid);
    setValidationErrors(validation.errors.map(e => `${e.field}: ${e.message}`));
  }, [config, serializer]);

  const handleConfigChange = (field: keyof GoogleLiveConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
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
        body: JSON.stringify({ provider: 'google', config })
      });
      const result = await response.json();
      if (result.success) {
        setTestResult({ success: true, message: result.message || 'Configuration test successful' });
        toast.success('Test successful', 'Google connection is working correctly');
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
      await onSave({ ...config, isDefault: false } as any);
    } catch (err) {
      // Error handling is done in parent component
    }
  };

  const handleReset = () => {
    setConfig(initialConfig || serializer.getDefaultConfig());
    setTestResult(null);
  };

  return (
    <div className="space-y-6">
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {validationErrors.map((error, i) => <li key={i}>{error}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {testResult && (
        <Alert variant={testResult.success ? 'default' : 'destructive'}>
          {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{testResult.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gemini Live Configuration</CardTitle>
          <CardDescription>
            Native speech-to-speech via the Gemini Live API (WebSocket + v1alpha ephemeral tokens, D22)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enabled</Label>
              <HelpText>Whether this configuration is available for use</HelpText>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              value={config.displayName}
              onChange={(e) => handleConfigChange('displayName', e.target.value)}
              placeholder="Gemini Live"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={config.model} onValueChange={(value) => handleConfigChange('model', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOOGLE_LIVE_MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Voice</Label>
              <Select value={config.voice} onValueChange={(value) => handleConfigChange('voice', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOOGLE_VOICES.map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Temperature: {config.temperature}</Label>
            <Slider
              value={[config.temperature]}
              onValueChange={([value]) => handleConfigChange('temperature', value)}
              min={0}
              max={2}
              step={0.1}
            />
          </div>

          <div className="space-y-2">
            <Label>Instructions</Label>
            <Textarea
              value={config.instructions}
              onChange={(e) => handleConfigChange('instructions', e.target.value)}
              rows={4}
            />
            <HelpText>Base system instructions — the session mint route appends tool-usage and language-policy guidance</HelpText>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Reasoning (Thinking)</Label>
              <HelpText>Off by default — real-time voice favors low latency. When on, the reasoning trace is captured separately and stored/displayed as collapsible, never spoken aloud.</HelpText>
            </div>
            <Switch
              checked={config.enableReasoning}
              onCheckedChange={(checked) => handleConfigChange('enableReasoning', checked)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Response Modality</Label>
              <Select
                value={config.responseModality}
                onValueChange={(value) => handleConfigChange('responseModality', value as 'AUDIO' | 'TEXT')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUDIO">AUDIO (speaks)</SelectItem>
                  <SelectItem value="TEXT">TEXT (silent debug fallback)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Max Session Seconds</Label>
              <Input
                type="number"
                value={config.maxSessionSeconds}
                onChange={(e) => handleConfigChange('maxSessionSeconds', parseInt(e.target.value, 10) || 0)}
                min={30}
                max={3600}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label>Input Transcription</Label>
              <Switch
                checked={config.transcription.input}
                onCheckedChange={(checked) => handleConfigChange('transcription', { ...config.transcription, input: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Output Transcription</Label>
              <Switch
                checked={config.transcription.output}
                onCheckedChange={(checked) => handleConfigChange('transcription', { ...config.transcription, output: checked })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Capabilities</Label>
            <div className="flex flex-wrap gap-2">
              {config.capabilities.map((capability) => (
                <Badge key={capability} variant="secondary">{capability}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-6 border-t">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleTestConfiguration} disabled={!isValid || testing} className="flex items-center gap-2">
            <ButtonLoadingState isLoading={testing} loadingText="Testing...">
              {!testing && <TestTube className="h-4 w-4" />}
              Test Configuration
            </ButtonLoadingState>
          </Button>
          <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isValid || saving} className="flex items-center gap-2">
            <ButtonLoadingState isLoading={saving} loadingText="Saving...">
              {!saving && <Save className="h-4 w-4" />}
              Save Configuration
            </ButtonLoadingState>
          </Button>
        </div>
      </div>
    </div>
  );
}
