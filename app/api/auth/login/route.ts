import { NextResponse } from "next/server";
import { deriveAuthPassword, normalizeAshaUsername, validateAshaPin, validateAshaUsername } from "@/lib/auth/pin";
import { setSessionCookies } from "@/lib/auth/session";
import { getSupabaseServerConfig, supabaseAdminFetch } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginBody = {
  login?: string;
  secret?: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string;
  role: string;
  is_active: boolean;
  is_primary_admin: boolean;
};

function authError() {
  return NextResponse.json({ ok: false, error: "Usuario o credencial incorrectos." }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const login = String(body.login ?? "").trim();
    const suppliedSecret = String(body.secret ?? "");
    if (!login || !suppliedSecret) return authError();

    const { url, publishableKey } = getSupabaseServerConfig();
    let email: string;
    let authPassword: string;

    if (login.includes("@")) {
      // Technical/support access: real Supabase email + password.
      email = login.toLowerCase();
      authPassword = suppliedSecret;
    } else {
      // Operational access: ASHA username + numeric PIN.
      const username = normalizeAshaUsername(login);
      if (!validateAshaUsername(username) || !validateAshaPin(suppliedSecret)) return authError();

      const profileResponse = await supabaseAdminFetch(
        `/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id,username,full_name,role,is_active,is_primary_admin&limit=1`,
        { method: "GET" },
      );
      if (!profileResponse.ok) throw new Error("Could not resolve ASHA username");
      const profiles = (await profileResponse.json()) as ProfileRow[];
      const profile = profiles[0];
      if (!profile?.id || !profile.is_active) return authError();

      const authUserResponse = await supabaseAdminFetch(`/auth/v1/admin/users/${profile.id}`, { method: "GET" });
      if (!authUserResponse.ok) throw new Error("Could not resolve Supabase Auth identity");
      const authUser = (await authUserResponse.json()) as { email?: string };
      if (!authUser.email) throw new Error("ASHA Auth identity has no internal email");

      email = authUser.email;
      authPassword = deriveAuthPassword(username, suppliedSecret);
    }

    const tokenResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password: authPassword }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) return authError();

    const session = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in?: number;
      user?: { id?: string };
    };
    if (!session.access_token || !session.refresh_token || !session.user?.id) return authError();

    const profileResponse = await fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(session.user.id)}&select=id,username,full_name,role,is_active,is_primary_admin&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      },
    );
    if (!profileResponse.ok) throw new Error("Could not load authenticated profile");
    const profileRows = (await profileResponse.json()) as ProfileRow[];
    const profile = profileRows[0];
    if (!profile?.is_active) return authError();

    const permissionsResponse = await fetch(
      `${url}/rest/v1/user_permissions?user_id=eq.${encodeURIComponent(profile.id)}&allowed=eq.true&select=module`,
      {
        method: "GET",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      },
    );
    const permissions = permissionsResponse.ok
      ? ((await permissionsResponse.json()) as Array<{ module: string }>).map((item) => item.module)
      : [];

    const response = NextResponse.json({
      ok: true,
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
    setSessionCookies(response, session);
    return response;
  } catch (error) {
    console.error("ASHA auth login failed", error);
    return NextResponse.json({ ok: false, error: "No se pudo iniciar sesión en este momento." }, { status: 500 });
  }
}
