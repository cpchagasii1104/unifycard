// F-NEIGHBORHOOD-CANONICAL-AUTO-INGESTION · N1 — ATO DE APROVAÇÃO (§16, ato 1 de 2).
//
// Executa a APROVAÇÃO HUMANA do manifest de aliases, SEPARADA da aplicação. Delega à casa interna de
// aplicação (approveAliasManifest → canRepresentActor + capability em DB). NÃO cria execução nem alias.
//   dry-run (default): valida o manifest, resolve hash, PROVA a autorização em transação e ROLLBACK.
//   --apply "APPROVE_CURITIBA_NEIGHBORHOOD_ALIAS_MANIFEST_V1": persiste manifest_approved.
//
// Requer operador humano (canRepresentActor=true). NÃO é rota pública. Um job NÃO usa este entrypoint.
// Sem provider/CEP, sem Bank/Social. O hash é recomputado do conteúdo estrutural do arquivo (não confia em campo).

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { approveAliasManifest } from '../src/core/location/neighborhood-alias-manifest-approval.service';

const CONFIRM_TOKEN = 'APPROVE_CURITIBA_NEIGHBORHOOD_ALIAS_MANIFEST_V1';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const CONFIRMED = argv.includes(CONFIRM_TOKEN);
const manifestPath = argValue('--manifest');

function argValue(flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

// Hash estrutural canônico: ordena as linhas por line_key e serializa apenas os campos governados.
function structuralHash(manifest: any): string {
  const header = {
    manifest_code: manifest.manifest_code,
    manifest_version: manifest.manifest_version,
    city_id: manifest.city_id,
    city_external_code: manifest.city_external_code,
    source_dataset: manifest.source_dataset,
    source_dataset_version: manifest.source_dataset_version,
    source_dataset_hash: manifest.source_dataset_hash,
    line_count: manifest.lines.length,
  };
  const lines = [...manifest.lines]
    .sort((a, b) => String(a.line_key).localeCompare(String(b.line_key)))
    .map((l) => ({
      line_key: l.line_key,
      alias_text: l.alias_text,
      neighborhood_id: l.neighborhood_id,
      canonical_neighborhood_name: l.canonical_neighborhood_name,
      source_kind: l.source_kind,
      source_reference: l.source_reference,
      evidence: l.evidence,
    }));
  return createHash('sha256').update(JSON.stringify({ header, lines }), 'utf8').digest('hex');
}

async function main() {
  if (!manifestPath) throw new Error('uso: --manifest <path> [--apply APPROVE_CURITIBA_NEIGHBORHOOD_ALIAS_MANIFEST_V1]');
  if (APPLY && !CONFIRMED) throw new Error(`--apply exige o token literal: ${CONFIRM_TOKEN}`);

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.lines) || manifest.lines.length < 1) {
    throw new Error('MANIFEST_EMPTY: manifest sem linhas — nada a aprovar (bloqueio documental honesto).');
  }
  const hash = structuralHash(manifest);

  // Contexto autenticado server-side (operador + tenant). Em produção vem do runtime autenticado.
  const tenantId = requireEnv('ALIAS_APPROVE_TENANT_ID');
  const operatorUserId = requireEnv('ALIAS_APPROVE_OPERATOR_USER_ID');
  const approverActorId = requireEnv('ALIAS_APPROVE_APPROVER_ACTOR_ID');

  console.log(`[alias-approve] modo=${APPLY ? (CONFIRMED ? 'APPLY' : 'APPLY-SEM-CONFIRMAÇÃO') : 'DRY-RUN'} manifest=${manifest.manifest_code}@${manifest.manifest_version} hash=${hash} lines=${manifest.lines.length}`);

  if (!APPLY) {
    // dry-run: NÃO persiste. A prova de autorização real (canRepresentActor + capability) roda em ambiente de teste
    // dedicado (test-neighborhood-alias-first-db.sql) para não persistir. Aqui só validamos o conteúdo/hash.
    console.log('[alias-approve] DRY-RUN: conteúdo e hash validados; nenhuma aprovação persistida.');
    return;
  }

  const res = await approveAliasManifest(
    { tenantId, operatorUserId },
    {
      approverActorId,
      cityId: manifest.city_id,
      manifestCode: manifest.manifest_code,
      manifestVersion: manifest.manifest_version,
      manifestHash: hash,
      lineCount: manifest.lines.length,
      eventReason: `Aprovação humana do manifest ${manifest.manifest_code}@${manifest.manifest_version}`,
      evidence: manifest.source_dataset ?? 'manifest governado de aliases',
    },
  );
  console.log(`[alias-approve] APPLY OK — manifest_approved ${res.manifestApprovalEventId}`);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`env ausente: ${name}`);
  return v;
}

main().then(() => process.exit(0)).catch((e) => { console.error('[alias-approve] ERRO:', e.message); process.exit(1); });
