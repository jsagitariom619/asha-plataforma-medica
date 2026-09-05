"use client";

import {useEffect,useMemo,useState} from "react";
import {CalendarDays,ChevronRight,FileHeart,ImagePlus,Stethoscope,UserRound,X} from "lucide-react";

type Patient={id:number;name:string;code?:string;age?:number;phone?:string;lastVisit?:string;status?:string};
type HistoryRecord={id:number;createdAt:string;patient:string;patientCode:string;data:Record<string,string|string[]>};

const HISTORY_KEY="asha-aesthetic-histories-v1";

function readPatient(name:string):Patient|null{try{const data=JSON.parse(localStorage.getItem("asha-demo")||"null");const patients:Array<Patient>=Array.isArray(data?.patients)?data.patients:[];return patients.find(item=>item.name===name)||null}catch{return null}}
function readHistories(name:string):HistoryRecord[]{try{const rows=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");return (Array.isArray(rows)?rows:[]).filter((item:HistoryRecord)=>item.patient===name).sort((a:HistoryRecord,b:HistoryRecord)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime())}catch{return[]}}
const value=(record:HistoryRecord,key:string)=>{const raw=record.data?.[key];return Array.isArray(raw)?raw.join(", "):String(raw||"").trim()};
const prettyDate=(value:string)=>{try{return new Intl.DateTimeFormat("es-BO",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}catch{return value}};

export function PatientProfileCompat(){
  const[patient,setPatient]=useState<Patient|null>(null),[histories,setHistories]=useState<HistoryRecord[]>([]);
  useEffect(()=>{
    const openByName=(name:string)=>{const found=readPatient(name);if(!found)return;setPatient(found);setHistories(readHistories(name))};
    const onClick=(event:MouseEvent)=>{const target=event.target as HTMLElement|null;const row=target?.closest(".person") as HTMLElement|null;if(!row)return;const name=row.querySelector("b")?.textContent?.trim();if(!name)return;event.preventDefault();openByName(name)};
    const onRefresh=(event:Event)=>{const name=(event as CustomEvent<{patient?:string}>).detail?.patient;if(patient&&(!name||name===patient.name))openByName(patient.name)};
    document.addEventListener("click",onClick,true);window.addEventListener("asha-clinical-completed",onRefresh as EventListener);return()=>{document.removeEventListener("click",onClick,true);window.removeEventListener("asha-clinical-completed",onRefresh as EventListener)};
  },[patient]);
  useEffect(()=>{if(!patient)return;const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setPatient(null)};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey)},[patient]);

  const treatmentSummary=useMemo(()=>histories.map((record,index)=>({
    id:record.id,
    title:value(record,"procedure")||value(record,"treatmentPlan")|| (index===histories.length-1?"Historia clínica inicial":"Control / evolución"),
    areas:value(record,"areas"),
    nextControl:value(record,"nextControl"),
    response:value(record,"evolution"),
    hasPhotos:Boolean(value(record,"beforePhoto")||value(record,"afterPhoto")),
    date:prettyDate(record.createdAt),
    record
  })),[histories]);
  if(!patient)return null;
  const active=treatmentSummary.find(item=>item.nextControl)||treatmentSummary[0];
  const openEvolution=()=>{const article=document.createElement("article"),title=document.createElement("h3"),button=document.createElement("button");article.style.display="none";title.textContent=patient.name;button.type="button";button.textContent="Registrar evolución";article.append(title,button);document.body.appendChild(article);setPatient(null);button.click();article.remove()};

  return <div className="patient-profile-layer" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setPatient(null)}}>
    <section className="patient-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="patient-profile-title">
      <header className="patient-profile-header"><div><span className="patient-profile-avatar"><UserRound/></span><div><small>EXPEDIENTE DEL PACIENTE</small><h2 id="patient-profile-title">{patient.name}</h2><p>{patient.code||"Sin número de historia"}</p></div></div><button type="button" aria-label="Cerrar" onClick={()=>setPatient(null)}><X/></button></header>
      <div className="patient-profile-body">
        <div className="patient-profile-facts"><div><span>Edad</span><b>{patient.age?`${patient.age} años`:"No registrada"}</b></div><div><span>Teléfono</span><b>{patient.phone||"No registrado"}</b></div><div><span>Última atención</span><b>{patient.lastVisit||"Sin consultas"}</b></div><div><span>Estado</span><b className="patient-profile-status">{patient.status||"Sin estado"}</b></div></div>

        <section className="patient-profile-current"><div className="patient-profile-section-title"><Stethoscope/><div><h3>Tratamiento actual</h3><p>Resumen de la atención o procedimiento más reciente.</p></div></div>{active?<div className="patient-current-card"><div><span className="patient-current-icon"><Stethoscope/></span><div><b>{active.title}</b>{active.areas&&<small>{active.areas}</small>}<small>{active.date}</small></div></div>{active.nextControl?<span className="patient-next-control"><CalendarDays/>Próximo control: {active.nextControl}</span>:<span className="patient-no-control">Sin próximo control programado</span>}</div>:<div className="patient-profile-empty">Este paciente todavía no tiene tratamientos ni historias estéticas registradas.</div>}</section>

        <section><div className="patient-profile-section-title"><FileHeart/><div><h3>Historia y evoluciones</h3><p>{histories.length} registro{histories.length===1?"":"s"} clínico{histories.length===1?"":"s"} asociado{histories.length===1?"":"s"}.</p></div></div>{treatmentSummary.length?<div className="patient-timeline">{treatmentSummary.map((item,index)=><article key={item.id}><span className="patient-timeline-dot"/><div className="patient-timeline-card"><div className="patient-timeline-top"><div><small>{index===treatmentSummary.length-1?"HISTORIA INICIAL":"EVOLUCIÓN / CONTROL"}</small><h4>{item.title}</h4></div><span>{item.date}</span></div>{item.areas&&<p><b>Zona:</b> {item.areas}</p>}{item.response&&<p><b>Evolución:</b> {item.response}</p>}{item.hasPhotos&&<span className="patient-photo-chip"><ImagePlus/>Registro fotográfico</span>}{item.nextControl&&<span className="patient-control-chip"><CalendarDays/>Control {item.nextControl}</span>}</div></article>)}</div>:<div className="patient-profile-empty">No existen registros clínicos guardados para este paciente.</div>}</section>
      </div>
      <footer className="patient-profile-actions"><button type="button" className="patient-secondary" onClick={()=>setPatient(null)}>Cerrar</button><button type="button" className="patient-primary" onClick={openEvolution}><FileHeart/>Registrar evolución <ChevronRight/></button></footer>
    </section>
  </div>
}
