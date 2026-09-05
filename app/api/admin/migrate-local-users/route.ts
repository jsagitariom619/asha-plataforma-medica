import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  deriveInternalPassword,
  initialsFromName,
  normalizeUsername,
  sanitizePermissions,
  supabaseAdminFetch,
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

async function rollbackAuthUser(id: string) {
  try {
    await supabaseAdminFetch(`/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {}
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { migrationCode?: unknown; users?: unknown };
    const migrationCode = typeof body.migrationCode === "string" ? body.migrationCode.trim() : "";
    if (!validMigrationCode(migrationCode)) return fail("Código de migración inválido.", 403);
    if (!Array.isArray(body.users) || body.users.length < 1 || body.users.length > 20) {
      return fail("No hay usuarios válidos para migrar.");
    }

    const results: Array<{ username: string; status: "created" | "existing"; id?: string }> = [];

    for (const raw of body.users as LocalUserInput[]) {
      const fullName = typeof raw.fullName === "string" ? raw.fullName.trim() : "";
      const username = normalizeUsername(typeof raw.username === "string" ? raw.username : "");
      const secret = typeof raw.secret === "string" ? raw.secret.trim() : "";
      const role = typeof raw.role === "string" && raw.role.trim() ? raw.role.trim() : "Usuario";
      const active = raw.active !== false;
      const permissions = sanitizePermissions(raw.permissions);

      if (fullName.length < 3 || fullName.length > 120) return fail(`Nombre inválido para ${username || "un usuario"}.`);
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) return fail(`Usuario inválido: ${username || "sin usuario"}.`);
      if (secret.length < 6 || secret.length > 72) return fail(`La contraseña/PIN de ${username} debe tener entre 6 y 72 caracteres.`);

      const existingResponse = await supabaseAdminFetch(
        `/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(username)}&limit=1`,
        { headers: { Accept: "application/json" } },
      );
      if (!existingResponse.ok) return fail(`No se pudo comprobar ${username}.`, 503);
      const existing = (await existingResponse.json()) as Array<{ id: string }>;
      if (existing[0]?.id) {
        results.push({ username, status: "existing", id: existing[0].id });
        continue;
      }

      const internalEmail = `${username}@asha.invalid`;
      const internalPassword = deriveInternalPassword(username, secret);
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
      if (!createResponse.ok) {
        console.error("ASHA local migration auth user failed", await readJsonSafe(createResponse));
        return fail(`No se pudo crear el acceso cloud de ${username}.`, 502);
      }

      const created = await readJsonSafe(createResponse);
      const createdUser = created.user && typeof created.user === "object" ? created.user as Record<string, unknown> : created;
      const userId = typeof createdUser.id === "string" ? createdUser.id : "";
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
        console.error("ASHA local migration profile failed", await readJsonSafe(profileResponse));
        await rollbackAuthUser(userId);
        return fail(`No se pudo crear el perfil cloud de ${username}.`, 502);
      }

      if (permissions.length > 0) {
        const permissionResponse = await supabaseAdminFetch("/rest/v1/user_permissions", {
          method: "POST",
          body: JSON.stringify(permissions.map(module => ({ user_id: userId, module, allowed: true }))),
        });
        if (!permissionResponse.ok) {
          console.error("ASHA local migration permissions failed", await readJsonSafe(permissionResponse));
          await rollbackAuthUser(userId);
          return fail(`No se pudieron migrar los permisos de ${username}.`, 502);
        }
      }

      results.push({ username, status: "created", id: userId });
    }

    return NextResponse.json({ ok: true, results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ASHA local migration error", error);
    return fail("No se pudo completar la migración de accesos.", 503);
  }
}
