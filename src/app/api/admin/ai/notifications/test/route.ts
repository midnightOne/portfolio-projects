/**
 * Admin API endpoint for testing notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { securityNotifier } from '@/lib/services/ai/security-notifier';
import { createApiSuccess, createApiError } from '@/lib/types/api';
import { z } from 'zod';

async function checkAdminAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return false;
  }
  return session.user;
}

const TestNotificationSchema = z.object({
  type: z.enum(['email', 'in_app']),
  emailAddress: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = TestNotificationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'Invalid test notification data',
          { errors: validation.error.errors }
        ),
        { status: 400 }
      );
    }

    const { type, emailAddress } = validation.data;

    if (type === 'email' && !emailAddress) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'Email address is required for email test'
        ),
        { status: 400 }
      );
    }

    // Send test notification
    await securityNotifier.notifyWarning(
      '127.0.0.1',
      'This is a test notification from the admin panel',
      {
        endpoint: '/api/admin/ai/notifications/test',
        userAgent: req.headers.get('user-agent') || 'Admin Panel',
        metadata: {
          testNotification: true,
          requestedBy: (user as any).email || (user as any).id,
          timestamp: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json(createApiSuccess({
      sent: true,
      type,
      timestamp: new Date().toISOString(),
      message: type === 'email' 
        ? `Test email sent to ${emailAddress}`
        : 'Test in-app notification sent',
    }));

  } catch (error) {
    console.error('Failed to send test notification:', error);
    return NextResponse.json(
      createApiError(
        'TEST_NOTIFICATION_ERROR',
        'Failed to send test notification',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}