export type UUID = string;

export type PatientStatus = "Registrado" | "Atendido" | "Inactivo";
export type TreatmentStatus = "Activo" | "Finalizado" | "Suspendido";
export type ChargeStatus = "Pendiente" | "Parcial" | "Pagado" | "Anulado";
export type FinancialMovementType = "Ingreso" | "Egreso";
export type AppointmentStatus = "Programado" | "Confirmado" | "Atendido" | "Cancelado" | "No asistió";

export interface CentralPatient {
  id: UUID;
  historyNumber: string | null;
  fullName: string;
  documentNumber: string | null;
  birthDate: string | null;
  age: number | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  sex: string | null;
  status: PatientStatus | string;
  notes: string | null;
  createdBy: UUID | null;
  createdAt: string;
  updatedAt: string;
}

export interface CentralClinicalHistory {
  id: UUID;
  patientId: UUID;
  chiefComplaint: string | null;
  medicalHistory: Record<string, unknown>;
  riskFactors: unknown[];
  aestheticHistory: Record<string, unknown>;
  clinicalEvaluation: Record<string, unknown>;
  diagnosticImpression: string | null;
  objectives: string | null;
  treatmentPlan: string | null;
  consent: Record<string, unknown>;
  baselinePhotos: unknown[];
  createdBy: UUID | null;
  updatedBy: UUID | null;
  createdAt: string;
  updatedAt: string;
}

export interface CentralTreatment {
  id: UUID;
  patientId: UUID;
  clinicalHistoryId: UUID;
  serviceId: UUID | null;
  name: string;
  areas: string | null;
  diagnosis: string | null;
  objectives: string | null;
  plan: string | null;
  status: TreatmentStatus | string;
  startedAt: string;
  endedAt: string | null;
  createdBy: UUID | null;
}

export interface CentralAttention {
  id: UUID;
  patientId: UUID;
  clinicalHistoryId: UUID;
  treatmentId: UUID | null;
  serviceId: UUID | null;
  reason: string | null;
  procedureName: string | null;
  notes: string | null;
  totalCost: number;
  status: string;
  attendedAt: string;
  createdBy: UUID | null;
}

export interface CentralEvolution {
  id: UUID;
  patientId: UUID;
  clinicalHistoryId: UUID;
  treatmentId: UUID | null;
  attentionId: UUID | null;
  evolution: string;
  areas: string | null;
  adverseEvents: string | null;
  indications: string | null;
  observations: string | null;
  photos: unknown[];
  nextControlAt: string | null;
  evolvedAt: string;
  createdBy: UUID | null;
}

export interface CentralCharge {
  id: UUID;
  patientId: UUID;
  attentionId: UUID | null;
  treatmentId: UUID | null;
  serviceId: UUID | null;
  concept: string;
  totalAmount: number;
  status: ChargeStatus;
  chargedAt: string;
  createdBy: UUID | null;
}

export interface CentralPayment {
  id: UUID;
  chargeId: UUID;
  patientId: UUID;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  receivedBy: UUID | null;
}

export interface CentralFinancialMovement {
  id: UUID;
  movementType: FinancialMovementType;
  category: string | null;
  concept: string;
  amount: number;
  paymentId: UUID | null;
  chargeId: UUID | null;
  patientId: UUID | null;
  productId: UUID | null;
  method: string | null;
  status: string;
  occurredAt: string;
  createdBy: UUID | null;
}

export interface ChargeBalance {
  chargeId: UUID;
  patientId: UUID;
  attentionId: UUID | null;
  treatmentId: UUID | null;
  concept: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: ChargeStatus;
  chargedAt: string;
}

/**
 * Reglas estructurales de ASHA:
 * - patient_id identifica al paciente en todos los módulos; no se relaciona por nombre.
 * - cada paciente tiene como máximo una clinical_history.
 * - una evolution siempre pertenece a la historia y puede pertenecer a un treatment.
 * - una atención cobrable genera un charge; el saldo nunca se guarda como copia independiente.
 * - payments se aplican a charges.
 * - cada payment confirmado genera exactamente un financial_movement de ingreso.
 * - Caja, Movimientos y Contabilidad consumen el mismo libro financiero central.
 */
export const CENTRAL_DATA_RULES = Object.freeze({
  oneClinicalHistoryPerPatient: true,
  evolutionBelongsToClinicalHistory: true,
  paymentMustReferenceCharge: true,
  paymentCreatesSingleFinancialMovement: true,
  balancesAreDerivedFromChargesAndPayments: true,
  accountingReadsFinancialMovements: true,
});
