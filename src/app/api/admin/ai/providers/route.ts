import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AIServiceFactory } from '@/lib/services/ai/providers';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const providers = AIServiceFactory.getAvailableProviders();
    return NextResponse.json(providers);
  } catch (error) {
    console.error('Error fetching AI providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI providers' },
      { status: 500 }
    );
  }
}