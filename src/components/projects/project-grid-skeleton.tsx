"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ProjectCardSkeletonProps {
  index?: number;
}

function ProjectCardSkeleton({ index = 0 }: ProjectCardSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay: index * 0.1,
        ease: [0.21, 1.11, 0.81, 0.99]
      }}
    >
      <Card className="overflow-hidden">
        {/* Thumbnail skeleton with shimmer effect */}
        <div className="aspect-video relative overflow-hidden rounded-t-xl">
          <Skeleton className="w-full h-full" />
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
              delay: index * 0.2,
            }}
          />
        </div>
        
        <CardHeader className="pb-3">
          {/* Title skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          
          {/* Tags skeleton */}
          <div className="flex gap-1 mt-3">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-10 rounded-full" />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Description skeleton */}
          <div className="space-y-2 mb-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>

          {/* Footer skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface ProjectGridSkeletonProps {
  count?: number;
  showStaggered?: boolean;
}

export function ProjectGridSkeleton({ 
  count = 6, 
  showStaggered = true 
}: ProjectGridSkeletonProps) {
  return (
    <motion.div 
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <ProjectCardSkeleton 
          key={index} 
          index={showStaggered ? index : 0}
        />
      ))}
    </motion.div>
  );
}