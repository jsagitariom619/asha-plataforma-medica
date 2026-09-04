"use client";

import {useState} from "react";
import {ArrowDownRight,ArrowUpRight,CircleDollarSign,Search,TrendingUp} from "lucide-react";
import {Input} from "@/components/ui/input";
import type {Product,Tx} from "@/app/page";

type ServiceLike={id:number;name:string;category:string;price:number;duration:string;active:boolean};
type PeriodKind="week"|"month"|"previous-month"|"year";

const money=(value:number)=>new Intl.NumberFormat("es-BO",{style:"currency",currency:"BOB",maximumFractionDigits:0}).format(Number.isFinite(value)?value:0);
const pct=(value:number)=>`${new Intl.NumberFormat("es-BO",{maximumFractionDigits:1}).format(Number.isFinite(value)?value:0)} %`;
const sum=(rows:Tx[])=>rows.reduce((total,row)=>total+(Number(row.amount)||0),0);
const paid=(tx:Tx)=>tx.type==="Ingreso"&&tx.status!=="Pendiente"&&tx.status!=="Anulado";

function dateOf(tx:Tx):Date|null{
  if(tx.createdAt){const parsed=new Date(tx.createdAt);if(!Number.isNaN(parsed.getTime()))return parsed}
  const match=String(tx.date||"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,)?\s+(\d{1,2}):(\d{2})/);
  if(!match)return null;
  const rawYear=Number(match[3]),year=rawYear<100?2000+rawYear:rawYear;
  const parsed=new Date(year,Number(match[2])-1,Number(match[1]),Number(match[4]),Number(match[5]));
  return Number.isNaN(parsed.getTime())?null:parsed;
}

function range(kind:PeriodKind){
  const now=new Date();
  if(kind==="week"){const offset=(now.getDay()+6)%7,start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-offset),end=new Date(start.getFullYear(),start.getMonth(),start.getDate()+6,23,59,59,999);return{start,end}}
  if(kind==="previous-month")return{start:new Date(now.getFullYear(),now.getMonth()-1,1),end:new Date(now.getFullYear(),now.getMonth(),0,23,59,59,999)};
  if(kind==="year")return{start:new Date(now.getFullYear(),0,1),end:new Date(now.getFullYear(),11,31,23,59,59,999)};
  return{start:new Date(now.getFullYear(),now.getMonth(),1),end:new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999)};
}

export function AccountingPanel({txs,products,services}:{txs:Tx[];products:Product[];services:ServiceLike[]}){
  const[kind,setKind]=useState<PeriodKind>("month"),[query,setQuery]=useState("");
  const selected=range(kind),rows=txs.filter(tx=>{const date=dateOf(tx);return date!==null&&date.getTime()>=selected.start.getTime()&&date.getTime()<=selected.end.getTime()});
  const valid=rows.filter(tx=>tx.status!=="Anulado"),incomeRows=valid.filter(paid),expenseRows=valid.filter(tx=>tx.type==="Egreso"),pendingRows=valid.filter(tx=>tx.type==="Ingreso"&&tx.status==="Pendiente");
  const income=sum(incomeRows),expenses=sum(expenseRows),profit=income-expenses,margin=income>0?profit/income*100:0;
  const productSales=incomeRows.filter(tx=>tx.origin==="product-sale"),units=productSales.reduce((total,tx)=>total+(Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0),0);
  const productRevenue=sum(productSales),serviceNames=new Set(services.map(service=>service.name.trim().toLowerCase())),serviceRevenue=sum(incomeRows.filter(tx=>tx.origin==="cash"&&serviceNames.has(tx.concept.trim().toLowerCase()))),otherRevenue=Math.max(0,income-productRevenue-serviceRevenue);
  const detail=rows.filter(tx=>(tx.concept+" "+tx.reference+" "+(tx.productName||"")).toLowerCase().includes(query.toLowerCase()));
  const unknownDates=txs.filter(tx=>dateOf(tx)===null).length;

  return <div style={{display:"grid",gap:18}}>
    <p style={{margin:0,color:"#66706d",fontSize:14}}>Resumen financiero y operativo del consultorio</p>
    <section className="panel" style={{display:"flex",gap:8,flexWrap:"wrap",padding:14}}>{([['Esta semana','week'],['Este mes','month'],['Mes anterior','previous-month'],['Este año','year']] as const).map(([label,value])=><button key={value} onClick={()=>setKind(value)} style={{border:"1px solid #d9dfdc",background:kind===value?"#f7f2e6":"#fff",borderRadius:9,padding:"8px 11px",fontWeight:700}}>{label}</button>)}</section>
    {unknownDates>0&&<div style={{padding:12,border:"1px solid #e6d9b9",background:"#fbf7ee",borderRadius:10,fontSize:12,color:"#695d42"}}>{unknownDates} registro(s) histórico(s) tienen una fecha no interpretable y no se incluyen en filtros históricos. No se asignan fechas ficticias.</div>}
    <div className="metrics finance"><article className="metric"><span><ArrowUpRight/></span><p>Ingresos</p><strong>{money(income)}</strong><small>Cobrado en el período</small></article><article className="metric"><span><ArrowDownRight/></span><p>Egresos</p><strong>{money(expenses)}</strong><small>Egresos válidos</small></article><article className="metric"><span><TrendingUp/></span><p>Utilidad</p><strong>{money(profit)}</strong><small>Ingresos − egresos</small></article><article className="metric"><span><CircleDollarSign/></span><p>Margen</p><strong>{pct(margin)}</strong><small>Utilidad / ingresos</small></article></div>
    <section className="panel"><div className="title"><div><h3>Estado del período</h3><p>Resumen financiero consolidado</p></div></div><div style={{display:"grid",gap:10}}><b>Facturado / registrado: {money(sum(valid.filter(tx=>tx.type==="Ingreso")))}</b><span>Cobrado: {money(income)}</span><span>Pendiente: {money(sum(pendingRows))} · {pendingRows.length} cobro(s)</span><span>Egresos: {money(expenses)}</span><b>Resultado: {money(profit)} · Margen {pct(margin)}</b><span>Operaciones válidas: {valid.length}</span><span>Productos vendidos: {units} unidades</span><span>Pacientes atendidos: Sin fuente fiable actualmente</span></div></section>
    <section className="panel"><div className="title"><div><h3>Origen de ingresos</h3><p>Derivado de movimientos existentes</p></div></div><p>Servicios / consultas: <b>{money(serviceRevenue)}</b></p><p>Productos: <b>{money(productRevenue)}</b></p><p>Otros ingresos: <b>{money(otherRevenue)}</b></p></section>
    <section className="panel"><div className="title"><div><h3>Detalle financiero</h3><p>Lectura directa de txs, sin duplicar movimientos</p></div></div><div className="search"><Search/><Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar concepto, referencia o producto"/></div><div className="table"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Origen</th><th>Referencia</th><th>Método</th><th>Estado</th><th>Importe</th></tr></thead><tbody>{detail.map(tx=><tr key={tx.id}><td>{tx.date}</td><td>{tx.type}</td><td>{tx.concept}</td><td>{tx.origin||"—"}</td><td>{tx.reference}</td><td>{tx.method}</td><td>{tx.status??(tx.type==="Ingreso"?"Pagado":"—")}</td><td>{tx.type==="Ingreso"?"+":"−"}{money(tx.amount)}</td></tr>)}</tbody></table></div></section>
    <small style={{color:"#7a817e"}}>Productos configurados: {products.length}. Los anulados permanecen visibles en detalle cuando corresponda, pero no afectan ingresos, egresos, utilidad ni margen.</small>
  </div>
}
