// frontend/src/admin/KybReviewBackoffice.tsx
// CP2 F-PJ-HUMAN-TO-COMPANY (PJ-B2): BACKOFFICE MÍNIMO do reviewer humano de KYB PJ.
//
// Superfície mínima para operar o backend já vivo (DECISION-0086/0087/0101): fila de requests,
// filtro por status, documentos da identidade fiscal, download protegido, accept/reject de
// documento (reason), approve/reject da request (reason), revogação de aprovação (reason).
// NÃO é ERP: sem auto-review, sem aprovação automática, sem "verificado" sem estado.
// Autoridade = backend (requireRole admin + reviewer humano fail-closed); 403 → acesso restrito.

import { useCallback, useEffect, useState } from 'react';
import {
  getKybQueue,
  getKybDocuments,
  downloadKybDocument,
  reviewKybDocument,
  reviewKybRequest,
  revokeKybApproval,
  type KybQueueRow,
  type KybAdminDocument,
} from '../api/kyb-admin';
import { showToast } from '../components/common/Toast';
import './KybReviewBackoffice.css';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  suspended: 'Suspenso',
  closed: 'Encerrado',
  submitted: 'Enviado',
  accepted: 'Aceito',
  superseded: 'Substituído',
};

const DOC_TYPE_LABEL: Record<string, string> = {
  cnpj_registration: 'Cartão CNPJ',
  articles_of_association: 'Contrato social',
};

export default function KybReviewBackoffice() {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [queue, setQueue] = useState<KybQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [selected, setSelected] = useState<KybQueueRow | null>(null);
  const [documents, setDocuments] = useState<KybAdminDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await getKybQueue(statusFilter || undefined);
      setQueue(rows);
      setForbidden(false);
    } catch (err: any) {
      if (err?.code === 'FORBIDDEN' || /403|forbidden|acesso/i.test(String(err?.message))) {
        setForbidden(true);
      } else {
        setLoadError(err instanceof Error ? err.message : 'Erro ao carregar a fila KYB.');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const openRequest = async (row: KybQueueRow): Promise<void> => {
    setSelected(row);
    setDocsLoading(true);
    setDocuments([]);
    try {
      setDocuments(await getKybDocuments(row.fiscalIdentityId));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao listar documentos.', 'error');
    } finally {
      setDocsLoading(false);
    }
  };

  const refreshSelected = async (): Promise<void> => {
    await loadQueue();
    if (selected) {
      try {
        setDocuments(await getKybDocuments(selected.fiscalIdentityId));
      } catch {
        /* erro já visível via toast das ações */
      }
    }
  };

  const handleDownload = async (doc: KybAdminDocument): Promise<void> => {
    try {
      const blob = await downloadKybDocument(doc.documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha no download protegido.', 'error');
    }
  };

  const askReason = (label: string): string | null => {
    const reason = window.prompt(`${label} — informe a justificativa (obrigatória, auditável):`);
    if (reason === null) return null;
    if (!reason.trim()) {
      showToast('Justificativa é obrigatória.', 'error');
      return null;
    }
    return reason.trim();
  };

  const handleDocReview = async (doc: KybAdminDocument, decision: 'accepted' | 'rejected'): Promise<void> => {
    const reason = askReason(`${decision === 'accepted' ? 'Aceitar' : 'Rejeitar'} documento ${DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}`);
    if (!reason) return;
    setActing(true);
    try {
      await reviewKybDocument(doc.documentId, decision, reason);
      showToast(`Documento ${decision === 'accepted' ? 'aceito' : 'rejeitado'}.`, 'success');
      await refreshSelected();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao revisar documento.', 'error');
    } finally {
      setActing(false);
    }
  };

  const handleRequestReview = async (decision: 'approved' | 'rejected'): Promise<void> => {
    if (!selected) return;
    const reason = askReason(`${decision === 'approved' ? 'Aprovar' : 'Rejeitar'} a análise KYB de ${selected.companyName ?? selected.cnpj}`);
    if (!reason) return;
    setActing(true);
    try {
      await reviewKybRequest(selected.kybRequestId, decision, reason);
      showToast(`Análise ${decision === 'approved' ? 'aprovada' : 'rejeitada'}.`, 'success');
      setSelected(null);
      await loadQueue();
    } catch (err) {
      // Erro honesto do gate documental (KYB_APPROVAL_REQUIRES_DOCUMENTS) aparece aqui.
      showToast(err instanceof Error ? err.message : 'Erro ao decidir a análise.', 'error');
    } finally {
      setActing(false);
    }
  };

  const handleRevoke = async (): Promise<void> => {
    if (!selected) return;
    const reason = askReason(`Revogar a aprovação KYB de ${selected.companyName ?? selected.cnpj} (retira publicações em cascata)`);
    if (!reason) return;
    setActing(true);
    try {
      const out = await revokeKybApproval(selected.fiscalIdentityId, 'suspended', reason);
      showToast(`Aprovação revogada (${out.retiredPublications} publicação(ões) retirada(s)).`, 'success');
      setSelected(null);
      await loadQueue();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao revogar aprovação.', 'error');
    } finally {
      setActing(false);
    }
  };

  if (forbidden) {
    return (
      <div className="kyb-backoffice">
        <h1>Análise KYB (PJ)</h1>
        <p className="kyb-forbidden" role="alert">
          Acesso restrito a operadores administrativos. Sua conta não possui papel de reviewer.
        </p>
      </div>
    );
  }

  return (
    <div className="kyb-backoffice">
      <h1>Análise KYB (PJ)</h1>
      <p className="kyb-subtitle">
        Fila de pedidos de verificação fiscal. A decisão é humana, auditável e exige justificativa;
        aprovar requer os documentos mínimos aceitos.
      </p>

      <div className="kyb-toolbar">
        <label>
          Status:{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Rejeitados</option>
            <option value="">Todos</option>
          </select>
        </label>
        <button className="btn-secondary" onClick={() => void loadQueue()} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {loadError && <p className="kyb-error" role="alert">{loadError}</p>}
      {!loading && !loadError && queue.length === 0 && (
        <p className="kyb-empty">Nenhum pedido {STATUS_LABEL[statusFilter]?.toLowerCase() ?? ''} na fila.</p>
      )}

      {queue.length > 0 && (
        <table className="kyb-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>CNPJ</th>
              <th>Request</th>
              <th>KYB atual</th>
              <th>Motivo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {queue.map((row) => (
              <tr key={row.kybRequestId} className={selected?.kybRequestId === row.kybRequestId ? 'selected' : ''}>
                <td>{row.companyName ?? '—'}</td>
                <td>{row.cnpj}</td>
                <td><span className={`kyb-badge kyb-${row.status}`}>{STATUS_LABEL[row.status] ?? row.status}</span></td>
                <td><span className={`kyb-badge kyb-${row.kybStatusCurrent}`}>{STATUS_LABEL[row.kybStatusCurrent] ?? row.kybStatusCurrent}</span></td>
                <td className="kyb-reason">{row.decisionReason ?? '—'}</td>
                <td><button className="btn-secondary" onClick={() => void openRequest(row)}>Abrir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <div className="kyb-detail">
          <h2>
            {selected.companyName ?? 'Empresa'} · {selected.cnpj}
          </h2>
          <p>
            Request <code>{selected.kybRequestId.slice(0, 8)}</code> ·{' '}
            <span className={`kyb-badge kyb-${selected.status}`}>{STATUS_LABEL[selected.status] ?? selected.status}</span>{' '}
            · KYB atual:{' '}
            <span className={`kyb-badge kyb-${selected.kybStatusCurrent}`}>
              {STATUS_LABEL[selected.kybStatusCurrent] ?? selected.kybStatusCurrent}
            </span>{' '}
            · Submitter: <code>{selected.submittedByActorId.slice(0, 8)}</code>
          </p>

          <h3>Documentos</h3>
          {docsLoading && <p>Carregando documentos…</p>}
          {!docsLoading && documents.length === 0 && <p>Nenhum documento enviado.</p>}
          {documents.length > 0 && (
            <table className="kyb-table">
              <thead>
                <tr><th>Tipo</th><th>Status</th><th>Motivo</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.documentId}>
                    <td>{DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}</td>
                    <td><span className={`kyb-badge kyb-${doc.documentStatus}`}>{STATUS_LABEL[doc.documentStatus] ?? doc.documentStatus}</span></td>
                    <td className="kyb-reason">{doc.decisionReason ?? '—'}</td>
                    <td className="kyb-doc-actions">
                      <button className="btn-secondary" onClick={() => void handleDownload(doc)} disabled={acting}>Baixar</button>
                      {doc.documentStatus === 'submitted' && (
                        <>
                          <button className="btn-primary" onClick={() => void handleDocReview(doc, 'accepted')} disabled={acting}>Aceitar</button>
                          <button className="btn-danger" onClick={() => void handleDocReview(doc, 'rejected')} disabled={acting}>Rejeitar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="kyb-decision-actions">
            {selected.status === 'pending' && (
              <>
                <button className="btn-primary" onClick={() => void handleRequestReview('approved')} disabled={acting}>
                  Aprovar análise
                </button>
                <button className="btn-danger" onClick={() => void handleRequestReview('rejected')} disabled={acting}>
                  Rejeitar análise
                </button>
              </>
            )}
            {selected.kybStatusCurrent === 'approved' && (
              <button className="btn-danger" onClick={() => void handleRevoke()} disabled={acting}>
                Revogar aprovação
              </button>
            )}
            <button className="btn-secondary" onClick={() => setSelected(null)} disabled={acting}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
