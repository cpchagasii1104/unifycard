# FALSIFICATION_LOG (normativo)

Registo **append-only** de violações ou testes de falsificação com impacto em normas.

**SSOT forense completo (template + histórico):** `docs/ssot/FALSIFICATION_LOG.md`

---

## Entradas espelhadas (índice)

| Data | Âmbito | Norma | Resumo | Estado |
|------|--------|-------|--------|--------|
| 2026-04-17 | `backend/src` (múltiplos módulos) | §4.8.1 `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD` | Chamadas directas a `actorRepository.findOrCreateUserActor` / `findOrCreatePageActor` em código de produto (22 ficheiros / 44 ocorrências), contornando `actor-writer.service`. Corrigido via `PLANO_ACTOR_WRITER_ENFORCEMENT.md` (Sessões 2 e 3). CI guard (`validate:actor-writer-boundaries`) para prevenir regressão. | **RESOLVIDO** |

Detalhe forense: **Entrada #4** em `docs/ssot/FALSIFICATION_LOG.md`.
