# 2026-06-12 — F-CANONICAL-CONTEXTUAL-MEDIA-AND-TEMPORAL-AUTHORITY-CLOSURE

**GO macro corretivo integrado da IA Diretora** sobre HEAD `7ff2aeb8` · rescue-structural ·
migrations 373→**375** · **DECISION-0118** promulgada ANTES do runtime (commit 0 `e1cecdca`).
Origem: re-reseal adversarial da Yala — DOIS bloqueadores independentes.

## EIXO M — [B1] DT-CANONICAL-MEDIA-LOGICAL-CONTEXT-COLLAPSE (CLOSED)

**Causa-raiz:** identidade lógica = só (blob, tenant, actor) — licença/source/purpose/empresa
divergentes colapsavam em silêncio; gate 6d cristalizava o anti-padrão.

**Modelo (DECISION-0118 D1):** asset lógico = DECLARAÇÃO CONTEXTUAL. Migration
`20260612100000_media_asset_contextual_identity.sql`: `context_type` + `context_owner_id` +
`purpose` + `idempotency_key` + **`context_fingerprint` UNIQUE** (md5 V1 espelhado SQL↔
`media-context-identity.ts`; blob|tenant|actor|context_type|context_owner|source|purpose|
licença_norm|provenance_norm); CHECKs de vocabulário; UNIQUE blob+tenant+actor REMOVIDA;
UNIQUE parcial de idempotency_key por (tenant, actor). Backfill fail-closed (dev: 0 linhas).

**Pipeline:** dimensões da declaração no upload (`purpose` business_media|canonical_catalog
dirige context_type company|canonical_suggestion; companyId = context_owner; license/provenance/
idempotencyKey); CASO 1 fingerprint idêntico ⇒ idempotente; CASO 2 dimensão divergente ⇒
declaração NOVA no MESMO blob; CASO 3 Idempotency-Key + payload divergente ⇒ **409
MEDIA_IDEMPOTENCY_CONFLICT** (registro anterior intacto). Compensação ref-count-safe preservada.

**Autorização:** leitura privada = autoridade do CONTEXT_OWNER (canManageCompany) — autor
genérico NÃO basta; attach business = declaração da MESMA empresa-alvo (mesmo humano gerindo E1
e E2 não cruza ativos privados) OU canônica pública; sugestão canônica pending inanexável a
business; canônica pública = approved + relação explícita.

**Provas:** e2e NOVO `validate-pipeline-e2e-media-contextual-identity.ts` **21/21** (cenários
A/B/C/D; licença divergente preservada; moderação por declaração; cross-company mesmo-humano
403; idempotency 409; canônica pública por declaração; 1 blob/5 declarações; bank 0; storage
baseline). Isolation cross-tenant atualizado (T2/T8 = contexto empresarial). CP2 intacto.

## EIXO T — [B2] DT-UNIFIED-AVAILABILITY-RESOURCE-OWNER-AUTHORITY-CONFLATION (CLOSED)

**Causa-raiz:** família temporal tratava owner_id como ACTOR (canRepresentActor(ownerId);
actionContext===ownerId); service_offering fora do enum (`as never`), availability da oferta
WRITE-ONLY; owner_type VARCHAR livre.

**Modelo (DECISION-0118 D2):** (owner_type, owner_id) = RECURSO. Resolver polimórfico central
`core/availability/availability-owner-authority.ts` — `OWNER_AUTHORITY_POLICIES` por tipo
(user/page→próprio actor com fidelidade actor_type · service→services.actor_id ·
service_offering→service_offerings.provider_actor_id · event→events.actor_id ·
group→groups.owner_actor_id) → existência no tenant + tipo↔id + **authority actor** +
canRepresentActor server-side. Rotas TODAS migradas (create/list/get/update/weekly-template/
bookings/check-in/check-out/participants): autoria (actionContext, hint 0113) comparada ao
authority RESOLVIDO; nunca ao ownerId cru. Enum ganhou SERVICE_OFFERING (zero `as never`;
writer usa enum; frontend espelhado). Migration `20260612110000_availability_owner_type_check.sql`:
CHECK físico {user, service, event, group, page, service_offering} (valida vivos antes; dev: 32
linhas todas 'user'). Sem driver/pdv por antecipação.

**Provas:** e2e NOVO `validate-pipeline-e2e-availability-owner-authority.ts` **24/24** —
service_offering PONTA A PONTA por HTTP (cria 201/relê/lista/atualiza/pausa/reativa/booking de
cliente/lista bookings/confirma/check-in/check-out); estranho 403 em TODAS; owner inexistente
404; tipo↔id incompatível 404 (UUID coincidente nunca autoriza); actionContext forjado 403;
**offering.id ∉ actors** (material); CHECK rejeita 'pdv'; matriz user/page/service/event/group
(dono 201+200; estranho 403; cross-type 404); zero actor curado; bank 0.

## INTEGRADO + GATES + PROVAS

- E2E INTEGRADO `validate-pipeline-e2e-contextual-media-temporal-authority.ts` **10/10**
  (mídia A/B/C/D + cross-company + canônico público; service_offering lifecycle + estranho +
  confirm; bank_ledger/transactions/accounts byte-idênticos; storage baseline).
- Gate canônico AMPLIADO: 6d reescrito (identidade = contexto completo; `findAssetByBlobAndContext`
  PROIBIDO — cristalização removida), 6d2 idempotency-conflict, 6e/6f context_owner.
  **71 CLOSED_CANONICAL / 5 KNOWN_OPEN / 0 / 0 / 0.**
- Gate temporal NOVO `audit-availability-owner-authority.mjs` (**23/0**; paridade enum↔CHECK;
  policy por tipo; proibições ownerId-cru/`as never`/cure; NEW_UNCLASSIFIED) — integrado ao
  `validate:regression-guards` + alias `validate:availability-owner-authority`.
- **Provas negativas 11/11** (`negative-proofs-contextual-temporal.ps1`): P-M1 context_owner
  fora da identidade · P-M2 licença descartada · P-M3 attach cross-company · P-M4 publicação sem
  relação canônica · P-M5 idempotency sucesso falso · P-T1 canRepresentActor(ownerId) · P-T2
  enum sem service_offering · P-T3 `as never` · P-T4 policy removida · P-T5 actionContext vs
  ownerId · P-T6 owner_type novo sem policy — todas: inject→FAIL→restore sha256→OK.

## TSC — HONESTIDADE OBRIGATÓRIA (GO §20)

**tsc backend: VERMELHO — 25 erros PRÉ-EXISTENTES** (idênticos ao HEAD `7ff2aeb8`; union sem
discriminação em account.routes ×10, event-rfq.routes ×8, event-settlement.routes ×2,
e2e-events-money-reads ×5 — arco DECISION-0113, anteriores a `d865a04d`). **ZERO erro novo da
macrofrente** (diff de saída vazio nos arquivos tocados). NÃO corrigidos (fora do escopo; frente
0113). Frontend: **0 erros**.

## REGRESSÕES (matriz §19) e estados

Registrados na RESPOSTA final da frente (matriz completa: 13 efêmeros + 9 f6-5 availability +
4 dev). Estados: esta frente **tecnicamente concluída** · F-CANONICAL-CATALOG **tecnicamente
concluída** · MACROFRENTE CANÔNICA **NÃO CLOSED antes do PASS da Yala**. Achados Yala FORA do
corte registrados sem fechar no DT_LOG (frente oferta→pedido).
