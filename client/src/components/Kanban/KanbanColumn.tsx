import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Client, PipelineStage } from '../../types/client';
import { KanbanCard } from './KanbanCard';
import { Inbox } from 'lucide-react';

interface KanbanColumnProps {
  stage: PipelineStage;
  clients: Client[];
  onCardClick: (client: Client) => void;
}

const STAGE_CONFIG: Record<
  PipelineStage,
  { dotColor: string; headerBg: string; borderAccent: string }
> = {
  'Novo Lead': {
    dotColor: 'bg-blue-500',
    headerBg: 'text-blue-900',
    borderAccent: 'border-t-blue-500',
  },
  'Contato/Qualificação': {
    dotColor: 'bg-amber-500',
    headerBg: 'text-amber-900',
    borderAccent: 'border-t-amber-500',
  },
  'Proposta Enviada': {
    dotColor: 'bg-purple-500',
    headerBg: 'text-purple-900',
    borderAccent: 'border-t-purple-500',
  },
  'Em Negociação': {
    dotColor: 'bg-emerald-500',
    headerBg: 'text-emerald-900',
    borderAccent: 'border-t-emerald-500',
  },
  'Contrato Ativo': {
    dotColor: 'bg-teal-600',
    headerBg: 'text-teal-900',
    borderAccent: 'border-t-teal-600',
  },
  'Pausado/Churn': {
    dotColor: 'bg-rose-500',
    headerBg: 'text-rose-900',
    borderAccent: 'border-t-rose-500',
  },
};

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  stage,
  clients,
  onCardClick,
}) => {
  const config = STAGE_CONFIG[stage] || {
    dotColor: 'bg-slate-400',
    headerBg: 'text-slate-900',
    borderAccent: 'border-t-slate-400',
  };

  return (
    <section
      aria-label={`Etapa ${stage}, ${clients.length} ${
        clients.length === 1 ? 'lead' : 'leads'
      }`}
      className="w-[280px] sm:w-[320px] flex flex-col bg-slate-100/90 rounded-xl border border-slate-200/80 h-full max-h-full shrink-0 shadow-xs"
    >
      {/* Topo da Coluna */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-200/60 bg-white/70 rounded-t-xl shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor} shadow-xs`} />
          <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">
            {stage}
          </h3>
        </div>
        <span
          aria-hidden="true"
          className="text-xs font-semibold tabular-nums px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded-full"
        >
          {clients.length}
        </span>
      </div>

      {/* Área Droppable */}
      <Droppable droppableId={stage}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto p-2.5 space-y-2.5 transition-colors min-h-[150px] ${
              snapshot.isDraggingOver ? 'bg-teal-50/50 rounded-b-xl ring-1 ring-teal-500/30' : ''
            }`}
          >
            {clients.map((client, index) => (
              <KanbanCard
                key={client.id}
                client={client}
                index={index}
                onClick={onCardClick}
              />
            ))}

            {provided.placeholder}

            {clients.length === 0 && !snapshot.isDraggingOver && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-500 p-4 text-center border-2 border-dashed border-slate-200 rounded-lg">
                <Inbox className="w-6 h-6 text-slate-300 mb-1" />
                <p className="text-xs font-medium text-slate-500">Nenhum lead</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Arraste um card para esta etapa</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </section>
  );
};
