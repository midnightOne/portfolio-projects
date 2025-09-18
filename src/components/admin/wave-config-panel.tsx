"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Palette,
  Settings,
  Zap,
  Camera,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WaveEngine, type WaveConfiguration } from '@/components/ui/wave-background/wave-engine';
import { defaultWaveConfig } from '@/lib/constants/wave-config';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface WaveConfigPanelProps {
  className?: string;
}

interface WaveConfigState {
  config: WaveConfiguration;
  originalConfig: WaveConfiguration;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  showPreview: boolean;
  previewDimensions: { width: number; height: number };
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// ============================================================================
// COLOR PICKER COMPONENT
// ============================================================================

function ColorPicker({ label, value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-8 rounded border border-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-1 text-sm border border-border rounded"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// ============================================================================
// PARAMETER SLIDER COMPONENT
// ============================================================================

interface ParameterSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  className?: string;
}

function ParameterSlider({ label, value, onChange, min, max, step, className }: ParameterSliderProps) {
  // Handle undefined/null values gracefully
  const safeValue = value ?? 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-sm text-muted-foreground">{safeValue.toFixed(3)}</span>
      </div>
      <Slider
        value={[safeValue]}
        onValueChange={([newValue]) => onChange(newValue)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WaveConfigPanel({ className }: WaveConfigPanelProps) {
  const { toast } = useToast();
  const { theme, systemTheme } = useTheme();
  const currentTheme = (theme === 'system' ? systemTheme : theme) as 'light' | 'dark';

  const [state, setState] = useState<WaveConfigState>({
    config: defaultWaveConfig,
    originalConfig: defaultWaveConfig,
    hasUnsavedChanges: false,
    isLoading: true,
    isSaving: false,
    error: null,
    showPreview: false,
    previewDimensions: { width: 800, height: 400 }
  });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchWaveConfig = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/admin/homepage/wave-config');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch wave configuration');
      }

      const config = { ...defaultWaveConfig, ...data.data.config };
      setState(prev => ({
        ...prev,
        config,
        originalConfig: JSON.parse(JSON.stringify(config)),
        isLoading: false,
        hasUnsavedChanges: false
      }));

    } catch (error) {
      console.error('Error fetching wave config:', error);
      // Use default config even on error to prevent missing fields
      const config = { ...defaultWaveConfig };
      setState(prev => ({
        ...prev,
        config,
        originalConfig: JSON.parse(JSON.stringify(config)),
        error: error instanceof Error ? error.message : 'Failed to load configuration',
        isLoading: false
      }));

      toast({
        title: "Error",
        description: "Failed to load wave configuration",
        variant: "destructive"
      });
    }
  }, [toast]);

  const saveWaveConfig = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isSaving: true, error: null }));

      const response = await fetch('/api/admin/homepage/wave-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(state.config)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save wave configuration');
      }

      setState(prev => ({
        ...prev,
        originalConfig: JSON.parse(JSON.stringify(prev.config)),
        hasUnsavedChanges: false,
        isSaving: false
      }));

      toast({
        title: "Success",
        description: "Wave configuration saved successfully",
        variant: "default"
      });

    } catch (error) {
      console.error('Error saving wave config:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save configuration',
        isSaving: false
      }));

      toast({
        title: "Error",
        description: "Failed to save wave configuration",
        variant: "destructive"
      });
    }
  }, [state.config, toast]);

  // ============================================================================
  // CONFIGURATION HANDLERS
  // ============================================================================

  const handleConfigChange = useCallback((updates: Partial<WaveConfiguration>) => {
    setState(prev => {
      const newConfig = { ...prev.config, ...updates };
      return {
        ...prev,
        config: newConfig,
        hasUnsavedChanges: JSON.stringify(newConfig) !== JSON.stringify(prev.originalConfig)
      };
    });
  }, []);

  const handleCameraChange = useCallback((cameraConfig: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    zoom: number;
    target: { x: number; y: number; z: number };
  }) => {

    handleConfigChange({
      cameraPosition: cameraConfig.position,
      cameraRotation: cameraConfig.rotation,
      cameraZoom: cameraConfig.zoom,
      cameraTarget: cameraConfig.target
    });
  }, [handleConfigChange]);

  const handleColorChange = useCallback((theme: 'light' | 'dark', colorKey: keyof WaveConfiguration['lightTheme'], value: string) => {
    setState(prev => {
      const newConfig = {
        ...prev.config,
        [theme === 'light' ? 'lightTheme' : 'darkTheme']: {
          ...prev.config[theme === 'light' ? 'lightTheme' : 'darkTheme'],
          [colorKey]: value
        }
      };
      return {
        ...prev,
        config: newConfig,
        hasUnsavedChanges: JSON.stringify(newConfig) !== JSON.stringify(prev.originalConfig)
      };
    });
  }, []);

  const handleResetChanges = useCallback(() => {
    setState(prev => ({
      ...prev,
      config: JSON.parse(JSON.stringify(prev.originalConfig)),
      hasUnsavedChanges: false
    }));

    toast({
      title: "Changes Reset",
      description: "All unsaved changes have been discarded",
      variant: "default"
    });
  }, [toast]);

  const handlePresetApply = useCallback(async (presetName: string) => {
    try {
      const response = await fetch('/api/admin/homepage/wave-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'get-presets' })
      });

      const data = await response.json();
      if (response.ok && data.data.presets[presetName]) {
        handleConfigChange(data.data.presets[presetName]);
        toast({
          title: "Preset Applied",
          description: `Applied ${presetName} preset configuration`,
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error applying preset:', error);
      toast({
        title: "Error",
        description: "Failed to apply preset",
        variant: "destructive"
      });
    }
  }, [handleConfigChange, toast]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    fetchWaveConfig();
  }, [fetchWaveConfig]);

  useEffect(() => {
    const updatePreviewDimensions = () => {
      setState(prev => ({
        ...prev,
        previewDimensions: {
          width: Math.min(800, window.innerWidth - 100),
          height: Math.min(400, window.innerHeight / 3)
        }
      }));
    };

    updatePreviewDimensions();
    window.addEventListener('resize', updatePreviewDimensions);
    return () => window.removeEventListener('resize', updatePreviewDimensions);
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderStatusIndicator = () => {
    if (state.isSaving) {
      return (
        <div className="flex items-center gap-2 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Saving...</span>
        </div>
      );
    }

    if (state.hasUnsavedChanges) {
      return (
        <div className="flex items-center gap-2 text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Unsaved changes</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm">All changes saved</span>
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading wave configuration...</span>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{state.error}</span>
          </div>
          <Button
            onClick={fetchWaveConfig}
            className="mt-4"
            variant="outline"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Wave Background Configuration</h2>
          <p className="text-muted-foreground">Configure the 3D wave animation for the hero section</p>
        </div>

        <div className="flex items-center gap-2">
          {renderStatusIndicator()}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setState(prev => ({ ...prev, showPreview: !prev.showPreview }))}
            className="flex items-center gap-2"
          >
            {state.showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {state.showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>

          {state.hasUnsavedChanges && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetChanges}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          )}

          <Button
            onClick={saveWaveConfig}
            disabled={!state.hasUnsavedChanges || state.isSaving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Preview */}
      <AnimatePresence>
        {state.showPreview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Live Preview
                  <Badge variant="secondary" className="ml-2">
                    {currentTheme || 'light'} theme
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-background">
                  <WaveEngine
                    config={state.config}
                    theme={currentTheme || 'light'}
                    width={state.previewDimensions.width}
                    height={state.previewDimensions.height}
                    className="w-full"
                    interactive={true}
                    onCameraChange={handleCameraChange}
                  />
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>🖱️ <strong>Left click + drag:</strong> Rotate camera around target</p>
                  <p>🖱️ <strong>Middle click + drag:</strong> Pan camera target</p>
                  <p>🖱️ <strong>Scroll wheel:</strong> Zoom in/out</p>
                  <p>🖱️ <strong>Double click:</strong> Reset camera to default position</p>
                  <p className="mt-2 text-xs text-amber-600">💡 Camera changes are saved automatically when you save the configuration</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Configuration Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Wave Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Wave Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ParameterSlider
              label="Waves X"
              value={state.config.wavesX}
              onChange={(value) => handleConfigChange({ wavesX: value })}
              min={0.5}
              max={10.0}
              step={0.1}
            />
            <ParameterSlider
              label="Waves Y"
              value={state.config.wavesY}
              onChange={(value) => handleConfigChange({ wavesY: value })}
              min={0.5}
              max={10.0}
              step={0.1}
            />
            <ParameterSlider
              label="Amplitude"
              value={state.config.displacementHeight}
              onChange={(value) => handleConfigChange({ displacementHeight: value })}
              min={0.0}
              max={2.0}
              step={0.1}
            />
            <ParameterSlider
              label="Speed X"
              value={state.config.speedX}
              onChange={(value) => handleConfigChange({ speedX: value })}
              min={0.0}
              max={0.005}
              step={0.0001}
            />
            <ParameterSlider
              label="Speed Y"
              value={state.config.speedY}
              onChange={(value) => handleConfigChange({ speedY: value })}
              min={0.0}
              max={0.005}
              step={0.0001}
            />
            <ParameterSlider
              label="Cylinder Bend"
              value={state.config.cylinderBend}
              onChange={(value) => handleConfigChange({ cylinderBend: value })}
              min={0.0}
              max={1.0}
              step={0.1}
            />
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Colors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-medium mb-3">Light Theme</h4>
              <div className="space-y-3">
                <ColorPicker
                  label="Primary Color"
                  value={state.config.lightTheme.primaryColor}
                  onChange={(value) => handleColorChange('light', 'primaryColor', value)}
                />
                <ColorPicker
                  label="Valley Color"
                  value={state.config.lightTheme.valleyColor}
                  onChange={(value) => handleColorChange('light', 'valleyColor', value)}
                />
                <ColorPicker
                  label="Peak Color"
                  value={state.config.lightTheme.peakColor}
                  onChange={(value) => handleColorChange('light', 'peakColor', value)}
                />
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3">Dark Theme</h4>
              <div className="space-y-3">
                <ColorPicker
                  label="Primary Color"
                  value={state.config.darkTheme.primaryColor}
                  onChange={(value) => handleColorChange('dark', 'primaryColor', value)}
                />
                <ColorPicker
                  label="Valley Color"
                  value={state.config.darkTheme.valleyColor}
                  onChange={(value) => handleColorChange('dark', 'valleyColor', value)}
                />
                <ColorPicker
                  label="Peak Color"
                  value={state.config.darkTheme.peakColor}
                  onChange={(value) => handleColorChange('dark', 'peakColor', value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Effects & Camera */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Effects & Camera
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ParameterSlider
              label="Iridescence Width"
              value={state.config.iridescenceWidth}
              onChange={(value) => handleConfigChange({ iridescenceWidth: value })}
              min={1.0}
              max={50.0}
              step={1.0}
            />
            <ParameterSlider
              label="Iridescence Speed"
              value={state.config.iridescenceSpeed}
              onChange={(value) => handleConfigChange({ iridescenceSpeed: value })}
              min={0.0}
              max={0.01}
              step={0.001}
            />
            <ParameterSlider
              label="Flow Mix Amount"
              value={state.config.flowMixAmount}
              onChange={(value) => handleConfigChange({ flowMixAmount: value })}
              min={0.0}
              max={1.0}
              step={0.1}
            />
            <ParameterSlider
              label="Reveal Animation Speed"
              value={state.config.revealAnimationSpeed}
              onChange={(value) => handleConfigChange({ revealAnimationSpeed: value })}
              min={0.5}
              max={10.0}
              step={0.1}
            />

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Camera Position
              </h4>
              <ParameterSlider
                label="Position X"
                value={state.config.cameraPosition.x}
                onChange={(value) => handleConfigChange({
                  cameraPosition: { ...state.config.cameraPosition, x: value }
                })}
                min={-10.0}
                max={10.0}
                step={0.1}
              />
              <ParameterSlider
                label="Position Y"
                value={state.config.cameraPosition.y}
                onChange={(value) => handleConfigChange({
                  cameraPosition: { ...state.config.cameraPosition, y: value }
                })}
                min={-10.0}
                max={10.0}
                step={0.1}
              />
              <ParameterSlider
                label="Position Z"
                value={state.config.cameraPosition.z}
                onChange={(value) => handleConfigChange({
                  cameraPosition: { ...state.config.cameraPosition, z: value }
                })}
                min={1.0}
                max={15.0}
                step={0.1}
              />

              <h4 className="font-medium mb-3 mt-4 flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Camera Rotation
              </h4>
              <ParameterSlider
                label="Rotation X (Pitch)"
                value={state.config.cameraRotation.x}
                onChange={(value) => handleConfigChange({
                  cameraRotation: { ...state.config.cameraRotation, x: value }
                })}
                min={-90}
                max={90}
                step={1}
              />
              <ParameterSlider
                label="Rotation Y (Yaw)"
                value={state.config.cameraRotation.y}
                onChange={(value) => handleConfigChange({
                  cameraRotation: { ...state.config.cameraRotation, y: value }
                })}
                min={-180}
                max={180}
                step={1}
              />
              <ParameterSlider
                label="Rotation Z (Roll)"
                value={state.config.cameraRotation.z}
                onChange={(value) => handleConfigChange({
                  cameraRotation: { ...state.config.cameraRotation, z: value }
                })}
                min={-180}
                max={180}
                step={1}
              />

              <h4 className="font-medium mb-3 mt-4 flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Camera Target & Zoom
              </h4>
              <ParameterSlider
                label="Target X"
                value={state.config.cameraTarget.x}
                onChange={(value) => handleConfigChange({
                  cameraTarget: { ...state.config.cameraTarget, x: value }
                })}
                min={-5.0}
                max={5.0}
                step={0.1}
              />
              <ParameterSlider
                label="Target Y"
                value={state.config.cameraTarget.y}
                onChange={(value) => handleConfigChange({
                  cameraTarget: { ...state.config.cameraTarget, y: value }
                })}
                min={-5.0}
                max={5.0}
                step={0.1}
              />
              <ParameterSlider
                label="Target Z"
                value={state.config.cameraTarget.z}
                onChange={(value) => handleConfigChange({
                  cameraTarget: { ...state.config.cameraTarget, z: value }
                })}
                min={-5.0}
                max={5.0}
                step={0.1}
              />
              <ParameterSlider
                label="Zoom"
                value={state.config.cameraZoom}
                onChange={(value) => handleConfigChange({ cameraZoom: value })}
                min={0.1}
                max={5.0}
                step={0.1}
              />
            </div>
          </CardContent>
        </Card>

        {/* Presets */}
        <Card className="lg:col-span-2 xl:col-span-3">
          <CardHeader>
            <CardTitle>Presets</CardTitle>
            <p className="text-sm text-muted-foreground">
              Quick configurations for different visual styles
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => handlePresetApply('startup')}
                className="flex items-center gap-2"
              >
                Startup Theme
              </Button>
              <Button
                variant="outline"
                onClick={() => handlePresetApply('ocean')}
                className="flex items-center gap-2"
              >
                Ocean Waves
              </Button>
              <Button
                variant="outline"
                onClick={() => handlePresetApply('tunnel')}
                className="flex items-center gap-2"
              >
                Cylinder Tunnel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}