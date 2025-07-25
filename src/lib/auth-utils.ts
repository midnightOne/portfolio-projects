import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Get the current session on the server side
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session?.user;
}

/**
 * Check if the current user has admin role
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return (session?.user as any)?.role === "admin";
}

/**
 * Require authentication for API routes
 * Returns the session if authenticated, otherwise returns an error response
 */
export async function requireAuth(request: NextRequest) {
  const session = await getSession();
  
  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    };
  }

  return { session };
}

/**
 * Require admin role for API routes
 * Returns the session if user is admin, otherwise returns an error response
 */
export async function requireAdmin(request: NextRequest) {
  const session = await getSession();
  
  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    };
  }

  if ((session.user as any)?.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    };
  }

  return { session };
}

/**
 * Utility to protect API routes with authentication
 */
export function withAuth(handler: (request: NextRequest, session: any) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const authResult = await requireAuth(request);
    
    if (authResult.error) {
      return authResult.error;
    }

    return handler(request, authResult.session);
  };
}

/**
 * Utility to protect API routes with admin role requirement
 */
export function withAdmin(handler: (request: NextRequest, session: any) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const authResult = await requireAdmin(request);
    
    if (authResult.error) {
      return authResult.error;
    }

    return handler(request, authResult.session);
  };
}