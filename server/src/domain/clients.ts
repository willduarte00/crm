/**
 * Regras de negócio puras para Clientes e Leads (RF-01 a RF-06c).
 * Sem dependências de Express ou Prisma.
 */

export const LEAD_SOURCES = [
  'Instagram',
  'Indicação',
  'Google Ads',
  'Prospecção Ativa',
  'LinkedIn',
  'Outro',
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const PIPELINE_STAGES = [
  'Novo Lead',
  'Contato/Qualificação',
  'Proposta Enviada',
  'Em Negociação',
  'Contrato Ativo',
  'Pausado/Churn',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PRIORITIES = ['alta', 'media', 'baixa'] as const;

export type Priority = (typeof PRIORITIES)[number];

export const DOCUMENT_TYPES = ['CPF', 'CNPJ'] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const SERVICE_TYPES = [
  'Tráfego Pago',
  'Social Media & Conteúdo',
  'Sites/Landing Pages',
  'Branding',
  'SEO',
  'Pacote Completo',
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

/**
 * Remove caracteres não numéricos.
 */
export function cleanDigits(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Remove tudo que não for letra ou dígito e normaliza para maiúsculas.
 * Base do CNPJ alfanumérico (IN RFB nº 2.229/2024).
 */
export function cleanAlphanumeric(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/**
 * Normaliza o documento conforme o tipo, antes de validar ou persistir:
 * CPF mantém apenas dígitos; CNPJ aceita letras e dígitos, em maiúsculas.
 */
export function normalizeDocument(
  value: string | null | undefined,
  type: DocumentType | string
): string {
  return String(type || '').toUpperCase() === 'CNPJ' ? cleanAlphanumeric(value) : cleanDigits(value);
}

/**
 * Valor do caractere no cálculo do DV: código ASCII menos 48.
 * Dígitos mantêm o próprio valor; A=17, B=18, ..., Z=42.
 */
function documentCharValue(char: string): number {
  return char.charCodeAt(0) - 48;
}

/**
 * Validação de CPF com cálculo dos dois dígitos verificadores (RF-01).
 */
export function validateCPF(cpf: string): boolean {
  const digits = cleanDigits(cpf);
  if (digits.length !== 11) return false;

  // Rejeita sequências repetidas (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Cálculo do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== parseInt(digits[9], 10)) return false;

  // Cálculo do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  if (secondDigit !== parseInt(digits[10], 10)) return false;

  return true;
}

/**
 * Validação de CNPJ com cálculo dos dois dígitos verificadores (RF-01).
 *
 * Aceita o formato alfanumérico da IN RFB nº 2.229/2024, em vigor desde 31/07/2026:
 * 12 posições em [A-Z0-9] (raiz + ordem do estabelecimento) seguidas de 2 dígitos
 * verificadores numéricos. CNPJs totalmente numéricos continuam válidos, com o
 * mesmo cálculo e o mesmo DV de antes.
 */
export function validateCNPJ(cnpj: string): boolean {
  const value = cleanAlphanumeric(cnpj);
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(value)) return false;

  // Rejeita sequências com o mesmo caractere repetido (ex: 00000000000000)
  if (value.split('').every((char) => char === value[0])) return false;

  // Módulo 11 sobre o valor ASCII de cada caractere menos 48.
  const values = value.split('').map(documentCharValue);

  // Primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += values[i] * weights1[i];
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== values[12]) return false;

  // Segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += values[i] * weights2[i];
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  if (secondDigit !== values[13]) return false;

  return true;
}

/**
 * Valida se o documento é válido de acordo com o tipo especificado.
 */
export function validateDocument(number: string, type: DocumentType | string): boolean {
  const normalizedType = type.toUpperCase();
  if (normalizedType === 'CPF') {
    return validateCPF(number);
  }
  if (normalizedType === 'CNPJ') {
    return validateCNPJ(number);
  }
  return false;
}

/**
 * Formata CPF para exibição: 000.000.000-00
 */
export function formatCPF(cpf: string): string {
  const digits = cleanDigits(cpf);
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ para exibição: 00.000.000/0000-00 ou LH.ILR.C2X/0001-88
 */
export function formatCNPJ(cnpj: string): string {
  const value = cleanAlphanumeric(cnpj);
  if (value.length !== 14) return cnpj;
  return value.replace(
    /^([A-Z0-9]{2})([A-Z0-9]{3})([A-Z0-9]{3})([A-Z0-9]{4})([0-9]{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

/**
 * Formata documento (CPF ou CNPJ) para exibição.
 */
export function formatDocument(number: string, type?: string): string {
  const normalizedType = type?.toUpperCase();
  if (normalizedType === 'CPF') return formatCPF(number);
  if (normalizedType === 'CNPJ') return formatCNPJ(number);

  // Sem tipo explícito, infere pelo tamanho do valor normalizado.
  if (cleanDigits(number).length === 11) return formatCPF(number);
  if (cleanAlphanumeric(number).length === 14) return formatCNPJ(number);
  return number;
}

/**
 * Normaliza telefone para formato E.164 brasileiro (RF-02):
 * 55 + DDD (2 dígitos) + 8 ou 9 dígitos numéricos (apenas dígitos).
 * Ex: '5511987654321' ou '551134567890'.
 */
export function normalizePhoneE164(phone: string): string {
  const digits = cleanDigits(phone);
  if (!digits) return '';

  // Se já começar com 55 e tiver 12 ou 13 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Se tiver 10 (fixo com DDD) ou 11 (celular com DDD) dígitos
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Caso não se encaixe nos formatos válidos, retorna os dígitos limpos
  return digits;
}

/**
 * Verifica se um telefone é válido no padrão brasileiro (celular 9 dígitos ou fixo 8 dígitos com DDD).
 */
export function isValidPhoneBR(phone: string): boolean {
  const normalized = normalizePhoneE164(phone);
  // Deve ter 12 dígitos (55 + DDD + 8 dígitos) ou 13 dígitos (55 + DDD + 9 dígitos)
  if (normalized.length !== 12 && normalized.length !== 13) {
    return false;
  }

  // O DDD fica nas posições 2 e 3 (índices 2 e 3)
  const ddd = parseInt(normalized.substring(2, 4), 10);
  if (ddd < 11 || ddd > 99) return false;

  // Celular (13 dígitos) deve começar com 9 após o DDD
  if (normalized.length === 13) {
    const ninthDigit = normalized.charAt(4);
    if (ninthDigit !== '9') return false;
  }

  return true;
}

/**
 * Formata telefone E.164 ou numérico para exibição brasileira:
 * +55 (11) 98765-4321 (celular) ou +55 (11) 3456-7890 (fixo).
 */
export function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return '';
  const normalized = normalizePhoneE164(phone);

  if (normalized.length === 13) {
    // +55 (XX) XXXXX-XXXX
    return normalized.replace(/^55(\d{2})(\d{5})(\d{4})$/, '+55 ($1) $2-$3');
  }

  if (normalized.length === 12) {
    // +55 (XX) XXXX-XXXX
    return normalized.replace(/^55(\d{2})(\d{4})(\d{4})$/, '+55 ($1) $2-$3');
  }

  return phone;
}
