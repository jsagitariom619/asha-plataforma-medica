"use client";

import {useEffect} from "react";

type Patient={name:string;status?:string;lastVisit?:string};
type Appointment={id:number;date:string;time:string;patient:string;service:string;status:string};
type CompletedMap=Record<string,{completedAt:string;date:string}>;

const COMPLETED_KEY="asha-completed-consultations-v1";
const LEGACY_DEMO_MIGRATION_KEY="asha-clinical-demo-status-v2";
const LEGACY_ATTENDED_NAMES=new Set(["María Fernanda López","Carlos Alberto Rojas","Ana Sofía Méndez"]);
const BOLIVIA_TIME_ZONE="America/La_Paz";

function boliviaDateKey(value:Date|string=new Date()){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))return"";
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:BOLIVIA_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const read=(type:string)=>parts.find(part=>part.type===type)?.value||"";
  return `${read("year")}-${read("month")}-${read("day")}`;
}
const todayKey=()=>boliviaDateKey(new Date());
const visitLabel=(iso:string)=>{const date=new Date(iso);if(Number.isNaN(date.getTime()))return iso;return `Hoy, ${new Intl.DateTimeFormat("es-BO",{timeZone:BOLIVIA_TIME_ZONE,hour:"2-digit",minute:"2-digit",hour12:false}).format(date)}`};
function readCompleted():CompletedMap{try{const value=JSON.parse(localStorage.getItem(COMPLETED_KEY)||"{}");return value&&typeof value==="object"?value:{}}catch{return{}}}
function writeCompleted(value:CompletedMap){try{localStorage.setItem(COMPLETED_KEY,JSON.stringify(value))}catch{}}

function migrateLegacyDemoStatuses(){
  try{
    if(localStorage.getItem(LEGACY_DEMO_MIGRATION_KEY)==="done")return;
    const stored=JSON.parse(localStorage.getItem("asha-demo")||"null")||{};
    const patients:Array<Patient>=Array.isArray(stored.patients)?stored.patients:[];
    const appointments:Array<Appointment>=Array.isArray(stored.appointments)?stored.appointments:[];
    let changed=false;
    const nextPatients=patients.map(patient=>{
      if(!LEGACY_ATTENDED_NAMES.has(patient.name)||patient.status==="Atendido")return patient;
      changed=true;
      return{...patient,status:"Atendido"};
    });
    const nextAppointments=appointments.map(appointment=>{
      const legacyMaria=appointment.patient==="María Fernanda López"&&appointment.time==="09:30"&&appointment.service==="Consulta integral";
      if(!legacyMaria||appointment.status==="Atendido")return appointment;
      changed=true;
      return{...appointment,status:"Atendido"};
    });
    if(changed)localStorage.setItem("asha-demo",JSON.stringify({...stored,patients:nextPatients,appointments:nextAppointments}));
    localStorage.setItem(LEGACY_DEMO_MIGRATION_KEY,"done");
  }catch{}
}

function persistCompletion(patientName:string,completedAt:string){
  try{
    const stored=JSON.parse(localStorage.getItem("asha-demo")||"null")||{};
    const patients:Array<Patient>=Array.isArray(stored.patients)?stored.patients:[];
    const appointments:Array<Appointment>=Array.isArray(stored.appointments)?stored.appointments:[];
    const date=boliviaDateKey(completedAt)||todayKey(),label=visitLabel(completedAt);
    let changed=false;
    const nextPatients=patients.map(patient=>{if(patient.name!==patientName)return patient;if(patient.status==="Atendido"&&patient.lastVisit===label)return patient;changed=true;return{...patient,status:"Atendido",lastVisit:label}});
    const candidates=appointments.map((appointment,index)=>({appointment,index})).filter(({appointment})=>appointment.patient===patientName&&appointment.date===date&&appointment.status!=="Atendido"&&appointment.status!=="Anulado");
    const preferred=candidates.find(({appointment})=>appointment.status==="En consulta")||candidates.find(({appointment})=>appointment.status==="Confirmada")||candidates[0];
    const nextAppointments=appointments.map((appointment,index)=>{if(!preferred||index!==preferred.index)return appointment;changed=true;return{...appointment,status:"Atendido"}});
    if(changed)localStorage.setItem("asha-demo",JSON.stringify({...stored,patients:nextPatients,appointments:nextAppointments}));
  }catch{}
}

function syncDom(){
  const completed=readCompleted(),today=todayKey();
  document.querySelectorAll<HTMLElement>(".person").forEach(row=>{const name=row.querySelector("b")?.textContent?.trim();if(!name)return;const item=completed[name];if(!item)return;const tag=row.querySelector<HTMLElement>(".tag");if(tag&&tag.textContent!=="Atendido")tag.textContent="Atendido";const directSmalls=Array.from(row.children).filter(el=>el.tagName==="SMALL") as HTMLElement[];const last=directSmalls[directSmalls.length-1],label=visitLabel(item.completedAt);if(last&&last.textContent!==label)last.textContent=label});
  document.querySelectorAll<HTMLElement>(".agenda > div").forEach(row=>{const name=row.querySelector("b")?.textContent?.trim();if(!name)return;const item=completed[name];if(!item||boliviaDateKey(item.completedAt)!==today)return;const tag=row.querySelector<HTMLElement>("em.tag");if(tag&&tag.textContent!=="Anulado"&&tag.textContent!=="Atendido")tag.textContent="Atendido"});
}

function syncLegacyDemoDom(){
  document.querySelectorAll<HTMLElement>(".person").forEach(row=>{const name=row.querySelector("b")?.textContent?.trim();if(!name||!LEGACY_ATTENDED_NAMES.has(name))return;const tag=row.querySelector<HTMLElement>(".tag");if(tag&&tag.textContent!=="Atendido")tag.textContent="Atendido"});
  document.querySelectorAll<HTMLElement>(".agenda > div").forEach(row=>{const name=row.querySelector("b")?.textContent?.trim();const time=row.querySelector("time")?.textContent?.trim();if(name!=="María Fernanda López"||time!=="09:30")return;const tag=row.querySelector<HTMLElement>("em.tag");if(tag&&tag.textContent!=="Atendido")tag.textContent="Atendido"});
}

export function ClinicalStatusSync(){
  useEffect(()=>{
    migrateLegacyDemoStatuses();
    let timer:number|undefined;
    const reconcile=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>{const completed=readCompleted();Object.entries(completed).forEach(([name,item])=>persistCompletion(name,item.completedAt));syncLegacyDemoDom();syncDom()},40)};
    const onSubmit=(event:Event)=>{const form=event.target as HTMLFormElement|null;if(!form?.classList.contains("aesthetic-history-form"))return;const data=new FormData(form),patient=String(data.get("patient")||"").trim();if(!patient)return;const completedAt=new Date().toISOString(),completed=readCompleted();completed[patient]={completedAt,date:boliviaDateKey(completedAt)};writeCompleted(completed);window.setTimeout(()=>{persistCompletion(patient,completedAt);syncLegacyDemoDom();syncDom();window.dispatchEvent(new CustomEvent("asha-clinical-completed",{detail:{patient}}))},120)};
    document.addEventListener("submit",onSubmit,true);
    const observer=new MutationObserver(reconcile);observer.observe(document.body,{childList:true,subtree:true,characterData:true});syncLegacyDemoDom();syncDom();
    return()=>{document.removeEventListener("submit",onSubmit,true);observer.disconnect();window.clearTimeout(timer)};
  },[]);
  return null;
}
