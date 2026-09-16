const MIN_PASSWORD_LENGTH = 12;

const COMMON_PASSWORDS = new Set([
  'admin123456',
  'admin12345678',
  'password',
  'password1234',
  'senha123',
  'senha12345678',
  '12345678',
  '123456789012',
  'qwerty123',
  'qwerty123456',
  'letmein12345',
  'welcome12345',
]);

/**
 * Valida a política mínima de senha (F-18): 12+ caracteres, letra e número,
 * fora de uma lista curta de senhas comuns. Retorna null quando válida, ou
 * uma mensagem de erro para exibir ao usuário.
 */
export function validatePasswordPolicy(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'A senha deve conter ao menos uma letra e um número.';
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'Esta senha é muito comum. Escolha outra.';
  }
  return null;
}
