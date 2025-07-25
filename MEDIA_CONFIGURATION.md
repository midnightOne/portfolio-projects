# Media Provider Configuration

This document explains how to configure the media upload system with different storage providers.

> 📖 **For detailed setup instructions for each provider**, see [MEDIA_PROVIDER_SETUP.md](./MEDIA_PROVIDER_SETUP.md)

## Overview

The media upload system supports **5 different storage providers** through a configurable abstraction layer. You can switch between providers using environment variables without changing code.

## Supported Providers

### 1. Cloudinary (Default - Recommended)

**Features:**
- Automatic image optimization
- Real-time transformations
- CDN delivery
- Video support
- 25GB free tier

**Configuration:**
```bash
MEDIA_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_FOLDER=portfolio-projects  # Optional
```

**Setup Steps:**
1. Create account at [cloudinary.com](https://cloudinary.com)
2. Get credentials from Dashboard
3. Add environment variables
4. Test upload via API

### 2. AWS S3

**Features:**
- Cost-effective storage
- Scalable infrastructure
- CloudFront CDN integration
- Fine-grained access control

**Configuration:**
```bash
MEDIA_PROVIDER=s3
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name
AWS_CLOUDFRONT_URL=https://your-distribution-id.cloudfront.net  # Optional
AWS_S3_ACL=public-read  # Optional, defaults to public-read
```

**Setup Steps:**
1. Create AWS account and S3 bucket
2. Create IAM user with S3 permissions
3. Configure bucket for public access (if needed)
4. Set up CloudFront distribution (recommended)
5. Add environment variables

### 3. Vercel Blob Storage ✅ **NEW**

**Features:**
- Seamless Vercel integration
- Automatic HTTPS and global edge locations
- Simple setup with single token
- 1GB free tier

**Configuration:**
```bash
MEDIA_PROVIDER=vercel
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### 4. Supabase Storage ✅ **NEW**

**Features:**
- Database integration with auth-aware storage
- Row Level Security (RLS) support
- Built-in image optimization
- 1GB free tier

**Configuration:**
```bash
MEDIA_PROVIDER=supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_STORAGE_BUCKET=media
```

### 5. GitHub + jsDelivr ✅ **NEW**

**Features:**
- Completely free for public repositories
- Version controlled assets with Git workflow
- Global CDN via jsDelivr
- Perfect for open source projects

**Configuration:**
```bash
MEDIA_PROVIDER=github
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
GITHUB_BRANCH=main  # Optional
```

## API Usage

### Upload Endpoint

**POST /api/media/upload**

Headers:
- Authentication required (admin session)
- Content-Type: multipart/form-data

Body:
- `file`: The file to upload
- `metadata` (optional): JSON string with upload options

**Example metadata:**
```json
{
  "type": "image",
  "projectId": "clx123...",
  "description": "Project screenshot",
  "folder": "screenshots",
  "tags": ["ui", "desktop"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "url": "https://res.cloudinary.com/...",
    "publicId": "screenshots/image-123",
    "format": "jpg",
    "width": 1920,
    "height": 1080,
    "bytes": 245760,
    "resourceType": "image",
    "provider": "cloudinary",
    "createdAt": "2024-01-01T12:00:00.000Z"
  },
  "warnings": ["File size approaching limit"]
}
```

### Configuration Endpoint

**GET /api/media/upload**

Returns current provider configuration and limits.

## File Validation

### Size Limits
- **Images**: 10MB max
- **Videos**: 100MB max  
- **Attachments**: 50MB max

### Supported Formats

**Images:** JPG, PNG, GIF, WebP, SVG
**Videos:** MP4, WebM, MOV, AVI
**Attachments:** PDF, ZIP, APK, EXE, DMG, TXT

### Security

- Dangerous file extensions blocked (.js, .html, .php, etc.)
- MIME type validation
- File size limits enforced
- Filename sanitization

## Development

### Local Testing

1. Set up provider credentials
2. Start development server: `npm run dev`
3. Test upload via admin interface or API client

### Switching Providers

Change the `MEDIA_PROVIDER` environment variable and restart the application:

```bash
# Switch to S3
MEDIA_PROVIDER=s3

# Switch back to Cloudinary  
MEDIA_PROVIDER=cloudinary
```

### Provider Validation

Check if your provider is configured correctly:

```javascript
import { validateMediaProviderConfig } from '@/lib/media';

const validation = validateMediaProviderConfig();
console.log(validation.valid); // true/false
console.log(validation.errors); // Array of error messages
```

## Troubleshooting

### Common Issues

**Provider not configured:**
- Check environment variables are set
- Verify credentials are correct
- Ensure provider name is valid

**Upload fails:**
- Check file size limits
- Verify file type is supported
- Check network connectivity
- Review provider-specific error messages

**Images not loading:**
- Verify URLs are accessible
- Check CORS configuration
- Ensure CDN is properly configured

### Error Codes

- `UNAUTHORIZED`: User not authenticated
- `NO_FILE`: No file provided in request
- `VALIDATION_FAILED`: File validation failed
- `CLOUDINARY_ERROR`: Cloudinary-specific error
- `S3_ERROR`: AWS S3-specific error
- `UPLOAD_FAILED`: Generic upload failure

## Migration

When switching providers, existing media URLs will continue to work. New uploads will use the configured provider. Consider implementing a migration script if you need to move existing files between providers. 