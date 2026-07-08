// frontend/src/components/layout/PageModuleShell.tsx
// Matriz de página REUTILIZÁVEL (Clayton 2026-07-07) para /locacoes, /servicos, /oportunidades.
// Header consistente + conteúdo principal + slot de rail contextual. Responsivo: desktop 2 colunas
// (conteúdo + rail); ≤1000px empilha (rail desce); mobile 1 coluna. Sem rail → 1 coluna larga com
// respiro (mata o "cinza morto" do max-width 860px fixo). O shell é UX — não conhece regra de negócio.
import type { ReactNode } from 'react';
import './PageModuleShell.css';

export default function PageModuleShell({ title, subtitle, actions, rail, children }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Slot do rail contextual. Ausente → 1 coluna larga. Presente → 2 colunas no desktop. */
  rail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pms">
      <header className="pms-head">
        <div className="pms-head-main">
          <h1 className="pms-title">{title}</h1>
          {subtitle && <p className="pms-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="pms-head-actions">{actions}</div>}
      </header>
      <div className={`pms-body ${rail ? 'pms-body--railed' : ''}`}>
        <main className="pms-main">{children}</main>
        {rail && <aside className="pms-rail">{rail}</aside>}
      </div>
    </div>
  );
}
