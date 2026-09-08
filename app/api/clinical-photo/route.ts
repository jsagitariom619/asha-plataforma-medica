import { NextResponse } from "next/server";
import { readAccessToken } from "@/lib/auth/session";
import { readJsonSafe, supabaseAdminFetch, supabaseAuthFetch } from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = await readAccessToken();
  if (!token) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const auth = await supabaseAuthFetch("/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } });
  if (!auth.ok) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const user = await readJsonSafe(auth), id = typeof user.id === "string" ? user.id : "";
  const profileResponse = await supabaseAdminFetch(`/rest/v1/profiles?select=is_active,is_primary_admin&id=eq.${encodeURIComponent(id)}&limit=1`);
  const profiles = profileResponse.ok ? await profileResponse.json() as Array<{is_active?:boolean;is_primary_admin?:boolean}> : [];
  if (!profiles[0]?.is_active) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  if (!profiles[0].is_primary_admin) {
    const permission = await supabaseAdminFetch(`/rest/v1/user_permissions?select=user_id&user_id=eq.${encodeURIComponent(id)}&module=eq.${encodeURIComponent("Historias clínicas")}&allowed=eq.true&limit=1`);
    if (!permission.ok || !(await permission.json() as unknown[]).length) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }
  const path = new URL(request.url).searchParams.get("path") || "";
  if (!/^[A-Za-z0-9._/-]+$/.test(path) || path.includes("..")) return NextResponse.json({ error: "Ruta no válida." }, { status: 400 });
  const file = await supabaseAdminFetch(`/storage/v1/object/clinical-images/${path}`);
  if (!file.ok) return NextResponse.json({ error: "Imagen no encontrada." }, { status: file.status === 404 ? 404 : 503 });
  return new NextResponse(file.body, { headers: { "Content-Type": file.headers.get("content-type") || "application/octet-stream", "Cache-Control": "private, max-age=300" } });
}
