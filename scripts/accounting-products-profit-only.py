from pathlib import Path

path = Path('app/accounting.tsx')
s = path.read_text()

old = '''  const purchaseExpenses=sum(expenseRows.filter(tx=>tx.origin==="product-purchase"));
  const operatingExpenses=Math.max(0,expenses-purchaseExpenses);
  const cogs=costOfGoodsSold(incomeRows,products,txs);
  const grossProfit=income-cogs;
  const netProfit=grossProfit-operatingExpenses;
  const margin=income>0?netProfit/income*100:0;
  const cashFlow=income-expenses;

  const priorRows=dated.filter(item=>inRange(item.date,previous.start,previous.end)).map(item=>item.tx).filter(validTx),priorIncomeRows=priorRows.filter(paidIncome),priorExpenseRows=priorRows.filter(tx=>tx.type==="Egreso"),priorIncome=sum(priorIncomeRows),priorExpenses=sum(priorExpenseRows),priorPurchases=sum(priorExpenseRows.filter(tx=>tx.origin==="product-purchase")),priorOperatingExpenses=Math.max(0,priorExpenses-priorPurchases),priorCogs=costOfGoodsSold(priorIncomeRows,products,txs),priorProfit=priorIncome-priorCogs-priorOperatingExpenses;
  const unknownDates=dated.filter(item=>item.date===null).length;

  const sales=incomeRows.filter(tx=>tx.origin==="product-sale"),unitsSold=sales.reduce((total,tx)=>total+(Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0),0),productRevenue=sum(sales),productProfit=productRevenue-cogs;'''
new = '''  const purchaseExpenses=sum(expenseRows.filter(tx=>tx.origin==="product-purchase"));
  const operatingExpenses=Math.max(0,expenses-purchaseExpenses);
  const cogs=costOfGoodsSold(incomeRows,products,txs);
  const cashFlow=income-expenses;

  const priorRows=dated.filter(item=>inRange(item.date,previous.start,previous.end)).map(item=>item.tx).filter(validTx),priorIncomeRows=priorRows.filter(paidIncome),priorProductRows=priorIncomeRows.filter(tx=>tx.origin==="product-sale"),priorProductRevenue=sum(priorProductRows),priorCogs=costOfGoodsSold(priorProductRows,products,txs),priorProductProfit=priorProductRevenue-priorCogs;
  const unknownDates=dated.filter(item=>item.date===null).length;

  const sales=incomeRows.filter(tx=>tx.origin==="product-sale"),unitsSold=sales.reduce((total,tx)=>total+(Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0),0),productRevenue=sum(sales),productProfit=productRevenue-cogs,productMargin=productRevenue>0?productProfit/productRevenue*100:0,serviceAndOtherIncome=Math.max(0,income-productRevenue);'''
if old not in s:
    raise SystemExit('calculation block not found')
s = s.replace(old, new, 1)

old = '''        <Kpi icon={<ArrowUpRight/>} label="Ingresos" value={money(income)} change={variation(income,priorIncome)}/><Kpi icon={<ArrowDownRight/>} label="Costo de ventas" value={money(cogs)}/><Kpi icon={<TrendingUp/>} label="Utilidad neta" value={money(netProfit)} change={variation(netProfit,priorProfit)}/><Kpi icon={<CircleDollarSign/>} label="Margen neto" value={pct(margin)}/>'''
new = '''        <Kpi icon={<ArrowUpRight/>} label="Ingresos totales" value={money(income)} change={variation(income,priorIncome)}/><Kpi icon={<WalletCards/>} label="Ingresos clínicos / servicios" value={money(serviceAndOtherIncome)}/><Kpi icon={<TrendingUp/>} label="Utilidad de productos" value={money(productProfit)} change={variation(productProfit,priorProductProfit)}/><Kpi icon={<CircleDollarSign/>} label="Margen de productos" value={pct(productMargin)}/>'''
if old not in s:
    raise SystemExit('kpi block not found')
s = s.replace(old, new, 1)

old = '''        <section className="panel" style={compactPanel}><Heading title="Productos"/><MiniRow label="Vendidos" value={`${unitsSold} u.`}/><MiniRow label="Facturación" value={money(productRevenue)}/><MiniRow label="Costo vendido" value={money(cogs)}/><MiniRow label="Utilidad bruta" value={money(productProfit)}/>{topProduct&&<MiniRow label="Más vendido" value={topProduct[0]}/>}</section>'''
new = '''        <section className="panel" style={compactPanel}><Heading title="Productos"/><MiniRow label="Vendidos" value={`${unitsSold} u.`}/><MiniRow label="Ventas de productos" value={money(productRevenue)}/><MiniRow label="Costo de productos vendidos" value={money(cogs)}/><MiniRow label="Utilidad de productos" value={money(productProfit)}/>{topProduct&&<MiniRow label="Más vendido" value={topProduct[0]}/>}</section>'''
if old not in s:
    raise SystemExit('product summary block not found')
s = s.replace(old, new, 1)

old = '''        <section className="panel" style={compactPanel}><Heading title="Lectura rápida"/><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}><Quick label="Flujo de caja" value={money(cashFlow)}/><Quick label="Utilidad bruta" value={money(grossProfit)}/><Quick label="Margen productos" value={pct(productRevenue>0?productProfit/productRevenue*100:0)}/></div><small style={{display:"block",marginTop:8,color:"#7d8581",fontSize:9}}>Las compras de inventario afectan el flujo de caja, pero solo el costo de las unidades vendidas afecta la utilidad.</small></section>'''
new = '''        <section className="panel" style={compactPanel}><Heading title="Lectura rápida"/><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}><Quick label="Flujo de caja" value={money(cashFlow)}/><Quick label="Ingresos clínicos / servicios" value={money(serviceAndOtherIncome)}/><Quick label="Margen productos" value={pct(productMargin)}/></div><small style={{display:"block",marginTop:8,color:"#7d8581",fontSize:9}}>La utilidad y el margen se calculan solo para productos vendidos. Consultas, procedimientos, tratamientos y otros servicios se registran como ingresos y forman parte de los ingresos totales.</small></section>'''
if old not in s:
    raise SystemExit('quick summary block not found')
s = s.replace(old, new, 1)

path.write_text(s)
