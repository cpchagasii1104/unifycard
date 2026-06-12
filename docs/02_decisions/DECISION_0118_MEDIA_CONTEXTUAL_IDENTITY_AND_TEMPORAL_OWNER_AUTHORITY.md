# DECISION-0118 — Identidade contextual de mídia lógica e autoridade polimórfica do owner temporal

**Data:** 2026-06-12 · **Status:** PROMULGADA (ratificação: IA Diretora / Clayton — GO macro corretivo
integrado `F-CANONICAL-CONTEXTUAL-MEDIA-AND-TEMPORAL-AUTHORITY-CLOSURE`) · **Executora:** unificard
**Origem:** reseal adversarial da Yala sobre a macrofrente canônica — DOIS bloqueadores materiais
independentes, comprovados no código vivo em `7ff2aeb8`:
- **[B1] DT-CANONICAL-MEDIA-LOGICAL-CONTEXT-COLLAPSE** — a identidade do asset lógico era apenas
  `(media_blob_id, origin_tenant_id, created_by_actor_id)`: licença/source/finalidade/contexto
  divergentes eram DESCARTADOS em silêncio (o 2º envio do mesmo humano no mesmo tenant devolvia o
  asset anterior, ignorando a nova declaração); o gate 6d cristalizava esse anti-padrão.
- **[B2] DT-UNIFIED-AVAILABILITY-RESOURCE-OWNER-AUTHORITY-CONFLATION** — `availability.owner_id`
  era tratado como ACTOR em toda a família temporal (`canRepresentActor(userId, ownerId)` e
  `actionContext.actorId === ownerId` como autorização). Para `owner_type='service_offering'`
  (`owner_id` = id da oferta, que NUNCA existe em `actors`), a availability era WRITE-ONLY:
  criada pelo writer (com `as never` por fora do enum) e inacessível por qualquer rota de
  leitura/gestão. O banco aceitava `owner_type` livre (VARCHAR sem CHECK).

Esta DECISION é a norma; o GO executa o que aqui está registrado. Não reabre DECISION-0072 (B1
agenda), DECISION-0109, DECISION-0113 nem DECISION-0117 — **materializa-as**.

## D1 — Blob físico não é direito de uso; asset lógico é DECLARAÇÃO CONTEXTUAL

1. **Dedup física global permanece obrigatória**: mesmos bytes = um `media_blobs` (content_hash
   UNIQUE GLOBAL). O blob não contém autoridade, autoria, moderação, licença, origem ou finalidade
   — blob/hash/storage_reference NUNCA autorizam acesso (preserva DECISION-0117 C + ADENDO A2).
2. **Asset lógico = declaração contextual de uso.** A identidade lógica passa a incluir TODAS as
   dimensões materiais da declaração: `media_blob_id` + `origin_tenant_id` +
   `created_by_actor_id` (actor declarante) + **`context_type`** + **`context_owner_id`** +
   **`source`** + **`purpose`** + **licença normalizada** + **provenance normalizada**
   (`origin_note`). Materialização: colunas reais + `context_fingerprint` (md5 V1 das dimensões
   normalizadas) com **UNIQUE** — não metadata JSON opaca.
3. **Vocabulário de contexto** (CHECK físico): `context_type ∈ {company, canonical_suggestion,
   platform}` · `purpose ∈ {business_media, canonical_catalog, platform_curation}` ·
   `context_type='company' ⇒ context_owner_id NOT NULL` (a EMPRESA dona do uso). O mesmo humano
   representando duas empresas gera declarações DISTINTAS por empresa; uso empresarial ≠ sugestão
   canônica, mesmo com bytes/tenant/actor idênticos.
4. **Idempotência**: existe SOMENTE quando o contexto material é INTEGRALMENTE o mesmo (CASO 1 —
   mesmo fingerprint ⇒ mesmo asset, `reusedExistingBlob`/`reusedExistingAsset` verdadeiros).
   Mesmos bytes com QUALQUER dimensão divergente ⇒ asset/declaração NOVA sobre o MESMO blob
   (CASO 2). Nenhum campo declarado é descartado em silêncio.
5. **Chave explícita de idempotência** (`idempotency_key`, escopo tenant+actor declarante):
   reuso com payload contextual IDÊNTICO ⇒ idempotente; reuso com payload DIVERGENTE ⇒
   **409 conflito observável**, sem alterar o registro anterior e sem sucesso falso.
6. **Moderação pertence ao asset/declaração** (nunca ao blob, nunca à chave de identidade):
   aprovar uma declaração não aprova outra do mesmo blob; mídia canônica pública não publica os
   usos empresariais privados do mesmo blob.
7. **Autorização de metadata/download/attach resolve o CONTEXTO**: uso empresarial privado exige
   autoridade sobre o `context_owner` (empresa) — não basta "representar o actor autor" quando o
   ownership real é uma empresa específica; sugestão canônica pending/rejected = declarante (via
   contexto) + curador; canônica pública = approved + relação canônica explícita, com projeção
   pública sem metadata privada. Attach empresarial exige asset do contexto da empresa-alvo OU
   mídia canônica pública (referência explícita).

## D2 — Owner temporal é RECURSO; autoridade é resolvida por policy conforme owner_type

1. Na Unified Availability, `(owner_type, owner_id)` identificam o **RECURSO temporal**
   proprietário da janela — NÃO o actor autorizado. **resource owner ≠ authority actor.**
2. **Resolução polimórfica server-side obrigatória** (primitivo central único —
   `resolveAvailabilityOwnerAuthority` — com policies por owner_type; sem switch disperso por
   rota): prova que (a) o recurso EXISTE no tenant; (b) o `owner_id` pertence ao TIPO declarado;
   (c) deriva o **authority actor** do recurso; (d) o sujeito autenticado (`req.user.userId`)
   pode representá-lo (`canRepresentActor`). Mapa material vigente (schema vivo):
   - `user` → o próprio actor (`actors.id`, tipo humano);
   - `page` → o próprio page actor (`actors.id`, tipo page);
   - `service` → `services.actor_id`;
   - `service_offering` → `service_offerings.provider_actor_id`;
   - `event` → `events.actor_id` (organizador);
   - `group` → `groups.owner_actor_id`.
3. **Vocabulário físico fail-closed**: `service_offering` entra no enum canônico
   (`AvailabilityOwnerType`) e o banco ganha CHECK de `owner_type` restrito aos tipos normados,
   vivos E suportados pelo resolver: `{user, service, event, group, page, service_offering}`.
   Nenhum tipo por antecipação (driver/pdv etc. exigem norma + runtime + policy). `as never`
   PROIBIDO na família temporal.
4. **PROIBIDO** como autorização: `canRepresentActor(userId, availability.ownerId)` quando o
   owner não é comprovadamente actor; `actionContext.actorId === ownerId` como autorização
   genérica; owner declarado pelo cliente como autoridade; fallback para actor do cliente; cura
   de actor em qualquer caminho temporal. `actionContext.actorId` permanece HINT/autoria
   (DECISION-0113): a coerência de autoria é comparada ao **authority actor resolvido**, e a
   autoridade em si é sempre `canRepresentActor` server-side a partir de `req.user`.
5. Nenhum menu, frontend ou actorId declarado concede autoridade temporal.

## Limites

Não abre booking↔service_offering binding, unicidade de service_order por booking, capacidade/
sobreposição global, bundle atômico, escrow, pedido/pagamento (registrados como dívidas, frente
causal futura). Não reabre as superfícies aprovadas da macrofrente canônica.

## Referências

GO `F-CANONICAL-CONTEXTUAL-MEDIA-AND-TEMPORAL-AUTHORITY-CLOSURE` (IA Diretora, 2026-06-12);
reseal Yala (vetores [B1]/[B2]); DECISION-0072; DECISION-0109; DECISION-0113; DECISION-0117 +
ADENDOS A1/A2; SSOT_REGISTRY (SSOT TEMPORAL); schema vivo (`availability.owner_type` VARCHAR sem
CHECK; `service_offerings.provider_actor_id`; `services.actor_id`; `events.actor_id`;
`groups.owner_actor_id`; `media_assets` pós-`20260612090000`).
