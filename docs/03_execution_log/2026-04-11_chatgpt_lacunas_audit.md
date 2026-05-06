# Auditoria — resposta ChatGPT «100% / lacunas» (2026-04-11)

**Norma:** subordinado a `docs/01_normative/`, `PRODUTO_PLANO_MESTRE_COMPLETO.md`, `ORIENTACAO_PRODUTO_EXECUTAR.md`, `C.25_SPEC.md` (regra: sem lista fechada → CI não opina sobre **inferência**).

## O que está **correcto**

| Afirmação ChatGPT | Evidência no repo |
|-------------------|-------------------|
| 2B, 5C, C.17 E2E, gate C.22, §4.10, anti-regressão | Planos + logs `2026-04-10_*`, `2026-04-11_*` |
| **C.25_SPEC** rascunho; allowlist §1 vazia | `docs/02_decisions/C.25_SPEC.md` |
| **C.27** T1–T4 não tinham ficheiro dedicado | Matriz no plano §C.27 |
| **Fase 4** `importProductTemplates` | **Fechado** no código (`rg` → 0 em `backend/**/*.ts`) — `2026-04-09_fase4_legacy_removed.md` |
| **`economic_guardianship.scope`** sem CHECK de domínio | `20260501100000_*` + plano §1B dívida |
| **5A/5B** parcial no plano | Tabelas `[~]` / `[ ]` no plano mestre |
| **EIXO 9** sobretudo documental | Plano EIXO 9 |

## O que convém **corrigir na leitura**

1. **«CI não sabe o que bloquear» (inferência):** por **norma do próprio spec**, o CI **não deve** bloquear inferência vaga até §1–5 fechados. O que está activo é o **gate C.22** (SQL), **separado**. Não é bug — é **governança explícita**.
2. **Percentagens (92–95%, «core 100%»):** métricas subjetivas; **Bloco 3 SQL** passou a **PASS** em 2026-04-12 (`2026-04-12_bloco3_sql_output_after_repair.txt`); manter atenção a tabelas duplicadas com estados por vezes divergentes — risco **documental**, não só de código.
3. **«Sistema pronto para produção»:** não consta como consequência automática do plano; «produção confiável» continua amarrada a vários itens (incl. fechos opcionais e **C.25_SPEC**).
4. **`server.ts` / `server-TESTE.ts`:** o `throw` em `server.ts` (**usar `BOOT.ts`**) é **intencional**; ficheiros `server-TESTE*.ts` são legado/diagnóstico listados em scripts de validação — **não** provam que o entrypoint de produção está indefinido (`BOOT.ts` é o caminho suportado).

## Acções tomadas nesta entrega (repo)

- Testes de integração **C.27** (`canonical-resolution.test.ts`) + script npm.
- Migration **`economic_guardianship`** CHECK em `scope` (valores alinhados ao default actual `'full'` e extensão documentada).
- **`C.25_SPEC`:** secção de estado/limites (sem preencher allowlist fictícia — violaria a regra de ouro do spec).
- **Fase 4:** símbolo `importProductTemplates` removido do `backend/`; trilho suportado `activateLegacyProductTemplatesForStore` — `2026-04-09_fase4_legacy_removed.md`.
- Actualização **C.27** no `PRODUTO_PLANO_MESTRE_COMPLETO.md` / orientação com remissão a este log e ao ficheiro de testes.

## O que **permanece** por decisão humana / RFC

- Preencher **C.25_SPEC** §1–3 e §5 com listas **aprovadas**.
- ~~Remover **callers** de `importProductTemplates` (Fase 4)~~ — **fechado** 2026-04-09 (`2026-04-09_fase4_legacy_removed.md`); manter apenas o contrato HTTP/documentado para legado.
- **C.27** T4 corpo HTTP `reason` em teste de rota (opcional; adapter já coberto em unit + 5C).
- **EIXO 9** runtime (contestação, media, etc.).
