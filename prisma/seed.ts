/**
 * Database seed script for development
 * Creates sample projects, tags, and media items
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.projectAnalytics.deleteMany();
  await prisma.projectReference.deleteMany();
  await prisma.carouselImage.deleteMany();
  await prisma.mediaCarousel.deleteMany();
  await prisma.embeddedMedia.deleteMany();
  await prisma.articleContent.deleteMany();
  await prisma.interactiveExample.deleteMany();
  await prisma.downloadableFile.deleteMany();
  await prisma.externalLink.deleteMany();
  await prisma.mediaItem.deleteMany();
  await prisma.project.deleteMany();
  await prisma.tag.deleteMany();

  // Create tags
  console.log('Creating tags...');
  const tags = await Promise.all([
    prisma.tag.create({
      data: { name: 'React', color: '#61DAFB' },
    }),
    prisma.tag.create({
      data: { name: 'TypeScript', color: '#3178C6' },
    }),
    prisma.tag.create({
      data: { name: 'Next.js', color: '#000000' },
    }),
    prisma.tag.create({
      data: { name: 'WebXR', color: '#FF6B6B' },
    }),
    prisma.tag.create({
      data: { name: 'AI', color: '#4ECDC4' },
    }),
    prisma.tag.create({
      data: { name: 'Game', color: '#45B7D1' },
    }),
    prisma.tag.create({
      data: { name: '3D', color: '#96CEB4' },
    }),
    prisma.tag.create({
      data: { name: '2D', color: '#FFEAA7' },
    }),
    prisma.tag.create({
      data: { name: 'Mobile', color: '#DDA0DD' },
    }),
    prisma.tag.create({
      data: { name: 'Web', color: '#98D8C8' },
    }),
  ]);

  // Create media items
  console.log('Creating media items...');
  const mediaItems = await Promise.all([
    prisma.mediaItem.create({
      data: {
        type: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=600',
        thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=300',
        altText: 'Modern web development setup',
        description: 'A clean development workspace',
        width: 800,
        height: 600,
        fileSize: BigInt(150000),
      },
    }),
    prisma.mediaItem.create({
      data: {
        type: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600',
        thumbnailUrl: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400&h=300',
        altText: 'Mobile app interface',
        description: 'Sleek mobile application design',
        width: 800,
        height: 600,
        fileSize: BigInt(120000),
      },
    }),
    prisma.mediaItem.create({
      data: {
        type: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=300',
        altText: '3D visualization',
        description: 'Interactive 3D graphics demonstration',
        width: 800,
        height: 600,
        fileSize: BigInt(200000),
      },
    }),
  ]);

  // Create projects
  console.log('Creating projects...');
  const projects = await Promise.all([
    prisma.project.create({
      data: {
        title: 'Portfolio Website',
        slug: 'portfolio-website',
        description: 'A modern, responsive portfolio website built with Next.js and TypeScript. Features include project showcases, interactive galleries, and a content management system.',
        briefOverview: 'Modern portfolio website with CMS capabilities',
        workDate: new Date('2024-01-15'),
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        viewCount: 150,
        thumbnailImageId: mediaItems[0].id,
        metadataImageId: mediaItems[0].id,
        tags: {
          connect: [
            { id: tags[0].id }, // React
            { id: tags[1].id }, // TypeScript
            { id: tags[2].id }, // Next.js
            { id: tags[9].id }, // Web
          ],
        },
      },
    }),
    prisma.project.create({
      data: {
        title: 'AR Mobile Game',
        slug: 'ar-mobile-game',
        description: 'An augmented reality mobile game that combines real-world environments with virtual gameplay elements. Built using Unity and ARCore/ARKit.',
        briefOverview: 'Immersive AR gaming experience for mobile devices',
        workDate: new Date('2023-11-20'),
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        viewCount: 89,
        thumbnailImageId: mediaItems[1].id,
        metadataImageId: mediaItems[1].id,
        tags: {
          connect: [
            { id: tags[3].id }, // WebXR
            { id: tags[5].id }, // Game
            { id: tags[6].id }, // 3D
            { id: tags[8].id }, // Mobile
          ],
        },
      },
    }),
    prisma.project.create({
      data: {
        title: 'AI Data Visualization',
        slug: 'ai-data-visualization',
        description: 'Interactive data visualization platform powered by machine learning algorithms. Provides real-time insights and predictive analytics through intuitive charts and graphs.',
        briefOverview: 'ML-powered data visualization and analytics platform',
        workDate: new Date('2024-03-10'),
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        viewCount: 234,
        thumbnailImageId: mediaItems[2].id,
        metadataImageId: mediaItems[2].id,
        tags: {
          connect: [
            { id: tags[4].id }, // AI
            { id: tags[0].id }, // React
            { id: tags[1].id }, // TypeScript
            { id: tags[9].id }, // Web
          ],
        },
      },
    }),
    prisma.project.create({
      data: {
        title: 'WebXR Experience',
        slug: 'webxr-experience',
        description: 'An immersive WebXR experience that showcases virtual reality capabilities directly in the browser. Features spatial audio, hand tracking, and interactive 3D environments.',
        briefOverview: 'Browser-based VR experience with hand tracking',
        workDate: new Date('2023-09-05'),
        status: 'DRAFT',
        visibility: 'PRIVATE',
        viewCount: 12,
        tags: {
          connect: [
            { id: tags[3].id }, // WebXR
            { id: tags[6].id }, // 3D
            { id: tags[9].id }, // Web
          ],
        },
      },
    }),
  ]);

  // Create article content
  console.log('Creating article content...');
  await Promise.all([
    prisma.articleContent.create({
      data: {
        projectId: projects[0].id,
        content: `# Portfolio Website Development

This project represents a comprehensive approach to modern web development, combining cutting-edge technologies with thoughtful user experience design.

## Technical Implementation

The website is built using **Next.js 14** with the App Router, providing server-side rendering for optimal SEO performance. TypeScript ensures type safety throughout the codebase, while Tailwind CSS enables rapid, consistent styling.

### Key Features

- **Responsive Design**: Mobile-first approach ensuring perfect display across all devices
- **Performance Optimized**: Lazy loading, image optimization, and efficient bundling
- **Content Management**: Admin interface for easy project management
- **Search Functionality**: Full-text search with real-time filtering

## Development Process

The development followed a systematic approach:

1. **Planning & Design**: User research and wireframing
2. **Architecture**: Database design and API structure
3. **Implementation**: Component development and testing
4. **Optimization**: Performance tuning and accessibility improvements

The result is a fast, accessible, and maintainable portfolio platform that showcases work effectively while providing an excellent user experience.`,
      },
    }),
    prisma.articleContent.create({
      data: {
        projectId: projects[1].id,
        content: `# AR Mobile Game Development

Creating an augmented reality mobile game presents unique challenges and opportunities in modern game development.

## Game Concept

The game blends physical and virtual worlds, allowing players to interact with digital objects placed in their real environment. Using advanced computer vision and spatial tracking, the game creates believable AR experiences.

### Technical Challenges

- **Spatial Tracking**: Accurate world tracking across different lighting conditions
- **Performance**: Maintaining 60fps while processing camera feed and rendering 3D graphics
- **Cross-Platform**: Supporting both iOS (ARKit) and Android (ARCore)

## Implementation Details

Built with Unity 2023.1 and AR Foundation, the game leverages:

- **Plane Detection**: Identifying surfaces for object placement
- **Light Estimation**: Matching virtual lighting to real environment
- **Occlusion**: Realistic interaction between virtual and real objects

The game has been tested across 15+ device models and achieves consistent performance on mid-range and high-end smartphones.`,
      },
    }),
  ]);

  // Create external links
  console.log('Creating external links...');
  await Promise.all([
    prisma.externalLink.create({
      data: {
        projectId: projects[0].id,
        label: 'Live Demo',
        url: 'https://portfolio-demo.example.com',
        icon: 'external-link',
        description: 'View the live website',
        order: 1,
      },
    }),
    prisma.externalLink.create({
      data: {
        projectId: projects[0].id,
        label: 'GitHub',
        url: 'https://github.com/example/portfolio',
        icon: 'github',
        description: 'Source code repository',
        order: 2,
      },
    }),
    prisma.externalLink.create({
      data: {
        projectId: projects[1].id,
        label: 'App Store',
        url: 'https://apps.apple.com/app/ar-game',
        icon: 'smartphone',
        description: 'Download for iOS',
        order: 1,
      },
    }),
  ]);

  // Create downloadable files
  console.log('Creating downloadable files...');
  await Promise.all([
    prisma.downloadableFile.create({
      data: {
        projectId: projects[1].id,
        filename: 'ar-game-v1.2.apk',
        originalName: 'AR Game v1.2.apk',
        fileType: 'application/vnd.android.package-archive',
        fileSize: BigInt(45000000), // 45MB
        downloadUrl: 'https://example.com/downloads/ar-game-v1.2.apk',
        description: 'Android APK file for direct installation',
      },
    }),
    prisma.downloadableFile.create({
      data: {
        projectId: projects[2].id,
        filename: 'data-viz-demo.zip',
        originalName: 'Data Visualization Demo.zip',
        fileType: 'application/zip',
        fileSize: BigInt(12000000), // 12MB
        downloadUrl: 'https://example.com/downloads/data-viz-demo.zip',
        description: 'Demo dataset and configuration files',
      },
    }),
  ]);

  // Create interactive examples
  console.log('Creating interactive examples...');
  await prisma.interactiveExample.create({
    data: {
      projectId: projects[3].id,
      type: 'WEBXR',
      title: 'VR Environment Preview',
      description: 'Experience the virtual environment in your browser',
      url: 'https://example.com/webxr-demo',
      fallbackContent: 'WebXR not supported on this device. Please use a VR-capable browser.',
      securitySettings: {
        allowFullscreen: true,
        allowVR: true,
        sandbox: ['allow-scripts', 'allow-same-origin'],
      },
      displayOrder: 1,
    },
  });

  // Create project analytics
  console.log('Creating analytics data...');
  const analyticsData = [];
  for (const project of projects) {
    // Generate view events over the past 30 days
    for (let i = 0; i < project.viewCount; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const timestamp = new Date();
      timestamp.setDate(timestamp.getDate() - daysAgo);
      
      analyticsData.push({
        projectId: project.id,
        event: 'VIEW' as const,
        timestamp,
        userAgent: 'Mozilla/5.0 (compatible; SeedBot/1.0)',
      });
    }
  }

  await prisma.projectAnalytics.createMany({
    data: analyticsData,
  });

  console.log('\n✅ Database seeded successfully!');
  console.log(`Created:`);
  console.log(`  - ${tags.length} tags`);
  console.log(`  - ${mediaItems.length} media items`);
  console.log(`  - ${projects.length} projects`);
  console.log(`  - ${analyticsData.length} analytics events`);
  console.log(`\nYou can now run "npm run dev" to start the development server.`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });