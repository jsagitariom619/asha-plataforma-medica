from pathlib import Path

page = Path('app/page.tsx')
s = page.read_text()
s = s.replace('useState("Dra. Andrea Vargas")','useState("Profesional ASHA")',1)
s = s.replace('[dateLabel, setDateLabel] = useState("Viernes, 4 de septiembre")','[dateLabel, setDateLabel] = useState(todayLabel())',1)
page.write_text(s)

layout = Path('app/layout.tsx')
l = layout.read_text()
l = l.replace('import "./test-data-reset.css";\n','',1)
layout.write_text(l)
