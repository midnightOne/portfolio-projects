'use client';

import { NodeViewWrapper } from '@tiptap/react';
import { Download, ChevronDown, FileText, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DownloadButtonNodeViewProps {
  node: {
    attrs: {
      files: Array<{
        url: string;
        filename: string;
        size?: string;
        type?: string;
      }>;
      label?: string;
      variant?: 'single' | 'dropdown';
    };
  };
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
}

export function DownloadButtonNodeView({ 
  node, 
  updateAttributes, 
  deleteNode 
}: DownloadButtonNodeViewProps) {
  const { files, label = 'Download', variant = 'single' } = node.attrs;

  if (!files || files.length === 0) {
    return (
      <NodeViewWrapper className="download-button-node">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          <p className="text-gray-500 mb-2">No files to download</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={deleteNode}
          >
            Remove Download Button
          </Button>
        </div>
      </NodeViewWrapper>
    );
  }

  const getFileIcon = (type?: string) => {
    if (!type) return <FileText className="h-4 w-4" />;
    
    if (type.includes('zip') || type.includes('archive')) {
      return <Archive className="h-4 w-4" />;
    }
    
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (size?: string) => {
    if (!size) return '';
    return ` (${size})`;
  };

  const handleDownload = (file: { url: string; filename: string }) => {
    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Single file or single button for multiple files
  if (variant === 'single' || files.length === 1) {
    const file = files[0];
    return (
      <NodeViewWrapper className="download-button-node">
        <div className="flex justify-center my-4">
          <Button
            onClick={() => handleDownload(file)}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {label}
            {files.length === 1 && formatFileSize(file.size)}
          </Button>
        </div>
      </NodeViewWrapper>
    );
  }

  // Dropdown for multiple files
  return (
    <NodeViewWrapper className="download-button-node">
      <div className="flex justify-center my-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {label}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-64">
            {files.map((file, index) => (
              <DropdownMenuItem
                key={index}
                onClick={() => handleDownload(file)}
                className="flex items-center gap-2 cursor-pointer"
              >
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">
                    {file.filename}
                  </div>
                  {file.size && (
                    <div className="text-xs text-gray-500">
                      {file.size}
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </NodeViewWrapper>
  );
}