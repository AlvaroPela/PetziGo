import React from 'react';
import { useAuth } from './AuthProvider';
import { Outlet, Navigate } from 'react-router-dom';

export default function RequireRole({ allowedRoles = [] }) {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="rounded-lg bg-white p-6 shadow">Validando sesión…</div>
      </div>
    );
  }

  const hasAccess = auth.token && auth.user && (allowedRoles.length === 0 || allowedRoles.includes(auth.user.role));

  if (!hasAccess) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
