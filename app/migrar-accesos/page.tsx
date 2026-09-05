"use client";

import { FormEvent, useEffect, useState } from "react";

type LocalUser = {
  id?: number;
  name?: string;
  role?: string;
  active?: boolean;
  username?: string;
  permissions?: string[];
};

type Row = LocalUser & { secret: string };

export default function MigrateLocalAccessPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem("asha-demo") || "null");
      const users: LocalUser[] = Array.isArray(data?.users) ? data.users : [];
      setRows(
        users
          .filter(user => user?.username)
          .map(user => ({ ...user, secret: "" })),
      );
    } catch {
      setRows([]);
    }
  }, []);

  const updateSecret = (index: number, secret: string) => {
    setRows(current => current.map((row, i) => i === index ? { ...row, secret } : row));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("");
    const selected = rows.filter(row => row.secret.trim().length >= 6);
    if (!code.trim()) {
      setStatus("Ingresa el código de migración.");
      return;
    }
    if (selected.length < 1) {
      setStatus("Escribe la contraseña o PIN de al menos un usuario.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/migrate-local-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          migrationCode: code.trim(),
          users: selected.map(row => ({
            fullName: row.name || "Usuario ASHA",
            username: row.username || "",
            secret: row.secret,
            role: row.role || "Usuario",
            active: row.active !== false,
            permissions: Array.isArray(row.permissions) ? row.permissions : [],
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok !== true) {
        setStatus(typeof data?.error === "string" ? data.error : "No se pudo migrar el acceso.");
        return;
      }
      const created = Array.isArray(data.results) ? data.results.filter((item: any) => item?.status === "created").length : 0;
      const existing = Array.isArray(data.results) ? data.results.filter((item: any) => item?.status === "existing").length : 0;
      setStatus(`Migración completada. Nuevos: ${created}. Ya existentes: ${existing}. Ahora prueba el acceso desde otro dispositivo.`);
    } catch {
      setStatus("No se pudo conectar con el servidor de ASHA.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f5f2ec", padding: "32px 16px", fontFamily: "Arial, sans-serif" }}>
      <section style={{ maxWidth: 760, margin: "0 auto", background: "white", borderRadius: 18, padding: 24, boxShadow: "0 12px 30px rgba(0,0,0,.08)" }}>
        <h1 style={{ marginTop: 0 }}>Migrar accesos locales a Supabase</h1>
        <p>Esta pantalla copia únicamente los usuarios y permisos locales al acceso cloud de ASHA. No borra ningún dato local.</p>
        {rows.length === 0 ? (
          <p><strong>No se encontraron usuarios locales en este dispositivo.</strong> Abre esta pantalla desde la computadora donde ASHA funcionaba originalmente.</p>
        ) : (
          <form onSubmit={submit}>
            <label style={{ display: "block", marginBottom: 20 }}>
              <span style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Código de migración</span>
              <input value={code} onChange={e => setCode(e.target.value)} type="password" autoComplete="off" style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 8 }} />
            </label>

            {rows.map((row, index) => (
              <div key={`${row.id}-${row.username}`} style={{ borderTop: "1px solid #e8e8e8", padding: "18px 0" }}>
                <strong>{row.name}</strong>
                <div style={{ color: "#555", margin: "4px 0 10px" }}>Usuario: {row.username} · {row.role}</div>
                <label>
                  <span style={{ display: "block", marginBottom: 6 }}>Contraseña o PIN que quieres usar desde cualquier dispositivo</span>
                  <input
                    value={row.secret}
                    onChange={e => updateSecret(index, e.target.value)}
                    type="password"
                    minLength={6}
                    maxLength={72}
                    placeholder="Déjalo vacío si no quieres migrar este usuario ahora"
                    style={{ width: "100%", padding: 12, border: "1px solid #ccc", borderRadius: 8 }}
                  />
                </label>
              </div>
            ))}

            {status && <p style={{ padding: 12, background: "#f3f0e9", borderRadius: 8 }}>{status}</p>}
            <button disabled={busy} type="submit" style={{ width: "100%", padding: 14, border: 0, borderRadius: 10, background: "#0e5a4f", color: "white", fontWeight: 700 }}>
              {busy ? "Migrando…" : "Migrar accesos a Supabase"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
