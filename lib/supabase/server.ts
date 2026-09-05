import { getSupabasePublicConfig } from "@/lib/supabase/env";

export type SupabaseServerConfig = {
  url: string;
  publishableKey: string;
  secretKey: string;
  pinPepper: string;
};

export function getSupabaseServerConfig(): SupabaseServerConfig {
  const { url, publishableKey } = getSupabasePublicConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const pinPepper = process.env.ASHA_PIN_PEPPER?.trim();

  if (!secretKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY");
  }

  if (!pinPepper || pinPepper.length < 32) {
    throw new Error("Missing or weak ASHA_PIN_PEPPER (minimum 32 characters)");
  }

  return { url, publishableKey, secretKey, pinPepper };
}

export async function supabaseAdminFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { url, secretKey } = getSupabaseServerConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", secretKey);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");

  return fetch(`${url}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function supabaseUserFetch(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const { url, publishableKey } = getSupabaseServerConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", publishableKey);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");

  return fetch(`${url}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
