import { NextResponse } from "next/server";
import {
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

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export async function PATCH(request: Request) {
  try {
    const accessToken = bearerToken(request);
    if (!accessToken) return fail("Sesión requerida.", 401);

    const authResponse = await supabaseAuthFetch("/auth/v1/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!authResponse.ok) return fail("La sesión no es válida.", 401);

    const authUser = await readJsonSafe(authResponse);
    const userId = typeof authUser.id === "string" ? authUser.id : "";
    if (!userId) return fail("La sesión no es válida.", 401);

    const profileResponse = await supabaseAdminFetch(
      `/rest/v1/profiles?select=id,is_active,is_primary_admin,username&id=eq.${encodeURIComponent(userId)}&limit=1`,
      { headers: { Accept: "application/json" } },
    );
    if (!profileResponse.ok) return fail("No se pudo validar el perfil.", 503);

    const profiles = (await profileResponse.json()) as Array<{
      id: string;
      is_active: boolean;
      is_primary_admin: boolean;
      username: string;
    }>;
    const profile = profiles[0];
    if (!profile || !profile.is_active || !profile.is_primary_admin) {
      return fail("Solo el Administrador Principal puede actualizar estas credenciales.", 403);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const username = normalizeUsername(
      typeof body.username === "string" ? body.username : "",
    );
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return fail(
        "El usuario debe tener entre 3 y 40 caracteres y usar solo letras, números, punto, guion o guion bajo.",
      );
    }
    if (newPassword && (newPassword.length < 6 || newPassword.length > 72)) {
      return fail("La contraseña debe tener entre 6 y 72 caracteres.");
    }

    const existingResponse = await supabaseAdminFetch(
      `/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(username)}&id=neq.${encodeURIComponent(userId)}&limit=1`,
      { headers: { Accept: "application/json" } },
    );
    if (!existingResponse.ok) {
      return fail("No se pudo comprobar el nombre de usuario.", 503);
    }
    const existing = (await existingResponse.json()) as Array<{ id: string }>;
    if (existing.length > 0) return fail("Ese nombre de usuario ya está en uso.", 409);

    if (newPassword) {
      const passwordResponse = await supabaseAdminFetch(
        `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
        {
          method: "PUT",
          body: JSON.stringify({ password: newPassword }),
        },
      );
      if (!passwordResponse.ok) {
        const details = await readJsonSafe(passwordResponse);
        console.error("ASHA primary password update failed", details);
        return fail("No se pudo actualizar la contraseña en Supabase Auth.", 502);
      }
    }

    if (username !== profile.username) {
      const updateProfileResponse = await supabaseAdminFetch(
        `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ username }),
        },
      );
      if (!updateProfileResponse.ok) {
        const details = await readJsonSafe(updateProfileResponse);
        console.error("ASHA primary username update failed", details);
        return fail(
          "La contraseña se actualizó, pero no se pudo actualizar el nombre de usuario. Intenta ingresar con el usuario anterior y la nueva contraseña.",
          502,
        );
      }
    }

    return NextResponse.json(
      { ok: true, user: { id: userId, username } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("ASHA primary account update error", error);
    return fail("No se pudieron actualizar las credenciales cloud.", 503);
  }
}
