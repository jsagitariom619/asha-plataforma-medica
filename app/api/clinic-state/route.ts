import { NextResponse } from "next/server";
import { readJsonSafe, supabaseAdminFetch, supabaseAuthFetch } from "@/lib/supabase/server-rest";
import { readAccessToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
type Caller = { id: string; isPrimaryAdmin: boolean; permissions: Set<string> };
type State = Record<string, unknown>;
const FIELD_MODULES: Record<string, string[]> = {
  patients: ["Pacientes", "Historias clínicas"],
  services: ["Servicios", "Agenda", "Historias clínicas", "Caja y cobros"],
  products: ["Productos", "Caja y cobros", "Movimientos", "Contabilidad"],
  txs: ["Caja y cobros", "Movimientos", "Productos", "Contabilidad"],
  appointments: ["Agenda"],
  attentions: ["Pacientes", "Historias clínicas", "Caja y cobros"],
  clinicalHistories: ["Historias clínicas"],
  completedConsultations: ["Historias clínicas"],
  clinicalDemoStatus: ["Historias clínicas"],
  professionalName: ["Resumen", "Configuración"],
};

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
}
function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

async function authenticatedCaller(token: string): Promise<Caller | null> {
  if (!token) return null;
  const authResponse = await supabaseAuthFetch("/auth/v1/user", { headers: { Authorization: `Bearer ${token}` } });
  if (!authResponse.ok) return null;
  const authUser = await readJsonSafe(authResponse);
  const id = typeof authUser.id === "string" ? authUser.id : "";
  if (!id) return null;
  const profileResponse = await supabaseAdminFetch(`/rest/v1/profiles?select=id,is_active,is_primary_admin&id=eq.${encodeURIComponent(id)}&limit=1`, { headers: { Accept: "application/json" } });
  if (!profileResponse.ok) return null;
  const profiles = (await profileResponse.json()) as Array<{ is_active?: boolean; is_primary_admin?: boolean }>;
  const profile = profiles[0];
  if (!profile?.is_active) return null;
  const permissionResponse = await supabaseAdminFetch(`/rest/v1/user_permissions?select=module&user_id=eq.${encodeURIComponent(id)}&allowed=eq.true`, { headers: { Accept: "application/json" } });
  const rows = permissionResponse.ok ? ((await permissionResponse.json()) as Array<{ module?: string }>) : [];
  return { id, isPrimaryAdmin: profile.is_primary_admin === true, permissions: new Set(rows.map((row) => row.module).filter((value): value is string => Boolean(value))) };
}

function canUseField(caller: Caller, field: string) {
  return caller.isPrimaryAdmin ? field in FIELD_MODULES : (FIELD_MODULES[field] || []).some((module) => caller.permissions.has(module));
}
function visibleState(state: State, caller: Caller) {
  const visible = Object.fromEntries(Object.entries(state).filter(([field]) => canUseField(caller, field)));
  if (Array.isArray(visible.clinicalHistories)) {
    visible.clinicalHistories = visible.clinicalHistories.map((record) => {
      if (!record || typeof record !== "object") return record;
      const copy = structuredClone(record) as Record<string, unknown>;
      const data = copy.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        for (const field of ["beforePhoto", "afterPhoto"]) {
          const value = (data as State)[field];
          if (typeof value === "string" && value.startsWith("clinical-storage:")) (data as State)[field] = `/api/clinical-photo?path=${encodeURIComponent(value.slice(17))}`;
        }
      }
      return copy;
    });
  }
  return visible;
}

function dataImage(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("image-size");
  return { bytes, mime: match[1], extension: match[1].split("/")[1].replace("jpeg", "jpg") };
}
async function uploadImage(bucket: string, path: string, value: unknown) {
  const image = dataImage(value);
  if (!image) return value;
  const response = await supabaseAdminFetch(`/storage/v1/object/${bucket}/${path}.${image.extension}`, { method: "POST", headers: { "Content-Type": image.mime, "x-upsert": "true" }, body: image.bytes });
  if (!response.ok) throw new Error(`storage-upload-${response.status}`);
  return `${path}.${image.extension}`;
}
async function persistImages(state: State) {
  const next = structuredClone(state);
  if (Array.isArray(next.products)) {
    next.products = await Promise.all(next.products.map(async (product) => {
      if (!product || typeof product !== "object") return product;
      const copy = product as State;
      const id = String(copy.id || crypto.randomUUID());
      if (dataImage(copy.image)) {
        const path = await uploadImage("product-images", id, copy.image);
        copy.image = `/api/media?bucket=product-images&path=${encodeURIComponent(String(path))}`;
      }
      return copy;
    }));
  }
  if (Array.isArray(next.clinicalHistories)) {
    next.clinicalHistories = await Promise.all(next.clinicalHistories.map(async (record) => {
      if (!record || typeof record !== "object") return record;
      const copy = record as State;
      const id = String(copy.id || crypto.randomUUID());
      const data = copy.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        for (const field of ["beforePhoto", "afterPhoto"]) {
          if (dataImage((data as State)[field])) {
            const path = await uploadImage("clinical-images", `${id}/${field}`, (data as State)[field]);
            (data as State)[field] = `clinical-storage:${path}`;
          }
        }
      }
      return copy;
    }));
  }
  return next;
}

async function readCentralState(): Promise<{ payload: State; revision: number; updated_at: string | null } | null> {
  const response = await supabaseAdminFetch("/rest/v1/clinic_state?select=payload,revision,updated_at&id=eq.asha&limit=1", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`clinic_state read failed: ${response.status}`);
  const rows = (await response.json()) as Array<{ payload?: unknown; revision?: number; updated_at?: string }>;
  const row = rows[0];
  if (!row) return null;
  return { payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? (row.payload as State) : {}, revision: Number(row.revision) || 1, updated_at: row.updated_at || null };
}

export async function GET(request: Request) {
  try {
    const caller = await authenticatedCaller(bearerToken(request) || (await readAccessToken()) || "");
    if (!caller) return fail("Sesión no válida.", 401);
    const row = await readCentralState();
    return NextResponse.json({ ok: true, state: row ? visibleState(row.payload, caller) : null, revision: row?.revision ?? 0, updatedAt: row?.updated_at ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ASHA clinic state read error", error);
    return fail("No se pudo leer la información central.", 503);
  }
}

export async function PUT(request: Request) {
  try {
    const caller = await authenticatedCaller(bearerToken(request) || (await readAccessToken()) || "");
    if (!caller) return fail("Sesión no válida.", 401);
    const raw = await request.text();
    if (!raw || Buffer.byteLength(raw, "utf8") > MAX_PAYLOAD_BYTES) return fail("La información excede el tamaño permitido.", 413);
    let body: { state?: unknown };
    try { body = JSON.parse(raw) as { state?: unknown }; } catch { return fail("Contenido no válido.", 400); }
    if (!body.state || typeof body.state !== "object" || Array.isArray(body.state)) return fail("Contenido no válido.", 400);
    const permitted = Object.fromEntries(Object.entries(body.state as State).filter(([field]) => canUseField(caller, field)));
    if (!Object.keys(permitted).length) return fail("No tienes permiso para guardar esta información.", 403);
    const persisted = await persistImages(permitted);
    const response = await supabaseAdminFetch("/rest/v1/rpc/merge_clinic_state", { method: "POST", headers: { Accept: "application/json" }, body: JSON.stringify({ p_patch: persisted, p_updated_by: caller.id }) });
    if (!response.ok) {
      console.error("ASHA clinic state atomic write rejected", response.status, await response.text());
      return fail("No se pudo guardar la información central.", 503);
    }
    const rows = (await response.json()) as Array<{ revision?: number; updated_at?: string }>;
    return NextResponse.json({ ok: true, revision: rows[0]?.revision ?? null, updatedAt: rows[0]?.updated_at ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ASHA clinic state write error", error);
    return fail("No se pudo guardar la información central.", 503);
  }
}
