/**
 * Enhanced Navigation Bar - UI System
 * 
 * Enhanced NavigationBar with AI control hooks and advanced interaction capabilities.
 * Maintains backward compatibility while adding AI navigation and highlighting.
 */

"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, Grid, List, ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tag } from '@/lib/types/project';
import type { AIControlProps, NavigationCommand, HighlightOptions } from '@/lib/ui/types';

export type SortOption = 'relevance' | 'date' | 'title' | 'popularity';
export type ViewMode = 'grid' | 'list' | 'timeline';
export type TimelineGroupBy = 'year' | 'month';

interface EnhancedNavigationBarProps extends AIControlProps {
  tags: Tag[];
  selectedTags: string[];
  onTagSelect: (tags: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  timelineGroupBy?: TimelineGroupBy;
  onTimelineGroupByChange?: (groupBy: TimelineGroupBy) => void;
  isLoading?: boolean;
  // Progressive loading props
  canSearch?: boolean;
  canFilter?: boolean;
  tagsLoading?: boolean;
  loadingMessage?: string;
  // Search state
  isSearching?: boolean;
  searchResultsCount?: number;
  // Layout variant
  variant?: 'page' | 'section';
  // AI-specific props
  aiId?: string;
  animated?: boolean;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Date' },
  { value: 'title', label: 'Title' },
  { value: 'popularity', label: 'Popularity' },
];

// Enhanced Tag Filter Badge Component with AI capabilities
interface EnhancedTagFilterBadgeProps {
  tag: Tag;
  isSelected: boolean;
  canFilter: boolean;
  onClick: () => void;
  index: number;
  aiControlEnabled?: boolean;
  aiId?: string;
  onAINavigate?: (command: NavigationCommand) => void;
  onAIHighlight?: (target: string, options: HighlightOptions) => void;
}

function EnhancedTagFilterBadge({ 
  tag, 
  isSelected, 
  canFilter, 
  onClick, 
  index,
  aiControlEnabled = false,
  aiId,
  onAINavigate,
  onAIHighlight
}: EnhancedTagFilterBadgeProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isAIHighlighted, setIsAIHighlighted] = React.useState(false);

  // Handle AI navigation commands
  const handleAICommand = React.useCallback((command: NavigationCommand) => {
    if (onAINavigate) {
      onAINavigate(command);
    }
  }, [onAINavigate]);

  // Enhanced click handler
  const handleClick = React.useCallback(() => {
    onClick();

    // Notify AI system of tag interaction
    if (aiControlEnabled && onAINavigate) {
      const command: NavigationCommand = {
        action: 'navigate',
        target: `tag-${tag.id}`,
        metadata: {
          source: 'user',
          timestamp: Date.now(),
          sessionId: 'current',
        },
      };
      handleAICommand(command);
    }
  }, [onClick, aiControlEnabled, tag.id, onAINavigate, handleAICommand]);

  // Add AI-specific attributes
  const aiAttributes = aiControlEnabled ? {
    'data-ai-controllable': 'true',
    'data-ai-id': aiId || `tag-${tag.id}`,
    'data-ai-type': 'tag-filter',
    'data-ai-tag-id': tag.id,
    'data-ai-tag-name': tag.name,
  } : {};
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -10 }}
      transition={{ 
        delay: shouldReduceMotion ? 0 : index * 0.05,
        duration: shouldReduceMotion ? 0.1 : 0.3,
        ease: [0.21, 1.11, 0.81, 0.99]
      }}
      layout
      {...aiAttributes}
    >
      <motion.div
        whileHover={canFilter ? { scale: 1.05 } : {}}
        whileTap={canFilter ? { scale: 0.95 } : {}}
        animate={isAIHighlighted ? { 
          scale: 1.1,
          boxShadow: "0 0 0 2px var(--primary)"
        } : {}}
        transition={{ duration: 0.2 }}
      >
        <Badge
          variant={isSelected ? 'default' : 'outline'}
          className={cn(
            "cursor-pointer relative overflow-hidden",
            "transition-all duration-300 ease-out",
            canFilter && "hover:shadow-md",
            !canFilter && "opacity-50 cursor-not-allowed",
            isSelected && "ring-2 ring-primary/20 shadow-sm",
            isAIHighlighted && "ring-2 ring-primary"
          )}
          style={
            isSelected && tag.color
              ? { 
                  backgroundColor: tag.color, 
                  borderColor: tag.color,
                  color: getContrastColor(tag.color)
                }
              : undefined
          }
          onClick={handleClick}
        >
          {/* Animated background for selection state */}
          <motion.div
            className="absolute inset-0 bg-primary/10"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: isSelected ? 1 : 0, 
              opacity: isSelected ? 1 : 0 
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
          
          {/* Tag name with selection indicator */}
          <motion.span 
            className="relative z-10 flex items-center gap-1"
            layout
          >
            {tag.name}
            {isSelected && (
              <motion.span
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.3, ease: "backOut" }}
                className="text-xs"
              >
                ✓
              </motion.span>
            )}
          </motion.span>
          
          {/* Ripple effect on click */}
          <motion.div
            className="absolute inset-0 bg-white/20 rounded-full"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 4, opacity: [0, 1, 0] }}
            transition={{ duration: 0.4 }}
          />
        </Badge>
      </motion.div>
    </motion.div>
  );
}

// Helper function to determine text color based on background
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function EnhancedNavigationBar({
  tags,
  selectedTags,
  onTagSelect,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  timelineGroupBy = 'year',
  onTimelineGroupByChange,
  isLoading = false,
  canSearch = true,
  canFilter = true,
  tagsLoading = false,
  loadingMessage,
  isSearching = false,
  searchResultsCount,
  variant = 'page',
  aiControlEnabled = false,
  aiId = 'navigation-bar',
  onAINavigate,
  onAIHighlight,
  animated = true,
}: EnhancedNavigationBarProps) {
  const [showAllTags, setShowAllTags] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Use internal state for the input value to prevent focus loss
  const [internalSearchValue, setInternalSearchValue] = useState(searchQuery);

  // Handle AI navigation commands
  const handleAICommand = React.useCallback((command: NavigationCommand) => {
    if (onAINavigate) {
      onAINavigate(command);
    }
  }, [onAINavigate]);
  
  // Sync internal value with external prop when it changes from outside
  useEffect(() => {
    if (searchQuery !== internalSearchValue && document.activeElement !== searchInputRef.current) {
      setInternalSearchValue(searchQuery);
    }
  }, [searchQuery, internalSearchValue]);

  const handleTagClick = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onTagSelect(selectedTags.filter(t => t !== tagName));
    } else {
      onTagSelect([...selectedTags, tagName]);
    }

    // Notify AI system of tag selection
    if (aiControlEnabled && onAINavigate) {
      const command: NavigationCommand = {
        action: 'navigate',
        target: `tag-filter-${tagName}`,
        metadata: {
          source: 'user',
          timestamp: Date.now(),
          sessionId: 'current',
        },
      };
      handleAICommand(command);
    }
  };

  const clearFilters = () => {
    onTagSelect([]);
    setInternalSearchValue('');
    onSearchChange('');

    // Notify AI system of filter clear
    if (aiControlEnabled && onAINavigate) {
      const command: NavigationCommand = {
        action: 'navigate',
        target: 'clear-filters',
        metadata: {
          source: 'user',
          timestamp: Date.now(),
          sessionId: 'current',
        },
      };
      handleAICommand(command);
    }
  };

  const clearSearchOnly = () => {
    setInternalSearchValue('');
    onSearchChange('');
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 0);
  };

  const handleSearchChange = (value: string) => {
    setInternalSearchValue(value);
    if (canSearch) {
      onSearchChange(value);
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    onViewModeChange(mode);

    // Notify AI system of view mode change
    if (aiControlEnabled && onAINavigate) {
      const command: NavigationCommand = {
        action: 'navigate',
        target: `view-mode-${mode}`,
        metadata: {
          source: 'user',
          timestamp: Date.now(),
          sessionId: 'current',
        },
      };
      handleAICommand(command);
    }
  };

  const handleSortChange = (sort: SortOption) => {
    onSortChange(sort);
    setSortDropdownOpen(false);

    // Notify AI system of sort change
    if (aiControlEnabled && onAINavigate) {
      const command: NavigationCommand = {
        action: 'navigate',
        target: `sort-${sort}`,
        metadata: {
          source: 'user',
          timestamp: Date.now(),
          sessionId: 'current',
        },
      };
      handleAICommand(command);
    }
  };

  const visibleTags = showAllTags ? tags : tags.slice(0, 8);
  const hasMoreTags = tags.length > 8;

  const containerClasses = variant === 'page' 
    ? "sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b"
    : "mb-6";

  const innerClasses = variant === 'page'
    ? "container mx-auto px-4 py-4"
    : "px-4 py-4";

  // Add AI-specific attributes
  const aiAttributes = aiControlEnabled ? {
    'data-ai-controllable': 'true',
    'data-ai-id': aiId,
    'data-ai-type': 'navigation-bar',
  } : {};

  return (
    <div className={containerClasses} {...aiAttributes}>
      <div className={innerClasses}>
        {/* Search and Controls Row */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md" data-ai-id={`${aiId}-search`}>
            <Search className={cn(
              "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 z-10",
              isSearching ? "text-primary animate-pulse" : "text-muted-foreground"
            )} />
            <Input
              ref={searchInputRef}
              placeholder={canSearch ? "Search projects..." : "Loading projects..."}
              value={internalSearchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={cn(
                "pl-10 pr-12",
                isSearching && "border-primary/50"
              )}
              data-ai-id={`${aiId}-search-input`}
            />
            
            {/* Right side icons */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              {/* Clear search button */}
              <AnimatePresence>
                {internalSearchValue && canSearch && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    onClick={clearSearchOnly}
                    className="p-2 hover:bg-muted rounded-md transition-colors flex items-center justify-center min-w-[28px] min-h-[28px]"
                    type="button"
                    aria-label="Clear search"
                    data-ai-id={`${aiId}-clear-search`}
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </motion.button>
                )}
              </AnimatePresence>
              
              {/* Loading spinner */}
              {isSearching && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="p-2 flex items-center justify-center min-w-[28px] min-h-[28px]"
                >
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </motion.div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2" data-ai-id={`${aiId}-controls`}>
            {/* Sort Dropdown */}
            <div className="relative">
              <EnhancedButton
                variant="outline"
                onClick={() => canSearch && setSortDropdownOpen(!sortDropdownOpen)}
                disabled={isLoading || !canSearch}
                className="min-w-[120px] justify-between"
                aiControlEnabled={aiControlEnabled}
                aiId={`${aiId}-sort-button`}
                onAINavigate={onAINavigate}
              >
                {canSearch ? `Sort: ${sortOptions.find(opt => opt.value === sortBy)?.label}` : 'Loading...'}
                <ChevronDown className="h-4 w-4" />
              </EnhancedButton>
              
              <AnimatePresence>
                {sortDropdownOpen && (
                  <motion.div 
                    className="absolute top-full mt-1 right-0 bg-background border rounded-md shadow-lg z-50 min-w-[120px] overflow-hidden"
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    data-ai-id={`${aiId}-sort-dropdown`}
                  >
                    {sortOptions.map((option, index) => (
                      <motion.button
                        key={option.value}
                        onClick={() => handleSortChange(option.value)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                          sortBy === option.value && "bg-accent text-accent-foreground"
                        )}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.2 }}
                        whileHover={{ backgroundColor: "var(--accent)" }}
                        data-ai-id={`${aiId}-sort-option-${option.value}`}
                      >
                        {option.label}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* View Mode Toggle */}
            <div className="flex border rounded-md" data-ai-id={`${aiId}-view-mode`}>
              <EnhancedButton
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => canSearch && handleViewModeChange('grid')}
                disabled={isLoading || !canSearch}
                className="rounded-r-none"
                title="Grid View"
                aiControlEnabled={aiControlEnabled}
                aiId={`${aiId}-grid-view`}
                onAINavigate={onAINavigate}
              >
                <Grid className="h-4 w-4" />
              </EnhancedButton>
              <EnhancedButton
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => canSearch && handleViewModeChange('list')}
                disabled={isLoading || !canSearch}
                className="rounded-none border-l"
                title="List View"
                aiControlEnabled={aiControlEnabled}
                aiId={`${aiId}-list-view`}
                onAINavigate={onAINavigate}
              >
                <List className="h-4 w-4" />
              </EnhancedButton>
              <EnhancedButton
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => canSearch && handleViewModeChange('timeline')}
                disabled={isLoading || !canSearch}
                className="rounded-l-none border-l"
                title="Timeline View"
                aiControlEnabled={aiControlEnabled}
                aiId={`${aiId}-timeline-view`}
                onAINavigate={onAINavigate}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </EnhancedButton>
            </div>

            {/* Timeline Group By Toggle */}
            {viewMode === 'timeline' && onTimelineGroupByChange && (
              <div className="flex border rounded-md" data-ai-id={`${aiId}-timeline-group`}>
                <EnhancedButton
                  variant={timelineGroupBy === 'year' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => canSearch && onTimelineGroupByChange('year')}
                  disabled={isLoading || !canSearch}
                  className="rounded-r-none text-xs px-2"
                  aiControlEnabled={aiControlEnabled}
                  aiId={`${aiId}-group-year`}
                  onAINavigate={onAINavigate}
                >
                  Year
                </EnhancedButton>
                <EnhancedButton
                  variant={timelineGroupBy === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => canSearch && onTimelineGroupByChange('month')}
                  disabled={isLoading || !canSearch}
                  className="rounded-l-none border-l text-xs px-2"
                  aiControlEnabled={aiControlEnabled}
                  aiId={`${aiId}-group-month`}
                  onAINavigate={onAINavigate}
                >
                  Month
                </EnhancedButton>
              </div>
            )}

            {/* Clear Filters */}
            <AnimatePresence>
              {(selectedTags.length > 0 || internalSearchValue) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <EnhancedButton
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    disabled={isLoading || (!canSearch && !canFilter)}
                    className="transition-all duration-200 hover:scale-105 hover:bg-destructive hover:text-destructive-foreground"
                    aiControlEnabled={aiControlEnabled}
                    aiId={`${aiId}-clear-filters`}
                    onAINavigate={onAINavigate}
                  >
                    Clear
                  </EnhancedButton>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Tags Filter Row */}
        <div className="flex flex-wrap items-center gap-2" data-ai-id={`${aiId}-tags`}>
          <motion.div 
            className="flex items-center gap-1 text-sm text-muted-foreground"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Filter className="h-4 w-4" />
            <span>Filter:</span>
          </motion.div>
          
          {/* Show loading skeletons when tags are loading */}
          {tagsLoading ? (
            <motion.div 
              className="flex gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {Array.from({ length: 5 }).map((_, index) => (
                <motion.div
                  key={index}
                  className="h-6 bg-muted rounded-full animate-pulse"
                  style={{ width: `${Math.random() * 40 + 40}px` }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                />
              ))}
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              <motion.div 
                className="flex flex-wrap gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                {visibleTags.map((tag, index) => (
                  <EnhancedTagFilterBadge
                    key={tag.id}
                    tag={tag}
                    isSelected={selectedTags.includes(tag.name)}
                    canFilter={canFilter && !isLoading}
                    onClick={() => canFilter && !isLoading && handleTagClick(tag.name)}
                    index={index}
                    aiControlEnabled={aiControlEnabled}
                    aiId={`${aiId}-tag-${tag.id}`}
                    onAINavigate={onAINavigate}
                    onAIHighlight={onAIHighlight}
                  />
                ))}

                {hasMoreTags && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: visibleTags.length * 0.05, duration: 0.3 }}
                  >
                    <EnhancedButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllTags(!showAllTags)}
                      disabled={isLoading || !canFilter}
                      className="text-xs transition-all duration-200 hover:scale-105"
                      aiControlEnabled={aiControlEnabled}
                      aiId={`${aiId}-show-more-tags`}
                      onAINavigate={onAINavigate}
                    >
                      {showAllTags ? 'Show Less' : `+${tags.length - 8} More`}
                    </EnhancedButton>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Loading Status Message */}
        {loadingMessage && (
          <div className="mt-3 pt-3 border-t" data-ai-id={`${aiId}-loading-message`}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>{loadingMessage}</span>
            </div>
          </div>
        )}

        {/* Search Results Summary */}
        <AnimatePresence>
          {(internalSearchValue || selectedTags.length > 0) && (
            <motion.div 
              className="mt-3 pt-3 border-t"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              data-ai-id={`${aiId}-results-summary`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {internalSearchValue && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      {isSearching ? (
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                          Searching...
                        </span>
                      ) : 
                       searchResultsCount !== undefined ? 
                       `${searchResultsCount} result${searchResultsCount !== 1 ? 's' : ''} for "${internalSearchValue}"` :
                       `Results for "${internalSearchValue}"`}
                    </motion.span>
                  )}
                  {internalSearchValue && selectedTags.length > 0 && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      •
                    </motion.span>
                  )}
                  {selectedTags.length > 0 && (
                    <motion.div
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <span>Filtered by:</span>
                      <div className="flex flex-wrap gap-1">
                        <AnimatePresence>
                          {selectedTags.map((tagName, index) => (
                            <motion.div
                              key={tagName}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ 
                                delay: index * 0.05,
                                duration: 0.2 
                              }}
                            >
                              <Badge variant="secondary" className="text-xs">
                                {tagName}
                              </Badge>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export type { EnhancedNavigationBarProps };