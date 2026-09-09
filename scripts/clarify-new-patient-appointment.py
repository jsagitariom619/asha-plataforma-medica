from pathlib import Path

path = Path('app/page.tsx')
text = path.read_text()
old = '''                  Registrar paciente manualmente para esta cita
'''
new = '''                  Paciente nuevo / no registrado (primera vez)
'''
if old not in text:
    raise SystemExit('Expected agenda manual-patient label not found')
text = text.replace(old, new, 1)
old2 = '''                    placeholder="Nombre completo"
'''
new2 = '''                    placeholder="Nombre completo del paciente nuevo"
'''
if old2 not in text:
    raise SystemExit('Expected manual-patient placeholder not found')
text = text.replace(old2, new2, 1)
path.write_text(text)
