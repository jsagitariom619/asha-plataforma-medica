import { NextResponse } from "next/server";
import {
  deriveInternalPassword,
  normalizeUsername,
  readJsonSafe,
  supabaseAdminFetch,
  supabaseAuthFetch,
} from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function unwrapAuthUser(value: Record<string, unknown>): Record<string, unknown> {
  const nested = value.user;
  return nested && typeof nested === "object"
    ? (nested as Record<string, unknown>)
    : value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: unknown; pin?: unknown };
    const username = normalizeUsername(
      typeof body.username === "string" ? body.username : "",
    );
    const providedSecret = typeof body.pin === "string" ? body.pin.trim() : "";

    if (
      !/^[a-z0-9._-]{3,40}$/.test(username) ||
      providedSecret.length < 6 ||
      providedSecret.length > 72
    ) {
      return fail("Usuario o PIN/contraseña incorrectos.", 401);
    }

    const profileResponse = await supabaseAdminFetch(
      `/rest/v1/profiles?select=id,username,full_name,role,is_active,is_primary_admin&username=eq.${encodeURIComponent(username)}&limit=1`,
      { headers: { Accept: "application/json" } },
    );
    if (!profileResponse.ok) return fail("No se pudo validar el acceso.", 503);

    const profiles = (await profileResponse.json()) as Array<{
      id: string;
      username: string;
      full_name: string;
      role: string;
      is_active: boolean;
      is_primary_admin: boolean;
    }>;
    const profile = profiles[0];
    if (!profile || profile.is_active !== true) {
      return fail("Usuario o PIN/contraseña incorrectos.", 401);
    }

    const authUserResponse = await supabaseAdminFetch(
      `/auth/v1/admin/users/${encodeURIComponent(profile.id)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!authUserResponse.ok) return fail("Usuario o PIN/contraseña incorrectos.", 401);

    const authPayload = await readJsonSafe(authUserResponse);
    const authUser = unwrapAuthUser(authPayload);
    const email = typeof authUser.email === "string" ? authUser.email : "";
    const metadata =
      authUser.user_metadata && typeof authUser.user_metadata === "object"
        ? (authUser.user_metadata as Record<string, unknown>)
        : {};
    const isInternalUser = metadata.asha_internal_user === true;
    if (!email) return fail("Usuario o PIN/contraseña incorrectos.", 401);

    const password = isInternalUser
      ? deriveInternalPassword(username, providedSecret)
      : providedSecret;

    const tokenResponse = await supabaseAuthFetch(
      "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    if (!tokenResponse.ok) {
      const details = await readJsonSafe(tokenResponse);
      console.error("ASHA login token rejected", {
        username,
        isInternalUser,
        status: tokenResponse.status,
        code: typeof details.error_code === "string" ? details.error_code : undefined,
      });
      return fail("Usuario o PIN/contraseña incorrectos.", 401);
    }

    let permissions: string[] = [];
    const permissionResponse = await supabaseAdminFetch(
      `/rest/v1/user_permissions?select=module,allowed&user_id=eq.${encodeURIComponent(profile.id)}&allowed=eq.true`,
      { headers: { Accept: "application/json" } },
    );
    if (permissionResponse.ok) {
      const rows = (await permissionResponse.json()) as Array<{ module?: string; allowed?: boolean }>;
      permissions = rows
        .filter(row => row.allowed === true && typeof row.module === "string")
        .map(row => String(row.module));
    }

    const session = await readJsonSafe(tokenResponse);
    return NextResponse.json(
      {
        ok: true,
        session: {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresIn: session.expires_in,
          tokenType: session.token_type,
        },
        user: {
          id: profile.id,
          username: profile.username,
          fullName: profile.full_name,
          role: profile.role,
          isPrimaryAdmin: profile.is_primary_admin,
          permissions,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("ASHA login error", error);
    return fail("El acceso seguro todavía no está disponible.", 503);
  }
}
