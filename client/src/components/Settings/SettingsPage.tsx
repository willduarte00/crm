import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, CreditCard, Save, CheckCircle2, HelpCircle } from 'lucide-react';

const EMPTY_FORM: UpdateAgencySettingsInput = {
  agencyName: '',
  contactEmail: '',
  phone: '',
  pixKey: '',
  pixKeyType: 'CNPJ',
  bankName: '',
  bankBranch: '',
  bankAccount: '',
};
import { apiFetch, errorMessage } from '../../services/api';
import { Button } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { ErrorState } from '../ui/States';
import { AgencySettings, UpdateAgencySettingsInput } from '../../types/settings';
import { maskPhoneInput, cleanDigits } from '../../utils/formatters';

const PIX_KEY_TYPES = [
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'CPF', label: 'CPF' },
  { value: 'Email', label: 'E-mail' },
  { value: 'Telefone', label: 'Celular / Telefone' },
  { value: 'Aleatoria', label: 'Chave Aleatória (EVP)' },
];

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<UpdateAgencySettingsInput>(EMPTY_FORM);
  // Guarda o estado salvo para detectar alterações não persistidas.
  const [savedData, setSavedData] = useState<UpdateAgencySettingsInput>(EMPTY_FORM);

  const {
    data: settings,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<AgencySettings>({
    queryKey: ['settings'],
    queryFn: () => apiFetch<AgencySettings>('/api/settings'),
  });

  useEffect(() => {
    if (!settings) return;
    const next: UpdateAgencySettingsInput = {
      agencyName: settings.agencyName || '',
      contactEmail: settings.contactEmail || '',
      phone: settings.phone || '',
      pixKey: settings.pixKey || '',
      pixKeyType: settings.pixKeyType || 'CNPJ',
      bankName: settings.bankName || '',
      bankBranch: settings.bankBranch || '',
      bankAccount: settings.bankAccount || '',
    };
    setFormData(next);
    setSavedData(next);
  }, [settings]);

  const isDirty = JSON.stringify(formData) !== JSON.stringify(savedData);

  // Avisa antes de fechar a aba com alterações pendentes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateAgencySettingsInput) =>
      apiFetch<AgencySettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Configurações salvas.');
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, 'Não foi possível salvar as configurações.'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (updateMutation.isPending) return;
    if (!formData.agencyName?.trim()) {
      toast.error('Informe o nome da agência antes de salvar.');
      return;
    }
    updateMutation.mutate({
      ...formData,
      agencyName: formData.agencyName.trim(),
      contactEmail: formData.contactEmail?.trim() || undefined,
      phone: formData.phone ? cleanDigits(formData.phone) : undefined,
      pixKey: formData.pixKey?.trim() || undefined,
      pixKeyType: formData.pixKeyType || undefined,
      bankName: formData.bankName?.trim() || undefined,
      bankBranch: formData.bankBranch?.trim() || undefined,
      bankAccount: formData.bankAccount?.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div
        className="max-w-4xl mx-auto w-full space-y-6 animate-pulse"
        role="status"
        aria-label="Carregando configurações"
      >
        <div className="h-8 bg-slate-200 rounded-lg w-64" />
        <div className="h-96 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto w-full bg-white border border-slate-200 rounded-xl shadow-xs">
        <ErrorState
          title="Não foi possível carregar as configurações"
          message="Os dados da agência não puderam ser lidos do servidor. Verifique sua conexão e tente novamente."
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
            Configurações da agência
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Dados cadastrais, identificação nas mensagens e dados bancários.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {isDirty && (
            <span
              className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 whitespace-nowrap"
              aria-live="polite"
            >
              Alterações não salvas
            </span>
          )}
          <Button
            type="submit"
            form="settings-form"
            isLoading={updateMutation.isPending}
            disabled={!isDirty}
            icon={<Save className="w-4 h-4" aria-hidden="true" />}
          >
            Salvar alterações
          </Button>
        </div>
      </div>

      <form id="settings-form" onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder="Ex: AdPrecision Marketing Digital"
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
      </form>
    </div>
  );
};
