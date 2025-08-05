# Portfolio Projects

A modern, responsive portfolio website built with Next.js 14, TypeScript, and Tailwind CSS. This application showcases projects with rich media content, real-time filtering, and an admin CMS for content management.

## Features

- 🎨 Modern, responsive design with shadcn/ui components
- 🔍 Real-time search and filtering
- 📱 Mobile-first responsive layout
- 🖼️ Rich media support (images, videos, carousels)
- 🎮 Interactive content embedding (WebXR, Canvas, iframes)
- 📊 Analytics and view tracking
- 🔐 Secure admin interface
- 🤖 AI-powered content editing and assistance
- 🚀 Optimized performance with Next.js 14

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation
- **Animations**: Framer Motion
- **Image Processing**: Sharp

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd portfolio-projects
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```
Edit `.env.local` with your database URL and other configuration.

4. Set up the database:
```bash
npm run db:push
npm run db:generate
```

5. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin interface pages
│   ├── api/               # API routes
│   ├── projects/          # Project pages
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── admin/            # Admin-specific components
│   ├── layout/           # Layout components
│   ├── projects/         # Project-related components
│   └── ui/               # shadcn/ui components
├── lib/                  # Utility functions and configurations
│   ├── constants.ts      # Application constants
│   ├── types.ts          # TypeScript type definitions
│   └── utils.ts          # Utility functions
└── prisma/               # Database schema and migrations
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio
- `npm run type-check` - Run TypeScript type checking

## 📋 Technical Documentation

- 📚 **Project Architecture**: See `Architecture.md` for detailed system overview
- 🖼️ **Media System**: See `MEDIA_SYSTEM_DOCUMENTATION.md` for comprehensive media management reference
- 🎨 **Media Configuration**: Read `MEDIA_CONFIGURATION.md` for upload setup
- 🔗 **Provider Setup**: See `MEDIA_PROVIDER_SETUP.md` for storage configuration
- 🔧 **Database Setup**: Check `docs/database-providers.md` for provider configuration
- 🤖 **AI Configuration**: See `docs/ai-configuration-guide.md` for AI setup and configuration
- 🔧 **AI Troubleshooting**: Check `docs/ai-troubleshooting.md` for common issues and solutions
- 🚀 **AI Deployment**: See `docs/ai-deployment-guide.md` for platform-specific deployment guides
- 📦 **AI Migration**: See `docs/ai-migration-guide.md` for upgrading from previous versions
- 🔌 **API Documentation**: Check `docs/api-documentation.md` for endpoint reference

## Environment Variables

### Required Variables

Copy `.env.example` to `.env.local` and configure the following:

#### Database Configuration
```bash
DATABASE_PROVIDER="supabase"  # or "vercel", "local"
DATABASE_URL="your-database-url"
DIRECT_URL="your-direct-database-url"  # For connection pooling
```

#### Authentication
```bash
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-secure-password"
```

#### AI Configuration (Optional)
```bash
# OpenAI Integration
OPENAI_API_KEY="sk-proj-..."  # Get from https://platform.openai.com/api-keys

# Anthropic Integration  
ANTHROPIC_API_KEY="sk-ant-api03-..."  # Get from https://console.anthropic.com/
```

**Note**: AI features are optional. The application will work without AI keys, but content editing assistance will be disabled.

#### Media & File Upload
```bash
UPLOAD_DIR="./public/uploads"
MAX_FILE_SIZE="52428800"  # 50MB in bytes
MEDIA_BASE_URL="http://localhost:3000"
```

### AI Configuration Guide

The AI system supports both OpenAI and Anthropic providers:

- **OpenAI**: Supports GPT-4, GPT-4 Turbo, and GPT-3.5 models
- **Anthropic**: Supports Claude 3.5 Sonnet, Claude 3.5 Haiku, and Claude 3 Opus

Configure available models in the admin interface at `/admin/ai-settings`.

For detailed AI setup instructions, see `docs/ai-configuration-guide.md`.

## License

MIT License - see LICENSE file for details.