# DT-GATE-ARCHITECTURAL-BASELINE-VIOLATIONS — Violações arquiteturais pré-existentes reveladas pelo gate

**Data:** 2026-05-30
**Branch:** `rescue-structural`
**Escopo:** READ-ONLY sobre as violações. Runner corrigido em `package.json` (microfrente F-GATE-ARCHITECTURAL-TYPESCRIPT-RUNNER).

---

## Contexto

O gate `validate:architectural` estava cego por configuração: o script `package.json` apontava `node scripts/validate-architectural-rules.ts`, mas `node` não executa `.ts`. O gate falhava com `ERR_UNKNOWN_FILE_EXTENSION` antes de rodar qualquer validação.

Durante a 3C.3 (Etapas 1–3), a rede de segurança operou com **3 gates de fato, não 4**. Isso foi provado antes do commit `1834337d` ao reproduzir a falha em `b62bdab4`.

A microfrente F-GATE-ARCHITECTURAL-TYPESCRIPT-RUNNER corrigiu o runner (`node` → `tsx`, dependência já existente `^4.21.0`), e ao rodar o gate consertado pela primeira vez, **20 violações pré-existentes foram reveladas**.

## Confirmação de pré-existência

As violações referem-se a `user_skills_categories` / profile — código **não tocado pela 3C.3**. A 3C.3 tocou exclusivamente:
- `backend/src/modules/groups/groups.repository.ts` (Etapas 2 e 3)
- `backend/src/core/actors/actor-writer.service.ts`, `actor-repository.port.ts`, `actor-repository.adapter.ts`, `actor.repository.ts` (Etapa 2)
- Migrations de integridade do group-actor (Etapa 1)

Nenhum arquivo apontado nas violações pertence ao escopo da 3C.3.

## Violações reveladas

**Total: 20** (19 críticas + 1 estrutural)

### 🔴 CRITICAL (19) — REGRA 3: Categorias no perfil sem evento versionado associado

| Arquivo | Linha |
|---------|-------|
| `src/core/categories/categories.service.ts` | 1235 |
| `src/core/categories/categories.service.ts` | 1242 |
| `src/core/profile/category-navigation-bridge.ts` | 4 |
| `src/core/profile/category-navigation-bridge.ts` | 6 |
| `src/core/profile/category-navigation-bridge.ts` | 18 |
| `src/core/profile/category-navigation-bridge.ts` | 38 |
| `src/core/profile/category-navigation-bridge.ts` | 243 |
| `src/core/profile/profile-learning.service.ts` | 56 |
| `src/core/profile/profile-physical.service.ts` | 54 |
| `src/core/profile/profile-professional.service.ts` | 68 |
| `src/core/profile/profile-professional.service.ts` | 132 |
| `src/core/profile/profile-professional.service.ts` | 257 |
| `src/core/profile/profile-professional.service.ts` | 316 |
| `src/modules/human-mvp/human-mvp-matching.service.ts` | 61 |
| `src/modules/human-mvp/human-mvp-matching.service.ts` | 67 |
| `src/modules/human-mvp/human-mvp-service-offer.service.ts` | 45 |
| `src/modules/human-mvp/human-mvp-skill.service.ts` | 75 |
| `src/modules/human-mvp/human-mvp-skill.service.ts` | 78 |
| `src/core/profile/profile.routes.ts` | 80 |

### ⚠️ STRUCTURAL (1) — REGRA 4: Dados do perfil influenciando comportamento

| Arquivo | Linha |
|---------|-------|
| `src/core/profile/profile.routes.ts` | 80 |

Padrão: todas referências a `user_skills_categories` sem evento versionado associado, ou uso de perfil em decisões. Violação do `USER_PROFILE_CONTRACT`.

## Decisão desta microfrente

**NÃO corrigir as violações nesta microfrente.** Escopo é apenas o runner.

O gate passa a ser visível e verdadeiro. Um gate que grita sobre dívida real é mais seguro que um gate cego que passa silenciosamente. As violações entram como baseline classificado — dívida conhecida, não surpresa futura.

## Próximo passo (fora do escopo desta DT)

Antes de fechar a Etapa 4 da 3C.3, Clayton/Opus/ChatGPT decidirão:

- **(a)** Corrigir as 20 violações em fatia própria antes da Etapa 4; ou
- **(b)** Aceitar o baseline documentado e seguir com Etapa 4 sabendo que `validate:architectural` está visível mas vermelho por dívida antiga.

Enquanto isso, `validate:architectural` é classificado como: **rodando, revelando baseline pré-existente registrado nesta DT**.
