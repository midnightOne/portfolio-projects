// Core data types for the portfolio application

export interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  briefOverview: string;
  tags: Tag[];
  workDate: Date;
  status: 'draft' | 'published';
  visibility: 'public' | 'private';
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Media
  thumbnailImage: MediaItem;
  metadataImage: MediaItem;
  mediaItems: MediaItem[];
  
  // Content
  articleContent: ArticleContent;
  interactiveExamples: InteractiveExample[];
  
  // Links and Downloads
  externalLinks: ExternalLink[];
  downloadableFiles: DownloadableFile[];
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdAt: Date;
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'gif' | 'webm';
  url: string;
  thumbnailUrl?: string;
  alt: string;
  description?: string;
  width: number;
  height: number;
  fileSize: number;
  order: number;
}

export interface ArticleContent {
  id: string;
  content: string; // Rich text/markdown
  embeddedMedia: EmbeddedMedia[];
  projectReferences: ProjectReference[];
}

export interface InteractiveExample {
  id: string;
  type: 'canvas' | 'iframe' | 'webxr';
  title: string;
  description: string;
  url?: string;
  embedCode?: string;
  fallbackContent: string;
  securitySettings: SecuritySettings;
}

export interface ExternalLink {
  id: string;
  label: string;
  url: string;
  icon?: string;
}

export interface DownloadableFile {
  id: string;
  filename: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  downloadUrl: string;
  description?: string;
  uploadDate: Date;
}

export interface EmbeddedMedia {
  id: string;
  mediaItem: MediaItem;
  position: number;
}

export interface ProjectReference {
  id: string;
  referencedProjectId: string;
  position: number;
}

export interface SecuritySettings {
  allowScripts: boolean;
  allowForms: boolean;
  allowPopups: boolean;
  sandbox: string[];
}

export type SortOption = 'date' | 'title' | 'popularity';
export type ViewMode = 'grid' | 'timeline';