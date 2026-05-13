# Housekeeping HK6 — consolidado pós-Frente 6 (smoke v3 fundacional + sessão noturna)

**Data:** 2026-05-13
**Modo:** memória histórica (housekeeping consolidado pós-bloco noturno)
**Branch:** `rescue-structural`
**HEAD anterior:** `834ee486` (F6 — smoke v3 fundacional)
**HEAD pós-housekeeping:** TBD (este commit)

---

## 1. Origem material

Bloco noturno da sessão 2026-05-13 (continuação de F4/HK3) acumulou 5 commits ao longo de 3 etapas:

| Etapa | Commits |
|---|---|
| **Etapa A — Convergência mecânica** | F5 (`485503e0` — Dashboard wallet totalCents) + HK4 (`cde2d712`) |
| **Etapa B — Registro DT formal** | HK5 (`fb99d32d` — DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO) |
| **Etapa C — Implementação caminho fundacional** | F6 (`834ee486` — smoke v3 + DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION) |

Este HK6 consolida o STATUS_EXECUCAO_GLOBAL.md para refletir os 5 commits do bloco noturno (e implicitamente os 3 do bloco diurno A1/B/F1 + 4 do bloco tarde HK1/F2/HK2/F4 = total sessão: 13 commits).

## 2. O que este housekeeping atualiza

### `STATUS_EXECUCAO_GLOBAL.md` (edits cirúrgicos)

- **Cabeçalho da sessão:** 9 commits / 6 frentes + 3 housekeepings → **13 commits / 7 frentes + 5 housekeepings**
- **Tabela "Pipeline cronológica":** 3 linhas novas (`cde2d712` HK4, `fb99d32d` HK5, `834ee486` F6)
- **Métrica "Total funcional":** 40 arquivos / +1.513/-320 → **44 arquivos / +2.417/-334**
- **Investigações GUARDIÃO desta sessão:** nova subseção citando executei_19 a 22 (executei_21 com nota explícita do erro material #3 reconhecido e corrigido em executei_22)
- **Descoberta material fundacional pós-F5:** novo parágrafo no header descrevendo:
  - Caminho fundacional declarado por DECISION-0031 EXISTE (cadeia events-payment → bank-integration → bank-transaction → bankSplitEngine)
  - 3 erros materiais reconhecidos durante investigação (executei_21 errado, corrigido em executei_22)
  - Smoke v3 fundacional implementado (F6)
- **Resultado consolidado:** 2 bullets novos (F6 smoke v3 + DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION)
- **DTs em estado pós-sessão:** 2 entradas novas (DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO OPEN; DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION OPEN)
- **Investigações read-only:** 3 entradas adicionais (executei_20, _21, _22)
- **Commits + logs institucionais criados:** 3 entradas adicionais (`2026-05-13_housekeeping_institucional_pos_f5.md`, `2026-05-13_housekeeping_dt_q3_e2e_v2_shortcut_epistemico.md`, `2026-05-13_q3_e2e_v3_fundacional.md`)
- **Memória institucional:** anotação adicional sobre refinamento "ver stub ≠ ver feature ausente" (lição do erro #3)

## 3. Erros materiais reconhecidos honestamente nesta sessão (3 total acumulados)

| # | Erro | Onde foi cometido | Onde foi corrigido |
|---|---|---|---|
| 1 | DT-AVAILABILITY-CONVERGENCE-LATENT (taxonomia sem ancoragem) | Sessão anterior (FASE 2) | Próprio commit FASE 2 — DT desfeita com transparência |
| 2 | B/C como "decisões abertas" (norma já decidia implicitamente) | Resposta à IA externa (sessão noturna) | Aceito a refinamento da IA externa; recomendação δ' fundamentada |
| 3 | Caminho fundacional "ausente" baseado em stubs de feature distinta | executei_21 | executei_22 (mesma sessão, antes de implementação) |

**Padrão recorrente identificado:** "construir narrativa antes de ancorar em múltiplos pontos materiais". Refinamento institucional sistematizado em §30 (memória local) e aplicado nas frentes subsequentes.

**Heurística refinada (4 categorias agora):**
1. Drift real (Record<any> mascarando shape canônico) — renomear tipo + corrigir consumers
2. Tipo fiel ao DB — cancelar sem migration (F3 lição)
3. Tipo polimórfico por discriminator — DECISION-like, não rename
4. Money value object pattern — categoria arquitetural, sessão dedicada

**Novo refinamento (acrescido em executei_22):** "ver stub ≠ ver feature ausente — stub pode ser de camada distinta; sempre buscar caminhos alternativos antes de declarar 'não existe'."

## 4. Arquivos NÃO tocados nesta housekeeping (transparência institucional)

- **`code.md`** — refinamento §30 acumulou agora 5 aplicações (4 categorias originais + 1 nova "ver stub ≠ ver feature"). Próxima sessão pode considerar promoção a entrada persistente em memória institucional, mas calibração "menos meta-governança" sugere esperar mais 1-2 validações independentes antes de cristalizar.
- **`REMEDIATION_DT_LOG.md`** — 2 DTs novas já adicionadas em HK5 e F6; sem mudança nesta sessão de housekeeping.
- **`REMEDIATION_DECISIONS_LOG.md`** — sem DECISION nova nesta sessão. DECISION-0035 (formalizando design existente de event-escrow + split engines + reserve funding) pode emergir em sessão futura após validação dinâmica v3.
- **Memória institucional persistente** (`~/.claude/projects/C--unificard/memory/`) — calibração 2026-05-13 + refinamentos §30 ainda em validação. Esta é a 3ª sessão desde calibração; 0-2 sessões adicionais pendentes para estabilização.
- **`docs/01_normative/`** — não toquei norma. Pendência normativa DECISION-0033 permanece humano/RFC (§10 AGENT_PROTOCOL).
- **`q3-e2e-v2.ts`** — ainda existe (apenas header deprecated). Deleção ou conversão a referência histórica fica para após validação dinâmica v3 (próxima sessão).
- **Execução dinâmica do smoke v3** — não executei em backend rodando. DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO permanece OPEN até validação dinâmica.

## 5. Estado final consolidado da sessão 2026-05-13

| Métrica | Valor |
|---|---|
| Total de commits | **13** (7 frentes funcionais + 5 housekeepings + este HK6 = 13) |
| Frentes funcionais fechadas | 7 (A1, B, F1, F2, F4, F5, F6) |
| Frentes canceladas honestamente | 1 (F3 — regional-fund-governance) |
| Pivots meta-frente honestos | 1 (marketplace — investigação prévia revelou escopo arquitetural) |
| Erros materiais reconhecidos + corrigidos | 1 (erro #3 — executei_21 corrigido em executei_22, mesma sessão) |
| Investigações GUARDIÃO read-only | 6 (executei_17 a 22) |
| TSC backend | 0 em todos os checkpoints funcionais |
| TSC frontend | 0 em todos os checkpoints funcionais |
| 4 gates institucionais | 4 PASS em F1/F2/F4; 3 PASS + 1 baseline preservado em F5/F6 |
| DTs CLOSED nesta sessão | DT-TRANSPARENCY-API-CENTS (já contabilizada antes) |
| DTs NOVAS abertas nesta sessão | DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO + DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION |
| DTs PARCIAL/OPEN preservadas | DT-C36-actor-debts + DT-bank-trio + DT-event-reservations + DT-q3-e2e-v2-service-booking |
| Bugs runtime ativos eliminados | 4 (HeaderGlobal F1, Wallet F1+F2, SocialFeed2 widget F4, Dashboard widget F5) |
| Caminho fundacional canônico (DECISION-0031) | **Implementado em script executável (F6)** — validação dinâmica pendente |

## 6. Próxima sessão recomendada

| Opção | Descrição | Urgência |
|---|---|---|
| Validação dinâmica v3 | Executar `npx tsx backend/scripts/q3-e2e-v3-fundacional.ts` em backend rodando + banco virgem; bugs descobertos viram frentes curtas inline; convergência completa de DT-Q3-E2E-V2 | ALTA — fecha falsa solvência |
| Resolver DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION | Fix em `ensurePlatformAccounts` OU refactor em `bankSplitEngine` (auditoria semântica + DECISION arquitetural) | MÉDIA — fundação está mascarada por workaround |
| Implementar escrow event-orientado (camada 2) | Implementar 5 stubs em `escrow.service.ts:312-347` para feature post-event reconciliation (refund/no-show/cancelamento) | BAIXA — apenas quando feature for priorizada |
| Marketplace EIXO 5 do PLANO_CORRECAO_NOMENCLATURA | Abertura formal (autorização explícita Clayton) — escopo arquitetural confirmado | MÉDIA |
| Continuar pipeline convergência mecânica | F7+ em outras `frontend/src/api/*.ts` (fund.ts, identity.ts wallet, etc.) | BAIXA — pipeline estável |

**Recomendação:** validação dinâmica v3 como primeira ação da próxima sessão — é o teste material que ainda falta para fechar a falsa solvência institucional do v2.

## 7. Aderência ao protocolo

- §7 — log institucional criado
- §29 — git add específico (STATUS + este log apenas)
- §25 — pendências preservadas com critérios de convergência explícitos
- §10 — não toquei norma
- Calibração 2026-05-13 — autonomia operacional dentro de fronteiras; auto-vigilância material contra anti-padrões; reconhecimento honesto de erros materiais
- Princípio "menos meta-governança" — housekeeping cirúrgico, não inflar
