import { NextResponse } from "next/server";
import { readJsonSafe, supabaseAuthFetch } from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { refreshToken?: unknown };
    const refreshToken =
      typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";

    if (!refreshToken) {
      return NextResponse.json(
        { ok: false, error: "Sesión inválida." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const response = await supabaseAuthFetch(
      "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "La sesión ha expirado." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const session = await readJsonSafe(response);
    return NextResponse.json(
      {
        ok: true,
        session: {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresIn: session.expires_in,
          tokenType: session.token_type,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("ASHA refresh error", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo renovar la sesión." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
