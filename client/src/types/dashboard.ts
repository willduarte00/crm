export interface CurrentMetrics {
  referenceMonth: string; // YYYY-MM
  today: string; // YYYY-MM-DD
  mrrCents: number;
  receivedCents: number;
  invoicedCents: number;
  overdueCents: number;
  overdueCount: number;
  delinquencyRate: number; // percentual ex: 4.8
  activeClients: number;
}

export interface MetricSnapshot {
  id: string;
  referenceMonth: string;
  mrrCents: number;
  invoicedCents: number;
  receivedCents: number;
  overdueCents: number;
  overdueCount: number;
  activeClients: number;
  capturedAt: string;
}

export interface MetricComparison {
  diff: number;
  percentage: number;
}

export interface DashboardComparison {
  mrr: MetricComparison | null;
  received: MetricComparison | null;
  invoiced: MetricComparison | null;
  overdue: MetricComparison | null;
  delinquencyRate: MetricComparison | null;
  activeClients: MetricComparison | null;
}

export interface PaymentAlertItem {
  id: string;
  number: string;
  clientName: string;
  clientPhone?: string | null;
  amountCents: number;
  dueDate: string;
  referenceMonth: string;
  daysDiff: number; // negativo para atrasado, positivo para a vencer
}

export interface BillingHistoryItem {
  referenceMonth: string; // YYYY-MM
  label: string; // ex: "Jan", "Fev"
  invoicedCents: number;
  receivedCents: number;
}

export interface ServiceDistributionItem {
  serviceType: string;
  clientCount: number;
  percentage: number;
}

export interface AgencySettingsSummary {
  agencyName: string;
  contactEmail?: string | null;
  phone?: string | null;
  pixKey?: string | null;
  pixKeyType?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccount?: string | null;
}

export interface DashboardData {
  current: CurrentMetrics;
  previous: MetricSnapshot | null;
  comparison: DashboardComparison | null;
  alerts: {
    overdue: PaymentAlertItem[];
    upcoming7Days: PaymentAlertItem[];
  };
  charts: {
    billingHistory: BillingHistoryItem[];
    serviceDistribution: ServiceDistributionItem[];
  };
  settings: AgencySettingsSummary;
}
