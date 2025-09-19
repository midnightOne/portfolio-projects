# Content Sources Management Guide

## Overview

The Content Sources Management system provides a flexible, pluggable architecture for managing different types of content that can be used in AI context building. This system allows administrators to enable/disable different content sources and configure their priority levels.

## Features

### 🔧 **Admin Interface**
- **Location**: `/admin/ai/content-sources`
- **Navigation**: Admin Panel → AI Assistant → Content Sources
- **Quick Access**: AI Settings page → Content Sources card

### 🏗️ **Content Source Types**

The system supports the following built-in content source types:

1. **Projects** (`project`)
   - Portfolio projects and case studies
   - Automatically indexed content from published projects
   - Highest relevance for technical discussions

2. **About** (`about`)
   - Personal information and bio from homepage
   - Skills and background information
   - High priority for personal context

3. **Experience** (`experience`)
   - Work experience and professional history
   - Job roles, companies, and achievements
   - Medium-high priority for career discussions

4. **Skills** (`skills`)
   - Technical and professional skills
   - Extracted from various content sources
   - Medium priority for capability queries

5. **Resume** (`resume`)
   - Professional resume and CV information
   - Currently placeholder - can be extended
   - Medium priority for formal background

6. **Custom** (`custom`)
   - Extensible for future content types
   - Lowest priority by default

### ⚙️ **Configuration Options**

For each content source, administrators can configure:

- **Enable/Disable**: Toggle whether the source is included in AI context
- **Priority**: 0-100 scale determining importance in context building
- **Advanced Settings**: Provider-specific configuration options (when available)

### 🔄 **Auto-Discovery**

The system automatically:
- Discovers new content sources when they become available
- Enables new sources by default
- Persists configuration in the database
- Handles unavailable sources gracefully

## API Endpoints

### Content Sources Management

#### `GET /api/admin/ai/content-sources`
- **Purpose**: List all available content sources with configurations
- **Authentication**: Admin required
- **Response**: Array of content sources with metadata

#### `POST /api/admin/ai/content-sources`
- **Purpose**: Save content source configuration
- **Authentication**: Admin required
- **Body**: Configuration object with source settings

#### `PUT /api/admin/ai/content-sources`
- **Purpose**: Bulk update multiple content sources
- **Authentication**: Admin required
- **Body**: Array of update operations

### Individual Source Management

#### `GET /api/admin/ai/content-sources/[sourceId]`
- **Purpose**: Get detailed information about a specific content source
- **Authentication**: Admin required
- **Response**: Detailed source information including schema and metadata

#### `PUT /api/admin/ai/content-sources/[sourceId]`
- **Purpose**: Update specific content source configuration
- **Authentication**: Admin required
- **Body**: Partial configuration updates

#### `POST /api/admin/ai/content-sources/[sourceId]/toggle`
- **Purpose**: Quick toggle for enabling/disabling a source
- **Authentication**: Admin required
- **Body**: `{ "enabled": boolean }`

## Usage Examples

### Enabling a Content Source
```javascript
// Toggle a source on/off
await fetch('/api/admin/ai/content-sources/projects/toggle', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ enabled: true })
});
```

### Setting Priority
```javascript
// Update source priority
await fetch('/api/admin/ai/content-sources/projects', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ priority: 90 })
});
```

### Bulk Operations
```javascript
// Update multiple sources at once
await fetch('/api/admin/ai/content-sources', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    updates: [
      { sourceId: 'projects', changes: { enabled: true, priority: 90 } },
      { sourceId: 'about', changes: { enabled: true, priority: 80 } }
    ]
  })
});
```

## Integration with AI Context

The content sources system integrates with the AI context manager to:

1. **Auto-discover** available content sources
2. **Filter** enabled sources for context building
3. **Prioritize** content based on configured priority levels
4. **Weight** relevance scores by source priority
5. **Cache** configurations for performance

### Priority Weighting

Content is prioritized in the following order:
1. **About** (Priority 5) - Personal information
2. **Projects** (Priority 4) - Portfolio work
3. **Experience** (Priority 3) - Professional history
4. **Skills** (Priority 2) - Capabilities
5. **Resume** (Priority 1) - Formal background
6. **Custom** (Priority 0) - Extension content

## Database Schema

The system uses the `AIContentSourceConfig` model:

```sql
CREATE TABLE ai_content_source_config (
  id VARCHAR PRIMARY KEY,
  source_id VARCHAR UNIQUE NOT NULL,
  provider_id VARCHAR NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 50,
  config JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Extending the System

### Adding New Content Sources

1. **Create Provider Class**:
```typescript
class MyContentProvider implements ContentSourceProvider {
  id = 'my-content';
  type = 'custom';
  name = 'My Content';
  description = 'Custom content provider';
  version = '1.0.0';

  async isAvailable(): Promise<boolean> {
    // Check if content is available
    return true;
  }

  async getMetadata(): Promise<ContentSourceMetadata> {
    // Return content metadata
  }

  async searchContent(query: string): Promise<RelevantContent[]> {
    // Search and return relevant content
  }
}
```

2. **Register Provider**:
```typescript
// In content-source-manager.ts
const myProvider = new MyContentProvider();
contentSourceManager.registerProvider(myProvider);
```

3. **Auto-Discovery**: The system will automatically discover and enable the new provider.

## Troubleshooting

### Common Issues

1. **Sources Not Appearing**
   - Check if the provider's `isAvailable()` method returns true
   - Verify API endpoints are accessible
   - Check browser console for errors

2. **Configuration Not Saving**
   - Ensure admin authentication is working
   - Check database connectivity
   - Verify API endpoint responses

3. **Content Not Appearing in AI Context**
   - Confirm source is enabled
   - Check priority settings
   - Verify content has sufficient relevance score

### Debug Information

The admin interface provides:
- **Source Status**: Available/Unavailable indicators
- **Content Statistics**: Item counts, sizes, tags
- **Configuration Details**: Current settings and schemas
- **Real-time Updates**: Immediate feedback on changes

## Security Considerations

- All endpoints require admin authentication
- Configuration changes are logged
- API keys and sensitive data are not exposed in responses
- Input validation prevents malicious configuration
- Rate limiting protects against abuse

## Performance

- **Caching**: Configurations are cached for performance
- **Lazy Loading**: Content is loaded only when needed
- **Batch Operations**: Multiple updates can be processed together
- **Auto-cleanup**: Expired cache entries are automatically removed
- **Optimized Queries**: Database queries are optimized for speed