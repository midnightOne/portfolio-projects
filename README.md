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

## Environment Variables

See `.env.example` for all required environment variables.

## License

MIT License - see LICENSE file for details.