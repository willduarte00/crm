import React, { useState, useEffect, useRef } from 'react';
import { PaymentRecord, PaymentMethod, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, InvoiceFile } from '../../types/payment';
import { apiFetch } from '../../services/api';
import {
  formatDateBR,
  formatDateTimeBR,
  formatCurrencyBRL,
  parseBRLToCents,
  formatFileSize,
  formatReferenceMonthBR,
} from '../../utils/formatters';
import {
  X,
  FileText,
  Upload,
  Download,
  Trash2,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Ban,
  Loader2,
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string | null;
  onPaymentUpdated: () => void;
}

export const PaymentDetailsModal: React.FC<PaymentDetailsModalProps> = ({
  isOpen,
  onClose,
  paymentId,
  onPaymentUpdated,
}) => {
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingFile, setIsDeletingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Campos de baixa manual
  const [amountStr, setAmountStr] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [notes, setNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPaymentDetails = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data: PaymentRecord = await apiFetch(`/api/payments/${id}`);
      setPayment(data);

      // Preenche os campos do formulário
      setAmountStr((data.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
      setPaidDate(data.paidDate || new Date().toISOString().slice(0, 10));
      setPaymentMethod((data.paymentMethod as PaymentMethod) || 'PIX');
      setNotes(data.notes || '');
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar detalhes da cobrança.');
      toast.error('Erro ao carregar cobrança');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && paymentId) {
      fetchPaymentDetails(paymentId);
    } else {
      setPayment(null);
      setError(null);
    }
  }, [isOpen, paymentId]);

  if (!isOpen) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (!raw) {
      setAmountStr('0,00');
      return;
    }
    const cents = parseInt(raw, 10);
    setAmountStr((cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  };

  const handleMarkAsPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;

    if (!paidDate) {
      toast.error('Informe a data de pagamento.');
      return;
    }

    if (!paymentMethod) {
      toast.error('Selecione a forma de pagamento.');
      return;
    }

    const amountCents = parseBRLToCents(amountStr);
    if (amountCents < 0) {
      toast.error('O valor pago deve ser maior ou igual a zero.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updated = await apiFetch<PaymentRecord>(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'Pago',
          paidDate,
          paymentMethod,
          amountCents,
          notes: notes.trim() || null,
        }),
      });

      setPayment(updated);
      toast.success('Cobrança marcada como paga com sucesso!');
      onPaymentUpdated();
    } catch (err: any) {
      setError(err.message || 'Erro ao dar baixa no pagamento.');
      toast.error(err.message || 'Erro ao salvar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPayment = async () => {
    if (!payment) return;

    if (
      !confirm(
        `Deseja realmente cancelar a cobrança ${payment.number}? Esta numeração não será reaproveitada.`
      )
    ) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updated = await apiFetch<PaymentRecord>(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'Cancelado',
        }),
      });

      setPayment(updated);
      toast.success('Cobrança cancelada com sucesso.');
      onPaymentUpdated();
    } catch (err: any) {
      setError(err.message || 'Erro ao cancelar cobrança.');
      toast.error(err.message || 'Erro ao cancelar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopenPayment = async () => {
    if (!payment) return;

    if (!confirm(`Deseja reabrir a cobrança ${payment.number} como Pendente?`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updated = await apiFetch<PaymentRecord>(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'Pendente',
        }),
      });

      setPayment(updated);
      toast.success('Cobrança reaberta como Pendente.');
      onPaymentUpdated();
    } catch (err: any) {
      setError(err.message || 'Erro ao reabrir cobrança.');
      toast.error(err.message || 'Erro ao reabrir.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !payment) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo excede o limite máximo de 10 MB.');
      return;
    }

    const validExtensions = ['.pdf', '.xml'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      toast.error('Formato inválido. Apenas arquivos PDF e XML são aceitos para Notas Fiscais.');
      return;
    }

    const formData = new FormData();
    formData.append('paymentRecordId', payment.id);
    formData.append('file', file);

    try {
      setIsUploading(true);
      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro no upload da Nota Fiscal.');
      }

      const newInvoice: InvoiceFile = await res.json();
      setPayment((prev) =>
        prev
          ? {
              ...prev,
              invoices: [newInvoice, ...(prev.invoices || [])],
            }
          : null
      );

      toast.success('Nota Fiscal anexada com sucesso!');
      onPaymentUpdated();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro no upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadInvoice = async (invoice: InvoiceFile) => {
    try {
      const res = await fetch(`/api/files/${invoice.id}`);
      if (!res.ok) throw new Error('Falha no download da Nota Fiscal.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = invoice.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao baixar arquivo.');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Deseja realmente excluir este arquivo de Nota Fiscal?')) {
      return;
    }

    try {
      setIsDeletingFile(invoiceId);
      await apiFetch(`/api/files/${invoiceId}`, { method: 'DELETE' });
      setPayment((prev) =>
        prev
          ? {
              ...prev,
              invoices: (prev.invoices || []).filter((inv) => inv.id !== invoiceId),
            }
          : null
      );
      toast.success('Nota Fiscal excluída.');
      onPaymentUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir arquivo.');
    } finally {
      setIsDeletingFile(null);
    }
  };

  const renderStatusBadge = (effectiveStatus?: string) => {
    switch (effectiveStatus) {
      case 'Pago':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pago
          </span>
        );
      case 'Atrasado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Atrasado
          </span>
        );
      case 'Cancelado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Ban className="w-3.5 h-3.5" />
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600/10 text-teal-700 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-navy-900 font-display-lg-mobile">
                  {payment?.number || 'Detalhes da Cobrança'}
                </h3>
                {payment && renderStatusBadge(payment.effectiveStatus || payment.status)}
              </div>
              <p className="text-xs text-slate-500">
                Referência: {payment ? formatReferenceMonthBR(payment.referenceMonth) : '-'} •
                Vencimento: {payment ? formatDateBR(payment.dueDate) : '-'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2 text-teal-600" />
              <p className="text-xs">Carregando dados da cobrança...</p>
            </div>
          ) : error && !payment ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          ) : payment ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Coluna Esquerda: Dados Principais / Formulário de Baixa */}
              <div className="lg:col-span-7 space-y-6">
                {/* Resumo do Cliente e Contrato */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-navy-900">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span>{payment.contract?.client?.name || 'Cliente'}</span>
                      {payment.contract?.client?.tradeName && (
                        <span className="text-slate-400 font-normal">
                          ({payment.contract.client.tradeName})
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">
                      {payment.contract?.serviceType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Valor Original</span>
                      <span className="font-bold text-navy-900">
                        {formatCurrencyBRL(payment.amountCents)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Vencimento</span>
                      <span className="font-bold text-navy-900">
                        {formatDateBR(payment.dueDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seção de Baixa Manual (RF-29) ou Exibição de Pago */}
                {payment.status === 'Pago' ? (
                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Pagamento Confirmado</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleReopenPayment}
                        disabled={isSubmitting}
                        className="text-xs text-emerald-700 hover:text-emerald-900 underline font-medium"
                      >
                        Reabrir cobrança
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-[11px] text-emerald-700 block">Valor Recebido</span>
                        <span className="font-bold text-emerald-900 text-sm">
                          {formatCurrencyBRL(payment.amountCents)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-emerald-700 block">Data do Pagamento</span>
                        <span className="font-bold text-emerald-900 text-sm">
                          {formatDateBR(payment.paidDate)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[11px] text-emerald-700 block">Forma de Pagamento</span>
                        <span className="font-semibold text-emerald-900">
                          {PAYMENT_METHOD_LABELS[payment.paymentMethod as PaymentMethod] ||
                            payment.paymentMethod ||
                            '-'}
                        </span>
                      </div>
                      {payment.notes && (
                        <div className="col-span-2">
                          <span className="text-[11px] text-emerald-700 block">Observações</span>
                          <p className="text-emerald-900 bg-white/70 p-2.5 rounded border border-emerald-100 mt-1">
                            {payment.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : payment.status === 'Cancelado' ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-3 text-center">
                    <Ban className="w-8 h-8 mx-auto text-slate-400" />
                    <h4 className="text-sm font-bold text-slate-700">Cobrança Cancelada</h4>
                    <p className="text-xs text-slate-500">
                      Esta cobrança foi cancelada e seu número (<strong>{payment.number}</strong>) foi preservado no histórico financeiro.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleReopenPayment}
                        disabled={isSubmitting}
                        className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded transition-colors"
                      >
                        Reabrir Cobrança
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Formulário de Baixa Manual (RF-29) */
                  <form onSubmit={handleMarkAsPaid} className="border border-slate-200 rounded-lg p-5 space-y-4 bg-white shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h4 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-teal-600" />
                        <span>Dar Baixa Manual no Pagamento</span>
                      </h4>
                      <span className="text-[11px] text-slate-400">RF-29</span>
                    </div>

                    {/* Valor Final Recebido (proeminente e editável) */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                        Valor Final Recebido (R$)
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-base font-bold text-slate-400">R$</span>
                        <input
                          type="text"
                          value={amountStr}
                          onChange={handleAmountChange}
                          className="w-full pl-10 pr-3 py-1.5 bg-transparent text-lg font-bold text-navy-900 border-b-2 border-slate-300 focus:border-teal-600 focus:outline-none transition-colors"
                          placeholder="0,00"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Edite o valor para registrar pagamentos com desconto ou parciais.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Data do Pagamento */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Data do Pagamento *
                        </label>
                        <div className="relative">
                          <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <input
                            type="date"
                            value={paidDate}
                            onChange={(e) => setPaidDate(e.target.value)}
                            required
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-navy-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none"
                          />
                        </div>
                      </div>

                      {/* Forma de Pagamento */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Forma de Pagamento *
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                          required
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-navy-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none bg-white"
                        >
                          <option value="" disabled>
                            Selecione...
                          </option>
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method} value={method}>
                              {PAYMENT_METHOD_LABELS[method]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Observações Internas */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Observações Internas
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Pagamento com desconto negociado via WhatsApp..."
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-navy-900 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 outline-none resize-none"
                      />
                    </div>

                    {/* Botões de Ação */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleCancelPayment}
                        disabled={isSubmitting}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Cancelar Cobrança
                      </button>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Confirmar Baixa
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Coluna Direita: Nota Fiscal Anexa (RF-31) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h4 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-600" />
                      <span>Nota Fiscal (NF)</span>
                    </h4>
                    <span className="text-[11px] font-medium text-slate-400">RF-31</span>
                  </div>

                  {/* Dropzone de Upload de NF */}
                  <div className="border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-lg p-5 text-center transition-colors bg-white">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".pdf,.xml,application/pdf,text/xml,application/xml"
                      onChange={handleInvoiceUpload}
                      disabled={isUploading}
                      className="hidden"
                      id="invoice-file-input"
                    />
                    <label
                      htmlFor="invoice-file-input"
                      className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                    >
                      <div className="w-9 h-9 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-navy-900">
                        {isUploading ? 'Enviando NF...' : 'Anexar Nota Fiscal'}
                      </p>
                      <p className="text-[10px] text-slate-400">PDF ou XML até 10 MB</p>
                    </label>
                  </div>

                  {/* Lista de NFs Anexadas */}
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Arquivos Anexados ({payment.invoices?.length || 0})
                    </h5>

                    {(!payment.invoices || payment.invoices.length === 0) ? (
                      <div className="py-6 text-center text-slate-400 bg-white rounded-lg border border-slate-200/60">
                        <FileText className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                        <p className="text-[11px] font-medium text-slate-600">
                          Nenhuma Nota Fiscal anexada
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Faça o upload do arquivo PDF ou XML emitido
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {payment.invoices.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg hover:border-teal-400 transition-colors shadow-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded bg-rose-50 text-rose-600 flex items-center justify-center font-bold flex-shrink-0 border border-rose-100">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="text-xs font-bold text-navy-900 truncate"
                                  title={inv.originalName}
                                >
                                  {inv.originalName}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {formatFileSize(inv.fileSize)} • {formatDateTimeBR(inv.uploadedAt)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleDownloadInvoice(inv)}
                                title="Baixar Nota Fiscal"
                                className="p-1.5 text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteInvoice(inv.id)}
                                disabled={isDeletingFile === inv.id}
                                title="Excluir Nota Fiscal"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-50"
                              >
                                {isDeletingFile === inv.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
