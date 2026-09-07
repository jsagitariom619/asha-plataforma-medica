"use client";

import {FormEvent,useMemo,useState} from "react";
import {CircleDollarSign,Search,WalletCards} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";
import type {Attention,Patient,Tx} from "@/app/page";

const money=(value:number)=>new Intl.NumberFormat("es-BO",{style:"currency",currency:"BOB",maximumFractionDigits:2}).format(Number.isFinite(value)?value:0);

type BalanceRow={attention:Attention;patient:Patient;paid:number;balance:number};

export function PatientBillingPanel({patients,attentions,txs,onPayment}:{patients:Patient[];attentions:Attention[];txs:Tx[];onPayment:(patientId:number,attentionId:number,amount:number,method:string)=>string}){
  const[query,setQuery]=useState("");
  const[selected,setSelected]=useState<BalanceRow|null>(null);
  const rows=useMemo(()=>attentions.map(attention=>{
    const patient=patients.find(item=>item.id===attention.patientId);
    if(!patient)return null;
    const paid=txs.filter(tx=>tx.attentionId===attention.id&&tx.patientId===attention.patientId&&tx.type==="Ingreso"&&tx.status!=="Pendiente"&&tx.status!=="Anulado"&&tx.origin==="patient-payment").reduce((total,tx)=>total+(Number(tx.amount)||0),0);
    const total=Math.max(0,Number(attention.totalCost)||0),balance=Math.max(0,total-paid);
    return{attention,patient,paid,balance};
  }).filter((item):item is BalanceRow=>Boolean(item)).filter(item=>`${item.patient.name} ${item.patient.code} ${item.attention.procedure||item.attention.reason}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.attention.createdAt.localeCompare(a.attention.createdAt)),[patients,attentions,txs,query]);
  const pendingTotal=rows.reduce((total,row)=>total+row.balance,0);
  return <>
    <section className="panel" style={{display:"grid",gap:14}}>
      <div className="title" style={{marginBottom:0}}><div><h3>Estado de cuenta por paciente</h3><p>Busca al paciente para revisar cuánto pagó y cuánto falta.</p></div><span className="tag" style={{fontSize:10}}>{money(pendingTotal)} pendiente</span></div>
      <div className="search" style={{marginBottom:0,maxWidth:520}}><Search/><Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar por paciente, historia o procedimiento"/></div>
      {rows.length?<div className="table"><table><thead><tr><th>Paciente</th><th>Procedimiento</th><th>Total</th><th>Pagado</th><th>Saldo</th><th></th></tr></thead><tbody>{rows.map(row=><tr key={row.attention.id}><td><b>{row.patient.name}<small>{row.patient.code}</small></b></td><td>{row.attention.procedure||row.attention.reason}</td><td>{money(row.attention.totalCost||0)}</td><td className="green">{money(row.paid)}</td><td className={row.balance>0?"red":"green"}>{money(row.balance)}</td><td>{row.balance>0?<Button type="button" variant="outline" onClick={()=>setSelected(row)}>Registrar abono</Button>:<span className="tag">Pagado</span>}</td></tr>)}</tbody></table></div>:<div style={{padding:"18px",textAlign:"center",color:"#7d8581",fontSize:12}}>No hay atenciones con cobro para mostrar.</div>}
    </section>
    <PaymentDialog row={selected} close={()=>setSelected(null)} onPayment={onPayment}/>
  </>
}

function PaymentDialog({row,close,onPayment}:{row:BalanceRow|null;close:()=>void;onPayment:(patientId:number,attentionId:number,amount:number,method:string)=>string}){
  const[error,setError]=useState("");
  if(!row)return null;
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setError("");const data=new FormData(event.currentTarget),amount=Number(data.get("amount")),method=String(data.get("method")||"Efectivo");if(!Number.isFinite(amount)||amount<=0){setError("Ingresa un importe válido.");return}if(amount>row.balance+0.001){setError(`El abono no puede superar el saldo de ${money(row.balance)}.`);return}const message=onPayment(row.patient.id,row.attention.id,amount,method);if(message){setError(message);return}close()};
  return <Dialog open onOpenChange={open=>!open&&close()}><DialogContent><DialogHeader><DialogTitle>Registrar abono</DialogTitle><DialogDescription>{row.patient.name} · {row.attention.procedure||row.attention.reason}</DialogDescription></DialogHeader><form className="form" onSubmit={submit}><div className="metrics" style={{gridTemplateColumns:"repeat(3,1fr)"}}><Mini icon={<CircleDollarSign/>} label="Total" value={money(row.attention.totalCost||0)}/><Mini icon={<WalletCards/>} label="Pagado" value={money(row.paid)}/><Mini icon={<WalletCards/>} label="Saldo" value={money(row.balance)}/></div><label className="field"><Label>Importe del abono</Label><Input name="amount" type="number" inputMode="decimal" min="0.01" max={row.balance} step="0.01" defaultValue={row.balance} required/></label><label className="field"><Label>Método de pago</Label><select name="method" defaultValue="Efectivo"><option>Efectivo</option><option>QR</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></label>{error&&<p className="auth-error" role="alert">{error}</p>}<div className="form-actions"><Button type="button" variant="outline" onClick={close}>Cancelar</Button><Button className="gold" type="submit">Registrar abono</Button></div></form></DialogContent></Dialog>
}

function Mini({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <article className="metric" style={{minHeight:96,paddingLeft:48}}><span style={{width:28,height:28}}>{icon}</span><p>{label}</p><strong style={{fontSize:18}}>{value}</strong></article>}
