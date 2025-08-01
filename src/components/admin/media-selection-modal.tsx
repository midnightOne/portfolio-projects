'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  List
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

interface MediaSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onMediaSelect: (media: MediaItem) => void;
  currentMedia?: MediaItem;
}

export function MediaSelectionModal({
  isOpen,
  onClose,
  projectId,
  onMediaSelect,
  currentMedia
}: MediaSelectionModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadProgress[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(currentMedia || null);

  // Load existing media when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      loadMedia();
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
        if (selectedMedia?.id === mediaId) {
          setSelectedMedia(null);
        }
      } else {
        alert('Failed to delete media');
      }
    } catch (error) {
      console.error('Delete media error:', error);
      alert('An error occurred while deleting the media');
    }
  };

  const handleSelectMedia = (media: MediaItem) => {
    setSelectedMedia(media);
  };

  const handleConfirmSelection = () => {
    if (selectedMedia) {
      console.log('MediaSelectionModal: Confirming selection:', {
        id: selectedMedia.id,
        url: selectedMedia.url,
        thumbnailUrl: selectedMedia.thumbnailUrl,
        altText: selectedMedia.altText
      });
      onMediaSelect(selectedMedia);
      onClose();
    }
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

  const filteredMedia = media.filter(item =>
    item.altText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95vw] max-w-[95vw] w-[40vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Project Image</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Upload New Image</CardTitle>
              <CardDescription>
                Upload a new image for this project
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

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*"
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

                          {/* Description input */}
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
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Select Existing Image</CardTitle>
                  <CardDescription>
                    Choose from images already uploaded to this project
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search images..."
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
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading media...</p>
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">
                    {searchQuery ? 'No images match your search' : 'No images uploaded yet'}
                  </p>
                  <Button onClick={() => fileInputRef.current?.click()} size="sm">
                    Upload Your First Image
                  </Button>
                </div>
              ) : (
                <div className={viewMode === 'grid'
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                  : "space-y-3"
                }>
                  {filteredMedia.filter(item => item.type === 'IMAGE').map((item) => {
                    const isSelected = selectedMedia?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-all ${isSelected
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                            : 'hover:bg-gray-50 hover:border-gray-300'
                          }`}
                        onClick={() => handleSelectMedia(item)}
                      >
                        {viewMode === 'grid' ? (
                          <>
                            <img
                              src={item.url}
                              alt={item.altText || 'Image'}
                              className="w-full h-40 object-cover rounded mb-2"
                            />
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
                            <img
                              src={item.url}
                              alt={item.altText || 'Image'}
                              className="w-12 h-12 object-cover rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.altText || 'Untitled'}</p>
                              <p className="text-xs text-gray-600 truncate">{item.description}</p>
                              <Badge variant="outline" className="text-xs mt-1">
                                {item.type}
                              </Badge>
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
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            {selectedMedia ? `Selected: ${selectedMedia.altText || 'Untitled'}` : 'No image selected'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSelection}
              disabled={!selectedMedia}
            >
              Select Image
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}