"use client";

import {useMemo,useState} from "react";
import {ArrowDownRight,ArrowUpRight,CalendarDays,ChevronDown,CircleDollarSign,PackageOpen,Search,TrendingUp,WalletCards} from "lucide-react";
import {Input} from "@/components/ui/input";
import type {Product,Service,Tx} from "@/app/page";
import styles from "./accounting.module.css";

const money=(n:number)=>new Intl.NumberFormat("es-BO",{style:"currency",currency:"BOB",maximumFractionDigits:0}).format(Number.isFinite(n)?n:0);
const pct=(n:number)=>`${new Intl.NumberFormat("es-BO",{maximumFractionDigits:1}).format(Number.isFinite(n)?n:0)} %`;
const normalize=(value:string)=>value.trim().toLocaleLowerCase("es");
const startOfDay=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const endOfDay=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999);
const addDays=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const isoDate=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parseInputDate=(value:string)=>{const [y,m,d]=value.split("-").map(Number);return new Date(y,m-1,d)};

function txDate(tx:Tx){
  if(tx.createdAt){const parsed=new Date(tx.createdAt);if(!Number.isNaN(parsed.getTime()))return parsed}
  const match=String(tx.date??"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,)?\s+(\d{1,2}):(\d{2})/);
  if(!match)return null;
  const year=Number(match[3])<100?2000+Number(match[3]):Number(match[3]);
  const parsed=new Date(year,Number(match[2])-1,Number(match[1]),Number(match[4]),Number(match[5]));
  return Number.isNaN(parsed.getTime())?null:parsed;
}

type PeriodKind="week"|"month"|"previous-month"|"year"|"custom"|"selected-month";
type Period={start:Date;end:Date;label:string;kind:PeriodKind};

function buildPeriod(kind:PeriodKind,customFrom:string,customTo:string,month:number,year:number):Period{
  const now=new Date();
  if(kind==="week"){
    const day=(now.getDay()+6)%7,start=startOfDay(addDays(now,-day));
    return{start,end:endOfDay(addDays(start,6)),label:"Esta semana",kind};
  }
  if(kind==="previous-month"){
    const start=new Date(now.getFullYear(),now.getMonth()-1,1),end=endOfDay(new Date(now.getFullYear(),now.getMonth(),0));
    return{start,end,label:new Intl.DateTimeFormat("es-BO",{month:"long",year:"numeric"}).format(start),kind};
  }
  if(kind==="year")return{start:new Date(now.getFullYear(),0,1),end:endOfDay(new Date(now.getFullYear(),11,31)),label:String(now.getFullYear()),kind};
  if(kind==="custom"&&customFrom&&customTo){const a=parseInputDate(customFrom),b=parseInputDate(customTo);return{start:startOfDay(a<=b?a:b),end:endOfDay(a<=b?b:a),label:`${customFrom} a ${customTo}`,kind}}
  if(kind==="selected-month"){
    const start=new Date(year,month,1),end=endOfDay(new Date(year,month+1,0));
    return{start,end,label:new Intl.DateTimeFormat("es-BO",{month:"long",year:"numeric"}).format(start),kind};
  }
  const start=new Date(now.getFullYear(),now.getMonth(),1),end=endOfDay(new Date(now.getFullYear(),now.getMonth()+1,0));
  return{start,end,label:"Este mes",kind:"month"};
}

function previousPeriod(period:Period){
  if(period.kind==="month"||period.kind==="selected-month"||period.kind==="previous-month"){
    const start=new Date(period.start.getFullYear(),period.start.getMonth()-1,1),end=endOfDay(new Date(period.start.getFullYear(),period.start.getMonth(),0));
    return{start,end};
  }
  const days=Math.max(1,Math.round((startOfDay(period.end).getTime()-startOfDay(period.start).getTime())/86400000)+1);
  const end=endOfDay(addDays(period.start,-1));return{start:startOfDay(addDays(end,-days+1)),end};
}

const inRange=(date:Date|null,start:Date,end:Date)=>!!date&&date>=start&&date<=end;
const validFinancial=(t:Tx)=>t.status!=="Anulado";
const paidIncome=(t:Tx)=>t.type==="Ingreso"&&t.status!=="Pendiente"&&t.status!=="Anulado";

function sum(rows:Tx[]){return rows.reduce((a,t)=>a+(Number(t.amount)||0),0)}
function change(current:number,previous:number){if(previous===0)return current===0?null:null;return((current-previous)/Math.abs(previous))*100}
function Change({value,invert=false}:{value:number|null;invert?:boolean}){if(value===null)return <small>Sin datos suficientes para comparar.</small>;const up=value>=0,good=invert?!up:up;return <small className={good?styles.good:styles.bad}>{up?"↑":"↓"} {Math.abs(value).toLocaleString("es-BO",{maximumFractionDigits:1})} % vs período anterior</small>}

function historicalUnitCost(tx:Tx,products:Product[],txs:Tx[]){
  if(typeof tx.unitCost==="number"&&Number.isFinite(tx.unitCost))return tx.unitCost;
  if(typeof tx.costAmount==="number"&&Number(tx.quantity)>0)return tx.costAmount/Number(tx.quantity);
  const saleDate=txDate(tx),purchases=txs.filter(row=>row.origin==="product-purchase"&&row.productId===tx.productId&&typeof row.unitPrice==="number").map(row=>({row,date:txDate(row)})).filter(item=>!saleDate||!item.date||item.date<=saleDate).sort((a,b)=>(b.date?.getTime()??0)-(a.date?.getTime()??0));
  if(purchases[0]?.row.unitPrice!==undefined)return Number(purchases[0].row.unitPrice)||0;
  return Number(products.find(p=>p.id===tx.productId)?.purchaseCost)||0;
}

export function AccountingPanel({txs,products,services}:{txs:Tx[];products:Product[];services:Service[]}){
  const now=new Date(),[kind,setKind]=useState<PeriodKind>("month"),[customFrom,setCustomFrom]=useState(isoDate(new Date(now.getFullYear(),now.getMonth(),1))),[customTo,setCustomTo]=useState(isoDate(now)),[month,setMonth]=useState(now.getMonth()),[year,setYear]=useState(now.getFullYear()),[productSort,setProductSort]=useState<"units"|"revenue"|"profit">("units"),[query,setQuery]=useState(""),[typeFilter,setTypeFilter]=useState("Todos"),[originFilter,setOriginFilter]=useState("Todos");
  const period=useMemo(()=>buildPeriod(kind,customFrom,customTo,month,year),[kind,customFrom,customTo,month,year]);
  const previous=useMemo(()=>previousPeriod(period),[period]);
  const dated=useMemo(()=>txs.map(tx=>({tx,date:txDate(tx)})),[txs]);
  const periodRows=dated.filter(item=>inRange(item.date,period.start,period.end)).map(item=>item.tx);
  const validRows=periodRows.filter(validFinancial);
  const incomeRows=validRows.filter(paidIncome),expenseRows=validRows.filter(t=>t.type==="Egreso"),pendingRows=validRows.filter(t=>t.type==="Ingreso"&&t.status==="Pendiente"),registeredIncomeRows=validRows.filter(t=>t.type==="Ingreso");
  const income=sum(incomeRows),expenses=sum(expenseRows),profit=income-expenses,margin=income?profit/income*100:0,pending=sum(pendingRows),registered=sum(registeredIncomeRows);
  const previousRows=dated.filter(item=>inRange(item.date,previous.start,previous.end)).map(item=>item.tx).filter(validFinancial),previousIncome=sum(previousRows.filter(paidIncome)),previousExpenses=sum(previousRows.filter(t=>t.type==="Egreso")),previousProfit=previousIncome-previousExpenses;
  const unreadableDates=dated.filter(item=>!item.date).length;
  const productSales=incomeRows.filter(t=>t.origin==="product-sale");
  const unitsSold=productSales.reduce((a,t)=>a+(Number(t.quantity)||Math.abs(Number(t.stockDelta))||0),0);
  const cogs=productSales.reduce((a,t)=>a+historicalUnitCost(t,products,txs)*(Number(t.quantity)||Math.abs(Number(t.stockDelta))||0),0);

  const productStats=useMemo(()=>{
    const map=new Map<number,{id:number;name:string;units:number;revenue:number;cost:number;profit:number;margin:number}>();
    productSales.forEach(t=>{const id=Number(t.productId)||-1,q=Number(t.quantity)||Math.abs(Number(t.stockDelta))||0,cost=historicalUnitCost(t,products,txs)*q,current=map.get(id)??{id,name:t.productName||products.find(p=>p.id===id)?.name||"Producto",units:0,revenue:0,cost:0,profit:0,margin:0};current.units+=q;current.revenue+=Number(t.amount)||0;current.cost+=cost;current.profit=current.revenue-current.cost;current.margin=current.revenue?current.profit/current.revenue*100:0;map.set(id,current)});
    return [...map.values()];
  },[productSales,products,txs]);
  const sortedProducts=[...productStats].sort((a,b)=>productSort==="units"?b.units-a.units:productSort==="revenue"?b.revenue-a.revenue:b.profit-a.profit);
  const lowMargin=[...productStats].filter(p=>p.revenue>0).sort((a,b)=>a.margin-b.margin).slice(0,5);
  const topRevenue=[...productStats].sort((a,b)=>b.revenue-a.revenue)[0];

  const serviceStats=services.map(service=>{const rows=incomeRows.filter(t=>t.origin==="cash"&&normalize(t.concept)===normalize(service.name));return{name:service.name,count:rows.length,revenue:sum(rows)}}).filter(s=>s.count>0||s.revenue>0).sort((a,b)=>b.revenue-a.revenue);
  const serviceRevenue=serviceStats.reduce((a,s)=>a+s.revenue,0),productRevenue=sum(productSales),otherRevenue=Math.max(0,income-productRevenue-serviceRevenue);

  const weeks=useMemo(()=>{
    const result:{label:string;income:number;expenses:number;profit:number;operations:number;units:number}[]=[];
    let cursor=startOfDay(period.start),index=1;
    while(cursor<=period.end&&index<=54){const end=endOfDay(addDays(cursor,6)>period.end?period.end:addDays(cursor,6)),rows=dated.filter(item=>inRange(item.date,cursor,end)).map(item=>item.tx).filter(validFinancial),inc=sum(rows.filter(paidIncome)),out=sum(rows.filter(t=>t.type==="Egreso"));result.push({label:`Semana ${index}`,income:inc,expenses:out,profit:inc-out,operations:rows.length,units:rows.filter(t=>t.origin==="product-sale"&&paidIncome(t)).reduce((a,t)=>a+(Number(t.quantity)||Math.abs(Number(t.stockDelta))||0),0)});cursor=startOfDay(addDays(end,1));index++}
    return result;
  },[dated,period]);
  const maxChart=Math.max(1,...weeks.flatMap(w=>[w.income,w.expenses]));
  const bestIncome=[...weeks].sort((a,b)=>b.income-a.income)[0],bestProfit=[...weeks].sort((a,b)=>b.profit-a.profit)[0],mostOperations=[...weeks].sort((a,b)=>b.operations-a.operations)[0];
  const avgWeeks=weeks.length||1;

  const methods=useMemo(()=>{const map=new Map<string,number>();incomeRows.forEach(t=>map.set(t.method||"Otros",(map.get(t.method||"Otros")||0)+(Number(t.amount)||0)));return [...map.entries()].sort((a,b)=>b[1]-a[1])},[incomeRows]);
  const incomeOrigins=[{name:"Servicios / consultas",amount:serviceRevenue},{name:"Productos",amount:productRevenue},{name:"Otros ingresos",amount:otherRevenue}].filter(x=>x.amount>0);
  const purchaseExpenses=sum(expenseRows.filter(t=>t.origin==="product-purchase")),manualExpenses=sum(expenseRows.filter(t=>t.origin==="manual")),otherExpenses=Math.max(0,expenses-purchaseExpenses-manualExpenses);
  const expenseOrigins=[{name:"Compra de productos",amount:purchaseExpenses},{name:"Gastos / egresos manuales",amount:manualExpenses},{name:"Otros egresos",amount:otherExpenses}].filter(x=>x.amount>0);
  const originOptions=["Todos",...Array.from(new Set(periodRows.map(t=>t.origin||"Sin origen")))];
  const detail=periodRows.filter(t=>{const hay=(t.concept+" "+t.reference+" "+(t.productName||"")).toLowerCase().includes(query.toLowerCase()),type=typeFilter==="Todos"||t.type===typeFilter,origin=originFilter==="Todos"||(t.origin||"Sin origen")===originFilter;return hay&&type&&origin}).sort((a,b)=>(txDate(b)?.getTime()??0)-(txDate(a)?.getTime()??0));

  return <div className={styles.accounting}>
    <div className={styles.lead}>Resumen financiero y operativo del consultorio</div>
    <section className={`${styles.filters} panel`}>
      <div className={styles.presetRow}>{[["Esta semana","week"],["Este mes","month"],["Mes anterior","previous-month"],["Este año","year"]].map(([label,value])=><button key={value} className={kind===value?styles.active:""} onClick={()=>setKind(value as PeriodKind)}>{label}</button>)}<button className={kind==="custom"?styles.active:""} onClick={()=>setKind("custom")}>Personalizado</button></div>
      <div className={styles.monthRow}><label>Mes<select value={month} onChange={e=>setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i} value={i}>{new Intl.DateTimeFormat("es-BO",{month:"long"}).format(new Date(2026,i,1))}</option>)}</select></label><label>Año<select value={year} onChange={e=>setYear(Number(e.target.value))}>{Array.from({length:8},(_,i)=>now.getFullYear()-4+i).map(y=><option key={y}>{y}</option>)}</select></label><button onClick={()=>setKind("selected-month")}>Ver mes</button>{kind==="custom"&&<><label>Desde<input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/></label><label>Hasta<input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}/></>}</div>
      <small><CalendarDays/> Período: {period.label}</small>
    </section>

    {unreadableDates>0&&<div className={styles.notice}>{unreadableDates} registro(s) histórico(s) no se incluyen en análisis por período porque su fecha no puede interpretarse de forma segura. No se modificaron ni se asignaron fechas ficticias.</div>}

    <div className={styles.metrics}>
      <Metric icon={ArrowUpRight} label="Ingresos" value={money(income)} note="Cobrado en el período"><Change value={change(income,previousIncome)}/></Metric>
      <Metric icon={ArrowDownRight} label="Egresos" value={money(expenses)} note="Egresos válidos"><Change value={change(expenses,previousExpenses)} invert/></Metric>
      <Metric icon={TrendingUp} label="Utilidad" value={money(profit)} note="Ingresos − egresos"><Change value={change(profit,previousProfit)}/></Metric>
      <Metric icon={CircleDollarSign} label="Margen" value={pct(margin)} note="Utilidad / ingresos"/>
    </div>

    <div className={styles.grid2}>
      <section className="panel"><Heading title="Estado del período" text="Resumen financiero consolidado"/><div className={styles.statement}><Row label="Facturado / registrado" value={money(registered)}/><Row label="Cobrado" value={money(income)}/><Row label="Pendiente" value={money(pending)}/><Row label="Egresos" value={money(expenses)}/><Row label="Resultado" value={money(profit)} strong/><Row label="Margen" value={pct(margin)} strong/><Row label="Operaciones válidas" value={String(validRows.length)}/><Row label="Productos vendidos" value={`${unitsSold} unidades`}/><Row label="Pacientes atendidos" value="Sin fuente fiable actualmente"/></div></section>
      <section className="panel"><Heading title="Balance del período" text="Caja cobrada frente a egresos registrados"/><div className={styles.balance}><div><span>Ingresos</span><strong>{money(income)}</strong></div><div><span>Egresos</span><strong>{money(expenses)}</strong></div><div className={styles.result}><span>Utilidad</span><strong>{money(profit)}</strong><small>Margen {pct(margin)}</small></div></div><div className={styles.pending}><span>Cobros pendientes</span><strong>{money(pending)}</strong><small>{pendingRows.length} cobro(s) pendiente(s)</small></div></section>
    </div>

    <section className="panel"><Heading title="Evolución semanal" text="Ingresos, egresos y rentabilidad por semana"/><div className={styles.weekChart}>{weeks.map(w=><div className={styles.week} key={w.label}><div className={styles.weekTitle}><b>{w.label}</b><small>{w.operations} movimientos · {w.units} unidades</small></div><div className={styles.barLine}><span>Ingresos</span><i style={{width:`${w.income/maxChart*100}%`}}/><b>{money(w.income)}</b></div><div className={styles.barLine}><span>Egresos</span><i className={styles.expenseBar} style={{width:`${w.expenses/maxChart*100}%`}}/><b>{money(w.expenses)}</b></div><div className={styles.weekProfit}>Utilidad <strong>{money(w.profit)}</strong></div></div>)}</div><div className={styles.highlights}><Highlight label="Semana con mayor ingreso" value={bestIncome?.label||"Sin datos"} note={bestIncome?money(bestIncome.income):""}/><Highlight label="Semana con más movimientos" value={mostOperations?.label||"Sin datos"} note={mostOperations?`${mostOperations.operations} movimientos`:""}/><Highlight label="Mejor semana por utilidad" value={bestProfit?.label||"Sin datos"} note={bestProfit?money(bestProfit.profit):""}/></div><div className={styles.averages}><Row label="Ingreso promedio semanal" value={money(income/avgWeeks)}/><Row label="Egreso promedio semanal" value={money(expenses/avgWeeks)}/><Row label="Utilidad promedio semanal" value={money(profit/avgWeeks)}/></div></section>

    <div className={styles.grid2}>
      <section className="panel"><Heading title="Origen de ingresos" text="Clasificación derivada de movimientos existentes"/>{incomeOrigins.length?incomeOrigins.map(x=><Progress key={x.name} label={x.name} amount={x.amount} total={income}/>):<Empty text="Sin ingresos en el período seleccionado."/>}</section>
      <section className="panel"><Heading title="Egresos por origen" text="Sin alterar la clasificación original"/>{expenseOrigins.length?expenseOrigins.map(x=><Progress key={x.name} label={x.name} amount={x.amount} total={expenses}/>):<Empty text="Sin egresos en el período seleccionado."/>}</section>
    </div>

    <div className={styles.grid2}>
      <section className="panel"><Heading title="Métodos de pago" text="Distribución del dinero efectivamente cobrado"/>{methods.length?methods.map(([name,amount])=><Progress key={name} label={name} amount={amount} total={income}/>):<Empty text="Sin cobros pagados en este período."/>}</section>
      <section className="panel"><Heading title="Servicios" text="Operaciones financieras cuyo concepto coincide con servicios configurados"/>{serviceStats.length?serviceStats.map(s=><div className={styles.serviceRow} key={s.name}><div><b>{s.name}</b><small>{s.count} operación(es) identificada(s)</small></div><strong>{money(s.revenue)}</strong><span>{pct(income?s.revenue/income*100:0)}</span></div>):<Empty text="No existen movimientos de servicios identificables en este período."/>}<p className={styles.caution}>ASHA aún no conserva una colección estructurada de atenciones clínicas. Por eso este bloque no se utiliza para inventar “pacientes atendidos”.</p></section>
    </div>

    <section className="panel"><Heading title="Productos" text="Ventas, costo histórico disponible y rentabilidad"/><div className={styles.productSummary}><Highlight label="Unidades vendidas" value={String(unitsSold)} note="unidades"/><Highlight label="Facturación de productos" value={money(productRevenue)} note="ventas cobradas"/><Highlight label="Costo de productos vendidos" value={money(cogs)} note="CPV / COGS"/><Highlight label="Producto con mayor facturación" value={topRevenue?.name||"Sin datos"} note={topRevenue?money(topRevenue.revenue):""}/></div><div className={styles.sortRow}><span>TOP PRODUCTOS</span>{[["Unidades","units"],["Facturación","revenue"],["Utilidad","profit"]].map(([label,value])=><button className={productSort===value?styles.active:""} key={value} onClick={()=>setProductSort(value as typeof productSort)}>{label}</button>)}</div>{sortedProducts.length?<div className={styles.productTable}>{sortedProducts.slice(0,5).map((p,i)=><div key={p.id}><span>{i+1}</span><div><b>{p.name}</b><small>{p.units} u. · Facturación {money(p.revenue)}</small></div><div><b>{money(p.profit)}</b><small>Utilidad · margen {pct(p.margin)}</small></div></div>)}</div>:<Empty text="Sin ventas de productos en el período seleccionado."/>}{lowMargin.length>0&&<div className={styles.lowMargin}><b>Productos con menor margen</b>{lowMargin.map(p=><span key={p.id}>{p.name}<em>{pct(p.margin)}</em></span>)}</div>}</section>

    <section className="panel"><Heading title="Detalle financiero" text="Vista directa de los movimientos existentes; no crea una segunda tabla"/><div className={styles.detailFilters}><div className="search"><Search/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar concepto, referencia o producto"/></div><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option>Todos</option><option>Ingreso</option><option>Egreso</option></select><select value={originFilter} onChange={e=>setOriginFilter(e.target.value)}>{originOptions.map(o=><option key={o}>{o}</option>)}</select></div><div className="table"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Origen</th><th>Referencia</th><th>Método</th><th>Estado</th><th>Importe</th></tr></thead><tbody>{detail.map(t=><tr key={t.id}><td>{t.date}</td><td>{t.type}</td><td><b>{t.concept}{t.productName&&<small>{t.productName}</small>}</b></td><td>{t.origin||"—"}</td><td>{t.reference}</td><td>{t.method}</td><td>{t.status??(t.type==="Ingreso"?"Pagado":"—")}</td><td className={t.type==="Ingreso"?"green":"red"}>{t.type==="Ingreso"?"+":"−"}{money(t.amount)}</td></tr>)}</tbody></table>{detail.length===0&&<Empty text="Sin movimientos para los filtros seleccionados."/>}</div></section>
  </div>
}

function Metric({icon:Icon,label,value,note,children}:{icon:typeof WalletCards;label:string;value:string;note:string;children?:React.ReactNode}){return <article className={styles.metric}><span><Icon/></span><p>{label}</p><strong>{value}</strong><small>{note}</small>{children}</article>}
function Heading({title,text}:{title:string;text:string}){return <div className={styles.heading}><div><h3>{title}</h3><p>{text}</p></div><ChevronDown/></div>}
function Row({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <div className={strong?styles.strongRow:""}><span>{label}</span><b>{value}</b></div>}
function Highlight({label,value,note}:{label:string;value:string;note:string}){return <div className={styles.highlight}><span>{label}</span><b>{value}</b><small>{note}</small></div>}
function Progress({label,amount,total}:{label:string;amount:number;total:number}){const share=total?amount/total*100:0;return <div className={styles.progress}><div><span>{label}</span><b>{money(amount)}</b><small>{pct(share)}</small></div><i><em style={{width:`${Math.min(100,Math.max(0,share))}%`}}/></i></div>}
function Empty({text}:{text:string}){return <div className={styles.empty}><PackageOpen/><span>{text}</span></div>}
