import { Client, Priority } from './client';
import { User } from './index';

export const STAGE_COLOR_TOKENS = ['blue', 'amber', 'purple', 'emerald', 'teal', 'rose', 'sky', 'slate'] as const;
export type StageColor = (typeof STAGE_COLOR_TOKENS)[number];

export const STAGE_COLORS: Record<StageColor, { dot: string; bg: string; text: string; border: string; hoverBorder: string; label: string }> = {
  blue:    { dot: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-900',    border: 'border-t-blue-500',    hoverBorder: 'hover:border-blue-500',    label: 'Azul' },
  amber:   { dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-900',   border: 'border-t-amber-500',   hoverBorder: 'hover:border-amber-500',   label: 'Âmbar' },
  purple:  { dot: 'bg-purple-500',  bg: 'bg-purple-50',  text: 'text-purple-900',  border: 'border-t-purple-500',  hoverBorder: 'hover:border-purple-500',  label: 'Roxo' },
  emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-t-emerald-500', hoverBorder: 'hover:border-emerald-500', label: 'Verde' },
  teal:    { dot: 'bg-teal-600',    bg: 'bg-teal-50',    text: 'text-teal-900',    border: 'border-t-teal-600',    hoverBorder: 'hover:border-teal-600',    label: 'Turquesa' },
  rose:    { dot: 'bg-rose-500',    bg: 'bg-rose-50',    text: 'text-rose-900',    border: 'border-t-rose-500',    hoverBorder: 'hover:border-rose-500',    label: 'Rosa' },
  sky:     { dot: 'bg-sky-500',     bg: 'bg-sky-50',     text: 'text-sky-900',     border: 'border-t-sky-500',     hoverBorder: 'hover:border-sky-500',     label: 'Céu' },
  slate:   { dot: 'bg-slate-400',   bg: 'bg-slate-50',   text: 'text-slate-900',   border: 'border-t-slate-400',   hoverBorder: 'hover:border-slate-400',   label: 'Cinza' },
};

export interface OperationalStage {
  id: string;
  name: string;
  description: string | null;
  color: StageColor;
  position: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    tasks: number;
  };
}

export interface OperationalTask {
  id: string;
  clientId: string;
  stageId: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  stage?: OperationalStage;
  client?: Pick<Client, 'id' | 'name' | 'tradeName'>;
  owner?: Pick<User, 'id' | 'name' | 'active'>;
}

export interface CreateOperationalStageInput {
  name: string;
  description?: string;
  color: StageColor;
}

export interface UpdateOperationalStageInput {
  name?: string;
  description?: string;
  color?: StageColor;
  active?: boolean;
}

export interface CreateOperationalTaskInput {
  clientId: string;
  stageId: string;
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string | null;
  ownerId?: string | null;
}

export interface UpdateOperationalTaskInput {
  clientId?: string;
  stageId?: string;
  title?: string;
  description?: string | null;
  priority?: Priority;
  dueDate?: string | null;
  ownerId?: string | null;
}
