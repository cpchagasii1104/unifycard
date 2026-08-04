// backend/src/modules/dispatch/opportunity-dispatch-substrate-probe.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — sonda de existência do substrato de disparo de oportunidade
// ║ NORMA:   "zero é afirmação; desconhecido é a verdade" · contenção com saída verificável
// ║ NÃO:     NÃO criar a tabela por aqui; NÃO fingir sucesso; NÃO devolver 500 cru.
// ║ EM VEZ:  materializar `opportunity_dispatches` por migration — a sonda se apaga sozinha.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE ISTO EXISTE (2026-08-04) ═══
// `POST /events/:eventId/rfqs/:rfqId/dispatch` está VIVA e autoriza corretamente
// (`assertCanReadEventMoney` → `canRepresentActor`), e então chama `dispatchRFQToCompanies`, que
// escreve em `opportunity_dispatches`. Medido: `SELECT to_regclass('opportunity_dispatches')` →
// **null**. A tabela nunca foi materializada. Um organizador legítimo, dono do próprio evento,
// recebia **500** (42P01) — o caminho promete e morre.
//
// É o oposto do irmão na mesma rota: `acceptQuote` responde `403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED`,
// erro honesto e nomeado, com a decisão citada. Este ganha o mesmo tratamento.
//
// 🔴 SONDA, NÃO FLAG FIXA. A regra da casa é que contenção só não é adiamento quando tem saída
// verificável por consulta. Aqui a saída É a consulta: no dia em que a migration criar a tabela,
// `to_regclass` deixa de ser null e a rota volta a funcionar **sem ninguém precisar lembrar de
// desligar nada**. Contenção que se apaga sozinha é a única que não vira dívida esquecida.
//
// O guard `audit-event-rfq-dispatch-quarantine-gate` continua verde e sempre esteve: ele valida a
// quarentena do ACTOR dentro da função, não a existência da casa onde ela escreve. Guard verde
// sobre substrato ausente é precisamente o "verde mentindo" que esta casa persegue.

import { runQueryWithTenant } from '@core/database/pool';

/** Memoriza o resultado positivo. Ausência NÃO é memorizada: a migration pode rodar a qualquer momento. */
let substratoConfirmado = false;

export const OPPORTUNITY_DISPATCH_TABLE = 'opportunity_dispatches';

/**
 * `true` quando a casa do disparo existe. Consulta o catálogo do Postgres — não deduz pelo nome,
 * não confia em variável de ambiente.
 */
export async function opportunityDispatchSubstrateExists(tenantId: string): Promise<boolean> {
  if (substratoConfirmado) return true;
  const row = await runQueryWithTenant<{ t: string | null }>(
    tenantId,
    `SELECT to_regclass($1)::text AS t`,
    [OPPORTUNITY_DISPATCH_TABLE]
  );
  // `row` indefinido = a própria leitura falhou. Isso é DESCONHECIDO, não "não existe" — e
  // desconhecido tem de se comportar como ausente (fail-closed), nunca como presente.
  const existe = !!row?.t;
  if (existe) substratoConfirmado = true;
  return existe;
}

/** Corpo honesto: diz o que falta, quem resolve, e como a contenção termina. */
export function opportunityDispatchUnavailableBody(route: string) {
  return {
    error: 'OPPORTUNITY_DISPATCH_SUBSTRATE_MISSING',
    code: 'OPPORTUNITY_DISPATCH_SUBSTRATE_MISSING',
    message:
      `A tabela \`${OPPORTUNITY_DISPATCH_TABLE}\` não existe neste banco, então o disparo de ` +
      'oportunidade não tem onde registrar o que enviou. Nenhuma empresa foi notificada e nada ' +
      'foi gravado. A contenção termina sozinha quando a migration criar a tabela.',
    route,
    substrate: OPPORTUNITY_DISPATCH_TABLE,
  };
}
