# SELO — Lifestyle SSOT actor-first (DT-LIFESTYLE-SENSITIVE-IN-BLOB)

**Tipo:** SELO documental de encerramento de frente (DOCS-ONLY).
**Data:** 2026-06-01.
**Frente:** `DT-LIFESTYLE-SENSITIVE-IN-BLOB` → **CLOSED** por este selo.
**Branch:** `rescue-structural`. **HEAD selado:** `fde091e1` (commit do selo avança a partir daqui).
**Decisão-mãe:** [`DECISION_0071_SENSITIVE_LIFESTYLE_HEALTH_PROFILE_POLICY.md`](DECISION_0071_SENSITIVE_LIFESTYLE_HEALTH_PROFILE_POLICY.md).
**Ratificação:** Clayton (política D1 + sequência de fatias) · Opus (execução) · ChatGPT (auditoria da cadeia).
**Subordinado a:** Constituição / LEIS (LGPD/privacidade como limite material), LEI_DE_COERÊNCIA §4.8 (actor-first), SSOT_REGISTRY.
**Irmão:** [`SELO_C1_LEARNING_INTEREST.md`](SELO_C1_LEARNING_INTEREST.md) (mesmo padrão: blob → substrato actor-first).

> Migração de dado pessoal **sensível** (lifestyle) de blob opaco (`global_users.metadata`)
> para **SSOT actor-first** com consentimento por campo, visibility privada, auditoria sem
> valor sensível em claro, e remoção que anonimiza. A política (DECISION-0071) veio **antes**
> de qualquer schema/código — ordem inegociável.

---

## 1. Estado final material

```text
Lifestyle usa SSOT actor-first:
  actor_lifestyle_attributes
    - linha-por-atributo (relationship_status / drinks / smokes)
    - attribute_key restrito por CHECK (sexual_orientation e health_condition REJEITADOS estruturalmente)
    - visibility = 'private' (public rejeitado pelo banco)
    - ativo  ⇒ attribute_value NOT NULL + consented_at NOT NULL
    - inativo ⇒ attribute_value NULL + retired_at (anonymize)
    - UNIQUE(tenant_id, actor_id, attribute_key)
    - FK actors(id) / tenants(id); sem RLS (isolamento por tenant na query, igual aos C1)

Audit:
  actor_lifestyle_attribute_audit
    - append-only; registra o EVENTO (key + action + actor + source)
    - SEM coluna de valor sensível (sem attribute_value / old_value / new_value / JSONB)

Frontend:
  ProfilePhysical → /profile/lifestyle
    - declare (com consentimento) / retire (anonymize); 🔒 Privado
    - NÃO envia mais lifestyle ao /profile/physical legado

Readers / core:
  core.service.getCompleteProfile lê Lifestyle do SSOT
    - completude conta presença de atributo ativo/consentido do SSOT

Blob:
  global_users.metadata.lifestyle = REMOVIDO (migration 20260601180000)
    - preferences / physicalMetadata / sharedHealthData PRESERVADOS

sexualOrientation:
  fora do MVP e fora de toda superfície que captura/persiste/projeta dado.
  (resíduo de CÓDIGO MORTO documentado — ver §6)

Health:
  fora do MVP; /profile/health/* = 501 PROFILE_HEALTH_DISABLED (não toca DB ausente)

Targeting:
  drinks/smokes DESACOPLADOS do social-targeting (breakdown.lifestyle sempre 0, sem consent fake)
```

---

## 2. Cadeia de commits

| Fatia | Descrição | Commit |
|-------|-----------|--------|
| **DECISION-0071** | Política de dados sensíveis Lifestyle/Saúde (D1, docs-only) | `18772b47` |
| **F-SAUDE-501** | Saúde fantasma → 501 honesto (rotas + UI) | `075781b8` |
| **F-TARGETING-DECOUPLE** | drinks/smokes fora do social-targeting | `b64aadf8` |
| **F1a** | Desenho READ-ONLY do SSOT Lifestyle | *(ratificado; sem commit próprio — insumo de desenho)* |
| **F1b** | Migration: `actor_lifestyle_attributes` + `actor_lifestyle_attribute_audit` | `e35b72d6` |
| **F2** | Service/repository internos consent-aware (sem rotas) | `2da17955` |
| **F3** | Rotas `/profile/lifestyle` + ProfilePhysical → SSOT | `18333872` |
| **F4** | Readers/core (`getCompleteProfile`) → SSOT + completude | `75bf815c` |
| **F5** | Cleanup do blob `metadata.lifestyle` | `fde091e1` |

> **Nota sobre F1a:** desenho material READ-ONLY ratificado por Clayton antes da migration — **insumo**,
> não código; não gerou commit próprio. F1b é a primeira materialização.

---

## 3. Invariantes preservados

```text
Perfil é porta de entrada, não SSOT.
Lifestyle tem SSOT próprio (actor_lifestyle_attributes).
actor_id é a identidade operacional (DECISION-0069 para resolução userId→actor user).
global_users.metadata NÃO é destino final de dado sensível.
Consentimento obrigatório por campo sensível (não por bloco).
Visibility = private por default; abertura exige decisão futura.
Auditoria registra o evento, SEM valor sensível em claro.
Remoção/anonymize zera attribute_value (delete real do valor).
sexualOrientation fora do MVP (categoria especial LGPD).
Saúde não nasce sem substrato governado (consent/visibility/audit/retenção).
drinks/smokes não alimentam targeting/matching/recomendação sem consentimento explícito futuro.
Texto livre que possa capturar dado de saúde NÃO é neutro (trava; eixo 10 da DECISION-0071).
Dado civil não é reaproveitável para Saúde sem finalidade/consentimento (trava prospectiva; eixo 11).
```

---

## 4. Provas materiais (consolidação das fatias)

- **Schema (F1b):** `attribute_key` aceita só `relationship_status/drinks/smokes` (`sexual_orientation` e
  `health_condition` rejeitados pelo CHECK); `visibility='private'` (public rejeitado); lifecycle XOR
  (ativo⇒value+consent / inativo⇒value NULL+retired_at); audit com 0 colunas de valor; sem texto
  livre/notes/height/weight → trava contra captura indireta de Saúde.
- **Service (F2):** `declare` exige consent (falha sem consent / `sexual_orientation` / valor inválido /
  visibility public); `retire` anonimiza (`attribute_value=NULL`, confirmado no DB); toda mutação grava audit
  sem valor.
- **Rotas/Frontend (F3):** GET `/profile/lifestyle` 200; PUT por atributo 200; sem consent → 400;
  `sexual_orientation` → 400; DELETE → anonymize. UI viva não captura/envia `sexualOrientation`; deixou de
  enviar `lifestyle` ao `/profile/physical`.
- **Readers (F4):** `getCompleteProfile.physical_profile.lifestyle` vem do SSOT; completude física 0→5 com
  atributo consentido; output sem `sexualOrientation`; no-actor estável (sem 500).
- **Cleanup (F5):** `metadata - 'lifestyle'` (idempotente; `schema_migrations` 345→346); 2 rows→0;
  `preferences`/`physicalMetadata` preservados; **sem backfill** (`actor_lifestyle_attributes`=0; valores
  legados sem consent não viram ativos — DECISION-0071 §6); PUT com lifestyle legado **não recria** a chave.
- **Gates** (todas as fatias de código): typecheck=0; actor-writer / bank-ledger / regression-guards OK;
  `validate-architectural-patterns --strict` `critical_new=0`, `critical_total=20` (baseline legado
  inalterado; `warning_new=1` em `validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts:334` é
  pré-existente, não desta frente).

---

## 5. Estado das DTs

```text
DT-LIFESTYLE-SENSITIVE-IN-BLOB:
  CLOSED (2026-06-01) — referência: docs/02_decisions/SELO_LIFESTYLE_SSOT.md

DT-PROFILE-FRONTEND-DRIVES-TAXONOMY:
  PARTIALLY MITIGATED — mantida como está (DECISION-0070); não tocada por este selo.

DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION:
  DEFERRED — mantida; decisão de produto futura.

Health governado futuro:
  NÃO abrir implementação agora — só com nova decisão/frente própria.
```

---

## 6. Resíduos e futuro (frentes próprias — NÃO autorizadas aqui)

```text
Resíduo de CÓDIGO MORTO sexualOrientation (cosmético, não-bloqueante):
  - profile-physical.routes.ts:34  → literal `sexualOrientation: null` SÓ no fallback de perfil nulo
                                      (nunca populado; o caminho real via service já não tem o campo).
  - profile-physical.routes.ts:64  → Body type do PUT legado ainda ACEITA lifestyle.sexualOrientation,
                                      mas updatePhysicalProfile faz strip de todo `lifestyle` (F5) → ignorado.
  - frontend/src/api/core.ts:39 + api/physical.ts:17 → tipos do client legado; a UI viva (ProfilePhysical)
                                      não lê/envia desde F3.
  Caracterização: NÃO há captura, persistência nem projeção de sexualOrientation. São declarações de
  forma mortas no contrato LEGADO /profile/physical e nos tipos do client. Remoção é cosmética →
  frente própria opcional (não altera comportamento).

Health governado futuro:
  só com nova decisão/frente própria (substrato 0382 ou redesenho; consent/visibility/audit/retenção).

Visibility além de 'private':
  só com decisão futura explícita.

Uso de lifestyle em targeting/matching/recomendação:
  só com consentimento explícito + decisão futura.

Remoção cosmética de código morto (sexualOrientation legado, tipos órfãos):
  opcional, frente própria.
```

---

**Selo emitido.** A frente Lifestyle/Saúde sensível está consolidada: política → desativação do fantasma
de Saúde → desacoplamento de targeting → SSOT actor-first (schema/service/rotas/frontend/readers) → cleanup
do blob. `DT-LIFESTYLE-SENSITIVE-IN-BLOB` **CLOSED**.
