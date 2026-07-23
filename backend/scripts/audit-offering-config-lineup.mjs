#!/usr/bin/env node
// audit-offering-config-lineup.mjs — Guard da FATIA 3 do arco fundação eventos:
// CARDÁPIO DE CONFIGS da oferta do performer com LINE-UP opcional (line-up = PESSOA/member_actor_id,
// doutrina DECISION-0188; DERIVED-INCOMPLETE; owner-unilateral; team_size DECLARADO com piso do line-up).
// MORDE se:
//  (a) o write path do line-up (addConfigMember) perder o check de MEMBERSHIP ATIVA
//      (findActiveByGroupAndMember / 422 CONFIG_MEMBER_NOT_ACTIVE_IN_GROUP) OU o check de
//      PROVIDER GRUPO (actor_type 'group' / 409 CONFIG_LINEUP_REQUIRES_GROUP_PROVIDER);
//  (b) as tabelas de config ganharem coluna de preco/financeira em QUALQUER migration
//      (fronteira Bank-free DESTA fatia — preco de config = fatia propria com gate proprio);
//  (c) os writers SELADOS de membership ganharem acoplamento a config (auto-drop) — fn_leave/fn_remove
//      e o service/repository de membership NUNCA tocam service_offering_config*;
//  (d) o check de PISO do team_size (CONFIG_TEAM_SIZE_BELOW_LINEUP) sumir de updateConfig OU de
//      addConfigMember (validacao dos DOIS lados).
// Region-anchored; comment-aware nos checks de codigo (stripTs). Fail-closed.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const fails = [];
const note = (marker, m) => fails.push(`[${marker}] ${m}`);

const readOrFail = (rel, marker) => {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) { note(marker, `arquivo material ausente: ${rel}`); return ''; }
  return readFileSync(abs, 'utf8');
};

function region(raw, startRe, endRe, label) {
  const s = raw.search(startRe);
  if (s < 0) { note('REGION', `${label}: ancora de inicio nao encontrada (${startRe})`); return null; }
  const rest = raw.slice(s);
  const e = rest.search(endRe);
  const slice = e < 0 ? rest : rest.slice(0, e);
  return { raw: slice, code: stripTs(slice) };
}

const SVC_PATH = 'src/modules/services/service-offering-config.service.ts';
const SVC_RAW = readOrFail(SVC_PATH, 'FILE');

// ══ (a) write path do line-up: group-provider check + active-membership check ══
if (SVC_RAW) {
  const reg = region(SVC_RAW, /async addConfigMember\(/, /\n\s*async removeConfigMember\(/, 'addConfigMember');
  if (reg) {
    const { code } = reg;
    if (!/actor_type\s*!==\s*'group'/.test(code) && !/actor_type\s*===\s*'group'/.test(code)) {
      note('LINEUP-GROUP', `addConfigMember perdeu o check de provider grupo-actor (actor_type 'group') em ${SVC_PATH}`);
    }
    if (!/CONFIG_LINEUP_REQUIRES_GROUP_PROVIDER/.test(code)) {
      note('LINEUP-GROUP', 'addConfigMember sem rejeicao 409 CONFIG_LINEUP_REQUIRES_GROUP_PROVIDER (solo NUNCA ganha line-up)');
    }
    if (!/findActiveByGroupAndMember/.test(code)) {
      note('LINEUP-ACTIVE', 'addConfigMember perdeu o leitor selado findActiveByGroupAndMember (membership ATIVA na casa nova)');
    }
    if (!/CONFIG_MEMBER_NOT_ACTIVE_IN_GROUP/.test(code)) {
      note('LINEUP-ACTIVE', 'addConfigMember sem rejeicao 422 CONFIG_MEMBER_NOT_ACTIVE_IN_GROUP (nao-membro nao entra no line-up)');
    }
    // identidade = PESSOA (member_actor_id), nunca a linha de membership (DECISION-0188)
    if (!/member_actor_id/.test(code) || /membership_id/.test(code)) {
      note('LINEUP-IDENTITY', 'addConfigMember deve persistir member_actor_id (PESSOA) e NUNCA membership_id (episodio imutavel — DECISION-0188)');
    }
    if (!/canRepresentActor|requireOwnedOffering/.test(code)) {
      note('LINEUP-AUTH', 'addConfigMember sem prova de autoridade do provider (canRepresentActor fail-closed)');
    }
    // (d) piso do lado membro
    if (!/CONFIG_TEAM_SIZE_BELOW_LINEUP/.test(code)) {
      note('TEAM-SIZE-FLOOR', 'addConfigMember perdeu o check de PISO do team_size (CONFIG_TEAM_SIZE_BELOW_LINEUP)');
    }
  }
  // (d) piso do lado config (update)
  const regU = region(SVC_RAW, /async updateConfig\(/, /\n\s*async deleteConfig\(/, 'updateConfig');
  if (regU && !/CONFIG_TEAM_SIZE_BELOW_LINEUP/.test(regU.code)) {
    note('TEAM-SIZE-FLOOR', 'updateConfig perdeu o check de PISO do team_size (CONFIG_TEAM_SIZE_BELOW_LINEUP) no valor efetivo');
  }
  // DERIVED-INCOMPLETE: leitura deriva isActiveMember/lineupComplete (nunca persistidos)
  const regL = region(SVC_RAW, /async listConfigs\(/, /\n\s*toView\(/, 'listConfigs');
  if (regL) {
    if (!/group_actor_memberships/.test(regL.code) || !/status\s*=\s*'active'/.test(regL.code)) {
      note('DERIVED-READ', 'listConfigs perdeu a derivacao de isActiveMember via group_actor_memberships status=active');
    }
  }
  if (!/lineupComplete/.test(SVC_RAW)) {
    note('DERIVED-READ', `read model sem lineupComplete derivado (${SVC_PATH})`);
  }
}

// ══ (b) fronteira Bank-free: tabelas de config NUNCA ganham coluna de preco/financeira nesta fatia ══
{
  const MIG_DIR = join(ROOT, 'migrations');
  const FIN_TOKENS = /price|_cents|\bfee\b|fee_bps|\btax\b|tax_|bank_|currency|valor_|preco/i;
  if (!existsSync(MIG_DIR)) {
    note('MIGRATIONS', 'diretorio migrations ausente');
  } else {
    let foundCreate = false;
    for (const f of readdirSync(MIG_DIR)) {
      if (!f.endsWith('.sql')) continue;
      const raw = readFileSync(join(MIG_DIR, f), 'utf8');
      if (!/service_offering_config/i.test(raw)) continue;
      // remove comentarios SQL (linha e bloco) — a fronteira e sobre DDL real, nao wording
      const sql = raw.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      // statements que tocam as tabelas de config
      const stmts = sql.split(';').filter((s) => /service_offering_config/i.test(s));
      for (const s of stmts) {
        if (/^\s*(CREATE\s+TABLE|ALTER\s+TABLE)/i.test(s.trimStart()) && FIN_TOKENS.test(s)) {
          note('BANK-FREE', `migration ${f}: DDL de service_offering_config* contem token financeiro/preco — preco de config e FATIA PROPRIA com gate proprio.`);
        }
      }
      if (/CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?service_offering_configs/i.test(sql)) foundCreate = true;
    }
    if (!foundCreate) note('MIGRATIONS', 'migration de criacao de service_offering_configs ausente');
  }
}

// ══ (c) writers SELADOS de membership sem acoplamento a config (sem auto-drop) ══
{
  const SEALED = [
    'migrations/20260718120000_group_actor_memberships.sql',
    'migrations/20260723160000_group_membership_actor_first_cutover.sql',
    'src/modules/groups/group-actor-membership.service.ts',
    'src/modules/groups/group-actor-membership.repository.ts',
    'src/modules/groups/groups.service.ts',
  ];
  for (const rel of SEALED) {
    const raw = readOrFail(rel, 'SEALED');
    if (raw && /service_offering_config/i.test(raw)) {
      note('NO-COUPLING', `${rel} referencia service_offering_config* — writers selados de membership NUNCA acoplam a config (DERIVED-INCOMPLETE: sem auto-drop, sem bloqueio de leave).`);
    }
  }
}

if (fails.length) {
  console.error('❌ audit-offering-config-lineup FALHOU:');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('✅ audit-offering-config-lineup OK — line-up governado (grupo-provider + membership ativa + identidade=PESSOA) · piso team_size nos 2 lados · fronteira Bank-free das tabelas de config · zero acoplamento nos writers selados de membership.');
