import { NextResponse } from "next/server";
import { supabaseAdminFetch } from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";

export async function GET() {
  const secretConfigured = Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
  const pepperConfigured = Boolean(
    process.env.ASHA_PIN_PEPPER?.trim() &&
      (process.env.ASHA_PIN_PEPPER?.trim().length ?? 0) >= 32,
  );

  try {
    const response = await supabaseAdminFetch(
      "/rest/v1/profiles?select=id&limit=1",
      { headers: { Accept: "application/json" } },
    );

    return NextResponse.json(
      {
        ok: response.ok && secretConfigured && pepperConfigured,
        secretConfigured,
        pepperConfigured,
        supabaseAdminReachable: response.ok,
        status: response.status,
      },
      {
        status:
          response.ok && secretConfigured && pepperConfigured ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        secretConfigured,
        pepperConfigured,
        supabaseAdminReachable: false,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
