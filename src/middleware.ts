import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Check if user is trying to access admin routes
    if (req.nextUrl.pathname.startsWith("/admin")) {
      // Allow access to login page
      if (req.nextUrl.pathname === "/admin/login") {
        return NextResponse.next();
      }
      
      // Check if user has admin role
      if (req.nextauth.token?.role !== "admin") {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }

    // Check if user is trying to access admin API routes
    if (req.nextUrl.pathname.startsWith("/api/admin")) {
      // Allow public read-only access to wave configuration (needed for homepage)
      if (req.nextUrl.pathname === "/api/admin/homepage/wave-config" && req.method === "GET") {
        return NextResponse.next();
      }
      
      if (req.nextauth.token?.role !== "admin") {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow public routes
        if (!req.nextUrl.pathname.startsWith("/admin") && 
            !req.nextUrl.pathname.startsWith("/api/admin")) {
          return true;
        }

        // Allow login page
        if (req.nextUrl.pathname === "/admin/login") {
          return true;
        }

        // Allow public read-only access to wave configuration (needed for homepage)
        if (req.nextUrl.pathname === "/api/admin/homepage/wave-config" && req.method === "GET") {
          return true;
        }

        // Require authentication for admin routes
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*"
  ]
};