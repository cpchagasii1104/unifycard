// src/pages/HomePage.tsx
// 2026-05-15: usa UnifiedAuthLayout (mesma sidebar + header de todas as páginas).
// DashboardHome agora renderiza apenas o CONTEÚDO central (cards/grupos/atalhos),
// sem sidebar/topbar próprios.

import UnifiedAuthLayout from '../components/layout/UnifiedAuthLayout';
import DashboardHome from '../components/home/DashboardHome';

export default function HomePage() {
  return (
    <UnifiedAuthLayout>
      <DashboardHome />
    </UnifiedAuthLayout>
  );
}
