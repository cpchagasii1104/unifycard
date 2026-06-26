// src/pages/ServiceCreatePage.tsx
// GAP-1 / F-MVP-SERVICE-CHAIN-FRONTEND-WIRING (Opção A).
// O MEMBRO operando-como-a-empresa (company_users / canRepresentActor) publica a cadeia vendável mínima:
//   serviço canônico (catálogo governado) → service (provider = actor ativo) → oferta → ativação → 1 janela.
// Disciplina: frontend PROJETA verdade resolvida. O provider é o ACTOR ATIVO de sessão (não input/hardcode);
// o backend liga actionContext + canRepresentActor. SEM dinheiro/checkout/split — só catálogo + agenda.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { showToast } from '../components/common/Toast';
import { searchCanonicalServices, type CanonicalService } from '../api/canonical-services';
import { createService } from '../api/services';
import { createOffering, activateOffering, declareOfferingAvailability } from '../api/offerings';
import './ServiceCreatePage.css';

export default function ServiceCreatePage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CanonicalService[]>([]);
  const [canonical, setCanonical] = useState<CanonicalService | null>(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setError(null);
    setSearching(true);
    try {
      const data = await searchCanonicalServices(query);
      setResults(data);
      if (data.length === 0) setError('Nenhum serviço canônico encontrado para esse termo.');
    } catch (err) {
      console.error('[ServiceCreate] erro ao buscar serviços canônicos:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível buscar serviços canônicos. Tente novamente.');
    } finally {
      setSearching(false);
    }
  };

  const pickCanonical = (c: CanonicalService) => {
    setCanonical(c);
    setResults([]);
    if (!name) setName(c.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!activeActor) {
      setError('Sessão sem actor ativo — escolha o perfil da empresa para publicar.');
      return;
    }
    if (!canonical) {
      setError('Escolha um serviço canônico primeiro.');
      return;
    }
    const priceCents = Math.round(parseFloat(price.replace(',', '.')) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError('Preço inválido.');
      return;
    }
    const duration = parseInt(durationMinutes, 10);
    if (!Number.isInteger(duration) || duration <= 0) {
      setError('Duração inválida.');
      return;
    }
    if (!startLocal || !endLocal) {
      setError('Informe início e fim da janela de disponibilidade.');
      return;
    }
    const startDatetime = new Date(startLocal).toISOString();
    const endDatetime = new Date(endLocal).toISOString();
    if (new Date(endDatetime) <= new Date(startDatetime)) {
      setError('O fim da janela deve ser depois do início.');
      return;
    }

    setSubmitting(true);
    try {
      setStep('Criando serviço…');
      const service = await createService({
        actorId: activeActor.actor_id,
        name: name.trim() || canonical.name,
        serviceType: 'service',
        status: 'active',
        canonicalServiceId: canonical.id,
      });

      setStep('Criando oferta…');
      const offering = await createOffering({
        providerActorId: activeActor.actor_id,
        canonicalServiceId: canonical.id,
        priceCents,
        durationMinutes: duration,
      });

      setStep('Ativando oferta…');
      await activateOffering(offering.id);

      setStep('Publicando disponibilidade…');
      await declareOfferingAvailability(offering.id, { startDatetime, endDatetime });

      showToast('Serviço publicado com oferta e agenda.', 'success');
      navigate(`/discover/services/${service.id}`);
    } catch (err) {
      console.error('[ServiceCreate] erro ao publicar serviço:', err);
      const message = err instanceof Error ? err.message : 'Não foi possível publicar o serviço. Tente novamente.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
      setStep(null);
    }
  };

  return (
    <div className="service-create-page">
      <div className="page-header">
        <h1>Publicar serviço</h1>
        <button className="btn-secondary" onClick={() => navigate('/provider/services')}>
          Central do prestador
        </button>
      </div>

      <p className="acting-as">
        Operando como:{' '}
        <strong>{activeActor ? activeActor.display_name : '— escolha um perfil —'}</strong>
      </p>

      <section className="canonical-picker">
        <h2>1. Serviço canônico</h2>
        {canonical ? (
          <div className="canonical-chosen">
            <span>✓ {canonical.name}</span>
            <button type="button" className="btn-link" onClick={() => setCanonical(null)}>
              trocar
            </button>
          </div>
        ) : (
          <>
            <div className="search-row">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: corte de cabelo, manutenção…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />
              <button type="button" onClick={handleSearch} disabled={searching}>
                {searching ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
            {results.length > 0 && (
              <ul className="canonical-results">
                {results.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => pickCanonical(c)}>
                      {c.name}
                      {c.slug ? <span className="slug"> · {c.slug}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <form className="offer-form" onSubmit={handleSubmit}>
        <h2>2. Oferta e agenda</h2>

        <label>
          Nome do serviço
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome exibido ao cliente"
          />
        </label>

        <div className="form-row">
          <label>
            Preço (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0,00"
              required
            />
          </label>
          <label>
            Duração (min)
            <input
              type="number"
              min="1"
              step="1"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Início da janela
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              required
            />
          </label>
          <label>
            Fim da janela
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              required
            />
          </label>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        {step && <p className="form-step" role="status">{step}</p>}

        <button type="submit" className="btn-primary" disabled={submitting || !canonical || !activeActor}>
          {submitting ? 'Publicando…' : 'Publicar serviço'}
        </button>
      </form>
    </div>
  );
}
