// backend/src/modules/bank/__tests__/fiscal-reserve-bank-composition.db.test.ts
// FISCAL-4E · PASSE 3 — prova REAL (DB/E2E) da composição fiscal-Bank contra o SCHEMA + SINK + MOTOR reais.
// Roda SOMENTE contra banco EFÊMERO (FISCAL4E_EPHEMERAL=1 + DATABASE_URL do efêmero + firewall ON in-process);
// caso contrário SKIP (nunca toca unificard_dev). O ENVELOPE inteiro do efêmero é destruído ao final (script).
//
// Config fiscal (perfil/identidade/tipo/regra) é COMMITADA (o motor lê em conexão separada); o DINHEIRO
// (saldo do pagador + escritas da composição) vive na transação DONA (existingClient) e é ROLLBACK-safe:
// ao ROLLBACK, fiscal_provision_events/logs + bank_transactions/splits/ledger da composição somem (=0).

import { randomUUID } from 'node:crypto';

const RUN = process.env.FISCAL4E_EPHEMERAL === '1';
const d: jest.Describe = (RUN ? describe : describe.skip) as any;

const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce'; // tenant do ACTOR (reversal exige actor-in-tenant)
const COUNTRY = '42d04887-3033-459c-a4a9-8c6f9ea5a816'; // Brasil
const ACTOR = '213f4903-d0c3-4c03-aa2f-328e11aac807';
const FISCAL_IDENTITY = '9b7168b2-775d-42b7-8616-adc3e253edad';

const TAX_TYPE = '00000000-0000-4000-8000-0000000000aa';
const PAYER = '00000000-0000-4000-8000-0000000000b1';
const FEE = '00000000-0000-4000-8000-0000000000b2';
const SELLER = '00000000-0000-4000-8000-0000000000b3';
const RESERVE = '00000000-0000-4000-8000-0000000000b4';
const ACTOR_ACC = '00000000-0000-4000-8000-0000000000c1';   // conta owner_type='actor' (read-back Actor)
const OTHER_TENANT = 'a0000001-0000-4000-8000-000000000001'; // outro tenant (read-back cross-tenant)
const OTHER_ACC = '00000000-0000-4000-8000-0000000000c2';    // conta em OUTRO tenant

d('FISCAL-4E composição fiscal-Bank (DB efêmero real)', () => {
  let getClientWithTenant: any;
  let svc: any;
  let CompErr: any;
  let conceptId: string;

  beforeAll(async () => {
    process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED = 'true'; // efêmero-only; NUNCA commitado
    // §8: atravessa os gates internos (firewall + autoridade) SÓ no processo de teste efêmero; o PRODUTO
    // mantém firewall OFF e AUTHORITY_MODE=strict. permissive exige NODE_ENV=development (guard anti-vazamento).
    process.env.NODE_ENV = 'development';
    process.env.AUTHORITY_MODE = 'permissive';
    ({ getClientWithTenant } = await import('@core/database/pool'));
    const mod = await import('../fiscal-reserve-bank-composition.service');
    svc = mod.fiscalReserveBankCompositionService;
    CompErr = mod.FiscalReserveCompositionError;

    const c = await getClientWithTenant(TENANT);
    try {
      conceptId = (await c.query(`SELECT concept_id::text AS id FROM concepts LIMIT 1`)).rows[0].id;
      // identidade + perfil fiscal PLATFORM ativo (commit)
      await c.query(
        `INSERT INTO fiscal_identities (fiscal_identity_id, cnpj, kyb_status)
         VALUES ($1,'11222333000181','pending') ON CONFLICT DO NOTHING`, [FISCAL_IDENTITY]);
      // version alta → getActiveProfileForTenant (ORDER BY version DESC) escolhe ESTE perfil, mesmo se o
      // tenant já tiver perfil ativo no clone.
      await c.query(
        `INSERT INTO actor_fiscal_profiles (id, tenant_id, fiscal_identity_id, actor_id, tax_regime, status, version, effective_from)
         VALUES (gen_random_uuid(),$1,$2,$3,'SIMPLES_NACIONAL','active',999000, now() - interval '1 day')
         ON CONFLICT DO NOTHING`, [TENANT, FISCAL_IDENTITY, ACTOR]);
      // tipo fiscal (commit)
      await c.query(
        `INSERT INTO tax_types (id, tenant_id, code, name, scope_level, status, effective_from)
         VALUES ($1,$2,'FISCAL4E_P3','Prova 4E P3','country','active', now() - interval '1 day')
         ON CONFLICT DO NOTHING`, [TAX_TYPE, TENANT]);
      // contas: pagador (system, sem gate de risco) + destino da comissão + conta fiscal_reserve + mapping (commit)
      for (const [id, ot, at] of [[PAYER,'system','credit'],[FEE,'system','credit'],[SELLER,'system','credit'],[RESERVE,'system','fiscal_reserve']] as const) {
        await c.query(
          `INSERT INTO bank_accounts (id, tenant_id, owner_id, owner_type, account_type)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, [id, TENANT, 'sys:'+id, ot, at]);
      }
      // conta Actor (read-back Actor target) + conta em OUTRO tenant (read-back cross-tenant)
      await c.query(`INSERT INTO bank_accounts (id, tenant_id, owner_id, owner_type, account_type, actor_id)
                     VALUES ($1,$2,$3,'actor','credit',$4) ON CONFLICT (id) DO NOTHING`, [ACTOR_ACC, TENANT, 'actor:'+ACTOR, ACTOR]);
      await c.query(`INSERT INTO bank_accounts (id, tenant_id, owner_id, owner_type, account_type)
                     VALUES ($1,$2,$3,'system','credit') ON CONFLICT (id) DO NOTHING`, [OTHER_ACC, OTHER_TENANT, 'sys:other']);
      await c.query(
        `INSERT INTO fiscal_reserve_accounts (id, tenant_id, fiscal_identity_id, currency, bank_account_id)
         VALUES (gen_random_uuid(),$1,$2,'BRL',$3) ON CONFLICT DO NOTHING`, [TENANT, FISCAL_IDENTITY, RESERVE]);
      // §8: KYC do ACTOR aprovado no efêmero p/ atravessar o gate de risco do motor de reversão (dado
      // de fixture em banco descartável; o produto não é alterado).
      await c.query(
        `UPDATE identities SET kyc_status='approved'
          WHERE global_user_id IN (
            SELECT u.global_user_id FROM actors a JOIN users u ON u.id=a.user_id AND u.tenant_id=a.tenant_id
             WHERE a.id=$1 AND a.tenant_id=$2)`, [ACTOR, TENANT]);
    } finally { c.release(); }
  });

  async function setActiveRuleRate(rateBps: number) {
    const c = await getClientWithTenant(TENANT);
    try {
      await c.query(`UPDATE tax_rules SET status='deprecated' WHERE tenant_id=$1 AND taxpayer_kind='platform' AND status='active'`, [TENANT]);
      const v = Math.floor(Math.random() * 1_000_000_000);
      await c.query(
        `INSERT INTO tax_rules (id, tenant_id, tax_type_id, scope_level, taxpayer_kind, rate_bps, rounding_mode,
                                country_id, status, version, source, effective_from)
         VALUES (gen_random_uuid(),$1,$2,'country','platform',$3,'half_up',$4,'active',$5,'test', now() - interval '1 day')`,
        [TENANT, TAX_TYPE, rateBps, COUNTRY, v]);
    } finally { c.release(); }
  }

  function input(ref: string) {
    return {
      tenantId: TENANT, currency: 'BRL' as const, referenceType: 'fiscal4e_p3', referenceId: ref,
      fromAccountId: PAYER, payerActorId: ACTOR, conceptId, description: 'fiscal 4e p3 composition proof',
      authorship: { actingForActorId: ACTOR } as any,
      originalSplitLines: [
        { lineId: 'seller', targetAccountId: SELLER, amountCents: 9000, receiverActorId: ACTOR, splitType: 'revenue_share' as const },
        { lineId: 'commission', targetAccountId: FEE, amountCents: 1000, receiverActorId: ACTOR, splitType: 'fee' as const },
      ],
      commissionGrossSourceLineId: 'commission',
      platformRevenueStream: 'marketplace_commission' as const,
      fiscalCountryId: COUNTRY, fiscalStateId: null, fiscalCityId: null,
      occurredAt: new Date(), consumptionMode: 'mandatory' as const, buyerTerritory: { cityId: 'BUYER' },
    };
  }

  // Roda a composição numa transação DONA rollback-safe; semeia saldo do pagador in-tx; devolve os fatos observados.
  async function runInTx(inp: any, assertOnClient: (c: any) => Promise<void>) {
    const c = await getClientWithTenant(TENANT);
    try {
      await c.query('BEGIN');
      await c.query(`INSERT INTO bank_ledger (tenant_id, account_id, direction, amount_cents) VALUES ($1,$2,'credit',100000)`, [TENANT, PAYER]);
      const res = await svc.composePlatformCommission(inp, c);
      await assertOnClient(c);
      await c.query('ROLLBACK');
      return res;
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
    finally { c.release(); }
  }

  async function counts(c: any, ref: string) {
    const q = async (sql: string) => Number((await c.query(sql, [ref])).rows[0].n);
    return {
      events: await q(`SELECT count(*)::int n FROM fiscal_provision_events WHERE reference_id=$1`),
      tx: await q(`SELECT count(*)::int n FROM bank_transactions WHERE reference_id=$1`),
      splits: await q(`SELECT count(*)::int n FROM bank_splits s JOIN bank_transactions t ON t.id=s.transaction_id WHERE t.reference_id=$1`),
    };
  }

  it('CASO 1 — reserve>0 & dist>0 (rate 15%) → continuation + tax_reserve; conservação; Bank real', async () => {
    await setActiveRuleRate(1500);
    const ref = 'c1-' + randomUUID();
    const res = await runInTx(input(ref), async (c) => {
      const ev = (await c.query(`SELECT id, commission_gross_cents::int g, tax_reserve_cents::int r, commission_distributable_cents::int d FROM fiscal_provision_events WHERE reference_id=$1 AND event_kind='provision'`, [ref])).rows[0];
      expect(ev.g).toBe(1000);
      expect(ev.r).toBe(150);
      expect(ev.d).toBe(850);
      const splits = (await c.query(`SELECT s.split_type, s.amount_cents::int amt, s.target_account_id::text tgt FROM bank_splits s JOIN bank_transactions t ON t.id=s.transaction_id WHERE t.reference_id=$1 ORDER BY amt`, [ref])).rows;
      const bytype = Object.fromEntries(splits.map((s: any) => [s.split_type, s]));
      expect(bytype['tax_reserve'].amt).toBe(150);
      expect(bytype['tax_reserve'].tgt).toBe(RESERVE);
      expect(bytype['fee'].amt).toBe(850);      // continuation herda split_type 'fee'
      expect(bytype['fee'].tgt).toBe(FEE);
      // conservação global: Σsplits == amount == 10000; ledger balanceado
      const sum = splits.reduce((a: number, s: any) => a + s.amt, 0);
      expect(sum).toBe(10000);
      const led = (await c.query(`SELECT l.direction, SUM(l.amount_cents)::int s FROM bank_ledger l JOIN bank_transactions t ON t.id=l.transaction_id WHERE t.reference_id=$1 GROUP BY l.direction`, [ref])).rows;
      const dbt = led.find((r: any) => r.direction==='debit')?.s ?? 0;
      const crd = led.find((r: any) => r.direction==='credit')?.s ?? 0;
      expect(dbt).toBe(crd); // double-entry balanceado
      // vínculo Bank→fiscal
      const tx = (await c.query(`SELECT fiscal_provision_event_id::text fid FROM bank_transactions WHERE reference_id=$1`, [ref])).rows[0];
      expect(tx.fid).toBe(ev.id);
    });
    expect(res.materializedContinuation).toBe(true);
    expect(res.materializedTaxReserve).toBe(true);
    expect(res.splitCount).toBe(3);
    // após ROLLBACK: fresh client não vê nada
    const fresh = await getClientWithTenant(TENANT);
    try { expect((await counts(fresh, ref)).tx).toBe(0); } finally { fresh.release(); }
  });

  it('CASO 2 — reserve>0 & dist=0 (rate 100%) → somente tax_reserve', async () => {
    await setActiveRuleRate(10000);
    const ref = 'c2-' + randomUUID();
    const res = await runInTx(input(ref), async (c) => {
      const splits = (await c.query(`SELECT s.split_type, s.amount_cents::int amt FROM bank_splits s JOIN bank_transactions t ON t.id=s.transaction_id WHERE t.reference_id=$1`, [ref])).rows;
      expect(splits.some((s: any) => s.split_type === 'tax_reserve' && s.amt === 1000)).toBe(true);
      // sem continuation (fee) além do seller
      expect(splits.filter((s: any) => s.split_type === 'fee').length).toBe(0);
      expect(splits.reduce((a: number, s: any) => a + s.amt, 0)).toBe(10000);
    });
    expect(res.materializedContinuation).toBe(false);
    expect(res.materializedTaxReserve).toBe(true);
    expect(res.splitCount).toBe(2); // seller + tax_reserve
  });

  it('CASO 3 — reserve=0 & dist>0 (rate 0) → somente continuation; resolver NÃO exigido', async () => {
    await setActiveRuleRate(0);
    const ref = 'c3-' + randomUUID();
    const res = await runInTx(input(ref), async (c) => {
      const splits = (await c.query(`SELECT s.split_type, s.amount_cents::int amt FROM bank_splits s JOIN bank_transactions t ON t.id=s.transaction_id WHERE t.reference_id=$1`, [ref])).rows;
      expect(splits.some((s: any) => s.split_type === 'tax_reserve')).toBe(false);
      expect(splits.some((s: any) => s.split_type === 'fee' && s.amt === 1000)).toBe(true); // continuation = gross inteiro
      expect(splits.reduce((a: number, s: any) => a + s.amt, 0)).toBe(10000);
    });
    expect(res.materializedTaxReserve).toBe(false);
    expect(res.splitCount).toBe(2); // seller + continuation
  });

  it('FALHA — provisão ausente (nenhuma regra ativa) → FISCAL_CONFIG_MISSING, sem resíduo', async () => {
    const c0 = await getClientWithTenant(TENANT);
    try { await c0.query(`UPDATE tax_rules SET status='deprecated' WHERE tenant_id=$1 AND status='active'`, [TENANT]); } finally { c0.release(); }
    const ref = 'f1-' + randomUUID();
    await expect(runInTx(input(ref), async () => {})).rejects.toThrow(/FISCAL_CONFIG_MISSING/);
    const fresh = await getClientWithTenant(TENANT);
    try { expect((await counts(fresh, ref)).events).toBe(0); expect((await counts(fresh, ref)).tx).toBe(0); } finally { fresh.release(); }
  });

  it('PAYLOAD MISMATCH — mesma tuple, fingerprint divergente → IDEMPOTENCY_PAYLOAD_MISMATCH', async () => {
    await setActiveRuleRate(1500);
    const ref = 'pm-' + randomUUID();
    const c = await getClientWithTenant(TENANT);
    try {
      await c.query('BEGIN');
      await c.query(`INSERT INTO bank_ledger (tenant_id, account_id, direction, amount_cents) VALUES ($1,$2,'credit',100000)`, [TENANT, PAYER]);
      await svc.composePlatformCommission(input(ref), c);
      const diff = input(ref); diff.buyerTerritory = { cityId: 'OUTRO' }; // muda o payload (fingerprint), mesma tuple
      await expect(svc.composePlatformCommission(diff, c)).rejects.toThrow(/IDEMPOTENCY_PAYLOAD_MISMATCH/);
      await c.query('ROLLBACK');
    } finally { c.release(); }
  });

  // Full reversal ATÔMICA (PASSE 3R): provisão + evento de reversão + reversão Bank formal na MESMA tx DONA.
  async function provisionAndReverseInTx(rateBps: number, ref: string, assertFn: (c: any, prov: any, rev: any) => Promise<void>) {
    await setActiveRuleRate(rateBps);
    const c = await getClientWithTenant(TENANT);
    try {
      await c.query('BEGIN');
      await c.query(`INSERT INTO bank_ledger (tenant_id, account_id, direction, amount_cents) VALUES ($1,$2,'credit',100000)`, [TENANT, PAYER]);
      const prov = await svc.composePlatformCommission(input(ref), c);
      const rev = await svc.reverseFullPlatformCommission({ tenantId: TENANT, referenceType: 'fiscal4e_p3', referenceId: ref, actorId: ACTOR }, c);
      await assertFn(c, prov, rev);
      await c.query('ROLLBACK');
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
    // atomicidade: após ROLLBACK da DONA, NADA sobrevive (provisão + reversão desfeitas juntas)
    const fresh = await getClientWithTenant(TENANT);
    try {
      const ev = Number((await fresh.query(`SELECT count(*)::int n FROM fiscal_provision_events WHERE reference_id=$1`, [ref])).rows[0].n);
      const tx = Number((await fresh.query(`SELECT count(*)::int n FROM bank_transactions WHERE reference_id=$1 OR reference_id LIKE $2`, [ref, `%${ref}%`])).rows[0].n);
      expect(ev).toBe(0);
      expect(tx).toBe(0);
    } finally { fresh.release(); }
  }

  async function revCounts(c: any, ref: string) {
    const eventKinds = (await c.query(`SELECT event_kind, count(*)::int n FROM fiscal_provision_events WHERE reference_id=$1 GROUP BY event_kind`, [ref])).rows;
    const legs = Number((await c.query(`SELECT count(*)::int n FROM bank_transactions WHERE reference_type LIKE 'financial_reversal%' AND (reference_id=$1 OR metadata->>'original_transaction_id' IS NOT NULL) AND tenant_id=$2`, [ref, TENANT])).rows[0].n);
    return { eventKinds: Object.fromEntries(eventKinds.map((r: any) => [r.event_kind, r.n])), legs };
  }

  it('REVERSAL — sem evento original → fail-closed (na tx DONA)', async () => {
    const c = await getClientWithTenant(TENANT);
    try {
      await c.query('BEGIN');
      await expect(svc.reverseFullPlatformCommission({ tenantId: TENANT, referenceType: 'fiscal4e_p3', referenceId: 'nao-existe-' + randomUUID(), actorId: ACTOR }, c))
        .rejects.toThrow(/REVERSAL_NO_ORIGINAL/);
      await c.query('ROLLBACK');
    } finally { c.release(); }
  });

  it('REVERSAL CASO A — duas linhas (continuation + tax_reserve) revertidas; original imutável; atomicidade', async () => {
    const ref = 'rA-' + randomUUID();
    await provisionAndReverseInTx(1500, ref, async (c, prov, rev) => {
      expect(rev.reversedEventId).toBe(prov.fiscalProvisionEventId);
      const rc = await revCounts(c, ref);
      expect(rc.eventKinds.provision).toBe(1);
      expect(rc.eventKinds.full_reversal).toBe(1); // evento reverso append-only (original preservado)
      expect(rc.legs).toBeGreaterThanOrEqual(2);   // duas legs Bank reversas (fee + reserve)
      // reversão REUSA amounts do original (sem recomputar): evento reverso == amounts do provision
      const revEv = (await c.query(`SELECT tax_reserve_cents::int r, commission_distributable_cents::int d FROM fiscal_provision_events WHERE reference_id=$1 AND event_kind='full_reversal'`, [ref])).rows[0];
      expect(revEv.r).toBe(150); expect(revEv.d).toBe(850);
      // ledger das TRANSAÇÕES (provisão + legs de reversão; exclui o crédito-semente de saldo, sem tx):
      // Σcredito == Σdebito (double-entry provisão + reversão perfeitamente balanceado)
      const led = (await c.query(`SELECT direction, SUM(amount_cents)::int s FROM bank_ledger WHERE tenant_id=$1 AND transaction_id IS NOT NULL GROUP BY direction`, [TENANT])).rows;
      const dbt = led.find((r: any) => r.direction==='debit')?.s ?? 0;
      const crd = led.find((r: any) => r.direction==='credit')?.s ?? 0;
      expect(dbt).toBe(crd);
    });
  });

  it('REVERSAL CASO B — somente tax_reserve revertida (dist=0)', async () => {
    const ref = 'rB-' + randomUUID();
    await provisionAndReverseInTx(10000, ref, async (c, _p, _r) => {
      const rc = await revCounts(c, ref);
      expect(rc.eventKinds.full_reversal).toBe(1);
      expect(rc.legs).toBeGreaterThanOrEqual(1); // só a leg da tax_reserve (+ possivelmente seller)
    });
  });

  it('REVERSAL CASO C — somente continuation revertida (reserve=0)', async () => {
    const ref = 'rC-' + randomUUID();
    await provisionAndReverseInTx(0, ref, async (c, _p, _r) => {
      const rc = await revCounts(c, ref);
      expect(rc.eventKinds.full_reversal).toBe(1);
    });
  });

  // ── FAULT INJECTION (§2): falha determinística test-only em 4 profundidades da reversão; prova que o
  // ROLLBACK da DONA desfaz TUDO (client novo = zero). Wrapper LANÇA no lugar de rodar a query casada —
  // strictly test-only (sem env/rota/flag de produção; sem 2º motor).
  function makeFailingClient(real: any) {
    const st: any = { pattern: null, nth: 1, count: 0 };
    return {
      query: (sql: any, params?: any) => {
        if (st.pattern && st.pattern.test(String(sql))) { st.count++; if (st.count >= st.nth) return Promise.reject(new Error('FAULT_INJECTED')); }
        return real.query(sql, params);
      },
      release: () => real.release(),
      arm: (pattern: RegExp, nth = 1) => { st.pattern = pattern; st.nth = nth; st.count = 0; },
    };
  }
  async function faultInjectReversal(pattern: RegExp, nth: number) {
    await setActiveRuleRate(1500);
    const ref = 'fi-' + randomUUID();
    const real = await getClientWithTenant(TENANT);
    const fc = makeFailingClient(real);
    try {
      await fc.query('BEGIN');
      await fc.query(`INSERT INTO bank_ledger (tenant_id, account_id, direction, amount_cents) VALUES ($1,$2,'credit',100000)`, [TENANT, PAYER]);
      await svc.composePlatformCommission(input(ref), fc as any); // provisão (NÃO armada)
      fc.arm(pattern, nth); // arma a falha SÓ para a reversão
      await expect(svc.reverseFullPlatformCommission({ tenantId: TENANT, referenceType: 'fiscal4e_p3', referenceId: ref, actorId: ACTOR }, fc as any))
        .rejects.toThrow(/FAULT_INJECTED/);
      await real.query('ROLLBACK'); // rollback da DONA
    } catch (e) { await real.query('ROLLBACK').catch(() => {}); throw e; } finally { real.release(); }
    // client NOVO: zero resíduo (provisão + reversão parcial desfeitas juntas)
    const fresh = await getClientWithTenant(TENANT);
    try {
      const n = async (sql: string) => Number((await fresh.query(sql, [ref])).rows[0].n);
      expect(await n(`SELECT count(*)::int n FROM fiscal_provision_events WHERE reference_id=$1`)).toBe(0);
      expect(await n(`SELECT count(*)::int n FROM bank_transactions WHERE reference_id=$1`)).toBe(0);
      expect(await n(`SELECT count(*)::int n FROM bank_splits s JOIN bank_transactions t ON t.id=s.transaction_id WHERE t.reference_id=$1`)).toBe(0);
    } finally { fresh.release(); }
  }

  it('F1 — falha APÓS evento fiscal reverso, antes da reversão Bank → rollback total, zero resíduo', async () => {
    await faultInjectReversal(/SELECT id::text AS id FROM bank_transactions/, 1); // locate (após INSERT do evento)
  });
  it('F2 — falha APÓS bank transaction reversa, antes do ledger → rollback total, zero resíduo', async () => {
    await faultInjectReversal(/INSERT INTO bank_ledger/, 1); // 1ª leg: tx criada, ledger ainda não
  });
  it('F3 — falha DURANTE as legs (splits) reversas → rollback total, zero resíduo', async () => {
    await faultInjectReversal(/INSERT INTO\s+bank_transactions/, 2); // 2ª leg: leg1 completa, leg2 parcial
  });
  it('F4 — falha DURANTE o ledger reverso → rollback total, zero resíduo', async () => {
    await faultInjectReversal(/INSERT INTO bank_ledger/, 2); // 2ª escrita de ledger
  });

  // ── READ-BACK TARGET-ACCOUNT-FIRST (§4-§7): sintetiza bank_transaction + split committados, chama
  // getSplitsByTransaction (conexão própria), assere e limpa (DELETE — sem trigger de imutabilidade).
  async function synthSplit(targetAccountId: string | null, targetActorId: string | null, splitType: string, tenant = TENANT) {
    const c = await getClientWithTenant(tenant);
    const txId = randomUUID();
    try {
      await c.query(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, concept_id, reference_type, reference_id)
                     VALUES ($1,$2,$3,$4,1000,'execution','read-back synthetic row',$5,'rb_synth',$6)`, [txId, tenant, ACTOR, PAYER, conceptId, 'rbs-' + txId]);
      await c.query(`INSERT INTO bank_splits (tenant_id, transaction_id, source_actor_id, target_account_id, target_actor_id, amount_cents, split_type)
                     VALUES ($1,$2,$6,$3,$4,1000,$5)`, [tenant, txId, targetAccountId, targetActorId, splitType, ACTOR]);
    } finally { c.release(); }
    return txId;
  }
  async function readBack(txId: string) { const { bankSplitRepository } = await import('../bank-split.repository'); return bankSplitRepository.getSplitsByTransaction(TENANT, txId); }

  it('READ-BACK Actor target → targetAccountId da conta Actor persistida', async () => {
    const txId = await synthSplit(ACTOR_ACC, ACTOR, 'revenue_share');
    try { const [s] = await readBack(txId); expect(s.targetAccountId).toBe(ACTOR_ACC); } finally { /* bank_splits append-only: sem cleanup (efêmero destruído) */ }
  });
  it('READ-BACK system target (actor_id NULL) → targetAccountId system; split_type preservado', async () => {
    const txId = await synthSplit(RESERVE, null, 'tax_reserve');
    try { const [s] = await readBack(txId); expect(s.targetAccountId).toBe(RESERVE); expect(s.splitType).toBe('tax_reserve'); } finally { /* bank_splits append-only: sem cleanup (efêmero destruído) */ }
  });
  it('READ-BACK mixed (Actor + system) → cada split mantém a PRÓPRIA conta', async () => {
    const c = await getClientWithTenant(TENANT); const txId = randomUUID();
    try {
      await c.query(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, concept_id, reference_type, reference_id) VALUES ($1,$2,$3,$4,2000,'execution','read-back synthetic row',$5,'rb_synth',$6)`, [txId, TENANT, ACTOR, PAYER, conceptId, 'rbs-' + txId]);
      await c.query(`INSERT INTO bank_splits (tenant_id, transaction_id, source_actor_id, target_account_id, target_actor_id, amount_cents, split_type) VALUES ($1,$2,$5,$3,$4,1000,'revenue_share')`, [TENANT, txId, ACTOR_ACC, ACTOR, ACTOR]);
      await c.query(`INSERT INTO bank_splits (tenant_id, transaction_id, source_actor_id, target_account_id, target_actor_id, amount_cents, split_type) VALUES ($1,$2,$4,$3,NULL,1000,'tax_reserve')`, [TENANT, txId, RESERVE, ACTOR]);
    } finally { c.release(); }
    try {
      const splits = await readBack(txId);
      const byType = Object.fromEntries(splits.map((s: any) => [s.splitType, s.targetAccountId]));
      expect(byType['revenue_share']).toBe(ACTOR_ACC);
      expect(byType['tax_reserve']).toBe(RESERVE); // não trocado nem inferido pelo outro split
    } finally { /* bank_splits append-only: sem cleanup (efêmero destruído) */ }
  });
  it('READ-BACK target ausente (conta inexistente) → FAIL-CLOSED (não cai em fallback Actor)', async () => {
    // FATO FÍSICO: bank_splits.target_account_id tem FK → bank_accounts. Uma conta INEXISTENTE é REJEITADA
    // pelo próprio DB (fail-closed físico, mais forte que app). O cenário "target ausente" não é construível.
    const c = await getClientWithTenant(TENANT); const txId = randomUUID();
    try {
      await c.query(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, concept_id, reference_type, reference_id) VALUES ($1,$2,$3,$4,1000,'execution','read-back synthetic row',$5,'rb_synth',$6)`, [txId, TENANT, ACTOR, PAYER, conceptId, 'rbs-' + txId]);
      await expect(c.query(`INSERT INTO bank_splits (tenant_id, transaction_id, source_actor_id, target_account_id, amount_cents, split_type) VALUES ($1,$2,$3,$4,1000,'fee')`, [TENANT, txId, ACTOR, randomUUID()]))
        .rejects.toThrow(/target_account_id_fkey|chave estrangeira|foreign key/);
    } finally { c.release(); }
  });
  it('READ-BACK cross-tenant (conta de outro tenant) → FAIL-CLOSED (FK é global-id; cheque de tenant na app)', async () => {
    const txId = await synthSplit(OTHER_ACC, null, 'fee'); // OTHER_ACC vive em OUTRO tenant (FK global permite inserir)
    try { await expect(readBack(txId)).rejects.toThrow(/CROSS_TENANT/); } finally { /* bank_splits append-only: sem cleanup (efêmero destruído) */ }
  });
  it('READ-BACK legado NULL → coluna target_account_id é NOT NULL (nenhuma linha legada NULL possível)', async () => {
    // FATO FÍSICO: target_account_id é NOT NULL → o fallback Actor (COALESCE 2º arg) é DEFENSIVO/inalcançável.
    const c = await getClientWithTenant(TENANT); const txId = randomUUID();
    try {
      await c.query(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, concept_id, reference_type, reference_id) VALUES ($1,$2,$3,$4,1000,'execution','read-back synthetic row',$5,'rb_synth',$6)`, [txId, TENANT, ACTOR, PAYER, conceptId, 'rbs-' + txId]);
      await expect(c.query(`INSERT INTO bank_splits (tenant_id, transaction_id, source_actor_id, target_account_id, amount_cents, split_type) VALUES ($1,$2,$3,NULL,1000,'fee')`, [TENANT, txId, ACTOR]))
        .rejects.toThrow(/não-nulo|not-null|null value/);
    } finally { c.release(); }
  });

  it('RESÍDUO ZERO — após todos os casos, as tabelas de dinheiro/evento estão zeradas', async () => {
    const c = await getClientWithTenant(TENANT);
    try {
      const n = async (sql: string) => Number((await c.query(sql, [TENANT])).rows[0].n);
      // Resíduo da COMPOSIÇÃO (provisão + reversão) = ZERO. Exclui scaffolding read-only 'rb_synth'
      // (bank_splits é append-only → não removível; é dado de teste de leitura, não escrita da composição).
      expect(await n(`SELECT count(*)::int n FROM fiscal_provision_events WHERE tenant_id=$1`)).toBe(0);
      expect(await n(`SELECT count(*)::int n FROM fiscal_provision_logs WHERE tenant_id=$1`)).toBe(0);
      expect(await n(`SELECT count(*)::int n FROM bank_transactions WHERE tenant_id=$1 AND reference_type <> 'rb_synth'`)).toBe(0);
      expect(await n(`SELECT count(*)::int n FROM bank_splits WHERE tenant_id=$1 AND transaction_id NOT IN (SELECT id FROM bank_transactions WHERE reference_type='rb_synth')`)).toBe(0);
      expect(await n(`SELECT count(*)::int n FROM bank_ledger WHERE tenant_id=$1`)).toBe(0);
    } finally { c.release(); }
  });

  // Idempotência é propriedade de estado COMMITADO (o dup-path do sink lê a tx por getTransactionById em
  // conexão separada). Roda POR ÚLTIMO: comita a provisão original, faz replay em client novo e prova que
  // NÃO duplica (mesmos ids; counts inalterados). Deixa resíduo commitado — aceitável: é o último ato antes
  // da destruição do efêmero, e a prova de rollback-safe (RESÍDUO ZERO) já rodou acima.
  it('IDEMPOTÊNCIA (commit+replay) — replay NÃO duplica evento/tx/splits (garantia de dado)', async () => {
    await setActiveRuleRate(1500);
    const ref = 'id-' + randomUUID();
    let r1: any;
    const c = await getClientWithTenant(TENANT);
    try {
      await c.query('BEGIN');
      await c.query(`INSERT INTO bank_ledger (tenant_id, account_id, direction, amount_cents) VALUES ($1,$2,'credit',100000)`, [TENANT, PAYER]);
      r1 = await svc.composePlatformCommission(input(ref), c);
      await c.query('COMMIT');
    } finally { c.release(); }
    const c2 = await getClientWithTenant(TENANT);
    try {
      // baseline COMMITADO
      expect(await counts(c2, ref)).toEqual({ events: 1, tx: 1, splits: 3 });
      // Replay sobre estado commitado: com o read-back corrigido (PASSE 3R), o dup-path do sink reconstrói
      // corretamente a linha tax_reserve system → retorno idempotente LIMPO (mesmos ids), sem duplicação.
      await c2.query('BEGIN');
      const r2 = await svc.composePlatformCommission(input(ref), c2);
      expect(r2.idempotent).toBe(true);
      expect(r2.fiscalProvisionEventId).toBe(r1.fiscalProvisionEventId);
      expect(r2.bankTransactionId).toBe(r1.bankTransactionId);
      await c2.query('ROLLBACK');
      expect(await counts(c2, ref)).toEqual({ events: 1, tx: 1, splits: 3 });
    } finally { c2.release(); }
  });

  // §10 READ-BACK de system target: getSplitsByTransaction (conexão própria) reconstrói o destino pela FK
  // persistida (COALESCE bs.target_account_id) → resolve a conta system fiscal_reserve (actor_id NULL) que
  // a resolução legada por Actor jamais resolveria. Prova sobre composição COMMITADA.
  it('READ-BACK — getSplitsByTransaction resolve o alvo system fiscal_reserve (tax_reserve) pela FK persistida', async () => {
    await setActiveRuleRate(1500);
    const ref = 'rb-' + randomUUID();
    let bankTxId: string;
    const c = await getClientWithTenant(TENANT);
    try {
      await c.query('BEGIN');
      await c.query(`INSERT INTO bank_ledger (tenant_id, account_id, direction, amount_cents) VALUES ($1,$2,'credit',100000)`, [TENANT, PAYER]);
      const prov = await svc.composePlatformCommission(input(ref), c);
      bankTxId = prov.bankTransactionId;
      await c.query('COMMIT');
    } finally { c.release(); }
    const { bankSplitRepository } = await import('../bank-split.repository');
    const splits = await bankSplitRepository.getSplitsByTransaction(TENANT, bankTxId!);
    const bytype = Object.fromEntries(splits.map((s: any) => [s.splitType, s]));
    // a linha tax_reserve resolve o targetAccountId system (RESERVE) — antes lançava "sem target resolvível"
    expect(bytype['tax_reserve'].targetAccountId).toBe(RESERVE);
    expect(bytype['fee'].targetAccountId).toBe(FEE);       // continuation (target Actor-less system) resolvido
    expect(bytype['revenue_share'].targetAccountId).toBe(SELLER);
    // nenhuma linha sem destino
    expect(splits.every((s: any) => !!s.targetAccountId)).toBe(true);
  });

  // REGRESSÃO do caminho LEGADO (ownsTx=true): reverseTransaction SEM existingClient gerencia a própria
  // transação (BEGIN/COMMIT/hooks/markFailed) exatamente como antes do PASSE 3R. Prova sobre composição
  // COMMITADA (o motor legado lê em conexão própria).
  it('REGRESSÃO — reverseTransaction SEM existingClient (caminho legado) reverte o Bank e executa', async () => {
    await setActiveRuleRate(1500);
    const ref = 'leg-' + randomUUID();
    let bankTxId: string;
    const c = await getClientWithTenant(TENANT);
    try {
      await c.query('BEGIN');
      await c.query(`INSERT INTO bank_ledger (tenant_id, account_id, direction, amount_cents) VALUES ($1,$2,'credit',100000)`, [TENANT, PAYER]);
      const prov = await svc.composePlatformCommission(input(ref), c);
      bankTxId = prov.bankTransactionId;
      await c.query('COMMIT');
    } finally { c.release(); }
    const { bankIntegrationService } = await import('../bank-integration.service');
    const res = await bankIntegrationService.reverseTransaction(TENANT, bankTxId!, undefined, ACTOR); // SEM existingClient
    expect(res.reversalTransactionId).toBeTruthy();
    // a reversal row foi executada (state machine legada) e há legs Bank reversas
    const fresh = await getClientWithTenant(TENANT);
    try {
      const rev = (await fresh.query(`SELECT status FROM reversals WHERE tenant_id=$1 AND original_transaction_id=$2`, [TENANT, bankTxId])).rows[0];
      expect(rev.status).toBe('executed');
      const legs = Number((await fresh.query(`SELECT count(*)::int n FROM bank_transactions WHERE tenant_id=$1 AND reference_type LIKE 'financial_reversal%'`, [TENANT])).rows[0].n);
      expect(legs).toBeGreaterThanOrEqual(1);
    } finally { fresh.release(); }
  });
});
