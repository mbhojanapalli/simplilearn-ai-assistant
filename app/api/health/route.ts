import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Surfaces which integrations are configured — never returns secret values. */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    services: {
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      vector:
        Boolean(process.env.UPSTASH_VECTOR_REST_URL) &&
        Boolean(process.env.UPSTASH_VECTOR_REST_TOKEN),
      admin: Boolean(process.env.ADMIN_PASSWORD),
    },
    time: new Date().toISOString(),
  });
}
