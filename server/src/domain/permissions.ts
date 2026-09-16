export const PERMISSIONS = [
  // Telas
  'screen.dashboard',
  'screen.clientes',
  'screen.pipeline',
  'screen.pipeline_operacional',
  'screen.contratos',
  'screen.financeiro',
  'screen.usuarios',
  'screen.configuracoes',
  'screen.grupos',

  // Clientes
  'clients.view',
  'clients.create',
  'clients.update',
  'clients.delete',
  'clients.stage.update',
  'clients.owner.update',
  'clients.batch_reassign',
  'clients.export',

  // Interações
  'logs.view',
  'logs.create',

  // Pipeline operacional
  'operational_tasks.view',
  'operational_tasks.create',
  'operational_tasks.update',
  'operational_tasks.delete',

  // Contratos
  'contracts.view',
  'contracts.create',
  'contracts.update',
  'contracts.delete',
  'contract_files.view',
  'contract_files.create',
  'contract_files.delete',

  // Cobranças
  'payments.view',
  'payments.create',
  'payments.update',
  'payments.settle',
  'payments.cancel',
  'payments.export',
  'invoices.view',
  'invoices.create',
  'invoices.delete',

  // Dashboard
  'dashboard.financial.view',
  'dashboard.operational.view',

  // Configurações
  'settings.view',
  'settings.update',
  'settings.bank.view',

  // Usuários e grupos
  'users.view_basic',
  'users.view',
  'users.manage',
  'groups.view',
  'groups.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type PermissionCategory =
  | 'Telas'
  | 'Clientes'
  | 'Interações'
  | 'Pipeline operacional'
  | 'Contratos'
  | 'Cobranças'
  | 'Dashboard'
  | 'Configurações'
  | 'Usuários e grupos';

export interface PermissionMeta {
  key: Permission;
  label: string;
  category: PermissionCategory;
  requiresAnyOf?: Permission[];
}

export const SCREEN_DEPENDENCIES: Record<string, Permission[]> = {
  'screen.dashboard': ['dashboard.financial.view', 'dashboard.operational.view'],
  'screen.clientes': ['clients.view'],
  'screen.pipeline': ['clients.view'],
  'screen.pipeline_operacional': ['operational_tasks.view'],
  'screen.contratos': ['contracts.view'],
  'screen.financeiro': ['payments.view'],
  'screen.usuarios': ['users.view'],
  'screen.configuracoes': ['settings.view'],
  'screen.grupos': ['groups.view'],
};

export const SCREEN_ORDER: Permission[] = [
  'screen.dashboard',
  'screen.clientes',
  'screen.pipeline',
  'screen.pipeline_operacional',
  'screen.contratos',
  'screen.financeiro',
  'screen.usuarios',
  'screen.configuracoes',
  'screen.grupos',
];

export const SCREEN_ROUTES: Record<string, string> = {
  'screen.dashboard': '/',
  'screen.clientes': '/clientes',
  'screen.pipeline': '/pipeline',
  'screen.pipeline_operacional': '/pipeline-operacional',
  'screen.contratos': '/contratos',
  'screen.financeiro': '/financeiro',
  'screen.usuarios': '/usuarios',
  'screen.configuracoes': '/configuracoes',
  'screen.grupos': '/grupos',
};

export const PERMISSION_CATALOG: PermissionMeta[] = [
  // Telas
  { key: 'screen.dashboard', label: 'Dashboard', category: 'Telas', requiresAnyOf: SCREEN_DEPENDENCIES['screen.dashboard'] },
  { key: 'screen.clientes', label: 'Clientes', category: 'Telas', requiresAnyOf: SCREEN_DEPENDENCIES['screen.clientes'] },
  { key: 'screen.pipeline', label: 'Funil de Vendas', category: 'Telas', requiresAnyOf: SCREEN_DEPENDENCIES['screen.pipeline'] },
  { key: 'screen.pipeline_operacional', label: 'Operação', category: 'Telas', requiresAnyOf: SCREEN_DEPENDENCIES['screen.pipeline_operacional'] },
  { key: 'screen.contratos', label: 'Contratos', category: 'Telas', requiresAnyOf: SCREEN_DEPENDENCIES['screen.contratos'] },
  { key: 'screen.financeiro', label: 'Financeiro', category: 'Telas', requiresAnyOf: SCREEN_DEPENDENCIES['screen.financeiro'] },
  { key: 'screen.usuarios', label: 'Usuários', category: 'Telas', requiresAnyOf: SCREEN_DEPENDENCIES['screen.usuarios'] },
  { key: 'screen.configuracoes', label: 'Configurações', category: 'Telas', requiresAnyOf: SCREEN_DEPENDENCIES['screen.configuracoes'] },
  { key: 'screen.grupos', label: 'Grupos e permissões', category: 'Telas', requiresAnyOf: SCREEN_DEPENDENCIES['screen.grupos'] },

  // Clientes
  { key: 'clients.view', label: 'Listar e ver detalhe de cliente', category: 'Clientes' },
  { key: 'clients.create', label: 'Cadastrar cliente/lead', category: 'Clientes' },
  { key: 'clients.update', label: 'Editar cadastro', category: 'Clientes' },
  { key: 'clients.delete', label: 'Excluir cliente', category: 'Clientes' },
  { key: 'clients.stage.update', label: 'Mover etapa no pipeline', category: 'Clientes' },
  { key: 'clients.owner.update', label: 'Trocar responsável individual', category: 'Clientes' },
  { key: 'clients.batch_reassign', label: 'Reatribuir carteira em lote', category: 'Clientes' },
  { key: 'clients.export', label: 'Exportar clientes em CSV', category: 'Clientes' },

  // Interações
  { key: 'logs.view', label: 'Ver histórico de interações', category: 'Interações' },
  { key: 'logs.create', label: 'Registrar interação', category: 'Interações' },

  // Pipeline operacional
  { key: 'operational_tasks.view', label: 'Ver pipeline operacional', category: 'Pipeline operacional' },
  { key: 'operational_tasks.create', label: 'Criar demanda', category: 'Pipeline operacional' },
  { key: 'operational_tasks.update', label: 'Editar e mover demanda', category: 'Pipeline operacional' },
  { key: 'operational_tasks.delete', label: 'Excluir demanda', category: 'Pipeline operacional' },

  // Contratos
  { key: 'contracts.view', label: 'Listar e ver contrato', category: 'Contratos' },
  { key: 'contracts.create', label: 'Criar contrato', category: 'Contratos' },
  { key: 'contracts.update', label: 'Editar contrato', category: 'Contratos' },
  { key: 'contracts.delete', label: 'Excluir contrato', category: 'Contratos' },
  { key: 'contract_files.view', label: 'Ver/baixar anexo de contrato', category: 'Contratos' },
  { key: 'contract_files.create', label: 'Anexar arquivo a contrato', category: 'Contratos' },
  { key: 'contract_files.delete', label: 'Excluir anexo de contrato', category: 'Contratos' },

  // Cobranças
  { key: 'payments.view', label: 'Listar e ver cobrança', category: 'Cobranças' },
  { key: 'payments.create', label: 'Emitir cobrança', category: 'Cobranças' },
  { key: 'payments.update', label: 'Editar valor/vencimento/mês', category: 'Cobranças' },
  { key: 'payments.settle', label: 'Dar baixa (marcar Pago)', category: 'Cobranças' },
  { key: 'payments.cancel', label: 'Cancelar cobrança', category: 'Cobranças' },
  { key: 'payments.export', label: 'Exportar cobranças em CSV', category: 'Cobranças' },
  { key: 'invoices.view', label: 'Ver/baixar nota fiscal', category: 'Cobranças' },
  { key: 'invoices.create', label: 'Anexar nota fiscal', category: 'Cobranças' },
  { key: 'invoices.delete', label: 'Excluir nota fiscal', category: 'Cobranças' },

  // Dashboard
  { key: 'dashboard.financial.view', label: 'KPIs financeiros e alertas', category: 'Dashboard' },
  { key: 'dashboard.operational.view', label: 'Clientes ativos e distribuição de serviços', category: 'Dashboard' },

  // Configurações
  { key: 'settings.view', label: 'Ver configurações da agência', category: 'Configurações' },
  { key: 'settings.update', label: 'Editar configurações da agência', category: 'Configurações' },
  { key: 'settings.bank.view', label: 'Ver dados bancários e chave PIX', category: 'Configurações' },

  // Usuários e grupos
  { key: 'users.view_basic', label: 'Ver lista reduzida de usuários', category: 'Usuários e grupos' },
  { key: 'users.view', label: 'Ver lista completa de usuários', category: 'Usuários e grupos' },
  { key: 'users.manage', label: 'Gerenciar usuários', category: 'Usuários e grupos' },
  { key: 'groups.view', label: 'Ver grupos e permissões', category: 'Usuários e grupos' },
  { key: 'groups.manage', label: 'Gerenciar grupos', category: 'Usuários e grupos' },
];

export function isValidPermission(value: string): value is Permission {
  return PERMISSIONS.includes(value as Permission);
}

export function mergePermissions(groups: { permissions: string[] }[]): Set<string> {
  const merged = new Set<string>();
  for (const group of groups) {
    for (const permission of group.permissions) {
      merged.add(permission);
    }
  }
  return merged;
}

export interface ScreenDependencyViolation {
  screen: Permission;
  missingAnyOf: Permission[];
}

export function findScreenDependencyViolations(permissions: string[]): ScreenDependencyViolation[] {
  const violations: ScreenDependencyViolation[] = [];
  const permSet = new Set(permissions);

  for (const screen of Object.keys(SCREEN_DEPENDENCIES)) {
    if (permSet.has(screen)) {
      const deps = SCREEN_DEPENDENCIES[screen];
      const hasAny = deps.some((dep) => permSet.has(dep));
      if (!hasAny) {
        violations.push({
          screen: screen as Permission,
          missingAnyOf: deps,
        });
      }
    }
  }

  return violations;
}

export function firstAllowedScreen(permissions: Set<string>): Permission | null {
  for (const screen of SCREEN_ORDER) {
    if (permissions.has(screen)) {
      return screen;
    }
  }
  return null;
}
