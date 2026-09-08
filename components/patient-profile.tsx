"use client";

import { runtimeStore } from "@/lib/client/runtime-store";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  ChevronRight,
  FileHeart,
  FilePenLine,
  ImagePlus,
  Plus,
  Stethoscope,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
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

type Patient = {
  id: number;
  name: string;
  code?: string;
  age?: number;
  phone?: string;
  lastVisit?: string;
  status?: string;
};
type HistoryRecord = {
  id: number;
  createdAt: string;
  patient: string;
  patientCode: string;
  data: Record<string, string | string[]>;
};
type Attention = {
  id: number;
  patientId: number;
  patientName: string;
  createdAt: string;
  reason?: string;
  procedure?: string;
  totalCost?: number;
};
type Tx = {
  id: number;
  concept: string;
  reference: string;
  type: string;
  amount: number;
  date: string;
  method: string;
  status?: string;
  origin?: string;
  patientId?: number;
  attentionId?: number;
  createdAt?: string;
  operationId?: string;
};
type AccountRow = { attention: Attention; paid: number; balance: number };
const HISTORY_KEY = "asha-aesthetic-histories-v1";
const BOLIVIA_TZ = "America/La_Paz";
const money = (n: number) =>
  new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
const nowLabel = () =>
  new Intl.DateTimeFormat("es-BO", {
    timeZone: BOLIVIA_TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

function readStore() {
  try {
    return JSON.parse(runtimeStore.getItem("asha-demo") || "null") || {};
  } catch {
    return {};
  }
}
function readPatient(name: string): Patient | null {
  const data = readStore();
  const patients: Array<Patient> = Array.isArray(data?.patients)
    ? data.patients
    : [];
  return patients.find((item) => item.name === name) || null;
}
function readHistories(name: string): HistoryRecord[] {
  try {
    const rows = JSON.parse(runtimeStore.getItem(HISTORY_KEY) || "[]");
    return (Array.isArray(rows) ? rows : [])
      .filter((item: HistoryRecord) => item.patient === name)
      .sort(
        (a: HistoryRecord, b: HistoryRecord) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  } catch {
    return [];
  }
}
function readAttentions(patientId: number): Attention[] {
  const data = readStore();
  return (Array.isArray(data?.attentions) ? data.attentions : [])
    .filter((item: Attention) => item.patientId === patientId)
    .sort((a: Attention, b: Attention) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
    );
}
function readTxs(): Tx[] {
  const data = readStore();
  return Array.isArray(data?.txs) ? data.txs : [];
}
const value = (record: HistoryRecord, key: string) => {
  const raw = record.data?.[key];
  return Array.isArray(raw) ? raw.join(", ") : String(raw || "").trim();
};
const prettyDate = (raw: string) => {
  try {
    return new Intl.DateTimeFormat("es-BO", {
      timeZone: BOLIVIA_TZ,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(raw));
  } catch {
    return raw;
  }
};

export function PatientProfileCompat() {
  const [patient, setPatient] = useState<Patient | null>(null),
    [histories, setHistories] = useState<HistoryRecord[]>([]),
    [attentions, setAttentions] = useState<Attention[]>([]),
    [txs, setTxs] = useState<Tx[]>([]),
    [payment, setPayment] = useState<AccountRow | null>(null);
  const refresh = (name: string) => {
    const found = readPatient(name);
    if (!found) return;
    setPatient(found);
    setHistories(readHistories(name));
    setAttentions(readAttentions(found.id));
    setTxs(readTxs());
  };
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null,
        row = target?.closest(".person") as HTMLElement | null;
      if (!row || target?.closest("button")) return;
      const name = row.querySelector("b")?.textContent?.trim();
      if (!name) return;
      event.preventDefault();
      refresh(name);
    };
    const onRefresh = (event: Event) => {
      const name = (event as CustomEvent<{ patient?: string }>).detail?.patient;
      if (patient && (!name || name === patient.name)) refresh(patient.name);
    };
    const onOpenProfile = (event: Event) => {
      const name =
        (event as CustomEvent<{ patient?: string }>).detail?.patient || "";
      if (name) refresh(name);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(
      "asha-clinical-completed",
      onRefresh as EventListener,
    );
    window.addEventListener(
      "asha-open-patient-profile",
      onOpenProfile as EventListener,
    );
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(
        "asha-clinical-completed",
        onRefresh as EventListener,
      );
      window.removeEventListener(
        "asha-open-patient-profile",
        onOpenProfile as EventListener,
      );
    };
  }, [patient]);
  useEffect(() => {
    if (!patient) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPatient(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [patient]);

  const aestheticRecords = useMemo(
    () =>
      histories.map((record, index) => {
        const type = value(record, "recordType");
        return {
          id: `h-${record.id}`,
          type:
            type === "treatment"
              ? "treatment"
              : type === "evolution"
                ? "evolution"
                : index === histories.length - 1
                  ? "initial"
                  : "evolution",
          title:
            value(record, "procedure") ||
            value(record, "treatmentPlan") ||
            (type === "treatment"
              ? "Tratamiento estético"
              : type === "evolution"
                ? "Evolución clínica"
                : index === histories.length - 1
                  ? "Historia clínica inicial"
                  : "Control / evolución"),
          areas: value(record, "areas"),
          nextControl: value(record, "nextControl"),
          response: value(record, "evolution"),
          status: value(record, "treatmentStatus"),
          hasPhotos: Boolean(
            value(record, "beforePhoto") || value(record, "afterPhoto"),
          ),
          date: prettyDate(record.createdAt),
          record,
        };
      }),
    [histories],
  );
  const attentionRecords = useMemo(
    () =>
      attentions.map((item) => ({
        id: `a-${item.id}`,
        type: "attention",
        title: item.procedure || item.reason || "Atención clínica",
        areas: "",
        nextControl: "",
        response: item.reason || "",
        status: "Atendido",
        hasPhotos: false,
        date: prettyDate(item.createdAt),
        record: null,
      })),
    [attentions],
  );
  const records = useMemo(
    () =>
      [...attentionRecords, ...aestheticRecords].sort((a, b) =>
        String(b.date).localeCompare(String(a.date)),
      ),
    [attentionRecords, aestheticRecords],
  );
  const account = useMemo<AccountRow[]>(
    () =>
      attentions
        .filter((a) => (Number(a.totalCost) || 0) > 0)
        .map((attention) => {
          const paid = txs
            .filter(
              (tx) =>
                tx.attentionId === attention.id &&
                tx.patientId === attention.patientId &&
                tx.type === "Ingreso" &&
                tx.origin === "patient-payment" &&
                tx.status !== "Anulado" &&
                tx.status !== "Pendiente",
            )
            .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
          const total = Math.max(0, Number(attention.totalCost) || 0);
          return { attention, paid, balance: Math.max(0, total - paid) };
        }),
    [attentions, txs],
  );
  const totals = useMemo(
    () =>
      account.reduce(
        (acc, row) => ({
          total: acc.total + (Number(row.attention.totalCost) || 0),
          paid: acc.paid + row.paid,
          balance: acc.balance + row.balance,
        }),
        { total: 0, paid: 0, balance: 0 },
      ),
    [account],
  );
  const firstPending = account.find((row) => row.balance > 0) || null;
  if (!patient) return null;
  const active =
    aestheticRecords.find(
      (item) => item.type === "treatment" && item.status !== "Finalizado",
    ) ||
    attentionRecords[0] ||
    aestheticRecords[0];
  const initial =
    aestheticRecords.find((item) => item.type === "initial") || null;
  const dispatch = (name: string, detail: Record<string, string>) => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
    setPatient(null);
  };
  const openEvolution = () =>
    dispatch("asha-open-aesthetic-history", {
      patient: patient.name,
      mode: "evolution",
    });
  const openEdit = () =>
    dispatch("asha-edit-clinical-history", { patient: patient.name });
  const openAttention = () => {
    const name = patient.name;
    setPatient(null);
    window.setTimeout(
      () =>
        window.dispatchEvent(
          new CustomEvent("asha-open-new-attention", {
            detail: { patient: name },
          }),
        ),
      0,
    );
  };
  const registerPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!payment) return;
    const form = new FormData(event.currentTarget),
      amount = Number(form.get("amount")),
      method = String(form.get("method") || "Efectivo");
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > payment.balance + 0.001
    )
      return;
    const store = readStore(),
      rows: Tx[] = Array.isArray(store.txs) ? store.txs : [],
      pending = rows.find(
        (tx) =>
          tx.origin === "patient-charge" &&
          tx.patientId === patient.id &&
          tx.attentionId === payment.attention.id &&
          tx.status === "Pendiente",
      ),
      createdAt = new Date().toISOString(),
      newPayment: Tx = {
        id: Date.now(),
        concept:
          payment.attention.procedure || payment.attention.reason || "Pago",
        reference: patient.name,
        type: "Ingreso",
        amount,
        date: nowLabel(),
        method,
        status: "Pagado",
        origin: "patient-payment",
        patientId: patient.id,
        attentionId: payment.attention.id,
        createdAt,
        operationId: `AT-${payment.attention.id}-P-${Date.now()}`,
      };
    const next = rows.flatMap((tx) => {
      if (tx.id !== pending?.id) return [tx];
      const remaining = Math.max(0, (Number(tx.amount) || 0) - amount);
      return remaining > 0
        ? [{ ...tx, amount: remaining, date: nowLabel(), createdAt }]
        : [];
    });
    runtimeStore.setItem(
      "asha-demo",
      JSON.stringify({ ...store, txs: [newPayment, ...next] }),
    );
    setPayment(null);
    setTxs([newPayment, ...next]);
    window.dispatchEvent(
      new CustomEvent("asha-finance-updated", {
        detail: { patient: patient.name },
      }),
    );
  };

  return (
    <>
      <div
        className="patient-profile-layer"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPatient(null);
        }}
      >
        <section
          className="patient-profile-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-profile-title"
        >
          <header className="patient-profile-header">
            <div>
              <span className="patient-profile-avatar">
                <UserRound />
              </span>
              <div>
                <small>EXPEDIENTE DEL PACIENTE</small>
                <h2 id="patient-profile-title">{patient.name}</h2>
                <p>{patient.code || "Historia creada automáticamente"}</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setPatient(null)}
            >
              <X />
            </button>
          </header>
          <div className="patient-profile-body">
            <div className="patient-profile-facts">
              <div>
                <span>Edad</span>
                <b>{patient.age ? `${patient.age} años` : "No registrada"}</b>
              </div>
              <div>
                <span>Teléfono</span>
                <b>{patient.phone || "No registrado"}</b>
              </div>
              <div>
                <span>Última atención</span>
                <b>{patient.lastVisit || "Sin atenciones"}</b>
              </div>
              <div>
                <span>Estado</span>
                <b className="patient-profile-status">
                  {patient.status || "Registrado"}
                </b>
              </div>
            </div>
            <section className="patient-profile-current">
              <div className="patient-profile-section-title">
                <Stethoscope />
                <div>
                  <h3>Atención / tratamiento actual</h3>
                  <p>Resumen del procedimiento o seguimiento más reciente.</p>
                </div>
              </div>
              {active ? (
                <div className="patient-current-card">
                  <div>
                    <span className="patient-current-icon">
                      <Stethoscope />
                    </span>
                    <div>
                      <b>{active.title}</b>
                      {active.areas && <small>{active.areas}</small>}
                      <small>{active.status || active.date}</small>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="patient-profile-empty">
                  Historia clínica creada. Este paciente todavía no tiene
                  atenciones registradas.
                </div>
              )}
            </section>
            <section className="patient-account-section">
              <div className="patient-profile-section-title">
                <WalletCards />
                <div>
                  <h3>Estado de cuenta</h3>
                  <p>Procedimientos, pagos y saldos del paciente.</p>
                </div>
              </div>
              <div className="patient-account-summary">
                <div>
                  <span>Total</span>
                  <b>{money(totals.total)}</b>
                </div>
                <div>
                  <span>Pagado</span>
                  <b>{money(totals.paid)}</b>
                </div>
                <div>
                  <span>Saldo</span>
                  <b
                    className={
                      totals.balance > 0 ? "patient-balance-pending" : ""
                    }
                  >
                    {money(totals.balance)}
                  </b>
                </div>
              </div>
              {firstPending && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 10,
                  }}
                >
                  <button
                    type="button"
                    className="patient-treatment"
                    onClick={() => setPayment(firstPending)}
                  >
                    <Banknote />
                    Registrar pago
                  </button>
                </div>
              )}
              {account.length ? (
                <div className="patient-account-list">
                  {account.map((row) => (
                    <div key={row.attention.id}>
                      <div>
                        <b>
                          {row.attention.procedure ||
                            row.attention.reason ||
                            "Procedimiento"}
                        </b>
                        <small>
                          {money(row.paid)} pagado de{" "}
                          {money(row.attention.totalCost || 0)}
                        </small>
                      </div>
                      {row.balance > 0 ? (
                        <button type="button" onClick={() => setPayment(row)}>
                          <Banknote />
                          Registrar pago · {money(row.balance)}
                        </button>
                      ) : (
                        <span className="tag">Pagado</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="patient-profile-empty">
                  Todavía no existen procedimientos con costo registrado.
                </div>
              )}
            </section>
            <section>
              <div className="patient-profile-section-title">
                <FileHeart />
                <div>
                  <h3>Historia y evoluciones</h3>
                  <p>
                    {records.length} registro{records.length === 1 ? "" : "s"}{" "}
                    clínico{records.length === 1 ? "" : "s"} asociado
                    {records.length === 1 ? "" : "s"}.
                  </p>
                </div>
              </div>
              {records.length ? (
                <div className="patient-timeline">
                  {records.map((item) => (
                    <article key={item.id}>
                      <span className="patient-timeline-dot" />
                      <div className="patient-timeline-card">
                        <div className="patient-timeline-top">
                          <div>
                            <small>
                              {item.type === "initial"
                                ? "HISTORIA INICIAL"
                                : item.type === "treatment"
                                  ? "TRATAMIENTO"
                                  : item.type === "attention"
                                    ? "ATENCIÓN"
                                    : "EVOLUCIÓN / CONTROL"}
                            </small>
                            <h4>{item.title}</h4>
                          </div>
                          <span>{item.date}</span>
                        </div>
                        {item.response && (
                          <p>
                            <b>Detalle:</b> {item.response}
                          </p>
                        )}
                        <div className="patient-timeline-chips">
                          {item.hasPhotos && (
                            <span className="patient-photo-chip">
                              <ImagePlus />
                              Registro fotográfico
                            </span>
                          )}
                          {item.type === "initial" && (
                            <button
                              type="button"
                              className="patient-timeline-edit"
                              onClick={openEdit}
                            >
                              <FilePenLine />
                              Editar historia clínica
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="patient-profile-empty">
                  Historia clínica creada · sin atenciones ni evoluciones
                  registradas.
                </div>
              )}
            </section>
            {!initial && (
              <div className="patient-profile-missing">
                <FileHeart />
                <div>
                  <b>Historia clínica creada</b>
                  <span>
                    La ficha del paciente existe correctamente. Puedes completar
                    antecedentes clínicos cuando sea necesario.
                  </span>
                </div>
                <button type="button" onClick={openEdit}>
                  Completar datos clínicos
                </button>
              </div>
            )}
          </div>
          <footer className="patient-profile-actions">
            <button
              type="button"
              className="patient-secondary"
              onClick={() => setPatient(null)}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="patient-treatment"
              onClick={openAttention}
            >
              <Plus />
              Nueva atención
            </button>
            <button
              type="button"
              className="patient-primary"
              onClick={openEvolution}
            >
              <FileHeart />
              Registrar evolución <ChevronRight />
            </button>
          </footer>
        </section>
      </div>
      <Dialog
        open={!!payment}
        onOpenChange={(open) => !open && setPayment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              {patient.name} ·{" "}
              {payment?.attention.procedure || payment?.attention.reason} ·
              puede ser total o parcial
            </DialogDescription>
          </DialogHeader>
          {payment && (
            <form className="form" onSubmit={registerPayment}>
              <div className="patient-payment-summary">
                <span>Saldo pendiente</span>
                <strong>{money(payment.balance)}</strong>
              </div>
              <label className="field">
                <Label>Importe del pago</Label>
                <Input
                  name="amount"
                  type="number"
                  min="0.01"
                  max={payment.balance}
                  step="0.01"
                  defaultValue={payment.balance}
                  required
                />
              </label>
              <label className="field">
                <Label>Método de pago</Label>
                <select name="method" defaultValue="Efectivo">
                  <option>Efectivo</option>
                  <option>QR</option>
                  <option>Transferencia</option>
                  <option>Tarjeta</option>
                  <option>Otro</option>
                </select>
              </label>
              <div className="form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPayment(null)}
                >
                  Cancelar
                </Button>
                <Button className="gold" type="submit">
                  Registrar pago
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
