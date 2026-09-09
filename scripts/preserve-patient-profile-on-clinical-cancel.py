from pathlib import Path

profile = Path('components/patient-profile.tsx')
text = profile.read_text()
old = '''  const dispatch = (name: string, detail: Record<string, string>) => {\n    window.dispatchEvent(new CustomEvent(name, { detail }));\n    setPatient(null);\n  };'''
new = '''  const dispatch = (name: string, detail: Record<string, string>) => {\n    // Keep the patient expediente mounted while a clinical child dialog is open.\n    // Closing/cancelling the child returns to this same expediente.\n    window.dispatchEvent(new CustomEvent(name, { detail }));\n  };'''
if old not in text:
    raise SystemExit('Expected patient-profile dispatch block not found')
text = text.replace(old, new, 1)
old_escape = '''    const onKey = (event: KeyboardEvent) => {\n      if (event.key === "Escape") setPatient(null);\n    };'''
new_escape = '''    const onKey = (event: KeyboardEvent) => {\n      if (event.key !== "Escape") return;\n      // A clinical editor is a child of the expediente. Escape closes the child first.\n      if (document.querySelector(".aesthetic-history-layer")) return;\n      setPatient(null);\n    };'''
if old_escape not in text:
    raise SystemExit('Expected patient-profile Escape block not found')
text = text.replace(old_escape, new_escape, 1)
profile.write_text(text)

history = Path('components/aesthetic-history.tsx')
text = history.read_text()
# Avoid synthetic Escape: it was also reaching the parent expediente listener.
text = text.replace('''  saveError: string;\n}) {''', '''  saveError: string;\n  onCancel: () => void;\n}) {''', 1)
# Instead of widening form props throughout the large component, replace only Cancel buttons
# with a dedicated custom event consumed by the editor itself.
text = text.replace('''          onClick={() =>\n            document.dispatchEvent(\n              new KeyboardEvent("keydown", { key: "Escape" }),\n            )\n          }''', '''          onClick={() =>\n            window.dispatchEvent(new CustomEvent("asha-close-aesthetic-history"))\n          }''')
# The accidental prop declaration above is not needed; remove it if inserted.
text = text.replace('''  saveError: string;\n  onCancel: () => void;\n}) {''', '''  saveError: string;\n}) {''', 1)
needle = '''    window.addEventListener(\n      "asha-open-aesthetic-history",\n      onEvolution as EventListener,\n    );'''
replacement = needle + '''\n    const onClose = () => setMode(null);\n    window.addEventListener(\n      "asha-close-aesthetic-history",\n      onClose as EventListener,\n    );'''
if needle not in text:
    raise SystemExit('Expected aesthetic event registration not found')
text = text.replace(needle, replacement, 1)
needle2 = '''      window.removeEventListener(\n        "asha-open-aesthetic-history",\n        onEvolution as EventListener,\n      );'''
replacement2 = needle2 + '''\n      window.removeEventListener(\n        "asha-close-aesthetic-history",\n        onClose as EventListener,\n      );'''
if needle2 not in text:
    raise SystemExit('Expected aesthetic event cleanup not found')
text = text.replace(needle2, replacement2, 1)
history.write_text(text)
