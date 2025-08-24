"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  X, 
  Image, 
  Video, 
  File, 
  Check, 
  AlertCircle, 
  ArrowLeft,
  Cloud
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



export function MediaUploadInterface() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);




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
    </div>
  );
} 