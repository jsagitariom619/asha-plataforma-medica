-- ASHA — modelo central de datos
-- Objetivo: una sola fuente de verdad para todos los módulos.
-- Esta migración está preparada para ejecutarse únicamente sobre el proyecto Supabase de ASHA.
-- No elimina tablas ni datos existentes.

create extension if not exists pgcrypto;

-- ============================================================
-- Utilidades
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Pacientes
-- ============================================================

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  history_number text unique,
  full_name text not null,
  document_number text,
  birth_date date,
  age integer,
  phone text,
  email text,
  address text,
  sex text,
  status text not null default 'Registrado',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patients_full_name on public.patients (full_name);
create index if not exists idx_patients_document_number on public.patients (document_number);

-- ============================================================
-- Historia clínica única por paciente
-- ============================================================

create table if not exists public.clinical_histories (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  chief_complaint text,
  medical_history jsonb not null default '{}'::jsonb,
  risk_factors jsonb not null default '[]'::jsonb,
  aesthetic_history jsonb not null default '{}'::jsonb,
  clinical_evaluation jsonb not null default '{}'::jsonb,
  diagnostic_impression text,
  objectives text,
  treatment_plan text,
  consent jsonb not null default '{}'::jsonb,
  baseline_photos jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Servicios y productos
-- ============================================================

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  default_price numeric(12,2) not null default 0 check (default_price >= 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  sku text unique,
  sale_price numeric(12,2) not null default 0 check (sale_price >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  stock numeric(12,3) not null default 0,
  min_stock numeric(12,3) not null default 0,
  image_url text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Tratamientos, atenciones y evoluciones
-- ============================================================

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinical_history_id uuid not null references public.clinical_histories(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  name text not null,
  areas text,
  diagnosis text,
  objectives text,
  plan text,
  status text not null default 'Activo',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_treatments_patient_id on public.treatments(patient_id);
create index if not exists idx_treatments_status on public.treatments(status);

create table if not exists public.attentions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinical_history_id uuid not null references public.clinical_histories(id) on delete cascade,
  treatment_id uuid references public.treatments(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  reason text,
  procedure_name text,
  notes text,
  total_cost numeric(12,2) not null default 0 check (total_cost >= 0),
  status text not null default 'Atendido',
  attended_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_attentions_patient_id on public.attentions(patient_id);
create index if not exists idx_attentions_treatment_id on public.attentions(treatment_id);
create index if not exists idx_attentions_attended_at on public.attentions(attended_at);

create table if not exists public.evolutions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinical_history_id uuid not null references public.clinical_histories(id) on delete cascade,
  treatment_id uuid references public.treatments(id) on delete set null,
  attention_id uuid references public.attentions(id) on delete set null,
  evolution text not null,
  areas text,
  adverse_events text,
  indications text,
  observations text,
  photos jsonb not null default '[]'::jsonb,
  next_control_at timestamptz,
  evolved_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_evolutions_patient_id on public.evolutions(patient_id);
create index if not exists idx_evolutions_treatment_id on public.evolutions(treatment_id);
create index if not exists idx_evolutions_evolved_at on public.evolutions(evolved_at);

-- ============================================================
-- Agenda
-- ============================================================

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete set null,
  treatment_id uuid references public.treatments(id) on delete set null,
  attention_id uuid references public.attentions(id) on delete set null,
  title text not null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  status text not null default 'Programado',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_patient_id on public.appointments(patient_id);
create index if not exists idx_appointments_scheduled_at on public.appointments(scheduled_at);

-- ============================================================
-- Cargos y pagos: fuente única de saldos
-- ============================================================

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete restrict,
  attention_id uuid references public.attentions(id) on delete set null,
  treatment_id uuid references public.treatments(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  concept text not null,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  status text not null default 'Pendiente' check (status in ('Pendiente','Parcial','Pagado','Anulado')),
  charged_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_charges_patient_id on public.charges(patient_id);
create index if not exists idx_charges_attention_id on public.charges(attention_id);
create index if not exists idx_charges_status on public.charges(status);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.charges(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method text not null,
  reference text,
  notes text,
  paid_at timestamptz not null default now(),
  received_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_charge_id on public.payments(charge_id);
create index if not exists idx_payments_patient_id on public.payments(patient_id);
create index if not exists idx_payments_paid_at on public.payments(paid_at);

create or replace view public.charge_balances as
select
  c.id as charge_id,
  c.patient_id,
  c.attention_id,
  c.treatment_id,
  c.concept,
  c.total_amount,
  coalesce(sum(p.amount),0)::numeric(12,2) as paid_amount,
  greatest(c.total_amount - coalesce(sum(p.amount),0),0)::numeric(12,2) as balance,
  c.status,
  c.charged_at
from public.charges c
left join public.payments p on p.charge_id = c.id
group by c.id;

-- ============================================================
-- Movimientos financieros y contabilidad
-- ============================================================

create table if not exists public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null check (movement_type in ('Ingreso','Egreso')),
  category text,
  concept text not null,
  amount numeric(12,2) not null check (amount >= 0),
  payment_id uuid references public.payments(id) on delete set null,
  charge_id uuid references public.charges(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  method text,
  status text not null default 'Confirmado',
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_financial_movements_payment_id
  on public.financial_movements(payment_id)
  where payment_id is not null;
create index if not exists idx_financial_movements_occurred_at on public.financial_movements(occurred_at);
create index if not exists idx_financial_movements_patient_id on public.financial_movements(patient_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null check (movement_type in ('Entrada','Salida','Ajuste')),
  quantity numeric(12,3) not null,
  unit_cost numeric(12,2),
  unit_price numeric(12,2),
  attention_id uuid references public.attentions(id) on delete set null,
  financial_movement_id uuid references public.financial_movements(id) on delete set null,
  notes text,
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_product_id on public.inventory_movements(product_id);

-- ============================================================
-- Configuración central
-- ============================================================

create table if not exists public.organization_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Operación financiera única: registrar pago
-- Un pago actualiza el cargo y crea exactamente un movimiento de ingreso.
-- ============================================================

create or replace function public.register_charge_payment(
  p_charge_id uuid,
  p_amount numeric,
  p_method text,
  p_received_by uuid default null,
  p_reference text default null,
  p_notes text default null
)
returns table(payment_id uuid, remaining_balance numeric, charge_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge public.charges%rowtype;
  v_paid numeric(12,2);
  v_remaining numeric(12,2);
  v_payment_id uuid;
  v_status text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El importe debe ser mayor a cero';
  end if;

  select * into v_charge
  from public.charges
  where id = p_charge_id
  for update;

  if not found then
    raise exception 'Cargo no encontrado';
  end if;

  if v_charge.status = 'Anulado' then
    raise exception 'No se puede pagar un cargo anulado';
  end if;

  select coalesce(sum(amount),0)::numeric(12,2)
    into v_paid
  from public.payments
  where charge_id = p_charge_id;

  v_remaining := greatest(v_charge.total_amount - v_paid, 0);

  if p_amount > v_remaining then
    raise exception 'El pago supera el saldo pendiente';
  end if;

  insert into public.payments (
    charge_id, patient_id, amount, method, reference, notes, received_by
  ) values (
    v_charge.id, v_charge.patient_id, p_amount, p_method, p_reference, p_notes, p_received_by
  ) returning id into v_payment_id;

  insert into public.financial_movements (
    movement_type, category, concept, amount, payment_id, charge_id, patient_id,
    method, status, occurred_at, created_by
  ) values (
    'Ingreso', 'Cobro paciente', v_charge.concept, p_amount, v_payment_id,
    v_charge.id, v_charge.patient_id, p_method, 'Confirmado', now(), p_received_by
  );

  v_remaining := greatest(v_remaining - p_amount, 0);
  v_status := case
    when v_remaining = 0 then 'Pagado'
    when v_remaining < v_charge.total_amount then 'Parcial'
    else 'Pendiente'
  end;

  update public.charges
  set status = v_status, updated_at = now()
  where id = v_charge.id;

  return query select v_payment_id, v_remaining, v_status;
end;
$$;

-- ============================================================
-- updated_at automático
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'patients','clinical_histories','services','products','treatments','attentions',
    'evolutions','appointments','charges','organization_settings'
  ] loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', t, t);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================
-- RLS: seguro por defecto.
-- Las APIs server-side de ASHA usarán la clave de servicio.
-- Las políticas por rol se agregarán antes de habilitar acceso directo desde cliente.
-- ============================================================

alter table public.patients enable row level security;
alter table public.clinical_histories enable row level security;
alter table public.services enable row level security;
alter table public.products enable row level security;
alter table public.treatments enable row level security;
alter table public.attentions enable row level security;
alter table public.evolutions enable row level security;
alter table public.appointments enable row level security;
alter table public.charges enable row level security;
alter table public.payments enable row level security;
alter table public.financial_movements enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.organization_settings enable row level security;

comment on table public.patients is 'Registro maestro único de pacientes de ASHA.';
comment on table public.clinical_histories is 'Historia clínica única por paciente.';
comment on table public.evolutions is 'Evoluciones de la historia; opcionalmente vinculadas a tratamiento/atención.';
comment on table public.charges is 'Cargos facturados a pacientes. El saldo se deriva de pagos.';
comment on table public.payments is 'Pagos y abonos aplicados a un cargo.';
comment on table public.financial_movements is 'Libro financiero central usado por Caja, Movimientos y Contabilidad.';
