// frontend/src/admin/ServiceCurationQueue.tsx
// F-SERVICE-CURATION-HEAD-SLICE-A — a "cabeça" da esteira de curadoria de SERVIÇO (item 2b da fila).
// Backend JÁ COMPLETO: GET /catalog/governance/curation/queue (products+services) · approve · reject
// (D2, 2026-07-06) — todos admin-gated no BACKEND (requireRole; 403 honesto se não-admin).
// SEM MERGE nesta UI (D3: merge não re-aponta dependentes — fica fora até a fatia de re-point).
// Frontend só PROJETA: não cria concept/canonical/status; toda decisão é do backend.
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { showToast } from '../components/common/Toast';
import './ServiceCurationQueue.css';

interface PendingService {
  canonicalServiceId: string;
  name: string;
  slug: string;
  tenantId: string | null;
  conceptId: string;
}

export default function ServiceCurationQueue() {
  const [services, setServices] = useState<PendingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch('/catalog/governance/curation/queue');
      if (r.status === 403) { setError('Acesso restrito a curadores (admin).'); setServices([]); return; }
      const body = await r.json();
      setServices(body?.data?.services ?? []);
    } catch {
      setError('Falha ao carregar a fila de curadoria.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id);
    try {
      const r = await apiFetch(`/catalog/governance/curation/services/${id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action === 'reject' ? { reason: rejectReason[id] || undefined } : {}),
      });
      if (r.ok) {
        showToast(action === 'approve' ? 'Serviço aprovado no catálogo.' : 'Sugestão rejeitada.', 'success');
        await load();
      } else {
        const b = await r.json().catch(() => null);
        showToast(b?.message || `Falha ao ${action === 'approve' ? 'aprovar' : 'rejeitar'} (${r.status}).`, 'error');
      }
    } catch {
      showToast('Erro de rede na curadoria.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="svc-curation">
      <header className="svc-curation__head">
        <h1>Curadoria de serviços</h1>
        <p>
          Sugestões de serviço pendentes de curadoria. Aprovar ativa o serviço no catálogo do tenant de
          origem (escopo <code>scoped</code> — promoção a global é ato de plataforma, fora desta tela);
          rejeitar retira a sugestão com trilha auditável.
        </p>
      </header>

      {loading && <p className="svc-curation__muted">Carregando fila…</p>}
      {error && <p className="svc-curation__error">{error}</p>}
      {!loading && !error && services.length === 0 && (
        <p className="svc-curation__muted">Nenhuma sugestão de serviço pendente. 🎉</p>
      )}

      <ul className="svc-curation__list">
        {services.map((s) => (
          <li key={s.canonicalServiceId} className="svc-curation__item">
            <div className="svc-curation__info">
              <strong>{s.name}</strong>
              <span className="svc-curation__slug">{s.slug}</span>
            </div>
            <div className="svc-curation__actions">
              <input
                type="text"
                placeholder="Motivo da rejeição (opcional)"
                value={rejectReason[s.canonicalServiceId] ?? ''}
                onChange={(e) => setRejectReason((m) => ({ ...m, [s.canonicalServiceId]: e.target.value }))}
                disabled={busy === s.canonicalServiceId}
              />
              <button
                className="svc-curation__approve"
                disabled={busy === s.canonicalServiceId}
                onClick={() => void act(s.canonicalServiceId, 'approve')}
              >
                Aprovar
              </button>
              <button
                className="svc-curation__reject"
                disabled={busy === s.canonicalServiceId}
                onClick={() => void act(s.canonicalServiceId, 'reject')}
              >
                Rejeitar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
