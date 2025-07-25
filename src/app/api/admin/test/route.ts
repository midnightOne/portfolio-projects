import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-utils";

async function handler(request: NextRequest, session: any) {
  return NextResponse.json({
    message: "Admin access granted",
    user: session.user,
    timestamp: new Date().toISOString()
  });
}

export const GET = withAdmin(handler);
export const POST = withAdmin(handler);