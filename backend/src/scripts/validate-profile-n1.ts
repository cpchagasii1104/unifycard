// src/scripts/validate-profile-n1.ts
//
// HARD GATE (read-only): CompleteProfile.n1 — estrutura + invariantes mínimas.
// Não altera banco, serviços nem APIs. Apenas relatório + exit code.

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { coreService } from '../core/core.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Severity = 'CRITICAL' | 'WARNING';

interface Finding {
  severity: Severity;
  code: string;
  message: string;
  context?: string;
}

const findings: Finding[] = [];

function add(f: Finding) {
  findings.push(f);
}

function validateN1Structure(profile: unknown, ctx: string) {
  if (profile === null || profile === undefined || typeof profile !== 'object') {
    add({ severity: 'CRITICAL', code: 'N1_ROOT', message: 'profile não é objeto', context: ctx });
    return;
  }
  const p = profile as Record<string, unknown>;
  const n1 = p.n1;

  if (n1 === null || n1 === undefined) {
    add({ severity: 'CRITICAL', code: 'N1_NULL', message: 'n1 ausente ou null/undefined', context: ctx });
    return;
  }
  if (typeof n1 !== 'object' || Array.isArray(n1)) {
    add({ severity: 'CRITICAL', code: 'N1_TYPE', message: 'n1 deve ser objeto', context: ctx });
    return;
  }

  const keys = ['profissoes', 'educacao', 'interesses'] as const;
  for (const k of keys) {
    if (!(k in (n1 as object))) {
      add({ severity: 'CRITICAL', code: `N1_KEY_${k.toUpperCase()}`, message: `chave n1.${k} ausente`, context: ctx });
      continue;
    }
    const v = (n1 as Record<string, unknown>)[k];
    if (v === null || v === undefined) {
      add({ severity: 'CRITICAL', code: `N1_${k}_NULL`, message: `n1.${k} é null ou undefined`, context: ctx });
      continue;
    }
    if (!Array.isArray(v)) {
      add({ severity: 'CRITICAL', code: `N1_${k}_TYPE`, message: `n1.${k} deve ser array`, context: ctx });
    }
  }
}

function validateProfissoes(n1: unknown, ctx: string) {
  if (!n1 || typeof n1 !== 'object' || Array.isArray(n1)) return;
  const profissoes = (n1 as Record<string, unknown>).profissoes;
  if (!Array.isArray(profissoes)) return;

  profissoes.forEach((item, idx) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      add({
        severity: 'CRITICAL',
        code: 'PROF_ITEM_TYPE',
        message: `profissoes[${idx}] não é objeto`,
        context: ctx,
      });
      return;
    }
    const row = item as Record<string, unknown>;
    const cid = row.category_id;
    if (cid === undefined || cid === null || String(cid).trim() === '') {
      add({
        severity: 'CRITICAL',
        code: 'PROF_CATEGORY_ID',
        message: `profissoes[${idx}] sem category_id`,
        context: ctx,
      });
    }
    const concept = row.concept_id;
    if (concept === undefined || concept === null || String(concept).trim() === '') {
      add({
        severity: 'CRITICAL',
        code: 'PROF_CONCEPT_ID',
        message: `profissoes[${idx}] concept_id ausente ou null`,
        context: ctx,
      });
    }
  });
}

function validateEducacao(n1: unknown, ctx: string) {
  if (!n1 || typeof n1 !== 'object' || Array.isArray(n1)) return;
  const educacao = (n1 as Record<string, unknown>).educacao;
  if (!Array.isArray(educacao)) return;

  educacao.forEach((item, idx) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      add({
        severity: 'WARNING',
        code: 'EDU_ITEM_TYPE',
        message: `educacao[${idx}] não é objeto`,
        context: ctx,
      });
      return;
    }
    const row = item as Record<string, unknown>;
    const id = row.id;
    if (id === undefined || id === null || String(id).trim() === '') {
      add({
        severity: 'WARNING',
        code: 'EDU_ID',
        message: `educacao[${idx}] sem id`,
        context: ctx,
      });
    }
    const titulo = row.titulo;
    if (titulo === undefined || titulo === null || String(titulo).trim() === '') {
      add({
        severity: 'WARNING',
        code: 'EDU_TITULO',
        message: `educacao[${idx}] sem titulo (loose)`,
        context: ctx,
      });
    }
  });
}

function validateInteresses(n1: unknown, ctx: string) {
  if (!n1 || typeof n1 !== 'object' || Array.isArray(n1)) return;
  const interesses = (n1 as Record<string, unknown>).interesses;
  if (!Array.isArray(interesses)) return;

  interesses.forEach((item, idx) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      add({
        severity: 'WARNING',
        code: 'INT_ITEM_TYPE',
        message: `interesses[${idx}] não é objeto`,
        context: ctx,
      });
      return;
    }
    const row = item as Record<string, unknown>;
    const cid = row.category_id;
    if (cid === undefined || cid === null || String(cid).trim() === '') {
      add({
        severity: 'WARNING',
        code: 'INT_CATEGORY_ID',
        message: `interesses[${idx}] sem category_id`,
        context: ctx,
      });
      return;
    }
    if (!UUID_RE.test(String(cid).trim())) {
      add({
        severity: 'WARNING',
        code: 'INT_UUID',
        message: `interesses[${idx}] category_id não é UUID válido`,
        context: ctx,
      });
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  let limit = 50;
  let tenantFilter: string | undefined;
  let userFilter: string | undefined;

  for (const a of args) {
    if (a.startsWith('--limit=')) limit = Math.max(1, parseInt(a.split('=')[1] || '50', 10) || 50);
    if (a.startsWith('--tenant=')) tenantFilter = a.split('=')[1]?.trim();
    if (a.startsWith('--user=')) userFilter = a.split('=')[1]?.trim();
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada');
    process.exit(1);
  }

  console.log('validate-profile-n1 (read-only)\n');

  const client = await pool.connect();
  let rows: { user_id: string; tenant_id: string }[] = [];

  try {
    if (tenantFilter && userFilter) {
      rows = [{ user_id: userFilter, tenant_id: tenantFilter }];
    } else {
      const q = `
        SELECT user_id::text AS user_id, tenant_id::text AS tenant_id
        FROM users
        ${tenantFilter ? 'WHERE tenant_id = $1::uuid' : ''}
        ORDER BY created_at DESC NULLS LAST
        LIMIT ${tenantFilter ? '$2' : '$1'}
      `;
      const params = tenantFilter ? [tenantFilter, limit] : [limit];
      const res = await client.query<{ user_id: string; tenant_id: string }>(q, params);
      rows = res.rows;
    }
  } finally {
    client.release();
  }

  if (rows.length === 0) {
    add({
      severity: 'WARNING',
      code: 'NO_USERS',
      message:
        'Nenhum utilizador na amostra — getCompleteProfile não foi executado. Use --tenant= e --user=.',
    });
    console.log('⚠️  Nenhum utilizador encontrado.\n');
  }

  let profilesChecked = 0;
  const counts = {
    profissoes: 0,
    educacao: 0,
    interesses: 0,
  };

  for (const row of rows) {
    const ctx = `tenant=${row.tenant_id} user=${row.user_id}`;
    try {
      const profile = await coreService.getCompleteProfile(row.tenant_id, row.user_id);
      profilesChecked++;
      validateN1Structure(profile, ctx);
      // NOTA: CompleteProfile foi refatorado e não expõe mais 'n1' diretamente.
      // Este HARD GATE valida estrutura legada eventualmente presente em metadata.
      // Cast deliberado para preservar comportamento do script de validação.
      const profileLegacy = profile as unknown as { n1?: unknown };
      validateProfissoes(profileLegacy.n1, ctx);
      validateEducacao(profileLegacy.n1, ctx);
      validateInteresses(profileLegacy.n1, ctx);

      if (profileLegacy.n1 && typeof profileLegacy.n1 === 'object' && !Array.isArray(profileLegacy.n1)) {
        const n = profileLegacy.n1 as Record<string, unknown>;
        if (Array.isArray(n.profissoes)) counts.profissoes += n.profissoes.length;
        if (Array.isArray(n.educacao)) counts.educacao += n.educacao.length;
        if (Array.isArray(n.interesses)) counts.interesses += n.interesses.length;
      }
    } catch (e) {
      add({
        severity: 'CRITICAL',
        code: 'PROFILE_THROW',
        message: e instanceof Error ? e.message : String(e),
        context: ctx,
      });
    }
  }

  const critical = findings.filter((f) => f.severity === 'CRITICAL');
  const warnings = findings.filter((f) => f.severity === 'WARNING');

  console.log('─'.repeat(60));
  console.log(`Profiles verificados: ${profilesChecked}`);
  console.log(`Itens agregados: profissoes=${counts.profissoes} educacao=${counts.educacao} interesses=${counts.interesses}`);
  console.log(`CRITICAL: ${critical.length} | WARNING: ${warnings.length}`);
  console.log('─'.repeat(60));

  if (critical.length) {
    console.log('\n✖ CRÍTICOS:');
    critical.forEach((f) => console.log(`  [${f.code}] ${f.context ?? ''} — ${f.message}`));
  }
  if (warnings.length) {
    console.log('\n⚠ WARNINGS:');
    warnings.forEach((f) => console.log(`  [${f.code}] ${f.context ?? ''} — ${f.message}`));
  }

  if (critical.length === 0 && warnings.length === 0) {
    console.log('\n✔ PASS (sem achados)');
  } else if (critical.length === 0) {
    console.log('\n✔ PASS (apenas warnings)');
  } else {
    console.log('\n✖ FAIL');
  }

  await pool.end();
  process.exit(critical.length > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});