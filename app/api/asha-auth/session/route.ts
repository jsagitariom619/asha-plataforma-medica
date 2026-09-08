import { NextResponse } from "next/server";
import {
  clearSessionCookies,
  readAccessToken,
  readRefreshToken,
  setSessionCookies,
} from "@/lib/auth/session";
import {
  readJsonSafe,
  supabaseAdminFetch,
  supabaseAuthFetch,
} from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";

async function resolveUser(token: string) {
  const authResponse = await supabaseAuthFetch("/auth/v1/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!authResponse.ok) return null;
  const auth = await readJsonSafe(authResponse),
    id = typeof auth.id === "string" ? auth.id : "";
  if (!id) return null;
  const profileResponse = await supabaseAdminFetch(
    `/rest/v1/profiles?select=id,username,full_name,role,is_active,is_primary_admin,avatar_url&id=eq.${encodeURIComponent(id)}&limit=1`,
    { headers: { Accept: "application/json" } },
  );
  if (!profileResponse.ok) return null;
  const profiles = (await profileResponse.json()) as Array<
      Record<string, unknown>
    >,
    profile = profiles[0];
  if (!profile || profile.is_active !== true) return null;
  const permissionResponse = await supabaseAdminFetch(
    `/rest/v1/user_permissions?select=module&user_id=eq.${encodeURIComponent(id)}&allowed=eq.true`,
    { headers: { Accept: "application/json" } },
  );
  const permissions = permissionResponse.ok
    ? ((await permissionResponse.json()) as Array<{ module?: string }>)
        .map((row) => row.module)
        .filter((value): value is string => Boolean(value))
    : [];
  return {
    id,
    username: String(profile.username || ""),
    fullName: String(profile.full_name || ""),
    role: String(profile.role || "Usuario"),
    isPrimaryAdmin: profile.is_primary_admin === true,
    avatarUrl:
      typeof profile.avatar_url === "string" ? profile.avatar_url : undefined,
    permissions,
  };
}

export async function GET() {
  let accessToken = await readAccessToken();
  const refreshToken = await readRefreshToken();
  let session: null | {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    } = null;
  let user = accessToken ? await resolveUser(accessToken) : null;
  if (!user && refreshToken) {
    const refresh = await supabaseAuthFetch(
      "/auth/v1/token?grant_type=refresh_token",
      { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) },
    );
    if (refresh.ok) {
      const data = await readJsonSafe(refresh);
      session = {
        access_token: String(data.access_token || ""),
        refresh_token: String(data.refresh_token || ""),
        expires_in: Number(data.expires_in) || 3600,
      };
      accessToken = session.access_token;
      user = accessToken ? await resolveUser(accessToken) : null;
    }
  }
  const output = NextResponse.json(
    user ? { ok: true, user } : { ok: false, error: "Sesión no válida." },
    { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } },
  );
  if (user && session) setSessionCookies(output, session);
  if (!user) clearSessionCookies(output);
  return output;
}
