import {
  formatCurrencyBRL,
  formatDateBR,
  formatReferenceMonthBR,
  normalizePhoneE164,
} from '../../utils/formatters';

export type WhatsAppTemplateKey =
  | 'onboarding'
  | 'lembrete_vencimento'
  | 'envio_nf'
  | 'personalizada';

/** Dados que alimentam a substituição de variáveis (RF-52). */
export interface WhatsAppModalData {
  nome?: string | null;
  agencia?: string | null;
  valorCents?: number | null;
  valorFormatado?: string | null;
  vencimento?: string | null;
  mesReferencia?: string | null;
  numeroCobranca?: string | null;
  chavePix?: string | null;
  tipoChavePix?: string | null;
  phone?: string | null;
}

export const TEMPLATES: Record<
  WhatsAppTemplateKey,
  { name: string; description: string; template: string }
> = {
  onboarding: {
    name: 'Boas-vindas / Onboarding',
    description: 'Recepção de novo cliente e início da parceria.',
    template:
      'Olá, {nome}! Seja muito bem-vindo(a) à {agencia}. Estamos muito felizes em iniciar nossa parceria. Qualquer dúvida ou solicitação, estamos à total disposição por aqui!',
  },
  lembrete_vencimento: {
    name: 'Lembrete de Vencimento com PIX',
    description: 'Lembrete de pagamento com valor, vencimento e chave PIX.',
    template:
      'Olá, {nome}! Passando para lembrar que a cobrança {numero} no valor de {valor} vence em {vencimento} (ref. {mes_referencia}). Para facilitar, você pode realizar o pagamento via PIX utilizando a chave: {chave_pix} ({tipo_chave_pix}). Se já realizou o pagamento, por favor desconsidere esta mensagem.',
  },
  envio_nf: {
    name: 'Envio de Nota Fiscal',
    description: 'Aviso de emissão de NF e detalhes do serviço.',
    template:
      'Olá, {nome}! A nota fiscal referente aos serviços prestados em {mes_referencia} (cobrança {numero}, no valor de {valor}) já está disponível e segue em anexo para sua conferência. Agradecemos a parceria!',
  },
  personalizada: {
    name: 'Mensagem Personalizada',
    description: 'Mensagem em branco com saudação.',
    template: 'Olá, {nome}!\n\n',
  },
};

/** Ordem de exibição no seletor — o lembrete é o uso mais frequente. */
export const TEMPLATE_ORDER: WhatsAppTemplateKey[] = [
  'lembrete_vencimento',
  'onboarding',
  'envio_nf',
  'personalizada',
];

/** Modelos que dependem de uma cobrança para fazer sentido. */
export const TEMPLATES_REQUIRING_PAYMENT: WhatsAppTemplateKey[] = [
  'lembrete_vencimento',
  'envio_nf',
];

export function formatWhatsAppValue(data: WhatsAppModalData): string {
  if (data.valorFormatado) return data.valorFormatado;
  if (data.valorCents !== undefined && data.valorCents !== null) {
    return formatCurrencyBRL(data.valorCents);
  }
  return 'R$ 0,00';
}

export function formatWhatsAppDueDate(data: WhatsAppModalData): string {
  return data.vencimento ? formatDateBR(data.vencimento) : 'a combinar';
}

/** Valores finais de cada variável, já formatados para leitura humana. */
export function buildReplacements(
  data: WhatsAppModalData
): Record<string, string> {
  return {
    '{nome}': data.nome || 'Cliente',
    '{agencia}': data.agencia || 'AdPrecision',
    '{valor}': formatWhatsAppValue(data),
    '{vencimento}': formatWhatsAppDueDate(data),
    '{mes_referencia}': data.mesReferencia
      ? formatReferenceMonthBR(data.mesReferencia)
      : 'mês corrente',
    '{numero}': data.numeroCobranca || 'COB-0000-0000',
    '{chave_pix}': data.chavePix || 'Chave não cadastrada',
    '{tipo_chave_pix}': data.tipoChavePix || 'PIX',
  };
}

export function applyReplacements(
  template: string,
  replacements: Record<string, string>
): string {
  let text = template;
  for (const [key, value] of Object.entries(replacements)) {
    text = text.split(key).join(value);
  }
  return text;
}

export function buildWhatsAppMessage(
  templateKey: WhatsAppTemplateKey,
  data: WhatsAppModalData
): string {
  return applyReplacements(TEMPLATES[templateKey].template, buildReplacements(data));
}

/**
 * Monta o link `wa.me` (RF-50). Sem telefone o link ainda abre o WhatsApp com o
 * texto pronto, deixando o destinatário para o usuário escolher.
 */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string
): string {
  const encoded = encodeURIComponent(message);
  const normalized = normalizePhoneE164(phone || '');
  return normalized
    ? `https://wa.me/${normalized}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}
