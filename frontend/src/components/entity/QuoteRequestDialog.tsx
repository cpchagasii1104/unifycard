// frontend/src/components/entity/QuoteRequestDialog.tsx
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — o pedido de orçamento, in-page, para QUALQUER actor
// ║ NORMA:   `DESENHO_PAGINA_DO_ACTOR` §2.4 — uma página para todo actor; ação `request_quote`
// ║ NÃO:     NÃO criar página de fornecedor paralela; NÃO confirmar reserva pela tela.
// ║ EM VEZ:  este diálogo abre sobre a `ActorPage`, que é a casca universal.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE ISTO É DIÁLOGO, E NÃO UMA PÁGINA ═══
// Eu tinha criado `/fornecedores/:id` — a SEXTA superfície de "página de vendedor" do repositório,
// contra a cláusula anti-página-paralela do próprio `ActorPage` (*"absorve SocialProfilePage e
// SocialCompanyPage"*, *"adicionar vertical = registrar bloco, NUNCA página nova"*). Clayton
// apontou o risco antes de eu perceber: *"para no MVP a gente não ter uma infinidade de páginas
// para corrigir"*. O que valia daquela página era o FLUXO — ele virou este diálogo; a página saiu.
//
// 🔴 PEDIR NÃO MOVE DINHEIRO. Provado de 1ª mão em 2026-08-04: `POST /services/offerings/:id/bookings`
// → 201, status `requested`, Δbank medido 0 → 0. Por isso `request_quote` é a única das quatro
// ações (comprar · alugar · contratar · solicitar) que já pode acender antes da PORTA-01.

import { useCallback, useEffect, useState } from 'react';
import { getSupplierShowcase, listOrganizerEvents, type ProviderShowcase, type Event } from '../../api/events';
import { requestOfferingBooking, type OfferingBookingResult } from '../../api/offerings';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { formatSupplierPrice } from '../../utils/money';
import './QuoteRequestDialog.css';

interface Props {
  providerActorId: string;
  providerName: string;
  onClose: () => void;
}

function janelaLegivel(inicio: string, fim: string): string {
  const d = new Date(inicio);
  const f = new Date(fim);
  return `${d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} · ` +
    `${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}–` +
    `${f.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function QuoteRequestDialog({ providerActorId, providerName, onClose }: Props) {
  const { activeActor } = useActiveActor();
  const [vitrine, setVitrine] = useState<ProviderShowcase | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [meusEventos, setMeusEventos] = useState<Event[]>([]);

  const [ofertaId, setOfertaId] = useState('');
  const [janelaId, setJanelaId] = useState('');
  const [eventoId, setEventoId] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<OfferingBookingResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSupplierShowcase(providerActorId)
      .then((d) => { if (!cancelled) setVitrine(d); })
      // Falha NÃO vira vitrine vazia: vazio afirmaria "não oferece nada", e não foi o que houve.
      .catch((e) => { if (!cancelled) setErro(e instanceof Error ? e.message : 'Não foi possível carregar as ofertas.'); });
    return () => { cancelled = true; };
  }, [providerActorId]);

  useEffect(() => {
    if (!activeActor?.actor_id) return;
    let cancelled = false;
    listOrganizerEvents(activeActor.actor_id)
      .then((e) => { if (!cancelled) setMeusEventos(e); })
      .catch(() => { /* sem contexto de evento; o pedido segue possível sem ele */ });
    return () => { cancelled = true; };
  }, [activeActor?.actor_id]);

  const oferta = vitrine?.offers.find((o) => o.offerId === ofertaId);
  // 🔴 Só SERVIÇO tem caminho de pedido religado. Locação usa outro writer, ainda sem superfície —
  // e os locáveis vivos não têm agenda publicada, então nem janela haveria para escolher.
  const ofertasPedíveis = (vitrine?.offers ?? []).filter((o) => o.sourceKind === 'service' && o.windows.length > 0);

  const enviar = useCallback(async (): Promise<void> => {
    if (!janelaId || !ofertaId || !activeActor?.actor_id) return;
    setEnviando(true); setErro(null);
    try {
      setResultado(await requestOfferingBooking(ofertaId, {
        availabilityId: janelaId,
        requesterActorId: activeActor.actor_id,
        eventId: eventoId || undefined,
        notes: mensagem.trim() || undefined,
      }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o pedido.');
    } finally {
      setEnviando(false);
    }
  }, [janelaId, ofertaId, activeActor?.actor_id, eventoId, mensagem]);

  return (
    <div className="qrd-overlay" onClick={onClose} role="presentation">
      <div className="qrd" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Solicitar orçamento a ${providerName}`}>
        <div className="qrd-head">
          <h2>Solicitar orçamento</h2>
          <button type="button" className="qrd-fechar" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <p className="qrd-sub">para <strong>{providerName}</strong></p>

        {erro && <p className="qrd-erro">{erro}</p>}
        {!vitrine && !erro && <p className="qrd-muted">Carregando ofertas…</p>}

        {resultado ? (
          <div className="qrd-resultado" role="status">
            {/* REPORTA o que o servidor decidiu. `requested` NÃO é aceite — dizer que é seria mentir. */}
            {resultado.status === 'confirmed'
              ? <p><strong>Reserva confirmada.</strong> Este fornecedor aceita direto nesta condição.</p>
              : <p><strong>Pedido enviado.</strong> Ficou aguardando resposta — o fornecedor decide se aceita.</p>}
            <p className="qrd-detalhe">situação: <code>{resultado.status}</code> · critério: <code>{resultado.gateReason}</code></p>
            <button type="button" className="qrd-enviar" onClick={onClose}>Fechar</button>
          </div>
        ) : vitrine && (
          <>
            {ofertasPedíveis.length === 0 ? (
              <p className="qrd-muted">
                {/* Zero MEDIDO, com o motivo verdadeiro. */}
                Este fornecedor ainda não publicou agenda para nenhuma oferta contratável, então não
                há horário para pedir.
              </p>
            ) : (
              <div className="qrd-form">
                <label className="qrd-campo">
                  <span>O que você precisa</span>
                  <select value={ofertaId} onChange={(e) => { setOfertaId(e.target.value); setJanelaId(''); }}>
                    <option value="">Escolha uma oferta…</option>
                    {ofertasPedíveis.map((o) => (
                      <option key={o.offerId} value={o.offerId}>
                        {o.label ?? 'Oferta'} — {formatSupplierPrice(o)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="qrd-campo">
                  <span>Horário</span>
                  <select value={janelaId} onChange={(e) => setJanelaId(e.target.value)} disabled={!oferta}>
                    <option value="">{oferta ? 'Escolha um horário…' : 'escolha a oferta primeiro'}</option>
                    {(oferta?.windows ?? []).map((w) => (
                      <option key={w.availabilityId} value={w.availabilityId}>{janelaLegivel(w.startAt, w.endAt)}</option>
                    ))}
                  </select>
                </label>

                <label className="qrd-campo">
                  <span>Para qual evento</span>
                  <select value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
                    <option value="">Sem amarrar a um evento</option>
                    {meusEventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                  </select>
                </label>

                <label className="qrd-campo qrd-campo-largo">
                  <span>Detalhes</span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={mensagem}
                    placeholder="Ex.: festa para 200 pessoas, das 20h às 2h, montagem a partir das 16h."
                    onChange={(e) => setMensagem(e.target.value)}
                  />
                </label>

                {!activeActor?.actor_id && <p className="qrd-muted">Escolha um perfil ativo no topo para poder pedir.</p>}

                <button
                  type="button"
                  className="qrd-enviar"
                  disabled={!janelaId || !activeActor?.actor_id || enviando}
                  onClick={() => void enviar()}
                >
                  {enviando ? 'Enviando…' : 'Enviar pedido'}
                </button>
                <p className="qrd-nota">Enviar o pedido não paga nada — é combinação de agenda.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
