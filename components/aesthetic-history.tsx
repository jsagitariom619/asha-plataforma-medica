"use client";

import {ChangeEvent,FormEvent,useEffect,useMemo,useRef,useState} from "react";
import {CalendarDays,Camera,FileHeart,ImagePlus,Save,Trash2,X} from "lucide-react";

type Patient={id:number;name:string;code?:string;age?:number;phone?:string};
type HistoryRecord={id:number;createdAt:string;patient:string;patientCode:string;data:Record<string,string|string[]>};
type Appointment={id:number;date:string;time:string;patient:string;service:string;status:string};

const STORAGE_KEY="asha-aesthetic-histories-v1";
const relevantHistory=[
  ["allergies","Alergias conocidas"],["anticoagulants","Anticoagulantes / antiagregantes"],["autoimmune","Enfermedad autoinmune"],
  ["immunosuppression","Inmunosupresión"],["herpes","Antecedente de herpes simple"],["keloids","Queloides / cicatrización hipertrófica"],
  ["pregnancy","Embarazo / lactancia"],["isotretinoin","Uso reciente de isotretinoína"],["infection","Infección activa / lesión cutánea"],
  ["implants","Implantes, prótesis o dispositivos"],["oncology","Antecedente oncológico"],["neuromuscular","Enfermedad neuromuscular"]
] as const;

function readPatients():Patient[]{try{const data=JSON.parse(localStorage.getItem("asha-demo")||"null");return Array.isArray(data?.patients)?data.patients:[]}catch{return[]}}
function readHistories():HistoryRecord[]{try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");return Array.isArray(value)?value:[]}catch{return[]}}
const text=(form:FormData,name:string)=>String(form.get(name)||"").trim();

async function preparePhoto(file:File){
  const source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(new Error("No se pudo leer la imagen."));reader.readAsDataURL(file)});
  return await new Promise<string>((resolve,reject)=>{const image=new Image();image.onload=()=>{const max=1280,scale=Math.min(1,max/Math.max(image.width,image.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext("2d");if(!ctx){reject(new Error("No se pudo procesar la imagen."));return}ctx.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.78))};image.onerror=()=>reject(new Error("Formato de imagen no compatible."));image.src=source});
}

function addFollowUpToAgenda(appointment:Appointment){
  try{
    const data=JSON.parse(localStorage.getItem("asha-demo")||"null")||{};
    const appointments:Array<Appointment>=Array.isArray(data.appointments)?data.appointments:[];
    const duplicate=appointments.some(item=>item.date===appointment.date&&item.time===appointment.time&&item.patient===appointment.patient&&item.service===appointment.service);
    if(!duplicate)localStorage.setItem("asha-demo",JSON.stringify({...data,appointments:[appointment,...appointments]}));
  }catch{}
}

export function AestheticHistoryCompat(){
  const[open,setOpen]=useState(false),[patients,setPatients]=useState<Patient[]>([]),[preselected,setPreselected]=useState(""),[saved,setSaved]=useState(false),[saveError,setSaveError]=useState("");
  const[beforePhoto,setBeforePhoto]=useState(""),[afterPhoto,setAfterPhoto]=useState("");
  useEffect(()=>{
    const onClick=(event:MouseEvent)=>{const target=event.target as HTMLElement|null,button=target?.closest("button");if(!button)return;const label=(button.textContent||"").replace(/\s+/g," ").trim();if(label!=="Nueva historia"&&label!=="Registrar evolución")return;event.preventDefault();event.stopPropagation();let patient="";if(label==="Registrar evolución")patient=button.closest("article")?.querySelector("h3")?.textContent?.trim()||"";setPatients(readPatients());setPreselected(patient);setBeforePhoto("");setAfterPhoto("");setSaved(false);setSaveError("");setOpen(true)};
    document.addEventListener("click",onClick,true);return()=>document.removeEventListener("click",onClick,true);
  },[]);
  useEffect(()=>{if(!open)return;const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey)},[open]);
  const selectedPatient=useMemo(()=>patients.find(p=>p.name===preselected),[patients,preselected]);
  if(!open)return null;

  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSaveError("");const form=new FormData(event.currentTarget),patient=text(form,"patient"),patientInfo=patients.find(p=>p.name===patient),checks=relevantHistory.filter(([key])=>form.get(key)==="on").map(([,label])=>label),nextControl=text(form,"nextControl"),nextControlTime=text(form,"nextControlTime");
    const data:Record<string,string|string[]>={
      consultationDate:text(form,"consultationDate"),professional:text(form,"professional"),reason:text(form,"reason"),expectations:text(form,"expectations"),
      pathological:text(form,"pathological"),surgical:text(form,"surgical"),hospitalizations:text(form,"hospitalizations"),medications:text(form,"medications"),allergyDetail:text(form,"allergyDetail"),
      gynecologic:text(form,"gynecologic"),habits:text(form,"habits"),sunExposure:text(form,"sunExposure"),relevantHistory:checks,otherRelevant:text(form,"otherRelevant"),
      priorAesthetic:text(form,"priorAesthetic"),priorBotulinum:text(form,"priorBotulinum"),priorFillers:text(form,"priorFillers"),priorBiostimulators:text(form,"priorBiostimulators"),priorDevices:text(form,"priorDevices"),priorComplications:text(form,"priorComplications"),
      bloodPressure:text(form,"bloodPressure"),heartRate:text(form,"heartRate"),weight:text(form,"weight"),height:text(form,"height"),
      fitzpatrick:text(form,"fitzpatrick"),glogau:text(form,"glogau"),skinType:text(form,"skinType"),skinFindings:text(form,"skinFindings"),facialAnalysis:text(form,"facialAnalysis"),bodyAnalysis:text(form,"bodyAnalysis"),photographicNotes:text(form,"photographicNotes"),
      assessment:text(form,"assessment"),diagnosis:text(form,"diagnosis"),objectives:text(form,"objectives"),treatmentPlan:text(form,"treatmentPlan"),alternatives:text(form,"alternatives"),
      procedure:text(form,"procedure"),areas:text(form,"areas"),product:text(form,"product"),brand:text(form,"brand"),lot:text(form,"lot"),expiration:text(form,"expiration"),amount:text(form,"amount"),dilution:text(form,"dilution"),anesthesia:text(form,"anesthesia"),technique:text(form,"technique"),deviceParameters:text(form,"deviceParameters"),procedureIncidents:text(form,"procedureIncidents"),
      informedConsent:text(form,"informedConsent"),photoAuthorization:text(form,"photoAuthorization"),postCare:text(form,"postCare"),evolution:text(form,"evolution"),adverseEvents:text(form,"adverseEvents"),nextControl,nextControlTime,finalNotes:text(form,"finalNotes"),beforePhoto,afterPhoto
    };
    const record:HistoryRecord={id:Date.now(),createdAt:new Date().toISOString(),patient,patientCode:patientInfo?.code||"",data};
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify([record,...readHistories()]));
      if(nextControl)addFollowUpToAgenda({id:Date.now()+1,date:nextControl,time:nextControlTime||"—",patient:patient||"Paciente sin seleccionar",service:"Control de medicina estética",status:"Pendiente"});
      setSaved(true);setTimeout(()=>setOpen(false),850);
    }catch{setSaveError("No se pudo guardar la historia. Las fotografías pueden superar el espacio disponible del dispositivo; prueba con imágenes más pequeñas.")}
  };

  return <div className="aesthetic-history-layer" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
    <section className="aesthetic-history-dialog" role="dialog" aria-modal="true" aria-labelledby="aesthetic-history-title">
      <header className="aesthetic-history-header"><div><span className="aesthetic-history-icon"><FileHeart/></span><div><h2 id="aesthetic-history-title">Historia clínica de medicina estética</h2><p>Registro clínico integral. Ningún campo es obligatorio.</p></div></div><button type="button" aria-label="Cerrar" onClick={()=>setOpen(false)}><X/></button></header>
      <form className="aesthetic-history-form" onSubmit={submit}>
        <HistorySection title="1. Identificación y consulta" text="Datos del encuentro clínico y motivo de atención.">
          <div className="history-grid history-grid-3"><HistoryField label="Paciente"><select name="patient" defaultValue={preselected}><option value="">Sin seleccionar</option>{patients.map(p=><option key={p.id} value={p.name}>{p.name}{p.code?` · ${p.code}`:""}</option>)}</select></HistoryField><HistoryField label="Fecha de consulta"><input name="consultationDate" type="date" defaultValue={new Date().toISOString().slice(0,10)}/></HistoryField><HistoryField label="Profesional tratante"><input name="professional" placeholder="Nombre del profesional"/></HistoryField></div>
          {selectedPatient&&<p className="history-patient-note">{selectedPatient.code||"Sin código"}{selectedPatient.age?` · ${selectedPatient.age} años`:""}{selectedPatient.phone?` · ${selectedPatient.phone}`:""}</p>}
          <div className="history-grid"><HistoryField label="Motivo de consulta"><textarea name="reason" rows={3} placeholder="Motivo principal, zonas de interés, percepción del paciente…"/></HistoryField><HistoryField label="Expectativas y objetivos del paciente"><textarea name="expectations" rows={3} placeholder="Resultado esperado, prioridades, expectativas realistas…"/></HistoryField></div>
        </HistorySection>

        <HistorySection title="2. Antecedentes médicos y factores de riesgo" text="Antecedentes relevantes para procedimientos estéticos y seguridad del paciente.">
          <div className="history-grid"><HistoryField label="Antecedentes patológicos"><textarea name="pathological" rows={3}/></HistoryField><HistoryField label="Antecedentes quirúrgicos"><textarea name="surgical" rows={3}/></HistoryField><HistoryField label="Hospitalizaciones / procedimientos previos"><textarea name="hospitalizations" rows={3}/></HistoryField><HistoryField label="Medicamentos y suplementos actuales"><textarea name="medications" rows={3}/></HistoryField><HistoryField label="Alergias: detalle"><textarea name="allergyDetail" rows={3}/></HistoryField><HistoryField label="Antecedentes gineco-obstétricos, si aplica"><textarea name="gynecologic" rows={3} placeholder="Gestación, lactancia, anticoncepción, menopausia…"/></HistoryField><HistoryField label="Hábitos"><textarea name="habits" rows={3} placeholder="Tabaco, alcohol, sueño, actividad física…"/></HistoryField><HistoryField label="Exposición solar y fotoprotección"><textarea name="sunExposure" rows={3}/></HistoryField></div>
          <div className="history-checks">{relevantHistory.map(([key,label])=><label key={key}><input type="checkbox" name={key}/><span>{label}</span></label>)}</div><HistoryField label="Otros antecedentes relevantes"><textarea name="otherRelevant" rows={3}/></HistoryField>
        </HistorySection>

        <HistorySection title="3. Antecedentes estéticos" text="Procedimientos previos, respuesta clínica y posibles complicaciones.">
          <div className="history-grid"><HistoryField label="Tratamientos estéticos previos"><textarea name="priorAesthetic" rows={3}/></HistoryField><HistoryField label="Toxina botulínica"><textarea name="priorBotulinum" rows={3} placeholder="Fecha, zonas, respuesta, duración…"/></HistoryField><HistoryField label="Rellenos / ácido hialurónico"><textarea name="priorFillers" rows={3} placeholder="Producto, zona, fecha, complicaciones…"/></HistoryField><HistoryField label="Bioestimuladores / hilos"><textarea name="priorBiostimulators" rows={3}/></HistoryField><HistoryField label="Láser, IPL, radiofrecuencia, ultrasonido, peelings"><textarea name="priorDevices" rows={3}/></HistoryField><HistoryField label="Reacciones o complicaciones previas"><textarea name="priorComplications" rows={3}/></HistoryField></div>
        </HistorySection>

        <HistorySection title="4. Evaluación clínica estética" text="Exploración general, cutánea, facial y corporal según corresponda.">
          <div className="history-grid history-grid-4"><HistoryField label="Presión arterial"><input name="bloodPressure" placeholder="Ej. 120/80 mmHg"/></HistoryField><HistoryField label="Frecuencia cardiaca"><input name="heartRate" placeholder="lpm"/></HistoryField><HistoryField label="Peso"><input name="weight" placeholder="kg"/></HistoryField><HistoryField label="Talla"><input name="height" placeholder="cm"/></HistoryField></div>
          <div className="history-grid history-grid-3"><HistoryField label="Fototipo Fitzpatrick"><select name="fitzpatrick" defaultValue=""><option value="">No registrado</option>{["I","II","III","IV","V","VI"].map(v=><option key={v}>{v}</option>)}</select></HistoryField><HistoryField label="Clasificación de Glogau"><select name="glogau" defaultValue=""><option value="">No registrado</option><option>I · Leve</option><option>II · Moderado</option><option>III · Avanzado</option><option>IV · Severo</option></select></HistoryField><HistoryField label="Tipo / condición de piel"><input name="skinType" placeholder="Seca, grasa, mixta, sensible, deshidratada…"/></HistoryField></div>
          <div className="history-grid"><HistoryField label="Hallazgos cutáneos"><textarea name="skinFindings" rows={4} placeholder="Textura, hidratación, poros, pigmentación, vascularidad, acné, cicatrices, lesiones…"/></HistoryField><HistoryField label="Análisis facial"><textarea name="facialAnalysis" rows={4} placeholder="Simetría, proporciones, tercios, perfil, arrugas dinámicas/estáticas, flacidez, ptosis, pérdida de volumen…"/></HistoryField><HistoryField label="Análisis corporal, si aplica"><textarea name="bodyAnalysis" rows={4} placeholder="Adiposidad localizada, flacidez, celulitis, estrías, calidad cutánea, zonas…"/></HistoryField><HistoryField label="Registro fotográfico / observaciones"><textarea name="photographicNotes" rows={4} placeholder="Vistas tomadas, condiciones de iluminación, observaciones del registro…"/></HistoryField></div>
        </HistorySection>

        <HistorySection title="5. Impresión clínica y planificación" text="Valoración médica, objetivos terapéuticos y estrategia propuesta.">
          <div className="history-grid"><HistoryField label="Valoración estética integral"><textarea name="assessment" rows={4}/></HistoryField><HistoryField label="Diagnóstico / impresión diagnóstica"><textarea name="diagnosis" rows={4}/></HistoryField><HistoryField label="Objetivos terapéuticos"><textarea name="objectives" rows={4}/></HistoryField><HistoryField label="Plan de tratamiento"><textarea name="treatmentPlan" rows={4} placeholder="Procedimientos sugeridos, secuencia, sesiones, intervalos…"/></HistoryField><HistoryField label="Alternativas explicadas"><textarea name="alternatives" rows={3}/></HistoryField></div>
        </HistorySection>

        <HistorySection title="6. Registro del procedimiento realizado" text="Trazabilidad técnica del tratamiento cuando se realiza un procedimiento.">
          <div className="history-grid history-grid-3"><HistoryField label="Procedimiento"><input name="procedure"/></HistoryField><HistoryField label="Zona(s) tratada(s)"><input name="areas"/></HistoryField><HistoryField label="Producto / dispositivo"><input name="product"/></HistoryField><HistoryField label="Marca / fabricante"><input name="brand"/></HistoryField><HistoryField label="Lote"><input name="lot"/></HistoryField><HistoryField label="Vencimiento"><input name="expiration" type="date"/></HistoryField><HistoryField label="Cantidad / volumen / unidades"><input name="amount"/></HistoryField><HistoryField label="Dilución / preparación"><input name="dilution"/></HistoryField><HistoryField label="Anestesia / analgesia"><input name="anesthesia"/></HistoryField></div>
          <div className="history-grid"><HistoryField label="Técnica y puntos de aplicación"><textarea name="technique" rows={4}/></HistoryField><HistoryField label="Parámetros del equipo, si aplica"><textarea name="deviceParameters" rows={4} placeholder="Energía, potencia, frecuencia, profundidad, número de disparos/pases…"/></HistoryField><HistoryField label="Incidentes durante el procedimiento"><textarea name="procedureIncidents" rows={3}/></HistoryField></div>
        </HistorySection>

        <HistorySection title="7. Consentimientos, indicaciones y seguimiento" text="Registro documental de la información brindada y evolución posterior.">
          <div className="history-grid history-grid-2"><HistoryField label="Consentimiento informado"><select name="informedConsent" defaultValue=""><option value="">No registrado</option><option>Firmado</option><option>Explicado / pendiente de firma</option><option>No aplica</option></select></HistoryField><HistoryField label="Autorización para fotografías"><select name="photoAuthorization" defaultValue=""><option value="">No registrado</option><option>Autorizada para historia clínica</option><option>Autorizada para uso científico / educativo</option><option>No autorizada</option></select></HistoryField></div>
          <div className="history-grid"><HistoryField label="Indicaciones posteriores"><textarea name="postCare" rows={4}/></HistoryField><HistoryField label="Evolución / respuesta al tratamiento"><textarea name="evolution" rows={4}/></HistoryField><HistoryField label="Eventos adversos / complicaciones"><textarea name="adverseEvents" rows={4}/></HistoryField><div className="history-followup"><div className="history-followup-title"><CalendarDays/><div><b>Próximo control</b><small>La fecha se registra también en la Agenda de ASHA.</small></div></div><div className="history-grid history-grid-2"><HistoryField label="Fecha"><input name="nextControl" type="date"/></HistoryField><HistoryField label="Hora (opcional)"><input name="nextControlTime" type="time"/></HistoryField></div></div></div>
          <HistoryField label="Observaciones finales"><textarea name="finalNotes" rows={4}/></HistoryField>
          <div className="history-photo-title"><div><ImagePlus/><span><b>Registro fotográfico antes y después</b><small>Agrega fotografías desde el dispositivo o toma una foto directamente.</small></span></div></div>
          <div className="history-photo-grid"><PhotoSlot label="Antes" value={beforePhoto} onChange={setBeforePhoto}/><PhotoSlot label="Después" value={afterPhoto} onChange={setAfterPhoto}/></div>
        </HistorySection>

        <footer className="aesthetic-history-actions"><span>{saveError|| (saved?"Historia guardada correctamente":"Puedes guardar la historia aunque existan campos vacíos.")}</span><button type="button" className="history-secondary" onClick={()=>setOpen(false)}>Cancelar</button><button type="submit" className="history-primary"><Save/>Guardar historia</button></footer>
      </form>
    </section>
  </div>
}

function PhotoSlot({label,value,onChange}:{label:string;value:string;onChange:(value:string)=>void}){
  const galleryRef=useRef<HTMLInputElement>(null),cameraRef=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const choose=async(event:ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;setBusy(true);setError("");try{onChange(await preparePhoto(file))}catch{setError("No se pudo cargar la imagen.")}finally{setBusy(false)}};
  return <div className="history-photo-card"><div className="history-photo-card-head"><b>{label}</b>{value&&<button type="button" onClick={()=>onChange("")}><Trash2/>Quitar</button>}</div><div className={value?"history-photo-preview has-photo":"history-photo-preview"}>{value?<img src={value} alt={`Fotografía ${label.toLowerCase()}`}/>:<><ImagePlus/><span>Sin fotografía</span></>}</div><div className="history-photo-actions"><button type="button" onClick={()=>galleryRef.current?.click()} disabled={busy}><ImagePlus/>{busy?"Procesando…":"Elegir imagen"}</button><button type="button" onClick={()=>cameraRef.current?.click()} disabled={busy}><Camera/>Tomar foto</button></div>{error&&<small className="history-photo-error">{error}</small>}<input ref={galleryRef} hidden type="file" accept="image/*" onChange={choose}/><input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={choose}/></div>
}
function HistorySection({title,text,children}:{title:string;text:string;children:React.ReactNode}){return <fieldset className="history-section"><legend>{title}</legend><p>{text}</p>{children}</fieldset>}
function HistoryField({label,children}:{label:string;children:React.ReactNode}){return <label className="history-field"><span>{label}</span>{children}</label>}
