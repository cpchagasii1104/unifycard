# PLANO DE SESSÃO — Triagem de Working Tree (v5)

**Data:** 2026-05-05
**Snapshot inicial:** 2026-05-05 14:55:39 (1549 itens)
**Snapshot atual (após 5 commits):** ~1513 itens
**Branch:** `rescue-structural` ✅ confirmado
**Commit inicial da sessão:** `8e9a4c93 docs(#019.FR): registra gates finais e próximas ações no STATUS`
**Commit atual:** `4f066536 fix(gitignore): restaura regra *.bak corrompida na conversao de encoding`
**Orquestrador:** Clayton
**Agente principal:** Claude (este chat)
**Executores:** Codex (PowerShell)
**Modo de operação:** EXECUTOR pontual sob autorização explícita por commit.
**Escopo declarado:** Triagem dos 5 clusters operacionais (docs, backend não-src, frontend, scripts, packages). **Arquivos da raiz e diretórios temporários gerenciados por Clayton fora desta sessão.**

---

## ⚠️ ESCOPO RESTRITO DA SESSÃO (v5)

**Sob gerenciamento desta sessão (5 clusters):**

| Cluster | Volume | Status |
|---|---|---|
| `docs/` (não-normativos já commitados) | 246 itens | ativo |
| `backend/` (excluindo `backend/src/*`) | 166 itens | ativo (B4 bloqueado) |
| `frontend/` | 45 itens | bloqueado (regra B4 estendida) |
| `scripts/` (raiz) | 32 itens | ativo |
| `packages/` | 11 itens | ativo |

**Fora do escopo desta sessão (Clayton gerencia):**

- Arquivos `.md`, `.txt`, `.zip` na raiz do repositório
- Diretórios temporários: `backup-pre-volta-01-05`, `EXECUTAR`, `FACA-AGORA`, `unificard_03_05_arquivado`, `organizar_isto_parece_ser_de_categorias`
- Lixo Windows na raiz (`desktop.ini`, `generate_manifest.ps1`, etc.)
- Outros arquivos soltos na raiz não classificados

**Regra:** se aparecer commit relacionado a item fora do escopo, parada imediata.

---

**Mudanças vs v4 (1 ajuste estrutural):**
- Escopo restrito aos 5 clusters operacionais
- Buckets fora dos 5 clusters movidos para "Fora do escopo" (Clayton gerencia)
- A.5 reduzida — commits cobrem apenas os 5 clusters

**Mudanças anteriores mantidas:**
- A.0, A.1 fechadas
- Snapshot congelado (1549 itens iniciais)
- Regra de bloqueio #9 (não executar `dist/`)
- Critério "autônomo" com 3 condições obrigatórias
- A.3, A6 fechadas com decisões registradas
- 5 commits já executados (b29fc6a3, db3eda65, 4e697077, 5b410c17, 4f066536)

---

## 1. ESTADO DE ENTRADA — confirmado executavelmente

### 1.1 Estado de partida da sessão

| Item | Resultado | Evidência |
|---|---|---|
| Commit inicial da sessão | `8e9a4c93` | git log |
| Build TypeScript | PASS | `pnpm build` |
| 4 gates CI | PASS | execução direta |
| `CORE_PURITY_SUMMARY` | `68/319/891` | gate executado |

### 1.2 Estado pós-A.0 (commit `b29fc6a3`)

| Item | Resultado |
|---|---|
| Branch | `rescue-structural` ✅ |
| `validate:actor-writer-boundaries` | GATE OK [§4.8.1] ✅ |
| `validate:bank-ledger-boundaries` | GATE OK [§4.6] ✅ |
| `validate:regression-guards` | OK ✅ |
| `validate-architectural-patterns --strict` | `critical_new=0 warning_new=0` (exit 0) ✅ |
| `CORE_PURITY_SUMMARY` | `68/319/891` (inalterado) ✅ |

**Convergência:** os 4 gates passam após `b29fc6a3`. Baseline arquitetural inalterado (esperado: commit foi só docs).

### 1.3 Restrição de fato

Sistema **não tem dados** — sem usuários, empresas, produtos ou transações. Isso muda o peso de bugs de runtime mas **não altera a metodologia**. Razão: DECISION-0020 — *"antes do primeiro usuário, toda concessão a legado é suspeita."*

---

## 2. ACHADOS DESTA SESSÃO — classificados

### 2.1 Working tree massivamente sujo

**Snapshot congelado em 2026-05-05 14:55:39:**

| Categoria | Contagem (fora de `node_modules`) |
|---|---|
| Modified | 747 |
| Deleted | 39 |
| Untracked | 763 |
| **Total** | **1549** |

**Subcategorias críticas (medidas no mesmo snapshot):**

| Subcategoria | Modified | Deleted | Untracked |
|---|---|---|---|
| Normativos (`docs/01_normative/` + `docs/02_decisions/`) | **96** | **13** | **44** |

**Severidade:** CRÍTICO • **Impacto:** operacional + institucional (normativos) • **Bloqueia execução:** SIM

### 2.2 `package.json` com 3 meses de drift

- Última vez commitado: **2026-02-11** (`70579227 [REBASE-03]`)
- Estado: **+79 / -3** linhas
- Mudança crítica: `tsc-alias` removido do script `build`
- `tsc-alias` ainda presente em `devDependencies` (linha 171) — dependência órfã

**Severidade:** ALTO (latente) • **Impacto:** operacional + execução • **Bloqueia execução:** SIM (para commit do `package.json`); NÃO (outras frentes)

### 2.3 DT-build-alias (regressão silenciosa em `dist/`)

- `pnpm build` passa sem erro
- `backend/dist/` contém **1.464 ocorrências de `@core/*` e `@modules/*` literais** no JS emitido
- Causa: remoção do `tsc-alias` quebra resolução pós-`tsc`

**Quem dispara:**
- ❌ Nenhum workflow CI (zero matches em `.github/workflows/*.yml`) — confirmado em A.1
- ✅ `pnpm start` (linha 17 de `package.json`: `node dist/server.js`)
- ✅ Qualquer ambiente que importar o pacote via `main` (linha 7: `"main": "dist/server.js"`)

**Severidade:** ALTO (latente) • **Impacto:** execução fora de dev • **Bloqueia execução:** NÃO (sistema usa `tsx watch` em dev) • **Bloqueia produção:** SIM (qualquer `pnpm start` ou import como package)

**Classificação final:** débito futuro. Promovido a "agora" se/quando: (a) algum workflow CI passar a usar `dist/`, (b) você quiser rodar `pnpm start`, (c) aproximação de qualquer plano de deploy.

### 2.4 C66: bug latente `concept_id` slug→UUID

- Schema: `bank_transactions.concept_id UUID NOT NULL REFERENCES concepts(concept_id)`
- 4 callers passam slugs literais: `'group-contribution-payment'`, `'treasury-*'`, `'service-booking-payment'`, `'system-reserve-credit'`
- Wrapper `transaction.service.ts` aceita `concept_id: string` e repassa direto
- Bank validador (`bank-transaction.service.ts`) só checa `=== undefined` — não valida UUID, não resolve slug
- Resolvedor existe em `concept-slug-resolve.service.ts`, mas os 4 callers não o usam
- `'split-payment'` **não está seedado** em `concepts` — mesmo após resolver, faltaria registro

**Severidade:** CRÍTICO • **Impacto:** semântico + financeiro • **Risco operacional atual:** BAIXO (sistema sem dados) • **Bloqueia execução:** SIM, mas para a Frente 1 — não para esta sessão de triagem

**Status:** sistema vazio → bug não dispara → janela para corrigir antes do primeiro dado real. Documentado e isolado, não remediado nesta sessão.

### 2.5 Hipóteses #004 e #005 em execução fragmentada

- `backend/src/core/economy/fund/*` em **deleted** (Hipótese #004)
- `backend/src/config/testOverrideUsers.ts` deletado (Hipótese #005)
- `backend/src/modules/events/event.service.ts` e `events-multi-actor.service.ts` deletados
- Nenhum desses commits aparece no histórico — alguém aplicou parcialmente as Hipóteses sem commitar

**Severidade:** MÉDIO • **Impacto:** arquitetura + operacional • **Bloqueia execução:** SIM (parte do working tree sujo)

### 2.6 Seis workflows CI untracked

`.github/workflows/`: `backend-ci.yml`, `canonical-gates.yml`, `execution-guard.yml`, `marketplace-order-boundaries-audit.yml`, `payments-ledger-boundaries-audit.yml`, `system-gates.yml`

**Severidade:** MÉDIO • **Impacto:** operacional • **Bloqueia execução:** SIM (parte do working tree sujo)

### 2.7 Quatro stashes pendentes

- `stash@{0}: On genesis_v2_rebase: local-before-rescue`
- `stash@{1}: WIP on (no branch): 5fc10efc docs(decisions): aprova Gate Migration 300 (RBAC actor-based)`
- `stash@{2}: WIP on genesis_v2_rebase: a80654ee refactor: extract MarketplaceSubscriptionsService`
- `stash@{3}: On checkpoint-pos-reset: wip antes do GENESIS_CONSTITUCIONAL_v2`

**Severidade:** MÉDIO • **Impacto:** operacional • **Bloqueia execução:** NÃO

### 2.8 Aviso de "muitos objetos soltos no repo" (git gc)

- Git sugeriu gc durante o commit `b29fc6a3`
- **Não rodar `git gc` agora** — pode descartar objetos dangling que ainda têm valor

**Severidade:** BAIXO • **Impacto:** operacional • **Bloqueia execução:** NÃO

---

## 3. FRENTES — sequência atualizada

```
═══ ESTA SESSÃO ═══
A.0  ✅ FEITO — confirmar branch + revalidar gates pós-b29fc6a3
A.1  ✅ FEITO — validar uso de dist/ no CI (DT-build-alias = débito futuro)
A.2  Mapear 1549 itens em buckets B1–B10i (read-only)
A.3  Triagem institucional de normativos (96+13+44) — PRIORIDADE ALTA
A.4  Decisão por bucket (com Clayton)
A.5  Execução de commits/restores aprovados (com regra autônomo/não-autônomo)
A.6  Stashes + workflows untracked
A.7  Atualização de STATUS_EXECUCAO_GLOBAL.md (commit próprio)

═══ PRÓXIMAS SESSÕES ═══
DT-build-alias  Sessão dedicada para restaurar tsc-alias e validar dist/ limpo
C66             Sessão dedicada para resolver concept_id slug→UUID (Caminho A: wrapper)
Frente 3        Classificar 4 callers do wrapper transactionService (depois de C66)
Frente 1        account.service.ts e transaction.service.ts (depois de Frente 3)
Cluster B       UnifyBank — facade vs violação caso a caso
Cluster C       Events — só com decisão arquitetural prévia
Rotas 501       Decisão de produto: implementar via BankTransactionReadPort ampliado ou remover
```

Clusters B e C mapeados em auditorias prévias (CC + Codex). **Análise detalhada fica para sessão futura.**

---

## 4. REGRAS DE BLOQUEIO DA SESSÃO

Estas regras são absolutas durante toda a sessão atual:

1. **Working tree sujo → nenhuma alteração de código de produção.** Apenas decisões sobre arquivos já alterados.
2. **C66 aberto → nenhuma migração de callers financeiros.** Documentado e isolado, não remediado.
3. **DT-build-alias aberto → não commitar `package.json`** sem fix do `tsc-alias` validado.
4. **Build não revalidado entre alterações → não confiar em estado executável anterior.** Cada commit autorizado exige validação dos 4 gates após.
5. **Uma alteração → build → gate → commit → próxima.** Sem batch.
6. **Escopo único declarado:** triagem do working tree. Achados fora desse escopo são **registrados** e **não agidos**.
7. **Não rodar `git gc`** mesmo se git sugerir.
8. **Critério de "arquivo autônomo" — todas as 3 condições OBRIGATÓRIAS:**
   - **NÃO** estar em `backend/src/**`
   - **NÃO** afetar execução (build, runtime, gates, scripts npm)
   - **NÃO** depender de outros arquivos do working tree (semântica, contexto ou rastreabilidade)

   Arquivos autônomos: commit direto após confirmação humana.
   Qualquer dúvida → trata como não-autônomo → mapear contexto antes de commitar.
9. **NÃO executar código compilado de `dist/` enquanto DT-build-alias estiver aberto.** Inclui `pnpm start`, `node dist/server.js`, importar o pacote via `main`. Validar dist/ limpo antes de qualquer execução.

---

## 5. PLANO DA SESSÃO ATUAL — Fases A.2 → A.7

### Fase A.2 — Mapear 1548 itens em buckets (read-only)

**Objetivo:** classificar o working tree restante em buckets temáticos antes de qualquer decisão de commit.

**Buckets propostos:**

| Bucket | Critério | Esperado encontrar | Tratamento |
|---|---|---|---|
| B1 | Hipótese #004 (`fund/`) | ~10-30 deleteds em `backend/src/core/economy/fund/` | Caso a caso após confirmar Hipótese |
| B2 | Hipótese #005 (`testOverrideUsers`) | 1 deleted + possíveis ajustes em callers | Caso a caso após confirmar Hipótese |
| B3 | Events deletados | Verificar se é Hipótese declarada ou ação isolada | Investigação obrigatória |
| **B4** | **`backend/src/*` modified** | **Código de produção alterado sem commit** | **🚫 BLOQUEADO para ação nesta sessão (Regra #1)** |
| B5 | `docs/*` modified (não-normativos) | Documentação alterada | Amostragem |
| B6 | `scripts/*` modified | Scripts alterados | Amostragem |
| B7 | `package.json` (DT-build-alias) | Já isolado | 🚫 Congelado (Regra #3) |
| B8 | Workflows CI untracked (`.github/workflows/`) | 6 arquivos identificados | Fase A.6 |
| B9 | 4 arquivos canônicos untracked | `SRC_FULL.txt`, `MIGRATIONS_FULL.txt`, `01_NORMATIVE_FULL.txt`, `SSOT_FULL.txt`, `PLANO_SESSAO_v*.md` | Decidir gitignore vs commit |
| **B10a** | Root docs / full dumps | Arquivos `.md` na raiz não-normativos | Caso a caso |
| **B10b** | Migrations untracked (`backend/migrations/`) | Possíveis SQL não persistidos | Investigação obrigatória |
| **B10c** | Backend tests (`backend/tests/`, `**/*.spec.ts`) | Tests modificados/criados | Amostragem |
| **B10d** | Tsconfig / configs (`tsconfig*.json`, `eslintrc*`, `prettierrc*`) | Configs alterados | Cuidado: afeta build |
| **B10e** | Seeds (`backend/src/scripts/seed-*`, `backend/seeds/`) | Seeds modificados/criados | Caso a caso |
| **B10f** | Scripts backend (`backend/scripts/`) | Scripts shell/JS de operação | Amostragem |
| **B10g** | Docs archive (`docs/archive/`, `docs/legacy/`) | Documentos antigos | Caso a caso |
| **B10h** | Package contracts (`backend/package-lock.json`, `pnpm-lock.yaml`) | Lockfiles alterados | 🚫 Congelado junto com B7 |
| **B10i** | Arquivos deletados soltos | Deletes não classificados em B1-B3 | Investigação obrigatória |

**Prompt para Codex (read-only):**

```powershell
$env:GIT_PAGER = "cat"
cd C:\unificard

Write-Host "=== B1: fund/ ==="
git --no-pager status --short | Select-String 'fund/' | Measure-Object -Line | Select-Object -ExpandProperty Lines
git --no-pager status --short | Select-String 'fund/' | Select-Object -First 5

Write-Host "`n=== B2: testOverrideUsers ==="
git --no-pager status --short | Select-String 'testOverrideUsers'

Write-Host "`n=== B3: events deletados ==="
git --no-pager status --short | Select-String '^ D ' | Select-String 'modules/events/'

Write-Host "`n=== B4: backend/src/* modified — BLOQUEADO para ação ==="
git --no-pager status --short | Select-String '^ M backend/src/' | Measure-Object -Line | Select-Object -ExpandProperty Lines
git --no-pager status --short | Select-String '^ M backend/src/' | Select-Object -First 10

Write-Host "`n=== B5: docs/* modified (não-normativos) ==="
git --no-pager status --short | Select-String '^ M docs/' | Select-String -NotMatch '01_normative|02_decisions' | Measure-Object -Line | Select-Object -ExpandProperty Lines
git --no-pager status --short | Select-String '^ M docs/' | Select-String -NotMatch '01_normative|02_decisions' | Select-Object -First 10

Write-Host "`n=== B6: scripts/* modified ==="
git --no-pager status --short | Select-String '^ M scripts/' | Measure-Object -Line | Select-Object -ExpandProperty Lines
git --no-pager status --short | Select-String '^ M scripts/' | Select-Object -First 10

Write-Host "`n=== B8: workflows untracked ==="
git --no-pager status --short | Select-String '^\?\? \.github/workflows/'

Write-Host "`n=== B9: 4 arquivos canônicos + planos untracked ==="
git --no-pager status --short | Select-String '^\?\? (SRC_FULL|MIGRATIONS_FULL|01_NORMATIVE_FULL|SSOT_FULL|PLANO_SESSAO)' 

Write-Host "`n=== B10a: root docs / full dumps (.md na raiz) ==="
git --no-pager status --short | Select-String '^\?\? [^/]+\.md$' | Where-Object { $_ -notmatch 'node_modules' }

Write-Host "`n=== B10b: migrations untracked ==="
git --no-pager status --short | Select-String '^\?\? backend/migrations/' | Measure-Object -Line | Select-Object -ExpandProperty Lines
git --no-pager status --short | Select-String '^\?\? backend/migrations/' | Select-Object -First 10

Write-Host "`n=== B10c: backend tests ==="
git --no-pager status --short | Select-String 'backend/tests/|\.spec\.ts$|\.test\.ts$' | Where-Object { $_ -notmatch 'node_modules' } | Measure-Object -Line | Select-Object -ExpandProperty Lines
git --no-pager status --short | Select-String 'backend/tests/|\.spec\.ts$|\.test\.ts$' | Where-Object { $_ -notmatch 'node_modules' } | Select-Object -First 10

Write-Host "`n=== B10d: tsconfig / configs (BLOQUEADO se afeta build) ==="
git --no-pager status --short | Select-String 'tsconfig|\.eslintrc|\.prettierrc|jest\.config' | Where-Object { $_ -notmatch 'node_modules' }

Write-Host "`n=== B10e: seeds ==="
git --no-pager status --short | Select-String 'seed-|/seeds/' | Where-Object { $_ -notmatch 'node_modules' } | Measure-Object -Line | Select-Object -ExpandProperty Lines
git --no-pager status --short | Select-String 'seed-|/seeds/' | Where-Object { $_ -notmatch 'node_modules' } | Select-Object -First 10

Write-Host "`n=== B10f: scripts backend ==="
git --no-pager status --short | Select-String '^\?\? backend/scripts/|^ M backend/scripts/' | Measure-Object -Line | Select-Object -ExpandProperty Lines
git --no-pager status --short | Select-String '^\?\? backend/scripts/|^ M backend/scripts/' | Select-Object -First 10

Write-Host "`n=== B10g: docs archive ==="
git --no-pager status --short | Select-String 'docs/archive/|docs/legacy/'

Write-Host "`n=== B10h: lockfiles (BLOQUEADO junto com B7) ==="
git --no-pager status --short | Select-String 'package-lock\.json|pnpm-lock\.yaml'

Write-Host "`n=== B10i: arquivos deletados soltos (não cobertos por B1-B3) ==="
git --no-pager status --short | Select-String '^ D ' | Where-Object { 
  $_ -notmatch 'fund/' -and 
  $_ -notmatch 'testOverrideUsers' -and 
  $_ -notmatch 'modules/events/'
} | Measure-Object -Line | Select-Object -ExpandProperty Lines
git --no-pager status --short | Select-String '^ D ' | Where-Object { 
  $_ -notmatch 'fund/' -and 
  $_ -notmatch 'testOverrideUsers' -and 
  $_ -notmatch 'modules/events/'
} | Select-Object -First 15

Write-Host "`n=== Resíduo final (não cobertos por nenhum bucket) ==="
git --no-pager status --short | Where-Object {
  $_ -notmatch 'node_modules' -and
  $_ -notmatch 'fund/' -and
  $_ -notmatch 'testOverrideUsers' -and
  $_ -notmatch 'modules/events/' -and
  $_ -notmatch '^ M backend/src/' -and
  $_ -notmatch '^ M docs/' -and
  $_ -notmatch '^ M scripts/' -and
  $_ -notmatch '^\?\? \.github/workflows/' -and
  $_ -notmatch 'package\.json' -and
  $_ -notmatch 'package-lock|pnpm-lock' -and
  $_ -notmatch 'tsconfig|\.eslintrc|\.prettierrc|jest\.config' -and
  $_ -notmatch '^\?\? [^/]+\.md$' -and
  $_ -notmatch '^\?\? backend/migrations/' -and
  $_ -notmatch 'backend/tests/|\.spec\.ts$|\.test\.ts$' -and
  $_ -notmatch 'seed-|/seeds/' -and
  $_ -notmatch 'backend/scripts/' -and
  $_ -notmatch 'docs/archive/|docs/legacy/' -and
  $_ -notmatch '^\?\? (SRC_FULL|MIGRATIONS_FULL|01_NORMATIVE_FULL|SSOT_FULL|PLANO_SESSAO)' -and
  $_ -notmatch '^ D '
} | Measure-Object -Line | Select-Object -ExpandProperty Lines
```

**Saída esperada:** contagem por bucket + amostra dos primeiros itens. Sem ação, sem commit. Resíduo final esperado: ≤ 50 itens (se for maior, criar bucket adicional antes de A.4).

### Fase A.3 — Triagem institucional de normativos (PRIORIDADE ALTA)

**Objetivo:** classificar 96 modificados + 13 deletados + 44 untracked em `docs/01_normative/` e `docs/02_decisions/`. Esta categoria é **risco institucional**, não varredura lateral.

**Por que prioridade alta:** 13 normativos deletados sem rastro no histórico é alarme institucional. Pode haver:
- Decisões deletadas que ainda são vinculantes
- Normativos consolidados em outro arquivo (legítimo)
- Drift de organização documental

**Prompt para Codex (read-only):**

```powershell
$env:GIT_PAGER = "cat"
cd C:\unificard

Write-Host "=== Normativos modificados (96 esperados) ==="
git --no-pager status --short | Select-String -Pattern '^ M docs/(01_normative|02_decisions)/' | Select-Object -First 30

Write-Host "`n=== Normativos deletados (13 esperados) — TODOS ==="
git --no-pager status --short | Select-String -Pattern '^ D docs/(01_normative|02_decisions)/'

Write-Host "`n=== Normativos untracked (44 esperados) ==="
git --no-pager status --short | Select-String -Pattern '^\?\? docs/(01_normative|02_decisions)/' | Select-Object -First 30

Write-Host "`n=== Para cada normativo deletado: histórico do último commit ==="
$deleted = git --no-pager status --short | Select-String -Pattern '^ D docs/(01_normative|02_decisions)/' | ForEach-Object { ($_ -split ' ')[2] }
foreach ($f in $deleted) {
  Write-Host "`n--- $f ---"
  git --no-pager log -1 --format="%h %ad %s" --date=short -- $f
}
```

**Saída esperada:** lista completa de todos os 13 deleteds com último commit. Amostra dos modificados e untracked.

**Critério de classificação (a aplicar em A.4):**
- Deletado E ainda referenciado em outro normativo → **restaurar**
- Deletado E sem referências → candidato a confirmar com Clayton se foi consolidado em outro lugar
- Modificado em sessão registrada (Hipótese #019, etc.) → **commit** com escopo declarado
- Untracked com header coerente → caso a caso
- Untracked sem origem clara → manter ou descartar conforme decisão

**Aviso:** A.4 não pode prosseguir sem A.3 fechado. Normativos têm peso institucional acima do código.

### Fase A.4 — Decisão por bucket (com Clayton)

**Não tem prompt — é janela de decisão humana.** Após A.2 e A.3, apresento síntese e proposta para cada bucket. Você decide:
- Commit (se alinhado com sessão registrada)
- Restore (`git restore`) — se drift acidental
- Drop/delete — se lixo histórico
- Manter (caso especial documentado)

**Saída esperada:** decisão registrada por bucket neste arquivo.

### Fase A.5 — Execução de commits/restores aprovados

**Regra obrigatória (regra de bloqueio #8):**
- **Autônomos:** commit direto após confirmação
- **Não-autônomos:** mapear contexto antes

**Procedimento por bucket aprovado:**
1. Eu proponho prompt cirúrgico (`git add <arquivos>`, mensagem de commit, escopo)
2. Você revisa e autoriza
3. Codex executa
4. Eu revalido 4 gates após
5. Próximo bucket

**Saída esperada:** N commits cirúrgicos, working tree progressivamente limpo, 4 gates PASS após cada commit.

### Fase A.6 — Stashes + workflows untracked

**Posição final por baixa dependência (não por baixa importância).** Stashes podem conter trabalho real (`stash@{0}: local-before-rescue` é candidato). Workflows untracked podem ser parte de fase 2 do CI já preparada.

**Stashes — prompt para Codex (read-only):**

```powershell
$env:GIT_PAGER = "cat"
cd C:\unificard

git --no-pager stash show --stat stash@{0}
git --no-pager stash show --stat stash@{1}
git --no-pager stash show --stat stash@{2}
git --no-pager stash show --stat stash@{3}
```

**Workflows untracked — prompt para Codex (read-only):**

```powershell
$workflows = @(
  '.github/workflows/backend-ci.yml',
  '.github/workflows/canonical-gates.yml',
  '.github/workflows/execution-guard.yml',
  '.github/workflows/marketplace-order-boundaries-audit.yml',
  '.github/workflows/payments-ledger-boundaries-audit.yml',
  '.github/workflows/system-gates.yml'
)
foreach ($w in $workflows) {
  $f = Get-Item "C:\unificard\$w" -ErrorAction SilentlyContinue
  if ($f) {
    Write-Host "`n=== $w ==="
    Write-Host "Created: $($f.CreationTime) | Modified: $($f.LastWriteTime) | Lines: $((Get-Content $f.FullName | Measure-Object -Line).Lines)"
    Get-Content $f.FullName -Head 10
  }
}
```

**Critério de classificação:**
- Workflow recente (< 30 dias) com header coerente → candidato a commit
- Workflow antigo sem referência em outros arquivos → candidato a delete
- Workflow com TODO/WIP no header → manter untracked

**Decisão caso a caso após output, registrada neste arquivo na Fase A.4 expandida.**

### Fase A.7 — Atualização de STATUS_EXECUCAO_GLOBAL.md (subfase com commit próprio)

**Objetivo:** registrar checkpoint desta sessão no STATUS, com commit próprio dedicado.

**Por que separado:** atualizar STATUS é escrita documental, não checklist booleano. Exige autorização explícita e commit próprio para preservar rastreabilidade da sessão.

**Conteúdo a registrar:**
- Resumo do que esta sessão fez (triagem completa, N commits cirúrgicos)
- Snapshot de entrada (1549 itens) → snapshot de saída
- Débitos novos abertos: DT-build-alias, C66
- Decisões institucionais (B4 mantido bloqueado, normativos triados)
- Próximas sessões agendadas (referência ao Plano-Mestre)

**Procedimento:**
1. Eu redigo bloco de texto a adicionar ao STATUS
2. Você revisa e autoriza
3. Codex aplica edição
4. Codex commita com mensagem `docs(checkpoint): triagem working-tree sessao 2026-05-05`
5. Eu revalido 4 gates após
6. Sessão fechada

**Bloqueio:** A.7 só é executada após A.5 e A.6 fechadas e working tree em estado declarado.

---

## 6. CRITÉRIO DE SAÍDA DA SESSÃO

A sessão **termina** quando todas estas condições forem verdadeiras:

- [x] Fase A.0 fechada (branch confirmado, gates revalidados)
- [x] Fase A.1 fechada (DT-build-alias classificado como débito futuro)
- [ ] Fase A.2 fechada (1549 itens mapeados em buckets B1–B10i)
- [ ] Fase A.3 fechada (96 modificados + 13 deletados + 44 untracked normativos triados — categoria institucional)
- [ ] Fase A.4 fechada (decisão registrada por bucket)
- [ ] Fase A.5 fechada (commits/restores aprovados executados)
- [ ] Fase A.6 fechada (stashes + workflows decididos)
- [ ] Fase A.7 fechada (STATUS atualizado + commit próprio + 4 gates revalidados)
- [ ] **`git status --short`** mostra working tree em um destes 2 estados:
  - **Limpo** (zero itens fora de `node_modules`), OU
  - **Com resíduos explicitamente classificados e documentados por bucket** (cada item residual tem registro neste arquivo declarando: bucket, decisão, motivo de adiamento)
- [ ] **DT-build-alias e C66** registrados como débitos abertos para próximas sessões
- [ ] **Plano-Mestre** referenciado no STATUS como roteiro das próximas sessões

A sessão **não toca** em:
- Código de produção (`backend/src/core/`, `backend/src/modules/`)
- Migrations (`backend/migrations/`)
- C66 (apenas documentado, não remediado)
- DT-build-alias (apenas documentado, não remediado)
- Frentes 1, 2, 3 (Cluster A, B, C)

---

## 7. FORA DE ESCOPO — registrado para próximas sessões

| Item | Razão de adiamento |
|---|---|
| C66 (concept_id slug→UUID) | Sistema vazio → não está quebrando hoje. Sessão dedicada antes do primeiro seed financeiro real. |
| DT-build-alias (`tsc-alias` removido) | Não bloqueia dev (`tsx watch`). Não usado em CI. Sessão dedicada antes de qualquer build de deploy ou `pnpm start`. |
| Frente 3 (4 callers do wrapper) | Depende de C66 fechado. |
| Frente 1 — `account.service.ts` | Depende de decisão sobre `BankAccountPort` (ampliar vs 501). |
| Frente 1 — `transaction.service.ts` | Depende de Frente 3 completa. |
| Cluster B (UnifyBank) | Decisão arquitetural prévia: facade autorizada ou core puro? |
| Cluster C (Events) | Acoplamento bidirecional `core/events ↔ modules/events` — decisão arquitetural prévia. |
| Rotas 501 (`/event/:eventId`, `/account/:accountId`) | Decisão de produto: implementar via `BankTransactionReadPort` ampliado ou remover. |
| Promoção do gate fase 2 (`validate-core-purity` → warning) | Após baseline `modules_import` se estabilizar próximo de 0. |
| 12 erros TS pré-existentes (DT-tsc) | Verificar após Frente 1 estabilizar. `pnpm build` (produção) passa hoje. |
| 67 tabelas com `status` genérico (C36) | Bloqueado por RFC. |
| Gate de nomenclatura (C37) | Bloqueado por RFC. |
| `git gc` | Aviso recebido em `b29fc6a3`. Adiar até working tree limpo. |

---

## 8. PRECEDENTE OPERACIONAL REGISTRADO

Durante a transição da v1 para a v2 deste plano, o commit `b29fc6a3` (2 normativos) foi executado **antes** da finalização do mapeamento (Fase A.2). Isso ocorreu porque:
- A v1 do plano autorizava o commit como Fase A.1
- O Codex executou imediatamente
- Os 4 ajustes do Opus anterior chegaram após o commit, incluindo o ajuste #3 que invalidaria a autorização

**Decisão tomada:** manter `b29fc6a3` (commit cirúrgico, conteúdo trivial e autônomo, alinhado com sessão #019).

**Lição operacional:** não autorizar execução enquanto plano estiver em revisão, mesmo para passos que pareçam óbvios. Esta lição motivou a regra de bloqueio #8 (autônomo/não-autônomo) e a estrutura A.2 → A.5 da v2.

---

## 9. RESUMO EXECUTIVO

**Esta sessão não escreve código de produção.** Esta sessão **decide o que fazer com o que já está no disco** para que próximas sessões possam escrever código sem contaminar commits com 3 meses de drift.

A sessão produz:
- N commits cirúrgicos (apenas para arquivos triados como "trabalho legítimo abandonado")
- Decisões registradas para cada bucket do working tree
- 2 débitos novos abertos formalmente: **DT-build-alias** e **C66**
- Checkpoint no STATUS

A sessão **não produz** nem **autoriza**:
- Alteração em código de produção
- Remediação de C66 ou DT-build-alias
- Início de qualquer Frente arquitetural
