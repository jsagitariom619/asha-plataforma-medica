import { NextResponse } from "next/server";
import { supabaseAdminFetch } from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await supabaseAdminFetch(
      "/rest/v1/profiles?select=id&is_primary_admin=eq.true&is_active=eq.true&limit=1",
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "No se pudo comprobar el estado de configuración." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const profiles = (await response.json()) as Array<{ id: string }>;

    return NextResponse.json(
      { ok: true, configured: profiles.length > 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("ASHA bootstrap status error", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo comprobar el estado de configuración." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
