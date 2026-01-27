// frontend/src/components/events/wizard/pages/CommonFinalizePage.tsx
// FASE 5 — PÁGINA COMUM: Finalização
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - Apenas executa ação humana explícita
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_BIRTHDAY_PAGE_SET.md

export interface CommonFinalizePageProps {
  eventSpec: {
    spec_id?: string;
    answers?: Record<string, any>;
  };
  onFinalize: () => void | Promise<void>;
  isClosing?: boolean;
}

/**
 * CommonFinalizePage
 * 
 * Objetivo: Executar o fechamento explícito do EventSpec
 * Responsabilidades:
 * - Solicitar confirmação humana
 * - Acionar persistência final
 * - Encerrar edição do snapshot
 * 
 * Efeito institucional:
 * - EventSpec torna-se imutável
 * - Qualquer alteração futura exige novo snapshot
 */
export default function CommonFinalizePage({ eventSpec, onFinalize, isClosing = false }: CommonFinalizePageProps) {
  return (
    <div className="wizard-page">
      <h3>Finalizar Planejamento</h3>
      <p className="step-description">
        Ao salvar o planejamento, o EventSpec será fechado e não poderá mais ser editado.
        Qualquer alteração futura exigirá a criação de um novo snapshot.
      </p>
      
      <div className="form-group">
        <p className="field-hint">
          <strong>⚠️ Atenção:</strong> Após salvar, este planejamento não poderá ser alterado.
          Certifique-se de que todas as informações estão corretas.
        </p>
      </div>

      <div className="wizard-page-actions">
        <button
          type="button"
          className="wizard-button wizard-button-primary"
          onClick={onFinalize}
          disabled={isClosing}
        >
          {isClosing ? 'Salvando...' : 'Salvar planejamento'}
        </button>
      </div>
    </div>
  );
}

