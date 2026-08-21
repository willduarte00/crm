import React, { useState, useEffect } from 'react';
import { Contract } from '../../types/contract';
import {
  PaymentMethod,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from '../../types/payment';
import { apiFetch, errorMessage } from '../../services/api';
import { parseBRLToCents, formatCurrencyBRL } from '../../utils/formatters';
import { Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { FormAlert, LoadingState } from '../ui/States';

interface CreatePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentCreated: () => void;
}

export const CreatePaymentModal: React.FC<CreatePaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentCreated,
}) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [contractsError, setContractsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contractId, setContractId] = useState('');
  const [referenceMonth, setReferenceMonth] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');

  // Baixa imediata no momento da criação
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [paidDate, setPaidDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('PIX');

  const formId = 'create-payment-form';

  useEffect(() => {
    if (!isOpen) return;

    const today = new Date();
    setReferenceMonth(today.toISOString().slice(0, 7));
    setDueDate(today.toISOString().slice(0, 10));
    setPaidDate(today.toISOString().slice(0, 10));
    setAmountStr('');
    setNotes('');
    setMarkAsPaid(false);
    setError(null);
    setContractsError(false);

    const loadContracts = async () => {
      try {
        setIsLoadingContracts(true);
        const data: Contract[] = await apiFetch('/api/contracts?status=ativo');
        setContracts(data);
        if (data.length > 0) {
          setContractId(data[0].id);
          setAmountStr(
            (data[0].valueCents / 100).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })
          );
        } else {
          setContractId('');
        }
      } catch {
        setContracts([]);
        setContractsError(true);
      } finally {
        setIsLoadingContracts(false);
      }
    };

    loadContracts();
  }, [isOpen]);

  const handleContractChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setContractId(selectedId);

    const contract = contracts.find((c) => c.id === selectedId);
    if (contract) {
      setAmountStr(
        (contract.valueCents / 100).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
        })
      );
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (!raw) {
      setAmountStr('0,00');
      return;
    }
    const cents = parseInt(raw, 10);
    setAmountStr((cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!contractId) {
      setError('Selecione o contrato que originou esta cobrança.');
      return;
    }
    if (!referenceMonth || !/^\d{4}-\d{2}$/.test(referenceMonth)) {
      setError('Informe o mês de referência da cobrança.');
      return;
    }
    if (!dueDate) {
      setError('Informe a data de vencimento.');
      return;
    }

    const cents = parseBRLToCents(amountStr);
    if (cents <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    if (markAsPaid && (!paidDate || !paymentMethod)) {
      setError('Para registrar como paga, informe a data e a forma de pagamento.');
      return;
    }

    try {
      setIsSubmitting(true);

      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          contractId,
          referenceMonth,
          dueDate,
          amountCents: cents,
          notes: notes.trim() || null,
          status: markAsPaid ? 'Pago' : 'Pendente',
          paidDate: markAsPaid ? paidDate : null,
          paymentMethod: markAsPaid ? paymentMethod : null,
        }),
      });

      toast.success(markAsPaid ? 'Cobrança criada e baixada.' : 'Cobrança criada.');
      onPaymentCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível criar a cobrança.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewCents = parseBRLToCents(amountStr);
  const hasContracts = contracts.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nova cobrança avulsa"
      description="Cria um registro manual com numeração sequencial no formato COB-AAAA-NNNN."
      icon={<Receipt className="w-5 h-5" aria-hidden="true" />}
      size="md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            isLoading={isSubmitting}
            disabled={!hasContracts || isLoadingContracts}
          >
            {markAsPaid ? 'Criar e dar baixa' : 'Criar cobrança'}
          </Button>
        </div>
      }
    >
      {error && <FormAlert>{error}</FormAlert>}

      {isLoadingContracts ? (
        <LoadingState message="Carregando contratos ativos…" />
      ) : (
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          {contractsError && (
            <FormAlert tone="warning">
              A lista de contratos não pôde ser carregada. Feche e abra novamente esta
              janela para tentar de novo.
            </FormAlert>
          )}

          {!contractsError && !hasContracts && (
            <FormAlert tone="warning">
              Nenhum contrato ativo encontrado. Cadastre ou reative um contrato antes de
              criar uma cobrança.
            </FormAlert>
          )}

          <Field
            label="Contrato"
            required
            hint="O valor vem do contrato e pode ser ajustado abaixo."
          >
            {(props) => (
              <select
                {...props}
                value={contractId}
                onChange={handleContractChange}
                disabled={!hasContracts}
                className={controlClass}
              >
                {!hasContracts && <option value="">Nenhum contrato ativo</option>}
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client?.name || 'Cliente'} — {c.serviceType} (
                    {formatCurrencyBRL(c.valueCents)})
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Mês de referência" required>
              {(props) => (
                <input
                  {...props}
                  type="month"
                  value={referenceMonth}
                  onChange={(e) => setReferenceMonth(e.target.value)}
                  className={controlClass}
                />
              )}
            </Field>

            <Field label="Data de vencimento" required>
              {(props) => (
                <input
                  {...props}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={controlClass}
                />
              )}
            </Field>
          </div>

          <Field
            label="Valor da cobrança"
            required
            hint={previewCents > 0 ? formatCurrencyBRL(previewCents) : undefined}
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
                  value={amountStr}
                  onChange={handleAmountChange}
                  placeholder="0,00"
                  className={`${controlClass} pl-9 font-mono font-bold`}
                />
              </div>
            )}
          </Field>

          {/* Baixa imediata */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={markAsPaid}
                onChange={(e) => setMarkAsPaid(e.target.checked)}
                className="mt-0.5 rounded text-teal-600 focus:ring-teal-600 border-slate-300"
              />
              <span>
                <span className="block text-xs font-semibold text-navy-900">
                  Registrar como já paga
                </span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  Use quando o cliente já pagou. A cobrança entra no caixa do mês da data
                  informada.
                </span>
              </span>
            </label>

            {markAsPaid && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                <Field label="Data do pagamento" required>
                  {(props) => (
                    <input
                      {...props}
                      type="date"
                      value={paidDate}
                      onChange={(e) => setPaidDate(e.target.value)}
                      className={controlClass}
                    />
                  )}
                </Field>

                <Field label="Forma de pagamento" required>
                  {(props) => (
                    <select
                      {...props}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className={controlClass}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
            )}
          </div>

          <Field label="Observações">
            {(props) => (
              <textarea
                {...props}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexto da cobrança, combinados com o cliente…"
                className={controlClass}
              />
            )}
          </Field>
        </form>
      )}
    </Modal>
  );
};
