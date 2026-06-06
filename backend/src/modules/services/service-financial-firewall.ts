// service-financial-firewall.ts
// DECISION-0110: as rotas financeiras de serviço ficam FAIL-CLOSED ("feature disabled") até a cadeia
// canônica de serviço financeiro (pré-pago → escrow → release governado com KYB) estar desenhada,
// implementada e testada. O firewall NÃO move dinheiro, NÃO apaga código (o caminho fica preservado para
// auditoria e para a cadeia futura) e NÃO finge que está operacional — retorna erro honesto.
//
// Cobre as rotas vivas que a DECISION-0110 declarou FORA da política (D2/D3/D8):
//   POST /services/request/pay                       (pagamento DIRETO legado — proibido no canônico, D2)
//   POST /services/:serviceId/hire                   (auto-aceite + pagamento — viola decisão humana, D3)
//   POST /services/payments/:paymentRequestId/execute (execução com escrow — só com pré-condições + KYB, D8)
//
// Reabrir é trocar o flag (default OFF), não reescrever. A autenticação/autorização de cada rota deve ser
// revalidada quando o flag for reaberto (achado material da auditoria — DECISION-0110 §8).

export const SERVICE_FINANCIAL_RUNTIME_FLAG = 'SERVICE_FINANCIAL_RUNTIME_ENABLED';

/** true SÓ se o flag estiver explicitamente 'true'. Ausente/qualquer-outro = desligado (fail-closed). */
export function isServiceFinancialRuntimeEnabled(): boolean {
  return process.env[SERVICE_FINANCIAL_RUNTIME_FLAG] === 'true';
}

export interface ServiceFinancialDisabledBody {
  error: 'SERVICE_FINANCIAL_RUNTIME_DISABLED';
  code: 'SERVICE_FINANCIAL_RUNTIME_DISABLED';
  message: string;
  decision: 'DECISION-0110';
  route: string;
}

/** Corpo honesto de "feature desabilitada" para a rota financeira fail-closed. */
export function serviceFinancialDisabledBody(route: string): ServiceFinancialDisabledBody {
  return {
    error: 'SERVICE_FINANCIAL_RUNTIME_DISABLED',
    code: 'SERVICE_FINANCIAL_RUNTIME_DISABLED',
    message:
      'Rota financeira de serviço desabilitada por DECISION-0110 até a cadeia canônica ' +
      '(pré-pago → escrow → release governado com KYB) estar implementada e testada. ' +
      'Nenhum dinheiro é movido.',
    decision: 'DECISION-0110',
    route,
  };
}
