import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ForceChangePasswordModal } from './ForceChangePasswordModal';
import { NAVIGATION_ITEMS } from '../Layout/navigation';

interface RequireAuthProps {
  children: React.ReactNode;
  permission?: string;
  anyPermission?: string[];
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children, permission, anyPermission }) => {
  const { user, isLoading, has, hasAny } = useAuth();

  if (isLoading) {
    return (
      <div
        className="min-h-dvh bg-slate-50 flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-slate-600">Carregando o CRM…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    return <ForceChangePasswordModal />;
  }

  const isDenied = (permission && !has(permission)) || (anyPermission && !hasAny(...anyPermission));

  if (isDenied) {
    const firstAllowed = NAVIGATION_ITEMS.find(item => has(item.permission));
    return <Navigate to={firstAllowed?.to || '/'} replace />;
  }

  return <>{children}</>;
};
