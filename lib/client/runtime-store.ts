"use client";

type State=Record<string,unknown>;
const memory=new Map<string,string>();
let saveChain=Promise.resolve();

function persist(partial:State){
  saveChain=saveChain.then(async()=>{
    const response=await fetch("/api/clinic-state",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({state:partial})});
    if(!response.ok)throw new Error("No se pudo guardar en Supabase.");
  }).catch(error=>{window.dispatchEvent(new CustomEvent("asha-cloud-error",{detail:{message:error instanceof Error?error.message:"No se pudo guardar en Supabase."}}));});
  return saveChain;
}

export const runtimeStore={
  getItem(key:string){return memory.get(key)??null},
  setItem(key:string,value:string){
    memory.set(key,value);
    try{
      if(key==="asha-demo"){
        const parsed=JSON.parse(value) as State;
        const{users:_,...operational}=parsed;
        return persist(operational);
        window.dispatchEvent(new CustomEvent("asha-runtime-state",{detail:operational}));
      }else if(key==="asha-aesthetic-histories-v1"){
        const clinicalHistories=JSON.parse(value);
        return persist({clinicalHistories});
        window.dispatchEvent(new CustomEvent("asha-runtime-state",{detail:{clinicalHistories}}));
      }
    }catch{window.dispatchEvent(new CustomEvent("asha-cloud-error",{detail:{message:"No se pudo preparar el registro para Supabase."}}))}
    return Promise.resolve();
  },
  removeItem(key:string){memory.delete(key)},
  flush(){return saveChain},
};

export function primeRuntimeState(state:State){
  const{clinicalHistories=[],...main}=state;
  memory.set("asha-demo",JSON.stringify(main));
  memory.set("asha-aesthetic-histories-v1",JSON.stringify(clinicalHistories));
}
