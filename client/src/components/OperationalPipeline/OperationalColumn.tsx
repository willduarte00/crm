import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { OperationalStage, OperationalTask, STAGE_COLORS } from '../../types/operational';
import { OperationalCard } from './OperationalCard';
import { Inbox } from 'lucide-react';

interface OperationalColumnProps {
  stage: OperationalStage;
  tasks: OperationalTask[];
  onTaskClick: (task: OperationalTask) => void;
}

export const OperationalColumn: React.FC<OperationalColumnProps> = ({
  stage,
  tasks,
  onTaskClick,
}) => {
  const config = STAGE_COLORS[stage.color] || STAGE_COLORS.slate;

  return (
    <section
      aria-label={`Etapa ${stage.name}, ${tasks.length} ${
        tasks.length === 1 ? 'demanda' : 'demandas'
      }`}
      className="w-[280px] sm:w-[320px] flex flex-col bg-slate-100/90 rounded-xl border border-slate-200/80 h-full max-h-full shrink-0 shadow-xs"
    >
      {/* Topo da Coluna */}
      <div
        className={`flex items-center justify-between px-3.5 py-3 border-b border-slate-200/60 bg-white/70 rounded-t-xl shrink-0 ${config.border}`}
        title={stage.description || undefined}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${config.dot} shadow-xs`} aria-hidden="true" />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${config.text} truncate max-w-[200px]`}>
            {stage.name}
          </h3>
        </div>
        <span
          aria-hidden="true"
          className="text-xs font-semibold tabular-nums px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded-full"
        >
          {tasks.length}
        </span>
      </div>

      {/* Área Droppable */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto p-2.5 space-y-2.5 transition-colors min-h-[150px] ${
              snapshot.isDraggingOver ? `${config.bg} rounded-b-xl ring-1 ring-teal-500/30` : ''
            }`}
          >
            {tasks.map((task, index) => (
              <OperationalCard
                key={task.id}
                task={task}
                index={index}
                onClick={onTaskClick}
              />
            ))}

            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="h-40 flex flex-col items-center justify-center text-slate-500 p-4 text-center border-2 border-dashed border-slate-200 rounded-lg">
                <Inbox className="w-6 h-6 text-slate-300 mb-1" />
                <p className="text-xs font-medium text-slate-500">Nenhuma demanda</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Arraste um card para esta etapa</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </section>
  );
};