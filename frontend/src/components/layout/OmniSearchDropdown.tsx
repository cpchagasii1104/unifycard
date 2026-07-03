// frontend/src/components/layout/OmniSearchDropdown.tsx
// F-GLOBAL-SEARCH-OMNI Slice B — painel de resultados do omnibox (Ctrl-K), 3 pistas:
//   IR PARA  → filtro local sobre a PROJEÇÃO de navegação (GET /navigation/modules) — a pista de
//              "configurações/extrato/fundo regional" não inventa rota: módulos que o actor não vê
//              na sidebar também não aparecem aqui (navegação organiza, não define verdade).
//   QUEM     → pessoas / empresas / grupos (seções resolvidas pelo backend, projeção anti-PII).
//   O QUÊ    → serviços (termo→alias→CONCEPT) / produtos (item canônico) / eventos (piso discovery).
// O componente só RENDERIZA e NAVEGA — zero decisão material no cliente.

import type { NavModuleItem } from '../../api/navigation';
import type { OmniSearchResult } from '../../api/search';

interface OmniSearchDropdownProps {
  q: string;
  result: OmniSearchResult | null;
  navHits: NavModuleItem[];
  loading: boolean;
  onNavigate: (route: string) => void;
  onFullSearch: () => void;
}

export default function OmniSearchDropdown({ q, result, navHits, loading, onNavigate, onFullSearch }: OmniSearchDropdownProps) {
  const s = result?.sections;
  const hasAny =
    navHits.length > 0 ||
    (s &&
      (s.people.length > 0 ||
        s.companies.length > 0 ||
        s.groups.length > 0 ||
        s.services.results.length > 0 ||
        s.products.length > 0 ||
        s.events.length > 0));

  return (
    <div className="omni-dropdown" role="listbox" aria-label="Resultados da busca">
      {navHits.length > 0 && (
        <div className="omni-section">
          <div className="omni-section-title">Ir para</div>
          {navHits.map((m) => (
            <button key={m.moduleKey} type="button" className="omni-item" onClick={() => onNavigate(m.route)}>
              <span className="omni-item-icon" aria-hidden="true">{m.icon || '📄'}</span>
              <span className="omni-item-label">{m.label}</span>
            </button>
          ))}
        </div>
      )}

      {s && s.people.length > 0 && (
        <div className="omni-section">
          <div className="omni-section-title">Pessoas</div>
          {s.people.map((p) => (
            <button key={p.actorId} type="button" className="omni-item" onClick={() => onNavigate(`/profile/${p.actorId}`)}>
              {p.avatarUrl ? (
                <img className="omni-item-avatar" src={p.avatarUrl} alt="" />
              ) : (
                <span className="omni-item-icon" aria-hidden="true">👤</span>
              )}
              <span className="omni-item-label">{p.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {s && s.companies.length > 0 && (
        <div className="omni-section">
          <div className="omni-section-title">Empresas</div>
          {s.companies.map((c) => (
            <button key={c.actorId} type="button" className="omni-item" onClick={() => onNavigate(`/company/${c.actorId}`)}>
              {c.avatarUrl ? (
                <img className="omni-item-avatar" src={c.avatarUrl} alt="" />
              ) : (
                <span className="omni-item-icon" aria-hidden="true">🏢</span>
              )}
              <span className="omni-item-label">{c.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {s && s.groups.length > 0 && (
        <div className="omni-section">
          <div className="omni-section-title">Grupos</div>
          {s.groups.map((g) => (
            <button key={g.groupId} type="button" className="omni-item" onClick={() => onNavigate(`/grupos/${g.groupId}`)}>
              <span className="omni-item-icon" aria-hidden="true">👥</span>
              <span className="omni-item-label">{g.name}</span>
            </button>
          ))}
        </div>
      )}

      {s && s.services.results.length > 0 && (
        <div className="omni-section">
          <div className="omni-section-title">Serviços</div>
          {s.services.results.map((r) => (
            <button key={r.serviceId} type="button" className="omni-item" onClick={() => onNavigate(`/discover/services/${r.serviceId}`)}>
              <span className="omni-item-icon" aria-hidden="true">🔧</span>
              <span className="omni-item-label">{r.name}</span>
            </button>
          ))}
        </div>
      )}

      {s && s.products.length > 0 && (
        <div className="omni-section">
          <div className="omni-section-title">Produtos</div>
          {s.products.map((p) => (
            // sem página de item canônico no frontend ainda — deep-link honesto pro marketplace
            <button key={p.canonicalProductId} type="button" className="omni-item" onClick={() => onNavigate('/marketplace')}>
              <span className="omni-item-icon" aria-hidden="true">📦</span>
              <span className="omni-item-label">{p.name}{p.brand ? ` · ${p.brand}` : ''}</span>
            </button>
          ))}
        </div>
      )}

      {s && s.events.length > 0 && (
        <div className="omni-section">
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
      )}

      {!loading && !hasAny && (
        <div className="omni-empty">Nada encontrado para “{q}”.</div>
      )}
      {loading && <div className="omni-empty">Buscando…</div>}

      <button type="button" className="omni-footer" onClick={onFullSearch}>
        Buscar serviços por “{q}” →
      </button>
    </div>
  );
}
