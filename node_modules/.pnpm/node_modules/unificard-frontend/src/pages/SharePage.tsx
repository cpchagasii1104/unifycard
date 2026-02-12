// frontend/src/pages/SharePage.tsx
// Landing do link compartilhável com ações possíveis (ActionRouter)

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getPublicationMetadata, getReactionCounts } from '../api/publication';
import { getEventById } from '../api/events';
import { upsertRSVP, getRSVPStatus, getRSVPCounts, removeRSVP } from '../api/event-rsvp';
import { downloadICS } from '../utils/calendar';
import type { PublicationMetadata, EntityType } from '../types/publication';
import type { RSVPStatus } from '../types/event-rsvp';
import './SharePage.css';

export default function SharePage() {
  const { entityType, entityId } = useParams<{ entityType: EntityType; entityId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [metadata, setMetadata] = useState<PublicationMetadata | null>(null);
  const [entity, setEntity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [rsvpStatus, setRsvpStatus] = useState<RSVPStatus | null>(null);
  const [rsvpCounts, setRsvpCounts] = useState<{ yes: number; no: number; maybe: number } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Extrair referral code da URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref);
      // Armazenar em localStorage para uso futuro (signup/login)
      localStorage.setItem('pending_referral', JSON.stringify({
        code: ref,
        entityType,
        entityId,
        timestamp: Date.now(),
      }));
      
      // Logar abertura do link (stub - será implementado no backend)
      // TODO: Chamar endpoint para logar OPEN_LINK
    }
  }, [searchParams, entityType, entityId]);

  // Carregar metadados e entidade
  useEffect(() => {
    if (!entityType || !entityId) {
      setError('Tipo ou ID da entidade não fornecido');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Carregar metadados de publicação
        const pubMetadata = await getPublicationMetadata(entityType, entityId);
        setMetadata(pubMetadata);

        // Carregar entidade específica
        if (entityType === 'event') {
          const eventData = await getEventById(entityId);
          setEntity(eventData.event);
          
          // Carregar RSVP status e contagens
          try {
            const [rsvp, counts] = await Promise.all([
              getRSVPStatus(entityId),
              getRSVPCounts(entityId),
            ]);
            if (rsvp) {
              setRsvpStatus(rsvp.status);
            }
            setRsvpCounts(counts);
          } catch (err) {
            // Não bloquear se RSVP falhar
            console.warn('Erro ao carregar RSVP:', err);
          }
        } else if (entityType === 'post') {
          // TODO: Implementar getPostById quando existir
          setError('Posts ainda não implementados');
        } else if (entityType === 'group') {
          // TODO: Implementar getGroupById quando existir
          setError('Grupos ainda não implementados');
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [entityType, entityId]);

  // Handlers de ações
  const handleRSVP = async (status: RSVPStatus) => {
    if (!entityId || entityType !== 'event') return;
    
    try {
      setLoading(true);
      setActionFeedback(null);
      
      await upsertRSVP(entityId, { status });
      setRsvpStatus(status);
      
      // Recarregar contagens
      const counts = await getRSVPCounts(entityId);
      setRsvpCounts(counts);
      
      setActionFeedback(
        status === 'yes' ? '✅ Presença confirmada!' :
        status === 'maybe' ? '🤔 Status atualizado para "Talvez"' :
        '❌ Status atualizado para "Não vou"'
      );
      
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      setActionFeedback('Erro ao confirmar presença. Tente novamente.');
      console.error('Erro ao fazer RSVP:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRSVP = async () => {
    if (!entityId || entityType !== 'event') return;
    
    try {
      setLoading(true);
      setActionFeedback(null);
      
      await removeRSVP(entityId);
      setRsvpStatus(null);
      
      // Recarregar contagens
      const counts = await getRSVPCounts(entityId);
      setRsvpCounts(counts);
      
      setActionFeedback('Confirmação removida');
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      setActionFeedback('Erro ao remover confirmação. Tente novamente.');
      console.error('Erro ao remover RSVP:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCalendar = () => {
    if (!entity || !entity.datetime_start || !entity.datetime_end) {
      setActionFeedback('Evento sem data/hora definida');
      return;
    }
    
    try {
      const startDate = new Date(entity.datetime_start);
      const endDate = new Date(entity.datetime_end);
      
      downloadICS(
        entity.title,
        entity.description || null,
        startDate,
        endDate,
        entity.location_name || null
      );
      
      setActionFeedback('📥 Arquivo .ics baixado! Adicione ao seu calendário.');
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      setActionFeedback('Erro ao gerar arquivo de calendário');
      console.error('Erro ao gerar .ics:', err);
    }
  };

  const handleContribute = () => {
    if (!entityId) return;
    
    setActionFeedback('Redirecionando para contribuição...');
    
    // TODO: Redirecionar para fluxo financeiro (Unify Bank)
    // Por enquanto, apenas mostrar mensagem
    setTimeout(() => {
      setActionFeedback('Funcionalidade de contribuição em breve');
    }, 1000);
  };

  // Verificar se usuário pode ver (stub - será implementado com canUserSee)
  const canSee = metadata?.visibility === 'public' || metadata?.visibility === 'unlisted';

  if (loading) {
    return (
      <div className="share-page">
        <div className="share-loading">Carregando...</div>
      </div>
    );
  }

  if (error || !metadata || !canSee) {
    return (
      <div className="share-page">
        <div className="share-error">
          <h2>Conteúdo não disponível</h2>
          <p>{error || 'Você não tem permissão para ver este conteúdo.'}</p>
          <button onClick={() => navigate('/home')}>Voltar ao início</button>
        </div>
      </div>
    );
  }

  return (
    <div className="share-page">
      <div className="share-container">
        {/* Header com informações básicas */}
        <div className="share-header">
          {entityType === 'event' && entity && (
            <>
              <h1>{entity.title}</h1>
              {entity.description && <p className="share-description">{entity.description}</p>}
              {entity.datetime_start && (
                <div className="share-date">
                  📅 {new Date(entity.datetime_start).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Ações possíveis (cards) */}
        <div className="share-actions">
          <h2>Ações disponíveis</h2>
          
          {entityType === 'event' && (
            <>
              {/* RSVP */}
              <div className="action-card">
                <div className="action-icon">✋</div>
                <div className="action-content">
                  <h3>Confirmar presença (RSVP)</h3>
                  <p>
                    {rsvpStatus === 'yes' && '✅ Presença confirmada'}
                    {rsvpStatus === 'no' && '❌ Presença negada'}
                    {rsvpStatus === 'maybe' && '🤔 Talvez compareça'}
                    {!rsvpStatus && 'Confirme sua participação no evento'}
                  </p>
                  {rsvpCounts && (
                    <p className="rsvp-counts">
                      {rsvpCounts.yes} confirmados • {rsvpCounts.maybe} talvez • {rsvpCounts.no} não vão
                    </p>
                  )}
                  <div className="rsvp-buttons">
                    {rsvpStatus !== 'yes' && (
                      <button
                        className="action-button action-button-success"
                        onClick={() => handleRSVP('yes')}
                        disabled={loading}
                      >
                        ✅ Vou
                      </button>
                    )}
                    {rsvpStatus !== 'maybe' && (
                      <button
                        className="action-button action-button-warning"
                        onClick={() => handleRSVP('maybe')}
                        disabled={loading}
                      >
                        🤔 Talvez
                      </button>
                    )}
                    {rsvpStatus !== 'no' && (
                      <button
                        className="action-button action-button-danger"
                        onClick={() => handleRSVP('no')}
                        disabled={loading}
                      >
                        ❌ Não vou
                      </button>
                    )}
                    {rsvpStatus && (
                      <button
                        className="action-button action-button-secondary"
                        onClick={handleRemoveRSVP}
                        disabled={loading}
                      >
                        Remover confirmação
                      </button>
                    )}
                  </div>
                  {actionFeedback && actionFeedback.includes('confirmada') && (
                    <p className="action-feedback">{actionFeedback}</p>
                  )}
                </div>
              </div>

              {/* Adicionar à Agenda */}
              {entity.datetime_start && (
                <div className="action-card">
                  <div className="action-icon">📅</div>
                  <div className="action-content">
                    <h3>Adicionar à agenda</h3>
                    <p>Baixe o arquivo .ics para adicionar ao seu calendário</p>
                    <button
                      className="action-button"
                      onClick={handleAddToCalendar}
                      disabled={loading}
                    >
                      📥 Baixar .ics
                    </button>
                    {actionFeedback && actionFeedback.includes('agenda') && (
                      <p className="action-feedback">{actionFeedback}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Contribuir/Pagar */}
              {metadata?.invitations_enabled && entity.economy_type && entity.economy_type !== 'free' && (
                <div className="action-card">
                  <div className="action-icon">💳</div>
                  <div className="action-content">
                    <h3>Contribuir / Pagar</h3>
                    <p>Faça sua contribuição ou compre ingressos</p>
                    <button
                      className="action-button"
                      onClick={handleContribute}
                      disabled={loading}
                    >
                      Contribuir
                    </button>
                    {actionFeedback && actionFeedback.includes('contribuição') && (
                      <p className="action-feedback">{actionFeedback}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Ver detalhes */}
              <div className="action-card">
                <div className="action-icon">📋</div>
                <div className="action-content">
                  <h3>Abrir detalhes do evento</h3>
                  <p>Veja todas as informações completas</p>
                  <button
                    className="action-button"
                    onClick={() => navigate(`/events/${entityId}`)}
                  >
                    Ver detalhes
                  </button>
                </div>
              </div>
            </>
          )}

          {entityType === 'group' && (
            <div className="action-card">
              <div className="action-icon">👥</div>
              <div className="action-content">
                <h3>Solicitar entrada / Entrar no grupo</h3>
                <p>Participe deste grupo</p>
                <button
                  className="action-button"
                  onClick={() => {
                    // TODO: Implementar entrada no grupo quando existir feature
                    alert('Funcionalidade de grupos em breve');
                  }}
                >
                  Entrar no grupo
                </button>
              </div>
            </div>
          )}

          {entityType === 'post' && (
            <div className="action-card">
              <div className="action-icon">👁️</div>
              <div className="action-content">
                <h3>Ver post</h3>
                <p>Visualize o conteúdo completo</p>
                <button
                  className="action-button"
                  onClick={() => {
                    // TODO: Implementar visualização de post quando existir feature
                    alert('Funcionalidade de posts em breve');
                  }}
                >
                  Ver post
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Referral code (se existir) */}
        {referralCode && (
          <div className="share-referral">
            <p>Você acessou este link com código de indicação: <strong>{referralCode}</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}

