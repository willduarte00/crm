import { describe, it, expect } from 'vitest';
import {
  isLeapYear,
  getLastDayOfMonth,
  calculateDueDate,
  getTodayCivilDate,
  getCurrentReferenceMonth,
  addMonthsToReferenceMonth,
  addMonthsToCivilDate,
  isPaymentOverdue,
  getEffectivePaymentStatus,
} from '../domain/dates.js';

describe('Status e datas — domain/dates.ts (RF-28, P5)', () => {
  it('1. RF-28: cobrança pendente com vencimento ontem aparece como atrasada', () => {
    const today = '2026-05-15';
    const dueDate = '2026-05-14'; // ontem
    const status = 'Pendente';

    expect(isPaymentOverdue(status, dueDate, today)).toBe(true);
    expect(getEffectivePaymentStatus(status, dueDate, today)).toBe('Atrasado');
  });

  it('2. RF-28: cobrança pendente com vencimento hoje não aparece como atrasada', () => {
    const today = '2026-05-15';
    const dueDate = '2026-05-15'; // hoje
    const status = 'Pendente';

    expect(isPaymentOverdue(status, dueDate, today)).toBe(false);
    expect(getEffectivePaymentStatus(status, dueDate, today)).toBe('Pendente');
  });

  it('3. RF-28: cobrança pendente com vencimento amanhã não aparece como atrasada', () => {
    const today = '2026-05-15';
    const dueDate = '2026-05-16'; // amanhã
    const status = 'Pendente';

    expect(isPaymentOverdue(status, dueDate, today)).toBe(false);
    expect(getEffectivePaymentStatus(status, dueDate, today)).toBe('Pendente');
  });

  it('4. RF-28: cobrança paga com vencimento no passado não aparece como atrasada', () => {
    const today = '2026-05-15';
    const dueDate = '2026-04-10'; // passado
    const status = 'Pago';

    expect(isPaymentOverdue(status, dueDate, today)).toBe(false);
    expect(getEffectivePaymentStatus(status, dueDate, today)).toBe('Pago');
  });

  it('5. RF-28: cobrança cancelada com vencimento no passado não aparece como atrasada', () => {
    const today = '2026-05-15';
    const dueDate = '2026-04-10';
    const status = 'Cancelado';

    expect(isPaymentOverdue(status, dueDate, today)).toBe(false);
    expect(getEffectivePaymentStatus(status, dueDate, today)).toBe('Cancelado');
  });

  it('6. P5: cálculo correto na virada do dia em UTC−3 (fuso de Brasília)', () => {
    // 2026-05-10T23:30:00-03:00 é 2026-05-11T02:30:00Z em UTC
    const dateNight = new Date('2026-05-10T23:30:00-03:00');
    expect(getTodayCivilDate(dateNight)).toBe('2026-05-10');
    expect(getCurrentReferenceMonth(dateNight)).toBe('2026-05');

    // 2026-05-11T00:15:00-03:00 é 2026-05-11T03:15:00Z em UTC
    const dateMorning = new Date('2026-05-11T00:15:00-03:00');
    expect(getTodayCivilDate(dateMorning)).toBe('2026-05-11');
    expect(getCurrentReferenceMonth(dateMorning)).toBe('2026-05');
  });

  it('7. Identifica corretamente anos bissextos', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });

  it('8. RF-23: Retorna o último dia correto do mês (ano comum vs bissexto)', () => {
    expect(getLastDayOfMonth(2026, 2)).toBe(28); // Comum
    expect(getLastDayOfMonth(2024, 2)).toBe(29); // Bissexto
    expect(getLastDayOfMonth(2026, 1)).toBe(31); // Janeiro
    expect(getLastDayOfMonth(2026, 4)).toBe(30); // Abril
    expect(getLastDayOfMonth(2026, 7)).toBe(31); // Julho
    expect(getLastDayOfMonth(2026, 8)).toBe(31); // Agosto
    expect(getLastDayOfMonth(2026, 12)).toBe(31); // Dezembro
  });

  it('9. RF-23: calculateDueDate respeita min(billingDay, últimoDiaDoMês)', () => {
    // Dia 31 em fevereiro de ano comum -> 28
    expect(calculateDueDate(2026, 2, 31)).toBe('2026-02-28');
    // Dia 31 em fevereiro de ano bissexto -> 29
    expect(calculateDueDate(2024, 2, 31)).toBe('2024-02-29');
    // Dia 31 em abril (30 dias) -> 30
    expect(calculateDueDate(2026, 4, 31)).toBe('2026-04-30');
    // Dia 15 em qualquer mês -> 15
    expect(calculateDueDate(2026, 2, 15)).toBe('2026-02-15');
  });

  it('10. addMonthsToReferenceMonth avança e retrocede meses corretamente cruzando anos', () => {
    expect(addMonthsToReferenceMonth('2026-01', 1)).toBe('2026-02');
    expect(addMonthsToReferenceMonth('2026-11', 2)).toBe('2027-01');
    expect(addMonthsToReferenceMonth('2026-01', 12)).toBe('2027-01');
    expect(addMonthsToReferenceMonth('2026-03', -4)).toBe('2025-11');
  });

  it('11. addMonthsToCivilDate adiciona meses preservando ou ajustando dia de vencimento', () => {
    expect(addMonthsToCivilDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToCivilDate('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsToCivilDate('2026-01-10', 3)).toBe('2026-04-10');
  });
});
