"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Eye, 
  Save, 
  RotateCcw, 
  Settings, 
  Plus,
  AlertCircle,
  CheckCircle,
  Loader2,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SectionOrderManager } from './section-order-manager';
import { SectionConfigEditor } from './section-config-editor';
import { HomepagePreview } from './homepage-preview';
import { WaveConfigPanel } from './wave-config-panel';
import type { HomepageConfig, SectionConfig } from '@/components/homepage/section-renderer';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface HomepageEditorProps {
  className?: string;
}

interface EditorState {
  config: HomepageConfig | null;
  originalConfig: HomepageConfig | null;
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  selectedSectionId: string | null;
  showPreview: boolean;
  activeTab: 'sections' | 'wave-config';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HomepageEditor({ className }: HomepageEditorProps) {
  const { toast } = useToast();
  
  const [state, setState] = useState<EditorState>({
    config: null,
    originalConfig: null,
    hasUnsavedChanges: false,
    isLoading: true,
    isSaving: false,
    error: null,
    selectedSectionId: null,
    showPreview: false,
    activeTab: 'sections'
  });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchHomepageConfig = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/admin/homepage/config');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch homepage configuration');
      }
      
      const config = data.data.config;
      setState(prev => ({
        ...prev,
        config,
        originalConfig: JSON.parse(JSON.stringify(config)), // Deep copy
        isLoading: false,
        hasUnsavedChanges: false
      }));
      
    } catch (error) {
      console.error('Error fetching homepage config:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load configuration',
        isLoading: false
      }));
      
      toast({
        title: "Error",
        description: "Failed to load homepage configuration",
        variant: "destructive"
      });
    }
  };

  const saveHomepageConfig = async () => {
    if (!state.config) return;
    
    try {
      setState(prev => ({ ...prev, isSaving: true, error: null }));
      
      const response = await fetch('/api/admin/homepage/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(state.config)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save homepage configuration');
      }
      
      setState(prev => ({
        ...prev,
        originalConfig: JSON.parse(JSON.stringify(prev.config)), // Deep copy
        hasUnsavedChanges: false,
        isSaving: false
      }));
      
      toast({
        title: "Success",
        description: "Homepage configuration saved successfully",
        variant: "default"
      });
      
    } catch (error) {
      console.error('Error saving homepage config:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save configuration',
        isSaving: false
      }));
      
      toast({
        title: "Error",
        description: "Failed to save homepage configuration",
        variant: "destructive"
      });
    }
  };

  // ============================================================================
  // CONFIGURATION HANDLERS
  // ============================================================================

  const handleConfigChange = (newConfig: HomepageConfig) => {
    setState(prev => ({
      ...prev,
      config: newConfig,
      hasUnsavedChanges: JSON.stringify(newConfig) !== JSON.stringify(prev.originalConfig)
    }));
  };

  const handleSectionReorder = (sections: SectionConfig[]) => {
    if (!state.config) return;
    
    const newConfig = {
      ...state.config,
      sections
    };
    
    handleConfigChange(newConfig);
  };

  const handleSectionConfigChange = (sectionId: string, sectionConfig: Record<string, any>) => {
    if (!state.config) return;
    
    const newConfig = {
      ...state.config,
      sections: state.config.sections.map(section =>
        section.id === sectionId
          ? { ...section, config: sectionConfig }
          : section
      )
    };
    
    handleConfigChange(newConfig);
  };

  const handleSectionToggle = (sectionId: string, enabled: boolean) => {
    if (!state.config) return;
    
    const newConfig = {
      ...state.config,
      sections: state.config.sections.map(section =>
        section.id === sectionId
          ? { ...section, enabled }
          : section
      )
    };
    
    handleConfigChange(newConfig);
  };

  const handleGlobalThemeChange = (globalTheme: string) => {
    if (!state.config) return;
    
    const newConfig = {
      ...state.config,
      globalTheme
    };
    
    handleConfigChange(newConfig);
  };

  const handleLayoutChange = (layout: 'standard' | 'single-page' | 'multi-page') => {
    if (!state.config) return;
    
    const newConfig = {
      ...state.config,
      layout
    };
    
    handleConfigChange(newConfig);
  };

  const handleResetChanges = () => {
    if (!state.originalConfig) return;
    
    setState(prev => ({
      ...prev,
      config: JSON.parse(JSON.stringify(prev.originalConfig)), // Deep copy
      hasUnsavedChanges: false,
      selectedSectionId: null
    }));
    
    toast({
      title: "Changes Reset",
      description: "All unsaved changes have been discarded",
      variant: "default"
    });
  };

  const handlePreviewToggle = () => {
    setState(prev => ({ ...prev, showPreview: !prev.showPreview }));
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    fetchHomepageConfig();
  }, []);

  // Warn about unsaved changes when leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.hasUnsavedChanges]);

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

  const renderActionButtons = () => (
    <div className="flex items-center gap-2">
      {renderStatusIndicator()}
      
      <Button
        variant="outline"
        size="sm"
        onClick={handlePreviewToggle}
        className="flex items-center gap-2"
      >
        <Eye className="h-4 w-4" />
        {state.showPreview ? 'Hide Preview' : 'Preview'}
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
        onClick={saveHomepageConfig}
        disabled={!state.hasUnsavedChanges || state.isSaving}
        className="flex items-center gap-2"
      >
        <Save className="h-4 w-4" />
        Save Changes
      </Button>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading homepage configuration...</span>
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
            onClick={fetchHomepageConfig} 
            className="mt-4"
            variant="outline"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!state.config) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>No homepage configuration found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={state.activeTab === 'sections' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setState(prev => ({ ...prev, activeTab: 'sections' }))}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Sections
          </Button>
          <Button
            variant={state.activeTab === 'wave-config' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setState(prev => ({ ...prev, activeTab: 'wave-config' }))}
            className="flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            Wave Background
          </Button>
        </div>
        
        {renderActionButtons()}
      </div>

      {/* Preview Mode */}
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
                </CardTitle>
              </CardHeader>
              <CardContent>
                <HomepagePreview config={state.config} />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Editor Content */}
      {state.activeTab === 'sections' ? (
        /* Sections Configuration */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section Order Manager - Large Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Section Order & Visibility</CardTitle>
              <p className="text-sm text-muted-foreground">
                Drag to reorder sections and toggle their visibility
              </p>
            </CardHeader>
            <CardContent>
              <SectionOrderManager
                sections={state.config.sections}
                onReorder={handleSectionReorder}
                onToggleSection={handleSectionToggle}
                onSelectSection={(sectionId) => 
                  setState(prev => ({ ...prev, selectedSectionId: sectionId }))
                }
                selectedSectionId={state.selectedSectionId}
              />
            </CardContent>
          </Card>

          {/* Global Settings - Compact Card */}
          <Card>
            <CardHeader>
              <CardTitle>Global Settings</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure global theme and layout options
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Global Theme</label>
                <select
                  value={state.config.globalTheme}
                  onChange={(e) => handleGlobalThemeChange(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-md"
                >
                  <option value="default">Default</option>
                  <option value="dark">Dark</option>
                  <option value="minimal">Minimal</option>
                  <option value="colorful">Colorful</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Layout</label>
                <select
                  value={state.config.layout}
                  onChange={(e) => handleLayoutChange(e.target.value as any)}
                  className="w-full mt-1 p-2 border rounded-md"
                >
                  <option value="standard">Standard</option>
                  <option value="single-page">Single Page</option>
                  <option value="multi-page">Multi Page</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Section Configuration Editor - Full Width */}
          {state.selectedSectionId && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Section Configuration</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Configure the selected section's content and appearance
                </p>
              </CardHeader>
              <CardContent>
                <SectionConfigEditor
                  section={state.config.sections.find(s => s.id === state.selectedSectionId)!}
                  onConfigChange={(config) => 
                    handleSectionConfigChange(state.selectedSectionId!, config)
                  }
                />
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Wave Configuration */
        <WaveConfigPanel />
      )}
    </div>
  );
}