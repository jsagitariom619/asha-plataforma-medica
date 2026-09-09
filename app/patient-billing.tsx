"use client";

import { runtimeStore } from "@/lib/client/runtime-store";
import { FormEvent, useMemo, useState } from "react";
import {
  CircleDollarSign,
  Plus,
  Search,
  UserRound,
  WalletCards,
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
import type { Attention, Patient, Tx } from "@/app/page";

const money = (value: number) =>
  new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
const BOLIVIA_TZ = "America/La_Paz";
const nowLabel = () =>
  new Intl.DateTimeFormat("es-BO", {
    timeZone: BOLIVIA_TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
const compactActionStyle = {
  width: 126,
  height: 34,
  minHeight: 34,
  padding: "0 10px",
  fontSize: 12,
  justifyContent: "center",
  whiteSpace: "nowrap" as const,
};

type BalanceRow = {
  attention?: Attention;
  patient: Patient;
  paid: number;
  balance: number;
  total: number;
  concept: string;
  operationId?: string;
  direct?: boolean;
};
type PatientSummary = {
  patient: Patient;
  rows: BalanceRow[];
  total: number;
  paid: number;
  balance: number;
};
type ServiceOption = {
  id: number;
  name: string;
  category?: string;
  price: number;
  active?: boolean;
};
type LinkedTx = Tx & { serviceId?: number };

function readStore() {
  try {
    return JSON.parse(runtimeStore.getItem("asha-demo") || "null") || {};
  } catch {
    return {};
  }
}
function readServices(): ServiceOption[] {
  const store = readStore();
  return (Array.isArray(store?.services) ? store.services : [])
    .filter(
      (item: ServiceOption) =>
        item && item.active !== false && Number.isFinite(Number(item.price)),
    )
    .map((item: ServiceOption) => ({
      ...item,
      price: Number(item.price) || 0,
    }));
}
function saveDirectCharge(
  patient: Patient,
  concept: string,
  total: number,
  paid: number,
  method: string,
  serviceId?: number,
) {
  const store = readStore(),
    existing: Tx[] = Array.isArray(store.txs) ? store.txs : [],
    createdAt = new Date().toISOString(),
    stamp = Date.now(),
    operationId = `CHG-${patient.id}-${stamp}`,
    rows: LinkedTx[] = [];
  if (paid > 0)
    rows.push({
      id: stamp + 1,
      concept,
      reference: patient.name,
      type: "Ingreso",
      amount: paid,
      date: nowLabel(),
      createdAt,
      method,
      status: "Pagado",
      origin: "patient-payment",
      operationId,
      patientId: patient.id,
      serviceId,
    });
  const balance = Math.max(0, total - paid);
  if (balance > 0)
    rows.push({
      id: stamp + 2,
      concept: `Saldo · ${concept}`,
      reference: patient.name,
      type: "Ingreso",
      amount: balance,
      date: nowLabel(),
      createdAt,
      method: "Pendiente",
      status: "Pendiente",
      origin: "patient-charge",
      operationId,
      patientId: patient.id,
      serviceId,
    });
  runtimeStore.setItem(
    "asha-demo",
    JSON.stringify({ ...store, txs: [...rows, ...existing] }),
  );
}
function saveDirectPayment(row: BalanceRow, amount: number, method: string) {
  if (!row.operationId) return "No se encontró el cargo.";
  const store = readStore(),
    existing: Tx[] = Array.isArray(store.txs) ? store.txs : [],
    pending = existing.find(
      (tx) =>
        tx.operationId === row.operationId &&
        tx.origin === "patient-charge" &&
        tx.status === "Pendiente",
    ),
    balance = Number(pending?.amount) || 0;
  if (!pending || amount <= 0 || amount > balance + 0.001)
    return "El importe supera el saldo pendiente.";
  const createdAt = new Date().toISOString(),
    stamp = Date.now(),
    payment: Tx = {
      id: stamp,
      concept: row.concept,
      reference: row.patient.name,
      type: "Ingreso",
      amount,
      date: nowLabel(),
      createdAt,
      method,
      status: "Pagado",
      origin: "patient-payment",
      operationId: row.operationId,
      patientId: row.patient.id,
    };
  const next = existing.flatMap((tx) => {
    if (tx.id !== pending.id) return [tx];
    const remaining = Math.max(0, (Number(tx.amount) || 0) - amount);
    return remaining > 0
      ? [{ ...tx, amount: remaining, date: nowLabel(), createdAt }]
      : [];
  });
  runtimeStore.setItem(
    "asha-demo",
    JSON.stringify({ ...store, txs: [payment, ...next] }),
  );
  return "";
}

export function PatientBillingPanel({
  patients,
  attentions,
  txs,
  onPayment,
}: {
  patients: Patient[];
  attentions: Attention[];
  txs: Tx[];
  onPayment: (
    patientId: number,
    attentionId: number,
    amount: number,
    method: string,
  ) => string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BalanceRow | null>(null);
  const [newChargePatientId, setNewChargePatientId] = useState<number | null>(
    null,
  );
  const clean = query.trim().toLowerCase();

  const attentionRows = useMemo<BalanceRow[]>(
    () =>
      attentions.flatMap((attention) => {
        const patient = patients.find(
          (item) => item.id === attention.patientId,
        );
        if (!patient) return [];
        const paid = txs
          .filter(
            (tx) =>
              tx.attentionId === attention.id &&
              tx.patientId === attention.patientId &&
              tx.type === "Ingreso" &&
              tx.status !== "Pendiente" &&
              tx.status !== "Anulado" &&
              tx.origin === "patient-payment",
          )
          .reduce((total, tx) => total + (Number(tx.amount) || 0), 0);
        const total = Math.max(0, Number(attention.totalCost) || 0),
          balance = Math.max(0, total - paid);
        return [
          {
            attention,
            patient,
            paid,
            balance,
            total,
            concept:
              attention.procedure || attention.reason || "Atención clínica",
          },
        ];
      }),
    [patients, attentions, txs],
  );

  const directRows = useMemo<BalanceRow[]>(() => {
    const ids = Array.from(
      new Set(
        txs
          .filter(
            (tx) =>
              tx.patientId &&
              !tx.attentionId &&
              tx.operationId?.startsWith("CHG-") &&
              (tx.origin === "patient-payment" ||
                tx.origin === "patient-charge"),
          )
          .map((tx) => tx.operationId as string),
      ),
    );
    return ids.flatMap((operationId) => {
      const group = txs.filter(
          (tx) => tx.operationId === operationId && tx.status !== "Anulado",
        ),
        sample = group[0],
        patient = patients.find((item) => item.id === sample?.patientId);
      if (!patient) return [];
      const paid = group
        .filter(
          (tx) => tx.origin === "patient-payment" && tx.status !== "Pendiente",
        )
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const balance = group
        .filter(
          (tx) => tx.origin === "patient-charge" && tx.status === "Pendiente",
        )
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const concept =
        group.find((tx) => tx.origin === "patient-payment")?.concept ||
        String(
          group.find((tx) => tx.origin === "patient-charge")?.concept ||
            "Cobro directo",
        ).replace(/^Saldo · /, "");
      return [
        {
          patient,
          paid,
          balance,
          total: paid + balance,
          concept,
          operationId,
          direct: true,
        },
      ];
    });
  }, [patients, txs]);

  const allRows = useMemo(
    () =>
      [...attentionRows, ...directRows].sort((a, b) => {
        const ad =
          a.attention?.createdAt ||
          txs.find((tx) => tx.operationId === a.operationId)?.createdAt ||
          "";
        const bd =
          b.attention?.createdAt ||
          txs.find((tx) => tx.operationId === b.operationId)?.createdAt ||
          "";
        return bd.localeCompare(ad);
      }),
    [attentionRows, directRows, txs],
  );
  const summaries = useMemo<PatientSummary[]>(
    () =>
      patients
        .filter(
          (patient) =>
            !clean ||
            `${patient.name} ${patient.code} ${patient.phone}`
              .toLowerCase()
              .includes(clean),
        )
        .map((patient) => {
          const rows = allRows.filter((row) => row.patient.id === patient.id);
          return {
            patient,
            rows,
            total: rows.reduce((sum, row) => sum + row.total, 0),
            paid: rows.reduce((sum, row) => sum + row.paid, 0),
            balance: rows.reduce((sum, row) => sum + row.balance, 0),
          };
        }),
    [patients, allRows, clean],
  );
  const visibleRows = useMemo(
    () =>
      allRows.filter(
        (item) =>
          !clean ||
          `${item.patient.name} ${item.patient.code} ${item.concept}`
            .toLowerCase()
            .includes(clean),
      ),
    [allRows, clean],
  );
  const pendingTotal = allRows.reduce((total, row) => total + row.balance, 0);

  return (
    <>
      <section className="panel" style={{ display: "grid", gap: 14 }}>
        <div
          className="title"
          style={{ marginBottom: 0, alignItems: "center" }}
        >
          <div>
            <h3>Estado de cuenta por paciente</h3>
            <p>
              Busca cualquier paciente registrado para cobrar, revisar pagos o
              registrar un abono.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span className="tag" style={{ fontSize: 10 }}>
              {money(pendingTotal)} pendiente
            </span>
            <Button
              className="gold"
              type="button"
              style={compactActionStyle}
              onClick={() => setNewChargePatientId(0)}
            >
              <Plus />
              Nuevo cobro
            </Button>
          </div>
        </div>
        <div className="search" style={{ marginBottom: 0, maxWidth: 620 }}>
          <Search />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar paciente por nombre, historia o teléfono"
          />
        </div>
        {clean && (
          <div style={{ display: "grid", gap: 6 }}>
            {summaries.length ? (
              summaries.map((summary) => {
                const pending = summary.rows.find((row) => row.balance > 0);
                return (
                  <div
                    key={summary.patient.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      minHeight: 52,
                      border: "1px solid #e6ebe8",
                      borderRadius: 10,
                      background: "#fff",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className="avatar"
                      style={{ width: 34, height: 34, minWidth: 34 }}
                    >
                      <UserRound style={{ width: 18, height: 18 }} />
                    </span>
                    <div style={{ minWidth: 180, flex: 1, lineHeight: 1.25 }}>
                      <b
                        style={{
                          display: "block",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {summary.patient.name}
                      </b>
                      <small
                        style={{
                          display: "block",
                          fontSize: 11,
                          color: "#7a8581",
                          marginTop: 2,
                        }}
                      >
                        {summary.patient.code} · {summary.patient.phone}
                      </small>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gap: 1,
                        minWidth: 90,
                        lineHeight: 1.2,
                      }}
                    >
                      <small style={{ fontSize: 10, color: "#7a8581" }}>
                        Saldo
                      </small>
                      <b style={{ fontSize: 12, fontWeight: 600 }}>
                        {money(summary.balance)}
                      </b>
                    </div>
                    {pending ? (
                      <Button
                        type="button"
                        variant="outline"
                        style={compactActionStyle}
                        onClick={() => setSelected(pending)}
                      >
                        Registrar abono
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        style={compactActionStyle}
                        onClick={() =>
                          setNewChargePatientId(summary.patient.id)
                        }
                      >
                        <Plus />
                        Nuevo cobro
                      </Button>
                    )}
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: "14px",
                  textAlign: "center",
                  color: "#7d8581",
                  fontSize: 12,
                }}
              >
                No se encontró ningún paciente con ese nombre, historia o
                teléfono.
              </div>
            )}
          </div>
        )}
        {visibleRows.length ? (
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Concepto</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.attention?.id || row.operationId}>
                    <td>
                      <b>
                        {row.patient.name}
                        <small>{row.patient.code}</small>
                      </b>
                    </td>
                    <td>{row.concept}</td>
                    <td>{money(row.total)}</td>
                    <td className="green">{money(row.paid)}</td>
                    <td className={row.balance > 0 ? "red" : "green"}>
                      {money(row.balance)}
                    </td>
                    <td>
                      {row.balance > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          style={compactActionStyle}
                          onClick={() => setSelected(row)}
                        >
                          Registrar abono
                        </Button>
                      ) : (
                        <span className="tag">Pagado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !clean ? (
          <div
            style={{
              padding: "18px",
              textAlign: "center",
              color: "#7d8581",
              fontSize: 12,
            }}
          >
            No hay cobros todavía. Usa “Nuevo cobro” o busca un paciente
            registrado.
          </div>
        ) : null}
      </section>
      <PaymentDialog
        row={selected}
        close={() => setSelected(null)}
        onPayment={onPayment}
      />
      <NewChargeDialog
        key={`new-charge-${newChargePatientId ?? "closed"}`}
        open={newChargePatientId !== null}
        initialPatientId={newChargePatientId || undefined}
        patients={patients}
        close={() => setNewChargePatientId(null)}
      />
    </>
  );
}

function NewChargeDialog({
  open,
  initialPatientId,
  patients,
  close,
}: {
  open: boolean;
  initialPatientId?: number;
  patients: Patient[];
  close: () => void;
}) {
  const [error, setError] = useState("");
  const services = useMemo(() => readServices(), [open]);
  const [source, setSource] = useState("custom");
  const [concept, setConcept] = useState("");
  const [total, setTotal] = useState("");
  if (!open) return null;
  const chooseSource = (value: string) => {
    setSource(value);
    setError("");
    if (value === "custom") {
      setConcept("");
      setTotal("");
      return;
    }
    const service = services.find((item) => String(item.id) === value);
    if (service) {
      setConcept(service.name);
      setTotal(String(service.price));
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget),
      patientId = Number(data.get("patient")),
      patient = patients.find((item) => item.id === patientId),
      cleanConcept = concept.trim(),
      totalValue = Number(total),
      paid = Number(data.get("paid")),
      method = String(data.get("method") || "Efectivo"),
      serviceId = source !== "custom" ? Number(source) : undefined;
    if (!patient) {
      setError("Selecciona un paciente válido.");
      return;
    }
    if (!cleanConcept) {
      setError("Indica el motivo o detalle del cobro.");
      return;
    }
    if (!Number.isFinite(totalValue) || totalValue <= 0) {
      setError("Ingresa un importe total válido.");
      return;
    }
    if (!Number.isFinite(paid) || paid < 0) {
      setError("Ingresa cuánto está pagando el paciente.");
      return;
    }
    if (paid > totalValue + 0.001) {
      setError("El pago no puede superar el importe total del cobro.");
      return;
    }
    saveDirectCharge(
      patient,
      cleanConcept,
      totalValue,
      paid,
      method,
      Number.isFinite(serviceId) ? serviceId : undefined,
    );
    await runtimeStore.flush();
    close();
  };
  return (
    <Dialog open onOpenChange={(value) => !value && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cobro</DialogTitle>
          <DialogDescription>
            Úsalo para un costo adicional. Puedes tomar un servicio ya creado o
            registrar un concepto libre sin crear un servicio nuevo.
          </DialogDescription>
        </DialogHeader>
        <form className="form" onSubmit={submit}>
          <label className="field">
            <Label>Paciente</Label>
            <select
              name="patient"
              defaultValue={initialPatientId ?? patients[0]?.id}
              required
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} · {patient.code}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <Label>Tipo de cobro</Label>
            <select
              value={source}
              onChange={(event) => chooseSource(event.target.value)}
            >
              <option value="custom">Otro concepto / costo adicional</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {money(service.price)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <Label>Motivo / detalle del cobro</Label>
            <Input
              value={concept}
              onChange={(event) => setConcept(event.target.value)}
              placeholder="Ej. Material adicional del procedimiento"
              required
            />
          </label>
          <div className="cols">
            <label className="field">
              <Label>Importe total (Bs)</Label>
              <Input
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="100"
                required
              />
            </label>
            <label className="field">
              <Label>Pago recibido ahora (Bs)</Label>
              <Input
                name="paid"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder={total || "0"}
                required
              />
            </label>
          </div>
          {source !== "custom" && (
            <p className="form-note" style={{ margin: 0 }}>
              El servicio carga su precio configurado como referencia. Puedes
              ajustar el importe o ampliar el detalle antes de guardar.
            </p>
          )}
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
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button className="gold" type="submit">
              Registrar cobro
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  row,
  close,
  onPayment,
}: {
  row: BalanceRow | null;
  close: () => void;
  onPayment: (
    patientId: number,
    attentionId: number,
    amount: number,
    method: string,
  ) => string;
}) {
  const [error, setError] = useState("");
  if (!row) return null;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget),
      amount = Number(data.get("amount")),
      method = String(data.get("method") || "Efectivo");
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingresa un importe válido.");
      return;
    }
    if (amount > row.balance + 0.001) {
      setError(`El abono no puede superar el saldo de ${money(row.balance)}.`);
      return;
    }
    if (row.direct) {
      const message = saveDirectPayment(row, amount, method);
      if (message) {
        setError(message);
        return;
      }
      await runtimeStore.flush();
      close();
      return;
    }
    if (!row.attention) {
      setError("No se encontró la atención asociada.");
      return;
    }
    const message = onPayment(row.patient.id, row.attention.id, amount, method);
    if (message) {
      setError(message);
      return;
    }
    close();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar abono</DialogTitle>
          <DialogDescription>
            {row.patient.name} · {row.concept}
          </DialogDescription>
        </DialogHeader>
        <form className="form" onSubmit={submit}>
          <div
            className="metrics"
            style={{ gridTemplateColumns: "repeat(3,1fr)" }}
          >
            <Mini
              icon={<CircleDollarSign />}
              label="Total"
              value={money(row.total)}
            />
            <Mini
              icon={<WalletCards />}
              label="Pagado"
              value={money(row.paid)}
            />
            <Mini
              icon={<WalletCards />}
              label="Saldo"
              value={money(row.balance)}
            />
          </div>
          <label className="field">
            <Label>Importe del abono</Label>
            <Input
              name="amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              max={row.balance}
              step="0.01"
              defaultValue={row.balance}
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
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button className="gold" type="submit">
              Registrar abono
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Mini({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="metric" style={{ minHeight: 96, paddingLeft: 48 }}>
      <span style={{ width: 28, height: 28 }}>{icon}</span>
      <p>{label}</p>
      <strong style={{ fontSize: 18 }}>{value}</strong>
    </article>
  );
}


export function PaymentsPanel({
  patients,
  attentions,
  txs,
  onPayment,
}: {
  patients: Patient[];
  attentions: Attention[];
  txs: Tx[];
  onPayment: (
    patientId: number,
    attentionId: number,
    amount: number,
    method: string,
  ) => string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{
    attention: Attention;
    patient: Patient;
    balance: number;
  } | null>(null);
  const [error, setError] = useState("");
  const clean = query.trim().toLowerCase();

  const payments = useMemo(
    () =>
      txs
        .filter(
          (tx) =>
            tx.origin === "patient-payment" &&
            tx.type === "Ingreso" &&
            tx.status !== "Pendiente" &&
            tx.status !== "Anulado",
        )
        .filter((tx) => {
          if (!clean) return true;
          const patient = patients.find((item) => item.id === tx.patientId);
          return `${patient?.name || tx.reference} ${patient?.code || ""} ${tx.concept} ${tx.method}`
            .toLowerCase()
            .includes(clean);
        })
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [txs, patients, clean],
  );

  const pending = useMemo(
    () =>
      attentions.flatMap((attention) => {
        const patient = patients.find((item) => item.id === attention.patientId);
        if (!patient) return [];
        const paid = txs
          .filter(
            (tx) =>
              tx.patientId === attention.patientId &&
              tx.attentionId === attention.id &&
              tx.origin === "patient-payment" &&
              tx.status !== "Pendiente" &&
              tx.status !== "Anulado",
          )
          .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        const balance = Math.max(0, (Number(attention.totalCost) || 0) - paid);
        if (balance <= 0) return [];
        if (
          clean &&
          !`${patient.name} ${patient.code} ${attention.procedure} ${attention.reason}`
            .toLowerCase()
            .includes(clean)
        )
          return [];
        return [{ attention, patient, balance }];
      }),
    [attentions, patients, txs, clean],
  );

  const totalReceived = payments.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0,
  );
  const totalPending = pending.reduce((sum, item) => sum + item.balance, 0);

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount")) || 0;
    const method = String(form.get("method") || "Efectivo");
    const message = onPayment(
      selected.patient.id,
      selected.attention.id,
      amount,
      method,
    );
    if (message) {
      setError(message);
      return;
    }
    setSelected(null);
  };

  return (
    <>
      <section className="panel" style={{ display: "grid", gap: 14 }}>
        <div className="title" style={{ marginBottom: 0, alignItems: "center" }}>
          <div>
            <h3>Pagos recibidos</h3>
            <p>
              Historial de pagos y abonos ya realizados. Los cobros nuevos y la
              gestión de caja permanecen en Caja y cobros.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="tag">{money(totalReceived)} recibido</span>
            <span className="tag">{money(totalPending)} por cobrar</span>
          </div>
        </div>

        <div className="search" style={{ marginBottom: 0, maxWidth: 620 }}>
          <Search />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pago por paciente, concepto o método"
          />
        </div>

        {pending.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            <b style={{ fontSize: 13 }}>Saldos pendientes con opción de abono</b>
            {pending.map(({ attention, patient, balance }) => (
              <div
                key={attention.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  border: "1px solid #e6ebe8",
                  borderRadius: 10,
                  background: "#fff",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 180, flex: 1 }}>
                  <b style={{ display: "block", fontSize: 13 }}>{patient.name}</b>
                  <small style={{ color: "#7a8581" }}>
                    {attention.procedure || attention.reason || "Atención clínica"}
                  </small>
                </div>
                <strong>{money(balance)}</strong>
                <Button
                  type="button"
                  variant="outline"
                  style={compactActionStyle}
                  onClick={() => setSelected({ attention, patient, balance })}
                >
                  Registrar pago
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Paciente</th>
                <th>Concepto</th>
                <th>Método</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {payments.length ? (
                payments.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.date}</td>
                    <td>{patients.find((item) => item.id === tx.patientId)?.name || tx.reference}</td>
                    <td>{tx.concept}</td>
                    <td>{tx.method}</td>
                    <td><strong>{money(Number(tx.amount) || 0)}</strong></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#7a8581" }}>
                    No hay pagos registrados para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <Dialog open onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar pago</DialogTitle>
              <DialogDescription>
                {selected.patient.name} · Saldo {money(selected.balance)}
              </DialogDescription>
            </DialogHeader>
            <form className="form" onSubmit={submitPayment}>
              <div className="cols">
                <div>
                  <Label htmlFor="payment-amount">Importe</Label>
                  <Input
                    id="payment-amount"
                    name="amount"
                    type="number"
                    min="0.01"
                    max={selected.balance}
                    step="0.01"
                    defaultValue={selected.balance}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="payment-method">Método</Label>
                  <select id="payment-method" name="method" defaultValue="Efectivo">
                    <option>Efectivo</option>
                    <option>QR</option>
                    <option>Transferencia</option>
                    <option>Tarjeta</option>
                    <option>Otro</option>
                  </select>
                </div>
              </div>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <div className="form-actions">
                <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                  Cancelar
                </Button>
                <Button className="gold" type="submit">Registrar pago</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
