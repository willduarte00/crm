import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatPaymentNumber,
  parsePaymentNumber,
} from '../domain/billing.js';
import { getNextPaymentNumbers } from '../services/billingService.js';

describe('Numeração de cobranças — domain/billing.ts e billingService (RF-32)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. RF-32: formatação e parse de número de cobrança no formato COB-AAAA-NNNN', () => {
    expect(formatPaymentNumber(2026, 1)).toBe('COB-2026-0001');
    expect(formatPaymentNumber(2026, 42)).toBe('COB-2026-0042');
    expect(formatPaymentNumber(2026, 9999)).toBe('COB-2026-9999');
    expect(formatPaymentNumber(2027, 1)).toBe('COB-2027-0001');

    const parsed = parsePaymentNumber('COB-2026-0150');
    expect(parsed).toEqual({ year: 2026, sequence: 150 });

    expect(parsePaymentNumber('INVALID-NUMBER')).toBeNull();
  });

  it('2. RF-32: geração de 5 meses produz 5 números distintos e sequenciais', async () => {
    let mockSequenceState = 0;

    const mockTx = {
      paymentSequence: {
        upsert: vi.fn().mockResolvedValue({ year: 2026, lastNumber: mockSequenceState }),
        findUnique: vi.fn().mockImplementation(() => ({ year: 2026, lastNumber: mockSequenceState })),
        update: vi.fn().mockImplementation(({ data }: any) => {
          mockSequenceState = data.lastNumber;
          return { year: 2026, lastNumber: mockSequenceState };
        }),
      },
      $queryRawUnsafe: vi.fn().mockImplementation(() => [{ lastNumber: mockSequenceState }]),
    };

    const numbers = await getNextPaymentNumbers(mockTx, 2026, 5);

    expect(numbers).toHaveLength(5);
    expect(numbers).toEqual([
      'COB-2026-0001',
      'COB-2026-0002',
      'COB-2026-0003',
      'COB-2026-0004',
      'COB-2026-0005',
    ]);
    expect(mockSequenceState).toBe(5);
  });

  it('3. RF-32: duas criações concorrentes não geram número repetido', async () => {
    let dbLastNumber = 10; // Começando em 10
    let lockPromise: Promise<void> = Promise.resolve();

    const createMockTx = () => ({
      paymentSequence: {
        upsert: vi.fn().mockResolvedValue({ year: 2026, lastNumber: dbLastNumber }),
        findUnique: vi.fn().mockImplementation(() => ({ year: 2026, lastNumber: dbLastNumber })),
        update: vi.fn().mockImplementation(({ data }: any) => {
          dbLastNumber = data.lastNumber;
          return { year: 2026, lastNumber: dbLastNumber };
        }),
      },
      $queryRawUnsafe: vi.fn().mockImplementation(async () => {
        // Simula a fila de bloqueio exclusivo (SELECT ... FOR UPDATE) no Postgres
        let unlock: () => void;
        const acquired = new Promise<void>((resolve) => {
          unlock = resolve;
        });
        const prev = lockPromise;
        lockPromise = acquired;
        await prev;

        const val = [{ lastNumber: dbLastNumber }];
        setTimeout(() => unlock(), 5);
        return val;
      }),
    });

    // Chamada A pede 2 números, Chamada B pede 3 números simultaneamente
    const txA = createMockTx();
    const txB = createMockTx();

    const [numbersA, numbersB] = await Promise.all([
      getNextPaymentNumbers(txA, 2026, 2),
      getNextPaymentNumbers(txB, 2026, 3),
    ]);

    // As duas listas devem ter números únicos entre si
    const allGenerated = [...numbersA, ...numbersB];
    const uniqueSet = new Set(allGenerated);

    expect(allGenerated).toHaveLength(5);
    expect(uniqueSet.size).toBe(5);
    expect(dbLastNumber).toBe(15);
  });

  it('4. RF-32: a sequência reinicia em 0001 na virada do ano', async () => {
    const sequencesByYear: Record<number, number> = {
      2026: 850, // Final de 2026 terminou em 850
      2027: 0, // Novo ano 2027 inicia em 0
    };

    const mockTx = {
      paymentSequence: {
        upsert: vi.fn().mockImplementation(({ where }: any) => ({
          year: where.year,
          lastNumber: sequencesByYear[where.year] || 0,
        })),
        findUnique: vi.fn().mockImplementation(({ where }: any) => ({
          year: where.year,
          lastNumber: sequencesByYear[where.year] || 0,
        })),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          sequencesByYear[where.year] = data.lastNumber;
          return { year: where.year, lastNumber: data.lastNumber };
        }),
      },
      $queryRawUnsafe: vi.fn().mockImplementation((_query: string, year: number) => [
        { lastNumber: sequencesByYear[year] || 0 },
      ]),
    };

    // Último número de 2026
    const num2026 = await getNextPaymentNumbers(mockTx, 2026, 1);
    expect(num2026).toEqual(['COB-2026-0851']);

    // Primeiro número de 2027
    const num2027 = await getNextPaymentNumbers(mockTx, 2027, 1);
    expect(num2027).toEqual(['COB-2027-0001']);
  });

  it('5. RF-32: cancelar uma cobrança não libera o número para reuso', async () => {
    let sequenceCounter = 5;

    const mockTx = {
      paymentSequence: {
        upsert: vi.fn().mockResolvedValue({ year: 2026, lastNumber: sequenceCounter }),
        findUnique: vi.fn().mockImplementation(() => ({ year: 2026, lastNumber: sequenceCounter })),
        update: vi.fn().mockImplementation(({ data }: any) => {
          sequenceCounter = data.lastNumber;
          return { year: 2026, lastNumber: sequenceCounter };
        }),
      },
      $queryRawUnsafe: vi.fn().mockImplementation(() => [{ lastNumber: sequenceCounter }]),
    };

    // Gera COB-2026-0006
    const [num6] = await getNextPaymentNumbers(mockTx, 2026, 1);
    expect(num6).toBe('COB-2026-0006');
    expect(sequenceCounter).toBe(6);

    // Simula cancelamento da cobrança COB-2026-0006 (apenas status muda para 'Cancelado')
    const cancelledRecord = {
      id: 'pay-6',
      number: num6,
      status: 'Cancelado',
    };
    expect(cancelledRecord.status).toBe('Cancelado');
    expect(cancelledRecord.number).toBe('COB-2026-0006');

    // A próxima cobrança gerada DEVE ser COB-2026-0007, nunca 0006
    const [num7] = await getNextPaymentNumbers(mockTx, 2026, 1);
    expect(num7).toBe('COB-2026-0007');
    expect(sequenceCounter).toBe(7);
  });
});
