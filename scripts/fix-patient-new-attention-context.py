from pathlib import Path

profile = Path('components/patient-profile.tsx')
text = profile.read_text()
old = '''  const openAttention = () => {\n    const name = patient.name;\n    setPatient(null);\n    window.setTimeout(\n      () =>\n        window.dispatchEvent(\n          new CustomEvent("asha-open-new-attention", {\n            detail: { patient: name },\n          }),\n        ),\n      0,\n    );\n  };'''
new = '''  const openAttention = () => {\n    // Open the existing attention editor for this patient without closing the expediente.\n    window.dispatchEvent(\n      new CustomEvent("asha-open-attention-for-patient", {\n        detail: { patient: patient.name },\n      }),\n    );\n  };'''
if old not in text:
    raise SystemExit('Expected patient-profile openAttention block not found')
profile.write_text(text.replace(old, new, 1))

page = Path('app/page.tsx')
text = page.read_text()
anchor = '''  const openAttention = (patientId?: number) => {\n    setAttentionPatientId(patientId ?? null);\n    setModal("history");\n  };\n'''
insert = '''  const openAttention = (patientId?: number) => {\n    setAttentionPatientId(patientId ?? null);\n    setModal("history");\n  };\n  useEffect(() => {\n    const onOpenAttentionForPatient = (event: Event) => {\n      const name =\n        (event as CustomEvent<{ patient?: string }>).detail?.patient?.trim() || "";\n      if (!name) return;\n      const selected = patients.find((patient) => patient.name === name);\n      if (selected) openAttention(selected.id);\n    };\n    window.addEventListener(\n      "asha-open-attention-for-patient",\n      onOpenAttentionForPatient as EventListener,\n    );\n    return () =>\n      window.removeEventListener(\n        "asha-open-attention-for-patient",\n        onOpenAttentionForPatient as EventListener,\n      );\n  }, [patients]);\n'''
if anchor not in text:
    raise SystemExit('Expected page openAttention anchor not found')
page.write_text(text.replace(anchor, insert, 1))
