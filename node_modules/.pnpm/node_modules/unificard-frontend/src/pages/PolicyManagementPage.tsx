// frontend/src/pages/PolicyManagementPage.tsx
// Policy & Enforcement Engine - Gerenciamento de Políticas
// 🔴 BLINDAGEM: Nenhuma política aplicada automaticamente
// 🔴 BLINDAGEM: Toda ação exige confirmação humana

import { useState, useEffect } from 'react';
import {
  listPolicies,
  createPolicy,
  activatePolicy,
  deactivatePolicy,
  listDecisions,
  applyPolicyDecision,
  revokeDecision,
  evaluatePoliciesForActor,
  type PolicyRule,
  type PolicyDecision,
  type PolicyEvaluationResult,
  type CreatePolicyInput,
  type ApplyPolicyDecisionInput,
} from '../api/policies';
import { showToast } from '../utils/toast';
import './PolicyManagementPage.css';

export default function PolicyManagementPage() {
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [decisions, setDecisions] = useState<PolicyDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<PolicyEvaluationResult[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [policiesData, decisionsData] = await Promise.all([
        listPolicies({ limit: 1000 }),
        listDecisions({ limit: 1000 }),
      ]);

      setPolicies(policiesData);
      setDecisions(decisionsData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePolicy = async (input: CreatePolicyInput) => {
    try {
      await createPolicy(input);
      showToast('Política criada com sucesso', 'success');
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao criar política', 'error');
    }
  };

  const handleActivatePolicy = async (policyId: string) => {
    if (!confirm('Tem certeza que deseja ativar esta política?')) {
      return;
    }

    try {
      await activatePolicy(policyId);
      showToast('Política ativada com sucesso', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao ativar política', 'error');
    }
  };

  const handleDeactivatePolicy = async (policyId: string) => {
    if (!confirm('Tem certeza que deseja desativar esta política?')) {
      return;
    }

    try {
      await deactivatePolicy(policyId);
      showToast('Política desativada com sucesso', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao desativar política', 'error');
    }
  };

  const handleEvaluateActor = async (actorId: string) => {
    try {
      const evals = await evaluatePoliciesForActor(actorId);
      setEvaluations(evals);
      setSelectedActorId(actorId);
      setShowApplyModal(true);
    } catch (err: any) {
      showToast(err.message || 'Erro ao avaliar políticas', 'error');
    }
  };

  const handleApplyDecision = async (input: ApplyPolicyDecisionInput) => {
    if (!confirm('Tem certeza que deseja aplicar esta política? Esta ação será registrada e auditável.')) {
      return;
    }

    try {
      await applyPolicyDecision(input);
      showToast('Política aplicada com sucesso', 'success');
      setShowApplyModal(false);
      setSelectedActorId(null);
      setEvaluations([]);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao aplicar política', 'error');
    }
  };

  const handleRevokeDecision = async (decisionId: string, reason: string) => {
    if (!confirm('Tem certeza que deseja revogar esta decisão?')) {
      return;
    }

    try {
      await revokeDecision(decisionId, reason);
      showToast('Decisão revogada com sucesso', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao revogar decisão', 'error');
    }
  };

  const getPolicyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      feature_throttling: 'Throttling de Features',
      temporary_block: 'Bloqueio Temporário',
      manual_review_required: 'Revisão Manual Obrigatória',
    };
    return labels[type] || type;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      limit_rfq_creation: 'Limitar criação de RFQ',
      limit_booking_creation: 'Limitar criação de Booking',
      limit_messaging: 'Limitar mensagens',
      limit_payouts: 'Limitar payouts',
      block_rfq_creation: 'Bloquear criação de RFQ',
      block_booking_creation: 'Bloquear criação de Booking',
      block_messaging: 'Bloquear mensagens',
      block_payouts: 'Bloquear payouts',
      require_review_rfq: 'Exigir revisão para RFQ',
      require_review_booking: 'Exigir revisão para Booking',
      require_review_payout: 'Exigir revisão para Payout',
    };
    return labels[action] || action;
  };

  if (isLoading) {
    return (
      <div className="policy-management">
        <div className="page-loading">Carregando políticas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="policy-management">
        <div className="page-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="policy-management">
      <div className="page-header">
        <h1>Policy & Enforcement Engine</h1>
        <button className="create-button" onClick={() => setShowCreateModal(true)}>
          Criar Política
        </button>
      </div>

      <div className="policies-section">
        <h2>Políticas</h2>
        <table className="policies-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Versão</th>
              <th>Status</th>
              <th>Ações</th>
              <th>Operações</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy.policyId}>
                <td>
                  <div className="policy-name">{policy.name}</div>
                  <div className="policy-description">{policy.description}</div>
                </td>
                <td>{getPolicyTypeLabel(policy.policyType)}</td>
                <td>{policy.version}</td>
                <td>
                  <span className={`status-badge ${policy.isActive ? 'active' : 'inactive'}`}>
                    {policy.isActive ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td>
                  <div className="actions-list">
                    {policy.actions.map((action, idx) => (
                      <span key={idx} className="action-badge">
                        {getActionLabel(action)}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="policy-actions">
                    {policy.isActive ? (
                      <button
                        className="action-button deactivate"
                        onClick={() => handleDeactivatePolicy(policy.policyId)}
                      >
                        Desativar
                      </button>
                    ) : (
                      <button
                        className="action-button activate"
                        onClick={() => handleActivatePolicy(policy.policyId)}
                      >
                        Ativar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="decisions-section">
        <h2>Decisões Aplicadas</h2>
        <table className="decisions-table">
          <thead>
            <tr>
              <th>Política</th>
              <th>Actor ID</th>
              <th>Status</th>
              <th>Ações Aplicadas</th>
              <th>Razão</th>
              <th>Aplicada em</th>
              <th>Operações</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((decision) => (
              <tr key={decision.decisionId}>
                <td>{decision.policyId.substring(0, 8)}...</td>
                <td className="monospace">{decision.actorId.substring(0, 16)}...</td>
                <td>
                  <span className={`status-badge ${decision.status.toLowerCase()}`}>
                    {decision.status}
                  </span>
                </td>
                <td>
                  <div className="actions-list">
                    {decision.appliedActions.map((action, idx) => (
                      <span key={idx} className="action-badge">
                        {getActionLabel(action)}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{decision.reason}</td>
                <td>{new Date(decision.createdAt).toLocaleString('pt-BR')}</td>
                <td>
                  {decision.status === 'ACTIVE' && (
                    <button
                      className="action-button revoke"
                      onClick={() => {
                        const reason = prompt('Razão da revogação:');
                        if (reason) {
                          handleRevokeDecision(decision.decisionId, reason);
                        }
                      }}
                    >
                      Revogar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreatePolicyModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePolicy}
        />
      )}

      {showApplyModal && selectedActorId && (
        <ApplyPolicyModal
          actorId={selectedActorId}
          evaluations={evaluations}
          onClose={() => {
            setShowApplyModal(false);
            setSelectedActorId(null);
            setEvaluations([]);
          }}
          onApply={handleApplyDecision}
        />
      )}
    </div>
  );
}

// Modal para criar política
function CreatePolicyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: CreatePolicyInput) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [policyType, setPolicyType] = useState<'feature_throttling' | 'temporary_block' | 'manual_review_required'>('feature_throttling');
  const [actions, setActions] = useState<string[]>([]);
  const [minRiskLevel, setMinRiskLevel] = useState<string>('');
  const [maxTrustScore, setMaxTrustScore] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || actions.length === 0) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    const conditions: any = {};
    if (minRiskLevel) conditions.minRiskLevel = minRiskLevel;
    if (maxTrustScore) conditions.maxTrustScore = parseInt(maxTrustScore);

    onCreate({
      name,
      description,
      policyType,
      conditions,
      actions: actions as any,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Criar Política</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Tipo de Política *</label>
            <select
              value={policyType}
              onChange={(e) => setPolicyType(e.target.value as any)}
              required
            >
              <option value="feature_throttling">Feature Throttling</option>
              <option value="temporary_block">Temporary Block</option>
              <option value="manual_review_required">Manual Review Required</option>
            </select>
          </div>
          <div className="form-group">
            <label>Condições</label>
            <div className="conditions-grid">
              <div>
                <label>Risk Level Mínimo:</label>
                <select value={minRiskLevel} onChange={(e) => setMinRiskLevel(e.target.value)}>
                  <option value="">Nenhum</option>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="BLOCKED">BLOCKED</option>
                </select>
              </div>
              <div>
                <label>Trust Score Máximo:</label>
                <input
                  type="number"
                  value={maxTrustScore}
                  onChange={(e) => setMaxTrustScore(e.target.value)}
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>Ações *</label>
            <div className="actions-checkboxes">
              {[
                'limit_rfq_creation',
                'limit_booking_creation',
                'limit_messaging',
                'limit_payouts',
                'block_rfq_creation',
                'block_booking_creation',
                'block_messaging',
                'block_payouts',
                'require_review_rfq',
                'require_review_booking',
                'require_review_payout',
              ].map((action) => (
                <label key={action}>
                  <input
                    type="checkbox"
                    checked={actions.includes(action)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setActions([...actions, action]);
                      } else {
                        setActions(actions.filter((a) => a !== action));
                      }
                    }}
                  />
                  {action.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="submit-button">
              Criar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para aplicar política
function ApplyPolicyModal({
  actorId,
  evaluations,
  onClose,
  onApply,
}: {
  actorId: string;
  evaluations: PolicyEvaluationResult[];
  onClose: () => void;
  onApply: (input: ApplyPolicyDecisionInput) => void;
}) {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicyId || !reason) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    onApply({
      policyId: selectedPolicyId,
      actorId,
      reason,
      expiresAt: expiresAt || undefined,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Aplicar Política</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Actor ID:</label>
            <input type="text" value={actorId} disabled className="monospace" />
          </div>
          <div className="form-group">
            <label>Política Recomendada *</label>
            <select
              value={selectedPolicyId}
              onChange={(e) => setSelectedPolicyId(e.target.value)}
              required
            >
              <option value="">Selecione uma política</option>
              {evaluations
                .filter((e) => e.matches)
                .map((evaluation) => (
                  <option key={evaluation.policyId} value={evaluation.policyId}>
                    {evaluation.policyName} ({evaluation.severity})
                  </option>
                ))}
            </select>
            {evaluations.filter((e) => e.matches).length === 0 && (
              <div className="warning-text">Nenhuma política corresponde ao perfil deste actor</div>
            )}
          </div>
          <div className="form-group">
            <label>Razão *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              placeholder="Explique a razão para aplicar esta política..."
            />
          </div>
          <div className="form-group">
            <label>Expira em (opcional):</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="warning-box">
            <strong>⚠️ Atenção:</strong> Esta ação será registrada no Evidence Pack e auditável. A política será aplicada imediatamente após confirmação.
          </div>
          <div className="modal-footer">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="submit-button" disabled={!selectedPolicyId || !reason}>
              Aplicar Política
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

