import React, { useEffect, useId, useState } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  ExternalLink,
  Phone,
  Send,
  Sparkles,
} from 'lucide-react';
import { normalizePhoneE164 } from '../../utils/formatters';
import {
  TEMPLATES,
  TEMPLATE_ORDER,
  WhatsAppModalData,
  WhatsAppTemplateKey,
  applyReplacements,
  buildReplacements,
  buildWhatsAppUrl,
  formatWhatsAppDueDate,
  formatWhatsAppValue,
} from './templates';

interface WhatsAppComposerProps {
  data: WhatsAppModalData;
  initialTemplate?: WhatsAppTemplateKey;
  /** Conteúdo extra acima do seletor de modelo (ex.: escolha da cobrança). */
  headerSlot?: React.ReactNode;
  /** Ações extras no rodapé, à esquerda do botão de envio. */
  footerSlot?: React.ReactNode;
  /** Disparado ao abrir o link `wa.me`, com o que foi efetivamente enviado. */
  onSend?: (info: { template: WhatsAppTemplateKey; message: string }) => void;
  className?: string;
}

/**
 * Corpo da central de mensagens: seletor de modelo, variáveis substituídas,
 * pré-visualização/edição e o botão que abre o `wa.me`. Vive separado do
 * modal porque a ficha do cliente monta a mesma central embutida na aba.
 */
export const WhatsAppComposer: React.FC<WhatsAppComposerProps> = ({
  data,
  initialTemplate = 'lembrete_vencimento',
  headerSlot,
  footerSlot,
  onSend,
  className = '',
}) => {
  const fieldId = useId();
  const templateId = `${fieldId}-template`;
  const messageId = `${fieldId}-message`;

  const [selectedTemplate, setSelectedTemplate] =
    useState<WhatsAppTemplateKey>(initialTemplate);
  const [customText, setCustomText] = useState('');
  const [isEditingCustom, setIsEditingCustom] = useState(false);

  const replacements = buildReplacements(data);
  // Assinatura por valor: o texto é remontado quando algum dado muda de fato,
  // e não a cada render em que o chamador recria o objeto `data`.
  const replacementsSignature = JSON.stringify(replacements);

  useEffect(() => {
    setSelectedTemplate(initialTemplate);
  }, [initialTemplate]);

  useEffect(() => {
    setCustomText(
      applyReplacements(
        TEMPLATES[selectedTemplate].template,
        JSON.parse(replacementsSignature) as Record<string, string>
      )
    );
    setIsEditingCustom(false);
  }, [selectedTemplate, replacementsSignature]);

  const phoneE164 = normalizePhoneE164(data.phone || '');
  const waUrl = buildWhatsAppUrl(data.phone, customText);
  const formattedValor = formatWhatsAppValue(data);
  const formattedVencimento = formatWhatsAppDueDate(data);

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Coluna Esquerda: Controles e Variáveis */}
        <div className="md:col-span-5 space-y-4">
          {headerSlot}

          <div>
            <label
              htmlFor={templateId}
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Modelo da mensagem
            </label>
            <select
              id={templateId}
              value={selectedTemplate}
              onChange={(e) =>
                setSelectedTemplate(e.target.value as WhatsAppTemplateKey)
              }
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all cursor-pointer font-medium"
            >
              {TEMPLATE_ORDER.map((key) => (
                <option key={key} value={key}>
                  {TEMPLATES[key].name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              {TEMPLATES[selectedTemplate].description}
            </p>
          </div>

          {/* Variáveis Injetadas (RF-52) */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
              <span>Dados Substituídos</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                  {data.nome || '-'}
                </span>
              </div>
              {data.valorCents !== undefined && data.valorCents !== null && (
                <div className="flex justify-between items-center py-0.5 border-b border-slate-100">
                  <span className="text-slate-500">Valor:</span>
                  <span className="font-semibold text-teal-700">{formattedValor}</span>
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
                  <span className="font-mono text-slate-800">{data.numeroCobranca}</span>
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

          <div>
            <button
              type="button"
              onClick={() => setIsEditingCustom(!isEditingCustom)}
              aria-pressed={isEditingCustom}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline rounded-sm"
            >
              {isEditingCustom
                ? 'Voltar para a pré-visualização'
                : 'Editar o texto manualmente'}
            </button>
          </div>
        </div>

        {/* Coluna Direita: Preview do Balão WhatsApp */}
        <div className="md:col-span-7 flex flex-col">
          <label
            htmlFor={messageId}
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
          >
            {isEditingCustom ? 'Editar mensagem' : 'Pré-visualização'}
          </label>

          {isEditingCustom ? (
            <textarea
              id={messageId}
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
                backgroundImage: 'radial-gradient(#0000000d 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
            >
              <div className="bg-[#D9FDD3] text-[#111B21] rounded-lg rounded-tr-sm p-3.5 shadow-sm max-w-[95%] self-end relative text-sm leading-relaxed border border-[#c3f0bb]">
                <div className="whitespace-pre-wrap font-normal text-[13.5px]">
                  {customText}
                </div>

                <div className="text-[10px] text-slate-500 text-right mt-1.5 flex items-center justify-end gap-1 select-none">
                  <span>Agora</span>
                  <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" aria-hidden="true" />
                </div>
              </div>
            </div>
          )}

          {!phoneE164 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              <span>
                Cliente sem telefone cadastrado — o link abrirá o WhatsApp com o texto
                pronto, mas você precisará escolher o contato.
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Rodapé com o aviso obrigatório do RF-53 */}
      <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-amber-800 bg-amber-50 px-3.5 py-2 rounded-lg border border-amber-200 text-xs w-full sm:w-auto">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" aria-hidden="true" />
          <span>
            <strong>Anexos não vão junto.</strong> O link abre a conversa com o texto
            pronto; a nota fiscal e outros arquivos precisam ser anexados manualmente no
            WhatsApp.
          </span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {footerSlot}

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onSend?.({ template: selectedTemplate, message: customText })}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-sm rounded-lg shadow-sm transition-all duration-150 hover:shadow whitespace-nowrap"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>Abrir no WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
};
