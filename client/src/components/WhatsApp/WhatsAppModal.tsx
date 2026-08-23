import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, MessageSquare } from 'lucide-react';
import { formatPhoneBR } from '../../utils/formatters';
import { WhatsAppComposer } from './WhatsAppComposer';
import type { WhatsAppModalData, WhatsAppTemplateKey } from './templates';

export type { WhatsAppModalData, WhatsAppTemplateKey };

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTemplate?: WhatsAppTemplateKey;
  data: WhatsAppModalData;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  initialTemplate = 'lembrete_vencimento',
  data,
}) => {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 animate-overlay-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-slate-200 w-[calc(100vw-1.5rem)] max-w-3xl z-50 overflow-hidden animate-panel-in flex flex-col max-h-[calc(100dvh-2rem)]">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 fill-current" aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-base font-bold text-slate-900">
                  Central de Mensagens WhatsApp
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-500">
                  Destinatário:{' '}
                  <span className="font-semibold text-slate-700">
                    {data.nome || 'Cliente'}
                  </span>
                  {data.phone && (
                    <span className="ml-1 text-slate-600">
                      ({formatPhoneBR(data.phone)})
                    </span>
                  )}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Fechar"
                className="text-slate-500 hover:text-navy-900 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Corpo + rodapé (compartilhados com a aba WhatsApp da ficha) */}
          <div className="p-4 sm:p-6 overflow-y-auto bg-slate-50/30">
            <WhatsAppComposer
              data={data}
              initialTemplate={initialTemplate}
              onSend={onClose}
              footerSlot={
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              }
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
