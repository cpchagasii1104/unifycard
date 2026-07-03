#!/usr/bin/env node
// Gate estrutural — F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE
// (DECISION-0117). Vigia as invariantes do catálogo canônico, templates, mídia,
// menu e ofertas. Integrado em validate:regression-guards.
//
// Classificações: CLOSED_CANONICAL · KNOWN_OPEN_OUTSIDE_CANONICAL ·
// FINANCIAL_HARD_STOP · FORBIDDEN_REGRESSION · NEW_UNCLASSIFIED.
//
// Análise comment-stripped ORDER-SAFE (line-comments primeiro, com guarda para
// '://'; depois block-comments) — herdada do gate PJ após o bug provado em que
// um '/*' dentro de comentário de linha cegava a varredura. Limitação honesta:
// heurística textual, não AST; falso positivo torna o gate MAIS restritivo.
// Tokens em comentário NÃO satisfazem nem violam o gate (são removidos antes).

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

const SRC = join(process.cwd(), 'src');
const REPO = join(process.cwd(), '..');
const MIGRATIONS = join(process.cwd(), 'migrations');

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const surfaces = [];
const failures = [];
function check(surface, ok, failMsg, cls = 'FORBIDDEN_REGRESSION') {
  surfaces.push([surface, ok ? 'CLOSED_CANONICAL' : cls]);
  if (!ok) failures.push(`${cls}: ${failMsg}`);
}
function knownOpen(surface, note) {
  surfaces.push([surface, 'KNOWN_OPEN_OUTSIDE_CANONICAL']);
  console.log(`  KNOWN_OPEN: ${surface} — ${note}`);
}

function read(p) {
  return stripComments(readFileSync(p, 'utf-8'));
}

// ── FAMÍLIA CANÔNICA (denominador explícito de writers/readers da frente) ─────
const FAMILY = [
  'core/catalog/canonical/catalog-identity.ts',
  'core/catalog/canonical/canonical-units.service.ts',
  'core/catalog/canonical/canonical-variant.service.ts',
  'core/catalog/canonical/canonical-service.service.ts',
  'core/catalog/curation/catalog-curation.service.ts',
  'core/catalog/suggestions/catalog-suggestion.service.ts',
  'core/catalog/catalog-governance.routes.ts',
  'core/media-assets/media-asset.service.ts',
  'core/media-assets/media-assets.routes.ts',
  'core/media-assets/media-context-identity.ts',
  'core/companies/business-templates.service.ts',
  'core/companies/company-templates.routes.ts',
  'core/navigation/module-registry.ts',
  'core/navigation/module-projection.routes.ts',
  'modules/marketplace/product-offering.service.ts',
  'modules/marketplace/marketplace-offerings.routes.ts',
  'modules/marketplace/marketplace-canonical-search.routes.ts',
  'modules/marketplace/product-visibility.service.ts',
  'modules/services/service-offering.service.ts',
  'modules/services/service-offerings.routes.ts',
];

// 1) Família NÃO cura actor humano (regime PJ-B3 estendido) e NÃO escreve Bank.
const FORBIDDEN_CURE = /\bensureUserActor\b|\bfindOrCreateUserActor\b|\bensureCanonicalActorChain\b|INSERT\s+INTO\s+actors\b/;
const BANK_WRITER = /INSERT\s+INTO\s+bank_|UPDATE\s+bank_/i;
for (const f of FAMILY) {
  const p = join(SRC, f);
  if (!existsSync(p)) {
    failures.push(`FORBIDDEN_REGRESSION: arquivo da família canônica desapareceu: ${f}`);
    surfaces.push([`family:${f}`, 'FORBIDDEN_REGRESSION']);
    continue;
  }
  const code = read(p);
  check(`canonical:family-no-actor-cure:${f}`, !FORBIDDEN_CURE.test(code),
    `writer canônico ${f} cria/cura actor humano (proibido — DECISION-0117 B / PJ-B3).`);
  check(`canonical:family-no-bank-writer:${f}`, !BANK_WRITER.test(code),
    `writer canônico ${f} escreve em bank_* (FINANCIAL_HARD_STOP — zero financeiro nesta frente).`,
    'FINANCIAL_HARD_STOP');
}

// 2) PREÇO/ESTOQUE jamais em entidade canônica (preço = oferta; estoque = actor).
{
  let violation = null;
  const scan = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules') continue;
        scan(full);
      } else if (['.ts', '.sql'].includes(extname(full))) {
        const raw = extname(full) === '.ts' ? read(full) : readFileSync(full, 'utf-8').replace(/--[^\n]*/g, '');
        const m = raw.match(/(INSERT\s+INTO|UPDATE|ALTER\s+TABLE)\s+canonical_(products|variants|services)[\s\S]{0,300}?(price_cents|stock_quantity|estoque_)/i);
        if (m && !violation) violation = `${full.replace(process.cwd(), '')}: ${m[0].slice(0, 80)}…`;
      }
    }
  };
  scan(SRC);
  scan(MIGRATIONS);
  check('canonical:no-price-or-stock-on-canonical', violation === null,
    `preço/estoque entrando em entidade CANÔNICA (proibido — DECISION-0117 A/D): ${violation}`);
}

// 3) Empresa NÃO cria canônico global READY: sugestão nasce scoped; promoção/READY só na curadoria.
{
  // Vigia ESCRITA (INSERT/UPDATE) — predicados de LEITURA de visibilidade 2B
  // (scope='global' em WHERE) são legítimos e não disparam.
  const sug = read(join(SRC, 'core/catalog/suggestions/catalog-suggestion.service.ts'));
  const writesGlobal =
    /SET\s+scope\s*=\s*'global'/i.test(sug) ||
    /INSERT\s+INTO\s+canonical_products[\s\S]{0,500}?VALUES[\s\S]{0,300}?'global'/i.test(sug) ||
    /SET[^;]{0,200}concept_resolution_status\s*=\s*'confirmed'/i.test(sug);
  check('canonical:suggestion-never-global-ready', !writesGlobal,
    'catalog-suggestion passou a GRAVAR global/confirmed direto (empresa criando global READY — proibido, DECISION-0117 B).');
  const cur = read(join(SRC, 'core/catalog/curation/catalog-curation.service.ts'));
  check('canonical:curation-owns-ready',
    /concept_resolution_status\s*=\s*'confirmed'/.test(cur) && /resolved_by_actor_id/.test(cur),
    'catalog-curation perdeu a confirmação humana auditada (READY sem curador).');
}

// 4) OFERTA referencia canônico/variante; writer prova canRepresentActor.
{
  const off = read(join(SRC, 'modules/marketplace/product-offering.service.ts'));
  check('canonical:offer-references-variant',
    /canonical_variant_id/.test(off) && /resolveRedirect/.test(off) && /CANONICAL_NOT_READY/.test(off),
    'product-offering deixou de referenciar a variante canônica/readiness (oferta sem identidade — proibido).');
  check('canonical:offer-authority-canrepresent',
    /canRepresentActor\(/.test(off),
    'product-offering perdeu a prova server-side canRepresentActor (actorId do cliente virando autoridade — DECISION-0113).');
}

// 5) SERVIÇO empresarial referencia canonical_service; sem agenda paralela.
{
  const svc = read(join(SRC, 'modules/services/services.service.ts'));
  check('canonical:services-writer-requires-canonical',
    /canonicalServiceId/.test(svc) && /requireActiveForTenant/.test(svc),
    'services.service deixou de exigir canonical_service_id ativo (significado duplicado por prestador — DECISION-0117 D).');
  const so = read(join(SRC, 'modules/services/service-offering.service.ts'));
  check('canonical:service-offering-unified-availability',
    /unifiedAvailabilityService\.createAvailability/.test(so) && !/INSERT\s+INTO\s+schedules\b/i.test(so),
    'service-offering criou agenda paralela ou abandonou a Unified Availability (proibido — DECISION-0117 D).');
  check('canonical:service-offering-authority',
    /canRepresentActor\(/.test(so) && /requireActiveForTenant/.test(so),
    'service-offering perdeu canRepresentActor/identidade canônica ativa.');
}

// 6) MÍDIA: BLOB FÍSICO global ≠ ASSET LÓGICO tenant/actor-scoped
//    (DECISION-0117 C + F-CANONICAL-MEDIA-BLOB-ASSET-TENANT-ISOLATION-CLOSURE,
//    fechamento da DT-CANONICAL-MEDIA-CROSS-TENANT-METADATA-AND-FILE-LEAK).
{
  const media = read(join(SRC, 'core/media-assets/media-asset.service.ts'));
  const routes = read(join(SRC, 'core/media-assets/media-assets.routes.ts'));

  // 6a — dedup FÍSICA (camada blob) por hash ANTES do storage; exige a CHAMADA.
  const dedupIdx = media.indexOf('this.findBlobByHash(contentHash)');
  const storeIdx = media.indexOf('storeDocument({');
  check('canonical:media-blob-dedup-before-store',
    dedupIdx > -1 && storeIdx > -1 && dedupIdx < storeIdx,
    'media-asset perdeu o dedup FÍSICO por blob antes do storage (blob duplicado — DECISION-0117 C).');

  // 6b — compensação ref-count-safe: blob compartilhado JAMAIS é apagado.
  check('canonical:media-compensation-refcount-safe',
    /deleteBlobIfUnreferenced/.test(media) && /NOT EXISTS\s*\(SELECT\s+1\s+FROM\s+media_assets/i.test(media),
    'compensação de mídia perdeu a guarda ref-count (apagaria blob compartilhado por outro tenant).');

  // 6c — anti-padrão ORIGINAL do vazamento: lookup LÓGICO global por hash
  //      (devolver o media_asset do primeiro uploader a outro tenant).
  check('canonical:media-no-global-logical-hash-lookup',
    !/FROM\s+media_assets[\s\S]{0,120}?WHERE[\s\S]{0,80}?content_hash/i.test(media) && !/\bfindByContentHash\b/.test(media),
    'media-asset voltou a resolver ASSET LÓGICO por hash global (asset/metadata do 1º uploader vazando cross-tenant — FAIL Yala).');

  // 6d — identidade lógica é a DECLARAÇÃO CONTEXTUAL COMPLETA (DECISION-0118 D1),
  //      em ENCODER V2 collision-safe (fecha DT-MEDIA-CONTEXT-FINGERPRINT-
  //      SERIALIZATION-AMBIGUITY): PROIBIDO join '|' / md5 / fórmula manuscrita
  //      paralela; a fonte do encoder é a FUNÇÃO SQL media_context_fingerprint_v2.
  const identity = read(join(SRC, 'core/media-assets/media-context-identity.ts'));
  check('canonical:media-identity-is-full-context-v2',
    /computeMediaContextFingerprintV2/.test(media) &&
    /this\.findAssetByContextFingerprint\(contextFingerprint\)/.test(media) &&
    !/findAssetByBlobAndContext/.test(media) &&
    /media_context_fingerprint_v2\(/.test(identity) &&
    /decl\.contextType/.test(identity) && /decl\.contextOwnerId/.test(identity) &&
    /decl\.source/.test(identity) && /decl\.purpose/.test(identity) &&
    /canonicalizeContextDimension\(decl\.license\)/.test(identity) &&
    /canonicalizeContextDimension\(decl\.provenance\)/.test(identity),
    'identidade do asset lógico regrediu (encoder V2/dimensões fora da identidade — colapso contextual [B1]).');

  // 6d1 — SERIALIZAÇÃO INEQUÍVOCA: proibido reaparecer concatenação com
  //       delimitador livre (join "|") ou md5 como identidade contextual viva.
  check('canonical:media-no-ambiguous-serialization',
    !/\.join\(['"`]\|['"`]\)/.test(identity) && !/\bmd5\b/i.test(identity) &&
    !/createHash\(['"`]md5['"`]\)/.test(media) &&
    !/computeMediaContextFingerprintV1\b/.test(media) && !/computeMediaContextFingerprintV1\b/.test(identity),
    'serialização ambígua/md5 voltou à identidade contextual (preimage colidível — vetor Yala license="a|b").');

  // 6d2 — chave explícita de idempotência: TODO match (todas as call-sites)
  //       exige COMPARAÇÃO MATERIAL INTEGRAL; divergente = CONFLITO observável.
  const keyCallSites = [...media.matchAll(/this\.findAssetByIdempotencyKey\(/g)];
  check('canonical:media-idempotency-conflict-observable',
    /MEDIA_IDEMPOTENCY_CONFLICT/.test(media) &&
    keyCallSites.length >= 1 &&
    keyCallSites.every((m) => /materiallyEqualMediaContext\(/.test(media.slice(m.index, m.index + 300))),
    'Idempotency-Key deixou de recomparar o payload integral em alguma call-site / de conflitar observavelmente (sucesso falso — proibido).');

  // 6d3 — HASH NUNCA É PROVA DE IGUALDADE: TODO match de fingerprint (todas as
  //       call-sites) recompara as dimensões materiais; colisão = 409 observável.
  const fpCallSites = [...media.matchAll(/this\.findAssetByContextFingerprint\(contextFingerprint\)/g)];
  check('canonical:media-fingerprint-never-sole-proof',
    /MEDIA_CONTEXT_FINGERPRINT_COLLISION/.test(media) &&
    fpCallSites.length >= 1 &&
    fpCallSites.every((m) => /materiallyEqualMediaContext\(/.test(media.slice(m.index, m.index + 300))),
    'match de fingerprint voltou a reutilizar asset SEM recomparação material integral em alguma call-site (fingerprint-only trust — proibido).');

  // 6d4 — comparação material COMPLETA: nenhuma dimensão pode ser ignorada.
  check('canonical:media-material-comparison-complete',
    /materiallyEqualMediaContext/.test(identity) &&
    /ma\.media_blob_id = \$2::uuid/.test(identity) &&
    /ma\.origin_tenant_id IS NOT DISTINCT FROM/.test(identity) &&
    /ma\.created_by_actor_id IS NOT DISTINCT FROM/.test(identity) &&
    /ma\.context_type = \$5::text/.test(identity) &&
    /ma\.context_owner_id IS NOT DISTINCT FROM/.test(identity) &&
    /ma\.source = \$7::text/.test(identity) &&
    /ma\.purpose = \$8::text/.test(identity) &&
    /media_context_dimension_norm\(ma\.license\)/.test(identity) &&
    /media_context_dimension_norm\(ma\.origin_note\)/.test(identity),
    'comparação material perdeu dimensão (blob/tenant/actor/context/owner/source/purpose/licença/provenance — descarte silencioso possível).');

  // 6d5 — V2 VERSIONADO + V1 NÃO SOBERANO: migration recalcula tudo para V2
  //       (sha256, length-prefix, marcador N de NULL), retira o índice V1;
  //       runtime persiste version=2 e NUNCA consulta o fingerprint V1.
  const migV2 = readFileSync(join(MIGRATIONS, '20260612120000_media_context_identity_v2.sql'), 'utf-8');
  check('canonical:media-identity-v2-versioned-encoder',
    /media_context_fingerprint_v2/.test(migV2) && /sha256\(/.test(migV2) &&
    /octet_length\(convert_to\(/.test(migV2) && /THEN 'N'/.test(migV2) &&
    /media_context_preimage_field_v2\('LICENSE'/.test(migV2) &&
    /media_context_preimage_field_v2\('PROVENANCE'/.test(migV2) &&
    /SET context_fingerprint = media_context_fingerprint_v2\(/.test(migV2) &&
    /context_identity_version = 2/.test(migV2) &&
    /DROP INDEX IF EXISTS uidx_media_assets_context_fingerprint;/.test(migV2) &&
    /uidx_media_assets_context_fingerprint_v2/.test(migV2) &&
    /contextIdentityVersion: MEDIA_CONTEXT_IDENTITY_VERSION/.test(media) &&
    !/context_fingerprint_v1/.test(media) && !/context_fingerprint_v1/.test(identity),
    'identidade V2 regrediu (sem versão/sha256/recálculo, índice V1 soberano ou runtime consultando fingerprint V1 — proibido).');

  // 6d6 — PROVAS PERMANENTES: vetor Yala exato + colisão forçada + backfill
  //       legado precisam EXISTIR como e2e (gate acusa remoção).
  const ctxE2ePath = join(SRC, 'scripts/validate-pipeline-e2e-media-contextual-identity.ts');
  const backfillE2ePath = join(SRC, 'scripts/validate-pipeline-e2e-media-migration-backfill-legacy.ts');
  const ctxE2e = existsSync(ctxE2ePath) ? readFileSync(ctxE2ePath, 'utf-8') : '';
  const backfillE2e = existsSync(backfillE2ePath) ? readFileSync(backfillE2ePath, 'utf-8') : '';
  check('canonical:media-v2-proofs-exist',
    /provenance: 'b\|c'/.test(ctxE2e) && /license: 'a\|b'/.test(ctxE2e) &&
    /MEDIA_CONTEXT_FINGERPRINT_COLLISION/.test(ctxE2e) &&
    /apply-migrations-before-for-test/.test(backfillE2e) &&
    /context_identity_version/.test(backfillE2e) &&
    /media_context_fingerprint_v2/.test(backfillE2e),
    'provas permanentes da identidade V2 sumiram (vetor Yala exato / colisão forçada / backfill legado — suíte obrigatória).');

  // 6e — reader de arquivo AUTORIZADO: rota chama leitura autorizada; resolver
  //      prova visibilidade — canônica pública = approved E vinculada (isAttachedToCanonical);
  //      privado = autoridade do CONTEXT_OWNER (canManageCompany) ou criador, POR TENANT.
  check('canonical:media-file-reader-authorized',
    /readContentAuthorized\(/.test(routes) &&
    /canReadMediaAsset/.test(media) &&
    /asset\.originTenantId !== ctx\.tenantId/.test(media) &&
    /moderationStatus === 'approved'/.test(media) &&
    /isAttachedToCanonical\(asset\.id\)/.test(media) &&
    /canManageCompany\(ctx\.tenantId,\s*asset\.contextOwnerId/.test(media) &&
    /canRepresentActor/.test(media),
    'leitura de arquivo/metadata de mídia perdeu a autorização contextual (tenant/context_owner/visibilidade) — arquivo privado servível indevidamente.');

  // 6f — attach/business prova que o ASSET pertence ao CONTEXTO EMPRESARIAL do alvo
  //      (empresa E2 NÃO anexa declaração privada de E1, mesmo com o mesmo humano).
  check('canonical:media-business-attach-context-proof',
    /MEDIA_ASSET_FOREIGN/.test(media) &&
    /asset\.contextOwnerId === targetCompanyId/.test(media) &&
    /asset\.contextType === 'company'/.test(media),
    'attach/business deixou de provar o CONTEXT_OWNER do asset (declaração de outra empresa/finalidade anexável — [B1]).');

  // 6g — moderação/autoria/origem/licença NÃO vivem no BLOB físico.
  const newMig = readFileSync(join(MIGRATIONS, '20260612090000_media_blob_asset_separation.sql'), 'utf-8').replace(/--[^\n]*/g, '');
  const blobBlock = (newMig.match(/CREATE TABLE IF NOT EXISTS media_blobs\s*\(([\s\S]*?)\);/) ?? [, ''])[1];
  let blobContextWriter = null;
  {
    const scanBlobWriters = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === 'node_modules') continue;
          scanBlobWriters(full);
        } else if (extname(full) === '.ts') {
          const code = read(full);
          const m = code.match(/(UPDATE|ALTER\s+TABLE)\s+media_blobs[\s\S]{0,200}?(moderation_status|created_by_actor_id|origin_tenant_id|license|source)/i);
          if (m && !blobContextWriter) blobContextWriter = full.replace(process.cwd(), '');
        }
      }
    };
    scanBlobWriters(SRC);
  }
  check('canonical:media-blob-has-no-contextual-authority',
    blobBlock.length > 0 &&
    !/moderation_status|created_by_actor_id|origin_tenant_id|license|source/i.test(blobBlock) &&
    blobContextWriter === null,
    `moderação/autoria/origem/licença entrando na camada de BLOB físico (autoridade contextual no blob — proibido): ${blobContextWriter ?? 'schema media_blobs'}`);

  // 6h — UNIQUE de hash SÓ na camada física; unicidade lógica é por contexto.
  check('canonical:media-hash-unique-only-physical',
    /uidx_media_blobs_content_hash/.test(newMig) &&
    /DROP INDEX IF EXISTS uidx_media_assets_content_hash/.test(newMig) &&
    /uidx_media_assets_blob_context/.test(newMig),
    'unicidade de content_hash saiu da camada física e/ou voltou à camada lógica (um asset global por hash = vazamento).');

  // 6i — payload PÚBLICO de mídia canônica não vaza autoria/origem/storage.
  check('canonical:media-public-projection-strips-private',
    /toPublicMediaProjection/.test(routes) &&
    !/createdByActorId|originTenantId|storageReference|contentHash/.test(
      (read(join(SRC, 'core/media-assets/media-asset.service.ts')).match(/function toPublicMediaProjection[\s\S]*?\n\}/) ?? [''])[0]
    ),
    'projeção pública de mídia canônica voltou a expor autoria/origem/storage do uploader.');
}

// 7) images JSONB NÃO volta a ser SSOT (nenhum writer novo grava canonical_products.images).
{
  let violation = null;
  const scanTs = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules') continue;
        scanTs(full);
      } else if (extname(full) === '.ts' && !full.includes('scripts')) {
        const code = read(full);
        const m = code.match(/UPDATE\s+canonical_products\s+SET[\s\S]{0,200}?\bimages\b/i);
        if (m && !violation) violation = full.replace(process.cwd(), '');
      }
    }
  };
  scanTs(SRC);
  check('canonical:images-jsonb-not-ssot', violation === null,
    `writer voltou a gravar canonical_products.images como SSOT (mídia canônica é media_assets — DECISION-0117 C): ${violation}`);
}

// 8) TEMPLATES: aplicação versionada/auditável; sem metadata opaca; sem efeito comercial.
{
  const tpl = read(join(SRC, 'core/companies/business-templates.service.ts'));
  check('canonical:template-application-versioned',
    /template_version_id/.test(tpl) && /applied_by_actor_id/.test(tpl),
    'aplicação de template perdeu versão/actor aplicador (auditoria obrigatória — DECISION-0117 E).');
  check('canonical:template-no-opaque-metadata',
    !/businessType|businessCategory/.test(tpl),
    'template voltou a depender de metadata opaca businessType/businessCategory (proibido — DECISION-0098/0117 E).');
  check('canonical:template-no-commercial-effect',
    !/INSERT\s+INTO\s+(product_offers|service_offerings|inventory_movements|availability)\b/i.test(tpl),
    'template passou a criar oferta/estoque/agenda automaticamente (proibido — DECISION-0117 E).');
}

// 9) MENU: projeção do registry; frontend não inventa; STUB/TOMBSTONE fora.
{
  const reg = read(join(SRC, 'core/navigation/module-registry.ts'));
  check('canonical:menu-registry-hides-stub',
    /status === 'LIVE'/.test(reg),
    'liveEntriesForContext deixou de filtrar STUB/TOMBSTONE (rota morta aparecendo como operacional).');
  const sidebarPath = join(REPO, 'frontend/src/components/layout/GlobalSidebar.tsx');
  const sidebar = read(readFileSync(sidebarPath, 'utf-8') ? sidebarPath : sidebarPath);
  const sidebarCode = read(sidebarPath);
  check('canonical:sidebar-consumes-projection',
    /getNavigationModules/.test(sidebarCode) && !/NAV_GROUPS\s*:\s*NavGroup\[\]/.test(sidebarCode) && !/PILOT_HIDDEN_ROUTES/.test(sidebarCode),
    'GlobalSidebar voltou a hardcodar NAV_GROUPS/PILOT_HIDDEN_ROUTES divergentes do registry (DECISION-0117 F).');
}

// 10) DISCOVERY: estoque merchant-scoped + unidade consistente + KYB/publicação no reader.
{
  const vis = read(join(SRC, 'modules/marketplace/product-visibility.service.ts'));
  check('canonical:visibility-merchant-scoped-stock',
    /im\.actor_id\s*=\s*po\.merchant_id/.test(vis),
    'products/visible voltou a somar estoque tenant-wide (DT-INVENTORY-PRODUCT-VISIBILITY reaberta).');
  check('canonical:visibility-unit-consistent',
    /im\.unit\s*=\s*pv\.sale_unit/.test(vis),
    'products/visible voltou a somar unidades incompatíveis (DECISION-0117 H).');
  check('canonical:visibility-kyb-publication-gate',
    /kyb_status\s*=\s*'approved'/.test(vis) && /company_concept_publications/.test(vis),
    'discovery contornou KYB/publicação (defesa direta do reader removida — DECISION-0099/0101/0117).');
  // F-GLOBAL-SEARCH-OMNI: o SELECT canônico foi extraído p/ canonical-item-search.service.ts
  // (Lei de Coerência — 1 verdade, 2 callers: rota + omnibox). O invariante NÃO mudou; mudou de
  // endereço. O cheque segue a verdade: predicado de identidade no SERVICE compartilhado +
  // rota consumindo o service + agregação por unidade permanecendo na rota.
  const search = read(join(SRC, 'modules/marketplace/marketplace-canonical-search.routes.ts'));
  const itemSearchSvc = read(join(SRC, 'modules/marketplace/canonical-item-search.service.ts'));
  check('canonical:search-groups-by-identity',
    /duplicate_of_canonical_product_id IS NULL/.test(itemSearchSvc) && /searchCanonicalItems/.test(search) && /byUnit/.test(search),
    'busca deixou de agrupar por identidade canônica (predicado fora do canonical-item-search.service) e/ou a rota deixou de consumir o service compartilhado e/ou de separar preços por unidade.');
}

// 11) UNIDADES fail-closed.
{
  const units = read(join(SRC, 'core/catalog/canonical/canonical-units.service.ts'));
  check('canonical:units-fail-closed',
    /UNIT_INCOMPATIBLE/.test(units) && /UNIT_UNKNOWN/.test(units),
    'registry de unidades perdeu o fail-closed (soma silenciosa de bases incompatíveis — DECISION-0117 H).');
}

// 12) MERGE por redirect append-only (sem rewrite destrutivo).
{
  const cur = read(join(SRC, 'core/catalog/curation/catalog-curation.service.ts'));
  check('canonical:merge-redirect-append-only',
    /duplicate_of_canonical_product_id/.test(cur) && !/DELETE\s+FROM\s+canonical_products/i.test(cur),
    'merge curatorial virou rewrite destrutivo (DELETE de canônico) ou perdeu o redirect (DECISION-0117 G).');
}

// 13) NEW_UNCLASSIFIED — arquivo novo nos diretórios da frente sem classificação.
{
  const WATCH_DIRS = ['core/catalog', 'core/media-assets', 'core/navigation'];
  const CLASSIFIED_NON_RESOLVING = new Set([
    // pré-existentes do substrato canônico (fora do denominador de writers desta frente):
    'core/catalog/canonical/canonical-concept-resolution-audit.ts',
    'core/catalog/canonical/canonical-concept-resolution-queue.service.ts',
    'core/catalog/canonical/canonical-concept.types.ts',
    'core/catalog/canonical/canonical-match-suggestion.service.ts',
    'core/catalog/canonical/canonical-product-commerce-guard.ts',
    'core/catalog/canonical/canonical-product-creation.pipeline.ts',
    'core/catalog/canonical/canonical-product-creation.service.ts',
    'core/catalog/canonical/canonical-product-db.types.ts',
    'core/catalog/canonical/canonical-product-events.repository.ts',
    'core/catalog/canonical/canonical-product-readiness.ts',
    'core/catalog/canonical/canonical-product.module.ts',
    'core/catalog/canonical/canonical-product.repository.ts',
    'core/catalog/canonical/canonical-product.routes.ts',
    'core/catalog/canonical/canonical-product.service.ts',
    'core/catalog/canonical/canonical-product.types.ts',
    'core/catalog/category-review.module.ts',
    'core/catalog/category-review.routes.ts',
    'core/catalog/category-review.service.ts',
    'core/catalog/dynamic-pricing/dynamic-pricing.module.ts',
    'core/catalog/dynamic-pricing/dynamic-pricing.routes.ts',
    'core/catalog/dynamic-pricing/dynamic-pricing.service.ts',
    'core/catalog/dynamic-pricing/dynamic-pricing.types.ts',
    'core/catalog/offer-index/offer-index.module.ts',
    'core/catalog/offer-index/offer-index.routes.ts',
    'core/catalog/offer-index/offer-index.service.ts',
    'core/catalog/offer-index/offer-index.types.ts',
    'core/catalog/product-demand/product-demand.module.ts',
    'core/catalog/product-demand/product-demand.routes.ts',
    'core/catalog/product-demand/product-demand.service.ts',
    'core/catalog/product-demand/product-demand.types.ts',
    'core/navigation/n1-query.adapter.ts',
    'core/navigation/n2-governance.service.ts',
    'core/navigation/n2-query.adapter.ts',
    'core/navigation/navigation-offers.list.ts',
    'core/navigation/navigation.routes.ts',
  ]);
  const familySet = new Set(FAMILY);
  let unclassified = 0;
  for (const wd of WATCH_DIRS) {
    const base = join(SRC, wd);
    if (!existsSync(base)) continue;
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (extname(full) === '.ts') {
          const rel = full.replace(SRC, '').replace(/\\/g, '/').replace(/^\//, '');
          if (!familySet.has(rel) && !CLASSIFIED_NON_RESOLVING.has(rel)) {
            unclassified++;
            failures.push(`NEW_UNCLASSIFIED: arquivo novo na frente canônica sem classificação: ${rel} — classifique na FAMILY ou em CLASSIFIED_NON_RESOLVING (com revisão).`);
            surfaces.push([`new:${rel}`, 'NEW_UNCLASSIFIED']);
          }
        }
      }
    };
    walk(base);
  }
  if (unclassified === 0) surfaces.push(['canonical:new-files-classified', 'CLOSED_CANONICAL']);
}

// ── KNOWN_OPEN fora do fechamento (dívidas explícitas, não aprovação) ─────────
knownOpen('legacy:marketplace-store-products-in-memory',
  'GET /marketplace/store/:id/products e /marketplace/products/canonical seguem em memória com caller vivo no frontend — remoção exige substituto provado (fatia própria). Substituto canônico vivo: /marketplace/catalog/items/*.');
knownOpen('legacy:product_prices-table',
  'tabela product_prices (0 linhas) sem writer vivo — candidata a tombstone em fatia própria.');
knownOpen('vocabulary:marketplace-domain-fork',
  'MarketplaceDomain↔N0 segue OPEN (DT própria, DECISION-0102 §13 — aguarda Clayton).');
knownOpen('media:production-provider',
  'provider de produção de mídia FORA desta frente (local/dev funcional).');
knownOpen('units:auto-conversion',
  'conversão automática de unidades FORA (fail-closed vigente).');

// ── Saída ─────────────────────────────────────────────────────────────────────
const closed = surfaces.filter(([, c]) => c === 'CLOSED_CANONICAL').length;
const open = surfaces.filter(([, c]) => c === 'KNOWN_OPEN_OUTSIDE_CANONICAL').length;
const forb = surfaces.filter(([, c]) => c === 'FORBIDDEN_REGRESSION').length;
const fin = surfaces.filter(([, c]) => c === 'FINANCIAL_HARD_STOP').length;
const newu = surfaces.filter(([, c]) => c === 'NEW_UNCLASSIFIED').length;
console.log(`[canonical-catalog-closure] CLOSED_CANONICAL=${closed} KNOWN_OPEN_OUTSIDE_CANONICAL=${open} FORBIDDEN_REGRESSION=${failures.length ? forb : 0} FINANCIAL_HARD_STOP=${fin} NEW_UNCLASSIFIED=${newu}`);

if (failures.length > 0) {
  console.error('GATE FAIL [canonical-catalog-closure]:');
  failures.forEach((f) => console.error('  ', f));
  process.exit(1);
}
console.log('GATE OK [canonical-catalog-closure] — invariantes DECISION-0117 vigiadas; KNOWN_OPEN seguem dívida explícita.');
