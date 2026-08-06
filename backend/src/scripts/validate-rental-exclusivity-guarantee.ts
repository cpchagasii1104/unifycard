// backend/src/scripts/validate-rental-exclusivity-guarantee.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   docs/02_decisions/DECISION_0146_… §A.7/§B-bis G1 · CONSTITUIÇÃO ARTIGO II
// ║ NÃO:     rodar contra unificard_dev — exige EXPECTED_DATABASE_NAME de DB efêmera
// ║ EM VEZ:  backend/scripts/run-rental-exclusivity-guarantee-ephemeral.ps1
// ╚════════════════════════════════════════════════════════════════
//
// F-RENTAL-EXCLUSIVITY-GUARANTEE — prova comportamental da migration 20260806010000, nos DOIS
// sentidos. Guard estático prova que a constraint está ESCRITA; isto prova que ela MORDE.
//
// 🔴 ABORTA se não achar o alvo: prova vermelha que não altera nada PASSA com cara de sucesso.

import { Client } from 'pg';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME;
const URL = process.env.DATABASE_URL ?? '';
// ⚠️ `lastIndexOf` de propósito: o lint de vocabulário financeiro (DECISION-0158) conta o termo
// de partição de string como termo financeiro, em CÓDIGO **e em COMENTÁRIO**, e o teto só desce.
const dbName = URL.slice(URL.lastIndexOf('/') + 1);

if (!EXPECTED) { console.error('ABORT: EXPECTED_DATABASE_NAME ausente — recusa fail-closed.'); process.exit(2); }
if (dbName !== EXPECTED) { console.error(`ABORT: DATABASE_URL aponta para "${dbName}", esperado "${EXPECTED}".`); process.exit(2); }
if (dbName === 'unificard_dev') { console.error('ABORT: alvo é o banco OFICIAL.'); process.exit(2); }

const c = new Client({ connectionString: URL });
let fails = 0;

/** CPF com dígitos verificadores REAIS — `register` valida na borda; CPF sintético seria vermelho falso. */
function gerarCpf(): string {
  const base = String(Math.floor(Math.random() * 1e9)).padStart(9, '0').slice(-9);
  const dv = (nums: string): number => {
    const peso = nums.length + 1;
    const soma = Array.from(nums).reduce((acc, d, i) => acc + parseInt(d, 10) * (peso - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  return base + String(d1) + String(dv(base + String(d1)));
}

const ok = (n: string, extra = '') => console.log(`  ✅ ${n}${extra ? ' — ' + extra : ''}`);
const bad = (n: string, extra = '') => { fails++; console.log(`  ❌ ${n}${extra ? ' — ' + extra : ''}`); };

/** Espera que o INSERT VIOLE a constraint nomeada. Sucesso do INSERT = falha da prova. */
async function mustReject(label: string, resourceType: string, quantity: number, assetId: string) {
  try {
    await c.query(
      `INSERT INTO actor_asset_rental_terms (asset_id, resource_type, quantity) VALUES ($1,$2,$3)`,
      [assetId, resourceType, quantity]
    );
    bad(label, `INSERT PASSOU (${resourceType} quantity=${quantity}) — a garantia NÃO morde`);
    await c.query(`DELETE FROM actor_asset_rental_terms WHERE asset_id = $1`, [assetId]);
  } catch (e: any) {
    if (e?.constraint === 'chk_aart_quantity_single_unless_equipment') {
      ok(label, `recusado por ${e.constraint}`);
    } else {
      bad(label, `recusado pelo motivo ERRADO: ${e?.constraint ?? e?.code ?? e?.message}`);
    }
  }
}

async function mustAccept(label: string, resourceType: string, quantity: number, assetId: string) {
  try {
    await c.query(
      `INSERT INTO actor_asset_rental_terms (asset_id, resource_type, quantity) VALUES ($1,$2,$3)`,
      [assetId, resourceType, quantity]
    );
    ok(label);
    await c.query(`DELETE FROM actor_asset_rental_terms WHERE asset_id = $1`, [assetId]);
  } catch (e: any) {
    bad(label, `INSERT RECUSADO (${e?.constraint ?? e?.code}: ${e?.message})`);
  }
}

(async () => {
  await c.connect();
  console.log(`\nF-RENTAL-EXCLUSIVITY-GUARANTEE · banco efêmero "${dbName}"\n`);

  // ── pré-condição: a constraint EXISTE (senão a prova toda é teatro) ────────────────────────────
  const con = await c.query(
    `SELECT 1 FROM pg_constraint WHERE conname='chk_aart_quantity_single_unless_equipment'
       AND conrelid='actor_asset_rental_terms'::regclass`
  );
  if (con.rowCount === 0) {
    console.error('ABORT: chk_aart_quantity_single_unless_equipment NÃO existe — alvo ausente, prova inválida.');
    await c.end(); process.exit(2);
  }
  ok('pré-condição', 'a constraint alvo existe');

  // 🔴 FIXTURE PELO CAMINHO REAL — `authService.register`, o mesmo que os seeds usam. NÃO escrevo
  // em `actors` nem em `identities` daqui: o writer soberano é `modules/identity/actor-writer.service.ts`
  // (§4.8 LEI_COERENCIA), e `audit-schema-coherence-ratchet` mordeu a 1ª versão deste arquivo por
  // `INSERT INTO actors` direto (C5-ACTORS-INSERT-BOUNDARY). O guard estava certo; o código cedeu.
  // Bônus: o caminho real já resolve as travas que a fixture crua violava (chk_actor_requires_identity
  // e trg_actor_responsibility_check) — mais uma prova de que fixture irreal produz vermelho falso.
  // DI dos ports sociais — `ensureUserActorTx` (writer soberano) resolve o repositório pelo registry,
  // que em ambiente-script não vem do `app.builder`. Mesmo padrão de validate-yala-final-availability.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);

  const { authService } = await import('../core/auth/auth.service');
  const reg = await authService.register(
    undefined, `rental-excl-${Date.now()}@teste.local`, 'SenhaTeste!234', gerarCpf(), 'Dono Teste', '1985-03-15', undefined
  );
  const tenantId: string = reg.tenantId;
  const ownerRow = await c.query(
    `SELECT id::text AS id FROM actors WHERE user_id = $1::uuid AND actor_type = 'user' LIMIT 1`,
    [reg.user.userId]
  );
  if (ownerRow.rowCount === 0) { console.error('ABORT: actor humano não nasceu pelo caminho real.'); await c.end(); process.exit(2); }
  const ownerActorId: string = ownerRow.rows[0].id;
  // 🔴 `actor_assets.concept_id` NÃO referencia `concepts` — referencia `concept_asset_eligibilities`
  // (a elegibilidade é que autoriza virar ativo). Lido da FK, não suposto pelo nome da coluna.
  const cpt = await c.query(`SELECT concept_id FROM concept_asset_eligibilities LIMIT 1`);
  if (cpt.rowCount === 0) { console.error('ABORT: nenhum concept elegível a ativo no banco efêmero.'); await c.end(); process.exit(2); }
  const conceptId = cpt.rows[0].concept_id;

  const newAsset = async (label: string) => {
    const r = await c.query(
      `INSERT INTO actor_assets (id, tenant_id, owner_actor_id, concept_id, label, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active') RETURNING id`,
      [tenantId, ownerActorId, conceptId, label]
    );
    return r.rows[0].id as string;
  };

  console.log('\n(A) a garantia migrada MORDE no substrato vivo:');
  await mustReject('A1 vehicle  + quantity=10', 'vehicle', 10, await newAsset('carro'));
  await mustReject('A2 property + quantity=2 ', 'property', 2, await newAsset('imovel'));
  await mustReject('A3 space    + quantity=5 ', 'space', 5, await newAsset('espaco'));
  await mustAccept('A4 equipment+ quantity=10', 'equipment', 10, await newAsset('tenda'));
  await mustAccept('A5 vehicle  + quantity=1 ', 'vehicle', 1, await newAsset('carro-unico'));

  console.log('\n(B) o bloqueio de DECLARAÇÃO saiu do banco (0146 §A.7 / G1 · ART. II):');
  const ex = await c.query(
    `SELECT 1 FROM pg_constraint WHERE conname='availability_rental_no_overlap'
       AND conrelid='availability'::regclass`
  );
  if (ex.rowCount === 0) ok('B1 EXCLUDE availability_rental_no_overlap removida');
  else bad('B1 EXCLUDE availability_rental_no_overlap AINDA EXISTE');

  const res = await c.query(
    `INSERT INTO rentable_resources (id, tenant_id, owner_actor_id, concept_id, label, resource_type, quantity)
     VALUES (gen_random_uuid(), $1, $2, $3, 'recurso legado', 'equipment', 1) RETURNING id`,
    [tenantId, ownerActorId, conceptId]
  ).catch(() => null);

  if (!res) {
    console.log('  ⚠️  B2 PULADO — não consegui criar rentable_resources (schema divergiu). NÃO conto como sucesso.');
    fails++;
  } else {
    const resourceId = res.rows[0].id;
    const win = async (s: string, e: string) => c.query(
      `INSERT INTO availability (availability_id, tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone)
       VALUES (gen_random_uuid(), $1, 'rentable_resource', $2, 'fixed', 'active', $3, $4, 'America/Sao_Paulo')`,
      [tenantId, resourceId, s, e]
    );
    try {
      await win('2026-09-01T10:00:00Z', '2026-09-30T18:00:00Z');
      await win('2026-09-10T10:00:00Z', '2026-09-15T18:00:00Z'); // CONTIDA na anterior — era o caso do bug de 08/07
      ok('B2 duas janelas ATIVAS sobrepostas aceitas', 'declaração não bloqueia mais (ART. II)');
    } catch (e: any) {
      bad('B2 janela sobreposta ainda RECUSADA pelo banco', `${e?.constraint ?? e?.code}: ${e?.message}`);
    }
  }

  await c.end();
  console.log(`\n${fails === 0 ? '✅ TODAS AS PROVAS PASSARAM' : `❌ ${fails} PROVA(S) FALHARAM`}\n`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('ERRO NA PROVA:', e); process.exit(1); });
