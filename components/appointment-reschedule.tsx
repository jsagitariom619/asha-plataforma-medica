"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { primeRuntimeState } from "@/lib/client/runtime-store";

type Appointment = {
  id: number;
  date: string;
  time: string;
  patient: string;
  service: string;
  status: string;
};

type ClinicState = Record<string, unknown> & {
  appointments?: Appointment[];
};

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("es-BO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

export function AppointmentReschedule() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState<ClinicState | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateVisibility = () => {
      const title = document.querySelector("main header h1");
      setVisible(title?.textContent?.trim() === "Agenda");
    };
    updateVisibility();
    const observer = new MutationObserver(updateVisibility);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  const appointments = useMemo(() => {
    const rows = Array.isArray(state?.appointments) ? state!.appointments! : [];
    return [...rows]
      .filter((item) => item.status !== "Atendido" && item.status !== "Cancelada")
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [state]);

  const selected = appointments.find((item) => item.id === selectedId) ?? null;

  const loadState = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/clinic-state", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok !== true)
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo cargar la agenda.");
      const nextState = data.state && typeof data.state === "object" ? (data.state as ClinicState) : {};
      setState(nextState);
      const rows = Array.isArray(nextState.appointments) ? nextState.appointments : [];
      const first = [...rows]
        .filter((item) => item.status !== "Atendido" && item.status !== "Cancelada")
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
      setSelectedId(first?.id ?? null);
      setDate(first?.date ?? "");
      setTime(first?.time ?? "");
    } catch (value) {
      setError(value instanceof Error ? value.message : "No se pudo cargar la agenda.");
    } finally {
      setLoading(false);
    }
  };

  const openDialog = () => {
    setOpen(true);
    void loadState();
  };

  const chooseAppointment = (id: number) => {
    setSelectedId(id);
    const item = appointments.find((row) => row.id === id);
    setDate(item?.date ?? "");
    setTime(item?.time ?? "");
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state || !selected) return;
    if (!date || !time) {
      setError("Selecciona la nueva fecha y hora.");
      return;
    }
    if (date === selected.date && time === selected.time) {
      setError("La nueva fecha y hora son iguales a la cita actual.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updatedAppointments = (Array.isArray(state.appointments) ? state.appointments : []).map((item) =>
        item.id === selected.id ? { ...item, date, time } : item,
      );
      const nextState: ClinicState = { ...state, appointments: updatedAppointments };
      const response = await fetch("/api/clinic-state", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: nextState }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false)
        throw new Error(typeof data?.error === "string" ? data.error : "No se pudo reprogramar la cita.");
      primeRuntimeState(nextState);
      window.dispatchEvent(new CustomEvent("asha-runtime-state", { detail: { appointments: updatedAppointments } }));
      setState(nextState);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("asha-appointment-rescheduled", { detail: { appointmentId: selected.id, date, time } }));
    } catch (value) {
      setError(value instanceof Error ? value.message : "No se pudo reprogramar la cita.");
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={openDialog}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 45,
          boxShadow: "0 10px 28px rgba(41,76,69,.16)",
          background: "#fff",
          borderColor: "#d9dfdc",
          color: "#294c45",
        }}
      >
        <CalendarClock />
        Reprogramar cita
      </Button>

      <Dialog open={open} onOpenChange={(value) => !saving && setOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprogramar cita</DialogTitle>
            <DialogDescription>
              Cambia únicamente la fecha y la hora. El paciente, servicio y estado de la cita se conservan.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p style={{ color: "#6f7b77", fontSize: 14 }}>Cargando agenda…</p>
          ) : appointments.length === 0 ? (
            <p style={{ color: "#6f7b77", fontSize: 14 }}>No hay citas activas disponibles para reprogramar.</p>
          ) : (
            <form className="form" onSubmit={submit}>
              <label className="field">
                <Label>Cita</Label>
                <select
                  value={selectedId ?? ""}
                  onChange={(event) => chooseAppointment(Number(event.target.value))}
                  required
                >
                  {appointments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {formatDate(item.date)} · {item.time} · {item.patient} · {item.service}
                    </option>
                  ))}
                </select>
              </label>

              {selected && (
                <div style={{ padding: 12, border: "1px solid #e5e9e7", borderRadius: 10, background: "#fafbf9" }}>
                  <b style={{ display: "block", color: "#294c45", marginBottom: 3 }}>{selected.patient}</b>
                  <small style={{ display: "block", color: "#6f7b77" }}>
                    {selected.service} · {formatDate(selected.date)} · {selected.time} · {selected.status}
                  </small>
                </div>
              )}

              <div className="cols">
                <label className="field">
                  <Label>Nueva fecha</Label>
                  <Input name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
                </label>
                <label className="field">
                  <Label>Nueva hora</Label>
                  <Input name="time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
                </label>
              </div>

              {error && <p className="auth-error" role="alert">{error}</p>}

              <div className="form-actions">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button className="gold" type="submit" disabled={saving}>
                  {saving ? "Reprogramando…" : "Guardar nueva fecha"}
                </Button>
              </div>
            </form>
          )}
          {!loading && error && appointments.length === 0 && <p className="auth-error" role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
