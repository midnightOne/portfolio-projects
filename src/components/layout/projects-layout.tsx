"use client";

import React from 'react';
import { NavigationBar, type SortOption, type ViewMode } from './navigation-bar';
import type { Tag } from '@/lib/types/project';

interface ProjectsLayoutProps {
  children: React.ReactNode;
  showFilters?: boolean;
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

export function ProjectsLayout({
  children,
  showFilters = true,
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
}: ProjectsLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Portfolio Projects</h1>
              <p className="text-muted-foreground mt-1">
                Explore my creative and technical work
              </p>
            </div>
            
            {/* Optional: Add user menu or other header actions here */}
          </div>
        </div>
      </header>

      {/* Navigation/Filters */}
      {showFilters && (
        <NavigationBar
          tags={tags}
          selectedTags={selectedTags}
          onTagSelect={onTagSelect}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          sortBy={sortBy}
          onSortChange={onSortChange}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          isLoading={isLoading}
          canSearch={canSearch}
          canFilter={canFilter}
          tagsLoading={tagsLoading}
          loadingMessage={loadingMessage}
        />
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Portfolio Projects. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}