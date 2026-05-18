// frontend/src/components/InferredProfileCard.tsx
// 2026-05-18 P2 item 4 — UI "isso é você?" (display honesto v1)
//
// PRINCÍPIOS APLICADOS:
// - Frontend NUNCA cria verdade — só renderiza o que backend agregou
// - Causalidade declarada: cada item explica POR QUE apareceu (fonte SSOT)
// - Soberania cognitiva: usuário sempre sabe que dado vem do seu histórico real
// - Validação progressiva ainda NÃO inclui botões de "confirmar/negar"
//   porque NÃO existe endpoint backend para persistir feedback. Quando
//   esse endpoint vier (P3 talvez), botões aparecem. Princípio
//   "frontend não antecipa verdade material" — não vou simular validação
//   que não tem onde gravar.
//
// Não renderiza nada quando profile inferido está vazio (degradação graciosa).

import { useInferredProfile } from '../hooks/useInferredProfile';
import './InferredProfileCard.css';

const EVENT_TYPE_LABEL_PT: Record<string, string> = {
  show: 'shows ao vivo',
  workshop: 'workshops',
  birthday: 'aniversários',
  meeting: 'reuniões',
  conference: 'conferências',
  party: 'festas',
  service: 'serviços',
};

function formatEventTypeLabel(eventType: string, eventSubtype: string | null): string {
  const base = EVENT_TYPE_LABEL_PT[eventType.toLowerCase()] ?? eventType;
  return eventSubtype ? `${base} (${eventSubtype})` : base;
}

export default function InferredProfileCard() {
  const { data, loading } = useInferredProfile();

  if (loading || !data) return null;

  const hasAnyInference =
    data.eventTypeAffinities.length > 0 || data.communities.length > 0;

  // Degradação graciosa: sem inferências reais → não renderiza nada
  if (!hasAnyInference) return null;

  return (
    <section className="ipc-card" aria-label="Perfil inferido pelo seu histórico">
      <div className="ipc-header">
        <h3 className="ipc-title">O que vimos no seu histórico</h3>
        <p className="ipc-subtitle">
          Estes sinais vêm da sua atividade real no UnifiCard.
          Eles ajudam o sistema a sugerir o que importa para você.
        </p>
      </div>

      {data.eventTypeAffinities.length > 0 && (
        <div className="ipc-section">
          <div className="ipc-section-title">Você costuma participar de</div>
          <ul className="ipc-chip-list">
            {data.eventTypeAffinities.slice(0, 5).map((aff) => (
              <li key={`${aff.eventType}::${aff.eventSubtype ?? ''}`} className="ipc-chip">
                <span className="ipc-chip-label">
                  {formatEventTypeLabel(aff.eventType, aff.eventSubtype)}
                </span>
                <span className="ipc-chip-count">{aff.attendanceCount}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.communities.length > 0 && (
        <div className="ipc-section">
          <div className="ipc-section-title">Você é membro de</div>
          <ul className="ipc-community-list">
            {data.communities.slice(0, 5).map((c) => (
              <li key={c.groupId} className="ipc-community-item">
                <span className="ipc-community-icon" aria-hidden="true">👥</span>
                <div className="ipc-community-body">
                  <div className="ipc-community-name">{c.groupName}</div>
                  <div className="ipc-community-meta">
                    {c.role === 'owner'
                      ? 'Proprietária'
                      : c.role === 'admin'
                        ? 'Administradora'
                        : 'Membro'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="ipc-footer">
        <small>
          Resolvido em {new Date(data.resolvedAt).toLocaleString('pt-BR')} ·
          janela de {data.windowDaysEvents} dias para eventos.
        </small>
      </div>
    </section>
  );
}
