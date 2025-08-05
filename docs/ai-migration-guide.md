# AI Architecture Migration Guide

This guide helps migrate from the old database-stored AI configuration to the new environment variable-based system.

## Overview

The new AI architecture provides:
- ✅ **Security**: API keys stored in environment variables, not database
- ✅ **Simplicity**: Text-based model configuration instead of complex UI
- ✅ **Flexibility**: Unified model selection across providers
- ✅ **Reliability**: Real connection testing and better error handling

## Migration Steps

### Step 1: Export Existing Configuration

If you have existing AI configuration, note down:

1. **API Keys** (from old admin interface):
   - OpenAI API key
   - Anthropic API key

2. **Model Configuration**:
   - Which OpenAI models were enabled
   - Which Anthropic models were enabled

3. **Settings**:
   - Default provider
   - System prompt
   - Temperature and token settings

### Step 2: Set Environment Variables

Add your API keys to environment variables:

**Development (.env.local):**
```bash
# Add these to your .env.local file
OPENAI_API_KEY=sk-proj-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-api03-your-anthropic-key-here
```

**Production (hosting platform):**
- **Vercel**: Settings → Environment Variables
- **Netlify**: Site settings → Environment variables
- **Railway**: Project → Variables tab
- **Heroku**: Settings → Config Vars

### Step 3: Database Migration

The new system automatically cleans up old AI tables. If you need to manually clean up:

```sql
-- Remove old AI configuration tables (if they exist)
DROP TABLE IF EXISTS ai_settings CASCADE;
DROP TABLE IF EXISTS ai_providers CASCADE;
DROP TABLE IF EXISTS ai_model_configs CASCADE;
```

The new system uses simplified tables:
- `ai_model_config`: Stores model lists per provider
- `ai_general_settings`: Stores non-sensitive settings

### Step 4: Reconfigure Models

1. **Access New AI Settings**:
   - Navigate to `/admin/ai-settings`
   - You'll see the new tabbed admin interface

2. **Test Connections**:
   - Click "Test" buttons for each provider
   - Verify green checkmarks appear

3. **Configure Models**:
   ```
   OpenAI Models: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
   Anthropic Models: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022
   ```

4. **Set General Settings**:
   - Choose default provider
   - Set system prompt
   - Adjust temperature and max tokens

5. **Save Configuration**:
   - Click "Save Configuration"
   - Wait for success confirmation

### Step 5: Test AI Features

1. **Test Model Selection**:
   - Go to project editor
   - Open AI assistant panel
   - Verify unified model dropdown shows all configured models

2. **Test Content Editing**:
   - Select some text in a project
   - Try "Make Professional" or other quick actions
   - Verify AI responses work correctly

3. **Test Tag Suggestions**:
   - Use "Suggest Tags" feature
   - Verify relevant tags are suggested

## Key Differences

### Old System vs New System

| Feature | Old System | New System |
|---------|------------|------------|
| **API Keys** | Stored in database (encrypted) | Environment variables |
| **Model Config** | Complex UI with checkboxes | Simple text input (comma-separated) |
| **Model Selection** | Separate dropdowns per provider | Unified dropdown with grouping |
| **Connection Testing** | Basic validation | Real API calls with detailed errors |
| **Error Handling** | Generic error messages | Specific, actionable error messages |
| **Security** | Database encryption | Environment variable isolation |

### Configuration Changes

**Old Model Configuration:**
- Checkboxes for each model
- Separate sections per provider
- Complex validation logic

**New Model Configuration:**
```
OpenAI: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
Anthropic: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022
```

### UI Changes

**Old AI Settings:**
- Single page with multiple sections
- Complex provider configuration
- Separate model management

**New AI Settings:**
- Clean tabbed interface
- Environment status section
- Simplified model configuration
- Real-time connection testing

## Troubleshooting Migration

### Common Issues

1. **API Keys Not Working**:
   - Verify keys are correctly copied
   - Check for extra spaces or characters
   - Ensure environment variables are loaded (restart dev server)

2. **Models Not Appearing**:
   - Check that providers have valid API keys
   - Verify model names are correct
   - Save configuration after entering models

3. **Connection Tests Failing**:
   - Verify API keys are active in provider dashboards
   - Check network connectivity
   - Review error messages for specific issues

### Validation Steps

1. **Environment Check**:
   ```bash
   # Verify environment variables (without revealing keys)
   echo $OPENAI_API_KEY | cut -c1-10
   echo $ANTHROPIC_API_KEY | cut -c1-15
   ```

2. **Connection Test**:
   - Use test buttons in AI settings
   - Should show green checkmarks for configured providers

3. **Model Availability**:
   - Check unified model dropdown in AI assistant
   - Should show models grouped by provider

4. **Functionality Test**:
   - Try editing content with AI
   - Verify responses are generated correctly

## Rollback Plan

If you need to rollback (not recommended):

1. **Keep Environment Variables**:
   - Don't remove API keys from environment
   - They don't interfere with old system

2. **Database Restore**:
   - Restore old AI configuration tables from backup
   - Re-enter API keys in old admin interface

3. **Code Rollback**:
   - Revert to previous version of application
   - Redeploy with old AI architecture

## Benefits of New System

### Security Improvements

- **No Database Storage**: API keys never stored in database
- **Environment Isolation**: Keys isolated to deployment environment
- **Reduced Attack Surface**: Fewer places where keys can be compromised

### Operational Benefits

- **Easier Deployment**: Environment variables are standard practice
- **Better Error Handling**: Specific, actionable error messages
- **Simplified Configuration**: Text-based model configuration
- **Real Testing**: Actual API calls verify configuration

### Developer Experience

- **Unified Interface**: Single dropdown for all models
- **Better Feedback**: Clear status indicators and error messages
- **Faster Setup**: Simpler configuration process
- **More Reliable**: Robust error handling and recovery

## Support

### Getting Help

1. **Check Documentation**:
   - `docs/ai-configuration-guide.md`
   - `docs/ai-troubleshooting.md`
   - `docs/ai-deployment-guide.md`

2. **Common Solutions**:
   - Restart development server after environment changes
   - Verify API keys in provider dashboards
   - Check network connectivity for API calls

3. **Debug Information**:
   - Check browser console for errors
   - Review application logs
   - Test API endpoints directly

### Migration Checklist

- [ ] Export existing API keys and settings
- [ ] Add API keys to environment variables
- [ ] Restart development server
- [ ] Test connections in new AI settings
- [ ] Configure models using text input
- [ ] Set general settings (provider, prompt, parameters)
- [ ] Save configuration
- [ ] Test AI features in project editor
- [ ] Verify unified model selection works
- [ ] Test content editing and tag suggestions
- [ ] Deploy to production with environment variables
- [ ] Verify production deployment works
- [ ] Remove old AI configuration (optional)

The migration should be smooth and provide immediate benefits in terms of security, simplicity, and reliability.