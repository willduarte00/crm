/**
 * Utilitários e formatadores em pt-BR (RF-01, RF-02 e requisitos não funcionais).
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
 * Normaliza o documento conforme o tipo, antes de validar ou enviar à API:
 * CPF mantém apenas dígitos; CNPJ aceita letras e dígitos, em maiúsculas.
 */
export function normalizeDocument(
  value: string | null | undefined,
  type: 'CPF' | 'CNPJ' | string
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
 * Validação de CPF com cálculo de dígitos verificadores.
 */
export function validateCPF(cpf: string): boolean {
  const digits = cleanDigits(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== parseInt(digits[9], 10)) return false;

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
 * Validação de CNPJ com cálculo de dígitos verificadores.
 *
 * Aceita o formato alfanumérico da IN RFB nº 2.229/2024, em vigor desde 31/07/2026:
 * 12 posições em [A-Z0-9] seguidas de 2 dígitos verificadores numéricos.
 * CNPJs totalmente numéricos continuam válidos, com o mesmo cálculo.
 */
export function validateCNPJ(cnpj: string): boolean {
  const value = cleanAlphanumeric(cnpj);
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(value)) return false;
  if (value.split('').every((char) => char === value[0])) return false;

  const values = value.split('').map(documentCharValue);

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += values[i] * weights1[i];
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== values[12]) return false;

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

export function validateDocument(number: string, type: 'CPF' | 'CNPJ' | string): boolean {
  if (type.toUpperCase() === 'CPF') return validateCPF(number);
  if (type.toUpperCase() === 'CNPJ') return validateCNPJ(number);
  return false;
}

export function formatCPF(cpf: string | null | undefined): string {
  const digits = cleanDigits(cpf);
  if (digits.length !== 11) return cpf || '';
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatCNPJ(cnpj: string | null | undefined): string {
  const value = cleanAlphanumeric(cnpj);
  if (value.length !== 14) return cnpj || '';
  return value.replace(
    /^([A-Z0-9]{2})([A-Z0-9]{3})([A-Z0-9]{3})([A-Z0-9]{4})([0-9]{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

export function formatDocument(number: string | null | undefined, type?: string): string {
  if (!number) return '';
  const normalizedType = type?.toUpperCase();
  if (normalizedType === 'CPF') return formatCPF(number);
  if (normalizedType === 'CNPJ') return formatCNPJ(number);

  // Sem tipo explícito, infere pelo tamanho do valor normalizado.
  if (cleanDigits(number).length === 11) return formatCPF(number);
  if (cleanAlphanumeric(number).length === 14) return formatCNPJ(number);
  return number;
}

/**
 * Máscara dinâmica em tempo real para CPF/CNPJ enquanto o usuário digita.
 * O CNPJ aceita letras nas 12 primeiras posições; os 2 dígitos verificadores
 * continuam numéricos (IN RFB nº 2.229/2024).
 */
export function maskDocumentInput(value: string, type: 'CPF' | 'CNPJ'): string {
  if (type === 'CPF') {
    const digits = cleanDigits(value).slice(0, 11);
    let maskedCpf = digits.slice(0, 3);
    if (digits.length > 3) maskedCpf += '.' + digits.slice(3, 6);
    if (digits.length > 6) maskedCpf += '.' + digits.slice(6, 9);
    if (digits.length > 9) maskedCpf += '-' + digits.slice(9, 11);
    return maskedCpf;
  }

  const chars = cleanAlphanumeric(value).slice(0, 14);
  const base = chars.slice(0, 12);
  const checkDigits = cleanDigits(chars.slice(12));
  const raw = base + checkDigits;

  let masked = raw.slice(0, 2);
  if (raw.length > 2) masked += '.' + raw.slice(2, 5);
  if (raw.length > 5) masked += '.' + raw.slice(5, 8);
  if (raw.length > 8) masked += '/' + raw.slice(8, 12);
  if (raw.length > 12) masked += '-' + raw.slice(12, 14);
  return masked;
}

/**
 * Normaliza telefone para E.164 brasileiro (RF-02):
 * 55 + DDD + número.
 */
export function normalizePhoneE164(phone: string): string {
  const digits = cleanDigits(phone);
  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Formata telefone para exibição: +55 (11) 98765-4321 ou +55 (11) 3456-7890.
 */
export function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone) return '';
  const normalized = normalizePhoneE164(phone);

  if (normalized.length === 13) {
    return normalized.replace(/^55(\d{2})(\d{5})(\d{4})$/, '+55 ($1) $2-$3');
  }
  if (normalized.length === 12) {
    return normalized.replace(/^55(\d{2})(\d{4})(\d{4})$/, '+55 ($1) $2-$3');
  }
  return phone;
}

/**
 * Máscara dinâmica em tempo real para telefone enquanto o usuário digita.
 */
export function maskPhoneInput(value: string): string {
  let digits = cleanDigits(value);
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);

  if (digits.length <= 10) {
    // Fixo (XX) XXXX-XXXX
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  } else {
    // Celular (XX) XXXXX-XXXX
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  }
}

/**
 * Formatação de data civil YYYY-MM-DD para dd/mm/aaaa.
 */
export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

/**
 * Formatação de timestamp para dd/mm/aaaa às HH:mm.
 */
export function formatDateTimeBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const datePart = date.toLocaleDateString('pt-BR');
    const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} às ${timePart}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formatação de valor em centavos para moeda brasileira: R$ 1.234,56
 */
export function formatCurrencyBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return 'R$ 0,00';
  }
  const value = cents / 100;
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte string digitada em formato pt-BR (ex: "2.500,00" ou "2500,00") para centavos inteiros (ex: 250000).
 */
export function parseBRLToCents(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/[^\d]/g, '');
  return parseInt(clean, 10) || 0;
}

/**
 * Formata tamanho de arquivo em bytes para formato legível (KB, MB).
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const MONTH_NAMES_BR = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Formata mês de referência YYYY-MM para "Maio de 2026".
 */
export function formatReferenceMonthBR(refMonth: string | null | undefined): string {
  if (!refMonth || !/^\d{4}-\d{2}$/.test(refMonth)) return refMonth || '-';
  const [year, monthStr] = refMonth.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES_BR[monthIdx] || monthStr;
  return `${monthName} de ${year}`;
}

/**
 * Formata mês de referência YYYY-MM para "05/2026".
 */
export function formatReferenceMonthShort(refMonth: string | null | undefined): string {
  if (!refMonth || !/^\d{4}-\d{2}$/.test(refMonth)) return refMonth || '-';
  const [year, monthStr] = refMonth.split('-');
  return `${monthStr}/${year}`;
}

