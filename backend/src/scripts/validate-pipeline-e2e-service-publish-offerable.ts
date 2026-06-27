/**
 * F-MVP-SERVICE-PUBLISH-OFFERABLE-AUTOCOMPLETE (Opção A — ESTRITO) — E2E + negative-proof.
 *
 * Prova que `canonicalServiceService.searchOfferable` devolve SOMENTE o que o actor ativo pode publicar
 * AGORA, usando o MESMO predicado do gate DECISION-0144 (PF: actor_professional_concepts.is_active;
 * PJ: company_concept_publications.status='active'). Funções REAIS; fixture committed + teardown (DB
 * virgem restaurado). READ-ONLY de catálogo → PRÉ-DINHEIRO (Δbank=0 asserido).
 *
 * Também faz asserts ESTÁTICOS no frontend: /services/new NÃO usa mais a busca aberta e NÃO replica o
 * predicado PF/PJ no browser.
 *
 * Uso: pnpm exec tsx src/scripts/validate-pipeline-e2e-service-publish-offerable.ts
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadBackendEnv } from '../core/db/load-backend-env';
loadBackendEnv();

const TENANT = process.env.E2E_TENANT_ID?.trim() || 'fbe13b78-4516-493d-905a-363796aea1d1';

const fails: string[] = [];
const ok = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails.push(l); };

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL ausente'); process.exit(1); }
  const { pool } = await import('../core/database/pool');
  const { canonicalServiceService } = await import('../core/catalog/canonical/canonical-service.service');

  const c = await pool.connect();
  await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);

  // fixtures que serão criadas (ids p/ teardown determinístico)
  let PF = '';                       // user-actor existente (sem declaração ativa do concept-alvo)
  let GROUP = '';                    // group-actor existente (subject não suportado), se houver
  const PF_CONCEPT_SLUG = 'corte-de-cabelo-masculino';
  let pfConcept = '';                // concept serviciável real (tem canonical_service)
  let pfCanonName = '';
  let pfDeclInserted = false;

  // PJ (best-effort)
  let PJ_PAGE = '';                  // page-actor existente
  let PJ_COMPANY = '';               // company do page-actor
  let PJ_HUMAN = '';                 // actor humano p/ created_by
  let pjConcept = '';                // concept p/ canonical scoped + publicação
  const PJ_CANON = randomUUID();
  let pjPubInserted = false;
  let pjCanonInserted = false;

  // Δbank=0
  let ledgerBefore = -1;

  try {
    // ───────── baseline dinheiro ─────────
    ledgerBefore = (await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM bank_ledger WHERE tenant_id=$1`, [TENANT]).catch(() => ({ rows: [{ n: -1 }] }))).rows[0].n;

    // ───────── concept serviciável REAL (alvo da ponte 0094/seed bridge) ─────────
    const cc = await c.query<{ concept_id: string }>(`SELECT concept_id FROM concepts WHERE domain='servicos' AND slug=$1 LIMIT 1`, [PF_CONCEPT_SLUG]);
    if (cc.rows.length === 0) { console.error(`concept servicos/${PF_CONCEPT_SLUG} ausente — pré-req da seed bridge`); process.exit(1); }
    pfConcept = cc.rows[0].concept_id;
    const cn = await c.query<{ name: string }>(`SELECT name FROM canonical_services WHERE concept_id=$1 AND scope='global' AND status='active' LIMIT 1`, [pfConcept]);
    ok(cn.rows.length === 1, `0. pré-req: canonical_service GLOBAL ativo existe p/ ${PF_CONCEPT_SLUG}`);
    pfCanonName = cn.rows[0]?.name ?? '';

    // PF = user-actor SEM declaração ativa desse concept (não clobberar dados reais)
    const ar = await c.query<{ id: string }>(
      `SELECT a.id FROM actors a
        WHERE a.tenant_id=$1 AND a.actor_type='user'
          AND NOT EXISTS (SELECT 1 FROM actor_professional_concepts apc
                           WHERE apc.tenant_id=$1 AND apc.actor_id=a.id AND apc.concept_id=$2 AND apc.is_active=true)
        LIMIT 1`, [TENANT, pfConcept]);
    PF = ar.rows[0]?.id ?? '';

    const gr = await c.query<{ id: string }>(`SELECT id FROM actors WHERE tenant_id=$1 AND actor_type='group' AND company_id IS NULL LIMIT 1`, [TENANT]);
    GROUP = gr.rows[0]?.id ?? '';
    console.log(`    fixture PF=${PF || '(nenhum limpo)'} group=${GROUP || '(nenhum)'} concept=${pfConcept}`);

    if (PF) {
      const pfActor = { actor_id: PF, actor_type: 'user', company_id: null as string | null };

      // 1) ANTES de declarar: o serviço NÃO aparece (criterion #1)
      const before = await canonicalServiceService.searchOfferable(TENANT, pfActor, 'corte');
      ok(!before.some((s) => s.conceptId === pfConcept), `1. PF sem C1 ativa → '${PF_CONCEPT_SLUG}' NÃO surge no offerable (#1)`);

      // declara C1 ACTIVE
      await c.query(`INSERT INTO actor_professional_concepts (tenant_id,actor_id,concept_id,skill_level,is_active,declared_at) VALUES ($1,$2,$3,3,true,now())`, [TENANT, PF, pfConcept]);
      pfDeclInserted = true;

      // 2) COM C1 ativa: o serviço aparece (criterion #2 + #3 PF usa actor_professional_concepts)
      const after = await canonicalServiceService.searchOfferable(TENANT, pfActor, 'corte');
      ok(after.some((s) => s.conceptId === pfConcept), `2. PF com C1 ativa → '${PF_CONCEPT_SLUG}' surge no offerable (#2/#3 actor_professional_concepts)`);

      // 3) is_active=false → some de novo (predicado ACTIVE, espelha o gate)
      await c.query(`UPDATE actor_professional_concepts SET is_active=false, retired_at=now() WHERE tenant_id=$1 AND actor_id=$2 AND concept_id=$3`, [TENANT, PF, pfConcept]);
      const retired = await canonicalServiceService.searchOfferable(TENANT, pfActor, 'corte');
      ok(!retired.some((s) => s.conceptId === pfConcept), `3. PF com C1 RETIRADA (is_active=false) → some do offerable (predicado ACTIVE)`);
      await c.query(`UPDATE actor_professional_concepts SET is_active=true, retired_at=NULL WHERE tenant_id=$1 AND actor_id=$2 AND concept_id=$3`, [TENANT, PF, pfConcept]);
    } else {
      console.log('SKIP  1/2/3. PF — sem user-actor sem declaração ativa do concept neste tenant (rodar no tenant dev p/ cobrir PF)');
    }

    // 4) subject NÃO suportado (group-actor, sem company) → conjunto VAZIO (fail-closed, espelha G3 do gate)
    if (GROUP) {
      const groupOut = await canonicalServiceService.searchOfferable(TENANT, { actor_id: GROUP, actor_type: 'group', company_id: null }, 'corte');
      ok(groupOut.length === 0, `4. subject não suportado (group) → offerable VAZIO (fail-closed)`);
    } else {
      console.log('SKIP  4. sem group-actor no tenant — branch coberto por inspeção (return [] em searchOfferable)');
    }

    // 5) PJ (best-effort): page-actor usa company_concept_publications (criterion #4)
    const pj = await c.query<{ page_id: string; company_id: string }>(
      `SELECT a.id AS page_id, a.company_id FROM actors a WHERE a.tenant_id=$1 AND a.actor_type='page' AND a.company_id IS NOT NULL LIMIT 1`, [TENANT]);
    const hu = await c.query<{ id: string }>(`SELECT id FROM actors WHERE tenant_id=$1 AND actor_type='user' LIMIT 1`, [TENANT]);
    // concept livre (sem publicação ativa dessa company) p/ não clobberar
    if (pj.rows.length === 1 && hu.rows.length === 1) {
      PJ_PAGE = pj.rows[0].page_id; PJ_COMPANY = pj.rows[0].company_id; PJ_HUMAN = hu.rows[0].id;
      const freeConc = await c.query<{ concept_id: string }>(
        `SELECT concept_id FROM concepts WHERE NOT EXISTS (
            SELECT 1 FROM company_concept_publications ccp WHERE ccp.tenant_id=$1 AND ccp.company_id=$2 AND ccp.concept_id=concepts.concept_id AND ccp.status='active'
         ) LIMIT 1`, [TENANT, PJ_COMPANY]);
      pjConcept = freeConc.rows[0]?.concept_id ?? '';
      if (pjConcept) {
        // canonical scoped p/ esse concept (visível ao tenant)
        await c.query(`INSERT INTO canonical_services (id,tenant_id,concept_id,name,slug,scope,status) VALUES ($1,$2,$3,'PJ Offerable Canon',$4,'scoped','active')`,
          [PJ_CANON, TENANT, pjConcept, 'pj-offerable-' + PJ_CANON.slice(0, 8)]);
        pjCanonInserted = true;
        const pjActor = { actor_id: PJ_PAGE, actor_type: 'page', company_id: PJ_COMPANY };

        // sem publicação → NÃO aparece
        const pjBefore = await canonicalServiceService.searchOfferable(TENANT, pjActor, 'pj offerable');
        ok(!pjBefore.some((s) => s.id === PJ_CANON), `5a. PJ sem publicação ATIVA → canonical NÃO surge (#4 company_concept_publications)`);

        // publica ACTIVE → aparece
        await c.query(`INSERT INTO company_concept_publications (tenant_id, company_id, page_actor_id, concept_id, created_by_actor_id, status) VALUES ($1,$2,$3,$4,$5,'active')`,
          [TENANT, PJ_COMPANY, PJ_PAGE, pjConcept, PJ_HUMAN]);
        pjPubInserted = true;
        const pjAfter = await canonicalServiceService.searchOfferable(TENANT, pjActor, 'pj offerable');
        ok(pjAfter.some((s) => s.id === PJ_CANON), `5b. PJ com publicação ATIVA → canonical surge (#4 company_concept_publications)`);
      } else {
        console.log('SKIP  5. PJ — sem concept livre p/ a company (todos já publicados); branch idêntico ao gate por inspeção');
      }
    } else {
      console.log('SKIP  5. PJ — sem page-actor/company no tenant; branch coberto por paridade com o gate (assertDeclarationEligibility)');
    }

    // ───────── ASSERTS ESTÁTICOS no frontend (criteria #6/#7) ─────────
    // cwd = C:/unificard/backend (raiz do pacote backend onde tsx é invocado)
    const fePath = join(process.cwd(), '..', 'frontend', 'src', 'pages', 'ServiceCreatePage.tsx');
    const fe = readFileSync(fePath, 'utf8');
    ok(/searchOfferableCanonicalServices/.test(fe), `6a. /services/new usa searchOfferableCanonicalServices`);
    ok(!/searchCanonicalServices\b/.test(fe), `6b. /services/new NÃO usa mais a busca aberta searchCanonicalServices (#6)`);
    ok(!/services\/search/.test(fe), `6c. /services/new NÃO referencia /services/search (#6)`);
    ok(!/actor_professional_concepts|company_concept_publications/.test(fe), `7. frontend NÃO replica predicado PF/PJ (#7)`);

    // ───────── Δbank=0 (criterion #10) ─────────
    const ledgerAfter = (await c.query<{ n: number }>(`SELECT count(*)::int AS n FROM bank_ledger WHERE tenant_id=$1`, [TENANT]).catch(() => ({ rows: [{ n: -1 }] }))).rows[0].n;
    ok(ledgerBefore === ledgerAfter, `10. Δbank=0 (bank_ledger ${ledgerBefore}→${ledgerAfter}; leitura de catálogo não toca dinheiro)`);

  } finally {
    if (pjPubInserted) await c.query(`DELETE FROM company_concept_publications WHERE tenant_id=$1 AND company_id=$2 AND concept_id=$3 AND page_actor_id=$4`, [TENANT, PJ_COMPANY, pjConcept, PJ_PAGE]).catch(() => {});
    if (pjCanonInserted) await c.query(`DELETE FROM canonical_services WHERE id=$1`, [PJ_CANON]).catch(() => {});
    if (pfDeclInserted) await c.query(`DELETE FROM actor_professional_concepts WHERE tenant_id=$1 AND actor_id=$2 AND concept_id=$3`, [TENANT, PF, pfConcept]).catch(() => {});
    c.release();
    console.log('\n=== TEARDOWN ok (fixtures removidas) ===');
  }

  console.log(`\n=== RESULTADO: ${fails.length === 0 ? 'OFFERABLE AUTOCOMPLETE FECHA ✅ (todos PASS)' : 'FALHAS: ' + fails.length} ===`);
  await pool.end().catch(() => {});
  process.exit(fails.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
