"use client";

import {useEffect} from "react";

export function ClinicalUiPunctualFixes(){
  useEffect(()=>{
    const openPatientFromHistory=(name:string)=>{
      window.dispatchEvent(new CustomEvent("asha-open-patient-profile",{detail:{patient:name,source:"Historias clínicas"}}));
    };
    const launchDirectAttention=(name:string)=>{
      const card=Array.from(document.querySelectorAll<HTMLElement>("article.record")).find(item=>item.querySelector("h3")?.textContent?.trim()===name);
      const button=Array.from(card?.querySelectorAll<HTMLButtonElement>("button")||[]).find(item=>(item.textContent||"").includes("Ver expediente")||(item.textContent||"").includes("Nueva atención"));
      if(!button)return;
      button.dataset.ashaDirectAttention="true";
      button.click();
      delete button.dataset.ashaDirectAttention;
    };
    const enhance=()=>{
      const section=document.querySelector(".app>main>header h1")?.textContent?.trim();
      const headerGold=document.querySelector<HTMLButtonElement>(".head-actions > button.gold");
      if(headerGold&&section==="Historias clínicas"&&headerGold.textContent?.includes("Nueva atención"))headerGold.style.display="none";
      else if(headerGold)headerGold.style.removeProperty("display");
      document.querySelectorAll<HTMLElement>("article.record").forEach(card=>{
        const edit=card.querySelector<HTMLButtonElement>("[data-asha-edit-history]");
        const evolution=Array.from(card.querySelectorAll<HTMLButtonElement>("button")).find(button=>(button.textContent||"").includes("Registrar evolución"));
        const newAttention=Array.from(card.querySelectorAll<HTMLButtonElement>("button")).find(button=>(button.textContent||"").includes("Nueva atención")||(button.textContent||"").includes("Ver expediente"));
        if(edit){if(edit.textContent?.trim()!=="Modificar historia clínica")edit.textContent="Modificar historia clínica";edit.setAttribute("aria-label","Modificar historia clínica");edit.classList.add("asha-record-edit-action")}
        if(evolution){evolution.setAttribute("aria-label","Registrar evolución");evolution.classList.add("asha-record-evolution-action")}
        if(newAttention&&!newAttention.dataset.ashaHistoryRedirect){
          newAttention.dataset.ashaHistoryRedirect="true";
          newAttention.textContent="Ver expediente";
          newAttention.setAttribute("aria-label","Ver expediente del paciente");
          newAttention.addEventListener("click",event=>{
            if(newAttention.dataset.ashaDirectAttention==="true")return;
            event.preventDefault();
            event.stopPropagation();
            const name=card.querySelector("h3")?.textContent?.trim();
            if(name)openPatientFromHistory(name)
          },true);
        }
      });
    };
    const onDirectAttention=(event:Event)=>{const name=(event as CustomEvent<{patient?:string}>).detail?.patient||"";if(name)launchDirectAttention(name)};
    window.addEventListener("asha-open-new-attention",onDirectAttention as EventListener);
    const observer=new MutationObserver(enhance);observer.observe(document.body,{childList:true,subtree:true});enhance();return()=>{observer.disconnect();window.removeEventListener("asha-open-new-attention",onDirectAttention as EventListener)};
  },[]);
  return null;
}
