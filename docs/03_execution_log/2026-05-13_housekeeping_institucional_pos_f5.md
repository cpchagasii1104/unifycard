# Housekeeping institucional pós-Frente 5 — Dashboard wallet totalCents

**Data:** 2026-05-13
**Modo:** memória histórica
**Tipo:** atualização cirúrgica STATUS_EXECUCAO_GLOBAL + criação executei_19 + transparência sobre o que NÃO foi atualizado
**Branch:** `rescue-structural`
**HEAD anterior:** `485503e0` (Frente 5)
**HEAD pós-housekeeping:** TBD (este commit)

---

## 1. Contexto

Pipeline 2026-05-13 acumulou 9 commits ao longo do dia (3 do bloco matinal A1/B/F1 + HK1; 3 do bloco tarde F2/HK2/F4; 3 do bloco noturno HK3/F5/HK4). Após F5 fechada (`485503e0`), Clayton solicitou ritual de fechamento explícito:

> "Eu quero que você gere o relatório completo do que foi feito, crie lá o arquivo executei na sequência do me passa esse relatório em 1 bloco de notas por aqui e faça a atualização atualização dos arquivos necessários."

Ritual aplicado: criação `executei_19.md` (gitignored), reporte em bloco no chat, atualização cirúrgica STATUS_EXECUCAO_GLOBAL, criação deste log de housekeeping, commit isolado.

## 2. O que este housekeeping atualiza

### `STATUS_EXECUCAO_GLOBAL.md` (cirúrgico, append + ajustes inline)

- Cabeçalho da sessão 2026-05-13: 7 commits/5 frentes → **9 commits/6 frentes + 3 housekeepings**
- Tabela "Pipeline cronológica": adicionadas linhas `be3838ab` (HK3) e `485503e0` (F5)
- Métrica "Total funcional": 37 arquivos / +1.290/-316 → **40 arquivos / +1.513/-320**
- "Resultado consolidado": bullet novo sobre F5 + pivot meta-frente honesto marketplace
- "Calibração operacional validada na prática": de "3 aplicações + 1 pivot honesto" → **4 frentes funcionais + 1 pivot frente + 1 pivot meta-frente**; sessão sobre F5 + meta-frente marketplace
- "Anti-padrões fechados nesta sessão": 3 novos bullets (Dashboard.tsx totalIn/totalOut + bug 100x widget Minha Carteira + `Record<string, any>` em payload API mascarando drift)
- "Anti-padrões evitados nesta sessão": 3 novos bullets (execução cega marketplace; identity wallet como frente conjunta; limpeza dead code Fundo Regional Dashboard)
- "Pendências preservadas": **expandida com perímetro material descoberto durante GUARDIÃO/varredura F5**
  - marketplace: agora explícito = categoria EIXO 5 do `PLANO_CORRECAO_NOMENCLATURA` com pré-requisito EIXO 2 (~11%) + `MoneyAmountCents` canônico
  - identity wallet drift institucional: mapeado, 0 consumers reais
  - fund.ts ambiguidades: caso a caso (splitBreakdown, percentages, growth)
  - subscriptions.ts: descartado por Money value object
  - loyalty.ts: descartado por polimorfia DISCOUNT_FIXED vs DISCOUNT_PERCENT
  - dead code Fundo Regional Dashboard.tsx L423-450
- "Investigações read-only": adicionado `executei_19.md`
- "Commits + logs institucionais criados": adicionado `2026-05-13_dt_dashboard_wallet_totalCents_convergence.md`

## 3. Arquivos NÃO tocados nesta housekeeping (transparência institucional)

- **`code.md`** — princípio §30 reaplicado pela quarta vez nesta sessão, agora com refinamento sistemático em 4 categorias materiais (drift real / tipo fiel ao DB / tipo polimórfico discriminator / Money value object pattern). Ainda em validação — não inflar §30 com nova taxonomia até 5-6 aplicações independentes (princípio "menos meta-governança" da calibração 2026-05-13).
- **`REMEDIATION_DT_LOG.md`** — F5 fechou drift `_cents` em `api/dashboard.ts` + `Dashboard.tsx` sem entrada DT formal nova. Drift era análogo a DT-WALLET-CONSUMERS-CENTS-MIGRATION (encerrada em `11f028d9`) — mesma categoria de convergência mecânica focada em bug runtime visível, sem necessidade de DT separada antes. Dívida adjacente "identity wallet drift institucional" registrada apenas neste STATUS por enquanto (sem consumer ativo, criar DT formal seria over-engineering).
- **`REMEDIATION_DECISIONS_LOG.md`** — sem DECISION nova (F5 foi aplicação direta de §4.7 + tipagem canônica espelhando backend, sem decisão arquitetural inédita; abertura formal de EIXO 5 do PLANO para marketplace fica para sessão dedicada quando autorizada).
- **Memória institucional persistente** (`~/.claude/projects/C--unificard/memory/`) — refinamento §30 em validação por 4 aplicações, ainda não promovido a entrada formal. Calibração 2026-05-13 segue em validação por 3-5 sessões conforme `feedback_autonomia_operacional.md` (esta sessão é a 2ª desde calibração; 1-3 ainda pendentes para estabilização).
- **`docs/01_normative/`** — não toquei norma. Pendência normativa DECISION-0033 (07_NOMENCLATURA §3.2 + SSOT_REGISTRY `canonical_product_type`) permanece humano/RFC conforme §10 AGENT_PROTOCOL.
- **Backend** — F5 é frontend-only. Backend `dashboard.types.ts` + `dashboard.service.ts` já canônicos §4.7 (apenas verificados via Read durante investigação prévia).

## 4. Aderência ao protocolo

- Modo declarado (memória histórica / housekeeping)
- §7 — log institucional criado
- §29 — git add específico (apenas STATUS + este log + executei_19 NÃO entra em commit por estar gitignored)
- §25 — pendências adjacentes registradas com critério de convergência explícito ou semente para sessão futura
- §10 — não toquei norma
- Transparência institucional sobre o que NÃO foi atualizado (4 arquivos explicitamente justificados)
- Calibração 2026-05-13 — "menos meta-governança" honrada (não promovido refinamento §30 a entrada persistente; não criada DT formal sem consumer ativo)

## 5. Estado final consolidado da sessão 2026-05-13

- **9 commits totais** (6 frentes funcionais A1/B/F1/F2/F4/F5 + 3 housekeepings HK1/HK2/HK3 + este HK4)
- **Frente 3 cancelada honestamente** (regional-fund-governance — pivot frente)
- **Pivot meta-frente honesto** (marketplace — categoria muda, sessão dedicada)
- **TSC = 0** em todos os checkpoints funcionais
- **4/4 gates institucionais PASS** em F1/F2/F4
- **3 PASS + 1 baseline preservado** em F5 (architectural backend-only)
- **40 arquivos modificados** | +1.513/-320 linhas | sem retrocessos
- **Bug runtime ativo eliminado em 4 entrypoints universais:** HeaderGlobal (F1), Dashboard "Minha Carteira" (F5), SocialFeed2 widget (F4) — todos do padrão "sempre zero" / "valor 100x"
- **Calibração 2026-05-13** validada em 6 contextos materialmente distintos
- **Heurística §30 refinada** em 4 categorias materiais sistematizadas
- **3 DTs status PASS:** DT-TRANSPARENCY (CLOSED F1+F2), dívida adjacente DT-TRANSPARENCY summary (CLOSED F2), dívida F5 (CLOSED 485503e0 sem DT formal)
- **Próxima sessão abre com:** rescue-structural HEAD = TBD (housekeeping desta etapa), pipeline pronta para próxima frente conforme escolha de Clayton (identity wallet conjunta backend+frontend / fund.ts investigação prévia GUARDIÃO / marketplace EIXO 5 formal / outras)
