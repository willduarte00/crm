import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';

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
import { ErrorState } from '../ui/States';
import { AgencySettings, UpdateAgencySettingsInput } from '../../types/settings';
import { cleanDigits } from '../../utils/formatters';
import { AgencyTab } from './AgencyTab';
import { OperationalStagesTab } from './OperationalStagesTab';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<UpdateAgencySettingsInput>(EMPTY_FORM);
  const [savedData, setSavedData] = useState<UpdateAgencySettingsInput>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState('agency');

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
            Configurações
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gerencie os dados da agência e o pipeline operacional.
          </p>
        </div>

        {activeTab === 'agency' && (
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
        )}
      </div>

      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
        <Tabs.List
          className="flex flex-wrap border-b border-slate-200"
          aria-label="Abas de configurações"
        >
          <Tabs.Trigger
            value="agency"
            className="px-4 py-2 text-sm font-medium border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:text-teal-600 text-slate-500 hover:text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
          >
            Agência
          </Tabs.Trigger>
          <Tabs.Trigger
            value="operational-stages"
            className="px-4 py-2 text-sm font-medium border-b-2 border-transparent data-[state=active]:border-teal-500 data-[state=active]:text-teal-600 text-slate-500 hover:text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
          >
            Pipeline Operacional
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="agency" className="pt-6 outline-none">
          <form id="settings-form" onSubmit={handleSubmit}>
            <AgencyTab formData={formData} setFormData={setFormData} />
          </form>
        </Tabs.Content>

        <Tabs.Content value="operational-stages" className="pt-6 outline-none">
          <OperationalStagesTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};
