"use client";

import {useEffect} from "react";

type Patient={name:string;status?:string;lastVisit?:string};
type Appointment={id:number;date:string;time:string;patient:string;service:string;status:string};
type CompletedMap=Record<string,{completedAt:string;date:string}>;

const COMPLETED_KEY="asha-completed-consultations-v1";
const todayKey=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`};
const visitLabel=(iso:string)=>{const date=new Date(iso);return `Hoy, ${new Intl.DateTimeFormat("es-BO",{hour:"2-digit",minute:"2-digit",hour12:false}).format(date)}`};
function readCompleted():CompletedMap{try{const value=JSON.parse(localStorage.getItem(COMPLETED_KEY)||"{}");return value&&typeof value==="object"?value:{}}catch{return{}}}
function writeCompleted(value:CompletedMap){try{localStorage.setItem(COMPLETED_KEY,JSON.stringify(value))}catch{}}

function persistCompletion(patientName:string,completedAt:string){
  try{
    const stored=JSON.parse(localStorage.getItem("asha-demo")||"null")||{};
    const patients:Array<Patient>=Array.isArray(stored.patients)?stored.patients:[];
    const appointments:Array<Appointment>=Array.isArray(stored.appointments)?stored.appointments:[];
    const date=todayKey();
    const nextPatients=patients.map(patient=>patient.name===patientName?{...patient,status:"Atendido",lastVisit:visitLabel(completedAt)}:patient);
    const candidates=appointments.map((appointment,index)=>({appointment,index})).filter(({appointment})=>appointment.patient===patientName&&appointment.date===date&&appointment.status!=="Atendido"&&appointment.status!=="Anulado");
    const preferred=candidates.find(({appointment})=>appointment.status==="En consulta")||candidates.find(({appointment})=>appointment.status==="Confirmada")||candidates[0];
    const nextAppointments=appointments.map((appointment,index)=>preferred&&index===preferred.index?{...appointment,status:"Atendido"}:appointment);
    localStorage.setItem("asha-demo",JSON.stringify({...stored,patients:nextPatients,appointments:nextAppointments}));
  }catch{}
}

function syncDom(){
  const completed=readCompleted(),today=todayKey();
  document.querySelectorAll<HTMLElement>(".person").forEach(row=>{const name=row.querySelector("b")?.textContent?.trim();if(!name)return;const item=completed[name];if(!item)return;const tag=row.querySelector<HTMLElement>(".tag");if(tag)tag.textContent="Atendido";const directSmalls=Array.from(row.children).filter(el=>el.tagName==="SMALL") as HTMLElement[];const last=directSmalls[directSmalls.length-1];if(last)last.textContent=visitLabel(item.completedAt)});
  document.querySelectorAll<HTMLElement>(".agenda > div").forEach(row=>{const name=row.querySelector("b")?.textContent?.trim();if(!name)return;const item=completed[name];if(!item||item.date!==today)return;const tag=row.querySelector<HTMLElement>("em.tag");if(tag&&tag.textContent!=="Anulado")tag.textContent="Atendido"});
}

export function ClinicalStatusSync(){
  useEffect(()=>{
    let timer:number|undefined;
    const reconcile=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>{const completed=readCompleted();Object.entries(completed).forEach(([name,item])=>persistCompletion(name,item.completedAt));syncDom()},30)};
    const onSubmit=(event:Event)=>{const form=event.target as HTMLFormElement|null;if(!form?.classList.contains("aesthetic-history-form"))return;const data=new FormData(form),patient=String(data.get("patient")||"").trim();if(!patient)return;const completedAt=new Date().toISOString(),completed=readCompleted();completed[patient]={completedAt,date:todayKey()};writeCompleted(completed);window.setTimeout(()=>{persistCompletion(patient,completedAt);syncDom();window.dispatchEvent(new CustomEvent("asha-clinical-completed",{detail:{patient}}))},120)};
    document.addEventListener("submit",onSubmit,true);
    const observer=new MutationObserver(reconcile);observer.observe(document.body,{childList:true,subtree:true,characterData:true});syncDom();
    return()=>{document.removeEventListener("submit",onSubmit,true);observer.disconnect();window.clearTimeout(timer)};
  },[]);
  return null;
}
