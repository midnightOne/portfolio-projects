# Media Upload and Management System Documentation

## Overview

The Portfolio Projects application features a comprehensive media upload and management system with multi-provider support, admin interface, and project-specific media organization. This document serves as a technical reference for extending and maintaining the media system.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Interface                          │
├─────────────────────┬───────────────────┬───────────────────┤
│   Global Upload     │  Project Upload   │  Media Manager    │
│   /admin/media/     │  /admin/projects/ │  Grid/List Views  │
│   upload            │  [id]/media       │  Search/Filter    │
└─────────────────────┼───────────────────┼───────────────────┘
                      │                   │
┌─────────────────────┼───────────────────┼───────────────────┐
│                   API Layer                                 │
├─────────────────────┼───────────────────┼───────────────────┤
│ /api/media/upload   │ /api/media/[id]   │ /api/admin/*      │
│ • File Upload       │ • GET/PUT/DELETE  │ • Stats/Projects  │
│ • Validation        │ • Metadata Update │ • Authentication  │
│ • Provider Routing  │ • Cloud Cleanup   │ • Admin Routes    │
└─────────────────────┼───────────────────┼───────────────────┘
                      │                   │
┌─────────────────────┼───────────────────┼───────────────────┐
│                Provider Abstraction                        │
├─────────────────────┼───────────────────┼───────────────────┤
│    Cloudinary       │      AWS S3       │    Vercel Blob    │
│  (Default/Active)   │  (Cost-effective) │  (Vercel Native)  │
│                     │                   │                   │
│  Supabase Storage   │ GitHub + jsDelivr │   [Extensible]    │
│ (DB-integrated)     │ (Free/Open Source)│   (Future Providers)│
└─────────────────────┼───────────────────┼───────────────────┘
                      │                   │
┌─────────────────────┼───────────────────┼───────────────────┐
│                  Database Layer                            │
├─────────────────────┼───────────────────┼───────────────────┤
│    MediaItem        │     Project       │      Tags         │
│  • URL/Metadata     │  • Media Relations│  • Project Tags   │
│  • File Info        │  • Thumbnails     │  • Organization   │
│  • Project Link     │  • Display Order  │  • Filtering      │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### MediaItem Model

```typescript
model MediaItem {
  id           String    @id @default(cuid())
  projectId    String?   // Optional project association
  type         MediaType // IMAGE, VIDEO, DOCUMENT  
  url          String    // Cloud storage URL
  thumbnailUrl String?   // Optional thumbnail
  altText      String?   // Accessibility text
  description  String?   // Optional description
  width        Int?      // Image/video dimensions
  height       Int?
  fileSize     BigInt?   // File size in bytes
  displayOrder Int       @default(0)
  createdAt    DateTime  @default(now())

  // Relationships
  project              Project?        @relation("ProjectMedia")
  thumbnailForProjects Project[]       @relation("ProjectThumbnail")
  metadataForProjects  Project[]       @relation("ProjectMetadata")
  carouselImages       CarouselImage[]
  embeddedMedia        EmbeddedMedia[]
}

enum MediaType {
  IMAGE
  VIDEO
  DOCUMENT
}
```

### Project Relations

```typescript
model Project {
  // Media relationships
  thumbnailImageId String?
  thumbnailImage   MediaItem? @relation("ProjectThumbnail")
  metadataImageId  String?
  metadataImage    MediaItem? @relation("ProjectMetadata")
  mediaItems       MediaItem[] @relation("ProjectMedia")
}
```

## Provider System

### Base Interface

```typescript
interface MediaProvider {
  name: string;
  upload(file: File | Buffer, options?: UploadOptions): Promise<MediaResult>;
  uploadFromPath(filePath: string, options?: UploadOptions): Promise<MediaResult>;
  delete(publicId: string): Promise<DeleteResult>;
  transform(url: string, transformations: Transformation[]): string;
  getUrl(publicId: string, options?: UrlOptions): string;
}
```

### Supported Providers

#### 1. Cloudinary (Default/Active)
- **File**: `src/lib/media/providers/cloudinary.ts`
- **Features**: Auto-optimization, transformations, global CDN
- **Config**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- **Best for**: Production sites requiring image optimization

#### 2. AWS S3
- **File**: `src/lib/media/providers/s3.ts`
- **Features**: Cost-effective storage, CloudFront CDN
- **Config**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`
- **Best for**: Large storage needs, cost optimization

#### 3. Vercel Blob Storage
- **File**: `src/lib/media/providers/vercel-blob.ts`
- **Features**: Seamless Vercel integration, global edge
- **Config**: `BLOB_READ_WRITE_TOKEN`
- **Best for**: Vercel-hosted applications

#### 4. Supabase Storage
- **File**: `src/lib/media/providers/supabase-storage.ts`
- **Features**: Database integration, Row Level Security
- **Config**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_STORAGE_BUCKET`
- **Best for**: Apps already using Supabase

#### 5. GitHub + jsDelivr
- **File**: `src/lib/media/providers/github-jsdelivr.ts`
- **Features**: Free CDN, version controlled, Git workflow
- **Config**: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`
- **Best for**: Open source projects, free hosting

### Provider Configuration

```typescript
// Environment variable priority
MEDIA_PROVIDER=cloudinary  // Provider selection

// Factory pattern implementation
export function createMediaProvider(): MediaProvider {
  const config = getMediaProviderConfig();
  switch (config.provider) {
    case 'cloudinary': return new CloudinaryProvider(config.cloudinary!);
    case 's3': return new S3Provider(config.s3!);
    case 'vercel': return new VercelBlobProvider(config.vercel!);
    case 'supabase': return new SupabaseStorageProvider(config.supabase!);
    case 'github': return new GitHubJsDelivrProvider(config.github!);
  }
}
```

## API Endpoints

### Upload API

**POST** `/api/media/upload`

```typescript
// Request (multipart/form-data)
{
  file: File,
  metadata?: string // JSON: { projectId?, type?, altText?, description? }
}

// Response
{
  success: boolean,
  mediaItem: {
    id: string,
    url: string,
    type: MediaType,
    // ... other fields
  },
  provider: string
}
```

**Authentication**: Admin only
**Validation**: File size, type, extension, security checks
**Process**: 
1. Authenticate user
2. Parse multipart form data
3. Validate file
4. Upload to active provider
5. Save metadata to database
6. Return media item record

### Media Management API

**GET** `/api/media/[id]`
```typescript
// Response
{ mediaItem: MediaItem }
```

**PUT** `/api/media/[id]`
```typescript
// Request
{ altText?: string, description?: string }

// Response  
{ message: string, mediaItem: MediaItem }
```

**DELETE** `/api/media/[id]`
```typescript
// Response
{ message: string, deletedId: string }
```

**Process for DELETE**:
1. Authenticate admin user
2. Find media item in database
3. Extract publicId from cloud URL
4. Delete from cloud provider
5. Delete database record
6. Return confirmation

### Admin APIs

**GET** `/api/admin/stats`
```typescript
// Response
{
  totalProjects: number,
  publishedProjects: number,
  draftProjects: number,
  totalMediaFiles: number,
  totalViews: number
}
```

**GET** `/api/admin/projects`
```typescript
// Query params: limit?, offset?, status?, visibility?
// Response
{
  projects: ProjectSummary[],
  pagination: { total, limit, offset, hasMore }
}
```

## Admin Interface Components

### Global Media Upload

**Route**: `/admin/media/upload`
**Component**: `MediaUploadInterface`
**Features**:
- Drag-and-drop file upload
- Provider information display
- Project assignment (optional)
- Upload progress tracking
- File validation feedback

```typescript
interface MediaUploadInterface {
  // State management
  files: UploadFile[]
  selectedProject: string
  showProviderInfo: boolean
  
  // Key functions
  handleFileSelect()
  uploadAllFiles()
  removeFile()
}
```

### Project-Specific Media Management

**Route**: `/admin/projects/[id]/media`
**Component**: `ProjectMediaManager`
**Features**:
- Project-scoped media display
- Grid/list view toggle
- Search and filtering
- Upload with automatic project assignment
- Media deletion with confirmation

```typescript
interface ProjectMediaManagerProps {
  projectId: string
  projectTitle: string
  existingMedia: MediaItem[]
}
```

### Dashboard Integration

**Component**: `AdminDashboard`
**Media Features**:
- Total media files count
- Quick upload button
- Recent project media counts
- Media statistics display

## File Validation System

### Validation Rules

```typescript
interface FileValidation {
  maxFileSize: number      // 50MB default
  allowedTypes: string[]   // MIME types
  allowedExtensions: string[]
  securityChecks: boolean  // Virus/malware scanning
}

// Default validation
const DEFAULT_VALIDATION = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf', 'application/zip'
  ],
  allowedExtensions: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.mp4', '.webm', '.mov',
    '.pdf', '.zip', '.doc', '.docx'
  ]
}
```

### Security Measures

1. **File Type Validation**: MIME type + extension verification
2. **Size Limits**: Configurable per media type
3. **Content Scanning**: Basic security checks
4. **Authentication**: Admin-only upload access
5. **Input Sanitization**: Filename and metadata cleaning

## Usage Examples

### Uploading Media via API

```typescript
// Admin upload with project assignment
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('metadata', JSON.stringify({
  projectId: 'proj_123',
  type: 'IMAGE',
  altText: 'Screenshot of the application',
  description: 'Main interface showing the dashboard'
}));

const response = await fetch('/api/media/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
// result.mediaItem contains the created media record
```

### Displaying Media with Cloudinary Optimization

```typescript
import { CldImage } from 'next-cloudinary';

// Extract publicId from Cloudinary URL
const publicId = mediaItem.url.split('/').pop()?.split('.')[0];

// Optimized display
<CldImage
  src={publicId}
  width={800}
  height={600}
  alt={mediaItem.altText || 'Image'}
  crop={{ type: 'auto', source: true }}
  quality="auto"
  format="auto"
/>
```

### Programmatic Media Management

```typescript
import { getMediaProvider } from '@/lib/media';

// Upload from file path
const provider = getMediaProvider();
const result = await provider.uploadFromPath('/path/to/file.jpg', {
  folder: 'portfolio-projects',
  public_id: 'custom-name'
});

// Apply transformations
const transformedUrl = provider.transform(result.url, [
  { resize: { width: 400, height: 300 } },
  { enhance: { sharpen: true } }
]);
```

## Extension Points

### Adding New Providers

1. **Create Provider Class**: Implement `MediaProvider` interface
2. **Add Configuration**: Environment variables and config types
3. **Update Factory**: Add case to `createMediaProvider()`
4. **Update Types**: Add to `MediaProviderConfig` union
5. **Add Documentation**: Provider setup instructions

```typescript
// Example: Adding Backblaze B2
export class BackblazeProvider implements MediaProvider {
  name = 'backblaze';
  
  constructor(private config: BackblazeConfig) {}
  
  async upload(file: File | Buffer, options: UploadOptions = {}) {
    // Implement Backblaze B2 upload logic
  }
  
  // ... implement other required methods
}
```

### Extending File Validation

```typescript
// Custom validation for specific file types
export const DESIGN_FILE_VALIDATION = {
  maxFileSize: 100 * 1024 * 1024, // 100MB for design files
  allowedTypes: [
    'application/x-sketch',
    'application/vnd.figma',
    'application/x-adobe-illustrator'
  ],
  allowedExtensions: ['.sketch', '.fig', '.ai', '.psd']
};
```

### Adding Media Processing

```typescript
// Extend upload pipeline with processing
export async function uploadWithProcessing(
  file: File,
  processing: ProcessingOptions
) {
  // 1. Validate file
  // 2. Apply processing (resize, compress, etc.)
  // 3. Upload processed file
  // 4. Generate thumbnails
  // 5. Save to database
}
```

### Custom Media Types

```typescript
// Extend MediaType enum in schema.prisma
enum MediaType {
  IMAGE
  VIDEO
  DOCUMENT
  AUDIO        // New
  DESIGN       // New
  ARCHIVE      // New
}

// Update validation and UI accordingly
```

## Monitoring and Analytics

### Media Usage Tracking

```typescript
// Track upload events
export async function trackMediaUpload(mediaItem: MediaItem) {
  await prisma.mediaAnalytics.create({
    data: {
      mediaId: mediaItem.id,
      action: 'UPLOAD',
      timestamp: new Date(),
      metadata: { provider: 'cloudinary', fileSize: mediaItem.fileSize }
    }
  });
}
```

### Storage Analytics

```typescript
// Calculate storage usage by provider
export async function getStorageStats() {
  const stats = await prisma.mediaItem.groupBy({
    by: ['type'],
    _sum: { fileSize: true },
    _count: { id: true }
  });
  
  return {
    totalFiles: stats.reduce((sum, stat) => sum + stat._count.id, 0),
    totalSize: stats.reduce((sum, stat) => sum + (stat._sum.fileSize || 0), 0),
    byType: stats
  };
}
```

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Load media on demand
2. **Thumbnail Generation**: Automatic thumbnails for large images
3. **CDN Caching**: Leverage provider CDNs
4. **Progressive Loading**: Show low-quality placeholders first
5. **Compression**: Automatic compression based on file type

### Cloudinary Optimizations

```typescript
// Automatic optimization settings
const CLOUDINARY_DEFAULTS = {
  quality: 'auto',
  format: 'auto',
  fetch_format: 'auto',
  flags: ['progressive', 'immutable_cache']
};
```

## Troubleshooting

### Common Issues

1. **Upload Failures**: Check provider credentials and file validation
2. **Missing Images**: Verify URL structure and provider connectivity
3. **Slow Loading**: Enable CDN and check image sizes
4. **Permission Errors**: Verify admin authentication and role checks

### Debug Tools

```typescript
// Enable debug logging
process.env.MEDIA_DEBUG = 'true';

// Test provider connectivity
await testProviderConnection('cloudinary');

// Validate file before upload
const validation = validateFile(file, VALIDATION_RULES);
```

## Future Enhancements

### Planned Features

1. **Bulk Upload**: Multiple file selection and batch processing
2. **Media Library**: Global media browser and management
3. **Image Editor**: Basic editing tools (crop, resize, filters)
4. **Version Control**: Media file versioning and history
5. **Automated Backups**: Cross-provider backup strategies
6. **AI Integration**: Auto-tagging and content recognition
7. **Usage Analytics**: Detailed media usage and performance metrics

### Integration Opportunities

1. **Search Integration**: Media content in global search
2. **Project Templates**: Media-rich project templates
3. **Export Tools**: Media export for project sharing
4. **API Extensions**: Public API for media access
5. **Webhook System**: Real-time media event notifications

---

## Quick Reference

### Key Files
- **Upload API**: `src/app/api/media/upload/route.ts`
- **Media API**: `src/app/api/media/[id]/route.ts`
- **Provider Factory**: `src/lib/media/factory.ts`
- **Admin Components**: `src/components/admin/`
- **Database Schema**: `prisma/schema.prisma`

### Environment Variables
```bash
# Provider Selection
MEDIA_PROVIDER=cloudinary

# Cloudinary (Active)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# AWS S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket_name

# Other providers...
```

### Testing Commands
```bash
# Test media configuration
npm run media:test

# Test Cloudinary upload
npm run media:upload-test

# Test API upload
npm run media:api-test

# Migrate existing media
npm run media:migrate
```

This documentation should be updated as new features are added to the media system. 