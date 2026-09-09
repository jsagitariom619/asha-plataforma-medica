from pathlib import Path

path = Path('app/page.tsx')
text = path.read_text(encoding='utf-8')
old = '        appointmentManualAllowed={isPrimary}\n'
new = '        appointmentManualAllowed={canAccess("Agenda")}\n'
if old not in text:
    raise SystemExit('Expected appointmentManualAllowed binding not found; aborting without changes.')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
