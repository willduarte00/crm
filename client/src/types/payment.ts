import { Contract } from './contract';

export const PAYMENT_STATUSES = ['Pendente', 'Pago', 'Cancelado'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['PIX', 'Boleto', 'Cartao', 'Transferencia'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: 'PIX',
  Boleto: 'Boleto Bancário',
  Cartao: 'Cartão de Crédito',
  Transferencia: 'Transferência Bancária (TED/DOC)',
};

export interface InvoiceFile {
  id: string;
  paymentRecordId: string;
  storedName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface PaymentRecord {
  id: string;
  contractId: string;
  number: string;
  referenceMonth: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  paidDate?: string | null; // YYYY-MM-DD
  amountCents: number;
  status: PaymentStatus | string;
  effectiveStatus?: 'Pendente' | 'Atrasado' | 'Pago' | 'Cancelado' | string;
  paymentMethod?: PaymentMethod | null;
  notes?: string | null;
  createdAt: string;
  contract?: Contract;
  invoices?: InvoiceFile[];
}

export interface PaymentSummary {
  invoicedCents: number;
  receivedCents: number;
  overdueCents: number;
  overdueCount: number;
  currentMonth: string;
}

export interface PaginatedPaymentsResponse {
  data: PaymentRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: PaymentSummary;
}

export interface ManualSettlementInput {
  paidDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  amountCents?: number;
  notes?: string;
}

export interface CreatePaymentInput {
  contractId: string;
  referenceMonth: string;
  dueDate: string;
  amountCents: number;
  notes?: string | null;
  status?: PaymentStatus;
  paidDate?: string | null;
  paymentMethod?: PaymentMethod | null;
}

export interface UpdatePaymentInput {
  status?: PaymentStatus;
  paidDate?: string | null;
  paymentMethod?: PaymentMethod | null;
  amountCents?: number;
  notes?: string | null;
  dueDate?: string;
  referenceMonth?: string;
}
