"use client";

import {useState} from "react";
import {ArrowDownRight,ArrowUpRight,CalendarDays,CircleDollarSign,PackageOpen,Search,TrendingUp,WalletCards,type LucideIcon} from "lucide-react";
import {Input} from "@/components/ui/input";
import type {Product,Service,Tx} from "@/app/page";
import styles from "./accounting.module.css";

type PeriodKind="week"|"month"|"previous-month"|"year"|"custom"|"selected-month";
type ProductSort="units"|"revenue"|"profit";
type Period={start:Date;end:Date;label:string;kind:PeriodKind};
type ProductStat={id:number;name:string;units:number;revenue:number;cost:number;profit:number;margin:number};
type WeeklyStat={label:string;income:number;expenses:number;profit:number;operations:number;units:number};

const money=(value:number)=>new Intl.NumberFormat("es-BO",{style:"currency",currency:"BOB",maximumFractionDigits:0}).format(Number.isFinite(value)?value:0);
const percent=(value:number)=>`${new Intl.NumberFormat("es-BO",{maximumFractionDigits:1}).format(Number.isFinite(value)?value:0)} %`;
const startOfDay=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate());
const endOfDay=(date:Date)=>new Date(date.getFullYear(),date.getMonth(),date.getDate(),23,59,59,999);
const addDays=(date:Date,days:number)=>{const copy=new Date(date);copy.setDate(copy.getDate()+days);return copy};
const inputDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const parseInput=(value:string)=>{const parts=value.split("-").map(Number);return new Date(parts[0],parts[1]-1,parts[2])};
const normalize=(value:string)=>value.trim().toLocaleLowerCase("es-BO");
const sum=(rows:Tx[])=>rows.reduce((total,row)=>total+(Number(row.amount)||0),0);
const isValid=(tx:Tx)=>tx.status!=="Anulado";
const isPaidIncome=(tx:Tx)=>tx.type==="Ingreso"&&tx.status!=="Pendiente"&&tx.status!=="Anulado";

function parseTxDate(tx:Tx):Date|null{
  if(tx.createdAt){const date=new Date(tx.createdAt);if(!Number.isNaN(date.getTime()))return date}
  const match=String(tx.date||"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:,)?\s+(\d{1,2}):(\d{2})/);
  if(!match)return null;
  const rawYear=Number(match[3]),year=rawYear<100?2000+rawYear:rawYear;
  const date=new Date(year,Number(match[2])-1,Number(match[1]),Number(match[4]),Number(match[5]));
  return Number.isNaN(date.getTime())?null:date;
}

function currentPeriod(kind:PeriodKind,from:string,to:string,month:number,year:number):Period{
  const now=new Date();
  if(kind==="week"){
    const mondayOffset=(now.getDay()+6)%7,start=startOfDay(addDays(now,-mondayOffset));
    return{start,end:endOfDay(addDays(start,6)),label:"Esta semana",kind};
  }
  if(kind==="previous-month"){
    const start=new Date(now.getFullYear(),now.getMonth()-1,1),end=endOfDay(new Date(now.getFullYear(),now.getMonth(),0));
    return{start,end,label:new Intl.DateTimeFormat("es-BO",{month:"long",year:"numeric"}).format(start),kind};
  }
  if(kind==="year")return{start:new Date(now.getFullYear(),0,1),end:endOfDay(new Date(now.getFullYear(),11,31)),label:String(now.getFullYear()),kind};
  if(kind==="selected-month"){
    const start=new Date(year,month,1),end=endOfDay(new Date(year,month+1,0));
    return{start,end,label:new Intl.DateTimeFormat("es-BO",{month:"long",year:"numeric"}).format(start),kind};
  }
  if(kind==="custom"&&from&&to){
    const first=parseInput(from),second=parseInput(to),forward=first.getTime()<=second.getTime();
    return{start:startOfDay(forward?first:second),end:endOfDay(forward?second:first),label:`${from} a ${to}`,kind};
  }
  const start=new Date(now.getFullYear(),now.getMonth(),1),end=endOfDay(new Date(now.getFullYear(),now.getMonth()+1,0));
  return{start,end,label:"Este mes",kind:"month"};
}

function priorPeriod(period:Period){
  if(period.kind==="month"||period.kind==="previous-month"||period.kind==="selected-month"){
    return{start:new Date(period.start.getFullYear(),period.start.getMonth()-1,1),end:endOfDay(new Date(period.start.getFullYear(),period.start.getMonth(),0))};
  }
  const days=Math.max(1,Math.round((startOfDay(period.end).getTime()-startOfDay(period.start).getTime())/86400000)+1);
  const end=endOfDay(addDays(period.start,-1));
  return{start:startOfDay(addDays(end,-days+1)),end};
}

function inRange(date:Date|null,start:Date,end:Date){if(!date)return false;const time=date.getTime();return time>=start.getTime()&&time<=end.getTime()}
function variation(current:number,previous:number){return previous===0?null:((current-previous)/Math.abs(previous))*100}

function unitCostForSale(sale:Tx,products:Product[],txs:Tx[]){
  if(typeof sale.unitCost==="number"&&Number.isFinite(sale.unitCost))return sale.unitCost;
  if(typeof sale.costAmount==="number"&&(Number(sale.quantity)||0)>0)return sale.costAmount/Number(sale.quantity);
  const saleDate=parseTxDate(sale);
  const purchases=txs.filter(tx=>tx.origin==="product-purchase"&&tx.productId===sale.productId&&typeof tx.unitPrice==="number").filter(tx=>{const purchaseDate=parseTxDate(tx);return !saleDate||!purchaseDate||purchaseDate.getTime()<=saleDate.getTime()}).sort((a,b)=>(parseTxDate(b)?.getTime()||0)-(parseTxDate(a)?.getTime()||0));
  if(purchases.length>0)return Number(purchases[0].unitPrice)||0;
  return Number(products.find(product=>product.id===sale.productId)?.purchaseCost)||0;
}

export function AccountingPanel({txs,products,services}:{txs:Tx[];products:Product[];services:Service[]}){
  const now=new Date();
  const[kind,setKind]=useState<PeriodKind>("month");
  const[from,setFrom]=useState(inputDate(new Date(now.getFullYear(),now.getMonth(),1)));
  const[to,setTo]=useState(inputDate(now));
  const[month,setMonth]=useState(now.getMonth());
  const[year,setYear]=useState(now.getFullYear());
  const[productSort,setProductSort]=useState<ProductSort>("units");
  const[query,setQuery]=useState("");
  const[typeFilter,setTypeFilter]=useState("Todos");
  const[originFilter,setOriginFilter]=useState("Todos");

  const period=currentPeriod(kind,from,to,month,year),previous=priorPeriod(period);
  const dated=txs.map(tx=>({tx,date:parseTxDate(tx)}));
  const periodRows=dated.filter(item=>inRange(item.date,period.start,period.end)).map(item=>item.tx);
  const validRows=periodRows.filter(isValid);
  const incomeRows=validRows.filter(isPaidIncome);
  const expenseRows=validRows.filter(tx=>tx.type==="Egreso");
  const pendingRows=validRows.filter(tx=>tx.type==="Ingreso"&&tx.status==="Pendiente");
  const registeredRows=validRows.filter(tx=>tx.type==="Ingreso");
  const income=sum(incomeRows),expenses=sum(expenseRows),profit=income-expenses,margin=income>0?profit/income*100:0,pending=sum(pendingRows),registered=sum(registeredRows);

  const previousRows=dated.filter(item=>inRange(item.date,previous.start,previous.end)).map(item=>item.tx).filter(isValid);
  const previousIncome=sum(previousRows.filter(isPaidIncome)),previousExpenses=sum(previousRows.filter(tx=>tx.type==="Egreso")),previousProfit=previousIncome-previousExpenses;
  const unreadableDates=dated.filter(item=>item.date===null).length;

  const productSales=incomeRows.filter(tx=>tx.origin==="product-sale");
  const unitsSold=productSales.reduce((total,tx)=>total+(Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0),0);
  const productRevenue=sum(productSales);
  const cogs=productSales.reduce((total,tx)=>total+unitCostForSale(tx,products,txs)*(Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0),0);
  const productMap=new Map<number,ProductStat>();
  productSales.forEach(tx=>{
    const id=Number(tx.productId)||-1,units=Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0,cost=unitCostForSale(tx,products,txs)*units;
    const existing=productMap.get(id)||{id,name:tx.productName||products.find(product=>product.id===id)?.name||"Producto",units:0,revenue:0,cost:0,profit:0,margin:0};
    existing.units+=units;existing.revenue+=Number(tx.amount)||0;existing.cost+=cost;existing.profit=existing.revenue-existing.cost;existing.margin=existing.revenue>0?existing.profit/existing.revenue*100:0;productMap.set(id,existing);
  });
  const productStats=Array.from(productMap.values());
  const sortedProducts=[...productStats].sort((a,b)=>productSort==="units"?b.units-a.units:productSort==="revenue"?b.revenue-a.revenue:b.profit-a.profit);
  const lowMargin=[...productStats].filter(item=>item.revenue>0).sort((a,b)=>a.margin-b.margin).slice(0,5);
  const topRevenue=[...productStats].sort((a,b)=>b.revenue-a.revenue)[0];

  const serviceStats=services.map(service=>{const rows=incomeRows.filter(tx=>tx.origin==="cash"&&normalize(tx.concept)===normalize(service.name));return{name:service.name,count:rows.length,revenue:sum(rows)}}).filter(item=>item.count>0).sort((a,b)=>b.revenue-a.revenue);
  const serviceRevenue=serviceStats.reduce((total,item)=>total+item.revenue,0);
  const otherRevenue=Math.max(0,income-productRevenue-serviceRevenue);

  const weeks:WeeklyStat[]=[];
  let cursor=startOfDay(period.start),weekIndex=1;
  while(cursor.getTime()<=period.end.getTime()&&weekIndex<=54){
    const candidate=addDays(cursor,6),weekEnd=endOfDay(candidate.getTime()>period.end.getTime()?period.end:candidate);
    const rows=dated.filter(item=>inRange(item.date,cursor,weekEnd)).map(item=>item.tx).filter(isValid),weekIncome=sum(rows.filter(isPaidIncome)),weekExpenses=sum(rows.filter(tx=>tx.type==="Egreso"));
    weeks.push({label:`Semana ${weekIndex}`,income:weekIncome,expenses:weekExpenses,profit:weekIncome-weekExpenses,operations:rows.length,units:rows.filter(tx=>tx.origin==="product-sale"&&isPaidIncome(tx)).reduce((total,tx)=>total+(Number(tx.quantity)||Math.abs(Number(tx.stockDelta))||0),0)});
    cursor=startOfDay(addDays(weekEnd,1));weekIndex++;
  }
  const maxChart=Math.max(1,...weeks.map(item=>Math.max(item.income,item.expenses)));
  const bestIncome=[...weeks].sort((a,b)=>b.income-a.income)[0],bestProfit=[...weeks].sort((a,b)=>b.profit-a.profit)[0],mostOperations=[...weeks].sort((a,b)=>b.operations-a.operations)[0];

  const methodMap=new Map<string,number>();
  incomeRows.forEach(tx=>methodMap.set(tx.method||"Otros",(methodMap.get(tx.method||"Otros")||0)+(Number(tx.amount)||0)));
  const methods=Array.from(methodMap.entries()).sort((a,b)=>b[1]-a[1]);
  const incomeOrigins=[{name:"Servicios / consultas",amount:serviceRevenue},{name:"Productos",amount:productRevenue},{name:"Otros ingresos",amount:otherRevenue}].filter(item=>item.amount>0);
  const purchaseExpenses=sum(expenseRows.filter(tx=>tx.origin==="product-purchase")),manualExpenses=sum(expenseRows.filter(tx=>tx.origin==="manual")),otherExpenses=Math.max(0,expenses-purchaseExpenses-manualExpenses);
  const expenseOrigins=[{name:"Compra de productos",amount:purchaseExpenses},{name:"Gastos / egresos manuales",amount:manualExpenses},{name:"Otros egresos",amount:otherExpenses}].filter(item=>item.amount>0);
  const originOptions=["Todos",...Array.from(new Set(periodRows.map(tx=>tx.origin||"Sin origen")))];
  const detail=periodRows.filter(tx=>{const search=(tx.concept+" "+tx.reference+" "+(tx.productName||"")).toLowerCase().includes(query.toLowerCase()),type=typeFilter==="Todos"||tx.type===typeFilter,origin=originFilter==="Todos"||(tx.origin||"Sin origen")===originFilter;return search&&type&&origin}).sort((a,b)=>(parseTxDate(b)?.getTime()||0)-(parseTxDate(a)?.getTime()||0));
  const avgWeeks=Math.max(1,weeks.length);

  return <div className={styles.accounting}>
    <p className={styles.lead}>Resumen financiero y operativo del consultorio</p>

    <section className={`${styles.filters} panel`}>
      <div className={styles.presetRow}>
        <FilterButton active={kind==="week"} label="Esta semana" onClick={()=>setKind("week")}/><FilterButton active={kind==="month"} label="Este mes" onClick={()=>setKind("month")}/><FilterButton active={kind==="previous-month"} label="Mes anterior" onClick={()=>setKind("previous-month")}/><FilterButton active={kind==="year"} label="Este año" onClick={()=>setKind("year")}/><FilterButton active={kind==="custom"} label="Personalizado" onClick={()=>setKind("custom")}/>
      </div>
      <div className={styles.monthRow}>
        <label>Mes<select value={month} onChange={event=>setMonth(Number(event.target.value))}>{Array.from({length:12},(_,index)=><option key={index} value={index}>{new Intl.DateTimeFormat("es-BO",{month:"long"}).format(new Date(2026,index,1))}</option>)}</select></label>
        <label>Año<select value={year} onChange={event=>setYear(Number(event.target.value))}>{Array.from({length:8},(_,index)=>now.getFullYear()-4+index).map(option=><option key={option}>{option}</option>)}</select></label>
        <button onClick={()=>setKind("selected-month")}>Ver mes</button>
        {kind==="custom"&&<><label>Desde<input type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={event=>setTo(event.target.value)}/></>}
      </div>
      <small><CalendarDays/> Período: {period.label}</small>
    </section>

    {unreadableDates>0&&<div className={styles.notice}>{unreadableDates} registro(s) histórico(s) no se incluyen en los filtros por período porque su fecha no puede interpretarse con seguridad. No se modificaron ni se asignaron fechas ficticias.</div>}

    <div className={styles.metrics}>
      <Metric icon={ArrowUpRight} label="Ingresos" value={money(income)} note="Cobrado en el período" change={variation(income,previousIncome)}/>
      <Metric icon={ArrowDownRight} label="Egresos" value={money(expenses)} note="Egresos válidos" change={variation(expenses,previousExpenses)} invert/>
      <Metric icon={TrendingUp} label="Utilidad" value={money(profit)} note="Ingresos − egresos" change={variation(profit,previousProfit)}/>
      <Metric icon={CircleDollarSign} label="Margen" value={percent(margin)} note="Utilidad / ingresos"/>
    </div>

    <div className={styles.grid2}>
      <section className="panel"><Heading title="Estado del período" text="Resumen financiero consolidado"/><div className={styles.statement}><Row label="Facturado / registrado" value={money(registered)}/><Row label="Cobrado" value={money(income)}/><Row label="Pendiente" value={money(pending)}/><Row label="Egresos" value={money(expenses)}/><Row label="Resultado" value={money(profit)} strong/><Row label="Margen" value={percent(margin)} strong/><Row label="Operaciones válidas" value={String(validRows.length)}/><Row label="Productos vendidos" value={`${unitsSold} unidades`}/><Row label="Pacientes atendidos" value="Sin fuente fiable actualmente"/></div></section>
      <section className="panel"><Heading title="Balance del período" text="Cobrado frente a egresos registrados"/><div className={styles.balance}><div><span>Ingresos</span><strong>{money(income)}</strong></div><div><span>Egresos</span><strong>{money(expenses)}</strong></div><div className={styles.result}><span>Utilidad</span><strong>{money(profit)}</strong><small>Margen {percent(margin)}</small></div></div><div className={styles.pending}><span>Cobros pendientes</span><strong>{money(pending)}</strong><small>{pendingRows.length} cobro(s) pendiente(s)</small></div></section>
    </div>

    <section className="panel"><Heading title="Evolución semanal" text="Ingresos, egresos y rentabilidad por semana"/><div className={styles.weekChart}>{weeks.map(week=><div className={styles.week} key={week.label}><div className={styles.weekTitle}><b>{week.label}</b><small>{week.operations} movimientos · {week.units} unidades</small></div><div className={styles.barLine}><span>Ingresos</span><i style={{width:`${week.income/maxChart*100}%`}}/><b>{money(week.income)}</b></div><div className={styles.barLine}><span>Egresos</span><i className={styles.expenseBar} style={{width:`${week.expenses/maxChart*100}%`}}/><b>{money(week.expenses)}</b></div><div className={styles.weekProfit}>Utilidad <strong>{money(week.profit)}</strong></div></div>)}</div><div className={styles.highlights}><Highlight label="Semana con mayor ingreso" value={bestIncome?.label||"Sin datos"} note={bestIncome?money(bestIncome.income):""}/><Highlight label="Semana con más movimientos" value={mostOperations?.label||"Sin datos"} note={mostOperations?`${mostOperations.operations} movimientos`:""}/><Highlight label="Mejor semana por utilidad" value={bestProfit?.label||"Sin datos"} note={bestProfit?money(bestProfit.profit):""}/></div><div className={styles.averages}><Row label="Ingreso promedio semanal" value={money(income/avgWeeks)}/><Row label="Egreso promedio semanal" value={money(expenses/avgWeeks)}/><Row label="Utilidad promedio semanal" value={money(profit/avgWeeks)}/></div></section>

    <div className={styles.grid2}>
      <section className="panel"><Heading title="Origen de ingresos" text="Clasificación derivada de movimientos existentes"/>{incomeOrigins.length?incomeOrigins.map(item=><Progress key={item.name} label={item.name} amount={item.amount} total={income}/>):<Empty text="Sin ingresos en el período seleccionado."/>}</section>
      <section className="panel"><Heading title="Egresos por origen" text="Sin alterar la clasificación original"/>{expenseOrigins.length?expenseOrigins.map(item=><Progress key={item.name} label={item.name} amount={item.amount} total={expenses}/>):<Empty text="Sin egresos en el período seleccionado."/>}</section>
    </div>

    <div className={styles.grid2}>
      <section className="panel"><Heading title="Métodos de pago" text="Distribución del dinero efectivamente cobrado"/>{methods.length?methods.map(([name,amount])=><Progress key={name} label={name} amount={amount} total={income}/>):<Empty text="Sin cobros pagados en este período."/>}</section>
      <section className="panel"><Heading title="Servicios" text="Movimientos que coinciden con servicios configurados"/>{serviceStats.length?serviceStats.map(item=><div className={styles.serviceRow} key={item.name}><div><b>{item.name}</b><small>{item.count} operación(es) identificada(s)</small></div><strong>{money(item.revenue)}</strong><span>{percent(income>0?item.revenue/income*100:0)}</span></div>):<Empty text="No existen movimientos de servicios identificables en este período."/>}<p className={styles.caution}>ASHA todavía no conserva una colección estructurada de atenciones clínicas; por eso Contabilidad no inventa cifras de pacientes atendidos.</p></section>
    </div>

    <section className="panel"><Heading title="Productos" text="Ventas, costo histórico disponible y rentabilidad"/><div className={styles.productSummary}><Highlight label="Unidades vendidas" value={String(unitsSold)} note="unidades"/><Highlight label="Facturación de productos" value={money(productRevenue)} note="ventas cobradas"/><Highlight label="Costo de productos vendidos" value={money(cogs)} note="CPV / COGS"/><Highlight label="Producto con mayor facturación" value={topRevenue?.name||"Sin datos"} note={topRevenue?money(topRevenue.revenue):""}/></div><div className={styles.sortRow}><span>TOP PRODUCTOS</span><FilterButton active={productSort==="units"} label="Unidades" onClick={()=>setProductSort("units")}/><FilterButton active={productSort==="revenue"} label="Facturación" onClick={()=>setProductSort("revenue")}/><FilterButton active={productSort==="profit"} label="Utilidad" onClick={()=>setProductSort("profit")}/></div>{sortedProducts.length?<div className={styles.productTable}>{sortedProducts.slice(0,5).map((item,index)=><div key={item.id}><span>{index+1}</span><div><b>{item.name}</b><small>{item.units} u. · Facturación {money(item.revenue)} · Participación {percent(productRevenue>0?item.revenue/productRevenue*100:0)}</small></div><div><b>{money(item.profit)}</b><small>Costo {money(item.cost)} · margen {percent(item.margin)}</small></div></div>)}</div>:<Empty text="Sin ventas de productos en el período seleccionado."/>}{lowMargin.length>0&&<div className={styles.lowMargin}><b>Productos con menor margen</b>{lowMargin.map(item=><span key={item.id}>{item.name}<em>{percent(item.margin)}</em></span>)}</div>}</section>

    <section className="panel"><Heading title="Detalle financiero" text="Vista directa de txs; no crea una segunda tabla de movimientos"/><div className={styles.detailFilters}><div className="search"><Search/><Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar concepto, referencia o producto"/></div><select value={typeFilter} onChange={event=>setTypeFilter(event.target.value)}><option>Todos</option><option>Ingreso</option><option>Egreso</option></select><select value={originFilter} onChange={event=>setOriginFilter(event.target.value)}>{originOptions.map(option=><option key={option}>{option}</option>)}</select></div><div className="table"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Origen</th><th>Referencia</th><th>Método</th><th>Estado</th><th>Importe</th></tr></thead><tbody>{detail.map(tx=><tr key={tx.id}><td>{tx.date}</td><td>{tx.type}</td><td><b>{tx.concept}{tx.productName&&<small>{tx.productName}</small>}</b></td><td>{tx.origin||"—"}</td><td>{tx.reference}</td><td>{tx.method}</td><td>{tx.status??(tx.type==="Ingreso"?"Pagado":"—")}</td><td className={tx.type==="Ingreso"?"green":"red"}>{tx.type==="Ingreso"?"+":"−"}{money(tx.amount)}</td></tr>)}</tbody></table>{detail.length===0&&<Empty text="Sin movimientos para los filtros seleccionados."/>}</div></section>
  </div>
}

function FilterButton({active,label,onClick}:{active:boolean;label:string;onClick:()=>void}){return <button className={active?styles.active:""} onClick={onClick}>{label}</button>}
function Metric({icon:Icon,label,value,note,change,invert=false}:{icon:LucideIcon;label:string;value:string;note:string;change?:number|null;invert?:boolean}){const hasChange=change!==undefined&&change!==null,up=(change||0)>=0,good=invert?!up:up;return <article className={styles.metric}><span><Icon/></span><p>{label}</p><strong>{value}</strong><small>{note}</small>{hasChange?<small className={good?styles.good:styles.bad}>{up?"↑":"↓"} {Math.abs(change||0).toLocaleString("es-BO",{maximumFractionDigits:1})} % vs período anterior</small>:change===null?<small>Sin datos suficientes para comparar.</small>:null}</article>}
function Heading({title,text}:{title:string;text:string}){return <div className={styles.heading}><div><h3>{title}</h3><p>{text}</p></div></div>}
function Row({label,value,strong=false}:{label:string;value:string;strong?:boolean}){return <div className={strong?styles.strongRow:""}><span>{label}</span><b>{value}</b></div>}
function Highlight({label,value,note}:{label:string;value:string;note:string}){return <div className={styles.highlight}><span>{label}</span><b>{value}</b><small>{note}</small></div>}
function Progress({label,amount,total}:{label:string;amount:number;total:number}){const share=total>0?amount/total*100:0;return <div className={styles.progress}><div><span>{label}</span><b>{money(amount)}</b><small>{percent(share)}</small></div><i><em style={{width:`${Math.min(100,Math.max(0,share))}%`}}/></i></div>}
function Empty({text}:{text:string}){return <div className={styles.empty}><PackageOpen/><span>{text}</span></div>}
