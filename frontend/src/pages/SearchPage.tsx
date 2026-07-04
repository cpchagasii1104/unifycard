// src/pages/SearchPage.tsx
// 🔎 F-GLOBAL-SEARCH-OMNI Slice C — a BUSCA UNIVERSAL federada ("Google interno"), página cheia.
// (histórico: até 2026-07-01 esta página era um dead-end "em desenvolvimento"; o rewire interino a
// redirecionava para a descoberta de serviços; agora ela é a superfície plena do omnibox.)
//
// LEIS APLICADAS:
//   · frontend nunca cria verdade — as seções vêm resolvidas do backend (GET /search?q=, projeção
//     anti-PII, piso de discovery, eligibility, tenant-scoped);
//   · filtros só com substrato verdadeiro — cidade/estado são seletores NOMEADOS sobre o Location
//     Core (DECISION-0020) e aplicam às seções que o suportam HOJE (serviços + eventos, rotulado);
//     distância/avaliações NÃO aparecem (raio = endereços esparsos; reputação = substrato não-vivo);
//   · doutrina modo×busca — o modo Consumir/Operar NUNCA muda o que é encontrado; só reordena a
//     apresentação das seções (mesma doutrina do dropdown do header).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchOmni, type OmniSearchResult } from '../api/search';
import { getCountries, getStatesByCountry, getCitiesByState, type State, type City } from '../api/world';
import { useActorMode } from '../hooks/useActorMode';
import './SearchPage.css';

type TabKey = 'all' | 'people' | 'companies' | 'groups' | 'services' | 'products' | 'events';

const TAB_LABELS: Record<TabKey, string> = {
  all: 'Tudo',
  people: 'Pessoas',
  companies: 'Empresas',
  groups: 'Grupos',
  services: 'Serviços',
  products: 'Produtos',
  events: 'Eventos',
};

// doutrina modo×busca: ordem de APRESENTAÇÃO das seções (conteúdo idêntico nos dois modos)
const SECTION_ORDER_BY_MODE: Record<'consumir' | 'operar', Exclude<TabKey, 'all'>[]> = {
  consumir: ['services', 'products', 'events', 'people', 'companies', 'groups'],
  operar: ['people', 'companies', 'groups', 'services', 'products', 'events'],
};

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { mode } = useActorMode();
  const urlQ = (searchParams.get('q') || searchParams.get('term') || '').trim();

  const [input, setInput] = useState(urlQ);
  const [result, setResult] = useState<OmniSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [stateId, setStateId] = useState('');
  const [cityId, setCityId] = useState('');
  const seq = useRef(0);

  // filtros nomeados: Location Core (países→estados→cidades)
  useEffect(() => {
    getCountries()
      .then((countries) => {
        const br = countries[0];
        if (br) return getStatesByCountry(br.countryId);
        return [] as State[];
      })
      .then(setStates)
      .catch(() => setStates([]));
  }, []);

  useEffect(() => {
    setCityId('');
    if (!stateId) {
      setCities([]);
      return;
    }
    getCitiesByState(stateId).then(setCities).catch(() => setCities([]));
  }, [stateId]);

  // busca federada (10 por seção na página cheia)
  useEffect(() => {
    const q = urlQ;
    if (q.length < 2) {
      setResult(null);
      return;
    }
    setLoading(true);
    const mySeq = ++seq.current;
    searchOmni(q, 10, cityId || null)
      .then((r) => {
        if (seq.current === mySeq) setResult(r);
      })
      .catch(() => {
        if (seq.current === mySeq) setResult(null);
      })
      .finally(() => {
        if (seq.current === mySeq) setLoading(false);
      });
  }, [urlQ, cityId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (q) setSearchParams({ q });
  };

  const s = result?.sections;
  const counts: Record<Exclude<TabKey, 'all'>, number> = useMemo(
    () => ({
      people: s?.people.length ?? 0,
      companies: s?.companies.length ?? 0,
      groups: s?.groups.length ?? 0,
      services: s?.services.results.length ?? 0,
      products: s?.products.length ?? 0,
      events: s?.events.length ?? 0,
    }),
    [s]
  );
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const sectionOrder = SECTION_ORDER_BY_MODE[mode === 'operar' ? 'operar' : 'consumir'];
  const visibleSections = tab === 'all' ? sectionOrder : [tab as Exclude<TabKey, 'all'>];

  const renderSection = (key: Exclude<TabKey, 'all'>) => {
    if (!s || counts[key] === 0) return null;
    return (
      <section className="sp-section" key={key}>
        <h2 className="sp-section-title">{TAB_LABELS[key]}</h2>
        <div className="sp-results">
          {key === 'people' &&
            s.people.map((p) => (
              // origin='global' = vitrine (outra comunidade) → /vitrine/:actorId (plaquinha pública
              // cross-tenant). origin='local' → perfil interno completo (/profile/:actorId).
              <button
                key={p.actorId}
                type="button"
                className="sp-card"
                title={p.origin === 'global' ? 'Ver perfil público (outra comunidade)' : undefined}
                onClick={() => navigate(p.origin === 'global' ? `/vitrine/${p.actorId}` : `/profile/${p.actorId}`)}
              >
                <span className="sp-card-icon">👤</span>
                <span className="sp-card-body">
                  <span className="sp-card-title">
                    {p.displayName}
                    {p.origin === 'global' && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#4f5bd5', fontWeight: 700 }}>🌐 outra comunidade</span>}
                  </span>
                  {p.bio && <span className="sp-card-sub">{p.bio}</span>}
                </span>
              </button>
            ))}
          {key === 'companies' &&
            s.companies.map((c) => (
              <button
                key={c.actorId}
                type="button"
                className="sp-card"
                title={c.origin === 'global' ? 'Empresa de outra comunidade — página da vitrine em breve' : undefined}
                style={c.origin === 'global' ? { cursor: 'default' } : undefined}
                onClick={c.origin === 'global' ? undefined : () => navigate(`/company/${c.actorId}`)}
              >
                <span className="sp-card-icon">🏢</span>
                <span className="sp-card-body">
                  <span className="sp-card-title">
                    {c.displayName}
                    {c.origin === 'global' && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: '#4f5bd5', fontWeight: 700 }}>🌐 outra comunidade</span>}
                  </span>
                  {c.bio && <span className="sp-card-sub">{c.bio}</span>}
                </span>
              </button>
            ))}
          {key === 'groups' &&
            s.groups.map((g) => (
              <button key={g.groupId} type="button" className="sp-card" onClick={() => navigate(`/grupos/${g.groupId}`)}>
                <span className="sp-card-icon">👥</span>
                <span className="sp-card-body">
                  <span className="sp-card-title">{g.name}</span>
                </span>
              </button>
            ))}
          {key === 'services' &&
            s.services.results.map((r) => (
              <button key={r.serviceId} type="button" className="sp-card" onClick={() => navigate(`/discover/services/${r.serviceId}`)}>
                <span className="sp-card-icon">🔧</span>
                <span className="sp-card-body">
                  <span className="sp-card-title">{r.name}</span>
                </span>
              </button>
            ))}
          {key === 'products' &&
            s.products.map((p) => (
              <button key={p.canonicalProductId} type="button" className="sp-card" onClick={() => navigate('/marketplace')}>
                <span className="sp-card-icon">📦</span>
                <span className="sp-card-body">
                  <span className="sp-card-title">{p.name}</span>
                  {p.brand && <span className="sp-card-sub">{p.brand}</span>}
                </span>
              </button>
            ))}
          {key === 'events' &&
            s.events.map((e) => (
              <button key={e.eventId} type="button" className="sp-card" onClick={() => navigate(`/events/${e.eventId}`)}>
                <span className="sp-card-icon">🎪</span>
                <span className="sp-card-body">
                  <span className="sp-card-title">{e.title}</span>
                  {e.datetimeStart && (
                    <span className="sp-card-sub">{new Date(e.datetimeStart).toLocaleString('pt-BR')}</span>
                  )}
                </span>
              </button>
            ))}
        </div>
      </section>
    );
  };

  return (
    <div className="search-page">
      <div className="search-page-container">
        <h1 className="search-page-title">Busca</h1>

        <form className="sp-form" onSubmit={submit} role="search">
          <input
            type="text"
            className="sp-input"
            placeholder="Buscar pessoas, empresas, grupos, serviços, produtos e eventos…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Buscar"
          />
          <button type="submit" className="sp-submit">Buscar</button>
        </form>

        <div className="sp-filters">
          <label className="sp-filter">
            Estado
            <select value={stateId} onChange={(e) => setStateId(e.target.value)}>
              <option value="">Todos</option>
              {states.map((st) => (
                <option key={st.stateId} value={st.stateId}>{st.name}</option>
              ))}
            </select>
          </label>
          <label className="sp-filter">
            Cidade
            <select value={cityId} onChange={(e) => setCityId(e.target.value)} disabled={!stateId}>
              <option value="">Todas</option>
              {cities.map((ct) => (
                <option key={ct.cityId} value={ct.cityId}>{ct.name}</option>
              ))}
            </select>
          </label>
          {/* honestidade de substrato: o rótulo diz exatamente onde o filtro age */}
          <span className="sp-filter-note">Filtro de cidade aplica a serviços e eventos.</span>
        </div>

        {urlQ.length >= 2 && (
          <>
            <div className="sp-tabs" role="tablist">
              {(['all', ...sectionOrder] as TabKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  className={`sp-tab${tab === k ? ' sp-tab-active' : ''}`}
                  onClick={() => setTab(k)}
                >
                  {TAB_LABELS[k]}
                  {k !== 'all' && counts[k as Exclude<TabKey, 'all'>] > 0 ? ` (${counts[k as Exclude<TabKey, 'all'>]})` : ''}
                </button>
              ))}
            </div>

            {loading && <div className="sp-status">Buscando…</div>}
            {!loading && total === 0 && (
              <div className="sp-status">
                Nada encontrado para “{urlQ}”{cityId ? ' nesta cidade' : ''}.
              </div>
            )}
            {!loading && visibleSections.map((k) => renderSection(k))}
          </>
        )}

        {urlQ.length < 2 && (
          <div className="sp-status">Digite pelo menos 2 caracteres para buscar em todo o ecossistema.</div>
        )}

        <div className="sp-vertical-links">
          <button type="button" className="search-go-services" onClick={() => navigate(`/discover/services${urlQ ? `?term=${encodeURIComponent(urlQ)}` : ''}`)}>
            🔧 Descoberta completa de serviços
          </button>
        </div>
      </div>
    </div>
  );
}
