"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Grid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface NavigationBarSkeletonProps {
  showSearchEnabled?: boolean;
  showFiltersEnabled?: boolean;
}

export function NavigationBarSkeleton({ 
  showSearchEnabled = false,
  showFiltersEnabled = false 
}: NavigationBarSkeletonProps) {
  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4 py-4">
        {/* Search and Controls Row */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={showSearchEnabled ? "Search projects..." : "Loading..."}
              disabled={!showSearchEnabled}
              className="pl-10"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Sort Dropdown Skeleton */}
            <Button
              variant="outline"
              disabled={!showFiltersEnabled}
              className="min-w-[120px] justify-between"
            >
              {showFiltersEnabled ? "Sort: Relevance" : "Loading..."}
            </Button>

            {/* View Mode Toggle */}
            <div className="flex border rounded-md">
              <Button
                variant="default"
                size="sm"
                disabled={!showSearchEnabled}
                className="rounded-r-none"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!showSearchEnabled}
                className="rounded-l-none border-l"
              >
                <Grid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tags Filter Row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>Filter:</span>
          </div>
          
          {/* Tag Skeletons */}
          {showFiltersEnabled ? (
            // Show actual loading state for tags
            <motion.div 
              className="flex gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Skeleton className="h-6 w-12 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-10 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-8 rounded-full" />
            </motion.div>
          ) : (
            // Show disabled state
            <div className="flex gap-2 opacity-50">
              <div className="h-6 w-12 bg-muted rounded-full" />
              <div className="h-6 w-16 bg-muted rounded-full" />
              <div className="h-6 w-10 bg-muted rounded-full" />
              <div className="h-6 w-14 bg-muted rounded-full" />
              <div className="h-6 w-8 bg-muted rounded-full" />
            </div>
          )}
        </div>

        {/* Loading Status Message */}
        {(!showSearchEnabled || !showFiltersEnabled) && (
          <motion.div 
            className="mt-3 pt-3 border-t"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <motion.div
                className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span>
                {!showSearchEnabled && !showFiltersEnabled 
                  ? "Loading projects and filters..."
                  : !showFiltersEnabled 
                  ? "Loading filters..."
                  : "Loading projects..."
                }
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}