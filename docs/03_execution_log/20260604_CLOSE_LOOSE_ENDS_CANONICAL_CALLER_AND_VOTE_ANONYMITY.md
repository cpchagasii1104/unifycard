# Execution Log — Fecho de pontas soltas (docs-only)

**Data:** 2026-06-04
**Modo:** EXECUTOR DOCS-ONLY CONTROLADO
**Branch:** `rescue-structural`
**HEAD origem:** `b3970a47`
**Origem:** revisão de fim-de-sessão ("cometemos algum erro não-corrigido?")

---

## Objetivo
Fechar duas pontas soltas docs-only identificadas na verificação de fim-de-sessão. **Zero código/schema/runtime/Bank/DML.**

## Ponta 1 — achado de frontend na DT `company-canonical`
- **Problema:** a tentativa de aposentadoria backend-only de `company-canonical` (executada e revertida em 2026-06-04) descobriu um caller de frontend vivo. O achado vivia só no histórico do STATUS, **não na DT**.
- **Evidência:** `frontend/src/pages/CompanyCreationPage.tsx:104` → `POST /api/companies/canonical` (sem fallback); página roteada em `frontend/src/App.tsx:287-288` (`companies/new`, `empresas/nova`, não comentadas).
- **Ação:** anotada `DT-COMPANY-CANONICAL-SERVICE-SCHEMA-DRIFT` com o achado + regra: aposentadoria correta = fatia **front+back atômica** (não backend-only); auditar por **string da URL**, não por símbolo. DT permanece OPEN.

## Ponta 2 — DT própria de anonimato de votação
- **Problema:** `group_votes.is_anonymous` existe (`migration 20260530430000:42`) mas `getVotersByOption` (`votes.repository.ts:314`) nunca a lê → admin veria votantes em votação "anônima". Estava só mencionado de passagem na `DT-GROUPS-VOTES-SCHEMA-DRIFT`.
- **Ação:** criada `DT-GROUPS-VOTES-ANONYMITY-NOT-ENFORCED` (OPEN). É decisão de produto de Clayton + conserto conjunto com a reescrita das votações. Não resolver no código sem a palavra dele.

## Verificação de fim-de-sessão
- `DT-GROUPS-VOTES-SCHEMA-DRIFT` confirmada presente no HEAD (commit `945b5dc6`) — não se perdeu.
- Nenhuma outra ponta solta conhecida pendente.

## Ações realizadas (docs-only)
1. `REMEDIATION_DT_LOG.md` — anotação na `DT-COMPANY-CANONICAL-SERVICE-SCHEMA-DRIFT` + nova `DT-GROUPS-VOTES-ANONYMITY-NOT-ENFORCED`.
2. `STATUS_EXECUCAO_GLOBAL.md` — entrada de status.
3. `opus.md` — memória (cont.67).
4. Este execution log.

## Não-toque (confirmado)
- Zero schema/migration/backend/frontend/DML/Bank.
- 3 autorais intocados.

## Regra final
Registrar o achado no lugar certo (a DT), não só no chat/STATUS.
