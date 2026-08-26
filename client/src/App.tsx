import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './components/Auth/LoginPage';
import { RequireAuth } from './components/Auth/RequireAuth';
import { AppShell } from './components/Layout/AppShell';
import { ClientsPage } from './components/Clients/ClientsPage';
import { ContractsPage } from './components/Contracts/ContractsPage';
import { FinancialPage } from './components/Financial/FinancialPage';
import { LoadingState } from './components/ui/States';
import { useAuth } from './context/AuthContext';
import { NAVIGATION_ITEMS } from './components/Layout/navigation';

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
const OperationalPipelinePage = lazy(() =>
  import('./components/OperationalPipeline/OperationalPipelinePage')
);
const UsersPage = lazy(() =>
  import('./components/Users/UsersPage').then((m) => ({ default: m.UsersPage }))
);
const SettingsPage = lazy(() =>
  import('./components/Settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const GroupsPage = lazy(() =>
  import('./components/Groups/GroupsPage').then((m) => ({ default: m.GroupsPage }))
);

const RouteFallback = <LoadingState message="Carregando a página…" />;

const HomeRedirect: React.FC = () => {
  const { has } = useAuth();
  const firstAllowed = NAVIGATION_ITEMS.find((item) => has(item.permission));

  if (firstAllowed) {
    return <Navigate to={firstAllowed.to} replace />;
  }

  // Se não tem permissão para nenhuma tela, o AppShell já exibe o EmptyState
  // Porém a rota índice precisa renderizar algo (ou nulo) se as rotas internas não mudaram o outlet.
  // A SPEC diz para renderizar no AppShell: "Usuário sem nenhuma permissão de tela: renderizar EmptyState".
  return null;
};

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
        <Route index element={<HomeRedirect />} />
        
        <Route
          path="dashboard"
          element={
            <RequireAuth permission="screen.dashboard">
              <Suspense fallback={RouteFallback}>{<DashboardPage />}</Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="clientes"
          element={
            <RequireAuth permission="screen.clientes">
              <ClientsPage />
            </RequireAuth>
          }
        />
        <Route
          path="pipeline"
          element={
            <RequireAuth permission="screen.pipeline">
              <Suspense fallback={RouteFallback}>{<KanbanPage />}</Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="pipeline-operacional"
          element={
            <RequireAuth permission="screen.pipeline_operacional">
              <Suspense fallback={RouteFallback}><OperationalPipelinePage /></Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="contratos"
          element={
            <RequireAuth permission="screen.contratos">
              <ContractsPage />
            </RequireAuth>
          }
        />
        <Route
          path="financeiro"
          element={
            <RequireAuth permission="screen.financeiro">
              <FinancialPage />
            </RequireAuth>
          }
        />
        <Route
          path="usuarios"
          element={
            <RequireAuth permission="screen.usuarios">
              <Suspense fallback={RouteFallback}>
                <UsersPage />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="configuracoes"
          element={
            <RequireAuth permission="screen.configuracoes">
              <Suspense fallback={RouteFallback}>
                <SettingsPage />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="grupos"
          element={
            <RequireAuth permission="screen.grupos">
              <Suspense fallback={RouteFallback}>
                <GroupsPage />
              </Suspense>
            </RequireAuth>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

