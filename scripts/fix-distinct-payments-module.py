from pathlib import Path

page = Path('app/page.tsx')
billing = Path('app/patient-billing.tsx')

p = page.read_text(encoding='utf-8')
p = p.replace(
    'import { PatientBillingPanel } from "@/app/patient-billing";',
    'import { PatientBillingPanel, PaymentsPanel } from "@/app/patient-billing";'
)
old = '''          {section === "Pagos" && (\n            <>\n              <SectionLead text="Pagos de pacientes, saldos y abonos registrados" />\n              <PatientBillingPanel\n                patients={patients}\n                attentions={attentions}\n                txs={txs}\n                onPayment={registerPatientPayment}\n              />\n            </>\n          )}'''
new = '''          {section === "Pagos" && (\n            <>\n              <SectionLead text="Registro de pagos recibidos y abonos de pacientes" />\n              <PaymentsPanel\n                patients={patients}\n                attentions={attentions}\n                txs={txs}\n                onPayment={registerPatientPayment}\n              />\n            </>\n          )}'''
if old not in p:
    raise SystemExit('Pagos section not found')
p = p.replace(old, new)
page.write_text(p, encoding='utf-8')

b = billing.read_text(encoding='utf-8')
marker = '\nexport function PaymentsPanel('
if marker not in b:
    b += r'''

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
'''
billing.write_text(b, encoding='utf-8')
