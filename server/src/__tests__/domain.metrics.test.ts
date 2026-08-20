import { describe, it, expect } from 'vitest';
import {
  calculateMRR,
  calculateReceivedThisMonth,
  calculateInvoicedThisMonth,
  calculateOverdue,
  calculateDelinquencyRate,
  calculateActiveClients,
  getPaymentAlerts,
  calculateBillingHistory6Months,
  calculateServiceDistribution,
  calculateMetricComparison,
  ContractForMetrics,
  PaymentForMetrics,
  ClientForMetrics,
} from '../domain/metrics.js';
import {
  interpolateWhatsAppMessage,
  generateWhatsAppUrl,
  WHATSAPP_TEMPLATES,
} from '../domain/whatsapp.js';

describe('Métricas de Domínio — Métricas e Fórmulas (RF-40 a RF-49)', () => {
  describe('RF-40: MRR', () => {
    it('soma valueCents apenas de contratos recorrentes e ativos', () => {
      const contracts: ContractForMetrics[] = [
        {
          id: 'c1',
          clientId: 'cli1',
          serviceType: 'Tráfego Pago',
          billingType: 'recorrente',
          valueCents: 250000,
          status: 'ativo',
        },
        {
          id: 'c2',
          clientId: 'cli2',
          serviceType: 'Social Media & Conteúdo',
          billingType: 'recorrente',
          valueCents: 350000,
          status: 'ativo',
        },
      ];

      expect(calculateMRR(contracts)).toBe(600000);
    });

    it('RF-40: MRR ignora contrato pausado', () => {
      const contracts: ContractForMetrics[] = [
        {
          id: 'c1',
          clientId: 'cli1',
          serviceType: 'Tráfego Pago',
          billingType: 'recorrente',
          valueCents: 250000,
          status: 'ativo',
        },
        {
          id: 'c2',
          clientId: 'cli2',
          serviceType: 'SEO',
          billingType: 'recorrente',
          valueCents: 150000,
          status: 'pausado',
        },
        {
          id: 'c3',
          clientId: 'cli3',
          serviceType: 'Branding',
          billingType: 'recorrente',
          valueCents: 500000,
          status: 'encerrado',
        },
      ];

      expect(calculateMRR(contracts)).toBe(250000);
    });

    it('RF-40: MRR ignora contrato pontual', () => {
      const contracts: ContractForMetrics[] = [
        {
          id: 'c1',
          clientId: 'cli1',
          serviceType: 'Tráfego Pago',
          billingType: 'recorrente',
          valueCents: 200000,
          status: 'ativo',
        },
        {
          id: 'c2',
          clientId: 'cli2',
          serviceType: 'Sites/Landing Pages',
          billingType: 'pontual',
          valueCents: 600000,
          status: 'ativo',
        },
      ];

      expect(calculateMRR(contracts)).toBe(200000);
    });
  });

  describe('RF-41 & RF-42: Recebido no mês (caixa) e Faturado no mês (competência)', () => {
    const currentMonth = '2026-05';
    const payments: PaymentForMetrics[] = [
      {
        id: 'p1',
        contractId: 'c1',
        number: 'COB-2026-0001',
        referenceMonth: '2026-05',
        dueDate: '2026-05-10',
        paidDate: '2026-05-09',
        amountCents: 200000,
        status: 'Pago',
      },
      {
        id: 'p2',
        contractId: 'c2',
        number: 'COB-2026-0002',
        referenceMonth: '2026-05',
        dueDate: '2026-05-20',
        paidDate: null,
        amountCents: 150000,
        status: 'Pendente',
      },
      {
        id: 'p3',
        contractId: 'c3',
        number: 'COB-2026-0003',
        referenceMonth: '2026-04',
        dueDate: '2026-04-30',
        paidDate: '2026-05-02', // Pago em maio, mas referente a abril
        amountCents: 100000,
        status: 'Pago',
      },
      {
        id: 'p4',
        contractId: 'c4',
        number: 'COB-2026-0004',
        referenceMonth: '2026-05',
        dueDate: '2026-05-15',
        paidDate: null,
        amountCents: 80000,
        status: 'Cancelado',
      },
    ];

    it('RF-41: Recebido no mês soma pagamentos cuja paidDate cai no mês corrente (regime de caixa)', () => {
      // p1 (200.000 pago em 09/05) + p3 (100.000 pago em 02/05) = 300.000
      expect(calculateReceivedThisMonth(payments, currentMonth)).toBe(300000);
    });

    it('RF-42: Faturado no mês soma cobranças com referenceMonth do mês corrente excluindo canceladas (regime de competência)', () => {
      // p1 (200.000) + p2 (150.000) = 350.000 (p4 está cancelada)
      expect(calculateInvoicedThisMonth(payments, currentMonth)).toBe(350000);
    });
  });

  describe('RF-43 & RF-43a: Inadimplência e Taxa de Inadimplência', () => {
    const today = '2026-05-15';
    const payments: PaymentForMetrics[] = [
      {
        id: 'p1',
        contractId: 'c1',
        number: 'COB-2026-0001',
        referenceMonth: '2026-05',
        dueDate: '2026-05-10', // Vencida
        paidDate: null,
        amountCents: 200000,
        status: 'Pendente',
      },
      {
        id: 'p2',
        contractId: 'c2',
        number: 'COB-2026-0002',
        referenceMonth: '2026-05',
        dueDate: '2026-05-14', // Vencida
        paidDate: null,
        amountCents: 150000,
        status: 'Pendente',
      },
      {
        id: 'p3',
        contractId: 'c3',
        number: 'COB-2026-0003',
        referenceMonth: '2026-05',
        dueDate: '2026-05-15', // Vence hoje -> NÃO é atrasada (RF-28)
        paidDate: null,
        amountCents: 100000,
        status: 'Pendente',
      },
      {
        id: 'p4',
        contractId: 'c4',
        number: 'COB-2026-0004',
        referenceMonth: '2026-05',
        dueDate: '2026-05-05', // Venceu no passado mas está paga
        paidDate: '2026-05-06',
        amountCents: 300000,
        status: 'Pago',
      },
    ];

    it('RF-43: inadimplência soma apenas pendentes vencidas (dueDate < hoje)', () => {
      const result = calculateOverdue(payments, today);
      expect(result.overdueCents).toBe(350000); // 200.000 + 150.000
      expect(result.overdueCount).toBe(2);
    });

    it('RF-43a: taxa de inadimplência calcula overdueCents / invoicedCents em percentual', () => {
      const rate = calculateDelinquencyRate(350000, 1000000);
      expect(rate).toBe(35); // 35.0%
    });

    it('RF-43a: taxa de inadimplência com invoicedCents = 0 não divide por zero', () => {
      expect(calculateDelinquencyRate(50000, 0)).toBe(0);
      expect(calculateDelinquencyRate(0, 0)).toBe(0);
    });
  });

  describe('RF-44: Clientes Ativos', () => {
    it('conta apenas clientes com ao menos um contrato ativo', () => {
      const clients: ClientForMetrics[] = [
        {
          id: 'cli1',
          name: 'Cliente 1',
          contracts: [{ status: 'ativo', serviceType: 'Tráfego Pago' }],
        },
        {
          id: 'cli2',
          name: 'Cliente 2',
          contracts: [
            { status: 'pausado', serviceType: 'SEO' },
            { status: 'ativo', serviceType: 'Social Media & Conteúdo' },
          ],
        },
        {
          id: 'cli3',
          name: 'Cliente 3',
          contracts: [{ status: 'pausado', serviceType: 'Branding' }],
        },
        {
          id: 'cli4',
          name: 'Cliente 4',
          contracts: [{ status: 'encerrado', serviceType: 'Sites/Landing Pages' }],
        },
        {
          id: 'cli5',
          name: 'Cliente 5',
          contracts: [],
        },
      ];

      expect(calculateActiveClients(clients)).toBe(2); // cli1 e cli2
    });
  });

  describe('RF-45: Alertas de Pagamento', () => {
    const today = '2026-05-15';
    const payments: PaymentForMetrics[] = [
      {
        id: 'p1',
        contractId: 'c1',
        number: 'COB-2026-0001',
        referenceMonth: '2026-05',
        dueDate: '2026-05-10', // 5 dias atrasada
        amountCents: 120000,
        status: 'Pendente',
        contract: {
          clientId: 'cli1',
          serviceType: 'Tráfego Pago',
          client: { id: 'cli1', name: 'Alpha Tech', phone: '5511999990001' },
        },
      },
      {
        id: 'p2',
        contractId: 'c2',
        number: 'COB-2026-0002',
        referenceMonth: '2026-05',
        dueDate: '2026-05-16', // Vence amanhã (em 1 dia)
        amountCents: 250000,
        status: 'Pendente',
        contract: {
          clientId: 'cli2',
          serviceType: 'Social Media & Conteúdo',
          client: { id: 'cli2', name: 'Beta Store', phone: '5511999990002' },
        },
      },
      {
        id: 'p3',
        contractId: 'c3',
        number: 'COB-2026-0003',
        referenceMonth: '2026-05',
        dueDate: '2026-05-22', // Vence em 7 dias
        amountCents: 300000,
        status: 'Pendente',
        contract: {
          clientId: 'cli3',
          serviceType: 'SEO',
          client: { id: 'cli3', name: 'Gamma Corp', phone: '5511999990003' },
        },
      },
      {
        id: 'p4',
        contractId: 'c4',
        number: 'COB-2026-0004',
        referenceMonth: '2026-05',
        dueDate: '2026-05-25', // Vence em 10 dias (fora dos 7 dias)
        amountCents: 400000,
        status: 'Pendente',
        contract: {
          clientId: 'cli4',
          serviceType: 'Branding',
          client: { id: 'cli4', name: 'Delta Ltda', phone: '5511999990004' },
        },
      },
      {
        id: 'p5',
        contractId: 'c5',
        number: 'COB-2026-0005',
        referenceMonth: '2026-05',
        dueDate: '2026-05-08',
        paidDate: '2026-05-08',
        amountCents: 500000,
        status: 'Pago', // Paga não entra em alertas
      },
    ];

    it('separa corretamente cobranças vencidas e a vencer nos próximos 7 dias', () => {
      const alerts = getPaymentAlerts(payments, today);
      expect(alerts.overdue).toHaveLength(1);
      expect(alerts.overdue[0].number).toBe('COB-2026-0001');
      expect(alerts.overdue[0].daysDiff).toBe(-5);

      expect(alerts.upcoming7Days).toHaveLength(2);
      expect(alerts.upcoming7Days[0].number).toBe('COB-2026-0002');
      expect(alerts.upcoming7Days[1].number).toBe('COB-2026-0003');
    });
  });

  describe('RF-46: Gráficos de Faturamento e Distribuição por Serviço', () => {
    it('calcula o faturamento e recebimento dos últimos 6 meses cronologicamente', () => {
      const currentMonth = '2026-06';
      const payments: PaymentForMetrics[] = [
        {
          id: 'p1',
          contractId: 'c1',
          number: 'COB-2026-0001',
          referenceMonth: '2026-01',
          dueDate: '2026-01-10',
          paidDate: '2026-01-10',
          amountCents: 100000,
          status: 'Pago',
        },
        {
          id: 'p2',
          contractId: 'c2',
          number: 'COB-2026-0002',
          referenceMonth: '2026-06',
          dueDate: '2026-06-10',
          paidDate: '2026-06-09',
          amountCents: 250000,
          status: 'Pago',
        },
      ];

      const history = calculateBillingHistory6Months(payments, currentMonth);
      expect(history).toHaveLength(6);
      expect(history[0].referenceMonth).toBe('2026-01');
      expect(history[5].referenceMonth).toBe('2026-06');
      expect(history[0].invoicedCents).toBe(100000);
      expect(history[0].receivedCents).toBe(100000);
      expect(history[5].invoicedCents).toBe(250000);
    });

    it('calcula a distribuição de clientes por serviço considerando clientes com contratos ativos', () => {
      const clients: ClientForMetrics[] = [
        {
          id: 'cli1',
          name: 'Cliente 1',
          contracts: [{ status: 'ativo', serviceType: 'Tráfego Pago' }],
        },
        {
          id: 'cli2',
          name: 'Cliente 2',
          contracts: [
            { status: 'ativo', serviceType: 'Tráfego Pago' },
            { status: 'ativo', serviceType: 'Social Media & Conteúdo' },
          ],
        },
        {
          id: 'cli3',
          name: 'Cliente 3',
          contracts: [{ status: 'ativo', serviceType: 'SEO' }],
        },
        {
          id: 'cli4',
          name: 'Cliente 4',
          contracts: [{ status: 'pausado', serviceType: 'Branding' }], // Não entra
        },
      ];

      const dist = calculateServiceDistribution(clients);
      expect(dist).toHaveLength(3);
      // Total de clientes ativos = 3 (cli1, cli2, cli3)
      // Tráfego Pago: 2 clientes (67%)
      // Social Media: 1 cliente (33%)
      // SEO: 1 cliente (33%)
      const trafego = dist.find((d) => d.serviceType === 'Tráfego Pago');
      expect(trafego?.clientCount).toBe(2);
      expect(trafego?.percentage).toBe(67);
    });
  });

  describe('RF-48: Comparativo vs Mês Anterior', () => {
    it('RF-48: sem snapshot anterior, o comparativo vem ausente (null) — não vem 0', () => {
      expect(calculateMetricComparison(4250000, null)).toBeNull();
      expect(calculateMetricComparison(4250000, undefined)).toBeNull();
    });

    it('calcula variação percentual corretamente quando há snapshot anterior', () => {
      // De 100.000 para 105.200 (+5.2%)
      const comp = calculateMetricComparison(105200, 100000);
      expect(comp).not.toBeNull();
      expect(comp?.diff).toBe(5200);
      expect(comp?.percentage).toBe(5.2);
    });

    it('calcula variação negativa corretamente', () => {
      // De 100.000 para 90.000 (-10.0%)
      const comp = calculateMetricComparison(90000, 100000);
      expect(comp?.diff).toBe(-10000);
      expect(comp?.percentage).toBe(-10);
    });
  });

  describe('Aritmética de Centavos', () => {
    it('aritmética em centavos não produz resto de arredondamento em 100 somas', () => {
      let sum = 0;
      const stepCents = 13333; // R$ 133,33 em centavos

      for (let i = 0; i < 100; i++) {
        sum += stepCents;
      }

      expect(sum).toBe(1333300);
      expect(Number.isInteger(sum)).toBe(true);
    });
  });
});

describe('WhatsApp de Domínio — Templates e Interpolação (RF-50 a RF-53)', () => {
  it('RF-51: possui os 4 templates canônicos', () => {
    expect(WHATSAPP_TEMPLATES.onboarding).toBeDefined();
    expect(WHATSAPP_TEMPLATES.lembrete_vencimento).toBeDefined();
    expect(WHATSAPP_TEMPLATES.envio_nf).toBeDefined();
    expect(WHATSAPP_TEMPLATES.personalizada).toBeDefined();
  });

  it('RF-52: substitui corretamente as variáveis nos modelos', () => {
    const text = WHATSAPP_TEMPLATES.lembrete_vencimento.templateText;
    const interpolated = interpolateWhatsAppMessage(text, {
      nome: 'TechCorp',
      valor: 'R$ 5.400,00',
      vencimento: '10/06/2026',
      mes_referencia: 'Junho de 2026',
      numero: 'COB-2026-0042',
      chave_pix: 'contato@agencia.com.br',
      tipo_chave_pix: 'E-mail',
    });

    expect(interpolated).toContain('TechCorp');
    expect(interpolated).toContain('R$ 5.400,00');
    expect(interpolated).toContain('10/06/2026');
    expect(interpolated).toContain('Junho de 2026');
    expect(interpolated).toContain('COB-2026-0042');
    expect(interpolated).toContain('contato@agencia.com.br');
    expect(interpolated).toContain('E-mail');
  });

  it('RF-50: gera o link wa.me com telefone E.164 e texto urlencoded', () => {
    const url = generateWhatsAppUrl('(11) 98765-4321', 'Olá, Mundo!');
    expect(url).toBe('https://wa.me/5511987654321?text=Ol%C3%A1%2C%20Mundo!');
  });
});
