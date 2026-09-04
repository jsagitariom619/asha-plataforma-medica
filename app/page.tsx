"use client";

import {FormEvent,useEffect,useMemo,useRef,useState} from "react";
import {ArrowDownRight,ArrowUpRight,Banknote,Bell,CalendarDays,ChevronRight,CircleDollarSign,ClipboardPlus,FileHeart,LayoutDashboard,Menu,PackageOpen,Plus,Search,Settings,Stethoscope,Users,WalletCards,X} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from "@/components/ui/dialog";
import {CashPanel,MovementsPanel,ProductDialog,ProductsPanel} from "@/app/products";

type Patient={id:number;name:string;code:string;age:number;phone:string;lastVisit:string;status:string};
type Service={id:number;name:string;category:string;price:number;duration:string;active:boolean};
export type Product={id:number;name:string;description:string;salePrice:number;purchaseCost:number;initialStock:number;stock:number;image?:string;active:boolean;category?:string;code?:string;minimumStock?:number};
export type Tx={id:number;concept:string;reference:string;type:"Ingreso"|"Egreso";amount:number;date:string;method:string;status?:"Pagado"|"Pendiente"|"Anulado";origin?:"manual"|"cash"|"product-sale"|"product-purchase";operationId?:string;productId?:number;productName?:string;quantity?:number;stockDelta?:number;unitPrice?:number;note?:string};
type User={id:number;name:string;role:string;initials:string;active:boolean;email?:string;permissions?:string[]};
type ProductAction={kind:"new"|"edit"|"sell"|"restock"|"detail";product?:Product}|null;
type UserAction={kind:"edit"|"permissions";user:User}|null;

const MODULES=["Resumen","Pacientes","Historias clínicas","Agenda","Servicios","Productos","Caja y cobros","Movimientos","Usuarios","Configuración"];
const defaultPermissions=(role:string)=>{
  if(role.includes("Admin"))return [...MODULES];
  if(role.includes("Recepción"))return ["Resumen","Pacientes","Agenda","Productos","Caja y cobros"];
  if(role.includes("Médico"))return ["Resumen","Pacientes","Historias clínicas","Agenda","Servicios"];
  if(role.includes("Enfermería"))return ["Resumen","Pacientes","Agenda","Servicios"];
  return ["Resumen"];
};
const userInitials=(name:string)=>name.split(/\s+/).filter(Boolean).filter(part=>!/[.]$/.test(part)).slice(0,2).map(part=>part[0]).join("").toUpperCase()||"US";

const P:Patient[]=[
  {id:1,name:"María Fernanda López",code:"HC-2026-0148",age:34,phone:"770 24189",lastVisit:"Hoy, 09:30",status:"En consulta"},
  {id:2,name:"Carlos Alberto Rojas",code:"HC-2026-0147",age:48,phone:"690 11542",lastVisit:"Hoy, 08:15",status:"Atendido"},
  {id:3,name:"Ana Sofía Méndez",code:"HC-2026-0146",age:29,phone:"721 40883",lastVisit:"Ayer, 17:40",status:"Seguimiento"}
];
const S:Service[]=[
  {id:1,name:"Consulta integral",category:"Consulta médica",price:250,duration:"45 min",active:true},
  {id:2,name:"Control y seguimiento",category:"Consulta médica",price:150,duration:"30 min",active:true},
  {id:3,name:"Sueroterapia personalizada",category:"Terapias",price:380,duration:"60 min",active:true}
];
const T:Tx[]=[
  {id:1,concept:"Consulta integral",reference:"María F. López",type:"Ingreso",amount:250,date:"Hoy, 09:34",method:"QR",status:"Pagado",origin:"cash"},
  {id:2,concept:"Compra de insumos",reference:"Proveedor general",type:"Egreso",amount:185,date:"Hoy, 08:05",method:"Transferencia",origin:"manual"},
  {id:3,concept:"Control y seguimiento",reference:"Carlos A. Rojas",type:"Ingreso",amount:150,date:"Ayer, 17:22",method:"Efectivo",status:"Pagado",origin:"cash"}
];
const U:User[]=[
  {id:1,name:"Dra. Andrea Vargas",role:"Administradora · Médica",initials:"AV",active:true,permissions:[...MODULES]},
  {id:2,name:"Lic. Paula Méndez",role:"Recepción y caja",initials:"PM",active:true,permissions:defaultPermissions("Recepción y caja")},
  {id:3,name:"Dr. Marco Salinas",role:"Médico",initials:"MS",active:true,permissions:defaultPermissions("Médico")}
];
const nav=[["Resumen",LayoutDashboard],["Pacientes",Users],["Historias clínicas",FileHeart],["Agenda",CalendarDays],["Servicios",Stethoscope],["Productos",PackageOpen],["Caja y cobros",WalletCards],["Movimientos",CircleDollarSign],["Usuarios",Users],["Configuración",Settings]] as const;

export const money=(n:number)=>new Intl.NumberFormat("es-BO",{style:"currency",currency:"BOB",maximumFractionDigits:0}).format(n);
const nowLabel=()=>new Intl.DateTimeFormat("es-BO",{dateStyle:"short",timeStyle:"short"}).format(new Date());
const todayLabel=()=>{const value=new Intl.DateTimeFormat("es-BO",{weekday:"long",day:"numeric",month:"long"}).format(new Date());return value.charAt(0).toUpperCase()+value.slice(1)};

export default function Home(){
  const[section,setSection]=useState("Resumen"),[menu,setMenu]=useState(false),[modal,setModal]=useState<string|null>(null),[notificationsOpen,setNotificationsOpen]=useState(false),[patients,setPatients]=useState(P),[services,setServices]=useState(S),[products,setProducts]=useState<Product[]>([]),[txs,setTxs]=useState(T),[users,setUsers]=useState(U),[q,setQ]=useState("");
  const[productQuery,setProductQuery]=useState(""),[productFilter,setProductFilter]=useState("Todos"),[productAction,setProductAction]=useState<ProductAction>(null),[userAction,setUserAction]=useState<UserAction>(null),[flash,setFlash]=useState("");
  const[professionalName,setProfessionalName]=useState("Dra. Andrea Vargas"),[hydrated,setHydrated]=useState(false);
  const[greeting,setGreeting]=useState("Buenos días"),[dateLabel,setDateLabel]=useState("Viernes, 4 de septiembre");
  const notificationRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{const timer=setTimeout(()=>{try{const data=JSON.parse(localStorage.getItem("asha-demo")||"null");if(data){
    const storedName=data.professionalName??"Dra. Andrea Vargas";
    const storedUsers:Array<User>=Array.isArray(data.users)?data.users:U;
    const compatibleUsers=storedUsers.map((u,index)=>({...u,active:u.active!==false,permissions:Array.isArray(u.permissions)?u.permissions:defaultPermissions(u.role),initials:userInitials(index===0?storedName:u.name),name:index===0?storedName:u.name}));
    setPatients(data.patients??P);setServices(data.services??S);setProducts(data.products??[]);setTxs(data.txs??T);setUsers(compatibleUsers);setProfessionalName(storedName)
  }}catch{}setHydrated(true)},0);return()=>clearTimeout(timer)},[]);
  useEffect(()=>{if(hydrated)localStorage.setItem("asha-demo",JSON.stringify({patients,services,products,txs,users,professionalName}))},[patients,services,products,txs,users,professionalName,hydrated]);
  useEffect(()=>{const timer=setTimeout(()=>{const hour=new Date().getHours();setGreeting(hour<12?"Buenos días":hour<19?"Buenas tardes":"Buenas noches");setDateLabel(todayLabel())},0);return()=>clearTimeout(timer)},[]);
  useEffect(()=>{if(!hydrated)return;setUsers(current=>current.map((u,index)=>index===0?{...u,name:professionalName,initials:userInitials(professionalName),active:true}:u))},[professionalName,hydrated]);
  useEffect(()=>{if(!notificationsOpen)return;const onPointerDown=(event:PointerEvent)=>{const target=event.target as Node;if(notificationRef.current&&!notificationRef.current.contains(target))setNotificationsOpen(false)};const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")setNotificationsOpen(false)};document.addEventListener("pointerdown",onPointerDown);document.addEventListener("keydown",onKeyDown);return()=>{document.removeEventListener("pointerdown",onPointerDown);document.removeEventListener("keydown",onKeyDown)}},[notificationsOpen]);

  const activeTxs=txs.filter(t=>t.status!=="Anulado");
  const income=activeTxs.filter(t=>t.type==="Ingreso"&&t.status!=="Pendiente").reduce((a,t)=>a+t.amount,0);
  const expenses=activeTxs.filter(t=>t.type==="Egreso").reduce((a,t)=>a+t.amount,0);
  const filtered=useMemo(()=>patients.filter(p=>(p.name+p.code+p.phone).toLowerCase().includes(q.toLowerCase())),[patients,q]);
  const filteredProducts=useMemo(()=>products.filter(p=>{const matches=(p.name+" "+p.description).toLowerCase().includes(productQuery.toLowerCase());const status=productFilter==="Todos"||(productFilter==="Disponibles"&&p.active&&p.stock>0)||(productFilter==="Sin stock"&&p.stock===0)||(productFilter==="Inactivos"&&!p.active);return matches&&status}),[products,productQuery,productFilter]);
  const initials=userInitials(professionalName);
  const pendingCount=txs.filter(t=>t.type==="Ingreso"&&t.status==="Pendiente").length;
  const lowStock=products.filter(p=>p.active&&p.stock<=(p.minimumStock??2));
  const notifications=[...(pendingCount?[`${pendingCount} cobro${pendingCount===1?"":"s"} pendiente${pendingCount===1?"":"s"}.`]:[]),...(lowStock.length?[`${lowStock.length} producto${lowStock.length===1?"":"s"} con stock bajo.`]:[])];

  const notify=(message:string)=>{setFlash(message);setTimeout(()=>setFlash(""),2800)};
  const saveProduct=(product:Product)=>{setProducts(current=>current.some(p=>p.id===product.id)?current.map(p=>p.id===product.id?product:p):[product,...current]);notify(productAction?.kind==="edit"?"Producto actualizado":"Producto guardado");setProductAction(null)};
  const sellProduct=(product:Product,quantity:number,client:string,method:string,note:string)=>{if(quantity<1||quantity>product.stock)return false;const amount=product.salePrice*quantity,operationId=`PV-${Date.now()}`;setProducts(current=>current.map(p=>p.id===product.id?{...p,stock:p.stock-quantity}:p));setTxs(current=>[{id:Date.now(),concept:"Venta de producto",reference:client||product.name,type:"Ingreso",amount,date:nowLabel(),method,status:"Pagado",origin:"product-sale",operationId,productId:product.id,productName:product.name,quantity,stockDelta:-quantity,unitPrice:product.salePrice,note},...current]);notify(`Venta registrada: ${money(amount)}`);setProductAction(null);return true};
  const restockProduct=(product:Product,quantity:number,cost:number,provider:string,note:string)=>{if(quantity<1||cost<0)return;const amount=cost*quantity,operationId=`PC-${Date.now()}`;setProducts(current=>current.map(p=>p.id===product.id?{...p,stock:p.stock+quantity,purchaseCost:cost||p.purchaseCost}:p));setTxs(current=>[{id:Date.now(),concept:"Compra de productos",reference:provider||product.name,type:"Egreso",amount,date:nowLabel(),method:"Compra",origin:"product-purchase",operationId,productId:product.id,productName:product.name,quantity,stockDelta:quantity,unitPrice:cost,note},...current]);notify(`Ingreso registrado: +${quantity} unidades`);setProductAction(null)};
  const saveUser=(updated:User)=>{setUsers(current=>current.map(u=>u.id===updated.id?updated:u));if(users[0]?.id===updated.id&&updated.name!==professionalName)setProfessionalName(updated.name);notify("Usuario actualizado correctamente");setUserAction(null)};
  const savePermissions=(userId:number,permissions:string[])=>{setUsers(current=>current.map(u=>u.id===userId?{...u,permissions}:u));notify("Permisos actualizados correctamente");setUserAction(null)};
  const go=(s:string)=>{setSection(s);setMenu(false);setNotificationsOpen(false)};

  const headerAction=(()=>{
    if(section==="Pacientes")return{label:"Nuevo paciente",run:()=>setModal("patient")};
    if(section==="Historias clínicas")return{label:"Nueva historia",run:()=>setModal("history")};
    if(section==="Servicios")return{label:"Crear servicio",run:()=>setModal("service")};
    if(section==="Productos")return{label:"Nuevo producto",run:()=>setProductAction({kind:"new"})};
    if(section==="Caja y cobros")return{label:"Registrar cobro",run:()=>setModal("cash")};
    if(section==="Movimientos")return{label:"Nuevo movimiento",run:()=>setModal("transaction")};
    if(section==="Usuarios")return{label:"Agregar usuario",run:()=>setModal("user")};
    return null;
  })();

  return <div className="app">
    <aside className={menu?"sidebar open":"sidebar"}>
      <div className="brand" aria-label="ASHA Integrative Medicine"><div className="brand-lockup"><strong>ASHA</strong><small>Integrative Medicine</small></div><button aria-label="Cerrar menú" onClick={()=>setMenu(false)}><X/></button></div>
      <button className="clinic professional-card" onClick={()=>go("Configuración")} aria-label={`Abrir configuración de ${professionalName}`}><span>{initials}</span><div><b>{professionalName}</b><small>Profesional</small></div><ChevronRight/></button>
      <nav aria-label="Módulos">{nav.map(([label,Icon])=><button key={label} className={section===label?"active":""} onClick={()=>go(label)}><Icon/>{label}{label==="Agenda"&&<em>4</em>}</button>)}</nav>
    </aside>
    {menu&&<button aria-label="Cerrar menú" className="scrim" onClick={()=>setMenu(false)}/>}
    <main>
      <header>
        <button aria-label="Abrir menú" className="hamb" onClick={()=>setMenu(true)}><Menu/></button>
        <div><small>{dateLabel}</small><h1>{section}</h1></div>
        <div className="head-actions">
          <div className="notifications-wrap" ref={notificationRef}>
            <button aria-label="Notificaciones" aria-expanded={notificationsOpen} className="bell" onClick={()=>setNotificationsOpen(open=>!open)}><Bell/></button>
            {notificationsOpen&&<div className="notifications-panel" role="status">{notifications.length===0?<><span><Bell/></span><b>Sin notificaciones</b><p>No tienes notificaciones pendientes.</p></>:<><b>Notificaciones</b>{notifications.map((item,index)=><p key={index}>{item}</p>)}</>}<button onClick={()=>setNotificationsOpen(false)}>Cerrar</button></div>}
          </div>
          {headerAction&&<Button className="gold" onClick={headerAction.run}><Plus/>{headerAction.label}</Button>}
        </div>
      </header>
      <div className="content">
        {flash&&<div className="flash" role="status">{flash}</div>}
        {section==="Resumen"&&<Dashboard income={income} expenses={expenses} txs={txs} open={setModal} go={go} greeting={greeting} professionalName={professionalName}/>} 
        {section==="Pacientes"&&<><SectionLead text={`${patients.length} fichas registradas`}/><section className="panel"><div className="search"><Search/><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nombre, historia o teléfono"/></div><div className="list">{filtered.map(p=><div className="person" key={p.id}><Avatar name={p.name}/><div><b>{p.name}</b><small>{p.code} · {p.age} años · {p.phone}</small></div><span className="tag">{p.status}</span><small>{p.lastVisit}</small><ChevronRight/></div>)}</div></section></>}
        {section==="Historias clínicas"&&<><SectionLead text="Registros médicos y evoluciones"/><div className="cards">{patients.map(p=><article className="panel record" key={p.id}><FileHeart/><span className="tag">Consulta</span><h3>{p.name}</h3><p>{p.code}</p><hr/><small>Última atención</small><b>{p.lastVisit}</b><Button variant="outline">Abrir historia <ChevronRight/></Button></article>)}</div></>}
        {section==="Agenda"&&<><SectionLead text="12 citas programadas para hoy"/><section className="panel"><div className="dates">{["Lun 31","Mar 01","Mié 02","Jue 03","Vie 04","Sáb 05"].map((d,i)=><button className={i===4?"chosen":""} key={d}>{d}</button>)}</div><Agenda/></section></>}
        {section==="Servicios"&&<><SectionLead text="Catálogo, precios y duración"/><div className="cards">{services.map(s=><article className="panel service" key={s.id}><Stethoscope/><span className="tag">Activo</span><h3>{s.name}</h3><p>{s.category}</p><div><strong>{money(s.price)}</strong><small>{s.duration}</small></div><Button variant="outline">Editar servicio</Button></article>)}</div></>}
        {section==="Productos"&&<><SectionLead text="Catálogo físico, existencias, compras y ventas"/><ProductsPanel products={filteredProducts} query={productQuery} setQuery={setProductQuery} filter={productFilter} setFilter={setProductFilter} action={setProductAction}/></>}
        {section==="Caja y cobros"&&<><SectionLead text="Cobros, pendientes, medios de pago y caja operativa"/><CashPanel txs={txs}/></>}
        {section==="Movimientos"&&<><SectionLead text="Trazabilidad general de ingresos, egresos y productos"/><MovementsPanel txs={txs} income={income} expenses={expenses}/></>}
        {section==="Usuarios"&&<><SectionLead text="Roles y permisos de acceso"/><div className="cards">{users.map((u,index)=><article className="panel user" key={u.id}><span className="big-avatar">{userInitials(u.name)}</span><h3>{index===0?professionalName:u.name}</h3><p>{u.role}</p><span className={u.active?"tag":"tag inactive"}>{u.active?"Activo":"Inactivo"}</span><div className="user-actions"><Button variant="outline" onClick={()=>setUserAction({kind:"edit",user:u})}>Editar usuario</Button><Button variant="outline" onClick={()=>setUserAction({kind:"permissions",user:u})}>Gestionar permisos</Button></div></article>)}</div></>}
        {section==="Configuración"&&<><SectionLead text="Datos generales del consultorio y del profesional"/><SettingsPanel professionalName={professionalName} onSave={setProfessionalName}/></>}
      </div>
    </main>
    <Entry type={modal} close={()=>setModal(null)} patients={patients} addPatient={p=>setPatients(v=>[p,...v])} addService={s=>setServices(v=>[s,...v])} addTx={t=>setTxs(v=>[t,...v])} addUser={u=>{setUsers(v=>[...v,u]);notify("Usuario agregado correctamente")}}/>
    <UserDialog action={userAction} primaryUserId={users[0]?.id} close={()=>setUserAction(null)} saveUser={saveUser} savePermissions={savePermissions}/>
    <ProductDialog key={productAction?.kind+"-"+(productAction?.product?.id??"new")} action={productAction} close={()=>setProductAction(null)} save={saveProduct} sell={sellProduct} restock={restockProduct} txs={txs}/>
  </div>
}

function Dashboard({income,expenses,txs,open,go,greeting,professionalName}:{income:number;expenses:number;txs:Tx[];open:(s:string)=>void;go:(s:string)=>void;greeting:string;professionalName:string}){return <><div className="welcome"><div><em>PANEL DE CONTROL</em><h2>{greeting}, <span>{professionalName}</span></h2><p>Este es el panorama de su consultorio para hoy.</p></div><div><Button variant="outline" onClick={()=>open("history")}><ClipboardPlus/>Nueva historia</Button><Button className="gold" onClick={()=>open("cash")}><Banknote/>Registrar cobro</Button></div></div><div className="metrics"><Metric icon={Users} label="Pacientes atendidos" value="8" note="2 más que ayer"/><Metric icon={CalendarDays} label="Citas para hoy" value="12" note="4 pendientes"/><Metric icon={ArrowUpRight} label="Ingresos registrados" value={money(income)} note="Actualizado ahora"/><Metric icon={WalletCards} label="Balance" value={money(income-expenses)} note={`${money(expenses)} en egresos`}/></div><div className="dash"><section className="panel"><Title title="Agenda de hoy" text="Citas programadas" action="Ver agenda" click={()=>go("Agenda")}/><Agenda/></section><section className="panel"><Title title="Acciones rápidas" text="Operaciones frecuentes"/><div className="quick">{[[Users,"Registrar paciente","patient"],[FileHeart,"Nueva historia","history"],[Banknote,"Registrar cobro","cash"],[Stethoscope,"Crear servicio","service"]].map(([Icon,label,type])=><button key={String(label)} onClick={()=>open(String(type))}><span><Icon/></span><b>{String(label)}</b><ChevronRight/></button>)}</div></section></div><section className="panel"><Title title="Movimientos recientes" text="Últimos registros financieros" action="Ver todos" click={()=>go("Movimientos")}/><TxTable txs={txs}/></section></>}

function SettingsPanel({professionalName,onSave}:{professionalName:string;onSave:(name:string)=>void}){const[draft,setDraft]=useState(professionalName),[savedMessage,setSavedMessage]=useState(false);const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const clean=draft.trim();if(!clean)return;onSave(clean);setDraft(clean);setSavedMessage(true);setTimeout(()=>setSavedMessage(false),2400)};return <form className="panel settings" onSubmit={submit}><div className="settings-section"><span className="settings-icon"><Stethoscope/></span><div><h3>Datos del profesional</h3><p>Este nombre aparecerá en el saludo y en el perfil de la plataforma.</p></div></div><Field label="Nombre del profesional"><Input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Dr., Dra., Lic. y nombre completo" required maxLength={80}/></Field><div className="settings-grid"><Field label="Nombre comercial"><Input defaultValue="ASHA Integrative Medicine"/></Field><Field label="Moneda"><Input defaultValue="Bolivianos (Bs)"/></Field><Field label="Zona horaria"><Input defaultValue="Bolivia (GMT-4)"/></Field><Field label="Numeración de historias"><Input defaultValue="HC-2026-"/></Field></div><div className="settings-actions"><Button className="gold" type="submit">Guardar cambios</Button>{savedMessage&&<span role="status">Cambios guardados correctamente</span>}</div></form>}
function Metric({icon:Icon,label,value,note}:{icon:typeof Users;label:string;value:string;note:string}){return <article className="metric"><span><Icon/></span><p>{label}</p><strong>{value}</strong><small>{note}</small></article>}
function Title({title,text,action,click}:{title:string;text:string;action?:string;click?:()=>void}){return <div className="title"><div><h3>{title}</h3><p>{text}</p></div>{action&&<button onClick={click}>{action}<ChevronRight/></button>}</div>}
function SectionLead({text}:{text:string}){return <div className="heading"><div><p>{text}</p></div></div>}
function Agenda(){return <div className="agenda">{[["09:30","María Fernanda López","Consulta integral","En consulta"],["10:30","Luciana Parada","Control y seguimiento","Confirmada"],["11:15","Fernando Gómez","Sueroterapia","Confirmada"],["14:00","Paola Suárez","Evaluación nutricional","Pendiente"]].map((a,i)=><div key={a[0]}><time>{a[0]}</time><i className={`c${i}`}/><span><b>{a[1]}</b><small>{a[2]}</small></span><em className="tag">{a[3]}</em></div>)}</div>}
function TxTable({txs}:{txs:Tx[]}){return <div className="table"><table><thead><tr><th>Concepto</th><th>Referencia</th><th>Fecha</th><th>Método</th><th>Importe</th></tr></thead><tbody>{txs.map(t=><tr key={t.id}><td><span className={t.type==="Ingreso"?"in":"out"}>{t.type==="Ingreso"?<ArrowUpRight/>:<ArrowDownRight/>}</span><b>{t.concept}<small>{t.type}{t.status?` · ${t.status}`:""}</small></b></td><td>{t.reference}</td><td>{t.date}</td><td>{t.method}</td><td className={t.type==="Ingreso"?"green":"red"}>{t.type==="Ingreso"?"+":"−"}{money(t.amount)}</td></tr>)}</tbody></table></div>}
function Avatar({name}:{name:string}){return <span className="avatar">{userInitials(name)}</span>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="field"><Label>{label}</Label>{children}</label>}

function UserDialog({action,primaryUserId,close,saveUser,savePermissions}:{action:UserAction;primaryUserId?:number;close:()=>void;saveUser:(u:User)=>void;savePermissions:(id:number,p:string[])=>void}){
  const[permissions,setPermissions]=useState<string[]>([]);
  useEffect(()=>{setPermissions(action?.user.permissions??(action?defaultPermissions(action.user.role):[]))},[action]);
  if(!action)return null;
  const user=action.user,isPrimary=user.id===primaryUserId;
  const toggle=(module:string)=>setPermissions(current=>current.includes(module)?current.filter(item=>item!==module):[...current,module]);
  const submitEdit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get("name")).trim(),role=String(f.get("role")),active=isPrimary?true:String(f.get("active"))==="true";saveUser({...user,name,role,email:String(f.get("email")||""),active,initials:userInitials(name),permissions:user.permissions??defaultPermissions(role)})};
  return <Dialog open onOpenChange={open=>!open&&close()}><DialogContent className="user-dialog"><DialogHeader><DialogTitle>{action.kind==="edit"?"Editar usuario":"Gestionar permisos"}</DialogTitle><DialogDescription>{action.kind==="edit"?"Actualiza los datos del usuario sin crear un registro nuevo.":`${user.name} · ${user.role}`}</DialogDescription></DialogHeader>
    {action.kind==="edit"?<form className="form" onSubmit={submitEdit}><Field label="Nombre"><Input name="name" defaultValue={user.name} required/></Field><Field label="Rol"><select name="role" defaultValue={user.role}><option>Administradora · Médica</option><option>Administrador</option><option>Médico</option><option>Recepción y caja</option><option>Enfermería</option></select></Field><Field label="Correo"><Input name="email" type="email" defaultValue={user.email??""} placeholder="Opcional"/></Field><Field label="Estado"><select name="active" defaultValue={user.active?"true":"false"} disabled={isPrimary}><option value="true">Activo</option><option value="false">Inactivo</option></select></Field>{isPrimary&&<p className="form-note">El usuario principal se mantiene activo para evitar bloquear la administración.</p>}<div className="form-actions"><Button type="button" variant="outline" onClick={close}>Cancelar</Button><Button className="gold" type="submit">Guardar usuario</Button></div></form>:<div className="permissions-form"><div className="permission-grid">{MODULES.map(module=><label key={module} className="permission-item"><input type="checkbox" checked={permissions.includes(module)} onChange={()=>toggle(module)}/><span>{module}</span></label>)}</div><div className="form-actions"><Button type="button" variant="outline" onClick={close}>Cancelar</Button><Button className="gold" type="button" onClick={()=>savePermissions(user.id,permissions)}>Guardar permisos</Button></div></div>}
  </DialogContent></Dialog>
}

function Entry({type,close,patients,addPatient,addService,addTx,addUser}:{type:string|null;close:()=>void;patients:Patient[];addPatient:(p:Patient)=>void;addService:(s:Service)=>void;addTx:(t:Tx)=>void;addUser:(u:User)=>void}){
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget),id=Date.now();
    if(type==="patient")addPatient({id,name:String(f.get("name")),code:`HC-2026-${149+patients.length}`,age:Number(f.get("age")),phone:String(f.get("phone")),lastVisit:"Sin consultas",status:"Nuevo"});
    if(type==="service")addService({id,name:String(f.get("name")),category:String(f.get("category")),price:Number(f.get("amount")),duration:String(f.get("duration")),active:true});
    if(type==="cash")addTx({id,concept:String(f.get("concept")),reference:String(f.get("reference")),type:"Ingreso",amount:Number(f.get("amount")),date:nowLabel(),method:String(f.get("method")),status:String(f.get("status")) as Tx["status"],origin:"cash"});
    if(type==="transaction")addTx({id,concept:String(f.get("concept")),reference:String(f.get("reference")),type:String(f.get("movement")) as "Ingreso"|"Egreso",amount:Number(f.get("amount")),date:nowLabel(),method:String(f.get("method")),status:String(f.get("movement"))==="Ingreso"?"Pagado":undefined,origin:"manual"});
    if(type==="user"){const n=String(f.get("name")),role=String(f.get("role"));addUser({id,name:n,role,email:String(f.get("email")||""),initials:userInitials(n),active:true,permissions:defaultPermissions(role)})}
    close()
  };
  const names:{[k:string]:string}={patient:"Registrar paciente",history:"Crear historia clínica",service:"Crear servicio",cash:"Registrar cobro",transaction:"Registrar movimiento",user:"Agregar usuario"};
  return <Dialog open={!!type} onOpenChange={o=>!o&&close()}><DialogContent><DialogHeader><DialogTitle>{type?names[type]:"Nuevo registro"}</DialogTitle><DialogDescription>Complete los datos para guardar el registro.</DialogDescription></DialogHeader><form className="form" onSubmit={submit}>
    {type==="patient"&&<><Field label="Nombre completo"><Input name="name" required/></Field><div className="cols"><Field label="Edad"><Input name="age" type="number" required/></Field><Field label="Teléfono"><Input name="phone" required/></Field></div></>}
    {type==="history"&&<><Field label="Paciente"><select name="patient">{patients.map(p=><option key={p.id}>{p.name}</option>)}</select></Field><Field label="Motivo de consulta"><Input required/></Field><Field label="Anamnesis y antecedentes"><Textarea rows={4}/></Field></>}
    {type==="service"&&<><Field label="Nombre"><Input name="name" required/></Field><Field label="Categoría"><Input name="category" required/></Field><div className="cols"><Field label="Precio (Bs)"><Input name="amount" type="number" min="0" required/></Field><Field label="Duración"><Input name="duration" placeholder="45 min" required/></Field></div></>}
    {type==="cash"&&<><Field label="Concepto del cobro"><Input name="concept" required/></Field><Field label="Paciente o referencia"><Input name="reference" required/></Field><div className="cols"><Field label="Importe"><Input name="amount" type="number" min="0" step=".01" required/></Field><Field label="Estado"><select name="status"><option>Pagado</option><option>Pendiente</option><option>Anulado</option></select></Field></div><Field label="Método"><select name="method"><option>Efectivo</option><option>QR</option><option>Transferencia</option><option>Otro</option></select></Field></>}
    {type==="transaction"&&<><div className="cols"><Field label="Tipo"><select name="movement"><option>Ingreso</option><option>Egreso</option></select></Field><Field label="Importe"><Input name="amount" type="number" min="0" step=".01" required/></Field></div><Field label="Concepto"><Input name="concept" required/></Field><Field label="Referencia"><Input name="reference" required/></Field><Field label="Método"><select name="method"><option>Efectivo</option><option>QR</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></Field></>}
    {type==="user"&&<><Field label="Nombre"><Input name="name" required/></Field><Field label="Rol"><select name="role"><option>Médico</option><option>Recepción y caja</option><option>Administrador</option><option>Enfermería</option></select></Field><Field label="Correo"><Input name="email" type="email" placeholder="Opcional"/></Field></>}
    <div className="form-actions"><Button type="button" variant="outline" onClick={close}>Cancelar</Button><Button className="gold">Guardar</Button></div>
  </form></DialogContent></Dialog>
}
