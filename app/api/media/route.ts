import { NextResponse } from "next/server";
import { readAccessToken } from "@/lib/auth/session";
import { readJsonSafe, supabaseAdminFetch, supabaseAuthFetch } from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";
const BUCKETS = new Set(["avatars", "product-images"]);

export async function GET(request: Request) {
  const token = await readAccessToken();
  if (!token) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const auth = await supabaseAuthFetch("/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } });
  if (!auth.ok) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const user = await readJsonSafe(auth), id = typeof user.id === "string" ? user.id : "";
  const profile = await supabaseAdminFetch(`/rest/v1/profiles?select=is_active&id=eq.${encodeURIComponent(id)}&limit=1`);
  const rows = profile.ok ? await profile.json() as Array<{is_active?:boolean}> : [];
  if (!rows[0]?.is_active) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  const url = new URL(request.url), bucket = url.searchParams.get("bucket") || "", path = url.searchParams.get("path") || "";
  if (!BUCKETS.has(bucket) || !/^[A-Za-z0-9._/-]+$/.test(path) || path.includes("..")) return NextResponse.json({ error: "Ruta no válida." }, { status: 400 });
  const file = await supabaseAdminFetch(`/storage/v1/object/${bucket}/${path}`);
  if (!file.ok) return NextResponse.json({ error: "Imagen no encontrada." }, { status: file.status === 404 ? 404 : 503 });
  return new NextResponse(file.body, { headers: { "Content-Type": file.headers.get("content-type") || "application/octet-stream", "Cache-Control": "private, max-age=300" } });
}
