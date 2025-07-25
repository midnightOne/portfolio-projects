"use client";

import React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { Calendar, Eye, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ProjectWithRelations } from '@/lib/types/project';

interface ProjectCardProps {
  project: ProjectWithRelations;
  onClick: () => void;
  showViewCount?: boolean;
  className?: string;
}

export function ProjectCard({ 
  project, 
  onClick, 
  showViewCount = true,
  className 
}: ProjectCardProps) {
  const shouldReduceMotion = useReducedMotion();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const handleExternalLinkClick = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
    }).format(new Date(date));
  };

  const thumbnailUrl = project.thumbnailImage?.url || project.mediaItems?.[0]?.url;

  // Animation variants
  const cardVariants: Variants = {
    initial: { 
      opacity: 0, 
      y: 20,
      scale: 0.95 
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0.1 : 0.4,
        ease: [0.21, 1.11, 0.81, 0.99]
      }
    },
    hover: {
      y: shouldReduceMotion ? 0 : -8,
      scale: shouldReduceMotion ? 1 : 1.02,
      transition: {
        duration: 0.2,
        type: "spring",
        stiffness: 300,
        damping: 20
      }
    }
  };

  const imageVariants: Variants = {
    initial: { scale: 1 },
    hover: { 
      scale: shouldReduceMotion ? 1 : 1.05,
      transition: { 
        duration: 0.3, 
        type: "spring",
        stiffness: 200,
        damping: 15
      }
    }
  };

  const overlayVariants: Variants = {
    initial: { opacity: 0 },
    hover: { 
      opacity: 1,
      transition: { duration: 0.2 }
    }
  };

  const tagVariants: Variants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: (i: number) => ({
      opacity: 1,
      scale: 1,
      transition: {
        delay: shouldReduceMotion ? 0 : i * 0.05,
        duration: 0.3,
        type: "spring",
        stiffness: 300,
        damping: 20
      }
    })
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      whileTap={{ scale: shouldReduceMotion ? 1 : 0.98 }}
      className={cn(
        "group cursor-pointer border border-border/50 rounded-xl bg-card text-card-foreground shadow-sm",
        "hover:shadow-xl hover:border-border overflow-hidden",
        "active:shadow-lg transition-shadow touch-manipulation",
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`View details for ${project.title}`}
      style={{
        willChange: "transform, opacity"
      }}
    >
      {/* Thumbnail Image */}
      {thumbnailUrl && (
        <div className="relative aspect-video overflow-hidden rounded-t-xl">
          <motion.img
            src={thumbnailUrl}
            alt={project.thumbnailImage?.altText || project.title}
            className="w-full h-full object-cover"
            loading="lazy"
            variants={imageVariants}
            initial="initial"
            whileHover="hover"
          />
          
          {/* Overlay with quick actions */}
          <motion.div 
            className="absolute inset-0 bg-black/20 flex items-center justify-center"
            variants={overlayVariants}
            initial="initial"
            whileHover="hover"
          >
            <motion.div 
              className="flex gap-2"
              initial={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {project.externalLinks?.length > 0 && (
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => handleExternalLinkClick(e, project.externalLinks[0].url)}
                    className="bg-white/90 hover:bg-white text-black"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
              {project.downloadableFiles?.length > 0 && (
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-white/90 hover:bg-white text-black"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {project.title}
          </CardTitle>
          
          {showViewCount && project.viewCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Eye className="h-3 w-3" />
              <span>{project.viewCount}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {project.tags.length > 0 && (
          <motion.div 
            className="flex flex-wrap gap-1 mt-2"
            initial="initial"
            animate="animate"
          >
            {project.tags.slice(0, 3).map((tag, index) => (
              <motion.div
                key={tag.id}
                custom={index}
                variants={tagVariants}
                initial="initial"
                animate="animate"
              >
                <Badge
                  variant="secondary"
                  className="text-xs"
                  style={tag.color ? { backgroundColor: `${tag.color}20`, borderColor: tag.color } : undefined}
                >
                  {tag.name}
                </Badge>
              </motion.div>
            ))}
            {project.tags.length > 3 && (
              <motion.div
                custom={3}
                variants={tagVariants}
                initial="initial"
                animate="animate"
              >
                <Badge variant="outline" className="text-xs">
                  +{project.tags.length - 3}
                </Badge>
              </motion.div>
            )}
          </motion.div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Description */}
        {project.briefOverview && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
            {project.briefOverview}
          </p>
        )}

        {/* Footer with metadata */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {project.workDate && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(project.workDate)}</span>
              </div>
            )}
            
            {project._count && (
              <div className="flex items-center gap-3">
                {project._count.mediaItems > 0 && (
                  <span>{project._count.mediaItems} media</span>
                )}
                {project._count.downloadableFiles > 0 && (
                  <span>{project._count.downloadableFiles} files</span>
                )}
              </div>
            )}
          </div>

          {project.externalLinks?.length > 0 && (
            <div className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              <span>{project.externalLinks.length} link{project.externalLinks.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </CardContent>
    </motion.div>
  );
}