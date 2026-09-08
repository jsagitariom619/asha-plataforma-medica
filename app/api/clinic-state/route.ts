import { NextResponse } from "next/server";
import { readJsonSafe, supabaseAdminFetch, supabaseAuthFetch } from "@/lib/supabase/server-rest";

export const dynamic = "force-dynamic";
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
type Caller = {id:string;isPrimaryAdmin:boolean;permissions:Set<string>};
type State = Record<string,unknown>;
const FIELD_MODULES:Record<string,string[]>={
  patients:["Pacientes","Historias clínicas"],
  services:["Servicios","Agenda","Historias clínicas","Caja y cobros"],
  products:["Productos","Caja y cobros","Movimientos","Contabilidad"],
  txs:["Caja y cobros","Movimientos","Productos","Contabilidad"],
  appointments:["Agenda"],
  attentions:["Pacientes","Historias clínicas","Caja y cobros"],
  clinicalHistories:["Historias clínicas"],
  completedConsultations:["Historias clínicas"],
  clinicalDemoStatus:["Historias clínicas"],
  professionalName:["Resumen","Configuración"],
};

function bearerToken(request:Request){return(request.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1]?.trim()||""}
function fail(error:string,status:number){return NextResponse.json({ok:false,error},{status,headers:{"Cache-Control":"no-store"}})}

async function authenticatedCaller(token:string):Promise<Caller|null>{
  if(!token)return null;
  const authResponse=await supabaseAuthFetch("/auth/v1/user",{headers:{Authorization:`Bearer ${token}`}});
  if(!authResponse.ok)return null;
  const authUser=await readJsonSafe(authResponse),id=typeof authUser.id==="string"?authUser.id:"";
  if(!id)return null;
  const profileResponse=await supabaseAdminFetch(`/rest/v1/profiles?select=id,is_active,is_primary_admin&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:{Accept:"application/json"}});
  if(!profileResponse.ok)return null;
  const profiles=await profileResponse.json() as Array<{is_active?:boolean;is_primary_admin?:boolean}>,profile=profiles[0];
  if(!profile?.is_active)return null;
  const permissionResponse=await supabaseAdminFetch(`/rest/v1/user_permissions?select=module&user_id=eq.${encodeURIComponent(id)}&allowed=eq.true`,{headers:{Accept:"application/json"}});
  const rows=permissionResponse.ok?await permissionResponse.json() as Array<{module?:string}>:[];
  return{id,isPrimaryAdmin:profile.is_primary_admin===true,permissions:new Set(rows.map(row=>row.module).filter((value):value is string=>Boolean(value)))};
}

function canUseField(caller:Caller,field:string){return caller.isPrimaryAdmin?field in FIELD_MODULES:(FIELD_MODULES[field]||[]).some(module=>caller.permissions.has(module))}
function visibleState(state:State,caller:Caller){return Object.fromEntries(Object.entries(state).filter(([field])=>canUseField(caller,field)))}
async function readCentralState():Promise<{payload:State;revision:number;updated_at:string|null}|null>{
  const response=await supabaseAdminFetch("/rest/v1/clinic_state?select=payload,revision,updated_at&id=eq.asha&limit=1",{headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error(`clinic_state read failed: ${response.status}`);
  const rows=await response.json() as Array<{payload?:unknown;revision?:number;updated_at?:string}>,row=rows[0];
  if(!row)return null;
  return{payload:row.payload&&typeof row.payload==="object"&&!Array.isArray(row.payload)?row.payload as State:{},revision:Number(row.revision)||1,updated_at:row.updated_at||null};
}

export async function GET(request:Request){
  try{
    const caller=await authenticatedCaller(bearerToken(request));if(!caller)return fail("Sesión no válida.",401);
    const row=await readCentralState();
    return NextResponse.json({ok:true,state:row?visibleState(row.payload,caller):null,revision:row?.revision??0,updatedAt:row?.updated_at??null},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("ASHA clinic state read error",error);return fail("No se pudo leer la información central.",503)}
}

export async function PUT(request:Request){
  try{
    const caller=await authenticatedCaller(bearerToken(request));if(!caller)return fail("Sesión no válida.",401);
    const raw=await request.text();if(!raw||Buffer.byteLength(raw,"utf8")>MAX_PAYLOAD_BYTES)return fail("La información excede el tamaño permitido.",413);
    let body:{state?:unknown};try{body=JSON.parse(raw) as{state?:unknown}}catch{return fail("Contenido no válido.",400)}
    if(!body.state||typeof body.state!=="object"||Array.isArray(body.state))return fail("Contenido no válido.",400);
    const permitted=Object.fromEntries(Object.entries(body.state as State).filter(([field])=>canUseField(caller,field)));
    if(!Object.keys(permitted).length)return fail("No tienes permiso para guardar esta información.",403);
    const current=await readCentralState(),payload={...(current?.payload||{}),...permitted},revision=(current?.revision||0)+1;
    const response=await supabaseAdminFetch("/rest/v1/clinic_state?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation",Accept:"application/json"},body:JSON.stringify({id:"asha",payload,revision,updated_by:caller.id,updated_at:new Date().toISOString()})});
    if(!response.ok){console.error("ASHA clinic state write rejected",response.status,await response.text());return fail("No se pudo guardar la información central.",503)}
    const rows=await response.json() as Array<{revision?:number;updated_at?:string}>;
    return NextResponse.json({ok:true,revision:rows[0]?.revision??revision,updatedAt:rows[0]?.updated_at??null},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("ASHA clinic state write error",error);return fail("No se pudo guardar la información central.",503)}
}
