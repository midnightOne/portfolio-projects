# AI Assistant Usage Guide

## Overview

The AI-assisted content editing feature provides intelligent help for creating and improving portfolio project content. It supports both Anthropic Claude and OpenAI GPT models with secure API key management and structured response parsing.

## Features Implemented

### ✅ Core Features (Task 9.4)

1. **AI Settings Management Page** (`/admin/ai`)
   - Secure API key storage with encryption
   - Model selection (Claude 3.5 Sonnet, GPT-4o, etc.)
   - Behavior configuration (temperature, max tokens, cost limits)
   - Version management settings

2. **Chat Sidebar Component**
   - Context-aware AI assistance
   - Conversation history management
   - Model dropdown selection
   - Quick action buttons

3. **Context-Aware Prompting**
   - Project metadata integration
   - Current content analysis
   - Selected text support
   - Media and link context

4. **Partial Text Selection Editing**
   - Select text in content areas
   - AI suggestions for selected portions
   - Full article context maintained
   - Precise character position updates

5. **JSON Response Parsing**
   - Structured content updates
   - Metadata changes (title, description, tags)
   - Partial content replacements
   - Media suggestions

6. **Session-Based Undo/Redo**
   - Real-time editing history
   - Debounced state management
   - Configurable history size
   - Memory-efficient implementation

7. **Conversation History**
   - Auto-save conversations
   - Session-based storage
   - Message threading
   - Conversation management

## Getting Started

### 1. Configure AI Settings

1. Navigate to `/admin/ai`
2. Add your API keys:
   - **Anthropic**: Get from [Anthropic Console](https://console.anthropic.com/)
   - **OpenAI**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
3. Choose your preferred provider and model
4. Customize system prompt and behavior settings
5. Set cost limits and versioning preferences

### 2. Using the AI Assistant

**For New Projects:**
1. Go to `/admin/projects/new`
2. Click the "AI Assistant" button in the header
3. Use quick actions like "Generate Ideas", "Write Description", "Suggest Tags"
4. Get instant help with project creation (simulated responses until project is saved)

**For Existing Projects:**
1. Go to any project edit page (`/admin/projects/[id]/edit`)
2. Click the "AI Assistant" button or use the floating button
3. Select text in content areas for targeted editing
4. Use quick action buttons or type custom prompts
5. Review and apply AI suggestions with full conversation history

### 3. AI Prompting Best Practices

#### Effective Prompts:
- "Improve the clarity and flow of this content"
- "Add relevant technical tags for this project"
- "Write a more engaging project description"
- "Fix grammar and spelling in the selected text"
- "Suggest better section headings"

#### Context-Aware Features:
- AI automatically includes project metadata
- Selected text gets surrounding context
- Media and links are considered
- Previous conversation history is maintained

## API Endpoints

### Settings Management
- `GET /api/admin/ai/settings` - Fetch current settings
- `PUT /api/admin/ai/settings` - Update settings

### Chat Interface
- `POST /api/admin/ai/chat` - Send message and get response
- `GET /api/admin/ai/conversations/[projectId]` - Get conversations
- `DELETE /api/admin/ai/conversations/[projectId]` - Delete conversation

### Provider Information
- `GET /api/admin/ai/providers` - Get available providers and models

## Response Format

The AI returns structured JSON responses:

```json
{
  "reasoning": "Brief explanation of changes",
  "changes": {
    "articleContent": "Full replacement content",
    "partialUpdate": {
      "start": 123,
      "end": 456,
      "content": "replacement text",
      "reasoning": "why this change",
      "preserveFormatting": true
    },
    "metadata": {
      "title": "New title",
      "description": "New description",
      "tags": {
        "add": ["new-tag"],
        "remove": ["old-tag"],
        "reasoning": "tag change explanation"
      }
    }
  },
  "confidence": 0.95,
  "warnings": [],
  "modelUsed": "claude-3-5-sonnet",
  "tokensUsed": 150
}
```

## Security Features

- **API Key Encryption**: Keys are encrypted before database storage
- **Session-Based Auth**: Admin authentication required
- **Cost Controls**: Daily and monthly limits
- **Input Validation**: All inputs are validated and sanitized

## Performance Considerations

- **Context Truncation**: Large content is automatically truncated
- **Debounced Undo**: Prevents history spam from rapid changes
- **Efficient Parsing**: Structured responses for faster processing
- **Memory Management**: Limited conversation history

## Troubleshooting

### Common Issues:

1. **"Invalid API Key" Error**
   - Verify key format and permissions
   - Check provider-specific requirements
   - Ensure key hasn't expired

2. **"Rate Limit Exceeded"**
   - Wait before retrying
   - Check provider rate limits
   - Consider upgrading API plan

3. **"Context Too Large"**
   - Content is automatically truncated
   - Focus on smaller text selections
   - Break large edits into smaller chunks

4. **Poor AI Responses**
   - Improve system prompt specificity
   - Provide more context in prompts
   - Try different models or temperature settings

## Future Enhancements (Not in Task 9.4)

- Content versioning with database storage
- Advanced pattern analysis
- Bulk content operations
- Integration with external writing tools
- Multi-language support

## Testing

Run the AI functionality tests:

```bash
npm test -- --testPathPatterns=ai-functionality
```

The test suite covers:
- Encryption/decryption of API keys
- Context building from project data
- Response parsing (JSON and text fallback)
- Change validation and application
- Error handling scenarios

## Requirements Satisfied

This implementation satisfies all requirements from task 9.4:

- ✅ **21.1**: AI settings page with encrypted API key storage
- ✅ **21.2**: Model selection and configuration
- ✅ **21.3**: Chat sidebar with conversation interface
- ✅ **21.4**: Context-aware prompting with project data
- ✅ **21.5**: JSON response parsing for structured updates
- ✅ **21.11**: Partial text selection editing
- ✅ **21.12**: Session-based undo/redo functionality
- ✅ **21.13**: Conversation history with auto-save
- ✅ **21.14**: Full article context for AI processing