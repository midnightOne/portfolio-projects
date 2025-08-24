"use client";

import React, { useState } from 'react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  GripVertical, 
  Eye, 
  EyeOff, 
  Settings, 
  Home,
  User,
  FolderOpen,
  Mail,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectionConfig } from '@/components/homepage/section-renderer';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface SectionOrderManagerProps {
  sections: SectionConfig[];
  onReorder: (sections: SectionConfig[]) => void;
  onToggleSection: (sectionId: string, enabled: boolean) => void;
  onSelectSection: (sectionId: string) => void;
  selectedSectionId: string | null;
  className?: string;
}

interface SectionItemProps {
  section: SectionConfig;
  isSelected: boolean;
  onToggle: (enabled: boolean) => void;
  onSelect: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSectionIcon(type: string) {
  const icons = {
    hero: Home,
    about: User,
    projects: FolderOpen,
    contact: Mail,
    custom: Plus
  };
  
  const Icon = icons[type as keyof typeof icons] || Plus;
  return <Icon className="h-4 w-4" />;
}

function getSectionDisplayName(type: string) {
  const names = {
    hero: 'Hero Section',
    about: 'About Section',
    projects: 'Projects Section',
    contact: 'Contact Section',
    custom: 'Custom Section'
  };
  
  return names[type as keyof typeof names] || 'Unknown Section';
}

function getSectionDescription(section: SectionConfig) {
  switch (section.type) {
    case 'hero':
      return section.config.title || 'Hero section with title and call-to-action';
    case 'about':
      return 'About section with personal information and skills';
    case 'projects':
      const projectConfig = section.config.config || {};
      return `Projects section (${projectConfig.maxItems || 'all'} items, ${projectConfig.layout || 'grid'} layout)`;
    case 'contact':
      return section.config.title || 'Contact section with social links';
    case 'custom':
      return section.config.title || 'Custom content section';
    default:
      return 'Section configuration';
  }
}

function getSectionThemeColor(type: string, enabled: boolean) {
  if (!enabled) return 'bg-gray-100 border-gray-200';
  
  const colors = {
    hero: 'bg-blue-50 border-blue-200',
    about: 'bg-green-50 border-green-200',
    projects: 'bg-purple-50 border-purple-200',
    contact: 'bg-orange-50 border-orange-200',
    custom: 'bg-gray-50 border-gray-200'
  };
  
  return colors[type as keyof typeof colors] || 'bg-gray-50 border-gray-200';
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function SectionItem({ section, isSelected, onToggle, onSelect }: SectionItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'group relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200',
        getSectionThemeColor(section.type, section.enabled),
        isSelected && 'ring-2 ring-primary ring-offset-2',
        !section.enabled && 'opacity-60'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
      </div>

      {/* Content */}
      <div className="ml-6 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {/* Section Icon */}
          <div className={cn(
            'p-2 rounded-md',
            section.enabled ? 'bg-white/80' : 'bg-gray-200'
          )}>
            {getSectionIcon(section.type)}
          </div>

          {/* Section Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">
                {getSectionDisplayName(section.type)}
              </h3>
              <Badge variant="outline" className="text-xs">
                Order: {section.order}
              </Badge>
              {isSelected && (
                <Badge variant="default" className="text-xs">
                  Selected
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {getSectionDescription(section)}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Visibility Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              checked={section.enabled}
              onCheckedChange={onToggle}
              onClick={(e) => e.stopPropagation()}
            />
            {section.enabled ? (
              <Eye className="h-4 w-4 text-green-600" />
            ) : (
              <EyeOff className="h-4 w-4 text-gray-400" />
            )}
          </div>

          {/* Configure Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={cn(
              'opacity-0 group-hover:opacity-100 transition-opacity',
              isSelected && 'opacity-100'
            )}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <motion.div
          layoutId="selection-indicator"
          className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 px-4">
      <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Plus className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        No sections configured
      </h3>
      <p className="text-gray-500 mb-4">
        Get started by adding your first homepage section.
      </p>
      <Button variant="outline">
        <Plus className="h-4 w-4 mr-2" />
        Add Section
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SectionOrderManager({
  sections,
  onReorder,
  onToggleSection,
  onSelectSection,
  selectedSectionId,
  className
}: SectionOrderManagerProps) {
  // Sort sections by order for display
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  const handleReorder = (newSections: SectionConfig[]) => {
    // Update the order property based on new positions
    const reorderedSections = newSections.map((section, index) => ({
      ...section,
      order: index + 1
    }));
    
    onReorder(reorderedSections);
  };

  const handleToggle = (sectionId: string, enabled: boolean) => {
    onToggleSection(sectionId, enabled);
  };

  const handleSelect = (sectionId: string) => {
    onSelectSection(sectionId);
  };

  if (sections.length === 0) {
    return (
      <div className={className}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-blue-100 rounded">
            <GripVertical className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-blue-900">
              Drag & Drop to Reorder
            </h4>
            <p className="text-xs text-blue-700 mt-1">
              Drag sections to reorder them on your homepage. Use the toggle to show/hide sections, 
              and click on a section to configure its content.
            </p>
          </div>
        </div>
      </div>

      {/* Section List */}
      <Reorder.Group
        axis="y"
        values={sortedSections}
        onReorder={handleReorder}
        className="space-y-3"
      >
        <AnimatePresence>
          {sortedSections.map((section) => (
            <Reorder.Item
              key={section.id}
              value={section}
              className="cursor-grab active:cursor-grabbing"
            >
              <SectionItem
                section={section}
                isSelected={selectedSectionId === section.id}
                onToggle={(enabled) => handleToggle(section.id, enabled)}
                onSelect={() => handleSelect(section.id)}
              />
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
        <span>
          {sections.length} section{sections.length !== 1 ? 's' : ''} total
        </span>
        <span>
          {sections.filter(s => s.enabled).length} visible, {sections.filter(s => !s.enabled).length} hidden
        </span>
      </div>
    </div>
  );
}