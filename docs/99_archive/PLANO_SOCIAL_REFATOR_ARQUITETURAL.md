# PLANO_SOCIAL_REFATOR_ARQUITETURAL.md

Sistema: UnifiCard Backend - dominio social (TIER 3)
Molde normativo: PLANO_BASE_MODULO.md
Data: 2026-04-19
Modo: FASE S completada + migrations genesis

## §A - Estado atual do plano

| Campo | Valor |
|---|---|
| Modulo | modules/social + tabelas correlatas de reputacao/impacto |
| Status global | **PASS — ENCERRADO** |
| Fase atual | ENCERRADO — migrations genesis criadas (4 migrations social + impact, 8 tabelas) |
| Proxima acao | Rides + Social acoplarem ao core (identity, bank, actors) |
| Bloqueios ativos | Nenhum — social-ledger BLOQUEADO (defensivo, DERIVA_FINANCEIRA_BLOQUEADA) |
| Ultima execucao | 2026-04-19 (UTC atual) |
| Proposta | Social score (impact_ledger) é reputação, não ledger financeiro |

## EXECUTION LOG

| Data (UTC) | Tipo | Detalhe |
|---|---|---|
| 2026-04-19 | FASE S | Zero tabelas social no banco. Código existe (55 .ts files). social-ledger.ts BLOQUEADO com DERIVA_FINANCEIRA_BLOQUEADA. impact_ledger/impact_balances são score, não monetário. FASE S: OK (schema a criar). |
| 2026-04-19 | MIGRATIONS | 4 migrations social criadas (20260530300000-20260530340000): social_posts, social_follows, social_reactions, social_comments, social_impact. 8 tabelas criadas. |
| 2026-04-19 | GATES | actor-writer OK, bank-ledger OK, regression-guards OK. Integridade validada. |
| 2026-04-19 | PASS | Social encerrado PASS. Gates OK. posts/follows/reactions → actors (identidade). impact_ledger/actor_reputation → score de participação (não monetário). |

## Acoplamento ao core

### Identity
- `posts.actor_id` → `actors(id)` ✓
- `follows.follower_actor_id` → `actors(id)` ✓
- `follows.followed_actor_id` → `actors(id)` ✓
- `reactions.actor_id` → `actors(id)` ✓
- `comments.actor_id` → `actors(id)` ✓
- `impact_ledger.actor_id` → `actors(id)` ✓
- `actor_reputation.actor_id` → `actors(id)` ✓
- `ensureUserActor` pattern: canônico em social-2.0.routes.ts ✓

### Bank (não aplicável)
- Social não escreve em bank_* ✓
- social-ledger BLOQUEADO (fonte futura: bank_*) ✓

### Actors
- Acoplamento direto via actor_id ✓
- Reputação (actor_reputation) ligada a ator ✓

## Gates validados

✅ **actor-writer [4.8.1]** — Escritores dentro de limites defini  
✅ **bank-ledger [4.6]** — Social não escreve em banco  
✅ **regression-guards** — Integridade de migrations OK (241 total)

---

**Status final:** PASS — Pronto para acoplamento ao core
