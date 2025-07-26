"use client";

import React, { useState } from 'react';
import { Search, Filter, Grid, List, ChevronDown } from 'lucide-react';
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
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Date' },
  { value: 'title', label: 'Title' },
  { value: 'popularity', label: 'Popularity' },
];

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
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={canSearch ? "Search projects..." : "Loading projects..."}
              value={searchQuery}
              onChange={(e) => canSearch && onSearchChange(e.target.value)}
              className="pl-10"
              disabled={isLoading || !canSearch}
            />
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
              
              {sortDropdownOpen && (
                <div className="absolute top-full mt-1 right-0 bg-background border rounded-md shadow-lg z-50 min-w-[120px]">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSortChange(option.value);
                        setSortDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                        sortBy === option.value && "bg-accent text-accent-foreground"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
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
            {(selectedTags.length > 0 || searchQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                disabled={isLoading || (!canSearch && !canFilter)}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Tags Filter Row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filter:</span>
          </div>
          
          {/* Show loading skeletons when tags are loading */}
          {tagsLoading ? (
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-6 bg-muted rounded-full animate-pulse"
                  style={{ width: `${Math.random() * 40 + 40}px` }}
                />
              ))}
            </div>
          ) : (
            <>
              {visibleTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.name) ? 'default' : 'outline'}
                  className={cn(
                    "cursor-pointer transition-colors",
                    canFilter && !isLoading && "hover:bg-primary hover:text-primary-foreground",
                    (!canFilter || isLoading) && "opacity-50 cursor-not-allowed"
                  )}
                  style={
                    selectedTags.includes(tag.name) && tag.color
                      ? { backgroundColor: tag.color, borderColor: tag.color }
                      : undefined
                  }
                  onClick={() => canFilter && !isLoading && handleTagClick(tag.name)}
                >
                  {tag.name}
                </Badge>
              ))}

              {hasMoreTags && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllTags(!showAllTags)}
                  disabled={isLoading || !canFilter}
                  className="text-xs"
                >
                  {showAllTags ? 'Show Less' : `+${tags.length - 8} More`}
                </Button>
              )}
            </>
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

        {/* Active Filters Summary */}
        {selectedTags.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Active filters:</span>
              <div className="flex flex-wrap gap-1">
                {selectedTags.map((tagName) => (
                  <Badge key={tagName} variant="secondary" className="text-xs">
                    {tagName}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}