# AI Troubleshooting Guide

This guide helps resolve common issues with AI configuration and usage in the Portfolio Projects application.

## Quick Diagnostics

### Check AI Status

1. Navigate to `/admin/ai-settings`
2. Check the "Environment Configuration" section
3. Look for green checkmarks or red error indicators
4. Use "Test" buttons to verify connections

### Common Status Indicators

- ✅ **Connected**: API key is valid and working
- ❌ **Failed**: API key is invalid or connection failed
- ⚠️ **Not configured**: API key is missing from environment
- 🔄 **Testing**: Connection test in progress

## Environment Configuration Issues

### Problem: "Not configured" Status

**Symptoms:**
- API key shows "Not configured"
- Provider section is grayed out
- Test button is disabled

**Solutions:**

1. **Check Environment Variables**
   ```bash
   # Verify variables are set
   echo $OPENAI_API_KEY
   echo $ANTHROPIC_API_KEY
   ```

2. **Add Missing Variables**
   ```bash
   # Add to .env.local
   OPENAI_API_KEY="sk-proj-your-key-here"
   ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"
   ```

3. **Restart Development Server**
   ```bash
   # Stop server (Ctrl+C) then restart
   npm run dev
   ```

4. **Check File Location**
   - Ensure `.env.local` is in project root
   - Not in subdirectories or with different names

### Problem: API Key Not Loading

**Symptoms:**
- Environment variable is set but not detected
- Status still shows "Not configured"

**Solutions:**

1. **Check Variable Names**
   ```bash
   # Correct names (case-sensitive)
   OPENAI_API_KEY=sk-proj-...
   ANTHROPIC_API_KEY=sk-ant-api03-...
   
   # Wrong names (will not work)
   OPENAI_KEY=sk-proj-...
   ANTHROPIC_KEY=sk-ant-api03-...
   ```

2. **Check for Extra Characters**
   ```bash
   # Wrong (has quotes)
   OPENAI_API_KEY="sk-proj-..."
   
   # Correct (no quotes in .env.local)
   OPENAI_API_KEY=sk-proj-...
   ```

3. **Verify File Encoding**
   - Ensure `.env.local` is UTF-8 encoded
   - No BOM (Byte Order Mark)
   - Unix line endings (LF, not CRLF)

## Connection Testing Issues

### Problem: "Invalid API key" Error

**Symptoms:**
- Test connection fails with authentication error
- Error message mentions invalid or expired key

**Solutions:**

1. **Verify API Key Format**
   ```bash
   # OpenAI keys start with sk-proj- (newer) or sk- (older)
   OPENAI_API_KEY=sk-proj-abcd1234...
   
   # Anthropic keys start with sk-ant-api03-
   ANTHROPIC_API_KEY=sk-ant-api03-abcd1234...
   ```

2. **Check Key Status in Provider Dashboard**
   - **OpenAI**: Visit [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - **Anthropic**: Visit [console.anthropic.com](https://console.anthropic.com/)
   - Verify key is active and not expired

3. **Regenerate API Key**
   - Create a new key in provider dashboard
   - Update environment variable
   - Restart development server

### Problem: "Rate limit exceeded" Error

**Symptoms:**
- Connection test fails with rate limit message
- Error mentions too many requests

**Solutions:**

1. **Wait for Rate Limit Reset**
   - OpenAI: Usually resets every minute
   - Anthropic: Usually resets every minute
   - Wait 60 seconds and try again

2. **Check API Usage**
   - Review usage in provider dashboard
   - Ensure you haven't exceeded monthly limits
   - Consider upgrading API plan if needed

3. **Reduce Test Frequency**
   - Don't click test buttons repeatedly
   - Wait between connection tests

### Problem: "Network error" Error

**Symptoms:**
- Connection fails with network-related error
- Timeout or connection refused messages

**Solutions:**

1. **Check Internet Connection**
   ```bash
   # Test basic connectivity
   ping google.com
   curl -I https://api.openai.com
   ```

2. **Check Firewall Settings**
   - Ensure outbound HTTPS (port 443) is allowed
   - Check corporate firewall restrictions
   - Try from different network if possible

3. **Verify Proxy Settings**
   ```bash
   # If using proxy, set environment variables
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   ```

## Model Configuration Issues

### Problem: No Models in Dropdown

**Symptoms:**
- AI assistant dropdown is empty
- "No models available" message
- Model selection disabled

**Solutions:**

1. **Check Provider Configuration**
   - Ensure at least one provider has valid API key
   - Test connections in AI settings
   - Verify models are configured for working providers

2. **Configure Models**
   ```
   # In AI Settings, add models:
   OpenAI: gpt-4o, gpt-4o-mini, gpt-3.5-turbo
   Anthropic: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022
   ```

3. **Save Configuration**
   - Click "Save Configuration" button
   - Wait for success message
   - Refresh page if needed

### Problem: Model Validation Warnings

**Symptoms:**
- Yellow warning icons next to model names
- "Model may not be available" messages
- Models still work but show warnings

**Solutions:**

1. **Check Model Names**
   ```
   # Correct OpenAI models
   gpt-4o
   gpt-4o-mini
   gpt-3.5-turbo
   
   # Correct Anthropic models  
   claude-3-5-sonnet-20241022
   claude-3-5-haiku-20241022
   claude-3-opus-20240229
   ```

2. **Update Model Lists**
   - Check provider documentation for latest models
   - Remove deprecated models
   - Add new models as they become available

3. **Ignore Warnings for New Models**
   - Warnings may appear for very new models
   - System will still attempt to use them
   - Monitor provider announcements for model updates

## Content Editing Issues

### Problem: AI Assistant Not Working

**Symptoms:**
- AI buttons don't respond
- No model selection available
- Error messages when trying to edit content

**Solutions:**

1. **Check Prerequisites**
   - At least one provider must be configured
   - Models must be configured for that provider
   - Connection test must pass

2. **Verify Model Selection**
   - Ensure a model is selected in dropdown
   - Try different model if current one fails
   - Check model availability in AI settings

3. **Check Content Selection**
   - Some operations require text selection
   - Try selecting text before using AI features
   - Ensure content is not empty

### Problem: AI Responses Are Poor Quality

**Symptoms:**
- AI generates irrelevant content
- Responses don't match the requested operation
- Content quality is inconsistent

**Solutions:**

1. **Adjust System Prompt**
   ```
   You are an expert technical content editor specializing in portfolio projects. 
   Focus on clarity, professionalism, and accuracy. Maintain the original meaning 
   while improving readability and technical precision.
   ```

2. **Tune Parameters**
   - **Temperature**: Lower (0.3-0.5) for consistent, focused responses
   - **Max Tokens**: Higher (2000-4000) for detailed responses
   - **Model**: Try different models for different tasks

3. **Provide Better Context**
   - Ensure project title and description are filled
   - Add relevant tags to provide context
   - Select specific text portions for targeted edits

### Problem: High AI Costs

**Symptoms:**
- Unexpected API charges
- High token usage
- Frequent API calls

**Solutions:**

1. **Monitor Usage**
   - Check provider dashboards regularly
   - Review token usage in AI responses
   - Set up billing alerts

2. **Optimize Settings**
   - Use smaller models for simple tasks (gpt-4o-mini, claude-3-5-haiku)
   - Reduce max tokens for shorter responses
   - Keep system prompts concise

3. **Use AI Strategically**
   - Don't use AI for every small edit
   - Batch similar operations together
   - Review changes before applying

## Deployment Issues

### Problem: AI Not Working in Production

**Symptoms:**
- AI works locally but not in deployed version
- Environment configuration shows "Not configured"
- Connection tests fail in production

**Solutions:**

1. **Check Environment Variables**
   ```bash
   # Vercel
   vercel env ls
   
   # Netlify
   netlify env:list
   
   # Railway
   railway variables
   ```

2. **Add Missing Variables**
   - Use hosting platform's dashboard
   - Add OPENAI_API_KEY and ANTHROPIC_API_KEY
   - Redeploy application

3. **Verify Variable Names**
   - Ensure exact spelling and case
   - No extra spaces or characters
   - Don't include quotes in platform UI

### Problem: Environment Variables Not Loading

**Symptoms:**
- Variables are set in hosting platform
- Still showing as not configured
- Deployment logs show missing variables

**Solutions:**

1. **Check Variable Scope**
   - Ensure variables are set for correct environment
   - Check preview vs production environments
   - Verify branch-specific settings

2. **Redeploy Application**
   ```bash
   # Force redeploy to pick up new variables
   git commit --allow-empty -m "Trigger redeploy"
   git push
   ```

3. **Check Build Logs**
   - Review deployment logs for errors
   - Look for environment variable loading messages
   - Check for build-time vs runtime issues

## Performance Issues

### Problem: Slow AI Responses

**Symptoms:**
- AI operations take very long to complete
- Timeouts or connection errors
- Poor user experience

**Solutions:**

1. **Choose Faster Models**
   - OpenAI: gpt-4o-mini instead of gpt-4o
   - Anthropic: claude-3-5-haiku instead of claude-3-5-sonnet
   - Balance speed vs quality needs

2. **Optimize Requests**
   - Reduce max tokens for faster responses
   - Keep input content concise
   - Use specific operations instead of general "improve"

3. **Check Network**
   - Test from different locations
   - Check for network congestion
   - Consider CDN or edge deployment

### Problem: Frequent Timeouts

**Symptoms:**
- AI requests timeout before completing
- Network error messages
- Inconsistent response times

**Solutions:**

1. **Increase Timeout Settings**
   ```typescript
   // In API configuration
   const timeout = 60000; // 60 seconds
   ```

2. **Retry Logic**
   - Implement automatic retries for failed requests
   - Use exponential backoff
   - Provide user feedback during retries

3. **Split Large Requests**
   - Break large content into smaller chunks
   - Process sections independently
   - Combine results on client side

## Getting Additional Help

### Debug Information

When reporting issues, include:

1. **Environment Details**
   - Operating system
   - Node.js version
   - Browser and version
   - Deployment platform

2. **Configuration**
   - Which providers are configured
   - Model configuration
   - Error messages (without API keys)

3. **Steps to Reproduce**
   - Exact steps that cause the issue
   - Expected vs actual behavior
   - Screenshots if helpful

### Useful Commands

```bash
# Check environment variables (without revealing keys)
env | grep -E "(OPENAI|ANTHROPIC)" | sed 's/=.*/=***/'

# Test API connectivity
curl -I https://api.openai.com/v1/models
curl -I https://api.anthropic.com/v1/messages

# Check Node.js version
node --version

# Check npm version
npm --version

# View application logs
npm run dev 2>&1 | tee debug.log
```

### Resources

- **OpenAI Documentation**: [platform.openai.com/docs](https://platform.openai.com/docs)
- **Anthropic Documentation**: [docs.anthropic.com](https://docs.anthropic.com/)
- **Next.js Environment Variables**: [nextjs.org/docs/basic-features/environment-variables](https://nextjs.org/docs/basic-features/environment-variables)
- **Vercel Environment Variables**: [vercel.com/docs/concepts/projects/environment-variables](https://vercel.com/docs/concepts/projects/environment-variables)

### Support Channels

1. Check application logs for detailed error messages
2. Review provider status pages for service issues
3. Test with minimal configuration to isolate problems
4. Document exact steps to reproduce issues