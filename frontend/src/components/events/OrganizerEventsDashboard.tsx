// frontend/src/components/events/OrganizerEventsDashboard.tsx
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — visão de gestão dos eventos do organizador (Clayton, 2026-08-03)
// ║ NORMA:   "frontend nunca cria verdade" — os grupos abaixo são PROJEÇÃO do vocabulário GOVERNADO
// ║          de events.status, medido no banco: draft·declared·published·active·ended·cancelled.
// ║ NÃO:     NÃO inventar status ("EM_ANDAMENTO", "SOLD_OUT", "FINISHED"). Foi assim que o
// ║          EventStatusBadge nasceu com interseção ZERO com o banco e 23 eventos renderizaram o
// ║          status cru em inglês para o usuário.
// ║ EM VEZ:  agrupar os status REAIS sob rótulos em pt-BR. O rótulo é tradução, o valor é do banco.
// ╚════════════════════════════════════════════════════════════════
//
// Pedido de Clayton: "preciso ver os eventos já criados e ainda não concluídos, ou em andamento, ou
// cancelado… preciso dos status deles, poder ver quantos ingressos já vendeu, o que falta para
// colocar em produção / venda."
//
// As três peças já existiam separadas e nunca tinham sido juntas: a rota de listagem com
// `organizer_dashboard` (que devolve os NÃO-públicos), `getEventStats` (soldCount) e a noção de
// pendência do painel. Esta tela costura — sem duplicar regra de negócio.

import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { listOrganizerEvents, getEventStats, type Event } from '../../api/events';
import { useActiveActor } from '../../contexts/ActiveActorContext';

/**
 * Grupos = PROJEÇÃO dos status governados. Um status só aparece em um grupo; qualquer valor novo
 * que o banco passe a emitir cai em "outros" VISÍVEL — nunca é escondido, porque sumir da tela é
 * pior que aparecer sem rótulo bonito.
 */
const GRUPOS: Array<{ chave: string; titulo: string; status: string[]; ajuda: string }> = [
  { chave: 'montagem', titulo: 'Sendo cadastrados', status: ['draft', 'declared'],
    ajuda: 'Ainda não estão à venda nem aparecem no feed.' },
  { chave: 'publicados', titulo: 'Publicados', status: ['published'],
    ajuda: 'Visíveis no feed e prontos para receber público.' },
  { chave: 'andamento', titulo: 'Em andamento', status: ['active'],
    ajuda: 'Acontecendo agora.' },
  { chave: 'encerrados', titulo: 'Encerrados', status: ['ended'],
    ajuda: 'Já aconteceram.' },
  { chave: 'cancelados', titulo: 'Cancelados', status: ['cancelled'],
    ajuda: 'Não vão acontecer.' },
];

/** Espelha o contrato de getEventStats — o backend já resolve capacidade e ocupação; não recalculamos. */
type Stats = {
  soldCount: number;
  maxCapacity: number | null;
  remaining: number | null;
  occupancyPercent: number | null;
};

/**
 * O QUE FALTA para publicar — derivado só de campo que o payload REALMENTE traz.
 * ⚠️ Não repete o computeProgress do painel (que lê setores/necessidades e tem mais dado à mão):
 * duplicar a regra criaria duas respostas para a mesma pergunta. Aqui é o bloqueio de PUBLICAÇÃO,
 * e o painel continua sendo o lugar do diagnóstico completo.
 */
function pendenciaParaPublicar(ev: Event): string | null {
  if (ev.status !== 'draft' && ev.status !== 'declared') return null;
  if (!ev.datetimeStart) return 'Falta confirmar a data — sem ela o evento não pode ser publicado.';
  if (new Date(ev.datetimeStart).getTime() < Date.now()) return 'A data confirmada já passou — o feed só mostra evento futuro.';
  if (ev.status === 'draft') return 'Rascunho: falta concluir a declaração para poder publicar.';
  return 'Pronto para publicar.';
}

export default function OrganizerEventsDashboard() {
  const { activeActor, actors } = useActiveActor();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [erro, setErro] = useState<string | null>(null);
  // Aba visível — navegação de UX, nunca estado de domínio.
  const [abaAtiva, setAbaAtiva] = useState<string>('montagem');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // 🔴 NÃO basta o actor ATIVO. "Meus eventos" é o que EU organizo em QUALQUER papel — e o
      // organizador troca de chapéu no cabeçalho (pessoa física, página, empresa). Com um só actor,
      // quem estivesse "Operando" como página via ZERO eventos criados como pessoa física, e o
      // backend ainda caía em `public_discovery` (piso published/active), escondendo os `declared`.
      // Sintoma real: todos os grupos em (0) com eventos existindo no banco.
      const ids = Array.from(new Set([
        ...(actors ?? []).map((a) => a.actor_id),
        ...(activeActor?.actor_id ? [activeActor.actor_id] : []),
      ].filter(Boolean)));
      if (ids.length === 0) return;
      try {
        // Uma chamada por papel. Falha de um papel não pode zerar os outros — por isso allSettled.
        const results = await Promise.allSettled(ids.map((id) => listOrganizerEvents(id)));
        if (cancelled) return;
        const porId = new Map<string, Event>();
        for (const r of results) {
          if (r.status === 'fulfilled') for (const ev of r.value) porId.set(ev.id, ev);
        }
        const list = Array.from(porId.values());
        setEvents(list);
        // Ingressos vendidos: uma chamada por evento, tolerante a falha individual.
        // Falha de UM não pode zerar o número dos outros nem afirmar "0 vendidos" (zero é asserção).
        for (const ev of list) {
          getEventStats(ev.id)
            .then((s) => { if (!cancelled) setStats((prev) => ({ ...prev, [ev.id]: s })); })
            .catch(() => undefined);
        }
      } catch (e) {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Não foi possível carregar seus eventos.');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [activeActor?.actor_id, actors]);

  const agrupados = useMemo(() => {
    const base = GRUPOS.map((g) => ({ ...g, itens: (events ?? []).filter((e) => g.status.includes(e.status)) }));
    const conhecidos = new Set(GRUPOS.flatMap((g) => g.status));
    const outros = (events ?? []).filter((e) => !conhecidos.has(e.status));
    if (outros.length > 0) {
      base.push({ chave: 'outros', titulo: 'Outros status', status: [], ajuda: 'Status ainda sem rótulo nesta tela.', itens: outros });
    }
    return base;
  }, [events]);

  if (erro) return <p className="organizer-hint organizer-hint-warn">{erro}</p>;
  if (events === null) return <p className="organizer-hint">Carregando seus eventos…</p>;
  if (events.length === 0) {
    return (
      <p className="organizer-hint">
        Você ainda não criou nenhum evento. <Link to="/events/new">Criar o primeiro</Link>.
      </p>
    );
  }

  return (
    <div className="organizer-events-dashboard">
      {/* ABAS (Clayton: "podia também ser em abas"). A contagem fica NO rótulo, então dá para ver
          quantos há em cada situação sem abrir. Navegação pura — não grava nem altera nada. */}
      <nav className="organizer-tabs" role="tablist">
        {agrupados.map((g) => (
          <button
            key={g.chave}
            type="button"
            role="tab"
            aria-selected={abaAtiva === g.chave}
            className={`organizer-tab ${abaAtiva === g.chave ? 'organizer-tab-active' : ''}`}
            onClick={() => setAbaAtiva(g.chave)}
          >
            {g.titulo} ({g.itens.length})
          </button>
        ))}
      </nav>

      {agrupados.filter((g) => g.chave === abaAtiva).map((g) => (
        <section key={g.chave} className="organizer-section">
          <p className="organizer-hint organizer-hint-muted">{g.ajuda}</p>

          {g.itens.length === 0 ? (
            <p className="organizer-hint">Nenhum evento aqui.</p>
          ) : (
            <ul className="organizer-events-list">
              {g.itens.map((ev) => {
                const s = stats[ev.id];
                const pend = pendenciaParaPublicar(ev);
                return (
                  <li key={ev.id} className="organizer-event-row">
                    <Link to={`/events/${ev.id}`} className="organizer-event-title">{ev.title}</Link>
                    <span className="organizer-event-meta">
                      {ev.datetimeStart
                        ? new Date(ev.datetimeStart).toLocaleString('pt-BR')
                        : 'sem data confirmada'}
                    </span>
                    <span className="organizer-event-meta">
                      {/* undefined ≠ 0: enquanto não carregou, dizemos que não sabemos. Mostrar "0
                          vendidos" antes da resposta AFIRMARIA algo que não foi medido. */}
                      {s
                        ? `${s.soldCount} vendido(s)` +
                          (s.maxCapacity != null ? ` de ${s.maxCapacity}` : '') +
                          (s.occupancyPercent != null ? ` · ${s.occupancyPercent}% ocupado` : '')
                        : 'carregando vendas…'}
                    </span>
                    {pend && <span className="organizer-event-pending">{pend}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
