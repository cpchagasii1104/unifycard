// frontend/src/pages/PilotObserverPage.tsx
// CONTINUOUS PRODUCTION: Página de Observação de Piloto - SPRINT 13/14/15
// Painel interno simples para visualizar eventos, convites, fricções e acompanhamento humano

import { useState, useEffect } from 'react';
import { isPilotMode } from '../config/pilot';
import { listPilotEvents, type PilotEvent, type PilotEventType } from '../api/pilot';
import { listPilotInvites, revokePilotInvite, type PilotInvite, type PilotInviteStatus } from '../api/pilot-invites';
import {
  listObservationUsers,
  getChecklist,
  initializeChecklist,
  updateChecklistItem,
  getNotes,
  createNote,
  deleteNote,
  type PilotChecklistItem,
  type PilotNote,
} from '../api/pilot-observation';
import {
  listHypotheses,
  createHypothesis,
  deleteHypothesis,
  type PilotHypothesis,
} from '../api/pilot-hypotheses';
import { InstitutionalRhythmReading } from '../utils/institutional-rhythm';
import { InstitutionalReviewRitual } from '../utils/institutional-review-ritual';
import { InstitutionalReadingFrame } from '../utils/institutional-reading-principles';
import { InstitutionalMemory } from '../utils/institutional-memory';
import { InstitutionalSemanticAlignment } from '../utils/institutional-semantic-alignment';
import './PilotObserverPage.css';

type TabType = 'events' | 'invites' | 'frictions' | 'observation' | 'reading';

export default function PilotObserverPage() {
  const [activeTab, setActiveTab] = useState<TabType>('events');
  const [events, setEvents] = useState<PilotEvent[]>([]);
  const [invites, setInvites] = useState<PilotInvite[]>([]);
  const [frictions, setFrictions] = useState<PilotEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // SPRINT 15: Observação humana
  const [observationUsers, setObservationUsers] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<PilotChecklistItem[]>([]);
  const [notes, setNotes] = useState<PilotNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [observationLoading, setObservationLoading] = useState(false);
  
  // SPRINT 16: Leitura institucional
  const [selectedReadingUserId, setSelectedReadingUserId] = useState<string | null>(null);
  const [userEvents, setUserEvents] = useState<PilotEvent[]>([]);
  const [userFrictions, setUserFrictions] = useState<PilotEvent[]>([]);
  const [userChecklist, setUserChecklist] = useState<PilotChecklistItem[]>([]);
  const [userNotes, setUserNotes] = useState<PilotNote[]>([]);
  const [hypotheses, setHypotheses] = useState<PilotHypothesis[]>([]);
  const [newHypothesisContent, setNewHypothesisContent] = useState('');
  const [readingLoading, setReadingLoading] = useState(false);

  useEffect(() => {
    loadData();
    // Atualizar a cada 10 segundos
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // SPRINT 15: Carregar dados de observação quando aba estiver ativa
  useEffect(() => {
    if (activeTab === 'observation') {
      loadObservationData();
    }
  }, [activeTab]);

  // SPRINT 15: Carregar checklist e notas quando usuário for selecionado
  useEffect(() => {
    if (activeTab === 'observation' && selectedUserId) {
      loadUserObservation(selectedUserId);
    }
  }, [activeTab, selectedUserId]);

  // SPRINT 16: Carregar dados de leitura quando aba estiver ativa
  useEffect(() => {
    if (activeTab === 'reading') {
      loadReadingData();
    }
  }, [activeTab]);

  // SPRINT 16: Carregar visão cruzada quando usuário for selecionado na aba Leitura
  useEffect(() => {
    if (activeTab === 'reading' && selectedReadingUserId) {
      loadUserReading(selectedReadingUserId);
    }
  }, [activeTab, selectedReadingUserId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar eventos normais
      const pilotEvents = await listPilotEvents({ limit: 100 });
      setEvents(pilotEvents);
      
      // Carregar convites
      const pilotInvites = await listPilotInvites({ limit: 100 });
      setInvites(pilotInvites);
      
      // Carregar fricções (eventos de fricção)
      const frictionTypes: PilotEventType[] = [
        'invite_not_used',
        'signup_abandoned',
        'first_action_timeout',
        'workflow_started_not_completed',
      ];
      const frictionEvents = pilotEvents.filter(e => frictionTypes.includes(e.eventType));
      setFrictions(frictionEvents);
      
      setLoading(false);
    } catch (error) {
      console.warn('[PilotObserver] Erro ao carregar dados:', error);
      setLoading(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Tem certeza que deseja revogar este convite?')) {
      return;
    }

    try {
      await revokePilotInvite(inviteId);
      await loadData();
    } catch (error) {
      console.error('[PilotObserver] Erro ao revogar convite:', error);
      alert('Erro ao revogar convite');
    }
  };

  // SPRINT 15: Carregar dados de observação
  const loadObservationData = async () => {
    try {
      setObservationLoading(true);
      const users = await listObservationUsers();
      setObservationUsers(users);
      setObservationLoading(false);
    } catch (error) {
      console.error('[PilotObserver] Erro ao carregar usuários:', error);
      setObservationLoading(false);
    }
  };

  // SPRINT 15: Carregar checklist e notas de um usuário
  const loadUserObservation = async (userId: string) => {
    try {
      setObservationLoading(true);
      const [checklistData, notesData] = await Promise.all([
        getChecklist(userId),
        getNotes(userId),
      ]);
      setChecklist(checklistData);
      setNotes(notesData);
      setObservationLoading(false);
    } catch (error) {
      console.error('[PilotObserver] Erro ao carregar observação:', error);
      setObservationLoading(false);
    }
  };

  // SPRINT 15: Inicializar checklist
  const handleInitializeChecklist = async (userId: string) => {
    try {
      const items = await initializeChecklist(userId);
      setChecklist(items);
    } catch (error) {
      console.error('[PilotObserver] Erro ao inicializar checklist:', error);
      alert('Erro ao inicializar checklist');
    }
  };

  // SPRINT 15: Atualizar item do checklist
  const handleToggleChecklistItem = async (
    userId: string,
    itemKey: string,
    itemLabel: string,
    checked: boolean
  ) => {
    try {
      await updateChecklistItem(userId, itemKey, itemLabel, !checked);
      await loadUserObservation(userId);
    } catch (error) {
      console.error('[PilotObserver] Erro ao atualizar checklist:', error);
      alert('Erro ao atualizar checklist');
    }
  };

  // SPRINT 15: Criar nota
  const handleCreateNote = async (userId: string) => {
    if (!newNoteContent.trim()) {
      return;
    }

    try {
      await createNote(userId, newNoteContent.trim());
      setNewNoteContent('');
      await loadUserObservation(userId);
    } catch (error) {
      console.error('[PilotObserver] Erro ao criar nota:', error);
      alert('Erro ao criar nota');
    }
  };

  // SPRINT 15: Deletar nota
  const handleDeleteNote = async (noteId: string, userId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta nota?')) {
      return;
    }

    try {
      await deleteNote(noteId);
      await loadUserObservation(userId);
    } catch (error) {
      console.error('[PilotObserver] Erro ao deletar nota:', error);
      alert('Erro ao deletar nota');
    }
  };

  // SPRINT 16: Carregar dados de leitura
  const loadReadingData = async () => {
    try {
      setReadingLoading(true);
      const [hypothesesData, usersData] = await Promise.all([
        listHypotheses({ limit: 100 }),
        listObservationUsers(),
      ]);
      setHypotheses(hypothesesData);
      setObservationUsers(usersData);
      setReadingLoading(false);
    } catch (error) {
      console.error('[PilotObserver] Erro ao carregar dados de leitura:', error);
      setReadingLoading(false);
    }
  };

  // SPRINT 16: Carregar visão cruzada de um usuário
  const loadUserReading = async (userId: string) => {
    try {
      setReadingLoading(true);
      
      // Carregar todos os dados do usuário
      const [eventsData, checklistData, notesData] = await Promise.all([
        listPilotEvents({ limit: 100 }),
        getChecklist(userId),
        getNotes(userId),
      ]);

      // Filtrar eventos e fricções do usuário
      const userEventsFiltered = eventsData.filter(
        (e) => e.actorId === userId && !['invite_not_used', 'signup_abandoned', 'first_action_timeout', 'workflow_started_not_completed'].includes(e.eventType)
      );
      const userFrictionsFiltered = eventsData.filter(
        (e) => e.actorId === userId && ['invite_not_used', 'signup_abandoned', 'first_action_timeout', 'workflow_started_not_completed'].includes(e.eventType)
      );

      setUserEvents(userEventsFiltered);
      setUserFrictions(userFrictionsFiltered);
      setUserChecklist(checklistData);
      setUserNotes(notesData);
      setReadingLoading(false);
    } catch (error) {
      console.error('[PilotObserver] Erro ao carregar leitura do usuário:', error);
      setReadingLoading(false);
    }
  };

  // SPRINT 16: Criar hipótese
  const handleCreateHypothesis = async () => {
    if (!newHypothesisContent.trim()) {
      return;
    }

    try {
      await createHypothesis(newHypothesisContent.trim());
      setNewHypothesisContent('');
      await loadReadingData();
    } catch (error) {
      console.error('[PilotObserver] Erro ao criar hipótese:', error);
      alert('Erro ao criar hipótese');
    }
  };

  // SPRINT 16: Deletar hipótese
  const handleDeleteHypothesis = async (hypothesisId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta hipótese?')) {
      return;
    }

    try {
      await deleteHypothesis(hypothesisId);
      await loadReadingData();
    } catch (error) {
      console.error('[PilotObserver] Erro ao deletar hipótese:', error);
      alert('Erro ao deletar hipótese');
    }
  };

  // SPRINT 16: Agrupar fricções por tipo
  const groupFrictionsByType = (frictions: PilotEvent[]): Record<string, PilotEvent[]> => {
    const grouped: Record<string, PilotEvent[]> = {};
    frictions.forEach((friction) => {
      if (!grouped[friction.eventType]) {
        grouped[friction.eventType] = [];
      }
      grouped[friction.eventType].push(friction);
    });
    return grouped;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const getEventTypeLabel = (type: PilotEventType): string => {
    const labels: Record<PilotEventType, string> = {
      first_action_executed: 'Primeira ação executada',
      first_company_created: 'Primeira empresa criada',
      first_delegation: 'Primeira delegação',
      first_dispute_opened: 'Primeira disputa aberta',
      first_transaction: 'Primeira transação',
      first_group_allocation: 'Primeira alocação de grupo',
      first_workflow_completed: 'Primeiro workflow completado',
      first_member_invited: 'Primeiro membro convidado',
      // SPRINT 14: Fricções
      invite_not_used: 'Convite não utilizado',
      signup_abandoned: 'Cadastro abandonado',
      first_action_timeout: 'Timeout na primeira ação',
      workflow_started_not_completed: 'Workflow iniciado não completado',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: PilotInviteStatus): string => {
    const labels: Record<PilotInviteStatus, string> = {
      pending: 'Pendente',
      accepted: 'Aceito',
      revoked: 'Revogado',
      expired: 'Expirado',
    };
    return labels[status];
  };

  if (!isPilotMode()) {
    return (
      <div className="pilot-observer-page">
        <div className="pilot-observer-disabled">
          <p>Modo piloto não está ativo.</p>
          <p className="pilot-observer-hint">
            Para ativar, defina VITE_PILOT_MODE=true no arquivo .env
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pilot-observer-page">
        <div className="pilot-observer-loading">
          <p>Carregando eventos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pilot-observer-page">
      <div className="pilot-observer-header">
        <h1>Observação de Piloto</h1>
        <p className="pilot-observer-subtitle">
          Painel interno para observação do modo piloto
        </p>
      </div>

      {/* Tabs */}
      <div className="pilot-observer-tabs">
        <button
          className={`pilot-observer-tab ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Eventos ({events.length})
        </button>
        <button
          className={`pilot-observer-tab ${activeTab === 'invites' ? 'active' : ''}`}
          onClick={() => setActiveTab('invites')}
        >
          Convites ({invites.length})
        </button>
        <button
          className={`pilot-observer-tab ${activeTab === 'frictions' ? 'active' : ''}`}
          onClick={() => setActiveTab('frictions')}
        >
          Fricções ({frictions.length})
        </button>
        <button
          className={`pilot-observer-tab ${activeTab === 'observation' ? 'active' : ''}`}
          onClick={() => setActiveTab('observation')}
        >
          Acompanhamento
        </button>
        <button
          className={`pilot-observer-tab ${activeTab === 'reading' ? 'active' : ''}`}
          onClick={() => setActiveTab('reading')}
        >
          Leitura
        </button>
      </div>

      {/* SPRINT 16: Aviso sobre não usar métricas automáticas */}
      {isPilotMode() && (
        <div style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          color: '#856404',
          fontSize: '0.9rem',
        }}>
          <strong>⚠️ Regra de Ouro:</strong> Nenhuma decisão de produto será tomada com base em métricas automáticas do piloto.
          <br />
          <small style={{ fontStyle: 'italic', marginTop: '0.5rem', display: 'block' }}>
            (SPRINT 32: Decisões relacionadas devem declarar seu escopo em INSTITUTIONAL_DECISION_SCOPE.md)
          </small>
        </div>
      )}

      {/* Conteúdo das tabs */}
      {activeTab === 'events' && (
        <>
          {events.length === 0 ? (
            <div className="pilot-observer-empty">
              <p>Nenhum evento observado ainda.</p>
              <p className="pilot-observer-hint">
                Eventos serão registrados conforme usuários interagirem com o sistema.
              </p>
            </div>
          ) : (
            <div className="pilot-observer-list">
              {events.map((event) => (
                <div key={event.eventId} className="pilot-observer-item">
                  <div className="pilot-observer-item-header">
                    <span className="pilot-observer-event-type">
                      {getEventTypeLabel(event.eventType)}
                    </span>
                    <span className="pilot-observer-timestamp">
                      {formatDate(event.createdAt)}
                    </span>
                  </div>
                  <div className="pilot-observer-item-details">
                    <div className="pilot-observer-detail">
                      <span className="pilot-observer-label">Actor:</span>
                      <span className="pilot-observer-value" title={event.actorId}>
                        {event.actorId.substring(0, 8)}... ({event.actorType})
                      </span>
                    </div>
                    <div className="pilot-observer-detail">
                      <span className="pilot-observer-label">Ocorreu em:</span>
                      <span className="pilot-observer-value">
                        {formatDate(event.occurredAt)}
                      </span>
                    </div>
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="pilot-observer-detail">
                        <span className="pilot-observer-label">Metadados:</span>
                        <span className="pilot-observer-value">
                          {JSON.stringify(event.metadata, null, 2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'invites' && (
        <>
          {invites.length === 0 ? (
            <div className="pilot-observer-empty">
              <p>Nenhum convite ainda.</p>
            </div>
          ) : (
            <div className="pilot-observer-list">
              {invites.map((invite) => (
                <div key={invite.inviteId} className="pilot-observer-item">
                  <div className="pilot-observer-item-header">
                    <span className="pilot-observer-event-type">
                      {invite.email}
                    </span>
                    <span className={`pilot-observer-status pilot-observer-status-${invite.status}`}>
                      {getStatusLabel(invite.status)}
                    </span>
                  </div>
                  <div className="pilot-observer-item-details">
                    <div className="pilot-observer-detail">
                      <span className="pilot-observer-label">Status:</span>
                      <span className="pilot-observer-value">
                        {getStatusLabel(invite.status)}
                      </span>
                    </div>
                    <div className="pilot-observer-detail">
                      <span className="pilot-observer-label">Convidado em:</span>
                      <span className="pilot-observer-value">
                        {formatDate(invite.invitedAt)}
                      </span>
                    </div>
                    {invite.acceptedAt && (
                      <div className="pilot-observer-detail">
                        <span className="pilot-observer-label">Aceito em:</span>
                        <span className="pilot-observer-value">
                          {formatDate(invite.acceptedAt)}
                        </span>
                      </div>
                    )}
                    <div className="pilot-observer-detail">
                      <span className="pilot-observer-label">Expira em:</span>
                      <span className="pilot-observer-value">
                        {formatDate(invite.expiresAt)}
                      </span>
                    </div>
                    {invite.status === 'pending' && (
                      <div className="pilot-observer-item-actions">
                        <button
                          className="pilot-observer-button-revoke"
                          onClick={() => handleRevokeInvite(invite.inviteId)}
                        >
                          Revogar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'frictions' && (
        <>
          {frictions.length === 0 ? (
            <div className="pilot-observer-empty">
              <p>Nenhuma fricção observada ainda.</p>
            </div>
          ) : (
            <div className="pilot-observer-list">
              {frictions.map((friction) => (
                <div key={friction.eventId} className="pilot-observer-item">
                  <div className="pilot-observer-item-header">
                    <span className="pilot-observer-event-type">
                      {getEventTypeLabel(friction.eventType)}
                    </span>
                    <span className="pilot-observer-timestamp">
                      {formatDate(friction.createdAt)}
                    </span>
                  </div>
                  <div className="pilot-observer-item-details">
                    <div className="pilot-observer-detail">
                      <span className="pilot-observer-label">Ocorreu em:</span>
                      <span className="pilot-observer-value">
                        {formatDate(friction.occurredAt)}
                      </span>
                    </div>
                    {friction.actorId && (
                      <div className="pilot-observer-detail">
                        <span className="pilot-observer-label">Actor:</span>
                        <span className="pilot-observer-value" title={friction.actorId}>
                          {friction.actorId.substring(0, 8)}... ({friction.actorType})
                        </span>
                      </div>
                    )}
                    {friction.metadata && Object.keys(friction.metadata).length > 0 && (
                      <div className="pilot-observer-detail">
                        <span className="pilot-observer-label">Metadados:</span>
                        <span className="pilot-observer-value">
                          {JSON.stringify(friction.metadata, null, 2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'observation' && (
        <>
          {observationLoading ? (
            <div className="pilot-observer-loading">
              <p>Carregando...</p>
            </div>
          ) : (
            <div className="pilot-observer-observation">
              {/* Seletor de usuário */}
              <div className="pilot-observer-user-selector">
                <label>
                  <strong>Usuário:</strong>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) => setSelectedUserId(e.target.value || null)}
                    style={{ marginLeft: '0.5rem', padding: '0.5rem' }}
                  >
                    <option value="">Selecione um usuário</option>
                    {observationUsers.map((userId) => (
                      <option key={userId} value={userId}>
                        {userId.substring(0, 8)}...
                      </option>
                    ))}
                  </select>
                </label>
                {selectedUserId && checklist.length === 0 && (
                  <button
                    className="pilot-observer-button-initialize"
                    onClick={() => handleInitializeChecklist(selectedUserId)}
                    style={{ marginLeft: '1rem', padding: '0.5rem 1rem' }}
                  >
                    Inicializar Checklist
                  </button>
                )}
              </div>

              {selectedUserId && (
                <div className="pilot-observer-observation-content">
                  {/* Checklist */}
                  <div className="pilot-observer-section">
                    <h2>Checklist</h2>
                    {checklist.length === 0 ? (
                      <p className="pilot-observer-hint">
                        Clique em "Inicializar Checklist" para começar.
                      </p>
                    ) : (
                      <div className="pilot-observer-checklist">
                        {checklist.map((item) => (
                          <div key={item.checklistId} className="pilot-observer-checklist-item">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={() =>
                                  handleToggleChecklistItem(
                                    selectedUserId,
                                    item.itemKey,
                                    item.itemLabel,
                                    item.checked
                                  )
                                }
                              />
                              <span>{item.itemLabel}</span>
                            </label>
                            {item.checked && item.checkedAt && (
                              <span className="pilot-observer-checked-date">
                                Marcado em {formatDate(item.checkedAt)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notas */}
                  <div className="pilot-observer-section">
                    <h2>Notas</h2>
                    <div className="pilot-observer-notes-form">
                      <textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Adicionar nota..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          marginBottom: '0.5rem',
                          border: '1px solid #e0e0e0',
                          borderRadius: '4px',
                        }}
                      />
                      <button
                        onClick={() => handleCreateNote(selectedUserId)}
                        disabled={!newNoteContent.trim()}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: newNoteContent.trim() ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Adicionar Nota
                      </button>
                    </div>
                    <div className="pilot-observer-notes-list">
                      {notes.length === 0 ? (
                        <p className="pilot-observer-hint">Nenhuma nota ainda.</p>
                      ) : (
                        notes.map((note) => (
                          <div key={note.noteId} className="pilot-observer-note">
                            <div className="pilot-observer-note-header">
                              <span className="pilot-observer-timestamp">
                                {formatDate(note.createdAt)}
                              </span>
                              <button
                                className="pilot-observer-button-delete"
                                onClick={() => handleDeleteNote(note.noteId, selectedUserId)}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  background: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                }}
                              >
                                Deletar
                              </button>
                            </div>
                            <div className="pilot-observer-note-content">{note.content}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!selectedUserId && (
                <div className="pilot-observer-empty">
                  <p>Selecione um usuário para ver o acompanhamento.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'reading' && (
        <>
          {readingLoading ? (
            <div className="pilot-observer-loading">
              <p>Carregando...</p>
            </div>
          ) : (
            <div className="pilot-observer-reading">
              {/* Seletor de usuário para visão cruzada */}
              <div className="pilot-observer-user-selector">
                <label>
                  <strong>Usuário (visão cruzada):</strong>
                  <select
                    value={selectedReadingUserId || ''}
                    onChange={(e) => setSelectedReadingUserId(e.target.value || null)}
                    style={{ marginLeft: '0.5rem', padding: '0.5rem' }}
                  >
                    <option value="">Selecione um usuário</option>
                    {observationUsers.map((userId) => (
                      <option key={userId} value={userId}>
                        {userId.substring(0, 8)}...
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedReadingUserId ? (
                <div className="pilot-observer-reading-content">
                  {/* Visão Cruzada por Usuário */}
                  <div className="pilot-observer-section">
                    <h2>Visão Cruzada - {selectedReadingUserId.substring(0, 8)}...</h2>
                    
                    {/* Eventos Observados */}
                    <div className="pilot-observer-subsection">
                      <h3>Eventos Observados</h3>
                      {userEvents.length === 0 ? (
                        <p className="pilot-observer-hint">Nenhum evento observado.</p>
                      ) : (
                        <div className="pilot-observer-list">
                          {userEvents.map((event) => (
                            <div key={event.eventId} className="pilot-observer-item">
                              <div className="pilot-observer-item-header">
                                <span className="pilot-observer-event-type">
                                  {getEventTypeLabel(event.eventType)}
                                </span>
                                <span className="pilot-observer-timestamp">
                                  {formatDate(event.occurredAt)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Fricções Registradas */}
                    <div className="pilot-observer-subsection">
                      <h3>Fricções Registradas</h3>
                      {userFrictions.length === 0 ? (
                        <p className="pilot-observer-hint">Nenhuma fricção registrada.</p>
                      ) : (
                        <div className="pilot-observer-list">
                          {userFrictions.map((friction) => (
                            <div key={friction.eventId} className="pilot-observer-item">
                              <div className="pilot-observer-item-header">
                                <span className="pilot-observer-event-type">
                                  {getEventTypeLabel(friction.eventType)}
                                </span>
                                <span className="pilot-observer-timestamp">
                                  {formatDate(friction.occurredAt)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Checklist Humano */}
                    <div className="pilot-observer-subsection">
                      <h3>Checklist Humano</h3>
                      {userChecklist.length === 0 ? (
                        <p className="pilot-observer-hint">Nenhum item de checklist.</p>
                      ) : (
                        <div className="pilot-observer-checklist">
                          {userChecklist.map((item) => (
                            <div key={item.checklistId} className="pilot-observer-checklist-item">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  disabled
                                  readOnly
                                />
                                <span>{item.itemLabel}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Notas Humanas */}
                    <div className="pilot-observer-subsection">
                      <h3>Notas Humanas</h3>
                      {userNotes.length === 0 ? (
                        <p className="pilot-observer-hint">Nenhuma nota.</p>
                      ) : (
                        <div className="pilot-observer-notes-list">
                          {userNotes.map((note) => (
                            <div key={note.noteId} className="pilot-observer-note">
                              <div className="pilot-observer-note-header">
                                <span className="pilot-observer-timestamp">
                                  {formatDate(note.createdAt)}
                                </span>
                              </div>
                              <div className="pilot-observer-note-content">{note.content}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pilot-observer-reading-overview">
                  {/* SPRINT 23: Ritmo Institucional */}
                  <div className="pilot-observer-section">
                    <InstitutionalRhythmReading events={events} />
                  </div>

                  {/* SPRINT 24: Ritual de Revisão Institucional */}
                  <div className="pilot-observer-section">
                    <InstitutionalReviewRitual />
                  </div>

                  {/* SPRINT 25: Quadro de Leitura Institucional Compartilhada */}
                  <div className="pilot-observer-section">
                    <InstitutionalReadingFrame />
                  </div>

                  {/* SPRINT 26: Memória Institucional Declarativa */}
                  <div className="pilot-observer-section">
                    <InstitutionalMemory />
                  </div>

                  {/* SPRINT 27: Alinhamento Semântico Institucional */}
                  <div className="pilot-observer-section">
                    <InstitutionalSemanticAlignment />
                  </div>

                  {/* Fricções Agrupadas por Tipo */}
                  <div className="pilot-observer-section">
                    <h2>Fricções Observadas</h2>
                    {frictions.length === 0 ? (
                      <p className="pilot-observer-hint">Nenhuma fricção observada ainda.</p>
                    ) : (
                      <div className="pilot-observer-frictions-grouped">
                        {Object.entries(groupFrictionsByType(frictions)).map(([type, typeFrictions]) => (
                          <div key={type} className="pilot-observer-friction-group">
                            <h3>{getEventTypeLabel(type as PilotEventType)}</h3>
                            {/* SPRINT 23: Removido contagem - apenas descrição qualitativa */}
                            <div className="pilot-observer-list">
                              {typeFrictions
                                .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
                                .map((friction) => (
                                  <div key={friction.eventId} className="pilot-observer-item">
                                    <div className="pilot-observer-item-header">
                                      <span className="pilot-observer-timestamp">
                                        {formatDate(friction.occurredAt)}
                                      </span>
                                    </div>
                                    {friction.actorId && (
                                      <div className="pilot-observer-item-details">
                                        <div className="pilot-observer-detail">
                                          <span className="pilot-observer-label">Actor:</span>
                                          <span className="pilot-observer-value" title={friction.actorId}>
                                            {friction.actorId.substring(0, 8)}...
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hipóteses do Operador */}
                  <div className="pilot-observer-section">
                    <h2>Hipóteses do Operador</h2>
                    <div className="pilot-observer-hypotheses-form">
                      <textarea
                        value={newHypothesisContent}
                        onChange={(e) => setNewHypothesisContent(e.target.value)}
                        placeholder="Adicionar hipótese sobre o piloto..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          marginBottom: '0.5rem',
                          border: '1px solid #e0e0e0',
                          borderRadius: '4px',
                        }}
                      />
                      <button
                        onClick={handleCreateHypothesis}
                        disabled={!newHypothesisContent.trim()}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: newHypothesisContent.trim() ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Adicionar Hipótese
                      </button>
                    </div>
                    <div className="pilot-observer-hypotheses-list">
                      {hypotheses.length === 0 ? (
                        <p className="pilot-observer-hint">Nenhuma hipótese ainda.</p>
                      ) : (
                        hypotheses.map((hypothesis) => (
                          <div key={hypothesis.hypothesisId} className="pilot-observer-note">
                            <div className="pilot-observer-note-header">
                              <span className="pilot-observer-timestamp">
                                {formatDate(hypothesis.createdAt)}
                              </span>
                              <button
                                className="pilot-observer-button-delete"
                                onClick={() => handleDeleteHypothesis(hypothesis.hypothesisId)}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  background: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                }}
                              >
                                Deletar
                              </button>
                            </div>
                            <div className="pilot-observer-note-content">{hypothesis.content}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
