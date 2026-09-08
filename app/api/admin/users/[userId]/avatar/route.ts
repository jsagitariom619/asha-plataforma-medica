import { NextResponse } from "next/server";
import {
  readJsonSafe,
  supabaseAdminFetch,
  supabaseAuthFetch,
} from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function fail(error: string, status = 400) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
function bearerToken(request: Request) {
  const header = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  if (header) return header;
  const item = (request.headers.get("cookie") || "")
    .split(";")
    .find((value) => value.trim().startsWith("asha-access-token="));
  return item
    ? decodeURIComponent(item.trim().slice("asha-access-token=".length))
    : "";
}

async function requirePrimaryAdmin(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  const authResponse = await supabaseAuthFetch("/auth/v1/user", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!authResponse.ok) return null;
  const auth = await readJsonSafe(authResponse),
    id = typeof auth.id === "string" ? auth.id : "";
  if (!id) return null;
  const profileResponse = await supabaseAdminFetch(
    `/rest/v1/profiles?select=id,is_active,is_primary_admin&id=eq.${encodeURIComponent(id)}&limit=1`,
    { headers: { Accept: "application/json" } },
  );
  if (!profileResponse.ok) return null;
  const profiles = (await profileResponse.json()) as Array<{
    is_active?: boolean;
    is_primary_admin?: boolean;
  }>;
  return profiles[0]?.is_active && profiles[0]?.is_primary_admin ? id : null;
}

async function targetExists(userId: string) {
  const response = await supabaseAdminFetch(
    `/rest/v1/profiles?select=id&id=eq.${encodeURIComponent(userId)}&limit=1`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ id?: string }>;
  return rows[0]?.id === userId;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    if (!(await requirePrimaryAdmin(request)))
      return fail(
        "No tienes permiso para modificar fotografías de usuarios.",
        403,
      );
    const { userId } = await params;
    if (!userId || !(await targetExists(userId)))
      return fail("No se encontró el usuario.", 404);
    const form = await request.formData(),
      value = form.get("avatar");
    if (!(value instanceof File)) return fail("Selecciona una imagen válida.");
    if (!ALLOWED_TYPES.has(value.type))
      return fail("Selecciona una imagen JPG, JPEG, PNG o WEBP.");
    if (value.size <= 0 || value.size > MAX_BYTES)
      return fail("La imagen no puede superar 5 MB.");
    const bytes = await value.arrayBuffer();
    const signature = new Uint8Array(bytes.slice(0, 12));
    const isJpeg =
      signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    const isPng =
      signature[0] === 0x89 &&
      signature[1] === 0x50 &&
      signature[2] === 0x4e &&
      signature[3] === 0x47;
    const isWebp =
      String.fromCharCode(...signature.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
    if (!isJpeg && !isPng && !isWebp)
      return fail("El archivo no contiene una imagen válida.");
    const path = `${userId}/profile.webp`,
      upload = await supabaseAdminFetch(`/storage/v1/object/avatars/${path}`, {
        method: "POST",
        headers: {
          "Content-Type": value.type,
          "x-upsert": "true",
          "Cache-Control": "3600",
        },
        body: bytes,
      });
    if (!upload.ok) {
      console.error(
        "ASHA avatar upload failed",
        upload.status,
        await upload.text(),
      );
      return fail(
        "El almacenamiento de fotografías aún no está disponible.",
        503,
      );
    }
    const avatarUrl = `/api/media?bucket=avatars&path=${encodeURIComponent(path)}&v=${Date.now()}`;
    const update = await supabaseAdminFetch(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      },
    );
    if (!update.ok) {
      await supabaseAdminFetch(`/storage/v1/object/avatars/${path}`, {
        method: "DELETE",
      });
      console.error(
        "ASHA avatar profile update failed",
        update.status,
        await update.text(),
      );
      return fail("La base de perfiles aún no admite fotografías.", 503);
    }
    return NextResponse.json(
      { ok: true, avatarUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("ASHA avatar update error", error);
    return fail("No se pudo guardar la foto de perfil.", 503);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    if (!(await requirePrimaryAdmin(request)))
      return fail(
        "No tienes permiso para modificar fotografías de usuarios.",
        403,
      );
    const { userId } = await params;
    if (!userId || !(await targetExists(userId)))
      return fail("No se encontró el usuario.", 404);
    const update = await supabaseAdminFetch(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ avatar_url: null }),
      },
    );
    if (!update.ok)
      return fail("La base de perfiles aún no admite fotografías.", 503);
    await supabaseAdminFetch(
      `/storage/v1/object/avatars/${userId}/profile.webp`,
      { method: "DELETE" },
    );
    return NextResponse.json(
      { ok: true, avatarUrl: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("ASHA avatar removal error", error);
    return fail("No se pudo quitar la foto de perfil.", 503);
  }
}
