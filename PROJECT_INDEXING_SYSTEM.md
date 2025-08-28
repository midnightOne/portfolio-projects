# Project Indexing System

The Project Indexing System is a core component of the Client-Side AI Assistant that generates searchable summaries and indexes from project content. It integrates with the Rich Content System's Tiptap structure and Media Management System to provide comprehensive context for AI conversations.

## Overview

The system automatically:
- Analyzes Tiptap JSON content structure
- Extracts sections, headings, and content blocks
- Generates keywords and topics from content
- Identifies technologies mentioned in projects
- Creates media context from images, carousels, and interactive content
- Provides searchable indexes for AI context building

## Core Components

### ProjectIndexer Service
- **Location**: `src/lib/services/project-indexer.ts`
- **Purpose**: Main service for indexing project content
- **Features**: Caching, section extraction, keyword analysis, media context

### API Endpoints

#### Individual Project Index
```
GET /api/projects/[slug]/index
```
Query parameters:
- `includeContent=true` - Include full content in sections
- `includeSections=true` - Include section breakdown
- `includeMedia=true` - Include media context
- `forceReindex=true` - Clear cache and reindex

#### Batch Indexing
```
POST /api/projects/index/batch
```
Request body:
```json
{
  "projectIds": ["id1", "id2"],
  "projectSlugs": ["slug1", "slug2"],
  "forceReindex": false,
  "includeContent": true,
  "includeSections": true,
  "includeMedia": true
}
```

#### AI Context Search
```
GET /api/projects/search/ai-context
```
Query parameters:
- `query` - Search query (required, min 2 characters)
- `projectIds` - Comma-separated project IDs (optional)
- `limit` - Max results (default 10, max 50)
- `includeContent=true` - Include section content
- `includeMarkdown=true` - Include markdown content
- `minRelevance=0.1` - Minimum relevance score

## Usage Examples

### Basic Indexing
```typescript
import { projectIndexer } from '@/lib/services/project-indexer';

// Index a single project
const index = await projectIndexer.indexProject('project-id');
console.log('Keywords:', index.keywords);
console.log('Sections:', index.sections.length);

// Get project summary for AI context
const summary = await projectIndexer.getProjectSummary('project-id');
console.log('Technologies:', summary.keyTechnologies);
```

### React Hook Integration
```typescript
import { useProjectIndexing } from '@/lib/hooks/use-project-indexing';

function ProjectEditor({ projectId }) {
  const { indexProject, getCacheStats } = useProjectIndexing({
    onIndexComplete: (id, success) => {
      console.log(`Project ${id} indexed:`, success);
    }
  });

  const handleSave = async () => {
    // Save project...
    await indexProject(projectId); // Trigger indexing
  };

  return (
    <button onClick={handleSave}>
      Save & Index Project
    </button>
  );
}
```

### Search Integration
```typescript
// Search for relevant content
const results = await projectIndexer.searchRelevantContent(
  ['project-1', 'project-2'],
  'React TypeScript',
  10
);

results.forEach(section => {
  console.log(`${section.title}: ${section.summary}`);
});
```

### API Usage
```typescript
// Fetch project index via API
const response = await fetch('/api/projects/my-project/index?includeSections=true');
const data = await response.json();

if (data.success) {
  console.log('Project indexed:', data.data.lastUpdated);
  console.log('Sections:', data.data.sections);
}

// Batch index multiple projects
const batchResponse = await fetch('/api/projects/index/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectSlugs: ['project-1', 'project-2'],
    forceReindex: true
  })
});
```

## Data Structure

### ProjectIndex
```typescript
interface ProjectIndex {
  projectId: string;
  summary: string;
  sections: IndexedSection[];
  keywords: string[];
  topics: string[];
  technologies: string[];
  mediaContext: MediaContext[];
  lastUpdated: Date;
  contentHash: string;
}
```

### IndexedSection
```typescript
interface IndexedSection {
  id: string;
  title: string;
  summary: string;
  content: string;
  markdownContent: string;
  startOffset: number;
  endOffset: number;
  keywords: string[];
  importance: number; // 0-1 relevance score
  nodeType: string; // Tiptap node type
  depth: number; // Heading depth
}
```

### MediaContext
```typescript
interface MediaContext {
  id: string;
  type: 'image' | 'video' | 'carousel' | 'interactive' | 'download';
  title?: string;
  description?: string;
  altText?: string;
  url?: string;
  context: string;
  relevanceScore: number;
}
```

## Integration Points

### Rich Content System
- Parses Tiptap JSON content structure
- Extracts sections based on node types
- Converts content to markdown for AI processing
- Handles portfolio-specific extensions (carousels, interactive content)

### Media Management System
- Includes media items in context
- Processes carousel images
- Handles interactive examples and downloads
- Provides media descriptions for AI understanding

### Database Integration
- Stores indexes in `project_ai_index` table
- Tracks content changes via hash comparison
- Provides persistence for analytics

## Performance Features

### Caching
- In-memory cache with 15-minute TTL
- Content hash-based change detection
- Automatic cache invalidation on updates

### Batch Processing
- Concurrent indexing with limits
- Progress tracking for large operations
- Error handling and partial success reporting

### Optimization
- Selective content inclusion based on importance
- Keyword extraction with stop-word filtering
- Technology pattern matching
- Relevance scoring for search results

## Automatic Indexing

The system automatically triggers indexing when:
- Projects are saved or updated
- Content is modified through the editor
- Media items are added or changed
- Project metadata is updated

### Integration with Save Operations
```typescript
import { withProjectIndexing } from '@/lib/utils/project-indexing-integration';

// Wrap existing save function
const saveProjectWithIndex = withProjectIndexing(saveProject, {
  extractProjectId: (result) => result.id
});
```

## Monitoring and Analytics

### Cache Statistics
```typescript
const stats = projectIndexer.getCacheStats();
console.log(`Cached projects: ${stats.size}`);
console.log(`Project IDs: ${stats.projects}`);
```

### Indexing Statistics
```typescript
import { getIndexingStatistics } from '@/lib/utils/project-indexing-integration';

const stats = await getIndexingStatistics();
console.log(`Total projects: ${stats.totalProjects}`);
console.log(`Indexed projects: ${stats.indexedProjects}`);
console.log(`Last activity: ${stats.lastIndexingActivity}`);
```

## Admin Interface

The system includes React components for admin management:

### ProjectIndexingStatus
- Shows indexing status for individual projects
- Displays keywords and content statistics
- Allows manual reindexing
- Shows last indexed timestamp

### BatchIndexing
- Bulk indexing for multiple projects
- Progress tracking with visual indicators
- Error reporting and success statistics
- Force reindex option

## Testing

The system includes comprehensive tests:
- Unit tests for ProjectIndexer service
- API endpoint integration tests
- Mock data for consistent testing
- Error handling validation

Run tests:
```bash
npm test -- --testPathPatterns=project-indexer
```

## Future Enhancements

Planned improvements:
- AI-powered summary generation
- Advanced NLP for better keyword extraction
- Real-time indexing with WebSocket updates
- Search result ranking improvements
- Multi-language content support
- Vector embeddings for semantic search

## Requirements Fulfilled

This implementation satisfies the following requirements from the Client-Side AI spec:

- **2.1**: Project summaries/indexes for broad context and full content for specific queries
- **2.2**: Automatic generation of searchable indexes tied to article structure  
- **2.3**: Keyword and topic extraction from project content
- **Integration**: Connects with Rich Content System for content analysis and Media Management System for media context

The system provides a robust foundation for the AI Assistant's context management needs.