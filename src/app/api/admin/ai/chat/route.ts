import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AIService } from '@/lib/services/ai/ai-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, message, conversationId, selectedText } = await request.json();

    if (!projectId || !message) {
      return NextResponse.json(
        { error: 'Project ID and message are required' },
        { status: 400 }
      );
    }

    // Get project with all relations for context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tags: true,
        mediaItems: true,
        articleContent: true,
        externalLinks: true,
        downloadableFiles: true,
        interactiveExamples: true,
        carousels: { include: { images: { include: { mediaItem: true } } } },
        thumbnailImage: true,
        metadataImage: true
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Build context
    const context = AIService.buildProjectContext(project as any, selectedText);

    // Get AI response
    const result = await AIService.chat(projectId, message, context, conversationId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in AI chat:', error);
    return NextResponse.json(
      { error: 'Failed to process AI chat request' },
      { status: 500 }
    );
  }
}