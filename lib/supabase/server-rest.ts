import { createHmac } from "node:crypto";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export type JsonRecord = Record<string, unknown>;

function getSupabaseSecretKey(): string {
  const value =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!value) {
    throw new Error("Missing SUPABASE_SECRET_KEY");
  }

  return value;
}

function getPinPepper(): string {
  const value = process.env.ASHA_PIN_PEPPER?.trim();
  if (!value || value.length < 32) {
    throw new Error("Missing or weak ASHA_PIN_PEPPER");
  }
  return value;
}

export function deriveInternalPassword(username: string, pin: string): string {
  const normalized = normalizeUsername(username);
  return createHmac("sha256", getPinPepper())
    .update(`asha:${normalized}:${pin}`)
    .digest("hex");
}

export function getSupabaseServerConfig() {
  const { url, publishableKey } = getSupabasePublicConfig();
  const secretKey = getSupabaseSecretKey();
  return { url, publishableKey, secretKey };
}

export async function supabaseAdminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { url, secretKey } = getSupabaseServerConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", secretKey);
  headers.set("Authorization", `Bearer ${secretKey}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${url}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function supabaseAuthFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { url, publishableKey } = getSupabaseServerConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", publishableKey);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${url}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function readJsonSafe(response: Response): Promise<JsonRecord> {
  try {
    const value = await response.json();
    return value && typeof value === "object" ? (value as JsonRecord) : {};
  } catch {
    return {};
  }
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function initialsFromName(value: string): string {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "US"
  );
}

export const ASHA_MODULES = [
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

export function sanitizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(ASHA_MODULES);
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => allowed.has(item)),
    ),
  );
}
