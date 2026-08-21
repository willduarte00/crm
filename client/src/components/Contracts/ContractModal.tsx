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
import { apiFetch, errorMessage } from '../../services/api';
import { formatCurrencyBRL, parseBRLToCents } from '../../utils/formatters';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { FormAlert } from '../ui/States';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (contract: Contract) => void;
  contractToEdit?: Contract | null;
  fixedClientId?: string;
  clients?: Client[];
}

const STATUS_LABELS: Record<ContractStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
};

const PERIODICITY_OPTIONS = [
  { value: 1, label: 'Mensal (a cada 1 mês)' },
  { value: 2, label: 'Bimestral (a cada 2 meses)' },
  { value: 3, label: 'Trimestral (a cada 3 meses)' },
  { value: 6, label: 'Semestral (a cada 6 meses)' },
  { value: 12, label: 'Anual (a cada 12 meses)' },
];

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

  const formId = 'contract-form';

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    if (contractToEdit) {
      setClientId(contractToEdit.clientId);
      setServiceType(contractToEdit.serviceType);
      setDescription(contractToEdit.description || '');
      setBillingType(contractToEdit.billingType);
      setValueDisplay(
        formatCurrencyBRL(contractToEdit.valueCents).replace('R$', '').trim()
      );
      setBillingDay(contractToEdit.billingDay || 10);
      setBillingPeriodMonths(contractToEdit.billingPeriodMonths || 1);
      setInstallments(contractToEdit.installments || 1);
      setStartDate(contractToEdit.startDate);
      setEndDate(contractToEdit.endDate || '');
      setStatus(contractToEdit.status);
    } else {
      setClientId(fixedClientId || clients[0]?.id || '');
      setServiceType('Social Media & Conteúdo');
      setDescription('');
      setBillingType('recorrente');
      setValueDisplay('2.500,00');
      setBillingDay(10);
      setBillingPeriodMonths(1);
      setInstallments(1);
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setStatus('ativo');
    }
  }, [isOpen, contractToEdit, fixedClientId, clients]);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setValueDisplay('');
      return;
    }
    const cents = parseInt(raw, 10);
    setValueDisplay(
      (cents / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);

    const valueCents = parseBRLToCents(valueDisplay);

    if (!clientId && !fixedClientId) {
      setError('Selecione o cliente deste contrato.');
      return;
    }
    if (valueCents <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    if (!startDate) {
      setError('Informe a data de início do contrato.');
      return;
    }
    if (endDate && endDate < startDate) {
      setError('A data de término não pode ser anterior à data de início.');
      return;
    }
    if (billingType === 'recorrente') {
      if (!billingDay || billingDay < 1 || billingDay > 31) {
        setError('O dia de vencimento precisa estar entre 1 e 31.');
        return;
      }
      if (!billingPeriodMonths || billingPeriodMonths < 1) {
        setError('A periodicidade precisa ser de pelo menos 1 mês.');
        return;
      }
    }
    if (billingType === 'pontual' && (!installments || installments < 1)) {
      setError('O contrato precisa ter pelo menos 1 parcela.');
      return;
    }

    try {
      setIsLoading(true);

      const payload = {
        clientId: fixedClientId || clientId,
        serviceType,
        description: description.trim() || null,
        billingType,
        valueCents,
        billingDay: billingType === 'recorrente' ? Number(billingDay) : null,
        billingPeriodMonths:
          billingType === 'recorrente' ? Number(billingPeriodMonths) : null,
        installments: billingType === 'pontual' ? Number(installments) : null,
        startDate,
        endDate: endDate.trim() ? endDate.trim() : null,
        status,
      };

      const result = contractToEdit
        ? await apiFetch<Contract>(`/api/contracts/${contractToEdit.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<Contract>('/api/contracts', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

      toast.success(contractToEdit ? 'Contrato atualizado.' : 'Contrato criado.');
      onSuccess(result);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível salvar o contrato.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={contractToEdit ? 'Editar contrato' : 'Novo contrato'}
      description={
        contractToEdit
          ? 'Atualize os dados e as condições financeiras do contrato.'
          : 'Cadastre um contrato recorrente ou pontual, com serviço e vigência.'
      }
      icon={<FileText className="w-5 h-5" aria-hidden="true" />}
      size="lg"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} isLoading={isLoading}>
            {contractToEdit ? 'Salvar alterações' : 'Criar contrato'}
          </Button>
        </div>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {!fixedClientId && !contractToEdit && (
          <Field label="Cliente" required>
            {(props) => (
              <select
                {...props}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={controlClass}
              >
                <option value="" disabled>
                  Selecione um cliente…
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.tradeName ? ` (${c.tradeName})` : ''}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo de serviço" required>
            {(props) => (
              <select
                {...props}
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceType)}
                className={controlClass}
              >
                {SERVICE_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Status do contrato" required>
            {(props) => (
              <select
                {...props}
                value={status}
                onChange={(e) => setStatus(e.target.value as ContractStatus)}
                className={controlClass}
              >
                {CONTRACT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <Field label="Descrição do escopo">
          {(props) => (
            <input
              {...props}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: 12 posts mensais, stories diários e gestão de tráfego pago"
              className={controlClass}
            />
          )}
        </Field>

        {/* Condições financeiras */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
          <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
            Condições financeiras
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <fieldset>
              <legend className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tipo de cobrança
                <span className="text-rose-600 ml-0.5" aria-hidden="true">
                  *
                </span>
              </legend>
              <div className="flex flex-col gap-2 mt-1">
                <label className="flex items-center gap-2 text-xs text-navy-900 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="billingType"
                    value="recorrente"
                    checked={billingType === 'recorrente'}
                    onChange={() => setBillingType('recorrente')}
                    className="text-teal-600 focus:ring-teal-600"
                  />
                  <span>Recorrente (mensalidade)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-navy-900 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="billingType"
                    value="pontual"
                    checked={billingType === 'pontual'}
                    onChange={() => setBillingType('pontual')}
                    className="text-teal-600 focus:ring-teal-600"
                  />
                  <span>Pontual (projeto parcelado)</span>
                </label>
              </div>
            </fieldset>

            <Field
              label={
                billingType === 'recorrente'
                  ? 'Valor da mensalidade'
                  : 'Valor total do contrato'
              }
              required
            >
              {(props) => (
                <div className="relative">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 pointer-events-none"
                    aria-hidden="true"
                  >
                    R$
                  </span>
                  <input
                    {...props}
                    type="text"
                    inputMode="numeric"
                    value={valueDisplay}
                    onChange={handleValueChange}
                    placeholder="0,00"
                    className={`${controlClass} pl-9 font-mono font-bold`}
                  />
                </div>
              )}
            </Field>
          </div>

          {billingType === 'recorrente' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
              <Field
                label="Dia de vencimento"
                required
                hint="Em meses mais curtos, o vencimento cai no último dia do mês."
              >
                {(props) => (
                  <input
                    {...props}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    value={billingDay}
                    onChange={(e) => setBillingDay(parseInt(e.target.value, 10) || 1)}
                    className={controlClass}
                  />
                )}
              </Field>

              <Field label="Periodicidade" required>
                {(props) => (
                  <select
                    {...props}
                    value={billingPeriodMonths}
                    onChange={(e) =>
                      setBillingPeriodMonths(parseInt(e.target.value, 10) || 1)
                    }
                    className={controlClass}
                  >
                    {PERIODICITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-200">
              <Field
                label="Número de parcelas"
                required
                hint={`Gera ${installments} ${
                  installments === 1 ? 'cobrança' : 'cobranças'
                } com valores e datas editáveis no financeiro.`}
                className="sm:max-w-[50%]"
              >
                {(props) => (
                  <input
                    {...props}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    value={installments}
                    onChange={(e) => setInstallments(parseInt(e.target.value, 10) || 1)}
                    className={controlClass}
                  />
                )}
              </Field>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Início da vigência" required>
            {(props) => (
              <input
                {...props}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={controlClass}
              />
            )}
          </Field>

          <Field
            label="Término da vigência"
            hint="Deixe em branco para prazo indeterminado."
          >
            {(props) => (
              <input
                {...props}
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={controlClass}
              />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
};
