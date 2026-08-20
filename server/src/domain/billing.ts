/**
 * Regras de negócio puras para Cobranças e Faturamento (RF-20 a RF-32).
 * Sem Express e sem Prisma.
 */

import {
  calculateDueDate,
  getTodayCivilDate,
  parseReferenceMonth,
  addMonthsToReferenceMonth,
  compareCivilDates,
} from './dates.js';

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

export interface ExpectedBillingPeriod {
  referenceMonth: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  amountCents: number;
}

export interface ContractForBilling {
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  billingType: string; // 'recorrente' | 'pontual'
  valueCents: number;
  billingDay?: number | null;
  billingPeriodMonths?: number | null;
  status: string; // 'ativo' | 'pausado' | 'encerrado'
}

export interface PontualContractForBilling {
  startDate: string; // YYYY-MM-DD
  valueCents: number;
  installments: number;
  billingDay?: number | null;
}

/**
 * Formata o número da cobrança no padrão COB-AAAA-NNNN (RF-32).
 */
export function formatPaymentNumber(year: number, sequence: number): string {
  return `COB-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Faz parse de um número de cobrança COB-AAAA-NNNN.
 */
export function parsePaymentNumber(number: string): { year: number; sequence: number } | null {
  const match = /^COB-(\d{4})-(\d{4,})$/.exec(number);
  if (!match) return null;
  return {
    year: parseInt(match[1], 10),
    sequence: parseInt(match[2], 10),
  };
}

/**
 * Gera a lista de períodos de cobrança esperados para contratos recorrentes (RF-20, RF-21, RF-24, RF-25).
 *
 * Regras:
 * - Contrato não recorrente: não gera (RF-26).
 * - Status != ativo: não gera (RF-25).
 * - endDate no passado: não gera (RF-25).
 * - Horizonte: até o mês atual + 1 período/mês à frente (RF-21: nunca gera além do mês atual + 1).
 * - Valor congelado: amountCents vem de contract.valueCents (RF-24).
 * - Vencimento com mês curto: min(billingDay, últimoDiaDoMês) (RF-23).
 */
export function generateExpectedBillingPeriods(
  contract: ContractForBilling,
  targetDate?: string
): ExpectedBillingPeriod[] {
  if (contract.billingType !== 'recorrente') {
    return [];
  }

  if (contract.status !== 'ativo') {
    return [];
  }

  const today = targetDate || getTodayCivilDate();

  if (contract.endDate && contract.endDate < today) {
    return [];
  }

  const periodMonths = Math.max(1, contract.billingPeriodMonths || 1);
  const startRefMonth = contract.startDate.slice(0, 7);
  const startDay = parseInt(contract.startDate.split('-')[2], 10);
  const billingDay = contract.billingDay || startDay;

  // RF-21: Gera todos os períodos vencidos/em curso mais exatamente um mês à frente do atual
  const currentMonth = today.slice(0, 7);
  const maxAllowedRefMonth = addMonthsToReferenceMonth(currentMonth, 1);

  const periods: ExpectedBillingPeriod[] = [];
  let currentPeriodRef = startRefMonth;

  while (compareCivilDates(currentPeriodRef, maxAllowedRefMonth) <= 0) {
    if (contract.endDate && compareCivilDates(currentPeriodRef, contract.endDate.slice(0, 7)) > 0) {
      break;
    }

    const { year, month } = parseReferenceMonth(currentPeriodRef);
    const dueDate = calculateDueDate(year, month, billingDay);

    periods.push({
      referenceMonth: currentPeriodRef,
      dueDate,
      amountCents: contract.valueCents,
    });

    currentPeriodRef = addMonthsToReferenceMonth(currentPeriodRef, periodMonths);
  }

  return periods;
}

/**
 * Gera as parcelas de um projeto pontual na criação do contrato (RF-26).
 * Divide o valor total em N parcelas sem perda de centavos.
 */
export function generatePontualInstallments(
  contract: PontualContractForBilling
): ExpectedBillingPeriod[] {
  const n = Math.max(1, contract.installments);
  const baseAmount = Math.floor(contract.valueCents / n);
  const remainder = contract.valueCents - baseAmount * n;

  const startRef = contract.startDate.slice(0, 7);
  const startDay = parseInt(contract.startDate.split('-')[2], 10);
  const billingDay = contract.billingDay || startDay;

  const installments: ExpectedBillingPeriod[] = [];

  for (let i = 0; i < n; i++) {
    const refMonth = addMonthsToReferenceMonth(startRef, i);
    const { year, month } = parseReferenceMonth(refMonth);
    const dueDate = calculateDueDate(year, month, billingDay);
    const amountCents = i === 0 ? baseAmount + remainder : baseAmount;

    installments.push({
      referenceMonth: refMonth,
      dueDate,
      amountCents,
    });
  }

  return installments;
}

/**
 * Valida os dados de baixa manual de pagamento (RF-29).
 */
export function validatePaymentSettlement(input: {
  paidDate?: string | null;
  paymentMethod?: string | null;
  amountCents?: number | null;
}): { valid: boolean; error?: string } {
  if (!input.paidDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.paidDate)) {
    return {
      valid: false,
      error: 'Data de pagamento inválida. Deve estar no formato YYYY-MM-DD.',
    };
  }

  if (
    !input.paymentMethod ||
    !PAYMENT_METHODS.includes(input.paymentMethod as PaymentMethod)
  ) {
    return {
      valid: false,
      error: `Forma de pagamento inválida. Opções válidas: ${PAYMENT_METHODS.join(', ')}.`,
    };
  }

  if (
    input.amountCents !== undefined &&
    input.amountCents !== null &&
    (!Number.isInteger(input.amountCents) || input.amountCents < 0)
  ) {
    return {
      valid: false,
      error: 'O valor pago deve ser um número inteiro de centavos maior ou igual a zero.',
    };
  }

  return { valid: true };
}
