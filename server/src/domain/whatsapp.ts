/**
 * Regras de negócio puras para WhatsApp Message Center (RF-50 a RF-53).
 * Sem Express e sem Prisma.
 */

import { normalizePhoneE164 } from './clients.js';

export type WhatsAppTemplateKey =
  | 'onboarding'
  | 'lembrete_vencimento'
  | 'envio_nf'
  | 'personalizada';

export interface WhatsAppTemplate {
  key: WhatsAppTemplateKey;
  name: string;
  description: string;
  templateText: string;
}

export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateKey, WhatsAppTemplate> = {
  onboarding: {
    key: 'onboarding',
    name: 'Boas-vindas / Onboarding',
    description: 'Mensagem de recepção de novo cliente e início de parceria.',
    templateText:
      'Olá, {nome}! Seja muito bem-vindo(a) à {agencia}. Estamos muito felizes em iniciar nossa parceria. Qualquer dúvida ou solicitação, estamos à total disposição por aqui!',
  },
  lembrete_vencimento: {
    key: 'lembrete_vencimento',
    name: 'Lembrete de Vencimento com PIX',
    description: 'Lembrete com valor, vencimento, número da cobrança e dados de PIX.',
    templateText:
      'Olá, {nome}! Passando para lembrar que a cobrança {numero} no valor de {valor} vence em {vencimento} (ref. {mes_referencia}). Para facilitar, você pode realizar o pagamento via PIX utilizando a chave: {chave_pix} ({tipo_chave_pix}). Se já realizou o pagamento, por favor desconsidere esta mensagem.',
  },
  envio_nf: {
    key: 'envio_nf',
    name: 'Envio de Nota Fiscal',
    description: 'Aviso de emissão de NF com detalhes da cobrança (arquivo anexado à mão).',
    templateText:
      'Olá, {nome}! A nota fiscal referente aos serviços prestados em {mes_referencia} (cobrança {numero}, no valor de {valor}) já está disponível e segue em anexo para sua conferência. Agradecemos a parceria!',
  },
  personalizada: {
    key: 'personalizada',
    name: 'Mensagem Personalizada',
    description: 'Mensagem livre com saudação ao cliente.',
    templateText: 'Olá, {nome}! ',
  },
};

export interface WhatsAppInterpolationData {
  nome?: string | null;
  agencia?: string | null;
  valor?: string | null;
  vencimento?: string | null;
  mes_referencia?: string | null;
  numero?: string | null;
  chave_pix?: string | null;
  tipo_chave_pix?: string | null;
}

/**
 * Interpola variáveis no texto do modelo (RF-52).
 * Variáveis suportadas: {nome}, {agencia}, {valor}, {vencimento}, {mes_referencia}, {numero}, {chave_pix}, {tipo_chave_pix}.
 */
export function interpolateWhatsAppMessage(
  templateText: string,
  data: WhatsAppInterpolationData
): string {
  let message = templateText;

  const replacements: Record<string, string> = {
    '{nome}': data.nome || 'Cliente',
    '{agencia}': data.agencia || 'AdPrecision',
    '{valor}': data.valor || 'R$ 0,00',
    '{vencimento}': data.vencimento || 'a combinar',
    '{mes_referencia}': data.mes_referencia || 'mês corrente',
    '{numero}': data.numero || 'COB-0000-0000',
    '{chave_pix}': data.chave_pix || 'Chave não cadastrada',
    '{tipo_chave_pix}': data.tipo_chave_pix || 'PIX',
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    message = message.split(placeholder).join(value);
  }

  return message;
}

/**
 * Gera a URL do wa.me no formato: https://wa.me/<telefone_e164>?text=<mensagem_urlencoded> (RF-50).
 */
export function generateWhatsAppUrl(phone: string, text: string): string {
  const normalizedPhone = normalizePhoneE164(phone);
  const encodedText = encodeURIComponent(text);
  if (!normalizedPhone) {
    return `https://wa.me/?text=${encodedText}`;
  }
  return `https://wa.me/${normalizedPhone}?text=${encodedText}`;
}
