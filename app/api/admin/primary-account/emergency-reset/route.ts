import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  normalizeUsername,
  readJsonSafe,
  supabaseAdminFetch,
} from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";

const RESET_TOKEN_SHA256 =
  "ccd0118a7eb33695b690faa7a1fdc21d467a3747cb14b375f3632013883c25d4";
const EXPECTED_CURRENT_USERNAME = "medsolution";

function fail(message: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function validResetToken(value: string) {
  const actual = createHash("sha256").update(value).digest();
  const expected = Buffer.from(RESET_TOKEN_SHA256, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const resetToken = typeof body.resetToken === "string" ? body.resetToken.trim() : "";
    const username = normalizeUsername(
      typeof body.username === "string" ? body.username : "",
    );
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!validResetToken(resetToken)) return fail("Código temporal inválido.", 403);
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return fail(
        "El usuario debe tener entre 3 y 40 caracteres y usar solo letras, números, punto, guion o guion bajo.",
      );
    }
    if (newPassword.length < 6 || newPassword.length > 72) {
      return fail("La contraseña debe tener entre 6 y 72 caracteres.");
    }

    const primaryResponse = await supabaseAdminFetch(
      "/rest/v1/profiles?select=id,username,is_active,is_primary_admin&is_primary_admin=eq.true&is_active=eq.true&limit=2",
      { headers: { Accept: "application/json" } },
    );
    if (!primaryResponse.ok) return fail("No se pudo validar el Administrador Principal.", 503);

    const primary = (await primaryResponse.json()) as Array<{
      id: string;
      username: string;
      is_active: boolean;
      is_primary_admin: boolean;
    }>;
    if (primary.length !== 1) {
      return fail("El restablecimiento temporal no está disponible para este estado del proyecto.", 409);
    }

    const admin = primary[0];
    if (normalizeUsername(admin.username || "") !== EXPECTED_CURRENT_USERNAME) {
      return fail(
        "Este restablecimiento temporal ya fue utilizado o el usuario principal ya cambió.",
        409,
      );
    }

    const duplicateResponse = await supabaseAdminFetch(
      `/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(username)}&id=neq.${encodeURIComponent(admin.id)}&limit=1`,
      { headers: { Accept: "application/json" } },
    );
    if (!duplicateResponse.ok) return fail("No se pudo comprobar el nombre de usuario.", 503);
    const duplicates = (await duplicateResponse.json()) as Array<{ id: string }>;
    if (duplicates.length > 0) return fail("Ese nombre de usuario ya está en uso.", 409);

    const passwordResponse = await supabaseAdminFetch(
      `/auth/v1/admin/users/${encodeURIComponent(admin.id)}`,
      {
        method: "PUT",
        body: JSON.stringify({ password: newPassword }),
      },
    );
    if (!passwordResponse.ok) {
      const details = await readJsonSafe(passwordResponse);
      console.error("ASHA emergency password update failed", details);
      return fail("No se pudo actualizar la contraseña en Supabase Auth.", 502);
    }

    const profileUpdate = await supabaseAdminFetch(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(admin.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ username }),
      },
    );
    if (!profileUpdate.ok) {
      const details = await readJsonSafe(profileUpdate);
      console.error("ASHA emergency username update failed", details);
      return fail(
        "La contraseña se actualizó, pero no se pudo cambiar el usuario. Intenta ingresar con el usuario anterior y la nueva contraseña.",
        502,
      );
    }

    return NextResponse.json(
      { ok: true, user: { id: admin.id, username } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("ASHA emergency reset error", error);
    return fail("No se pudo completar el restablecimiento temporal.", 503);
  }
}
