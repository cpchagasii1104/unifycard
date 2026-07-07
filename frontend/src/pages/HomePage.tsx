// src/pages/HomePage.tsx
// 2026-05-15: usa UnifiedAuthLayout (mesma sidebar + header de todas as páginas).
// DashboardHome agora renderiza apenas o CONTEÚDO central (cards/grupos/atalhos),
// sem sidebar/topbar próprios.

import UnifiedAuthLayout from '../components/layout/UnifiedAuthLayout';
import DashboardHome from '../components/home/DashboardHome';
import ConnectionRequests from '../components/social/ConnectionRequests';

export default function HomePage() {
  return (
    <UnifiedAuthLayout>
      {/* Solicitações de conexão RECEBIDAS visíveis onde o usuário CAI ao logar
          (achado Clayton 2026-07-07: Dev não via a solicitação — o card morava só no feed).
          O componente some sozinho quando não há pendências (return null). */}
      <ConnectionRequests />
      <DashboardHome />
    </UnifiedAuthLayout>
  );
}
