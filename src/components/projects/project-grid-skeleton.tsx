"use client";

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function ProjectCardSkeleton() {
  return (
    <Card className="animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="aspect-video bg-muted rounded-t-xl" />
      
      <CardHeader className="pb-3">
        {/* Title skeleton */}
        <div className="h-6 bg-muted rounded w-3/4 mb-2" />
        
        {/* Tags skeleton */}
        <div className="flex gap-1 mt-2">
          <div className="h-5 bg-muted rounded-full w-12" />
          <div className="h-5 bg-muted rounded-full w-16" />
          <div className="h-5 bg-muted rounded-full w-10" />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Description skeleton */}
        <div className="space-y-2 mb-3">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-4/5" />
          <div className="h-4 bg-muted rounded w-3/5" />
        </div>

        {/* Footer skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-3 bg-muted rounded w-16" />
            <div className="h-3 bg-muted rounded w-12" />
          </div>
          <div className="h-3 bg-muted rounded w-10" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <ProjectCardSkeleton key={index} />
      ))}
    </div>
  );
}