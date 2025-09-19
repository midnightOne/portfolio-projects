/**
 * Admin API endpoints for notification configuration
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

const NotificationConfigSchema = z.object({
  enableEmailNotifications: z.boolean(),
  enableInAppNotifications: z.boolean(),
  emailAddress: z.string().email().optional(),
  notificationThreshold: z.enum(['all', 'medium', 'high']),
  batchNotifications: z.boolean(),
  batchIntervalMinutes: z.number().int().min(5).max(120),
  maxNotificationsPerHour: z.number().int().min(1).max(100),
});

export async function GET(req: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    const config = securityNotifier.getConfig();

    return NextResponse.json(createApiSuccess(config));

  } catch (error) {
    console.error('Failed to get notification config:', error);
    return NextResponse.json(
      createApiError(
        'CONFIG_GET_ERROR',
        'Failed to retrieve notification configuration',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await checkAdminAuth();
    if (!user) {
      return NextResponse.json(
        createApiError('UNAUTHORIZED', 'Admin access required'),
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = NotificationConfigSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'Invalid configuration data',
          { errors: validation.error.errors }
        ),
        { status: 400 }
      );
    }

    // Validate email address if email notifications are enabled
    if (validation.data.enableEmailNotifications && !validation.data.emailAddress) {
      return NextResponse.json(
        createApiError(
          'VALIDATION_ERROR',
          'Email address is required when email notifications are enabled'
        ),
        { status: 400 }
      );
    }

    // Update the security notifier configuration
    securityNotifier.updateConfig(validation.data);

    // In a real implementation, you might want to persist this to database
    // For now, the configuration is stored in memory

    return NextResponse.json(createApiSuccess({
      updated: true,
      config: securityNotifier.getConfig(),
    }));

  } catch (error) {
    console.error('Failed to update notification config:', error);
    return NextResponse.json(
      createApiError(
        'CONFIG_UPDATE_ERROR',
        'Failed to update notification configuration',
        undefined,
        req.nextUrl.pathname
      ),
      { status: 500 }
    );
  }
}