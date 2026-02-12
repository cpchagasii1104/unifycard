// frontend/src/components/agreements/AgreementHistory.tsx
// Histórico visual do acordo (timeline)
// 🔴 BLINDAGEM: Apenas exibe dados, não permite edição após FINALIZED

import { type Agreement } from '../../api/agreements';
import './AgreementHistory.css';

interface AgreementHistoryProps {
  agreement: Agreement;
}

export default function AgreementHistory({ agreement }: AgreementHistoryProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Rascunho',
      PROPOSED: 'Proposto',
      ACCEPTED: 'Aceito',
      FINALIZED: 'Finalizado',
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = {
      DRAFT: '📝',
      PROPOSED: '📤',
      ACCEPTED: '✓',
      FINALIZED: '🔒',
    };
    return icons[status] || '•';
  };

  // Timeline de status (simplificado - baseado no status atual)
  const timeline = [
    {
      status: 'DRAFT',
      label: 'Criado',
      date: agreement.createdAt,
      actor: agreement.createdByActorId,
      isActive: agreement.status === 'DRAFT',
      isCompleted: ['PROPOSED', 'ACCEPTED', 'FINALIZED'].includes(agreement.status),
    },
    {
      status: 'PROPOSED',
      label: 'Proposto',
      date: agreement.updatedAt,
      actor: agreement.createdByActorId,
      isActive: agreement.status === 'PROPOSED',
      isCompleted: ['ACCEPTED', 'FINALIZED'].includes(agreement.status),
    },
    {
      status: 'ACCEPTED',
      label: 'Aceito',
      date: agreement.updatedAt,
      actor: agreement.providerActorId,
      isActive: agreement.status === 'ACCEPTED',
      isCompleted: agreement.status === 'FINALIZED',
    },
    {
      status: 'FINALIZED',
      label: 'Finalizado',
      date: agreement.finalizedAt || agreement.updatedAt,
      actor: agreement.finalizedByActorId || agreement.createdByActorId,
      isActive: agreement.status === 'FINALIZED',
      isCompleted: false,
    },
  ].filter((item) => {
    // Mostrar apenas status relevantes
    if (item.status === 'DRAFT') return true;
    if (item.status === 'PROPOSED') return ['PROPOSED', 'ACCEPTED', 'FINALIZED'].includes(agreement.status);
    if (item.status === 'ACCEPTED') return ['ACCEPTED', 'FINALIZED'].includes(agreement.status);
    if (item.status === 'FINALIZED') return agreement.status === 'FINALIZED';
    return false;
  });

  return (
    <div className="agreement-history">
      <h4>Histórico do Acordo</h4>
      <div className="agreement-timeline">
        {timeline.map((item, index) => (
          <div
            key={item.status}
            className={`timeline-item ${item.isActive ? 'active' : ''} ${item.isCompleted ? 'completed' : ''}`}
          >
            <div className="timeline-marker">
              <span className="timeline-icon">{getStatusIcon(item.status)}</span>
            </div>
            <div className="timeline-content">
              <div className="timeline-status">
                <strong>{item.label}</strong>
                <span className="timeline-status-badge">{getStatusLabel(item.status)}</span>
              </div>
              <div className="timeline-date">{formatDate(item.date)}</div>
              <div className="timeline-actor">
                Por: {item.actor.substring(0, 8)}...
              </div>
            </div>
            {index < timeline.length - 1 && <div className="timeline-connector" />}
          </div>
        ))}
      </div>
      {agreement.status === 'FINALIZED' && (
        <div className="agreement-history-notice">
          <small>
            🔒 Este acordo foi finalizado e é imutável. Este histórico é usado em caso de disputa.
          </small>
        </div>
      )}
    </div>
  );
}




