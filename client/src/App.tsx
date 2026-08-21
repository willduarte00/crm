import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './components/Auth/LoginPage';
import { RequireAuth } from './components/Auth/RequireAuth';
import { AppShell } from './components/Layout/AppShell';
import { ClientsPage } from './components/Clients/ClientsPage';
import { ContractsPage } from './components/Contracts/ContractsPage';
import { FinancialPage } from './components/Financial/FinancialPage';
import { LoadingState } from './components/ui/States';

/*
 * Recharts (dashboard) e @hello-pangea/dnd (pipeline) respondem por boa parte
 * do bundle e só são usados nessas duas rotas. Carregá-las sob demanda tira
 * esse peso do primeiro carregamento, que hoje cai na tela de login.
 */
const DashboardPage = lazy(() =>
  import('./components/Dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const KanbanPage = lazy(() =>
  import('./components/Kanban/KanbanPage').then((m) => ({ default: m.KanbanPage }))
);
const UsersPage = lazy(() =>
  import('./components/Users/UsersPage').then((m) => ({ default: m.UsersPage }))
);
const SettingsPage = lazy(() =>
  import('./components/Settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

const RouteFallback = <LoadingState message="Carregando a página…" />;

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route
          index
          element={<Suspense fallback={RouteFallback}>{<DashboardPage />}</Suspense>}
        />
        <Route path="clientes" element={<ClientsPage />} />
        <Route
          path="pipeline"
          element={<Suspense fallback={RouteFallback}>{<KanbanPage />}</Suspense>}
        />
        <Route path="contratos" element={<ContractsPage />} />
        <Route path="financeiro" element={<FinancialPage />} />
        <Route
          path="usuarios"
          element={
            <RequireAuth adminOnly>
              <Suspense fallback={RouteFallback}>
                <UsersPage />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="configuracoes"
          element={
            <RequireAuth adminOnly>
              <Suspense fallback={RouteFallback}>
                <SettingsPage />
              </Suspense>
            </RequireAuth>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
