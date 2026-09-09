"use client";

import {useMemo,useState,type CSSProperties} from "react";
import {ArrowDownRight,ArrowUpRight,CalendarDays,ChevronLeft,ChevronRight,CircleDollarSign,PackageOpen,Search,TrendingUp,WalletCards} from "lucide-react";
import {Input} from "@/components/ui/input";
import type {Product,Tx} from "@/app/page";

type ServiceLike={id:number;name:string;category:string;price:number;duration:string;active:boolean};
type PeriodKind="week"|"month"|"previous-month"|"year"|"custom"|"selected-month";
type Period={start:Date;end:Date;label:string;kind:PeriodKind};
type ViewMode="summary"|"detail";

const money=(value:number)=>new Intl.NumberFormat("es-BO",{style:"currency",currency:"BOB",maximumFractionDigits:0}).format(Number.isFinite(value)?value:0);
const pct=(value:number)=>`${new Intl.NumberFormat("es-BO",{maximumFractionDigits:1}).format(Number.isFinite(value)?value:0)} %`;
const sum=(rows:Tx[])=>rows.reduce((total,row)=>total+(Number(row.amount)||0),0);
const normalize=(value:string)=>value.trim().toLocaleLowerCase("es-BO");
const startDay=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate());
const endDay=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate(),23,59,59,999);
const addDays=(date:Date,days:number)=>{const next=new Date(date);next.setDate(next.getDate()+days);return next};
const inputDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const parseInput=(value:string)=>{const [year,month,day]=value.split("-").map(Number);return new Date(year,month-1,day)};
const validTx=(tx:Tx)=>tx.status!=="Anulado";
const paidIncome=(tx:Tx)=>tx.type==="Ingreso"&&tx.status!=="Pendiente"&&tx.status!=="Anulado";

function txDate(tx:Tx):Date|null{
  if(tx.createdAt){const parsed=new Date(tx.createdAt);if(!Number.isNaN(parsed.getTime()))return parsed}
  const match=String(tx.date||"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,)?\s+(\d{1,2}):(\d{2})/);
  if(!match)return null;
  const rawYear=Number(match[3]),year=rawYear<100?2000+rawYear:rawYear;
  const parsed=new Date(year,Number(match[2])-1,Number(match[1]),Number(match[4]),Number(match[5]));
  return Number.isNaN(parsed.getTime())?null:parsed;
}

function buildPeriod(kind:PeriodKind,from:string,to:string,month:number,year:number):Period{
  const now=new Date();
  if(kind==="week"){const offset=(now.getDay()+6)%7,start=startDay(addDays(now,-offset));return{start,end:endDay(addDays(start,6)),label:"Esta semana",kind}}
  if(kind==="previous-month"){const start=new Date(now.getFullYear(),now.getMonth()-1,1);return{start,end:endDay(new Date(now.getFullYear(),now.getMonth(),0)),label:new Intl.DateTimeFormat("es-BO",{month:"long",year:"numeric"}).format(start),kind}}
  if(kind==="year")return{start:new Date(now.getFullYear(),0,1),end:endDay(new Date(now.getFullYear(),11,31)),label:String(now.getFullYear()),kind};
  if(kind==="selected-month"){const start=new Date(year,month,1);return{start,end:endDay(new Date(year,month+1,0)),label:new Intl.DateTimeFormat("es-BO",{month:"long",year:"numeric"}).format(start),kind}}
  if(kind==="custom"&&from&&to){const first=parseInput(from),second=parseInput(to),forward=first.getTime()<=second.getTime();return{start:startDay(forward?first:second),end:endDay(forward?second:first),label:`${from} a ${to}`,kind}}
  return{start:new Date(now.getFullYear(),now.getMonth(),1),end:endDay(new Date(now.getFullYear(),now.getMonth()+1,0)),label:"Este mes",kind:"month"};
}

function previousPeriod(period:Period){
  if(period.kind==="month"||period.kind==="previous-month"||period.kind==="selected-month")return{start:new Date(period.start.getFullYear(),period.start.getMonth()-1,1),end:endDay(new Date(period.start.getFullYear(),period.start.getMonth(),0))};
  const days=Math.max(1,Math.round((startDay(period.end).getTime()-startDay(period.start).getTime())/86400000)+1),end=endDay(addDays(period.start,-1));
  return{start:startDay(addDays(end,-days+1)),end};
}

function inRange(date:Date|null,start:Date,end:Date){if(!date)return false;const time=date.getTime();return time>=start.getTime()&&time<=end.getTime()}
function variation(current:number,previous:number){return previous===0?null:(current-previous)/Math.abs(previous)*100}

function saleUnitCost(sale:Tx,products:Product[],txs:Tx[]){
  if(typeof sale.unitCost==="number"&&Number.isFinite(sale.unitCost))return sale.unitCost;
  if(typeof sale.costAmount==="number"&&(Number(sale.quantity)||0)>0)return sale.costAmount/Number(sale.quantity);
  const saleWhen=txDate(sale);
  const purchases=txs.filter(tx=>tx.origin==="product-purchase"&&tx.productId===sale.productId&&typeof tx.unitPrice==="number").filter(tx=>{const when=txDate(tx);return !saleWhen||!when||when.getTime()<=saleWhen.getTime()}).sort((a,b)=>(txDate(b)?.getTime()||0)-(txDate(a)?.getTime()||0));
  if(purchases.length)return Number(purchases[0].unitPrice)||0;
  return Number(products.find(product=>product.id===sale.productId)?.purchaseCost)||0;
}

function costOfGoodsSold(rows:Tx[],products:Product[],txs:Tx[]){
  return rows.filter(tx=>paidIncome(tx)&&tx.origin==="product-sale").reduce((total,tx)=>{
    const units=Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0;
    return total+saleUnitCost(tx,products,txs)*units;
  },0);
}

const controls:CSSProperties={display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"};
const button:CSSProperties={border:"1px solid #d9dfdc",background:"#fff",color:"#36504a",borderRadius:8,padding:"6px 9px",fontSize:11,fontWeight:700,cursor:"pointer",height:32};
const activeButton:CSSProperties={...button,background:"#f7f2e6",borderColor:"#b59a5a",color:"#234a43"};
const compactPanel:CSSProperties={padding:13,minWidth:0,overflow:"hidden"};
const row:CSSProperties={display:"flex",justifyContent:"space-between",gap:10,padding:"5px 0",borderBottom:"1px solid #edf0ee",fontSize:11};

export function AccountingPanel({txs,products,services}:{txs:Tx[];products:Product[];services:ServiceLike[]}){
  const now=new Date();
  const[kind,setKind]=useState<PeriodKind>("month"),[from,setFrom]=useState(inputDate(new Date(now.getFullYear(),now.getMonth(),1))),[to,setTo]=useState(inputDate(now)),[month,setMonth]=useState(now.getMonth()),[year,setYear]=useState(now.getFullYear());
  const[view,setView]=useState<ViewMode>("summary"),[query,setQuery]=useState(""),[typeFilter,setTypeFilter]=useState("Todos"),[page,setPage]=useState(0);

  const period=buildPeriod(kind,from,to,month,year),previous=previousPeriod(period);
  const dated=txs.map(tx=>({tx,date:txDate(tx)}));
  const rows=dated.filter(item=>inRange(item.date,period.start,period.end)).map(item=>item.tx),valid=rows.filter(validTx),incomeRows=valid.filter(paidIncome),expenseRows=valid.filter(tx=>tx.type==="Egreso"),pendingRows=valid.filter(tx=>tx.type==="Ingreso"&&tx.status==="Pendiente"),registeredRows=valid.filter(tx=>tx.type==="Ingreso");
  const income=sum(incomeRows),expenses=sum(expenseRows),pending=sum(pendingRows),registered=sum(registeredRows);
  const purchaseExpenses=sum(expenseRows.filter(tx=>tx.origin==="product-purchase"));
  const operatingExpenses=Math.max(0,expenses-purchaseExpenses);
  const cogs=costOfGoodsSold(incomeRows,products,txs);
  const cashFlow=income-expenses;

  const priorRows=dated.filter(item=>inRange(item.date,previous.start,previous.end)).map(item=>item.tx).filter(validTx),priorIncomeRows=priorRows.filter(paidIncome),priorIncome=sum(priorIncomeRows),priorProductRows=priorIncomeRows.filter(tx=>tx.origin==="product-sale"),priorProductRevenue=sum(priorProductRows),priorCogs=costOfGoodsSold(priorProductRows,products,txs),priorProductProfit=priorProductRevenue-priorCogs;
  const unknownDates=dated.filter(item=>item.date===null).length;

  const sales=incomeRows.filter(tx=>tx.origin==="product-sale"),unitsSold=sales.reduce((total,tx)=>total+(Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0),0),productRevenue=sum(sales),productProfit=productRevenue-cogs,productMargin=productRevenue>0?productProfit/productRevenue*100:0,serviceAndOtherIncome=Math.max(0,income-productRevenue);
  const productTotals=new Map<string,{units:number;revenue:number;profit:number}>();
  sales.forEach(tx=>{const name=tx.productName||products.find(product=>product.id===tx.productId)?.name||"Producto",units=Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0,cost=saleUnitCost(tx,products,txs)*units,current=productTotals.get(name)||{units:0,revenue:0,profit:0};current.units+=units;current.revenue+=Number(tx.amount)||0;current.profit+=Number(tx.amount||0)-cost;productTotals.set(name,current)});
  const topProduct=Array.from(productTotals.entries()).sort((a,b)=>b[1].revenue-a[1].revenue)[0];

  const serviceStats=services.map(service=>{const matched=incomeRows.filter(tx=>tx.origin==="cash"&&normalize(tx.concept)===normalize(service.name));return{name:service.name,count:matched.length,revenue:sum(matched)}}).filter(item=>item.count>0).sort((a,b)=>b.revenue-a.revenue),serviceRevenue=serviceStats.reduce((total,item)=>total+item.revenue,0),otherRevenue=Math.max(0,income-productRevenue-serviceRevenue);
  const manualExpenses=sum(expenseRows.filter(tx=>tx.origin==="manual")),otherExpenses=Math.max(0,operatingExpenses-manualExpenses);
  const incomeOrigins=[{name:"Servicios",amount:serviceRevenue},{name:"Productos",amount:productRevenue},{name:"Otros",amount:otherRevenue}].filter(item=>item.amount>0).sort((a,b)=>b.amount-a.amount);
  const operatingExpenseOrigins=[{name:"Gastos registrados",amount:manualExpenses},{name:"Otros gastos",amount:otherExpenses}].filter(item=>item.amount>0).sort((a,b)=>b.amount-a.amount);
  const methods=new Map<string,number>();incomeRows.forEach(tx=>methods.set(tx.method||"Otros",(methods.get(tx.method||"Otros")||0)+(Number(tx.amount)||0)));const methodRows=Array.from(methods.entries()).sort((a,b)=>b[1]-a[1]);

  const detail=useMemo(()=>rows.filter(tx=>{const text=`${tx.concept} ${tx.reference} ${tx.productName||""}`.toLowerCase();return text.includes(query.toLowerCase())&&(typeFilter==="Todos"||tx.type===typeFilter)}).sort((a,b)=>(txDate(b)?.getTime()||0)-(txDate(a)?.getTime()||0)),[rows,query,typeFilter]);
  const pageSize=7,pageCount=Math.max(1,Math.ceil(detail.length/pageSize)),safePage=Math.min(page,pageCount-1),visibleDetail=detail.slice(safePage*pageSize,safePage*pageSize+pageSize);

  return <div style={{display:"grid",gap:10,minHeight:0}}>
    <section className="panel" style={{...compactPanel,display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
      <div style={controls}>
        <PeriodButton label="Semana" active={kind==="week"} onClick={()=>setKind("week")}/><PeriodButton label="Mes" active={kind==="month"} onClick={()=>setKind("month")}/><PeriodButton label="Anterior" active={kind==="previous-month"} onClick={()=>setKind("previous-month")}/><PeriodButton label="Año" active={kind==="year"} onClick={()=>setKind("year")}/><PeriodButton label="Personalizado" active={kind==="custom"} onClick={()=>setKind("custom")}/>
        <select value={month} onChange={event=>{setMonth(Number(event.target.value));setKind("selected-month")}} style={button}>{Array.from({length:12},(_,i)=><option value={i} key={i}>{new Intl.DateTimeFormat("es-BO",{month:"short"}).format(new Date(2026,i,1))}</option>)}</select>
        <select value={year} onChange={event=>{setYear(Number(event.target.value));setKind("selected-month")}} style={button}>{Array.from({length:8},(_,i)=>now.getFullYear()-4+i).map(value=><option key={value}>{value}</option>)}</select>
        {kind==="custom"&&<><input aria-label="Desde" type="date" value={from} onChange={event=>setFrom(event.target.value)} style={button}/><input aria-label="Hasta" type="date" value={to} onChange={event=>setTo(event.target.value)} style={button}/></>}
      </div>
      <div style={controls}><small style={{display:"flex",alignItems:"center",gap:5,color:"#74807c"}}><CalendarDays size={14}/>{period.label}</small><PeriodButton label="Resumen" active={view==="summary"} onClick={()=>setView("summary")}/><PeriodButton label="Detalle" active={view==="detail"} onClick={()=>setView("detail")}/></div>
    </section>

    {unknownDates>0&&<div style={{padding:"7px 10px",border:"1px solid #e6d9b9",background:"#fbf7ee",borderRadius:8,fontSize:10,color:"#695d42"}}>{unknownDates} registro(s) sin fecha interpretable no se incluyen en el período.</div>}

    {view==="summary"?<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10}}>
        <Kpi icon={<ArrowUpRight/>} label="Ingresos totales" value={money(income)} change={variation(income,priorIncome)}/><Kpi icon={<WalletCards/>} label="Ingresos clínicos / servicios" value={money(serviceAndOtherIncome)}/><Kpi icon={<TrendingUp/>} label="Utilidad de productos" value={money(productProfit)} change={variation(productProfit,priorProductProfit)}/><Kpi icon={<CircleDollarSign/>} label="Margen de productos" value={pct(productMargin)}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,minHeight:0}}>
        <section className="panel" style={compactPanel}><Heading title="Resumen financiero"/><MiniRow label="Facturado" value={money(registered)}/><MiniRow label="Cobrado" value={money(income)}/><MiniRow label="Pendiente" value={money(pending)}/><MiniRow label="Operaciones" value={String(valid.length)}/></section>
        <section className="panel" style={compactPanel}><Heading title="Ingresos"/>{incomeOrigins.length?incomeOrigins.slice(0,3).map(item=><ShareRow key={item.name} label={item.name} amount={item.amount} total={income}/>):<Empty/>}<MiniRow label="Método principal" value={methodRows[0]?.[0]||"Sin datos"}/></section>
        <section className="panel" style={compactPanel}><Heading title="Costos y gastos"/><MiniRow label="Costo de ventas" value={money(cogs)}/>{operatingExpenseOrigins.length?operatingExpenseOrigins.slice(0,2).map(item=><MiniRow key={item.name} label={item.name} value={money(item.amount)}/>):<MiniRow label="Gastos operativos" value={money(operatingExpenses)}/>}<MiniRow label="Compras de inventario" value={money(purchaseExpenses)}/></section>
        <section className="panel" style={compactPanel}><Heading title="Productos"/><MiniRow label="Vendidos" value={`${unitsSold} u.`}/><MiniRow label="Ventas de productos" value={money(productRevenue)}/><MiniRow label="Costo de productos vendidos" value={money(cogs)}/><MiniRow label="Utilidad de productos" value={money(productProfit)}/>{topProduct&&<MiniRow label="Más vendido" value={topProduct[0]}/>}</section>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,minHeight:0}}>
        <section className="panel" style={compactPanel}><Heading title="Servicios destacados"/>{serviceStats.length?serviceStats.slice(0,4).map(item=><MiniRow key={item.name} label={`${item.name} · ${item.count}`} value={money(item.revenue)}/>):<Empty/>}</section>
        <section className="panel" style={compactPanel}><Heading title="Lectura rápida"/><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}><Quick label="Flujo de caja" value={money(cashFlow)}/><Quick label="Ingresos clínicos / servicios" value={money(serviceAndOtherIncome)}/><Quick label="Margen productos" value={pct(productMargin)}/></div><small style={{display:"block",marginTop:8,color:"#7d8581",fontSize:9}}>La utilidad y el margen se calculan solo para productos vendidos. Consultas, procedimientos, tratamientos y otros servicios se registran como ingresos y forman parte de los ingresos totales.</small></section>
      </div>
    </>:<section className="panel" style={{...compactPanel,display:"grid",gap:8}}>
      <div style={{display:"flex",gap:8,alignItems:"center"}}><div className="search" style={{margin:0,flex:1}}><Search/><Input value={query} onChange={event=>{setQuery(event.target.value);setPage(0)}} placeholder="Buscar movimiento"/></div><select value={typeFilter} onChange={event=>{setTypeFilter(event.target.value);setPage(0)}} style={button}><option>Todos</option><option>Ingreso</option><option>Egreso</option></select></div>
      <div className="table"><table style={{minWidth:0,width:"100%"}}><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Método</th><th>Estado</th><th>Importe</th></tr></thead><tbody>{visibleDetail.map(tx=><tr key={tx.id}><td>{tx.date}</td><td><b>{tx.concept}</b><small style={{display:"block"}}>{tx.reference}</small></td><td>{tx.type}</td><td>{tx.method}</td><td>{tx.status??"—"}</td><td className={tx.type==="Ingreso"?"green":"red"}>{tx.type==="Ingreso"?"+":"−"}{money(tx.amount)}</td></tr>)}</tbody></table>{visibleDetail.length===0&&<Empty/>}</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:"#76807d"}}><span>{detail.length} movimiento(s)</span><div style={controls}><button aria-label="Página anterior" style={button} disabled={safePage===0} onClick={()=>setPage(current=>Math.max(0,current-1))}><ChevronLeft size={14}/></button><span>{safePage+1} / {pageCount}</span><button aria-label="Página siguiente" style={button} disabled={safePage>=pageCount-1} onClick={()=>setPage(current=>Math.min(pageCount-1,current+1))}><ChevronRight size={14}/></button></div></div>
    </section>}
  </div>
}

function PeriodButton({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}){return <button style={active?activeButton:button} onClick={onClick}>{label}</button>}
function Heading({title}:{title:string}){return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}><h3 style={{fontFamily:"Georgia,serif",fontSize:14,margin:0,color:"#234a43"}}>{title}</h3></div>}
function MiniRow({label,value}:{label:string;value:string}){return <div style={row}><span style={{color:"#697773",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span><b style={{color:"#234a43",textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</b></div>}
function ShareRow({label,amount,total}:{label:string;amount:number;total:number}){const share=total>0?amount/total*100:0;return <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,padding:"5px 0",fontSize:11,borderBottom:"1px solid #edf0ee"}}><span style={{color:"#697773"}}>{label}</span><b style={{color:"#234a43"}}>{money(amount)} · {pct(share)}</b></div>}
function Quick({label,value}:{label:string;value:string}){return <div style={{border:"1px solid #e6ebe8",borderRadius:9,padding:10,display:"grid",gap:3,background:"#fbfcfb"}}><small style={{fontSize:9,textTransform:"uppercase",color:"#7d8581"}}>{label}</small><b style={{fontSize:14,color:"#204940"}}>{value}</b></div>}
function Kpi({icon,label,value,change,invert=false}:{icon:React.ReactNode;label:string;value:string;change?:number|null;invert?:boolean}){const has=change!==undefined&&change!==null,up=(change||0)>=0,good=invert?!up:up;return <article className="metric" style={{minWidth:0,minHeight:92,padding:"12px 10px 10px 48px"}}><span style={{left:10,top:12,width:28,height:28}}>{icon}</span><p style={{marginBottom:4}}>{label}</p><strong style={{fontSize:19}}>{value}</strong>{has&&<small style={{marginTop:4,color:good?"#2e725f":"#a65c50"}}>{up?"↑":"↓"} {Math.abs(change||0).toLocaleString("es-BO",{maximumFractionDigits:1})}%</small>}</article>}
function Empty(){return <div style={{display:"flex",alignItems:"center",gap:7,padding:"10px 0",color:"#818885",fontSize:11}}><PackageOpen size={15}/><span>Sin datos en el período.</span></div>}
