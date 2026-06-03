// frontend/src/components/layout/GlobalSidebar.tsx
// 2026-05-15: Sidebar unificada compartilhada por todas as páginas autenticadas.
// Substitui as 4 sidebars antigas (BankLayout / SocialLayout / AdminLayout /
// DashboardHome inline) por uma única estrutura padronizada.
//
// Pedido Clayton: "em todas as páginas a opção da lateral esquerda tem que
// ser igual" + adicionar "Sair" no final.
//
// Estrutura: 6 seções + Sair.
//   1. Geral (Início)
//   2. Financeiro (Carteira/UnifyBank, Extrato, Fundo Regional, Ledger Social)
//   3. Comércio (Fazer compras, Pedir carro, Pedir comida, Serviços)
//   4. Social (Rede Social, Grupos, Votações, Impacto)
//   5. Conta (Meu Perfil, Minhas Empresas, Transparência, Configurações)
//   6. Criar (Empresa, Página, Grupo, Canal, Evento)
//   7. Sair

import { useLocation, useNavigate } from 'react-router-dom';
import { clearSession } from '../../config/auth';
import { useActorMode } from '../../hooks/useActorMode';
import { useBusinessProfile } from '../../hooks/useBusinessProfile';
import './GlobalSidebar.css';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Match exato ou prefixo. Default: prefixo. */
  exact?: boolean;
}

interface NavGroup {
  title: string | null;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [{ label: 'Início', icon: '🏠', route: '/home', exact: true }],
  },
  {
    title: 'Financeiro',
    items: [
      { label: 'UnifyBank', icon: '🏦', route: '/banco' },
      { label: 'Extrato', icon: '📄', route: '/extrato' },
      { label: 'Fundo Regional', icon: '🌱', route: '/fundo-regional' },
      { label: 'Ledger Social', icon: '📜', route: '/ledger' },
    ],
  },
  {
    title: 'Comércio',
    items: [
      { label: 'Fazer compras', icon: '🛒', route: '/marketplace' },
      { label: 'Pedir um carro', icon: '🚗', route: '/em-desenvolvimento?feature=mobility' },
      { label: 'Pedir comida', icon: '🍕', route: '/em-desenvolvimento?feature=food' },
      { label: 'Locações', icon: '🔑', route: '/em-desenvolvimento?feature=locacoes' },
      { label: 'Serviços', icon: '🔧', route: '/services' },
    ],
  },
  {
    title: 'Social',
    items: [
      { label: 'Rede Social', icon: '💬', route: '/social' },
      { label: 'Grupos', icon: '👥', route: '/grupos' },
      // DT-MODULE-VOTES-FANTASMA (2026-05-16): /votacoes desativado — tabelas inexistentes.
      { label: 'Votações', icon: '🗳️', route: '/em-desenvolvimento?feature=votes' },
      { label: 'Impacto', icon: '💚', route: '/impacto' },
    ],
  },
  {
    title: 'Conta',
    items: [
      { label: 'Meu Perfil', icon: '👤', route: '/perfil' },
      { label: 'Minhas Empresas', icon: '🏢', route: '/empresas' },
      { label: 'Transparência', icon: '🔍', route: '/transparencia' },
      { label: 'Configurações', icon: '⚙️', route: '/dashboard' },
    ],
  },
  {
    title: 'Criar',
    items: [
      { label: 'Empresa', icon: '🏢', route: '/empresas' },
      { label: 'Página', icon: '📄', route: '/em-desenvolvimento?feature=page' },
      { label: 'Grupo', icon: '👥', route: '/grupos' },
      { label: 'Canal', icon: '📡', route: '/em-desenvolvimento?feature=channel' },
      { label: 'Evento', icon: '🎭', route: '/events/new' },
    ],
  },
];

// [MVP-A piloto fechado] Rotas ocultadas do nav por estarem fora do escopo do piloto
// (marketplace de produtos, serviços pagos, PJ/empresas). Código e rotas permanecem intactos —
// apenas não são exibidos no menu. Reverter = esvaziar este Set.
const PILOT_HIDDEN_ROUTES = new Set<string>(['/marketplace', '/services', '/empresas']);

export default function GlobalSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useActorMode();
  const { profile: businessProfile } = useBusinessProfile();

  const isActive = (item: NavItem): boolean => {
    const path = item.route.split('?')[0];
    if (item.exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // 2026-05-15: priorityRoutes vêm do perfil contextual do actor ativo.
  // 2026-05-18 P2 item 5: businessProfile (banda/clínica/loja/etc) MERGE com
  // priorities do actor — princípio "prioriza, não esconde" preservado.
  // Sem businessProfile: priorities = profile.sidebarPriorities (legacy).
  // Com businessProfile: union (Set) — destaque combinado, sem remoção.
  // Itens prioritários recebem destaque visual (badge "● prioritário").
  // NÃO escondemos itens — apenas marcamos visualmente. Mantém base
  // estrutural universal conforme diretriz "actor = modo operacional".
  const priorityRoutes = new Set([
    ...profile.sidebarPriorities,
    ...(businessProfile?.sidebarPriorities ?? []),
  ]);
  const isPriority = (item: NavItem): boolean => priorityRoutes.has(item.route);

  const handleLogout = () => {
    clearSession();
    window.dispatchEvent(new CustomEvent('auth-changed'));
    window.location.href = '/login';
  };

  return (
    <aside className="gs-sidebar" aria-label="Navegação principal">
      <div className="gs-brand" onClick={() => navigate('/home')} role="button" tabIndex={0}>
        <span className="gs-brand-icon">💠</span>
        <span className="gs-brand-name">UnifiCard</span>
      </div>

      <nav className="gs-nav">
        {NAV_GROUPS.map((group, gIdx) => (
          <div key={gIdx} className="gs-group">
            {group.title && <div className="gs-group-title">{group.title}</div>}
            {group.items.filter((item) => !PILOT_HIDDEN_ROUTES.has(item.route)).map((item) => {
              const active = isActive(item);
              const priority = isPriority(item);
              return (
                <button
                  key={item.label + item.route}
                  type="button"
                  className={`gs-item ${active ? 'active' : ''} ${priority ? 'priority' : ''}`}
                  onClick={() => navigate(item.route)}
                  title={priority ? 'Sugerido para seu perfil atual' : undefined}
                >
                  <span className="gs-item-icon">{item.icon}</span>
                  <span className="gs-item-label">{item.label}</span>
                  {priority && !active && <span className="gs-priority-dot" aria-hidden="true">●</span>}
                </button>
              );
            })}
          </div>
        ))}

        {/* Sair — sempre no final */}
        <div className="gs-group gs-group-logout">
          <button
            type="button"
            className="gs-item gs-item-logout"
            onClick={handleLogout}
            aria-label="Sair da conta"
          >
            <span className="gs-item-icon">🚪</span>
            <span className="gs-item-label">Sair</span>
          </button>
        </div>
      </nav>

      <div className="gs-footer">
        <div className="gs-secure">
          <span>🔒</span>
          <div>
            <div className="gs-secure-title">Sua conta está segura</div>
            <div className="gs-secure-hint">Auditável e responsável</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
