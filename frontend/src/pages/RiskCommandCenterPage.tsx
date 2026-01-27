// frontend/src/pages/RiskCommandCenterPage.tsx
// Risk & Trust Command Center
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getRiskDashboardOverview,
  listActorRiskProfiles,
  getActorRiskProfile,
  getActorRiskTimeline,
  type RiskDashboardOverview,
  type ActorRiskProfile,
  type RiskTimelineEvent,
  type ActorRiskFilters,
} from '../api/risk-dashboard';
import { showToast } from '../utils/toast';
import { evaluatePoliciesForActor, applyPolicyDecision, type PolicyEvaluationResult } from '../api/policies';
import './RiskCommandCenterPage.css';

export default function RiskCommandCenterPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<RiskDashboardOverview | null>(null);
  const [profiles, setProfiles] = useState<ActorRiskProfile[]>([]);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ActorRiskProfile | null>(null);
  const [timeline, setTimeline] = useState<RiskTimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActorRiskFilters>({
    limit: 100,
  });
  const [showActorDetail, setShowActorDetail] = useState(false);
  const [showApplyPolicyModal, setShowApplyPolicyModal] = useState(false);
  const [policyEvaluations, setPolicyEvaluations] = useState<PolicyEvaluationResult[]>([]);

  useEffect(() => {
    loadData();
  }, [filters]);

  useEffect(() => {
    if (selectedActorId) {
      loadActorDetail(selectedActorId);
    }
  }, [selectedActorId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [overviewData, profilesData] = await Promise.all([
        getRiskDashboardOverview(),
        listActorRiskProfiles(filters),
      ]);

      setOverview(overviewData);
      setProfiles(profilesData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadActorDetail = async (actorId: string) => {
    try {
      const [profileData, timelineData] = await Promise.all([
        getActorRiskProfile(actorId),
        getActorRiskTimeline(actorId),
      ]);

      setSelectedProfile(profileData);
      setTimeline(timelineData);
      setShowActorDetail(true);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar detalhes do actor', 'error');
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const getRiskLevelColor = (riskLevel: string) => {
    const colors: Record<string, string> = {
      LOW: '#10b981', // Verde
      MEDIUM: '#f59e0b', // Amarelo
      HIGH: '#ef4444', // Laranja
      BLOCKED: '#dc2626', // Vermelho
    };
    return colors[riskLevel] || '#6b7280';
  };

  const getRiskLevelLabel = (riskLevel: string) => {
    const labels: Record<string, string> = {
      LOW: 'Baixo',
      MEDIUM: 'Médio',
      HIGH: 'Alto',
      BLOCKED: 'Bloqueado',
    };
    return labels[riskLevel] || riskLevel;
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      LOW: '#10b981',
      MEDIUM: '#f59e0b',
      HIGH: '#ef4444',
      CRITICAL: '#dc2626',
    };
    return colors[severity] || '#6b7280';
  };

  const handleViewActor = (actorId: string) => {
    setSelectedActorId(actorId);
  };

  const handleCloseActorDetail = () => {
    setShowActorDetail(false);
    setSelectedActorId(null);
    setSelectedProfile(null);
    setTimeline([]);
  };

  const handleViewEvidence = (packId: string) => {
    navigate(`/evidence/${packId}`);
  };

  const handleViewAgreement = (agreementId: string) => {
    navigate(`/agreements/${agreementId}`);
  };

  const handleViewPayout = (orderId: string) => {
    navigate(`/payouts/orders/${orderId}`);
  };

  const handleEvaluatePolicies = async (actorId: string) => {
    try {
      const evals = await evaluatePoliciesForActor(actorId);
      setPolicyEvaluations(evals);
      setShowApplyPolicyModal(true);
    } catch (err: any) {
      showToast(err.message || 'Erro ao avaliar políticas', 'error');
    }
  };

  const handleApplyPolicy = async (policyId: string, reason: string) => {
    if (!selectedActorId) return;

    if (!confirm('Tem certeza que deseja aplicar esta política? Esta ação será registrada e auditável.')) {
      return;
    }

    try {
      await applyPolicyDecision({
        policyId,
        actorId: selectedActorId,
        reason,
      });
      showToast('Política aplicada com sucesso', 'success');
      setShowApplyPolicyModal(false);
      setPolicyEvaluations([]);
      loadActorDetail(selectedActorId);
    } catch (err: any) {
      showToast(err.message || 'Erro ao aplicar política', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="risk-command-center">
        <div className="center-loading">Carregando Risk Command Center...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="risk-command-center">
        <div className="center-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="risk-command-center">
      <div className="center-header">
        <h1>Risk & Trust Command Center</h1>
        <p className="center-subtitle">Monitoramento e governança de riscos da plataforma</p>
      </div>

      {overview && (
        <div className="overview-section">
          <h2>Overview</h2>
          <div className="overview-grid">
            <div className="overview-card">
              <div className="overview-label">Total de Actors</div>
              <div className="overview-value">{overview.totalActors}</div>
            </div>
            <div className="overview-card">
              <div className="overview-label">Actors por Risk Level</div>
              <div className="overview-risk-levels">
                <div className="risk-level-item">
                  <span className="risk-level-badge" style={{ backgroundColor: '#10b981' }}>
                    LOW
                  </span>
                  <span className="risk-level-count">{overview.actorsByRiskLevel.LOW}</span>
                </div>
                <div className="risk-level-item">
                  <span className="risk-level-badge" style={{ backgroundColor: '#f59e0b' }}>
                    MEDIUM
                  </span>
                  <span className="risk-level-count">{overview.actorsByRiskLevel.MEDIUM}</span>
                </div>
                <div className="risk-level-item">
                  <span className="risk-level-badge" style={{ backgroundColor: '#ef4444' }}>
                    HIGH
                  </span>
                  <span className="risk-level-count">{overview.actorsByRiskLevel.HIGH}</span>
                </div>
                <div className="risk-level-item">
                  <span className="risk-level-badge" style={{ backgroundColor: '#dc2626' }}>
                    BLOCKED
                  </span>
                  <span className="risk-level-count">{overview.actorsByRiskLevel.BLOCKED}</span>
                </div>
              </div>
            </div>
            <div className="overview-card">
              <div className="overview-label">Bypass Detectados</div>
              <div className="overview-bypass">
                <div>30 dias: {overview.totalBypassDetected.last30Days}</div>
                <div>90 dias: {overview.totalBypassDetected.last90Days}</div>
                <div>180 dias: {overview.totalBypassDetected.last180Days}</div>
              </div>
            </div>
            <div className="overview-card">
              <div className="overview-label">Disputas Abertas</div>
              <div className="overview-value warning">{overview.openDisputes}</div>
              {overview.averageResolutionTimeDays !== null && (
                <div className="overview-subvalue">
                  Tempo médio: {overview.averageResolutionTimeDays} dias
                </div>
              )}
            </div>
            <div className="overview-card">
              <div className="overview-label">Volume Financeiro</div>
              <div className="overview-value">{formatPrice(overview.totalFinancialVolumeCents, overview.currency)}</div>
            </div>
            <div className="overview-card">
              <div className="overview-label">Payouts Bloqueados</div>
              <div className="overview-value warning">{overview.blockedPayouts}</div>
            </div>
            <div className="overview-card">
              <div className="overview-label">Payouts Falhos</div>
              <div className="overview-value error">{overview.failedPayouts}</div>
            </div>
            <div className="overview-card">
              <div className="overview-label">Agreements Abandonados</div>
              <div className="overview-value">{overview.abandonedAgreements}</div>
            </div>
          </div>
        </div>
      )}

      <div className="actors-section">
        <div className="section-header">
          <h2>Actors</h2>
          <div className="filters">
            <select
              value={filters.riskLevel || ''}
              onChange={(e) =>
                setFilters({ ...filters, riskLevel: (e.target.value || undefined) as any })
              }
            >
              <option value="">Todos os Risk Levels</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={filters.hasOpenDisputes || false}
                onChange={(e) => setFilters({ ...filters, hasOpenDisputes: e.target.checked || undefined })}
              />
              Com Disputas Abertas
            </label>
            <label>
              <input
                type="checkbox"
                checked={filters.hasBypassDetected || false}
                onChange={(e) => setFilters({ ...filters, hasBypassDetected: e.target.checked || undefined })}
              />
              Com Bypass Detectado
            </label>
          </div>
        </div>

        <table className="actors-table">
          <thead>
            <tr>
              <th>Actor ID</th>
              <th>Trust Score</th>
              <th>Risk Level</th>
              <th>Bypass (30d)</th>
              <th>Disputas Abertas</th>
              <th>Volume Financeiro</th>
              <th>Payouts Bloqueados</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.actorId} className={`risk-${profile.riskLevel.toLowerCase()}`}>
                <td className="monospace">{profile.actorId.substring(0, 16)}...</td>
                <td>{profile.currentTrustScore}/100</td>
                <td>
                  <span
                    className="risk-badge"
                    style={{ backgroundColor: getRiskLevelColor(profile.riskLevel) }}
                  >
                    {getRiskLevelLabel(profile.riskLevel)}
                  </span>
                </td>
                <td>
                  {profile.bypassDetected.last30Days > 0 ? (
                    <span className="bypass-alert">{profile.bypassDetected.last30Days}</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  {profile.openDisputes > 0 ? (
                    <span className="dispute-alert">{profile.openDisputes}</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="amount-cell">{formatPrice(profile.financialVolumeCents, profile.currency)}</td>
                <td>
                  {profile.blockedPayouts > 0 ? (
                    <span className="blocked-alert">{profile.blockedPayouts}</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <button
                    className="view-button"
                    onClick={() => handleViewActor(profile.actorId)}
                  >
                    Ver Detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showActorDetail && selectedProfile && (
        <div className="actor-detail-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Detalhes do Actor</h2>
              <button className="close-button" onClick={handleCloseActorDetail}>
                ×
              </button>
            </div>

            <div className="actor-detail">
              <div className="detail-section">
                <h3>Perfil de Risco</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Actor ID:</label>
                    <span className="monospace">{selectedProfile.actorId}</span>
                  </div>
                  <div className="detail-item">
                    <label>Trust Score:</label>
                    <span>{selectedProfile.currentTrustScore}/100</span>
                  </div>
                  <div className="detail-item">
                    <label>Risk Level:</label>
                    <span
                      className="risk-badge"
                      style={{ backgroundColor: getRiskLevelColor(selectedProfile.riskLevel) }}
                    >
                      {getRiskLevelLabel(selectedProfile.riskLevel)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Eventos:</label>
                    <span>
                      {selectedProfile.positiveEvents} + / {selectedProfile.negativeEvents} -
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Bypass Detectado</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Últimos 30 dias:</label>
                    <span>{selectedProfile.bypassDetected.last30Days}</span>
                  </div>
                  <div className="detail-item">
                    <label>Últimos 90 dias:</label>
                    <span>{selectedProfile.bypassDetected.last90Days}</span>
                  </div>
                  <div className="detail-item">
                    <label>Total:</label>
                    <span>{selectedProfile.bypassDetected.total}</span>
                  </div>
                  {selectedProfile.lastBypassAt && (
                    <div className="detail-item">
                      <label>Último Bypass:</label>
                      <span>{new Date(selectedProfile.lastBypassAt).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Disputas</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Abertas:</label>
                    <span className={selectedProfile.openDisputes > 0 ? 'warning' : ''}>
                      {selectedProfile.openDisputes}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Resolvidas:</label>
                    <span>{selectedProfile.resolvedDisputes}</span>
                  </div>
                  {selectedProfile.averageResolutionTimeDays !== null && (
                    <div className="detail-item">
                      <label>Tempo médio de resolução:</label>
                      <span>{selectedProfile.averageResolutionTimeDays} dias</span>
                    </div>
                  )}
                  {selectedProfile.evidencePackIds.length > 0 && (
                    <div className="detail-item">
                      <label>Evidence Packs:</label>
                      <div className="link-list">
                        {selectedProfile.evidencePackIds.slice(0, 5).map((packId) => (
                          <button
                            key={packId}
                            className="link-button"
                            onClick={() => handleViewEvidence(packId)}
                          >
                            {packId.substring(0, 8)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h3>Financeiro</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Volume Total:</label>
                    <span>{formatPrice(selectedProfile.financialVolumeCents, selectedProfile.currency)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Escrow em Hold:</label>
                    <span>{formatPrice(selectedProfile.escrowHeldCents, selectedProfile.currency)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Escrow Liberado:</label>
                    <span>{formatPrice(selectedProfile.escrowReleasedCents, selectedProfile.currency)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Payouts Bloqueados:</label>
                    <span className={selectedProfile.blockedPayouts > 0 ? 'warning' : ''}>
                      {selectedProfile.blockedPayouts}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Payouts Falhos:</label>
                    <span className={selectedProfile.failedPayouts > 0 ? 'error' : ''}>
                      {selectedProfile.failedPayouts}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Ações</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <button
                      className="action-button apply-policy"
                      onClick={() => handleEvaluatePolicies(selectedProfile.actorId)}
                    >
                      Aplicar Política
                    </button>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Timeline de Eventos</h3>
                <div className="timeline">
                  {timeline.slice(0, 50).map((event) => (
                    <div key={event.eventId} className="timeline-event">
                      <div
                        className="timeline-severity"
                        style={{ backgroundColor: getSeverityColor(event.severity) }}
                      />
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <span className="timeline-title">{event.title}</span>
                          <span className="timeline-time">
                            {new Date(event.timestamp).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div className="timeline-description">{event.description}</div>
                        <div className="timeline-meta">
                          <span className="timeline-source">
                            {event.sourceType}: {event.sourceId.substring(0, 8)}...
                          </span>
                          {event.evidencePackId && (
                            <button
                              className="link-button small"
                              onClick={() => handleViewEvidence(event.evidencePackId!)}
                            >
                              Ver Evidence
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showApplyPolicyModal && selectedActorId && (
        <div className="actor-detail-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Aplicar Política</h2>
              <button className="close-button" onClick={() => {
                setShowApplyPolicyModal(false);
                setPolicyEvaluations([]);
              }}>
                ×
              </button>
            </div>
            <div className="actor-detail">
              <div className="detail-section">
                <h3>Políticas Recomendadas</h3>
                {policyEvaluations.filter((e) => e.matches).length === 0 ? (
                  <div className="warning-text">Nenhuma política corresponde ao perfil deste actor</div>
                ) : (
                  <div className="evaluations-list">
                    {policyEvaluations
                      .filter((e) => e.matches)
                      .map((evaluation) => (
                        <div key={evaluation.policyId} className="evaluation-item">
                          <div className="evaluation-header">
                            <span className="evaluation-name">{evaluation.policyName}</span>
                            <span className={`severity-badge severity-${evaluation.severity.toLowerCase()}`}>
                              {evaluation.severity}
                            </span>
                          </div>
                          <div className="evaluation-explanation">{evaluation.explanation}</div>
                          <div className="evaluation-actions">
                            <div className="actions-list">
                              {evaluation.recommendedActions.map((action, idx) => (
                                <span key={idx} className="action-badge">
                                  {action.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            className="apply-policy-button"
                            onClick={() => {
                              const reason = prompt('Razão para aplicar esta política:');
                              if (reason) {
                                handleApplyPolicy(evaluation.policyId, reason);
                              }
                            }}
                          >
                            Aplicar Esta Política
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

