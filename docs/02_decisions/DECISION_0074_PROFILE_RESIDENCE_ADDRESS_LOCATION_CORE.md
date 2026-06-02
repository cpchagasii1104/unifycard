# DECISION-0074 — Endereço civil da pessoa física → Location Core (`addresses` + `address_assignments`)

**Status:** RATIFICADA — DECISÃO DE MODELAGEM/SSOT. **DOCS-ONLY**; implementação **NÃO** autorizada aqui (2026-06-01).
**Sessão:** 2026-06-01 (pós auditoria READ-ONLY da aba Pessoal + READ-ONLY de endereço civil PF).
**Decisor:** Clayton (owner model: `profile` + `actor_id` + `RESIDENCE`).
**Commit âncora:** HEAD origem `4ec2dfcb`.
**Documento canônico:** este arquivo.
**Subordinada a:** `SSOT_REGISTRY_UNIFICARD.md`, `DECISION-0020` (Location Core como infraestrutura territorial soberana),
`DECISION-0021` (tenant-awareness em addresses), LEI_DE_COERÊNCIA §4.8 (actor-first), `07_NOMENCLATURA_CANONICA.md`.
**Vinculada a:** `DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN — decisão tomada, implementação pendente),
DECISION-0069 (resolução `userId → actor user`).
**Escopo desta instância:** **somente Pessoa Física.** PJ/Companies/actor-context PJ são tratados por outra instância.

---

## 1. Contexto (auditoria read-only, HEAD `4ec2dfcb`)

A aba **Pessoal** grava o endereço civil da pessoa física em **`profiles.metadata.address`** (blob JSONB, via
`PUT /profile` → `profile.service.updateProfile` deepMerge) e lê do mesmo blob (`core.service.getCompleteProfile`).
Campos: `cep`, `address`/`street`, `address_number`/`number`, `complement`, `neighborhood`, `city`, `state`
(texto livre; **sem** lat/lng; cidade/estado **não** são FK ao catálogo). Em DEV: **1 `profiles.metadata.address`**
(addresses=0, address_assignments=0).

O **Location Core canônico já existe e já tem slot nativo para PF** (mig. `20260530518000`): `addresses`
(country→state→city→neighborhood FK; postal_code/street/number/complement; **lat/lng** geo-ready; `source` enum)
+ `address_assignments` polimórfico (`owner_type` ∈ {company, **profile**, event, ride, group, tenant_hq,
service_provider}; `role` ∈ {BILLING, DELIVERY, **RESIDENCE**, HQ, OPERATIONAL, PICKUP, DROPOFF}; `is_primary`;
`valid_from_at`/`valid_until_at` temporal; UNIQUE parcial 1 primary por (owner_type, owner_id, role)). Companies
já usam o Location Core (`owner_type='company', role='HQ'`); PE-5 usa `service_provider/OPERATIONAL`. O endereço
PF é o **único** que permaneceu em blob — divergência material que PJ/marketplace/geo/fiscalidade futura herdariam.

## 2. Escolha principal

O **endereço civil da pessoa física sai de `profiles.metadata.address`** e passa a usar o **Location Core
canônico** (`addresses` + `address_assignments`). **Sem blob, sem substrato paralelo.**

## 3. Modelo canônico escolhido

```text
owner_type = 'profile'        -- papel civil/residencial no Location Core
owner_id   = actor_id          -- do user-actor (actor PF), NÃO global_user_id nem profile_id
role       = 'RESIDENCE'
is_primary = true              -- 1 residência primária no MVP (modelo já suporta N por role/temporal)
```

**Interpretação:** `owner_type='profile'` representa o **papel** civil/residencial dentro do Location Core; o
**dono operacional** é o **actor PF** (`owner_id = actor_id`). NÃO se usa `global_user_id` (não reintroduzir como
identidade operacional) nem `profile_id` (projeção tenant-local) como dono da verdade.

## 4. Fontes (`source`)

```text
source = 'UX_INPUT'       -- escrita nova (usuário digita / CEP resolvido pode usar 'CEP_RESOLVED')
source = 'IMPORT_LEGACY'  -- backfill a partir de profiles.metadata.address
```

## 5. Justificativa

- Mantém **actor-first** (coerente com toda a varredura Perfil→SSOT desta sessão).
- Evita reintroduzir **`global_user_id`** como identidade operacional.
- Evita usar **`profile_id`** tenant-local como dono da verdade.
- **Converge PF ao Location Core** — mesmo modelo que companies/marketplace/geo já consomem (reduz divergência).
- Impede que endereço civil continue em **blob** (não-consultável por geo/jurisdição/raio).
- Prepara o terreno civil **sem abrir PJ** nesta instância.

## 6. Escopo

**Dentro:** Pessoa Física · endereço civil/residencial · Profile/Pessoal · Location Core.
**Fora (vetado nesta instância):** Pessoa Jurídica · Companies · CNPJ · empresa · company address · ERP · PDV ·
CRM · CPF/DECISION-0062 · gender · financeiro.

## 7. Fronteiras semânticas (vinculantes)

```text
endereço civil PF  ≠  endereço operacional de empresa
RESIDENCE          ≠  HQ            (sede de empresa/tenant)
RESIDENCE          ≠  OPERATIONAL   (ponto de operação de negócio / service_provider, PE-5)
endereço civil PF  ≠  actor_active_location
actor_active_location = contexto espacial CORRENTE do actor (RLS/LGPD; geo de feed/raio), NÃO residência civil
  — pode REFERENCIAR addresses, mas não é a residência declarada.
NÃO criar Location Core paralelo.
```

## 8. Backfill futuro (desenho — NÃO executar aqui)

```text
- ler profiles.metadata.address (DEV: 1 row);
- resolver actor PF via helper seguro user→actor (resolveUserActorId / DECISION-0069); NÃO criar actor por SQL;
- criar addresses com source='IMPORT_LEGACY' (country=BR; resolver city/state ao catálogo quando possível);
- criar address_assignments com owner_type='profile', owner_id=actor_id, role='RESIDENCE', is_primary=true;
- endereço incompleto NÃO vira address inválido (ignorar/pendente + log; respeitar CHECKs de addresses);
- preservar o blob até readers/frontend migrarem;
- cleanup do blob só em fatia posterior (F4); idempotente (ON CONFLICT / sem duplicar).
```

## 9. Escrita nova futura (desenho)

```text
- ProfilePersonal PARA de mandar endereço em metadata.address (via updateProfile);
- passa a usar rota/service canônico de Location Core (PF residence);
- source='UX_INPUT';
- manter o shape da UI (trocar o transporte, não reinventar o formulário).
```

## 10. Readers futuros (desenho)

```text
- core.service.getCompleteProfile lê endereço PF do Location Core (JOIN addresses via assignment profile/RESIDENCE);
- fallback ao blob SOMENTE durante a transição;
- fallback removido no cleanup (F4);
- nenhum módulo novo deve ler profiles.metadata.address.
```

## 11. Sequência recomendada (não autorizada aqui)

```text
D1 — esta decisão (docs-only)
F1 — backend reader/writer + backfill idempotente (ordem inegociável: F1 antes de F2)
F2 — frontend ProfilePersonal → rota canônica de address PF
F3 — readers/core lendo do Location Core (sem depender do blob)
F4 — cleanup de profiles.metadata.address
F5 — selo + CLOSE da DT
```

## 12. Vetos permanentes

- ❌ Endereço civil PF em `metadata` (blob) como destino final.
- ❌ Location Core paralelo / segundo substrato de endereço.
- ❌ `owner_id` = `global_user_id` ou `profile_id` para a residência PF (é `actor_id`).
- ❌ Confundir `RESIDENCE` com `HQ`/`OPERATIONAL`/`actor_active_location`.
- ❌ Tocar PJ/Companies/CNPJ/company address nesta frente.
- ❌ Tocar CPF/DECISION-0062 ou gender nesta frente.
- ❌ Implementar (código/migration/DML) nesta fatia.

## 13. Superada por

(em aberto — decisão vigente)
