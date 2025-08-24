"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  X, 
  Image, 
  Video, 
  File, 
  Check, 
  AlertCircle, 
  ArrowLeft,
  Cloud,
  RefreshCw,
  Trash2,
  Database,
  RotateCcw
} from "lucide-react";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  result?: any;
  preview?: string;
}

interface MediaItem {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  url: string;
  thumbnailUrl: string;
  altText: string;
  description?: string;
  width?: number;
  height?: number;
  fileSize: string;
  displayOrder: number;
  createdAt: string;
  project?: {
    id: string;
    title: string;
    slug: string;
  };
}

interface SyncSummary {
  cloudinaryTotal: number;
  databaseTotal: number;
  missingInDatabase: number;
  orphanedInDatabase: number;
}



export function MediaUploadInterface() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(true);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);




  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    const newFiles: UploadFile[] = selectedFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 15),
      file,
      progress: 0,
      status: 'pending',
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const uploadFile = async (fileItem: UploadFile) => {
         const formData = new FormData();
     formData.append('file', fileItem.file);
     
     if (selectedProject && selectedProject !== 'none') {
       formData.append('metadata', JSON.stringify({ 
         projectId: selectedProject,
         type: getMediaType(fileItem.file.type)
       }));
     }

    try {
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id 
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
        f.id === fileItem.id 
          ? { ...f, status: 'success', progress: 100, result }
          : f
      ));
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id 
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

  const getMediaType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'attachment';
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type.startsWith('video/')) return Video;
    return File;
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

  const loadMediaItems = async () => {
    try {
      setIsLoadingMedia(true);
      console.log('Loading media items...');
      const response = await fetch('/api/media');
      const data = await response.json();
      
      console.log('Media API response:', data);
      
      if (data.success) {
        console.log('Media items loaded:', data.data.mediaItems.length);
        setMediaItems(data.data.mediaItems);
      } else {
        console.error('Media API error:', data.error);
        toast({
          title: "Error",
          description: data.error?.message || "Failed to load media items",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Media loading error:', error);
      toast({
        title: "Error",
        description: "Failed to load media items",
        variant: "destructive"
      });
    } finally {
      setIsLoadingMedia(false);
    }
  };

  const checkSyncStatus = async () => {
    try {
      const response = await fetch('/api/media/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview' })
      });
      
      const data = await response.json();
      if (data.success) {
        setSyncSummary(data.data.summary);
      }
    } catch (error) {
      console.error('Failed to check sync status:', error);
    }
  };

  const handleSync = async (action: 'restore' | 'cleanup') => {
    try {
      setIsSyncing(true);
      const response = await fetch('/api/media/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      const data = await response.json();
      if (data.success) {
        const message = action === 'restore' 
          ? `Restored ${data.data.restored || 0} media items from Cloudinary`
          : `Cleaned up ${data.data.deleted || 0} orphaned database records`;
          
        toast({
          title: "Success",
          description: message,
          variant: "default"
        });
        
        console.log('Sync completed:', data.data);
        
        // Reload media items and sync status
        await loadMediaItems();
        await checkSyncStatus();
      } else {
        toast({
          title: "Error",
          description: `Failed to ${action} media items`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${action} media items`,
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteMediaItem = async (mediaId: string) => {
    try {
      const response = await fetch(`/api/media/${mediaId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Media item deleted successfully",
          variant: "default"
        });
        
        // Remove from local state
        setMediaItems(prev => prev.filter(item => item.id !== mediaId));
        await checkSyncStatus();
      } else {
        toast({
          title: "Error",
          description: "Failed to delete media item",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete media item",
        variant: "destructive"
      });
    }
  };

  const testCloudinaryConnection = async () => {
    try {
      setIsSyncing(true);
      const response = await fetch('/api/media/test-cloudinary');
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Cloudinary Connection Test",
          description: `Success! Found ${data.data.sampleResources.totalCount} total files in Cloudinary`,
          variant: "default"
        });
        
        // Refresh sync status after successful test
        await checkSyncStatus();
      } else {
        toast({
          title: "Cloudinary Connection Failed",
          description: data.error.message || "Failed to connect to Cloudinary",
          variant: "destructive"
        });
        
        // Log detailed error for debugging
        console.error('Cloudinary test failed:', data.error);
      }
    } catch (error) {
      toast({
        title: "Connection Test Failed",
        description: "Failed to test Cloudinary connection",
        variant: "destructive"
      });
      console.error('Cloudinary test error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadMediaItems();
    checkSyncStatus();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-start">
        <Button 
          variant="outline" 
          onClick={() => router.push('/admin')}
          className="flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Button>
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Media Files</CardTitle>
              <CardDescription>
                Upload images, videos, and other media files for your projects
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
                <p className="text-xs text-gray-500 mt-2">
                  Supports: Images (JPG, PNG, GIF, WebP), Videos (MP4, WebM), Documents
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
                      <div key={fileItem.id} className="flex items-center gap-3 p-3 border rounded-lg">
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
                            {formatFileSize(fileItem.file.size)} • {getMediaType(fileItem.file.type)}
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
                            onClick={() => removeFile(fileItem.id)}
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

        {/* Settings Sidebar */}
        <div className="space-y-6">
          {/* Project Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Project Assignment</CardTitle>
              <CardDescription>
                Assign uploaded media to a specific project
              </CardDescription>
            </CardHeader>
            <CardContent>
                             <Select value={selectedProject} onValueChange={setSelectedProject}>
                 <SelectTrigger>
                   <SelectValue placeholder="Select a project (optional)" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="none">No specific project</SelectItem>
                   {/* In a real app, this would be populated from the projects API */}
                   <SelectItem value="portfolio-website">Portfolio Website</SelectItem>
                   <SelectItem value="task-management-app">Task Management App</SelectItem>
                   <SelectItem value="e-commerce-platform">E-commerce Platform</SelectItem>
                 </SelectContent>
               </Select>
              <p className="text-xs text-gray-500 mt-2">
                Media can be assigned to projects later if needed
              </p>
            </CardContent>
          </Card>

          {/* Upload Status */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Total Files:</span>
                <span>{files.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Successful:</span>
                <span className="text-green-600">{files.filter(f => f.status === 'success').length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Failed:</span>
                <span className="text-red-600">{files.filter(f => f.status === 'error').length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Pending:</span>
                <span className="text-yellow-600">{files.filter(f => f.status === 'pending').length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Sync Status */}
          {syncSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database size={16} />
                  Sync Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Cloudinary Files:</span>
                  <span>{syncSummary.cloudinaryTotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Database Records:</span>
                  <span>{syncSummary.databaseTotal}</span>
                </div>
                {syncSummary.missingInDatabase > 0 && (
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Missing in DB:</span>
                    <span>{syncSummary.missingInDatabase}</span>
                  </div>
                )}
                {syncSummary.orphanedInDatabase > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Orphaned Records:</span>
                    <span>{syncSummary.orphanedInDatabase}</span>
                  </div>
                )}
                
                <div className="space-y-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={testCloudinaryConnection}
                    disabled={isSyncing}
                    className="w-full"
                  >
                    <Database size={14} className="mr-1" />
                    Test Cloudinary Connection
                  </Button>
                  
                  {/* Always show Force Sync button */}
                  <Button
                    size="sm"
                    onClick={() => handleSync('restore')}
                    disabled={isSyncing}
                    className="w-full"
                    variant={syncSummary.missingInDatabase > 0 ? "default" : "outline"}
                  >
                    <RotateCcw size={14} className="mr-1" />
                    {syncSummary.missingInDatabase > 0 ? 'Restore Missing Files' : 'Force Sync from Cloudinary'}
                  </Button>
                  
                  {syncSummary.orphanedInDatabase > 0 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleSync('cleanup')}
                      disabled={isSyncing}
                      className="w-full"
                    >
                      <Trash2 size={14} className="mr-1" />
                      Clean Orphaned Records
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Provider */}
          <Card>
            <CardHeader>
              <CardTitle>Active Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Cloud size={20} />
                <div>
                  <p className="font-medium">Cloudinary</p>
                  <p className="text-xs text-gray-500">Auto-optimization enabled</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-600">
                All uploads are automatically optimized and delivered via global CDN.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Media Library */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Media Library</CardTitle>
              <CardDescription>
                All uploaded media files ({mediaItems.length} items)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadMediaItems();
                checkSyncStatus();
              }}
              disabled={isLoadingMedia}
            >
              <RefreshCw size={14} className={`mr-1 ${isLoadingMedia ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingMedia ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin mr-2" size={20} />
              Loading media items...
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Image size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No media files found</p>
              <p className="text-sm">Upload some files or sync with Cloudinary to see them here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {mediaItems.map((item) => {
                const isImage = item.type === 'IMAGE';
                const isVideo = item.type === 'VIDEO';
                
                return (
                  <div key={item.id} className="group relative border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    {/* Media Preview */}
                    <div className="aspect-square bg-gray-100 flex items-center justify-center">
                      {isImage ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.altText}
                          className="w-full h-full object-cover"
                        />
                      ) : isVideo ? (
                        <div className="relative w-full h-full bg-black flex items-center justify-center">
                          <Video size={24} className="text-white" />
                        </div>
                      ) : (
                        <File size={24} className="text-gray-400" />
                      )}
                    </div>
                    
                    {/* Media Info */}
                    <div className="p-2">
                      <p className="text-xs font-medium truncate" title={item.altText}>
                        {item.altText}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {item.type.toLowerCase()}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(parseInt(item.fileSize))}
                        </span>
                      </div>
                      {item.project && (
                        <p className="text-xs text-blue-600 truncate mt-1" title={item.project.title}>
                          {item.project.title}
                        </p>
                      )}
                    </div>
                    
                    {/* Delete Button */}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      onClick={() => deleteMediaItem(item.id)}
                    >
                      <X size={12} />
                    </Button>
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