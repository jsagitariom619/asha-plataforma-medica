from pathlib import Path
p=Path('app/page.tsx')
s=p.read_text()

def rep(old,new,count=1):
    global s
    if old not in s:
        raise SystemExit('pattern not found: '+old[:120])
    s=s.replace(old,new,count)

rep('  "Productos",\n  "Caja y cobros",', '  "Productos",\n  "Pagos",\n  "Caja y cobros",')
rep('const operational = ["Resumen", "Pacientes", "Agenda", "Servicios", "Productos", "Caja y cobros"];', 'const operational = ["Resumen", "Pacientes", "Agenda", "Servicios", "Productos", "Pagos", "Caja y cobros"];')
rep('  ["Productos", PackageOpen],\n  ["Caja y cobros", WalletCards],', '  ["Productos", PackageOpen],\n  ["Pagos", Banknote],\n  ["Caja y cobros", WalletCards],')
rep('  const canAccess = (module: string) =>\n    !!currentUser &&\n    (isPrimary || (currentUser.permissions ?? []).includes(module));', '  const canAccess = (module: string) =>\n    !!currentUser &&\n    (isPrimary ||\n      (currentUser.permissions ?? []).includes(module) ||\n      (module === "Pagos" && (currentUser.permissions ?? []).includes("Caja y cobros")));')
rep('          {section === "Caja y cobros" && (\n            <>', '          {section === "Pagos" && (\n            <>\n              <SectionLead text="Pagos de pacientes, saldos y abonos registrados" />\n              <PatientBillingPanel\n                patients={patients}\n                attentions={attentions}\n                txs={txs}\n                onPayment={registerPatientPayment}\n              />\n            </>\n          )}\n          {section === "Caja y cobros" && (\n            <>')
rep('    [manualAppointment, setManualAppointment] = useState(false),\n    [newUserRole, setNewUserRole]', '    [manualAppointment, setManualAppointment] = useState(false),\n    [manualAppointmentService, setManualAppointmentService] = useState(false),\n    [newUserRole, setNewUserRole]')
rep('    setManualAppointment(false);\n    setNewUserRole("Médico");', '    setManualAppointment(false);\n    setManualAppointmentService(false);\n    setNewUserRole("Médico");')
old='''      addAppointment({\n        id,\n        date: String(f.get("date") || selectedAgendaDate),\n        time: String(f.get("time")),\n        patient: patientName,\n        service: String(f.get("service")),\n        status: String(f.get("appointmentStatus")),\n      });'''
new='''      const serviceName = manualAppointmentService\n        ? String(f.get("manualService") || "").trim()\n        : String(f.get("service") || "").trim();\n      if (!serviceName) {\n        setError("Ingresa o selecciona un servicio.");\n        return;\n      }\n      addAppointment({\n        id,\n        date: String(f.get("date") || selectedAgendaDate),\n        time: String(f.get("time")),\n        patient: patientName,\n        service: serviceName,\n        status: String(f.get("appointmentStatus")),\n      });'''
rep(old,new)
old='''              <Field label="Servicio">\n                <select name="service" required>\n                  {services\n                    .filter((s) => s.active)\n                    .map((s) => (\n                      <option key={s.id} value={s.name}>\n                        {s.name}\n                      </option>\n                    ))}\n                </select>\n              </Field>'''
new='''              <label className="form-note" style={{ display: "flex", gap: 8, alignItems: "center" }}>\n                <input\n                  type="checkbox"\n                  checked={manualAppointmentService}\n                  onChange={(event) => setManualAppointmentService(event.target.checked)}\n                />\n                Registrar servicio manualmente para esta cita\n              </label>\n              {manualAppointmentService ? (\n                <Field label="Servicio (registro manual)">\n                  <Input\n                    name="manualService"\n                    placeholder="Ej. Control, valoración, procedimiento especial"\n                    required\n                  />\n                </Field>\n              ) : (\n                <Field label="Servicio">\n                  <select name="service" required>\n                    {services\n                      .filter((s) => s.active)\n                      .map((s) => (\n                        <option key={s.id} value={s.name}>\n                          {s.name}\n                        </option>\n                      ))}\n                  </select>\n                </Field>\n              )}'''
rep(old,new)
p.write_text(s)
print('patched app/page.tsx')
