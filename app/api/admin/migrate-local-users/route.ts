import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  ASHA_MODULES,
  deriveInternalPassword,
  initialsFromName,
  normalizeUsername,
  sanitizePermissions,
  supabaseAdminFetch,
  supabaseAuthFetch,
  readJsonSafe,
} from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";

const MIGRATION_CODE_HASH = "00527f106e038f2cbbbe7b40401ac9c4d7df517c152a4dfa5e4883d24e05bf99";

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function validMigrationCode(value: string) {
  const actual = Buffer.from(createHash("sha256").update(value).digest("hex"), "utf8");
  const expected = Buffer.from(MIGRATION_CODE_HASH, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

type LocalUserInput = {
  fullName?: unknown;
  username?: unknown;
  secret?: unknown;
  role?: unknown;
  active?: unknown;
  permissions?: unknown;
};

type ExistingProfile = {
  id: string;
  is_primary_admin?: boolean;
};

async function rollbackAuthUser(id: string) {
  try {
    await supabaseAdminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {}
}

async function replacePermissions(userId: string, permissions: string[]) {
  const deleteResponse = await supabaseAdminFetch(
    `/rest/v1/user_permissions?user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
  if (!deleteResponse.ok) return false;
  if (permissions.length === 0) return true;
  const permissionResponse = await supabaseAdminFetch("/rest/v1/user_permissions", {
    method: "POST",
    body: JSON.stringify(permissions.map(module => ({ user_id: userId, module, allowed: true }))),
  });
  return permissionResponse.ok;
}

function unwrapAuthUser(value: Record<string, unknown>) {
  return value.user && typeof value.user === "object"
    ? (value.user as Record<string, unknown>)
    : value;
}

function safeAuthReason(detail: Record<string, unknown>) {
  const code =
    typeof detail.error_code === "string" ? detail.error_code :
    typeof detail.code === "string" ? detail.code :
    typeof detail.error === "string" ? detail.error :
    "auth_rejected";
  const message =
    typeof detail.msg === "string" ? detail.msg :
    typeof detail.message === "string" ? detail.message :
    typeof detail.error_description === "string" ? detail.error_description :
    "";
  const clean = message.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  return clean ? `${code}: ${clean}` : code;
}

async function verifyCredentials(userId: string, username: string, internalPassword: string) {
  const authUserResponse = await supabaseAdminFetch(
    `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!authUserResponse.ok) {
    return { ok: false, reason: "No se pudo leer la identidad Auth después de actualizarla." };
  }
  const authRaw = await readJsonSafe(authUserResponse);
  const authUser = unwrapAuthUser(authRaw);
  const email = typeof authUser.email === "string" ? authUser.email : "";
  if (!email) return { ok: false, reason: "La identidad Auth no tiene correo técnico asociado." };

  const tokenResponse = await supabaseAuthFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password: internalPassword }),
  });
  if (!tokenResponse.ok) {
    const detail = await readJsonSafe(tokenResponse);
    return { ok: false, reason: `Supabase Auth rechazó ${username} (${safeAuthReason(detail)}).` };
  }
  return { ok: true };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { migrationCode?: unknown; users?: unknown };
    const migrationCode = typeof body.migrationCode === "string" ? body.migrationCode.trim() : "";
    if (!validMigrationCode(migrationCode)) return fail("Código de migración inválido.", 403);
    if (!Array.isArray(body.users) || body.users.length < 1 || body.users.length > 20) {
      return fail("No hay usuarios válidos para migrar.");
    }

    const results: Array<{ username: string; status: "created" | "updated"; id?: string; verified: boolean }> = [];

    for (const raw of body.users as LocalUserInput[]) {
      const fullName = typeof raw.fullName === "string" ? raw.fullName.trim() : "";
      const username = normalizeUsername(typeof raw.username === "string" ? raw.username : "");
      const secret = typeof raw.secret === "string" ? raw.secret.trim() : "";
      const role = typeof raw.role === "string" && raw.role.trim() ? raw.role.trim() : "Usuario";
      const active = raw.active !== false;
      const requestedPermissions = sanitizePermissions(raw.permissions);

      if (fullName.length < 3 || fullName.length > 120) return fail(`Nombre inválido para ${username || "un usuario"}.`);
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) return fail(`Usuario inválido: ${username || "sin usuario"}.`);
      if (secret.length < 6 || secret.length > 72) return fail(`La contraseña/PIN de ${username} debe tener entre 6 y 72 caracteres.`);

      const existingResponse = await supabaseAdminFetch(
        `/rest/v1/profiles?select=id,is_primary_admin&username=eq.${encodeURIComponent(username)}&limit=1`,
        { headers: { Accept: "application/json" } },
      );
      if (!existingResponse.ok) return fail(`No se pudo comprobar ${username}.`, 503);
      const existing = (await existingResponse.json()) as ExistingProfile[];
      const existingProfile = existing[0];
      const internalPassword = deriveInternalPassword(username, secret);

      if (existingProfile?.id) {
        const userId = existingProfile.id;
        const isPrimaryAdmin = existingProfile.is_primary_admin === true;
        const permissions = isPrimaryAdmin ? [...ASHA_MODULES] : requestedPermissions;

        const authResponse = await supabaseAdminFetch(
          `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
          {
            method: "PUT",
            body: JSON.stringify({
              password: internalPassword,
              email_confirm: true,
              user_metadata: {
                asha_internal_user: true,
                asha_username: username,
                full_name: fullName,
                migrated_from_local: true,
              },
            }),
          },
        );
        if (!authResponse.ok) {
          console.error("ASHA local migration existing auth update failed", await readJsonSafe(authResponse));
          return fail(`No se pudo actualizar el acceso cloud de ${username}.`, 502);
        }

        const profileUpdate = await supabaseAdminFetch(
          `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              full_name: fullName,
              role,
              initials: initialsFromName(fullName),
              username,
              is_active: active,
              notes: "Usuario sincronizado desde almacenamiento local de ASHA",
            }),
          },
        );
        if (!profileUpdate.ok) return fail(`No se pudo actualizar el perfil cloud de ${username}.`, 502);
        if (!(await replacePermissions(userId, permissions))) return fail(`No se pudieron sincronizar los permisos de ${username}.`, 502);

        const verification = await verifyCredentials(userId, username, internalPassword);
        if (!verification.ok) return fail(verification.reason || `No se pudo verificar ${username}.`, 502);
        results.push({ username, status: "updated", id: userId, verified: true });
        continue;
      }

      const internalEmail = `${username}@asha.invalid`;
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
            migrated_from_local: true,
          },
        }),
      });
      if (!createResponse.ok) return fail(`No se pudo crear el acceso cloud de ${username}.`, 502);

      const created = unwrapAuthUser(await readJsonSafe(createResponse));
      const userId = typeof created.id === "string" ? created.id : "";
      if (!userId) return fail(`Supabase no devolvió el identificador de ${username}.`, 502);

      const profileResponse = await supabaseAdminFetch("/rest/v1/profiles", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          id: userId,
          full_name: fullName,
          role,
          initials: initialsFromName(fullName),
          username,
          is_active: active,
          is_primary_admin: false,
          notes: "Usuario migrado desde almacenamiento local de ASHA",
        }),
      });
      if (!profileResponse.ok) {
        await rollbackAuthUser(userId);
        return fail(`No se pudo crear el perfil cloud de ${username}.`, 502);
      }
      if (!(await replacePermissions(userId, requestedPermissions))) {
        await rollbackAuthUser(userId);
        return fail(`No se pudieron migrar los permisos de ${username}.`, 502);
      }

      const verification = await verifyCredentials(userId, username, internalPassword);
      if (!verification.ok) return fail(verification.reason || `No se pudo verificar ${username}.`, 502);
      results.push({ username, status: "created", id: userId, verified: true });
    }

    return NextResponse.json({ ok: true, results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ASHA local migration error", error);
    return fail("No se pudo completar la migración de accesos.", 503);
  }
}
