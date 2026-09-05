"use client";

import { useEffect } from "react";

const SESSION_KEY = "asha-session";

type StoredSession = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  cloudUser?: {
    id?: string;
    username?: string;
    fullName?: string;
    role?: string;
    isPrimaryAdmin?: boolean;
  };
  [key: string]: unknown;
};

function readStoredSession(): StoredSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return value && typeof value === "object" ? (value as StoredSession) : null;
  } catch {
    return null;
  }
}

function recoveryAccessToken(): string {
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return hash.get("access_token")?.trim() || "";
  } catch {
    return "";
  }
}

async function refreshStoredToken(session: StoredSession | null) {
  if (!session?.refreshToken) return "";
  try {
    const response = await fetch("/api/asha-auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !data?.session?.accessToken) return "";
    const updated: StoredSession = {
      ...session,
      accessToken: data.session.accessToken,
      refreshToken: data.session.refreshToken || session.refreshToken,
      expiresAt: Date.now() + Number(data.session.expiresIn || 3600) * 1000,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    return String(data.session.accessToken);
  } catch {
    return "";
  }
}

async function updateCloudCredentials(
  token: string,
  username: string,
  newPassword: string,
) {
  return fetch("/api/admin/primary-account", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ username, newPassword }),
  });
}

export function CloudPrimaryAccountSync() {
  useEffect(() => {
    const onSubmit = async (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const usernameField = form.elements.namedItem("username");
      const passwordField = form.elements.namedItem("password");
      const confirmField = form.elements.namedItem("confirm");
      const activeField = form.elements.namedItem("active");

      const isPrimaryEdit =
        usernameField instanceof HTMLInputElement &&
        passwordField instanceof HTMLInputElement &&
        confirmField instanceof HTMLInputElement &&
        activeField instanceof HTMLSelectElement &&
        activeField.disabled;

      if (!isPrimaryEdit) return;

      if (form.dataset.cloudSynced === "true") {
        delete form.dataset.cloudSynced;
        return;
      }

      const username = usernameField.value.trim().toLowerCase();
      const password = passwordField.value;
      const confirm = confirmField.value;

      // Let the existing React validation show its own messages.
      if (!username || password !== confirm || (password && password.length < 6)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (form.dataset.cloudSyncBusy === "true") return;
      form.dataset.cloudSyncBusy = "true";

      try {
        const session = readStoredSession();
        let token = recoveryAccessToken() || session?.accessToken || "";

        if (!token) {
          token = await refreshStoredToken(session);
        }
        if (!token) {
          window.alert(
            "No hay una sesión cloud válida para actualizar las credenciales. Inicia sesión o abre un enlace de recuperación nuevo y vuelve a intentarlo.",
          );
          return;
        }

        let response = await updateCloudCredentials(token, username, password);
        if (response.status === 401 && !recoveryAccessToken()) {
          const refreshed = await refreshStoredToken(readStoredSession());
          if (refreshed) response = await updateCloudCredentials(refreshed, username, password);
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.ok !== true) {
          window.alert(
            typeof data?.error === "string"
              ? data.error
              : "No se pudieron actualizar las credenciales cloud.",
          );
          return;
        }

        const current = readStoredSession();
        if (current?.cloudUser) {
          current.cloudUser.username = username;
          localStorage.setItem(SESSION_KEY, JSON.stringify(current));
        }

        if (window.location.hash.includes("access_token=")) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
        }

        form.dataset.cloudSynced = "true";
        form.requestSubmit();
      } catch {
        window.alert("No se pudo conectar con Supabase para actualizar las credenciales.");
      } finally {
        delete form.dataset.cloudSyncBusy;
      }
    };

    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  return null;
}
