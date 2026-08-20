/**
 * Regras de negócio puras para Contratos (RF-10 a RF-13).
 * Sem Express e sem Prisma.
 */

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

export interface ContractBillingValidationInput {
  billingType: BillingType | string;
  billingDay?: number | null;
  billingPeriodMonths?: number | null;
  installments?: number | null;
}

/**
 * Validação pura de regras de cobrança de contratos (RF-11, RF-11a).
 */
export function validateContractBilling(input: ContractBillingValidationInput): {
  valid: boolean;
  error?: string;
} {
  if (input.billingType === 'recorrente') {
    if (
      input.billingDay === undefined ||
      input.billingDay === null ||
      !Number.isInteger(input.billingDay) ||
      input.billingDay < 1 ||
      input.billingDay > 31
    ) {
      return {
        valid: false,
        error: 'Para contrato recorrente, o dia de cobrança (billingDay) deve ser um número inteiro entre 1 e 31.',
      };
    }

    if (
      input.billingPeriodMonths !== undefined &&
      input.billingPeriodMonths !== null &&
      (!Number.isInteger(input.billingPeriodMonths) || input.billingPeriodMonths < 1)
    ) {
      return {
        valid: false,
        error: 'A periodicidade de cobrança (billingPeriodMonths) deve ser um número inteiro de meses maior ou igual a 1.',
      };
    }

    return { valid: true };
  }

  if (input.billingType === 'pontual') {
    if (
      input.installments === undefined ||
      input.installments === null ||
      !Number.isInteger(input.installments) ||
      input.installments < 1
    ) {
      return {
        valid: false,
        error: 'Para contrato pontual, o número de parcelas (installments) deve ser um número inteiro maior ou igual a 1.',
      };
    }

    return { valid: true };
  }

  return {
    valid: false,
    error: 'Tipo de cobrança deve ser "recorrente" ou "pontual".',
  };
}
