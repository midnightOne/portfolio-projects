# AI Deployment Guide

This guide covers deploying the Portfolio Projects application with AI features across different hosting platforms.

## Overview

The AI system requires environment variables for API keys and works across all major hosting platforms. The application gracefully degrades when AI keys are not provided.

## Platform-Specific Setup

### Vercel

Vercel is the recommended platform for Next.js applications.

#### Environment Variables Setup

1. **Via Vercel Dashboard:**
   - Go to your project dashboard
   - Navigate to Settings → Environment Variables
   - Add the following variables:

   ```
   Name: OPENAI_API_KEY
   Value: sk-proj-your-key-here
   Environment: Production, Preview, Development
   
   Name: ANTHROPIC_API_KEY  
   Value: sk-ant-api03-your-key-here
   Environment: Production, Preview, Development
   ```

2. **Via Vercel CLI:**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login to Vercel
   vercel login
   
   # Add environment variables
   vercel env add OPENAI_API_KEY
   # Enter your OpenAI API key when prompted
   
   vercel env add ANTHROPIC_API_KEY
   # Enter your Anthropic API key when prompted
   ```

3. **Via vercel.json:**
   ```json
   {
     "env": {
       "OPENAI_API_KEY": "@openai-api-key",
       "ANTHROPIC_API_KEY": "@anthropic-api-key"
     }
   }
   ```

#### Deployment Steps

1. **Connect Repository:**
   ```bash
   # Deploy from local directory
   vercel
   
   # Or connect GitHub repository via dashboard
   ```

2. **Configure Build Settings:**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Deploy:**
   ```bash
   # Deploy to production
   vercel --prod
   ```

#### Vercel-Specific Features

- **Edge Functions**: AI endpoints work with Vercel Edge Runtime
- **Serverless Functions**: Automatic scaling for AI operations
- **Preview Deployments**: Test AI features in preview environments

---

### Netlify

#### Environment Variables Setup

1. **Via Netlify Dashboard:**
   - Go to Site settings → Environment variables
   - Add variables:
   ```
   OPENAI_API_KEY = sk-proj-your-key-here
   ANTHROPIC_API_KEY = sk-ant-api03-your-key-here
   ```

2. **Via Netlify CLI:**
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli
   
   # Login
   netlify login
   
   # Set environment variables
   netlify env:set OPENAI_API_KEY "sk-proj-your-key-here"
   netlify env:set ANTHROPIC_API_KEY "sk-ant-api03-your-key-here"
   ```

3. **Via netlify.toml:**
   ```toml
   [build.environment]
     OPENAI_API_KEY = "sk-proj-your-key-here"
     ANTHROPIC_API_KEY = "sk-ant-api03-your-key-here"
   ```

#### Build Configuration

Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "18"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  node_bundler = "esbuild"
```

#### Deployment

```bash
# Deploy via CLI
netlify deploy --prod

# Or connect GitHub repository via dashboard
```

---

### Railway

#### Environment Variables Setup

1. **Via Railway Dashboard:**
   - Go to your project
   - Click Variables tab
   - Add variables:
   ```
   OPENAI_API_KEY = sk-proj-your-key-here
   ANTHROPIC_API_KEY = sk-ant-api03-your-key-here
   ```

2. **Via Railway CLI:**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login
   railway login
   
   # Set variables
   railway variables set OPENAI_API_KEY=sk-proj-your-key-here
   railway variables set ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```

#### Deployment

1. **Connect Repository:**
   ```bash
   # Initialize Railway project
   railway login
   railway link
   ```

2. **Deploy:**
   ```bash
   # Deploy current directory
   railway up
   ```

3. **Custom Start Command:**
   ```json
   // package.json
   {
     "scripts": {
       "railway:start": "npm run build && npm run start"
     }
   }
   ```

---

### Heroku

#### Environment Variables Setup

1. **Via Heroku Dashboard:**
   - Go to Settings → Config Vars
   - Add variables:
   ```
   OPENAI_API_KEY = sk-proj-your-key-here
   ANTHROPIC_API_KEY = sk-ant-api03-your-key-here
   ```

2. **Via Heroku CLI:**
   ```bash
   # Install Heroku CLI
   # Set config vars
   heroku config:set OPENAI_API_KEY=sk-proj-your-key-here
   heroku config:set ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```

#### Build Configuration

Create `Procfile`:
```
web: npm start
```

Update `package.json`:
```json
{
  "scripts": {
    "heroku-postbuild": "npm run build"
  }
}
```

#### Deployment

```bash
# Create Heroku app
heroku create your-app-name

# Deploy
git push heroku main
```

---

### DigitalOcean App Platform

#### Environment Variables Setup

1. **Via App Spec:**
   ```yaml
   # .do/app.yaml
   name: portfolio-projects
   services:
   - name: web
     source_dir: /
     github:
       repo: your-username/portfolio-projects
       branch: main
     run_command: npm start
     build_command: npm run build
     environment_slug: node-js
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
     - key: OPENAI_API_KEY
       value: sk-proj-your-key-here
       type: SECRET
     - key: ANTHROPIC_API_KEY
       value: sk-ant-api03-your-key-here
       type: SECRET
   ```

2. **Via Dashboard:**
   - Go to App → Settings → Environment Variables
   - Add encrypted variables

#### Deployment

```bash
# Deploy via doctl CLI
doctl apps create --spec .do/app.yaml

# Or use GitHub integration via dashboard
```

---

### AWS (Amplify/Elastic Beanstalk)

#### AWS Amplify

1. **Environment Variables:**
   ```bash
   # Via Amplify CLI
   amplify env add production
   amplify env checkout production
   
   # Add to amplify/backend/function/[function-name]/src/.env
   OPENAI_API_KEY=sk-proj-your-key-here
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```

2. **Via Console:**
   - Go to Amplify Console → App Settings → Environment Variables
   - Add variables for each environment

#### AWS Elastic Beanstalk

1. **Configuration:**
   ```yaml
   # .ebextensions/environment.config
   option_settings:
     aws:elasticbeanstalk:application:environment:
       OPENAI_API_KEY: sk-proj-your-key-here
       ANTHROPIC_API_KEY: sk-ant-api03-your-key-here
   ```

2. **Via Console:**
   - Go to Configuration → Software → Environment Properties
   - Add environment variables

---

### Google Cloud Platform

#### Cloud Run

1. **Environment Variables:**
   ```bash
   # Deploy with environment variables
   gcloud run deploy portfolio-projects \
     --source . \
     --set-env-vars OPENAI_API_KEY=sk-proj-your-key-here,ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```

2. **Via Console:**
   - Go to Cloud Run → Service → Edit & Deploy New Revision
   - Add environment variables in Variables & Secrets tab

#### App Engine

1. **app.yaml:**
   ```yaml
   runtime: nodejs18
   
   env_variables:
     OPENAI_API_KEY: sk-proj-your-key-here
     ANTHROPIC_API_KEY: sk-ant-api03-your-key-here
   ```

2. **Deploy:**
   ```bash
   gcloud app deploy
   ```

---

## Security Best Practices

### Environment Variable Security

1. **Never Commit API Keys:**
   ```bash
   # Add to .gitignore
   .env.local
   .env.production
   *.env
   ```

2. **Use Platform Secret Management:**
   - Vercel: Environment Variables (encrypted)
   - Netlify: Environment Variables (encrypted)
   - Railway: Variables (encrypted)
   - Heroku: Config Vars (encrypted)

3. **Rotate Keys Regularly:**
   - Generate new API keys monthly
   - Update across all environments
   - Monitor for unauthorized usage

### Access Control

1. **Restrict API Key Permissions:**
   - Use minimum required permissions
   - Set usage limits in provider dashboards
   - Monitor API usage regularly

2. **Environment Separation:**
   - Use different keys for development/production
   - Implement proper staging environments
   - Test with limited-permission keys

### Monitoring

1. **Set Up Alerts:**
   ```bash
   # Example: Monitor API usage
   # Set billing alerts in provider dashboards
   # Monitor error rates and response times
   ```

2. **Log Security Events:**
   - Failed authentication attempts
   - Unusual API usage patterns
   - Configuration changes

---

## Testing Deployment

### Pre-Deployment Checklist

- [ ] Environment variables configured
- [ ] API keys tested locally
- [ ] Build process completes successfully
- [ ] Database migrations applied
- [ ] SSL certificates configured

### Post-Deployment Verification

1. **Test AI Features:**
   ```bash
   # Test environment status endpoint
   curl https://your-domain.com/api/admin/ai/environment-status
   
   # Test connection (requires authentication)
   curl -X POST https://your-domain.com/api/admin/ai/test-connection \
     -H "Content-Type: application/json" \
     -d '{"provider": "openai"}'
   ```

2. **Verify Configuration:**
   - Visit `/admin/ai-settings`
   - Check environment status
   - Test connections to both providers
   - Verify model configuration

3. **Test Content Editing:**
   - Create or edit a project
   - Use AI assistant features
   - Verify responses and functionality

### Common Deployment Issues

1. **Environment Variables Not Loading:**
   - Check variable names (case-sensitive)
   - Verify deployment environment
   - Restart/redeploy application

2. **API Connections Failing:**
   - Verify API keys are correct
   - Check network connectivity
   - Review firewall settings

3. **Build Failures:**
   - Check Node.js version compatibility
   - Verify all dependencies installed
   - Review build logs for errors

---

## Performance Optimization

### Caching Strategies

1. **API Response Caching:**
   ```typescript
   // Cache AI responses for repeated requests
   const cacheKey = `ai-${model}-${hash(content)}`;
   const cached = await cache.get(cacheKey);
   if (cached) return cached;
   ```

2. **Model Configuration Caching:**
   - Cache model lists to reduce API calls
   - Implement cache invalidation strategies
   - Use CDN for static configuration

### Resource Management

1. **Connection Pooling:**
   - Reuse HTTP connections
   - Implement connection limits
   - Monitor connection health

2. **Rate Limiting:**
   - Implement client-side rate limiting
   - Use exponential backoff
   - Queue requests during high load

### Monitoring and Analytics

1. **Performance Metrics:**
   - Response times
   - Error rates
   - Token usage
   - Cost tracking

2. **Health Checks:**
   ```typescript
   // Health check endpoint
   app.get('/health', async (req, res) => {
     const aiStatus = await checkAIProviders();
     res.json({ status: 'ok', ai: aiStatus });
   });
   ```

---

## Troubleshooting Deployment Issues

### Common Problems

1. **Build Timeouts:**
   - Increase build timeout limits
   - Optimize build process
   - Use build caching

2. **Memory Issues:**
   - Increase memory allocation
   - Optimize bundle size
   - Use streaming for large responses

3. **Cold Start Problems:**
   - Implement warming strategies
   - Use serverless optimizations
   - Consider always-on instances

### Debug Commands

```bash
# Check deployment logs
vercel logs your-deployment-url
netlify logs
heroku logs --tail

# Test environment variables
curl https://your-domain.com/api/health

# Monitor API usage
# Check provider dashboards for usage statistics
```

### Getting Help

1. **Platform Documentation:**
   - Vercel: [vercel.com/docs](https://vercel.com/docs)
   - Netlify: [docs.netlify.com](https://docs.netlify.com)
   - Railway: [docs.railway.app](https://docs.railway.app)

2. **AI Provider Support:**
   - OpenAI: [help.openai.com](https://help.openai.com)
   - Anthropic: [support.anthropic.com](https://support.anthropic.com)

3. **Community Resources:**
   - Next.js Discord
   - Platform-specific communities
   - Stack Overflow tags