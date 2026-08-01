// src/components/events/EventOrganizerPanel.tsx
// Painel do ORGANIZADOR na página do evento — projeta as capacidades seladas do event-core:
//   · Local (S2 venue enrichment): location_name + endereço via Location Core (cityId por CEP, nunca texto)
//   · Vaquinha (S1): event_access_type + meta (min_attendees) + prazo (funding_deadline_at) + all-or-nothing
//   · Setores (S3): catálogo declarado inteira/meia com piso legal 40% (Lei 12.933/2013)
// 🔴 FRONTEND NUNCA CRIA VERDADE: a exibição owner-only aqui é HINT de UX; a autoridade real é o backend
// (manage_events/create_events exatos, DECISION-0189A — 403 fail-closed). Regras de vaquinha/setor são
// espelhadas como dica; o 400 do backend (VAQUINHA_* / SECTOR_*) é quem decide, traduzido em toast pt-BR.
// Δbank=0: preços/metas são valores DECLARADOS de catálogo; dinheiro real = PORTA-01, FORA.
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   EVENT_ENGINE_COMPLETION_PLAN.md (fases A-G) + CLAUDE.md §2 ("onde já existe")
// ║ NÃO:     persistir "passo"/"progresso" como estado próprio (2ª verdade sobre o domínio)
// ║ EM VEZ:  computeProgress() deriva SEMPRE de campos já existentes (event/sectors/needs)
// ╚════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getEventById,
  updateEvent,
  listEventSectors,
  createEventSector,
  getOperationalNeeds,
  type EventSector,
  type UpdateEventInput,
  type OperationalNeed,
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
  ticketPriceCents: number | null;
  fundingDeadlineAt: string | null;
  isAllOrNothing: boolean;
  locationMode: 'fixed_place' | 'hybrid' | 'to_be_defined' | null;
  metadata: Record<string, unknown> | null;
}

/** Uma dimensão do ciclo do organizador, no painel de progresso (F-EVENT-ORGANIZER-CONTINUITY). */
type ProgressCategory = 'pronto' | 'faltando' | 'aguardando' | 'nao_implementado' | 'opcional';
interface ProgressItem {
  dimension: string;
  category: ProgressCategory;
  label: string;
}

// De-para dos códigos de erro do backend → mensagem amigável pt-BR. O backend é a autoridade:
// aqui só se TRADUZ o que ele decidiu (códigos podem vir em err.code OU no prefixo da message).
const BACKEND_ERROR_MESSAGES: Array<[string, string]> = [
  ['VAQUINHA_ALL_OR_NOTHING_REQUIRES_GOAL', 'Vaquinha tudo-ou-nada exige uma meta de participantes (mínimo de pessoas).'],
  ['VAQUINHA_ACCESS_TYPE_MISMATCH', 'Vaquinha tudo-ou-nada só é válida em evento de contribuição opcional.'],
  ['VAQUINHA_DEADLINE_AFTER_START', 'O prazo da vaquinha deve terminar até o início do evento (nunca depois).'],
  ['VAQUINHA_DEADLINE_INVALID', 'O prazo da vaquinha não é uma data/hora válida.'],
  ['SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR', 'A cota de meia-entrada deve ficar entre 40% (mínimo legal — Lei 12.933/2013) e 100%.'],
  ['SECTOR_MEIA_PRICE_NOT_HALF', 'O preço da meia-entrada deve ser exatamente a metade do preço da inteira (Lei 12.933/2013).'],
  ['SECTOR_CAPACITY_EXCEEDS_EVENT', 'A soma das capacidades dos setores excede a capacidade máxima do evento.'],
  ['EVENT_SECTOR_ACTOR_NOT_AUTHORIZED', 'Você não tem permissão para criar setores neste evento.'],
  ['EVENT_MAX_ATTENDEES_BELOW_SECTOR_CAPACITY', 'A capacidade máxima do evento não pode ficar abaixo da soma das capacidades dos setores já criados.'],
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
  const [operationalNeeds, setOperationalNeeds] = useState<OperationalNeed[]>([]);

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
  // Preço da meia NÃO é estado editável — é DERIVADO (auto-computado, read-only) do preço da inteira
  // (ver sectorMeiaCentsDerived, BUG E1: a meia tem que ser a METADE EXATA — Lei 12.933/2013).
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

  // Reusa a MESMA leitura que o wizard já usa (Step5OperationalRoles) — não inventa endpoint novo,
  // só liga a leitura ao painel de progresso (F-EVENT-ORGANIZER-CONTINUITY item 5).
  const loadOperationalNeeds = useCallback(async () => {
    try {
      const needs = await getOperationalNeeds(eventId);
      setOperationalNeeds(Array.isArray(needs) ? needs : []);
    } catch {
      setOperationalNeeds([]);
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
    loadOperationalNeeds();
    return () => { cancelled = true; };
  }, [eventId, loadSectors, loadOperationalNeeds]);

  // Owner-only como HINT de UX (a autoridade real — manage_events/create_events — é do backend).
  if (!event || !activeActor || activeActor.actor_id !== event.actorId) {
    return null;
  }

  const usedCapacity = sectors.reduce((sum, s) => sum + s.capacity, 0);
  const remainingCapacity = event.maxAttendees != null ? event.maxAttendees - usedCapacity : null;
  const nextSectorNumber = sectors.length > 0 ? Math.max(...sectors.map((s) => s.sectorNumber)) + 1 : 1;

  // F-EVENT-ORGANIZER-CONTINUITY: painel de progresso, 100% DERIVADO (nada persistido como "passo").
  // As 3 categorias-problema não podem se confundir (GATE 2026-08-01):
  //   FALTANDO      → o organizador pode agir AGORA, a leitura só nunca tinha sido ligada de volta.
  //   AGUARDANDO    → depende da PORTA-01 (dinheiro) ou de decisão contida — não é culpa de quem organiza.
  //   NÃO IMPLEMENTADO → fase futura do plano; a tabela/writer simplesmente não existe ainda.
  const computeProgress = (): ProgressItem[] => {
    const meta = (event.metadata ?? {}) as {
      location_name?: unknown;
      declaration?: { desired_time_windows?: unknown[] };
    };
    const items: ProgressItem[] = [];

    // 1. LOCAL — "endereço completo" não é reconferido aqui (sem endpoint, ver aviso na seção Local);
    // o sinal disponível é o nome declarado + o modo escolhido.
    if (event.locationMode === 'to_be_defined') {
      items.push({ dimension: 'Local', category: 'aguardando', label: 'Você decidiu definir depois — não é falta, é adiamento seu' });
    } else if (typeof meta.location_name === 'string' && meta.location_name.trim()) {
      items.push({ dimension: 'Local', category: 'pronto', label: `Nome declarado: "${meta.location_name}" (endereço detalhado não é reconferido nesta tela)` });
    } else {
      items.push({ dimension: 'Local', category: 'faltando', label: 'Nenhum local declarado ainda' });
    }

    // 2. AGENDA — honestidade obrigatória: "declarada candidata", nunca "confirmada" (availability
    // owner_type='event' = 0 linhas hoje; a SSOT temporal real ainda não existe para eventos).
    const windows = meta.declaration?.desired_time_windows;
    if (Array.isArray(windows) && windows.length > 0) {
      items.push({ dimension: 'Agenda', category: 'pronto', label: `${windows.length} janela(s) candidata(s) declarada(s) — ainda NÃO confirmada(s) na agenda oficial` });
    } else {
      items.push({ dimension: 'Agenda', category: 'faltando', label: 'Nenhuma janela de data/hora declarada' });
    }

    // 3. SETORES — opcional por natureza (um evento simples pode nunca precisar).
    if (sectors.length > 0) {
      items.push({ dimension: 'Setores', category: 'pronto', label: `${sectors.length} setor(es) configurado(s)` });
    } else {
      items.push({ dimension: 'Setores', category: 'opcional', label: 'Nenhum setor — opcional, use se o evento tiver preços por área (pista/camarote/etc.)' });
    }

    // 4. VAQUINHA — só se aplica em contribuição opcional; não marcar "faltando" em evento pago/gratuito simples.
    if (event.eventAccessType !== 'contribuicao_opcional') {
      items.push({ dimension: 'Vaquinha', category: 'opcional', label: 'Não se aplica (acesso não é "contribuição opcional")' });
    } else if (event.isAllOrNothing && (!event.fundingDeadlineAt || event.minAttendees == null)) {
      items.push({ dimension: 'Vaquinha', category: 'faltando', label: 'Tudo-ou-nada ativo, mas falta meta de participantes e/ou prazo' });
    } else {
      items.push({ dimension: 'Vaquinha', category: 'pronto', label: event.isAllOrNothing ? 'Tudo-ou-nada configurado com meta e prazo' : 'Contribuição opcional configurada (sem tudo-ou-nada)' });
    }

    // 5. PREÇO — decisão de Clayton (2026-08-01, opção B): ticket_price_cents = "a partir de"; setores
    // detalham. "Resolvido" = tem valor anunciado OU tem setor com preço. Não se aplica a evento gratuito.
    if (event.eventAccessType === 'gratuito') {
      items.push({ dimension: 'Preço', category: 'opcional', label: 'Não se aplica (evento gratuito)' });
    } else if ((event.ticketPriceCents ?? 0) > 0 || sectors.length > 0) {
      items.push({ dimension: 'Preço', category: 'pronto', label: 'Preço resolvido (valor anunciado e/ou setores com preço)' });
    } else {
      items.push({ dimension: 'Preço', category: 'faltando', label: 'Nenhum preço definido (nem valor anunciado, nem setor)' });
    }

    // 6. PERFORMERS/CONTRATAÇÃO — "necessidade declarada" deriva; "contratação fechada" não é
    // derivável hoje (RFQ vive em JSON não-indexável) e o aceite está contido por decisão (R7b).
    if (operationalNeeds.length > 0) {
      items.push({ dimension: 'Performers / contratação', category: 'pronto', label: `${operationalNeeds.length} necessidade(s) declarada(s)` });
    } else {
      items.push({ dimension: 'Performers / contratação', category: 'faltando', label: 'Nenhuma necessidade declarada (banda, som, segurança...)' });
    }
    items.push({ dimension: 'Fechar contratação (aceite de proposta)', category: 'aguardando', label: 'Contido por decisão (R7b) até a porta-01 — não depende de você' });

    // 7. AUDIÊNCIA — visibility sempre tem valor no banco (default 'public'); nunca é "faltando".
    // (audience_relationship_types não é devolvido pela leitura atual do evento — refinamento
    // fica de fora deste painel até essa leitura também ser ligada, fora do escopo desta fatia.)
    items.push({ dimension: 'Audiência / visibilidade', category: 'pronto', label: 'Sempre tem valor (padrão: pública) — nunca fica vazio' });

    // 8. Elenco estruturado — genuinamente não implementado (tipo existe, tabela não).
    items.push({ dimension: 'Elenco / line-up estruturado', category: 'nao_implementado', label: 'Ainda não existe no sistema (event_actors não foi criada) — hoje o vínculo vive em Setores/Contratar' });

    return items;
  };
  const progressItems = computeProgress();
  const PROGRESS_META: Record<ProgressCategory, { icon: string; label: string; className: string }> = {
    pronto: { icon: '✅', label: 'Pronto', className: 'progress-pronto' },
    faltando: { icon: '🔴', label: 'Faltando (você pode agir agora)', className: 'progress-faltando' },
    aguardando: { icon: '🟡', label: 'Aguardando (porta-01 / decisão contida)', className: 'progress-aguardando' },
    nao_implementado: { icon: '⚪', label: 'Não implementado ainda', className: 'progress-nao-implementado' },
    opcional: { icon: '·', label: 'Opcional / não se aplica', className: 'progress-opcional' },
  };

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

  // BUG E1 (Lei 12.933/2013): a meia tem que ser a METADE EXATA da inteira, nunca só "mais barata".
  // O preço da meia NUNCA é digitado — é DERIVADO aqui (floor, consumer-favorável) do preço da inteira,
  // espelhando exatamente o CHECK físico do backend (chk_event_sectors_meia_is_half_inteira:
  // meia_price_cents = inteira_price_cents / 2). Isso torna FISICAMENTE impossível o organizador digitar
  // um valor de meia que não seja a metade exata — o campo é só um DISPLAY read-only.
  const sectorInteiraCents = reaisToCents(sectorInteira);
  const sectorMeiaCentsDerived = sectorInteiraCents != null ? Math.floor(sectorInteiraCents / 2) : null;

  const handleCreateSector = async () => {
    const num = sectorNumber.trim() ? parseInt(sectorNumber, 10) : nextSectorNumber;
    const cap = sectorCapacity.trim() ? parseInt(sectorCapacity, 10) : NaN;
    const inteira = sectorInteiraCents;
    const meia = sectorMeiaCentsDerived;
    const quotaPct = sectorQuotaPct.trim() ? parseFloat(sectorQuotaPct.replace(',', '.')) : 40;

    if (!sectorName.trim()) { showToast('Informe o nome do setor', 'error'); return; }
    if (isNaN(cap) || cap < 1) { showToast('Informe a capacidade do setor (mínimo 1)', 'error'); return; }
    if (inteira == null) { showToast('Informe o preço da inteira (R$)', 'error'); return; }
    if (meia == null) { showToast('Informe o preço da inteira (R$) para derivar a meia', 'error'); return; }

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

      {/* ============ PROGRESSO ============ */}
      <section className="organizer-section organizer-progress-section">
        <h3 className="organizer-section-title">📊 Progresso do evento</h3>
        <ul className="organizer-progress-list">
          {progressItems.map((item, idx) => {
            const meta = PROGRESS_META[item.category];
            return (
              <li key={idx} className={`organizer-progress-item ${meta.className}`}>
                <span className="organizer-progress-icon" aria-hidden="true">{meta.icon}</span>
                <span className="organizer-progress-dimension">{item.dimension}</span>
                <span className="organizer-progress-status">{meta.label}</span>
                <span className="organizer-progress-detail">{item.label}</span>
              </li>
            );
          })}
        </ul>
        <p className="organizer-hint organizer-hint-muted">
          🔴 Faltando = você pode agir agora. 🟡 Aguardando = depende da porta-01 (dinheiro) ou de
          decisão já contida — não é algo que falta você fazer. ⚪ Não implementado = fase futura do
          sistema, ainda não existe.
        </p>
      </section>

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
            <span>Preço meia (R$) — metade exata, automático</span>
            <input
              type="text"
              value={sectorMeiaCentsDerived != null ? centsToReais(sectorMeiaCentsDerived) : ''}
              readOnly
              disabled
              placeholder="Informe a inteira ao lado"
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
          Cota de meia-entrada: mínimo legal 40% — Lei 12.933/2013. O preço da meia é sempre EXATAMENTE
          a metade do preço da inteira (calculado automaticamente, arredondado para baixo em favor do
          consumidor quando a inteira for um valor ímpar de centavos), e a soma das capacidades dos
          setores não pode passar da capacidade máxima do evento.
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
