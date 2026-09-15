import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { ChangePasswordModal } from '../Users/ChangePasswordModal';
import { apiFetch } from '../../services/api';
import type { AgencySettingsSummary } from '../../types/dashboard';
import { NAVIGATION_ITEMS } from './navigation';
import { EmptyState } from '../ui/States';
import {
  LogOut,
  KeyRound,
  Menu,
  X,
  ShieldCheck
} from 'lucide-react';

/** Título exibido no cabeçalho mobile, derivado da rota atual. */
function pageTitleFor(pathname: string): string {
  const match = NAVIGATION_ITEMS
    .filter((item) =>
      item.to === '/'
        ? pathname === '/'
        : pathname === item.to || pathname.startsWith(item.to + '/')
    )
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? 'CRM';
}

/** Helper functions for dynamic theming */
function hexToRgb(hex: string): number[] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [13, 148, 136]; // Default teal-600
}

function mixColor(rgb: number[], mixWith: number[], amount: number): string {
  const r = Math.round(rgb[0] + (mixWith[0] - rgb[0]) * amount);
  const g = Math.round(rgb[1] + (mixWith[1] - rgb[1]) * amount);
  const b = Math.round(rgb[2] + (mixWith[2] - rgb[2]) * amount);
  return `${r} ${g} ${b}`;
}

function getShades(hex: string) {
  const base = hexToRgb(hex);
  const white = [255, 255, 255];
  const black = [0, 0, 0];
  return {
    50: mixColor(base, white, 0.9),
    100: mixColor(base, white, 0.8),
    200: mixColor(base, white, 0.6),
    300: mixColor(base, white, 0.4),
    400: mixColor(base, white, 0.2),
    500: mixColor(base, white, 0.1),
    600: `${base[0]} ${base[1]} ${base[2]}`,
    700: mixColor(base, black, 0.15),
    800: mixColor(base, black, 0.3),
    900: mixColor(base, black, 0.45),
    950: mixColor(base, black, 0.6),
  };
}

export const AppShell: React.FC = () => {
  const { user, logout, has } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const pageTitle = pageTitleFor(location.pathname);
  
  const allowedNavItems = NAVIGATION_ITEMS.filter(item => has(item.permission));

  // Nome da agência lido do servidor — qualquer usuário autenticado tem acesso.
  const { data: settingsSummary } = useQuery<AgencySettingsSummary>({
    queryKey: ['settings', 'summary'],
    queryFn: () => apiFetch<AgencySettingsSummary>('/api/settings/summary'),
    staleTime: 10 * 60 * 1000, // 10 min — o nome da agência quase nunca muda
  });
  const agencyName = settingsSummary?.agencyName ?? '';
  const customShades = settingsSummary?.primaryColor ? getShades(settingsSummary.primaryColor) : null;

  // Iniciais do avatar: primeira letra das duas primeiras palavras do nome.
  function agencyInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'CR';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  // Apply custom shades dynamically
  useEffect(() => {
    if (!customShades) return;
    
    const root = document.documentElement;
    root.style.setProperty('--tw-color-teal-50', customShades[50]);
    root.style.setProperty('--tw-color-teal-100', customShades[100]);
    root.style.setProperty('--tw-color-teal-200', customShades[200]);
    root.style.setProperty('--tw-color-teal-300', customShades[300]);
    root.style.setProperty('--tw-color-teal-400', customShades[400]);
    root.style.setProperty('--tw-color-teal-500', customShades[500]);
    root.style.setProperty('--tw-color-teal-600', customShades[600]);
    root.style.setProperty('--tw-color-teal-700', customShades[700]);
    root.style.setProperty('--tw-color-teal-800', customShades[800]);
    root.style.setProperty('--tw-color-teal-900', customShades[900]);
    root.style.setProperty('--tw-color-teal-950', customShades[950]);
    
    return () => {
      root.style.removeProperty('--tw-color-teal-50');
      root.style.removeProperty('--tw-color-teal-100');
      root.style.removeProperty('--tw-color-teal-200');
      root.style.removeProperty('--tw-color-teal-300');
      root.style.removeProperty('--tw-color-teal-400');
      root.style.removeProperty('--tw-color-teal-500');
      root.style.removeProperty('--tw-color-teal-600');
      root.style.removeProperty('--tw-color-teal-700');
      root.style.removeProperty('--tw-color-teal-800');
      root.style.removeProperty('--tw-color-teal-900');
      root.style.removeProperty('--tw-color-teal-950');
    };
  }, [customShades]);

  // Sincroniza o título da aba com o nome da agência quando ele chega.
  useEffect(() => {
    document.title = agencyName ? `${agencyName} — CRM` : 'CRM';
  }, [agencyName]);

  // Fecha a gaveta ao navegar — no mobile ela cobre todo o conteúdo.
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Esc fecha a gaveta e o conteúdo atrás dela não deve rolar enquanto aberta.
  useEffect(() => {
    if (!isSidebarOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [isSidebarOpen]);

  const renderNavLink = (item: (typeof NAVIGATION_ITEMS)[number]) => {
    const Icon = item.icon;
    const isActive =
      item.to === '/'
        ? location.pathname === '/'
        : location.pathname === item.to || location.pathname.startsWith(item.to + '/');

    return (
      <NavLink
        key={item.to}
        to={item.to}
        aria-current={isActive ? 'page' : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-teal-600 text-white'
            : 'text-slate-300 hover:bg-navy-800 hover:text-white'
        }`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <div className="min-h-dvh bg-slate-50 lg:flex">


      {/* Fundo escurecido da gaveta no mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-navy-950/60 backdrop-blur-sm lg:hidden animate-overlay-in"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/*
        Desktop: coluna fixa de 260px grudada no topo (sticky).
        Mobile/tablet: gaveta deslizante sobreposta, aberta pelo botão do header.
      */}
      <aside
        id="app-sidebar"
        className={`fixed top-0 left-0 h-dvh z-40 w-[260px] flex-shrink-0 bg-navy-900 text-white flex flex-col justify-between border-r border-navy-800 transition-transform duration-200 ease-out lg:sticky lg:left-auto lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="min-h-0 flex-1 flex flex-col">
          {/* Identidade da agência */}
          <div className="h-16 flex items-center gap-3 px-5 border-b border-navy-800/80 flex-shrink-0 relative">
            {settingsSummary?.logoUrl ? (
              <div className="flex items-center justify-center min-w-0 flex-1 w-full">
                <img 
                  src={settingsSummary.logoUrl} 
                  alt={agencyName || 'Logo da agência'} 
                  className="max-h-8 max-w-full object-contain filter drop-shadow-sm" 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0">
                  {agencyInitials(agencyName || 'CRM')}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="font-semibold text-sm leading-tight text-white truncate"
                    title={agencyName || 'CRM'}
                  >
                    {agencyName || 'CRM'}
                  </div>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Fechar menu"
              className="ml-auto -mr-1 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 lg:hidden"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Navegação */}
          <nav
            aria-label="Navegação principal"
            className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto overscroll-contain nav-scroll"
          >
            <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Menu
            </div>
            {allowedNavItems.map(renderNavLink)}
          </nav>
        </div>

        {/* Perfil e sessão */}
        <div className="p-3 border-t border-navy-800/80 bg-navy-950/40 flex-shrink-0">
          <div className="p-2.5 rounded-lg bg-navy-800/60 border border-navy-700/50">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-7 h-7 rounded-full bg-teal-600/30 text-teal-200 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-teal-500/30"
                  aria-hidden="true"
                >
                  {user?.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
                </div>
              </div>
              <span 
                className="text-[10px] px-1.5 py-0.5 rounded bg-navy-700 text-slate-200 font-medium flex-shrink-0 max-w-[120px] truncate"
                title={user?.groups?.map(g => g.name).join(', ') || 'Sem grupo'}
              >
                {user?.groups?.length ? user.groups.map(g => g.name).join(', ') : 'Sem grupo'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 pt-1 border-t border-navy-700/50">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] text-slate-200 hover:text-white hover:bg-navy-700 rounded transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Alterar senha</span>
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-[11px] text-rose-300 hover:text-rose-200 hover:bg-rose-950/40 rounded transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0 min-h-dvh">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sticky top-0 z-20 shadow-2xs flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Abrir menu de navegação"
              aria-expanded={isSidebarOpen}
              aria-controls="app-sidebar"
              className="p-2 -ml-2 rounded-lg text-slate-600 hover:text-navy-900 hover:bg-slate-100 transition-colors lg:hidden"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="text-sm font-semibold text-navy-900 truncate lg:hidden">
              {pageTitle}
            </span>
            <span className="hidden lg:inline text-xs font-medium text-slate-500">
              Ambiente Operacional
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" aria-hidden="true" />
            <span aria-hidden="true" className="hidden sm:inline">
              Sessão ativa
            </span>
            <span className="sr-only">Sessão ativa</span>
          </span>
        </header>

        {/*
          `min-w-0` em toda a cadeia impede que tabelas largas estourem a
          largura da viewport e criem scroll horizontal na página inteira.
        */}
        <main className="flex-1 min-w-0 flex flex-col">
          {allowedNavItems.length > 0 ? (
            <div className="flex-1 min-w-0 flex flex-col p-4 sm:p-6 lg:p-8 max-w-app mx-auto w-full">
              <Outlet />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 min-h-0" role="alert">
              <EmptyState
                icon={<ShieldCheck className="w-6 h-6" />}
                title="Nenhum acesso liberado"
                message="Procure o administrador."
              />
            </div>
          )}
        </main>
      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};
