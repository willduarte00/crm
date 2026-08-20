import React, { useState, useEffect } from 'react';
import { Contract } from '../../types/contract';
import { PaymentMethod, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../../types/payment';
import { apiFetch } from '../../services/api';
import { parseBRLToCents, formatCurrencyBRL } from '../../utils/formatters';
import { X, Receipt, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contractId, setContractId] = useState('');
  const [referenceMonth, setReferenceMonth] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');

  // Marcar como pago de imediato
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [paidDate, setPaidDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('PIX');

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const currentMonth = today.toISOString().slice(0, 7);
      const currentDate = today.toISOString().slice(0, 10);

      setReferenceMonth(currentMonth);
      setDueDate(currentDate);
      setPaidDate(currentDate);
      setAmountStr('');
      setNotes('');
      setMarkAsPaid(false);
      setError(null);

      // Carrega contratos ativos
      const loadContracts = async () => {
        try {
          setIsLoadingContracts(true);
          const data: Contract[] = await apiFetch('/api/contracts?status=ativo');
          setContracts(data);
          if (data.length > 0) {
            setContractId(data[0].id);
            setAmountStr(
              (data[0].valueCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            );
          }
        } catch {
          toast.error('Erro ao carregar lista de contratos.');
        } finally {
          setIsLoadingContracts(false);
        }
      };

      loadContracts();
    }
  }, [isOpen]);

  const handleContractChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setContractId(selectedId);

    const contract = contracts.find((c) => c.id === selectedId);
    if (contract) {
      setAmountStr(
        (contract.valueCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractId) {
      toast.error('Selecione um contrato.');
      return;
    }

    if (!referenceMonth || !/^\d{4}-\d{2}$/.test(referenceMonth)) {
      toast.error('Mês de referência inválido (formato esperado: AAAA-MM).');
      return;
    }

    if (!dueDate) {
      toast.error('Informe a data de vencimento.');
      return;
    }

    const amountCents = parseBRLToCents(amountStr);
    if (amountCents <= 0) {
      toast.error('Informe um valor válido maior que zero.');
      return;
    }

    if (markAsPaid && (!paidDate || !paymentMethod)) {
      toast.error('Para registrar como pago, informe a data e a forma de pagamento.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          contractId,
          referenceMonth,
          dueDate,
          amountCents,
          notes: notes.trim() || null,
          status: markAsPaid ? 'Pago' : 'Pendente',
          paidDate: markAsPaid ? paidDate : null,
          paymentMethod: markAsPaid ? paymentMethod : null,
        }),
      });

      toast.success('Cobrança avulsa criada com sucesso!');
      onPaymentCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar cobrança.');
      toast.error(err.message || 'Erro ao criar cobrança.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600/10 text-teal-700 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-900">Nova Cobrança Avulsa</h3>
              <p className="text-xs text-slate-500">
                Gera um registro manual de cobrança com numeração sequencial COB-AAAA-NNNN
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Seleção do Contrato */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contrato do Cliente *
            </label>
            {isLoadingContracts ? (
              <div className="text-xs text-slate-400 py-2">Carregando contratos...</div>
            ) : contracts.length === 0 ? (
              <div className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded border border-amber-200">
                Nenhum contrato ativo encontrado. Cadastre um contrato antes de gerar cobranças.
              </div>
            ) : (
              <select
                value={contractId}
                onChange={handleContractChange}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-navy-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none bg-white"
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client?.name} — {c.serviceType} ({formatCurrencyBRL(c.valueCents)})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mês de Referência */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mês de Referência (AAAA-MM) *
              </label>
              <input
                type="month"
                value={referenceMonth}
                onChange={(e) => setReferenceMonth(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-navy-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none"
              />
            </div>

            {/* Data de Vencimento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Vencimento *
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-navy-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none"
              />
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Valor da Cobrança (R$) *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-xs font-bold text-slate-400">R$</span>
              <input
                type="text"
                value={amountStr}
                onChange={handleAmountChange}
                required
                placeholder="0,00"
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-navy-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none"
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Cobrança avulsa referente a taxa de setup..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-navy-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none resize-none"
            />
          </div>

          {/* Checkbox: Marcar como pago de imediato */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={markAsPaid}
                onChange={(e) => setMarkAsPaid(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              <span className="text-xs font-medium text-slate-700">
                Marcar como pago imediatamente (baixa manual)
              </span>
            </label>

            {markAsPaid && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Data do Pagamento *
                  </label>
                  <input
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    required={markAsPaid}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs text-navy-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Forma de Pagamento *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    required={markAsPaid}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs text-navy-900 bg-white"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé do Formulário */}
          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || contracts.length === 0}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Receipt className="w-4 h-4" />
              )}
              Criar Cobrança
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
