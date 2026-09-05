"use client";

import {useEffect} from "react";

export function ClinicalUiPunctualFixes(){
  useEffect(()=>{
    const enhance=()=>{
      document.querySelectorAll<HTMLElement>("article.record").forEach(card=>{
        const edit=card.querySelector<HTMLButtonElement>("[data-asha-edit-history]");
        const evolution=Array.from(card.querySelectorAll<HTMLButtonElement>("button")).find(button=>(button.textContent||"").includes("Registrar evolución"));
        if(edit){
          if(edit.textContent?.trim()!=="Modificar historia clínica")edit.textContent="Modificar historia clínica";
          edit.setAttribute("aria-label","Modificar historia clínica");
          edit.classList.add("asha-record-edit-action");
        }
        if(evolution){
          evolution.setAttribute("aria-label","Registrar evolución");
          evolution.classList.add("asha-record-evolution-action");
        }
      });
    };
    const observer=new MutationObserver(enhance);
    observer.observe(document.body,{childList:true,subtree:true});
    enhance();
    return()=>observer.disconnect();
  },[]);
  return null;
}
