// frontend/src/components/layout/UnifiedAuthLayout.tsx
// 2026-05-15: layout autenticado unificado.
// Pedido Clayton: "menu lateral + header devem ser iguais em todas as páginas".
// Composto por: GlobalSidebar (esquerda) + GlobalHeader (topo) + Outlet (conteúdo).
//
// Layouts específicos (BankLayout, SocialLayout, AdminLayout, AppLayout) são
// thin wrappers deste — adicionam apenas className própria para CSS herdado.

import { Outlet } from 'react-router-dom';
import GlobalHeader from './GlobalHeader';
import GlobalSidebar from './GlobalSidebar';
import './UnifiedAuthLayout.css';

interface UnifiedAuthLayoutProps {
  /** className opcional aplicada no main para herdar estilos legados. */
  mainClassName?: string;
  /** Renderiza children diretamente ao invés de <Outlet />. */
  children?: React.ReactNode;
}

export default function UnifiedAuthLayout({ mainClassName, children }: UnifiedAuthLayoutProps) {
  return (
    <div className="ual-shell">
      <GlobalSidebar />
      <div className="ual-content">
        <GlobalHeader />
        <main className={`ual-main ${mainClassName ?? ''}`}>
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
