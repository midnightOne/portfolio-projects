"use client";

import React from 'react';
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
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick();
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

  const thumbnailUrl = project.thumbnailImage?.url || project.mediaItems[0]?.url;

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1",
        "border-border/50 hover:border-border",
        className
      )}
      onClick={handleClick}
    >
      {/* Thumbnail Image */}
      {thumbnailUrl && (
        <div className="relative aspect-video overflow-hidden rounded-t-xl">
          <img
            src={thumbnailUrl}
            alt={project.thumbnailImage?.altText || project.title}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
          
          {/* Overlay with quick actions */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2">
              {project.externalLinks.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => handleExternalLinkClick(e, project.externalLinks[0].url)}
                  className="bg-white/90 hover:bg-white text-black"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              {project.downloadableFiles.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-white/90 hover:bg-white text-black"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
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
          <div className="flex flex-wrap gap-1 mt-2">
            {project.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs"
                style={tag.color ? { backgroundColor: `${tag.color}20`, borderColor: tag.color } : undefined}
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

          {project.externalLinks.length > 0 && (
            <div className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              <span>{project.externalLinks.length} link{project.externalLinks.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}