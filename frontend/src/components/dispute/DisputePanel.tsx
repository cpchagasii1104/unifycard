// frontend/src/components/dispute/DisputePanel.tsx
// F-DISPUTES-FRONTEND-HONEST-CONTAINMENT (2026-06-27):
//   Este painel ANTES lia disputas do localStorage e oferecia resolver/rejeitar/REVERTER
//   ação financeira pelo browser (DisputeResolutionModal → revertDispute), fabricando
//   status='reverted'/revertedTransactionId SEM Bank — mentira operacional colada ao saldo real.
//   O backend de disputa/reversão é completo e DELIBERADAMENTE fail-closed em 403 (DECISION-0123).
//   "Frontend nunca cria verdade": o painel agora é um TERMINAL HONESTO — não lê localStorage,
//   não muta nada, não abre o modal de resolução/reversão, não fabrica reversão financeira.
//   Props (actorId/maxItems) preservados para não quebrar o call-site (CompanyOverviewTab).
//   Religar disputa/reversão real = frente própria sob IA-DINHEIRO + desenhos (HOLD).

import './DisputePanel.css';

interface DisputePanelProps {
  actorId: string;
  maxItems?: number;
}

export default function DisputePanel(_props: DisputePanelProps) {
  return (
    <div className="dispute-panel">
      <div className="dispute-panel-empty">
        <p>Contestação de ações em revisão institucional</p>
        <p style={{
          fontSize: '0.85rem',
          color: '#999',
          fontStyle: 'italic',
          marginTop: '0.5rem',
        }}>
          Este recurso ainda não está disponível. Nenhuma solicitação é registrada,
          resolvida ou revertida por aqui — nada nesta tela altera transações ou saldo.
        </p>
      </div>
    </div>
  );
}
