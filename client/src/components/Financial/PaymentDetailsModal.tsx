import React, { useState, useEffect, useRef } from 'react';
import {
  PaymentRecord,
  PaymentMethod,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  InvoiceFile,
} from '../../types/payment';
import { apiFetch, apiDownload, errorMessage } from '../../services/api';
import {
  formatDateBR,
  formatDateTimeBR,
  formatCurrencyBRL,
  parseBRLToCents,
  formatFileSize,
  formatReferenceMonthBR,
} from '../../utils/formatters';
import {
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
  Building2,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Button, IconButton } from '../ui/Button';
import { Field, controlClass } from '../ui/Field';
import { FormAlert, LoadingState, ErrorState } from '../ui/States';
import { useConfirm } from '../ui/ConfirmDialog';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string | null;
  onPaymentUpdated: () => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const VALID_EXTENSIONS = ['.pdf', '.xml'];

export const PaymentDetailsModal: React.FC<PaymentDetailsModalProps> = ({
  isOpen,
  onClose,
  paymentId,
  onPaymentUpdated,
}) => {
  const confirm = useConfirm();

  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingFile, setIsDeletingFile] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Campos de baixa manual
  const [amountStr, setAmountStr] = useState('');
  const [paidDate, setPaidDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [notes, setNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formId = 'payment-settle-form';

  const fetchPaymentDetails = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setLoadFailed(false);

      const data: PaymentRecord = await apiFetch(`/api/payments/${id}`);
      setPayment(data);

      setAmountStr(
        (data.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      );
      setPaidDate(data.paidDate || new Date().toISOString().slice(0, 10));
      setPaymentMethod((data.paymentMethod as PaymentMethod) || 'PIX');
      setNotes(data.notes || '');
    } catch {
      setPayment(null);
      setLoadFailed(true);
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
      setLoadFailed(false);
    }
  }, [isOpen, paymentId]);

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
    if (!payment || isSubmitting) return;
    setError(null);

    if (!paidDate) {
      setError('Informe a data em que o pagamento foi recebido.');
      return;
    }
    if (!paymentMethod) {
      setError('Selecione a forma de pagamento.');
      return;
    }

    const amountCents = parseBRLToCents(amountStr);
    if (amountCents <= 0) {
      setError('O valor recebido precisa ser maior que zero.');
      return;
    }

    // O valor é editável para registrar desconto ou pagamento parcial; quando
    // diverge do emitido, confirmamos para não gravar um erro de digitação.
    if (amountCents !== payment.amountCents) {
      const confirmed = await confirm({
        title: 'Valor diferente do emitido',
        confirmLabel: 'Registrar este valor',
        message: (
          <>
            A cobrança foi emitida por{' '}
            <strong className="text-navy-900">
              {formatCurrencyBRL(payment.amountCents)}
            </strong>{' '}
            e você está registrando{' '}
            <strong className="text-navy-900">{formatCurrencyBRL(amountCents)}</strong>. O
            valor emitido será substituído nos relatórios financeiros.
          </>
        ),
      });
      if (!confirmed) return;
    }

    try {
      setIsSubmitting(true);

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
      toast.success(`Cobrança ${updated.number} baixada.`);
      onPaymentUpdated();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível registrar o pagamento.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPayment = async () => {
    if (!payment || isSubmitting) return;

    const confirmed = await confirm({
      title: 'Cancelar cobrança',
      tone: 'danger',
      confirmLabel: 'Cancelar cobrança',
      cancelLabel: 'Voltar',
      message: (
        <>
          A cobrança <strong className="text-navy-900">{payment.number}</strong> sairá do
          faturamento e da inadimplência. O número não será reaproveitado, mas você pode
          reabri-la depois.
        </>
      ),
    });
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const updated = await apiFetch<PaymentRecord>(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Cancelado' }),
      });

      setPayment(updated);
      toast.success(`Cobrança ${updated.number} cancelada.`);
      onPaymentUpdated();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível cancelar a cobrança.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopenPayment = async () => {
    if (!payment || isSubmitting) return;

    const wasPaid = payment.status === 'Pago';
    const confirmed = await confirm({
      title: 'Reabrir cobrança',
      confirmLabel: 'Reabrir como pendente',
      cancelLabel: 'Voltar',
      message: wasPaid ? (
        <>
          A cobrança <strong className="text-navy-900">{payment.number}</strong> voltará a
          pendente. A data e a forma de pagamento registradas serão descartadas e o valor
          sairá do caixa do mês.
        </>
      ) : (
        <>
          A cobrança <strong className="text-navy-900">{payment.number}</strong> voltará a
          pendente e será considerada de novo no faturamento.
        </>
      ),
    });
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const updated = await apiFetch<PaymentRecord>(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Pendente' }),
      });

      setPayment(updated);
      toast.success(`Cobrança ${updated.number} reaberta como pendente.`);
      onPaymentUpdated();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível reabrir a cobrança.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !payment) return;

    setError(null);

    if (file.size > MAX_FILE_BYTES) {
      const message = `“${file.name}” tem ${formatFileSize(
        file.size
      )}. O limite por arquivo é 10 MB.`;
      setError(message);
      toast.error(message);
      resetFileInput();
      return;
    }

    const hasValidExt = VALID_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    if (!hasValidExt) {
      const message = 'Envie a nota fiscal em PDF ou XML.';
      setError(message);
      toast.error(message);
      resetFileInput();
      return;
    }

    const formData = new FormData();
    formData.append('paymentRecordId', payment.id);
    formData.append('file', file);

    try {
      setIsUploading(true);
      // apiFetch em vez de fetch cru: preserva o tratamento de sessão expirada
      // e impede que a resposta bruta do servidor vá para a tela.
      const newInvoice = await apiFetch<InvoiceFile>('/api/files', {
        method: 'POST',
        body: formData,
      });

      setPayment((prev) =>
        prev ? { ...prev, invoices: [newInvoice, ...(prev.invoices || [])] } : null
      );
      toast.success('Nota fiscal anexada.');
      onPaymentUpdated();
      resetFileInput();
    } catch (err) {
      const message = errorMessage(err, 'Não foi possível anexar a nota fiscal.');
      setError(message);
      toast.error(message);
      resetFileInput();
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadInvoice = async (invoice: InvoiceFile) => {
    if (downloadingId) return;
    try {
      setDownloadingId(invoice.id);
      await apiDownload(`/api/files/${invoice.id}`, invoice.originalName);
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível baixar a nota fiscal.'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteInvoice = async (invoice: InvoiceFile) => {
    if (isDeletingFile) return;

    const confirmed = await confirm({
      title: 'Excluir nota fiscal',
      tone: 'danger',
      confirmLabel: 'Excluir nota fiscal',
      message: (
        <>
          O arquivo <strong className="text-navy-900">{invoice.originalName}</strong> será
          removido desta cobrança e apagado do servidor. Esta ação não pode ser desfeita.
        </>
      ),
    });
    if (!confirmed) return;

    try {
      setIsDeletingFile(invoice.id);
      await apiFetch(`/api/files/${invoice.id}`, { method: 'DELETE' });
      setPayment((prev) =>
        prev
          ? {
              ...prev,
              invoices: (prev.invoices || []).filter((inv) => inv.id !== invoice.id),
            }
          : null
      );
      toast.success('Nota fiscal excluída.');
      onPaymentUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível excluir a nota fiscal.'));
    } finally {
      setIsDeletingFile(null);
    }
  };

  const renderStatusBadge = (effectiveStatus?: string) => {
    switch (effectiveStatus) {
      case 'Pago':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Pago
          </span>
        );
      case 'Atrasado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            Atrasado
          </span>
        );
      case 'Cancelado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Ban className="w-3.5 h-3.5" aria-hidden="true" />
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            Pendente
          </span>
        );
    }
  };

  const isOpenForSettlement =
    !!payment && payment.status !== 'Pago' && payment.status !== 'Cancelado';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={payment?.number || 'Detalhes da cobrança'}
      description={
        payment
          ? `Referência ${formatReferenceMonthBR(
              payment.referenceMonth
            )} • Vence em ${formatDateBR(payment.dueDate)}`
          : undefined
      }
      icon={<Receipt className="w-5 h-5" aria-hidden="true" />}
      size="xl"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Fechar
          </Button>
          {isOpenForSettlement && (
            <Button
              type="submit"
              form={formId}
              isLoading={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
            >
              Confirmar baixa
            </Button>
          )}
        </div>
      }
    >
      {isLoading ? (
        <LoadingState message="Carregando dados da cobrança…" />
      ) : loadFailed ? (
        <ErrorState
          title="Não foi possível carregar a cobrança"
          message="Os dados não puderam ser lidos do servidor. Verifique sua conexão e tente novamente."
          onRetry={() => paymentId && fetchPaymentDetails(paymentId)}
        />
      ) : payment ? (
        <div className="space-y-5">
          {/* Status e valor em destaque, no topo do conteúdo */}
          <div className="flex items-center gap-3 flex-wrap">
            {renderStatusBadge(payment.effectiveStatus || payment.status)}
            <span className="text-sm font-bold text-navy-900 tabular-nums">
              {formatCurrencyBRL(payment.amountCents)}
            </span>
          </div>

          {error && <FormAlert>{error}</FormAlert>}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Coluna esquerda: dados e baixa */}
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-navy-900 min-w-0">
                    <Building2
                      className="w-4 h-4 text-slate-500 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {payment.contract?.client?.name || 'Cliente'}
                    </span>
                    {payment.contract?.client?.tradeName && (
                      <span className="text-slate-500 font-normal truncate">
                        ({payment.contract.client.tradeName})
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 flex-shrink-0">
                    {payment.contract?.serviceType}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <dt className="text-[11px] text-slate-500">Valor emitido</dt>
                    <dd className="font-bold text-navy-900 tabular-nums">
                      {formatCurrencyBRL(payment.amountCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">Vencimento</dt>
                    <dd className="font-bold text-navy-900 tabular-nums">
                      {formatDateBR(payment.dueDate)}
                    </dd>
                  </div>
                </dl>
              </div>

              {payment.status === 'Pago' ? (
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3 border-b border-emerald-200 pb-3">
                    <h3 className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                      <CheckCircle2
                        className="w-4 h-4 text-emerald-700"
                        aria-hidden="true"
                      />
                      <span>Pagamento confirmado</span>
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReopenPayment}
                      disabled={isSubmitting}
                      className="text-emerald-800 hover:bg-emerald-100"
                    >
                      Reabrir
                    </Button>
                  </div>

                  <dl className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <dt className="text-[11px] text-emerald-800">Valor recebido</dt>
                      <dd className="font-bold text-emerald-900 text-sm tabular-nums">
                        {formatCurrencyBRL(payment.amountCents)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-emerald-800">Data do pagamento</dt>
                      <dd className="font-bold text-emerald-900 text-sm tabular-nums">
                        {formatDateBR(payment.paidDate)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[11px] text-emerald-800">Forma de pagamento</dt>
                      <dd className="font-semibold text-emerald-900">
                        {PAYMENT_METHOD_LABELS[payment.paymentMethod as PaymentMethod] ||
                          payment.paymentMethod ||
                          '—'}
                      </dd>
                    </div>
                    {payment.notes && (
                      <div className="col-span-2">
                        <dt className="text-[11px] text-emerald-800">Observações</dt>
                        <dd className="text-emerald-900 bg-white/80 p-2.5 rounded-lg border border-emerald-100 mt-1 whitespace-pre-wrap">
                          {payment.notes}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              ) : payment.status === 'Cancelado' ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-3 text-center">
                  <Ban className="w-8 h-8 mx-auto text-slate-500" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-navy-900">Cobrança cancelada</h3>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto">
                    Esta cobrança está fora do faturamento. O número{' '}
                    <strong className="text-navy-900">{payment.number}</strong> ficou
                    reservado no histórico e não será reutilizado.
                  </p>
                  <div className="pt-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleReopenPayment}
                      disabled={isSubmitting}
                    >
                      Reabrir cobrança
                    </Button>
                  </div>
                </div>
              ) : (
                <form
                  id={formId}
                  onSubmit={handleMarkAsPaid}
                  className="border border-slate-200 rounded-lg p-5 space-y-4 bg-white"
                >
                  <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <DollarSign className="w-4 h-4 text-teal-600" aria-hidden="true" />
                    <span>Registrar pagamento</span>
                  </h3>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <Field
                      label="Valor recebido"
                      required
                      hint="Ajuste para registrar desconto ou pagamento parcial."
                    >
                      {(props) => (
                        <div className="relative flex items-center">
                          <span
                            className="absolute left-3 text-base font-bold text-slate-500 pointer-events-none"
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
                            className="w-full pl-10 pr-3 py-1.5 bg-transparent text-lg font-bold text-navy-900 tabular-nums border-b-2 border-slate-300 focus:border-teal-600 focus:outline-none transition-colors"
                          />
                        </div>
                      )}
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Data do pagamento" required>
                      {(props) => (
                        <div className="relative">
                          <Calendar
                            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            {...props}
                            type="date"
                            value={paidDate}
                            onChange={(e) => setPaidDate(e.target.value)}
                            className={`${controlClass} pl-9`}
                          />
                        </div>
                      )}
                    </Field>

                    <Field label="Forma de pagamento" required>
                      {(props) => (
                        <select
                          {...props}
                          value={paymentMethod}
                          onChange={(e) =>
                            setPaymentMethod(e.target.value as PaymentMethod)
                          }
                          className={controlClass}
                        >
                          <option value="" disabled>
                            Selecione…
                          </option>
                          {PAYMENT_METHODS.map((method) => (
                            <option key={method} value={method}>
                              {PAYMENT_METHOD_LABELS[method]}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  </div>

                  <Field label="Observações internas">
                    {(props) => (
                      <textarea
                        {...props}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: desconto negociado por WhatsApp"
                        rows={2}
                        className={`${controlClass} resize-none`}
                      />
                    )}
                  </Field>

                  <div className="pt-3 border-t border-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelPayment}
                      disabled={isSubmitting}
                      icon={<Ban className="w-3.5 h-3.5" aria-hidden="true" />}
                      className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    >
                      Cancelar esta cobrança
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Coluna direita: notas fiscais */}
            <div className="lg:col-span-5">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
                <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2 border-b border-slate-200 pb-3">
                  <FileText className="w-4 h-4 text-teal-600" aria-hidden="true" />
                  <span>Nota fiscal</span>
                </h3>

                <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-lg p-5 text-center transition-colors bg-white">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.xml,application/pdf,text/xml,application/xml"
                    onChange={handleInvoiceUpload}
                    disabled={isUploading}
                    className="sr-only"
                    id="invoice-file-input"
                  />
                  <label
                    htmlFor="invoice-file-input"
                    className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <div
                      className="w-9 h-9 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100"
                      aria-hidden="true"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-xs font-bold text-navy-900">
                      {isUploading ? 'Enviando…' : 'Anexar nota fiscal'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      PDF ou XML, até 10 MB
                    </span>
                  </label>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Arquivos anexados ({payment.invoices?.length || 0})
                  </h4>

                  {!payment.invoices || payment.invoices.length === 0 ? (
                    <div className="py-6 px-3 text-center bg-white rounded-lg border border-slate-200">
                      <FileText
                        className="w-6 h-6 mx-auto mb-1.5 text-slate-400"
                        aria-hidden="true"
                      />
                      <p className="text-[11px] font-medium text-slate-700">
                        Nenhuma nota fiscal anexada
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Envie o PDF ou XML emitido para o cliente.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {payment.invoices.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex items-center justify-between gap-2 p-2.5 bg-white border border-slate-200 rounded-lg hover:border-teal-400 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0 border border-slate-200"
                              aria-hidden="true"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p
                                className="text-xs font-bold text-navy-900 truncate"
                                title={inv.originalName}
                              >
                                {inv.originalName}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {formatFileSize(inv.fileSize)} •{' '}
                                {formatDateTimeBR(inv.uploadedAt)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <IconButton
                              label={`Baixar ${inv.originalName}`}
                              onClick={() => handleDownloadInvoice(inv)}
                              isLoading={downloadingId === inv.id}
                              className="!p-1.5"
                            >
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              label={`Excluir ${inv.originalName}`}
                              tone="danger"
                              onClick={() => handleDeleteInvoice(inv)}
                              isLoading={isDeletingFile === inv.id}
                              disabled={isDeletingFile !== null}
                              className="!p-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </IconButton>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
