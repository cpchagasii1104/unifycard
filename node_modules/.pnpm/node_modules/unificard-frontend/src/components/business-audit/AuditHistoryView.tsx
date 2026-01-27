// frontend/src/components/business-audit/AuditHistoryView.tsx
// Componente para visualizar histórico de auditoria
// 🔴 BLINDAGEM: Apenas leitura - logs são imutáveis

import { useState, useEffect } from 'react';
import { listBusinessAuditLogs, type BusinessAuditLog } from '../../api/business-audit';
import { getActorProfile } from '../../api/social';
import { showToast } from '../common/Toast';
import './AuditHistoryView.css';

interface AuditHistoryViewProps {
  contextType: 'event' | 'rfq' | 'booking' | 'service_order' | 'bundle' | 'split';
  contextId: string;
  title?: string;
}

export default function AuditHistoryView({
  contextType,
  contextId,
  title,
}: AuditHistoryViewProps) {
  const [logs, setLogs] = useState<BusinessAuditLog[]>([]);
  const [enrichedLogs, setEnrichedLogs] = useState<Array<BusinessAuditLog & {
    actor?: any;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [contextType, contextId]);

  const loadLogs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listBusinessAuditLogs({
        contextType,
        contextId,
        limit: 100,
      });
      setLogs(result.logs);

      // Enriquecer logs com dados do actor
      const enriched = await Promise.all(
        result.logs.map(async (log) => {
          try {
            const actor = await getActorProfile(log.actorId);
            return { ...log, actor };
          } catch (err) {
            return log;
          }
        })
      );

      setEnrichedLogs(enriched);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar histórico');
      showToast(err.message || 'Erro ao carregar histórico', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      booking_requested: 'Booking Solicitado',
      booking_decided: 'Booking Decidido',
      booking_confirmed: 'Booking Confirmado',
      rfq_created: 'RFQ Criado',
      quote_submitted: 'Proposta Submetida',
      rfq_converted: 'RFQ Convertido',
      bundle_confirmed: 'Bundle Confirmado',
      financial_terms_confirmed: 'Termos Financeiros Confirmados',
      service_order_created: 'Ordem de Serviço Criada',
      service_order_confirmed: 'Ordem de Serviço Confirmada',
      service_order_started: 'Ordem de Serviço Iniciada',
      service_order_completed: 'Ordem de Serviço Completada',
      service_order_cancelled: 'Ordem de Serviço Cancelada',
    };
    return labels[action] || action;
  };

  if (isLoading) {
    return (
      <div className="audit-history-view">
        <div className="loading">Carregando histórico...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="audit-history-view">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="audit-history-view">
      <div className="audit-history-header">
        <h3>{title || 'Histórico de Auditoria'}</h3>
        <div className="audit-context-info">
          <span className="context-type">{contextType}</span>
          <span className="context-id">ID: {contextId.substring(0, 8)}...</span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="no-logs">
          <p>Nenhum log de auditoria encontrado.</p>
        </div>
      ) : (
        <div className="audit-logs-list">
          {enrichedLogs.map((log) => (
            <div key={log.logId} className="audit-log-item">
              <div className="log-header">
                <div className="log-action">
                  <strong>{getActionLabel(log.action)}</strong>
                </div>
                <div className="log-time">
                  {new Date(log.createdAt).toLocaleString('pt-BR')}
                </div>
              </div>
              <div className="log-details">
                <div className="log-actor">
                  <span className="label">Executado por:</span>
                  <span className="value">
                    {log.actor?.display_name || log.actorId.substring(0, 8) || 'Usuário'}
                  </span>
                </div>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="log-metadata">
                    <details>
                      <summary>Detalhes</summary>
                      <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                    </details>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




