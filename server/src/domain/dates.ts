/**
 * Regras de negócio puras para datas civis e faturamento (RF-23, RF-28, P5).
 * Sem Express e sem Prisma.
 *
 * Datas civis são sempre strings no formato YYYY-MM-DD.
 * Meses de referência são strings no formato YYYY-MM.
 */

/**
 * Verifica se um ano é bissexto.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Retorna o último dia do mês para um determinado ano e mês (1 a 12).
 * Trata ano bissexto (29/02 vs 28/02) e meses de 30/31 dias (RF-23).
 */
export function getLastDayOfMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  return 31;
}

/**
 * Calcula a data de vencimento civil no formato YYYY-MM-DD.
 * Aplica a regra de mês curto: dueDate = min(billingDay, últimoDiaDoMês) (RF-23).
 */
export function calculateDueDate(year: number, month: number, billingDay: number): string {
  const lastDay = getLastDayOfMonth(year, month);
  const day = Math.min(Math.max(1, billingDay), lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Obtém a data civil atual no formato YYYY-MM-DD no fuso de Brasília (America/Sao_Paulo, UTC−3) (P5).
 */
export function getTodayCivilDate(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Obtém o mês de referência atual (YYYY-MM) no fuso de Brasília (P5).
 */
export function getCurrentReferenceMonth(now: Date = new Date()): string {
  return getTodayCivilDate(now).slice(0, 7);
}

/**
 * Faz parse de uma data civil YYYY-MM-DD.
 */
export function parseCivilDate(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
    day: parseInt(parts[2], 10),
  };
}

/**
 * Faz parse de um mês de referência YYYY-MM.
 */
export function parseReferenceMonth(refMonth: string): { year: number; month: number } {
  const parts = refMonth.split('-');
  return {
    year: parseInt(parts[0], 10),
    month: parseInt(parts[1], 10),
  };
}

/**
 * Formata ano e mês como YYYY-MM.
 */
export function formatReferenceMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Formata ano, mês e dia como YYYY-MM-DD.
 */
export function formatCivilDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Adiciona (ou subtrai) uma quantidade de meses a um mês de referência YYYY-MM.
 */
export function addMonthsToReferenceMonth(refMonth: string, monthsToAdd: number): string {
  const { year, month } = parseReferenceMonth(refMonth);
  const totalMonths = year * 12 + (month - 1) + monthsToAdd;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (((totalMonths % 12) + 12) % 12) + 1;
  return formatReferenceMonth(newYear, newMonth);
}

/**
 * Adiciona meses a uma data civil YYYY-MM-DD, ajustando para o último dia do mês se necessário.
 */
export function addMonthsToCivilDate(
  dateStr: string,
  monthsToAdd: number,
  targetBillingDay?: number
): string {
  const { year, month, day } = parseCivilDate(dateStr);
  const targetRef = addMonthsToReferenceMonth(formatReferenceMonth(year, month), monthsToAdd);
  const { year: newYear, month: newMonth } = parseReferenceMonth(targetRef);
  const billingDay = targetBillingDay !== undefined ? targetBillingDay : day;
  return calculateDueDate(newYear, newMonth, billingDay);
}

/**
 * Verifica se uma cobrança está atrasada (RF-28).
 * Atrasado é estritamente derivado: status === 'Pendente' && dueDate < hoje.
 */
export function isPaymentOverdue(status: string, dueDate: string, today?: string): boolean {
  const currentToday = today || getTodayCivilDate();
  return status === 'Pendente' && dueDate < currentToday;
}

/**
 * Retorna o status efetivo para exibição e métricas (RF-27, RF-28):
 * - 'Pago' se status === 'Pago'
 * - 'Cancelado' se status === 'Cancelado'
 * - 'Atrasado' se status === 'Pendente' e dueDate < hoje
 * - 'Pendente' se status === 'Pendente' e dueDate >= hoje
 */
export function getEffectivePaymentStatus(
  status: string,
  dueDate: string,
  today?: string
): 'Pendente' | 'Atrasado' | 'Pago' | 'Cancelado' {
  if (status === 'Pago') return 'Pago';
  if (status === 'Cancelado') return 'Cancelado';
  if (status === 'Pendente' && isPaymentOverdue(status, dueDate, today)) {
    return 'Atrasado';
  }
  return 'Pendente';
}

/**
 * Compara duas datas civis ou meses de referência em ordem cronológica (-1, 0, 1).
 */
export function compareCivilDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
