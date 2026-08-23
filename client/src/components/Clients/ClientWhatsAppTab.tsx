import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Receipt, ShieldAlert } from 'lucide-react';
import { Client, InteractionLog } from '../../types/client';
import { AgencySettingsSummary } from '../../types/dashboard';
import { PaginatedPaymentsResponse, PaymentRecord } from '../../types/payment';
import { apiFetch } from '../../services/api';
import { LoadingState } from '../ui/States';
import {
  formatCurrencyBRL,
  formatDateBR,
  formatPhoneBR,
  formatReferenceMonthShort,
} from '../../utils/formatters';
import { WhatsAppComposer } from '../WhatsApp/WhatsAppComposer';
import { TEMPLATES, WhatsAppTemplateKey } from '../WhatsApp/templates';

interface ClientWhatsAppTabProps {
  client: Client;
  /** Recebe a anotação criada quando o disparo é registrado no histórico. */
  onLogged: (log: InteractionLog) => void;
}

/** Cobranças em aberto primeiro, da mais antiga para a mais nova. */
function sortPayments(payments: PaymentRecord[]): PaymentRecord[] {
  const openStatuses = ['Pendente', 'Atrasado'];
  return [...payments].sort((a, b) => {
    const aOpen = openStatuses.includes(a.effectiveStatus || a.status);
    const bOpen = openStatuses.includes(b.effectiveStatus || b.status);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

function paymentLabel(payment: PaymentRecord): string {
  const status = payment.effectiveStatus || payment.status;
  return `${payment.number} — ${formatCurrencyBRL(payment.amountCents)} — vence ${formatDateBR(
    payment.dueDate
  )} (${status}, ref. ${formatReferenceMonthShort(payment.referenceMonth)})`;
}

/**
 * Central de mensagens embutida na ficha do cliente (RF-50 a RF-53).
 * Diferente do modal disparado pela lista, aqui a cobrança de referência é
 * escolhida na própria tela e o disparo pode virar anotação na timeline.
 */
export const ClientWhatsAppTab: React.FC<ClientWhatsAppTabProps> = ({
  client,
  onLogged,
}) => {
  const [settings, setSettings] = useState<AgencySettingsSummary | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [shouldLog, setShouldLog] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const [settingsResult, paymentsResult] = await Promise.allSettled([
        apiFetch<AgencySettingsSummary>('/api/settings/summary'),
        apiFetch<PaginatedPaymentsResponse>(
          `/api/payments?clientId=${client.id}&limit=50`
        ),
      ]);
      if (cancelled) return;

      setSettings(
        settingsResult.status === 'fulfilled' ? settingsResult.value : null
      );

      const list =
        paymentsResult.status === 'fulfilled'
          ? sortPayments(paymentsResult.value.data)
          : [];
      setPayments(list);
      setSelectedPaymentId(list[0]?.id || '');
      setIsLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [client.id]);

  const selectedPayment = payments.find((p) => p.id === selectedPaymentId) || null;

  const composerData = useMemo(
    () => ({
      nome: client.tradeName || client.name,
      phone: client.phone,
      agencia: settings?.agencyName,
      chavePix: settings?.pixKey,
      tipoChavePix: settings?.pixKeyType,
      valorCents: selectedPayment?.amountCents ?? null,
      vencimento: selectedPayment?.dueDate ?? null,
      mesReferencia: selectedPayment?.referenceMonth ?? null,
      numeroCobranca: selectedPayment?.number ?? null,
    }),
    [client.tradeName, client.name, client.phone, settings, selectedPayment]
  );

  const handleSend = async ({ template }: { template: WhatsAppTemplateKey }) => {
    if (!shouldLog) return;

    const parts = [
      `WhatsApp aberto com o modelo “${TEMPLATES[template].name}”`,
      client.phone ? `para ${formatPhoneBR(client.phone)}` : null,
      selectedPayment ? `(cobrança ${selectedPayment.number})` : null,
    ].filter(Boolean);

    try {
      const log = await apiFetch<InteractionLog>(`/api/clients/${client.id}/logs`, {
        method: 'POST',
        body: JSON.stringify({
          content: `${parts.join(' ')}.`,
          type: 'whatsapp',
        }),
      });
      onLogged(log);
    } catch {
      // O disparo já aconteceu; falhar o registro não deve interromper o fluxo.
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200">
        <LoadingState message="Carregando dados da mensagem..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho da aba */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-4.5 h-4.5 fill-current" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
              Central de mensagens WhatsApp
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Destinatário:{' '}
              <strong className="text-slate-700">
                {client.tradeName || client.name}
              </strong>
              {client.phone && (
                <span className="ml-1 font-mono">({formatPhoneBR(client.phone)})</span>
              )}
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={shouldLog}
            onChange={(e) => setShouldLog(e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-600/30"
          />
          <span>Registrar o disparo no histórico</span>
        </label>
      </div>

      {/* Composição da mensagem */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-xs">
        <WhatsAppComposer
          data={composerData}
          initialTemplate={
            payments.length > 0 ? 'lembrete_vencimento' : 'onboarding'
          }
          onSend={handleSend}
          headerSlot={
            <div>
              <label
                htmlFor="wa-client-payment"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Cobrança de referência
              </label>
              {payments.length === 0 ? (
                <p className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
                  <Receipt className="w-3.5 h-3.5 mt-px flex-shrink-0" aria-hidden="true" />
                  <span>
                    Este cliente ainda não tem cobranças. Os modelos com valor e
                    vencimento ficam sem dados — use Boas-vindas ou Mensagem
                    Personalizada.
                  </span>
                </p>
              ) : (
                <select
                  id="wa-client-payment"
                  value={selectedPaymentId}
                  onChange={(e) => setSelectedPaymentId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 transition-all cursor-pointer font-medium"
                >
                  {payments.map((p) => (
                    <option key={p.id} value={p.id}>
                      {paymentLabel(p)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          }
        />

        {!settings?.pixKey && (
          <p className="mt-4 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <ShieldAlert className="w-4 h-4 mt-px flex-shrink-0" aria-hidden="true" />
            <span>
              Nenhuma chave PIX cadastrada nas configurações da agência — o lembrete de
              vencimento sairá sem a chave. Um administrador pode cadastrá-la em
              Configurações.
            </span>
          </p>
        )}
      </div>
    </div>
  );
};
