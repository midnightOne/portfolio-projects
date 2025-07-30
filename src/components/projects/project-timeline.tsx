"use client";

import React from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { Calendar, Clock, ExternalLink, Download, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ProjectWithRelations } from '@/lib/types/project';

interface ProjectTimelineProps {
  projects: ProjectWithRelations[];
  loading: boolean;
  onProjectClick: (projectSlug: string) => void;
  showViewCount?: boolean;
  className?: string;
  searchQuery?: string;
  groupBy?: 'year' | 'month';
}

interface TimelineGroup {
  period: string;
  projects: ProjectWithRelations[];
  date: Date;
}

// Helper function to group projects by time period
function groupProjectsByPeriod(projects: ProjectWithRelations[], groupBy: 'year' | 'month'): TimelineGroup[] {
  const groups = new Map<string, ProjectWithRelations[]>();
  
  projects.forEach(project => {
    const date = project.workDate || project.createdAt;
    const period = groupBy === 'year' 
      ? date.getFullYear().toString()
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!groups.has(period)) {
      groups.set(period, []);
    }
    groups.get(period)!.push(project);
  });

  // Convert to array and sort by date (newest first)
  return Array.from(groups.entries())
    .map(([period, projects]) => ({
      period: groupBy === 'year' 
        ? period
        : new Date(period + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
      projects: projects.sort((a, b) => {
        const dateA = a.workDate || a.createdAt;
        const dateB = b.workDate || b.createdAt;
        return dateB.getTime() - dateA.getTime();
      }),
      date: new Date(period + (groupBy === 'year' ? '-01-01' : '-01'))
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

// Helper function to highlight search terms
function highlightSearchTerms(text: string, searchQuery: string): React.ReactNode {
  if (!searchQuery.trim()) return text;
  
  const terms = searchQuery.trim().split(/\s+/);
  let highlightedText = text;
  
  terms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>');
  });
  
  return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />;
}

// Timeline item component
interface TimelineItemProps {
  project: ProjectWithRelations;
  onProjectClick: (projectSlug: string) => void;
  showViewCount: boolean;
  searchQuery: string;
  index: number;
}

function TimelineItem({ project, onProjectClick, showViewCount, searchQuery, index }: TimelineItemProps) {
  const shouldReduceMotion = useReducedMotion();
  
  const itemVariants: Variants = {
    hidden: { 
      opacity: 0, 
      x: -30,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      x: 0,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0.1 : 0.4,
        delay: shouldReduceMotion ? 0 : index * 0.05,
        ease: [0.21, 1.11, 0.81, 0.99]
      }
    },
    exit: {
      opacity: 0,
      x: -30,
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    }
  };

  const workDate = project.workDate || project.createdAt;
  const thumbnailImage = project.thumbnailImage || project.mediaItems?.[0];

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className="relative"
    >
      {/* Timeline connector line */}
      <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-border" />
      
      {/* Timeline dot */}
      <div className="absolute left-4 top-8 w-4 h-4 bg-primary rounded-full border-2 border-background shadow-sm z-10" />
      
      {/* Content card */}
      <div className="ml-12 pb-8">
        <Card className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border-l-4 border-l-primary/20 hover:border-l-primary">
          <CardContent className="p-6" onClick={() => onProjectClick(project.slug)}>
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Project thumbnail */}
              {thumbnailImage && (
                <div className="flex-shrink-0">
                  <div className="w-full lg:w-32 h-32 lg:h-24 rounded-lg overflow-hidden bg-muted">
                    <img
                      src={thumbnailImage.thumbnailUrl || thumbnailImage.url}
                      alt={thumbnailImage.altText || project.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                </div>
              )}
              
              {/* Project details */}
              <div className="flex-1 min-w-0">
                {/* Header with date */}
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {highlightSearchTerms(project.title, searchQuery)}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      <time dateTime={workDate.toISOString()}>
                        {workDate.toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long',
                          day: 'numeric'
                        })}
                      </time>
                      {showViewCount && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            <span>{project.viewCount.toLocaleString()} views</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {(project.briefOverview || project.description) && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {highlightSearchTerms(
                      project.briefOverview || project.description || '', 
                      searchQuery
                    )}
                  </p>
                )}

                {/* Tags */}
                {project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {project.tags.slice(0, 4).map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="text-xs"
                        style={
                          tag.color
                            ? { 
                                backgroundColor: tag.color + '20', 
                                borderColor: tag.color,
                                color: tag.color
                              }
                            : undefined
                        }
                      >
                        {tag.name}
                      </Badge>
                    ))}
                    {project.tags.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{project.tags.length - 4} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Quick actions */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {project._count?.mediaItems && project._count.mediaItems > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span>{project._count.mediaItems} media</span>
                    </div>
                  )}
                  {project._count?.downloadableFiles && project._count.downloadableFiles > 0 && (
                    <div className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      <span>{project._count.downloadableFiles} downloads</span>
                    </div>
                  )}
                  {project._count?.externalLinks && project._count.externalLinks > 0 && (
                    <div className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      <span>{project._count.externalLinks} links</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

// Timeline group header component
interface TimelineGroupHeaderProps {
  period: string;
  projectCount: number;
  index: number;
}

function TimelineGroupHeader({ period, projectCount, index }: TimelineGroupHeaderProps) {
  const shouldReduceMotion = useReducedMotion();
  
  const headerVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: -20,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0.1 : 0.4,
        delay: shouldReduceMotion ? 0 : index * 0.1,
        ease: "easeOut"
      }
    }
  };

  return (
    <motion.div
      variants={headerVariants}
      initial="hidden"
      animate="visible"
      className="relative mb-6"
    >
      {/* Timeline connector for group header */}
      <div className="absolute left-6 top-8 bottom-0 w-0.5 bg-border" />
      
      {/* Group header dot */}
      <div className="absolute left-3 top-4 w-6 h-6 bg-primary rounded-full border-4 border-background shadow-md z-10 flex items-center justify-center">
        <Clock className="h-3 w-3 text-primary-foreground" />
      </div>
      
      {/* Header content */}
      <div className="ml-12">
        <div className="bg-muted/50 rounded-lg px-4 py-3 border">
          <h2 className="text-xl font-bold text-foreground">{period}</h2>
          <p className="text-sm text-muted-foreground">
            {projectCount} project{projectCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function ProjectTimeline({ 
  projects, 
  loading, 
  onProjectClick, 
  showViewCount = true,
  className,
  searchQuery = '',
  groupBy = 'year'
}: ProjectTimelineProps) {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.1,
        delayChildren: 0.2
      }
    }
  };

  const emptyStateVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  if (loading) {
    return (
      <div className={cn("space-y-8", className)}>
        {Array.from({ length: 3 }).map((_, groupIndex) => (
          <div key={groupIndex} className="space-y-4">
            {/* Group header skeleton */}
            <div className="relative">
              <div className="absolute left-3 top-4 w-6 h-6 bg-muted rounded-full animate-pulse" />
              <div className="ml-12">
                <div className="bg-muted/50 rounded-lg px-4 py-3 border">
                  <div className="h-6 bg-muted rounded animate-pulse mb-2" style={{ width: '120px' }} />
                  <div className="h-4 bg-muted rounded animate-pulse" style={{ width: '80px' }} />
                </div>
              </div>
            </div>
            
            {/* Project items skeleton */}
            {Array.from({ length: 2 }).map((_, itemIndex) => (
              <div key={itemIndex} className="relative">
                <div className="absolute left-4 top-8 w-4 h-4 bg-muted rounded-full animate-pulse" />
                <div className="ml-12 pb-8">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex gap-4">
                        <div className="w-32 h-24 bg-muted rounded-lg animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-5 bg-muted rounded animate-pulse" style={{ width: '60%' }} />
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: '40%' }} />
                          <div className="h-4 bg-muted rounded animate-pulse" style={{ width: '80%' }} />
                          <div className="flex gap-2">
                            <div className="h-5 bg-muted rounded animate-pulse" style={{ width: '60px' }} />
                            <div className="h-5 bg-muted rounded animate-pulse" style={{ width: '50px' }} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <motion.div 
        className="flex flex-col items-center justify-center py-16 text-center"
        variants={emptyStateVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div 
          className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            delay: 0.2 
          }}
        >
          <Clock className="w-8 h-8 text-muted-foreground" />
        </motion.div>
        <motion.h3 
          className="text-lg font-semibold mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          No projects found
        </motion.h3>
        <motion.p 
          className="text-muted-foreground max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Try adjusting your search terms or filters to find what you're looking for.
        </motion.p>
      </motion.div>
    );
  }

  // Group projects by time period
  const timelineGroups = groupProjectsByPeriod(projects, groupBy);

  return (
    <motion.div 
      className={cn("relative", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence mode="popLayout">
        {timelineGroups.map((group, groupIndex) => (
          <div key={group.period} className="relative">
            <TimelineGroupHeader 
              period={group.period}
              projectCount={group.projects.length}
              index={groupIndex}
            />
            
            {group.projects.map((project, projectIndex) => (
              <TimelineItem
                key={project.id}
                project={project}
                onProjectClick={onProjectClick}
                showViewCount={showViewCount}
                searchQuery={searchQuery}
                index={projectIndex}
              />
            ))}
          </div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}