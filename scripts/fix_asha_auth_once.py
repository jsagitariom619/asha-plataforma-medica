from pathlib import Path

path = Path("app/page.tsx")
text = path.read_text()

old_merge = '''const mergeCloudUser = (source: User[], cloudUser: CloudUser) => {
  const matchIndex = cloudUser.isPrimaryAdmin
    ? 0
    : source.findIndex(
        (user) =>
          normalizeUsername(user.username || "") ===
          normalizeUsername(cloudUser.username),
      );'''
new_merge = '''const mergeCloudUser = (source: User[], cloudUser: CloudUser) => {
  const matchIndex = source.findIndex(
    (user) =>
      user.cloudId === cloudUser.id ||
      normalizeUsername(user.username || "") ===
        normalizeUsername(cloudUser.username),
  );'''
if old_merge not in text:
    raise SystemExit("mergeCloudUser pattern not found")
text = text.replace(old_merge, new_merge, 1)

old_init = '''        setUsers(merged.users);
        setCurrentUserId(merged.userId);
        setProfessionalName(cloudUser.fullName);
        const stateResponse=await fetch("/api/clinic-state",{credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"}});'''
new_init = '''        setUsers(merged.users);
        setCurrentUserId(merged.userId);
        setProfessionalName(cloudUser.fullName);
        setHydrated(true);
        setAuthReady(true);
        setBootstrapState("configured");
        const stateResponse=await fetch("/api/clinic-state",{credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"}});'''
if old_init not in text:
    raise SystemExit("initialize pattern not found")
text = text.replace(old_init, new_init, 1)

old_login = '''      const cloudUser=data.user as CloudUser,merged=mergeCloudUser([],cloudUser);setUsers(merged.users);setCurrentUserId(merged.userId);setProfessionalName(cloudUser.fullName);
      const stateResponse=await fetch("/api/clinic-state",{credentials:"same-origin",cache:"no-store"}),stateData=await stateResponse.json().catch(()=>({}));
      if(!stateResponse.ok||stateData?.ok!==true)return typeof stateData?.error==="string"?stateData.error:"No se pudo cargar la información.";
      const state=stateData.state&&typeof stateData.state==="object"?stateData.state as Record<string,unknown>:{};
      setPatients(Array.isArray(state.patients)?state.patients as Patient[]:[]);setServices(Array.isArray(state.services)?state.services as Service[]:[]);setProducts(Array.isArray(state.products)?state.products as Product[]:[]);setTxs(Array.isArray(state.txs)?state.txs as Tx[]:[]);setAppointments(Array.isArray(state.appointments)?state.appointments as Appointment[]:[]);setAttentions(Array.isArray(state.attentions)?state.attentions as Attention[]:[]);primeRuntimeState(state);setCloudReady(true);setBootstrapState("configured");return "";'''
new_login = '''      const cloudUser=data.user as CloudUser,merged=mergeCloudUser([],cloudUser);
      setUsers(merged.users);setCurrentUserId(merged.userId);setProfessionalName(cloudUser.fullName);setHydrated(true);setBootstrapState("configured");setCloudReady(false);
      void (async()=>{
        try{
          const stateResponse=await fetch("/api/clinic-state",{credentials:"same-origin",cache:"no-store"}),stateData=await stateResponse.json().catch(()=>({}));
          if(!stateResponse.ok||stateData?.ok!==true)throw new Error(typeof stateData?.error==="string"?stateData.error:"No se pudo cargar la información de Supabase.");
          const state=stateData.state&&typeof stateData.state==="object"?stateData.state as Record<string,unknown>:{};
          setPatients(Array.isArray(state.patients)?state.patients as Patient[]:[]);setServices(Array.isArray(state.services)?state.services as Service[]:[]);setProducts(Array.isArray(state.products)?state.products as Product[]:[]);setTxs(Array.isArray(state.txs)?state.txs as Tx[]:[]);setAppointments(Array.isArray(state.appointments)?state.appointments as Appointment[]:[]);setAttentions(Array.isArray(state.attentions)?state.attentions as Attention[]:[]);if(typeof state.professionalName==="string"&&state.professionalName.trim())setProfessionalName(state.professionalName);primeRuntimeState(state);setCloudReady(true);
        }catch(error){setFlash(error instanceof Error?error.message:"No se pudo cargar la información de Supabase.")}
      })();
      return "";'''
if old_login not in text:
    raise SystemExit("login pattern not found")
text = text.replace(old_login, new_login, 1)

path.write_text(text)
print("ASHA authentication patch applied")
