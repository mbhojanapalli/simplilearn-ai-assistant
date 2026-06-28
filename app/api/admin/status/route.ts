import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminConfigured, verifySessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  return NextResponse.json({
    configured: isAdminConfigured(),
    authenticated: verifySessionToken(token),
  });
}
