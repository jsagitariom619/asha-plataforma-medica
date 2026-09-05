import { createHmac } from "node:crypto";
import { getSupabaseServerConfig } from "@/lib/supabase/server";

export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,40}$/;
export const PIN_PATTERN = /^\d{4,8}$/;

export function normalizeAshaUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function validateAshaUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

export function validateAshaPin(value: string): boolean {
  return PIN_PATTERN.test(value);
}

export function deriveAuthPassword(username: string, pin: string): string {
  const { pinPepper } = getSupabaseServerConfig();
  return createHmac("sha256", pinPepper)
    .update(`asha:v1:${normalizeAshaUsername(username)}:${pin}`)
    .digest("hex");
}
