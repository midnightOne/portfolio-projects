/**
 * Database seeding script for portfolio projects
 */

import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create some tags
  const reactTag = await prisma.tag.upsert({
    where: { name: 'React' },
    update: {},
    create: {
      name: 'React',
      color: '#61DAFB',
    },
  });

  const typescriptTag = await prisma.tag.upsert({
    where: { name: 'TypeScript' },
    update: {},
    create: {
      name: 'TypeScript',
      color: '#3178C6',
    },
  });

  const nextjsTag = await prisma.tag.upsert({
    where: { name: 'Next.js' },
    update: {},
    create: {
      name: 'Next.js',
      color: '#000000',
    },
  });

  const webdevTag = await prisma.tag.upsert({
    where: { name: 'Web Development' },
    update: {},
    create: {
      name: 'Web Development',
      color: '#FF6B6B',
    },
  });

  // Create sample projects
  const project1 = await prisma.project.upsert({
    where: { slug: 'portfolio-website' },
    update: {},
    create: {
      title: 'Portfolio Website',
      slug: 'portfolio-website',
      description: 'A modern portfolio website built with Next.js and TypeScript, featuring a clean design and responsive layout.',
      briefOverview: 'Modern portfolio showcasing web development projects',
      workDate: new Date('2024-01-15'),
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      viewCount: 42,
      tags: {
        connect: [
          { id: reactTag.id },
          { id: typescriptTag.id },
          { id: nextjsTag.id },
          { id: webdevTag.id },
        ],
      },
    },
  });

  const project2 = await prisma.project.upsert({
    where: { slug: 'task-management-app' },
    update: {},
    create: {
      title: 'Task Management App',
      slug: 'task-management-app',
      description: 'A full-stack task management application with real-time updates, user authentication, and collaborative features.',
      briefOverview: 'Collaborative task management with real-time updates',
      workDate: new Date('2024-03-20'),
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      viewCount: 28,
      tags: {
        connect: [
          { id: reactTag.id },
          { id: typescriptTag.id },
          { id: nextjsTag.id },
        ],
      },
    },
  });

  const project3 = await prisma.project.upsert({
    where: { slug: 'e-commerce-platform' },
    update: {},
    create: {
      title: 'E-commerce Platform',
      slug: 'e-commerce-platform',
      description: 'A comprehensive e-commerce solution with payment processing, inventory management, and admin dashboard.',
      briefOverview: 'Full-featured e-commerce platform',
      workDate: new Date('2024-02-10'),
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      viewCount: 67,
      tags: {
        connect: [
          { id: reactTag.id },
          { id: typescriptTag.id },
          { id: webdevTag.id },
        ],
      },
    },
  });

  // Create some media items
  await prisma.mediaItem.create({
    data: {
      projectId: project1.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
      altText: 'Portfolio website screenshot',
      description: 'Homepage of the portfolio website',
      width: 1200,
      height: 800,
      displayOrder: 1,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project2.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400',
      altText: 'Task management app interface',
      description: 'Main dashboard of the task management application',
      width: 1200,
      height: 800,
      displayOrder: 1,
    },
  });

  // Create external links
  await prisma.externalLink.create({
    data: {
      projectId: project1.id,
      label: 'Live Demo',
      url: 'https://portfolio-demo.example.com',
      icon: 'external-link',
      description: 'View the live portfolio website',
      order: 1,
    },
  });

  await prisma.externalLink.create({
    data: {
      projectId: project1.id,
      label: 'GitHub Repository',
      url: 'https://github.com/example/portfolio',
      icon: 'github',
      description: 'Source code on GitHub',
      order: 2,
    },
  });

  // Create article content
  await prisma.articleContent.create({
    data: {
      projectId: project1.id,
      content: `# Portfolio Website Project

This portfolio website was built to showcase my web development skills and projects. The site features a modern, responsive design that works seamlessly across all devices.

## Key Features

- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Fast Performance**: Built with Next.js for optimal loading speeds
- **SEO Optimized**: Proper meta tags and structured data
- **Accessibility**: WCAG compliant design
- **Dark Mode**: Toggle between light and dark themes

## Technical Implementation

The website is built using modern web technologies:

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS for utility-first styling
- **Database**: PostgreSQL with Prisma ORM
- **Deployment**: Vercel for seamless CI/CD

## Challenges and Solutions

One of the main challenges was creating a flexible content management system that could handle different types of projects and media. I solved this by designing a robust database schema that supports various content types while maintaining performance.

## Results

The portfolio has received positive feedback and has helped me connect with potential clients and collaborators. The site loads quickly and provides an excellent user experience across all devices.`,
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log(`Created ${await prisma.tag.count()} tags`);
  console.log(`Created ${await prisma.project.count()} projects`);
  console.log(`Created ${await prisma.mediaItem.count()} media items`);
  console.log(`Created ${await prisma.externalLink.count()} external links`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });