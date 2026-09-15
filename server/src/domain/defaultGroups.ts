import { Permission, PERMISSIONS } from './permissions.js';

export const ADMIN_PERMISSIONS: Permission[] = [...PERMISSIONS];

export const OPERACIONAL_PERMISSIONS: Permission[] = [
  'screen.clientes', 'screen.pipeline', 'screen.pipeline_operacional',
  'clients.view', 'clients.create', 'clients.update', 'clients.stage.update', 'clients.owner.update',
  'logs.view', 'logs.create',
  'operational_tasks.view', 'operational_tasks.create', 'operational_tasks.update', 'operational_tasks.delete',
  'users.view_basic',
];

export const FINANCEIRO_PERMISSIONS: Permission[] = [
  'screen.dashboard', 'screen.clientes', 'screen.contratos', 'screen.financeiro',
  'clients.view',
  'logs.view',
  'operational_tasks.view',
  'contracts.view', 'contracts.create', 'contracts.update',
  'contract_files.view', 'contract_files.create',
  'payments.view', 'payments.create', 'payments.update', 'payments.settle', 'payments.export',
  'invoices.view', 'invoices.create',
  'dashboard.financial.view', 'dashboard.operational.view',
  'settings.bank.view',
];
