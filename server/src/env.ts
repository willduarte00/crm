import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const FORBIDDEN_JWT_SECRETS = [
  'change-me',
  'secret',
  'jwt_secret',
  'sua_chave_jwt_aqui',
  'example',
  '12345678',
  'admin',
  'default_secret',
];

const FORBIDDEN_ADMIN_PASSWORDS = [
  'admin123456',
  'admin1234567',
  'password',
  'senha123',
  '12345678',
  '123456789',
  '1234567890',
  '123456789012',
  'changeme',
  'admin@123',
];

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET deve ter ao menos 32 caracteres')
    .refine(
      (secret) => !FORBIDDEN_JWT_SECRETS.includes(secret.toLowerCase()),
      'JWT_SECRET não pode ser um valor de exemplo ou inseguro'
    ),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z
    .string()
    .min(12)
    .refine(
      (pass) => !FORBIDDEN_ADMIN_PASSWORDS.includes(pass.toLowerCase()),
      'Senha de administrador muito fraca ou comum'
    ),
  UPLOAD_DIR: z.string().default('./uploads'),
  CORS_ORIGINS: z.string().optional().default(''),
}).refine(
  (data) => !(data.NODE_ENV === 'production' && data.APP_ENV !== 'production'),
  { message: 'Em NODE_ENV=production o APP_ENV deve ser production (cookie Secure)' }
);

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Erro na validação das variáveis de ambiente:');
    result.error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw new Error('Falha na validação de variáveis de ambiente');
  }

  return result.data;
};

export const env = parseEnv();
