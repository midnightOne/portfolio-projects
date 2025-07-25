# Portfolio Projects - Architecture Overview

## Project Overview

A modern, responsive portfolio website showcasing projects with rich media content, built with Next.js 14, TypeScript, and Prisma. The system provides both a public viewing interface and an admin content management system.

## Technology Stack

### Frontend
- **Next.js 14** with App Router for SSR and routing
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for consistent UI components
- **Framer Motion** for animations
- **React Hook Form** for form handling

### Backend
- **Next.js API Routes** for RESTful API
- **Prisma ORM** for database operations
- **PostgreSQL** database (configurable: Supabase/Vercel Postgres)
- **NextAuth.js** for authentication

### Current Status: Iteration 2 - Enhanced Project Experience + Media Upload System

## Architecture Components

### 1. Database Layer (`/src/lib/database/`)

**Current Implementation:**
- **Connection Management**: Configurable database providers (Supabase/Vercel Postgres)
- **Schema**: Projects, tags, media items, analytics, and relationships
- **Adapters**: Database provider abstraction for flexibility

**Key Files:**
- `connection.ts` - Database connection utilities
- `adapters/` - Provider-specific implementations
- `prisma/schema.prisma` - Database schema definition

### 1.5. Media Management Layer (`/src/lib/media/`) ✅ **NEWLY IMPLEMENTED**

**Configuration-Based Media Storage:**
- **Provider Abstraction**: Unified interface for multiple storage providers
- **File Validation**: Comprehensive file type, size, and security validation
- **Environment Switching**: Switch providers via environment variables

**Supported Providers:**
- **Cloudinary** (Default) - Automatic optimization, transformations, CDN
- **AWS S3** - Cost-effective storage with optional CloudFront CDN
- **Vercel Blob Storage** ✅ - Seamless Vercel integration, global edge locations
- **Supabase Storage** ✅ - Database integration, auth-aware storage
- **GitHub + jsDelivr** ✅ - Free CDN for open source projects

**Key Files:**
- `types.ts` - Media provider interfaces and types
- `factory.ts` - Provider factory and configuration management
- `validation.ts` - File validation utilities
- `providers/cloudinary.ts` - Cloudinary implementation ✅
- `providers/s3.ts` - AWS S3 implementation ✅
- `providers/vercel-blob.ts` - Vercel Blob Storage implementation ✅
- `providers/supabase-storage.ts` - Supabase Storage implementation ✅
- `providers/github-jsdelivr.ts` - GitHub + jsDelivr implementation ✅
- `MEDIA_CONFIGURATION.md` - API documentation
- `MEDIA_PROVIDER_SETUP.md` - Comprehensive setup guide ✅

### 2. API Layer (`/src/app/api/`)

**Current Endpoints:**

#### Projects API
- **GET `/api/projects`** - List projects with pagination, filtering, search
  - Supports: tag filtering, sorting (date/title/popularity), search queries
  - Returns: Paginated project list with metadata
  
- **GET `/api/projects/[slug]`** - Get individual project details
  - Includes: Full project data, media, external links, downloads
  - Automatically tracks analytics and increments view count
  
- **GET `/api/projects/test`** - Test endpoint for API validation

#### Authentication API
- **POST `/api/auth/[...nextauth]`** - NextAuth.js authentication endpoints

#### Media Upload API ✅ **NEWLY IMPLEMENTED**
- **POST `/api/media/upload`** - Upload media files with provider abstraction
  - Supports: Images, videos, attachments with validation
  - Features: Cloudinary/AWS S3 provider switching, file validation
  - Returns: Media item data with provider-specific URLs
  
- **GET `/api/media/upload`** - Get upload configuration and provider status

#### Health Check
- **GET `/api/health`** - API health status

### 3. Frontend Components (`/src/components/`)

#### Layout Components (`/src/components/layout/`)
- **NavigationBar** - Filter controls, search, sorting options
- **ProjectsLayout** - Main layout wrapper with navigation

#### Project Components (`/src/components/projects/`)
- **ProjectCard** - Individual project display in grid
- **ProjectGrid** - Responsive grid layout for projects
- **ProjectModal** - ✅ **NEWLY IMPLEMENTED** - Detailed project view modal

#### UI Components (`/src/components/ui/`)
- shadcn/ui components: Dialog, Card, Button, Badge, etc.

### 4. Pages and Routing (`/src/app/`)

#### Main Pages
- **`/projects`** - Main portfolio viewing page
  - ✅ **ENHANCED** - Now supports project detail modal with URL routing
  - Features: Grid view, filtering, search, project detail modal

#### API Integration
- **`/src/hooks/use-projects.ts`** - Project data fetching and state management

## Current Features Implemented

### ✅ Task 8.1: Configurable Media Upload API (COMPLETED)

**Implementation Summary:**
- **Media Provider Abstraction** - Unified interface supporting multiple storage providers
- **Environment Configuration** - Switch providers via `MEDIA_PROVIDER` environment variable
- **Cloudinary Provider** - Default provider with automatic optimization and transformations
- **AWS S3 Provider** - Cost-effective alternative with CloudFront CDN support
- **File Validation** - Comprehensive validation for security, size limits, and file types
- **Admin API Endpoint** - RESTful upload API with authentication

### ✅ Task 8.2: Additional Media Providers (COMPLETED)

**Implementation Summary:**
- **Vercel Blob Storage** - Seamless integration for Vercel-hosted applications
- **Supabase Storage** - Database-integrated storage with Row Level Security
- **GitHub + jsDelivr** - Free CDN solution for open source projects
- **Comprehensive Documentation** - Detailed setup guides for all providers
- **Provider Testing** - Configuration validation and testing utilities

**Key Features:**
1. **Provider Abstraction** (Requirements 7.3, 6.6):
   - Unified `MediaProvider` interface
   - Factory pattern for provider switching
   - Environment-based configuration

2. **File Validation** (Requirement 6.6):
   - Type-specific size limits (Images: 10MB, Videos: 100MB, Attachments: 50MB)
   - Supported formats: JPG, PNG, GIF, WebP, SVG, MP4, WebM, PDF, ZIP, etc.
   - Security checks blocking dangerous file types

3. **Upload API** (Requirement 7.3):
   - `POST /api/media/upload` with multipart form data
   - Authentication required (admin session)
   - Database integration storing media metadata
   - Provider-specific upload handling

4. **Configuration Management**:
   - Provider validation and error reporting
   - Environment variable documentation
   - Easy switching between Cloudinary and S3

### ✅ Task 6: Basic Project Details (COMPLETED)

**Implementation Summary:**
- **ProjectModal Component** - Two-column layout modal for project details
- **URL Routing** - Project selection updates browser URL (`/projects?project=slug`)
- **State Management** - Modal open/close state with project data
- **API Integration** - Fetches full project details from `/api/projects/[slug]`
- **Analytics Tracking** - Automatic view tracking when project details are loaded
- **Navigation** - Close functionality with X button, browser back/forward support

**Key Features:**
1. **Two-Column Layout** (Requirements 3.1, 3.2):
   - Left column: Metadata, tags, links, downloads
   - Right column: Project description, article content, media

2. **Close Functionality** (Requirement 3.13):
   - X button in top-right corner
   - Click outside modal to close
   - ESC key support (via shadcn/ui Dialog)

3. **URL Integration**:
   - Updates URL when project is opened
   - Direct link support (`/projects?project=project-slug`)
   - Browser history management

4. **Loading States**:
   - Shows loading spinner while fetching project details
   - Graceful error handling for missing projects

## Data Models

### Core Types (`/src/lib/types/project.ts`)

**ProjectWithRelations** - Complete project with all related data:
```typescript
interface ProjectWithRelations extends Project {
  tags: Tag[];
  thumbnailImage?: MediaItem | null;
  metadataImage?: MediaItem | null;
  mediaItems: MediaItem[];
  articleContent?: ArticleContent | null;
  interactiveExamples: InteractiveExample[];
  externalLinks: ExternalLink[];
  downloadableFiles: DownloadableFile[];
  carousels: MediaCarousel[];
  analytics?: ProjectAnalytics[];
  _count?: {
    mediaItems: number;
    downloadableFiles: number;
    externalLinks: number;
    analytics: number;
  };
}
```

## Current API Usage Patterns

### Project Details Flow
1. User clicks project card → `handleProjectClick(projectId)`
2. Update URL with project slug
3. Open modal with basic project info (if available)
4. Fetch full details from `/api/projects/[slug]`
5. Update modal with complete project data
6. Track analytics automatically via API

### Error Handling
- 404 errors for missing projects
- Network error graceful degradation
- Loading states during data fetching

## Next Implementation Priority

### Task 7: Enhanced Project Details (Next in Queue)
- Improved two-column layout with animations
- Enhanced media display and image carousels
- Better responsive design for mobile devices

## Development Status

- ✅ **Foundation**: Project setup, database, authentication
- ✅ **Core API**: Projects CRUD, filtering, search
- ✅ **Basic Components**: Layout, project cards, grid
- ✅ **Project Details**: Basic modal implementation with URL routing
- ✅ **Media Upload API**: Configurable provider system with 5 storage providers
- 🟡 **Enhanced Details**: Advanced layout and media (Next)
- ⏳ **Admin Interface**: Content management with media upload UI (Future)
- ⏳ **Advanced Features**: Search, filtering, analytics (Future)

## Environment Configuration

### Required Environment Variables
```bash
DATABASE_URL=                  # Database connection string
NEXTAUTH_SECRET=              # NextAuth.js secret
NEXTAUTH_URL=                 # Base URL for authentication
```

### Media Provider Configuration
```bash
# Default (Cloudinary)
MEDIA_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=        # Cloudinary cloud name
CLOUDINARY_API_KEY=           # Cloudinary API key
CLOUDINARY_API_SECRET=        # Cloudinary API secret
CLOUDINARY_FOLDER=portfolio-projects  # Optional folder

# AWS S3
MEDIA_PROVIDER=s3
AWS_ACCESS_KEY_ID=            # AWS access key
AWS_SECRET_ACCESS_KEY=        # AWS secret key
AWS_REGION=us-east-1          # AWS region
AWS_S3_BUCKET=                # S3 bucket name
AWS_CLOUDFRONT_URL=           # Optional CloudFront URL

# Vercel Blob Storage
MEDIA_PROVIDER=vercel
BLOB_READ_WRITE_TOKEN=        # Vercel Blob read/write token

# Supabase Storage
MEDIA_PROVIDER=supabase
SUPABASE_URL=                 # Supabase project URL
SUPABASE_SERVICE_KEY=         # Supabase service role key
SUPABASE_STORAGE_BUCKET=media # Storage bucket name

# GitHub + jsDelivr
MEDIA_PROVIDER=github
GITHUB_TOKEN=                 # GitHub personal access token
GITHUB_OWNER=                 # GitHub username/org
GITHUB_REPO=                  # Repository name
GITHUB_BRANCH=main            # Optional branch (defaults to main)
```

### Optional Configuration
```bash
DATABASE_PROVIDER=supabase    # Database provider (supabase/vercel)
```

## File Structure Overview

```
portfolio-projects/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── projects/         # Main portfolio page
│   │   └── admin/            # Admin interface
│   ├── components/
│   │   ├── layout/           # Layout components
│   │   ├── projects/         # Project-specific components
│   │   └── ui/               # shadcn/ui components
│   ├── lib/
│   │   ├── database/         # Database configuration
│   │   ├── media/            # Media provider abstraction ✅ NEW
│   │   ├── types/            # TypeScript type definitions
│   │   └── utils/            # Utility functions
│   └── hooks/                # React hooks
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
└── public/                   # Static assets
``` 