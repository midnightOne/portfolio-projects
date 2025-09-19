/**
 * Enhanced Project Modal - UI System
 * 
 * Enhanced ProjectModal with AI control hooks and GSAP animation coordination.
 * Maintains backward compatibility while adding AI navigation capabilities.
 */

"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Eye, Download, ExternalLink, Tag as TagIcon } from 'lucide-react';
import {
  EnhancedDialog,
  EnhancedDialogContent,
  EnhancedDialogHeader,
  EnhancedDialogTitle,
} from '@/components/ui/enhanced-dialog';
import { Badge } from '@/components/ui/badge';
import { EnhancedButton } from '@/components/ui/enhanced-button';
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader } from '@/components/ui/enhanced-card';
import { cn } from '@/lib/utils';
import type { ProjectWithRelations } from '@/lib/types/project';
import type { AIControlProps, NavigationCommand, HighlightOptions } from '@/lib/ui/types';
import { TiptapDisplayRenderer } from '@/components/tiptap/tiptap-display-renderer';
import { ImageCarousel } from '@/components/media/image-carousel';
import { ImageLightbox } from '@/components/media/image-lightbox';
import DownloadButton from '@/components/media/download-button';
import { ExternalLinks } from '@/components/media/external-links';
import { MODAL, SPACING, COMPONENTS, FLEX } from '@/lib/constants';

interface EnhancedProjectModalProps extends AIControlProps {
  project: ProjectWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  loading?: boolean;
  aiId?: string;
  animated?: boolean;
  animationType?: 'fade' | 'slide' | 'scale';
}

// Modal animation variants with crisp text rendering
const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.98,
    y: 10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "tween" as const,
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const,
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 10,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

// Enhanced animation variants for AI interactions
const aiInteractionVariants = {
  normal: { scale: 1, boxShadow: "none" },
  highlighted: { 
    scale: 1.02,
    boxShadow: "0 0 0 2px var(--primary)",
    transition: { duration: 0.3 }
  },
  aiNavigating: {
    scale: 1.01,
    boxShadow: "0 0 0 1px var(--primary)",
    transition: { duration: 0.7 }
  }
};

export function EnhancedProjectModal({ 
  project, 
  isOpen, 
  onClose, 
  loading = false,
  aiControlEnabled = false,
  aiId = 'project-modal',
  onAINavigate,
  onAIHighlight,
  animated = true,
  animationType = 'scale'
}: EnhancedProjectModalProps) {
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);
  const [isAIHighlighted, setIsAIHighlighted] = React.useState(false);

  // Handle AI navigation commands
  const handleAICommand = React.useCallback((command: NavigationCommand) => {
    if (onAINavigate) {
      onAINavigate(command);
    }
  }, [onAINavigate]);

  // Handle AI highlighting
  const handleAIHighlight = React.useCallback((options: HighlightOptions) => {
    setIsAIHighlighted(true);
    if (onAIHighlight) {
      onAIHighlight('project-modal', options);
    }

    // Auto-remove highlight if timed
    if (options.duration === 'timed' && options.timing) {
      setTimeout(() => {
        setIsAIHighlighted(false);
      }, options.timing);
    }
  }, [onAIHighlight]);

  // Enhanced close handler that notifies AI system
  const handleClose = React.useCallback(() => {
    onClose();

    // Notify AI system of modal close
    if (aiControlEnabled && onAINavigate) {
      const command: NavigationCommand = {
        action: 'modal',
        target: 'close',
        metadata: {
          source: 'user',
          timestamp: Date.now(),
          sessionId: 'current',
        },
      };
      handleAICommand(command);
    }
  }, [onClose, aiControlEnabled, onAINavigate, handleAICommand]);

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
    
    // Notify AI system of external link click
    if (aiControlEnabled && onAINavigate) {
      const command: NavigationCommand = {
        action: 'navigate',
        target: url,
        metadata: {
          source: 'user',
          timestamp: Date.now(),
          sessionId: 'current',
        },
      };
      handleAICommand(command);
    }
  };

  const handleImageClick = (image: any, index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);

    // Notify AI system of image interaction
    if (aiControlEnabled && onAINavigate) {
      const command: NavigationCommand = {
        action: 'navigate',
        target: `image-${index}`,
        metadata: {
          source: 'user',
          timestamp: Date.now(),
          sessionId: 'current',
        },
      };
      handleAICommand(command);
    }
  };

  // Helper function to render inline media component
  const renderInlineMedia = (media: any, className: string = "") => {
    const baseStyles = `rounded-lg shadow-sm ${className}`;
    
    switch (media.type) {
      case 'IMAGE':
        return (
          <div className="my-4 w-full" data-ai-id={`media-${media.id}`}>
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
          <div className="my-4 w-full" data-ai-id={`media-${media.id}`}>
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
          <div className="my-4 w-full" data-ai-id={`media-${media.id}`}>
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

  // Don't render anything if modal is not open
  if (!isOpen) {
    return null;
  }

  // Safe array access with fallbacks
  const mediaItems = project?.mediaItems || [];
  const tags = project?.tags || [];
  const externalLinks = project?.externalLinks || [];
  const downloadableFiles = project?.downloadableFiles || [];

  const metadataImageUrl = project?.metadataImage?.url || project?.thumbnailImage?.url || mediaItems[0]?.url;

  // Add AI-specific attributes
  const aiAttributes = aiControlEnabled ? {
    'data-ai-controllable': 'true',
    'data-ai-id': aiId,
    'data-ai-type': 'project-modal',
  } : {};

  return (
    <EnhancedDialog 
      open={isOpen} 
      onOpenChange={handleClose}
      aiControlEnabled={aiControlEnabled}
      aiId={aiId}
      onAINavigate={onAINavigate}
    >
      <EnhancedDialogContent 
        className={`!w-[95vw] !max-w-none sm:!max-w-[95vw] md:!${MODAL.xl} lg:!${MODAL.full} !${MODAL.height.lg} p-0 overflow-hidden`}
        showCloseButton={false}
        animated={animated}
        animationType={animationType}
        aiControlEnabled={aiControlEnabled}
        aiId={`${aiId}-content`}
        onAINavigate={onAINavigate}
        onAIHighlight={onAIHighlight}
      >
        <motion.div
          className="h-full"
          variants={modalVariants}
          initial="hidden"
          animate={isAIHighlighted ? "highlighted" : "visible"}
          exit="exit"
          style={{
            backfaceVisibility: 'hidden',
            perspective: 1000,
            transform: 'translateZ(0)',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          }}
          {...aiAttributes}
        >
          {/* Loading State Overlay */}
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

          {/* Accessible title for screen readers */}
          <EnhancedDialogHeader className="sr-only" aiId={`${aiId}-header`}>
            <EnhancedDialogTitle aiId={`${aiId}-title`}>
              {project?.title || 'Project Details'}
            </EnhancedDialogTitle>
          </EnhancedDialogHeader>

          {/* Custom close button with AI tracking */}
          <EnhancedButton
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-[60] bg-background/80 backdrop-blur-sm hover:bg-background/90"
            onClick={handleClose}
            aiControlEnabled={aiControlEnabled}
            aiId={`${aiId}-close-button`}
            onAINavigate={onAINavigate}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close project details</span>
          </EnhancedButton>

          <div className="flex h-full flex-col lg:flex-row">
            {/* Left Column - Fixed Metadata Sidebar */}
            <motion.div 
              className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r bg-muted/30 flex flex-col"
              data-ai-id={`${aiId}-sidebar`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              {/* Scrollable content within fixed sidebar */}
              <div className={`flex-1 overflow-y-auto ${COMPONENTS.card.sm} lg:${COMPONENTS.card.md}`}>
                {project ? (
                  <div className={SPACING.stack.md}>
                    {/* Project Title */}
                    <motion.h2 
                      className="text-xl lg:text-2xl font-bold leading-tight"
                      data-ai-id={`${aiId}-project-title`}
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
                        data-ai-id={`${aiId}-project-image`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4, duration: 0.3 }}
                      >
                        <img
                          src={metadataImageUrl}
                          alt={project.metadataImage?.altText || project.title}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => handleImageClick(project.metadataImage || mediaItems[0], 0)}
                        />
                      </motion.div>
                    )}

                    {/* Brief Overview */}
                    {project.briefOverview && (
                      <motion.p 
                        className="text-sm text-muted-foreground leading-relaxed"
                        data-ai-id={`${aiId}-brief-overview`}
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
                        className={COMPONENTS.form.field}
                        data-ai-id={`${aiId}-tags`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.3 }}
                      >
                        <div className={`${FLEX.start} ${SPACING.gap.xs} text-sm font-medium`}>
                          <TagIcon className="h-4 w-4" />
                          Tags
                        </div>
                        <div className={`flex flex-wrap ${SPACING.gap.xs}`}>
                          {tags.map((tag, index) => (
                            <motion.div
                              key={tag.id}
                              data-ai-id={`${aiId}-tag-${tag.id}`}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.7 + index * 0.05, duration: 0.2 }}
                            >
                              <Badge
                                variant="secondary"
                                className="text-xs cursor-pointer hover:scale-105 transition-transform"
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
                      className={`${SPACING.stack.sm} pt-2`}
                      data-ai-id={`${aiId}-metadata`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8, duration: 0.3 }}
                    >
                      {project.workDate && (
                        <div className={`${FLEX.start} ${SPACING.gap.xs} text-sm`}>
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Work Date:</span>
                          <span className="text-muted-foreground">{formatDate(project.workDate)}</span>
                        </div>
                      )}

                      {project.viewCount > 0 && (
                        <div className={`${FLEX.start} ${SPACING.gap.xs} text-sm`}>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Views:</span>
                          <span className="text-muted-foreground">{project.viewCount}</span>
                        </div>
                      )}
                    </motion.div>

                    {/* External Links */}
                    {externalLinks.length > 0 && (
                      <motion.div 
                        className={`${SPACING.stack.sm} pt-2`}
                        data-ai-id={`${aiId}-external-links`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9, duration: 0.3 }}
                      >
                        <h3 className={`text-sm font-medium ${FLEX.start} ${SPACING.gap.xs}`}>
                          <ExternalLink className="h-4 w-4" />
                          External Links
                        </h3>
                        <ExternalLinks
                          links={externalLinks}
                          variant="outline"
                          size="sm"
                          layout="vertical"
                          showDescription={false}
                        />
                      </motion.div>
                    )}

                    {/* Download Files */}
                    {downloadableFiles.length > 0 && (
                      <motion.div 
                        className={`${SPACING.stack.sm} pt-2`}
                        data-ai-id={`${aiId}-downloads`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.1, duration: 0.3 }}
                      >
                        <h3 className={`text-sm font-medium ${FLEX.start} ${SPACING.gap.xs}`}>
                          <Download className="h-4 w-4" />
                          Downloads
                        </h3>
                        <DownloadButton
                          files={downloadableFiles}
                          variant="outline"
                          size="sm"
                          showMetadata={false}
                        />
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
              data-ai-id={`${aiId}-content`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <div className={`flex-1 overflow-y-auto ${COMPONENTS.card.sm} lg:${COMPONENTS.card.md}`} style={{ maxHeight: 'calc(85vh - 2rem)' }}>
                {project ? (
                  <div className={`max-w-none prose prose-gray dark:prose-invert lg:prose-lg ${SPACING.stack.lg}`}>
                    {/* Main Description */}
                    {project.description && (
                      <motion.div 
                        className={SPACING.stack.md}
                        data-ai-id={`${aiId}-description`}
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
                        className={`${SPACING.stack.md} mt-6`}
                        data-ai-id={`${aiId}-article-content`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.4 }}
                      >
                        <h2 className="text-lg lg:text-xl font-semibold">Project Details</h2>
                        <div className="text-sm lg:text-base leading-relaxed">
                          <TiptapDisplayRenderer
                            content={
                              project.articleContent.jsonContent 
                                ? project.articleContent.jsonContent
                                : project.articleContent.content || ''
                            }
                            className="prose-sm lg:prose-base"
                            mediaRenderer={(mediaItems) => (
                              <div className="my-6 space-y-4" data-ai-id={`${aiId}-media-gallery`}>
                                {mediaItems.length > 1 ? (
                                  <ImageCarousel
                                    images={mediaItems}
                                    className="max-w-3xl mx-auto"
                                    showThumbnails={true}
                                  />
                                ) : (
                                  mediaItems.slice(0, 3).map((media, index) => (
                                    <div key={media.id} data-ai-id={`${aiId}-media-item-${index}`}>
                                      {renderInlineMedia(media, "max-w-3xl mx-auto")}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                            downloadRenderer={(files) => (
                              <div className="my-6 flex justify-center" data-ai-id={`${aiId}-download-section`}>
                                <DownloadButton
                                  files={files}
                                  variant="default"
                                  size="default"
                                  inline={true}
                                />
                              </div>
                            )}
                            interactiveRenderer={(url) => (
                              <div className="my-6" data-ai-id={`${aiId}-interactive-section`}>
                                <iframe
                                  src={url}
                                  className="w-full h-96 rounded-lg border"
                                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                />
                              </div>
                            )}
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Enhanced Media Gallery */}
                    {mediaItems.length > 0 && (
                      <motion.div 
                        className={`${SPACING.stack.lg} mt-8`}
                        data-ai-id={`${aiId}-media-section`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.4 }}
                      >
                        <h2 className="text-lg lg:text-xl font-semibold">Project Media</h2>
                        
                        {mediaItems.filter(m => m.type === 'IMAGE' || m.type === 'GIF').length > 1 ? (
                          <ImageCarousel
                            images={mediaItems.filter(m => m.type === 'IMAGE' || m.type === 'GIF')}
                            className="max-w-4xl mx-auto"
                            showThumbnails={true}
                          />
                        ) : (
                          <div className={SPACING.stack.lg}>
                            {mediaItems.slice(0, 15).map((media, index) => (
                              <motion.div
                                key={media.id}
                                className="w-full"
                                data-ai-id={`${aiId}-media-${media.id}`}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.7 + index * 0.1, duration: 0.3 }}
                              >
                                <div className="w-full max-w-4xl mx-auto">
                                  {renderInlineMedia(media)}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Loading placeholder content */}
                    <div className="h-6 bg-muted/50 rounded animate-pulse" />
                    <div className="h-4 bg-muted/50 rounded animate-pulse" />
                    <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
                    <div className="h-32 bg-muted/50 rounded animate-pulse" />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </EnhancedDialogContent>

      {/* Image Lightbox */}
      <ImageLightbox
        images={mediaItems.filter(m => m.type === 'IMAGE' || m.type === 'GIF')}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        initialIndex={lightboxIndex}
      />
    </EnhancedDialog>
  );
}

export type { EnhancedProjectModalProps };