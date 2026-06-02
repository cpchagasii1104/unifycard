# SELO — Endereço civil PF → Location Core (DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE)

**Tipo:** SELO documental de encerramento de frente (DOCS-ONLY).
**Data:** 2026-06-02.
**Frente:** `DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` → **CLOSED** por este selo.
**Branch:** `rescue-structural`. **HEAD selado:** `040f71fd` (o commit deste selo avança a partir daqui).
**Decisões-mãe:** [`DECISION_0074`](DECISION_0074_PROFILE_RESIDENCE_ADDRESS_LOCATION_CORE.md) (owner model PF) ·
[`DECISION_0076`](DECISION_0076_PROFILE_ADDRESS_GEO_ENRICHMENT_POLICY.md) (enriquecimento transitório do blob) ·
[`DECISION_0077`](DECISION_0077_LOCATION_CORE_GEO_ENRICHMENT_POLICY.md) (estratégia geo B+D+C) ·
[`DECISION_0078`](DECISION_0078_GEO_CEP_CACHE_BACKFILL_POLICY.md) (cache/backfill/provider) ·
[`DECISION_0079`](DECISION_0079_LOCATION_CORE_NEIGHBORHOOD_POLICY.md) (bairro = exibição controlada, não FK).
**Subordinado a:** `DECISION-0020`/`0021` (Location Core soberano), LEI_DE_COERÊNCIA §4.8 (actor-first), SSOT_REGISTRY,
LGPD (limite material), `DECISION-0075` §7 (fronteira endereço PJ — fora desta instância).
**Irmãos:** [`SELO_LIFESTYLE_SSOT.md`](SELO_LIFESTYLE_SSOT.md) · [`SELO_C1_LEARNING_INTEREST.md`](SELO_C1_LEARNING_INTEREST.md)
(mesmo padrão: blob opaco → SSOT canônico actor-first).
**Ratificação:** Clayton (owner model + sequência de fatias + autorização do cleanup) · Opus (execução) ·
auditoria da cadeia em cada fatia.

> Migração do **endereço civil da Pessoa Física** de blob opaco (`profiles.metadata.address`) para o **Location
> Core soberano** (`addresses` + `address_assignments`), com cidade/UF canônicas por FK (catálogo IBGE) e bairro
> como **texto de exibição controlado** — explicitamente **não** autoridade territorial. "Cidade tem IBGE; bairro
> tem apelido — um vira canônico, o outro vira exibição controlada." A prateleira foi criada, o dado movido peça
> por peça, o leitor desacoplado, e só então a caixa velha jogada fora — com guard fail-closed dentro do DML.

---

## 1. Estado final material

```text
Endereço civil PF NÃO mora mais em profiles.metadata.address (subchave removida; resto do JSONB preservado).

Escrita nova:
  PUT /profile/residence-address  → profile-residence-address.service → Location Core (Opção A, CEP-âncora)
  Frontend (ProfilePersonal) NÃO envia mais endereço no PUT /profile (sai do blob).

SSOT = Location Core:
  addresses              — CEP/rua/número/complemento + FK state_id/city_id + neighborhood_display_text + source
  address_assignments    — vínculo temporal polimórfico

Owner model (DECISION-0074):
  owner_type = 'profile'
  owner_id   = actor_id do user-actor (resolveUserActorId; actor_type='user')
  role       = 'RESIDENCE'
  is_primary = true ; valid_until_at IS NULL  (residência vigente)

Cidade / UF — por FK canônica (F-GEO-3):
  addresses.state_id → states.abbreviation ('PR') / states.name ('Paraná')
  addresses.city_id  → cities.name ('Curitiba') / cities.external_code (IBGE '4106902')

Bairro — texto de exibição controlado (DECISION-0079, F-GEO-4a/4b/4c):
  addresses.neighborhood_display_text   (NÃO FK, NÃO SSOT territorial)
  neighborhood_id (uuid FK) segue RESERVADO para catálogo oficial futuro.

Reader (core.service.getCompleteProfile) — endereço PF 100% do Location Core:
  neighborhood = canonical.neighborhoodDisplayText || blob.neighborhood(fallback morto) || null
  city/UF      = FK canônica (blob só fallback quando FK NULL — não ocorre no universo atual)
  NÃO depende mais do blob para nenhum campo do endereço.
```

---

## 2. Cadeia consolidada de commits

| # | Fatia | Descrição | Commit |
|---|-------|-----------|--------|
| 1 | **DECISION-0074** | Endereço civil PF → Location Core (D1, owner model) | `335a5eaf` |
| 2 | **F1** | Backend residência PF + backfill (Opção A, CEP-âncora) | `f32dba8c` |
| 3 | **F2** | Frontend grava na rota canônica, fora do blob | `5e098a25` |
| 4 | **DECISION-0076** | Política de enriquecimento geográfico do endereço PF (D2) | `ff0a8c43` |
| 5 | **DECISION-0077** | Estratégia geo do Location Core (B+D+C; D-GEO) | `85be6903` |
| 6 | **F-GEO-1a** | Infra geo compartilhável — resolver CEP/UF/cidade | `30e46ba9` |
| 7 | **DECISION-0078** | Política de cache/backfill/provider real de CEP | `1433cfdf` |
| 8 | **F-GEO-1b** | Cache CEP + service cache-first + backfill idempotente | `eb0970ec` |
| 9 | **F-GEO-2a** | Dry-run do backfill geo (sem API externa) | `17947618` |
| 10 | **F-GEO-2b** | Backfill real (BrasilAPI) — state-only; gap de IBGE | `73d48e30` |
| 11 | **F-GEO-2c** | ViaCepProvider (IBGE) + re-resolve de cache incompleto | `9585524b` |
| 12 | **F-GEO-2d** | Execução real ViaCEP — city_id dos 3 preenchido | `b9b1bb53` |
| 13 | **F-GEO-3** | core.service lê city/UF por FK canônica, sem blob | `70f9aa73` |
| 14 | **DECISION-0079** | Bairro = texto de exibição, não FK (D-NEIGHBORHOOD) | `cd4fd5ba` |
| 15 | **F-GEO-4a** | Coluna `addresses.neighborhood_display_text` + write/read | `b755761b` |
| 16 | **F-GEO-4b** | Migra bairro do blob → `neighborhood_display_text` | `46a6be9d` |
| 17 | **F-GEO-4c** | core.service lê bairro da coluna (read-first), não do blob | `347116b5` |
| 18 | **F-GEO-4d** | Cleanup seguro de `profiles.metadata.address` (guard fail-closed) | `040f71fd` |
| 19 | **F-GEO-5** | **Este selo + CLOSE da DT** | *(commit deste selo)* |

> Cadeia verificada commit-a-commit (subjects batem 1:1). PF apenas — PJ/Companies seguem em outra instância,
> sobre o mesmo trilho Location Core/Geo (sem resolver/cache paralelo).

---

## 3. Invariantes preservados

```text
actor-first: owner_id do endereço = actor_id do user-actor (NUNCA global_user_id, NUNCA profile_id).
Location Core é SSOT único de endereço — sem Location Core paralelo, sem texto solto em metadata.
Cidade/UF = verdade canônica por FK (external_code/IBGE) — NÃO texto livre, NÃO match frágil por nome.
Bairro = exibição controlada (neighborhood_display_text) — NÃO FK por nome, NÃO autoridade territorial/fiscal/matching.
neighborhood_id (FK) reservado para catálogo oficial futuro — não inventado por nome.
CEP = insumo de resolução (UX), NÃO SSOT sozinho; cache de CEP é insumo técnico, NÃO SSOT.
actor_active_location ≠ residência civil (contexto espacial corrente, RLS-private; intocado nesta frente).
Coordenada precisa de residência NÃO persistida (privacidade/LGPD; geo coarse = centroide via FK).
API externa só via env opt-in (CEP_PROVIDER), NUNCA em CI/gates/migration.
PF apenas — zero PJ/Companies/company address; zero financeiro nesta frente.
```

---

## 4. Provas materiais (consolidação, estado final em DEV 2026-06-02)

```text
profiles WHERE metadata ? 'address'                                   = 0   (blob extinto)
profiles WHERE metadata IS NULL                                       = 0   (JSONB nunca nulado; só a subchave saiu)
address_assignments profile/RESIDENCE primárias vigentes              = 2   (residência canônica existe)
addresses WHERE postal_code IS NOT NULL                               = 3
addresses WHERE state_id IS NOT NULL                                  = 3   (UF por FK)
addresses WHERE city_id IS NOT NULL                                   = 3   (cidade por FK/IBGE)
addresses WHERE neighborhood_display_text IS NOT NULL                 = 1   ("Sítio Cercado")
neighborhoods                                                         = 0   (sem FK artificial de bairro)
actor_active_location                                                 = 1   (intocado)
```

- **Cleanup (F-GEO-4d):** guard fail-closed (aborta com órfão) + `metadata - 'address'` (só subchave) + verificação-pós;
  pré-check `orphans=0` antes de remover. Profile alvo manteve 5 chaves (`gender='male'`, onboarding_*,
  personal_data_locked_*) — só `address` removido.
- **Prova runtime (blob JÁ removido):** `getCompleteProfile` do user que tinha "Sítio Cercado" retorna endereço
  completo — `address_id` UUID canônico (`caef7b1c`), cep `81920410`, rua/número, `city=Curitiba`, `state=PR`,
  `neighborhood="Sítio Cercado"` — **100% do Location Core, zero regressão visual**.
- **Gates** (todas as fatias de código/migration): typecheck=0; actor-writer / bank-ledger / regression-guards OK
  (regression 350 ao final); `validate-architectural-patterns --strict` `critical_new=0`, `critical_total=20`
  (baseline legado inalterado; `warning_new=1` em `validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts:334` é
  pré-existente, não desta frente).

---

## 5. Estado das DTs

```text
DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE:
  CLOSED (2026-06-02) — referência: docs/02_decisions/SELO_PROFILE_RESIDENCE_ADDRESS_LOCATION_CORE.md
  (Histórico OPEN preservado no REMEDIATION_DT_LOG.md — toda a cadeia D1→F-GEO-4d registrada.)

DT-PROFILE-FRONTEND-DRIVES-TAXONOMY:
  PARTIALLY MITIGATED — não tocada por este selo.
```

---

## 6. Resíduos e futuro (frentes próprias — NÃO autorizadas aqui)

```text
gender em profiles.metadata:
  dívida MENOR remanescente da aba Pessoal (metadata.gender ainda é blob). Frente própria, fora deste selo.

CPF (DECISION-0062) F4/F5:
  migrar leitura CORE + deprecar caches de CPF — frente própria já mapeada, não desta frente.

PJ / Companies (endereço PJ):
  outra instância. DEVE usar o MESMO Location Core/Geo compartilhado (sem resolver/cache paralelo;
  sem assumir city/UF textual canônica em addresses — DECISION-0075 §7 / 0077).

neighborhood_id (FK de bairro):
  reservado para futuro catálogo oficial/confiável de bairros (IBGE não codifica bairro). Não criar por nome livre.

Geocoding preciso de residência (lat/lng):
  exige decisão de privacidade/LGPD própria (consent/visibility/RLS) — addresses não tem RLS hoje. Vetado sem isso.

Catálogo de cidades:
  cresce sob demanda por external_code/IBGE (DECISION-0077 §C). Sem import em massa.
```

---

**Selo emitido.** A frente Endereço Civil PF está consolidada: política (owner model + geo + bairro) → infra geo
compartilhável → enriquecimento real (state/city por IBGE) → leitura canônica (city/UF/bairro) → prateleira de bairro
→ migração do bairro → leitor desacoplado → cleanup do blob com guard. O endereço da PF é **SSOT no Location Core,
sem rodinha lateral**. `DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` **CLOSED**.
