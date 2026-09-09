import {NextResponse} from "next/server";
import {readAccessToken} from "@/lib/auth/session";
import {deriveInternalPassword,initialsFromName,normalizeUsername,readJsonSafe,sanitizePermissions,supabaseAdminFetch,supabaseAuthFetch} from "@/lib/supabase/server-rest";

const VALID_ROLES=new Set(["Administrador","Médico","Recepción y caja","Enfermería","Usuario"]);

function fail(error:string,status=400){return NextResponse.json({ok:false,error},{status,headers:{"Cache-Control":"no-store"}})}
async function requirePrimaryAdmin(){
  const token=await readAccessToken();if(!token)return null;
  const auth=await supabaseAuthFetch("/auth/v1/user",{headers:{Authorization:`Bearer ${token}`}});if(!auth.ok)return null;
  const user=await readJsonSafe(auth),id=typeof user.id==="string"?user.id:"";if(!id)return null;
  const response=await supabaseAdminFetch(`/rest/v1/profiles?select=id,is_active,is_primary_admin&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:{Accept:"application/json"}});
  if(!response.ok)return null;const rows=await response.json() as Array<{is_active?:boolean;is_primary_admin?:boolean}>;
  return rows[0]?.is_active&&rows[0]?.is_primary_admin?id:null;
}

export async function PATCH(request:Request,{params}:{params:Promise<{userId:string}>}){
  try{
    if(!await requirePrimaryAdmin())return fail("No tienes permiso para editar usuarios.",403);
    const{userId}=await params,body=await request.json() as Record<string,unknown>;
    const fullName=String(body.fullName||"").trim(),username=normalizeUsername(String(body.username||"")),role=String(body.role||"Usuario").trim(),pin=String(body.pin||""),permissions=sanitizePermissions(body.permissions),active=body.active!==false,contactEmail=String(body.email||"").trim()||null;
    if(fullName.length<3||fullName.length>120)return fail("El nombre no es válido.");
    if(!/^[a-z0-9._-]{3,40}$/.test(username))return fail("El nombre de usuario no es válido.");
    if(pin&&(pin.length<6||pin.length>72))return fail("Utilice una contraseña de al menos 6 caracteres.");
    if(!VALID_ROLES.has(role))return fail("El rol seleccionado no es válido.");
    const targetResponse=await supabaseAdminFetch(`/rest/v1/profiles?select=id,username,is_primary_admin&id=eq.${encodeURIComponent(userId)}&limit=1`,{headers:{Accept:"application/json"}});
    if(!targetResponse.ok)return fail("No se pudo consultar el usuario.",503);
    const targets=await targetResponse.json() as Array<{id:string;username:string;is_primary_admin:boolean}>,target=targets[0];
    if(!target)return fail("No se encontró el usuario.",404);
    if(target.is_primary_admin&&!active)return fail("El Administrador Principal no puede desactivarse.");
    if(username!==target.username&&!pin)return fail("Para cambiar el username debes asignar también un PIN nuevo.");
    const duplicate=await supabaseAdminFetch(`/rest/v1/profiles?select=id&username=eq.${encodeURIComponent(username)}&id=neq.${encodeURIComponent(userId)}&limit=1`,{headers:{Accept:"application/json"}});
    if(!duplicate.ok)return fail("No se pudo comprobar el username.",503);
    if((await duplicate.json() as unknown[]).length)return fail("Ese nombre de usuario ya está en uso.",409);
    if(pin||username!==target.username){
      const authUpdate=await supabaseAdminFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`,{method:"PUT",body:JSON.stringify({email:`${username}@asha.invalid`,...(pin?{password:deriveInternalPassword(username,pin)}:{}),email_confirm:true,user_metadata:{asha_internal_user:true,asha_username:username,full_name:fullName}})});
      if(!authUpdate.ok)return fail("No se pudieron actualizar las credenciales.",502);
    }
    const profileUpdate=await supabaseAdminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({full_name:fullName,username,role,initials:initialsFromName(fullName),is_active:target.is_primary_admin?true:active,contact_email:contactEmail})});
    if(!profileUpdate.ok)return fail("No se pudo actualizar el perfil.",502);
    if(!target.is_primary_admin){
      const deleted=await supabaseAdminFetch(`/rest/v1/user_permissions?user_id=eq.${encodeURIComponent(userId)}`,{method:"DELETE"});
      if(!deleted.ok)return fail("No se pudieron reemplazar los permisos.",502);
      if(permissions.length){const inserted=await supabaseAdminFetch("/rest/v1/user_permissions",{method:"POST",body:JSON.stringify(permissions.map(module=>({user_id:userId,module,allowed:true})))});if(!inserted.ok)return fail("No se pudieron guardar los permisos.",502)}
    }
    return NextResponse.json({ok:true,user:{id:userId,fullName,username,role,active:target.is_primary_admin?true:active,isPrimaryAdmin:target.is_primary_admin,permissions:target.is_primary_admin?sanitizePermissions(["Resumen","Pacientes","Historias clínicas","Agenda","Servicios","Productos","Caja y cobros","Movimientos","Contabilidad","Usuarios","Configuración"]):permissions,email:contactEmail}},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("ASHA user update error",error);return fail("No se pudo actualizar el usuario.",503)}
}
