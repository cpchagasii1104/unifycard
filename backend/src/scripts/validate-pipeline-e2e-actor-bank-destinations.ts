/**
 * E2E F4.0 ACTOR_BANK_DESTINATIONS — MVP substrate (DECISION-0060, 2026-05-28).
 *
 * Prova:
 *   - tabela existe + constraints DB
 *   - service: criação fail-closed em mismatch
 *   - "conta própria" funciona em duas camadas (service + TRIGGER)
 *   - lifecycle controlado por trigger
 *   - KYC pending permite cadastro
 *   - ZERO toque em ledger / bank_transactions / payout_requests / F1/F2/F3
 *
 * Cenários:
 *   T1 — happy path pix_key CPF com holder == tax_id → auto_tax_id_match → verified
 *   T2 — mismatch fail-closed (holder ≠ tax_id) — service + trigger ambos rejeitam
 *   T3 — bank_account happy path com holder == tax_id → pending_verification
 *   T4 — lifecycle transitions: pending → verified (manual), pending → rejected,
 *        verified → archived, rejected → archived, transição inválida bloqueia
 *   T5 — trigger DB protege bypass de service (INSERT/UPDATE direto rejeitado)
 *   T6 — KYC pending permite cadastro (DECISION-0060 D12)
 *   T7 — F1/F2/F3 não foram acordados (zero alteração em actor_wallet_payout_requests)
 *   T8 — zero alteração em bank_ledger e bank_transactions
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-actor-bank-destinations.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import {
  actorBankDestinationService,
  ActorBankDestinationError,
} from '../modules/wallet/actor-bank-destination.service';

dotenv.config({ path: join(process.cwd(), 'backend', '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

// ── counters ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results: { name: string; ok: boolean; detail: string }[] = [];

function ok(name: string, detail = '') {
  passed++;
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name: string, detail: string) {
  failed++;
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

async function q(sql: string, params: unknown[] = []) {
  return pool.query(sql, params);
}

// ── fixtures ──────────────────────────────────────────────────────────────────

interface Fixtures {
  actorId: string;
  globalUserId: string;
  taxId: string;
  taxIdType: 'cpf' | 'cnpj';
  kycStatus: string;
}

/**
 * Cria identity + actor temporários para teste. CPFs reais válidos:
 *   - 39053344705 (passa pelos dígitos verificadores)
 *   - 52998224725 (passa pelos dígitos verificadores)
 * Evita depender de actors do dataset (cujos CPFs de seed podem ser inválidos pelos DVs).
 */
async function createTestActor(
  kycStatus: 'approved' | 'pending',
  taxId: string,
  label: string
): Promise<Fixtures & { cleanup: () => Promise<void> }> {
  const globalUserId = uuidv4();
  await q(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level)
     VALUES ($1, $2, 'cpf', $3, 'basic')`,
    [globalUserId, taxId, kycStatus]
  );
  const actorId = uuidv4();
  await q(
    `INSERT INTO actors (id, tenant_id, actor_type, display_name, global_user_id)
     VALUES ($1, $2, 'user', $3, $4)`,
    [actorId, TENANT_ID, `e2e f40 ${label}`, globalUserId]
  );
  return {
    actorId,
    globalUserId,
    taxId,
    taxIdType: 'cpf',
    kycStatus,
    cleanup: async () => {
      await q(`DELETE FROM actor_bank_destinations WHERE actor_id=$1`, [actorId]).catch(() => {});
      await q(`DELETE FROM actors WHERE id=$1`, [actorId]).catch(() => {});
      await q(`DELETE FROM identities WHERE global_user_id=$1`, [globalUserId]).catch(() => {});
    },
  };
}

async function getSnapshot() {
  const [abd, ledger, txs, payouts, payoutReq, payoutType] = await Promise.all([
    q(`SELECT COUNT(*) AS n FROM actor_bank_destinations`),
    q(`SELECT COUNT(*) AS n FROM bank_ledger WHERE tenant_id=$1`, [TENANT_ID]),
    q(`SELECT COUNT(*) AS n FROM bank_transactions WHERE tenant_id=$1`, [TENANT_ID]),
    q(`SELECT COUNT(*) AS n FROM payout_requests WHERE tenant_id=$1`, [TENANT_ID]),
    q(`SELECT COUNT(*) AS n FROM actor_wallet_payout_requests WHERE tenant_id=$1`, [TENANT_ID]),
    q(
      `SELECT pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conname='chk_payout_request_destination_type'`
    ),
  ]);
  return {
    abd: Number(abd.rows[0].n),
    ledger: Number(ledger.rows[0].n),
    txs: Number(txs.rows[0].n),
    payouts: Number(payouts.rows[0].n),
    payoutReq: Number(payoutReq.rows[0].n),
    payoutDestinationTypeConstraint: payoutType.rows[0]?.def ?? null,
  };
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('E2E F4.0 ACTOR_BANK_DESTINATIONS (DECISION-0060)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Fixtures temporárias com CPFs reais válidos
  const approvedFx = await createTestActor('approved', '39053344705', 'approved');
  const approved: Fixtures = {
    actorId: approvedFx.actorId,
    globalUserId: approvedFx.globalUserId,
    taxId: approvedFx.taxId,
    taxIdType: approvedFx.taxIdType,
    kycStatus: approvedFx.kycStatus,
  };
  const snapshot0 = await getSnapshot();
  const createdIds: string[] = [];
  let pendingFx: Awaited<ReturnType<typeof createTestActor>> | null = null;

  console.log('Approved actor fixture (temp):', approved);
  console.log('Snapshot inicial:', snapshot0);
  console.log();

  try {
    // ── T1: happy path pix_key CPF auto-verify ────────────────────────────────
    console.log('T1 — happy path pix_key CPF (holder == tax_id) → auto_tax_id_match → verified');
    try {
      const res = await actorBankDestinationService.createDestination({
        tenantId: TENANT_ID,
        actorId: approved.actorId,
        destinationType: 'pix_key',
        pixKeyType: approved.taxIdType,
        pixKeyValue: approved.taxId,
        holderName: 'Test Holder T1',
        holderDocument: approved.taxId,
        holderDocumentType: approved.taxIdType,
      });
      createdIds.push(res.id);
      if (
        res.status === 'verified' &&
        res.ownershipVerificationMethod === 'auto_tax_id_match' &&
        res.ownershipVerifiedAt !== null &&
        res.holderDocument === approved.taxId.replace(/\D/g, '')
      ) {
        ok('T1', `auto_tax_id_match verificou (id=${res.id.slice(0, 8)})`);
      } else {
        fail('T1', `status=${res.status} method=${res.ownershipVerificationMethod}`);
      }
    } catch (e: any) {
      fail('T1', e.message);
    }

    // ── T2: mismatch fail-closed ──────────────────────────────────────────────
    console.log('T2 — mismatch (holder ≠ tax_id) → fail-closed; zero row');
    {
      const abdBefore = (await getSnapshot()).abd;
      // CPF válido diferente do tax_id do actor (52998224725 é válido)
      const wrongDocument = '52998224725';
      try {
        await actorBankDestinationService.createDestination({
          tenantId: TENANT_ID,
          actorId: approved.actorId,
          destinationType: 'pix_key',
          pixKeyType: 'cpf',
          pixKeyValue: wrongDocument,
          holderName: 'Other Person',
          holderDocument: wrongDocument,
          holderDocumentType: 'cpf',
        });
        fail('T2', 'deveria ter falhado com HOLDER_DOCUMENT_MISMATCH');
      } catch (e: any) {
        const abdAfter = (await getSnapshot()).abd;
        if (
          e instanceof ActorBankDestinationError &&
          e.code === 'ACTOR_BANK_DEST_HOLDER_DOCUMENT_MISMATCH' &&
          abdAfter === abdBefore
        ) {
          ok('T2', 'HOLDER_DOCUMENT_MISMATCH + zero row persistida');
        } else {
          fail('T2', `code=${e.code} Δrows=${abdAfter - abdBefore}`);
        }
      }
    }

    // ── T3: bank_account happy path ───────────────────────────────────────────
    console.log('T3 — bank_account (holder == tax_id) → pending_verification');
    try {
      const res = await actorBankDestinationService.createDestination({
        tenantId: TENANT_ID,
        actorId: approved.actorId,
        destinationType: 'bank_account',
        bankCode: '341',
        bankName: 'Itaú Unibanco',
        agencyNumber: '0001',
        accountNumber: '123456',
        accountDigit: '7',
        accountType: 'checking',
        holderName: 'Test Holder T3',
        holderDocument: approved.taxId,
        holderDocumentType: approved.taxIdType,
      });
      createdIds.push(res.id);
      if (
        res.status === 'pending_verification' &&
        res.ownershipVerificationMethod === null &&
        res.destinationType === 'bank_account' &&
        res.bankCode === '341'
      ) {
        ok('T3', `bank_account pending_verification (id=${res.id.slice(0, 8)})`);
      } else {
        fail('T3', `status=${res.status} method=${res.ownershipVerificationMethod}`);
      }
    } catch (e: any) {
      fail('T3', e.message);
    }

    // ── T4: lifecycle transitions ────────────────────────────────────────────
    console.log('T4 — lifecycle: pending→verified, pending→rejected, →archived, inválida bloqueia');
    try {
      // Cria 3 destinos para testar transições
      const aux1 = await actorBankDestinationService.createDestination({
        tenantId: TENANT_ID,
        actorId: approved.actorId,
        destinationType: 'pix_key',
        pixKeyType: 'email',
        pixKeyValue: 't4a@test.local',
        holderName: 'T4 A',
        holderDocument: approved.taxId,
        holderDocumentType: approved.taxIdType,
      });
      createdIds.push(aux1.id);

      const aux2 = await actorBankDestinationService.createDestination({
        tenantId: TENANT_ID,
        actorId: approved.actorId,
        destinationType: 'pix_key',
        pixKeyType: 'email',
        pixKeyValue: 't4b@test.local',
        holderName: 'T4 B',
        holderDocument: approved.taxId,
        holderDocumentType: approved.taxIdType,
      });
      createdIds.push(aux2.id);

      // pending → verified
      const verified1 = await actorBankDestinationService.markVerified(TENANT_ID, aux1.id);
      // pending → rejected
      const rejected1 = await actorBankDestinationService.markRejected(TENANT_ID, aux2.id, 'razão de teste T4');
      // verified → archived
      const archived1 = await actorBankDestinationService.archive(TENANT_ID, verified1.id);
      // rejected → archived
      const archived2 = await actorBankDestinationService.archive(TENANT_ID, rejected1.id);

      // Transição inválida: archived → verified deve falhar (trigger DB)
      let invalidBlocked = false;
      try {
        await q(
          `UPDATE actor_bank_destinations SET status='verified' WHERE id=$1`,
          [archived1.id]
        );
      } catch (e: any) {
        if (String(e.message).includes('transição') || String(e.message).includes('lifecycle')) {
          invalidBlocked = true;
        }
      }

      if (
        verified1.status === 'verified' &&
        verified1.ownershipVerificationMethod === 'manual_review' &&
        rejected1.status === 'rejected' &&
        archived1.status === 'archived' &&
        archived2.status === 'archived' &&
        invalidBlocked
      ) {
        ok('T4', 'transições válidas OK; inválida (archived→verified) bloqueada por trigger');
      } else {
        fail('T4', `v1=${verified1.status} r1=${rejected1.status} a1=${archived1.status} a2=${archived2.status} invalidBlocked=${invalidBlocked}`);
      }
    } catch (e: any) {
      fail('T4', e.message);
    }

    // ── T5: trigger DB protege bypass ────────────────────────────────────────
    console.log('T5 — trigger DB rejeita INSERT direto com holder_document errado + UPDATE direto');
    {
      const abdBefore = (await getSnapshot()).abd;
      // INSERT direto com holder errado — TRIGGER deve barrar (CPF válido mas mismatch)
      let triggerBlockedInsert = false;
      try {
        await q(
          `INSERT INTO actor_bank_destinations
             (tenant_id, actor_id, destination_type, pix_key_type, pix_key_value_normalized,
              holder_name, holder_document, holder_document_type, status)
           VALUES ($1, $2, 'pix_key', 'cpf', '52998224725',
                   'Bypass Test', '52998224725', 'cpf', 'pending_verification')`,
          [TENANT_ID, approved.actorId]
        );
      } catch (e: any) {
        if (
          String(e.message).includes('conta própria') ||
          String(e.message).includes('holder_document') ||
          String(e.message).includes('não corresponde')
        ) {
          triggerBlockedInsert = true;
        }
      }

      // Para testar UPDATE bypass, criar uma row válida via service primeiro,
      // depois tentar UPDATE direto para holder mismatch.
      const ownRow = await actorBankDestinationService.createDestination({
        tenantId: TENANT_ID,
        actorId: approved.actorId,
        destinationType: 'pix_key',
        pixKeyType: 'email',
        pixKeyValue: 't5update@test.local',
        holderName: 'T5 Update Test',
        holderDocument: approved.taxId,
        holderDocumentType: approved.taxIdType,
      });
      createdIds.push(ownRow.id);

      let triggerBlockedUpdate = false;
      try {
        await q(
          `UPDATE actor_bank_destinations SET holder_document='52998224725' WHERE id=$1`,
          [ownRow.id]
        );
      } catch (e: any) {
        if (
          String(e.message).includes('conta própria') ||
          String(e.message).includes('holder_document') ||
          String(e.message).includes('não corresponde')
        ) {
          triggerBlockedUpdate = true;
        }
      }
      const abdAfter = (await getSnapshot()).abd;

      // Esperado: abdAfter = abdBefore + 1 (ownRow criado), nenhum bypass row
      if (triggerBlockedInsert && triggerBlockedUpdate && abdAfter === abdBefore + 1) {
        ok('T5', 'INSERT e UPDATE diretos com mismatch bloqueados pelo trigger');
      } else {
        fail('T5', `insertBlocked=${triggerBlockedInsert} updateBlocked=${triggerBlockedUpdate} Δrows=${abdAfter - abdBefore} (esperado +1)`);
      }
    }

    // ── T6: KYC pending permite cadastro ──────────────────────────────────────
    console.log('T6 — KYC pending permite cadastro (DECISION-0060 D12)');
    try {
      pendingFx = await createTestActor('pending', '52998224725', 'pending_kyc');
      const res = await actorBankDestinationService.createDestination({
        tenantId: TENANT_ID,
        actorId: pendingFx.actorId,
        destinationType: 'pix_key',
        pixKeyType: pendingFx.taxIdType,
        pixKeyValue: pendingFx.taxId,
        holderName: 'Pending KYC User',
        holderDocument: pendingFx.taxId,
        holderDocumentType: pendingFx.taxIdType,
      });
      createdIds.push(res.id);
      // Confirma que KYC pending NÃO bloqueou cadastro
      const kycCheck = await q(
        `SELECT i.kyc_status FROM actors a JOIN identities i ON i.global_user_id=a.global_user_id WHERE a.id=$1`,
        [pendingFx.actorId]
      );
      if (
        res.status === 'verified' && // auto_tax_id_match ainda funciona
        kycCheck.rows[0]?.kyc_status === 'pending'
      ) {
        ok('T6', 'cadastro criado mesmo com kyc_status=pending (D12 cadastro permitido)');
      } else {
        fail('T6', `status=${res.status} kyc=${kycCheck.rows[0]?.kyc_status}`);
      }
    } catch (e: any) {
      fail('T6', e.message);
    }

    // ── T7: F1/F2/F3 não acordados ────────────────────────────────────────────
    console.log('T7 — F1/F2/F3 não acordados (zero alteração em actor_wallet_payout_requests + CHECK preservado)');
    try {
      const snapNow = await getSnapshot();
      const checkOK =
        snapNow.payoutDestinationTypeConstraint === snapshot0.payoutDestinationTypeConstraint;
      const reqUnchanged = snapNow.payoutReq === snapshot0.payoutReq;
      if (checkOK && reqUnchanged) {
        ok('T7', `actor_wallet_payout_requests intocado; CHECK destination_type preservado`);
      } else {
        fail('T7', `Δreq=${snapNow.payoutReq - snapshot0.payoutReq} checkChanged=${!checkOK}`);
      }
    } catch (e: any) {
      fail('T7', e.message);
    }

    // ── T8: zero ledger / bank_transactions ───────────────────────────────────
    console.log('T8 — zero alteração em bank_ledger e bank_transactions; payout_requests legado intocado');
    try {
      const snapNow = await getSnapshot();
      if (
        snapNow.ledger === snapshot0.ledger &&
        snapNow.txs === snapshot0.txs &&
        snapNow.payouts === snapshot0.payouts
      ) {
        ok('T8', `ledger=${snapNow.ledger} txs=${snapNow.txs} payout_requests=${snapNow.payouts} todos inalterados`);
      } else {
        fail(
          'T8',
          `Δledger=${snapNow.ledger - snapshot0.ledger} Δtxs=${snapNow.txs - snapshot0.txs} Δpayouts=${snapNow.payouts - snapshot0.payouts}`
        );
      }
    } catch (e: any) {
      fail('T8', e.message);
    }
  } finally {
    // Cleanup
    if (createdIds.length > 0) {
      await q(
        `DELETE FROM actor_bank_destinations WHERE id = ANY($1::uuid[])`,
        [createdIds]
      ).catch(() => {});
    }
    if (pendingFx) {
      await pendingFx.cleanup();
    }
    await approvedFx.cleanup();
  }

  // ── summary ─────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${passed}/${passed + failed} cenários passaram`);
  if (failed > 0) {
    console.error(`FALHOU: ${failed} cenário(s)`);
    results.filter((r) => !r.ok).forEach((r) => console.error(`  ✗ ${r.name}: ${r.detail}`));
  } else {
    console.log('TODOS OS CENÁRIOS PASSARAM ✓');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('ERRO FATAL:', e);
  process.exit(1);
});
