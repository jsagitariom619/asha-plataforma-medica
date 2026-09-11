"use client";

import {FormEvent,useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {Banknote,Plus,ShoppingCart} from "lucide-react";
import {runtimeStore} from "@/lib/client/runtime-store";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";

type Patient={id:number;name:string;code?:string};
type Product={id:number;name:string;salePrice:number;purchaseCost:number;stock:number;active:boolean};
type Attention={id:number;patientId:number;totalCost?:number};
type Tx={id:number;concept:string;reference:string;type:"Ingreso"|"Egreso";amount:number;date:string;method:string;status?:"Pagado"|"Pendiente"|"Anulado";origin?:string;operationId?:string;productId?:number;productName?:string;patientId?:number;attentionId?:number;quantity?:number;stockDelta?:number;unitPrice?:number;unitCost?:number;createdAt?:string;note?:string};
type SaleLine={productId:number;quantity:number};

const BOLIVIA_TZ="America/La_Paz";
const money=(value:number)=>new Intl.NumberFormat("es-BO",{style:"currency",currency:"BOB",maximumFractionDigits:2}).format(Number.isFinite(value)?value:0);
const nowLabel=()=>new Intl.DateTimeFormat("es-BO",{timeZone:BOLIVIA_TZ,dateStyle:"short",timeStyle:"short"}).format(new Date());
const readStore=()=>{try{return JSON.parse(runtimeStore.getItem("asha-demo")||"null")||{}}catch{return{}}};

function persistOperational(next:Record<string,unknown>,products:Product[],txs:Tx[]){
  runtimeStore.setItem("asha-demo",JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("asha-runtime-state",{detail:{products,txs}}));
  window.dispatchEvent(new CustomEvent("asha-finance-updated"));
}

export function PatientProductSalesCompat(){
  const[footer,setFooter]=useState<HTMLElement|null>(null),[body,setBody]=useState<HTMLElement|null>(null),[patient,setPatient]=useState<Patient|null>(null);
  const[open,setOpen]=useState(false),[paymentOpen,setPaymentOpen]=useState(false),[lines,setLines]=useState<SaleLine[]>([{productId:0,quantity:1}]),[error,setError]=useState(""),[version,setVersion]=useState(0);

  useEffect(()=>{
    const sync=()=>{
      const dialog=document.querySelector<HTMLElement>(".patient-profile-dialog");
      const title=dialog?.querySelector<HTMLElement>("#patient-profile-title")?.textContent?.trim()||"";
      const store=readStore();
      const patients:Patient[]=Array.isArray(store.patients)?store.patients:[];
      setPatient(title?patients.find(item=>item.name===title)||null:null);
      setFooter(dialog?.querySelector<HTMLElement>(".patient-profile-actions")||null);
      setBody(dialog?.querySelector<HTMLElement>(".patient-profile-body")||null);
    };
    const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});sync();
    const refresh=()=>{sync();setVersion(v=>v+1)};
    window.addEventListener("asha-runtime-state",refresh as EventListener);
    window.addEventListener("asha-finance-updated",refresh as EventListener);
    return()=>{observer.disconnect();window.removeEventListener("asha-runtime-state",refresh as EventListener);window.removeEventListener("asha-finance-updated",refresh as EventListener)};
  },[]);

  const store=readStore();
  const products:Product[]=Array.isArray(store.products)?store.products.filter((p:Product)=>p&&p.active!==false):[];
  const txs:Tx[]=Array.isArray(store.txs)?store.txs:[];
  const attentions:Attention[]=Array.isArray(store.attentions)?store.attentions:[];
  void version;

  const patientTxs=useMemo(()=>patient?txs.filter(tx=>tx.patientId===patient.id&&tx.status!=="Anulado"):[],[patient,txs]);
  const productRows=useMemo(()=>patientTxs.filter(tx=>tx.origin==="product-sale"&&Number(tx.quantity)>0),[patientTxs]);
  const productGroups=useMemo(()=>{
    const map=new Map<string,Tx[]>();
    productRows.forEach(tx=>{const key=tx.operationId||String(tx.id),rows=map.get(key)||[];rows.push(tx);map.set(key,rows)});
    return Array.from(map.entries()).sort((a,b)=>String(b[1][0]?.createdAt||"").localeCompare(String(a[1][0]?.createdAt||"")));
  },[productRows]);

  if(!patient||!footer||!body)return null;

  const treatmentTotal=attentions.filter(a=>a.patientId===patient.id).reduce((sum,a)=>sum+(Number(a.totalCost)||0),0);
  const treatmentPaid=patientTxs.filter(tx=>tx.origin==="patient-payment"&&tx.status!=="Pendiente").reduce((sum,tx)=>sum+(Number(tx.amount)||0),0);
  const productTotal=productRows.reduce((sum,tx)=>sum+(Number(tx.unitPrice)||0)*(Number(tx.quantity)||0),0);
  const productPaid=patientTxs.filter(tx=>tx.origin==="product-sale"&&tx.status!=="Pendiente").reduce((sum,tx)=>sum+(Number(tx.amount)||0),0);
  const consumption=treatmentTotal+productTotal,totalPaid=treatmentPaid+productPaid,balance=Math.max(0,consumption-totalPaid);
  const pendingProduct=patientTxs.filter(tx=>tx.origin==="product-sale"&&tx.status==="Pendiente"&&Number(tx.amount)>0);
  const pendingProductTotal=pendingProduct.reduce((sum,tx)=>sum+(Number(tx.amount)||0),0);

  const addLine=()=>setLines(current=>[...current,{productId:0,quantity:1}]);
  const totalSale=lines.reduce((sum,line)=>{const p=products.find(item=>item.id===line.productId);return sum+(p?.salePrice||0)*Math.max(0,line.quantity||0)},0);

  const submitSale=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setError("");
    const selected=lines.filter(line=>line.productId&&line.quantity>0);
    if(!selected.length){setError("Selecciona al menos un producto.");return}
    for(const line of selected){const p=products.find(item=>item.id===line.productId);if(!p){setError("Producto no encontrado.");return}if(Number(p.stock)<line.quantity){setError(`Stock insuficiente para ${p.name}. Disponible: ${p.stock}.`);return}}
    const form=new FormData(event.currentTarget),method=String(form.get("method")||"Efectivo"),status=String(form.get("status")||"Pagada"),note=String(form.get("note")||"").trim();
    const total=selected.reduce((sum,line)=>{const p=products.find(item=>item.id===line.productId)!;return sum+p.salePrice*line.quantity},0);
    let paid=status==="Pagada"?total:status==="Pendiente"?0:Number(form.get("paid"))||0;
    paid=Math.max(0,Math.min(total,paid));
    if(status==="Parcial"&&(paid<=0||paid>=total)){setError("Para pago parcial, el monto pagado debe ser mayor a 0 y menor al total.");return}
    const stamp=Date.now(),operationId=`PVP-${patient.id}-${stamp}`,createdAt=new Date().toISOString(),ratio=total>0?paid/total:0;
    const nextProducts=products.map(product=>{const line=selected.find(item=>item.productId===product.id);return line?{...product,stock:Number(product.stock)-line.quantity}:product});
    const untouchedProducts=(Array.isArray(store.products)?store.products:[]).filter((p:Product)=>!nextProducts.some(np=>np.id===p.id));
    const allProducts=[...nextProducts,...untouchedProducts];
    const mainRows:Tx[]=selected.map((line,index):Tx=>{const p=products.find(item=>item.id===line.productId)!,subtotal=p.salePrice*line.quantity;const remaining=status==="Pagada"?0:status==="Pendiente"?subtotal:Math.max(0,subtotal*(1-ratio));return{id:stamp+index+1,concept:"Venta de producto",reference:patient.name,type:"Ingreso",amount:status==="Pagada"?subtotal:remaining,date:nowLabel(),method:status==="Pagada"?method:"Pendiente",status:status==="Pagada"?"Pagado":"Pendiente",origin:"product-sale",operationId,productId:p.id,productName:p.name,patientId:patient.id,quantity:line.quantity,stockDelta:-line.quantity,unitPrice:p.salePrice,unitCost:p.purchaseCost,createdAt,note}});
    const paidRows:Tx[]=status==="Parcial"?selected.map((line,index):Tx=>{const p=products.find(item=>item.id===line.productId)!,subtotal=p.salePrice*line.quantity,allocation=Math.max(0,subtotal*ratio);return{id:stamp+500+index,concept:"Abono venta de producto",reference:patient.name,type:"Ingreso",amount:allocation,date:nowLabel(),method,status:"Pagado",origin:"product-sale",operationId,productId:p.id,productName:p.name,patientId:patient.id,quantity:0,stockDelta:0,unitPrice:p.salePrice,unitCost:0,createdAt,note}}).filter(row=>row.amount>0):[];
    const nextTxs:Tx[]=[...paidRows,...mainRows,...txs];
    persistOperational({...store,products:allProducts,txs:nextTxs},allProducts,nextTxs);
    setOpen(false);setLines([{productId:0,quantity:1}]);setVersion(v=>v+1);
  };

  const submitProductPayment=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setError("");
    const form=new FormData(event.currentTarget),amount=Number(form.get("amount"))||0,method=String(form.get("method")||"Efectivo");
    if(amount<=0||amount>pendingProductTotal+0.001){setError("El importe supera el saldo pendiente de productos.");return}
    let remainingPayment=amount;const createdAt=new Date().toISOString(),stamp=Date.now(),newPayments:Tx[]=[];
    const nextTxs:Tx[]=txs.map((tx):Tx=>{
      if(tx.patientId!==patient.id||tx.origin!=="product-sale"||tx.status!=="Pendiente"||Number(tx.amount)<=0||remainingPayment<=0)return tx;
      const applied=Math.min(Number(tx.amount)||0,remainingPayment);remainingPayment-=applied;
      newPayments.push({id:stamp+newPayments.length+1,concept:"Abono venta de producto",reference:patient.name,type:"Ingreso",amount:applied,date:nowLabel(),method,status:"Pagado",origin:"product-sale",operationId:tx.operationId,productId:tx.productId,productName:tx.productName,patientId:patient.id,quantity:0,stockDelta:0,unitPrice:tx.unitPrice,unitCost:0,createdAt});
      const left=Math.max(0,(Number(tx.amount)||0)-applied);
      return left>0?{...tx,amount:left,date:nowLabel(),createdAt}:{...tx,amount:0,status:"Pagado",method,date:nowLabel(),createdAt};
    });
    const merged:Tx[]=[...newPayments,...nextTxs];
    persistOperational({...store,txs:merged},Array.isArray(store.products)?store.products:[],merged);
    setPaymentOpen(false);setVersion(v=>v+1);
  };

  const summary=createPortal(<section style={{marginTop:14,padding:14,border:"1px solid #e4e8e6",borderRadius:14,background:"#fbfcfb"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><ShoppingCart size={18}/><div><b style={{display:"block"}}>Resumen financiero</b><small>Tratamientos, productos y pagos asociados a este paciente.</small></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:8}}>
      <div><small>Tratamientos / atenciones</small><b style={{display:"block"}}>{money(treatmentTotal)}</b></div><div><small>Productos comprados</small><b style={{display:"block"}}>{money(productTotal)}</b></div><div><small>Consumo total</small><b style={{display:"block"}}>{money(consumption)}</b></div><div><small>Total pagado</small><b style={{display:"block"}}>{money(totalPaid)}</b></div><div><small>Saldo pendiente</small><b style={{display:"block"}}>{money(balance)}</b></div>
    </div>
    {pendingProductTotal>0&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}><Button type="button" variant="outline" onClick={()=>{setError("");setPaymentOpen(true)}}><Banknote/> Pagar productos · {money(pendingProductTotal)}</Button></div>}
    <div style={{marginTop:12}}><b style={{fontSize:13}}>Productos comprados</b>{productGroups.length?<div style={{display:"grid",gap:6,marginTop:7}}>{productGroups.map(([operationId,rows])=><div key={operationId} style={{padding:"8px 10px",border:"1px solid #e8ecea",borderRadius:10,background:"white"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><small>{rows[0]?.date}</small><small>{rows.some(row=>row.status==="Pendiente")?"Pendiente":"Pagado"}</small></div>{rows.map(row=><div key={row.id} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12,marginTop:3}}><span>{row.productName} · {row.quantity} u. × {money(Number(row.unitPrice)||0)}</span><b>{money((Number(row.unitPrice)||0)*(Number(row.quantity)||0))}</b></div>)}</div>)}</div>:<small style={{display:"block",marginTop:5}}>Sin compras de productos registradas.</small>}</div>
  </section>,body);

  const action=createPortal(<button type="button" className="patient-treatment" onClick={()=>{setError("");setLines([{productId:0,quantity:1}]);setOpen(true)}}><ShoppingCart/>Vender producto</button>,footer);

  return <>{summary}{action}
    <Dialog open={open} onOpenChange={(next)=>{setOpen(next);if(!next){setLines([{productId:0,quantity:1}]);setError("")}}}><DialogContent style={{zIndex:200,maxHeight:"88vh",overflowY:"auto"}}><DialogHeader><DialogTitle>Vender producto</DialogTitle><DialogDescription>{patient.name} · la operación usa el inventario y movimientos actuales de ASHA.</DialogDescription></DialogHeader><form className="form" onSubmit={submitSale}>{error&&<div className="form-error" role="alert">{error}</div>}{lines.map((line,index)=><div className="cols" key={index}><label className="field"><Label>Producto</Label><select value={line.productId} onChange={e=>setLines(rows=>rows.map((row,i)=>i===index?{...row,productId:Number(e.target.value)}:row))} required><option value={0}>Seleccionar producto…</option>{products.map(p=><option key={p.id} value={p.id} disabled={Number(p.stock)<=0}>{p.name} · stock {p.stock} · {money(p.salePrice)}</option>)}</select></label><label className="field"><Label>Cantidad</Label><Input type="number" min="1" step="1" value={line.quantity} onChange={e=>setLines(rows=>rows.map((row,i)=>i===index?{...row,quantity:Math.max(1,Number(e.target.value)||1)}:row))}/></label></div>)}<Button type="button" variant="outline" onClick={addLine}><Plus/>Agregar producto</Button><div style={{padding:"8px 10px",borderRadius:10,background:"#f6f8f7",fontSize:13}}>Total estimado: <b>{money(totalSale)}</b></div><div className="cols"><label className="field"><Label>Método de pago</Label><select name="method" defaultValue="Efectivo"><option>Efectivo</option><option>QR</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></label><label className="field"><Label>Estado de pago</Label><select name="status" defaultValue="Pagada"><option>Pagada</option><option>Parcial</option><option>Pendiente</option></select></label></div><label className="field"><Label>Monto pagado (solo si es parcial)</Label><Input name="paid" type="number" min="0" step="0.01" defaultValue="0"/></label><label className="field"><Label>Observación</Label><Textarea name="note" rows={2}/></label><div className="form-actions"><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button className="gold" type="submit">Confirmar venta</Button></div></form></DialogContent></Dialog>
    <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}><DialogContent style={{zIndex:200}}><DialogHeader><DialogTitle>Registrar pago de productos</DialogTitle><DialogDescription>{patient.name} · saldo pendiente {money(pendingProductTotal)}</DialogDescription></DialogHeader><form className="form" onSubmit={submitProductPayment}>{error&&<div className="form-error" role="alert">{error}</div>}<label className="field"><Label>Importe</Label><Input name="amount" type="number" min="0.01" max={pendingProductTotal} step="0.01" defaultValue={pendingProductTotal} required/></label><label className="field"><Label>Método de pago</Label><select name="method" defaultValue="Efectivo"><option>Efectivo</option><option>QR</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></label><div className="form-actions"><Button type="button" variant="outline" onClick={()=>setPaymentOpen(false)}>Cancelar</Button><Button className="gold" type="submit">Registrar pago</Button></div></form></DialogContent></Dialog>
  </>;
}
