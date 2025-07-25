/**
 * API utility functions for error handling and response formatting
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { createApiError } from '@/lib/types/api';

/**
 * Handle API errors and return appropriate responses
 */
export function handleApiError(error: unknown, request: NextRequest): NextResponse {
  console.error('API Error:', error);

  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json(
      createApiError(
        'VALIDATION_ERROR',
        'Invalid request data',
        error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
        request.url
      ),
      { status: 400 }
    );
  }

  // Prisma errors - check by error properties since types changed
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as any;
    switch (prismaError.code) {
      case 'P2002':
        return NextResponse.json(
          createApiError(
            'CONFLICT',
            'A record with this data already exists',
            { field: prismaError.meta?.target },
            request.url
          ),
          { status: 409 }
        );
      
      case 'P2025':
        return NextResponse.json(
          createApiError(
            'NOT_FOUND',
            'Record not found',
            undefined,
            request.url
          ),
          { status: 404 }
        );
      
      case 'P2003':
        return NextResponse.json(
          createApiError(
            'BAD_REQUEST',
            'Foreign key constraint failed',
            { field: prismaError.meta?.field_name },
            request.url
          ),
          { status: 400 }
        );
      
      default:
        return NextResponse.json(
          createApiError(
            'DATABASE_ERROR',
            'Database operation failed',
            process.env.NODE_ENV === 'development' ? prismaError.message : undefined,
            request.url
          ),
          { status: 500 }
        );
    }
  }

  // Database connection errors - check by error message pattern
  if (error && typeof error === 'object' && 'message' in error) {
    const errorMsg = (error as any).message;
    if (errorMsg?.includes('connect') || errorMsg?.includes('database')) {
      return NextResponse.json(
        createApiError(
          'DATABASE_CONNECTION_ERROR',
          'Failed to connect to database',
          process.env.NODE_ENV === 'development' ? errorMsg : undefined,
          request.url
        ),
        { status: 503 }
      );
    }
  }

  // Generic errors
  if (error instanceof Error) {
    return NextResponse.json(
      createApiError(
        'INTERNAL_ERROR',
        error.message || 'An unexpected error occurred',
        process.env.NODE_ENV === 'development' ? error.stack : undefined,
        request.url
      ),
      { status: 500 }
    );
  }

  // Unknown errors
  return NextResponse.json(
    createApiError(
      'UNKNOWN_ERROR',
      'An unknown error occurred',
      process.env.NODE_ENV === 'development' ? error : undefined,
      request.url
    ),
    { status: 500 }
  );
}

/**
 * Validate request method
 */
export function validateMethod(request: NextRequest, allowedMethods: string[]): NextResponse | null {
  if (!allowedMethods.includes(request.method)) {
    return NextResponse.json(
      createApiError(
        'METHOD_NOT_ALLOWED',
        `Method ${request.method} not allowed`,
        { allowedMethods },
        request.url
      ),
      { 
        status: 405,
        headers: {
          'Allow': allowedMethods.join(', ')
        }
      }
    );
  }
  return null;
}

/**
 * Parse JSON body with error handling
 */
export async function parseJsonBody<T = any>(request: NextRequest): Promise<T | null> {
  try {
    const body = await request.json();
    return body;
  } catch (error) {
    return null;
  }
}

/**
 * Extract client IP address
 */
export function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for') || 
         request.headers.get('x-real-ip') || 
         request.headers.get('cf-connecting-ip') ||
         undefined;
}

/**
 * Extract user agent
 */
export function getUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * Rate limiting helper (basic implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string, 
  limit: number = 100, 
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    // Create new record or reset expired one
    const resetTime = now + windowMs;
    rateLimitMap.set(identifier, { count: 1, resetTime });
    return { allowed: true, remaining: limit - 1, resetTime };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, resetTime: record.resetTime };
}

/**
 * CORS headers for API responses
 */
export function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(response: NextResponse): NextResponse {
  const corsHeaders = getCorsHeaders();
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}