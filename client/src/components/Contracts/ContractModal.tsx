import React, { useState, useEffect } from 'react';
import {
  Contract,
  ServiceType,
  BillingType,
  ContractStatus,
  SERVICE_TYPES,
  CONTRACT_STATUSES,
} from '../../types/contract';
import { Client } from '../../types/client';
import { apiFetch } from '../../services/api';
import { formatCurrencyBRL, parseBRLToCents } from '../../utils/formatters';
import { X, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (contract: Contract) => void;
  contractToEdit?: Contract | null;
  fixedClientId?: string;
  clients?: Client[];
}

export const ContractModal: React.FC<ContractModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  contractToEdit,
  fixedClientId,
  clients = [],
}) => {
  const [clientId, setClientId] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('Social Media & Conteúdo');
  const [description, setDescription] = useState('');
  const [billingType, setBillingType] = useState<BillingType>('recorrente');
  const [valueDisplay, setValueDisplay] = useState('');
  const [billingDay, setBillingDay] = useState<number>(10);
  const [billingPeriodMonths, setBillingPeriodMonths] = useState<number>(1);
  const [installments, setInstallments] = useState<number>(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<ContractStatus>('ativo');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (contractToEdit) {
        setClientId(contractToEdit.clientId);
        setServiceType(contractToEdit.serviceType);
        setDescription(contractToEdit.description || '');
        setBillingType(contractToEdit.billingType);
        setValueDisplay(formatCurrencyBRL(contractToEdit.valueCents).replace('R$', '').trim());
        setBillingDay(contractToEdit.billingDay || 10);
        setBillingPeriodMonths(contractToEdit.billingPeriodMonths || 1);
        setInstallments(contractToEdit.installments || 1);
        setStartDate(contractToEdit.startDate);
        setEndDate(contractToEdit.endDate || '');
        setStatus(contractToEdit.status);
      } else {
        setClientId(fixedClientId || (clients[0]?.id || ''));
        setServiceType('Social Media & Conteúdo');
        setDescription('');
        setBillingType('recorrente');
        setValueDisplay('2.500,00');
        setBillingDay(10);
        setBillingPeriodMonths(1);
        setInstallments(1);
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate('');
        setStatus('ativo');
      }
    }
  }, [isOpen, contractToEdit, fixedClientId, clients]);

  if (!isOpen) return null;

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setValueDisplay('');
      return;
    }
    const cents = parseInt(raw, 10);
    setValueDisplay((cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const valueCents = parseBRLToCents(valueDisplay);

    if (!clientId && !fixedClientId) {
      setError('Selecione um cliente para o contrato.');
      return;
    }

    if (valueCents <= 0) {
      setError('O valor do contrato deve ser maior que zero.');
      return;
    }

    if (!startDate) {
      setError('Informe a data de início do contrato.');
      return;
    }

    if (billingType === 'recorrente') {
      if (!billingDay || billingDay < 1 || billingDay > 31) {
        setError('O dia de cobrança (billingDay) deve ser entre 1 e 31.');
        return;
      }
      if (!billingPeriodMonths || billingPeriodMonths < 1) {
        setError('A periodicidade de cobrança deve ser de pelo menos 1 mês.');
        return;
      }
    }

    if (billingType === 'pontual') {
      if (!installments || installments < 1) {
        setError('O número de parcelas deve ser no mínimo 1.');
        return;
      }
    }

    try {
      setIsLoading(true);

      const payload: any = {
        clientId: fixedClientId || clientId,
        serviceType,
        description: description.trim() || null,
        billingType,
        valueCents,
        billingDay: billingType === 'recorrente' ? Number(billingDay) : null,
        billingPeriodMonths: billingType === 'recorrente' ? Number(billingPeriodMonths) : null,
        installments: billingType === 'pontual' ? Number(installments) : null,
        startDate,
        endDate: endDate.trim() ? endDate.trim() : null,
        status,
      };

      let result: Contract;

      if (contractToEdit) {
        result = await apiFetch<Contract>(`/api/contracts/${contractToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Contrato atualizado com sucesso!');
      } else {
        result = await apiFetch<Contract>('/api/contracts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Contrato cadastrado com sucesso!');
      }

      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar contrato.');
      toast.error('Erro ao salvar contrato.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden my-6 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-teal-600/10 text-teal-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-900">
                {contractToEdit ? 'Editar Contrato' : 'Novo Contrato'}
              </h3>
              <p className="text-xs text-slate-500">
                {contractToEdit
                  ? 'Atualize os dados e condições financeiras do contrato'
                  : 'Cadastre um contrato recorrente ou pontual com serviços e vigência'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Seleção de Cliente se não fixo */}
          {!fixedClientId && !contractToEdit && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cliente *
              </label>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
              >
                <option value="" disabled>Selecione um cliente...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.tradeName ? `(${c.tradeName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo de Serviço (RF-10) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Serviço (RF-10) *
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceType)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
              >
                {SERVICE_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Status do Contrato (RF-13) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status do Contrato (RF-13) *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContractStatus)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900 font-medium"
              >
                {CONTRACT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st === 'ativo' ? 'Ativo' : st === 'pausado' ? 'Pausado' : 'Encerrado'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição / Escopo */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição do Escopo <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Gestão de 12 posts mensais, stories diários e tráfego pago..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
            />
          </div>

          {/* Tipo de Cobrança (RF-11, RF-11a) e Valor */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
              Condições Financeiras (RF-11)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tipo de Cobrança */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tipo de Cobrança *
                </label>
                <div className="flex gap-4 mt-1.5">
                  <label className="flex items-center gap-1.5 text-xs text-navy-900 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="billingType"
                      value="recorrente"
                      checked={billingType === 'recorrente'}
                      onChange={() => setBillingType('recorrente')}
                      className="text-teal-600 focus:ring-teal-600"
                    />
                    <span>Recorrente (Mensalidade)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-navy-900 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="billingType"
                      value="pontual"
                      checked={billingType === 'pontual'}
                      onChange={() => setBillingType('pontual')}
                      className="text-teal-600 focus:ring-teal-600"
                    />
                    <span>Pontual (Projeto / Parcelado)</span>
                  </label>
                </div>
              </div>

              {/* Valor em R$ */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {billingType === 'recorrente' ? 'Valor da Mensalidade (R$) *' : 'Valor Total do Contrato (R$) *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-semibold text-slate-500">R$</span>
                  <input
                    type="text"
                    required
                    value={valueDisplay}
                    onChange={handleValueChange}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900 font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Campos Específicos por Tipo */}
            {billingType === 'recorrente' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dia de Vencimento (1 a 31) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={31}
                    value={billingDay}
                    onChange={(e) => setBillingDay(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Mês curto ajusta automaticamente para o último dia do mês.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Periodicidade (RF-11a) *
                  </label>
                  <select
                    value={billingPeriodMonths}
                    onChange={(e) => setBillingPeriodMonths(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
                  >
                    <option value={1}>Mensal (a cada 1 mês)</option>
                    <option value={2}>Bimestral (a cada 2 meses)</option>
                    <option value={3}>Trimestral (a cada 3 meses)</option>
                    <option value={6}>Semestral (a cada 6 meses)</option>
                    <option value={12}>Anual (a cada 12 meses)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número de Parcelas *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={60}
                  value={installments}
                  onChange={(e) => setInstallments(parseInt(e.target.value, 10) || 1)}
                  className="w-full sm:w-1/2 px-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Cria {installments} parcela(s) com valores e datas editáveis no módulo financeiro.
                </span>
              </div>
            )}
          </div>

          {/* Vigência / Datas civis (YYYY-MM-DD) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Início do Contrato *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Término <span className="text-slate-400 font-normal">(opcional / indeterminado)</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 text-navy-900"
              />
            </div>
          </div>

          {/* Rodapé e Botões */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-xs"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{contractToEdit ? 'Salvar Alterações' : 'Criar Contrato'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
