import {
  LayoutDashboard,
  Users,
  Kanban,
  FileText,
  DollarSign,
  ShieldCheck,
  Settings,
  KeyRound,
  ClipboardList
} from 'lucide-react';

export const NAVIGATION_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'screen.dashboard' },
  { to: '/clientes', label: 'Clientes', icon: Users, permission: 'screen.clientes' },
  { to: '/pipeline', label: 'Pipeline comercial', icon: Kanban, permission: 'screen.pipeline' },
  { to: '/pipeline-operacional', label: 'Pipeline operacional', icon: ClipboardList, permission: 'screen.pipeline_operacional' },
  { to: '/contratos', label: 'Contratos', icon: FileText, permission: 'screen.contratos' },
  { to: '/financeiro', label: 'Financeiro', icon: DollarSign, permission: 'screen.financeiro' },
  { to: '/usuarios', label: 'Usuários', icon: ShieldCheck, permission: 'screen.usuarios' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, permission: 'screen.configuracoes' },
  { to: '/grupos', label: 'Grupos e permissões', icon: KeyRound, permission: 'screen.grupos' },
];
