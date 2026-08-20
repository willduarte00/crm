/**
 * Regras de negócio puras para Métricas, Dashboard e KPIs (RF-40 a RF-49).
 * Sem Express e sem Prisma.
 */

import { addMonthsToReferenceMonth, formatReferenceMonth, parseReferenceMonth } from './dates.js';

export interface ContractForMetrics {
  id: string;
  clientId: string;
  serviceType: string;
  billingType: string; // 'recorrente' | 'pontual'
  valueCents: number;
  status: string; // 'ativo' | 'pausado' | 'encerrado'
  deletedAt?: Date | string | null;
}

export interface PaymentForMetrics {
  id: string;
  contractId: string;
  number: string;
  referenceMonth: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  paidDate?: string | null; // YYYY-MM-DD
  amountCents: number;
  status: string; // 'Pendente' | 'Pago' | 'Cancelado'
  contract?: {
    clientId: string;
    serviceType: string;
    client?: {
      id: string;
      name: string;
      tradeName?: string | null;
      phone?: string | null;
    };
  };
}

export interface ClientForMetrics {
  id: string;
  name: string;
  contracts: {
    status: string;
    serviceType: string;
    deletedAt?: Date | string | null;
  }[];
}

export interface MetricSnapshotData {
  referenceMonth: string; // YYYY-MM
  mrrCents: number;
  invoicedCents: number;
  receivedCents: number;
  overdueCents: number;
  overdueCount: number;
  activeClients: number;
}

export interface MetricComparison {
  diff: number;
  percentage: number;
}

export interface PaymentAlertItem {
  id: string;
  number: string;
  clientName: string;
  clientPhone?: string | null;
  amountCents: number;
  dueDate: string;
  referenceMonth: string;
  daysDiff: number; // negativo para atrasado, positivo/0 para a vencer
}

export interface BillingHistoryItem {
  referenceMonth: string; // YYYY-MM
  label: string; // ex: "Jan", "Fev", "05/2026"
  invoicedCents: number;
  receivedCents: number;
}

export interface ServiceDistributionItem {
  serviceType: string;
  clientCount: number;
  percentage: number;
}

/**
 * Calcula o MRR (Monthly Recurring Revenue) (RF-40).
 * Soma de valueCents dos contratos recorrentes E ativos.
 * Pausados não entram. Encerrados não entram. Pontuais não entram.
 */
export function calculateMRR(contracts: ContractForMetrics[]): number {
  return contracts.reduce((acc, contract) => {
    if (contract.billingType === 'recorrente' && contract.status === 'ativo') {
      return acc + contract.valueCents;
    }
    return acc;
  }, 0);
}

/**
 * Calcula o total recebido no mês (regime de caixa) (RF-41).
 * Soma de amountCents das cobranças cuja paidDate cai no mês de referência fornecido.
 */
export function calculateReceivedThisMonth(
  payments: PaymentForMetrics[],
  currentMonth: string
): number {
  return payments.reduce((acc, p) => {
    if (p.status === 'Pago' && p.paidDate && p.paidDate.startsWith(currentMonth)) {
      return acc + p.amountCents;
    }
    return acc;
  }, 0);
}

/**
 * Calcula o total faturado no mês (regime de competência) (RF-42).
 * Soma de amountCents das cobranças com referenceMonth igual ao mês de referência fornecido,
 * independentemente de pagamento (exclui apenas Canceladas).
 */
export function calculateInvoicedThisMonth(
  payments: PaymentForMetrics[],
  currentMonth: string
): number {
  return payments.reduce((acc, p) => {
    if (p.status !== 'Cancelado' && p.referenceMonth === currentMonth) {
      return acc + p.amountCents;
    }
    return acc;
  }, 0);
}

/**
 * Calcula a inadimplência atual: soma em centavos e contagem (RF-43).
 * Cobranças com status = 'Pendente' e dueDate < hoje.
 */
export function calculateOverdue(
  payments: PaymentForMetrics[],
  today: string
): { overdueCents: number; overdueCount: number } {
  let overdueCents = 0;
  let overdueCount = 0;

  for (const p of payments) {
    if (p.status === 'Pendente' && p.dueDate < today) {
      overdueCents += p.amountCents;
      overdueCount++;
    }
  }

  return { overdueCents, overdueCount };
}

/**
 * Calcula a taxa de inadimplência em percentual (RF-43a).
 * Taxa = (overdueCents / invoicedCents) * 100.
 * Se invoicedCents === 0, retorna 0 (evita divisão por zero).
 */
export function calculateDelinquencyRate(overdueCents: number, invoicedCents: number): number {
  if (invoicedCents <= 0 || overdueCents <= 0) {
    return 0;
  }
  const rate = (overdueCents / invoicedCents) * 100;
  // Arredonda para 1 casa decimal
  return Math.round(rate * 10) / 10;
}

/**
 * Calcula o número de clientes ativos (RF-44).
 * Cliente ativo = cliente com pelo menos um contrato com status = 'ativo'.
 */
export function calculateActiveClients(clients: ClientForMetrics[]): number {
  return clients.filter((client) =>
    client.contracts.some((contract) => contract.status === 'ativo')
  ).length;
}

/**
 * Adiciona N dias civis a uma data YYYY-MM-DD.
 */
export function addDaysToCivilDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  const newY = date.getUTCFullYear();
  const newM = String(date.getUTCMonth() + 1).padStart(2, '0');
  const newD = String(date.getUTCDate()).padStart(2, '0');
  return `${newY}-${newM}-${newD}`;
}

/**
 * Calcula a diferença em dias civis entre duas datas (dateB - dateA).
 */
export function diffInCivilDays(dateA: string, dateB: string): number {
  const [yA, mA, dA] = dateA.split('-').map(Number);
  const [yB, mB, dB] = dateB.split('-').map(Number);
  const utcA = Date.UTC(yA, mA - 1, dA);
  const utcB = Date.UTC(yB, mB - 1, dB);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utcB - utcA) / msPerDay);
}

/**
 * Obtém os alertas de pagamentos: vencidas e a vencer nos próximos 7 dias (RF-45).
 */
export function getPaymentAlerts(
  payments: PaymentForMetrics[],
  today: string
): {
  overdue: PaymentAlertItem[];
  upcoming7Days: PaymentAlertItem[];
} {
  const limitDate = addDaysToCivilDate(today, 7);

  const overdue: PaymentAlertItem[] = [];
  const upcoming7Days: PaymentAlertItem[] = [];

  for (const p of payments) {
    if (p.status !== 'Pendente') continue;

    const clientName = p.contract?.client?.tradeName || p.contract?.client?.name || 'Cliente';
    const clientPhone = p.contract?.client?.phone || null;

    if (p.dueDate < today) {
      // Vencida
      const daysLate = diffInCivilDays(p.dueDate, today);
      overdue.push({
        id: p.id,
        number: p.number,
        clientName,
        clientPhone,
        amountCents: p.amountCents,
        dueDate: p.dueDate,
        referenceMonth: p.referenceMonth,
        daysDiff: -daysLate,
      });
    } else if (p.dueDate >= today && p.dueDate <= limitDate) {
      // A vencer nos próximos 7 dias
      const daysUntilDue = diffInCivilDays(today, p.dueDate);
      upcoming7Days.push({
        id: p.id,
        number: p.number,
        clientName,
        clientPhone,
        amountCents: p.amountCents,
        dueDate: p.dueDate,
        referenceMonth: p.referenceMonth,
        daysDiff: daysUntilDue,
      });
    }
  }

  // Ordena vencidas: da mais antiga para a mais recente
  overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Ordena a vencer: da mais próxima para a mais distante
  upcoming7Days.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return { overdue, upcoming7Days };
}

const MONTH_LABELS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Calcula o histórico financeiro dos últimos 6 meses (faturado vs recebido) (RF-46).
 */
export function calculateBillingHistory6Months(
  payments: PaymentForMetrics[],
  currentMonth: string
): BillingHistoryItem[] {
  const months: string[] = [];

  for (let i = 5; i >= 0; i--) {
    months.push(addMonthsToReferenceMonth(currentMonth, -i));
  }

  return months.map((refMonth) => {
    const { month } = parseReferenceMonth(refMonth);
    const label = MONTH_LABELS_PT[month - 1] || refMonth;

    let invoicedCents = 0;
    let receivedCents = 0;

    for (const p of payments) {
      // Faturado: regime de competência no mês
      if (p.status !== 'Cancelado' && p.referenceMonth === refMonth) {
        invoicedCents += p.amountCents;
      }
      // Recebido: regime de caixa na data de pagamento
      if (p.status === 'Pago' && p.paidDate && p.paidDate.startsWith(refMonth)) {
        receivedCents += p.amountCents;
      }
    }

    return {
      referenceMonth: refMonth,
      label,
      invoicedCents,
      receivedCents,
    };
  });
}

/**
 * Calcula a distribuição de clientes por tipo de serviço (RF-46).
 * Considera contratos ativos de clientes ativos.
 */
export function calculateServiceDistribution(
  clients: ClientForMetrics[]
): ServiceDistributionItem[] {
  // Mapa de tipo de serviço para contagem de clientes distintos
  const serviceClientCount = new Map<string, Set<string>>();
  let totalClientsWithActiveServices = 0;
  const activeClientIds = new Set<string>();

  for (const client of clients) {
    const activeContracts = client.contracts.filter((c) => c.status === 'ativo');
    if (activeContracts.length > 0) {
      activeClientIds.add(client.id);
      for (const contract of activeContracts) {
        if (!serviceClientCount.has(contract.serviceType)) {
          serviceClientCount.set(contract.serviceType, new Set());
        }
        serviceClientCount.get(contract.serviceType)!.add(client.id);
      }
    }
  }

  totalClientsWithActiveServices = activeClientIds.size;

  if (totalClientsWithActiveServices === 0) {
    return [];
  }

  const items: ServiceDistributionItem[] = [];

  for (const [serviceType, clientSet] of serviceClientCount.entries()) {
    const clientCount = clientSet.size;
    const percentage = Math.round((clientCount / totalClientsWithActiveServices) * 100);
    items.push({
      serviceType,
      clientCount,
      percentage,
    });
  }

  // Ordena por maior número de clientes
  items.sort((a, b) => b.clientCount - a.clientCount);

  return items;
}

/**
 * Calcula o comparativo vs mês anterior para um indicador (RF-48).
 * Se não houver snapshot anterior (previousValue === null | undefined), retorna null!
 * Não exibe 0% nem inventa número.
 */
export function calculateMetricComparison(
  currentValue: number,
  previousValue: number | null | undefined
): MetricComparison | null {
  if (previousValue === null || previousValue === undefined) {
    return null;
  }

  const diff = currentValue - previousValue;

  if (previousValue === 0) {
    if (currentValue === 0) {
      return { diff: 0, percentage: 0 };
    }
    return { diff, percentage: 100 };
  }

  const percentage = Math.round(((currentValue - previousValue) / previousValue) * 1000) / 10;

  return {
    diff,
    percentage,
  };
}
