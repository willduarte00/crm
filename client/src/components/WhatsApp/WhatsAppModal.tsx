import React, { useState, useEffect, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  MessageSquare,
  Send,
  AlertTriangle,
  ExternalLink,
  CheckCheck,
  Sparkles,
} from 'lucide-react';
import {
  formatCurrencyBRL,
  formatDateBR,
  formatPhoneBR,
  normalizePhoneE164,
} from '../../utils/formatters';

export type WhatsAppTemplateKey =
  | 'onboarding'
  | 'lembrete_vencimento'
  | 'envio_nf'
  | 'personalizada';

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

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTemplate?: WhatsAppTemplateKey;
  data: WhatsAppModalData;
}

const TEMPLATES: Record<
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

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  initialTemplate = 'lembrete_vencimento',
  data,
}) => {
  const [selectedTemplate, setSelectedTemplate] =
    useState<WhatsAppTemplateKey>(initialTemplate);
  const [customText, setCustomText] = useState<string>('');
  const [isEditingCustom, setIsEditingCustom] = useState(false);

  // Valores calculados e formatados
  const formattedValor = useMemo(() => {
    if (data.valorFormatado) return data.valorFormatado;
    if (data.valorCents !== undefined && data.valorCents !== null) {
      return formatCurrencyBRL(data.valorCents);
    }
    return 'R$ 0,00';
  }, [data.valorFormatado, data.valorCents]);

  const formattedVencimento = useMemo(() => {
    if (data.vencimento) return formatDateBR(data.vencimento);
    return 'a combinar';
  }, [data.vencimento]);

  const replacements = useMemo(() => {
    return {
      '{nome}': data.nome || 'Cliente',
      '{agencia}': data.agencia || 'AdPrecision',
      '{valor}': formattedValor,
      '{vencimento}': formattedVencimento,
      '{mes_referencia}': data.mesReferencia || 'mês corrente',
      '{numero}': data.numeroCobranca || 'COB-0000-0000',
      '{chave_pix}': data.chavePix || 'Chave não cadastrada',
      '{tipo_chave_pix}': data.tipoChavePix || 'PIX',
    };
  }, [data, formattedValor, formattedVencimento]);

  // Atualiza o texto base ao mudar template ou abrir o modal
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplate(initialTemplate);
      const rawTemplate = TEMPLATES[initialTemplate].template;
      let text = rawTemplate;
      for (const [k, v] of Object.entries(replacements)) {
        text = text.split(k).join(v);
      }
      setCustomText(text);
      setIsEditingCustom(false);
    }
  }, [isOpen, initialTemplate, replacements]);

  const handleTemplateChange = (tmplKey: WhatsAppTemplateKey) => {
    setSelectedTemplate(tmplKey);
    let text = TEMPLATES[tmplKey].template;
    for (const [k, v] of Object.entries(replacements)) {
      text = text.split(k).join(v);
    }
    setCustomText(text);
    setIsEditingCustom(false);
  };

  const finalPhone = normalizePhoneE164(data.phone || '');
  const waUrl = useMemo(() => {
    const encoded = encodeURIComponent(customText);
    if (!finalPhone) return `https://wa.me/?text=${encoded}`;
    return `https://wa.me/${finalPhone}?text=${encoded}`;
  }, [finalPhone, customText]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl z-50 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 fill-current" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-slate-900">
                  Central de Mensagens WhatsApp
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-500">
                  Destinatário: <span className="font-semibold text-slate-700">{data.nome || 'Cliente'}</span>
                  {data.phone && (
                    <span className="ml-1 text-slate-600">({formatPhoneBR(data.phone)})</span>
                  )}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50/30">
            {/* Coluna Esquerda: Controles e Variáveis */}
            <div className="md:col-span-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Modelo da Mensagem
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) =>
                    handleTemplateChange(e.target.value as WhatsAppTemplateKey)
                  }
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all cursor-pointer font-medium"
                >
                  <option value="lembrete_vencimento">Lembrete de Vencimento com PIX</option>
                  <option value="onboarding">Boas-vindas / Onboarding</option>
                  <option value="envio_nf">Envio de Nota Fiscal</option>
                  <option value="personalizada">Mensagem Personalizada</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {TEMPLATES[selectedTemplate].description}
                </p>
              </div>

              {/* Variáveis Injetadas */}
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                  <span>Dados Substituídos</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                    <span className="text-slate-500">Cliente:</span>
                    <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                      {data.nome || '-'}
                    </span>
                  </div>
                  {data.valorCents !== undefined && (
                    <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                      <span className="text-slate-500">Valor:</span>
                      <span className="font-semibold text-teal-700">
                        {formattedValor}
                      </span>
                    </div>
                  )}
                  {data.vencimento && (
                    <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                      <span className="text-slate-500">Vencimento:</span>
                      <span className="font-semibold text-slate-800">
                        {formattedVencimento}
                      </span>
                    </div>
                  )}
                  {data.numeroCobranca && (
                    <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                      <span className="text-slate-500">Cobrança:</span>
                      <span className="font-mono text-slate-800">
                        {data.numeroCobranca}
                      </span>
                    </div>
                  )}
                  {data.chavePix && (
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500">Chave PIX:</span>
                      <span className="font-mono text-[11px] text-slate-800 truncate max-w-[140px]">
                        {data.chavePix}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botão para alternar edição manual */}
              <div>
                <button
                  type="button"
                  onClick={() => setIsEditingCustom(!isEditingCustom)}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline flex items-center gap-1"
                >
                  {isEditingCustom ? '← Visualizar balão padrão' : '✏️ Editar texto manualmente'}
                </button>
              </div>
            </div>

            {/* Coluna Direita: Preview do Balão WhatsApp */}
            <div className="md:col-span-7 flex flex-col">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {isEditingCustom ? 'Editar Mensagem' : 'Pré-visualização (WhatsApp)'}
              </label>

              {isEditingCustom ? (
                <textarea
                  rows={8}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full h-full min-h-[220px] bg-white border border-slate-300 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 font-sans leading-relaxed"
                  placeholder="Escreva a mensagem personalizada..."
                />
              ) : (
                <div
                  className="flex-1 min-h-[220px] bg-[#EFEAE2] rounded-xl border border-slate-300/80 p-4 flex flex-col justify-end relative shadow-inner overflow-hidden"
                  style={{
                    backgroundImage:
                      "radial-gradient(#0000000d 1px, transparent 1px)",
                    backgroundSize: '16px 16px',
                  }}
                >
                  {/* Balão WhatsApp Verde */}
                  <div className="bg-[#D9FDD3] text-[#111B21] rounded-lg rounded-tr-xs p-3.5 shadow-sm max-w-[95%] self-end relative text-sm leading-relaxed border border-[#c3f0bb]">
                    <div className="whitespace-pre-wrap font-normal text-[13.5px]">
                      {customText}
                    </div>

                    <div className="text-[10px] text-slate-500 text-right mt-1.5 flex items-center justify-end gap-1 select-none">
                      <span>Agora</span>
                      <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer & Aviso RF-53 */}
          <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Alerta RF-53 Obrigatório */}
            <div className="flex items-center gap-2.5 text-amber-800 bg-amber-50 px-3.5 py-2 rounded-lg border border-amber-200 text-xs w-full sm:w-auto">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Aviso:</strong> A NF e arquivos não vão anexados. O link abre o WhatsApp e o anexo é manual.
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors"
              >
                Cancelar
              </button>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-sm rounded-lg shadow-sm transition-all duration-150 hover:shadow"
              >
                <Send className="w-4 h-4" />
                <span>Abrir no WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
