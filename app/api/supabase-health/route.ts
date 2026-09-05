import { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { url, publishableKey } = getSupabasePublicConfig();
    const response = await fetch(`${url}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: publishableKey,
      },
      cache: "no-store",
    });

    return NextResponse.json(
      {
        configured: true,
        reachable: response.ok,
        status: response.status,
        projectHost: new URL(url).host,
      },
      { status: response.ok ? 200 : 502 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        configured: false,
        reachable: false,
        error: error instanceof Error ? error.message : "Unknown Supabase configuration error",
      },
      { status: 503 },
    );
  }
}
