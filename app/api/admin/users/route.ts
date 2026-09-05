import { NextResponse } from "next/server";
import {
  ASHA_MODULES,
  deriveInternalPassword,
  initialsFromName,
  normalizeUsername,
  readJsonSafe,
  sanitizePermissions,
  supabaseAdminFetch,
  supabaseAuthFetch,
} from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set([
  "Administrador",
  "Médico",
  "Recepción y caja",
  "Enfermería",
  "Usuario",
]);

function responseError(message: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

async function getCaller(accessToken: string) {
  const userResponse = await supabaseAuthFetch("/auth/v1/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) return null;
  const user = await readJsonSafe(userResponse);
  const id = typeof user.id === "string" ? user.id : "";
  if (!id) return null;

  const profileResponse = await supabaseAdminFetch(
    `/rest/v1/profiles?select=id,is_active,is_primary_admin&id=eq.${encodeURIComponent(id)}&limit=1`,
    { headers: { Accept: "application/json" } },
  );
  if (!profileResponse.ok) return null;
  const profiles = (await profileResponse.json()) as Array<{
    id: string;
    is_active: boolean;
    is_primary_admin: boolean;
  }>;
  return profiles[0] || null;
}

async function deleteAuthUser(userId: string) {
  try {
    await supabaseAdminFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  } catch {
    // Best-effort rollback only.
  }
}

async function rollbackCreatedUser(userId: string) {
  try {
    await supabaseAdminFetch(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
  } catch {
    // Best-effort rollback only.
  }
  await deleteAuthUser(userId);
}

export async function POST(request: Request) {
  let createdUserId = "";

  try {
    const accessToken = bearerToken(request);
    if (!accessToken) return responseError("Sesión requerida.", 401);

    const caller = await getCaller(accessToken);
    if (!caller || !caller.is_active || !caller.is_primary_admin) {
      return responseError("No tienes permiso para crear usuarios.", 403);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const username = normalizeUsername(
      typeof body.username === "string" ? body.username : "",
    );
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "Usuario";
    const active = body.active !== false;
    const isPrimaryAdmin = false;
    const permissions = sanitizePermissions(body.permissions);

    if (fullName.length < 3 || fullName.length > 120) {
      return responseError("El nombre del usuario no es válido.");
    }
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return responseError(
        "El usuario debe tener entre 3 y 40 caracteres y usar solo letras, números, punto, guion o guion bajo.",
      );
    }
    if (!/^\d{6}$/.test(pin)) {
      return responseError("El PIN debe tener exactamente 6 dígitos.");
    }
    if (!VALID_ROLES.has(role)) {
      return responseError("El rol seleccionado no es válido.");
    }

    const existingResponse = await supabaseAdminFetch(
      `/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(username)}&limit=1`,
      { headers: { Accept: "application/json" } },
    );
    if (!existingResponse.ok) {
      return responseError("No se pudo comprobar el nombre de usuario.", 503);
    }
    const existing = (await existingResponse.json()) as Array<{ id: string }>;
    if (existing.length > 0) {
      return responseError("Ese nombre de usuario ya está en uso.", 409);
    }

    const internalEmail = `${username}@asha.invalid`;
    const internalPassword = deriveInternalPassword(username, pin);
    const createResponse = await supabaseAdminFetch("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: internalEmail,
        password: internalPassword,
        email_confirm: true,
        user_metadata: {
          asha_internal_user: true,
          asha_username: username,
          full_name: fullName,
        },
      }),
    });

    if (!createResponse.ok) {
      const details = await readJsonSafe(createResponse);
      console.error("ASHA create auth user failed", details);
      return responseError("No se pudo crear la identidad del usuario.", 502);
    }

    const created = await readJsonSafe(createResponse);
    const createdUser =
      created.user && typeof created.user === "object"
        ? (created.user as Record<string, unknown>)
        : created;
    createdUserId = typeof createdUser.id === "string" ? createdUser.id : "";
    if (!createdUserId) {
      return responseError("Supabase no devolvió el identificador del usuario.", 502);
    }

    const profileResponse = await supabaseAdminFetch("/rest/v1/profiles", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: createdUserId,
        full_name: fullName,
        role,
        initials: initialsFromName(fullName),
        username,
        is_active: active,
        is_primary_admin: isPrimaryAdmin,
        notes: "Usuario creado desde ASHA",
      }),
    });

    if (!profileResponse.ok) {
      const details = await readJsonSafe(profileResponse);
      console.error("ASHA create profile failed", details);
      await deleteAuthUser(createdUserId);
      return responseError("No se pudo crear el perfil del usuario.", 502);
    }

    if (permissions.length > 0) {
      const permissionRows = permissions.map((module) => ({
        user_id: createdUserId,
        module,
        allowed: true,
      }));
      const permissionsResponse = await supabaseAdminFetch(
        "/rest/v1/user_permissions",
        {
          method: "POST",
          body: JSON.stringify(permissionRows),
        },
      );

      if (!permissionsResponse.ok) {
        const details = await readJsonSafe(permissionsResponse);
        console.error("ASHA create permissions failed", details);
        await rollbackCreatedUser(createdUserId);
        return responseError("No se pudieron asignar los permisos del usuario.", 502);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: createdUserId,
          fullName,
          username,
          role,
          active,
          isPrimaryAdmin,
          permissions,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("ASHA admin user creation error", error);
    if (createdUserId) await rollbackCreatedUser(createdUserId);
    return responseError("No se pudo completar la creación del usuario.", 503);
  }
}
