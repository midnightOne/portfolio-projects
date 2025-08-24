"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Monitor, 
  Tablet, 
  Smartphone, 
  Eye,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Homepage } from '@/components/homepage/homepage';
import { useProjects } from '@/hooks/use-projects';
import type { HomepageConfig } from '@/components/homepage/section-renderer';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface HomepagePreviewProps {
  config: HomepageConfig;
  className?: string;
}

type ViewportSize = 'desktop' | 'tablet' | 'mobile';

interface ViewportConfig {
  size: ViewportSize;
  width: string;
  height: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

// ============================================================================
// VIEWPORT CONFIGURATIONS
// ============================================================================

const VIEWPORT_CONFIGS: ViewportConfig[] = [
  {
    size: 'desktop',
    width: '100%',
    height: '600px',
    icon: Monitor,
    label: 'Desktop'
  },
  {
    size: 'tablet',
    width: '768px',
    height: '600px',
    icon: Tablet,
    label: 'Tablet'
  },
  {
    size: 'mobile',
    width: '375px',
    height: '600px',
    icon: Smartphone,
    label: 'Mobile'
  }
];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ViewportSelectorProps {
  currentViewport: ViewportSize;
  onViewportChange: (viewport: ViewportSize) => void;
}

function ViewportSelector({ currentViewport, onViewportChange }: ViewportSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      {VIEWPORT_CONFIGS.map((config) => {
        const Icon = config.icon;
        const isActive = currentViewport === config.size;
        
        return (
          <Button
            key={config.size}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onViewportChange(config.size)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 h-auto",
              isActive && "shadow-sm"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{config.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

interface PreviewFrameProps {
  config: HomepageConfig;
  viewport: ViewportSize;
  onRefresh: () => void;
}

function PreviewFrame({ config, viewport, onRefresh }: PreviewFrameProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [key, setKey] = useState(0); // Force re-render key
  
  // Get projects data for the preview
  const { projects, tags, loading: projectsLoading } = useProjects();
  
  const viewportConfig = VIEWPORT_CONFIGS.find(v => v.size === viewport)!;
  
  const handleRefresh = () => {
    setIsLoading(true);
    setKey(prev => prev + 1);
    onRefresh();
    
    // Simulate loading time
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  const handleOpenInNewTab = () => {
    // In a real implementation, this would open a preview URL
    // For now, we'll just show a message
    alert('Preview in new tab functionality would be implemented here');
  };

  return (
    <div className="space-y-4">
      {/* Preview Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {viewportConfig.label} Preview
          </Badge>
          {projectsLoading && (
            <Badge variant="secondary" className="text-xs">
              Loading Projects...
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenInNewTab}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open
          </Button>
        </div>
      </div>

      {/* Preview Container */}
      <div className="relative">
        <div 
          className={cn(
            "mx-auto bg-white border rounded-lg shadow-lg overflow-hidden transition-all duration-300",
            viewport === 'mobile' && "max-w-sm",
            viewport === 'tablet' && "max-w-3xl",
            viewport === 'desktop' && "w-full"
          )}
          style={{
            width: viewportConfig.width,
            height: viewportConfig.height
          }}
        >
          {/* Loading Overlay */}
          {(isLoading || projectsLoading) && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Loading preview...</span>
              </div>
            </div>
          )}
          
          {/* Preview Content */}
          <div 
            key={key}
            className="h-full overflow-auto"
            style={{
              fontSize: viewport === 'mobile' ? '14px' : '16px'
            }}
          >
            <Homepage 
              config={config}
              className="min-h-full"
              enableDynamicConfig={false}
            />
          </div>
        </div>
        
        {/* Viewport Size Indicator */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
          <Badge variant="secondary" className="text-xs">
            {viewportConfig.width} × {viewportConfig.height}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HomepagePreview({ config, className }: HomepagePreviewProps) {
  const [currentViewport, setCurrentViewport] = useState<ViewportSize>('desktop');
  const [refreshCount, setRefreshCount] = useState(0);

  const handleRefresh = () => {
    setRefreshCount(prev => prev + 1);
  };

  const handleViewportChange = (viewport: ViewportSize) => {
    setCurrentViewport(viewport);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-md">
            <Eye className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium">Homepage Preview</h3>
            <p className="text-sm text-muted-foreground">
              See how your homepage will look to visitors
            </p>
          </div>
        </div>
        
        <ViewportSelector
          currentViewport={currentViewport}
          onViewportChange={handleViewportChange}
        />
      </div>

      {/* Preview Frame */}
      <PreviewFrame
        config={config}
        viewport={currentViewport}
        onRefresh={handleRefresh}
      />

      {/* Configuration Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3">Configuration Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Sections:</span>
            <div className="mt-1">
              {config.sections.filter(s => s.enabled).length} enabled, {config.sections.filter(s => !s.enabled).length} disabled
            </div>
          </div>
          
          <div>
            <span className="text-muted-foreground">Theme:</span>
            <div className="mt-1 capitalize">
              {config.globalTheme || 'default'}
            </div>
          </div>
          
          <div>
            <span className="text-muted-foreground">Layout:</span>
            <div className="mt-1 capitalize">
              {config.layout || 'standard'}
            </div>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t">
          <span className="text-muted-foreground text-xs">Section Order:</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {config.sections
              .filter(s => s.enabled)
              .sort((a, b) => a.order - b.order)
              .map((section) => (
                <Badge key={section.id} variant="outline" className="text-xs">
                  {section.order}. {section.type}
                </Badge>
              ))}
          </div>
        </div>
      </div>

      {/* Preview Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Eye className="h-4 w-4 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">
              Preview Notes
            </h4>
            <ul className="text-xs text-blue-700 mt-1 space-y-1">
              <li>• This preview shows how your homepage will appear to visitors</li>
              <li>• Interactive features like project modals are fully functional</li>
              <li>• Changes are applied in real-time as you modify the configuration</li>
              <li>• Use different viewport sizes to test responsive behavior</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}