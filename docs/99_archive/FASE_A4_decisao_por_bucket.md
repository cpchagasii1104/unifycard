# FASE A.4 — Decisão por Bucket

**Data:** 2026-05-05
**Snapshot base:** 2026-05-05 14:55:39 (1549 itens)
**Branch:** `rescue-structural`
**Commit atual:** `b29fc6a3`
**Modo:** Janela de decisão humana. Nenhuma execução nesta fase.

**Princípio:** agrupar por natureza, não por conveniência. Cada commit tem unidade temática real.

**Estado da sessão:**
- ✅ A.0, A.1 fechadas
- ✅ A.2 (1549 itens em 18 buckets)
- ✅ A.3 (13 deletados normativos = todos confirmar delete)
- ✅ A6 (docs/ssot/ — 2 deletados consolidados em 01_normative/)
- ⏳ **A.4 (este documento)** — decisão por bucket
- ⏸ A.5 execução (depende desta aprovação)
- ⏸ A.6 stashes + workflows
- ⏸ A.7 STATUS final

---

## SUMÁRIO EXECUTIVO

### Commits propostos: **8 commits cirúrgicos**

| # | Commit temático | Buckets envolvidos | ~Arquivos |
|---|---|---|---|
| 1 | Deletes seguros (lixo de editor + timestamps + placeholders) | 13 deleteds normativos + B10i seleção | ~25 |
| 2 | Consolidação docs/ssot/ → docs/01_normative/ | 2 deleteds + 10 modificados ssot/ | 12 |
| 3 | Reorganização normativa: nova série + atualização canônicos | 96 modificados + 44 untracked normativos | ~140 |
| 4 | Auditorias e logs de execução | docs/04_audit + docs/03_execution_log seleção | ~80 |
| 5 | Arquivar histórico (docs/99_archive + migrations-resetadas) | docs/99_archive + backend/migrations-resetadas | ~26 |
| 6 | Novos scripts e validators | scripts/ untracked + B10b seleção | ~30 |
| 7 | Restaurar regra Cursor obrigatória | backend/.cursor/rules/ | 1 |
| 8 | Plano de sessão e dumps canônicos | B9 (4 dumps + 2 planos) | 6 |

### Buckets BLOQUEADOS (não executados nesta sessão):
- B4 (`backend/src/*` modified, 545 arquivos) — Regra #1
- B7 (`backend/package.json`) — Regra #3 (DT-build-alias)
- B10c (backend tests) — depende de B4
- B10d (configs build/test) — bloqueado por DT-build-alias
- B10h (lockfiles) — congelado junto com B7
- C (`frontend/src/*`, 44 arquivos) — Regra B4 estendida

### Buckets para A.4 estendida (decisão humana adicional necessária):
- B10e (seeds, 10) — investigar caso a caso
- B10f (backend/scripts, 12) — caso a caso
- B10b (268 migrations untracked) — investigação obrigatória antes de decidir
- A1 (docs/03_execution_log, 163) — separar legítimos de exploração

---

## TIPO 1 — LIXO CONFIRMADO (commits 1, 2)

### COMMIT 1 — Deletes seguros: backups, timestamps e placeholders

**Ação proposta:** `DELETE (commit)`
**Risco:** zero (todos com substituto vivo confirmado em A.3)

**Arquivos (lista explícita):**

10 `.bak` em docs/01_normative/:
- `AGENDA_UNIVERSAL_CONTRACT.md.bak`
- `CONTRACTS.md.bak`
- `CORE_APROVACAO_FINANCEIRA_CANONICO.md.bak`
- `CORE_ESTORNOS_FINANCEIROS_CANONICO.md.bak`
- `CORE_EXECUTAVEL_VS_CORE_CONCEITUAL.md.bak`
- `CORE_PERMISSOES_FINANCEIRAS_CANONICO.md.bak`
- `CORE_SPLIT_PAGAMENTO_CANONICO.md.bak`
- `CORE_TEMPORAL_CONTRACT.md.bak`
- `CORE_TEMPORAL_HARDENING_CONTRACT.md.bak`
- `CORE_VS_MODULOS_CONTRACT.md.bak`

2 com timestamp em docs/01_normative/ (canônicos vivos preservados):
- `MAPA_CANONICO_PERMISSIONS_v1_20260122-073046.md`
- `USER_PROFILE_CONTRACT_20260122-071728.md`

1 placeholder vazio:
- `LEIA_ANTES_DE_TOMAR_DECISAO.md` (0 bytes, nunca utilizado)

**Justificativa:**
- 10 `.bak`: backups de editor (auto-save). Originais existem como modified ou untracked.
- 2 timestamped: renomeação consolidada. Versões sem timestamp (`MAPA_CANONICO_PERMISSIONS_v1.md`, `USER_PROFILE_CONTRACT.md`) estão vivas em working tree.
- 1 placeholder: 0 bytes, adicionado em `c4c45ec7` e nunca preenchido. Substituído pelos índices estruturados (`00_INDEX.md`, `00_SUMARIO.md`) que estão untracked.

**Mensagem de commit:**
```
docs(normative): remove 13 arquivos obsoletos

- 10 backups de editor (.bak) com canonicos vivos preservados
- 2 versoes com timestamp consolidadas em arquivos sem timestamp
- 1 placeholder vazio (LEIA_ANTES_DE_TOMAR_DECISAO.md, 0 bytes)

Canonicos vivos preservados:
- MAPA_CANONICO_PERMISSIONS_v1.md (modified)
- USER_PROFILE_CONTRACT.md (modified)
- Substitutos estruturados: 00_INDEX.md, 00_SUMARIO.md (entram em commit 3)

Sem referencias rastreadas aos arquivos deletados.
```

---

### COMMIT 2 — Consolidação docs/ssot/ → docs/01_normative/

**Ação proposta:** `DELETE (commit) + COMMIT modificados`
**Risco:** zero (substitutos confirmados em A6, 0 referências rastreadas)

**Arquivos:**

2 deleteds em docs/ssot/:
- `docs/ssot/PROHIBITED_STRUCTURES.md` (210 linhas, substituto: `docs/01_normative/PROHIBITED_STRUCTURES.md`)
- `docs/ssot/SSOT_REGISTRY.md` (289 linhas, substituto: `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`)

10 modificados em docs/ssot/:
- `AUTHORITY_PRECEDENCE.md` (+22)
- `AUTHORITY_RECOVERY.md` (+20)
- `FALSIFICATION_LOG.md` (+109)
- `GATES.md` (+56)
- `GATE_2_BLOCKERS.md` (+22)
- `GATE_2_CHECKS.md` (+21)
- `GATE_3_EXECUTION.md` (+26)
- `GATE_3_REVIEW.md` (+26)
- `IMPACT_MATRIX.md` (+19)
- `WRITE_SURFACE_BASELINE.md` (+27)

**Justificativa:**
- Os 2 deletados se autodeclaravam não-norma e apontavam para `docs/01_normative/` como autoritativo
- Substitutos `PROHIBITED_STRUCTURES.md` (7.163 bytes) e `SSOT_REGISTRY_UNIFICARD.md` (21.811 bytes) existem em `docs/01_normative/`, modificados em 2026-04-30
- 0 referências em arquivos rastreados; 4 referências apenas em arquivados (que serão removidos manualmente por Clayton)
- Os 10 modificados são avanço de gates e autoridade — trabalho legítimo de governança pendurado

**Mensagem de commit:**
```
docs(ssot): consolida governanca em docs/01_normative/ + atualiza gates

- Remove 2 documentos consolidados:
  * docs/ssot/PROHIBITED_STRUCTURES.md (substituto: docs/01_normative/PROHIBITED_STRUCTURES.md)
  * docs/ssot/SSOT_REGISTRY.md (substituto: docs/01_normative/SSOT_REGISTRY_UNIFICARD.md)
  Ambos se autodeclaravam nao-norma e apontavam para docs/01_normative/ como autoridade.

- Atualiza 10 documentos de governanca de gates:
  * AUTHORITY_PRECEDENCE/RECOVERY (+42 linhas)
  * FALSIFICATION_LOG (+109 linhas)
  * GATES + GATE_2_* + GATE_3_* (+150 linhas)
  * IMPACT_MATRIX, WRITE_SURFACE_BASELINE (+46 linhas)

Sem referencias rastreadas aos paths deletados (4 ocorrencias em
arquivados serao removidas manualmente).
```

---

## TIPO 2 — CANÔNICO VIVO MODIFICADO (commits 3, 4)

### COMMIT 3 — Reorganização normativa: nova série + atualização canônicos

**Ação proposta:** `COMMIT (escopo amplo, mas tematicamente unitário)`
**Risco:** baixo (trabalho de governança documental sistemático)

**Subdivisão interna:**

**3.1 — 96 modificados em `docs/01_normative/` + `docs/02_decisions/`**

Inclui:
- Série numerada `00_AGENT_PROTOCOL.md` + `01_SSOT.md → 17_EFFECTS_CANONICA.md` + `99_GLOSSARIO_CANONICO.md`
- `AGENDA_UNIVERSAL_CONTRACT.md`
- `AUTHORITY_LAW.md` + 3 `AUTHORITY_ANNEX_*`
- `CATEGORY_TREE_*` (3 arquivos)
- + outros normativos canônicos atualizados

**3.2 — 44 untracked em `docs/01_normative/` + `docs/02_decisions/`**

Novos índices:
- `00_AGENT.md`
- `00_INDEX.md` (substituto institucional dos timestamped deletados)
- `00_SUMARIO.md`

Continuação da série:
- `18_DOMAIN_ONTOLOGY_UNIFICARD.md`
- `19_N1_NAVIGATION_STRUCTURE_UNIFICARD.md`
- `20_N2_NAVIGATION_STRUCTURE_UNIFICARD.md`
- `22_RFC_N1_PESSOAS_E_IDENTIDADES.md`

Novos contratos/decisões:
- `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`
- `BANK_DOMAIN_RULES.md`
- `IDENTITY_SSOT_PRECEDENCE.md`
- `VOCABULARIO_CANONICO_UNIFICARD.md`
- + outros

**Justificativa:**
- Padrão claro: reorganização documental sistemática que ficou pendurada de sessões anteriores
- Os untracked completam a série numerada (até 22) e introduzem leis/contratos faltantes
- A própria existência de `00_INDEX.md` e `00_SUMARIO.md` substitui o placeholder vazio que foi deletado em commit 1

**Mensagem de commit:**
```
docs(normative): consolida reorganizacao da serie canonica + novos contratos

Atualiza 96 normativos vigentes:
- Serie 00_AGENT_PROTOCOL + 01-17 SSOT/Authority/Effects + 99_GLOSSARIO
- AGENDA_UNIVERSAL_CONTRACT, AUTHORITY_LAW + anexos
- CATEGORY_TREE + outros canonicos

Adiciona 44 novos:
- Indices estruturados: 00_AGENT, 00_INDEX, 00_SUMARIO
- Continuacao da serie: 18_DOMAIN_ONTOLOGY, 19/20_N1_N2_NAVIGATION,
  22_RFC_N1_PESSOAS_E_IDENTIDADES
- Leis e contratos: LEI_DE_COERENCIA_SISTEMICA, BANK_DOMAIN_RULES,
  IDENTITY_SSOT_PRECEDENCE, VOCABULARIO_CANONICO

Trabalho de governanca documental pendurado de sessoes anteriores.
Nenhuma alteracao de codigo de producao envolvida.
```

⚠️ **DECISÃO REQUERIDA:** este é o commit mais amplo. Alternativas:
- (a) Commit único conforme proposto (140 arquivos, 1 commit)
- (b) Quebrar em 3.1 (modificados) e 3.2 (untracked) — 2 commits
- (c) Quebrar ainda mais: por subdiretório

Minha recomendação: **(b) — 2 commits** (3.1 modificados, 3.2 novos). Modificar canônico tem peso institucional diferente de adicionar novo. Separar permite revert isolado se algum dos 96 modificados se revelar problemático.

---

### COMMIT 4 — Auditorias e logs de execução

**Ação proposta:** `COMMIT (com curadoria interna)`
**Risco:** baixo (auditorias e logs são registro institucional)

**Arquivos:**

A4 — `docs/04_audit/` (11 arquivos):
- `AUDITORIA_ARQUITETURAL_BACKEND_SRC_2026-05-04.md`
- `ADERENCIA_FINANCIAL_CHAOS_SUITE.md`
- + outros 9 audits

A1 parcial — `docs/03_execution_log/` (163 arquivos):
- ⚠️ **Subdivisão necessária dentro deste commit**

**Decisão sobre A1 (163 logs de execução):**

Por padrão, **logs de sessão registrados** vão a commit. Mas há 163 itens — provável que alguns sejam exploração/teste.

**Critério proposto:**
- Logs com nomenclatura datada e título descritivo (`2026-04-21-fase4-c1-c3-c4.md`) → COMMIT
- Logs com nome `_TEMPLATE.md`, `_TEST_*.md`, ou rascunho → manter untracked ou descartar
- Modified vs untracked: ambos vão a commit se passarem critério

**Sub-prompt necessário (read-only) para Codex antes de fechar este commit:**

```powershell
# Listar A1 separando datados de não-datados
Write-Host "=== docs/03_execution_log/ — DATADOS (provavel commit) ==="
git --no-pager status --short | Select-String 'docs/03_execution_log/' |
  Where-Object { $_ -match '\d{4}-\d{2}-\d{2}' } |
  Measure-Object -Line | Select-Object -ExpandProperty Lines

Write-Host "`n=== docs/03_execution_log/ — NÃO-DATADOS (revisar) ==="
git --no-pager status --short | Select-String 'docs/03_execution_log/' |
  Where-Object { $_ -notmatch '\d{4}-\d{2}-\d{2}' }
```

**Mensagem de commit (após curadoria de A1):**
```
docs(audit+logs): consolida auditorias e logs de execucao

- 11 auditorias em docs/04_audit/
  * AUDITORIA_ARQUITETURAL_BACKEND_SRC_2026-05-04
  * ADERENCIA_FINANCIAL_CHAOS_SUITE
  * + outras

- N logs datados em docs/03_execution_log/
  * Sessoes registradas com data e fase
  * Templates e drafts mantidos untracked

Registro institucional de trabalho realizado nas ultimas sessoes.
```

---

## TIPO 3 — ARTEFATO NOVO (commits 5, 6, 7, 8)

### COMMIT 5 — Arquivar histórico

**Ação proposta:** `COMMIT (move para archive)`
**Risco:** baixo (preservação explícita)

**Arquivos:**

A2 — `docs/99_archive/` (16 arquivos untracked):
- `2026-04-24_RFC_C52_OBSOLETO_DECISION_PENDING.md`
- + outros 15

`backend/migrations-resetadas/` (10 arquivos untracked):
- `.gitkeep`
- `0001_extensions.sql` → `0008_payment_intent_trace.sql`
- `desktop.ini` (lixo Windows — **excluir do commit**)

**Justificativa:**
- `docs/99_archive/`: preservar RFCs obsoletos, decisões pendentes históricas
- `migrations-resetadas/`: snapshot das migrations consolidadas pré-genesis (10 arquivos numerados 0001-0008)
- `desktop.ini`: lixo Windows, não commitar

**Decisão sobre `migrations-resetadas/`:**

Duas opções:
- (a) Commitar onde está (`backend/migrations-resetadas/`) com nota de archive
- (b) Mover para `docs/99_archive/migrations-pre-genesis/` antes de commitar

**Recomendação: (a) — commitar onde está.** Mover é trabalho de mais para benefício pequeno. Mensagem de commit já deixa explícito que é archive.

**Mensagem de commit:**
```
docs(archive): preserva historicos e snapshot de migrations pre-genesis

- 16 arquivos em docs/99_archive/
  * RFCs obsoletos, decisoes pendentes historicas

- 10 arquivos em backend/migrations-resetadas/
  * Snapshot consolidado pre-genesis (0001_extensions ate 0008_payment_intent_trace)
  * NAO eh runtime atual (migrations vivas estao em backend/migrations/)
  * Preservado como referencia historica

Excluido: desktop.ini (lixo Windows).
```

---

### COMMIT 6 — Novos scripts e validators

**Ação proposta:** `COMMIT (após inspeção rápida)`
**Risco:** baixo a médio (scripts novos podem afetar fluxo se nomeados como gates ativos)

**Arquivos:**

D — `scripts/` raiz (32 itens, mistura M e ??):
- `architectural-patterns-baseline.json` (M) → ⚠️ **EXCLUIR deste commit** (baseline do gate, mexer aqui afeta validate-architectural-patterns)
- `append-architectural-metrics.mjs` (??)
- `check-frontend-no-direct-fetch.mjs` (??)
- `detect-marketplace-*.js` (??)
- `docs-*.mjs` (??)
- `execution-guard/` (?? — diretório novo)
- `validate-*.mjs` (?? — possíveis novos gates)

**Justificativa:**
- Novos scripts são trabalho legítimo de instrumentação
- `architectural-patterns-baseline.json` modificado é congelado (mexer afeta gate ativo) — fica para sessão dedicada
- `execution-guard/` é diretório novo, parece infraestrutura de validação

**Sub-prompt necessário (read-only) antes de fechar este commit:**

```powershell
# Inspecionar headers dos scripts untracked para confirmar coerência
Get-ChildItem -Path C:\unificard\scripts -File -Recurse |
  Where-Object { $_.FullName -notmatch 'baseline\.json' } |
  ForEach-Object {
    Write-Host "`n--- $($_.Name) ---"
    Get-Content $_.FullName -Head 5
  }
```

**Mensagem de commit (após inspeção):**
```
chore(scripts): adiciona novos validators e scripts de auditoria

Novos scripts em scripts/:
- append-architectural-metrics.mjs
- check-frontend-no-direct-fetch.mjs
- detect-marketplace-*.js
- docs-*.mjs
- validate-*.mjs (novos gates de validacao)
- execution-guard/ (diretorio novo)

NAO inclui scripts/architectural-patterns-baseline.json (modificado, congelado
por afetar gate ativo validate-architectural-patterns; sessao dedicada).
```

---

### COMMIT 7 — Restaurar regra Cursor obrigatória

**Ação proposta:** `RESTORE (git restore)`
**Risco:** baixo (restauração de regra com referência viva)

**Arquivos:**
- `backend/.cursor/rules/00_NORMATIVE_MANDATORY.md` (D)

**Justificativa:**
- Adicionada em `a2a4cbe6 (2026-02-19) feat: adiciona regra obrigatória de consulta à documentação normativa`
- Referência viva em `PLANO_MARKETPLACE_REFATOR_ARQUITETURAL.md:369`
- Deletada sem rastro de commit que justificasse a remoção

**Procedimento:**
```
git restore backend/.cursor/rules/00_NORMATIVE_MANDATORY.md
git add backend/.cursor/rules/00_NORMATIVE_MANDATORY.md
git commit -m "..."
```

⚠️ **Por que restore + add + commit em vez de só restore:** restore só puxa do HEAD. Como o working tree já estava dessincronizado, é melhor explicitar com commit para deixar rastro do que rolou.

Alternativa: só `git restore` (volta para HEAD, sem commit) — mas aí a restauração não fica auditada na história.

**Decisão recomendada:** apenas `git restore` (sem commit). Razão: o arquivo está em HEAD, restore só remove o `D` do status. Não adiciona novo commit poluindo timeline.

```
git restore backend/.cursor/rules/00_NORMATIVE_MANDATORY.md
```

(Sem commit — `git restore` reverte working tree ao HEAD, gates não precisam revalidar.)

---

### COMMIT 8 — Plano de sessão e dumps canônicos

**Ação proposta:** `COMMIT (artefatos da própria sessão)`
**Risco:** zero (são os documentos desta sessão)

**Arquivos:**

B9 — 6 untracked:
- `SRC_FULL.txt`
- `MIGRATIONS_FULL.txt`
- `01_NORMATIVE_FULL.txt`
- `SSOT_FULL.txt`
- `PLANO_SESSAO_2026-05-05_working-tree_v4.md`
- `PLANO_MESTRE_remediacao_core_modules.md`

**Decisão:**

Os 4 dumps canônicos (`SRC_FULL`, `MIGRATIONS_FULL`, `01_NORMATIVE_FULL`, `SSOT_FULL`) deveriam ir para `.gitignore` em vez de commit. Razão: são snapshots regenerados a cada sessão, vão crescer rápido em commits, e o repositório já tem `backend/src/`, `backend/migrations/`, `docs/01_normative/`, `docs/ssot/` como fontes vivas.

Os 2 planos (`PLANO_SESSAO_v4.md`, `PLANO_MESTRE_*.md`) **devem ir a commit** — são produto desta sessão.

**Procedimento em duas partes:**

**8a — Adicionar dumps ao .gitignore:**
```
# Editar .gitignore para incluir:
SRC_FULL.txt
MIGRATIONS_FULL.txt
01_NORMATIVE_FULL.txt
SSOT_FULL.txt

git add .gitignore
git commit -m "chore(gitignore): exclui dumps canonicos regenerados por sessao"
```

**8b — Commit dos planos:**
```
git add PLANO_SESSAO_2026-05-05_working-tree_v4.md PLANO_MESTRE_remediacao_core_modules.md
git commit -m "docs(planning): adiciona plano de sessao e plano-mestre"
```

**Mensagem de commit (8b):**
```
docs(planning): adiciona plano de sessao 2026-05-05 e plano-mestre

- PLANO_SESSAO_2026-05-05_working-tree_v4.md: roteiro da triagem desta sessao
- PLANO_MESTRE_remediacao_core_modules.md: roteiro multi-sessoes (22 sessoes)
  para resolver acoplamento core <-> modules

Documentacao operacional para rastreabilidade institucional.
```

---

## BUCKETS QUE PRECISAM DE DECISÃO ADICIONAL ANTES DE A.5

Estes 4 buckets têm volume alto e/ou natureza ambígua. **Recomendo decidir individualmente:**

### B10b — 268 migrations untracked

**Volume crítico.** Pode ser:
- Migrations realmente não persistidas (alarme — schema crítico)
- Cópias geradas por scripts de auditoria
- Lixo de exploração

**Sub-prompt obrigatório (read-only):**

```powershell
Write-Host "=== Padrão de nomes em migrations untracked ==="
git --no-pager status --short | Select-String '^\?\? backend/migrations/' |
  ForEach-Object { ($_.ToString().Trim() -split ' ')[1] -replace '^"|"$','' } |
  ForEach-Object { ($_ -split '_')[0] } |
  Group-Object | Sort-Object Count -Descending | Select-Object -First 10

Write-Host "`n=== Datas dos arquivos ==="
git --no-pager status --short | Select-String '^\?\? backend/migrations/' |
  ForEach-Object { ($_.ToString().Trim() -split ' ')[1] -replace '^"|"$','' } |
  Select-Object -First 10 |
  ForEach-Object {
    $f = "C:\unificard\$_"
    if (Test-Path $f) {
      "$((Get-Item $f).LastWriteTime.ToString('yyyy-MM-dd')): $_"
    }
  }
```

**Decisão fica em standby até output.** Se forem migrations reais não-aplicadas, vira sessão dedicada.

### A1 — docs/03_execution_log (163 arquivos)

**Sub-prompt no commit 4 já mapeia.** Decisão fina vai depender do output (datados vs não-datados).

### B5 — 21 docs/* modified não-normativos

**Volume baixo.** Decidir individualmente quando chegar em A.5.

### B10e (10 seeds) e B10f (12 backend/scripts)

**Volume baixo.** Caso a caso em A.5.

---

## RESUMO FINAL DA A.4

### O que está aprovado para A.5:
1. **Commit 1** — 13 deletes seguros (.bak + timestamps + placeholder)
2. **Commit 2** — Consolidação docs/ssot/ (2 deletes + 10 modified)
3. **Commit 3a** — 96 normativos modificados (séries canônicas atualizadas)
4. **Commit 3b** — 44 normativos novos (continuação da série + novas leis)
5. **Commit 4** — Auditorias + logs de execução (após curadoria de A1)
6. **Commit 5** — Archive (docs/99_archive + migrations-resetadas, sem desktop.ini)
7. **Commit 6** — Novos scripts (após inspeção de headers, sem baseline.json)
8. **`git restore`** — backend/.cursor/rules/00_NORMATIVE_MANDATORY.md (sem commit)
9. **Commit 8a** — `.gitignore` para dumps canônicos
10. **Commit 8b** — Planos de sessão e mestre

**Total: 9 commits + 1 restore.** Mais granular que os "5-7" iniciais, mas mantém unidade temática real (regra do ajuste 1).

### O que fica para depois (ordem de execução em A.5 / A.6):
- B10b (268 migrations) — sub-investigação antes de decidir
- A1 (curadoria fina dos 163 logs)
- B10e, B10f (caso a caso)
- B6 (1 script modified) — caso a caso
- B5 (21 docs modified) — caso a caso
- B10a (13 root .md untracked) — caso a caso
- B10i (30 deleteds soltos) — caso a caso (mistura código + lixo)
- A.6 (4 stashes + 6 workflows untracked)

### O que fica BLOQUEADO (não toca nesta sessão):
- B4, B7, B10c, B10d, B10h, C — todos com justificativa formal

---

## PRÓXIMO PASSO

Aguardo aprovação por bucket. Você pode:
- (a) Aprovar tudo de uma vez ("vai com tudo")
- (b) Aprovar commit por commit
- (c) Ajustar algum agrupamento ou mensagem antes de aprovar

Quando aprovado, abro **A.5 (execução)** com o primeiro commit. Cada commit segue o protocolo:

```
1. Codex executa git add com lista explícita
2. Codex faz git commit com mensagem aprovada
3. Codex revalida 4 gates
4. Eu confirmo PASS antes do próximo commit
```
