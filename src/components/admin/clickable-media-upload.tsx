'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Image as ImageIcon, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaSelectionModal } from '@/components/admin/media-selection-modal';
import { MediaItem } from '@/lib/types/project';

/**
 * ClickableMediaUpload - A modular, reusable media upload component
 * 
 * Features:
 * - Click to open media selection modal
 * - Drag and drop for direct file upload
 * - Flexible aspect ratio handling
 * - Integration with existing media library
 * - Customizable validation and error handling
 * 
 * @example
 * ```tsx
 * <ClickableMediaUpload
 *   currentMedia={project.thumbnailImage}
 *   projectId={project.id}
 *   onMediaSelect={(media) => setProjectImage(media)}
 *   onMediaRemove={() => setProjectImage(null)}
 *   aspectRatio="16:9"
 *   onError={(error) => showToast(error)}
 * />
 * ```
 */
interface ClickableMediaUploadProps {
  /** Currently selected media item to display */
  currentMedia?: MediaItem;
  /** Project ID for accessing project media library */
  projectId?: string;
  /** Callback when media is selected from modal or uploaded */
  onMediaSelect: (media: MediaItem) => void;
  /** Callback when current media is removed */
  onMediaRemove: () => void;
  /** Optional custom upload handler for direct file uploads */
  onDirectUpload?: (file: File) => Promise<MediaItem>;
  /** Error callback for validation and upload errors */
  onError?: (error: string) => void;
  /** Aspect ratio constraint for the upload area */
  aspectRatio?: 'square' | '16:9' | '4:3' | 'auto';
  /** Custom placeholder content when no media is selected */
  placeholder?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Maximum file size in bytes (default: 10MB) */
  maxSize?: number;
  /** Accepted MIME types (default: common image formats) */
  acceptedTypes?: string[];
  /** External error message to display */
  error?: string;
}

export function ClickableMediaUpload({
  currentMedia,
  projectId,
  onMediaSelect,
  onMediaRemove,
  onDirectUpload,
  onError,
  aspectRatio = 'auto',
  placeholder,
  className = '',
  maxSize = 10 * 1024 * 1024, // 10MB default
  acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  error
}: ClickableMediaUploadProps) {
  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('ClickableMediaUpload render:', {
      hasCurrentMedia: !!currentMedia,
      currentMediaId: currentMedia?.id,
      currentMediaUrl: currentMedia?.url,
      currentMediaThumbnailUrl: currentMedia?.thumbnailUrl,
      projectId
    });
  }
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'square': return 'aspect-square';
      case '16:9': return 'aspect-video';
      case '4:3': return 'aspect-[4/3]';
      default: return '';
    }
  };

  const handleClick = () => {
    if (projectId) {
      setIsModalOpen(true);
    } else {
      console.warn('No project ID provided for media selection');
    }
  };

  const handleFileSelect = async (file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      console.error('File validation failed:', validation.error);
      onError?.(validation.error || 'File validation failed');
      return;
    }

    if (onDirectUpload) {
      try {
        setIsUploading(true);
        const uploadedMedia = await onDirectUpload(file);
        onMediaSelect(uploadedMedia);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        console.error('Upload failed:', error);
        onError?.(errorMessage);
      } finally {
        setIsUploading(false);
      }
    } else {
      // Fallback to default upload API if no custom handler provided
      await handleDefaultUpload(file);
    }
  };

  const handleDefaultUpload = async (file: File) => {
    try {
      setIsUploading(true);
      
      // Test authentication (but don't fail if it's just a different error)
      console.log('Testing authentication...');
      try {
        const authTest = await fetch('/api/admin/projects', { method: 'GET' });
        console.log('Auth test response:', authTest.status, authTest.statusText);
        
        if (authTest.status === 401) {
          throw new Error('Authentication required. Please log in.');
        }
      } catch (authError) {
        console.warn('Auth test failed, but continuing with upload:', authError);
        // Continue with upload attempt even if auth test fails
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      const metadata = {
        type: 'image',
        projectId: projectId
        // No description - leave empty
      };
      
      console.log('Upload metadata:', metadata);
      formData.append('metadata', JSON.stringify(metadata));

      console.log('Uploading file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        projectId: projectId
      });

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
        // Note: Don't set Content-Type header for FormData, let browser set it
      });

      console.log('Upload response status:', response.status, response.statusText);
      console.log('Upload response ok:', response.ok);

      if (!response.ok) {
        let errorMessage = `Upload failed (${response.status})`;
        let errorDetails = null;
        
        try {
          const errorData = await response.json();
          console.error('Upload API error response:', errorData);
          
          // Handle different error response formats
          if (errorData.error) {
            if (typeof errorData.error === 'string') {
              errorMessage = errorData.error;
            } else if (errorData.error.message) {
              errorMessage = errorData.error.message;
            } else if (errorData.error.code) {
              errorMessage = `Error: ${errorData.error.code}`;
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (Object.keys(errorData).length === 0) {
            // Empty object response - this usually means authentication failed
            errorMessage = `Upload failed: ${response.status} ${response.statusText} (Empty response - check authentication)`;
          } else {
            // Try to extract any meaningful error info
            errorMessage = JSON.stringify(errorData);
          }
        } catch (e) {
          // If we can't parse the error response, try to get text
          try {
            const errorText = await response.text();
            console.error('Upload API error text:', errorText);
            errorMessage = errorText || `Upload failed: ${response.status} ${response.statusText}`;
          } catch (e2) {
            errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Upload API success response:', result);
      console.log('Response keys:', Object.keys(result));
      console.log('Result.success:', result.success);
      console.log('Result.data:', result.data);
      
      if (result.success && result.data?.mediaItem) {
        // Use the MediaItem directly from the API response
        console.log('✅ Upload successful, selecting media:', result.data.mediaItem);
        onMediaSelect(result.data.mediaItem);
      } else {
        console.error('❌ Invalid API response format:', result);
        let errorMsg = 'Invalid response format from server';
        
        if (Object.keys(result).length === 0) {
          errorMsg = 'Server returned empty response - this usually indicates an authentication or server error';
        } else if (result.error) {
          errorMsg = typeof result.error === 'string' ? result.error : result.error.message || errorMsg;
        } else if (!result.success) {
          errorMsg = 'Upload was not successful - server did not return success=true';
        } else if (!result.data) {
          errorMsg = 'Upload response missing data field';
        } else if (!result.data.mediaItem) {
          errorMsg = 'Upload response missing mediaItem in data';
        }
        
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      console.error('Default upload failed:', error);
      onError?.(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };



  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the main container
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      // Use the first image file
      handleFileSelect(imageFiles[0]);
    } else if (files.length > 0) {
      onError?.('Please drop an image file');
    }
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!acceptedTypes.includes(file.type)) {
      const supportedTypes = acceptedTypes.map(type => type.split('/')[1]).join(', ');
      return {
        valid: false,
        error: `Invalid file type. Supported formats: ${supportedTypes}`
      };
    }
    
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large. Maximum size: ${formatFileSize(maxSize)}`
      };
    }
    
    return { valid: true };
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-2 ${className}`}>

      
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative cursor-pointer rounded-lg border-2 border-dashed transition-all duration-200',
          getAspectRatioClass(),
          isDragging 
            ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-lg' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          error && 'border-red-500 bg-red-50',
          isUploading && 'pointer-events-none opacity-50'
        )}
        style={{ minHeight: '120px' }}
      >
        {currentMedia ? (
          <div className="relative w-full h-full group">
            {/* Loading placeholder */}
            <div 
              id="loading-placeholder"
              className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10"
            >
              <div className="text-gray-400 text-center">
                <div className="animate-pulse">Loading image...</div>
              </div>
            </div>
            
            <img
              src={currentMedia.thumbnailUrl || currentMedia.url}
              alt={currentMedia.altText || 'Project image'}
              className="w-full h-full object-cover rounded-lg relative z-20"
              onLoad={(e) => {
                console.log('✅ Image loaded successfully:', currentMedia.thumbnailUrl || currentMedia.url);
                // Hide loading placeholder
                const loadingDiv = document.getElementById('loading-placeholder');
                if (loadingDiv) {
                  loadingDiv.style.display = 'none';
                }
              }}
              onError={(e) => {
                console.error('❌ Image failed to load:', {
                  src: e.currentTarget.src,
                  originalSrc: currentMedia.thumbnailUrl || currentMedia.url,
                  currentMedia
                });
                
                // Try fallback to main URL if thumbnail fails
                if (currentMedia.thumbnailUrl && e.currentTarget.src === currentMedia.thumbnailUrl) {
                  console.log('🔄 Trying fallback to main URL:', currentMedia.url);
                  e.currentTarget.src = currentMedia.url;
                } else {
                  // If both fail, show error placeholder
                  console.log('❌ Both URLs failed, showing error state');
                  const loadingDiv = document.getElementById('loading-placeholder');
                  if (loadingDiv) {
                    loadingDiv.innerHTML = `
                      <div class="text-red-400 text-center">
                        <div>❌</div>
                        <div class="text-xs mt-1">Failed to load image</div>
                      </div>
                    `;
                  }
                }
              }}
              style={{
                backgroundColor: '#f3f4f6', // Light gray background while loading
                minHeight: '120px'
              }}
            />
            {/* Action buttons - positioned in center */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity z-30 flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                className="shadow-lg"
              >
                <ImageIcon className="h-4 w-4 mr-1" />
                Change
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMediaRemove();
                }}
                className="shadow-lg"
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
            
            {/* Hover overlay for better button visibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none z-25"></div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center h-full min-h-[120px]">
            {isUploading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2" />
                <p className="text-sm text-gray-600">Uploading...</p>
                <p className="text-xs text-gray-500 mt-1">Please wait...</p>
              </div>
            ) : placeholder ? (
              placeholder
            ) : (
              <>
                <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mb-3">
                  <ImageIcon className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Click to select image
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  or drag and drop to upload directly
                </p>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Upload className="h-3 w-3" />
                  <span>
                    {acceptedTypes.map(type => type.split('/')[1]).join(', ')} up to {formatFileSize(maxSize)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {currentMedia && (
        <div className="text-xs text-gray-500">
          {currentMedia.altText || 'Untitled'} 
          {currentMedia.fileSize && ` (${formatFileSize(Number(currentMedia.fileSize))})`}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600">
          {typeof error === 'string' ? error : 
           typeof error === 'object' ? JSON.stringify(error) : 
           'An error occurred'}
        </div>
      )}

      {/* Media Selection Modal */}
      {projectId && (
        <MediaSelectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          projectId={projectId}
          onMediaSelect={onMediaSelect}
          currentMedia={currentMedia}
        />
      )}
    </div>
  );
}