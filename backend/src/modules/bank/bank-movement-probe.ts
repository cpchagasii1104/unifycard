// backend/src/modules/bank/bank-movement-probe.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — sonda READ-ONLY de movimento do Bank, para provas de Δbank=0
// ║ NORMA:   SSOT_EXCLUSIVE_BANK_RULE — só o domínio Bank toca `bank_*`
// ║ NÃO:     NÃO usar como valor em conta, NÃO usar em decisão de negócio, NÃO escrever aqui.
// ║ EM VEZ:  valor em conta e extrato vêm das PORTAS (bankPortsRegistry.getBankAccount()).
// ║          ⚠️ Comentário aqui evita o vocabulário financeiro de propósito: `src/modules/bank`
// ║          NÃO é isento do lint (só `src/core/bank` é) — assimetria conhecida, DECISION-0158.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE ISTO EXISTE (2026-08-04) ═══
// Toda prova pré-PORTA-01 precisa afirmar "nada de dinheiro se moveu". A forma que se espalhou foi
// cada script rodar o próprio `SELECT count(*) FROM bank_ledger + bank_transactions` — a MESMA
// consulta copiada em 8 lugares, cada cópia sendo uma leitura de `bank_*` FORA do domínio Bank.
// `audit-schema-coherence-ratchet` mordeu (C4-BANK-READ-BOUNDARY) e está certo: mesmo leitura só
// pode sair do módulo autorizado. Eu criei essas 8 cópias nesta sessão — o conserto é meu.
//
// A sonda mora onde a norma manda (o Bank é dono da verdade sobre movimento) e os scripts passam a
// PERGUNTAR ao Bank em vez de ler as tabelas dele. Consulta única: some uma cópia, some das oito.
//
// ⚠️ Isto NÃO é dinheiro. É cardinalidade de movimento — serve para uma única afirmação: "o número
// antes e o número depois são iguais, logo nada foi movido". Usar como valor seria erro de eixo.

import { pool } from '@core/database/pool';
import type { PoolClient } from 'pg';

/** Executor mínimo — aceita o pool ou um client já dentro de transação (o caller decide o escopo). */
type Executor = Pick<PoolClient, 'query'> | typeof pool;

/**
 * Quantas linhas de movimento existem no Bank AGORA (as duas tabelas de movimento), tenant-wide.
 *
 * Uso canônico numa prova:
 *   const antes  = await countBankMovements();
 *   … o ato que se quer provar Bank-free …
 *   const depois = await countBankMovements();
 *   if (depois !== antes) throw new Error('Δbank ≠ 0 — o caminho moveu dinheiro.');
 */
export async function countBankMovements(executor: Executor = pool): Promise<number> {
  const r = await executor.query<{ n: string }>(
    `SELECT ((SELECT count(*) FROM bank_ledger) + (SELECT count(*) FROM bank_transactions))::text AS n`
  );
  // Sem fallback para 0: contagem que não foi lida é DESCONHECIDA, e desconhecido não pode se
  // passar por "não há movimento" — seria a prova afirmar exatamente o que não mediu.
  const bruto = r.rows[0]?.n;
  if (bruto === undefined) throw new Error('BANK_MOVEMENT_PROBE_UNREADABLE: a contagem de movimento do Bank não retornou linha.');
  return Number(bruto);
}
