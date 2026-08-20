import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './components/Auth/LoginPage';
import { RequireAuth } from './components/Auth/RequireAuth';
import { AppShell } from './components/Layout/AppShell';
import { UsersPage } from './components/Users/UsersPage';
import { ClientsPage } from './components/Clients/ClientsPage';
import { ContractsPage } from './components/Contracts/ContractsPage';
import { FinancialPage } from './components/Financial/FinancialPage';
import { KanbanPage } from './components/Kanban/KanbanPage';
import { DashboardPage } from './components/Dashboard/DashboardPage';
import { SettingsPage } from './components/Settings/SettingsPage';

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
        <Route index element={<DashboardPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="pipeline" element={<KanbanPage />} />
        <Route path="contratos" element={<ContractsPage />} />
        <Route path="financeiro" element={<FinancialPage />} />
        <Route
          path="usuarios"
          element={
            <RequireAuth adminOnly>
              <UsersPage />
            </RequireAuth>
          }
        />
        <Route
          path="configuracoes"
          element={
            <RequireAuth adminOnly>
              <SettingsPage />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
