"use client";

import {useState,type CSSProperties} from "react";
import {ArrowDownRight,ArrowUpRight,CalendarDays,CircleDollarSign,PackageOpen,Search,TrendingUp} from "lucide-react";
import {Input} from "@/components/ui/input";
import type {Product,Tx} from "@/app/page";

type ServiceLike={id:number;name:string;category:string;price:number;duration:string;active:boolean};
type PeriodKind="week"|"month"|"previous-month"|"year"|"custom"|"selected-month";
type ProductSort="units"|"revenue"|"profit";
type Period={start:Date;end:Date;label:string;kind:PeriodKind};
type ProductStat={id:number;name:string;units:number;revenue:number;cost:number;profit:number;margin:number};
type WeekStat={label:string;income:number;expenses:number};

const money=(value:number)=>new Intl.NumberFormat("es-BO",{style:"currency",currency:"BOB",maximumFractionDigits:0}).format(Number.isFinite(value)?value:0);
const pct=(value:number)=>`${new Intl.NumberFormat("es-BO",{maximumFractionDigits:1}).format(Number.isFinite(value)?value:0)} %`;
const sum=(rows:Tx[])=>rows.reduce((total,row)=>total+(Number(row.amount)||0),0);
const normalize=(value:string)=>value.trim().toLocaleLowerCase("es-BO");
const startDay=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate());
const endDay=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate(),23,59,59,999);
const addDays=(date:Date,days:number)=>{const next=new Date(date);next.setDate(next.getDate()+days);return next};
const inputDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const parseInput=(value:string)=>{const [year,month,day]=value.split("-").map(Number);return new Date(year,month-1,day)};
const shortDate=(date:Date)=>new Intl.DateTimeFormat("es-BO",{day:"2-digit",month:"short"}).format(date).replace(".","");
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

const cardGrid:CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14};
const twoGrid:CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:18};
const controlRow:CSSProperties={display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"};
const buttonBase:CSSProperties={border:"1px solid #d9dfdc",background:"#fff",color:"#36504a",borderRadius:9,padding:"8px 11px",fontWeight:700,cursor:"pointer"};
const buttonActive:CSSProperties={...buttonBase,background:"#f7f2e6",borderColor:"#b59a5a",color:"#234a43"};
const rowStyle:CSSProperties={display:"flex",justifyContent:"space-between",gap:16,padding:"10px 0",borderBottom:"1px solid #edf0ee",fontSize:13};
const highlightStyle:CSSProperties={border:"1px solid #e5e9e7",borderRadius:11,padding:12,display:"grid",gap:4,background:"#fbfcfb"};

export function AccountingPanel({txs,products,services}:{txs:Tx[];products:Product[];services:ServiceLike[]}){
  const now=new Date();
  const[kind,setKind]=useState<PeriodKind>("month"),[from,setFrom]=useState(inputDate(new Date(now.getFullYear(),now.getMonth(),1))),[to,setTo]=useState(inputDate(now)),[month,setMonth]=useState(now.getMonth()),[year,setYear]=useState(now.getFullYear());
  const[productSort,setProductSort]=useState<ProductSort>("units"),[query,setQuery]=useState(""),[typeFilter,setTypeFilter]=useState("Todos"),[originFilter,setOriginFilter]=useState("Todos");

  const period=buildPeriod(kind,from,to,month,year),previous=previousPeriod(period);
  const dated=txs.map(tx=>({tx,date:txDate(tx)}));
  const rows=dated.filter(item=>inRange(item.date,period.start,period.end)).map(item=>item.tx),valid=rows.filter(validTx),incomeRows=valid.filter(paidIncome),expenseRows=valid.filter(tx=>tx.type==="Egreso"),pendingRows=valid.filter(tx=>tx.type==="Ingreso"&&tx.status==="Pendiente"),registeredRows=valid.filter(tx=>tx.type==="Ingreso");
  const income=sum(incomeRows),expenses=sum(expenseRows),profit=income-expenses,margin=income>0?profit/income*100:0,pending=sum(pendingRows),registered=sum(registeredRows);
  const priorRows=dated.filter(item=>inRange(item.date,previous.start,previous.end)).map(item=>item.tx).filter(validTx),priorIncome=sum(priorRows.filter(paidIncome)),priorExpenses=sum(priorRows.filter(tx=>tx.type==="Egreso")),priorProfit=priorIncome-priorExpenses;
  const unknownDates=dated.filter(item=>item.date===null).length;

  const sales=incomeRows.filter(tx=>tx.origin==="product-sale"),unitsSold=sales.reduce((total,tx)=>total+(Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0),0),productRevenue=sum(sales),cogs=sales.reduce((total,tx)=>total+saleUnitCost(tx,products,txs)*(Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0),0);
  const productMap=new Map<number,ProductStat>();
  sales.forEach(tx=>{const id=Number(tx.productId)||-1,units=Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0,cost=saleUnitCost(tx,products,txs)*units,current=productMap.get(id)||{id,name:tx.productName||products.find(product=>product.id===id)?.name||"Producto",units:0,revenue:0,cost:0,profit:0,margin:0};current.units+=units;current.revenue+=Number(tx.amount)||0;current.cost+=cost;current.profit=current.revenue-current.cost;current.margin=current.revenue>0?current.profit/current.revenue*100:0;productMap.set(id,current)});
  const productStats=Array.from(productMap.values()),sortedProducts=[...productStats].sort((a,b)=>productSort==="units"?b.units-a.units:productSort==="revenue"?b.revenue-a.revenue:b.profit-a.profit),lowMargin=[...productStats].filter(item=>item.revenue>0).sort((a,b)=>a.margin-b.margin).slice(0,5),topRevenue=[...productStats].sort((a,b)=>b.revenue-a.revenue)[0];

  const serviceStats=services.map(service=>{const matched=incomeRows.filter(tx=>tx.origin==="cash"&&normalize(tx.concept)===normalize(service.name));return{name:service.name,count:matched.length,revenue:sum(matched)}}).filter(item=>item.count>0).sort((a,b)=>b.revenue-a.revenue),serviceRevenue=serviceStats.reduce((total,item)=>total+item.revenue,0),otherRevenue=Math.max(0,income-productRevenue-serviceRevenue);

  const weeks:WeekStat[]=[];let cursor=startDay(period.start),index=1;
  while(cursor.getTime()<=period.end.getTime()&&index<=54){const candidate=addDays(cursor,6),weekEnd=endDay(candidate.getTime()>period.end.getTime()?period.end:candidate),weekRows=dated.filter(item=>inRange(item.date,cursor,weekEnd)).map(item=>item.tx).filter(validTx),weekIncome=sum(weekRows.filter(paidIncome)),weekExpenses=sum(weekRows.filter(tx=>tx.type==="Egreso"));weeks.push({label:`${shortDate(cursor)}–${shortDate(weekEnd)}`,income:weekIncome,expenses:weekExpenses});cursor=startDay(addDays(weekEnd,1));index++}
  const maxWeek=Math.max(1,...weeks.map(week=>Math.max(week.income,week.expenses)));

  const methods=new Map<string,number>();incomeRows.forEach(tx=>methods.set(tx.method||"Otros",(methods.get(tx.method||"Otros")||0)+(Number(tx.amount)||0)));const methodRows=Array.from(methods.entries()).sort((a,b)=>b[1]-a[1]);
  const purchaseExpenses=sum(expenseRows.filter(tx=>tx.origin==="product-purchase")),manualExpenses=sum(expenseRows.filter(tx=>tx.origin==="manual")),otherExpenses=Math.max(0,expenses-purchaseExpenses-manualExpenses),incomeOrigins=[{name:"Servicios / consultas",amount:serviceRevenue},{name:"Productos",amount:productRevenue},{name:"Otros ingresos",amount:otherRevenue}].filter(item=>item.amount>0),expenseOrigins=[{name:"Compra de productos",amount:purchaseExpenses},{name:"Gastos / egresos manuales",amount:manualExpenses},{name:"Otros egresos",amount:otherExpenses}].filter(item=>item.amount>0);
  const origins=["Todos",...Array.from(new Set(rows.map(tx=>tx.origin||"Sin origen")))],detail=rows.filter(tx=>{const search=(tx.concept+" "+tx.reference+" "+(tx.productName||"")).toLowerCase().includes(query.toLowerCase()),type=typeFilter==="Todos"||tx.type===typeFilter,origin=originFilter==="Todos"||(tx.origin||"Sin origen")===originFilter;return search&&type&&origin}).sort((a,b)=>(txDate(b)?.getTime()||0)-(txDate(a)?.getTime()||0));

  return <div style={{display:"grid",gap:18}}>
    <p style={{margin:0,color:"#66706d",fontSize:14}}>Resumen financiero y operativo del consultorio</p>

    <section className="panel" style={{display:"grid",gap:12,padding:14}}>
      <div style={controlRow}><PeriodButton label="Esta semana" active={kind==="week"} onClick={()=>setKind("week")}/><PeriodButton label="Este mes" active={kind==="month"} onClick={()=>setKind("month")}/><PeriodButton label="Mes anterior" active={kind==="previous-month"} onClick={()=>setKind("previous-month")}/><PeriodButton label="Este año" active={kind==="year"} onClick={()=>setKind("year")}/><PeriodButton label="Personalizado" active={kind==="custom"} onClick={()=>setKind("custom")}/></div>
      <div style={controlRow}><label style={{fontSize:12,color:"#66706d"}}>Mes <select value={month} onChange={event=>setMonth(Number(event.target.value))} style={buttonBase}>{Array.from({length:12},(_,i)=><option value={i} key={i}>{new Intl.DateTimeFormat("es-BO",{month:"long"}).format(new Date(2026,i,1))}</option>)}</select></label><label style={{fontSize:12,color:"#66706d"}}>Año <select value={year} onChange={event=>setYear(Number(event.target.value))} style={buttonBase}>{Array.from({length:8},(_,i)=>now.getFullYear()-4+i).map(value=><option key={value}>{value}</option>)}</select></label><button style={buttonBase} onClick={()=>setKind("selected-month")}>Ver mes</button>{kind==="custom"&&<><label style={{fontSize:12,color:"#66706d"}}>Desde <input type="date" value={from} onChange={event=>setFrom(event.target.value)} style={buttonBase}/></label><label style={{fontSize:12,color:"#66706d"}}>Hasta <input type="date" value={to} onChange={event=>setTo(event.target.value)} style={buttonBase}/></label></>}</div>
      <small style={{display:"flex",gap:6,alignItems:"center",color:"#79817e"}}><CalendarDays size={15}/> Período: {period.label}</small>
    </section>

    {unknownDates>0&&<div style={{padding:12,border:"1px solid #e6d9b9",background:"#fbf7ee",borderRadius:10,fontSize:12,color:"#695d42"}}>{unknownDates} registro(s) histórico(s) tienen una fecha que no puede interpretarse con seguridad y no se incluyen en análisis por período. No se modificaron ni se asignaron fechas ficticias.</div>}

    <div style={cardGrid}><Kpi icon={<ArrowUpRight/>} label="Ingresos" value={money(income)} note="Cobrado en el período" change={variation(income,priorIncome)}/><Kpi icon={<ArrowDownRight/>} label="Egresos" value={money(expenses)} note="Egresos válidos" change={variation(expenses,priorExpenses)} invert/><Kpi icon={<TrendingUp/>} label="Utilidad" value={money(profit)} note="Ingresos − egresos" change={variation(profit,priorProfit)}/><Kpi icon={<CircleDollarSign/>} label="Margen" value={pct(margin)} note="Utilidad / ingresos"/></div>

    <div style={twoGrid}><section className="panel"><Heading title="Estado del período" text="Resumen financiero consolidado"/><Row label="Facturado / registrado" value={money(registered)}/><Row label="Cobrado" value={money(income)}/><Row label="Pendiente" value={money(pending)}/><Row label="Egresos" value={money(expenses)}/><Row label="Resultado" value={money(profit)} strong/><Row label="Margen" value={pct(margin)} strong/><Row label="Número de operaciones" value={String(valid.length)}/><Row label="Productos vendidos" value={`${unitsSold} unidades`}/><Row label="Pacientes atendidos" value="Sin fuente fiable actualmente"/></section><section className="panel"><Heading title="Balance del período" text="Resumen operativo, no saldo de caja"/><div style={cardGrid}><Mini label="Total ingresos" value={money(income)}/><Mini label="Total egresos" value={money(expenses)}/><Mini label="Utilidad" value={money(profit)}/><Mini label="Margen" value={pct(margin)}/><Mini label="Cobros pendientes" value={money(pending)} note={`${pendingRows.length} cobro(s)`}/><Mini label="CPV / COGS" value={money(cogs)}/></div></section></div>

    <section className="panel"><Heading title="Tendencia financiera" text="Vista gráfica de ingresos y egresos dentro del período seleccionado"/><div style={{display:"flex",gap:16,alignItems:"center",marginBottom:12,fontSize:11,color:"#6f7774"}}><span style={{display:"flex",gap:6,alignItems:"center"}}><i style={{width:9,height:9,borderRadius:3,background:"#2f6b5e",display:"inline-block"}}/>Ingresos</span><span style={{display:"flex",gap:6,alignItems:"center"}}><i style={{width:9,height:9,borderRadius:3,background:"#b59a5a",display:"inline-block"}}/>Egresos</span></div><div style={{overflowX:"auto",paddingBottom:4}}><div style={{display:"grid",gridTemplateColumns:`repeat(${Math.max(weeks.length,1)},minmax(48px,1fr))`,gap:10,alignItems:"end",minWidth:Math.max(320,weeks.length*58),height:190,borderBottom:"1px solid #e7ebe9",padding:"10px 4px 0"}}>{weeks.map(week=><div key={week.label} title={`${week.label} · Ingresos ${money(week.income)} · Egresos ${money(week.expenses)}`} style={{height:"100%",display:"grid",gridTemplateRows:"1fr auto",gap:7,minWidth:0}}><div style={{display:"flex",alignItems:"end",justifyContent:"center",gap:4,height:"100%"}}><div style={{width:"34%",minWidth:8,maxWidth:20,height:`${Math.max(2,week.income/maxWeek*100)}%`,background:"#2f6b5e",borderRadius:"5px 5px 1px 1px"}}/><div style={{width:"34%",minWidth:8,maxWidth:20,height:`${Math.max(2,week.expenses/maxWeek*100)}%`,background:"#b59a5a",borderRadius:"5px 5px 1px 1px"}}/></div><small style={{fontSize:9,color:"#7c8581",textAlign:"center",whiteSpace:"nowrap"}}>{week.label}</small></div>)}</div></div></section>

    <div style={twoGrid}><section className="panel"><Heading title="Origen de ingresos" text="Servicios, productos y otros ingresos"/>{incomeOrigins.length?incomeOrigins.map(item=><Progress key={item.name} label={item.name} amount={item.amount} total={income}/>):<Empty text="Sin ingresos en el período seleccionado."/>}</section><section className="panel"><Heading title="Egresos por origen" text="Clasificación derivada del origin real"/>{expenseOrigins.length?expenseOrigins.map(item=><Progress key={item.name} label={item.name} amount={item.amount} total={expenses}/>):<Empty text="Sin egresos en el período seleccionado."/>}</section></div>

    <div style={twoGrid}><section className="panel"><Heading title="Métodos de pago" text="Solo dinero efectivamente cobrado"/>{methodRows.length?methodRows.map(([name,amount])=><Progress key={name} label={name} amount={amount} total={income}/>):<Empty text="Sin cobros pagados en este período."/>}</section><section className="panel"><Heading title="Servicios" text="Ingresos identificables por coincidencia con servicios configurados"/>{serviceStats.length?serviceStats.map(item=><div key={item.name} style={rowStyle}><span><b>{item.name}</b><small style={{display:"block",color:"#858b88"}}>{item.count} operación(es)</small></span><span style={{textAlign:"right"}}><b>{money(item.revenue)}</b><small style={{display:"block",color:"#858b88"}}>{pct(income>0?item.revenue/income*100:0)}</small></span></div>):<Empty text="No existen movimientos de servicios identificables en este período."/>}<p style={{fontSize:11,color:"#7b817f",lineHeight:1.45}}>ASHA aún no conserva una colección estructurada de atenciones clínicas. Por eso este módulo no fabrica “pacientes atendidos”, pacientes nuevos/recurrentes ni semanas clínicas.</p></section></div>

    <section className="panel"><Heading title="Productos" text="Ventas, costo de productos vendidos y rentabilidad"/><div style={cardGrid}><Mini label="Unidades vendidas" value={String(unitsSold)} note="unidades"/><Mini label="Facturación de productos" value={money(productRevenue)}/><Mini label="Costo de productos vendidos" value={money(cogs)} note="CPV / COGS"/><Mini label="Utilidad bruta productos" value={money(productRevenue-cogs)}/><Mini label="Producto con mayor facturación" value={topRevenue?.name||"Sin datos"} note={topRevenue?money(topRevenue.revenue):undefined}/></div><div style={{...controlRow,marginTop:16}}><b style={{fontSize:12,color:"#4f625c",marginRight:"auto"}}>TOP PRODUCTOS</b><PeriodButton label="Unidades" active={productSort==="units"} onClick={()=>setProductSort("units")}/><PeriodButton label="Facturación" active={productSort==="revenue"} onClick={()=>setProductSort("revenue")}/><PeriodButton label="Utilidad" active={productSort==="profit"} onClick={()=>setProductSort("profit")}/></div>{sortedProducts.length?<div style={{display:"grid",marginTop:8}}>{sortedProducts.slice(0,5).map((item,i)=><div key={item.id} style={{display:"grid",gridTemplateColumns:"30px minmax(0,1fr) auto",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid #edf0ee"}}><span style={{width:26,height:26,borderRadius:8,background:"#eef4f1",display:"grid",placeItems:"center",fontWeight:800,color:"#2f665a"}}>{i+1}</span><span><b style={{display:"block",color:"#284d45"}}>{item.name}</b><small style={{color:"#818783"}}>{item.units} u. · Facturación {money(item.revenue)} · Participación {pct(productRevenue>0?item.revenue/productRevenue*100:0)}</small></span><span style={{textAlign:"right"}}><b style={{display:"block",color:"#284d45"}}>{money(item.profit)}</b><small style={{color:"#818783"}}>Costo {money(item.cost)} · margen {pct(item.margin)}</small></span></div>)}</div>:<Empty text="Sin ventas de productos en el período seleccionado."/>}{lowMargin.length>0&&<div style={{marginTop:14,borderTop:"1px solid #edf0ee",paddingTop:12}}><b style={{fontSize:12,color:"#586964"}}>Productos con menor margen</b>{lowMargin.map(item=><div key={item.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,paddingTop:8,color:"#66726e"}}><span>{item.name}</span><b style={{color:"#9a7e45"}}>{pct(item.margin)}</b></div>)}</div>}</section>

    <section className="panel"><Heading title="Detalle financiero" text="Vista directa de txs; no crea una segunda tabla de movimientos"/><div style={{...controlRow,marginBottom:14}}><div className="search" style={{flex:"1 1 240px"}}><Search/><Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar concepto, referencia o producto"/></div><select value={typeFilter} onChange={event=>setTypeFilter(event.target.value)} style={buttonBase}><option>Todos</option><option>Ingreso</option><option>Egreso</option></select><select value={originFilter} onChange={event=>setOriginFilter(event.target.value)} style={buttonBase}>{origins.map(origin=><option key={origin}>{origin}</option>)}</select></div><div className="table" style={{overflowX:"auto"}}><table style={{minWidth:850}}><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Origen</th><th>Referencia</th><th>Método</th><th>Estado</th><th>Importe</th></tr></thead><tbody>{detail.map(tx=><tr key={tx.id}><td>{tx.date}</td><td>{tx.type}</td><td><b>{tx.concept}</b>{tx.productName&&<small style={{display:"block"}}>{tx.productName}</small>}</td><td>{tx.origin||"—"}</td><td>{tx.reference}</td><td>{tx.method}</td><td>{tx.status??(tx.type==="Ingreso"?"Pagado":"—")}</td><td className={tx.type==="Ingreso"?"green":"red"}>{tx.type==="Ingreso"?"+":"−"}{money(tx.amount)}</td></tr>)}</tbody></table>{detail.length===0&&<Empty text="Sin movimientos para los filtros seleccionados."/>}</div></section>
  </div>
}

function PeriodButton({label,active,onClick}:{label:string;active:boolean;onClick:()=>void}){return <button style={active?buttonActive:buttonBase} onClick={onClick}>{label}</button>}
function Heading({title,text}:{title:string;text:string}){return <div className="title"><div><h3>{title}</h3><p>{text}</p></div></div>}
function Row({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <div style={{...rowStyle,fontWeight:strong?800:400,color:strong?"#173f37":undefined}}><span>{label}</span><b>{value}</b></div>}
function Kpi({icon,label,value,note,change,invert=false}:{icon:React.ReactNode;label:string;value:string;note:string;change?:number|null;invert?:boolean}){const has=change!==undefined&&change!==null,up=(change||0)>=0,good=invert?!up:up;return <article className="metric" style={{minWidth:0}}><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{note}</small>{has?<small style={{color:good?"#2e725f":"#a65c50"}}>{up?"↑":"↓"} {Math.abs(change||0).toLocaleString("es-BO",{maximumFractionDigits:1})} % vs período anterior</small>:change===null?<small>Sin datos suficientes para comparar.</small>:null}</article>}
function Mini({label,value,note}:{label:string;value:string;note?:string}){return <div style={highlightStyle}><small style={{color:"#7d8581",textTransform:"uppercase",fontSize:10}}>{label}</small><b style={{color:"#204940",fontSize:15}}>{value}</b>{note&&<small style={{color:"#7b817f"}}>{note}</small>}</div>}
function Progress({label,amount,total}:{label:string;amount:number;total:number}){const share=total>0?amount/total*100:0;return <div style={{display:"grid",gap:7,margin:"14px 0"}}><div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:12,fontSize:12}}><span>{label}</span><b>{money(amount)}</b><small>{pct(share)}</small></div><div style={{height:7,borderRadius:999,background:"#edf0ee",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,Math.max(0,share))}%`,background:"#35695d",borderRadius:999}}/></div></div>}
function Empty({text}:{text:string}){return <div style={{display:"flex",alignItems:"center",gap:9,padding:"18px 0",color:"#818885",fontSize:12}}><PackageOpen size={18}/><span>{text}</span></div>}