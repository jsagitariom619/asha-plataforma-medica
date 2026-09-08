"use client";

import { runtimeStore } from "@/lib/client/runtime-store";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarDays,
  Camera,
  ImagePlus,
  Save,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";

type Patient = {
  id: number;
  name: string;
  code?: string;
  age?: number;
  phone?: string;
};
type HistoryRecord = {
  id: number;
  createdAt: string;
  patient: string;
  patientCode: string;
  data: Record<string, string | string[]>;
};
const HISTORY_KEY = "asha-aesthetic-histories-v1";
const BOLIVIA_TZ = "America/La_Paz";

function readPatients(): Patient[] {
  try {
    const data = JSON.parse(runtimeStore.getItem("asha-demo") || "null");
    return Array.isArray(data?.patients) ? data.patients : [];
  } catch {
    return [];
  }
}
function readHistories(): HistoryRecord[] {
  try {
    const rows = JSON.parse(runtimeStore.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}
function writeHistories(rows: HistoryRecord[]) {
  runtimeStore.setItem(HISTORY_KEY, JSON.stringify(rows));
}
const formText = (form: FormData, key: string) =>
  String(form.get(key) || "").trim();
const todayBolivia = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOLIVIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};
async function preparePhoto(file: File) {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error());
    reader.readAsDataURL(file);
  });
  return await new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const max = 1280,
        scale = Math.min(1, max / Math.max(image.width, image.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error());
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => reject(new Error());
    image.src = source;
  });
}
export function ClinicalRecordActionsCompat() {
  const [open, setOpen] = useState(false),
    [patient, setPatient] = useState(""),
    [patients, setPatients] = useState<Patient[]>([]),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(""),
    [beforePhoto, setBeforePhoto] = useState(""),
    [afterPhoto, setAfterPhoto] = useState("");
  useEffect(() => {
    const onTreatment = (event: Event) => {
      const name =
        (event as CustomEvent<{ patient?: string }>).detail?.patient || "";
      if (!name) return;
      setPatients(readPatients());
      setPatient(name);
      setBeforePhoto("");
      setAfterPhoto("");
      setSaved(false);
      setError("");
      setOpen(true);
    };
    window.addEventListener("asha-new-treatment", onTreatment as EventListener);
    return () =>
      window.removeEventListener(
        "asha-new-treatment",
        onTreatment as EventListener,
      );
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const patientInfo = useMemo(
    () => patients.find((item) => item.name === patient),
    [patients, patient],
  );
  if (!open) return null;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget),
      nextControl = formText(form, "nextControl"),
      nextControlTime = formText(form, "nextControlTime");
    try {
      const now = Date.now();
      const treatment: HistoryRecord = {
        id: now,
        createdAt: new Date().toISOString(),
        patient,
        patientCode: patientInfo?.code || "",
        data: {
          recordType: "treatment",
          treatmentStatus:
            formText(form, "treatmentStatus") || "En tratamiento",
          consultationDate: formText(form, "consultationDate"),
          professional: formText(form, "professional"),
          procedure: formText(form, "procedure"),
          areas: formText(form, "areas"),
          diagnosis: formText(form, "diagnosis"),
          objectives: formText(form, "objectives"),
          treatmentPlan: formText(form, "treatmentPlan"),
          product: formText(form, "product"),
          brand: formText(form, "brand"),
          lot: formText(form, "lot"),
          expiration: formText(form, "expiration"),
          amount: formText(form, "amount"),
          technique: formText(form, "technique"),
          postCare: formText(form, "postCare"),
          nextControl,
          nextControlTime,
          finalNotes: formText(form, "finalNotes"),
          beforePhoto,
          afterPhoto,
        },
      };
      writeHistories([treatment, ...readHistories()]);
      if (nextControl) {
        const stored =
            JSON.parse(runtimeStore.getItem("asha-demo") || "null") || {},
          appointments = Array.isArray(stored.appointments)
            ? stored.appointments
            : [];
        runtimeStore.setItem(
          "asha-demo",
          JSON.stringify({
            ...stored,
            appointments: [
              {
                id: now + 1,
                date: nextControl,
                time: nextControlTime || "—",
                patient,
                service: `Control · ${formText(form, "procedure") || "Tratamiento estético"}`,
                status: "Pendiente",
              },
              ...appointments,
            ],
          }),
        );
      }
      setSaved(true);
      window.dispatchEvent(
        new CustomEvent("asha-clinical-completed", { detail: { patient } }),
      );
      setTimeout(() => setOpen(false), 750);
    } catch {
      setError("No se pudo guardar el tratamiento.");
    }
  };
  return (
    <div
      className="clinical-action-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        className="clinical-action-dialog"
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div>
            <span>
              <Stethoscope />
            </span>
            <div>
              <small>{patientInfo?.code || "EXPEDIENTE CLÍNICO"}</small>
              <h2>Nuevo tratamiento</h2>
              <p>{patient}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
        </header>
        <form className="clinical-action-form" onSubmit={submit}>
          <p className="clinical-action-note">
            Registra un tratamiento dentro del mismo expediente. No crea una
            nueva historia clínica.
          </p>
          <Block title="Identificación del tratamiento">
            <div className="clinical-action-grid three">
              <Field label="Fecha">
                <input
                  name="consultationDate"
                  type="date"
                  defaultValue={todayBolivia()}
                />
              </Field>
              <Field label="Profesional">
                <input name="professional" />
              </Field>
              <Field label="Estado">
                <select name="treatmentStatus" defaultValue="En tratamiento">
                  <option>Planificado</option>
                  <option>En tratamiento</option>
                  <option>En seguimiento</option>
                  <option>Finalizado</option>
                </select>
              </Field>
              <Field label="Tratamiento / procedimiento">
                <input name="procedure" />
              </Field>
              <Field label="Zona(s)">
                <input name="areas" />
              </Field>
              <Field label="Diagnóstico / indicación">
                <input name="diagnosis" />
              </Field>
            </div>
            <Grid>
              <Field label="Objetivos">
                <textarea name="objectives" />
              </Field>
              <Field label="Plan y número de sesiones">
                <textarea name="treatmentPlan" />
              </Field>
            </Grid>
          </Block>
          <Block title="Trazabilidad">
            <div className="clinical-action-grid three">
              <Field label="Producto / dispositivo">
                <input name="product" />
              </Field>
              <Field label="Marca">
                <input name="brand" />
              </Field>
              <Field label="Lote">
                <input name="lot" />
              </Field>
              <Field label="Vencimiento">
                <input name="expiration" type="date" />
              </Field>
              <Field label="Cantidad / unidades">
                <input name="amount" />
              </Field>
            </div>
            <Grid>
              <Field label="Técnica">
                <textarea name="technique" />
              </Field>
              <Field label="Indicaciones posteriores">
                <textarea name="postCare" />
              </Field>
              <Field label="Observaciones">
                <textarea name="finalNotes" />
              </Field>
            </Grid>
          </Block>
          <Block title="Fotografías y seguimiento">
            <PhotoPair
              beforePhoto={beforePhoto}
              afterPhoto={afterPhoto}
              setBeforePhoto={setBeforePhoto}
              setAfterPhoto={setAfterPhoto}
            />
            <div className="clinical-treatment-followup">
              <CalendarDays />
              <div className="clinical-action-grid two">
                <Field label="Próximo control">
                  <input name="nextControl" type="date" />
                </Field>
                <Field label="Hora">
                  <input name="nextControlTime" type="time" />
                </Field>
              </div>
            </div>
          </Block>
          <footer className="clinical-action-actions">
            <span>
              {error ||
                (saved
                  ? "Tratamiento guardado correctamente"
                  : "Puedes dejar campos vacíos.")}
            </span>
            <button className="clinical-action-primary" type="submit">
              <Save />
              Guardar tratamiento
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function PhotoPair({
  beforePhoto,
  afterPhoto,
  setBeforePhoto,
  setAfterPhoto,
}: {
  beforePhoto: string;
  afterPhoto: string;
  setBeforePhoto: (v: string) => void;
  setAfterPhoto: (v: string) => void;
}) {
  return (
    <div className="clinical-photo-pair">
      <PhotoSlot label="Antes" value={beforePhoto} onChange={setBeforePhoto} />
      <PhotoSlot label="Después" value={afterPhoto} onChange={setAfterPhoto} />
    </div>
  );
}
function PhotoSlot({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const gallery = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null),
    [busy, setBusy] = useState(false);
  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      onChange(await preparePhoto(file));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="clinical-photo-card">
      <div>
        <b>{label}</b>
        {value && (
          <button type="button" onClick={() => onChange("")}>
            <Trash2 />
            Quitar
          </button>
        )}
      </div>
      <div
        className={
          value ? "clinical-photo-preview filled" : "clinical-photo-preview"
        }
      >
        {value ? (
          <img src={value} alt={`Fotografía ${label.toLowerCase()}`} />
        ) : (
          <>
            <ImagePlus />
            <small>Sin fotografía</small>
          </>
        )}
      </div>
      <div className="clinical-photo-buttons">
        <button
          type="button"
          disabled={busy}
          onClick={() => gallery.current?.click()}
        >
          <ImagePlus />
          Elegir
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => camera.current?.click()}
        >
          <Camera />
          Tomar foto
        </button>
      </div>
      <input
        ref={gallery}
        hidden
        type="file"
        accept="image/*"
        onChange={choose}
      />
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/*"
        capture="environment"
        onChange={choose}
      />
    </div>
  );
}
function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="clinical-action-block">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="clinical-action-grid two">{children}</div>;
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="clinical-action-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
