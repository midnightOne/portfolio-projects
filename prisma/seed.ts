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

  // Create diverse media items for testing inline media functionality
  
  // Project 1 Media Items (Portfolio Website)
  await prisma.mediaItem.create({
    data: {
      projectId: project1.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
      altText: 'Portfolio website homepage',
      description: 'The main landing page featuring a clean, modern design with smooth animations and responsive layout.',
      width: 1200,
      height: 800,
      displayOrder: 1,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project1.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400',
      altText: 'Portfolio analytics dashboard',
      description: 'Built-in analytics showing visitor engagement and project views with interactive charts.',
      width: 1200,
      height: 600,
      displayOrder: 2,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project1.id,
      type: 'GIF',
      url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExYjV0d2syczNjZWlxbWE4dm15cXRscnllNXFrZm5wcGhnN3Nqa3l1eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26tn33aiTi1jkl6H6/giphy.gif',
      altText: 'Interactive navigation animation',
      description: 'Smooth hover animations and transitions throughout the navigation system.',
      width: 480,
      height: 270,
      displayOrder: 3,
    },
  });

  // Project 2 Media Items (Task Management App)
  await prisma.mediaItem.create({
    data: {
      projectId: project2.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400',
      altText: 'Task management dashboard',
      description: 'The main dashboard showing active projects, task progress, and team collaboration features.',
      width: 1200,
      height: 800,
      displayOrder: 1,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project2.id,
      type: 'VIDEO',
      url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400',
      altText: 'Task management demo video',
      description: 'Live demonstration of creating tasks, assigning team members, and tracking progress in real-time.',
      width: 1280,
      height: 720,
      displayOrder: 2,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project2.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=400',
      altText: 'Mobile app interface',
      description: 'Responsive design adapting seamlessly to mobile devices with touch-friendly interactions.',
      width: 800,
      height: 1200,
      displayOrder: 3,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project2.id,
      type: 'GIF',
      url: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHI4eWhoa2piN2E4dGZhc2RoOGVkb3cybGQycjZwdnkydm1qbHVvYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPEqDGUULpEU0aQ/giphy.gif',
      altText: 'Real-time collaboration',
      description: 'Live updates showing multiple users collaborating on tasks simultaneously.',
      width: 500,
      height: 281,
      displayOrder: 4,
    },
  });

  // Project 3 Media Items (E-commerce Platform)
  await prisma.mediaItem.create({
    data: {
      projectId: project3.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400',
      altText: 'E-commerce storefront',
      description: 'Modern product catalog with advanced filtering, search functionality, and intuitive navigation.',
      width: 1200,
      height: 800,
      displayOrder: 1,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project3.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400',
      altText: 'Shopping cart and checkout',
      description: 'Streamlined checkout process with secure payment integration and order tracking.',
      width: 1200,
      height: 800,
      displayOrder: 2,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project3.id,
      type: 'WEBM',
      url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm',
      thumbnailUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400',
      altText: 'Admin dashboard demo',
      description: 'Complete walkthrough of the admin dashboard featuring inventory management, order processing, and analytics.',
      width: 854,
      height: 480,
      displayOrder: 3,
    },
  });

  await prisma.mediaItem.create({
    data: {
      projectId: project3.id,
      type: 'IMAGE',
      url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
      altText: 'Payment processing interface',
      description: 'Secure payment gateway integration supporting multiple payment methods and currencies.',
      width: 1200,
      height: 600,
      displayOrder: 4,
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

  // Create comprehensive article content for all projects
  await prisma.articleContent.upsert({
    where: { projectId: project1.id },
    update: {},
    create: {
      projectId: project1.id,
      content: `# Portfolio Website Project

This portfolio website was built to showcase my web development skills and projects. The site features a modern, responsive design that works seamlessly across all devices.

## Design Philosophy

The design focuses on simplicity and user experience. Clean lines, thoughtful typography, and strategic use of whitespace create an engaging and professional presentation.

## Key Features

- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Fast Performance**: Built with Next.js for optimal loading speeds
- **SEO Optimized**: Proper meta tags and structured data
- **Accessibility**: WCAG compliant design
- **Dark Mode**: Toggle between light and dark themes
- **Interactive Animations**: Smooth hover effects and page transitions

## Technical Implementation

The website is built using modern web technologies:

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS for utility-first styling
- **Database**: PostgreSQL with Prisma ORM
- **Deployment**: Vercel for seamless CI/CD
- **Analytics**: Real-time visitor tracking and engagement metrics

## Development Process

The development followed an iterative approach with continuous testing and refinement. User feedback was incorporated throughout the process to ensure optimal usability.

## Performance Optimization

Special attention was paid to performance optimization, resulting in excellent Core Web Vitals scores and fast loading times across all devices.

## Results and Impact

The portfolio has received positive feedback and has helped me connect with potential clients and collaborators. The site loads quickly and provides an excellent user experience across all devices.`,
    },
  });

  await prisma.articleContent.upsert({
    where: { projectId: project2.id },
    update: {},
    create: {
      projectId: project2.id,
      content: `# Task Management Application

A comprehensive task management solution designed for modern teams who need to collaborate effectively and track project progress in real-time.

## Project Overview

The application addresses common pain points in team collaboration by providing an intuitive interface for task creation, assignment, and tracking. Real-time updates ensure team members stay synchronized.

## Core Functionality

### Task Management
- Create, edit, and delete tasks with rich descriptions
- Set priorities, due dates, and assign team members
- Track task progress with customizable status workflows
- Add comments and attachments to tasks

### Real-Time Collaboration
- Live updates across all connected devices
- Instant notifications for task changes
- Team chat integration for quick discussions
- Activity feeds showing recent project updates

### Project Organization
- Organize tasks into projects and categories
- Custom project templates for recurring workflows
- Advanced filtering and search capabilities
- Kanban boards and list views

## Technical Architecture

The application is built with a modern tech stack emphasizing performance and scalability:

- **Frontend**: React with TypeScript and Redux for state management
- **Backend**: Node.js with Express and WebSocket for real-time features
- **Database**: PostgreSQL with optimized queries for large datasets
- **Authentication**: JWT-based authentication with role-based permissions
- **Real-time**: Socket.io for instant updates and notifications

## User Experience Design

The interface prioritizes usability with drag-and-drop functionality, keyboard shortcuts, and responsive design. Extensive user testing informed design decisions throughout development.

## Deployment and DevOps

The application uses Docker containers with automated CI/CD pipelines, ensuring reliable deployments and easy scaling as team size grows.

## Results and Metrics

Since launch, the application has facilitated thousands of completed tasks and improved team productivity by an average of 30% according to user feedback surveys.`,
    },
  });

  await prisma.articleContent.upsert({
    where: { projectId: project3.id },
    update: {},
    create: {
      projectId: project3.id,
      content: `# E-commerce Platform

A full-featured e-commerce solution built to handle everything from product catalog management to payment processing and order fulfillment.

## Business Requirements

The platform was designed to serve medium to large-scale businesses with complex product catalogs, multiple payment methods, and international shipping requirements.

## Feature Highlights

### Product Management
- Advanced product catalog with variants and options
- Inventory tracking with low-stock alerts
- Bulk import/export capabilities
- SEO-optimized product pages
- Dynamic pricing rules and discounts

### Shopping Experience
- Intelligent search with filters and sorting
- Personalized product recommendations
- Wishlist and comparison features
- Guest checkout and account registration
- Mobile-optimized shopping experience

### Payment Processing
- Multiple payment gateway integrations
- Secure tokenization for stored payment methods
- Support for multiple currencies
- Subscription and recurring payment handling
- Comprehensive fraud detection

## Administrative Dashboard

The admin interface provides comprehensive tools for managing every aspect of the e-commerce operation:

### Order Management
- Order processing workflow with status tracking
- Inventory management with automatic updates
- Shipping label generation and tracking
- Return and refund processing
- Customer service tools

### Analytics and Reporting
- Sales performance dashboards
- Customer behavior analytics
- Inventory turnover reports
- Revenue forecasting tools
- Custom report generation

## Technical Infrastructure

### Backend Architecture
- Microservices architecture for scalability
- RESTful APIs with comprehensive documentation
- Database optimization for high-traffic scenarios
- Redis caching for improved performance
- Automated backup and disaster recovery

### Security Implementation
- PCI DSS compliance for payment processing
- SSL/TLS encryption throughout
- Regular security audits and penetration testing
- GDPR compliance for data protection
- Rate limiting and DDoS protection

## Performance and Scalability

The platform is designed to handle high traffic volumes with auto-scaling infrastructure and optimized database queries. Load testing confirmed the system can handle Black Friday-level traffic spikes.

## Integration Capabilities

The platform integrates with popular business tools including CRM systems, email marketing platforms, accounting software, and shipping providers.

## Results and Business Impact

The platform has processed over $2M in transactions in its first year, with 99.9% uptime and consistently positive user feedback regarding performance and ease of use.`,
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