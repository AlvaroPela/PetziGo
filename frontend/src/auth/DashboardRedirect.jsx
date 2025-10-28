import React from 'react';
import { useAuth } from './AuthProvider';
import { Navigate } from 'react-router-dom';

export default function DashboardRedirect() {
  const auth = useAuth();

  if (auth.loading) return <div className="min-h-screen flex items-center justify-center">Validando sesión…</div>;

  // If not authenticated, go to login
  if (!auth.token || !auth.user) return <Navigate to="/login" replace />;

  // Redirect based on role
  const role = auth.user.role;
  if (role === 'CLIENT') return <Navigate to="/client" replace />;
  if (role === 'PROVIDER') return <Navigate to="/provider" replace />;
  if (role === 'ADMIN') return <Navigate to="/admin" replace />;

  return <Navigate to="/" replace />;
}
