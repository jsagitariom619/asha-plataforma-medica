"use client";

import {useEffect,useState} from "react";
import {Trash2,X} from "lucide-react";

const DEMO_KEY="asha-demo";
const HISTORY_KEY="asha-aesthetic-histories-v1";
const COMPLETED_KEY="asha-completed-consultations-v1";
const LEGACY_STATUS_KEY="asha-clinical-demo-status-v2";

type StoredSession={cloudUser?:{isPrimaryAdmin?:boolean}};

type DemoStore={
  users?:unknown[];
  professionalName?:string;
  [key:string]:unknown;
};

function isPrimaryAdmin(){
  try{
    const session=JSON.parse(localStorage.getItem("asha-session")||"null") as StoredSession|null;
    return session?.cloudUser?.isPrimaryAdmin===true;
  }catch{return false}
}

function clearOperationalTestData(){
  const current:DemoStore=(()=>{try{return JSON.parse(localStorage.getItem(DEMO_KEY)||"null")||{}}catch{return{}}})();
  const clean:DemoStore={
    ...current,
    patients:[],
    services:[],
    products:[],
    txs:[],
    appointments:[],
    attentions:[]
  };
  localStorage.setItem(DEMO_KEY,JSON.stringify(clean));
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(COMPLETED_KEY);
  localStorage.removeItem(LEGACY_STATUS_KEY);
}

export function TestDataReset(){
  const[visible,setVisible]=useState(false);
  const[open,setOpen]=useState(false);
  const[confirm,setConfirm]=useState("");

  useEffect(()=>{
    const sync=()=>{
      const section=document.querySelector(".app>main>header h1")?.textContent?.trim();
      setVisible(section==="Configuración"&&isPrimaryAdmin());
    };
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    sync();
    return()=>observer.disconnect();
  },[]);

  if(!visible)return null;

  const execute=()=>{
    if(confirm.trim().toUpperCase()!=="BORRAR PRUEBAS")return;
    clearOperationalTestData();
    setOpen(false);
    setConfirm("");
    window.location.reload();
  };

  return <>
    <section className="test-data-reset-card" aria-label="Datos de prueba">
      <div><small>ADMINISTRADOR PRINCIPAL</small><h3>Datos de prueba</h3><p>Elimina los datos operativos usados durante las pruebas sin borrar usuarios, credenciales, permisos ni la sesión actual.</p></div>
      <button type="button" onClick={()=>setOpen(true)}><Trash2/>Borrar datos de prueba</button>
    </section>
    {open&&<div className="test-data-reset-layer" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
      <section className="test-data-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="test-data-reset-title">
        <header><div><h2 id="test-data-reset-title">Borrar datos de prueba</h2><p>Esta acción es irreversible.</p></div><button type="button" aria-label="Cerrar" onClick={()=>setOpen(false)}><X/></button></header>
        <div className="test-data-reset-warning"><b>Se eliminarán:</b><p>Pacientes, historias y evoluciones, atenciones, agenda, servicios, productos, cobros y movimientos registrados actualmente como datos operativos.</p><b>Se conservarán:</b><p>Usuarios, credenciales, permisos, configuración profesional y la sesión iniciada.</p></div>
        <label><span>Para confirmar escribe <b>BORRAR PRUEBAS</b></span><input value={confirm} onChange={event=>setConfirm(event.target.value)} autoComplete="off"/></label>
        <footer><button type="button" className="test-data-cancel" onClick={()=>setOpen(false)}>Cancelar</button><button type="button" className="test-data-danger" disabled={confirm.trim().toUpperCase()!=="BORRAR PRUEBAS"} onClick={execute}><Trash2/>Eliminar definitivamente</button></footer>
      </section>
    </div>}
  </>;
}
