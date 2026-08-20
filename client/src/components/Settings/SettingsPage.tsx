import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  CreditCard,
  Save,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
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

  const [formData, setFormData] = useState<UpdateAgencySettingsInput>({
    agencyName: '',
    contactEmail: '',
    phone: '',
    pixKey: '',
    pixKeyType: 'CNPJ',
    bankName: '',
    bankBranch: '',
    bankAccount: '',
  });

  const { data: settings, isLoading } = useQuery<AgencySettings>({
    queryKey: ['settings'],
    queryFn: () => apiFetch<AgencySettings>('/api/settings'),
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        agencyName: settings.agencyName || '',
        contactEmail: settings.contactEmail || '',
        phone: settings.phone || '',
        pixKey: settings.pixKey || '',
        pixKeyType: settings.pixKeyType || 'CNPJ',
        bankName: settings.bankName || '',
        bankBranch: settings.bankBranch || '',
        bankAccount: settings.bankAccount || '',
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateAgencySettingsInput) =>
      apiFetch<AgencySettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.data?.error || 'Erro ao salvar configurações.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.agencyName?.trim()) {
      toast.error('O nome da agência é obrigatório.');
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
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-64" />
        <div className="h-96 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Configurações da Agência
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dados cadastrais, identificação para mensagens e dados bancários brasileiros
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={updateMutation.isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-all duration-150"
        >
          <Save className="w-4 h-4" />
          <span>{updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seção 1: Dados Gerais da Agência */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Perfil e Identificação da Agência
              </h2>
              <p className="text-xs text-slate-500">
                Utilizado na assinatura de mensagens do WhatsApp e cabeçalhos do sistema
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nome da Agência <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.agencyName}
                onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                placeholder="Ex: AdPrecision Marketing Digital"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                E-mail de Contato
              </label>
              <input
                type="email"
                value={formData.contactEmail || ''}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="contato@suaagencia.com.br"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Telefone / WhatsApp da Agência
              </label>
              <input
                type="text"
                value={maskPhoneInput(formData.phone || '')}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 98765-4321"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Seção 2: Dados Financeiros & PIX (Padrão Brasileiro) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Dados Financeiros e Chave PIX
              </h2>
              <p className="text-xs text-slate-500">
                Utilizados nos modelos de lembrete de vencimento e orientações de pagamento
              </p>
            </div>
          </div>

          {/* Chave PIX */}
          <div className="p-4 bg-teal-50/40 border border-teal-200/60 rounded-xl space-y-3">
            <div className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              <span>Chave PIX Principal</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo da Chave
                </label>
                <select
                  value={formData.pixKeyType || 'CNPJ'}
                  onChange={(e) => setFormData({ ...formData, pixKeyType: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all font-medium cursor-pointer"
                >
                  {PIX_KEY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chave PIX
                </label>
                <input
                  type="text"
                  value={formData.pixKey || ''}
                  onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                  placeholder="Ex: 12.345.678/0001-90 ou financeiro@agencia.com.br"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all font-mono"
                />
              </div>
            </div>
          </div>

          {/* Dados Bancários Brasileiros */}
          <div className="pt-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Conta Bancária (TED / DOC / Depósito)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Banco / Instituição
                </label>
                <input
                  type="text"
                  value={formData.bankName || ''}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  placeholder="Ex: Itaú Unibanco (341)"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Agência (com dígito se houver)
                </label>
                <input
                  type="text"
                  value={formData.bankBranch || ''}
                  onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                  placeholder="Ex: 1234 ou 1234-5"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Conta Corrente (com dígito)
                </label>
                <input
                  type="text"
                  value={formData.bankAccount || ''}
                  onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                  placeholder="Ex: 56789-0"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Informações Fixas do Sistema */}
        <div className="p-4 bg-slate-100/70 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">
              Operação Fixa no Fuso Horário de Brasília (UTC−3)
            </p>
            <p className="text-slate-500">
              O sistema opera exclusivamente em horário de Brasília para garantir precisão nas datas de vencimento, viradas de mês e cálculo de atrasos.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
};
