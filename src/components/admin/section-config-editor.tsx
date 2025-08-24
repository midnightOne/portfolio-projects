"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Save, 
  RotateCcw, 
  Eye, 
  Palette,
  Layout,
  Type,
  Link,
  Image,
  Users,
  Mail
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { SectionConfig } from '@/components/homepage/section-renderer';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface SectionConfigEditorProps {
  section: SectionConfig;
  onConfigChange: (config: Record<string, any>) => void;
  className?: string;
}

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'boolean' | 'number' | 'array' | 'url';
  description?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

// ============================================================================
// CONFIGURATION SCHEMAS
// ============================================================================

const SECTION_CONFIG_SCHEMAS: Record<string, ConfigField[]> = {
  hero: [
    {
      key: 'title',
      label: 'Title',
      type: 'text',
      description: 'Main heading text',
      placeholder: 'Your Name',
      required: true
    },
    {
      key: 'subtitle',
      label: 'Subtitle',
      type: 'text',
      description: 'Secondary heading text',
      placeholder: 'Your Title/Role',
      required: true
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
      description: 'Brief introduction text',
      placeholder: 'A brief introduction about yourself...'
    },
    {
      key: 'ctaText',
      label: 'Call-to-Action Text',
      type: 'text',
      description: 'Button text',
      placeholder: 'View My Work'
    },
    {
      key: 'ctaLink',
      label: 'Call-to-Action Link',
      type: 'url',
      description: 'Button destination (use #section-name for internal links)',
      placeholder: '#projects'
    },
    {
      key: 'backgroundImage',
      label: 'Background Image URL',
      type: 'url',
      description: 'Optional background image',
      placeholder: 'https://example.com/image.jpg'
    },
    {
      key: 'showScrollIndicator',
      label: 'Show Scroll Indicator',
      type: 'boolean',
      description: 'Display scroll down indicator'
    },
    {
      key: 'theme',
      label: 'Theme',
      type: 'select',
      description: 'Visual theme for this section',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'dark', label: 'Dark' },
        { value: 'minimal', label: 'Minimal' },
        { value: 'colorful', label: 'Colorful' }
      ]
    }
  ],
  
  about: [
    {
      key: 'content',
      label: 'Content',
      type: 'textarea',
      description: 'Main about text',
      placeholder: 'Tell your story here...',
      required: true
    },
    {
      key: 'skills',
      label: 'Skills',
      type: 'array',
      description: 'List of skills (comma-separated)',
      placeholder: 'React, TypeScript, Node.js'
    },
    {
      key: 'showSkills',
      label: 'Show Skills',
      type: 'boolean',
      description: 'Display skills list'
    },
    {
      key: 'profileImage',
      label: 'Profile Image URL',
      type: 'url',
      description: 'Optional profile image',
      placeholder: 'https://example.com/profile.jpg'
    },
    {
      key: 'layout',
      label: 'Layout',
      type: 'select',
      description: 'Section layout style',
      options: [
        { value: 'side-by-side', label: 'Side by Side' },
        { value: 'image-first', label: 'Image First' },
        { value: 'text-first', label: 'Text First' },
        { value: 'centered', label: 'Centered' }
      ]
    },
    {
      key: 'theme',
      label: 'Theme',
      type: 'select',
      description: 'Visual theme for this section',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'dark', label: 'Dark' },
        { value: 'minimal', label: 'Minimal' },
        { value: 'colorful', label: 'Colorful' }
      ]
    }
  ],
  
  projects: [
    {
      key: 'config.title',
      label: 'Section Title',
      type: 'text',
      description: 'Title for the projects section',
      placeholder: 'Featured Projects'
    },
    {
      key: 'config.maxItems',
      label: 'Max Items',
      type: 'number',
      description: 'Maximum number of projects to show (0 for all)',
      placeholder: '6'
    },
    {
      key: 'config.layout',
      label: 'Layout',
      type: 'select',
      description: 'How projects are displayed',
      options: [
        { value: 'grid', label: 'Grid' },
        { value: 'timeline', label: 'Timeline' },
        { value: 'carousel', label: 'Carousel' }
      ]
    },
    {
      key: 'config.columns',
      label: 'Grid Columns',
      type: 'select',
      description: 'Number of columns for grid layout',
      options: [
        { value: '2', label: '2 Columns' },
        { value: '3', label: '3 Columns' },
        { value: '4', label: '4 Columns' }
      ]
    },
    {
      key: 'config.showSearch',
      label: 'Show Search',
      type: 'boolean',
      description: 'Display search functionality'
    },
    {
      key: 'config.showFilters',
      label: 'Show Filters',
      type: 'boolean',
      description: 'Display tag filters'
    },
    {
      key: 'config.showSorting',
      label: 'Show Sorting',
      type: 'boolean',
      description: 'Display sort options'
    },
    {
      key: 'config.showViewToggle',
      label: 'Show View Toggle',
      type: 'boolean',
      description: 'Allow switching between grid/timeline'
    },
    {
      key: 'config.theme',
      label: 'Theme',
      type: 'select',
      description: 'Visual theme for this section',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'dark', label: 'Dark' },
        { value: 'minimal', label: 'Minimal' },
        { value: 'colorful', label: 'Colorful' }
      ]
    }
  ],
  
  contact: [
    {
      key: 'title',
      label: 'Title',
      type: 'text',
      description: 'Section title',
      placeholder: 'Get In Touch'
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
      description: 'Contact section description',
      placeholder: 'I\'m always interested in new opportunities...'
    },
    {
      key: 'email',
      label: 'Email Address',
      type: 'text',
      description: 'Contact email address',
      placeholder: 'your@email.com'
    },
    {
      key: 'showContactForm',
      label: 'Show Contact Form',
      type: 'boolean',
      description: 'Display contact form'
    },
    {
      key: 'theme',
      label: 'Theme',
      type: 'select',
      description: 'Visual theme for this section',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'dark', label: 'Dark' },
        { value: 'minimal', label: 'Minimal' },
        { value: 'colorful', label: 'Colorful' }
      ]
    }
  ],
  
  custom: [
    {
      key: 'title',
      label: 'Title',
      type: 'text',
      description: 'Section title',
      placeholder: 'Custom Section'
    },
    {
      key: 'content',
      label: 'Content',
      type: 'textarea',
      description: 'Section content',
      placeholder: 'Add your custom content here...',
      required: true
    },
    {
      key: 'theme',
      label: 'Theme',
      type: 'select',
      description: 'Visual theme for this section',
      options: [
        { value: 'default', label: 'Default' },
        { value: 'dark', label: 'Dark' },
        { value: 'minimal', label: 'Minimal' },
        { value: 'colorful', label: 'Colorful' }
      ]
    }
  ]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): any {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
  return { ...obj };
}

function getSectionIcon(type: string) {
  const icons = {
    hero: Type,
    about: Users,
    projects: Layout,
    contact: Mail,
    custom: Palette
  };
  
  const Icon = icons[type as keyof typeof icons] || Palette;
  return <Icon className="h-4 w-4" />;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ConfigFieldEditorProps {
  field: ConfigField;
  value: any;
  onChange: (value: any) => void;
}

function ConfigFieldEditor({ field, value, onChange }: ConfigFieldEditorProps) {
  const handleChange = (newValue: any) => {
    onChange(newValue);
  };

  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'url':
        return (
          <Input
            type={field.type === 'url' ? 'url' : 'text'}
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full"
          />
        );
      
      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full resize-none"
          />
        );
      
      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full p-2 border border-input rounded-md bg-background"
          >
            <option value="">Select...</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={Boolean(value)}
              onCheckedChange={handleChange}
            />
            <span className="text-sm text-muted-foreground">
              {Boolean(value) ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        );
      
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(Number(e.target.value) || 0)}
            placeholder={field.placeholder}
            className="w-full"
          />
        );
      
      case 'array':
        return (
          <div className="space-y-2">
            <Input
              type="text"
              value={Array.isArray(value) ? value.join(', ') : (value || '')}
              onChange={(e) => {
                const arrayValue = e.target.value
                  .split(',')
                  .map(item => item.trim())
                  .filter(item => item.length > 0);
                handleChange(arrayValue);
              }}
              placeholder={field.placeholder}
              className="w-full"
            />
            {Array.isArray(value) && value.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {value.map((item, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full"
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
      
      {field.description && (
        <p className="text-xs text-muted-foreground">
          {field.description}
        </p>
      )}
      
      {renderField()}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SectionConfigEditor({
  section,
  onConfigChange,
  className
}: SectionConfigEditorProps) {
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState(section.config);
  const [hasChanges, setHasChanges] = useState(false);

  // Get configuration schema for this section type
  const configSchema = SECTION_CONFIG_SCHEMAS[section.type] || [];

  // Update local config when section changes
  useEffect(() => {
    setLocalConfig(section.config);
    setHasChanges(false);
  }, [section.config]);

  // Handle field changes
  const handleFieldChange = (fieldKey: string, value: any) => {
    const newConfig = setNestedValue({ ...localConfig }, fieldKey, value);
    setLocalConfig(newConfig);
    setHasChanges(JSON.stringify(newConfig) !== JSON.stringify(section.config));
  };

  // Apply changes
  const handleApplyChanges = () => {
    onConfigChange(localConfig);
    setHasChanges(false);
    
    toast({
      title: "Configuration Updated",
      description: `${section.type} section configuration has been updated`,
      variant: "default"
    });
  };

  // Reset changes
  const handleResetChanges = () => {
    setLocalConfig(section.config);
    setHasChanges(false);
    
    toast({
      title: "Changes Reset",
      description: "Configuration has been reset to saved values",
      variant: "default"
    });
  };

  if (configSchema.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">
          No configuration options available for {section.type} sections.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md">
            {getSectionIcon(section.type)}
          </div>
          <div>
            <h3 className="font-medium">
              {section.type.charAt(0).toUpperCase() + section.type.slice(1)} Section
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure the content and appearance of this section
            </p>
          </div>
        </div>
        
        {hasChanges && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetChanges}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleApplyChanges}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Apply Changes
            </Button>
          </div>
        )}
      </div>

      {/* Configuration Fields */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-6">
            {configSchema.map((field) => (
              <ConfigFieldEditor
                key={field.key}
                field={field}
                value={getNestedValue(localConfig, field.key)}
                onChange={(value) => handleFieldChange(field.key, value)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Eye className="h-4 w-4 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">
              Live Preview
            </h4>
            <p className="text-xs text-blue-700 mt-1">
              Changes will be reflected in the preview once you apply them. 
              Use the main "Preview" button to see how your homepage will look.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}