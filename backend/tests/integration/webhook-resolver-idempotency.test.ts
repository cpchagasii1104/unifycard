// backend/tests/integration/webhook-resolver-idempotency.test.ts
// F-CAMADA-1-GATE-IDEMPOTENCIA-OUTBOX-G1 (#35 da Matriz Consolidada Camada 1).
//
// Prova CONTIDA de replay/dedup do caminho: webhook PIX → payment-event-resolver → bank transaction.
// Invariante: a 2ª entrega do mesmo evento (mesmo provider/reference_id, ou mesmo reference_type/reference_id)
// NÃO duplica efeito — e Δbank=0 na 2ª entrega.
//
// FRONTEIRA (G1): ZERO escrita em bank_* (bank_ledger/bank_transactions/bank_splits/bank_accounts) — Δbank=0
// por CONSTRUÇÃO. A camada de ingestão é provada COMPORTAMENTALMENTE (gateway_webhook_events NÃO é tabela
// bank_*, e é limpa no afterAll); a camada financeira é provada pela CONSTRAINT viva no DB (defense-in-depth)
// + guard estrutural `audit-webhook-resolver-idempotency` (advisory lock + SELECT FOR UPDATE por referência
// + 23505 idempotente). NÃO executa transfer gross (que deixaria bank_ledger append-only persistente no dev).

import { describe, it, expect, afterAll } from '@jest/globals';
import { pool } from '../../src/core/database/pool';
import { recordWebhookEvent } from '../../src/modules/gateway/gateway-webhook-repository';
import { v4 as uuidv4 } from 'uuid';

describe('#35 G1 — webhook→resolver→bank idempotência (replay/dedup contido, Δbank=0)', () => {
  const provider = 'pix';
  const referenceId = `g1-idempotency-probe-${uuidv4()}`;

  afterAll(async () => {
    // gateway_webhook_events NÃO é bank_* — limpeza segura da fixture de ingestão.
    await pool.query(
      'DELETE FROM gateway_webhook_events WHERE provider = $1 AND reference_id = $2',
      [provider, referenceId]
    );
  });

  it('ingestão: 2ª entrega do mesmo (provider, reference_id) NÃO re-enfileira (dedup ON CONFLICT)', async () => {
    const first = await recordWebhookEvent(provider, referenceId, 'payload-hash-A');
    const second = await recordWebhookEvent(provider, referenceId, 'payload-hash-A'); // replay idêntico
    const third = await recordWebhookEvent(provider, referenceId, 'payload-hash-DIFERENTE'); // replay c/ payload diferente, MESMA ref

    expect(first).toBe(true); // 1ª entrega = nova → segue para a fila
    expect(second).toBe(false); // 2ª entrega = duplicada → short-circuit, NÃO enfileira (não chega ao resolver/bank)
    expect(third).toBe(false); // mesmo com hash diferente, (provider, reference_id) já registrado → bloqueada

    const { rows } = await pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM gateway_webhook_events WHERE provider = $1 AND reference_id = $2',
      [provider, referenceId]
    );
    expect(rows[0].n).toBe(1); // EXATAMENTE uma linha — replay não duplicou a ingestão
  });

  it('ingestão: constraint UNIQUE(provider, reference_id) VIVA no DB (não só na migration)', async () => {
    const { rows } = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE tablename = 'gateway_webhook_events'
         AND indexname = 'uq_gateway_webhook_events_provider_reference'`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].indexdef.toLowerCase()).toContain('unique');
  });

  it('financeiro: constraint de idempotência por referência VIVA no DB (defense-in-depth, Δbank=0)', async () => {
    // uq_bank_transactions_reference garante 1 transação por (tenant_id, reference_type, reference_id).
    // O resolver (payment-event-resolver → bankTransactionService.transfer) faz short-circuit idempotente
    // (advisory lock + SELECT ... reference_type/reference_id ... FOR UPDATE) ANTES do INSERT; em corrida,
    // esta constraint absorve a 2ª entrega via unique_violation(23505) com retorno idempotente.
    const { rows } = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE tablename = 'bank_transactions'
         AND indexname = 'uq_bank_transactions_reference'`
    );
    expect(rows.length).toBe(1);
    const def = rows[0].indexdef.toLowerCase();
    expect(def).toContain('unique');
    expect(def).toContain('tenant_id');
    expect(def).toContain('reference_type');
    expect(def).toContain('reference_id');
    // Nenhuma escrita em bank_* neste teste → Δbank=0 por construção.
  });
});
