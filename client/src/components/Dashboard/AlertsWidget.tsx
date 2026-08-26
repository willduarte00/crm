import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Clock,
  Calendar,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { PaymentAlertItem, AgencySettingsSummary } from '../../types/dashboard';
import { formatCurrencyBRL, formatDateBR } from '../../utils/formatters';
import { WhatsAppModal, WhatsAppModalData } from '../WhatsApp/WhatsAppModal';

interface AlertsWidgetProps {
  overdue: PaymentAlertItem[];
  upcoming7Days: PaymentAlertItem[];
  settings?: AgencySettingsSummary;
}

export const AlertsWidget: React.FC<AlertsWidgetProps> = ({
  overdue,
  upcoming7Days,
  settings,
}) => {
  const [selectedAlertForWhatsApp, setSelectedAlertForWhatsApp] =
    useState<WhatsAppModalData | null>(null);

  const handleOpenWhatsApp = (alert: PaymentAlertItem) => {
    setSelectedAlertForWhatsApp({
      nome: alert.clientName,
      phone: alert.clientPhone,
      valorCents: alert.amountCents,
      vencimento: alert.dueDate,
      mesReferencia: alert.referenceMonth,
      numeroCobranca: alert.number,
      agencia: settings?.agencyName || '',
      chavePix: settings?.pixKey || '',
      tipoChavePix: settings?.pixKeyType || '',
    });
  };

  const hasAlerts = overdue.length > 0 || upcoming7Days.length > 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-navy-900">
                Alertas de cobrança
              </h2>
              <p className="text-xs text-slate-500">
                Vencidas e a vencer nos próximos 7 dias
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {overdue.length + upcoming7Days.length}
          </span>
        </div>

        {!hasAlerts ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Tudo em dia!
            </p>
            <p className="text-xs text-slate-500 max-w-[200px] mt-1">
              Não há cobranças vencidas nem a vencer nos próximos 7 dias.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
            {/* Seção Vencidas */}
            {overdue.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Vencidas ({overdue.length})</span>
                </div>
                <div className="space-y-2">
                  {overdue.map((item) => {
                    const daysLate = Math.abs(item.daysDiff);
                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-rose-50/60 border border-rose-200/80 rounded-lg flex items-center justify-between gap-3 relative overflow-hidden group hover:border-rose-300 transition-colors"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500" />
                        <div className="min-w-0 flex-1 pl-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {item.clientName}
                            </span>
                            <span className="text-xs font-bold text-rose-700  tabular-nums">
                              {formatCurrencyBRL(item.amountCents)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                            <span className="font-mono">{item.number}</span>
                            <span className="text-rose-600 font-semibold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {daysLate === 1 ? '1 dia de atraso' : `${daysLate} dias de atraso`}
                            </span>
                          </div>
                        </div>

                        {/* Botão de WhatsApp */}
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsApp(item)}
                          aria-label={`Cobrar ${item.clientName} por WhatsApp sobre a cobrança ${item.number}`}
                          title="Enviar cobrança por WhatsApp"
                          className="w-8 h-8 rounded-lg bg-white border border-rose-200 text-[#128C4A] hover:bg-[#25D366] hover:text-white hover:border-[#25D366] flex items-center justify-center transition-colors flex-shrink-0 shadow-2xs"
                        >
                          <MessageSquare className="w-4 h-4 fill-current" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Seção A Vencer nos Próximos 7 Dias */}
            {upcoming7Days.length > 0 && (
              <div className={overdue.length > 0 ? 'pt-2' : ''}>
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>A Vencer em 7 Dias ({upcoming7Days.length})</span>
                </div>
                <div className="space-y-2">
                  {upcoming7Days.map((item) => {
                    const daysDue = item.daysDiff;
                    const dueLabel =
                      daysDue === 0
                        ? 'Vence hoje'
                        : daysDue === 1
                        ? 'Vence amanhã'
                        : `Vence em ${daysDue} dias`;

                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 relative overflow-hidden group hover:border-teal-400 transition-colors"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500" />
                        <div className="min-w-0 flex-1 pl-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {item.clientName}
                            </span>
                            <span className="text-xs font-bold text-slate-900  tabular-nums">
                              {formatCurrencyBRL(item.amountCents)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                            <span className="font-mono">{item.number}</span>
                            <span className="text-teal-700 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {dueLabel} ({formatDateBR(item.dueDate)})
                            </span>
                          </div>
                        </div>

                        {/* Botão de WhatsApp */}
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsApp(item)}
                          aria-label={`Lembrar ${item.clientName} por WhatsApp do vencimento da cobrança ${item.number}`}
                          title="Enviar lembrete por WhatsApp"
                          className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-[#128C4A] hover:bg-[#25D366] hover:text-white hover:border-[#25D366] flex items-center justify-center transition-colors flex-shrink-0 shadow-2xs"
                        >
                          <MessageSquare className="w-4 h-4 fill-current" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-4 mt-4 border-t border-slate-100">
        <Link
          to="/financeiro"
          className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:bg-teal-50/50 rounded-lg transition-colors"
        >
          <span>Acessar Financeiro Completo</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Modal de WhatsApp acionado pelo alerta */}
      {selectedAlertForWhatsApp && (
        <WhatsAppModal
          isOpen={true}
          onClose={() => setSelectedAlertForWhatsApp(null)}
          initialTemplate="lembrete_vencimento"
          data={selectedAlertForWhatsApp}
        />
      )}
    </div>
  );
};
