import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { deriveAuthPassword, normalizeAshaUsername, validateAshaPin, validateAshaUsername } from "@/lib/auth/pin";
import { getAuthenticatedUser, readAccessToken } from "@/lib/auth/session";
import { supabaseAdminFetch, supabaseUserFetch } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULES = [
  "Resumen",
  "Pacientes",
  "Historias clínicas",
  "Agenda",
  "Servicios",
  "Productos",
  "Caja y cobros",
  "Movimientos",
  "Contabilidad",
  "Usuarios",
  "Configuración",
] as const;

const ROLES = ["Administrador", "Médico", "Recepción y caja", "Enfermería", "Usuario"] as const;

type CreateUserBody = {
  name?: string;
  username?: string;
  pin?: string;
  role?: string;
  active?: boolean;
  isPrimaryAdmin?: boolean;
  permissions?: string[];
};

type CallerProfile = {
  id: string;
  is_active: boolean;
  is_primary_admin: boolean;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "US";
}

async function requirePrimaryAdmin() {
  const user = await getAuthenticatedUser();
  const accessToken = await readAccessToken();
  if (!user || !accessToken) return null;

  const profileResponse = await supabaseUserFetch(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,is_active,is_primary_admin&limit=1`,
    accessToken,
    { method: "GET" },
  );
  if (!profileResponse.ok) return null;
  const profiles = (await profileResponse.json()) as CallerProfile[];
  const profile = profiles[0];
  if (!profile?.is_active || !profile.is_primary_admin) return null;
  return { user, accessToken, profile };
}

async function deleteAuthUser(userId: string) {
  try {
    await supabaseAdminFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
  } catch (error) {
    console.error("ASHA rollback could not delete Auth user", error);
  }
}

export async function GET() {
  try {
    const caller = await requirePrimaryAdmin();
    if (!caller) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });

    const profilesResponse = await supabaseAdminFetch(
      "/rest/v1/profiles?select=id,username,full_name,role,initials,is_active,is_primary_admin,created_at&order=created_at.asc",
      { method: "GET" },
    );
    if (!profilesResponse.ok) throw new Error("Could not load profiles");
    const profiles = (await profilesResponse.json()) as Array<Record<string, unknown>>;

    const permissionsResponse = await supabaseAdminFetch(
      "/rest/v1/user_permissions?select=user_id,module,allowed&order=created_at.asc",
      { method: "GET" },
    );
    if (!permissionsResponse.ok) throw new Error("Could not load permissions");
    const permissions = (await permissionsResponse.json()) as Array<{
      user_id: string;
      module: string;
      allowed: boolean;
    }>;

    return NextResponse.json({
      ok: true,
      users: profiles.map((profile) => ({
        ...profile,
        permissions: permissions
          .filter((permission) => permission.user_id === profile.id && permission.allowed)
          .map((permission) => permission.module),
      })),
    });
  } catch (error) {
    console.error("ASHA users list failed", error);
    return NextResponse.json({ ok: false, error: "No se pudo cargar los usuarios." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let createdAuthUserId: string | null = null;

  try {
    const caller = await requirePrimaryAdmin();
    if (!caller) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });

    const body = (await request.json()) as CreateUserBody;
    const name = String(body.name ?? "").trim();
    const username = normalizeAshaUsername(String(body.username ?? ""));
    const pin = String(body.pin ?? "");
    const role = String(body.role ?? "Usuario").trim();
    const active = body.active !== false;
    const isPrimaryAdmin = body.isPrimaryAdmin === true;

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ ok: false, error: "Ingresa un nombre válido." }, { status: 400 });
    }
    if (!validateAshaUsername(username)) {
      return NextResponse.json(
        { ok: false, error: "El usuario debe tener entre 3 y 40 caracteres y usar solo letras, números, punto, guion o guion bajo." },
        { status: 400 },
      );
    }
    if (!validateAshaPin(pin)) {
      return NextResponse.json({ ok: false, error: "El PIN debe contener entre 4 y 8 números." }, { status: 400 });
    }
    if (!(ROLES as readonly string[]).includes(role)) {
      return NextResponse.json({ ok: false, error: "Rol no válido." }, { status: 400 });
    }

    const requestedPermissions = Array.isArray(body.permissions)
      ? body.permissions.filter((module): module is (typeof MODULES)[number] =>
          (MODULES as readonly string[]).includes(module),
        )
      : [];
    const allowedPermissions = isPrimaryAdmin ? [...MODULES] : [...new Set(requestedPermissions)];

    const duplicateResponse = await supabaseAdminFetch(
      `/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id&limit=1`,
      { method: "GET" },
    );
    if (!duplicateResponse.ok) throw new Error("Could not validate username uniqueness");
    const duplicates = (await duplicateResponse.json()) as Array<{ id: string }>;
    if (duplicates.length) {
      return NextResponse.json({ ok: false, error: "Este nombre de usuario ya está en uso." }, { status: 409 });
    }

    const internalEmail = `asha-${username}-${randomUUID()}@users.invalid`;
    const authPassword = deriveAuthPassword(username, pin);
    const authResponse = await supabaseAdminFetch("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: internalEmail,
        password: authPassword,
        email_confirm: true,
        user_metadata: {
          asha_username: username,
          asha_managed: true,
          full_name: name,
        },
      }),
    });
    if (!authResponse.ok) {
      const detail = await authResponse.text();
      console.error("Supabase Auth user creation failed", authResponse.status, detail);
      return NextResponse.json({ ok: false, error: "No se pudo crear la identidad del usuario." }, { status: 502 });
    }

    const authUser = (await authResponse.json()) as { id?: string; user?: { id?: string } };
    createdAuthUserId = authUser.id ?? authUser.user?.id ?? null;
    if (!createdAuthUserId) throw new Error("Supabase Auth did not return the new user id");

    const profileResponse = await supabaseAdminFetch("/rest/v1/profiles", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: createdAuthUserId,
        username,
        full_name: name,
        role,
        initials: initials(name),
        is_active: active,
        is_primary_admin: isPrimaryAdmin,
        notes: "Usuario administrado desde ASHA",
      }),
    });
    if (!profileResponse.ok) {
      const detail = await profileResponse.text();
      console.error("ASHA profile creation failed", profileResponse.status, detail);
      await deleteAuthUser(createdAuthUserId);
      return NextResponse.json({ ok: false, error: "No se pudo crear el perfil del usuario." }, { status: 502 });
    }

    const permissionRows = MODULES.map((module) => ({
      user_id: createdAuthUserId,
      module,
      allowed: allowedPermissions.includes(module),
    }));
    const permissionsResponse = await supabaseAdminFetch("/rest/v1/user_permissions", {
      method: "POST",
      body: JSON.stringify(permissionRows),
    });
    if (!permissionsResponse.ok) {
      const detail = await permissionsResponse.text();
      console.error("ASHA permissions creation failed", permissionsResponse.status, detail);
      await deleteAuthUser(createdAuthUserId);
      return NextResponse.json({ ok: false, error: "No se pudieron configurar los permisos del usuario." }, { status: 502 });
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: createdAuthUserId,
          name,
          username,
          role,
          active,
          isPrimaryAdmin,
          permissions: allowedPermissions,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (createdAuthUserId) await deleteAuthUser(createdAuthUserId);
    console.error("ASHA user creation failed", error);
    return NextResponse.json({ ok: false, error: "No se pudo crear el usuario." }, { status: 500 });
  }
}
