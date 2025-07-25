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

### Current Status: Iteration 1 (MVP) - Basic Portfolio Viewer

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
- 🟡 **Enhanced Details**: Advanced layout and media (Next)
- ⏳ **Admin Interface**: Content management (Future)
- ⏳ **Advanced Features**: Search, filtering, analytics (Future)

## Environment Configuration

### Required Environment Variables
```bash
DATABASE_URL=                  # Database connection string
NEXTAUTH_SECRET=              # NextAuth.js secret
NEXTAUTH_URL=                 # Base URL for authentication
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
│   │   ├── types/            # TypeScript type definitions
│   │   └── utils/            # Utility functions
│   └── hooks/                # React hooks
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
└── public/                   # Static assets
``` 