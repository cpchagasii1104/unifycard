// frontend/src/components/layout/OmniSearchDropdown.tsx
// F-GLOBAL-SEARCH-OMNI Slice B — painel de resultados do omnibox (Ctrl-K), 3 pistas:
//   IR PARA  → filtro local sobre a PROJEÇÃO de navegação (GET /navigation/modules) — a pista de
//              "configurações/extrato/fundo regional" não inventa rota: módulos que o actor não vê
//              na sidebar também não aparecem aqui (navegação organiza, não define verdade).
//   QUEM     → pessoas / empresas / grupos (seções resolvidas pelo backend, projeção anti-PII).
//   O QUÊ    → serviços (termo→alias→CONCEPT) / produtos (item canônico) / eventos (piso discovery).
// O componente só RENDERIZA e NAVEGA — zero decisão material no cliente.

import type { ReactNode } from 'react';
import type { NavModuleItem } from '../../api/navigation';
import type { OmniSearchResult } from '../../api/search';

interface OmniSearchDropdownProps {
  q: string;
  result: OmniSearchResult | null;
  navHits: NavModuleItem[];
  loading: boolean;
  /** DOUTRINA MODO×BUSCA (ratificada por Clayton 2026-07-03): o modo Consumir/Operar NUNCA muda
   *  O QUE a busca encontra (retrieval = tenant + visibilidade + eligibility, tudo server-side,
   *  modo-independente). O modo só reordena a APRESENTAÇÃO das seções DEPOIS do buscador trabalhar
   *  (lei "frontend pode ordenar/priorizar visualmente"): Consumir prioriza O QUÊ (ofertas);
   *  Operar prioriza QUEM/navegação operacional. Mesmos resultados, ênfase diferente. */
  mode?: 'consumir' | 'operar' | string;
  onNavigate: (route: string) => void;
  onFullSearch: () => void;
}

type OmniSectionKey = 'nav' | 'people' | 'companies' | 'groups' | 'services' | 'products' | 'events' | 'rentals';

const SECTION_ORDER_BY_MODE: Record<'consumir' | 'operar', OmniSectionKey[]> = {
  consumir: ['nav', 'services', 'products', 'rentals', 'events', 'people', 'companies', 'groups'],
  operar: ['nav', 'people', 'companies', 'groups', 'services', 'products', 'rentals', 'events'],
};

export default function OmniSearchDropdown({ q, result, navHits, loading, mode, onNavigate, onFullSearch }: OmniSearchDropdownProps) {
  const s = result?.sections;
  const hasAny =
    navHits.length > 0 ||
    (s &&
      (s.people.length > 0 ||
        s.companies.length > 0 ||
        s.groups.length > 0 ||
        s.services.results.length > 0 ||
        s.products.length > 0 ||
        s.events.length > 0 ||
        (s.rentals?.length ?? 0) > 0));

  // renderers por seção — a ORDEM de exibição vem do modo (apresentação); o CONTEÚDO nunca muda
  const sectionRenderers: Record<OmniSectionKey, () => ReactNode> = {
    nav: () =>
      navHits.length > 0 && (
        <div className="omni-section" key="nav">
          <div className="omni-section-title">Ir para</div>
          {navHits.map((m) => (
            <button key={m.moduleKey} type="button" className="omni-item" onClick={() => onNavigate(m.route)}>
              <span className="omni-item-icon" aria-hidden="true">{m.icon || '📄'}</span>
              <span className="omni-item-label">{m.label}</span>
            </button>
          ))}
        </div>
      ),
    people: () =>
      s && s.people.length > 0 && (
        <div className="omni-section" key="people">
          <div className="omni-section-title">Pessoas</div>
          {s.people.map((p) => (
            // origin='global' = plaquinha da vitrine (outra comunidade) → página da vitrine
            // (/vitrine/:actorId, leitura cross-tenant só da plaquinha pública). origin='local' →
            // perfil interno completo (/profile/:actorId).
            <button
              key={p.actorId}
              type="button"
              className="omni-item"
              title={p.origin === 'global' ? 'Ver perfil público (outra comunidade)' : undefined}
              onClick={() => onNavigate(p.origin === 'global' ? `/vitrine/${p.actorId}` : `/profile/${p.actorId}`)}
            >
              {p.avatarUrl ? (
                <img className="omni-item-avatar" src={p.avatarUrl} alt="" />
              ) : (
                <span className="omni-item-icon" aria-hidden="true">👤</span>
              )}
              <span className="omni-item-label">{p.displayName}</span>
              {p.origin === 'global' && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#4f5bd5', fontWeight: 700 }}>🌐 outra comunidade</span>}
            </button>
          ))}
        </div>
      ),
    companies: () =>
      s && s.companies.length > 0 && (
        <div className="omni-section" key="companies">
          <div className="omni-section-title">Empresas</div>
          {s.companies.map((c) => (
            <button
              key={c.actorId}
              type="button"
              className="omni-item"
              title={c.origin === 'global' ? 'Empresa de outra comunidade — página da vitrine em breve' : undefined}
              style={c.origin === 'global' ? { cursor: 'default' } : undefined}
              onClick={c.origin === 'global' ? undefined : () => onNavigate(`/company/${c.actorId}`)}
            >
              {c.avatarUrl ? (
                <img className="omni-item-avatar" src={c.avatarUrl} alt="" />
              ) : (
                <span className="omni-item-icon" aria-hidden="true">🏢</span>
              )}
              <span className="omni-item-label">{c.displayName}</span>
              {c.origin === 'global' && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#4f5bd5', fontWeight: 700 }}>🌐 outra comunidade</span>}
            </button>
          ))}
        </div>
      ),
    groups: () =>
      s && s.groups.length > 0 && (
        <div className="omni-section" key="groups">
          <div className="omni-section-title">Grupos</div>
          {s.groups.map((g) => (
            <button key={g.groupId} type="button" className="omni-item" onClick={() => onNavigate(`/grupos/${g.groupId}`)}>
              <span className="omni-item-icon" aria-hidden="true">👥</span>
              <span className="omni-item-label">{g.name}</span>
            </button>
          ))}
        </div>
      ),
    services: () =>
      s && s.services.results.length > 0 && (
        <div className="omni-section" key="services">
          <div className="omni-section-title">Serviços</div>
          {s.services.results.map((r) => (
            <button key={r.serviceId} type="button" className="omni-item" onClick={() => onNavigate(`/discover/services/${r.serviceId}`)}>
              <span className="omni-item-icon" aria-hidden="true">🔧</span>
              <span className="omni-item-label">{r.name}</span>
            </button>
          ))}
        </div>
      ),
    products: () =>
      s && s.products.length > 0 && (
        <div className="omni-section" key="products">
          <div className="omni-section-title">Produtos</div>
          {s.products.map((p) => (
            // sem página de item canônico no frontend ainda — deep-link honesto pro marketplace
            <button key={p.canonicalProductId} type="button" className="omni-item" onClick={() => onNavigate('/marketplace')}>
              <span className="omni-item-icon" aria-hidden="true">📦</span>
              <span className="omni-item-label">{p.name}{p.brand ? ` · ${p.brand}` : ''}</span>
            </button>
          ))}
        </div>
      ),
    events: () =>
      s && s.events.length > 0 && (
        <div className="omni-section" key="events">
          <div className="omni-section-title">Eventos</div>
          {s.events.map((e) => (
            <button key={e.eventId} type="button" className="omni-item" onClick={() => onNavigate(`/events/${e.eventId}`)}>
              <span className="omni-item-icon" aria-hidden="true">🎪</span>
              <span className="omni-item-label">{e.title}</span>
              {e.datetimeStart && (
                <span className="omni-item-meta">{new Date(e.datetimeStart).toLocaleDateString('pt-BR')}</span>
              )}
            </button>
          ))}
        </div>
      ),
    rentals: () =>
      s && (s.rentals?.length ?? 0) > 0 && (
        <div className="omni-section" key="rentals">
          <div className="omni-section-title">Locações</div>
          {s.rentals!.map((r) => (
            <button key={r.id} type="button" className="omni-item" onClick={() => onNavigate(`/locacoes/${r.id}`)}>
              <span className="omni-item-icon" aria-hidden="true">🔑</span>
              <span className="omni-item-label">{r.label}</span>
              {r.cityName && <span className="omni-item-meta">{r.cityName}{r.uf ? `/${r.uf}` : ''}</span>}
            </button>
          ))}
        </div>
      ),
  };

  const order = SECTION_ORDER_BY_MODE[mode === 'operar' ? 'operar' : 'consumir'];

  return (
    <div className="omni-dropdown" role="listbox" aria-label="Resultados da busca">
      {order.map((k) => sectionRenderers[k]())}

      {!loading && !hasAny && (
        <div className="omni-empty">Nada encontrado para “{q}”.</div>
      )}
      {loading && <div className="omni-empty">Buscando…</div>}

      <button type="button" className="omni-footer" onClick={onFullSearch}>
        Ver todos os resultados para “{q}” →
      </button>
    </div>
  );
}
