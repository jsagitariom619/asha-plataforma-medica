import { NextResponse } from "next/server";
import { getSupabaseServerConfig, supabaseAdminFetch } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { url } = getSupabaseServerConfig();
    const response = await supabaseAdminFetch("/auth/v1/admin/users?page=1&per_page=1", {
      method: "GET",
    });

    return NextResponse.json(
      {
        ok: response.ok,
        configured: true,
        adminApiReachable: response.ok,
        status: response.status,
        projectHost: new URL(url).host,
      },
      { status: response.ok ? 200 : 502 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        adminApiReachable: false,
        error: error instanceof Error ? error.message : "Unknown ASHA auth configuration error",
      },
      { status: 503 },
    );
  }
}
