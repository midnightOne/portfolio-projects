"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Eye, Download, ExternalLink, Tag as TagIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ProjectWithRelations } from '@/lib/types/project';
import { NovelDisplayRenderer } from '@/components/novel-display-renderer';

interface ProjectModalProps {
  project: ProjectWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  loading?: boolean;
}

// Modal animation variants with smoother transitions
const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      duration: 0.4,
      bounce: 0.1,
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

// Sidebar animation variants
const sidebarVariants = {
  hidden: {
    opacity: 0,
    x: -30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.1,
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

// Content animation variants  
const contentVariants = {
  hidden: {
    opacity: 0,
    x: 30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.1,
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

// Loading to content transition variants
const loadingTransitionVariants = {
  loading: {
    opacity: 0.3,
    scale: 0.98,
    filter: "blur(1px)",
  },
  loaded: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

export function ProjectModal({ project, isOpen, onClose, loading = false }: ProjectModalProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  };

  const handleExternalLinkClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Helper function to render inline media component (Requirement 3.6)
  const renderInlineMedia = (media: any, className: string = "") => {
    const baseStyles = `rounded-lg shadow-sm ${className}`;
    
    switch (media.type) {
      case 'IMAGE':
        return (
          <div className="my-4 w-full">
            <img
              src={media.url}
              alt={media.altText || media.description || 'Inline media'}
              className={`${baseStyles} w-full h-auto cursor-pointer transition-transform hover:scale-[1.02]`}
              style={{
                aspectRatio: media.width && media.height 
                  ? `${media.width} / ${media.height}` 
                  : 'auto'
              }}
              onClick={() => window.open(media.url, '_blank')}
              loading="lazy"
            />
            {media.description && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {media.description}
                </p>
              </div>
            )}
          </div>
        );
      
      case 'GIF':
        return (
          <div className="my-4 w-full">
            <img
              src={media.url}
              alt={media.altText || media.description || 'Inline GIF'}
              className={`${baseStyles} w-full h-auto`}
              style={{
                aspectRatio: media.width && media.height 
                  ? `${media.width} / ${media.height}` 
                  : 'auto'
              }}
              loading="lazy"
            />
            {media.description && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {media.description}
                </p>
              </div>
            )}
          </div>
        );
      
      case 'VIDEO':
      case 'WEBM':
        return (
          <div className="my-4 w-full">
            <video
              src={media.url}
              poster={media.thumbnailUrl || undefined}
              controls
              className={`${baseStyles} w-full h-auto`}
              style={{
                aspectRatio: media.width && media.height 
                  ? `${media.width} / ${media.height}` 
                  : '16 / 9'
              }}
            >
              <source src={media.url} type={media.type === 'WEBM' ? 'video/webm' : 'video/mp4'} />
              Your browser does not support the video tag.
            </video>
            {media.description && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {media.description}
                </p>
              </div>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  // Enhanced article content processing (Requirement 3.6)
  const processArticleContent = (content: string) => {
    // Simple placeholder for future rich content processing
    // This could be enhanced to parse markdown or special media tags
    // For now, return the content as-is with media displayed separately
    return content;
  };

  // Don't render anything if modal is not open
  if (!isOpen) {
    return null;
  }

  // Safe array access with fallbacks
  const mediaItems = project?.mediaItems || [];
  const tags = project?.tags || [];
  const externalLinks = project?.externalLinks || [];
  const downloadableFiles = project?.downloadableFiles || [];
  const interactiveExamples = project?.interactiveExamples || [];

  const metadataImageUrl = project?.metadataImage?.url || project?.thumbnailImage?.url || mediaItems[0]?.url;



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!w-[95vw] !max-w-none sm:!max-w-[95vw] md:!max-w-6xl lg:!max-w-7xl !h-[85vh] p-0 overflow-hidden">
        <motion.div
          className="h-full"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
            {/* Loading State Overlay with seamless transition */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
                  initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                  animate={{ 
                    opacity: 1, 
                    backdropFilter: "blur(4px)",
                    transition: { duration: 0.2, ease: "easeOut" }
                  }}
                  exit={{ 
                    opacity: 0, 
                    backdropFilter: "blur(0px)",
                    transition: { duration: 0.3, ease: "easeInOut" }
                  }}
                >
                  <motion.div 
                    className="text-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ 
                      opacity: 1, 
                      y: 0,
                      transition: { delay: 0.1, duration: 0.3 }
                    }}
                    exit={{ 
                      opacity: 0, 
                      y: -10,
                      transition: { duration: 0.2 }
                    }}
                  >
                    <motion.div 
                      className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ 
                        scale: 1, 
                        opacity: 1,
                        transition: { delay: 0.2, duration: 0.3 }
                      }}
                      exit={{ 
                        scale: 0.8, 
                        opacity: 0,
                        transition: { duration: 0.2 }
                      }}
                    />
                    <motion.p 
                      className="text-muted-foreground text-sm"
                      initial={{ opacity: 0 }}
                      animate={{ 
                        opacity: 1,
                        transition: { delay: 0.3, duration: 0.3 }
                      }}
                      exit={{ 
                        opacity: 0,
                        transition: { duration: 0.2 }
                      }}
                    >
                      Loading project details...
                    </motion.p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content State - Always rendered with smooth transitions */}
            <motion.div
              className="h-full"
              variants={loadingTransitionVariants}
              initial="loading"
              animate={loading ? "loading" : "loaded"}
            >
              {/* Accessible title for screen readers */}
              <DialogHeader className="sr-only">
                <DialogTitle>{project?.title || 'Project Details'}</DialogTitle>
              </DialogHeader>

              {/* Custom close button - Always visible */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-[60] bg-background/80 backdrop-blur-sm hover:bg-background/90"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close project details</span>
              </Button>

              <div className="flex h-full flex-col lg:flex-row">
                {/* Left Column - Fixed Metadata Sidebar */}
                <motion.div 
                  className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r bg-muted/30 flex flex-col"
                  variants={sidebarVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {/* Scrollable content within fixed sidebar */}
                  <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {project ? (
                      <div className="space-y-4">
                        {/* Project Title - Visible */}
                      <motion.h2 
                        className="text-xl lg:text-2xl font-bold leading-tight"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                      >
                        {project.title}
                      </motion.h2>

                      {/* Project Image */}
                      {metadataImageUrl && (
                        <motion.div 
                          className="relative aspect-video rounded-lg overflow-hidden"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4, duration: 0.3 }}
                        >
                          <img
                            src={metadataImageUrl}
                            alt={project.metadataImage?.altText || project.title}
                            className="w-full h-full object-cover"
                          />
                        </motion.div>
                      )}

                      {/* Brief Overview */}
                      {project.briefOverview && (
                        <motion.p 
                          className="text-sm text-muted-foreground leading-relaxed"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5, duration: 0.3 }}
                        >
                          {project.briefOverview}
                        </motion.p>
                      )}

                      {/* Tags */}
                      {tags.length > 0 && (
                        <motion.div 
                          className="space-y-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6, duration: 0.3 }}
                        >
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <TagIcon className="h-4 w-4" />
                            Tags
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {tags.map((tag, index) => (
                              <motion.div
                                key={tag.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.7 + index * 0.05, duration: 0.2 }}
                              >
                                <Badge
                                  variant="secondary"
                                  className="text-xs"
                                  style={tag.color ? { 
                                    backgroundColor: `${tag.color}20`, 
                                    borderColor: tag.color,
                                    color: tag.color 
                                  } : undefined}
                                >
                                  {tag.name}
                                </Badge>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Metadata */}
                      <motion.div 
                        className="space-y-3 pt-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.3 }}
                      >
                        {project.workDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Work Date:</span>
                            <span className="text-muted-foreground">{formatDate(project.workDate)}</span>
                          </div>
                        )}

                        {project.viewCount > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Views:</span>
                            <span className="text-muted-foreground">{project.viewCount}</span>
                          </div>
                        )}

                        {project._count && (
                          <div className="text-sm text-muted-foreground">
                            {project._count.mediaItems > 0 && (
                              <div>{project._count.mediaItems} media item{project._count.mediaItems !== 1 ? 's' : ''}</div>
                            )}
                            {project._count.downloadableFiles > 0 && (
                              <div>{project._count.downloadableFiles} downloadable file{project._count.downloadableFiles !== 1 ? 's' : ''}</div>
                            )}
                          </div>
                        )}
                      </motion.div>

                      {/* External Links */}
                      {externalLinks.length > 0 && (
                        <motion.div 
                          className="space-y-3 pt-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.9, duration: 0.3 }}
                        >
                          <h3 className="text-sm font-medium flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            External Links
                          </h3>
                          <div className="space-y-2">
                            {externalLinks.map((link, index) => (
                              <motion.div
                                key={link.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 1.0 + index * 0.1, duration: 0.2 }}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start transition-transform hover:scale-[1.02]"
                                  onClick={() => handleExternalLinkClick(link.url)}
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  {link.label}
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Download Files */}
                      {downloadableFiles.length > 0 && (
                        <motion.div 
                          className="space-y-3 pt-2"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 1.1, duration: 0.3 }}
                        >
                          <h3 className="text-sm font-medium flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            Downloads
                          </h3>
                          <div className="space-y-2">
                            {downloadableFiles.map((file, index) => (
                              <motion.div
                                key={file.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 1.2 + index * 0.1, duration: 0.2 }}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start transition-transform hover:scale-[1.02]"
                                  onClick={() => window.open(file.downloadUrl, '_blank')}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  <div className="flex flex-col items-start text-left">
                                    <span className="text-xs">{file.originalName}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {file.fileType} • {(Number(file.fileSize) / 1024 / 1024).toFixed(1)}MB
                                    </span>
                                  </div>
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Loading placeholder content */}
                        <div className="h-8 bg-muted/50 rounded animate-pulse" />
                        <div className="aspect-video bg-muted/50 rounded animate-pulse" />
                        <div className="h-4 bg-muted/50 rounded animate-pulse" />
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Right Column - Scrollable Main Content */}
                <motion.div 
                  className="flex-1 flex flex-col"
                  variants={contentVariants}
                  initial="hidden" 
                  animate="visible"
                >
                  <div className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ maxHeight: 'calc(85vh - 2rem)' }}>
                    {project ? (
                      <div className="max-w-none prose prose-gray dark:prose-invert lg:prose-lg space-y-6">
                        {/* Main Description */}
                        {project.description && (
                        <motion.div 
                          className="space-y-4"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4, duration: 0.4 }}
                        >
                          <h2 className="text-lg lg:text-xl font-semibold">Project Description</h2>
                          <div className="text-sm lg:text-base leading-relaxed whitespace-pre-wrap">
                            {project.description}
                          </div>
                        </motion.div>
                      )}

                      {/* Enhanced Article Content with Rich Formatting */}
                      {(project.articleContent?.content || project.articleContent?.jsonContent) && (
                        <motion.div 
                          className="space-y-4 mt-6"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5, duration: 0.4 }}
                        >
                          <h2 className="text-lg lg:text-xl font-semibold">Project Details</h2>
                          <div className="text-sm lg:text-base leading-relaxed">
                            {/* Rich article content with Novel renderer */}
                            <NovelDisplayRenderer
                              content={
                                project.articleContent.contentType === 'json' && project.articleContent.jsonContent
                                  ? project.articleContent.jsonContent
                                  : project.articleContent.content || ''
                              }
                              className="prose-sm lg:prose-base"
                              mediaRenderer={(mediaItems) => (
                                <div className="my-6 space-y-4">
                                  {mediaItems.slice(0, 3).map((media, index) => (
                                    <div key={media.id}>
                                      {renderInlineMedia(media, "max-w-3xl mx-auto")}
                                    </div>
                                  ))}
                                </div>
                              )}
                              downloadRenderer={(files) => (
                                <div className="my-6 flex justify-center">
                                  <Button
                                    onClick={() => files[0] && window.open(files[0].downloadUrl, '_blank')}
                                    className="flex items-center gap-2"
                                  >
                                    <Download className="h-4 w-4" />
                                    Download {files.length > 1 ? `(${files.length} files)` : files[0]?.filename}
                                  </Button>
                                </div>
                              )}
                              interactiveRenderer={(url) => (
                                <div className="my-6">
                                  <iframe
                                    src={url}
                                    className="w-full h-96 rounded-lg border"
                                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                  />
                                </div>
                              )}
                            />
                            
                            {/* Inline media items embedded within article (Requirement 3.6) */}
                            {mediaItems.length > 0 && mediaItems.slice(0, 3).some(media => 
                              ['IMAGE', 'GIF', 'VIDEO', 'WEBM'].includes(media.type)
                            ) && (
                              <div className="my-6 space-y-4">
                                {mediaItems
                                  .filter(media => ['IMAGE', 'GIF', 'VIDEO', 'WEBM'].includes(media.type))
                                  .slice(0, 3)
                                  .map((media, index) => (
                                    <motion.div
                                      key={`inline-${media.id}`}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: 0.6 + index * 0.1, duration: 0.3 }}
                                    >
                                      {renderInlineMedia(media, "max-w-3xl mx-auto")}
                                    </motion.div>
                                  ))
                                }
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Enhanced Media Gallery - Remaining Items */}
                      {mediaItems.length > 3 && (
                        <motion.div 
                          className="space-y-6 mt-8"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.8, duration: 0.4 }}
                        >
                          <h2 className="text-lg lg:text-xl font-semibold">Additional Media</h2>
                          <div className="space-y-6">
                            {/* Show remaining media items not displayed inline */}
                            {mediaItems.slice(3, 15).map((media, index) => (
                              <motion.div
                                key={media.id}
                                className="w-full"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 + index * 0.1, duration: 0.3 }}
                              >
                                {/* Media Container with proper responsive sizing */}
                                <div className="w-full max-w-4xl mx-auto">
                                  {media.type === 'IMAGE' && (
                                    <div className="relative w-full">
                                      <img
                                        src={media.url}
                                        alt={media.altText || media.description || 'Project media'}
                                        className="w-full h-auto rounded-lg shadow-sm transition-transform hover:scale-[1.02] cursor-pointer"
                                        loading="lazy"
                                        style={{
                                          aspectRatio: media.width && media.height 
                                            ? `${media.width} / ${media.height}` 
                                            : 'auto'
                                        }}
                                        onClick={() => {
                                          // TODO: Open in lightbox/fullscreen view
                                          window.open(media.url, '_blank');
                                        }}
                                      />
                                      {/* Image description matching image width (Requirement 3.10) */}
                                      {media.description && (
                                        <div className="mt-2">
                                          <p className="text-sm text-muted-foreground leading-relaxed">
                                            {media.description}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {media.type === 'GIF' && (
                                    <div className="relative w-full">
                                      <img
                                        src={media.url}
                                        alt={media.altText || media.description || 'Project GIF'}
                                        className="w-full h-auto rounded-lg shadow-sm"
                                        loading="lazy"
                                        style={{
                                          aspectRatio: media.width && media.height 
                                            ? `${media.width} / ${media.height}` 
                                            : 'auto'
                                        }}
                                      />
                                      {/* GIF description matching image width (Requirement 3.10) */}
                                      {media.description && (
                                        <div className="mt-2">
                                          <p className="text-sm text-muted-foreground leading-relaxed">
                                            {media.description}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {(media.type === 'VIDEO' || media.type === 'WEBM') && (
                                    <div className="relative w-full">
                                      <video
                                        src={media.url}
                                        poster={media.thumbnailUrl || undefined}
                                        controls
                                        className="w-full h-auto rounded-lg shadow-sm"
                                        style={{
                                          aspectRatio: media.width && media.height 
                                            ? `${media.width} / ${media.height}` 
                                            : '16 / 9'
                                        }}
                                      >
                                        <source src={media.url} type={media.type === 'WEBM' ? 'video/webm' : 'video/mp4'} />
                                        Your browser does not support the video tag.
                                      </video>
                                      {/* Video description matching video width (Requirement 3.10) */}
                                      {media.description && (
                                        <div className="mt-2">
                                          <p className="text-sm text-muted-foreground leading-relaxed">
                                            {media.description}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {media.type === 'AUDIO' && (
                                    <div className="relative w-full">
                                      <div className="bg-muted/50 rounded-lg p-4 border">
                                        <audio
                                          src={media.url}
                                          controls
                                          className="w-full"
                                        >
                                          Your browser does not support the audio tag.
                                        </audio>
                                      </div>
                                      {/* Audio description */}
                                      {media.description && (
                                        <div className="mt-2">
                                          <p className="text-sm text-muted-foreground leading-relaxed">
                                            {media.description}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {media.type === 'DOCUMENT' && (
                                    <div className="relative w-full">
                                      <Card className="transition-transform hover:scale-[1.01]">
                                        <CardContent className="p-4">
                                          <div className="flex items-center gap-3">
                                            <div className="p-2 bg-muted rounded">
                                              <Download className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1">
                                              <h4 className="font-medium">
                                                {media.altText || 'Document'}
                                              </h4>
                                              {media.description && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                  {media.description}
                                                </p>
                                              )}
                                            </div>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => window.open(media.url, '_blank')}
                                            >
                                              View
                                            </Button>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                            {mediaItems.length > 15 && (
                              <motion.div 
                                className="text-center py-4"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1.5, duration: 0.3 }}
                              >
                                <p className="text-sm text-muted-foreground">
                                  And {mediaItems.length - 15} more media item{mediaItems.length - 15 !== 1 ? 's' : ''}...
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => {
                                    // TODO: Load more media or show all
                                    console.log('Show more media items');
                                  }}
                                >
                                  Show All Media
                                </Button>
                              </motion.div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* Interactive Examples */}
                      {interactiveExamples.length > 0 && (
                        <motion.div 
                          className="space-y-4 mt-6"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.8, duration: 0.4 }}
                        >
                          <h2 className="text-lg lg:text-xl font-semibold">Interactive Examples</h2>
                          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                            {interactiveExamples.map((example, index) => (
                              <motion.div
                                key={example.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.9 + index * 0.1, duration: 0.3 }}
                              >
                                <Card className="transition-transform hover:scale-[1.02]">
                                  <CardHeader>
                                    <h3 className="font-medium">{example.title}</h3>
                                    {example.description && (
                                      <p className="text-sm text-muted-foreground">{example.description}</p>
                                    )}
                                  </CardHeader>
                                  <CardContent>
                                    {example.url ? (
                                      <Button
                                        variant="outline"
                                        onClick={() => handleExternalLinkClick(example.url!)}
                                        className="transition-transform hover:scale-[1.05]"
                                      >
                                        View Interactive Example
                                      </Button>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">
                                        Interactive content will be available in a future update.
                                      </p>
                                    )}
                                  </CardContent>
                                </Card>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Placeholder for future content */}
                      {(!project.description && !project.articleContent?.content && mediaItems.length === 0) && (
                        <motion.div 
                          className="text-center py-12"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4, duration: 0.4 }}
                        >
                          <h2 className="text-lg lg:text-xl font-semibold mb-2">Project Details</h2>
                          <p className="text-muted-foreground">
                            Detailed project information will be displayed here.
                          </p>
                        </motion.div>
                      )}
                      </div>
                    ) : (
                      <div className="max-w-none prose prose-gray dark:prose-invert lg:prose-lg space-y-6">
                        {/* Loading placeholder content */}
                        <div className="space-y-4">
                          <div className="h-6 bg-muted/50 rounded animate-pulse w-1/3" />
                          <div className="space-y-2">
                            <div className="h-4 bg-muted/50 rounded animate-pulse" />
                            <div className="h-4 bg-muted/50 rounded animate-pulse" />
                            <div className="h-4 bg-muted/50 rounded animate-pulse w-2/3" />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="h-6 bg-muted/50 rounded animate-pulse w-1/4" />
                          <div className="aspect-video bg-muted/50 rounded animate-pulse" />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </DialogContent>
      </Dialog>
    );
} 