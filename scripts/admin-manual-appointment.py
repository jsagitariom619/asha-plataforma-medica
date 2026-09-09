from pathlib import Path

path = Path('app/page.tsx')
text = path.read_text()

replacements = [
("""        selectedAgendaDate={selectedAgendaDate}\n        addPatient={(p) => setPatients((v) => [p, ...v])}""",
 """        selectedAgendaDate={selectedAgendaDate}\n        appointmentManualAllowed={isPrimary}\n        addPatient={(p) => setPatients((v) => [p, ...v])}"""),
("""  selectedAgendaDate,\n  addPatient,""",
 """  selectedAgendaDate,\n  appointmentManualAllowed,\n  addPatient,"""),
("""  selectedAgendaDate: string;\n  addPatient: (p: Patient) => void;""",
 """  selectedAgendaDate: string;\n  appointmentManualAllowed: boolean;\n  addPatient: (p: Patient) => void;"""),
("""  const [error, setError] = useState(\"\"),\n    [busy, setBusy] = useState(false),\n    [newUserRole, setNewUserRole] = useState(\"Médico\"),""",
 """  const [error, setError] = useState(\"\"),\n    [busy, setBusy] = useState(false),\n    [manualAppointment, setManualAppointment] = useState(false),\n    [newUserRole, setNewUserRole] = useState(\"Médico\"),"""),
("""    setBusy(false);\n    setNewUserRole(\"Médico\");""",
 """    setBusy(false);\n    setManualAppointment(false);\n    setNewUserRole(\"Médico\");"""),
("""    if (type === \"appointment\")\n      addAppointment({\n        id,\n        date: String(f.get(\"date\") || selectedAgendaDate),\n        time: String(f.get(\"time\")),\n        patient: String(f.get(\"patient\")),\n        service: String(f.get(\"service\")),\n        status: String(f.get(\"appointmentStatus\")),\n      });""",
 """    if (type === \"appointment\") {\n      const patientName =\n        appointmentManualAllowed && manualAppointment\n          ? String(f.get(\"manualPatient\") || \"\").trim()\n          : String(f.get(\"patient\") || \"\").trim();\n      if (!patientName) {\n        setError(\"Ingresa o selecciona un paciente.\");\n        return;\n      }\n      addAppointment({\n        id,\n        date: String(f.get(\"date\") || selectedAgendaDate),\n        time: String(f.get(\"time\")),\n        patient: patientName,\n        service: String(f.get(\"service\")),\n        status: String(f.get(\"appointmentStatus\")),\n      });\n    }"""),
("""              <Field label=\"Paciente\">\n                <select name=\"patient\" required>\n                  {patients.map((p) => (\n                    <option key={p.id} value={p.name}>\n                      {p.name}\n                    </option>\n                  ))}\n                </select>\n              </Field>""",
 """              {appointmentManualAllowed && (\n                <label className=\"form-note\" style={{ display: \"flex\", gap: 8, alignItems: \"center\" }}>\n                  <input\n                    type=\"checkbox\"\n                    checked={manualAppointment}\n                    onChange={(event) => setManualAppointment(event.target.checked)}\n                  />\n                  Registrar paciente manualmente para esta cita\n                </label>\n              )}\n              {appointmentManualAllowed && manualAppointment ? (\n                <Field label=\"Paciente (registro manual)\">\n                  <Input\n                    name=\"manualPatient\"\n                    placeholder=\"Nombre completo\"\n                    required\n                    autoFocus\n                  />\n                </Field>\n              ) : (\n                <Field label=\"Paciente\">\n                  <select name=\"patient\" required>\n                    {patients.map((p) => (\n                      <option key={p.id} value={p.name}>\n                        {p.name}\n                      </option>\n                    ))}\n                  </select>\n                </Field>\n              )}""")
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected block not found:\n{old[:180]}')
    text = text.replace(old, new, 1)

path.write_text(text)
