import React from 'react';
import { Building2, CreditCard, CheckCircle2, HelpCircle } from 'lucide-react';
import { Field, controlClass } from '../ui/Field';
import { UpdateAgencySettingsInput } from '../../types/settings';
import { maskPhoneInput } from '../../utils/formatters';
import { apiFetch } from '../../services/api';

interface AgencyTabProps {
  formData: UpdateAgencySettingsInput;
  setFormData: (data: UpdateAgencySettingsInput) => void;
}

const PIX_KEY_TYPES = [
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'CPF', label: 'CPF' },
  { value: 'Email', label: 'E-mail' },
  { value: 'Telefone', label: 'Celular / Telefone' },
  { value: 'Aleatoria', label: 'Chave Aleatória (EVP)' },
];

export const AgencyTab: React.FC<AgencyTabProps> = ({ formData, setFormData }) => {
  return (
    <div className="space-y-6">
      {/* Seção 1: Dados Gerais da Agência */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-navy-900">
              Perfil e identificação
            </h2>
            <p className="text-xs text-slate-500">
              Aparece na assinatura das mensagens de WhatsApp e nos cabeçalhos do sistema.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome da agência" required className="sm:col-span-2">
            {(props) => (
              <input
                {...props}
                type="text"
                value={formData.agencyName}
                onChange={(e) =>
                  setFormData({ ...formData, agencyName: e.target.value })
                }
                placeholder="Ex: Agência de Marketing Digital"
                className={controlClass + ' font-medium'}
              />
            )}
          </Field>

          <Field label="E-mail de contato">
            {(props) => (
              <input
                {...props}
                type="email"
                value={formData.contactEmail || ''}
                onChange={(e) =>
                  setFormData({ ...formData, contactEmail: e.target.value })
                }
                placeholder="contato@suaagencia.com.br"
                className={controlClass}
              />
            )}
          </Field>

          <Field label="Telefone / WhatsApp da agência">
            {(props) => (
              <input
                {...props}
                type="tel"
                inputMode="tel"
                value={maskPhoneInput(formData.phone || '')}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 98765-4321"
                className={controlClass}
              />
            )}
          </Field>
        </div>
      </div>

      {/* Seção: Identidade Visual */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-navy-900">
              Identidade visual
            </h2>
            <p className="text-xs text-slate-500">
              Personalize a aparência do sistema com a marca da agência.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Cor Principal">
            {(props) => (
              <div className="flex items-center gap-3">
                <input
                  {...props}
                  type="color"
                  value={formData.primaryColor || '#0f172a'}
                  onChange={(e) =>
                    setFormData({ ...formData, primaryColor: e.target.value })
                  }
                  className="w-12 h-12 p-1 rounded cursor-pointer border border-slate-200"
                />
                <span className="text-sm font-mono text-slate-600 uppercase">
                  {formData.primaryColor || '#0f172a'}
                </span>
              </div>
            )}
          </Field>

          <Field label="Logotipo" hint="Formatos: JPG, PNG, WEBP, SVG">
            {(props) => (
              <div className="space-y-3">
                {formData.logoUrl && (
                  <div className="w-32 h-32 bg-slate-50 rounded border border-slate-200 flex items-center justify-center overflow-hidden">
                    <img src={formData.logoUrl} alt="Logotipo" className="max-w-full max-h-full object-contain" onError={(e) => { e.currentTarget.src = formData.logoUrl || '' }} />
                  </div>
                )}
                <input
                  {...props}
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    const fd = new FormData();
                    fd.append('file', file);

                    try {
                      // Usar apiFetch para lidar com cookies (credentials: include) e auth
                      const data = await apiFetch<{url: string}>('/api/files/logo', {
                        method: 'POST',
                        body: fd,
                      });
                      setFormData({ ...formData, logoUrl: data.url });
                    } catch (error) {
                      alert('Erro ao enviar imagem. Verifique se o formato e tamanho estão corretos.');
                    }
                  }}
                  className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />
              </div>
            )}
          </Field>
        </div>
      </div>

      {/* Seção 2: Dados Financeiros & PIX (Padrão Brasileiro) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-navy-900">
              Dados financeiros e chave PIX
            </h2>
            <p className="text-xs text-slate-500">
              Usados nos lembretes de vencimento e nas orientações de pagamento.
            </p>
          </div>
        </div>

        {/* Chave PIX */}
        <div className="p-4 bg-teal-50/40 border border-teal-200/60 rounded-xl space-y-3">
          <h3 className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-teal-700" aria-hidden="true" />
            <span>Chave PIX principal</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Tipo da chave">
              {(props) => (
                <select
                  {...props}
                  value={formData.pixKeyType || 'CNPJ'}
                  onChange={(e) =>
                    setFormData({ ...formData, pixKeyType: e.target.value })
                  }
                  className={controlClass + ' font-medium cursor-pointer'}
                >
                  {PIX_KEY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Chave PIX" className="sm:col-span-2">
              {(props) => (
                <input
                  {...props}
                  type="text"
                  value={formData.pixKey || ''}
                  onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                  placeholder="Ex: 12.345.678/0001-90 ou financeiro@agencia.com.br"
                  className={controlClass + ' font-mono'}
                />
              )}
            </Field>
          </div>
        </div>

        {/* Dados Bancários Brasileiros */}
        <div className="pt-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Conta bancária (TED / depósito)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Banco / instituição">
              {(props) => (
                <input
                  {...props}
                  type="text"
                  value={formData.bankName || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, bankName: e.target.value })
                  }
                  placeholder="Ex: Itaú Unibanco (341)"
                  className={controlClass}
                />
              )}
            </Field>

            <Field label="Agência" hint="Inclua o dígito, se houver.">
              {(props) => (
                <input
                  {...props}
                  type="text"
                  value={formData.bankBranch || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, bankBranch: e.target.value })
                  }
                  placeholder="Ex: 1234-5"
                  className={controlClass + ' font-mono'}
                />
              )}
            </Field>

            <Field label="Conta corrente" hint="Inclua o dígito.">
              {(props) => (
                <input
                  {...props}
                  type="text"
                  value={formData.bankAccount || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, bankAccount: e.target.value })
                  }
                  placeholder="Ex: 56789-0"
                  className={controlClass + ' font-mono'}
                />
              )}
            </Field>
          </div>
        </div>
      </div>

      {/* Informações Fixas do Sistema */}
      <div className="p-4 bg-slate-100/70 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-3">
        <HelpCircle className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold text-navy-900">
            Fuso horário fixo: Brasília (UTC−3)
          </p>
          <p className="text-slate-600">
            Datas de vencimento, viradas de mês e cálculo de atraso seguem sempre o
            horário de Brasília, independentemente do fuso do seu computador.
          </p>
        </div>
      </div>
    </div>
  );
};