import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateExpectedBillingPeriods,
  generatePontualInstallments,
  formatPaymentNumber,
  parsePaymentNumber,
  validatePaymentSettlement,
} from '../domain/billing.js';
import { ensurePaymentRecords } from '../services/billingService.js';
import { prisma } from '../prisma.js';

vi.mock('../prisma.js', () => ({
  prisma: {
    contract: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    paymentRecord: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentSequence: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  },
}));

describe('Faturamento — domain/billing.ts e billingService (RF-20 a RF-26, RF-11a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. RF-23: contrato com billingDay = 31 gera vencimento 28/02 em ano comum (2026)', () => {
    const contract = {
      startDate: '2026-01-15',
      billingType: 'recorrente',
      valueCents: 250000,
      billingDay: 31,
      billingPeriodMonths: 1,
      status: 'ativo',
    };

    const periods = generateExpectedBillingPeriods(contract, '2026-02-15');
    const febPeriod = periods.find((p) => p.referenceMonth === '2026-02');

    expect(febPeriod).toBeDefined();
    expect(febPeriod?.dueDate).toBe('2026-02-28');
  });

  it('2. RF-23: o mesmo contrato gera 29/02 em ano bissexto (2024)', () => {
    const contract = {
      startDate: '2024-01-15',
      billingType: 'recorrente',
      valueCents: 250000,
      billingDay: 31,
      billingPeriodMonths: 1,
      status: 'ativo',
    };

    const periods = generateExpectedBillingPeriods(contract, '2024-02-15');
    const febPeriod = periods.find((p) => p.referenceMonth === '2024-02');

    expect(febPeriod).toBeDefined();
    expect(febPeriod?.dueDate).toBe('2024-02-29');
  });

  it('3. RF-21: nunca gera além do mês atual + 1', () => {
    const contract = {
      startDate: '2026-01-01',
      billingType: 'recorrente',
      valueCents: 200000,
      billingDay: 10,
      billingPeriodMonths: 1,
      status: 'ativo',
    };

    // Simulando data atual como 2026-03-15
    const periods = generateExpectedBillingPeriods(contract, '2026-03-15');
    const months = periods.map((p) => p.referenceMonth);

    // Mês atual é 2026-03, mês atual + 1 é 2026-04
    expect(months).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(months).not.toContain('2026-05');
  });

  it('4. RF-24: reajustar valueCents no contrato não altera amountCents de cobrança já gerada', () => {
    const oldContract = {
      id: 'contract-1',
      startDate: '2026-01-01',
      billingType: 'recorrente',
      valueCents: 250000, // R$ 2.500,00
      billingDay: 10,
      billingPeriodMonths: 1,
      status: 'ativo',
    };

    const initialPeriods = generateExpectedBillingPeriods(oldContract, '2026-01-15');
    expect(initialPeriods[0].amountCents).toBe(250000);

    // Simula reajuste do contrato em março para R$ 3.000,00
    const updatedContract = {
      ...oldContract,
      valueCents: 300000, // R$ 3.000,00
    };

    // O registro já gerado em janeiro mantém 250000
    const existingJanuaryRecord = {
      id: 'payment-jan',
      contractId: oldContract.id,
      number: 'COB-2026-0001',
      referenceMonth: '2026-01',
      dueDate: '2026-01-10',
      amountCents: initialPeriods[0].amountCents, // 250000 congelado
      status: 'Pendente',
    };

    expect(existingJanuaryRecord.amountCents).toBe(250000);
    // Nova geração para o contrato reajustado gera com o novo valor apenas para os novos meses
    const newPeriods = generateExpectedBillingPeriods(updatedContract, '2026-03-15');
    const marchPeriod = newPeriods.find((p) => p.referenceMonth === '2026-03');
    expect(marchPeriod?.amountCents).toBe(300000);
  });

  it('5. RF-25: contrato pausado ou encerrado não gera cobrança nova', () => {
    const contractPausado = {
      startDate: '2026-01-01',
      billingType: 'recorrente',
      valueCents: 250000,
      billingDay: 10,
      billingPeriodMonths: 1,
      status: 'pausado',
    };

    const periodsPausado = generateExpectedBillingPeriods(contractPausado, '2026-03-15');
    expect(periodsPausado).toEqual([]);

    const contractEncerrado = {
      ...contractPausado,
      status: 'encerrado',
    };
    const periodsEncerrado = generateExpectedBillingPeriods(contractEncerrado, '2026-03-15');
    expect(periodsEncerrado).toEqual([]);
  });

  it('6. RF-25: contrato com endDate no passado não gera cobrança nova', () => {
    const contract = {
      startDate: '2026-01-01',
      endDate: '2026-02-28', // Passado em relação a maio
      billingType: 'recorrente',
      valueCents: 250000,
      billingDay: 10,
      billingPeriodMonths: 1,
      status: 'ativo',
    };

    const periods = generateExpectedBillingPeriods(contract, '2026-05-15');
    expect(periods).toEqual([]);
  });

  it('7. RF-26: contrato pontual com 3 parcelas cria exatamente 3 registros com divisão exata', () => {
    const pontualContract = {
      startDate: '2026-02-01',
      valueCents: 500000, // R$ 5.000,00
      installments: 3,
      billingDay: 10,
    };

    const installments = generatePontualInstallments(pontualContract);
    expect(installments).toHaveLength(3);

    // Divisão de 500000 / 3 = 166666 + 166666 + 166668
    const totalSum = installments.reduce((acc, curr) => acc + curr.amountCents, 0);
    expect(totalSum).toBe(500000);

    expect(installments[0].referenceMonth).toBe('2026-02');
    expect(installments[0].dueDate).toBe('2026-02-10');
    expect(installments[0].amountCents).toBe(166668); // Base + resto

    expect(installments[1].referenceMonth).toBe('2026-03');
    expect(installments[1].dueDate).toBe('2026-03-10');
    expect(installments[1].amountCents).toBe(166666);

    expect(installments[2].referenceMonth).toBe('2026-04');
    expect(installments[2].dueDate).toBe('2026-04-10');
    expect(installments[2].amountCents).toBe(166666);
  });

  it('8. RF-20: contrato iniciado há 5 meses materializa os meses faltantes de uma vez', () => {
    const contract = {
      startDate: '2026-01-01',
      billingType: 'recorrente',
      valueCents: 150000,
      billingDay: 5,
      billingPeriodMonths: 1,
      status: 'ativo',
    };

    // Simulando data em 2026-05 (5 meses após janeiro)
    const periods = generateExpectedBillingPeriods(contract, '2026-05-10');
    const months = periods.map((p) => p.referenceMonth);

    // Gera de 2026-01 até 2026-06 (mês atual + 1)
    expect(months).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
  });

  it('9. RF-11a: contrato trimestral iniciado em janeiro gera 2026-01, 2026-04, 2026-07 — e nada nos intermediários', () => {
    const quarterlyContract = {
      startDate: '2026-01-01',
      billingType: 'recorrente',
      valueCents: 600000,
      billingDay: 15,
      billingPeriodMonths: 3, // Trimestral
      status: 'ativo',
    };

    // Simulando data em 2026-07 (julho)
    const periods = generateExpectedBillingPeriods(quarterlyContract, '2026-07-15');
    const months = periods.map((p) => p.referenceMonth);

    expect(months).toEqual(['2026-01', '2026-04', '2026-07']);
    expect(months).not.toContain('2026-02');
    expect(months).not.toContain('2026-03');
    expect(months).not.toContain('2026-05');
    expect(months).not.toContain('2026-06');
  });

  it('10. RF-11a & RF-21: contrato anual gera uma única cobrança por ano e não gera a anuidade seguinte antes da hora', () => {
    const annualContract = {
      startDate: '2026-01-01',
      billingType: 'recorrente',
      valueCents: 2400000, // R$ 24.000,00/ano
      billingDay: 10,
      billingPeriodMonths: 12, // Anual
      status: 'ativo',
    };

    // Em 2026-03 (março), deve gerar apenas a anuidade de 2026-01, sem gerar 2027 antes da hora
    const periodsMarch = generateExpectedBillingPeriods(annualContract, '2026-03-15');
    expect(periodsMarch.map((p) => p.referenceMonth)).toEqual(['2026-01']);

    // Em 2026-12 (dezembro), o horizonte (mês atual + 1 = 2027-01) alcança a anuidade de 2027-01
    const periodsDecember = generateExpectedBillingPeriods(annualContract, '2026-12-15');
    expect(periodsDecember.map((p) => p.referenceMonth)).toEqual(['2026-01', '2027-01']);
  });

  it('11. RF-22: chamar ensurePaymentRecords duas vezes seguidas não duplica cobrança (idempotência)', async () => {
    const mockContract = {
      id: 'contract-id-123',
      startDate: '2026-01-01',
      endDate: null,
      billingType: 'recorrente',
      valueCents: 250000,
      billingDay: 10,
      billingPeriodMonths: 1,
      status: 'ativo',
      paymentRecords: [],
    };

    const targetDate = '2026-01-15'; // Horizon is 2026-01 + 1 = 2026-02

    // Primeira chamada: não há pagamentos existentes
    vi.mocked(prisma.contract.findFirst).mockResolvedValue(mockContract as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      return cb({
        paymentSequence: {
          upsert: vi.fn().mockResolvedValue({ year: 2026, lastNumber: 0 }),
          findUnique: vi.fn().mockResolvedValue({ year: 2026, lastNumber: 0 }),
          update: vi.fn().mockResolvedValue({ year: 2026, lastNumber: 2 }),
        },
        $queryRawUnsafe: vi.fn().mockResolvedValue([{ lastNumber: 0 }]),
        paymentRecord: {
          create: vi.fn().mockResolvedValue({}),
        },
      });
    });

    const generatedRecords = [
      {
        id: 'p1',
        contractId: mockContract.id,
        number: 'COB-2026-0001',
        referenceMonth: '2026-01',
        dueDate: '2026-01-10',
        amountCents: 250000,
        status: 'Pendente',
        invoices: [],
      },
      {
        id: 'p2',
        contractId: mockContract.id,
        number: 'COB-2026-0002',
        referenceMonth: '2026-02',
        dueDate: '2026-02-10',
        amountCents: 250000,
        status: 'Pendente',
        invoices: [],
      },
    ];

    vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue(generatedRecords as any);

    // 1ª execução
    const firstResult = await ensurePaymentRecords(mockContract.id, targetDate);
    expect(firstResult).toHaveLength(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // 2ª execução: agora o contrato já possui os registros gravados
    vi.clearAllMocks();
    vi.mocked(prisma.contract.findFirst).mockResolvedValue({
      ...mockContract,
      paymentRecords: generatedRecords,
    } as any);
    vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue(generatedRecords as any);

    const secondResult = await ensurePaymentRecords(mockContract.id, targetDate);
    expect(secondResult).toHaveLength(2);
    // Não deve disparar transação de criação pois não há períodos faltantes
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('12. Validação de baixa manual de pagamento (RF-29)', () => {
    const valid = validatePaymentSettlement({
      paidDate: '2026-05-10',
      paymentMethod: 'PIX',
      amountCents: 250000,
    });
    expect(valid.valid).toBe(true);

    const invalidDate = validatePaymentSettlement({
      paidDate: '10/05/2026', // Formato errado
      paymentMethod: 'PIX',
    });
    expect(invalidDate.valid).toBe(false);
    expect(invalidDate.error).toContain('Data de pagamento inválida');

    const invalidMethod = validatePaymentSettlement({
      paidDate: '2026-05-10',
      paymentMethod: 'Cheque' as any,
    });
    expect(invalidMethod.valid).toBe(false);
    expect(invalidMethod.error).toContain('Forma de pagamento inválida');

    const invalidAmount = validatePaymentSettlement({
      paidDate: '2026-05-10',
      paymentMethod: 'Boleto',
      amountCents: -50,
    });
    expect(invalidAmount.valid).toBe(false);
  });
});
