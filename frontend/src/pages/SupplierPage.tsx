// frontend/src/pages/SupplierPage.tsx
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — a página do fornecedor (vitrine + agenda + pedido)
// ║ NORMA:   "frontend nunca cria verdade — projeta verdade resolvida" · Δbank=0 (PRÉ-PORTA-01)
// ║ NÃO:     NÃO confirmar reserva pela tela; NÃO calcular preço/split; NÃO inventar agenda;
// ║          NÃO usar a trilha RFQ→quote→booking (CONTIDA por ato de Clayton, 403).
// ║ EM VEZ:  GET /api/events/suppliers/:actorId (vitrine) + POST /services/offerings/:id/bookings
// ║          (pedido — o servidor decide se vira 'requested' ou 'confirmed').
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE ESTA PÁGINA NASCE SOBRE `requestBooking`, E NÃO SOBRE RFQ ═══
// Clayton pediu *"uma página (padrão para este modelo) que eu consiga montar um pedido de orçamento,
// ver a disponibilidade de agenda, ver o que ele tem a oferecer"*. Havia DOIS candidatos, e eu
// verifiquei os dois antes de escolher (2026-08-04):
//
//   · RFQ  — "não sei quem, manda para N candidatos". Está com TRÊS cortes independentes:
//            o RFQ vive em `events.metadata.rfqs` (JSONB, não tabela); o disparo escreve em
//            `opportunity_dispatches`, tabela que NÃO EXISTE no banco (42P01 garantido); e o
//            terminal `acceptQuote` responde 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED por decisão
//            EXPLÍCITA de Clayton (2026-06-18), porque materializava cobrança "em nome do provider"
//            sem confirmação dele. Reabrir é DECISION do dono, não ato meu.
//   · requestBooking — "escolhi este". VIVO, selado por E2E, Δbank=0, já aceita contexto de evento
//            com autoridade `manage_attendees` revalidada server-side.
//
// Não são duas verdades concorrentes: são dois degraus do MESMO funil, e o degrau de cima está
// contido. Esta tela é o caso "já sei quem" — que é literalmente o que acontece quando o usuário
// clica num fornecedor do catálogo. Nasce sobre o caminho vivo.
//
// ⚠️ O QUE A TELA NÃO PODE PROMETER: `status` volta 'requested' (negocia) ou 'confirmed'
// (aceita-direto within-reach) — quem decide é o DONO da oferta, server-side. A tela REPORTA o que
// voltou; nunca antecipa nem traduz 'requested' como se fosse aceite.

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getSupplierShowcase, listOrganizerEvents, type ProviderShowcase, type ProviderOffer, type Event } from '../api/events';
import { requestOfferingBooking, type OfferingBookingResult } from '../api/offerings';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { formatCentsAsBRL } from '../utils/money';
import './SupplierPage.css';

/** Preço legível. `priceUnit` significa coisas DIFERENTES por substrato — não unificar às cegas. */
function precoLegivel(cents: number | null, unidade: string | null, kind: string): string {
  if (cents == null) return 'sob consulta';
  const valor = formatCentsAsBRL(cents);
  if (kind === 'rentable') {
    const porUnidade: Record<string, string> = {
      por_hora: '/hora', por_dia: '/dia', por_semana: '/semana',
      por_mes: '/mês', por_semestre: '/semestre', por_ano: '/ano',
    };
    return `${valor}${unidade ? porUnidade[unidade] ?? '' : ''}`;
  }
  const min = unidade ? Number(unidade) : NaN;
  return Number.isFinite(min) && min > 0 ? `${valor} · ${Math.round(min / 60)}h` : valor;
}

function janelaLegivel(inicio: string, fim: string): string {
  const d = new Date(inicio);
  const f = new Date(fim);
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  const hi = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const hf = f.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia} · ${hi}–${hf}`;
}

export default function SupplierPage() {
  const { providerActorId } = useParams<{ providerActorId: string }>();
  const [searchParams] = useSearchParams();
  const { activeActor } = useActiveActor();

  const [vitrine, setVitrine] = useState<ProviderShowcase | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [meusEventos, setMeusEventos] = useState<Event[]>([]);

  useEffect(() => {
    if (!providerActorId) return;
    let cancelled = false;
    setErro(null);
    getSupplierShowcase(providerActorId)
      .then((d) => { if (!cancelled) setVitrine(d); })
      // Falha NÃO vira vitrine vazia: vazio afirmaria "não oferece nada", e não é o que aconteceu.
      .catch((e) => { if (!cancelled) { setVitrine(null); setErro(e instanceof Error ? e.message : 'Não foi possível carregar este fornecedor.'); } });
    return () => { cancelled = true; };
  }, [providerActorId]);

  // Eventos do contratante — o pedido pode ser amarrado a um deles (contexto validado no servidor).
  useEffect(() => {
    if (!activeActor?.actor_id) return;
    let cancelled = false;
    listOrganizerEvents(activeActor.actor_id)
      .then((evs) => { if (!cancelled) setMeusEventos(evs); })
      .catch(() => { /* sem contexto de evento; o pedido segue possível sem ele */ });
    return () => { cancelled = true; };
  }, [activeActor?.actor_id]);

  if (erro) {
    return (
      <div className="page-container">
        <p className="organizer-hint organizer-hint-warn">{erro}</p>
        <Link to="/meus-eventos">← voltar para quem me ajuda</Link>
      </div>
    );
  }
  if (!vitrine) {
    return <div className="page-container"><p className="organizer-hint">Carregando fornecedor…</p></div>;
  }

  const nome = vitrine.displayName ?? 'Fornecedor sem nome de exibição';
  const totalJanelas = vitrine.offers.reduce((a, o) => a + o.windows.length, 0);

  return (
    <div className="page-container supplier-page">
      <div className="flow-header">
        <p className="sp-breadcrumb"><Link to="/meus-eventos">Quem me ajuda</Link> › fornecedor</p>
        <h1>{nome}</h1>
        <p className="flow-subtitle">
          {vitrine.offers.length === 0
            ? 'Este fornecedor ainda não publicou nenhuma oferta ativa.'
            : `${vitrine.offers.length} ${vitrine.offers.length === 1 ? 'oferta ativa' : 'ofertas ativas'} · ${totalJanelas} ${totalJanelas === 1 ? 'horário disponível' : 'horários disponíveis'}`}
        </p>
      </div>

      {vitrine.offers.length === 0 && (
        <p className="organizer-hint">
          Nada a contratar por aqui hoje. Isso é uma medição, não uma falha de busca — o fornecedor
          existe e não tem oferta ativa.
        </p>
      )}

      <ul className="sp-ofertas">
        {vitrine.offers.map((oferta) => (
          <OfferCard
            key={`${oferta.sourceKind}:${oferta.offerId}`}
            oferta={oferta}
            meusEventos={meusEventos}
            eventoSugerido={searchParams.get('eventId') ?? ''}
            requesterActorId={activeActor?.actor_id ?? null}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * Uma oferta + sua agenda + o pedido. O formulário só existe quando há janela: pedir uma reserva
 * sem janela é impossível no backend (`availabilityId` é obrigatório), e um botão que sempre falha
 * é pior que botão nenhum.
 */
function OfferCard({ oferta, meusEventos, eventoSugerido, requesterActorId }: {
  oferta: ProviderOffer;
  meusEventos: Event[];
  eventoSugerido: string;
  requesterActorId: string | null;
}) {
  const [janelaSelecionada, setJanelaSelecionada] = useState<string>('');
  const [eventoId, setEventoId] = useState<string>(eventoSugerido);
  const [mensagem, setMensagem] = useState<string>('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<OfferingBookingResult | null>(null);
  const [erroPedido, setErroPedido] = useState<string | null>(null);

  // 🔴 LOCAÇÃO NÃO PASSA POR AQUI. `POST /services/offerings/:id/bookings` é o writer de
  // service_offerings; recurso alugável tem caminho PRÓPRIO (rentable-resource.requestBooking) que
  // ainda não tem superfície. Mandar um rentable para esta rota daria 404/400 — e medido em
  // 2026-08-04 os locáveis têm ZERO janela publicada, então nem agenda haveria para escolher.
  const contratavelAqui = oferta.sourceKind === 'service';

  const enviar = useCallback(async (): Promise<void> => {
    if (!janelaSelecionada || !requesterActorId) return;
    setEnviando(true); setErroPedido(null);
    try {
      const r = await requestOfferingBooking(oferta.offerId, {
        availabilityId: janelaSelecionada,
        requesterActorId,
        eventId: eventoId || undefined,
        notes: mensagem.trim() || undefined,
      });
      setResultado(r);
    } catch (e) {
      // O erro REAL sobe para a tela. Engolir aqui seria repetir o defeito que esta sessão inteira
      // perseguiu: falha silenciosa que o usuário lê como "não há".
      setErroPedido(e instanceof Error ? e.message : 'Não foi possível enviar o pedido.');
    } finally {
      setEnviando(false);
    }
  }, [janelaSelecionada, requesterActorId, oferta.offerId, eventoId, mensagem]);

  return (
    <li className="sp-oferta">
      <div className="sp-oferta-head">
        <span className="sp-oferta-label">{oferta.label ?? 'Oferta sem rótulo'}</span>
        <span className="sp-oferta-kind">{oferta.sourceKind === 'rentable' ? '🔑 alugar' : '🛠️ contratar'}</span>
        <span className="sp-oferta-preco">{precoLegivel(oferta.priceCents, oferta.priceUnit, oferta.sourceKind)}</span>
      </div>

      {oferta.windows.length === 0 ? (
        <p className="sp-vazio">
          {/* Zero MEDIDO, com o motivo verdadeiro — não "erro ao buscar agenda". */}
          Sem agenda publicada. Este fornecedor não declarou horários para esta oferta.
        </p>
      ) : !contratavelAqui ? (
        <p className="sp-vazio">
          Locação de bem ainda não tem pedido pela tela — o caminho de reserva de recurso é outro e
          não foi religado. Os horários abaixo são reais, mas o pedido ainda não sai daqui.
        </p>
      ) : resultado ? (
        <div className="sp-resultado" role="status">
          {/* REPORTA o que o servidor decidiu. 'requested' NÃO é aceite — dizer que é seria mentir. */}
          {resultado.status === 'confirmed' ? (
            <p><strong>Reserva confirmada.</strong> O fornecedor aceita direto nesta condição.</p>
          ) : (
            <p><strong>Pedido enviado.</strong> Ficou aguardando resposta do fornecedor — ele decide se aceita.</p>
          )}
          <p className="sp-resultado-detalhe">
            situação: <code>{resultado.status}</code> · critério: <code>{resultado.gateReason}</code>
          </p>
        </div>
      ) : (
        <div className="sp-pedido">
          <label className="sp-campo">
            <span className="sp-campo-rotulo">Horário</span>
            <select value={janelaSelecionada} onChange={(e) => setJanelaSelecionada(e.target.value)}>
              <option value="">Escolha um horário…</option>
              {oferta.windows.map((w) => (
                <option key={w.availabilityId} value={w.availabilityId}>{janelaLegivel(w.startAt, w.endAt)}</option>
              ))}
            </select>
          </label>

          <label className="sp-campo">
            <span className="sp-campo-rotulo">Para qual evento</span>
            <select value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
              <option value="">Sem amarrar a um evento</option>
              {meusEventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
          </label>

          <label className="sp-campo sp-campo-largo">
            <span className="sp-campo-rotulo">O que você precisa</span>
            <textarea
              value={mensagem}
              maxLength={2000}
              rows={3}
              placeholder="Ex.: festa para 200 pessoas, das 20h às 2h, com montagem a partir das 16h."
              onChange={(e) => setMensagem(e.target.value)}
            />
          </label>

          {erroPedido && <p className="organizer-hint organizer-hint-warn">{erroPedido}</p>}
          {!requesterActorId && <p className="sp-vazio">Escolha um perfil ativo no topo para poder pedir.</p>}

          <button type="button" className="sp-enviar" disabled={!janelaSelecionada || !requesterActorId || enviando} onClick={() => void enviar()}>
            {enviando ? 'Enviando…' : 'Enviar pedido'}
          </button>
          <p className="sp-nota">
            {/* A fronteira, dita na tela: pedir não move dinheiro. */}
            Enviar o pedido não paga nada e não reserva pagamento — é combinação de agenda.
          </p>
        </div>
      )}
    </li>
  );
}
