// src/components/events/EventOrganizerPanel.tsx
// Painel do ORGANIZADOR na página do evento — projeta as capacidades seladas do event-core:
//   · Local (S2 venue enrichment): location_name + endereço via Location Core (cityId por CEP, nunca texto)
//   · Vaquinha (S1): event_access_type + meta (min_attendees) + prazo (funding_deadline_at) + all-or-nothing
//   · Setores (S3): catálogo declarado inteira/meia com piso legal 40% (Lei 12.933/2013)
// 🔴 FRONTEND NUNCA CRIA VERDADE: a exibição owner-only aqui é HINT de UX; a autoridade real é o backend
// (manage_events/create_events exatos, DECISION-0189A — 403 fail-closed). Regras de vaquinha/setor são
// espelhadas como dica; o 400 do backend (VAQUINHA_* / SECTOR_*) é quem decide, traduzido em toast pt-BR.
// Δbank=0: preços/metas são valores DECLARADOS de catálogo; dinheiro real = PORTA-01, FORA.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getEventById,
  updateEvent,
  listEventSectors,
  createEventSector,
  type EventSector,
  type UpdateEventInput,
} from '../../api/events';
import { resolveCep } from '../../api/location';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { showToast } from '../../utils/toast';
import './EventOrganizerPanel.css';

interface EventOrganizerPanelProps {
  eventId: string;
}

/**
 * Shape REAL do GET /api/events/:id (event-core, event.service.toEvent) — camelCase.
 * (O tipo declarado em EventResponse é snake_case legado; o payload vivo é este.)
 */
interface OrganizerEventView {
  id: string;
  actorId: string;
  status: string;
  datetimeStart: string | null;
  datetimeEnd: string | null;
  maxAttendees: number | null;
  minAttendees: number | null;
  eventAccessType: 'gratuito' | 'pago' | 'contribuicao_opcional' | null;
  fundingDeadlineAt: string | null;
  isAllOrNothing: boolean;
  metadata: Record<string, unknown> | null;
}

// De-para dos códigos de erro do backend → mensagem amigável pt-BR. O backend é a autoridade:
// aqui só se TRADUZ o que ele decidiu (códigos podem vir em err.code OU no prefixo da message).
const BACKEND_ERROR_MESSAGES: Array<[string, string]> = [
  ['VAQUINHA_ALL_OR_NOTHING_REQUIRES_GOAL', 'Vaquinha tudo-ou-nada exige uma meta de participantes (mínimo de pessoas).'],
  ['VAQUINHA_ACCESS_TYPE_MISMATCH', 'Vaquinha tudo-ou-nada só é válida em evento de contribuição opcional.'],
  ['VAQUINHA_DEADLINE_AFTER_START', 'O prazo da vaquinha deve terminar até o início do evento (nunca depois).'],
  ['VAQUINHA_DEADLINE_INVALID', 'O prazo da vaquinha não é uma data/hora válida.'],
  ['SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR', 'A cota de meia-entrada deve ficar entre 40% (mínimo legal — Lei 12.933/2013) e 100%.'],
  ['SECTOR_MEIA_PRICE_EXCEEDS_INTEIRA', 'O preço da meia-entrada não pode ser maior que o da inteira.'],
  ['SECTOR_CAPACITY_EXCEEDS_EVENT', 'A soma das capacidades dos setores excede a capacidade máxima do evento.'],
  ['EVENT_SECTOR_ACTOR_NOT_AUTHORIZED', 'Você não tem permissão para criar setores neste evento.'],
];

function friendlyError(err: unknown, fallback: string): string {
  const e = err as { code?: string; message?: string } | null;
  const raw = `${e?.code ?? ''} ${e?.message ?? ''}`;
  for (const [token, msg] of BACKEND_ERROR_MESSAGES) {
    if (raw.includes(token)) return msg;
  }
  return e?.message || fallback;
}

/** ISO → valor de <input type="datetime-local"> no fuso local. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "12,50" / "12.50" (reais) → cents inteiros; null se vazio/inválido. */
function reaisToCents(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = parseFloat(t.replace(',', '.'));
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function centsToReais(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export default function EventOrganizerPanel({ eventId }: EventOrganizerPanelProps) {
  const { activeActor } = useActiveActor();
  const navigate = useNavigate();

  const [event, setEvent] = useState<OrganizerEventView | null>(null);
  const [sectors, setSectors] = useState<EventSector[]>([]);

  // --- Local (S2)
  const [locationName, setLocationName] = useState('');
  const [venueCep, setVenueCep] = useState('');
  const [venueCityId, setVenueCityId] = useState<string | null>(null);
  const [venueCityLabel, setVenueCityLabel] = useState('');
  const [venueNeighborhoodDisplay, setVenueNeighborhoodDisplay] = useState<string | null>(null);
  const [venueStreet, setVenueStreet] = useState('');
  const [venueNumber, setVenueNumber] = useState('');
  const [venueComplement, setVenueComplement] = useState('');
  const [resolvingCep, setResolvingCep] = useState(false);
  const [savingLocal, setSavingLocal] = useState(false);

  // --- Vaquinha (S1)
  const [accessType, setAccessType] = useState<'' | 'gratuito' | 'pago' | 'contribuicao_opcional'>('');
  const [minAttendees, setMinAttendees] = useState('');
  const [fundingDeadline, setFundingDeadline] = useState('');
  const [isAllOrNothing, setIsAllOrNothing] = useState(false);
  const [savingVaquinha, setSavingVaquinha] = useState(false);

  // --- Setores (S3)
  const [sectorNumber, setSectorNumber] = useState('');
  const [sectorName, setSectorName] = useState('');
  const [sectorCapacity, setSectorCapacity] = useState('');
  const [sectorInteira, setSectorInteira] = useState('');
  const [sectorMeia, setSectorMeia] = useState('');
  const [sectorQuotaPct, setSectorQuotaPct] = useState('40');
  const [creatingSector, setCreatingSector] = useState(false);

  const loadSectors = useCallback(async () => {
    try {
      const list = await listEventSectors(eventId);
      setSectors(Array.isArray(list) ? list : []);
    } catch {
      // GET é canViewEvent-gated (404 não-leak) — silencioso, não crítico para o resto do painel.
      setSectors([]);
    }
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getEventById(eventId);
        // Payload vivo do event-core é camelCase (toEvent); o tipo declarado é legado snake_case.
        const ev = res.event as unknown as OrganizerEventView;
        if (cancelled || !ev?.id) return;
        setEvent(ev);
        // Pré-preenchimento com a verdade resolvida do backend
        const meta = (ev.metadata ?? {}) as { location_name?: unknown };
        setLocationName(typeof meta.location_name === 'string' ? meta.location_name : '');
        setAccessType(ev.eventAccessType ?? '');
        setMinAttendees(ev.minAttendees != null ? String(ev.minAttendees) : '');
        setFundingDeadline(isoToLocalInput(ev.fundingDeadlineAt));
        setIsAllOrNothing(!!ev.isAllOrNothing);
      } catch {
        if (!cancelled) setEvent(null);
      }
    };
    load();
    loadSectors();
    return () => { cancelled = true; };
  }, [eventId, loadSectors]);

  // Owner-only como HINT de UX (a autoridade real — manage_events/create_events — é do backend).
  if (!event || !activeActor || activeActor.actor_id !== event.actorId) {
    return null;
  }

  const usedCapacity = sectors.reduce((sum, s) => sum + s.capacity, 0);
  const remainingCapacity = event.maxAttendees != null ? event.maxAttendees - usedCapacity : null;
  const nextSectorNumber = sectors.length > 0 ? Math.max(...sectors.map((s) => s.sectorNumber)) + 1 : 1;

  const onVenueCepChange = async (raw: string) => {
    setVenueCep(raw);
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 8) {
      setResolvingCep(true);
      try {
        const r = await resolveCep(digits);
        if (r?.resolved && r.cityId) {
          setVenueCityId(r.cityId);
          setVenueCityLabel(`${r.cityName}${r.stateUf ? ' / ' + r.stateUf : ''}`);
          setVenueNeighborhoodDisplay(r.neighborhoodDisplay ?? null);
          if (r.street && !venueStreet.trim()) setVenueStreet(r.street);
        }
      } finally {
        setResolvingCep(false);
      }
    }
  };

  const handleSaveLocal = async () => {
    setSavingLocal(true);
    try {
      const patch: UpdateEventInput = {
        location_name: locationName.trim() || null,
      };
      // O backend só grava endereço (address_assignments) quando venue_city_id vem preenchido —
      // cidade GOVERNADA pelo Location Core (via CEP), nunca texto livre.
      if (venueCityId) {
        patch.venue_city_id = venueCityId;
        patch.venue_postal_code = venueCep.trim() || null;
        patch.venue_neighborhood_display = venueNeighborhoodDisplay;
        patch.venue_street = venueStreet.trim() || null;
        patch.venue_number = venueNumber.trim() || null;
        patch.venue_complement = venueComplement.trim() || null;
      }
      await updateEvent(eventId, patch);
      showToast('Local salvo', 'success');
    } catch (err) {
      showToast(friendlyError(err, 'Erro ao salvar o local'), 'error');
    } finally {
      setSavingLocal(false);
    }
  };

  const handleSaveVaquinha = async () => {
    // Dicas client-side espelham as regras do backend; a DECISÃO é o 400 dele (VAQUINHA_*).
    setSavingVaquinha(true);
    try {
      const min = minAttendees.trim() ? parseInt(minAttendees, 10) : null;
      await updateEvent(eventId, {
        event_access_type: accessType || null,
        min_attendees: min,
        funding_deadline_at: fundingDeadline ? new Date(fundingDeadline).toISOString() : null,
        is_all_or_nothing: accessType === 'contribuicao_opcional' ? isAllOrNothing : false,
      });
      showToast('Configuração de acesso/vaquinha salva', 'success');
      const res = await getEventById(eventId);
      setEvent(res.event as unknown as OrganizerEventView);
    } catch (err) {
      showToast(friendlyError(err, 'Erro ao salvar a vaquinha'), 'error');
    } finally {
      setSavingVaquinha(false);
    }
  };

  const handleCreateSector = async () => {
    const num = sectorNumber.trim() ? parseInt(sectorNumber, 10) : nextSectorNumber;
    const cap = sectorCapacity.trim() ? parseInt(sectorCapacity, 10) : NaN;
    const inteira = reaisToCents(sectorInteira);
    const meia = reaisToCents(sectorMeia);
    const quotaPct = sectorQuotaPct.trim() ? parseFloat(sectorQuotaPct.replace(',', '.')) : 40;

    if (!sectorName.trim()) { showToast('Informe o nome do setor', 'error'); return; }
    if (isNaN(cap) || cap < 1) { showToast('Informe a capacidade do setor (mínimo 1)', 'error'); return; }
    if (inteira == null) { showToast('Informe o preço da inteira (R$)', 'error'); return; }
    if (meia == null) { showToast('Informe o preço da meia (R$)', 'error'); return; }

    setCreatingSector(true);
    try {
      await createEventSector(eventId, {
        sectorNumber: num,
        name: sectorName.trim(),
        capacity: cap,
        meiaQuotaBps: Math.round(quotaPct * 100), // % × 100 = bps (40% → 4000)
        inteiraPriceCents: inteira,
        meiaPriceCents: meia,
      });
      showToast('Setor criado', 'success');
      setSectorNumber('');
      setSectorName('');
      setSectorCapacity('');
      setSectorInteira('');
      setSectorMeia('');
      setSectorQuotaPct('40');
      await loadSectors();
    } catch (err) {
      showToast(friendlyError(err, 'Erro ao criar setor'), 'error');
    } finally {
      setCreatingSector(false);
    }
  };

  const isContribuicao = accessType === 'contribuicao_opcional';

  return (
    <div className="event-organizer-panel">
      <h2 className="event-organizer-panel-title">🛠️ Gestão do organizador</h2>

      {/* ============ LOCAL ============ */}
      <section className="organizer-section">
        <h3 className="organizer-section-title">📍 Local</h3>
        <div className="organizer-form-grid">
          <label className="organizer-field organizer-field-wide">
            <span>Nome do local</span>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Ex.: Teatro Guaíra"
            />
          </label>
          <label className="organizer-field">
            <span>CEP (define a cidade)</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={9}
              value={venueCep}
              onChange={(e) => onVenueCepChange(e.target.value)}
              placeholder="Ex.: 80010-000"
            />
          </label>
          <label className="organizer-field organizer-field-wide">
            <span>Rua / logradouro</span>
            <input
              type="text"
              value={venueStreet}
              onChange={(e) => setVenueStreet(e.target.value)}
              placeholder="Ex.: Rua XV de Novembro"
            />
          </label>
          <label className="organizer-field organizer-field-small">
            <span>Número</span>
            <input
              type="text"
              value={venueNumber}
              onChange={(e) => setVenueNumber(e.target.value)}
              placeholder="Ex.: 971"
            />
          </label>
          <label className="organizer-field">
            <span>Complemento</span>
            <input
              type="text"
              value={venueComplement}
              onChange={(e) => setVenueComplement(e.target.value)}
              placeholder="Ex.: Sala 2"
            />
          </label>
        </div>
        {resolvingCep && <p className="organizer-hint">Resolvendo cidade…</p>}
        {venueCityId && (
          <p className="organizer-hint">
            📍 {venueCityLabel}{venueNeighborhoodDisplay ? ` · ${venueNeighborhoodDisplay}` : ''}
          </p>
        )}
        <p className="organizer-hint organizer-hint-muted">
          A cidade vem do Location Core via CEP (verdade territorial) — sem CEP resolvido, só o nome do local é salvo.
          O endereço já gravado não é reexibido aqui (leitura do endereço do evento ainda não tem endpoint).
        </p>
        <button
          className="organizer-button organizer-button-primary"
          onClick={handleSaveLocal}
          disabled={savingLocal}
        >
          {savingLocal ? 'Salvando…' : 'Salvar local'}
        </button>
      </section>

      {/* ============ VAQUINHA ============ */}
      <section className="organizer-section">
        <h3 className="organizer-section-title">🤝 Acesso e vaquinha</h3>
        <div className="organizer-form-grid">
          <label className="organizer-field">
            <span>Tipo de acesso</span>
            <select value={accessType} onChange={(e) => setAccessType(e.target.value as typeof accessType)}>
              <option value="">— não definido —</option>
              <option value="gratuito">Gratuito</option>
              <option value="pago">Pago</option>
              <option value="contribuicao_opcional">Contribuição opcional</option>
            </select>
          </label>
          <label className="organizer-field">
            <span>Meta / mínimo de participantes</span>
            <input
              type="number"
              min={1}
              value={minAttendees}
              onChange={(e) => setMinAttendees(e.target.value)}
              placeholder="Ex.: 30"
            />
          </label>
          {isContribuicao && (
            <>
              <label className="organizer-field">
                <span>Prazo da vaquinha</span>
                <input
                  type="datetime-local"
                  value={fundingDeadline}
                  onChange={(e) => setFundingDeadline(e.target.value)}
                />
              </label>
              <label className="organizer-field organizer-field-checkbox">
                <input
                  type="checkbox"
                  checked={isAllOrNothing}
                  onChange={(e) => setIsAllOrNothing(e.target.checked)}
                />
                <span>Vaquinha tudo-ou-nada (só acontece se bater a meta)</span>
              </label>
            </>
          )}
        </div>
        {isContribuicao && (
          <p className="organizer-hint organizer-hint-muted">
            Tudo-ou-nada exige a meta de participantes, e o prazo da vaquinha deve terminar até o início do evento.
            A meta é em PESSOAS — sem movimentação de dinheiro nesta etapa.
          </p>
        )}
        {!isContribuicao && isAllOrNothing && (
          <p className="organizer-hint organizer-hint-warn">
            Vaquinha tudo-ou-nada só é válida com acesso "Contribuição opcional" — ao salvar, o modo tudo-ou-nada será desligado.
          </p>
        )}
        <button
          className="organizer-button organizer-button-primary"
          onClick={handleSaveVaquinha}
          disabled={savingVaquinha}
        >
          {savingVaquinha ? 'Salvando…' : 'Salvar acesso/vaquinha'}
        </button>
      </section>

      {/* ============ SETORES ============ */}
      <section className="organizer-section">
        <h3 className="organizer-section-title">🎟️ Setores (inteira / meia-entrada)</h3>

        {sectors.length > 0 ? (
          <div className="organizer-sectors-table-wrap">
            <table className="organizer-sectors-table">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Nome</th>
                  <th>Capacidade</th>
                  <th>Inteira</th>
                  <th>Meia</th>
                  <th>Cota de meia</th>
                </tr>
              </thead>
              <tbody>
                {sectors.map((s) => (
                  <tr key={s.id}>
                    <td>{s.sectorNumber}</td>
                    <td>{s.name}</td>
                    <td>{s.capacity}</td>
                    <td>{centsToReais(s.inteiraPriceCents)}</td>
                    <td>{centsToReais(s.meiaPriceCents)}</td>
                    <td>{(s.meiaQuotaBps / 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="organizer-hint">Nenhum setor criado ainda.</p>
        )}

        <p className="organizer-hint">
          {event.maxAttendees != null ? (
            <>
              Capacidade dos setores: <strong>{usedCapacity}</strong> de <strong>{event.maxAttendees}</strong>
              {remainingCapacity != null && remainingCapacity >= 0 && <> · restam <strong>{remainingCapacity}</strong></>}
            </>
          ) : (
            <>Evento sem capacidade máxima declarada — setores sem teto a reconciliar.</>
          )}
        </p>

        <div className="organizer-form-grid">
          <label className="organizer-field organizer-field-small">
            <span>Número</span>
            <input
              type="number"
              min={1}
              value={sectorNumber}
              onChange={(e) => setSectorNumber(e.target.value)}
              placeholder={String(nextSectorNumber)}
            />
          </label>
          <label className="organizer-field">
            <span>Nome do setor</span>
            <input
              type="text"
              value={sectorName}
              onChange={(e) => setSectorName(e.target.value)}
              placeholder="Ex.: Pista"
            />
          </label>
          <label className="organizer-field organizer-field-small">
            <span>Capacidade</span>
            <input
              type="number"
              min={1}
              value={sectorCapacity}
              onChange={(e) => setSectorCapacity(e.target.value)}
              placeholder="Ex.: 200"
            />
          </label>
          <label className="organizer-field organizer-field-small">
            <span>Preço inteira (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              value={sectorInteira}
              onChange={(e) => setSectorInteira(e.target.value)}
              placeholder="Ex.: 80,00"
            />
          </label>
          <label className="organizer-field organizer-field-small">
            <span>Preço meia (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              value={sectorMeia}
              onChange={(e) => setSectorMeia(e.target.value)}
              placeholder="Ex.: 40,00"
            />
          </label>
          <label className="organizer-field organizer-field-small">
            <span>Cota de meia (%)</span>
            <input
              type="number"
              min={40}
              max={100}
              value={sectorQuotaPct}
              onChange={(e) => setSectorQuotaPct(e.target.value)}
            />
          </label>
        </div>
        <p className="organizer-hint organizer-hint-muted">
          Cota de meia-entrada: mínimo legal 40% — Lei 12.933/2013. A meia não pode custar mais que a inteira,
          e a soma das capacidades dos setores não pode passar da capacidade máxima do evento.
        </p>
        <button
          className="organizer-button organizer-button-primary"
          onClick={handleCreateSector}
          disabled={creatingSector}
        >
          {creatingSector ? 'Criando…' : 'Criar setor'}
        </button>
      </section>

      {/* ============ CONTRATAR (FATIA 3B) ============ */}
      {/* Leva o organizador à descoberta com o eventId no query (?eventId=) — o modal CONTRATAR da
          descoberta pré-seleciona este evento na proposta orquestrada (C3). Navegação pura, sem writer. */}
      <section className="organizer-section">
        <h3 className="organizer-section-title">🎸 Elenco / atrações</h3>
        <p className="organizer-hint">
          Encontre bandas, artistas e serviços e envie uma proposta de contratação já amarrada a este evento.
        </p>
        <button
          className="organizer-button organizer-button-primary"
          onClick={() => navigate(`/discover/services?eventId=${encodeURIComponent(eventId)}`)}
        >
          Contratar banda / serviços →
        </button>
      </section>
    </div>
  );
}
