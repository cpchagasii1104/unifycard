// frontend/src/components/authority/OperatorGrantsManager.tsx
// F-MVP-SERVICE-CHAIN-FRONTEND-WIRING-SLICE-1 (GAP-B) — 2026-06-27.
// Superfície MÍNIMA do PROVIDER para conceder a um operador a capability NÃO-financeira de LEITURA
// 'service_order:view' (DECISION-0136). Hospedada na Central do prestador (ProviderServiceHubPage),
// escopada ao actor ativo (a empresa que o membro representa). O backend decide a autoridade
// (canRepresentActor(scopeActorId)); esta tela só projeta a concessão e a revogação.
// NÃO concede financial-terms/status/update/cancel/refund/dispute/payout (capabilityKey é fixo e
// tipado p/ NÃO-financeiro). NÃO usa business-permissions como concessor, NÃO usa organization_*,
// NÃO toca Bank. "Frontend nunca cria verdade — projeta verdade resolvida."

import { useState, useEffect, useCallback } from 'react';
import {
  listGrantsForScope,
  createGrant,
  revokeGrant,
  type ActorCapabilityGrant,
} from '../../api/authority-grants';
import { showToast } from '../common/Toast';
import { shortId } from '../../utils/service-orders-helpers';
import './OperatorGrantsManager.css';

const CAPABILITY = 'service_order:view' as const;

interface OperatorGrantsManagerProps {
  /** Actor do provider (empresa) cujas ordens o operador poderá VER. Escopo da concessão. */
  scopeActorId: string;
  scopeActorName?: string;
}

export default function OperatorGrantsManager({ scopeActorId, scopeActorName }: OperatorGrantsManagerProps) {
  const [grants, setGrants] = useState<ActorCapabilityGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [granteeRef, setGranteeRef] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!scopeActorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listGrantsForScope(scopeActorId, {
        capabilityKey: CAPABILITY,
        status: 'active',
      });
      setGrants(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível carregar as concessões.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [scopeActorId]);

  useEffect(() => {
    load();
  }, [load]);

  // Heurística leve só para escolher o campo certo (id vs slug). O backend é a verdade.
  const looksLikeUuid = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = granteeRef.trim();
    if (!ref) {
      showToast('Informe o operador (actor id ou slug).', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await createGrant({
        scopeActorId,
        capabilityKey: CAPABILITY,
        ...(looksLikeUuid(ref) ? { granteeActorId: ref } : { granteeActorSlug: ref }),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      showToast('Acesso de leitura concedido ao operador.', 'success');
      setGranteeRef('');
      setReason('');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível conceder o acesso.';
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (grantId: string) => {
    setRevokingId(grantId);
    try {
      await revokeGrant(grantId);
      showToast('Acesso revogado.', 'success');
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível revogar o acesso.';
      showToast(message, 'error');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="operator-grants">
      <div className="operator-grants-head">
        <h2>Operadores com acesso de leitura às ordens</h2>
        <p className="operator-grants-sub">
          Conceda a um operador permissão apenas para <strong>ver</strong> as ordens de
          {scopeActorName ? ` ${scopeActorName}` : ' sua empresa'}. Não dá acesso a valores
          financeiros, nem permite confirmar, iniciar, concluir ou cancelar.
        </p>
      </div>

      <form className="operator-grants-form" onSubmit={handleGrant}>
        <label>
          Operador (actor id ou slug)
          <input
            type="text"
            value={granteeRef}
            onChange={(e) => setGranteeRef(e.target.value)}
            placeholder="ex.: 1a2b3c…-… ou nome-do-operador"
            disabled={submitting}
          />
        </label>
        <label>
          Motivo (opcional)
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ex.: atendimento da recepção"
            maxLength={500}
            disabled={submitting}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Concedendo…' : 'Conceder acesso de leitura'}
        </button>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? (
        <p className="operator-grants-empty">Carregando concessões…</p>
      ) : grants.length === 0 ? (
        <p className="operator-grants-empty">Nenhum operador com acesso no momento.</p>
      ) : (
        <ul className="operator-grants-list">
          {grants.map((g) => (
            <li key={g.grantId} className="operator-grants-row">
              <div className="operator-grants-info">
                <strong title={g.granteeActorId}>operador: {shortId(g.granteeActorId)}</strong>
                <span className="muted">
                  ver ordens · concedido em {new Date(g.createdAt).toLocaleDateString('pt-BR')}
                  {g.validUntil ? ` · expira ${new Date(g.validUntil).toLocaleDateString('pt-BR')}` : ''}
                </span>
                {g.reason && <span className="muted">motivo: {g.reason}</span>}
              </div>
              <button
                className="btn-secondary"
                onClick={() => handleRevoke(g.grantId)}
                disabled={revokingId === g.grantId}
              >
                {revokingId === g.grantId ? 'Revogando…' : 'Revogar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
