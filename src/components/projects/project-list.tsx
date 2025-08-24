"use client";

import React from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { Calendar, Eye, Download, ExternalLink, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HighlightedText, SearchExcerpt } from '@/components/ui/highlighted-text';
import { cn } from '@/lib/utils';
import { highlightSearchTerms } from '@/lib/utils/search-highlight';
import type { ProjectWithRelations } from '@/lib/types/project';

interface ProjectListProps {
  projects: ProjectWithRelations[];
  loading: boolean;
  onProjectClick: (projectSlug: string) => void;
  showViewCount?: boolean;
  className?: string;
  searchQuery?: string;
}

interface ProjectListItemProps {
  project: ProjectWithRelations;
  onProjectClick: (projectSlug: string) => void;
  showViewCount: boolean;
  searchQuery: string;
  index: number;
}

function ProjectListItem({ project, onProjectClick, showViewCount, searchQuery, index }: ProjectListItemProps) {
  const shouldReduceMotion = useReducedMotion();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onProjectClick(project.slug);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onProjectClick(project.slug);
    }
  };

  const handleExternalLinkClick = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return null;
    const dateObj = new Date(date);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(dateObj);
  };

  const workDate = new Date(project.workDate || project.createdAt);
  const thumbnailImage = project.thumbnailImage || project.mediaItems?.[0];

  // Prepare highlighted text segments
  const titleSegments = React.useMemo(() =>
    highlightSearchTerms(project.title, searchQuery),
    [project.title, searchQuery]
  );

  // Animation variants
  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 20,
      scale: 0.98
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0.1 : 0.4,
        delay: shouldReduceMotion ? 0 : index * 0.05,
        ease: [0.21, 1.11, 0.81, 0.99]
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.98,
      transition: {
        duration: 0.2
      }
    },
    hover: {
      y: shouldReduceMotion ? 0 : -2,
      scale: shouldReduceMotion ? 1 : 1.01,
      transition: {
        duration: 0.2,
        type: "spring",
        stiffness: 300,
        damping: 20
      }
    }
  };

  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover="hover"
      whileTap={{ scale: shouldReduceMotion ? 1 : 0.99 }}
      layout
    >
      <Card
        className={cn(
          "group cursor-pointer border border-border/50 bg-card text-card-foreground shadow-sm",
          "hover:shadow-md hover:border-border transition-all duration-300",
          "active:shadow-sm touch-manipulation"
        )}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label={`View details for ${project.title}`}
      >
        <CardContent className="p-4">
          <div className="flex gap-4">
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-muted">
                {thumbnailImage ? (
                  <img
                    src={thumbnailImage.thumbnailUrl || thumbnailImage.url}
                    alt={thumbnailImage.altText || project.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <div className="w-6 h-6 mx-auto mb-1 rounded bg-muted-foreground/10 flex items-center justify-center">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          />
                        </svg>
                      </div>
                      <p className="text-xs font-medium">No Image</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Left Content */}
            <div className="flex-1 lg:flex-none lg:w-1/4 min-w-0">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    <HighlightedText
                      segments={titleSegments}
                      highlightClassName="bg-yellow-200 dark:bg-yellow-800 font-medium rounded-sm px-0.5"
                    />
                  </h3>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <time dateTime={workDate.toISOString()}>
                        {formatDate(workDate)}
                      </time>
                    </div>

                    {showViewCount && project.viewCount > 0 && (
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{project.viewCount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {project.externalLinks?.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleExternalLinkClick(e, project.externalLinks[0].url)}
                      className="h-8 w-8 p-0"
                      title="View Live Demo"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  {project.downloadableFiles?.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title="Download Files"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Brief Overview */}
              {project.briefOverview && (
                <div className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {searchQuery ? (
                    <SearchExcerpt
                      text={project.briefOverview}
                      searchQuery={searchQuery}
                      maxLength={120}
                      contextLength={20}
                      highlightClassName="bg-yellow-200 dark:bg-yellow-800 font-medium rounded-sm px-0.5"
                      as="span"
                    />
                  ) : (
                    project.briefOverview
                  )}
                </div>
              )}

              {/* Tags and Stats */}
              <div className="flex items-center justify-between gap-4">
                {/* Tags */}
                {project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                    {project.tags.slice(0, 3).map((tag) => (
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
                    {project.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{project.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  {project._count?.mediaItems && project._count.mediaItems > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span>{project._count.mediaItems}</span>
                    </div>
                  )}
                  {project._count?.downloadableFiles && project._count.downloadableFiles > 0 && (
                    <div className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      <span>{project._count.downloadableFiles}</span>
                    </div>
                  )}
                  {project._count?.externalLinks && project._count.externalLinks > 0 && (
                    <div className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      <span>{project._count.externalLinks}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Content - Project Description */}
            {project.description && (
              <div className="hidden lg:block lg:w-2/3 lg:pl-6 lg:border-l lg:border-border/50">
                <div className="text-sm text-muted-foreground line-clamp-4">
                  {searchQuery ? (
                    <SearchExcerpt
                      text={project.description}
                      searchQuery={searchQuery}
                      maxLength={400}
                      contextLength={50}
                      highlightClassName="bg-yellow-200 dark:bg-yellow-800 font-medium rounded-sm px-0.5"
                      as="div"
                    />
                  ) : (
                    project.description
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Description - Show below on small screens */}
          {project.description && (
            <div className="lg:hidden mt-3 pt-3 border-t border-border/50">
              <div className="text-sm text-muted-foreground line-clamp-3">
                {searchQuery ? (
                  <SearchExcerpt
                    text={project.description}
                    searchQuery={searchQuery}
                    maxLength={200}
                    contextLength={30}
                    highlightClassName="bg-yellow-200 dark:bg-yellow-800 font-medium rounded-sm px-0.5"
                    as="div"
                  />
                ) : (
                  project.description
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ProjectList({
  projects,
  loading,
  onProjectClick,
  showViewCount = true,
  className,
  searchQuery = ''
}: ProjectListProps) {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.05,
        delayChildren: 0.1
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
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-muted rounded-lg animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-muted rounded animate-pulse" style={{ width: '60%' }} />
                  <div className="h-4 bg-muted rounded animate-pulse" style={{ width: '40%' }} />
                  <div className="h-4 bg-muted rounded animate-pulse" style={{ width: '80%' }} />
                  <div className="flex gap-2 mt-3">
                    <div className="h-5 bg-muted rounded animate-pulse" style={{ width: '60px' }} />
                    <div className="h-5 bg-muted rounded animate-pulse" style={{ width: '50px' }} />
                    <div className="h-5 bg-muted rounded animate-pulse" style={{ width: '70px' }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
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

  return (
    <motion.div
      className={cn("space-y-4", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      layout
    >
      <AnimatePresence mode="popLayout">
        {projects.map((project, index) => (
          <ProjectListItem
            key={project.id}
            project={project}
            onProjectClick={onProjectClick}
            showViewCount={showViewCount}
            searchQuery={searchQuery}
            index={index}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}