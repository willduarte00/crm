import { describe, it, expect } from 'vitest';
import { validatePasswordPolicy } from '../domain/passwords';

describe('validatePasswordPolicy (F-18)', () => {
  it('rejeita senhas com menos de 12 caracteres', () => {
    expect(validatePasswordPolicy('curta123')).toMatch(/mínimo 12 caracteres/);
  });

  it('rejeita senha sem número', () => {
    expect(validatePasswordPolicy('somenteletras')).toMatch(/letra e um número/);
  });

  it('rejeita senha sem letra', () => {
    expect(validatePasswordPolicy('123456789012')).toMatch(/letra e um número/);
  });

  it('rejeita senhas comuns mesmo que atendam ao tamanho e à regra de letra/número', () => {
    expect(validatePasswordPolicy('admin12345678')).toMatch(/muito comum/);
    expect(validatePasswordPolicy('qwerty123456')).toMatch(/muito comum/);
  });

  it('aceita senha forte', () => {
    expect(validatePasswordPolicy('SenhaForte2026')).toBeNull();
  });
});
