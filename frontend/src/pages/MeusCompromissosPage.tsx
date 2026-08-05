// src/pages/MeusCompromissosPage.tsx
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - NÃO bloqueia fluxos institucionais
// - Apenas coleta, exibe e orienta
//
// Arquétipo: Entity Listing Page
// Listagem homogênea de compromissos (read-only)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCommitments, type Commitments } from '../api/commitments';
import { getPendingResponsibilities, type PendingResponsibilities } from '../api/pendingResponsibilities';
import { getImpactOverview, type ImpactOverview } from '../api/impactOverview';
import { confirmBooking, cancelBooking } from '../api/availability';
import { showToast } from '../components/common/Toast';
import './MeusCompromissosPage.css';

export default function MeusCompromissosPage() {
  const navigate = useNavigate();
  const [commitments, setCommitments] = useState<Commitments | null>(null);
  const [pendingResponsibilities, setPendingResponsibilities] = useState<PendingResponsibilities | null>(null);
  const [impactOverview, setImpactOverview] = useState<ImpactOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // qual pedido está sendo respondido — trava os dois botões daquele card, não da lista inteira
  const [respondendo, setRespondendo] = useState<string | null>(null);

  useEffect(() => {
    loadCommitments();
  }, []);

  const loadCommitments = async () => {
    setLoading(true);
    setError(null);
    try {
      const [commitmentsData, pendingData, impactData] = await Promise.all([
        getCommitments(),
        getPendingResponsibilities().catch(() => null), // Não bloquear se pendências falhar
        getImpactOverview().catch(() => null), // Não bloquear se impacto falhar
      ]);
      setCommitments(commitmentsData);
      setPendingResponsibilities(pendingData);
      setImpactOverview(impactData);
    } catch (err) {
      console.error('Erro ao carregar compromissos:', err);
      setError('Não foi possível carregar seus compromissos agora. Por favor, tente novamente em alguns instantes.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🔴 RESPONDER AO PEDIDO — as duas rotas já existiam e não tinham de onde ser chamadas (2026-08-05).
   *
   * `PUT /availability/bookings/:id` só aceita `confirmed` ou `cancelled` (o backend recusa status
   * arbitrário) — a tela NÃO escolhe estado livre, escolhe entre os dois que o domínio permite.
   *
   * Quem decide de verdade é o servidor: o confirm passa pelo lock transacional por recurso/provider
   * e pode devolver **409 RENTAL_RESOURCE_TIME_CONFLICT** se alguém confirmou o mesmo período antes.
   * Por isso o erro é MOSTRADO, nunca engolido — e a lista é recarregada em qualquer desfecho, para
   * a tela voltar a refletir o que o backend diz, e não o que ela achou que ia acontecer.
   */
  const responderPedido = async (bookingId: string, acao: 'aceitar' | 'recusar'): Promise<void> => {
    setRespondendo(bookingId);
    try {
      if (acao === 'aceitar') await confirmBooking(bookingId);
      else await cancelBooking(bookingId);
      showToast(acao === 'aceitar' ? 'Pedido aceito.' : 'Pedido recusado.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showToast(
        msg.includes('TIME_CONFLICT')
          ? 'Este período acabou de ser confirmado para outra pessoa.'
          : msg || 'Não foi possível responder ao pedido.',
        'error'
      );
    } finally {
      setRespondendo(null);
      await loadCommitments();
    }
  };

  // 🔴 2026-08-04 — aceita null porque a data PODE não existir: evento declarado sem agenda
  // confirmada é estado real do domínio. Dizer "sem data confirmada" é a verdade; `new Date(null)`
  // produziria 01/01/1970 — uma data INVENTADA, que é o erro mais caro que uma agenda pode cometer.
  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return 'sem data confirmada';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'data inválida';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="meus-compromissos-page">
        <div className="meus-compromissos-loading">Carregando compromissos...</div>
      </div>
    );
  }

  if (error || !commitments) {
    return (
      <div className="meus-compromissos-page">
        <div className="meus-compromissos-error">
          <p>{error || 'Erro ao carregar compromissos'}</p>
          <button onClick={loadCommitments} className="meus-compromissos-retry">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="meus-compromissos-page">
      <h1>Meus Compromissos</h1>

      {/* Eventos que participo */}
      <section className="meus-compromissos-section">
        <h2>Eventos que participo ({commitments.eventsParticipating.length})</h2>
        {commitments.eventsParticipating.length === 0 ? (
          <p className="meus-compromissos-empty">Você não está participando de nenhum evento no momento.</p>
        ) : (
          <div className="meus-compromissos-list">
            {commitments.eventsParticipating.map((event) => (
              <div
                key={event.eventId}
                className="meus-compromissos-item"
                onClick={() => navigate(`/events/${event.eventId}`)}
              >
                <div className="meus-compromissos-item-header">
                  <h3>{event.title}</h3>
                  {event.checkedIn && <span className="meus-compromissos-badge checked-in">✓ Check-in realizado</span>}
                </div>
                <div className="meus-compromissos-item-details">
                  <p>Início: {formatDateTime(event.startTime)}</p>
                  <p>Fim: {formatDateTime(event.endTime)}</p>
                  <p>Status: {event.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Eventos que organizo */}
      <section className="meus-compromissos-section">
        <h2>Eventos que organizo ({commitments.eventsOrganizing.length})</h2>
        {commitments.eventsOrganizing.length === 0 ? (
          <p className="meus-compromissos-empty">Você não está organizando nenhum evento no momento.</p>
        ) : (
          <div className="meus-compromissos-list">
            {commitments.eventsOrganizing.map((event) => (
              <div
                key={event.eventId}
                className="meus-compromissos-item"
                onClick={() => navigate(`/events/${event.eventId}`)}
              >
                <div className="meus-compromissos-item-header">
                  <h3>{event.title}</h3>
                </div>
                <div className="meus-compromissos-item-details">
                  <p>Início: {formatDateTime(event.startTime)}</p>
                  <p>Fim: {formatDateTime(event.endTime)}</p>
                  <p>Status: {event.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Grupos que gerencio */}
      <section className="meus-compromissos-section">
        <h2>Grupos que gerencio ({commitments.groupsManaging.length})</h2>
        {commitments.groupsManaging.length === 0 ? (
          <p className="meus-compromissos-empty">Você não gerencia nenhum grupo no momento.</p>
        ) : (
          <div className="meus-compromissos-list">
            {commitments.groupsManaging.map((group) => (
              <div
                key={group.groupId}
                className="meus-compromissos-item"
                onClick={() => navigate(`/grupos/${group.groupId}`)}
              >
                <div className="meus-compromissos-item-header">
                  <h3>{group.name}</h3>
                  {group.isActive && <span className="meus-compromissos-badge active">Ativo</span>}
                </div>
                <div className="meus-compromissos-item-details">
                  <p>Criado em: {formatDateTime(group.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Agenda (próximos compromissos) */}
      <section className="meus-compromissos-section">
        <h2>Agenda - Próximos compromissos ({commitments.agendaBookings.length})</h2>
        {commitments.agendaBookings.length === 0 ? (
          <p className="meus-compromissos-empty">Você não tem compromissos agendados no momento.</p>
        ) : (
          <div className="meus-compromissos-list">
            {commitments.agendaBookings.map((booking) => (
              <div
                key={booking.bookingId}
                className="meus-compromissos-item"
                onClick={() => navigate(`/availability/${booking.availabilityId}`)}
              >
                <div className="meus-compromissos-item-header">
                  <h3>Compromisso agendado</h3>
                  <span className={`meus-compromissos-badge status-${booking.status}`}>{booking.status}</span>
                </div>
                <div className="meus-compromissos-item-details">
                  <p>Início: {formatDateTime(booking.startDatetime)}</p>
                  <p>Fim: {formatDateTime(booking.endDatetime)}</p>
                  <p>Solicitado em: {formatDateTime(booking.requestedAt)}</p>
                  {/* A mensagem do pedido. Antes ela era gravada e nunca mostrada a ninguém. */}
                  {booking.notes && <p className="meus-compromissos-notes">“{booking.notes}”</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── PEDIDOS RECEBIDOS — o lado de quem FORNECE (2026-08-04) ──
          Não existia. A seção acima é a agenda de quem PEDE (`requester_actor_id`); quem RECEBIA
          um pedido não tinha onde vê-lo. Renderiza só quando há algo: seção vazia permanente
          ensinaria que o recurso não funciona. */}
      {commitments.incomingRequests.length > 0 && (
        <section className="meus-compromissos-section">
          <h2>Pedidos recebidos ({commitments.incomingRequests.length})</h2>
          <div className="meus-compromissos-list">
            {commitments.incomingRequests.map((pedido) => (
              <div key={pedido.bookingId} className="meus-compromissos-item">
                <div className="meus-compromissos-item-header">
                  <h3>{pedido.offerLabel ?? 'Pedido'}</h3>
                  <span className={`meus-compromissos-badge status-${pedido.status}`}>
                    {/* Rótulo em português SEM inventar estado: o vocabulário é o do CHECK físico. */}
                    {pedido.status === 'requested' ? 'aguardando você' : pedido.status}
                  </span>
                </div>
                <div className="meus-compromissos-item-details">
                  <p>De: {pedido.requesterDisplayName ?? 'Solicitante sem nome de exibição'}</p>
                  <p>Início: {formatDateTime(pedido.startDatetime)}</p>
                  <p>Fim: {formatDateTime(pedido.endDatetime)}</p>
                  {pedido.notes && <p className="meus-compromissos-notes">“{pedido.notes}”</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pendências (inbox) */}
      <section className="meus-compromissos-section">
        <h2>Pendências</h2>
        <div className="meus-compromissos-inbox">
          {commitments.inboxPendingCount > 0 ? (
            <div
              className="meus-compromissos-item meus-compromissos-inbox-item"
              onClick={() => navigate('/inbox')}
            >
              <div className="meus-compromissos-item-header">
                <h3>Você tem {commitments.inboxPendingCount} {commitments.inboxPendingCount === 1 ? 'pendência' : 'pendências'}</h3>
                <span className="meus-compromissos-badge pending">Pendente</span>
              </div>
              <p className="meus-compromissos-inbox-hint">Clique para ver detalhes</p>
            </div>
          ) : (
            <p className="meus-compromissos-empty">Nenhuma pendência no momento.</p>
          )}
        </div>
      </section>

      {/* Resumo Econômico */}
      {commitments.economySummary && (
        <section className="meus-compromissos-section">
          <h2>Resumo Econômico</h2>
          <div className="meus-compromissos-economy">
            <div className="meus-compromissos-economy-item">
              <strong>Total Envolvido:</strong>{' '}
              <span>{commitments.economySummary.totalInvolved} transações</span>
            </div>
            <div className="meus-compromissos-economy-item">
              <strong>Total Gasto:</strong>{' '}
              <span>R$ {(commitments.economySummary.totalSpent / 100).toFixed(2)}</span>
            </div>
            <div className="meus-compromissos-economy-item">
              <strong>Total Recebido:</strong>{' '}
              <span>R$ {(commitments.economySummary.totalReceived / 100).toFixed(2)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Impacto Atual */}
      {impactOverview && (
        <section className="meus-compromissos-section">
          <h2>Impacto Atual</h2>
          <div className="meus-compromissos-impact">
            {impactOverview.pendingImpact.peopleWaiting > 0 && (
              <div className="meus-compromissos-impact-item">
                <p>
                  {impactOverview.pendingImpact.peopleWaiting}{' '}
                  {impactOverview.pendingImpact.peopleWaiting === 1 ? 'pessoa aguarda' : 'pessoas aguardam'}{' '}
                  decisões em eventos que você organiza
                </p>
              </div>
            )}
            {impactOverview.pendingImpact.moneyLockedCents > 0 && (
              <div className="meus-compromissos-impact-item">
                <p>
                  {impactOverview.pendingImpact.moneyLockedCents >= 100
                    ? `R$ ${(impactOverview.pendingImpact.moneyLockedCents / 100).toFixed(2)}`
                    : `${impactOverview.pendingImpact.moneyLockedCents} centavos`}{' '}
                  estão vinculados a ações pendentes
                </p>
              </div>
            )}
            {impactOverview.pendingImpact.eventsAffected > 0 && (
              <div className="meus-compromissos-impact-item">
                <p>
                  {impactOverview.pendingImpact.eventsAffected}{' '}
                  {impactOverview.pendingImpact.eventsAffected === 1 ? 'evento está' : 'eventos estão'}{' '}
                  aguardando ação
                </p>
              </div>
            )}
            {impactOverview.neutralImpact.ongoingEvents > 0 && (
              <div className="meus-compromissos-impact-item neutral">
                <p>
                  {impactOverview.neutralImpact.ongoingEvents}{' '}
                  {impactOverview.neutralImpact.ongoingEvents === 1 ? 'evento em andamento' : 'eventos em andamento'}
                </p>
              </div>
            )}
            {impactOverview.neutralImpact.activeGroups > 0 && (
              <div className="meus-compromissos-impact-item neutral">
                <p>
                  {impactOverview.neutralImpact.activeGroups}{' '}
                  {impactOverview.neutralImpact.activeGroups === 1 ? 'grupo ativo' : 'grupos ativos'}
                </p>
              </div>
            )}
            {impactOverview.pendingImpact.peopleWaiting === 0 &&
              impactOverview.pendingImpact.moneyLockedCents === 0 &&
              impactOverview.pendingImpact.eventsAffected === 0 &&
              impactOverview.neutralImpact.ongoingEvents === 0 &&
              impactOverview.neutralImpact.activeGroups === 0 && (
                <p className="meus-compromissos-empty">Nenhum impacto registrado no momento.</p>
              )}
          </div>
        </section>
      )}

      {/* Pendências */}
      {pendingResponsibilities && (
        <section className="meus-compromissos-section">
          <h2>Pendências</h2>
          
          {/* Eventos Pendentes */}
          {pendingResponsibilities.pendingEvents.length > 0 && (
            <div className="meus-compromissos-pending-subsection">
              <h3>Eventos ({pendingResponsibilities.pendingEvents.length})</h3>
              <div className="meus-compromissos-list">
                {pendingResponsibilities.pendingEvents.map((item) => (
                  <div
                    key={item.id}
                    className="meus-compromissos-item"
                    onClick={() => navigate(`/events/${item.id}`)}
                  >
                    <div className="meus-compromissos-item-header">
                      <h4>{item.title}</h4>
                      <span className={`meus-compromissos-badge status-${item.status}`}>{item.status}</span>
                    </div>
                    <div className="meus-compromissos-item-details">
                      <p>Tipo: Evento</p>
                      <p>Status: {item.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grupos Pendentes */}
          {pendingResponsibilities.pendingGroups.length > 0 && (
            <div className="meus-compromissos-pending-subsection">
              <h3>Grupos ({pendingResponsibilities.pendingGroups.length})</h3>
              <div className="meus-compromissos-list">
                {pendingResponsibilities.pendingGroups.map((item) => (
                  <div
                    key={item.id}
                    className="meus-compromissos-item"
                    onClick={() => navigate(`/grupos/${item.id}`)}
                  >
                    <div className="meus-compromissos-item-header">
                      <h4>{item.name}</h4>
                      <span className={`meus-compromissos-badge status-${item.status}`}>{item.status}</span>
                    </div>
                    <div className="meus-compromissos-item-details">
                      <p>Tipo: Grupo</p>
                      {item.needsFinancialPurpose && (
                        <p className="meus-compromissos-warning">⚠️ Precisa definir finalidade financeira</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Serviços Pendentes */}
          {pendingResponsibilities.pendingServices.length > 0 && (
            <div className="meus-compromissos-pending-subsection">
              <h3>Serviços ({pendingResponsibilities.pendingServices.length})</h3>
              <div className="meus-compromissos-list">
                {pendingResponsibilities.pendingServices.map((item) => (
                  <div
                    key={item.id}
                    className="meus-compromissos-item"
                    onClick={() => navigate(`/services/${item.id}`)}
                  >
                    <div className="meus-compromissos-item-header">
                      <h4>{item.title}</h4>
                      <span className={`meus-compromissos-badge status-${item.status}`}>{item.status}</span>
                    </div>
                    <div className="meus-compromissos-item-details">
                      <p>Tipo: Serviço</p>
                      <p>{item.pendingBookingsCount} {item.pendingBookingsCount === 1 ? 'solicitação pendente' : 'solicitações pendentes'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagamentos Pendentes */}
          {pendingResponsibilities.pendingPayments.length > 0 && (
            <div className="meus-compromissos-pending-subsection">
              <h3>Pagamentos ({pendingResponsibilities.pendingPayments.length})</h3>
              <div className="meus-compromissos-list">
                {pendingResponsibilities.pendingPayments.map((item) => (
                  <div
                    key={item.id}
                    className="meus-compromissos-item"
                    onClick={() => item.serviceId && navigate(`/services/${item.serviceId}`)}
                  >
                    <div className="meus-compromissos-item-header">
                      <h4>Pagamento Pendente</h4>
                      <span className={`meus-compromissos-badge status-${item.status}`}>{item.status}</span>
                    </div>
                    <div className="meus-compromissos-item-details">
                      <p>Tipo: Pagamento</p>
                      <p>Valor: {item.currency === 'FIC' ? `${item.amount.toFixed(2)} FIC` : `R$ ${(item.amount / 100).toFixed(2)}`}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bookings Pendentes */}
          {pendingResponsibilities.pendingBookings.length > 0 && (
            <div className="meus-compromissos-pending-subsection">
              <h3>Reservas ({pendingResponsibilities.pendingBookings.length})</h3>
              <div className="meus-compromissos-list">
                {/* 🔴 2026-08-05 — ERA UM CARD MUDO, E O CLIQUE IA PARA LUGAR NENHUM.
                    Mostrava "Reserva Pendente" + início + fim, e navegava para `/availability/:id`,
                    ROTA QUE NÃO EXISTE (conferido em App.tsx). O dono tinha que aceitar ou recusar
                    um pedido sem saber de quem era, para quê, nem o que a pessoa precisava — e o
                    único caminho a mais levava a uma tela inexistente.
                    Todo dado abaixo vem RESOLVIDO do servidor; a tela não deduz nada. */}
                {pendingResponsibilities.pendingBookings.map((item) => (
                  <div key={item.id} className="meus-compromissos-item">
                    <div className="meus-compromissos-item-header">
                      <h4>{item.requester?.displayName ?? 'Solicitante'}</h4>
                      <span className={`meus-compromissos-badge status-${item.status}`}>{item.status}</span>
                    </div>
                    <div className="meus-compromissos-item-details">
                      <p>{formatDateTime(item.startDatetime)} — {formatDateTime(item.endDatetime)}</p>
                      {/* Evento: só aparece quando o servidor mandou. Ausente ≠ "sem evento". */}
                      {item.eventTitle && <p>Para: <strong>{item.eventTitle}</strong></p>}
                      {item.notes && <p className="mc-pedido-detalhe">“{item.notes}”</p>}
                      {/* QUEM PEDE — os dois fatos que dá para medir hoje. Reputação segue fora:
                          5 substratos com 0 linhas, e score inventado na hora do aceite é mentira
                          justamente no momento em que ela custa mais caro. */}
                      <p className="mc-pedido-quem">
                        {item.requester?.completedCommitments ?? 0} compromisso(s) cumprido(s)
                        {item.requester?.memberSince
                          ? ` · no UnifiCard desde ${new Date(item.requester.memberSince).toLocaleDateString('pt-BR')}`
                          : ''}
                      </p>
                    </div>
                    <div className="mc-pedido-acoes">
                      <button
                        type="button"
                        className="mc-pedido-aceitar"
                        disabled={respondendo === item.id}
                        onClick={() => void responderPedido(item.id, 'aceitar')}
                      >
                        {respondendo === item.id ? '…' : 'Aceitar'}
                      </button>
                      <button
                        type="button"
                        className="mc-pedido-recusar"
                        disabled={respondendo === item.id}
                        onClick={() => void responderPedido(item.id, 'recusar')}
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingResponsibilities.pendingEvents.length === 0 &&
            pendingResponsibilities.pendingGroups.length === 0 &&
            pendingResponsibilities.pendingServices.length === 0 &&
            pendingResponsibilities.pendingPayments.length === 0 &&
            pendingResponsibilities.pendingBookings.length === 0 && (
              <p className="meus-compromissos-empty">Nenhuma pendência no momento.</p>
            )}
        </section>
      )}
    </div>
  );
}

