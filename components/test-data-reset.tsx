"use client";

import {useEffect,useState} from "react";
import {Trash2,X} from "lucide-react";

type SessionPayload={ok?:boolean;user?:{isPrimaryAdmin?:boolean}};

const EMPTY_OPERATIONAL_STATE={
  patients:[],
  services:[],
  products:[],
  txs:[],
  appointments:[],
  attentions:[],
  clinicalHistories:[],
  completedConsultations:[],
  clinicalDemoStatus:{}
};

export function TestDataReset(){
  const[isPrimary,setIsPrimary]=useState(false),[visible,setVisible]=useState(false),[open,setOpen]=useState(false),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");

  useEffect(()=>{
    let cancelled=false;
    fetch("/api/asha-auth/session",{credentials:"same-origin",cache:"no-store"})
      .then(async response=>{const data=await response.json().catch(()=>({})) as SessionPayload;if(!cancelled)setIsPrimary(response.ok&&data?.ok===true&&data?.user?.isPrimaryAdmin===true)})
      .catch(()=>{if(!cancelled)setIsPrimary(false)});
    return()=>{cancelled=true};
  },[]);

  useEffect(()=>{
    const sync=()=>{
      const section=document.querySelector(".app>main>header h1")?.textContent?.trim();
      setVisible(section==="Configuración"&&isPrimary);
    };
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    sync();
    return()=>observer.disconnect();
  },[isPrimary]);

  if(!visible)return null;

  const close=()=>{if(busy)return;setOpen(false);setConfirm("");setError("")};
  const execute=async()=>{
    if(confirm.trim().toUpperCase()!=="BORRAR PRUEBAS"||busy)return;
    setBusy(true);setError("");
    try{
      const sessionResponse=await fetch("/api/asha-auth/session",{credentials:"same-origin",cache:"no-store"});
      const sessionData=await sessionResponse.json().catch(()=>({})) as SessionPayload;
      if(!sessionResponse.ok||sessionData?.ok!==true||sessionData?.user?.isPrimaryAdmin!==true)throw new Error("Solo la administradora principal puede borrar datos de prueba.");
      const response=await fetch("/api/clinic-state",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({state:EMPTY_OPERATIONAL_STATE})});
      const data=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok)throw new Error(data?.error||"No se pudieron borrar los datos de prueba.");
      setOpen(false);setConfirm("");
      window.location.reload();
    }catch(value){setError(value instanceof Error?value.message:"No se pudieron borrar los datos de prueba.");setBusy(false)}
  };

  return <>
    <section className="test-data-reset-card" aria-label="Datos de prueba">
      <div><small>ADMINISTRADOR PRINCIPAL</small><h3>Datos de prueba</h3><p>Elimina los registros operativos de prueba guardados en Supabase sin borrar usuarios, credenciales, permisos ni configuración profesional.</p></div>
      <button type="button" onClick={()=>{setError("");setConfirm("");setOpen(true)}}><Trash2/>Borrar datos de prueba</button>
    </section>
    {open&&<div className="test-data-reset-layer" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}>
      <section className="test-data-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="test-data-reset-title">
        <header><div><h2 id="test-data-reset-title">Borrar datos de prueba</h2><p>Esta acción es irreversible.</p></div><button type="button" aria-label="Cerrar" disabled={busy} onClick={close}><X/></button></header>
        <div className="test-data-reset-warning"><b>Se eliminarán:</b><p>Pacientes, historias y evoluciones, atenciones, agenda, servicios, productos, cobros y movimientos operativos actualmente guardados en ASHA.</p><b>Se conservarán:</b><p>Usuarios, credenciales, permisos, perfiles, configuración profesional y la sesión actual.</p></div>
        {error&&<div className="test-data-reset-error" role="alert">{error}</div>}
        <label><span>Para confirmar escribe <b>BORRAR PRUEBAS</b></span><input value={confirm} disabled={busy} onChange={event=>setConfirm(event.target.value)} autoComplete="off"/></label>
        <footer><button type="button" className="test-data-cancel" disabled={busy} onClick={close}>Cancelar</button><button type="button" className="test-data-danger" disabled={busy||confirm.trim().toUpperCase()!=="BORRAR PRUEBAS"} onClick={execute}><Trash2/>{busy?"Eliminando…":"Eliminar definitivamente"}</button></footer>
      </section>
    </div>}
  </>;
}
