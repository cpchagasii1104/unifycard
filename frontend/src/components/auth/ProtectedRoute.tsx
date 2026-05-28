// src/components/auth/ProtectedRoute.tsx
// Componente para proteger rotas que requerem autenticação

import { Navigate } from 'react-router-dom';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { useSession } from '../../contexts/SessionProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { authHydrated } = useSession();

  // Aguardar hidratação (bootstrap terminou ou utilizador público já resolvido)
  if (!authHydrated) {
    return null;
  }

  if (!isAuthenticated() || !getTenantId()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}












