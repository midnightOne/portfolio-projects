'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { MediaItem } from '@/lib/types/project';
import {
  Upload,
  X,
  Image,
  Video,
  File,
  Check,
  AlertCircle,
  Trash2,
  Eye,
  Grid,
  List,
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  Smartphone,
  AlertTriangle
} from 'lucide-react';

interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  result?: any;
  preview?: string;
  description?: string;
}

export type MediaPickerContext = 'carousel' | 'download' | 'general';

interface MediaSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onMediaSelect: (media: MediaItem | MediaItem[]) => void;
  currentMedia?: MediaItem | MediaItem[];
  context?: MediaPickerContext;
  multiSelect?: boolean;
  allowedTypes?: ('IMAGE' | 'VIDEO' | 'DOCUMENT')[];
}

// Context configuration helper
const getContextConfig = (context: MediaPickerContext) => {
  switch (context) {
    case 'carousel':
      return {
        defaultTab: 'images',
        allowedTypes: ['IMAGE', 'VIDEO'] as const,
        restrictTabs: true, // Only show Images tab
        multiSelect: true,
        title: 'Select Images for Carousel'
      };
    case 'download':
      return {
        defaultTab: 'files',
        allowedTypes: ['DOCUMENT'] as const,
        restrictTabs: true, // Only show Files tab
        multiSelect: true,
        title: 'Select Files for Download'
      };
    case 'general':
    default:
      return {
        defaultTab: 'images',
        allowedTypes: ['IMAGE', 'VIDEO', 'DOCUMENT'] as const,
        restrictTabs: false, // Show both tabs
        multiSelect: false,
        title: 'Select Media'
      };
  }
};

export function MediaSelectionModal({
  isOpen,
  onClose,
  projectId,
  onMediaSelect,
  currentMedia,
  context = 'general',
  multiSelect,
  allowedTypes
}: MediaSelectionModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadProgress[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Context-aware configuration
  const contextConfig = getContextConfig(context);
  const shouldMultiSelect = multiSelect !== undefined ? multiSelect : contextConfig.multiSelect;
  const effectiveAllowedTypes = allowedTypes || [...contextConfig.allowedTypes];
  
  // Selection state - support both single and multi-select
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>(() => {
    if (!currentMedia) return [];
    return Array.isArray(currentMedia) ? currentMedia : [currentMedia];
  });
  
  const [activeTab, setActiveTab] = useState<'images' | 'files'>(contextConfig.defaultTab as 'images' | 'files');
  const [unusedMedia, setUnusedMedia] = useState<Set<string>>(new Set());

  // Load existing media when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      loadMedia();
      loadUnusedMedia();
    }
  }, [isOpen, projectId]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/projects/${projectId}/media`);

      if (response.ok) {
        const data = await response.json();
        console.log('Loaded media data:', data);
        setMedia(data.mediaItems || []);
      } else {
        console.error('Failed to load media:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        // Don't clear existing media on error
      }
    } catch (error) {
      console.error('Failed to load media:', error);
      // Don't clear existing media on error
    } finally {
      setLoading(false);
    }
  };

  const loadUnusedMedia = async () => {
    try {
      // TODO: Implement unused media detection API endpoint
      // For now, we'll simulate unused media detection
      // This should call an API that analyzes the project's article content
      // and determines which media items are not referenced
      const response = await fetch(`/api/admin/projects/${projectId}/unused-media`);
      
      if (response.ok) {
        const data = await response.json();
        setUnusedMedia(new Set(data.unusedMediaIds || []));
      } else {
        // If endpoint doesn't exist yet, we'll skip unused media detection
        console.log('Unused media detection not available yet');
      }
    } catch (error) {
      console.log('Unused media detection not available yet:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);

    const newFiles: UploadProgress[] = selectedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      description: ''
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const getFileAcceptTypes = () => {
    if (activeTab === 'images') {
      return 'image/*,video/*';
    } else {
      // For files tab, accept all file types
      return '*/*';
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.file.name === fileId);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.file.name !== fileId);
    });
  };

  const uploadFile = async (fileItem: UploadProgress) => {
    const formData = new FormData();
    formData.append('file', fileItem.file);
    formData.append('metadata', JSON.stringify({
      projectId: projectId,
      type: getMediaType(fileItem.file.type),
      description: fileItem.description || undefined // Only include if not empty
    }));

    try {
      setFiles(prev => prev.map(f =>
        f.file.name === fileItem.file.name
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();

      setFiles(prev => prev.map(f =>
        f.file.name === fileItem.file.name
          ? { ...f, status: 'success', progress: 100, result }
          : f
      ));

      // Add to media list
      if (result.success && result.data?.mediaItem) {
        setMedia(prev => [result.data.mediaItem, ...prev]);
      }
    } catch (error) {
      setFiles(prev => prev.map(f =>
        f.file.name === fileItem.file.name
          ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
          : f
      ));
    }
  };

  const uploadAllFiles = async () => {
    setIsUploading(true);
    const pendingFiles = files.filter(f => f.status === 'pending');

    for (const file of pendingFiles) {
      await uploadFile(file);
    }

    // Refresh media list after all uploads complete
    await loadMedia();

    setIsUploading(false);
  };

  const deleteMedia = async (mediaId: string) => {
    if (!confirm('Are you sure you want to delete this media item?')) {
      return;
    }

    try {
      const response = await fetch(`/api/media/${mediaId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMedia(prev => prev.filter(m => m.id !== mediaId));
        setSelectedMedia(prev => prev.filter(m => m.id !== mediaId));
      } else {
        alert('Failed to delete media');
      }
    } catch (error) {
      console.error('Delete media error:', error);
      alert('An error occurred while deleting the media');
    }
  };

  const handleSelectMedia = (media: MediaItem) => {
    if (shouldMultiSelect) {
      setSelectedMedia(prev => {
        const isSelected = prev.some(m => m.id === media.id);
        if (isSelected) {
          return prev.filter(m => m.id !== media.id);
        } else {
          return [...prev, media];
        }
      });
    } else {
      setSelectedMedia([media]);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedMedia.length > 0) {
      console.log('MediaSelectionModal: Confirming selection:', selectedMedia);
      if (shouldMultiSelect) {
        onMediaSelect(selectedMedia);
      } else {
        onMediaSelect(selectedMedia[0]);
      }
      onClose();
    }
  };

  const isMediaSelected = (mediaId: string) => {
    return selectedMedia.some(m => m.id === mediaId);
  };

  const getMediaType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    return 'DOCUMENT';
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type.startsWith('video/')) return Video;
    return File;
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'IMAGE': return Image;
      case 'VIDEO': return Video;
      default: return File;
    }
  };

  const getDetailedFileIcon = (type: string, url?: string) => {
    const fileExtension = url?.split('.').pop()?.toLowerCase() || '';
    
    switch (type) {
      case 'IMAGE':
        return <FileImage className="h-4 w-4" />;
      case 'VIDEO':
        return <FileVideo className="h-4 w-4" />;
      case 'DOCUMENT':
        if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(fileExtension)) {
          return <FileText className="h-4 w-4" />;
        }
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExtension)) {
          return <FileArchive className="h-4 w-4" />;
        }
        if (['apk', 'exe', 'dmg', 'deb'].includes(fileExtension)) {
          return <Smartphone className="h-4 w-4" />;
        }
        return <File className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <Check className="text-green-500" size={16} />;
      case 'error': return <AlertCircle className="text-red-500" size={16} />;
      default: return null;
    }
  };

  const filteredMedia = media.filter(item => {
    // Filter by search query
    const matchesSearch = !searchQuery || 
      item.altText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by tab
    const matchesTab = activeTab === 'images' 
      ? ['IMAGE', 'VIDEO'].includes(item.type)
      : item.type === 'DOCUMENT';
    
    // Filter by allowed types for context
    const matchesAllowedTypes = effectiveAllowedTypes.includes(item.type as any);
    
    return matchesSearch && matchesTab && matchesAllowedTypes;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95vw] max-w-[95vw] w-[50vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{contextConfig.title}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'images' | 'files')} className="flex-1 flex flex-col">
          {/* Tab Navigation - only show if not restricted */}
          {!contextConfig.restrictTabs && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="images" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Images
              </TabsTrigger>
              <TabsTrigger value="files" className="flex items-center gap-2">
                <File className="h-4 w-4" />
                Files
              </TabsTrigger>
            </TabsList>
          )}

          {/* Images Tab */}
          <TabsContent value="images" className="flex-1 flex flex-col space-y-4 mt-4">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle>Upload New {activeTab === 'images' ? 'Images' : 'Files'}</CardTitle>
                <CardDescription>
                  Upload new {activeTab === 'images' ? 'images or videos' : 'files'} for this project
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');

                    const droppedFiles = Array.from(e.dataTransfer.files);
                    const newFiles: UploadProgress[] = droppedFiles.map(file => ({
                      file,
                      progress: 0,
                      status: 'pending',
                      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
                      description: ''
                    }));

                    setFiles(prev => [...prev, ...newFiles]);
                  }}
                >
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Click to upload {activeTab === 'images' ? 'images' : 'files'}
                  </p>
                  <p className="text-xs text-gray-600">
                    Or drag and drop {activeTab === 'images' ? 'images' : 'files'} here
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept={getFileAcceptTypes()}
                />

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((fileItem) => {
                      const FileIcon = getFileIcon(fileItem.file);
                      return (
                        <div key={fileItem.file.name} className="flex items-center gap-3 p-2 border rounded-lg">
                          {fileItem.preview ? (
                            <img
                              src={fileItem.preview}
                              alt={fileItem.file.name}
                              className="w-10 h-10 object-cover rounded"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                              <FileIcon size={16} className="text-gray-500" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(fileItem.file.size)}
                            </p>

                            <Input
                              placeholder="Description (optional)"
                              value={fileItem.description || ''}
                              onChange={(e) => {
                                setFiles(prev => prev.map(f =>
                                  f.file.name === fileItem.file.name
                                    ? { ...f, description: e.target.value }
                                    : f
                                ));
                              }}
                              className="mt-1 h-7 text-xs"
                              disabled={fileItem.status === 'uploading'}
                            />

                            {fileItem.status === 'uploading' && (
                              <Progress value={fileItem.progress} className="mt-1 h-1" />
                            )}
                            {fileItem.error && (
                              <p className="text-xs text-red-600 mt-1">{fileItem.error}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {getStatusIcon(fileItem.status)}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFile(fileItem.file.name)}
                              disabled={fileItem.status === 'uploading'}
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {files.length > 0 && (
                  <Button
                    onClick={uploadAllFiles}
                    disabled={isUploading || files.every(f => f.status !== 'pending')}
                    className="w-full"
                    size="sm"
                  >
                    {isUploading ? 'Uploading...' : `Upload ${files.filter(f => f.status === 'pending').length} Files`}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Existing Media */}
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Select Existing {activeTab === 'images' ? 'Images' : 'Files'}</CardTitle>
                    <CardDescription>
                      Choose from {activeTab === 'images' ? 'images and videos' : 'files'} already uploaded to this project
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={`Search ${activeTab}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 h-9"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                      size="sm"
                    >
                      {viewMode === 'grid' ? <List size={14} /> : <Grid size={14} />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading media...</p>
                  </div>
                ) : filteredMedia.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">
                      {searchQuery ? `No ${activeTab} match your search` : `No ${activeTab} uploaded yet`}
                    </p>
                    <Button onClick={() => fileInputRef.current?.click()} size="sm">
                      Upload Your First {activeTab === 'images' ? 'Image' : 'File'}
                    </Button>
                  </div>
                ) : (
                  <div className={viewMode === 'grid'
                    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                    : "space-y-3"
                  }>
                    {filteredMedia.map((item) => {
                      const isSelected = isMediaSelected(item.id);
                      const isUnused = unusedMedia.has(item.id);
                      
                      return (
                        <div
                          key={item.id}
                          className={`border rounded-lg p-3 cursor-pointer transition-all relative ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                              : 'hover:bg-gray-50 hover:border-gray-300'
                          } ${
                            isUnused ? 'border-orange-200 bg-orange-50' : ''
                          }`}
                          onClick={() => handleSelectMedia(item)}
                        >
                          {/* Multi-select checkbox */}
                          {shouldMultiSelect && (
                            <div className="absolute top-2 left-2 z-10">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleSelectMedia(item)}
                                className="bg-white border-2"
                              />
                            </div>
                          )}

                          {/* Unused indicator */}
                          {isUnused && (
                            <div className="absolute top-2 right-2 z-10" title="Unused media">
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            </div>
                          )}

                          {viewMode === 'grid' ? (
                            <>
                              {activeTab === 'images' ? (
                                <img
                                  src={item.url}
                                  alt={item.altText || 'Media'}
                                  className="w-full h-40 object-cover rounded mb-2"
                                />
                              ) : (
                                <div className="w-full h-40 bg-gray-100 rounded mb-2 flex items-center justify-center">
                                  {getDetailedFileIcon(item.type, item.url)}
                                </div>
                              )}
                              <div className="space-y-1">
                                <p className="text-xs font-medium truncate">{item.altText || 'Untitled'}</p>
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="text-xs">
                                    {item.type}
                                  </Badge>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(item.url, '_blank');
                                      }}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Eye size={10} />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMedia(item.id);
                                      }}
                                      className="h-6 w-6 p-0 text-red-600"
                                    >
                                      <Trash2 size={10} />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-3">
                              {activeTab === 'images' ? (
                                <img
                                  src={item.url}
                                  alt={item.altText || 'Media'}
                                  className="w-12 h-12 object-cover rounded"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                  {getDetailedFileIcon(item.type, item.url)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.altText || 'Untitled'}</p>
                                <p className="text-xs text-gray-600 truncate">{item.description}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {item.type}
                                  </Badge>
                                  {item.fileSize && (
                                    <span className="text-xs text-gray-500">
                                      {formatFileSize(Number(item.fileSize))}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(item.url, '_blank');
                                  }}
                                >
                                  <Eye size={12} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteMedia(item.id);
                                  }}
                                  className="text-red-600"
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="flex-1 flex flex-col space-y-4 mt-4">
            {/* Same content as Images tab but filtered for files */}
            <Card>
              <CardHeader>
                <CardTitle>Upload New Files</CardTitle>
                <CardDescription>
                  Upload new files for this project
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');

                    const droppedFiles = Array.from(e.dataTransfer.files);
                    const newFiles: UploadProgress[] = droppedFiles.map(file => ({
                      file,
                      progress: 0,
                      status: 'pending',
                      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
                      description: ''
                    }));

                    setFiles(prev => [...prev, ...newFiles]);
                  }}
                >
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Click to upload files
                  </p>
                  <p className="text-xs text-gray-600">
                    Or drag and drop files here
                  </p>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((fileItem) => {
                      const FileIcon = getFileIcon(fileItem.file);
                      return (
                        <div key={fileItem.file.name} className="flex items-center gap-3 p-2 border rounded-lg">
                          {fileItem.preview ? (
                            <img
                              src={fileItem.preview}
                              alt={fileItem.file.name}
                              className="w-10 h-10 object-cover rounded"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                              <FileIcon size={16} className="text-gray-500" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(fileItem.file.size)}
                            </p>

                            <Input
                              placeholder="Description (optional)"
                              value={fileItem.description || ''}
                              onChange={(e) => {
                                setFiles(prev => prev.map(f =>
                                  f.file.name === fileItem.file.name
                                    ? { ...f, description: e.target.value }
                                    : f
                                ));
                              }}
                              className="mt-1 h-7 text-xs"
                              disabled={fileItem.status === 'uploading'}
                            />

                            {fileItem.status === 'uploading' && (
                              <Progress value={fileItem.progress} className="mt-1 h-1" />
                            )}
                            {fileItem.error && (
                              <p className="text-xs text-red-600 mt-1">{fileItem.error}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {getStatusIcon(fileItem.status)}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFile(fileItem.file.name)}
                              disabled={fileItem.status === 'uploading'}
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {files.length > 0 && (
                  <Button
                    onClick={uploadAllFiles}
                    disabled={isUploading || files.every(f => f.status !== 'pending')}
                    className="w-full"
                    size="sm"
                  >
                    {isUploading ? 'Uploading...' : `Upload ${files.filter(f => f.status === 'pending').length} Files`}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Files Grid/List */}
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Select Existing Files</CardTitle>
                    <CardDescription>
                      Choose from files already uploaded to this project
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-48 h-9"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                      size="sm"
                    >
                      {viewMode === 'grid' ? <List size={14} /> : <Grid size={14} />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading files...</p>
                  </div>
                ) : filteredMedia.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">
                      {searchQuery ? 'No files match your search' : 'No files uploaded yet'}
                    </p>
                    <Button onClick={() => fileInputRef.current?.click()} size="sm">
                      Upload Your First File
                    </Button>
                  </div>
                ) : (
                  <div className={viewMode === 'grid'
                    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                    : "space-y-3"
                  }>
                    {filteredMedia.map((item) => {
                      const isSelected = isMediaSelected(item.id);
                      const isUnused = unusedMedia.has(item.id);
                      
                      return (
                        <div
                          key={item.id}
                          className={`border rounded-lg p-3 cursor-pointer transition-all relative ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                              : 'hover:bg-gray-50 hover:border-gray-300'
                          } ${
                            isUnused ? 'border-orange-200 bg-orange-50' : ''
                          }`}
                          onClick={() => handleSelectMedia(item)}
                        >
                          {/* Multi-select checkbox */}
                          {shouldMultiSelect && (
                            <div className="absolute top-2 left-2 z-10">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleSelectMedia(item)}
                                className="bg-white border-2"
                              />
                            </div>
                          )}

                          {/* Unused indicator */}
                          {isUnused && (
                            <div className="absolute top-2 right-2 z-10" title="Unused media">
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            </div>
                          )}

                          {viewMode === 'grid' ? (
                            <>
                              <div className="w-full h-40 bg-gray-100 rounded mb-2 flex items-center justify-center">
                                {getDetailedFileIcon(item.type, item.url)}
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-medium truncate">{item.altText || 'Untitled'}</p>
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="text-xs">
                                    {item.type}
                                  </Badge>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(item.url, '_blank');
                                      }}
                                      className="h-6 w-6 p-0"
                                    >
                                      <Eye size={10} />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteMedia(item.id);
                                      }}
                                      className="h-6 w-6 p-0 text-red-600"
                                    >
                                      <Trash2 size={10} />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                {getDetailedFileIcon(item.type, item.url)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.altText || 'Untitled'}</p>
                                <p className="text-xs text-gray-600 truncate">{item.description}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {item.type}
                                  </Badge>
                                  {item.fileSize && (
                                    <span className="text-xs text-gray-500">
                                      {formatFileSize(Number(item.fileSize))}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(item.url, '_blank');
                                  }}
                                >
                                  <Eye size={12} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteMedia(item.id);
                                  }}
                                  className="text-red-600"
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            {selectedMedia.length === 0 
              ? 'No media selected' 
              : shouldMultiSelect 
                ? `${selectedMedia.length} item${selectedMedia.length !== 1 ? 's' : ''} selected`
                : `Selected: ${selectedMedia[0]?.altText || 'Untitled'}`
            }
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSelection}
              disabled={selectedMedia.length === 0}
            >
              Select {shouldMultiSelect && selectedMedia.length > 1 ? `${selectedMedia.length} Items` : 'Media'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
