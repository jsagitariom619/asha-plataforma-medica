from pathlib import Path

page = Path('app/page.tsx')
products = Path('app/products.tsx')

p = page.read_text()
p = p.replace('  CashPanel,\n  MovementsPanel,\n', '  CashPanel,\n  ExpensesPanel,\n  MovementsPanel,\n')
p = p.replace('import { PatientBillingPanel, PaymentsPanel } from "@/app/patient-billing";', 'import { PatientBillingPanel } from "@/app/patient-billing";')
p = p.replace('  "Pagos",\n', '  "Egresos",\n')
p = p.replace('["Pagos", Banknote],', '["Egresos", ArrowDownRight],')
p = p.replace('"Productos", "Pagos", "Caja y cobros"', '"Productos", "Egresos", "Caja y cobros"')
p = p.replace('(module === "Pagos" && (currentUser.permissions ?? []).includes("Caja y cobros"))', '(module === "Egresos" && ((currentUser.permissions ?? []).includes("Caja y cobros") || (currentUser.permissions ?? []).includes("Pagos")))')
p = p.replace('{section === "Pagos" && (\n            <>\n              <SectionLead text="Pagos recibidos de pacientes y abonos registrados" />\n              <PaymentsPanel\n                patients={patients}\n                attentions={attentions}\n                txs={txs}\n                onPayment={registerPatientPayment}\n              />\n            </>\n          )}', '{section === "Egresos" && (\n            <>\n              <SectionLead text="Salidas de dinero, gastos y compras registradas" />\n              <ExpensesPanel\n                txs={txs}\n                onAdd={(expense) => {\n                  setTxs((current) => [expense, ...current]);\n                  notify("Egreso registrado correctamente");\n                }}\n              />\n            </>\n          )}')
# Compatibility in case the distinct-payments text differs slightly.
if 'section === "Pagos"' in p:
    start = p.index('          {section === "Pagos" && (')
    end = p.index('          {section === "Caja y cobros" && (', start)
    replacement = '''          {section === "Egresos" && (\n            <>\n              <SectionLead text="Salidas de dinero, gastos y compras registradas" />\n              <ExpensesPanel\n                txs={txs}\n                onAdd={(expense) => {\n                  setTxs((current) => [expense, ...current]);\n                  notify("Egreso registrado correctamente");\n                }}\n              />\n            </>\n          )}\n'''
    p = p[:start] + replacement + p[end:]

page.write_text(p)

s = products.read_text()
marker = 'export function MovementsPanel'
if 'export function ExpensesPanel' not in s:
    component = r'''
export function ExpensesPanel({txs,onAdd}:{txs:Tx[];onAdd:(tx:Tx)=>void}){
  const [open,setOpen]=useState(false),[query,setQuery]=useState("");
  const rows=useMemo(()=>txs.filter(t=>t.type==="Egreso"&&(`${t.concept} ${t.reference} ${t.category??""} ${t.note??""}`).toLowerCase().includes(query.toLowerCase())),[txs,query]);
  const total=txs.filter(t=>t.type==="Egreso"&&t.status!=="Anulado").reduce((sum,t)=>sum+(Number(t.amount)||0),0);
  const purchases=txs.filter(t=>t.type==="Egreso"&&t.origin==="product-purchase"&&t.status!=="Anulado").reduce((sum,t)=>sum+(Number(t.amount)||0),0);
  const operating=Math.max(0,total-purchases);
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget),amount=Math.max(0,Number(f.get("amount"))||0);if(!amount)return;const stamp=Date.now();onAdd({id:stamp,concept:String(f.get("concept")||"").trim(),reference:String(f.get("reference")||"").trim()||"ASHA",type:"Egreso",amount,date:new Intl.DateTimeFormat("es-BO",{timeZone:"America/La_Paz",dateStyle:"short",timeStyle:"short"}).format(new Date()),createdAt:new Date().toISOString(),method:String(f.get("method")||"Efectivo"),status:"Pagado",origin:"manual",operationId:`EG-${stamp}`,category:String(f.get("category")||"Otros"),note:String(f.get("note")||"").trim()});setOpen(false)};
  return <>
    <div className="metrics finance"><Metric icon={ArrowDownRight} label="Egresos totales" value={money(total)} note={`${rows.length} registros visibles`}/><Metric icon={PackageOpen} label="Compras de productos" value={money(purchases)} note="Costos ligados a inventario"/><Metric icon={WalletCards} label="Gastos operativos" value={money(operating)} note="Egresos no vinculados a compras"/></div>
    <div className="product-toolbar panel"><div className="search"><Search/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar egreso por concepto, proveedor o categoría"/></div><Button className="gold" onClick={()=>setOpen(true)}>Nuevo egreso</Button></div>
    <section className="panel"><div className="title"><div><h3>Registro de egresos</h3><p>Salidas de dinero: gastos operativos, compras, servicios y otros pagos realizados por ASHA.</p></div></div>{rows.length?<Table rows={rows} detailed/>:<p>Sin egresos registrados.</p>}</section>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Registrar egreso</DialogTitle><DialogDescription>Este registro se reflejará también en Movimientos y Contabilidad.</DialogDescription></DialogHeader><form className="form" onSubmit={submit}><Field label="Concepto"><Input name="concept" placeholder="Ej. Alquiler, insumos, publicidad" required/></Field><Field label="Proveedor / beneficiario"><Input name="reference" placeholder="Nombre o referencia"/></Field><Field label="Categoría"><select name="category" defaultValue="Otros"><option>Alquiler</option><option>Servicios básicos</option><option>Insumos</option><option>Personal</option><option>Marketing</option><option>Mantenimiento</option><option>Transporte</option><option>Impuestos</option><option>Otros</option></select></Field><div className="cols"><Field label="Importe (Bs)"><Input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required/></Field><Field label="Método"><select name="method"><option>Efectivo</option><option>QR</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></Field></div><Field label="Observación"><Textarea name="note" rows={2}/></Field><div className="form-actions"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button className="gold" type="submit">Registrar egreso</Button></div></form></DialogContent></Dialog>
  </>
}

'''
    s = s.replace(marker, component + marker)
products.write_text(s)

# Guardrails
assert '"Egresos"' in p
assert 'section === "Pagos"' not in p
assert 'PaymentsPanel' not in p
assert 'export function ExpensesPanel' in s
