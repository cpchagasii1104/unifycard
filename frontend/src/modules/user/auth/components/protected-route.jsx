import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context.js';

/**
 * Rota protegida: só renderiza children se usuário estiver autenticado.
 * @param {ReactNode} children
 */
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return token ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
