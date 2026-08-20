import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ChangePasswordModal } from '../Users/ChangePasswordModal';
import {
  LayoutDashboard,
  Users,
  Kanban,
  FileText,
  DollarSign,
  ShieldCheck,
  Settings,
  LogOut,
  KeyRound,
} from 'lucide-react';

export const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const location = useLocation();

  const isAdmin = user?.role === 'admin';

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/clientes', label: 'Clientes', icon: Users },
    { to: '/pipeline', label: 'Pipeline', icon: Kanban },
    { to: '/contratos', label: 'Contratos', icon: FileText },
    { to: '/financeiro', label: 'Financeiro', icon: DollarSign },
  ];

  const adminNavItems = [
    { to: '/usuarios', label: 'Usuários', icon: ShieldCheck },
    { to: '/configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Fixa 260px */}
      <aside className="w-sidebar w-[260px] flex-shrink-0 bg-navy-900 text-white flex flex-col justify-between border-r border-navy-800">
        <div>
          {/* Logo / Header da Agência */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-navy-800/80">
            <div className="w-8 h-8 rounded bg-teal-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
              CR
            </div>
            <div>
              <div className="font-bold text-sm leading-tight text-white tracking-wide">
                CRM AGÊNCIA
              </div>
              <div className="text-[11px] text-slate-400">Kinetic Enterprise</div>
            </div>
          </div>

          {/* Navegação Principal */}
          <div className="px-3 py-4 space-y-1">
            <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Principal
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}

            {/* Módulo Administrativo (Aparece apenas para Admin) */}
            {isAdmin && (
              <div className="pt-4 space-y-1">
                <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Administração
                </div>
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname.startsWith(item.to);

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-teal-600 text-white'
                          : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Perfil do Usuário e Logout */}
        <div className="p-3 border-t border-navy-800/80 bg-navy-950/40">
          <div className="p-2 rounded bg-navy-800/60 border border-navy-700/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-full bg-teal-600/30 text-teal-300 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-teal-500/30">
                  {user?.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-semibold text-white truncate">
                    {user?.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {user?.email}
                  </div>
                </div>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700 text-slate-300 font-medium">
                {user?.role === 'admin' ? 'Admin' : 'Membro'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 pt-1 border-t border-navy-700/50">
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                className="flex items-center justify-center gap-1.5 py-1 px-2 text-[11px] text-slate-300 hover:text-white hover:bg-navy-700 rounded transition-colors"
                title="Trocar minha senha"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Senha</span>
              </button>
              <button
                onClick={logout}
                className="flex items-center justify-center gap-1.5 py-1 px-2 text-[11px] text-red-300 hover:text-red-200 hover:bg-red-950/40 rounded transition-colors"
                title="Encerrar sessão"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Área Principal de Conteúdo */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header Superior Limpo (Sem busca global, tarefas ou notificações) */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">
            Ambiente Operacional
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              Sessão Ativa
            </span>
          </div>
        </header>

        {/* Conteúdo da Página */}
        <div className="p-8 max-w-app mx-auto w-full">
          <Outlet />
        </div>
      </main>

      {/* Modal de Troca Voluntária de Senha */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};
