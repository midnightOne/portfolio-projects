# API Documentation

This document covers the API endpoints for the Portfolio Projects application, with a focus on the AI-powered features.

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://yourdomain.com/api`

## Authentication

Admin endpoints require authentication via NextAuth.js session or admin credentials.

## AI Endpoints

### Environment Status

Check AI provider configuration status.

**Endpoint**: `GET /api/admin/ai/environment-status`

**Authentication**: Required (Admin)

**Response**:
```json
{
  "openai": {
    "configured": true,
    "keyPreview": "sk-proj-nLUK...7rT3"
  },
  "anthropic": {
    "configured": false,
    "keyPreview": "Not configured"
  }
}
```

**Response Fields**:
- `configured`: Boolean indicating if API key is present
- `keyPreview`: Masked version of API key (first 4 + last 4 characters)

---

### Connection Testing

Test real API connections to AI providers.

**Endpoint**: `POST /api/admin/ai/test-connection`

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "provider": "openai"
}
```

**Request Parameters**:
- `provider`: String - Either "openai" or "anthropic"

**Success Response**:
```json
{
  "success": true,
  "message": "Connected successfully - 12 models available",
  "availableModels": [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-3.5-turbo"
  ]
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Invalid API key for openai",
  "error": {
    "code": "INVALID_API_KEY",
    "details": "The provided API key is invalid",
    "actionable": true
  }
}
```

**Error Codes**:
- `NOT_CONFIGURED`: API key not set in environment
- `INVALID_API_KEY`: API key is invalid or expired
- `RATE_LIMITED`: API rate limit exceeded
- `NETWORK_ERROR`: Connection failed
- `UNKNOWN_ERROR`: Unexpected error occurred

---

### Model Configuration

Manage AI model configuration.

#### Get Model Configuration

**Endpoint**: `GET /api/admin/ai/model-config`

**Authentication**: Required (Admin)

**Response**:
```json
{
  "modelConfig": {
    "openai": "gpt-4o, gpt-4o-mini, gpt-3.5-turbo",
    "anthropic": "claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022"
  },
  "defaultProvider": "openai",
  "systemPrompt": "You are an expert content editor...",
  "temperature": 0.7,
  "maxTokens": 4000
}
```

#### Update Model Configuration

**Endpoint**: `PUT /api/admin/ai/model-config`

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "modelConfig": {
    "openai": "gpt-4o, gpt-4o-mini",
    "anthropic": "claude-3-5-sonnet-20241022"
  },
  "defaultProvider": "openai",
  "systemPrompt": "You are an expert content editor...",
  "temperature": 0.8,
  "maxTokens": 3000
}
```

**Success Response**:
```json
{
  "success": true,
  "message": "Configuration saved successfully"
}
```

---

### Available Models

Get all available models from configured providers.

**Endpoint**: `GET /api/admin/ai/available-models`

**Authentication**: Required (Admin)

**Response**:
```json
{
  "models": [
    {
      "id": "gpt-4o",
      "provider": "openai",
      "name": "GPT-4 Omni",
      "available": true
    },
    {
      "id": "claude-3-5-sonnet-20241022",
      "provider": "anthropic", 
      "name": "Claude 3.5 Sonnet",
      "available": true
    }
  ],
  "groupedByProvider": {
    "openai": [
      {
        "id": "gpt-4o",
        "name": "GPT-4 Omni",
        "available": true
      }
    ],
    "anthropic": [
      {
        "id": "claude-3-5-sonnet-20241022",
        "name": "Claude 3.5 Sonnet", 
        "available": true
      }
    ]
  }
}
```

---

### Content Editing

AI-powered content editing operations.

#### Edit Content

**Endpoint**: `POST /api/admin/ai/edit-content`

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "model": "gpt-4o",
  "operation": "make_professional",
  "content": "This project is really cool and does stuff.",
  "selectedText": {
    "text": "really cool and does stuff",
    "start": 17,
    "end": 42
  },
  "context": {
    "projectTitle": "My Portfolio Website",
    "projectDescription": "A modern portfolio built with Next.js",
    "existingTags": ["nextjs", "typescript"],
    "fullContent": "This project is really cool and does stuff. It showcases my skills."
  },
  "systemPrompt": "You are an expert content editor...",
  "temperature": 0.7
}
```

**Request Parameters**:
- `model`: String - AI model to use
- `operation`: String - Type of edit ("rewrite", "improve", "expand", "summarize", "make_professional", "make_casual")
- `content`: String - Content to edit
- `selectedText`: Object - Selected text portion (optional)
- `context`: Object - Project context for better editing
- `systemPrompt`: String - Custom system prompt (optional)
- `temperature`: Number - Creativity level 0.0-1.0 (optional)

**Success Response**:
```json
{
  "success": true,
  "changes": {
    "partialUpdate": {
      "start": 17,
      "end": 42,
      "newText": "sophisticated and implements advanced functionality",
      "reasoning": "Replaced casual language with professional terminology"
    },
    "suggestedTags": {
      "add": ["web-development", "frontend"],
      "remove": [],
      "reasoning": "Added relevant technical tags based on content"
    }
  },
  "reasoning": "Enhanced professionalism while maintaining meaning",
  "confidence": 0.95,
  "warnings": [],
  "model": "gpt-4o",
  "tokensUsed": 156,
  "cost": 0.00468
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Model not available",
  "details": "The specified model is not configured or accessible"
}
```

---

#### Suggest Tags

**Endpoint**: `POST /api/admin/ai/suggest-tags`

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "model": "gpt-4o",
  "projectTitle": "E-commerce Dashboard",
  "projectDescription": "A React-based admin dashboard for managing online stores",
  "articleContent": "Built with React, TypeScript, and Material-UI. Features real-time analytics, inventory management, and order processing.",
  "existingTags": ["react", "typescript"],
  "maxSuggestions": 5
}
```

**Success Response**:
```json
{
  "success": true,
  "suggestions": {
    "add": [
      {
        "tag": "material-ui",
        "confidence": 0.95,
        "reasoning": "Explicitly mentioned as the UI framework"
      },
      {
        "tag": "dashboard",
        "confidence": 0.90,
        "reasoning": "Core functionality is dashboard-based"
      },
      {
        "tag": "analytics",
        "confidence": 0.85,
        "reasoning": "Features real-time analytics functionality"
      }
    ],
    "remove": []
  },
  "reasoning": "Suggested tags based on technologies and features mentioned",
  "model": "gpt-4o",
  "tokensUsed": 89,
  "cost": 0.00267
}
```

---

#### Improve Content

**Endpoint**: `POST /api/admin/ai/improve-content`

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "content": "This is a web app I made. It has some features.",
  "context": {
    "projectTitle": "Task Management App",
    "projectDescription": "A productivity app for managing tasks and projects",
    "existingTags": ["productivity", "web-app"],
    "fullContent": "This is a web app I made. It has some features. Users can create tasks and mark them complete."
  },
  "improvementType": "expand"
}
```

**Request Parameters**:
- `improvementType`: String - Type of improvement ("expand", "clarify", "enhance", "restructure")

**Success Response**:
```json
{
  "success": true,
  "changes": {
    "fullContent": "This is a comprehensive task management web application I developed to enhance productivity and organization. The application features an intuitive interface that allows users to create, organize, and track tasks efficiently. Key functionality includes task creation with detailed descriptions, priority levels, due dates, and completion tracking. The system provides visual progress indicators and helps users stay organized with their daily workflow.",
    "suggestedTitle": "Comprehensive Task Management Application",
    "suggestedDescription": "A feature-rich productivity web app with advanced task organization and tracking capabilities"
  },
  "reasoning": "Expanded the brief description into a comprehensive overview highlighting key features and benefits",
  "confidence": 0.92,
  "warnings": [],
  "model": "claude-3-5-sonnet-20241022",
  "tokensUsed": 234,
  "cost": 0.00351
}
```

## Project Endpoints

### Get Projects

**Endpoint**: `GET /api/projects`

**Authentication**: Not required

**Query Parameters**:
- `search`: String - Search term for filtering
- `tags`: String - Comma-separated list of tags
- `limit`: Number - Maximum number of results
- `offset`: Number - Pagination offset

**Response**:
```json
{
  "projects": [
    {
      "id": "1",
      "title": "Portfolio Website",
      "description": "A modern portfolio built with Next.js",
      "tags": ["nextjs", "typescript", "tailwind"],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:45:00Z"
    }
  ],
  "total": 1,
  "hasMore": false
}
```

### Get Project by ID

**Endpoint**: `GET /api/projects/[id]`

**Authentication**: Not required

**Response**:
```json
{
  "id": "1",
  "title": "Portfolio Website",
  "description": "A modern portfolio built with Next.js",
  "content": "Detailed project content...",
  "tags": ["nextjs", "typescript", "tailwind"],
  "media": [
    {
      "id": "1",
      "type": "image",
      "url": "/uploads/screenshot.png",
      "alt": "Project screenshot"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-20T14:45:00Z"
}
```

## Admin Endpoints

### Create Project

**Endpoint**: `POST /api/admin/projects`

**Authentication**: Required (Admin)

**Request Body**:
```json
{
  "title": "New Project",
  "description": "Project description",
  "content": "Detailed project content",
  "tags": ["tag1", "tag2"],
  "status": "published"
}
```

### Update Project

**Endpoint**: `PUT /api/admin/projects/[id]`

**Authentication**: Required (Admin)

**Request Body**: Same as create project

### Delete Project

**Endpoint**: `DELETE /api/admin/projects/[id]`

**Authentication**: Required (Admin)

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": "Detailed error information",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-20T14:45:00Z"
}
```

**Common HTTP Status Codes**:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Rate Limited
- `500`: Internal Server Error

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Public endpoints**: 100 requests per minute per IP
- **Admin endpoints**: 200 requests per minute per session
- **AI endpoints**: 20 requests per minute per session

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Webhooks

The application supports webhooks for external integrations:

### Project Events

**Endpoint**: `POST /api/webhooks/projects`

**Events**:
- `project.created`
- `project.updated`
- `project.deleted`

**Payload**:
```json
{
  "event": "project.created",
  "data": {
    "project": {
      "id": "1",
      "title": "New Project",
      "createdAt": "2024-01-20T14:45:00Z"
    }
  },
  "timestamp": "2024-01-20T14:45:00Z"
}
```

## SDK and Client Libraries

### JavaScript/TypeScript

```typescript
import { PortfolioAPI } from '@/lib/api-client';

const api = new PortfolioAPI({
  baseURL: 'http://localhost:3000/api',
  apiKey: 'your-api-key' // For admin operations
});

// Get projects
const projects = await api.projects.list({
  search: 'nextjs',
  tags: ['typescript', 'react']
});

// AI content editing
const result = await api.ai.editContent({
  model: 'gpt-4o',
  operation: 'make_professional',
  content: 'This project is cool'
});
```

### cURL Examples

```bash
# Test AI connection
curl -X POST http://localhost:3000/api/admin/ai/test-connection \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai"}' \
  -b "session-cookie"

# Edit content with AI
curl -X POST http://localhost:3000/api/admin/ai/edit-content \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "operation": "make_professional", 
    "content": "This project is really cool"
  }' \
  -b "session-cookie"
```

## Changelog

### v2.0.0 - AI Architecture Redesign
- Added AI provider abstraction layer
- Moved API keys to environment variables
- Simplified model configuration
- Added unified model selection
- Improved error handling and user feedback

### v1.0.0 - Initial Release
- Basic project CRUD operations
- Media upload and management
- Admin authentication
- Search and filtering