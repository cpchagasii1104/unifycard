// frontend/src/components/layout/UnifiedAuthLayout.tsx
// 2026-05-15: layout autenticado unificado.
// Pedido Clayton: "menu lateral + header devem ser iguais em todas as páginas".
// Composto por: GlobalSidebar (esquerda) + GlobalHeader (topo) + Outlet (conteúdo).
//
// Layouts específicos (BankLayout, SocialLayout, AdminLayout, AppLayout) são
// thin wrappers deste — adicionam apenas className própria para CSS herdado.
//
// 2026-07-07 (pedido Clayton): sidebar recolhível — o menu ocupava espaço demais
// do conteúdo. Recolhida vira trilho de ícones (72px, mesmo padrão do modo tablet).
// Preferência lembrada em localStorage (apresentação pura, não verdade).

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import GlobalHeader from './GlobalHeader';
import GlobalSidebar from './GlobalSidebar';
import './UnifiedAuthLayout.css';

const SIDEBAR_COLLAPSED_KEY = 'unificard.ui.sidebarCollapsed';

interface UnifiedAuthLayoutProps {
  /** className opcional aplicada no main para herdar estilos legados. */
  mainClassName?: string;
  /** Renderiza children diretamente ao invés de <Outlet />. */
  children?: React.ReactNode;
}

export default function UnifiedAuthLayout({ mainClassName, children }: UnifiedAuthLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // preferência não persistida — segue só em memória
      }
      return next;
    });
  };

  return (
    <div className={`ual-shell ${sidebarCollapsed ? 'ual-shell--rail' : ''}`}>
      <GlobalSidebar collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
      <div className="ual-content">
        <GlobalHeader />
        <main className={`ual-main ${mainClassName ?? ''}`}>
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
