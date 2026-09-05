import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseUserFetch } from "@/lib/supabase/server";

export const ACCESS_COOKIE = "asha-access-token";
export const REFRESH_COOKIE = "asha-refresh-token";

export type AuthUser = {
  id: string;
  email?: string;
};

export async function readAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const accessToken = await readAccessToken();
  if (!accessToken) return null;

  const response = await supabaseUserFetch("/auth/v1/user", accessToken, {
    method: "GET",
  });
  if (!response.ok) return null;

  const user = (await response.json()) as AuthUser;
  return user?.id ? user : null;
}

export function setSessionCookies(
  response: NextResponse,
  session: { access_token: string; refresh_token: string; expires_in?: number },
) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, Number(session.expires_in ?? 3600)),
  });
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
