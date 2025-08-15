"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  ChevronDown, 
  FileText, 
  Archive, 
  Image, 
  Video, 
  Music, 
  Code,
  Smartphone,
  Monitor,
  File,
  ExternalLink,
  Clock,
  HardDrive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { DownloadableFile } from '@/lib/types/project';

interface DownloadButtonProps {
  files: DownloadableFile[];
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showMetadata?: boolean;
  inline?: boolean;
}

interface SingleDownloadButtonProps {
  file: DownloadableFile;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showMetadata?: boolean;
  inline?: boolean;
}

// File type to icon mapping
const getFileIcon = (fileType: string) => {
  const type = fileType.toLowerCase();
  
  if (type.includes('pdf') || type.includes('doc') || type.includes('txt')) {
    return FileText;
  }
  if (type.includes('zip') || type.includes('rar') || type.includes('7z') || type.includes('tar')) {
    return Archive;
  }
  if (type.includes('jpg') || type.includes('png') || type.includes('gif') || type.includes('webp')) {
    return Image;
  }
  if (type.includes('mp4') || type.includes('avi') || type.includes('mov') || type.includes('webm')) {
    return Video;
  }
  if (type.includes('mp3') || type.includes('wav') || type.includes('ogg')) {
    return Music;
  }
  if (type.includes('js') || type.includes('ts') || type.includes('html') || type.includes('css') || type.includes('json')) {
    return Code;
  }
  if (type.includes('apk')) {
    return Smartphone;
  }
  if (type.includes('exe') || type.includes('msi') || type.includes('dmg')) {
    return Monitor;
  }
  
  return File;
};

// Format file size
const formatFileSize = (bytes: bigint | number): string => {
  const size = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let fileSize = size;
  
  while (fileSize >= 1024 && unitIndex < units.length - 1) {
    fileSize /= 1024;
    unitIndex++;
  }
  
  return `${fileSize.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

// Format upload date
const formatUploadDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
};

// Get file type badge color
const getFileTypeBadgeColor = (fileType: string): string => {
  const type = fileType.toLowerCase();
  
  if (type.includes('pdf')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  if (type.includes('zip') || type.includes('rar')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  if (type.includes('apk')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (type.includes('exe')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (type.includes('doc')) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
  
  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
};

// Single file download button
export function SingleDownloadButton({
  file,
  variant = 'default',
  size = 'default',
  className,
  showMetadata = false,
  inline = false
}: SingleDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const FileIcon = getFileIcon(file.fileType);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = file.downloadUrl;
      link.download = file.originalName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      // Add to DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Optional: Track download analytics
      // await trackDownload(file.id);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (inline) {
    return (
      <Button
        variant="link"
        size="sm"
        className={cn("h-auto p-0 text-primary hover:text-primary/80", className)}
        onClick={handleDownload}
        disabled={isDownloading}
      >
        <Download className="h-3 w-3 mr-1" />
        {file.originalName}
      </Button>
    );
  }

  if (showMetadata) {
    return (
      <Card className={cn("transition-transform hover:scale-[1.02]", className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <FileIcon className="h-5 w-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm truncate">
                  {file.originalName}
                </h4>
                <Badge 
                  variant="secondary" 
                  className={cn("text-xs", getFileTypeBadgeColor(file.fileType))}
                >
                  {file.fileType.toUpperCase()}
                </Badge>
              </div>
              
              {file.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {file.description}
                </p>
              )}
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {formatFileSize(file.fileSize)}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatUploadDate(file.uploadDate)}
                </div>
              </div>
              
              <Button
                variant={variant}
                size={size}
                className="w-full"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <>
                    <motion.div
                      className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={cn("transition-transform hover:scale-[1.02]", className)}
      onClick={handleDownload}
      disabled={isDownloading}
    >
      {isDownloading ? (
        <>
          <motion.div
            className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          Downloading...
        </>
      ) : (
        <>
          <FileIcon className="h-4 w-4 mr-2" />
          {file.originalName}
        </>
      )}
    </Button>
  );
}

// Multi-file download dropdown
export function DownloadButton({
  files,
  variant = 'default',
  size = 'default',
  className,
  showMetadata = false,
  inline = false
}: DownloadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Don't render if no files
  if (!files || files.length === 0) return null;

  // Single file - use SingleDownloadButton
  if (files.length === 1) {
    return (
      <SingleDownloadButton
        file={files[0]}
        variant={variant}
        size={size}
        className={className}
        showMetadata={showMetadata}
        inline={inline}
      />
    );
  }

  // Multiple files - use dropdown
  const totalSize = files.reduce((acc, file) => acc + Number(file.fileSize), 0);

  const handleDownloadAll = async () => {
    // Download all files sequentially with a small delay
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const link = document.createElement('a');
      link.href = file.downloadUrl;
      link.download = file.originalName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Small delay between downloads to avoid browser blocking
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const handleSingleDownload = async (file: DownloadableFile) => {
    const link = document.createElement('a');
    link.href = file.downloadUrl;
    link.download = file.originalName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (inline) {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="link"
            size="sm"
            className={cn("h-auto p-0 text-primary hover:text-primary/80", className)}
          >
            <Download className="h-3 w-3 mr-1" />
            Download ({files.length} files)
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>
            Download Files ({files.length})
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleDownloadAll}>
            <Download className="h-4 w-4 mr-2" />
            Download All ({formatFileSize(totalSize)})
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {files.map((file) => {
            const FileIcon = getFileIcon(file.fileType);
            return (
              <DropdownMenuItem
                key={file.id}
                onClick={() => handleSingleDownload(file)}
              >
                <FileIcon className="h-4 w-4 mr-2" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">{file.originalName}</div>
                  <div className="text-xs text-muted-foreground">
                    {file.fileType.toUpperCase()} • {formatFileSize(file.fileSize)}
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn("transition-transform hover:scale-[1.02]", className)}
        >
          <Download className="h-4 w-4 mr-2" />
          Download ({files.length})
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Download Files</span>
          <Badge variant="secondary">{files.length} files</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleDownloadAll} className="font-medium">
          <Download className="h-4 w-4 mr-2" />
          Download All ({formatFileSize(totalSize)})
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {files.map((file) => {
          const FileIcon = getFileIcon(file.fileType);
          return (
            <DropdownMenuItem
              key={file.id}
              onClick={() => handleSingleDownload(file)}
              className="flex items-start gap-2 p-3"
            >
              <FileIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate mb-1">
                  {file.originalName}
                </div>
                {file.description && (
                  <div className="text-xs text-muted-foreground mb-1 line-clamp-2">
                    {file.description}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge 
                    variant="outline" 
                    className="text-xs px-1 py-0"
                  >
                    {file.fileType.toUpperCase()}
                  </Badge>
                  <span>{formatFileSize(file.fileSize)}</span>
                  <span>•</span>
                  <span>{formatUploadDate(file.uploadDate)}</span>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Export both components
export { SingleDownloadButton };
export default DownloadButton;