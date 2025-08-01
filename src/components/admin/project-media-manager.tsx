"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MediaItem } from "@/lib/types/project";
import { 
  Upload, 
  X, 
  Image, 
  Video, 
  File, 
  Check, 
  AlertCircle, 
  ArrowLeft,
  Trash2,
  Edit,
  Download,
  Eye,
  Grid,
  List
} from "lucide-react";

interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  result?: any;
  preview?: string;
}

interface ProjectMediaManagerProps {
  projectId: string;
  projectTitle: string;
  existingMedia: MediaItem[];
}

export function ProjectMediaManager({ projectId, projectTitle, existingMedia }: ProjectMediaManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadProgress[]>([]);
  const [media, setMedia] = useState<MediaItem[]>(existingMedia);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    const newFiles: UploadProgress[] = selectedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
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
      type: getMediaType(fileItem.file.type)
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
    
    setIsUploading(false);
  };

  const deleteMedia = async (mediaId: string) => {
    if (!confirm('Are you sure you want to delete this media item? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/media/${mediaId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMedia(prev => prev.filter(m => m.id !== mediaId));
      } else {
        alert('Failed to delete media');
      }
    } catch (error) {
      console.error('Delete media error:', error);
      alert('An error occurred while deleting the media');
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
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={() => router.push(`/admin/projects/${projectId}/edit`)}
          className="flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Project
        </Button>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="flex items-center gap-2"
          >
            {viewMode === 'grid' ? <List size={16} /> : <Grid size={16} />}
            {viewMode === 'grid' ? 'List View' : 'Grid View'}
          </Button>
        </div>
      </div>

      {/* Project Info */}
      <Card>
        <CardHeader>
          <CardTitle>Project: {projectTitle}</CardTitle>
          <CardDescription>
            Manage media files specifically for this project. {media.length} media items uploaded.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle>Upload New Media</CardTitle>
              <CardDescription>
                Add images, videos, and documents to this project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Click to upload files
                </p>
                <p className="text-sm text-gray-600">
                  Or drag and drop files here
                </p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,video/*,.pdf,.zip,.doc,.docx"
              />

              {files.length > 0 && (
                <div className="space-y-3">
                  {files.map((fileItem) => {
                    const FileIcon = getFileIcon(fileItem.file);
                    return (
                      <div key={fileItem.file.name} className="flex items-center gap-3 p-3 border rounded-lg">
                        {fileItem.preview ? (
                          <img 
                            src={fileItem.preview} 
                            alt={fileItem.file.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                            <FileIcon size={20} className="text-gray-500" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(fileItem.file.size)}
                          </p>
                          {fileItem.status === 'uploading' && (
                            <Progress value={fileItem.progress} className="mt-2 h-1" />
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
                            <X size={14} />
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
                >
                  {isUploading ? 'Uploading...' : `Upload ${files.filter(f => f.status === 'pending').length} Files`}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Statistics Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Media Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Total Files:</span>
                <span>{media.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Images:</span>
                <span className="text-blue-600">{media.filter(m => m.type === 'IMAGE').length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Videos:</span>
                <span className="text-purple-600">{media.filter(m => m.type === 'VIDEO').length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Documents:</span>
                <span className="text-green-600">{media.filter(m => m.type === 'DOCUMENT').length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Existing Media */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Existing Media</CardTitle>
              <CardDescription>
                Manage media files already uploaded to this project
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredMedia.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                {searchQuery ? 'No media matches your search' : 'No media files uploaded yet'}
              </p>
              <Button onClick={() => fileInputRef.current?.click()}>
                Upload Your First Media File
              </Button>
            </div>
          ) : (
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              : "space-y-4"
            }>
              {filteredMedia.map((item) => {
                const MediaIcon = getMediaIcon(item.type);
                return (
                  <div 
                    key={item.id} 
                    className={viewMode === 'grid' 
                      ? "border rounded-lg p-4 hover:bg-gray-50"
                      : "flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50"
                    }
                  >
                    {viewMode === 'grid' ? (
                      <>
                                                 {item.type === 'IMAGE' ? (
                           <img 
                             src={item.url} 
                             alt={item.altText || 'Image'}
                             className="w-full h-32 object-cover rounded mb-3"
                           />
                         ) : (
                           <div className="w-full h-32 bg-gray-100 rounded mb-3 flex items-center justify-center">
                             <MediaIcon size={32} className="text-gray-400" />
                           </div>
                         )}
                         <div className="space-y-2">
                           <p className="text-sm font-medium truncate">{item.altText || 'Untitled'}</p>
                           <div className="flex items-center gap-2">
                             <Badge variant="outline" className="text-xs">
                               {item.type}
                             </Badge>
                             <span className="text-xs text-gray-500">
                               {formatFileSize(Number(item.fileSize || 0))}
                             </span>
                           </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => window.open(item.url, '_blank')}>
                              <Eye size={12} />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => deleteMedia(item.id)} className="text-red-600">
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                                                 {item.type === 'IMAGE' ? (
                           <img 
                             src={item.url} 
                             alt={item.altText || 'Image'}
                             className="w-16 h-16 object-cover rounded"
                           />
                         ) : (
                           <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                             <MediaIcon size={24} className="text-gray-400" />
                           </div>
                         )}
                         <div className="flex-1 min-w-0">
                           <p className="font-medium truncate">{item.altText || 'Untitled'}</p>
                           <p className="text-sm text-gray-600 truncate">{item.description}</p>
                           <div className="flex items-center gap-2 mt-1">
                             <Badge variant="outline" className="text-xs">
                               {item.type}
                             </Badge>
                             <span className="text-xs text-gray-500">
                               {formatFileSize(Number(item.fileSize || 0))}
                             </span>
                           </div>
                         </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => window.open(item.url, '_blank')}>
                            <Eye size={14} />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteMedia(item.id)} className="text-red-600">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 