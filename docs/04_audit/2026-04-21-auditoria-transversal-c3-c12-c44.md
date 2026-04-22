# AUDITORIA TRANSVERSAL — C3 + C12 + C44 — 2026-04-21

## Metadados
- Data: 2026-04-21
- Modo: GUARDIÃO (Cursor Ask)
- Solicitante: Clayton via Claude
- Escopo: violações FASE 4 candidatas a fix

## Método
Busca estruturada em backend/src para cada violação, sem editar código.

## Resultados

### C3 — INSERT actors fora do writer
- Resultado: 2 caminhos ativos identificados
  - backend/src/core/actors/actor.helpers.ts (getActiveActor)
  - backend/src/modules/social/actor.utils.ts (resolveActiveActorFromRequest
    com allowUserFallback=true)
- Consumidores: 9 rotas em 7 módulos
- STATUS inicial descrevia "3 INSERTs" — descrição não correspondia à realidade

### C12 — actorId retornado como globalUserId
- Resultado: 4 violações REAIS em response HTTP
  - identity.routes.ts wallet (L797-804)
  - identity.routes.ts ledger (L879-883)
  - cultural.routes.ts check-in (L498-515)
  - store-onboarding.routes.ts storeId condicional (L173-186)
- Padrões adjacentes (NÃO são C12 response HTTP): 5 locais em groups, events, organizers
- Reporting routes: persistência em report_events, não response HTTP

### C44 — marketplace/group.repository.ts colunas inexistentes
- Resultado: arquivo existe, 3 colunas fantasmas identificadas
  - parent_group_id (não existe)
  - created_by_actor_id (não existe)
  - created_by_user_id (não existe)
- Schema real: id, tenant_id, name, description, slug, actor_id, owner_actor_id,
  status, metadata, created_at, updated_at

## Decisões geradas pela auditoria
- DECISION-0008 (C3): substituição direta por ensureUserActor, C3-B para FASE 6
- DECISION-0009 (C12): escopo reduzido a identity.routes, C50/C51 criadas
- C44: fix direto em sessão futura, sem decisão pendente (schema Gênesis já canônico)

## Impacto metodológico
Auditoria transversal antes de fix cirúrgico revelou-se padrão eficaz:
- Evita retrabalho
- Reclassifica violações com descrição imprecisa
- Gera DECISIONs com base empírica em vez de suposição
