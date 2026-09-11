from pathlib import Path

path = Path('components/patient-profile.tsx')
text = path.read_text()

# 1) imports
text = text.replace('  Plus,\n  Stethoscope,', '  Plus,\n  ShoppingCart,\n  Stethoscope,')

# 2) extend transaction/product types
text = text.replace('  operationId?: string;\n};\ntype AccountRow', '  operationId?: string;\n  productId?: number;\n  productName?: string;\n  quantity?: number;\n  unitPrice?: number;\n  unitCost?: number;\n  stockDelta?: number;\n  note?: string;\n};\ntype Product = { id:number; name:string; salePrice:number; purchaseCost:number; stock:number; active:boolean; };\ntype SaleLine = { productId:number; quantity:number };\ntype AccountRow')

# 3) state
text = text.replace('    [txs, setTxs] = useState<Tx[]>([]),\n    [payment, setPayment] = useState<AccountRow | null>(null);', '    [txs, setTxs] = useState<Tx[]>([]),\n    [payment, setPayment] = useState<AccountRow | null>(null),\n    [saleOpen, setSaleOpen] = useState(false),\n    [saleLines, setSaleLines] = useState<SaleLine[]>([{ productId: 0, quantity: 1 }]),\n    [saleError, setSaleError] = useState(\"\");')

# 4) helper products
anchor = 'function readTxs(): Tx[] {\n  const data = readStore();\n  return Array.isArray(data?.txs) ? data.txs : [];\n}\n'
insert = anchor + 'function readProducts(): Product[] {\n  const data = readStore();\n  return (Array.isArray(data?.products) ? data.products : []).filter((item: Product) => item && item.active !== false);\n}\n'
text = text.replace(anchor, insert)

# 5) finance calculations
old = '''  const totals = useMemo(\n    () =>\n      account.reduce(\n        (acc, row) => ({\n          total: acc.total + (Number(row.attention.totalCost) || 0),\n          paid: acc.paid + row.paid,\n          balance: acc.balance + row.balance,\n        }),\n        { total: 0, paid: 0, balance: 0 },\n      ),\n    [account],\n  );\n  const firstPending = account.find((row) => row.balance > 0) || null;\n'''
new = '''  const productSales = useMemo(() =>\n    txs.filter((tx) => tx.patientId === patient?.id && tx.origin === \"product-sale\" && tx.status !== \"Anulado\"),\n    [txs, patient?.id],\n  );\n  const productPayments = useMemo(() =>\n    txs.filter((tx) => tx.patientId === patient?.id && tx.origin === \"patient-payment\" && tx.operationId?.startsWith(\"PVP-\") && tx.status !== \"Anulado\" && tx.status !== \"Pendiente\"),\n    [txs, patient?.id],\n  );\n  const treatmentTotal = account.reduce((sum,row)=>sum+(Number(row.attention.totalCost)||0),0);\n  const treatmentPaid = account.reduce((sum,row)=>sum+row.paid,0);\n  const productTotal = productSales.reduce((sum,tx)=>sum+(Number(tx.unitPrice)||0)*(Number(tx.quantity)||0),0);\n  const productPaidDirect = productSales.filter(tx=>tx.status!==\"Pendiente\").reduce((sum,tx)=>sum+(Number(tx.amount)||0),0);\n  const productPaid = productPaidDirect + productPayments.reduce((sum,tx)=>sum+(Number(tx.amount)||0),0);\n  const totals = {\n    treatmentTotal,\n    productTotal,\n    total: treatmentTotal + productTotal,\n    paid: treatmentPaid + productPaid,\n    balance: Math.max(0, treatmentTotal + productTotal - treatmentPaid - productPaid),\n  };\n  const firstPending = account.find((row) => row.balance > 0) || null;\n'''
if old not in text:
    raise SystemExit('finance anchor not found')
text = text.replace(old,new)

# 6) sale handler before return
anchor2 = '  const registerPayment = (event: FormEvent<HTMLFormElement>) => {'
idx = text.index(anchor2)
# place sale handler after registerPayment function block using anchor just before return
return_anchor = '\n  return (\n    <>\n'
handler = '''\n  const submitProductSale = (event: FormEvent<HTMLFormElement>) => {\n    event.preventDefault();\n    if (!patient) return;\n    const store = readStore();\n    const products: Product[] = readProducts();\n    const currentTxs: Tx[] = Array.isArray(store.txs) ? store.txs : [];\n    const valid = saleLines.filter(line=>line.productId && line.quantity>0);\n    if (!valid.length) { setSaleError(\"Selecciona al menos un producto.\"); return; }\n    for (const line of valid) {\n      const p = products.find(item=>item.id===line.productId);\n      if (!p || line.quantity > Number(p.stock||0)) { setSaleError(`Stock insuficiente para ${p?.name || \"el producto\"}.`); return; }\n    }\n    const form = new FormData(event.currentTarget);\n    const method = String(form.get(\"method\") || \"Efectivo\");\n    const status = String(form.get(\"status\") || \"Pagada\");\n    const note = String(form.get(\"note\") || \"\").trim();\n    const total = valid.reduce((sum,line)=>{ const p=products.find(item=>item.id===line.productId)!; return sum+p.salePrice*line.quantity; },0);\n    let paid = status===\"Pagada\" ? total : status===\"Pendiente\" ? 0 : Math.max(0,Math.min(total,Number(form.get(\"paid\"))||0));\n    const stamp = Date.now();\n    const operationId = `PVP-${patient.id}-${stamp}`;\n    const updatedProducts = products.map(p=>{ const line=valid.find(item=>item.productId===p.id); return line ? {...p,stock:Number(p.stock)-line.quantity}:p; });\n    const saleRows: Tx[] = valid.map((line,index)=>{\n      const p=products.find(item=>item.id===line.productId)!;\n      const subtotal=p.salePrice*line.quantity;\n      const allocation = total>0 ? Math.min(subtotal, paid * (subtotal/total)) : 0;\n      const remaining=Math.max(0,subtotal-allocation);\n      return {\n        id: stamp+index+1, concept:\"Venta de producto\", reference:patient.name, type:\"Ingreso\",\n        amount: remaining>0 ? remaining : subtotal, date:nowLabel(), method: remaining>0 ? \"Pendiente\" : method,\n        status: remaining>0 ? \"Pendiente\" : \"Pagado\", origin:\"product-sale\", operationId, patientId:patient.id,\n        productId:p.id, productName:p.name, quantity:line.quantity, unitPrice:p.salePrice, unitCost:p.purchaseCost, stockDelta:-line.quantity, note, createdAt:new Date().toISOString()\n      };\n    });\n    const paymentRows: Tx[] = paid>0 && paid<total ? [{\n      id: stamp+1000, concept:\"Pago venta de productos\", reference:patient.name, type:\"Ingreso\", amount:paid, date:nowLabel(), method,\n      status:\"Pagado\", origin:\"patient-payment\", operationId, patientId:patient.id, note, createdAt:new Date().toISOString()\n    }] : [];\n    const next = {...store, products:updatedProducts, txs:[...paymentRows,...saleRows,...currentTxs]};\n    runtimeStore.setItem(\"asha-demo\", JSON.stringify(next));\n    setTxs(next.txs);\n    window.dispatchEvent(new CustomEvent(\"asha-runtime-state\",{detail:{products:updatedProducts,txs:next.txs}}));\n    setSaleOpen(false); setSaleLines([{productId:0,quantity:1}]); setSaleError(\"\");\n  };\n'''
text = text.replace(return_anchor, handler + return_anchor, 1)

# 7) financial summary labels
text = text.replace('<span>Total</span>\n                  <b>{money(totals.total)}</b>', '<span>Tratamientos / atenciones</span>\n                  <b>{money(totals.treatmentTotal)}</b>')
text = text.replace('<span>Pagado</span>\n                  <b>{money(totals.paid)}</b>', '<span>Productos comprados</span>\n                  <b>{money(totals.productTotal)}</b>')
text = text.replace('<span>Saldo</span>', '<span>Consumo total</span>')
text = text.replace('{money(totals.balance)}\n                  </b>', '{money(totals.total)}\n                  </b>', 1)
# add paid/saldo rows after summary closing
summary_anchor = '              </div>\n              {firstPending && ('
summary_extra = '''              </div>\n              <div className=\"patient-account-summary\" style={{marginTop:8}}>\n                <div><span>Total pagado</span><b>{money(totals.paid)}</b></div>\n                <div><span>Saldo pendiente</span><b className={totals.balance>0?\"patient-balance-pending\":\"\"}>{money(totals.balance)}</b></div>\n              </div>\n              {firstPending && ('''
text = text.replace(summary_anchor, summary_extra, 1)

# 8) product history section before history/evolutions
history_anchor = '            <section>\n              <div className="patient-profile-section-title">\n                <FileHeart />'
products_section = '''            <section>\n              <div className=\"patient-profile-section-title\">\n                <ShoppingCart />\n                <div><h3>Productos comprados</h3><p>Ventas asociadas directamente a este paciente.</p></div>\n              </div>\n              {productSales.length ? <div className=\"patient-account-list\">{productSales.map(tx=><div key={tx.id}><div><b>{tx.productName || \"Producto\"}</b><small>{tx.date} · {Number(tx.quantity)||0} × {money(Number(tx.unitPrice)||0)}</small></div><span className=\"tag\">{tx.status || \"Pagado\"}</span></div>)}</div> : <div className=\"patient-profile-empty\">Todavía no existen productos comprados por este paciente.</div>}\n            </section>\n''' + history_anchor
text = text.replace(history_anchor, products_section, 1)

# 9) footer button
footer_anchor = '''            <button\n              type="button"\n              className="patient-treatment"\n              onClick={openAttention}\n            >\n              <Plus />\n              Nueva atención\n            </button>'''
footer_new = footer_anchor + '''\n            <button type=\"button\" className=\"patient-treatment\" onClick={()=>{setSaleError(\"\");setSaleOpen(true)}}>\n              <ShoppingCart />\n              Vender producto\n            </button>'''
text = text.replace(footer_anchor, footer_new, 1)

# 10) sale dialog before payment dialog
pay_anchor = '      <Dialog\n        open={!!payment}'
sale_dialog = '''      <Dialog open={saleOpen} onOpenChange={open=>!open&&setSaleOpen(false)}>\n        <DialogContent style={{zIndex:120}}>\n          <DialogHeader><DialogTitle>Vender producto</DialogTitle><DialogDescription>{patient.name} · la venta descontará stock y se reflejará en Caja, Movimientos y Contabilidad.</DialogDescription></DialogHeader>\n          <form className=\"form\" onSubmit={submitProductSale}>\n            {saleError&&<div className=\"form-error\" role=\"alert\">{saleError}</div>}\n            {saleLines.map((line,index)=><div className=\"cols\" key={index}>\n              <label className=\"field\"><Label>Producto</Label><select value={line.productId} onChange={e=>setSaleLines(rows=>rows.map((r,i)=>i===index?{...r,productId:Number(e.target.value)}:r))} required><option value={0}>Seleccionar…</option>{readProducts().map(p=><option key={p.id} value={p.id} disabled={p.stock<=0}>{p.name} · stock {p.stock} · {money(p.salePrice)}</option>)}</select></label>\n              <label className=\"field\"><Label>Cantidad</Label><Input type=\"number\" min=\"1\" step=\"1\" value={line.quantity} onChange={e=>setSaleLines(rows=>rows.map((r,i)=>i===index?{...r,quantity:Math.max(1,Number(e.target.value)||1)}:r))}/></label>\n            </div>)}\n            <Button type=\"button\" variant=\"outline\" onClick={()=>setSaleLines(rows=>[...rows,{productId:0,quantity:1}])}>+ Agregar producto</Button>\n            <div className=\"cols\"><label className=\"field\"><Label>Método de pago</Label><select name=\"method\"><option>Efectivo</option><option>QR</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></label><label className=\"field\"><Label>Estado</Label><select name=\"status\" defaultValue=\"Pagada\"><option>Pagada</option><option>Parcial</option><option>Pendiente</option></select></label></div>\n            <label className=\"field\"><Label>Monto pagado (solo si es parcial)</Label><Input name=\"paid\" type=\"number\" min=\"0\" step=\"0.01\" defaultValue=\"0\"/></label>\n            <label className=\"field\"><Label>Observación</Label><Input name=\"note\"/></label>\n            <div className=\"form-actions\"><Button type=\"button\" variant=\"outline\" onClick={()=>setSaleOpen(false)}>Cancelar</Button><Button className=\"gold\" type=\"submit\">Confirmar venta</Button></div>\n          </form>\n        </DialogContent>\n      </Dialog>\n'''+pay_anchor
text = text.replace(pay_anchor, sale_dialog, 1)

path.write_text(text)
print('patient product sale patch applied')
