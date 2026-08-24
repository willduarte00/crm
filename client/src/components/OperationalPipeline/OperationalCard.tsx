import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { OperationalTask, STAGE_COLORS } from '../../types/operational';
import { Priority } from '../../types/client';
import { Calendar, User2, AlignLeft } from 'lucide-react';
import { formatDateBR } from '../../utils/formatters';

interface OperationalCardProps {
  task: OperationalTask;
  index: number;
  onClick: (task: OperationalTask) => void;
}

const PRIORITY_BARS: Record<Priority, string> = {
  alta: 'bg-rose-500',
  media: 'bg-amber-400',
  baixa: 'bg-teal-600',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  alta: 'Prioridade Alta',
  media: 'Prioridade Média',
  baixa: 'Prioridade Baixa',
};

export const OperationalCard: React.FC<OperationalCardProps> = ({
  task,
  index,
  onClick,
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const isOverdue =
    task.dueDate && new Date(task.dueDate + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0));

  const config = task.stage ? STAGE_COLORS[task.stage.color] : STAGE_COLORS.slate;
  const hoverBorder = config.hoverBorder;

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onClick(task);
            }
          }}
          role="button"
          aria-label={`Abrir demanda ${task.title}`}
          className={`group ${config.bg} rounded-lg border p-3.5 relative overflow-hidden transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${
            snapshot.isDragging
              ? `shadow-xl ring-2 ring-teal-500/40 border-teal-500 rotate-[1deg] scale-[1.02] z-50 ${config.bg}`
              : `border-slate-200 ${hoverBorder} hover:shadow-sm`
          }`}
          style={provided.draggableProps.style}
        >
          {/* Priority Left Bar */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-1 ${PRIORITY_BARS[task.priority]}`}
            title={PRIORITY_LABELS[task.priority]}
          />

          <div className="pl-2">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="text-[13px] font-bold text-navy-900 leading-tight line-clamp-2">
                {task.title}
              </h4>
            </div>
            
            {task.client && (
              <p className="text-xs text-slate-500 mb-2 truncate" title={task.client.name}>
                {task.client.name}
              </p>
            )}

            {task.description && (
              <div className="mt-2 flex items-start gap-1.5 text-slate-500">
                <AlignLeft className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <p className="text-xs line-clamp-2">{task.description}</p>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-slate-100/60 pt-3">
              {/* Due Date */}
              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  isOverdue ? 'text-rose-600' : 'text-slate-500'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{task.dueDate ? formatDateBR(task.dueDate) : 'Sem prazo'}</span>
              </div>

              {/* Owner Avatar */}
              {task.owner ? (
                <div
                  className="w-6 h-6 rounded-full bg-teal-100 border border-teal-200 flex items-center justify-center flex-shrink-0"
                  title={`Responsável: ${task.owner.name}`}
                >
                  <span className="text-[10px] font-bold text-teal-700">
                    {getInitials(task.owner.name)}
                  </span>
                </div>
              ) : (
                <div
                  className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0"
                  title="Sem responsável"
                >
                  <User2 className="w-3.5 h-3.5 text-slate-400" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};