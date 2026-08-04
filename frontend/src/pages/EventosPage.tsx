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
import { listPublicEvents, type Event } from '../api/events';
import { validateActiveActor } from '../utils/guardrails';
import './EventosPage.css';

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
  const { activeActor } = useActiveActor();
  const { mode } = useOperatingMode();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      if (!validateActiveActor(activeActor)) { setEvents([]); return; }
      setError(null);
      try {
        const list = await listPublicEvents(50);
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
  }, [activeActor?.actor_id]);

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

      {error && (
        <div className="eventos-error">
          {error} — <button type="button" className="eventos-link-button" onClick={() => window.location.reload()}>tentar de novo</button>
        </div>
      )}

      {events === null && !error && <p className="eventos-hint-muted">Carregando eventos…</p>}

      {events !== null && ordenados.length === 0 && !error && (
        <div className="eventos-empty">
          <p>Nenhum evento publicado por perto ainda.</p>
          <p className="eventos-hint-muted">
            Quando alguém publicar um evento com data, ele aparece aqui.
          </p>
        </div>
      )}

      <div className="eventos-vitrine-grid">
        {ordenados.map((ev) => {
          const inicio = inicioDoEvento(ev);
          return (
            <button
              key={ev.id}
              type="button"
              className="eventos-vitrine-card"
              onClick={() => navigate(`/events/${ev.id}`)}
            >
              <span className="eventos-vitrine-data">{formatarData(inicio)}</span>
              <span className="eventos-vitrine-titulo">{ev.title}</span>
              {ev.description && <span className="eventos-vitrine-desc">{ev.description}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
