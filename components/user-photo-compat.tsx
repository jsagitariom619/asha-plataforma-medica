"use client";

import {useEffect} from "react";

const PHOTO_KEY="asha-user-photos-v1";
type PhotoMap=Record<string,string>;

function normalize(value:string){return value.trim().toLowerCase()}
function readPhotos():PhotoMap{try{const value=JSON.parse(localStorage.getItem(PHOTO_KEY)||"{}");return value&&typeof value==="object"?value:{}}catch{return{}}}
function writePhotos(value:PhotoMap){localStorage.setItem(PHOTO_KEY,JSON.stringify(value));window.dispatchEvent(new Event("asha-user-photo-updated"))}
function currentUsername(){try{const session=JSON.parse(localStorage.getItem("asha-session")||"null")||{};return normalize(String(session?.cloudUser?.username||""))}catch{return""}}
function userKeyFromCard(card:Element){const credential=card.querySelector(".credential-state")?.textContent||"";const match=credential.match(/Usuario:\s*(.+)$/i);return normalize(match?.[1]||card.querySelector("h3")?.textContent||"")}

async function preparePhoto(file:File){
  if(!file.type.startsWith("image/"))throw new Error("Formato no válido");
  if(file.size>8*1024*1024)throw new Error("La imagen es demasiado grande");
  const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(new Error("No se pudo leer la imagen"));reader.readAsDataURL(file)});
  return await new Promise<string>((resolve,reject)=>{const image=new Image();image.onload=()=>{const max=512,scale=Math.min(1,max/Math.max(image.width,image.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext("2d");if(!ctx){reject(new Error("No se pudo procesar la imagen"));return}ctx.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.82))};image.onerror=()=>reject(new Error("No se pudo procesar la imagen"));image.src=source})
}

function setAvatar(container:Element|null,photo:string){
  if(!container)return;
  const existing=container.querySelector<HTMLImageElement>("img[data-asha-user-photo]");
  if(!photo){existing?.remove();container.classList.remove("has-user-photo");return}
  let image=existing;
  if(!image){image=document.createElement("img");image.dataset.ashaUserPhoto="true";image.alt="Foto de perfil";container.prepend(image)}
  image.src=photo;container.classList.add("has-user-photo")
}

function decorateAvatars(){
  const photos=readPhotos(),sessionKey=currentUsername();
  const professional=document.querySelector(".professional-card");
  if(professional){const name=normalize(professional.querySelector("b")?.textContent||"");setAvatar(professional.querySelector(":scope > span"),photos[sessionKey]||photos[name]||"")}
  document.querySelectorAll(".panel.user").forEach(card=>setAvatar(card.querySelector(".big-avatar"),photos[userKeyFromCard(card)]||""));
}

function enhanceUserDialog(){
  const dialog=document.querySelector<HTMLElement>(".user-dialog");
  const form=dialog?.querySelector<HTMLFormElement>("form.form");
  if(!form||form.dataset.ashaPhotoReady)return;
  const title=dialog?.querySelector("[data-slot='dialog-title'],h2")?.textContent||"";
  if(!title.includes("Editar usuario"))return;
  const usernameInput=form.querySelector<HTMLInputElement>('input[name="username"]');
  const nameInput=form.querySelector<HTMLInputElement>('input[name="name"]');
  if(!usernameInput||!nameInput)return;
  form.dataset.ashaPhotoReady="true";
  const originalKey=normalize(usernameInput.value||nameInput.value),photos=readPhotos();
  let draft=photos[originalKey]||"";

  const block=document.createElement("div");block.className="asha-user-photo-editor";
  const preview=document.createElement("div");preview.className="asha-user-photo-preview";
  const initials=document.createElement("span");initials.textContent=(nameInput.value||"US").split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase();
  const img=document.createElement("img");img.alt="Vista previa de foto de perfil";
  if(draft){img.src=draft;preview.append(img)}else preview.append(initials);
  const copy=document.createElement("div");copy.innerHTML="<b>Foto de perfil</b><small>Opcional. Se mostrará junto al nombre del usuario.</small>";
  const actions=document.createElement("div");actions.className="asha-user-photo-actions";
  const choose=document.createElement("button");choose.type="button";choose.textContent=draft?"Cambiar foto":"Agregar foto";
  const remove=document.createElement("button");remove.type="button";remove.textContent="Quitar";remove.hidden=!draft;
  const input=document.createElement("input");input.type="file";input.accept="image/*";input.hidden=true;
  const error=document.createElement("small");error.className="asha-user-photo-error";
  actions.append(choose,remove,input);block.append(preview,copy,actions,error);
  form.prepend(block);

  const refreshPreview=()=>{preview.replaceChildren();if(draft){img.src=draft;preview.append(img);choose.textContent="Cambiar foto";remove.hidden=false}else{initials.textContent=(nameInput.value||"US").split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase();preview.append(initials);choose.textContent="Agregar foto";remove.hidden=true}};
  choose.addEventListener("click",()=>input.click());
  input.addEventListener("change",async()=>{const file=input.files?.[0];input.value="";if(!file)return;error.textContent="";choose.disabled=true;try{draft=await preparePhoto(file);refreshPreview()}catch(err){error.textContent=err instanceof Error?err.message:"No se pudo cargar la imagen."}finally{choose.disabled=false}});
  remove.addEventListener("click",()=>{draft="";error.textContent="";refreshPreview()});
  nameInput.addEventListener("input",()=>{if(!draft)refreshPreview()});
  form.addEventListener("submit",()=>{const key=normalize(usernameInput.value||nameInput.value),next=readPhotos();if(originalKey&&originalKey!==key)delete next[originalKey];if(draft)next[key]=draft;else delete next[key];writePhotos(next)});
}

export function UserPhotoCompat(){
  useEffect(()=>{
    const enhance=()=>{decorateAvatars();enhanceUserDialog()};
    const observer=new MutationObserver(enhance);observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("asha-user-photo-updated",enhance);enhance();
    return()=>{observer.disconnect();window.removeEventListener("asha-user-photo-updated",enhance)}
  },[]);
  return null
}
