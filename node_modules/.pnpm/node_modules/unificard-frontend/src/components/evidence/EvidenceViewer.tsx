// frontend/src/components/evidence/EvidenceViewer.tsx
// Visualizador neutro de evidências (somente leitura)
// 🔴 BLINDAGEM: Apenas exibe dados, sem cálculos ou inferências

import { useState, useEffect } from 'react';
import { getEvidencePackByContext, exportEvidencePack, type EvidencePack } from '../../api/evidence';
import EvidenceTimeline from './EvidenceTimeline';
import { showToast } from '../../utils/toast';
import './EvidenceViewer.css';

interface EvidenceViewerProps {
  contextType: 'event' | 'booking' | 'bundle' | 'service_order' | 'agreement';
  contextId: string;
}

export default function EvidenceViewer({ contextType, contextId }: EvidenceViewerProps) {
  const [pack, setPack] = useState<EvidencePack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadEvidencePack();
  }, [contextType, contextId]);

  const loadEvidencePack = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getEvidencePackByContext(contextType, contextId);
      setPack(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar evidências');
      console.error('Erro ao carregar evidence pack:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'pdf') => {
    if (!pack) return;

    setIsExporting(true);
    try {
      const blob = await exportEvidencePack(pack.packId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evidence-${pack.packId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('Evidências exportadas com sucesso', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao exportar evidências', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="evidence-viewer">
        <div className="evidence-viewer-loading">Carregando evidências...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="evidence-viewer">
        <div className="evidence-viewer-error">{error}</div>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="evidence-viewer">
        <div className="evidence-viewer-empty">Nenhuma evidência encontrada.</div>
      </div>
    );
  }

  return (
    <div className="evidence-viewer">
      <div className="evidence-viewer-header">
        <h3>Dossiê de Evidências</h3>
        <div className="evidence-viewer-actions">
          <button
            className="btn-secondary"
            onClick={() => handleExport('json')}
            disabled={isExporting}
          >
            {isExporting ? 'Exportando...' : 'Exportar JSON'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
          >
            {isExporting ? 'Exportando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      <div className="evidence-viewer-info">
        <div className="info-item">
          <strong>Contexto:</strong> {contextType} ({contextId.substring(0, 8)}...)
        </div>
        <div className="info-item">
          <strong>Status de Disputa:</strong>{' '}
          <span className={`dispute-status dispute-status-${pack.disputeStatus.toLowerCase()}`}>
            {pack.disputeStatus === 'NONE' && 'Nenhuma'}
            {pack.disputeStatus === 'OPEN' && 'Aberta'}
            {pack.disputeStatus === 'IN_MEDIATION' && 'Em Mediação'}
            {pack.disputeStatus === 'RESOLVED' && 'Resolvida'}
          </span>
        </div>
        {pack.openedAt && (
          <div className="info-item">
            <strong>Disputa aberta em:</strong> {new Date(pack.openedAt).toLocaleString('pt-BR')}
          </div>
        )}
        {pack.resolvedAt && (
          <div className="info-item">
            <strong>Disputa resolvida em:</strong> {new Date(pack.resolvedAt).toLocaleString('pt-BR')}
          </div>
        )}
        {pack.retentionUntil && (
          <div className="info-item">
            <strong>Retenção até:</strong> {new Date(pack.retentionUntil).toLocaleString('pt-BR')}
          </div>
        )}
      </div>

      <div className="evidence-viewer-timeline">
        <h4>Linha do Tempo de Evidências</h4>
        <EvidenceTimeline events={pack.timeline} />
      </div>

      <div className="evidence-viewer-notice">
        <small>
          ℹ️ Este dossiê é imutável e utilizado para disputas, mediação e auditoria. Todas as
          evidências são registradas permanentemente.
        </small>
      </div>
    </div>
  );
}




