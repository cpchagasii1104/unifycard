# 2026-06-12 — F-CANONICAL-MEDIA-BLOB-ASSET-TENANT-ISOLATION-CLOSURE

**GO corretivo final da IA Diretora** (correção cirúrgica + revalidação da macrofrente canônica)
sobre HEAD `274861c3` · branch `rescue-structural` · dev `unificard_dev` · migrations 372→**373**.
Origem: **FAIL do reseal adversarial da Yala** sobre F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-
OFFERING-CLOSURE com um único bloqueador material.

## Causa-raiz (vetor Yala, reproduzido no código vivo)

`media_assets` (migration 20260611160000) misturava **blob físico** (content_hash UNIQUE GLOBAL,
MIME, tamanho, storage_reference) com **asset lógico** (origin_tenant_id, created_by_actor_id,
source, license, moderation_status):

- tenant B enviando os MESMOS bytes recebia o **media_asset do tenant A** (`findByContentHash`
  global no ingest) — observando autoria/origem/moderação de A;
- `attachBusinessMedia` não provava que o asset pertencia ao contexto do caller — B vinculava o
  asset privado de A ao próprio business_media;
- `GET /catalog/media/assets/:id/file` servia o blob **sem nenhuma prova** de tenant/actor/
  vínculo/visibilidade/moderação;
- a lista canônica pública expunha `created_by_actor_id`/`origin_tenant_id`/`storage_reference`.

## Modelo corrigido (DECISION-0117 C MATERIALIZADA — ADENDO A2; dedup física PRESERVADA)

- **`media_blobs`** (FÍSICA): `content_hash` **UNIQUE GLOBAL** — mesmos bytes = 1 blob; MIME/
  tamanho/referência opaca/created_at. **SEM** tenant/actor/moderação/licença/source. Blob, hash
  e storage_reference **não autorizam acesso**.
- **`media_assets`** (LÓGICA): `media_blob_id` FK **RESTRICT** NOT NULL; autoria/origem/licença/
  moderação/trilha POR TENANT/ACTOR; **UNIQUE parcial `(media_blob_id, origin_tenant_id,
  created_by_actor_id)`** = reenvio idempotente SÓ no mesmo contexto. UNIQUE de hash e colunas
  físicas REMOVIDAS da camada lógica (backfill fail-closed antes do drop; dev tinha 0 linhas).
- **Ingestão**: MIME→magic→scan→hash→`findBlobByHash` (dedup física ANTES do storage)→blob
  (corrida 23505 = arquivo duplicado removido, blob vencedor reusado; fileReference é aleatória
  por chamada, nunca derivada do conteúdo)→`findAssetByBlobAndContext` (reuso lógico SÓ
  tenant+criador)→INSERT asset (corrida 23505 de contexto = idempotente). `reusedExistingBlob` =
  bytes reutilizados; `reusedExistingAsset` = idempotência própria. **Hash fora do response.**
- **Compensação ref-count-safe**: `deleteBlobIfUnreferenced` — DELETE guardado por `NOT EXISTS
  (media_assets)` + FK RESTRICT (23503 na corrida = manter); só si o blob nasceu NA chamada.
  Blob compartilhado **JAMAIS** é apagado; arquivo só após a linha sair.
- **Leitura autorizada** (`readContentAuthorized` + `canReadMediaAsset`): visível sse (a)
  canônica pública = approved **E** vinculada a entidade canônica (attach curatorial é o ato
  explícito de publicação; detach devolve à privacidade), (b) contexto do criador = mesmo tenant
  + `canRepresentActor`, ou (c) curador admin do tenant (precisa VER pending para moderar).
  Cross-tenant privado = **404 sem oráculo de existência**.
- **`attachBusinessMedia`**: + `subjectUserId`; exige asset do PRÓPRIO contexto (mesmo tenant +
  criador representável → senão `MEDIA_ASSET_FOREIGN` 403; outro tenant → 404) OU mídia canônica
  pública (referência explícita permitida).
- **Projeção pública** (`toPublicMediaProjection`): id/mime/size/license/version — sem autoria/
  origem/storage/hash.
- **Moderação por ASSET lógico**: aprovar o de um tenant nunca altera o de outro (mesmo blob).

## Artefatos

- Migration **`20260612090000_media_blob_asset_separation.sql`** (aditiva, forward-only,
  idempotente, backfill fail-closed; nenhuma migration aplicada editada; 373/373).
- `backend/src/core/media-assets/media-asset.service.ts` (reescrito em 2 camadas) ·
  `media-assets.routes.ts` (reader autorizado c/ rbac admin; projeção pública; subjectUserId).
- Gate `audit-canonical-catalog-closure.mjs` — seção 6 reescrita: **6a** dedup física antes do
  storage · **6b** compensação ref-count · **6c** PROIBIDO lookup lógico global por hash (o
  anti-padrão original) · **6d** reuso lógico context-scoped · **6e** file/metadata reader
  autorizado (tenant+visibilidade+canRepresentActor) · **6f** attach business prova contexto ·
  **6g** moderação/autoria/origem/licença NUNCA no blob (schema+writers) · **6h** UNIQUE de hash
  SÓ na física + UNIQUE de contexto na lógica · **6i** projeção pública sem metadata privada.
  O check antigo que EXIGIA `this.findByContentHash(contentHash)` (anti-padrão) foi removido.
  Resultado: **68 CLOSED_CANONICAL / 5 KNOWN_OPEN / 0 / 0 / 0**.
- Provas negativas: **`negative-proofs-media-isolation.ps1` 6/6** (P1 predicate tenant/visibility
  removido · P2 file reader sem auth · P3 attach cross-tenant · P4 moderação no blob · P5 colisão
  devolve asset do 1º uploader · P6 compensação apaga blob compartilhado — todas: inject→gate
  FAIL→restore sha256 byte-idêntico→gate OK) + **`negative-proofs-canonical.ps1` 8/8** re-verdes
  (P8 reapontada para `findBlobByHash`).
- E2E adversarial permanente **`validate-pipeline-e2e-media-tenant-isolation.ts` 25/25**
  (wrapper `scripts/run-media-tenant-isolation-ephemeral.ps1`): 2 TENANTS reais por HTTP —
  blob=1/assets=2/ids distintos/tenants+autores corretos (T1–T4) · moderação isolada (T5, B nasce
  pending com A approved) · file/attach cross-tenant 404 + zero linha (T6–T7b) · B usa o próprio
  asset (T8) · canônica pública pós-curadoria lida cross-tenant; o OUTRO asset do mesmo blob
  segue privado; payload público sem metadata privada (T9–T9d) · corrida cross-tenant 1 blob/2
  assets sem 500 (T10) · corrida mesmo-contexto idempotente (T11) · blob exclusivo compensado
  (T12) · blob COMPARTILHADO sobrevive a DB-failure (T13) · integridade blobs=3/assets=5/zero
  órfão (T14) · zero Bank (T15) · storage baseline (CLEANUP).
- CP2 atualizado/ampliado **26/26** (M2 = asset lógico próprio; M2b idempotência; M2c 1 blob;
  M2d pending de terceiro invisível; M8b2 moderação por asset; M12b visibilidade segue lifecycle
  pós-detach; M12c dono lê o próprio pending; M13 órfãos por BLOBS). Integrado **21/21** (I4 =
  asset próprio de B; blobs=1). Fixture `inventory-legacy-readers` G1d atualizada ao contrato
  vigente (`FIXED_REGRESSION=3` — o gate ganhou o check 3c no commit D; expectativa FORTALECIDA;
  defasagem pré-existente ao HEAD, descoberta nesta matriz).

## Matriz de revalidação (TODA verde)

Efêmeros (DB nova por teste): **isolation 25/25 · CP2 26/26 · integrado 21/21 · foundation 35/35
· templates 15/15 · offerings 16/16 · menu 13/13 · ramo-guard 14/14 · salon 10/10 · publication-
writer 20/20 · publication-projection 13/13 · revocation-cascade 15/15 · revocation-reader 6/6**.
Dev: **C1 journey 55/55 · PJ integrado 52/52 · inventory consolidated 39/39 · legacy-readers
32/32**. Gates: actor-writer OK · bank-ledger OK · regression-guards OK (financial/sql-lint/
numbering/inventory[FIXED_REGRESSION=3]/register-birth/c1-read-purity/c1-journey/pj[41]/
canonical 68-5-0-0-0) · arch --strict critical_new=0 (4 warnings NOVO = heurística textual sobre
comentários/URLs pré-existentes de inventário, zero em mídia, não-bloqueantes) · system-state
PASS · tsc backend = só baseline (4 arquivos do HEAD) · tsc frontend 0 · git diff --check 0.

## Estado residual

dev byte-estável (media_assets=0, media_blobs=0, business_media=0, relações canônicas de mídia=0;
bank_ledger/bank_transactions inalterados; catálogo/templates/tenants/actors intactos) · storage
local = baseline (0 resíduos das runs) · DBs efêmeras = 0 · working tree = frente + drift
protegido (orquestradores temporários tmp-mediafix/ NÃO commitados, deletados).

## Cartório

DT-CANONICAL-MEDIA-CROSS-TENANT-METADATA-AND-FILE-LEAK **OPEN (achado Yala) → CLOSED** no
REMEDIATION_DT_LOG · DECISION-0117 **ADENDO A2** (factual; não reabre A–H) · STATUS · opus (5
lições) · memória da executora. Resíduo honesto OPEN: projeção pública de business_media via
lifecycle de oferta/publicação (hoje owner/representável; nenhum consumer público existe).

**F-CANONICAL-MEDIA-BLOB-ASSET-TENANT-ISOLATION-CLOSURE: CLOSED.**
**F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE: tecnicamente concluída — AGUARDANDO RE-RESEAL FINAL YALA.**
