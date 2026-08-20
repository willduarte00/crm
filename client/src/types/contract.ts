export const SERVICE_TYPES = [
  'Tráfego Pago',
  'Social Media & Conteúdo',
  'Sites/Landing Pages',
  'Branding',
  'SEO',
  'Pacote Completo',
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const BILLING_TYPES = ['recorrente', 'pontual'] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const CONTRACT_STATUSES = ['ativo', 'pausado', 'encerrado'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export interface ContractFile {
  id: string;
  contractId: string;
  storedName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface Contract {
  id: string;
  clientId: string;
  serviceType: ServiceType;
  description?: string | null;
  billingType: BillingType;
  valueCents: number;
  billingDay?: number | null;
  billingPeriodMonths?: number | null;
  installments?: number | null;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  client?: {
    id: string;
    name: string;
    tradeName?: string | null;
    documentType: string;
    documentNumber: string;
    phone?: string | null;
    email?: string | null;
  };
  files?: ContractFile[];
  _count?: {
    paymentRecords: number;
  };
}

export interface CreateContractInput {
  clientId: string;
  serviceType: ServiceType;
  description?: string | null;
  billingType: BillingType;
  valueCents: number;
  billingDay?: number | null;
  billingPeriodMonths?: number | null;
  installments?: number | null;
  startDate: string;
  endDate?: string | null;
  status?: ContractStatus;
}

export interface UpdateContractInput {
  serviceType?: ServiceType;
  description?: string | null;
  billingType?: BillingType;
  valueCents?: number;
  billingDay?: number | null;
  billingPeriodMonths?: number | null;
  installments?: number | null;
  startDate?: string;
  endDate?: string | null;
  status?: ContractStatus;
}
