// src/pages/ServiceDiscoveryPage.tsx
// Página de Descoberta de Serviços
// SPRINT: Service Discovery MVP
// Conectado ao endpoint backend canônico GET /services/discover

import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  discoverServices,
  searchServicesByTerm,
  type DiscoveredService,
  type ServiceDiscoveryFilters,
  type ServiceTermSearchResult,
} from '../api/service-discovery';
import { searchEventThemes } from '../api/events';
import { showToast } from '../components/common/Toast';
// 🔴 FATIA 3B — CONTRATAR: modal de proposta orquestrada (C3) a partir do card de descoberta.
import ContractPerformerModal from '../components/services/ContractPerformerModal';
import './ServiceDiscoveryPage.css';

export default function ServiceDiscoveryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<DiscoveredService[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  
  // Filtros
  const [categoryId, setCategoryId] = useState<string>('');
  const [cityId, setCityId] = useState<string>('');
  const [stateId, setStateId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [hasAvailability, setHasAvailability] = useState<boolean>(false);
  const [actorType, setActorType] = useState<string>('');

  // 🔵 SLICE-2B (discovery by genre): filtro por GÊNERO governado (typeahead no pool de assunto via
  // searchEventThemes — mesmo padrão do GenreTab do raio-x; NENHUMA lista hardcoded no front) e filtro
  // "evento para quantas pessoas?" (audience_size — a faixa da oferta precisa CONTER N). O frontend só
  // projeta a verdade resolvida pelo backend (concept id governado); o matching vive em /services/discover.
  const [genre, setGenre] = useState<{ conceptId: string; label: string } | null>(null);
  const [genreQ, setGenreQ] = useState<string>('');
  const [genreResults, setGenreResults] = useState<Array<{ conceptId: string; label: string }>>([]);
  const [genreSearching, setGenreSearching] = useState<boolean>(false);
  const [audienceSize, setAudienceSize] = useState<string>('');
  // Só envia audience_size quando é inteiro positivo (o backend rejeita o resto com 400).
  const audienceSizeNum = /^\d+$/.test(audienceSize.trim()) && parseInt(audienceSize.trim(), 10) > 0
    ? parseInt(audienceSize.trim(), 10)
    : undefined;

  // Paginação
  const [limit] = useState<number>(20);
  const [offset, setOffset] = useState<number>(0);

  // 🔴 FATIA 3B — CONTRATAR: alvo do modal + evento pré-selecionado via navegação do painel do
  // organizador (?eventId= na URL). O modal só abre para serviço com superfície canônica de oferta.
  const [contractTarget, setContractTarget] = useState<DiscoveredService | null>(null);
  const contractEventId = searchParams.get('eventId');

  // 🔵 F-SERVICE-DISCOVERY-SEARCH-FRONTEND-WIRING: busca por TERMO de ocupação.
  // O frontend só projeta a verdade resolvida pelo backend (termo→concept via ponte advisory).
  const [term, setTerm] = useState<string>('');
  const [termSearched, setTermSearched] = useState<boolean>(false);
  const [termLoading, setTermLoading] = useState<boolean>(false);
  const [termError, setTermError] = useState<string | null>(null);
  const [termResult, setTermResult] = useState<ServiceTermSearchResult | null>(null);

  useEffect(() => {
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, cityId, stateId, startDate, endDate, hasAvailability, actorType, genre, audienceSizeNum, offset]);

  // 🔎 F-GLOBAL-SEARCH-DEADEND-REWIRE-SLICE-A: consome o termo vindo da URL (?term=) — a busca do header
  // global / marketplace agora aponta para cá. Preenche o campo e dispara a busca real de serviços no mount,
  // sem exigir redigitar. Termo explícito evita corrida com o setState (o backend resolve termo→concept).
  useEffect(() => {
    const urlTerm = (searchParams.get('term') || '').trim();
    if (urlTerm) {
      setTerm(urlTerm);
      void handleTermSearch(undefined, urlTerm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const loadServices = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters: ServiceDiscoveryFilters = {
        category_id: categoryId || undefined,
        city_id: cityId || undefined,
        state_id: stateId || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        has_availability: hasAvailability || undefined,
        actor_type: actorType ? (actorType as 'user' | 'page' | 'group' | 'channel') : undefined,
        subject_concept_id: genre?.conceptId || undefined,
        audience_size: audienceSizeNum,
        limit,
        offset,
      };

      const data = await discoverServices(filters);
      setServices(data);
      setTotalCount(data.length);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar serviços');
      showToast(err.message || 'Erro ao buscar serviços', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Busca por termo: chama GET /services/search-by-term e projeta o resultado resolvido.
  // O termo NÃO é normalizado/mapeado aqui — quem resolve termo→concept é o backend.
  const handleTermSearch = async (e?: FormEvent, explicitTerm?: string) => {
    if (e) e.preventDefault();
    const trimmed = (explicitTerm ?? term).trim();
    if (!trimmed) {
      setTermSearched(false);
      setTermResult(null);
      setTermError(null);
      return;
    }

    setTermSearched(true);
    setTermLoading(true);
    setTermError(null);

    try {
      const data = await searchServicesByTerm(trimmed, cityId.trim() || undefined);
      setTermResult(data);
    } catch (err: any) {
      setTermError(err.message || 'Erro ao buscar serviços por termo');
      setTermResult(null);
      showToast(err.message || 'Erro ao buscar serviços por termo', 'error');
    } finally {
      setTermLoading(false);
    }
  };

  const clearTermSearch = () => {
    setTerm('');
    setTermSearched(false);
    setTermResult(null);
    setTermError(null);
  };

  const clearFilters = () => {
    setCategoryId('');
    setCityId('');
    setStateId('');
    setStartDate('');
    setEndDate('');
    setHasAvailability(false);
    setActorType('');
    setGenre(null);
    setGenreQ('');
    setGenreResults([]);
    setAudienceSize('');
    setOffset(0);
  };

  // Busca de gênero no pool GOVERNADO (searchEventThemes → GET /api/events/themes/search).
  const handleGenreSearch = async () => {
    if (genreQ.trim().length < 2) {
      showToast('Digite ao menos 2 letras para buscar gênero.', 'error');
      return;
    }
    setGenreSearching(true);
    try {
      const themes = await searchEventThemes(genreQ);
      setGenreResults(themes.map((t) => ({ conceptId: t.conceptId, label: t.label })));
      if (themes.length === 0) showToast('Nenhum gênero encontrado para essa busca.', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao buscar gêneros.', 'error');
    } finally {
      setGenreSearching(false);
    }
  };

  const selectGenre = (g: { conceptId: string; label: string }) => {
    setGenre(g);
    setGenreResults([]);
    setGenreQ('');
    setOffset(0);
  };

  const handleNextPage = () => {
    setOffset(prev => prev + limit);
  };

  const handlePrevPage = () => {
    setOffset(prev => Math.max(0, prev - limit));
  };

  const formatCurrency = (cents: number | null, currency: string | null): string => {
    if (!cents) return 'A consultar';
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const renderServiceCard = (service: DiscoveredService) => (
    <div
      key={service.serviceId}
      className="service-card"
      onClick={() => navigate(`/discover/services/${service.serviceId}`)}
    >
      <div className="service-card-header">
        <h3 className="service-name">{service.name}</h3>
        {service.availability_summary?.has_availability && (
          <span className="availability-badge">Agenda aberta</span>
        )}
      </div>
      {service.actor && (
        <div className="service-actor">
          Por: {service.actor.display_name || service.actor.actor_id}
        </div>
      )}
      {service.shortDescription && (
        <p className="service-description">{service.shortDescription}</p>
      )}
      {service.priceCents && (
        <div className="service-price">
          {formatCurrency(service.priceCents, service.currency)}
          {service.pricingType && (
            <span className="pricing-type"> / {service.pricingType}</span>
          )}
        </div>
      )}
      {service.cityId && (
        <div className="service-location">
          📍 Localização: {service.cityId}
        </div>
      )}
      {service.availability_summary?.next_available_date && (
        <div className="service-next-availability">
          Próxima disponibilidade: {new Date(service.availability_summary.next_available_date).toLocaleDateString('pt-BR')}
        </div>
      )}
      {/* 🔴 FATIA 3B — CONTRATAR: só para serviço com identidade canônica (ofertas by-canonical).
          stopPropagation para não disparar a navegação do card. A proposta real é o C3 no backend. */}
      {service.canonicalServiceId && (
        <div className="service-card-actions">
          <button
            type="button"
            className="btn-contract"
            onClick={(e) => {
              e.stopPropagation();
              setContractTarget(service);
            }}
          >
            Contratar
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="service-discovery-page">
      <div className="page-header">
        <h1>Descobrir Serviços</h1>
        <p className="page-subtitle">Encontre artistas, bandas e profissionais</p>
      </div>

      <div className="discovery-layout">
        {/* Filtros Laterais */}
        <div className="filters-sidebar">
          <h2>Filtros</h2>

          <div className="filter-section">
            <label htmlFor="category">Categoria:</label>
            <input
              id="category"
              type="text"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="ID da categoria"
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <label htmlFor="city">Cidade:</label>
            <input
              id="city"
              type="text"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              placeholder="ID da cidade"
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <label htmlFor="state">Estado:</label>
            <input
              id="state"
              type="text"
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
              placeholder="ID do estado"
              className="filter-input"
            />
          </div>

          {/* 🔵 SLICE-2B — filtro por GÊNERO governado (typeahead no pool; sem lista hardcoded) */}
          <div className="filter-section">
            <label htmlFor="genre-search">Gênero:</label>
            {genre ? (
              <div className="genre-selected">
                <span className="genre-chip">
                  {genre.label}
                  <button
                    type="button"
                    className="genre-chip-x"
                    onClick={() => setGenre(null)}
                    aria-label="Remover gênero"
                  >
                    ×
                  </button>
                </span>
              </div>
            ) : (
              <>
                <div className="genre-search-row">
                  <input
                    id="genre-search"
                    type="text"
                    value={genreQ}
                    onChange={(e) => setGenreQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleGenreSearch(); } }}
                    placeholder="ex.: rock, samba, funk"
                    className="filter-input"
                  />
                  <button
                    type="button"
                    className="btn-genre-search"
                    onClick={handleGenreSearch}
                    disabled={genreSearching}
                  >
                    {genreSearching ? '…' : 'Buscar'}
                  </button>
                </div>
                {genreResults.length > 0 && (
                  <ul className="genre-results">
                    {genreResults.map((g) => (
                      <li key={g.conceptId}>
                        <button type="button" className="genre-result-item" onClick={() => selectGenre(g)}>
                          {g.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* 🔵 SLICE-2B — filtro por tamanho de público (audience_size: faixa da oferta CONTÉM N) */}
          <div className="filter-section">
            <label htmlFor="audience-size">Evento para quantas pessoas?</label>
            <input
              id="audience-size"
              type="number"
              min={1}
              step={1}
              value={audienceSize}
              onChange={(e) => setAudienceSize(e.target.value)}
              placeholder="ex.: 300"
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <label htmlFor="start-date">Data Início (opcional):</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <label htmlFor="end-date">Data Fim (opcional):</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <label htmlFor="actor-type">Tipo de Actor:</label>
            <select
              id="actor-type"
              value={actorType}
              onChange={(e) => setActorType(e.target.value)}
              className="filter-input"
            >
              <option value="">Todos</option>
              <option value="user">Usuário</option>
              <option value="page">Página</option>
              <option value="group">Grupo</option>
              <option value="channel">Canal</option>
            </select>
          </div>

          <div className="filter-section">
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={hasAvailability}
                onChange={(e) => setHasAvailability(e.target.checked)}
              />
              <span>Agenda aberta (sem data específica)</span>
            </label>
          </div>

          <div className="filter-actions">
            <button onClick={clearFilters} className="btn-clear-filters">
              Limpar Filtros
            </button>
          </div>
        </div>

        {/* Lista de Serviços */}
        <div className="services-content">
          {/* 🔵 Busca por TERMO de ocupação (F-SERVICE-DISCOVERY-SEARCH-FRONTEND-WIRING).
              Projeta a verdade resolvida pelo backend; não cria taxonomia no front. */}
          <form className="term-search-bar" onSubmit={handleTermSearch}>
            <input
              type="text"
              className="term-search-input"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por profissão ou serviço (ex.: cabeleireiro, barbeiro, manicure)"
              aria-label="Buscar serviços por termo"
            />
            <button type="submit" className="btn-term-search">Buscar</button>
            {termSearched && (
              <button type="button" className="btn-term-clear" onClick={clearTermSearch}>
                Limpar busca
              </button>
            )}
          </form>

          {termSearched ? (
            /* ── MODO BUSCA POR TERMO ── */
            termLoading ? (
              <div className="loading">Buscando serviços...</div>
            ) : termError ? (
              <div className="error">
                <p>{termError}</p>
                <button onClick={() => handleTermSearch()}>Tentar novamente</button>
              </div>
            ) : termResult && termResult.results.length > 0 ? (
              <>
                <div className="results-header">
                  <span className="results-count">
                    {termResult.results.length}{' '}
                    {termResult.results.length === 1 ? 'serviço encontrado' : 'serviços encontrados'}
                    {' '}para “{termResult.term}”
                  </span>
                </div>
                <div className="services-grid">
                  {termResult.results.map((service) => renderServiceCard(service))}
                </div>
              </>
            ) : termResult && termResult.conceptIds.length > 0 ? (
              /* Vazio honesto: o termo resolveu para categoria/serviço, mas não há oferta ativa. */
              <div className="empty-state empty-state--has-concept">
                <p>
                  Encontramos a categoria/serviço, mas ainda não há ofertas ativas para
                  “{termResult.term}” na sua região.
                </p>
                <p className="empty-hint">
                  Assim que um profissional publicar uma oferta para este serviço, ela aparece aqui.
                </p>
              </div>
            ) : (
              /* Vazio honesto: termo desconhecido (sem ponte de busca para ele ainda). */
              <div className="empty-state">
                <p>Não encontramos esse termo na busca.</p>
                <p className="empty-hint">
                  Tente outro termo de profissão ou serviço (ex.: cabeleireiro, barbeiro, manicure).
                </p>
              </div>
            )
          ) : isLoading ? (
            <div className="loading">Carregando serviços...</div>
          ) : error ? (
            <div className="error">
              <p>{error}</p>
              <button onClick={loadServices}>Tentar novamente</button>
            </div>
          ) : services.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum serviço encontrado.</p>
              <p className="empty-hint">
                Tente ajustar os filtros para encontrar mais resultados.
              </p>
            </div>
          ) : (
            <>
              <div className="results-header">
                <span className="results-count">
                  {totalCount} {totalCount === 1 ? 'serviço encontrado' : 'serviços encontrados'}
                </span>
              </div>
              <div className="services-grid">
                {services.map((service) => renderServiceCard(service))}
              </div>

              {/* Paginação */}
              <div className="pagination">
                <button
                  onClick={handlePrevPage}
                  disabled={offset === 0}
                  className="btn-pagination"
                >
                  Anterior
                </button>
                <span className="pagination-info">
                  Página {Math.floor(offset / limit) + 1}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={services.length < limit}
                  className="btn-pagination"
                >
                  Próxima
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 🔴 FATIA 3B — modal CONTRATAR (proposta orquestrada C3; resultado honesto do backend) */}
      {contractTarget?.canonicalServiceId && (
        <ContractPerformerModal
          canonicalServiceId={contractTarget.canonicalServiceId}
          serviceName={contractTarget.name}
          preselectedEventId={contractEventId}
          onClose={() => setContractTarget(null)}
        />
      )}
    </div>
  );
}
