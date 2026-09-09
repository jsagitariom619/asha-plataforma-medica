"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Bell,
  RefreshCw,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardPlus,
  Eye,
  EyeOff,
  FileHeart,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageOpen,
  Plus,
  Search,
  Settings,
  Stethoscope,
  Trash2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CashPanel,
  ExpensesPanel,
  MovementsPanel,
  ProductDialog,
  ProductsPanel,
} from "@/app/products";
import { AccountingPanel } from "@/app/accounting";
import { PatientBillingPanel } from "@/app/patient-billing";
import { primeRuntimeState } from "@/lib/client/runtime-store";

export type Patient = {
  id: number;
  name: string;
  code: string;
  age: number;
  phone: string;
  lastVisit: string;
  status: string;
};
export type Service = {
  id: number;
  name: string;
  category: string;
  price: number;
  duration: string;
  active: boolean;
};
export type Product = {
  id: number;
  name: string;
  description: string;
  salePrice: number;
  purchaseCost: number;
  initialStock: number;
  stock: number;
  image?: string;
  active: boolean;
  category?: string;
  code?: string;
  minimumStock?: number;
};
export type Tx = {
  id: number;
  concept: string;
  reference: string;
  type: "Ingreso" | "Egreso";
  amount: number;
  date: string;
  method: string;
  status?: "Pagado" | "Pendiente" | "Anulado";
  origin?:
    | "manual"
    | "cash"
    | "product-sale"
    | "product-purchase"
    | "patient-payment"
    | "patient-charge";
  operationId?: string;
  productId?: number;
  productName?: string;
  patientId?: number;
  attentionId?: number;
  quantity?: number;
  stockDelta?: number;
  unitPrice?: number;
  unitCost?: number;
  costAmount?: number;
  category?: string;
  createdAt?: string;
  note?: string;
};
type User = {
  id: number;
  cloudId?: string;
  name: string;
  role: string;
  initials: string;
  active: boolean;
  email?: string;
  permissions?: string[];
  username?: string;
  avatarUrl?: string;
  isPrimaryAdmin?: boolean;
};
type Appointment = {
  id: number;
  date: string;
  time: string;
  patient: string;
  service: string;
  status: string;
};
export type Attention = {
  id: number;
  patientId: number;
  patientName: string;
  date: string;
  createdAt: string;
  reason: string;
  notes: string;
  procedure: string;
  totalCost: number;
  status: "Atendido";
  appointmentId?: number;
};
type ProductAction = {
  kind: "new" | "edit" | "sell" | "restock" | "detail";
  product?: Product;
} | null;
type UserAction = { kind: "edit" | "permissions"; user: User } | null;
type CloudUser = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isPrimaryAdmin: boolean;
  permissions?: string[];
  avatarUrl?: string;
};
type NewUserPayload = {
  fullName: string;
  username: string;
  pin: string;
  role: string;
  active: boolean;
  permissions: string[];
};
type BootstrapState =
  | "checking"
  | "configured"
  | "unconfigured"
  | "unavailable";

const MODULES = [
  "Resumen",
  "Pacientes",
  "Historias clínicas",
  "Agenda",
  "Servicios",
  "Productos",
  "Egresos",
  "Caja y cobros",
  "Movimientos",
  "Contabilidad",
  "Usuarios",
  "Configuración",
];
const NON_ACCOUNTING_MODULES = MODULES.filter(
  (module) => module !== "Contabilidad",
);
const BOLIVIA_TZ = "America/La_Paz";
const defaultPermissions = (role: string) => {
  if (role.includes("Admin")) return [...NON_ACCOUNTING_MODULES];
  // Secondary users work operationally without managing master/configuration data.
  // Clinical history remains role-specific; Productos is available to sell.
  const operational = ["Resumen", "Pacientes", "Agenda", "Servicios", "Productos", "Egresos", "Caja y cobros"];
  if (role.includes("Médico")) return [...operational, "Historias clínicas"];
  return operational;
};
const userInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !/[.]$/.test(part))
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "US";
const normalizeUsername = (value: string) => value.trim().toLowerCase();
const cloudPermissions = (value: unknown) =>
  Array.isArray(value)
    ? MODULES.filter((module) => (value as unknown[]).includes(module))
    : null;
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const boliviaTodayKey = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOLIVIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};
const dateFromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const agendaDateLabel = (key: string) => {
  const value = new Intl.DateTimeFormat("es-BO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateFromKey(key));
  return value.charAt(0).toUpperCase() + value.slice(1);
};
const nav = [
  ["Resumen", LayoutDashboard],
  ["Pacientes", Users],
  ["Historias clínicas", FileHeart],
  ["Agenda", CalendarDays],
  ["Servicios", Stethoscope],
  ["Productos", PackageOpen],
  ["Egresos", ArrowDownRight],
  ["Caja y cobros", WalletCards],
  ["Movimientos", CircleDollarSign],
  ["Contabilidad", Banknote],
  ["Usuarios", Users],
  ["Configuración", Settings],
] as const;

export const money = (n: number) =>
  new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    maximumFractionDigits: 0,
  }).format(n);
const nowLabel = () =>
  new Intl.DateTimeFormat("es-BO", {
    timeZone: BOLIVIA_TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
const todayLabel = () => {
  const value = new Intl.DateTimeFormat("es-BO", {
    timeZone: BOLIVIA_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return value.charAt(0).toUpperCase() + value.slice(1);
};
const boliviaHour = () =>
  Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BOLIVIA_TZ,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
const mergeCloudUser = (source: User[], cloudUser: CloudUser) => {
  const matchIndex = source.findIndex(
    (user) =>
      user.cloudId === cloudUser.id ||
      normalizeUsername(user.username || "") ===
        normalizeUsername(cloudUser.username),
  );
  const nextId = Math.max(0, ...source.map((user) => user.id)) + 1;
  const base =
    matchIndex >= 0
      ? source[matchIndex]
      : {
          id: nextId,
          name: cloudUser.fullName,
          role: cloudUser.role,
          initials: userInitials(cloudUser.fullName),
          active: true,
          permissions: defaultPermissions(cloudUser.role),
        };
  const cloudPermissions = Array.isArray(cloudUser.permissions)
    ? MODULES.filter((module) => cloudUser.permissions?.includes(module))
    : null;
  const merged: User = {
    ...base,
    cloudId: cloudUser.id,
    name: cloudUser.fullName,
    role: cloudUser.role,
    initials: userInitials(cloudUser.fullName),
    active: true,
    username: normalizeUsername(cloudUser.username),
    avatarUrl: cloudUser.avatarUrl || undefined,
    isPrimaryAdmin: cloudUser.isPrimaryAdmin,
    permissions: cloudUser.isPrimaryAdmin
      ? [...MODULES]
      : (cloudPermissions ??
        base.permissions ??
        defaultPermissions(cloudUser.role)),
  };
  const users =
    matchIndex >= 0
      ? source.map((user, index) => (index === matchIndex ? merged : user))
      : [...source, merged];
  return { users, userId: merged.id };
};

export default function Home() {
  const [section, setSection] = useState("Resumen"),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState<string | null>(null),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    [patients, setPatients] = useState<Patient[]>([]),
    [services, setServices] = useState<Service[]>([]),
    [products, setProducts] = useState<Product[]>([]),
    [txs, setTxs] = useState<Tx[]>([]),
    [users, setUsers] = useState<User[]>([]),
    [appointments, setAppointments] = useState<Appointment[]>([]),
    [attentions, setAttentions] = useState<Attention[]>([]),
    [q, setQ] = useState("");
  const [productQuery, setProductQuery] = useState(""),
    [productFilter, setProductFilter] = useState("Todos"),
    [productAction, setProductAction] = useState<ProductAction>(null),
    [userAction, setUserAction] = useState<UserAction>(null),
    [editingService, setEditingService] = useState<Service | null>(null),
    [flash, setFlash] = useState("");
  const [professionalName, setProfessionalName] =
      useState("Profesional ASHA"),
    [hydrated, setHydrated] = useState(false),
    [authReady, setAuthReady] = useState(false),
    [currentUserId, setCurrentUserId] = useState<number | null>(null),
    [bootstrapState, setBootstrapState] = useState<BootstrapState>("configured"),
    [cloudReady, setCloudReady] = useState(false);
  const [greeting, setGreeting] = useState("Buenos días"),
    [dateLabel, setDateLabel] = useState(todayLabel()),
    [selectedAgendaDate, setSelectedAgendaDate] = useState(boliviaTodayKey()),
    [attentionPatientId, setAttentionPatientId] = useState<number | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const cloudUsersLoaded = useRef(false);
  const cloudSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled=false;
    const initialize=async()=>{
      try{
        const sessionResponse=await fetch("/api/asha-auth/session",{credentials:"same-origin",cache:"no-store"});
        const sessionData=await sessionResponse.json().catch(()=>({}));
        if(cancelled)return;
        if(!sessionResponse.ok||sessionData?.ok!==true||!sessionData.user){
          setHydrated(true);
          setCloudReady(false);
          return;
        }
        const cloudUser=sessionData.user as CloudUser;
        const merged=mergeCloudUser([],cloudUser);
        setUsers(merged.users);
        setCurrentUserId(merged.userId);
        setHydrated(true);
        setAuthReady(true);
        setBootstrapState("configured");
        const stateResponse=await fetch("/api/clinic-state",{credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"}});
        const stateData=await stateResponse.json().catch(()=>({}));
        if(cancelled)return;
        if(!stateResponse.ok||stateData?.ok!==true)throw new Error(typeof stateData?.error==="string"?stateData.error:"No se pudo cargar la información de Supabase.");
        const state=stateData.state&&typeof stateData.state==="object"?stateData.state as Record<string,unknown>:{};
        setPatients(Array.isArray(state.patients)?state.patients as Patient[]:[]);
        setServices(Array.isArray(state.services)?state.services as Service[]:[]);
        setProducts(Array.isArray(state.products)?state.products as Product[]:[]);
        setTxs(Array.isArray(state.txs)?state.txs as Tx[]:[]);
        setAppointments(Array.isArray(state.appointments)?state.appointments as Appointment[]:[]);
        setAttentions(Array.isArray(state.attentions)?state.attentions as Attention[]:[]);
        if(typeof state.professionalName==="string"&&state.professionalName.trim())setProfessionalName(state.professionalName);
        primeRuntimeState(state);
        setCloudReady(true);
        setHydrated(true);
      }catch(error){
        if(!cancelled){
          setBootstrapState("unavailable");
          setFlash(error instanceof Error?error.message:"No se pudo conectar con Supabase.");
          setHydrated(true);
        }
      }finally{if(!cancelled)setAuthReady(true)}
    };
    initialize();
    return()=>{cancelled=true};
  },[]);
  useEffect(()=>{
    const onState=(event:Event)=>{
      const patch=(event as CustomEvent<Record<string,unknown>>).detail||{};
      if(Array.isArray(patch.patients))setPatients(patch.patients as Patient[]);
      if(Array.isArray(patch.services))setServices(patch.services as Service[]);
      if(Array.isArray(patch.products))setProducts(patch.products as Product[]);
      if(Array.isArray(patch.txs))setTxs(patch.txs as Tx[]);
      if(Array.isArray(patch.appointments))setAppointments(patch.appointments as Appointment[]);
      if(Array.isArray(patch.attentions))setAttentions(patch.attentions as Attention[]);
      if(typeof patch.professionalName==="string")setProfessionalName(patch.professionalName);
    };
    const onError=(event:Event)=>setFlash((event as CustomEvent<{message?:string}>).detail?.message||"No se pudo guardar en Supabase.");
    window.addEventListener("asha-runtime-state",onState as EventListener);
    window.addEventListener("asha-cloud-error",onError as EventListener);
    return()=>{window.removeEventListener("asha-runtime-state",onState as EventListener);window.removeEventListener("asha-cloud-error",onError as EventListener)};
  },[]);
  useEffect(()=>{
    if(!currentUserId||!hydrated||!cloudReady)return;
    const state={patients,services,products,txs,appointments,attentions,professionalName};
    primeRuntimeState(state);
    if(cloudSaveTimer.current)clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current=setTimeout(async()=>{
      try{
        const response=await fetch("/api/clinic-state",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({state})});
        if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(typeof data?.error==="string"?data.error:"No se pudo guardar en Supabase.")}
      }catch(error){setFlash(error instanceof Error?error.message:"No se pudo guardar en Supabase.")}
    },400);
    return()=>{if(cloudSaveTimer.current)clearTimeout(cloudSaveTimer.current)};
  },[patients,services,products,txs,appointments,attentions,professionalName,currentUserId,hydrated,cloudReady]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const hour = boliviaHour();
      setGreeting(
        hour < 12
          ? "Buenos días"
          : hour < 19
            ? "Buenas tardes"
            : "Buenas noches",
      );
      setDateLabel(todayLabel());
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target))
        setNotificationsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [notificationsOpen]);

  const currentUser = users.find((u) => u.id === currentUserId) ?? null;
  const primaryUserId = users.find((user)=>user.isPrimaryAdmin)?.id;
  const isPrimary = currentUser?.isPrimaryAdmin === true;
  const canAccess = (module: string) =>
    !!currentUser &&
    (isPrimary ||
      (currentUser.permissions ?? []).includes(module) ||
      (module === "Egresos" && ((currentUser.permissions ?? []).includes("Caja y cobros") || (currentUser.permissions ?? []).includes("Pagos"))));
  const visibleNav = nav.filter(([label]) => canAccess(label));
  useEffect(() => {
    if (!isPrimary || cloudUsersLoaded.current) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/admin/users", {
          credentials:"same-origin",
          headers: {Accept: "application/json"},
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));
        if (
          cancelled ||
          !response.ok ||
          data?.ok !== true ||
          !Array.isArray(data.users)
        )
          return;
        cloudUsersLoaded.current = true;
        setUsers((current) =>
          data.users.map((row: Record<string, unknown>, index: number) => {
            const cloudId = String(row.id || ""),
              username = normalizeUsername(String(row.username || "")),
              existing =
                current.find(
                  (item) =>
                    item.cloudId === cloudId ||
                    normalizeUsername(item.username || "") === username,
                ) || (index === 0 ? current[0] : undefined),
              permissions = cloudPermissions(row.permissions);
            return {
              ...existing,
              id: existing?.id ?? Date.now() + index,
              cloudId,
              name: String(row.fullName || existing?.name || "Usuario"),
              role: String(row.role || existing?.role || "Usuario"),
              initials: userInitials(
                String(row.fullName || existing?.name || "Usuario"),
              ),
              active: row.active !== false,
              username,
              avatarUrl:
                typeof row.avatarUrl === "string" && row.avatarUrl
                  ? row.avatarUrl
                  : undefined,
              isPrimaryAdmin: row.isPrimaryAdmin === true,
              permissions:
                permissions ??
                existing?.permissions ??
                defaultPermissions(String(row.role || "Usuario")),
            };
          }),
        );
      } catch {}
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isPrimary]);
  useEffect(() => {
    if (currentUser && !canAccess(section)) {
      const first = visibleNav[0]?.[0];
      if (first) setSection(first);
    }
  }, [currentUserId, users, section]);

  const activeTxs = txs.filter((t) => t.status !== "Anulado");
  const income = activeTxs
    .filter((t) => t.type === "Ingreso" && t.status !== "Pendiente")
    .reduce((a, t) => a + t.amount, 0);
  const expenses = activeTxs
    .filter((t) => t.type === "Egreso")
    .reduce((a, t) => a + t.amount, 0);
  const filtered = useMemo(
    () =>
      patients.filter((p) =>
        (p.name + p.code + p.phone).toLowerCase().includes(q.toLowerCase()),
      ),
    [patients, q],
  );
  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        const matches = (p.name + " " + p.description)
          .toLowerCase()
          .includes(productQuery.toLowerCase());
        const status =
          productFilter === "Todos" ||
          (productFilter === "Disponibles" && p.active && p.stock > 0) ||
          (productFilter === "Sin stock" && p.stock === 0) ||
          (productFilter === "Inactivos" && !p.active);
        return matches && status;
      }),
    [products, productQuery, productFilter],
  );
  const pendingCount = txs.filter(
    (t) => t.type === "Ingreso" && t.status === "Pendiente",
  ).length;
  const lowStock = products.filter(
    (p) => p.active && p.stock <= (p.minimumStock ?? 2),
  );
  const todayAppointments = appointments.filter(
    (item) => item.date === boliviaTodayKey(),
  );
  const notifications = [
    ...(pendingCount
      ? [
          `${pendingCount} cobro${pendingCount === 1 ? "" : "s"} pendiente${pendingCount === 1 ? "" : "s"}.`,
        ]
      : []),
    ...(lowStock.length
      ? [
          `${lowStock.length} producto${lowStock.length === 1 ? "" : "s"} con stock bajo.`,
        ]
      : []),
  ];

  const notify = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash(""), 2800);
  };
  const openAttention = (patientId?: number) => {
    setAttentionPatientId(patientId ?? null);
    setModal("history");
  };
  useEffect(() => {
    const onOpenAttentionForPatient = (event: Event) => {
      const name =
        (event as CustomEvent<{ patient?: string }>).detail?.patient?.trim() || "";
      if (!name) return;
      const selected = patients.find((patient) => patient.name === name);
      if (selected) openAttention(selected.id);
    };
    window.addEventListener(
      "asha-open-attention-for-patient",
      onOpenAttentionForPatient as EventListener,
    );
    return () =>
      window.removeEventListener(
        "asha-open-attention-for-patient",
        onOpenAttentionForPatient as EventListener,
      );
  }, [patients]);
  const closeEntry = () => {
    setModal(null);
    setAttentionPatientId(null);
  };
  const saveAttention = (
    attention: Attention,
    initialPayment: number,
    method: string,
  ) => {
    const total = Math.max(0, Number(attention.totalCost) || 0),
      paid = Math.min(total, Math.max(0, Number(initialPayment) || 0)),
      balance = Math.max(0, total - paid),
      createdAt = new Date().toISOString(),
      rows: Tx[] = [];
    if (paid > 0)
      rows.push({
        id: Date.now() + 1,
        concept: attention.procedure || attention.reason,
        reference: attention.patientName,
        type: "Ingreso",
        amount: paid,
        date: nowLabel(),
        createdAt,
        method,
        status: "Pagado",
        origin: "patient-payment",
        operationId: `AT-${attention.id}-P1`,
        patientId: attention.patientId,
        attentionId: attention.id,
      });
    if (balance > 0)
      rows.push({
        id: Date.now() + 2,
        concept: `Saldo · ${attention.procedure || attention.reason}`,
        reference: attention.patientName,
        type: "Ingreso",
        amount: balance,
        date: nowLabel(),
        createdAt,
        method: "Pendiente",
        status: "Pendiente",
        origin: "patient-charge",
        operationId: `AT-${attention.id}-SALDO`,
        patientId: attention.patientId,
        attentionId: attention.id,
      });
    setAttentions((current) => [attention, ...current]);
    setPatients((current) =>
      current.map((patient) =>
        patient.id === attention.patientId
          ? { ...patient, status: "Atendido", lastVisit: nowLabel() }
          : patient,
      ),
    );
    if (attention.appointmentId)
      setAppointments((current) =>
        current.map((appointment) =>
          appointment.id === attention.appointmentId
            ? { ...appointment, status: "Atendido" }
            : appointment,
        ),
      );
    if (rows.length) setTxs((current) => [...rows, ...current]);
    notify(
      balance > 0
        ? `Atención guardada · saldo pendiente ${money(balance)}`
        : "Atención guardada · pago completo",
    );
  };
  const registerPatientPayment = (
    patientId: number,
    attentionId: number,
    amount: number,
    method: string,
  ) => {
    const attention = attentions.find(
        (item) => item.id === attentionId && item.patientId === patientId,
      ),
      patient = patients.find((item) => item.id === patientId);
    if (!attention || !patient)
      return "No se encontró la atención del paciente.";
    const pending = txs.find(
      (tx) =>
        tx.origin === "patient-charge" &&
        tx.patientId === patientId &&
        tx.attentionId === attentionId &&
        tx.status === "Pendiente",
    );
    const balance = Number(pending?.amount) || 0;
    if (amount <= 0 || amount > balance + 0.001)
      return "El importe supera el saldo pendiente.";
    const createdAt = new Date().toISOString(),
      payment: Tx = {
        id: Date.now(),
        concept: attention.procedure || attention.reason,
        reference: patient.name,
        type: "Ingreso",
        amount,
        date: nowLabel(),
        createdAt,
        method,
        status: "Pagado",
        origin: "patient-payment",
        operationId: `AT-${attentionId}-P-${Date.now()}`,
        patientId,
        attentionId,
      };
    setTxs((current) => {
      const next = current.flatMap((tx) => {
        if (tx.id !== pending?.id) return [tx];
        const remaining = Math.max(0, (Number(tx.amount) || 0) - amount);
        return remaining > 0
          ? [{ ...tx, amount: remaining, date: nowLabel(), createdAt }]
          : [];
      });
      return [payment, ...next];
    });
    notify(
      Math.abs(balance - amount) < 0.001
        ? "Pago registrado · cuenta cancelada"
        : "Abono registrado correctamente",
    );
    return "";
  };
  const saveProduct = (product: Product) => {
    if (!isPrimary) { notify("Solo la administradora principal puede modificar productos."); return; }
    setProducts((current) =>
      current.some((p) => p.id === product.id)
        ? current.map((p) => (p.id === product.id ? product : p))
        : [product, ...current],
    );
    notify(
      productAction?.kind === "edit"
        ? "Producto actualizado"
        : "Producto guardado",
    );
    setProductAction(null);
  };
  const sellProduct = (
    product: Product,
    quantity: number,
    client: string,
    method: string,
    note: string,
  ) => {
    if (quantity < 1 || quantity > product.stock) return false;
    const amount = product.salePrice * quantity,
      operationId = `PV-${Date.now()}`;
    setProducts((current) =>
      current.map((p) =>
        p.id === product.id ? { ...p, stock: p.stock - quantity } : p,
      ),
    );
    setTxs((current) => [
      {
        id: Date.now(),
        concept: "Venta de producto",
        reference: client || product.name,
        type: "Ingreso",
        amount,
        date: nowLabel(),
        createdAt: new Date().toISOString(),
        method,
        status: "Pagado",
        origin: "product-sale",
        operationId,
        productId: product.id,
        productName: product.name,
        quantity,
        stockDelta: -quantity,
        unitPrice: product.salePrice,
        unitCost: product.purchaseCost,
        note,
      },
      ...current,
    ]);
    notify(`Venta registrada: ${money(amount)}`);
    setProductAction(null);
    return true;
  };
  const restockProduct = (
    product: Product,
    quantity: number,
    cost: number,
    provider: string,
    note: string,
  ) => {
    if (!isPrimary) { notify("Solo la administradora principal puede modificar el inventario."); return; }
    if (quantity < 1 || cost < 0) return;
    const amount = cost * quantity,
      operationId = `PC-${Date.now()}`;
    setProducts((current) =>
      current.map((p) =>
        p.id === product.id
          ? {
              ...p,
              stock: p.stock + quantity,
              purchaseCost: cost || p.purchaseCost,
            }
          : p,
      ),
    );
    setTxs((current) => [
      {
        id: Date.now(),
        concept: "Compra de productos",
        reference: provider || product.name,
        type: "Egreso",
        amount,
        date: nowLabel(),
        createdAt: new Date().toISOString(),
        method: "Compra",
        origin: "product-purchase",
        operationId,
        productId: product.id,
        productName: product.name,
        quantity,
        stockDelta: quantity,
        unitPrice: cost,
        note,
      },
      ...current,
    ]);
    notify(`Ingreso registrado: +${quantity} unidades`);
    setProductAction(null);
  };
  const saveUser=async(updated:User,pin="")=>{
    if(!updated.cloudId)return "El usuario no existe en Supabase.";
    try{
      const response=await fetch(`/api/admin/users/${encodeURIComponent(updated.cloudId)}`,{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({fullName:updated.name,username:updated.username,role:updated.role,email:updated.email,active:updated.active,permissions:updated.permissions,pin:pin||undefined})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data?.ok!==true)return typeof data?.error==="string"?data.error:"No se pudo actualizar el usuario.";
      setUsers(current=>current.map(user=>user.id===updated.id?{...updated,isPrimaryAdmin:data.user?.isPrimaryAdmin===true}:user));
      notify("Usuario actualizado correctamente");setUserAction(null);return "";
    }catch{return "No se pudo actualizar el usuario."}
  };
  const savePermissions=async(userId:number,permissions:string[])=>{
    const user=users.find(item=>item.id===userId);if(!user)return "No se encontró el usuario.";
    return saveUser({...user,permissions:user.isPrimaryAdmin?[...MODULES]:permissions});
  };
  const saveEditedService = (service: Service) => {
    setServices((current) =>
      current.map((item) => (item.id === service.id ? service : item)),
    );
    setEditingService(null);
    notify("Servicio actualizado correctamente");
  };
  const addAppointment = (appointment: Appointment) => {
    setAppointments((current) => [appointment, ...current]);
    setSelectedAgendaDate(appointment.date);
    notify("Cita agendada correctamente");
  };
  const createCloudUser=async(payload:NewUserPayload)=>{
    try{
      const response=await fetch("/api/admin/users",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data?.ok!==true||!data.user){if(response.status===401)return "Tu sesión ha expirado. Inicia sesión nuevamente.";if(response.status===403)return "No tienes permiso para crear usuarios.";if(response.status===409)return "Ese nombre de usuario ya está en uso.";return typeof data?.error==="string"?data.error:"No se pudo crear el usuario."}
      const created=data.user as Record<string,unknown>,cachedUser:User={id:Date.now(),cloudId:String(created.id||""),name:String(created.fullName||payload.fullName),role:String(created.role||payload.role),initials:userInitials(String(created.fullName||payload.fullName)),active:created.active!==false,username:normalizeUsername(String(created.username||payload.username)),permissions:Array.isArray(created.permissions)?created.permissions as string[]:payload.permissions,isPrimaryAdmin:false};
      setUsers(current=>current.some(user=>user.cloudId===cachedUser.cloudId)?current:[...current,cachedUser]);notify("Usuario creado correctamente");return "";
    }catch{return "No se pudo crear el usuario."}
  };
  const go = (s: string) => {
    if (!canAccess(s)) return;
    setSection(s);
    setMenu(false);
    setNotificationsOpen(false);
  };
  const logout=async()=>{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"}).catch(()=>undefined);setCloudReady(false);setUsers([]);setCurrentUserId(null);setNotificationsOpen(false);setMenu(false)};
  const completeBootstrap = async () =>
    "No existe un Administrador Principal activo en Supabase. La configuración inicial cloud debe completarse desde el backend seguro antes de habilitar el acceso.";
  const login=async(username:string,password:string)=>{
    const clean=normalizeUsername(username);if(!clean||!password)return "Ingresa tu usuario y contraseña/PIN.";
    try{
      const response=await fetch("/api/asha-auth/login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:clean,pin:password})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data?.ok!==true||!data.user)return typeof data?.error==="string"?data.error:"No se pudo iniciar sesión.";
      const cloudUser=data.user as CloudUser,merged=mergeCloudUser([],cloudUser);
      setUsers(merged.users);setCurrentUserId(merged.userId);setHydrated(true);setBootstrapState("configured");setCloudReady(false);
      void (async()=>{
        try{
          const stateResponse=await fetch("/api/clinic-state",{credentials:"same-origin",cache:"no-store"}),stateData=await stateResponse.json().catch(()=>({}));
          if(!stateResponse.ok||stateData?.ok!==true)throw new Error(typeof stateData?.error==="string"?stateData.error:"No se pudo cargar la información de Supabase.");
          const state=stateData.state&&typeof stateData.state==="object"?stateData.state as Record<string,unknown>:{};
          setPatients(Array.isArray(state.patients)?state.patients as Patient[]:[]);setServices(Array.isArray(state.services)?state.services as Service[]:[]);setProducts(Array.isArray(state.products)?state.products as Product[]:[]);setTxs(Array.isArray(state.txs)?state.txs as Tx[]:[]);setAppointments(Array.isArray(state.appointments)?state.appointments as Appointment[]:[]);setAttentions(Array.isArray(state.attentions)?state.attentions as Attention[]:[]);if(typeof state.professionalName==="string"&&state.professionalName.trim())setProfessionalName(state.professionalName);primeRuntimeState(state);setCloudReady(true);
        }catch(error){setFlash(error instanceof Error?error.message:"No se pudo cargar la información de Supabase.")}
      })();
      return "";
    }catch{return "No se pudo conectar con el servicio de autenticación. Intenta nuevamente."}
  };

  if (!authReady || bootstrapState === "checking")
    return <div className="auth-loading" aria-label="Cargando ASHA" />;
  if (bootstrapState === "unconfigured")
    return (
      <BootstrapScreen
        professionalName={professionalName}
        submit={completeBootstrap}
      />
    );
  if (!currentUser)
    return (
      <LoginScreen
        submit={login}
        notice={
          bootstrapState === "unavailable"
            ? "No se pudo comprobar temporalmente el estado de Supabase. ASHA no iniciará una nueva configuración automáticamente; puedes intentar iniciar sesión nuevamente."
            : undefined
        }
      />
    );

  const headerAction = (() => {
    if (section === "Pacientes")
      return { label: "Nuevo paciente", run: () => setModal("patient") };
    if (section === "Historias clínicas")
      return { label: "Nueva atención", run: () => openAttention() };
    if (section === "Agenda")
      return { label: "Nueva cita", run: () => setModal("appointment") };
    if (section === "Servicios")
      return { label: "Crear servicio", run: () => setModal("service") };
    if (section === "Productos")
      return {
        label: "Nuevo producto",
        run: () => setProductAction({ kind: "new" }),
      };
    if (section === "Caja y cobros") return null;
    if (section === "Movimientos")
      return { label: "Nuevo movimiento", run: () => setModal("transaction") };
    if (section === "Usuarios" && isPrimary)
      return { label: "Agregar usuario", run: () => setModal("user") };
    return null;
  })();

  return (
    <div className="app">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand" aria-label="ASHA Integrative Medicine">
          <div className="brand-lockup">
            <strong>ASHA</strong>
            <small>Integrative Medicine</small>
          </div>
          <button aria-label="Cerrar menú" onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <button
          className="clinic professional-card"
          onClick={() =>
            canAccess("Configuración")
              ? go("Configuración")
              : notify("Tu perfil no tiene acceso a Configuración.")
          }
          aria-label={`Usuario actual: ${currentUser.name}`}
        >
          <UserAvatar user={currentUser} />
          <div>
            <b>{currentUser.name}</b>
            <small>{currentUser.role}</small>
          </div>
          {canAccess("Configuración") && <ChevronRight />}
        </button>
        <nav aria-label="Módulos">
          {visibleNav.map(([label, Icon]) => (
            <button
              key={label}
              className={section === label ? "active" : ""}
              onClick={() => go(label)}
            >
              <Icon />
              {label}
              {label === "Agenda" && todayAppointments.length > 0 && (
                <em>{todayAppointments.length}</em>
              )}
            </button>
          ))}
        </nav>
        <button className="logout-button" onClick={logout}>
          <LogOut />
          Cerrar sesión
        </button>
      </aside>
      {menu && (
        <button
          aria-label="Cerrar menú"
          className="scrim"
          onClick={() => setMenu(false)}
        />
      )}
      <main>
        <header>
          <button
            aria-label="Abrir menú"
            className="hamb"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>
          <div>
            <small>{dateLabel}</small>
            <h1>{section}</h1>
          </div>
          <div className="head-actions">
            <button
              aria-label="Actualizar página"
              title="Actualizar página"
              className="bell"
              type="button"
              onClick={() => window.location.reload()}
            >
              <RefreshCw />
            </button>
            <div className="notifications-wrap" ref={notificationRef}>
              <button
                aria-label="Notificaciones"
                aria-expanded={notificationsOpen}
                className="bell"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell />
              </button>
              {notificationsOpen && (
                <div className="notifications-panel" role="status">
                  {notifications.length === 0 ? (
                    <>
                      <span>
                        <Bell />
                      </span>
                      <b>Sin notificaciones</b>
                      <p>No tienes notificaciones pendientes.</p>
                    </>
                  ) : (
                    <>
                      <b>Notificaciones</b>
                      {notifications.map((item, index) => (
                        <p key={index}>{item}</p>
                      ))}
                    </>
                  )}
                  <button onClick={() => setNotificationsOpen(false)}>
                    Cerrar
                  </button>
                </div>
              )}
            </div>
            {headerAction && (
              <Button className="gold" onClick={headerAction.run}>
                <Plus />
                {headerAction.label}
              </Button>
            )}
            <Button variant="outline" onClick={logout}>
              <LogOut />
              Cerrar sesión
            </Button>
          </div>
        </header>
        <div className="content">
          {flash && (
            <div className="flash" role="status">
              {flash}
            </div>
          )}
          {section === "Resumen" && (
            <Dashboard
              income={income}
              expenses={expenses}
              txs={txs}
              appointments={appointments}
              attentions={attentions}
              open={setModal}
              openAttention={openAttention}
              go={go}
              greeting={greeting}
              professionalName={currentUser.name}
            />
          )}
          {section === "Pacientes" && (
            <>
              <SectionLead text={`${patients.length} fichas registradas`} />
              <section className="panel">
                <div className="search">
                  <Search />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por nombre, historia o teléfono"
                  />
                </div>
                <div className="list">
                  {filtered.map((p) => (
                    <div className="person" key={p.id}>
                      <Avatar name={p.name} />
                      <div>
                        <b>{p.name}</b>
                        <small>
                          {p.code} · {p.age} años · {p.phone}
                        </small>
                      </div>
                      <span className="tag">{p.status}</span>
                      <small>{p.lastVisit}</small>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openAttention(p.id)}
                      >
                        Nueva atención
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {section === "Historias clínicas" && (
            <>
              <SectionLead text="Historial de atenciones y evoluciones" />
              <div className="cards">
                {patients.map((p) => {
                  const patientAttentions = attentions.filter(
                    (a) => a.patientId === p.id,
                  );
                  const latest = patientAttentions[0];
                  return (
                    <article className="panel record" key={p.id}>
                      <FileHeart />
                      <span className="tag">
                        {patientAttentions.length
                          ? `${patientAttentions.length} atención${patientAttentions.length === 1 ? "" : "es"}`
                          : "Sin atenciones"}
                      </span>
                      <h3>{p.name}</h3>
                      <p>{p.code}</p>
                      <hr />
                      <small>Última atención</small>
                      <b>
                        {latest
                          ? nowLabelFromIso(latest.createdAt)
                          : p.lastVisit}
                      </b>
                      {latest && (
                        <small>
                          {latest.procedure || latest.reason} ·{" "}
                          {money(latest.totalCost || 0)}
                        </small>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => openAttention(p.id)}
                      >
                        Nueva atención <ChevronRight />
                      </Button>
                    </article>
                  );
                })}
              </div>
            </>
          )}
          {section === "Agenda" && (
            <>
              <SectionLead
                text={`${appointments.filter((item) => item.date === selectedAgendaDate).length} cita(s) · ${agendaDateLabel(selectedAgendaDate)}`}
              />
              <AgendaPanel
                appointments={appointments}
                patients={patients}
                selectedDate={selectedAgendaDate}
                onSelectDate={setSelectedAgendaDate}
                onNew={() => setModal("appointment")}
                onAttend={openAttention}
              />
            </>
          )}
          {section === "Servicios" && (
            <>
              <SectionLead text="Catálogo, precios y duración" />
              <div className="cards">
                {services.map((s) => (
                  <article className="panel service" key={s.id}>
                    <Stethoscope />
                    <span className={s.active ? "tag" : "tag inactive"}>
                      {s.active ? "Activo" : "Inactivo"}
                    </span>
                    <h3>{s.name}</h3>
                    <p>{s.category}</p>
                    <div>
                      <strong>{money(s.price)}</strong>
                      <small>{s.duration}</small>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setEditingService(s)}
                    >
                      Editar servicio
                    </Button>
                  </article>
                ))}
              </div>
            </>
          )}
          {section === "Productos" && (
            <>
              <SectionLead text="Catálogo físico, existencias, compras y ventas" />
              <ProductsPanel
                products={filteredProducts}
                query={productQuery}
                setQuery={setProductQuery}
                filter={productFilter}
                setFilter={setProductFilter}
                action={setProductAction}
                adminMode={isPrimary}
              />
            </>
          )}
          {section === "Egresos" && (
            <>
              <SectionLead text="Salidas de dinero, gastos y compras registradas" />
              <ExpensesPanel
                txs={txs}
                onAdd={(expense) => {
                  setTxs((current) => [expense, ...current]);
                  notify("Egreso registrado correctamente");
                }}
              />
            </>
          )}
          {section === "Caja y cobros" && (
            <>
              <SectionLead text="Cobros por paciente, saldos pendientes y caja operativa" />
              <PatientBillingPanel
                patients={patients}
                attentions={attentions}
                txs={txs}
                onPayment={registerPatientPayment}
              />
              <CashPanel txs={txs} />
            </>
          )}
          {section === "Movimientos" && (
            <>
              <SectionLead text="Trazabilidad general de ingresos, egresos y productos" />
              <MovementsPanel txs={txs} income={income} expenses={expenses} />
            </>
          )}
          {section === "Contabilidad" && (
            <AccountingPanel
              txs={txs}
              products={products}
              services={services}
            />
          )}
          {section === "Usuarios" && (
            <>
              <SectionLead text="Roles y permisos de acceso" />
              <div className="cards">
                {users.map((u) => (
                  <article className="panel user" key={u.id}>
                    <UserAvatar user={u} large />
                    <h3>{u.name}</h3>
                    <p>{u.role}</p>
                    <span className={u.active ? "tag" : "tag inactive"}>
                      {u.active ? "Activo" : "Inactivo"}
                    </span>
                    {u.username ? (
                      <small className="credential-state">
                        Usuario: {u.username}
                      </small>
                    ) : (
                      <small className="credential-state pending">
                        Credenciales pendientes
                      </small>
                    )}
                    <div className="user-actions">
                      <Button
                        variant="outline"
                        onClick={() => setUserAction({ kind: "edit", user: u })}
                      >
                        Editar usuario
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setUserAction({ kind: "permissions", user: u })
                        }
                      >
                        Gestionar permisos
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {section === "Configuración" && (
            <>
              <SectionLead text="Datos generales del consultorio y del profesional" />
              <SettingsPanel
                professionalName={professionalName}
                onSave={setProfessionalName}
              />
            </>
          )}
        </div>
      </main>
      <Entry
        type={modal}
        close={closeEntry}
        patients={patients}
        services={services}
        users={users}
        appointments={appointments}
        attentionPatientId={attentionPatientId}
        selectedAgendaDate={selectedAgendaDate}
        appointmentManualAllowed={canAccess("Agenda")}
        addPatient={(p) => setPatients((v) => [p, ...v])}
        addAttention={saveAttention}
        addService={(s) => setServices((v) => [s, ...v])}
        addTx={(t) => setTxs((v) => [t, ...v])}
        addAppointment={addAppointment}
        createUser={createCloudUser}
      />
      <ServiceEditDialog
        service={editingService}
        close={() => setEditingService(null)}
        save={saveEditedService}
      />
      <UserDialog
        action={userAction}
        users={users}
        primaryUserId={primaryUserId}
        close={() => setUserAction(null)}
        saveUser={saveUser}
        savePermissions={savePermissions}
      />
      <ProductDialog
        key={productAction?.kind + "-" + (productAction?.product?.id ?? "new")}
        action={productAction}
        close={() => setProductAction(null)}
        save={saveProduct}
        sell={sellProduct}
        restock={restockProduct}
        txs={txs}
      />
    </div>
  );
}
function nowLabelFromIso(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("es-BO", {
        timeZone: BOLIVIA_TZ,
        dateStyle: "short",
        timeStyle: "short",
      }).format(parsed);
}
function storedProfessionalName(users: User[]) {
  return users[0]?.name || "Profesional ASHA";
}
function UserAvatar({
  user,
  large = false,
  previewUrl,
}: {
  user: Pick<User, "name" | "avatarUrl">;
  large?: boolean;
  previewUrl?: string;
}) {
  const url = previewUrl ?? user.avatarUrl;
  return (
    <span className={large ? "big-avatar user-avatar" : "user-avatar"}>
      {url ? (
        <img src={url} alt={`Foto de perfil de ${user.name}`} />
      ) : (
        userInitials(user.name)
      )}
    </span>
  );
}

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
async function prepareAvatar(file: File) {
  if (!ALLOWED_AVATAR_TYPES.has(file.type))
    throw new Error("Selecciona una imagen JPG, JPEG, PNG o WEBP.");
  if (file.size <= 0) throw new Error("El archivo de imagen está vacío.");
  if (file.size > MAX_AVATAR_BYTES)
    throw new Error("La imagen no puede superar 5 MB.");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(new Error("No se pudo leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });
  return await new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error("El archivo no contiene una imagen válida."));
        return;
      }
      const max = 512,
        scale = Math.min(
          1,
          max / Math.max(image.naturalWidth, image.naturalHeight),
        ),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("No se pudo procesar la imagen."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("No se pudo procesar la imagen.")),
        "image/webp",
        0.84,
      );
    };
    image.onerror = () =>
      reject(new Error("El archivo no contiene una imagen válida."));
    image.src = source;
  });
}

function AuthBrand() {
  return (
    <div className="auth-brand">
      <strong>ASHA</strong>
      <small>Integrative Medicine</small>
    </div>
  );
}
function LoginScreen({
  submit,
  notice,
}: {
  submit: (u: string, p: string) => Promise<string>;
  notice?: string;
}) {
  const [error, setError] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false);
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget),
      message = await submit(
        String(f.get("username")),
        String(f.get("password")),
      );
    setError(message);
    setBusy(false);
  };
  return (
    <main className="auth-page">
      <section className="auth-card">
        <AuthBrand />
        <div className="auth-copy">
          <h1>Iniciar sesión</h1>
          <p>Accede a la plataforma de gestión médica.</p>
        </div>
        {notice && (
          <p className="auth-error" role="status">
            {notice}
          </p>
        )}
        <form onSubmit={onSubmit}>
          <Field label="Usuario">
            <Input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </Field>
          <Field label="Contraseña">
            <div className="password-field">
              <Input
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShow((v) => !v)}
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </Field>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <Button className="gold auth-submit" disabled={busy}>
            {busy ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
function BootstrapScreen({
  professionalName,
  submit,
}: {
  professionalName: string;
  submit: (u: string, p: string) => Promise<string>;
}) {
  const [error, setError] = useState("");
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false);
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      password = String(f.get("password")),
      confirm = String(f.get("confirm"));
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    const message = await submit(String(f.get("username")), password);
    setError(message);
    setBusy(false);
  };
  return (
    <main className="auth-page">
      <section className="auth-card bootstrap">
        <AuthBrand />
        <div className="auth-copy">
          <h1>Configurar acceso administrador</h1>
          <p>
            {professionalName}, crea las credenciales iniciales para activar el
            inicio de sesión sin perder ningún dato existente.
          </p>
        </div>
        <form onSubmit={onSubmit}>
          <Field label="Usuario administrador">
            <Input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </Field>
          <Field label="Contraseña">
            <div className="password-field">
              <Input
                name="password"
                type={show ? "text" : "password"}
                minLength={6}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                onClick={() => setShow((v) => !v)}
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </Field>
          <Field label="Confirmar contraseña">
            <Input
              name="confirm"
              type={show ? "text" : "password"}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </Field>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <Button className="gold auth-submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar y continuar"}
          </Button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({
  income,
  expenses,
  txs,
  appointments,
  attentions,
  open,
  openAttention,
  go,
  greeting,
  professionalName,
}: {
  income: number;
  expenses: number;
  txs: Tx[];
  appointments: Appointment[];
  attentions: Attention[];
  open: (s: string) => void;
  openAttention: (patientId?: number) => void;
  go: (s: string) => void;
  greeting: string;
  professionalName: string;
}) {
  const todayKey = boliviaTodayKey(),
    today = appointments
      .filter((item) => item.date === todayKey)
      .sort((a, b) => a.time.localeCompare(b.time)),
    attendedToday = new Set(
      attentions
        .filter((item) => item.date === todayKey)
        .map((item) => item.patientId),
    ).size;
  return (
    <>
      <div className="welcome">
        <div>
          <em>PANEL DE CONTROL</em>
          <h2>
            {greeting}, <span>{professionalName}</span>
          </h2>
          <p>Este es el panorama de su consultorio para hoy.</p>
        </div>
        <div>
          <Button variant="outline" onClick={() => openAttention()}>
            <ClipboardPlus />
            Nueva atención
          </Button>
          <Button className="gold" onClick={() => go("Caja y cobros")}>
            <Banknote />
            Registrar cobro
          </Button>
        </div>
      </div>
      <div className="metrics">
        <Metric
          icon={Users}
          label="Pacientes atendidos"
          value={String(attendedToday)}
          note="Atenciones guardadas hoy"
        />
        <Metric
          icon={CalendarDays}
          label="Citas para hoy"
          value={String(today.length)}
          note={`${today.filter((item) => item.status === "Pendiente").length} pendientes`}
        />
        <Metric
          icon={ArrowUpRight}
          label="Ingresos registrados"
          value={money(income)}
          note="Actualizado ahora"
        />
        <Metric
          icon={WalletCards}
          label="Balance"
          value={money(income - expenses)}
          note={`${money(expenses)} en egresos`}
        />
      </div>
      <div className="dash">
        <section className="panel">
          <Title
            title="Agenda de hoy"
            text="Citas programadas"
            action="Ver agenda"
            click={() => go("Agenda")}
          />
          <AgendaList appointments={today} />
        </section>
        <section className="panel">
          <Title title="Acciones rápidas" text="Operaciones frecuentes" />
          <div className="quick">
            <button onClick={() => open("patient")}>
              <span>
                <Users />
              </span>
              <b>Registrar paciente</b>
              <ChevronRight />
            </button>
            <button onClick={() => openAttention()}>
              <span>
                <FileHeart />
              </span>
              <b>Nueva atención</b>
              <ChevronRight />
            </button>
            <button onClick={() => go("Caja y cobros")}>
              <span>
                <Banknote />
              </span>
              <b>Registrar cobro</b>
              <ChevronRight />
            </button>
            <button onClick={() => open("service")}>
              <span>
                <Stethoscope />
              </span>
              <b>Crear servicio</b>
              <ChevronRight />
            </button>
          </div>
        </section>
      </div>
      <section className="panel">
        <Title
          title="Movimientos recientes"
          text="Últimos registros financieros"
          action="Ver todos"
          click={() => go("Movimientos")}
        />
        <TxTable txs={txs} />
      </section>
    </>
  );
}

function SettingsPanel({
  professionalName,
  onSave,
}: {
  professionalName: string;
  onSave: (name: string) => void;
}) {
  const [draft, setDraft] = useState(professionalName),
    [savedMessage, setSavedMessage] = useState(false);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean) return;
    onSave(clean);
    setDraft(clean);
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2400);
  };
  return (
    <form className="panel settings" onSubmit={submit}>
      <div className="settings-section">
        <span className="settings-icon">
          <Stethoscope />
        </span>
        <div>
          <h3>Datos del profesional</h3>
          <p>
            Este nombre aparecerá en el saludo y en el perfil de la plataforma.
          </p>
        </div>
      </div>
      <Field label="Nombre del profesional">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Dr., Dra., Lic. y nombre completo"
          required
          maxLength={80}
        />
      </Field>
      <div className="settings-grid">
        <Field label="Nombre comercial">
          <Input defaultValue="ASHA Integrative Medicine" />
        </Field>
        <Field label="Moneda">
          <Input defaultValue="Bolivianos (Bs)" />
        </Field>
        <Field label="Zona horaria">
          <Input defaultValue="Bolivia (GMT-4)" />
        </Field>
        <Field label="Numeración de historias">
          <Input defaultValue="HC-2026-" />
        </Field>
      </div>
      <div className="settings-actions">
        <Button className="gold" type="submit">
          Guardar cambios
        </Button>
        {savedMessage && (
          <span role="status">Cambios guardados correctamente</span>
        )}
      </div>
    </form>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="metric">
      <span>
        <Icon />
      </span>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
function Title({
  title,
  text,
  action,
  click,
}: {
  title: string;
  text: string;
  action?: string;
  click?: () => void;
}) {
  return (
    <div className="title">
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      {action && (
        <button onClick={click}>
          {action}
          <ChevronRight />
        </button>
      )}
    </div>
  );
}
function SectionLead({ text }: { text: string }) {
  return (
    <div className="heading">
      <div>
        <p>{text}</p>
      </div>
    </div>
  );
}
function AgendaList({
  appointments,
  onAttend,
  patients,
}: {
  appointments: Appointment[];
  onAttend?: (patientId: number) => void;
  patients?: Patient[];
}) {
  const rows = [...appointments].sort((a, b) => a.time.localeCompare(b.time));
  return rows.length ? (
    <div className="agenda">
      {rows.map((a, i) => {
        const patient = patients?.find((p) => p.name === a.patient);
        return (
          <div key={a.id}>
            <time>{a.time}</time>
            <i className={`c${i % 4}`} />
            <span>
              <b>{a.patient}</b>
              <small>{a.service}</small>
            </span>
            <em className="tag">{a.status}</em>
            {onAttend && patient && a.status !== "Atendido" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onAttend(patient.id)}
              >
                Nueva atención
              </Button>
            )}
          </div>
        );
      })}
    </div>
  ) : (
    <div
      style={{
        padding: "22px 0",
        textAlign: "center",
        color: "#7a8581",
        fontSize: 13,
      }}
    >
      No hay citas programadas para esta fecha.
    </div>
  );
}
function AgendaPanel({
  appointments,
  patients,
  selectedDate,
  onSelectDate,
  onNew,
  onAttend,
}: {
  appointments: Appointment[];
  patients: Patient[];
  selectedDate: string;
  onSelectDate: (value: string) => void;
  onNew: () => void;
  onAttend: (patientId: number) => void;
}) {
  const [month, setMonth] = useState(() => {
    const date = dateFromKey(selectedDate);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  useEffect(() => {
    const date = dateFromKey(selectedDate);
    if (
      date.getFullYear() !== month.getFullYear() ||
      date.getMonth() !== month.getMonth()
    )
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [selectedDate]);
  const year = month.getFullYear(),
    monthIndex = month.getMonth(),
    first = new Date(year, monthIndex, 1),
    offset = (first.getDay() + 6) % 7,
    daysInMonth = new Date(year, monthIndex + 1, 0).getDate(),
    cells = Array.from({ length: 42 }, (_, index) => {
      const day = index - offset + 1;
      return day >= 1 && day <= daysInMonth
        ? new Date(year, monthIndex, day)
        : null;
    }),
    selectedRows = appointments.filter((item) => item.date === selectedDate);
  const countFor = (key: string) =>
    appointments.filter((item) => item.date === key).length;
  const move = (delta: number) =>
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  const today = () => {
    const now = dateFromKey(boliviaTodayKey());
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDate(boliviaTodayKey());
  };
  return (
    <section className="panel" style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0, textTransform: "capitalize" }}>
            {new Intl.DateTimeFormat("es-BO", {
              month: "long",
              year: "numeric",
            }).format(month)}
          </h3>
          <small style={{ color: "#7a8581" }}>
            Selecciona cualquier día para revisar o agendar citas.
          </small>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            type="button"
            variant="outline"
            onClick={() => move(-1)}
            aria-label="Mes anterior"
          >
            ‹
          </Button>
          <Button type="button" variant="outline" onClick={today}>
            Hoy
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => move(1)}
            aria-label="Mes siguiente"
          >
            ›
          </Button>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,minmax(36px,1fr))",
          gap: 6,
        }}
      >
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <b
            key={day}
            style={{
              fontSize: 11,
              textAlign: "center",
              color: "#7a8581",
              paddingBottom: 4,
            }}
          >
            {day}
          </b>
        ))}
        {cells.map((date, index) =>
          date ? (
            (() => {
              const key = dateKey(date),
                count = countFor(key),
                selected = key === selectedDate,
                isToday = key === boliviaTodayKey();
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectDate(key)}
                  style={{
                    minHeight: 58,
                    border: selected
                      ? "1px solid #b59a5a"
                      : "1px solid #e4e9e6",
                    background: selected ? "#f7f2e6" : "#fff",
                    borderRadius: 10,
                    padding: 7,
                    cursor: "pointer",
                    display: "grid",
                    alignContent: "space-between",
                    justifyItems: "start",
                  }}
                >
                  <span
                    style={{
                      fontWeight: selected ? 800 : 600,
                      color: isToday ? "#9a7e45" : "#294c45",
                    }}
                  >
                    {date.getDate()}
                  </span>
                  {count > 0 && (
                    <small style={{ fontSize: 10, color: "#5f706a" }}>
                      {count} cita{count === 1 ? "" : "s"}
                    </small>
                  )}
                </button>
              );
            })()
          ) : (
            <span key={`empty-${index}`} />
          ),
        )}
      </div>
      <div style={{ borderTop: "1px solid #edf0ee", paddingTop: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <div>
            <b style={{ color: "#284d45" }}>{agendaDateLabel(selectedDate)}</b>
            <small style={{ display: "block", color: "#7a8581" }}>
              {selectedRows.length} cita(s) programada(s)
            </small>
          </div>
          <Button className="gold" type="button" onClick={onNew}>
            <Plus />
            Agendar cita
          </Button>
        </div>
        <AgendaList
          appointments={selectedRows}
          patients={patients}
          onAttend={onAttend}
        />
      </div>
    </section>
  );
}
function TxTable({ txs }: { txs: Tx[] }) {
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Referencia</th>
            <th>Fecha</th>
            <th>Método</th>
            <th>Importe</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((t) => (
            <tr key={t.id}>
              <td>
                <span className={t.type === "Ingreso" ? "in" : "out"}>
                  {t.type === "Ingreso" ? <ArrowUpRight /> : <ArrowDownRight />}
                </span>
                <b>
                  {t.concept}
                  <small>
                    {t.type}
                    {t.status ? ` · ${t.status}` : ""}
                  </small>
                </b>
              </td>
              <td>{t.reference}</td>
              <td>{t.date}</td>
              <td>{t.method}</td>
              <td className={t.type === "Ingreso" ? "green" : "red"}>
                {t.type === "Ingreso" ? "+" : "−"}
                {money(t.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Avatar({ name }: { name: string }) {
  return <span className="avatar">{userInitials(name)}</span>;
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function ServiceEditDialog({
  service,
  close,
  save,
}: {
  service: Service | null;
  close: () => void;
  save: (service: Service) => void;
}) {
  if (!service) return null;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save({
      ...service,
      name: String(f.get("name") || "").trim(),
      category: String(f.get("category") || "").trim(),
      price: Math.max(0, Number(f.get("price"))),
      duration: String(f.get("duration") || "").trim(),
      active: String(f.get("active")) === "true",
    });
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar servicio</DialogTitle>
          <DialogDescription>
            Actualiza el servicio existente sin crear un registro duplicado.
          </DialogDescription>
        </DialogHeader>
        <form className="form" onSubmit={submit}>
          <Field label="Nombre">
            <Input name="name" defaultValue={service.name} required />
          </Field>
          <Field label="Categoría">
            <Input name="category" defaultValue={service.category} required />
          </Field>
          <div className="cols">
            <Field label="Precio (Bs)">
              <Input
                name="price"
                type="number"
                min="0"
                defaultValue={service.price}
                required
              />
            </Field>
            <Field label="Duración">
              <Input name="duration" defaultValue={service.duration} required />
            </Field>
          </div>
          <Field label="Estado">
            <select
              name="active"
              defaultValue={service.active ? "true" : "false"}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </Field>
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button className="gold" type="submit">
              Guardar servicio
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserDialog({
  action,
  users,
  primaryUserId,
  close,
  saveUser,
  savePermissions,
}: {
  action: UserAction;
  users: User[];
  primaryUserId?: number;
  close: () => void;
  saveUser: (u: User, pin?: string) => Promise<string>;
  savePermissions: (id: number, p: string[]) => Promise<string>;
}) {
  const [permissions, setPermissions] = useState<string[]>([]),
    [error, setError] = useState(""),
    [avatarFile, setAvatarFile] = useState<Blob | null>(null),
    [avatarPreview, setAvatarPreview] = useState(""),
    [removeAvatar, setRemoveAvatar] = useState(false),
    [busy, setBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setPermissions(
      action?.user.permissions ??
        (action ? defaultPermissions(action.user.role) : []),
    );
    setError("");
    setAvatarFile(null);
    setAvatarPreview("");
    setRemoveAvatar(false);
    setBusy(false);
  }, [action]);
  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );
  if (!action) return null;
  const user = action.user,
    isPrimary = user.id === primaryUserId;
  const toggle = (module: string) => {
    if (isPrimary) return;
    setPermissions((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module],
    );
  };
  const chooseAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const prepared = await prepareAvatar(file);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(prepared);
      setAvatarPreview(URL.createObjectURL(prepared));
      setRemoveAvatar(false);
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "No se pudo cargar la imagen.",
      );
    } finally {
      setBusy(false);
    }
  };
  const submitEdit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();setError("");
    const f=new FormData(e.currentTarget),name=String(f.get("name")||"").trim(),role=String(f.get("role")||"Usuario"),active=isPrimary?true:String(f.get("active"))==="true",username=normalizeUsername(String(f.get("username")||"")),pin=String(f.get("password")||""),confirm=String(f.get("confirm")||"");
    if(!username){setError("El nombre de usuario es obligatorio.");return}
    if(users.some(item=>item.id!==user.id&&normalizeUsername(item.username||"")===username)){setError("Este nombre de usuario ya está en uso.");return}
    if(pin||confirm){if(pin.length<6||pin.length>72){setError("Utilice una contraseña de al menos 6 caracteres.");return}if(pin!==confirm){setError("Las contraseñas no coinciden.");return}}
    let avatarUrl=removeAvatar?undefined:user.avatarUrl;setBusy(true);
    try{
      if((avatarFile||removeAvatar)&&user.cloudId){
        const response=avatarFile?await fetch(`/api/admin/users/${encodeURIComponent(user.cloudId)}/avatar`,{method:"PUT",credentials:"same-origin",body:(()=>{const data=new FormData();data.set("avatar",avatarFile,"profile.webp");return data})()}):await fetch(`/api/admin/users/${encodeURIComponent(user.cloudId)}/avatar`,{method:"DELETE",credentials:"same-origin"});
        const result=await response.json().catch(()=>({}));if(!response.ok||result?.ok!==true)throw new Error(typeof result?.error==="string"?result.error:"No se pudo guardar la foto de perfil.");
        avatarUrl=typeof result.avatarUrl==="string"&&result.avatarUrl?result.avatarUrl:undefined;
      }
      const message=await saveUser({...user,name,role,email:String(f.get("email")||""),active,username,avatarUrl,initials:userInitials(name),permissions:isPrimary?[...MODULES]:(user.permissions??defaultPermissions(role))},pin);
      if(message){setError(message);return}
    }catch(error){setError(error instanceof Error?error.message:"No se pudo guardar el usuario.")}finally{setBusy(false)}
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="user-dialog">
        <DialogHeader>
          <DialogTitle>
            {action.kind === "edit" ? "Editar usuario" : "Gestionar permisos"}
          </DialogTitle>
          <DialogDescription>
            {action.kind === "edit"
              ? "Actualiza datos y credenciales sin crear un registro nuevo."
              : `${user.name} · ${user.role}`}
          </DialogDescription>
        </DialogHeader>
        {action.kind === "edit" ? (
          <form className="form" onSubmit={submitEdit}>
            <section className="user-photo-editor" aria-label="Foto de perfil">
              <UserAvatar
                user={user}
                large
                previewUrl={removeAvatar ? "" : avatarPreview || undefined}
              />
              <div className="user-photo-copy">
                <b>Foto de perfil</b>
                <small>Opcional · JPG, JPEG, PNG o WEBP · máximo 5 MB</small>
              </div>
              <div className="user-photo-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => photoInput.current?.click()}
                >
                  <ImagePlus />
                  {user.avatarUrl || avatarPreview
                    ? "Cambiar foto"
                    : "Agregar foto"}
                </Button>
                {(user.avatarUrl || avatarPreview) && !removeAvatar && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                      setAvatarPreview("");
                      setAvatarFile(null);
                      setRemoveAvatar(true);
                      setError("");
                    }}
                  >
                    <Trash2 />
                    Quitar foto
                  </Button>
                )}
                <input
                  ref={photoInput}
                  hidden
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseAvatar}
                />
              </div>
            </section>
            <Field label="Nombre">
              <Input name="name" defaultValue={user.name} required />
            </Field>
            <Field label="Rol">
              <select name="role" defaultValue={user.role}>
                <option>Administradora · Médica</option>
                <option>Administrador</option>
                <option>Médico</option>
                <option>Recepción y caja</option>
                <option>Enfermería</option>
              </select>
            </Field>
            <Field label="Correo">
              <Input
                name="email"
                type="email"
                defaultValue={user.email ?? ""}
                placeholder="Opcional"
              />
            </Field>
            <Field label="Usuario">
              <Input
                name="username"
                defaultValue={user.username ?? ""}
                autoCapitalize="none"
                required
              />
            </Field>
            <div className="cols">
              <Field label="Nueva contraseña">
                <Input
                  name="password"
                  type="password"
                  minLength={6}
                  maxLength={72}
                  autoComplete="new-password"
                  placeholder="Dejar vacío para conservar"
                />
              </Field>
              <Field label="Confirmar nueva contraseña">
                <Input name="confirm" type="password" minLength={6} maxLength={72} autoComplete="new-password" />
              </Field>
            </div>
            <Field label="Estado">
              <select
                name="active"
                defaultValue={user.active ? "true" : "false"}
                disabled={isPrimary}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </Field>
            {isPrimary && (
              <p className="form-note">
                El administrador principal permanece activo y conserva acceso
                completo.
              </p>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={close}
              >
                Cancelar
              </Button>
              <Button className="gold" type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Guardar usuario"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="permissions-form">
            <div className="permission-grid">
              {MODULES.map((module) => (
                <label key={module} className="permission-item">
                  <input
                    type="checkbox"
                    checked={isPrimary || permissions.includes(module)}
                    disabled={isPrimary}
                    onChange={() => toggle(module)}
                  />
                  <span>{module}</span>
                </label>
              ))}
            </div>
            {isPrimary && (
              <p className="form-note">
                El administrador principal mantiene acceso completo a todos los
                módulos.
              </p>
            )}
            <div className="form-actions">
              <Button type="button" variant="outline" onClick={close}>
                Cancelar
              </Button>
              <Button
                className="gold"
                type="button"
                disabled={busy}
                onClick={async()=>{setBusy(true);const message=await savePermissions(user.id,isPrimary?[...MODULES]:permissions);setBusy(false);if(message)setError(message)}}
              >
                Guardar permisos
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Entry({
  type,
  close,
  patients,
  services,
  users,
  appointments,
  attentionPatientId,
  selectedAgendaDate,
  appointmentManualAllowed,
  addPatient,
  addAttention,
  addService,
  addTx,
  addAppointment,
  createUser,
}: {
  type: string | null;
  close: () => void;
  patients: Patient[];
  services: Service[];
  users: User[];
  appointments: Appointment[];
  attentionPatientId: number | null;
  selectedAgendaDate: string;
  appointmentManualAllowed: boolean;
  addPatient: (p: Patient) => void;
  addAttention: (a: Attention, initialPayment: number, method: string) => void;
  addService: (s: Service) => void;
  addTx: (t: Tx) => void;
  addAppointment: (a: Appointment) => void;
  createUser: (payload: NewUserPayload) => Promise<string>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [manualAppointment, setManualAppointment] = useState(false),
    [manualAppointmentService, setManualAppointmentService] = useState(false),
    [newUserRole, setNewUserRole] = useState("Médico"),
    [newUserPermissions, setNewUserPermissions] = useState<string[]>(
      defaultPermissions("Médico"),
    );
  useEffect(() => {
    setError("");
    setBusy(false);
    setManualAppointment(false);
    setManualAppointmentService(false);
    setNewUserRole("Médico");
    setNewUserPermissions(defaultPermissions("Médico"));
  }, [type]);
  const toggleNewUserPermission = (module: string) =>
    setNewUserPermissions((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module],
    );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = e.currentTarget,
      f = new FormData(form),
      id = Date.now(),
      createdAt = new Date().toISOString();
    if (type === "user") {
      const fullName = String(f.get("name") || "").trim(),
        username = normalizeUsername(String(f.get("username") || "")),
        pin = String(f.get("pin") || ""),
        confirm = String(f.get("confirm") || ""),
        active = String(f.get("active")) !== "false";
      if (fullName.length < 3) {
        setError("El nombre del usuario no es válido.");
        return;
      }
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
        setError(
          "El usuario debe tener entre 3 y 40 caracteres y usar solo letras, números, punto, guion o guion bajo.",
        );
        return;
      }
      if (users.some((u) => normalizeUsername(u.username || "") === username)) {
        setError("Ese nombre de usuario ya está en uso.");
        return;
      }
      if (pin.length < 6 || pin.length > 72) {
        setError("Utilice una contraseña de al menos 6 caracteres.");
        return;
      }
      if (pin !== confirm) {
        setError("Las contraseñas no coinciden.");
        return;
      }
      setBusy(true);
      const message = await createUser({
        fullName,
        username,
        pin,
        role: newUserRole,
        active,
        permissions: MODULES.filter((module) =>
          newUserPermissions.includes(module),
        ),
      });
      setBusy(false);
      form
        .querySelectorAll<HTMLInputElement>(
          'input[name="pin"],input[name="confirm"]',
        )
        .forEach((input) => {
          input.value = "";
        });
      if (message) {
        setError(message);
        return;
      }
      form.reset();
      close();
      return;
    }
    if (type === "patient")
      addPatient({
        id,
        name: String(f.get("name")),
        code: `HC-2026-${149 + patients.length}`,
        age: Number(f.get("age")),
        phone: String(f.get("phone")),
        lastVisit: "Sin atenciones",
        status: "Registrado",
      });
    if (type === "history") {
      const patientId = Number(f.get("patient")),
        patient = patients.find((item) => item.id === patientId);
      if (!patient) {
        setError("Selecciona un paciente válido.");
        return;
      }
      const today = boliviaTodayKey(),
        appointment = appointments.find(
          (item) =>
            item.patient === patient.name &&
            item.date === today &&
            item.status !== "Atendido" &&
            item.status !== "Cancelada",
        ),
        procedure = String(f.get("procedure") || "").trim(),
        totalCost = Math.max(0, Number(f.get("totalCost")) || 0),
        initialPayment = Math.max(0, Number(f.get("initialPayment")) || 0),
        method = String(f.get("paymentMethod") || "Efectivo");
      if (initialPayment > totalCost) {
        setError(
          "El pago inicial no puede superar el costo total del procedimiento.",
        );
        return;
      }
      addAttention(
        {
          id,
          patientId: patient.id,
          patientName: patient.name,
          date: today,
          createdAt,
          reason: String(f.get("reason") || "").trim(),
          notes: String(f.get("notes") || "").trim(),
          procedure,
          totalCost,
          status: "Atendido",
          appointmentId: appointment?.id,
        },
        initialPayment,
        method,
      );
    }
    if (type === "service")
      addService({
        id,
        name: String(f.get("name")),
        category: String(f.get("category")),
        price: Number(f.get("amount")),
        duration: String(f.get("duration")),
        active: true,
      });
    if (type === "appointment") {
      const patientName =
        appointmentManualAllowed && manualAppointment
          ? String(f.get("manualPatient") || "").trim()
          : String(f.get("patient") || "").trim();
      if (!patientName) {
        setError("Ingresa o selecciona un paciente.");
        return;
      }
      const serviceName = manualAppointmentService
        ? String(f.get("manualService") || "").trim()
        : String(f.get("service") || "").trim();
      if (!serviceName) {
        setError("Ingresa o selecciona un servicio.");
        return;
      }
      addAppointment({
        id,
        date: String(f.get("date") || selectedAgendaDate),
        time: String(f.get("time")),
        patient: patientName,
        service: serviceName,
        status: String(f.get("appointmentStatus")),
      });
    }
    if (type === "cash")
      addTx({
        id,
        concept: String(f.get("concept")),
        reference: String(f.get("reference")),
        type: "Ingreso",
        amount: Number(f.get("amount")),
        date: nowLabel(),
        createdAt,
        method: String(f.get("method")),
        status: String(f.get("status")) as Tx["status"],
        origin: "cash",
      });
    if (type === "transaction")
      addTx({
        id,
        concept: String(f.get("concept")),
        reference: String(f.get("reference")),
        type: String(f.get("movement")) as "Ingreso" | "Egreso",
        amount: Number(f.get("amount")),
        date: nowLabel(),
        createdAt,
        method: String(f.get("method")),
        status: String(f.get("movement")) === "Ingreso" ? "Pagado" : undefined,
        origin: "manual",
      });
    close();
  };
  const names: { [k: string]: string } = {
    patient: "Registrar paciente",
    history: "Nueva atención",
    appointment: "Agendar cita",
    service: "Crear servicio",
    cash: "Registrar cobro",
    transaction: "Registrar movimiento",
    user: "Agregar usuario",
  };
  return (
    <Dialog open={!!type} onOpenChange={(o) => !o && !busy && close()}>
      <DialogContent className={type === "user" ? "user-entry-dialog" : undefined}>
        <DialogHeader>
          <DialogTitle>{type ? names[type] : "Nuevo registro"}</DialogTitle>
          <DialogDescription>
            {type === "user"
              ? "Crea el acceso operativo en Supabase. El correo interno no se muestra al usuario."
              : type === "appointment"
                ? "Selecciona fecha y hora. La cita quedará asociada al día elegido en la agenda."
                : type === "history"
                  ? "Registra la atención, el costo del procedimiento y el pago recibido. El saldo quedará disponible en Caja y cobros."
                  : "Complete los datos para guardar el registro."}
          </DialogDescription>
        </DialogHeader>
        <form className="form" onSubmit={submit}>
          {type === "patient" && (
            <>
              <Field label="Nombre completo">
                <Input name="name" required />
              </Field>
              <div className="cols">
                <Field label="Edad">
                  <Input name="age" type="number" required />
                </Field>
                <Field label="Teléfono">
                  <Input name="phone" required />
                </Field>
              </div>
            </>
          )}
          {type === "history" && (
            <>
              <Field label="Paciente">
                <select
                  name="patient"
                  defaultValue={attentionPatientId ?? patients[0]?.id}
                  required
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Motivo de consulta">
                <Input name="reason" required />
              </Field>
              <Field label="Procedimiento / tratamiento">
                <Input
                  name="procedure"
                  placeholder="Ej. Ácido hialurónico"
                  required
                />
              </Field>
              <div className="cols">
                <Field label="Costo total (Bs)">
                  <Input
                    name="totalCost"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    required
                  />
                </Field>
                <Field label="Pago inicial (Bs)">
                  <Input
                    name="initialPayment"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                    required
                  />
                </Field>
              </div>
              <Field label="Método del pago inicial">
                <select name="paymentMethod" defaultValue="Efectivo">
                  <option>Efectivo</option>
                  <option>QR</option>
                  <option>Transferencia</option>
                  <option>Tarjeta</option>
                  <option>Otro</option>
                </select>
              </Field>
              <Field label="Anamnesis, antecedentes y evolución">
                <Textarea name="notes" rows={4} />
              </Field>
            </>
          )}
          {type === "appointment" && (
            <>
              <div className="cols">
                <Field label="Fecha">
                  <Input
                    name="date"
                    type="date"
                    defaultValue={selectedAgendaDate}
                    required
                  />
                </Field>
                <Field label="Hora">
                  <Input name="time" type="time" required />
                </Field>
              </div>
              {appointmentManualAllowed && (
                <label className="form-note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={manualAppointment}
                    onChange={(event) => setManualAppointment(event.target.checked)}
                  />
                  Registrar paciente manualmente para esta cita
                </label>
              )}
              {appointmentManualAllowed && manualAppointment ? (
                <Field label="Paciente (registro manual)">
                  <Input
                    name="manualPatient"
                    placeholder="Nombre completo"
                    required
                    autoFocus
                  />
                </Field>
              ) : (
                <Field label="Paciente">
                  <select name="patient" required>
                    {patients.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <label className="form-note" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={manualAppointmentService}
                  onChange={(event) => setManualAppointmentService(event.target.checked)}
                />
                Registrar servicio manualmente para esta cita
              </label>
              {manualAppointmentService ? (
                <Field label="Servicio (registro manual)">
                  <Input
                    name="manualService"
                    placeholder="Ej. Control, valoración, procedimiento especial"
                    required
                  />
                </Field>
              ) : (
                <Field label="Servicio">
                  <select name="service" required>
                    {services
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <Field label="Estado">
                <select name="appointmentStatus" defaultValue="Confirmada">
                  <option>Confirmada</option>
                  <option>Pendiente</option>
                  <option>En consulta</option>
                  <option>Atendido</option>
                </select>
              </Field>
            </>
          )}
          {type === "service" && (
            <>
              <Field label="Nombre">
                <Input name="name" required />
              </Field>
              <Field label="Categoría">
                <Input name="category" required />
              </Field>
              <div className="cols">
                <Field label="Precio (Bs)">
                  <Input name="amount" type="number" min="0" required />
                </Field>
                <Field label="Duración">
                  <Input name="duration" placeholder="45 min" required />
                </Field>
              </div>
            </>
          )}
          {type === "cash" && (
            <>
              <Field label="Concepto del cobro">
                <Input name="concept" required />
              </Field>
              <Field label="Paciente o referencia">
                <Input name="reference" required />
              </Field>
              <div className="cols">
                <Field label="Importe">
                  <Input
                    name="amount"
                    type="number"
                    min="0"
                    step=".01"
                    required
                  />
                </Field>
                <Field label="Estado">
                  <select name="status">
                    <option>Pagado</option>
                    <option>Pendiente</option>
                    <option>Anulado</option>
                  </select>
                </Field>
              </div>
              <Field label="Método">
                <select name="method">
                  <option>Efectivo</option>
                  <option>QR</option>
                  <option>Transferencia</option>
                  <option>Otro</option>
                </select>
              </Field>
            </>
          )}
          {type === "transaction" && (
            <>
              <div className="cols">
                <Field label="Tipo">
                  <select name="movement">
                    <option>Ingreso</option>
                    <option>Egreso</option>
                  </select>
                </Field>
                <Field label="Importe">
                  <Input
                    name="amount"
                    type="number"
                    min="0"
                    step=".01"
                    required
                  />
                </Field>
              </div>
              <Field label="Concepto">
                <Input name="concept" required />
              </Field>
              <Field label="Referencia">
                <Input name="reference" required />
              </Field>
              <Field label="Método">
                <select name="method">
                  <option>Efectivo</option>
                  <option>QR</option>
                  <option>Transferencia</option>
                  <option>Tarjeta</option>
                  <option>Otro</option>
                </select>
              </Field>
            </>
          )}
          {type === "user" && (
            <>
              <Field label="Nombre completo">
                <Input name="name" required maxLength={120} />
              </Field>
              <Field label="Usuario">
                <Input
                  name="username"
                  autoCapitalize="none"
                  autoComplete="username"
                  minLength={3}
                  maxLength={40}
                  pattern="[a-z0-9._-]{3,40}"
                  required
                />
              </Field>
              <div className="cols">
                <Field label="Contraseña">
                  <Input
                    name="pin"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    maxLength={72}
                    required
                  />
                </Field>
                <Field label="Confirmar contraseña">
                  <Input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    maxLength={72}
                    required
                  />
                </Field>
              </div>
              <Field label="Rol">
                <select
                  name="role"
                  value={newUserRole}
                  onChange={(event) => {
                    const role = event.target.value;
                    setNewUserRole(role);
                    setNewUserPermissions(defaultPermissions(role));
                  }}
                >
                  <option>Administrador</option>
                  <option>Médico</option>
                  <option>Recepción y caja</option>
                  <option>Enfermería</option>
                  <option>Usuario</option>
                </select>
              </Field>
              <Field label="Estado">
                <select name="active" defaultValue="true">
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </Field>
              <div className="permissions-form">
                <Label>Permisos por módulo</Label>
                <div className="permission-grid">
                  {MODULES.map((module) => (
                    <label key={module} className="permission-item">
                      <input
                        type="checkbox"
                        checked={newUserPermissions.includes(module)}
                        onChange={() => toggleNewUserPermission(module)}
                      />
                      <span>{module}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button className="gold" disabled={busy}>
              {type === "user"
                ? busy
                  ? "Creando usuario…"
                  : "Guardar usuario"
                : type === "appointment"
                  ? "Agendar cita"
                  : type === "history"
                    ? "Guardar atención"
                    : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
