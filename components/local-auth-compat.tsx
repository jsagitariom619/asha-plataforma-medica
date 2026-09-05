"use client";

import { useEffect } from "react";

const SESSION_KEY = "asha-session";
const DATA_KEY = "asha-demo";

type LocalUser = {
  id?: number;
  active?: boolean;
  username?: string;
  passwordHash?: string;
  passwordSalt?: string;
};

const normalizeUsername = (value: string) => value.trim().toLowerCase();

function hexToBytes(hex: string) {
  return new Uint8Array((hex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)));
}

async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: hexToBytes(salt),
      iterations: 120000,
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function readLocalUsers(): LocalUser[] {
  try {
    const data = JSON.parse(localStorage.getItem(DATA_KEY) || "null");
    return Array.isArray(data?.users) ? data.users : [];
  } catch {
    return [];
  }
}

export function LocalAuthCompat() {
  useEffect(() => {
    const onSubmit = async (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const usernameField = form.elements.namedItem("username");
      const passwordField = form.elements.namedItem("password");
      const confirmField = form.elements.namedItem("confirm");

      // Only intercept the login form. Bootstrap/edit-user forms also contain
      // username/password but include a confirm field.
      if (
        !(usernameField instanceof HTMLInputElement) ||
        !(passwordField instanceof HTMLInputElement) ||
        confirmField
      ) {
        return;
      }

      const username = normalizeUsername(usernameField.value);
      const password = passwordField.value;
      if (!username || !password) return;

      const users = readLocalUsers();
      const localUser = users.find(
        (user) =>
          normalizeUsername(user.username || "") === username &&
          typeof user.passwordHash === "string" &&
          typeof user.passwordSalt === "string",
      );

      // If this username is not a legacy/local user, leave the existing cloud
      // login flow untouched.
      if (!localUser) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (localUser.active === false) {
        window.alert("Usuario inactivo. Contacte al administrador.");
        return;
      }

      try {
        const hash = await hashPassword(password, localUser.passwordSalt || "");
        if (hash !== localUser.passwordHash) {
          window.alert("Usuario o contraseña incorrectos.");
          return;
        }

        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ userId: Number(localUser.id) }),
        );
        window.location.reload();
      } catch {
        window.alert("No se pudo validar el acceso local.");
      }
    };

    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  return null;
}
