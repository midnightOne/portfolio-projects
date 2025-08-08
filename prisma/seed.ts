/**
 * Database seeding script for portfolio projects
 */

import { PrismaClient } from '@prisma/client';
// Novel converter removed - using plain text content for now

const prisma = new PrismaClient();

// Helper function to convert markdown-like text to Tiptap JSON
function convertToTiptapJSON(text: string) {
  return {
    type: 'doc',
    content: text.split('\n\n').filter(p => p.trim()).map(paragraph => {
      if (paragraph.startsWith('# ')) {
        return {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: paragraph.replace('# ', '') }]
        };
      } else if (paragraph.startsWith('## ')) {
        return {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: paragraph.replace('## ', '') }]
        };
      } else if (paragraph.startsWith('### ')) {
        return {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: paragraph.replace('### ', '') }]
        };
      } else if (paragraph.startsWith('> ')) {
        return {
          type: 'blockquote',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: paragraph.replace('> ', '') }]
          }]
        };
      } else if (paragraph.startsWith('```')) {
        // Handle code blocks
        const lines = paragraph.split('\n');
        const codeContent = lines.slice(1, -1).join('\n');
        return {
          type: 'codeBlock',
          content: [{ type: 'text', text: codeContent }]
        };
      } else if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
        // Handle bullet lists
        const items = paragraph.split('\n').filter(line => line.startsWith('- ') || line.startsWith('* '));
        return {
          type: 'bulletList',
          content: items.map(item => ({
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: item.replace(/^[*-] /, '') }]
            }]
          }))
        };
      } else {
        // Handle basic formatting in paragraphs
        const content = [];
        const parts = paragraph.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|~~.*?~~)/);
        
        for (const part of parts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            content.push({
              type: 'text',
              text: part.slice(2, -2),
              marks: [{ type: 'bold' }]
            });
          } else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
            content.push({
              type: 'text',
              text: part.slice(1, -1),
              marks: [{ type: 'italic' }]
            });
          } else if (part.startsWith('`') && part.endsWith('`')) {
            content.push({
              type: 'text',
              text: part.slice(1, -1),
              marks: [{ type: 'code' }]
            });
          } else if (part.startsWith('~~') && part.endsWith('~~')) {
            content.push({
              type: 'text',
              text: part.slice(2, -2),
              marks: [{ type: 'strike' }]
            });
          } else if (part.trim()) {
            content.push({
              type: 'text',
              text: part
            });
          }
        }
        
        return {
          type: 'paragraph',
          content: content.length > 0 ? content : [{ type: 'text', text: paragraph }]
        };
      }
    })
  };
}

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

  // Create comprehensive article content for all projects showcasing Novel editor features
  const project1ArticleText = `# Portfolio Website Project

This portfolio website was built to showcase my web development skills and projects. The site features a **modern, responsive design** that works seamlessly across all devices.

## Design Philosophy

The design focuses on *simplicity* and user experience. Clean lines, thoughtful typography, and strategic use of whitespace create an engaging and professional presentation.

> "Good design is not just what it looks like and feels like. Good design is how it works." - Steve Jobs

## Key Features

- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Fast Performance**: Built with Next.js for optimal loading speeds  
- **SEO Optimized**: Proper meta tags and structured data
- **Accessibility**: WCAG compliant design
- ~~Dark Mode~~: Toggle between light and dark themes
- **Interactive Animations**: Smooth hover effects and page transitions

## Technical Implementation

The website is built using modern web technologies:

1. **Frontend**: Next.js 14 with TypeScript
2. **Styling**: Tailwind CSS for utility-first styling
3. **Database**: PostgreSQL with Prisma ORM
4. **Deployment**: Vercel for seamless CI/CD
5. **Analytics**: Real-time visitor tracking and engagement metrics

### Code Example

Here's a sample component from the project:

\`\`\`typescript
export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg">
      <div className="aspect-video overflow-hidden">
        <Image
          src={project.thumbnailUrl}
          alt={project.title}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900">{project.title}</h3>
        <p className="mt-1 text-sm text-gray-600">{project.description}</p>
      </div>
    </div>
  );
}
\`\`\`

---

## Development Process

The development followed an iterative approach:

1. **Planning & Research**: Understanding user needs and competitive analysis
2. **Design & Prototyping**: Creating wireframes and visual designs
3. **Development**: Building features incrementally with testing
4. **Testing & Refinement**: User feedback and performance optimization
5. **Deployment & Monitoring**: Production deployment with analytics

## Performance Optimization

Special attention was paid to performance optimization, resulting in excellent Core Web Vitals scores and fast loading times across all devices.

**Performance Metrics:**
- Lighthouse Score: 98/100
- First Contentful Paint: < 1.2s
- Largest Contentful Paint: < 2.5s

## Links & Resources

- [Live Demo](https://portfolio-demo.example.com)
- [GitHub Repository](https://github.com/example/portfolio)
- [Design System](https://design.example.com)

## Results and Impact

The portfolio has received positive feedback and has helped me connect with potential clients and collaborators. The site loads quickly and provides an excellent user experience across all devices.`;

  await prisma.articleContent.upsert({
    where: { projectId: project1.id },
    update: {},
    create: {
      projectId: project1.id,
      content: project1ArticleText,
      jsonContent: convertToTiptapJSON(project1ArticleText),
      contentType: 'json',
    },
  });

  const project2ArticleText = `# Task Management Application

A **comprehensive task management solution** designed for modern teams who need to collaborate effectively and track project progress in *real-time*.

## Project Overview

The application addresses common pain points in team collaboration by providing an intuitive interface for task creation, assignment, and tracking. Real-time updates ensure team members stay synchronized.

> "The best way to get something done is to begin." - This app makes beginning (and finishing) easier than ever.

## Core Functionality

### Task Management Features
- **Create, edit, and delete** tasks with rich descriptions
- Set priorities, due dates, and assign team members
- Track task progress with *customizable status workflows*
- Add \`comments\` and attachments to tasks
- ~~Manual status updates~~ **Automatic progress tracking**

### Real-Time Collaboration
- Live updates across all connected devices
- Instant notifications for task changes  
- Team chat integration for quick discussions
- Activity feeds showing recent project updates

### Project Organization

The system supports multiple organizational patterns:

1. **Project-based structure**: Group tasks by project
2. **Team-based organization**: Assign tasks to specific teams
3. **Priority-based sorting**: Focus on high-impact work
4. **Timeline management**: Track deadlines and milestones

## Technical Architecture

The application is built with a modern tech stack emphasizing performance and scalability:

### Frontend Technologies
- **React 18** with TypeScript for type safety
- **Redux Toolkit** for predictable state management
- **React Query** for server state synchronization
- **Tailwind CSS** for responsive styling

### Backend Infrastructure  
- **Node.js** with Express framework
- **WebSocket** connections for real-time features
- **PostgreSQL** with optimized queries for large datasets
- **Redis** for session management and caching

### Authentication & Security
\`\`\`typescript
// JWT token validation middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.sendStatus(401);
  }
  
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};
\`\`\`

---

## User Experience Design

The interface prioritizes usability with:
- Drag-and-drop functionality
- Keyboard shortcuts for power users
- Responsive design for mobile and desktop
- Dark mode support

**Accessibility Features:**
- Screen reader compatibility
- High contrast mode
- Keyboard navigation
- ARIA labels and descriptions

## Deployment Pipeline

The application uses **Docker containers** with automated CI/CD pipelines:

1. **Code commit** triggers automated tests
2. **Test suite** runs unit and integration tests
3. **Build process** creates optimized production bundle
4. **Deployment** to staging environment for QA
5. **Production release** with zero-downtime deployment

## Performance Metrics

Since launch, the application has achieved impressive results:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Task completion rate | 65% | 89% | +24% |
| Team productivity | Baseline | +30% | 30% increase |
| User satisfaction | 3.2/5 | 4.7/5 | +47% |

## Links & Documentation

- [Live Application](https://taskmanager-demo.example.com)
- [API Documentation](https://docs.taskmanager.example.com)
- [GitHub Repository](https://github.com/example/task-manager)

The application continues to evolve based on user feedback, with new features and improvements released monthly.`;

  await prisma.articleContent.upsert({
    where: { projectId: project2.id },
    update: {},
    create: {
      projectId: project2.id,
      content: project2ArticleText,
      jsonContent: convertToTiptapJSON(project2ArticleText),
      contentType: 'json',
    },
  });

  const project3ArticleText = `# E-commerce Platform

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

The platform has processed over $2M in transactions in its first year, with 99.9% uptime and consistently positive user feedback regarding performance and ease of use.`;

  await prisma.articleContent.upsert({
    where: { projectId: project3.id },
    update: {},
    create: {
      projectId: project3.id,
      content: project3ArticleText,
      jsonContent: convertToTiptapJSON(project3ArticleText),
      contentType: 'json',
    },
  });

  // Create default AI configuration
  await prisma.aIModelConfig.upsert({
    where: { provider: 'openai' },
    update: {},
    create: {
      provider: 'openai',
      models: 'gpt-4o,gpt-4o-mini,gpt-3.5-turbo',
    },
  });

  await prisma.aIModelConfig.upsert({
    where: { provider: 'anthropic' },
    update: {},
    create: {
      provider: 'anthropic',
      models: 'claude-3-5-sonnet-20241022,claude-3-5-haiku-20241022',
    },
  });

  await prisma.aIGeneralSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      defaultProvider: 'openai',
      systemPrompt: 'You are an expert content editor for portfolio projects. Help improve and edit project content while maintaining the author\'s voice and style.',
      temperature: 0.7,
      maxTokens: 4000,
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log(`Created ${await prisma.tag.count()} tags`);
  console.log(`Created ${await prisma.project.count()} projects`);
  console.log(`Created ${await prisma.mediaItem.count()} media items`);
  console.log(`Created ${await prisma.externalLink.count()} external links`);
  console.log(`Created ${await prisma.aIModelConfig.count()} AI model configurations`);
  console.log(`Created ${await prisma.aIGeneralSettings.count()} AI general settings`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });