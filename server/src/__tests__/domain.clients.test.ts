import { describe, it, expect } from 'vitest';
import {
  validateCPF,
  validateCNPJ,
  normalizeDocument,
  validateDocument,
  formatCPF,
  formatCNPJ,
  formatDocument,
  normalizePhoneE164,
  isValidPhoneBR,
  formatPhoneBR,
  LEAD_SOURCES,
  PIPELINE_STAGES,
  PRIORITIES,
} from '../domain/clients.js';

describe('Domain — Clientes e Leads (Funções Puras)', () => {
  describe('Validação de CPF (RF-01)', () => {
    it('deve validar CPFs válidos com cálculo correto de dígitos verificadores', () => {
      // CPFs válidos de teste
      expect(validateCPF('52998224725')).toBe(true);
      expect(validateCPF('529.982.247-25')).toBe(true);
      expect(validateCPF('11144477735')).toBe(true);
    });

    it('deve rejeitar CPFs com dígitos verificadores incorretos', () => {
      expect(validateCPF('52998224720')).toBe(false);
      expect(validateCPF('11144477700')).toBe(false);
      expect(validateCPF('12345678900')).toBe(false);
    });

    it('deve rejeitar CPFs com sequências de dígitos idênticos repetidos', () => {
      expect(validateCPF('00000000000')).toBe(false);
      expect(validateCPF('11111111111')).toBe(false);
      expect(validateCPF('22222222222')).toBe(false);
      expect(validateCPF('99999999999')).toBe(false);
    });

    it('deve rejeitar CPFs com tamanho inválido', () => {
      expect(validateCPF('123')).toBe(false);
      expect(validateCPF('123456789012')).toBe(false);
      expect(validateCPF('')).toBe(false);
    });
  });

  describe('Validação de CNPJ (RF-01)', () => {
    it('deve validar CNPJs válidos com cálculo correto de dígitos verificadores', () => {
      // CNPJs válidos de teste
      expect(validateCNPJ('11222333000181')).toBe(true);
      expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
      expect(validateCNPJ('12345678000195')).toBe(true);
      expect(validateCNPJ('00000000000191')).toBe(true); // Banco do Brasil
    });

    it('deve rejeitar CNPJs com dígitos verificadores incorretos', () => {
      expect(validateCNPJ('11222333000100')).toBe(false);
      expect(validateCNPJ('12345678000100')).toBe(false);
    });

    it('deve rejeitar CNPJs com dígitos idênticos repetidos', () => {
      expect(validateCNPJ('00000000000000')).toBe(false);
      expect(validateCNPJ('11111111111111')).toBe(false);
    });

    it('deve rejeitar CNPJs com tamanho inválido', () => {
      expect(validateCNPJ('123')).toBe(false);
      expect(validateCNPJ('123456789012345')).toBe(false);
    });

    it('deve validar CNPJ alfanumérico (IN RFB nº 2.229/2024)', () => {
      expect(validateCNPJ('LHILRC2X000188')).toBe(true);
      expect(validateCNPJ('LH.ILR.C2X/0001-88')).toBe(true);
      expect(validateCNPJ('12ABC34501DE35')).toBe(true);
    });

    it('deve aceitar CNPJ alfanumérico em minúsculas, normalizando para maiúsculas', () => {
      expect(validateCNPJ('lh.ilr.c2x/0001-88')).toBe(true);
    });

    it('deve rejeitar CNPJ alfanumérico com dígito verificador incorreto', () => {
      expect(validateCNPJ('LHILRC2X000100')).toBe(false);
      expect(validateCNPJ('12ABC34501DE00')).toBe(false);
    });

    it('deve rejeitar CNPJ com letra nas posições dos dígitos verificadores', () => {
      expect(validateCNPJ('LHILRC2X0001AB')).toBe(false);
    });

    it('deve rejeitar CNPJ com caracteres fora de [A-Z0-9]', () => {
      expect(validateCNPJ('LH-ILR-C2X-0001-8@')).toBe(false);
      expect(validateCNPJ('LHILRÇ2X000188')).toBe(false);
    });
  });

  describe('Formatação de Documentos', () => {
    it('deve formatar CPF corretamente', () => {
      expect(formatCPF('52998224725')).toBe('529.982.247-25');
      expect(formatDocument('52998224725', 'CPF')).toBe('529.982.247-25');
    });

    it('deve formatar CNPJ corretamente', () => {
      expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81');
      expect(formatDocument('11222333000181', 'CNPJ')).toBe('11.222.333/0001-81');
    });

    it('deve formatar CNPJ alfanumérico corretamente', () => {
      expect(formatCNPJ('LHILRC2X000188')).toBe('LH.ILR.C2X/0001-88');
      expect(formatDocument('LHILRC2X000188', 'CNPJ')).toBe('LH.ILR.C2X/0001-88');
      expect(formatDocument('LHILRC2X000188')).toBe('LH.ILR.C2X/0001-88');
    });

    it('deve normalizar documento conforme o tipo', () => {
      expect(normalizeDocument('lh.ilr.c2x/0001-88', 'CNPJ')).toBe('LHILRC2X000188');
      expect(normalizeDocument('529.982.247-25', 'CPF')).toBe('52998224725');
    });
  });

  describe('Telefone e Normalização E.164 (RF-02)', () => {
    it('deve normalizar celular com DDD para E.164 (55 + DDD + 9 dígitos)', () => {
      expect(normalizePhoneE164('(11) 98765-4321')).toBe('5511987654321');
      expect(normalizePhoneE164('11987654321')).toBe('5511987654321');
      expect(normalizePhoneE164('+55 (11) 98765-4321')).toBe('5511987654321');
      expect(normalizePhoneE164('5511987654321')).toBe('5511987654321');
    });

    it('deve normalizar telefone fixo com DDD para E.164 (55 + DDD + 8 dígitos)', () => {
      expect(normalizePhoneE164('(11) 3456-7890')).toBe('551134567890');
      expect(normalizePhoneE164('1134567890')).toBe('551134567890');
      expect(normalizePhoneE164('+55 (11) 3456-7890')).toBe('551134567890');
      expect(normalizePhoneE164('551134567890')).toBe('551134567890');
    });

    it('deve validar telefones válidos no Brasil', () => {
      expect(isValidPhoneBR('11987654321')).toBe(true);
      expect(isValidPhoneBR('5511987654321')).toBe(true);
      expect(isValidPhoneBR('(21) 2233-4455')).toBe(true);
      expect(isValidPhoneBR('552122334455')).toBe(true);
    });

    it('deve rejeitar telefones inválidos no Brasil', () => {
      expect(isValidPhoneBR('12345')).toBe(false);
      expect(isValidPhoneBR('05987654321')).toBe(false); // DDD 05 inválido
      expect(isValidPhoneBR('11887654321')).toBe(false); // Celular deve iniciar com 9
    });

    it('deve formatar telefone para exibição brasileira', () => {
      expect(formatPhoneBR('5511987654321')).toBe('+55 (11) 98765-4321');
      expect(formatPhoneBR('551134567890')).toBe('+55 (11) 3456-7890');
      expect(formatPhoneBR('(11) 98765-4321')).toBe('+55 (11) 98765-4321');
    });
  });

  describe('Listas canônicas (RF-03, RF-04, RF-06b)', () => {
    it('deve conter as 6 origens canônicas do RF-03', () => {
      expect(LEAD_SOURCES).toEqual([
        'Instagram',
        'Indicação',
        'Google Ads',
        'Prospecção Ativa',
        'LinkedIn',
        'Outro',
      ]);
    });

    it('deve conter as 6 etapas canônicas do RF-04 na ordem exata', () => {
      expect(PIPELINE_STAGES).toEqual([
        'Novo Lead',
        'Contato/Qualificação',
        'Proposta Enviada',
        'Em Negociação',
        'Contrato Ativo',
        'Pausado/Churn',
      ]);
    });

    it('deve conter as 3 prioridades do RF-06b', () => {
      expect(PRIORITIES).toEqual(['alta', 'media', 'baixa']);
    });
  });
});
