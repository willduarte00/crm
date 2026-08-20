import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Client, LeadSource, Priority } from '../../types/client';
import { formatDateBR, formatPhoneBR } from '../../utils/formatters';
import { UserX, Phone, MessageSquare, FileText } from 'lucide-react';

interface KanbanCardProps {
  client: Client;
  index: number;
  onClick: (client: Client) => void;
}

const PRIORITY_BARS: Record<Priority, string> = {
  alta: 'bg-rose-500', // Vermelho para alta
  media: 'bg-amber-400', // Âmbar para média
  baixa: 'bg-teal-600', // Teal para baixa conforme design system
};

const PRIORITY_LABELS: Record<Priority, { label: string; color: string }> = {
  alta: { label: 'Alta', color: 'text-rose-600' },
  media: { label: 'Média', color: 'text-amber-600' },
  baixa: { label: 'Baixa', color: 'text-teal-600' },
};

const LEAD_SOURCE_STYLES: Record<LeadSource, { bg: string; text: string; border: string }> = {
  Instagram: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  'Google Ads': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Indicação: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Prospecção Ativa': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  LinkedIn: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  Outro: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
};

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const KanbanCard: React.FC<KanbanCardProps> = ({ client, index, onClick }) => {
  const priorityBarColor = PRIORITY_BARS[client.priority] || PRIORITY_BARS.media;
  const sourceStyle =
    LEAD_SOURCE_STYLES[client.leadSource] || LEAD_SOURCE_STYLES.Outro;
  const priorityInfo = PRIORITY_LABELS[client.priority] || PRIORITY_LABELS.media;

  return (
    <Draggable draggableId={client.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(client)}
          className={`group bg-white rounded-lg border p-3.5 relative overflow-hidden transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${
            snapshot.isDragging
              ? 'shadow-xl ring-2 ring-teal-500/40 border-teal-500 rotate-[1deg] scale-[1.02] z-50 bg-white'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
          }`}
          style={provided.draggableProps.style}
        >
          {/* Barra de Prioridade Lateral Esquerda (RF-06b) */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-1 ${priorityBarColor} transition-colors`}
            title={`Prioridade ${priorityInfo.label}`}
          />

          {/* Topo do Card: Origem do Lead e Data */}
          <div className="flex items-center justify-between gap-2 mb-2 pl-1.5">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${sourceStyle.bg} ${sourceStyle.text} ${sourceStyle.border}`}
            >
              {client.leadSource}
            </span>
            <span className="text-[11px] tabular-nums text-slate-400 font-medium">
              {formatDateBR(client.createdAt)}
            </span>
          </div>

          {/* Identificação do Cliente */}
          <div className="pl-1.5 mb-2.5">
            <h4 className="text-sm font-bold text-navy-900 leading-snug group-hover:text-teal-700 transition-colors line-clamp-1">
              {client.name}
            </h4>
            {client.tradeName && (
              <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
                {client.tradeName}
              </p>
            )}
          </div>

          {/* Detalhes rápidos / Notas */}
          {client.notes && (
            <div className="pl-1.5 mb-3">
              <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100 leading-relaxed">
                {client.notes}
              </p>
            </div>
          )}

          {/* Rodapé: Responsável (RF-06a/RF-06c) e Contadores */}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 pl-1.5 mt-auto">
            {/* Avatar do Responsável */}
            <div className="flex items-center gap-1.5 min-w-0">
              {client.owner ? (
                <div
                  className="flex items-center gap-1.5 min-w-0"
                  title={`Responsável: ${client.owner.name}${
                    !client.owner.active ? ' (Inativo)' : ''
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold tracking-tighter flex-shrink-0 ${
                      client.owner.active
                        ? 'bg-navy-800 text-white'
                        : 'bg-slate-200 text-slate-500 border border-slate-300'
                    }`}
                  >
                    {getInitials(client.owner.name)}
                  </div>
                  <span
                    className={`text-xs truncate font-medium ${
                      client.owner.active ? 'text-slate-700' : 'text-slate-400 italic'
                    }`}
                  >
                    {client.owner.name.split(' ')[0]}
                    {!client.owner.active && ' (Inativo)'}
                  </span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 text-slate-400"
                  title="Lead sem responsável atribuído"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                    <UserX className="w-3 h-3" />
                  </div>
                  <span className="text-[11px] text-slate-400 italic">Sem responsável</span>
                </div>
              )}
            </div>

            {/* Badges de Contratos e Anotações */}
            <div className="flex items-center gap-2 text-slate-400 flex-shrink-0 text-xs">
              {client.phone && (
                <span title={formatPhoneBR(client.phone)}>
                  <Phone className="w-3.5 h-3.5 text-slate-400 hover:text-teal-600 transition-colors" />
                </span>
              )}

              {!!client._count?.contracts && (
                <span
                  className="flex items-center gap-0.5 text-[11px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100"
                  title={`${client._count.contracts} contrato(s)`}
                >
                  <FileText className="w-3 h-3" />
                  <span>{client._count.contracts}</span>
                </span>
              )}

              {!!client._count?.interactionLogs && (
                <span
                  className="flex items-center gap-0.5 text-[11px] font-medium text-slate-500"
                  title={`${client._count.interactionLogs} anotação(ões)`}
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>{client._count.interactionLogs}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
