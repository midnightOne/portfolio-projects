'use client';

import React, { useState, useCallback } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Download, 
  Edit, 
  Trash2, 
  ChevronDown,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  Smartphone
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MediaSelectionModal } from '@/components/admin/media-selection-modal';

interface DownloadFile {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
  description?: string;
}

interface DownloadButtonNodeViewProps {
  node: {
    attrs: {
      files: DownloadFile[];
      label: string;
      variant: 'single' | 'dropdown';
      style: 'primary' | 'secondary' | 'outline';
    };
  };
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
  selected: boolean;
}

export function DownloadButtonNodeView({ 
  node, 
  updateAttributes, 
  deleteNode,
  selected 
}: DownloadButtonNodeViewProps) {
  const { files, label, variant, style } = node.attrs;
  const [isEditing, setIsEditing] = useState(false);

  const formatFileSize = useCallback((bytes?: number) => {
    if (!bytes) return '';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  const getFileIcon = useCallback((type?: string, name?: string) => {
    if (!type && !name) return <File className="h-4 w-4" />;
    
    const fileType = type || name?.split('.').pop()?.toLowerCase() || '';
    
    if (fileType.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileType)) {
      return <FileImage className="h-4 w-4" />;
    }
    if (fileType.includes('video') || ['mp4', 'webm', 'avi', 'mov'].includes(fileType)) {
      return <FileVideo className="h-4 w-4" />;
    }
    if (fileType.includes('text') || ['txt', 'md', 'doc', 'docx', 'pdf'].includes(fileType)) {
      return <FileText className="h-4 w-4" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileType)) {
      return <FileArchive className="h-4 w-4" />;
    }
    if (['apk', 'exe', 'dmg', 'deb'].includes(fileType)) {
      return <Smartphone className="h-4 w-4" />;
    }
    
    return <File className="h-4 w-4" />;
  }, []);

  const handleDownload = useCallback((file: DownloadFile) => {
    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);

  const handleEdit = useCallback(() => {
    setIsMediaModalOpen(true);
  }, []);

  const handleMediaSelect = useCallback((media: any) => {
    // Handle both single media item and array of media items
    const mediaArray = Array.isArray(media) ? media : [media];
    
    // Convert MediaItems to DownloadFile format
    const downloadFiles: DownloadFile[] = mediaArray.map(item => ({
      id: item.id,
      name: item.altText || 'Download File',
      url: item.url,
      size: item.fileSize ? Number(item.fileSize) : undefined,
      type: item.type,
      description: item.description || undefined
    }));

    // Update the node attributes
    updateAttributes({ files: downloadFiles });
  }, [updateAttributes]);

  // Get project ID from editor context (similar to carousel)
  const getProjectId = useCallback(() => {
    // Try to extract from URL or other context
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/');
      const editIndex = pathParts.indexOf('edit');
      if (editIndex !== -1 && pathParts[editIndex + 1]) {
        return pathParts[editIndex + 1];
      }
    }
    
    return null;
  }, []);

  const handleDelete = useCallback(() => {
    if (confirm('Are you sure you want to delete this download button?')) {
      deleteNode();
    }
  }, [deleteNode]);

  const getButtonVariant = () => {
    switch (style) {
      case 'secondary':
        return 'secondary';
      case 'outline':
        return 'outline';
      default:
        return 'default';
    }
  };

  if (!files || files.length === 0) {
    return (
      <NodeViewWrapper className="download-button-node">
        <Card className={`border-2 border-dashed border-gray-300 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <Download className="h-8 w-8 text-gray-400 mb-3" />
            <p className="text-gray-500 mb-3">No files to download</p>
            <div className="flex gap-2">
              <Button onClick={handleEdit} size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Add Files
              </Button>
              <Button onClick={handleDelete} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </NodeViewWrapper>
    );
  }

  // Single file download
  if (variant === 'single' || files.length === 1) {
    const file = files[0];
    
    return (
      <NodeViewWrapper className="download-button-node">
        <div className={`inline-flex items-center gap-2 ${selected ? 'ring-2 ring-blue-500 rounded' : ''}`}>
          <Button
            variant={getButtonVariant()}
            onClick={() => handleDownload(file)}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {label || file.name}
            {file.size && (
              <span className="text-xs opacity-75">
                ({formatFileSize(file.size)})
              </span>
            )}
          </Button>
          
          {/* Edit controls (visible when selected) */}
          {selected && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                title="Edit download button"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                title="Delete download button"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  // Multiple files dropdown
  return (
    <NodeViewWrapper className="download-button-node">
      <div className={`inline-flex items-center gap-2 ${selected ? 'ring-2 ring-blue-500 rounded' : ''}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={getButtonVariant()} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {label}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {files.map((file) => (
              <DropdownMenuItem
                key={file.id}
                onClick={() => handleDownload(file)}
                className="flex items-center gap-3 py-3"
              >
                {getFileIcon(file.type, file.name)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {file.size && <span>{formatFileSize(file.size)}</span>}
                    {file.type && <span>{file.type}</span>}
                  </div>
                  {file.description && (
                    <p className="text-xs text-gray-400 truncate mt-1">
                      {file.description}
                    </p>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Edit controls (visible when selected) */}
        {selected && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              title="Edit download button"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              title="Delete download button"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Media Selection Modal */}
      {isMediaModalOpen && getProjectId() && (
        <MediaSelectionModal
          isOpen={isMediaModalOpen}
          onClose={() => setIsMediaModalOpen(false)}
          projectId={getProjectId()!}
          onMediaSelect={handleMediaSelect}
          context="download"
          multiSelect={true}
          currentMedia={files.map(file => ({
            id: file.id,
            url: file.url,
            altText: file.name,
            description: file.description,
            type: 'DOCUMENT' as const,
            projectId: getProjectId()!,
            fileSize: file.size ? BigInt(file.size) : undefined,
            displayOrder: 0,
            createdAt: new Date()
          }))}
        />
      )}
    </NodeViewWrapper>
  );
}