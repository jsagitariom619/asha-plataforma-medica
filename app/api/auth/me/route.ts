import { NextResponse } from "next/server";
import { getAuthenticatedUser, readAccessToken } from "@/lib/auth/session";
import { supabaseUserFetch } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const accessToken = await readAccessToken();
    if (!user || !accessToken) {
      return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
    }

    const profileResponse = await supabaseUserFetch(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,username,full_name,role,is_active,is_primary_admin&limit=1`,
      accessToken,
      { method: "GET" },
    );
    if (!profileResponse.ok) {
      return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
    }

    const profiles = (await profileResponse.json()) as Array<{
      id: string;
      username: string | null;
      full_name: string;
      role: string;
      is_active: boolean;
      is_primary_admin: boolean;
    }>;
    const profile = profiles[0];
    if (!profile?.is_active) {
      return NextResponse.json({ ok: false, authenticated: false }, { status: 403 });
    }

    const permissionsResponse = await supabaseUserFetch(
      `/rest/v1/user_permissions?user_id=eq.${encodeURIComponent(user.id)}&allowed=eq.true&select=module`,
      accessToken,
      { method: "GET" },
    );
    const permissions = permissionsResponse.ok
      ? ((await permissionsResponse.json()) as Array<{ module: string }>).map((item) => item.module)
      : [];

    return NextResponse.json({
      ok: true,
      authenticated: true,
      user: {
        id: profile.id,
        username: profile.username,
        name: profile.full_name,
        role: profile.role,
        active: profile.is_active,
        isPrimaryAdmin: profile.is_primary_admin,
        permissions,
      },
    });
  } catch (error) {
    console.error("ASHA auth session check failed", error);
    return NextResponse.json({ ok: false, authenticated: false }, { status: 500 });
  }
}
