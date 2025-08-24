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
  Mail,
  Settings
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
      description: 'Main heading text (your name or brand)',
      placeholder: 'Your Name',
      required: true
    },
    {
      key: 'subtitle',
      label: 'Subtitle',
      type: 'text',
      description: 'Secondary heading text (your role or tagline)',
      placeholder: 'Your Title/Role',
      required: true
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
      description: 'Brief introduction text (2-3 sentences about what you do)',
      placeholder: 'A brief introduction about yourself and what you do...'
    },
    {
      key: 'ctaText',
      label: 'Call-to-Action Text',
      type: 'text',
      description: 'Primary button text',
      placeholder: 'View My Work'
    },
    {
      key: 'ctaLink',
      label: 'Call-to-Action Link',
      type: 'url',
      description: 'Button destination (use #section-name for internal links, or full URLs)',
      placeholder: '#projects'
    },
    {
      key: 'backgroundImage',
      label: 'Background Image URL',
      type: 'url',
      description: 'Optional hero background image (high resolution recommended)',
      placeholder: 'https://example.com/hero-background.jpg'
    },
    {
      key: 'showScrollIndicator',
      label: 'Show Scroll Indicator',
      type: 'boolean',
      description: 'Display animated scroll down indicator at bottom'
    },
    {
      key: 'layout',
      label: 'Layout Style',
      type: 'select',
      description: 'Hero section layout and content arrangement',
      options: [
        { value: 'centered', label: 'Centered (Default)' },
        { value: 'left-aligned', label: 'Left Aligned' },
        { value: 'split', label: 'Split Layout' },
        { value: 'minimal', label: 'Minimal' }
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
  
  about: [
    {
      key: 'title',
      label: 'Section Title',
      type: 'text',
      description: 'Title for the about section',
      placeholder: 'About Me'
    },
    {
      key: 'content',
      label: 'About Content',
      type: 'textarea',
      description: 'Main about text - tell your professional story, background, and what drives you',
      placeholder: 'Tell your story here... Include your background, experience, and what you\'re passionate about.',
      required: true
    },
    {
      key: 'skills',
      label: 'Skills & Technologies',
      type: 'array',
      description: 'List of skills and technologies (comma-separated). Use "skill:category" format for grouping.',
      placeholder: 'React, TypeScript:Frontend, Node.js:Backend, Python:Languages, AWS:Cloud'
    },
    {
      key: 'showSkills',
      label: 'Show Skills Section',
      type: 'boolean',
      description: 'Display skills and technologies list'
    },
    {
      key: 'profileImage',
      label: 'Profile Image URL',
      type: 'url',
      description: 'Professional profile photo (square aspect ratio recommended)',
      placeholder: 'https://example.com/profile.jpg'
    },
    {
      key: 'showProfileImage',
      label: 'Show Profile Image',
      type: 'boolean',
      description: 'Display profile image in the section'
    },
    {
      key: 'layout',
      label: 'Layout Style',
      type: 'select',
      description: 'How content and image are arranged',
      options: [
        { value: 'side-by-side', label: 'Side by Side (Image + Text)' },
        { value: 'image-first', label: 'Image First (Stacked)' },
        { value: 'text-first', label: 'Text First (Stacked)' },
        { value: 'centered', label: 'Centered (Text Only)' },
        { value: 'stacked', label: 'Stacked (Image + Text + Skills)' }
      ]
    },
    {
      key: 'highlightAchievements',
      label: 'Highlight Achievements',
      type: 'boolean',
      description: 'Emphasize key achievements or metrics in the content'
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
      key: 'config.description',
      label: 'Section Description',
      type: 'textarea',
      description: 'Optional description text below the title',
      placeholder: 'A showcase of my recent work and projects...'
    },
    {
      key: 'config.variant',
      label: 'Section Type',
      type: 'select',
      description: 'Configure for homepage or full-page display',
      options: [
        { value: 'homepage', label: 'Homepage (Featured Projects)' },
        { value: 'full-page', label: 'Full Page (All Projects)' },
        { value: 'featured', label: 'Featured Only' }
      ]
    },
    {
      key: 'config.maxItems',
      label: 'Max Items (Homepage)',
      type: 'number',
      description: 'Maximum number of projects to show on homepage (0 for all)',
      placeholder: '6'
    },
    {
      key: 'config.layout',
      label: 'Layout Style',
      type: 'select',
      description: 'How projects are displayed',
      options: [
        { value: 'grid', label: 'Grid Layout' },
        { value: 'timeline', label: 'Timeline Layout' },
        { value: 'list', label: 'List Layout' },
        { value: 'carousel', label: 'Carousel Layout' }
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
      label: 'Enable Search',
      type: 'boolean',
      description: 'Display search functionality (recommended for full-page)'
    },
    {
      key: 'config.showFilters',
      label: 'Enable Tag Filters',
      type: 'boolean',
      description: 'Display tag-based filtering (recommended for full-page)'
    },
    {
      key: 'config.showSorting',
      label: 'Enable Sorting',
      type: 'boolean',
      description: 'Display sort options (date, title, popularity)'
    },
    {
      key: 'config.showViewToggle',
      label: 'Enable View Toggle',
      type: 'boolean',
      description: 'Allow switching between grid/timeline/list views'
    },
    {
      key: 'config.showViewCount',
      label: 'Show View Counts',
      type: 'boolean',
      description: 'Display project view statistics'
    },
    {
      key: 'config.openMode',
      label: 'Project Open Mode',
      type: 'select',
      description: 'How projects open when clicked',
      options: [
        { value: 'modal', label: 'Modal Overlay' },
        { value: 'page', label: 'Dedicated Page' }
      ]
    },
    {
      key: 'config.spacing',
      label: 'Spacing',
      type: 'select',
      description: 'Spacing between project items',
      options: [
        { value: 'compact', label: 'Compact' },
        { value: 'normal', label: 'Normal' },
        { value: 'spacious', label: 'Spacious' }
      ]
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
      label: 'Section Title',
      type: 'text',
      description: 'Title for the contact section',
      placeholder: 'Get In Touch'
    },
    {
      key: 'description',
      label: 'Section Description',
      type: 'textarea',
      description: 'Description text that appears below the title',
      placeholder: 'I\'m always interested in new opportunities and collaborations. Let\'s connect!'
    },
    {
      key: 'email',
      label: 'Primary Email Address',
      type: 'text',
      description: 'Your main contact email address',
      placeholder: 'your@email.com'
    },
    {
      key: 'showContactForm',
      label: 'Enable Contact Form',
      type: 'boolean',
      description: 'Display an interactive contact form for visitors'
    },
    {
      key: 'socialLinks',
      label: 'Social Links',
      type: 'array',
      description: 'Social media and professional links (format: "platform:url" or "label:url:icon")',
      placeholder: 'GitHub:https://github.com/username, LinkedIn:https://linkedin.com/in/username, Twitter:https://twitter.com/username'
    },
    {
      key: 'showSocialLinks',
      label: 'Show Social Links',
      type: 'boolean',
      description: 'Display social media and professional links'
    },
    {
      key: 'contactMethods',
      label: 'Additional Contact Methods',
      type: 'array',
      description: 'Other ways to contact you (format: "method:value")',
      placeholder: 'Phone:+1-555-0123, Location:San Francisco, CA, Timezone:PST'
    },
    {
      key: 'showContactMethods',
      label: 'Show Contact Methods',
      type: 'boolean',
      description: 'Display additional contact information'
    },
    {
      key: 'layout',
      label: 'Layout Style',
      type: 'select',
      description: 'How contact information is arranged',
      options: [
        { value: 'form-and-info', label: 'Form + Contact Info' },
        { value: 'form-only', label: 'Contact Form Only' },
        { value: 'info-only', label: 'Contact Info Only' },
        { value: 'centered', label: 'Centered Layout' }
      ]
    },
    {
      key: 'enableFormNotifications',
      label: 'Form Notifications',
      type: 'boolean',
      description: 'Send email notifications when contact form is submitted'
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
// CONFIGURATION PRESETS
// ============================================================================

const SECTION_PRESETS: Record<string, Record<string, any>> = {
  hero: {
    'Professional': {
      theme: 'default',
      layout: 'centered',
      showScrollIndicator: true,
      ctaText: 'View My Work',
      ctaLink: '#projects'
    },
    'Minimal': {
      theme: 'minimal',
      layout: 'left-aligned',
      showScrollIndicator: false,
      ctaText: 'Explore',
      ctaLink: '/projects'
    },
    'Creative': {
      theme: 'colorful',
      layout: 'split',
      showScrollIndicator: true,
      ctaText: 'See My Projects',
      ctaLink: '#projects'
    }
  },
  about: {
    'Professional': {
      layout: 'side-by-side',
      showSkills: true,
      showProfileImage: true,
      highlightAchievements: true,
      theme: 'default'
    },
    'Skills Focused': {
      layout: 'stacked',
      showSkills: true,
      showProfileImage: true,
      highlightAchievements: false,
      theme: 'default'
    },
    'Personal': {
      layout: 'image-first',
      showSkills: false,
      showProfileImage: true,
      highlightAchievements: false,
      theme: 'minimal'
    }
  },
  projects: {
    'Homepage Featured': {
      'config.variant': 'homepage',
      'config.maxItems': 6,
      'config.layout': 'grid',
      'config.columns': '3',
      'config.showSearch': false,
      'config.showFilters': false,
      'config.showSorting': false,
      'config.openMode': 'modal',
      'config.theme': 'default'
    },
    'Full Portfolio': {
      'config.variant': 'full-page',
      'config.maxItems': 0,
      'config.layout': 'grid',
      'config.columns': '3',
      'config.showSearch': true,
      'config.showFilters': true,
      'config.showSorting': true,
      'config.showViewToggle': true,
      'config.openMode': 'modal',
      'config.theme': 'default'
    },
    'Timeline View': {
      'config.variant': 'full-page',
      'config.layout': 'timeline',
      'config.showSearch': true,
      'config.showFilters': true,
      'config.showViewToggle': false,
      'config.openMode': 'page',
      'config.theme': 'default'
    }
  },
  contact: {
    'Full Contact': {
      showContactForm: true,
      showSocialLinks: true,
      showContactMethods: true,
      layout: 'form-and-info',
      enableFormNotifications: true,
      theme: 'default'
    },
    'Form Only': {
      showContactForm: true,
      showSocialLinks: false,
      showContactMethods: false,
      layout: 'form-only',
      enableFormNotifications: true,
      theme: 'default'
    },
    'Links Only': {
      showContactForm: false,
      showSocialLinks: true,
      showContactMethods: true,
      layout: 'info-only',
      enableFormNotifications: false,
      theme: 'minimal'
    }
  }
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ConfigFieldEditorProps {
  field: ConfigField;
  value: any;
  onChange: (value: any) => void;
}

interface PresetSelectorProps {
  sectionType: string;
  onApplyPreset: (preset: Record<string, any>) => void;
  className?: string;
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
            <Textarea
              value={Array.isArray(value) ? value.join(', ') : (value || '')}
              onChange={(e) => {
                const arrayValue = e.target.value
                  .split(',')
                  .map(item => item.trim())
                  .filter(item => item.length > 0);
                handleChange(arrayValue);
              }}
              placeholder={field.placeholder}
              rows={3}
              className="w-full resize-none"
            />
            {Array.isArray(value) && value.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {value.length} item{value.length !== 1 ? 's' : ''}:
                </p>
                <div className="flex flex-wrap gap-1">
                  {value.map((item, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {item.length > 30 ? `${item.substring(0, 30)}...` : item}
                    </Badge>
                  ))}
                </div>
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

function PresetSelector({ sectionType, onApplyPreset, className }: PresetSelectorProps) {
  const presets = SECTION_PRESETS[sectionType] || {};
  const presetNames = Object.keys(presets);

  if (presetNames.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Quick Presets</Label>
      </div>
      <div className="flex flex-wrap gap-2">
        {presetNames.map((presetName) => (
          <Button
            key={presetName}
            variant="outline"
            size="sm"
            onClick={() => onApplyPreset(presets[presetName])}
            className="text-xs"
          >
            {presetName}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Apply a preset configuration to quickly set up common layouts and settings.
      </p>
    </div>
  );
}

interface ConfigSummaryProps {
  sectionType: string;
  config: Record<string, any>;
  className?: string;
}

function ConfigSummary({ sectionType, config, className }: ConfigSummaryProps) {
  const getSummaryText = () => {
    switch (sectionType) {
      case 'hero':
        return `${config.layout || 'centered'} layout with ${config.theme || 'default'} theme${config.backgroundImage ? ', custom background' : ''}`;
      
      case 'about':
        return `${config.layout || 'side-by-side'} layout${config.showSkills ? ' with skills' : ''}${config.showProfileImage ? ' and profile image' : ''}`;
      
      case 'projects':
        const variant = config.config?.variant || 'homepage';
        const layout = config.config?.layout || 'grid';
        const maxItems = config.config?.maxItems || 'all';
        return `${variant} variant, ${layout} layout${maxItems !== 'all' && maxItems > 0 ? `, max ${maxItems} items` : ''}`;
      
      case 'contact':
        const features = [];
        if (config.showContactForm) features.push('contact form');
        if (config.showSocialLinks) features.push('social links');
        if (config.showContactMethods) features.push('contact methods');
        return features.length > 0 ? `Includes ${features.join(', ')}` : 'Basic contact section';
      
      default:
        return 'Custom configuration';
    }
  };

  return (
    <div className={cn('bg-muted/50 rounded-lg p-3', className)}>
      <div className="flex items-start gap-2">
        <Settings className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div>
          <p className="text-sm font-medium">Current Configuration</p>
          <p className="text-xs text-muted-foreground mt-1">
            {getSummaryText()}
          </p>
        </div>
      </div>
    </div>
  );
}

interface SectionHelpProps {
  sectionType: string;
  className?: string;
}

function SectionHelp({ sectionType, className }: SectionHelpProps) {
  const getHelpContent = () => {
    switch (sectionType) {
      case 'hero':
        return {
          title: 'Hero Section Tips',
          tips: [
            'Keep your title concise and memorable - this is the first thing visitors see',
            'Use a subtitle to clarify your role or value proposition',
            'Background images should be high resolution (1920x1080 or larger)',
            'Internal links use # format (e.g., #projects), external links use full URLs'
          ]
        };
      
      case 'about':
        return {
          title: 'About Section Tips',
          tips: [
            'Tell your professional story - background, experience, and what drives you',
            'Use "skill:category" format to group skills (e.g., "React:Frontend, AWS:Cloud")',
            'Profile images work best in square aspect ratio (1:1)',
            'Side-by-side layout works well for longer content with skills'
          ]
        };
      
      case 'projects':
        return {
          title: 'Projects Section Tips',
          tips: [
            'Homepage variant shows featured projects, full-page shows all projects',
            'Grid layout with 3 columns works well for most screen sizes',
            'Enable search and filters for full-page variant to help visitors find projects',
            'Modal mode keeps visitors on the same page, page mode provides dedicated URLs'
          ]
        };
      
      case 'contact':
        return {
          title: 'Contact Section Tips',
          tips: [
            'Use format "platform:url" for social links (e.g., "GitHub:https://github.com/username")',
            'Contact form submissions can be configured to send email notifications',
            'Include multiple contact methods to give visitors options',
            'Form + info layout works well for comprehensive contact sections'
          ]
        };
      
      default:
        return null;
    }
  };

  const helpContent = getHelpContent();
  
  if (!helpContent) {
    return null;
  }

  return (
    <div className={cn('bg-blue-50 border border-blue-200 rounded-lg p-4', className)}>
      <div className="flex items-start gap-3">
        <div className="p-1 bg-blue-100 rounded">
          <Eye className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            {helpContent.title}
          </h4>
          <ul className="space-y-1">
            {helpContent.tips.map((tip, index) => (
              <li key={index} className="text-xs text-blue-700 flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
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

  // Apply preset
  const handleApplyPreset = (preset: Record<string, any>) => {
    const newConfig = { ...localConfig };
    
    // Apply preset values
    Object.entries(preset).forEach(([key, value]) => {
      setNestedValue(newConfig, key, value);
    });
    
    setLocalConfig(newConfig);
    setHasChanges(JSON.stringify(newConfig) !== JSON.stringify(section.config));
    
    toast({
      title: "Preset Applied",
      description: `Configuration preset has been applied to ${section.type} section`,
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

      {/* Quick Presets */}
      <Card>
        <CardContent className="pt-6">
          <PresetSelector
            sectionType={section.type}
            onApplyPreset={handleApplyPreset}
          />
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      <ConfigSummary
        sectionType={section.type}
        config={localConfig}
      />

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

      {/* Section-Specific Help */}
      <SectionHelp sectionType={section.type} />

      {/* Preview Note */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Eye className="h-4 w-4 text-green-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-green-900">
              Live Preview
            </h4>
            <p className="text-xs text-green-700 mt-1">
              Changes will be reflected in the preview once you apply them. 
              Use the main "Preview" button to see how your homepage will look.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}