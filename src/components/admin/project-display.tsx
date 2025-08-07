'use client';

import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Calendar, Tag as TagIcon, Eye, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProjectWithRelations, MediaItem, Tag, ExternalLink as ExternalLinkType, DownloadableFile } from '@/lib/types/project';
import { TiptapDisplayRenderer } from '@/components/tiptap/tiptap-display-renderer';

interface ProjectDisplayProps {
  project: ProjectWithRelations;
  mode: 'view' | 'edit';
  className?: string;
  
  // Edit mode props
  onFieldEdit?: (field: string, value: any) => void;
  onTextSelection?: (selection: any) => void;
  errors?: Record<string, string>;
  
  // Custom renderers for edit mode
  titleRenderer?: ReactNode;
  descriptionRenderer?: ReactNode;
  briefOverviewRenderer?: ReactNode;
  tagsRenderer?: ReactNode;
  mediaRenderer?: ReactNode;
  articleContentRenderer?: ReactNode;
  
  // View mode customization
  showViewCount?: boolean;
  showDownloads?: boolean;
  showExternalLinks?: boolean;
  maxDescriptionLength?: number;
}

/**
 * Shared ProjectDisplay component that ensures consistency between edit and view modes
 * 
 * This component provides a unified layout structure that matches the public project view
 * while allowing inline editing capabilities in edit mode.
 * 
 * Features:
 * - Consistent two-column layout (metadata sidebar + main content)
 * - Responsive design matching public project modal
 * - Seamless switching between view and edit modes
 * - Proper typography and spacing consistency
 * - Accessibility support
 */
export function ProjectDisplay({
  project,
  mode,
  className = '',
  onFieldEdit,
  onTextSelection,
  errors = {},
  titleRenderer,
  descriptionRenderer,
  briefOverviewRenderer,
  tagsRenderer,
  mediaRenderer,
  articleContentRenderer,
  showViewCount = true,
  showDownloads = true,
  showExternalLinks = true,
  maxDescriptionLength
}: ProjectDisplayProps) {
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

  const truncateText = (text: string, maxLength?: number) => {
    if (!maxLength || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Safe array access with fallbacks
  const tags = project?.tags || [];
  const externalLinks = project?.externalLinks || [];
  const downloadableFiles = project?.downloadableFiles || [];
  const mediaItems = project?.mediaItems || [];
  
  const metadataImageUrl = project?.metadataImage?.url || project?.thumbnailImage?.url || mediaItems[0]?.url;

  return (
    <div className={cn('flex h-full flex-col lg:flex-row', className)}>
      {/* Left Column - Fixed Metadata Sidebar */}
      <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r bg-muted/30 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="space-y-4">
            {/* Project Title */}
            <div className="space-y-2">
              {mode === 'edit' && titleRenderer ? (
                titleRenderer
              ) : (
                <h2 className="text-xl lg:text-2xl font-bold leading-tight">
                  {project.title}
                </h2>
              )}
            </div>

            {/* Project Image */}
            <div className="space-y-2">
              {mode === 'edit' && mediaRenderer ? (
                mediaRenderer
              ) : metadataImageUrl ? (
                <div className="relative aspect-video rounded-lg overflow-hidden">
                  <img
                    src={metadataImageUrl}
                    alt={project.metadataImage?.altText || project.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-video rounded-lg bg-gray-100 flex items-center justify-center">
                  <div className="text-gray-400 text-center">
                    <div className="w-12 h-12 bg-gray-200 rounded-lg mx-auto mb-2" />
                    <p className="text-sm">No image</p>
                  </div>
                </div>
              )}
            </div>

            {/* Brief Overview */}
            {(project.briefOverview || mode === 'edit') && (
              <div className="space-y-2">
                {mode === 'edit' && briefOverviewRenderer ? (
                  briefOverviewRenderer
                ) : project.briefOverview ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {truncateText(project.briefOverview, maxDescriptionLength)}
                  </p>
                ) : null}
              </div>
            )}

            {/* Tags */}
            {(tags.length > 0 || mode === 'edit') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TagIcon className="h-4 w-4" />
                  Tags
                </div>
                {mode === 'edit' && tagsRenderer ? (
                  tagsRenderer
                ) : tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag.id}
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
                    ))}
                  </div>
                ) : mode === 'edit' ? (
                  <div className="text-sm text-gray-400 italic">
                    No tags added
                  </div>
                ) : null}
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-3 pt-2">
              {project.workDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Work Date:</span>
                  <span className="text-muted-foreground">{formatDate(project.workDate)}</span>
                </div>
              )}

              {showViewCount && project.viewCount > 0 && (
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
            </div>

            {/* External Links */}
            {showExternalLinks && externalLinks.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  External Links
                </h3>
                <div className="space-y-2">
                  {externalLinks.map((link) => (
                    <Button
                      key={link.id}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start transition-transform hover:scale-[1.02]"
                      onClick={() => handleExternalLinkClick(link.url)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {link.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Download Files */}
            {showDownloads && downloadableFiles.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Downloads
                </h3>
                <div className="space-y-2">
                  {downloadableFiles.map((file) => (
                    <Button
                      key={file.id}
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
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Scrollable Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 lg:p-6" style={{ maxHeight: 'calc(85vh - 2rem)' }}>
          <div className="max-w-none prose prose-gray dark:prose-invert lg:prose-lg space-y-6">
            {/* Main Description */}
            {(project.description || mode === 'edit') && (
              <div className="space-y-4">
                <h2 className="text-lg lg:text-xl font-semibold">Project Description</h2>
                {mode === 'edit' && descriptionRenderer ? (
                  descriptionRenderer
                ) : project.description ? (
                  <div className="text-sm lg:text-base leading-relaxed whitespace-pre-wrap">
                    {project.description}
                  </div>
                ) : mode === 'edit' ? (
                  <div className="text-sm text-gray-400 italic">
                    No description added
                  </div>
                ) : null}
              </div>
            )}

            {/* Article Content */}
            {(project.articleContent?.content || project.articleContent?.jsonContent || mode === 'edit') && (
              <div className="space-y-4 mt-6">
                <h2 className="text-lg lg:text-xl font-semibold">Project Details</h2>
                {mode === 'edit' && articleContentRenderer ? (
                  articleContentRenderer
                ) : (project.articleContent?.jsonContent || project.articleContent?.content) ? (
                  <div className="text-sm lg:text-base leading-relaxed">
                    <TiptapDisplayRenderer
                      content={
                        project.articleContent.contentType === 'json' && project.articleContent.jsonContent
                          ? project.articleContent.jsonContent
                          : project.articleContent.content || ''
                      }
                      className="prose-sm lg:prose-base max-w-none"
                    />
                  </div>
                ) : mode === 'edit' ? (
                  <div className="text-sm text-gray-400 italic">
                    No article content added
                  </div>
                ) : null}
              </div>
            )}

            {/* Media Gallery - For view mode */}
            {mode === 'view' && mediaItems.length > 0 && (
              <div className="space-y-6 mt-8">
                <h2 className="text-lg lg:text-xl font-semibold">Media Gallery</h2>
                <div className="space-y-6">
                  {mediaItems.slice(0, 10).map((media) => (
                    <div key={media.id} className="w-full max-w-4xl mx-auto">
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
                            onClick={() => window.open(media.url, '_blank')}
                          />
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
                          {media.description && (
                            <div className="mt-2">
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {media.description}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}