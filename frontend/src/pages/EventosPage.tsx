// src/pages/EventosPage.tsx
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — a VITRINE de eventos (descoberta), com as duas faces do modo operante
// ║ NORMA:   "a verdade vive no backend" (Clayton) · "Modo operante prioriza, NÃO esconde"
// ║          (operatingMode.ts:9) · precedente de modo que troca conteúdo = RentalResourceListPage
// ║ NÃO:     NÃO filtrar status/visibilidade aqui (o piso é do servidor); NÃO reconstruir evento a
// ║          partir de post de feed; NÃO afirmar status que não foi lido.
// ║ EM VEZ:  listPublicEvents() → rota canônica sprint76, que aplica `public_discovery` server-side.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ 2026-08-04 — POR QUE ESTA TELA FOI REESCRITA ═══
// 🔴 A vitrine mostrava "Nenhum evento encontrado" SEMPRE, e não era falta de evento: ela lia
// `getUnifiedFeed()` → `/api/feed`, endpoint **APOSENTADO**, que responde:
//     {"error":"Legacy feed endpoint retired. Use the canonical GET /social/feed (social 2.0)."}
// e o erro era ENGOLIDO por um `.catch(() => ({ items: [] }))`, com o comentário culpando uma
// dívida de schema antiga. Falha muda: 200 lógico com lista vazia, para sempre, sem ninguém saber.
// Medido com curl na rota real antes de trocar — 6 eventos publicados existiam e nenhum chegava.
//
// 🔴 E a tela FABRICAVA status: `status: 'published'` hardcoded para post com linked_event, e
// `metadata.status || 'published'` para intent=event. Afirmava o que nunca leu, violando
// "frontend nunca cria verdade" e "zero é afirmação; desconhecido é a verdade". Some junto com a
// leitura de feed — agora todo evento vem da rota de evento, com status REAL.
//
// ═══ AS DUAS FACES (desenho de Clayton, 2026-08-04) ═══
//   CONSUMIR → vitrine: o que está acontecendo e eu posso ir
//   OPERAR   → produzir: a porta de criar e gerir
// O modo troca CONTEÚDO (padrão RentalResourceListPage), não só rótulo. E como "prioriza, não
// esconde", cada face carrega o convite explícito para a outra — nunca um beco.

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { useOperatingMode } from '../hooks/useOperatingMode';
import {
  listPublicEvents, getEventTaxonomy,
  type Event, type EventTaxonomy, type PublicEventFilters,
} from '../api/events';
import { validateActiveActor } from '../utils/guardrails';
import './EventosPage.css';

/** Faixas de preço da vitrine. Rótulo é apresentação; o VALOR vai em centavos para o backend. */
const FAIXAS_PRECO: Array<{ chave: string; rotulo: string; filtro: Partial<PublicEventFilters> }> = [
  { chave: 'qualquer', rotulo: 'Qualquer preço', filtro: {} },
  { chave: 'gratis', rotulo: 'Grátis', filtro: { onlyFree: true } },
  { chave: 'ate30', rotulo: 'Até R$ 30', filtro: { maxPriceCents: 3000 } },
  { chave: 'ate80', rotulo: 'Até R$ 80', filtro: { maxPriceCents: 8000 } },
];

/** Janelas de data — calculadas na hora do uso, nunca no módulo (senão "hoje" congela no load). */
const JANELAS: Array<{ chave: string; rotulo: string; dias: number | null }> = [
  { chave: 'qualquer', rotulo: 'Qualquer data', dias: null },
  { chave: 'semana', rotulo: 'Próximos 7 dias', dias: 7 },
  { chave: 'mes', rotulo: 'Próximos 30 dias', dias: 30 },
];

/** Data do evento na LISTA: o payload da rota de discovery manda `startAt` (não `datetimeStart`). */
function inicioDoEvento(ev: Event): string | null {
  return ev.startAt ?? ev.datetimeStart ?? null;
}

function formatarData(iso: string | null): string {
  if (!iso) return 'data a confirmar';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'data a confirmar';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function EventosPage() {
  const navigate = useNavigate();
  const { activeActor, actors } = useActiveActor();
  const { mode } = useOperatingMode();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Vocabulário dos filtros: SERVER-DRIVEN. Enquanto não chega, não há filtro a oferecer.
  const [taxonomia, setTaxonomia] = useState<EventTaxonomy | null>(null);
  const [formato, setFormato] = useState<string>('');
  const [categoria, setCategoria] = useState<string>('');
  const [faixaPreco, setFaixaPreco] = useState<string>('qualquer');
  const [janela, setJanela] = useState<string>('qualquer');

  useEffect(() => {
    let cancelled = false;
    getEventTaxonomy()
      .then((t) => { if (!cancelled) setTaxonomia(t); })
      .catch(() => { /* sem taxonomia = sem filtros; a lista continua funcionando */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      if (!validateActiveActor(activeActor)) { setEvents([]); return; }
      setError(null);
      // Os filtros são aplicados NO BACKEND (query), não recortando no cliente uma lista já
      // trazida: filtrar no cliente daria "3 de 50" quando o teto de 50 já tivesse cortado o que
      // interessa. Quem sabe o conjunto inteiro é o servidor.
      const filtros: PublicEventFilters = {};
      if (formato) filtros.formatSlug = formato;
      if (categoria) filtros.categoryKey = categoria;
      const faixa = FAIXAS_PRECO.find((f) => f.chave === faixaPreco);
      Object.assign(filtros, faixa?.filtro ?? {});
      const j = JANELAS.find((x) => x.chave === janela);
      if (j?.dias) {
        const ate = new Date();
        ate.setDate(ate.getDate() + j.dias);
        filtros.startAtTo = ate.toISOString();
      }
      try {
        const list = await listPublicEvents(50, filtros);
        if (!cancelled) setEvents(list);
      } catch (e) {
        // 🔴 Falha de rede/rota NÃO vira lista vazia: lista vazia AFIRMA "não há eventos", e foi
        // exatamente essa mentira (endpoint aposentado engolido) que esta tela carregava.
        if (!cancelled) {
          setEvents(null);
          setError(e instanceof Error ? e.message : 'Não foi possível carregar os eventos.');
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [activeActor?.actor_id, formato, categoria, faixaPreco, janela]);

  const ordenados = useMemo(() => {
    if (!events) return [];
    return [...events].sort((a, b) => {
      const da = inicioDoEvento(a); const db = inicioDoEvento(b);
      if (!da && !db) return 0;
      if (!da) return 1;           // sem data desce
      if (!db) return -1;
      return new Date(da).getTime() - new Date(db).getTime();
    });
  }, [events]);

  /**
   * 🔴 Clayton: *"a vitrine de verdade deve priorizar o que é dos outros"*. Separação por
   * `organizerActorId` contra os actors do próprio usuário — dado que o backend JÁ manda; não é
   * verdade inventada aqui, é agrupamento de apresentação.
   */
  const meusActorIds = useMemo(
    () => new Set([...(actors ?? []).map((a) => a.actor_id), activeActor?.actor_id].filter(Boolean) as string[]),
    [actors, activeActor?.actor_id]
  );
  const deOutros = ordenados.filter((e) => !meusActorIds.has((e as Event & { organizerActorId?: string }).organizerActorId ?? ''));
  const meus = ordenados.filter((e) => meusActorIds.has((e as Event & { organizerActorId?: string }).organizerActorId ?? ''));
  const temFiltroAtivo = !!formato || !!categoria || faixaPreco !== 'qualquer' || janela !== 'qualquer';
  const limparFiltros = (): void => { setFormato(''); setCategoria(''); setFaixaPreco('qualquer'); setJanela('qualquer'); };

  // ══ MODO OPERAR — produzir ═══════════════════════════════════════════════
  if (mode === 'operar') {
    return (
      <div className="eventos-page">
        <div className="eventos-header">
          <h1>🎬 Produzir evento</h1>
          <button className="eventos-create-button" type="button" onClick={() => navigate('/events/new')}>
            + Criar evento
          </button>
        </div>

        <div className="eventos-mode-banner" role="note">
          <strong>Você está operando.</strong> Aqui você cria. Para acompanhar o que já criou —
          status, ingressos vendidos e o que falta publicar — vá para{' '}
          <Link to="/meus-eventos">Meus eventos</Link>.
        </div>

        <div className="eventos-produzir-grid">
          <button type="button" className="eventos-produzir-card" onClick={() => navigate('/events/new')}>
            <span className="eventos-produzir-icone">✨</span>
            <span className="eventos-produzir-titulo">Criar um evento</span>
            <span className="eventos-produzir-hint">Formato, data, local, ingressos e equipe — passo a passo.</span>
          </button>
          <button type="button" className="eventos-produzir-card" onClick={() => navigate('/meus-eventos')}>
            <span className="eventos-produzir-icone">📋</span>
            <span className="eventos-produzir-titulo">Meus eventos</span>
            <span className="eventos-produzir-hint">Acompanhar os que já existem, por situação.</span>
          </button>
        </div>

        {/* "Prioriza, não esconde": a vitrine continua alcançável daqui. */}
        <div className="eventos-cross-mode">
          <p className="eventos-hint-muted">
            {ordenados.length > 0
              ? `Há ${ordenados.length} evento(s) acontecendo por perto.`
              : 'Nenhum evento publicado por perto ainda.'}
          </p>
        </div>
      </div>
    );
  }

  // ══ MODO CONSUMIR — vitrine ══════════════════════════════════════════════
  return (
    <div className="eventos-page">
      <div className="eventos-header">
        <h1>🎭 Eventos por perto</h1>
        <button className="eventos-create-button" type="button" onClick={() => navigate('/events/new')}>
          + Criar evento
        </button>
      </div>

      <div className="eventos-mode-banner" role="note">
        <strong>Você está consumindo.</strong> Estes são os eventos publicados que você pode
        acompanhar. Quer organizar o seu? <Link to="/meus-eventos">Vá para Meus eventos</Link>.
      </div>

      {/* ── FILTROS ── vocabulário SERVER-DRIVEN (getEventTaxonomy): 23 formatos e 9 categorias
          governados. O front não enumera nada; se a taxonomia não chegar, some o filtro e a
          lista continua funcionando (degradar ≠ mentir). */}
      <div className="eventos-filtros" role="search" aria-label="Filtrar eventos">
        <label className="eventos-filtro">
          <span className="eventos-filtro-rotulo">Tipo</span>
          <select value={formato} onChange={(e) => setFormato(e.target.value)} disabled={!taxonomia}>
            <option value="">Todos os tipos</option>
            {(taxonomia?.formats ?? []).map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </label>

        <label className="eventos-filtro">
          <span className="eventos-filtro-rotulo">Categoria</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={!taxonomia}>
            <option value="">Todas</option>
            {(taxonomia?.categories ?? []).map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </label>

        <label className="eventos-filtro">
          <span className="eventos-filtro-rotulo">Quando</span>
          <select value={janela} onChange={(e) => setJanela(e.target.value)}>
            {JANELAS.map((j) => <option key={j.chave} value={j.chave}>{j.rotulo}</option>)}
          </select>
        </label>

        <label className="eventos-filtro">
          <span className="eventos-filtro-rotulo">Preço</span>
          <select value={faixaPreco} onChange={(e) => setFaixaPreco(e.target.value)}>
            {FAIXAS_PRECO.map((f) => <option key={f.chave} value={f.chave}>{f.rotulo}</option>)}
          </select>
        </label>

        {temFiltroAtivo && (
          <button type="button" className="eventos-link-button eventos-filtro-limpar" onClick={limparFiltros}>
            limpar filtros
          </button>
        )}
      </div>

      {error && (
        <div className="eventos-error">
          {error} — <button type="button" className="eventos-link-button" onClick={() => window.location.reload()}>tentar de novo</button>
        </div>
      )}

      {events === null && !error && <p className="eventos-hint-muted">Carregando eventos…</p>}

      {events !== null && ordenados.length === 0 && !error && (
        <div className="eventos-empty">
          {/* Vazio COM filtro ≠ vazio sem filtro. Dizer "não há eventos" quando o filtro é que
              está restrito seria afirmar algo falso sobre o sistema. */}
          <p>{temFiltroAtivo ? 'Nenhum evento com esses filtros.' : 'Nenhum evento publicado por perto ainda.'}</p>
          <p className="eventos-hint-muted">
            {temFiltroAtivo
              ? <>Tente ampliar a busca — <button type="button" className="eventos-link-button" onClick={limparFiltros}>limpar filtros</button>.</>
              : 'Quando alguém publicar um evento com data, ele aparece aqui.'}
          </p>
        </div>
      )}

      {deOutros.length > 0 && (
        <section className="eventos-secao">
          <h2 className="eventos-secao-titulo">Acontecendo por perto</h2>
          <div className="eventos-vitrine-grid">
            {deOutros.map((ev) => <CartaoEvento key={ev.id} ev={ev} onClick={() => navigate(`/events/${ev.id}`)} />)}
          </div>
        </section>
      )}

      {meus.length > 0 && (
        <section className="eventos-secao">
          <h2 className="eventos-secao-titulo eventos-secao-titulo-secundaria">
            Seus eventos <span className="eventos-secao-hint">— você organiza</span>
          </h2>
          <div className="eventos-vitrine-grid">
            {meus.map((ev) => <CartaoEvento key={ev.id} ev={ev} onClick={() => navigate(`/events/${ev.id}`)} seu />)}
          </div>
        </section>
      )}
    </div>
  );
}

function CartaoEvento({ ev, onClick, seu }: { ev: Event; onClick: () => void; seu?: boolean }) {
  const inicio = inicioDoEvento(ev);
  // 🔴 `ticketPriceCents` é o campo da rota de LISTA (adicionado ao mapper em 2026-08-04 — ele
  // trazia a coluna na query e nunca a projetava). `ticketPrice` é o nome no payload de DETALHE.
  // Ler só um dos dois faria a vitrine dizer "Entrada gratuita" para todo evento pago.
  const preco = (ev as Event & { ticketPriceCents?: number | null }).ticketPriceCents ?? ev.ticketPrice ?? null;
  return (
    <button type="button" className={`eventos-vitrine-card ${seu ? 'eventos-vitrine-card-seu' : ''}`} onClick={onClick}>
      <span className="eventos-vitrine-data">{formatarData(inicio)}</span>
      <span className="eventos-vitrine-titulo">{ev.title}</span>
      {ev.description && <span className="eventos-vitrine-desc">{ev.description}</span>}
      <span className="eventos-vitrine-preco">
        {/* null = sem preço declarado (gratuito); 0 também. undefined seria "não sei" — mas esta
            rota sempre projeta o campo, então null aqui significa mesmo "sem ingresso pago". */}
        {preco == null || preco === 0 ? 'Entrada gratuita' : (preco / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </span>
    </button>
  );
}
