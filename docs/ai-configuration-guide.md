# AI Configuration Guide

This guide covers setting up and configuring AI features for the Portfolio Projects application.

## Overview

The AI system provides intelligent content editing assistance with support for:
- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5 models
- **Anthropic**: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus

AI features are completely optional - the application works fully without AI configuration.

## Quick Setup

### 1. Get API Keys

**OpenAI:**
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create an account or sign in
3. Generate a new API key
4. Copy the key (starts with `sk-proj-...`)

**Anthropic:**
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an account or sign in
3. Generate a new API key
4. Copy the key (starts with `sk-ant-api03-...`)

### 2. Configure Environment Variables

Add to your `.env.local` file:

```bash
# OpenAI (optional)
OPENAI_API_KEY="sk-proj-your-key-here"

# Anthropic (optional)  
ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"
```

### 3. Configure Models

1. Start your development server: `npm run dev`
2. Navigate to `/admin/ai-settings`
3. Test your API connections
4. Configure available models for each provider

## Deployment Scenarios

### Development Environment

For local development, add keys to `.env.local`:

```bash
# .env.local
OPENAI_API_KEY="sk-proj-..."
ANTHROPIC_API_KEY="sk-ant-api03-..."
```

### Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables:

```
OPENAI_API_KEY = sk-proj-your-key-here
ANTHROPIC_API_KEY = sk-ant-api03-your-key-here
```

4. Redeploy your application

### Other Hosting Platforms

For other platforms (Netlify, Railway, etc.), add environment variables through their respective dashboards:

- **Netlify**: Site settings → Environment variables
- **Railway**: Project → Variables tab
- **Heroku**: Settings → Config Vars

## Model Configuration

### Supported Models

**OpenAI Models:**
- `gpt-4o` - Latest GPT-4 Omni model
- `gpt-4o-mini` - Faster, cost-effective GPT-4 variant
- `gpt-4-turbo` - High-performance GPT-4
- `gpt-3.5-turbo` - Fast and economical option

**Anthropic Models:**
- `claude-3-5-sonnet-20241022` - Most capable Claude model
- `claude-3-5-haiku-20241022` - Fast and efficient
- `claude-3-opus-20240229` - Previous generation flagship

### Configuring Models

1. Access `/admin/ai-settings`
2. In the "Model Configuration" section:
   - **OpenAI Models**: Enter comma-separated model IDs
   - **Anthropic Models**: Enter comma-separated model IDs

Example configuration:
```
OpenAI: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
Anthropic: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022
```

### Model Selection

- Models appear in the AI assistant dropdown grouped by provider
- Only models from providers with valid API keys are shown
- Invalid model IDs show warnings but can still be saved

## Troubleshooting

### Connection Issues

**"Invalid API key" Error:**
- Verify the API key is correct and active
- Check for extra spaces or characters
- Ensure the key hasn't expired

**"Rate limit exceeded" Error:**
- You've hit API usage limits
- Wait for the limit to reset
- Consider upgrading your API plan

**"Network error" Error:**
- Check your internet connection
- Verify firewall settings allow API requests
- Try again in a few minutes

### Configuration Issues

**No models showing in dropdown:**
- Ensure at least one provider has a valid API key
- Check that models are configured in AI settings
- Verify model IDs are correct

**AI features not working:**
- Check that environment variables are set correctly
- Restart your development server after adding keys
- Test connections in AI settings page

**Models not recognized:**
- Some model IDs may be newer than the validation list
- The system will show warnings but still allow usage
- Check provider documentation for correct model names

### Environment Variable Issues

**Keys not loading:**
- Ensure `.env.local` is in the project root
- Restart your development server
- Check for typos in variable names

**Production deployment issues:**
- Verify environment variables are set in hosting platform
- Check that variables don't have quotes in the platform UI
- Redeploy after adding variables

## Security Best Practices

### API Key Management

- **Never commit API keys to version control**
- Use environment variables for all deployments
- Rotate keys regularly
- Monitor API usage for unexpected activity

### Access Control

- AI features are only available to admin users
- API keys are never stored in the database
- Keys are masked in the admin interface
- Connection testing uses minimal API calls

## Cost Management

### Token Usage

The system provides cost estimates for AI operations:
- OpenAI: Charged per token (input + output)
- Anthropic: Charged per token (input + output)

### Cost Optimization Tips

- Use smaller models for simple tasks (gpt-4o-mini, claude-3-5-haiku)
- Keep system prompts concise
- Limit max tokens for responses
- Monitor usage in provider dashboards

## Advanced Configuration

### Custom System Prompts

Configure default behavior in AI settings:

```
You are an expert content editor helping improve portfolio project descriptions. 
Focus on clarity, professionalism, and technical accuracy.
```

### Temperature and Token Limits

- **Temperature**: Controls creativity (0.0 = deterministic, 1.0 = creative)
- **Max Tokens**: Limits response length (recommended: 1000-4000)

### Default Provider

Set which provider to use by default when both are configured.

## API Usage Monitoring

### OpenAI Usage

Monitor usage at: https://platform.openai.com/usage

### Anthropic Usage

Monitor usage at: https://console.anthropic.com/

### Built-in Monitoring

The application tracks:
- Token usage per request
- Estimated costs
- Model performance
- Error rates

## Support

### Getting Help

1. Check this troubleshooting guide
2. Review provider documentation:
   - [OpenAI API Docs](https://platform.openai.com/docs)
   - [Anthropic API Docs](https://docs.anthropic.com/)
3. Check application logs for detailed error messages

### Common Solutions

- **Restart development server** after environment changes
- **Clear browser cache** if settings don't update
- **Check network connectivity** for API calls
- **Verify API key permissions** in provider dashboards

## Migration from Previous Versions

If upgrading from an older version with database-stored API keys:

1. Export existing API keys from the old admin interface
2. Add keys to environment variables
3. Run database migration to clean up old tables
4. Reconfigure models in the new AI settings interface

The new architecture is more secure and easier to manage across different environments.