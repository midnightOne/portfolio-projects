# Media Provider Setup Guide

This guide provides step-by-step instructions for setting up each supported media storage provider in your portfolio project.

## 🚀 Quick Start

1. Choose your preferred provider from the options below
2. Follow the setup instructions for your chosen provider
3. Add the required environment variables to your `.env.local` file
4. Test your configuration with `npm run media:test`

---

## 📋 Provider Comparison

| Provider | Free Tier | Pros | Best For |
|----------|-----------|------|----------|
| **Cloudinary** | 25GB/month | Auto-optimization, transformations, easy setup | Production sites with image/video heavy content |
| **AWS S3** | 5GB storage | Cost-effective at scale, highly reliable | Large portfolios, professional deployments |
| **Vercel Blob** | 1GB | Seamless Vercel integration, simple setup | Vercel-hosted projects, small to medium portfolios |
| **Supabase Storage** | 1GB | Database integration, auth-aware | Projects already using Supabase |
| **GitHub + jsDelivr** | Unlimited* | Free, version controlled, global CDN | Open source projects, static assets |

*GitHub: Free for public repos, subject to file size limits

---

## 1. 🎨 Cloudinary (Recommended)

**Best for**: Production sites with automatic image optimization

### Setup Steps

1. **Create Account**: Visit [cloudinary.com](https://cloudinary.com) and sign up
2. **Get Credentials**: Go to Dashboard → Settings → Access Keys
3. **Add Environment Variables**:

```bash
MEDIA_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=portfolio-projects  # Optional: organize uploads
```

### Features
- ✅ Automatic image optimization (WebP, AVIF)
- ✅ Real-time transformations (resize, crop, effects)
- ✅ Video processing and optimization
- ✅ Global CDN delivery
- ✅ 25GB free bandwidth/month

### Example Usage
```tsx
import { CloudinaryImage } from '@/components/media/cloudinary-image';

<CloudinaryImage 
  publicId="portfolio-projects/my-image"
  alt="Project screenshot"
  width={800}
  height={600}
  crop={{ type: 'fill', gravity: 'auto' }}
/>
```

---

## 2. 💰 AWS S3 + CloudFront

**Best for**: Cost-effective storage at scale, professional deployments

### Setup Steps

1. **Create AWS Account**: Visit [aws.amazon.com](https://aws.amazon.com)
2. **Create S3 Bucket**:
   - Go to S3 Console → Create Bucket
   - Choose a unique bucket name
   - Select your preferred region
   - Configure public access if needed

3. **Create IAM User**:
   - Go to IAM Console → Users → Create User
   - Attach policy: `AmazonS3FullAccess` (or create custom policy)
   - Generate Access Keys

4. **Setup CloudFront (Optional)**:
   - Go to CloudFront Console → Create Distribution
   - Set S3 bucket as origin
   - Configure caching rules

5. **Add Environment Variables**:

```bash
MEDIA_PROVIDER=s3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_CLOUDFRONT_URL=https://d123456789.cloudfront.net  # Optional
AWS_S3_ACL=public-read  # Optional, defaults to public-read
```

### Features
- ✅ Very cost-effective at scale
- ✅ 99.999999999% (11 9's) durability
- ✅ CloudFront global CDN integration
- ✅ Fine-grained access control
- ❌ No automatic image optimization (requires Lambda@Edge)

---

## 3. ⚡ Vercel Blob Storage

**Best for**: Vercel-hosted projects, simple setup

### Setup Steps

1. **Vercel Account**: Ensure you have a Vercel account and project
2. **Enable Blob Storage**:
   - Go to your Vercel Dashboard
   - Navigate to your project → Storage → Blob
   - Click "Create Store"

3. **Get Token**:
   - Go to Storage → Blob → Settings
   - Copy the Read/Write token

4. **Add Environment Variables**:

```bash
MEDIA_PROVIDER=vercel
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_abcdef123456
```

### Features
- ✅ Seamless Vercel integration
- ✅ Automatic HTTPS
- ✅ Simple setup
- ✅ Global edge locations
- ❌ No image transformations
- ❌ Limited free tier (1GB)

---

## 4. 🔥 Supabase Storage

**Best for**: Projects already using Supabase, auth-aware storage

### Setup Steps

1. **Supabase Project**: Create or use existing project at [supabase.com](https://supabase.com)
2. **Create Storage Bucket**:
   - Go to Storage in Supabase Dashboard
   - Create a new bucket (e.g., "media")
   - Configure public/private access as needed

3. **Get Service Key**:
   - Go to Settings → API
   - Copy the `service_role` key (not anon key for uploads)

4. **Add Environment Variables**:

```bash
MEDIA_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET=media
```

### Features
- ✅ Database integration
- ✅ Row Level Security (RLS)
- ✅ Auth-aware storage
- ✅ Automatic HTTPS
- ❌ No image transformations
- ❌ Limited free tier (1GB)

### Security Note
The service key is powerful - keep it secure and only use in server environments.

---

## 5. 🆓 GitHub + jsDelivr

**Best for**: Open source projects, version-controlled assets

### Setup Steps

1. **GitHub Repository**: Create or use existing public repository
2. **Generate Token**:
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate token with `repo` scope

3. **Add Environment Variables**:

```bash
MEDIA_PROVIDER=github
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
GITHUB_BRANCH=main  # Optional, defaults to 'main'
```

### Features
- ✅ Completely free for public repos
- ✅ Version controlled assets
- ✅ Global CDN via jsDelivr
- ✅ Git-based workflow
- ❌ Public repositories only for free
- ❌ File size limits (100MB per file)
- ❌ No image transformations

### Example URLs
Files are served via jsDelivr CDN:
```
https://cdn.jsdelivr.net/gh/username/repo@main/uploads/image.jpg
```

---

## 🧪 Testing Your Setup

After configuring any provider, test your setup:

```bash
# Test configuration
npm run media:test

# Test actual upload (Cloudinary only currently)
npm run media:upload-test
```

---

## 🔄 Switching Providers

To switch providers, simply change the `MEDIA_PROVIDER` environment variable:

```bash
# Switch to AWS S3
MEDIA_PROVIDER=s3

# Switch to Vercel Blob
MEDIA_PROVIDER=vercel

# Switch back to Cloudinary
MEDIA_PROVIDER=cloudinary
```

Restart your application after changing providers.

---

## 🚨 Security Best Practices

### Environment Variables
- **Never commit** `.env.local` or environment files to version control
- Use different credentials for development and production
- Regularly rotate API keys and tokens

### Access Control
- **Cloudinary**: Use signed URLs for sensitive content
- **AWS S3**: Configure bucket policies and IAM roles properly
- **Supabase**: Use Row Level Security (RLS) policies
- **GitHub**: Use fine-grained personal access tokens

### File Validation
The system automatically validates:
- File types and extensions
- File sizes (configurable limits)
- Dangerous file types are blocked (.js, .html, .php, etc.)

---

## 🔧 Troubleshooting

### Common Issues

**"Provider configuration is missing"**
- Check all required environment variables are set
- Verify variable names match exactly (case-sensitive)
- Restart development server after adding variables

**Upload fails with authentication error**
- Verify API keys/tokens are correct
- Check token permissions (especially for GitHub)
- Ensure service keys have proper permissions (Supabase)

**Files not accessible**
- Check bucket/storage permissions are public
- Verify CloudFront/CDN configuration (AWS)
- Ensure repository is public (GitHub)

### Getting Help

1. Run `npm run media:test` to diagnose configuration issues
2. Check console logs for detailed error messages
3. Verify environment variables with the test output
4. Consult provider documentation for service-specific issues

---

## 🎯 Recommendations by Use Case

### Personal Portfolio
- **Start with**: Cloudinary (free tier)
- **Scale to**: AWS S3 + CloudFront

### Open Source Project
- **Use**: GitHub + jsDelivr
- **Benefits**: Free, version controlled, community friendly

### Vercel-hosted Site
- **Use**: Vercel Blob Storage
- **Benefits**: Seamless integration, simple setup

### Supabase-based App
- **Use**: Supabase Storage
- **Benefits**: Database integration, unified auth

### High-Traffic Production
- **Use**: AWS S3 + CloudFront
- **Benefits**: Cost-effective, enterprise-grade reliability

---

## 📊 Cost Comparison

| Provider | Storage | Bandwidth | Requests |
|----------|---------|-----------|----------|
| **Cloudinary** | Included | 25GB/month | Included |
| **AWS S3** | $0.023/GB | $0.09/GB | $0.0004/1k |
| **Vercel Blob** | $0.15/GB | Included | $0.30/1k |
| **Supabase** | $0.021/GB | $0.09/GB | Included |
| **GitHub** | Free* | Free* | Free* |

*GitHub: Free for public repositories

---

**Next**: After setting up your provider, you can start using the upload API or implement the admin interface for file management! 