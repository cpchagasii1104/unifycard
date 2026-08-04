// frontend/src/components/events/EventPublicView.tsx
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — a face do VISITANTE de /events/:id (modelo único para todo evento)
// ║ NORMA:   "a verdade vive no backend" (Clayton) · dinheiro em CENTAVOS inteiros (§4.7)
// ║ NÃO:     NÃO calcular meia aqui (o banco trava `meia = inteira/2` por CHECK físico);
// ║          NÃO inventar disponibilidade; NÃO fingir compra enquanto o motor está desligado.
// ║ EM VEZ:  ler `GET /api/events/events/:id/sectors` — endpoint JÁ público (gate `canViewEvent`,
// ║          comentado no backend como "VITRINE do comprador") e que não tinha consumidor nenhum.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE ESTA TELA EXISTE (Clayton, 2026-08-04) ═══
// *"quando estou na tela dos eventos e clico no evento, estou indo para uma tela nada a ver, de
// buscar no catálogo, sendo que deveria aparecer a página (mesmo modelo para todos os eventos e
// para facilitar nos app) com informações sobre o evento, ingressos disponíveis… Aparecer valores,
// setores, quantidade de meias, etc. Que nem aparece em eventim."*
//
// A `EventPage` renderiza 23 blocos e apenas UM verifica se quem olha é o dono. Um visitante via
// "Histórico de Estados", "Buscar no Catálogo", "Publicar Evento" e "Criar RFQ". Os writes falhavam
// no backend (403), mas os controles apareciam — ruído de gestão na cara de quem só quer ir ao show.
//
// ═══ 🔴 A HONESTIDADE SOBRE A VENDA ═══
// A compra de ingresso está estruturalmente DESLIGADA hoje, e isto foi medido, não suposto:
//   · `POST /tickets/:id/reserve|pay` → 501 (o repositório mira colunas que `ticket_sales` não tem)
//   · `POST /api/events/:id/checkout` → 403 (firewall `CHECKOUT_FINANCIAL_RUNTIME_ENABLED`, default OFF)
//   · carrinho de ingresso não existe em lugar nenhum do domínio de evento
// Então esta tela mostra PREÇO REAL e diz a verdade sobre o botão. Fingir um carrinho que devolve
// 403 seria a mesma doença que esta sessão vem consertando (executor que relata sucesso sem ato).

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DateTime } from 'luxon';
import {
  listEventSectors, getEventStats, setEventRSVP, getMyEventRSVP, removeEventRSVP, getEventRSVPCounts,
  type Event, type EventSector, type EventRSVP, type RSVPCounts,
} from '../../api/events';
import { formatCentsAsBRL } from '../../utils/money';
import { showToast } from '../common/Toast';
import EventStatusBadge from './EventStatusBadge';
import './EventPublicView.css';

interface Props {
  event: Event & {
    actorId?: string;
    actorType?: string;
    ticketPriceCents?: number | null;
    maxAttendees?: number | null;
    locationMode?: string | null;
    eventAccessType?: string | null;
  };
  /** Presente quando quem olha TAMBÉM organiza — oferece a volta para a gestão. */
  podeGerenciar?: boolean;
  onIrParaGestao?: () => void;
}

const LOCATION_MODE_LABEL: Record<string, string> = {
  fixed_place: 'Local fixo', online: 'Online', hybrid: 'Híbrido',
  to_be_defined: 'Local a definir', route: 'Rota / múltiplos pontos',
};

function formatarQuando(iso: string | null | undefined, timezone?: string): string {
  if (!iso) return 'Data a confirmar';
  const dt = DateTime.fromISO(iso, { zone: timezone || 'America/Sao_Paulo' });
  if (!dt.isValid) return 'Data a confirmar';
  // Ex.: "domingo, 16 de agosto de 2026 · 20:00"
  return `${dt.setLocale('pt-BR').toFormat("cccc, d 'de' LLLL 'de' yyyy")} · ${dt.toFormat('HH:mm')}`;
}

export default function EventPublicView({ event, podeGerenciar, onIrParaGestao }: Props) {
  const [setores, setSetores] = useState<EventSector[] | null>(null);
  const [erroSetores, setErroSetores] = useState<string | null>(null);
  const [stats, setStats] = useState<{ soldCount: number; maxCapacity: number | null; remaining: number | null; occupancyPercent: number | null } | null>(null);
  const [minhaInscricao, setMinhaInscricao] = useState<EventRSVP | null>(null);
  const [contagem, setContagem] = useState<RSVPCounts | null>(null);
  const [inscrevendo, setInscrevendo] = useState(false);

  const recarregarInscricao = useCallback(async (): Promise<void> => {
    const [meu, cnt] = await Promise.allSettled([getMyEventRSVP(event.id), getEventRSVPCounts(event.id)]);
    if (meu.status === 'fulfilled') setMinhaInscricao(meu.value);
    if (cnt.status === 'fulfilled') setContagem(cnt.value);
  }, [event.id]);

  useEffect(() => {
    let cancelled = false;
    listEventSectors(event.id)
      .then((s) => { if (!cancelled) setSetores(s); })
      .catch((e) => {
        // Falha de leitura ≠ "não há setor". Lista vazia AFIRMA que o evento não tem setor;
        // erro diz que não deu para saber. São coisas diferentes e a tela mostra as duas diferente.
        if (!cancelled) { setSetores(null); setErroSetores(e instanceof Error ? e.message : 'Não foi possível carregar os ingressos.'); }
      });
    getEventStats(event.id)
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => { /* ocupação é acessório: sem ela a página continua completa */ });
    void recarregarInscricao();
    return () => { cancelled = true; };
  }, [event.id, recarregarInscricao]);

  const inscrever = useCallback(async (): Promise<void> => {
    setInscrevendo(true);
    try {
      await setEventRSVP(event.id, 'yes');
      showToast('Presença confirmada!', 'success');
      await recarregarInscricao();
    } catch (e) {
      // Motivo REAL do backend, nunca "erro ao inscrever" genérico.
      showToast(e instanceof Error ? e.message : 'Não foi possível confirmar', 'error');
    } finally {
      setInscrevendo(false);
    }
  }, [event.id, recarregarInscricao]);

  const cancelarInscricao = useCallback(async (): Promise<void> => {
    setInscrevendo(true);
    try {
      await removeEventRSVP(event.id);
      showToast('Presença cancelada.', 'success');
      await recarregarInscricao();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível cancelar', 'error');
    } finally {
      setInscrevendo(false);
    }
  }, [event.id, recarregarInscricao]);

  const inicio = event.datetimeStart ?? event.startAt ?? null;
  const fim = event.datetimeEnd ?? event.endAt ?? null;
  const temSetores = Array.isArray(setores) && setores.length > 0;
  const precoAvulso = event.ticketPriceCents ?? null;
  const statusReal = ((event as Event & { statusCanonical?: string }).statusCanonical ?? event.status ?? '').toLowerCase();
  const aberto = statusReal === 'published' || statusReal === 'active';
  /**
   * GRATUITO = sem setor pago E sem preço avulso. Decide qual dos dois caminhos a página oferece.
   * Um setor com preço torna o evento pago mesmo que `ticket_price_cents` esteja nulo — o setor é
   * a autoridade de preço quando existe (o backend serve `ticketPriceCents = MIN(inteira)`).
   */
  const ehGratuito = temSetores
    ? setores!.every((s) => s.inteiraPriceCents === 0)
    : precoAvulso == null || precoAvulso === 0;

  return (
    <div className="ev-public">
      {/* ── CABEÇALHO ─────────────────────────────────────────────────────── */}
      <header className="ev-public-hero">
        <div className="ev-public-hero-topo">
          <EventStatusBadge status={event.status} />
          {event.locationMode && (
            <span className="ev-public-tag">{LOCATION_MODE_LABEL[event.locationMode] ?? event.locationMode}</span>
          )}
        </div>
        <h1 className="ev-public-titulo">{event.title}</h1>
        <p className="ev-public-quando">{formatarQuando(inicio, event.timezone)}</p>
        {fim && <p className="ev-public-ate">até {formatarQuando(fim, event.timezone)}</p>}
      </header>

      {event.description && (
        <section className="ev-public-secao">
          <h2 className="ev-public-secao-titulo">Sobre o evento</h2>
          <p className="ev-public-descricao">{event.description}</p>
        </section>
      )}

      {/* ── INGRESSOS ─────────────────────────────────────────────────────── */}
      <section className="ev-public-secao ev-public-ingressos">
        <h2 className="ev-public-secao-titulo">Ingressos</h2>

        {erroSetores && <p className="ev-public-aviso ev-public-aviso-erro">{erroSetores}</p>}

        {setores === null && !erroSetores && <p className="ev-public-hint">Carregando ingressos…</p>}

        {temSetores && (
          <div className="ev-public-setores">
            {setores!.slice().sort((a, b) => a.sectorNumber - b.sectorNumber).map((s) => (
              <article key={s.id} className="ev-public-setor">
                <div className="ev-public-setor-cabeca">
                  <h3 className="ev-public-setor-nome">{s.name}</h3>
                  <span className="ev-public-setor-cap">{s.capacity} lugares</span>
                </div>
                <div className="ev-public-precos">
                  <div className="ev-public-preco">
                    <span className="ev-public-preco-rotulo">Inteira</span>
                    <span className="ev-public-preco-valor">{formatCentsAsBRL(s.inteiraPriceCents)}</span>
                  </div>
                  <div className="ev-public-preco ev-public-preco-meia">
                    <span className="ev-public-preco-rotulo">Meia-entrada</span>
                    <span className="ev-public-preco-valor">{formatCentsAsBRL(s.meiaPriceCents)}</span>
                    {/* A cota é do BANCO (meia_quota_bps, piso legal 40% travado por CHECK).
                        Exibida em %, mas o valor governado é em BPS — não recalculamos nada. */}
                    <span className="ev-public-preco-cota">
                      até {Math.round(s.meiaQuotaBps / 100)}% dos lugares
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {setores !== null && !temSetores && (
          precoAvulso != null && precoAvulso > 0 ? (
            <div className="ev-public-setores">
              <article className="ev-public-setor">
                <div className="ev-public-setor-cabeca">
                  <h3 className="ev-public-setor-nome">Entrada única</h3>
                  {event.maxAttendees != null && <span className="ev-public-setor-cap">{event.maxAttendees} lugares</span>}
                </div>
                <div className="ev-public-precos">
                  <div className="ev-public-preco">
                    <span className="ev-public-preco-rotulo">Inteira</span>
                    <span className="ev-public-preco-valor">{formatCentsAsBRL(precoAvulso)}</span>
                  </div>
                </div>
                {/* Honesto: sem setor declarado, não há cota de meia governada para exibir.
                    Inventar "metade disso" aqui seria o frontend criando política de preço. */}
                <p className="ev-public-hint">
                  Este evento ainda não tem setores com meia-entrada declarados pelo organizador.
                </p>
              </article>
            </div>
          ) : (
            <p className="ev-public-aviso">Entrada gratuita.</p>
          )
        )}

        {stats && (
          <p className="ev-public-ocupacao">
            {stats.maxCapacity != null
              ? <>{stats.remaining ?? '—'} de {stats.maxCapacity} disponíveis{stats.occupancyPercent != null ? ` · ${stats.occupancyPercent}% ocupado` : ''}</>
              : <>{stats.soldCount} confirmado(s)</>}
          </p>
        )}

        {/* ── AÇÃO ──────────────────────────────────────────────────────────
            🔴 DOIS CAMINHOS DIFERENTES, e a diferença é REAL, não cosmética:
            · GRATUITO → INSCRIÇÃO funciona de verdade (POST /rsvp), Δbank=0, nada de Bank.
            · PAGO     → a venda está estruturalmente desligada (reserva 501, checkout 403 pelo
              firewall financeiro default OFF, carrinho inexistente). O botão DIZ ISSO em vez de
              fingir carrinho — Clayton confirmou preferir preço visível + verdade a preço oculto. */}
        <div className="ev-public-compra">
          {ehGratuito ? (
            minhaInscricao?.status === 'yes' ? (
              <>
                <div className="ev-public-confirmado" role="status">✅ Sua presença está confirmada</div>
                <button
                  type="button"
                  className="ev-public-btn-secundario"
                  disabled={inscrevendo}
                  onClick={() => void cancelarInscricao()}
                >
                  {inscrevendo ? 'Cancelando…' : 'Cancelar presença'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="ev-public-btn-comprar"
                disabled={inscrevendo || !aberto}
                onClick={() => void inscrever()}
              >
                {inscrevendo ? 'Confirmando…' : aberto ? 'Confirmar presença' : 'Inscrições não abertas'}
              </button>
            )
          ) : (
            <>
              <button type="button" className="ev-public-btn-comprar" disabled>
                Venda ainda não liberada
              </button>
              <p className="ev-public-hint">
                {aberto
                  ? 'O evento está publicado, mas a venda de ingressos ainda não foi habilitada nesta instalação.'
                  : 'Este evento ainda não está com inscrições abertas.'}
              </p>
            </>
          )}

          {contagem && contagem.yes > 0 && (
            <p className="ev-public-hint">
              {contagem.yes === 1 ? '1 pessoa confirmou presença.' : `${contagem.yes} pessoas confirmaram presença.`}
            </p>
          )}
        </div>
      </section>

      {podeGerenciar && (
        <section className="ev-public-secao ev-public-gestao">
          <p className="ev-public-hint">
            Você organiza este evento.{' '}
            {onIrParaGestao
              ? <button type="button" className="ev-public-link" onClick={onIrParaGestao}>Abrir painel de gestão</button>
              : <Link className="ev-public-link" to="/meus-eventos">Ir para Meus eventos</Link>}
          </p>
        </section>
      )}
    </div>
  );
}
