"use client";

import React, { useState } from 'react';
import { Search, Filter, Grid, List, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tag } from '@/lib/types/project';

export type SortOption = 'relevance' | 'date' | 'title' | 'popularity';
export type ViewMode = 'grid' | 'timeline';

interface NavigationBarProps {
  tags: Tag[];
  selectedTags: string[];
  onTagSelect: (tags: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isLoading?: boolean;
  // Progressive loading props
  canSearch?: boolean;
  canFilter?: boolean;
  tagsLoading?: boolean;
  loadingMessage?: string;
  // Search state
  isSearching?: boolean;
  searchResultsCount?: number;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Date' },
  { value: 'title', label: 'Title' },
  { value: 'popularity', label: 'Popularity' },
];

// Enhanced Tag Filter Badge Component with animations
interface TagFilterBadgeProps {
  tag: Tag;
  isSelected: boolean;
  canFilter: boolean;
  onClick: () => void;
  index: number;
}

function TagFilterBadge({ tag, isSelected, canFilter, onClick, index }: TagFilterBadgeProps) {
  const shouldReduceMotion = useReducedMotion();
  
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
    >
      <motion.div
        whileHover={canFilter ? { scale: 1.05 } : {}}
        whileTap={canFilter ? { scale: 0.95 } : {}}
        transition={{ duration: 0.2 }}
      >
        <Badge
          variant={isSelected ? 'default' : 'outline'}
          className={cn(
            "cursor-pointer relative overflow-hidden",
            "transition-all duration-300 ease-out",
            canFilter && "hover:shadow-md",
            !canFilter && "opacity-50 cursor-not-allowed",
            isSelected && "ring-2 ring-primary/20 shadow-sm"
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
          onClick={onClick}
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
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black or white based on luminance
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function NavigationBar({
  tags,
  selectedTags,
  onTagSelect,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  isLoading = false,
  canSearch = true,
  canFilter = true,
  tagsLoading = false,
  loadingMessage,
  isSearching = false,
  searchResultsCount,
}: NavigationBarProps) {
  const [showAllTags, setShowAllTags] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  const handleTagClick = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onTagSelect(selectedTags.filter(t => t !== tagName));
    } else {
      onTagSelect([...selectedTags, tagName]);
    }
  };

  const clearFilters = () => {
    onTagSelect([]);
    onSearchChange('');
  };

  const visibleTags = showAllTags ? tags : tags.slice(0, 8);
  const hasMoreTags = tags.length > 8;

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4 py-4">
        {/* Search and Controls Row */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className={cn(
              "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4",
              isSearching ? "text-primary animate-pulse" : "text-muted-foreground"
            )} />
            <Input
              placeholder={canSearch ? "Search projects..." : "Loading projects..."}
              value={searchQuery}
              onChange={(e) => canSearch && onSearchChange(e.target.value)}
              className={cn(
                "pl-10",
                isSearching && "border-primary/50"
              )}
              disabled={isLoading || !canSearch}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Sort Dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => canSearch && setSortDropdownOpen(!sortDropdownOpen)}
                disabled={isLoading || !canSearch}
                className="min-w-[120px] justify-between"
              >
                {canSearch ? `Sort: ${sortOptions.find(opt => opt.value === sortBy)?.label}` : 'Loading...'}
                <ChevronDown className="h-4 w-4" />
              </Button>
              
              <AnimatePresence>
                {sortDropdownOpen && (
                  <motion.div 
                    className="absolute top-full mt-1 right-0 bg-background border rounded-md shadow-lg z-50 min-w-[120px] overflow-hidden"
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    {sortOptions.map((option, index) => (
                      <motion.button
                        key={option.value}
                        onClick={() => {
                          onSortChange(option.value);
                          setSortDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                          sortBy === option.value && "bg-accent text-accent-foreground"
                        )}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.2 }}
                        whileHover={{ backgroundColor: "var(--accent)" }}
                      >
                        {option.label}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* View Mode Toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => canSearch && onViewModeChange('grid')}
                disabled={isLoading || !canSearch}
                className="rounded-r-none"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => canSearch && onViewModeChange('timeline')}
                disabled={isLoading || !canSearch}
                className="rounded-l-none border-l"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Clear Filters */}
            <AnimatePresence>
              {(selectedTags.length > 0 || searchQuery) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    disabled={isLoading || (!canSearch && !canFilter)}
                    className="transition-all duration-200 hover:scale-105 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    Clear
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Tags Filter Row */}
        <div className="flex flex-wrap items-center gap-2">
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
                  <TagFilterBadge
                    key={tag.id}
                    tag={tag}
                    isSelected={selectedTags.includes(tag.name)}
                    canFilter={canFilter && !isLoading}
                    onClick={() => canFilter && !isLoading && handleTagClick(tag.name)}
                    index={index}
                  />
                ))}

                {hasMoreTags && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: visibleTags.length * 0.05, duration: 0.3 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllTags(!showAllTags)}
                      disabled={isLoading || !canFilter}
                      className="text-xs transition-all duration-200 hover:scale-105"
                    >
                      {showAllTags ? 'Show Less' : `+${tags.length - 8} More`}
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Loading Status Message */}
        {loadingMessage && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>{loadingMessage}</span>
            </div>
          </div>
        )}

        {/* Search Results Summary */}
        <AnimatePresence>
          {(searchQuery || selectedTags.length > 0) && (
            <motion.div 
              className="mt-3 pt-3 border-t"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {searchQuery && (
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
                       `${searchResultsCount} result${searchResultsCount !== 1 ? 's' : ''} for "${searchQuery}"` :
                       `Results for "${searchQuery}"`}
                    </motion.span>
                  )}
                  {searchQuery && selectedTags.length > 0 && (
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