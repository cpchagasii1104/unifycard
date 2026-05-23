# MENSAGEM DE TRANSFERÊNCIA — UNIFICARD

**Versão:** 1.1 (com ajuste do ChatGPT — Passo 3.4 adicionado)
**Data:** 2026-05-04 (fim do dia)
**Sessão encerrando:** Claude (Auditor) + ChatGPT (Crítico) + Codex (Executor) + Clayton (Orquestrador)
**Próxima sessão:** começar a partir desta mensagem

---

## ⚠️ LEIA TUDO ANTES DE QUALQUER AÇÃO

Esta mensagem contém o estado real do projeto, descobertas críticas e regras operacionais. Pular seções pode custar horas. Execução começa apenas na **Seção 7**.

---

## 1. ESTADO REAL DO PROJETO (validado por Codex)

### Repositório

- **Caminho:** `C:\unificard\`
- **Branch:** `rescue-structural`
- **HEAD:** `e96323cc` — `merge: baseline limpa pós-rescue (01/05 restaurado)`

### Histórico recente

```
e96323cc  merge: baseline limpa pós-rescue (01/05 restaurado)  ← HEAD
5bafe88e  fix: corrige narrowing em CheckResult (reason access)
14111f7c  refactor: fatiamento marketplace estabilizado
4c395634  status: registra checkpoint 2026-05-01 e atualiza próximas ações (DECISION-0017)
6b5127a4  status: registra Ciclo 3 fechado (DECISION-0017 - repo-strict)
```

### Build

- **Comando:** `npm run build -w unificard-backend` (rodando em `C:\unificard\backend`)
- **Resultado validado:** **0 erros TS**
- **Ambiente:** `node_modules` presente, `tsc` disponível em `backend\node_modules\.bin\tsc.cmd`

### Working tree

- **1544 entries modificadas/untracked** (excluindo node_modules)
- ⚠️ **NÃO atacar essas 1544 mudanças sem entender uma a uma.** A maioria pode ser:
  - Trabalho parcial do fatiamento ainda em andamento
  - Modificações vindas da pasta `unificard_03_05_arquivado/` que estão dentro do repo
  - Reconfigurações de ambiente
- **Ação para próxima sessão:** rodar `git diff` categorizado **antes** de qualquer mudança

### Marketplace (estado atual)

- `backend/src/modules/marketplace/marketplace.service.ts` = **886 linhas** (fatiado)
- `backend/src/modules/marketplace/marketplace.routes.ts` = **144 linhas** (agregador)
- ✅ Fatiamento commitado em `14111f7c` (1+ mês de trabalho finalmente registrado no Git)

### Stashes preservados

```
stash@{0}: On genesis_v2_rebase: local-before-rescue
stash@{1}: WIP on (no branch): 5fc10efc docs(decisions): aprova Gate Migration 300 (RBAC actor-based)
stash@{2}: WIP on genesis_v2_rebase: a80654ee refactor: extract MarketplaceSubscriptionsService
stash@{3}: On checkpoint-pos-reset: wip antes do GENESIS_CONSTITUCIONAL_v2
```

---

## 2. O QUE ACONTECEU (resumo de 5 frases)

1. Entre 01/05 e 03/05, Claude Code modificou o sistema gerando ~1209 erros TypeScript (refactor big bang sem validação incremental).
2. Em 04/05, operação multi-IA reverteu o estado para baseline de 01/05.
3. Fatiamento do marketplace que estava há 1+ mês em working tree foi finalmente commitado.
4. Build voltou a 0 erros.
5. Material das 36h foi preservado em `unificard_03_05_arquivado/` para análise como hipóteses, não como código a recuperar.

---

## 3. DESCOBERTA CRÍTICA DESTA SESSÃO — HIPÓTESE #019

⚠️ **Esta é a descoberta arquitetural mais importante.** Foi feita no fim da sessão e ainda **não está no documento de hipóteses v2** (v3 pendente).

### Hipótese #019 — Repurificação da fronteira core/modules

**Categoria:** Arquitetural
**Impacto se errada:** Alto

**Diagnóstico:**

> O sistema compila, mas a fronteira arquitetural `core/modules` está contaminada.

**Sintomas concretos identificados:**

| Sintoma | Implicação |
|---|---|
| `core/*` contém SQL direto, Fastify, adapters | Viola "núcleo puro" |
| `core/*` importa de `modules/` | Inversão de dependência errada |
| `work` ↔ `work-instant` | Fragmentação semântica |
| `payments` / `payout` / `payouts` | Possível duplicação |
| `reporting` / `reports` / `core/reporting` | Triplicação de responsabilidade |
| `orders` / `my-orders` | Confusão de escopo |
| `services/events`, `modules/live-chat`, `modules/payout`, `modules/my-orders`, `core/plugins`, `core/utils`, `jobs/` | Possível código morto (validar antes de afirmar) |

**Princípio violado:** Lei §1 — sistema único, sem realidade paralela.

**Decisão arquitetural correta:**

> **O problema não é abandonar o core. É repurificar o core para que ele volte a ser núcleo de verdade única, conforme a Lei de Coerência.**

**Não fazer:**
- Renomear `core/` para `platform/`
- Fundir tudo em `domains/`
- Big bang refactor

**Fazer:**
- Repurificar incrementalmente
- 1 sintoma por sessão
- Validar entre cada movimento

**Por que essa é a descoberta mais importante:**
- A Claude Code tentou resolver isso nas 36h (com 17 docs canônicos, novos services, desabilitação de fund/) e quebrou tudo
- Bloqueia outras hipóteses (#002 Mutations, #004 fund, #007 EventOrganizer, #008 tipos rides/work, #014 constraints) porque todas dependem de saber **onde cada coisa mora**
- É a hipótese mais cara se errar (impacto Alto)
- É também a mais valiosa se acertar (resolve causa raiz, não sintoma)

---

## 4. SÍNTESE CONCEITUAL — O QUE A CLAUDE CODE VIU CERTO

A Claude Code produziu 1209 erros TS, mas viu coisas reais. Esta seção captura a intenção dela para próxima IA não desperdiçar o aprendizado.

### Os 5 movimentos dela (intenção e erro)

**1. Tentativa de formalizar ontologia (17 documentos canônicos)**
- Intenção: explicitar e ordenar o sistema (SSOT → Actors → Identity → ... → Effects)
- Errou: criou segunda autoridade documental
- Insight válido: sistema precisa de ontologia clara e única, integrada aos normativos existentes

**2. Tentativa de corrigir drift entre código e banco (fix C4)**
- Intenção: alinhar SQL com schema real
- Acertou: virou cherry-pick legítimo (Hipótese #003, commit `7033c77e`)
- Insight válido: existe drift, validar caso a caso

**3. Auditoria das violações (807 → 5 categorias)**
- Intenção: agrupar problemas em padrões
- Acertou: identificou 5 categorias reais, não 807 erros isolados
- Insight válido: corrigir padrão > corrigir arquivos

**4. Reestruturação de execução (services novos, types, resolvers)**
- Intenção: redistribuir responsabilidades, eliminar acoplamento errado
- Errou: mexeu em muitas camadas ao mesmo tempo, big bang refactor
- Insight válido: **descoberta crítica deste turno (Hipótese #019)** — fronteira core/modules está contaminada

**5. Tentativa de eliminar realidade paralela financeira (desabilitar fund/)**
- Intenção: forçar `bank_*` como SSOT único
- Errou: desabilitar sem migrar dependentes
- Insight válido: existem múltiplas fontes de verdade financeira que precisam ser unificadas com método

### Insight central (a frase mais importante de tudo)

> **O sistema é bem desenhado, mas mal protegido.**

**Tradução:**
- Arquitetura: boa
- Execução: frágil
- Enforcement: insuficiente

**Próxima fase do projeto não é mais documentação. É blindagem executável.**

### Por que deu 1209 erros (sem mistério)

1. Mudou tipos → quebrou contracts
2. Mudou services → quebrou dependências
3. Desligou módulos → quebrou imports
4. Não validou incrementalmente
5. Cascata em efeito dominó

**Não foi burrice. Foi excesso de ambição sem controle incremental.**

---

## 5. DOCUMENTOS CANÔNICOS PARA ESTA SESSÃO

### Existem em `C:\unificard\`

```
✅ REMEDIATION_DECISIONS_LOG.md
✅ STATUS_EXECUCAO_GLOBAL.md
✅ SYSTEM_REMEDIATION_STATUS.md
✅ SYSTEM_REMEDIATION_PLAN.md
✅ MODULOS.txt
✅ estouaprendendo.md
✅ docs/01_normative/00_AGENT_PROTOCOL.md
✅ docs/01_normative/CONSTITUICAO_UNIFICARD.md
✅ docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md
✅ docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
✅ docs/01_normative/SSOT_REGISTRY_UNIFICARD.md
✅ docs/01_normative/07_NOMENCLATURA_CANONICA.md
✅ RELATORIO_36_HORAS_NORTE.md (na raiz)
```

### NÃO existem ainda no repo (críticos)

```
❌ HIPOTESES_DAS_36_HORAS_2026-05_v2.md
   → Clayton tem o arquivo. Salvar em: docs/decisions/
   → Versão v2 cobre 18 hipóteses macro + ~84 sub-hipóteses
   → PRECISA SER ATUALIZADA PARA v3 com Hipótese #019 (esta sessão descobriu)
```

### Documentos defasados (cuidado)

```
⚠️ docs/01_normative/00_AI_ONBOARDING_PROTOCOL.md (se existir como cópia da sessão de 03/05)
   → Foi escrito em 03/05, referencia DECISION-0020 e DECISION-0021 que não estão no estado atual
   → Adicionar nota de revisão pós-rescue OU usar com ressalva
```

---

## 6. AVISOS CRÍTICOS — LEIA ANTES DE EXECUTAR

### Aviso 1 — Pasta `unificard_03_05_arquivado/` está DENTRO do repo

**Localização atual:** `C:\unificard\unificard_03_05_arquivado/`

**Status:** temporária, será deletada após executar todas as hipóteses macro relevantes.

**Tem `.git/` interno** (subprojeto Git). Não tratar como problema — é temporário.

**Sem blindagem aplicada** (não está em `.gitignore` nem em `tsconfig.exclude`):
- `git status` vai mostrar 3000+ untracked vindos dela
- TypeScript pode tentar processar `.ts` lá dentro em alguns comandos
- Buscas (grep/IDE) vão encontrar código antigo misturado

**Recomendação operacional:** se o ruído atrapalhar, adicionar 1 linha em `tsconfig.build.json`:
```json
"exclude": [..., "unificard_03_05_arquivado"]
```

**Uso correto da pasta:**
- ✅ Comparação de arquivos para validar hipóteses
- ✅ Extrair ideias pontuais
- ❌ NÃO copiar código direto
- ❌ NÃO importar
- ❌ NÃO assumir que implementação está correta

### Aviso 2 — Backups deletados

```
❌ C:\backup-pre-volta-01-05.zip — NÃO EXISTE
❌ C:\backup-pre-volta-01-05\ — NÃO EXISTE
```

Clayton fez ZIP manual de `C:\unificard\` em outro local. Confirmar com ele antes de qualquer operação destrutiva.

### Aviso 3 — Working tree com 1544 entries

**NÃO atacar todas de uma vez.** Categorizar primeiro:

```powershell
cd C:\unificard
git --no-pager status --short | Where-Object { $_ -notmatch "node_modules|unificard_03_05_arquivado" } | Group-Object {
    $path = $_.Substring(3)
    if ($path -match "^backend/src/modules/") { "modules" }
    elseif ($path -match "^backend/src/core/") { "core" }
    elseif ($path -match "^backend/migrations/") { "migrations" }
    elseif ($path -match "^docs/") { "docs" }
    elseif ($path -match "^backend/scripts/") { "scripts" }
    else { "outros" }
} | Format-Table Name, Count
```

### Aviso 4 — Backups de stash

Existem 4 stashes (ver Seção 1). Não fazer `git stash drop` sem revisão.

### Aviso 5 — Risco psicológico (mais importante que técnico)

> *"Você está no ponto perigoso: já entendeu o problema… mas pode cair no mesmo erro de novo."*

**Antídoto:** sempre perguntar antes de qualquer mudança:

> *"Isso é uma mudança isolada ou estou mexendo em várias coisas ao mesmo tempo?"*

Se for várias → **NÃO faça**.

---

## 7. PRÓXIMOS PASSOS — EXECUÇÃO COMEÇA AQUI

### Passo 0 — Validar que nada mudou desde esta mensagem

```powershell
cd C:\unificard
git --no-pager log -n 1 --oneline
# Esperado: e96323cc merge: baseline limpa pós-rescue (01/05 restaurado)

cd backend
npm run build
# Esperado: 0 erros
```

**Se HEAD diferir:** investigar antes de prosseguir. Algo aconteceu desde 04/05.

### Passo 1 — Salvar documento de hipóteses v2 no repo

Clayton tem o arquivo `HIPOTESES_DAS_36_HORAS_2026-05_v2.md` baixado.

**Ação:**
```powershell
# Criar pasta de decisões se não existir
mkdir -Force C:\unificard\docs\decisions

# Salvar v2 (Clayton fornece)
# Em: C:\unificard\docs\decisions\HIPOTESES_DAS_36_HORAS_2026-05_v2.md
```

### Passo 2 — Criar v3 do documento adicionando Hipótese #019

**Modelo da nova hipótese (ver Seção 3 desta mensagem para conteúdo completo).**

Atualizar:
- Tabela-índice no topo (adicionar linha #019)
- Adicionar seção `## Hipótese #019` ao corpo
- Atualizar status de #003 (fix narrowing) para **EXECUTADA** com commit `5bafe88e`
- Atualizar status do fatiamento marketplace para **EXECUTADA** com commit `14111f7c`
- Renomear arquivo para `HIPOTESES_DAS_36_HORAS_2026-05_v3.md`
- Commit: `docs(rescue): atualiza hipoteses para v3 — adiciona #019 (core/modules)`

### Passo 3 — DECIDIR estratégia para Hipótese #019

⚠️ **NÃO executar Hipótese #019 ainda.** Antes:

**3.1 — Mapeamento read-only (sem modificar nada):**

```powershell
cd C:\unificard\backend\src

# Imports de core/ vindo de modules/ (errado por design)
"=== core/ importando de modules/ (inversão errada) ==="
Get-ChildItem -Recurse -Filter "*.ts" -Path "core" | 
    Select-String -Pattern "from ['\""]\.\./.*modules" |
    Select-Object Path, LineNumber, Line |
    Format-Table -AutoSize

# SQL direto em core/ (deveria estar em repository)
"=== SQL direto em core/ ==="
Get-ChildItem -Recurse -Filter "*.ts" -Path "core" |
    Select-String -Pattern "INSERT INTO|UPDATE.*SET|DELETE FROM" |
    Select-Object Path, LineNumber |
    Format-Table -AutoSize

# Fastify em core/ (deveria ser modules/)
"=== Fastify em core/ ==="
Get-ChildItem -Recurse -Filter "*.ts" -Path "core" |
    Select-String -Pattern "FastifyInstance|fastify\.|fastifyPlugin" |
    Select-Object Path, LineNumber |
    Format-Table -AutoSize
```

**3.2 — Validar pastas suspeitas (código morto):**

Para cada pasta suspeita, contar imports externos:
```powershell
$suspeitas = @(
  "services/events",
  "modules/live-chat",
  "modules/payout",
  "modules/my-orders",
  "core/plugins",
  "core/utils",
  "jobs"
)

foreach ($p in $suspeitas) {
    $count = (Get-ChildItem -Recurse -Filter "*.ts" -Path "C:\unificard\backend\src" |
        Where-Object { $_.FullName -notmatch [regex]::Escape($p) } |
        Select-String -Pattern "from ['\""].*$p" |
        Measure-Object).Count
    "$p : $count importadores externos"
}
```

⚠️ **Zero imports não prova morte** se houver registro dinâmico. Apenas indica candidatos.

**3.3 — Salvar resultados em arquivo fora do repo** para análise multi-IA:
```powershell
# Salvar em pasta separada (não poluir repo)
mkdir -Force C:\unificard-analise
# Output dos comandos acima vai para arquivos lá
```

### Passo 3.4 — PRIMEIRA EXECUÇÃO CONTROLADA (#019)

⚠️ **Esta etapa é CRÍTICA e foi adicionada no último ajuste da sessão de 04/05.**

⚠️ **Sem ela, Hipótese #019 vira análise infinita sem execução real.**

#### Princípio

Selecionar **1 único caso simples** de violação `core/modules` e atacar com método cirúrgico.

**Objetivo:** validar o método de repurificação **antes** de atacar casos complexos.

**NÃO é:** resolver o problema inteiro.
**É:** ensaio do protocolo "1 sintoma por sessão".

#### Critério de seleção do "primeiro caso"

Escolher caso que tenha:

- ✅ Escopo isolado (1 arquivo em `core/`)
- ✅ Violação clara (ex: SQL direto, ou Fastify, ou import de `modules/`)
- ✅ Sem dependentes complexos (poucos consumidores)
- ✅ Movimento óbvio (qual port criar, qual módulo destino)

**Exemplos de bons candidatos (a confirmar com mapeamento do Passo 3.1):**
- Arquivo em `core/` com 1-2 funções fazendo SQL direto
- Helper em `core/utils/` que só é usado por 1 módulo

**NÃO escolher como primeiro:**
- Arquivos com muitos imports cruzados
- Lógica financeira (impacto Alto demais para ensaio)
- Pastas que aparentam código morto (vai para sessão dedicada de deleção, não de movimentação)

#### Protocolo de execução (UM caso, sem desvio)

```
1. Identificar o arquivo violador escolhido
2. Mapear seus consumidores (grep por imports)
3. Definir destino (qual módulo vai recebê-lo)
4. Criar port em core/ (interface vazia ou contrato leve)
5. Mover implementação para módulo destino
6. Ajustar imports nos consumidores
7. pnpm build (deve dar 0 erros)
8. Rodar gates (validate-schema-coherence, etc.)
9. git diff completo (revisar)
10. Commit: "refactor(core): repurifica X — primeiro caso #019"
```

#### Critérios de sucesso

- ✅ Build = 0 erros TS após movimentação
- ✅ Comportamento do sistema mantido (nenhum endpoint quebrado)
- ✅ Nenhum efeito colateral em outros domínios
- ✅ `git status` mostra apenas o arquivo movido + ajustes de import (não 50 outros)

#### Critérios de falha (PARAR e investigar)

- ❌ Build dá novos erros TS
- ❌ Imports cruzados aparecem em arquivos não previstos
- ❌ Movimento exige mudar tipos em outros lugares
- ❌ Surge necessidade de "só essa coisinha extra"

⚠️ **Se algum critério de falha aparecer:** REVERTER. Não tentar consertar. Não acumular mudanças.

```powershell
git reset --hard HEAD
# Voltar ao estado anterior. Replanejar com Clayton.
```

#### Aprendizado esperado

Este primeiro caso vai **ensinar o método**, não resolver o problema.

Após executá-lo:
- Você sabe quanto tempo leva 1 caso (medir)
- Você sabe quais surpresas aparecem (catalogar)
- Você sabe qual é o tamanho real do trabalho de #019 (estimar)

**Aí sim** atualizar plano para os próximos casos.

#### Importante

⚠️ **Não atacar mais de 1 caso por sessão**, mesmo que o primeiro pareça fácil.

⚠️ **Repetir** o ensaio com 2-3 casos pequenos antes de atacar contaminações maiores.

⚠️ **Documentar cada caso** em `docs/decisions/REPURIFICACAO_CORE_LOG.md` (criar se não existir):
- Arquivo movido
- Destino
- Tempo gasto
- Surpresas encontradas
- Método validado/ajustado

---

### Passo 4 — Sessão estratégica multi-IA com Clayton

Com o mapeamento em mãos, decidir **ordem de ataque**:

**Recomendação inicial (a confirmar):**
1. **Começar pelo código morto** (sub-hipóteses #019.08-14)
   - Risco baixo (deletar não compromete sistema vivo)
   - Aprendizado de método
   - Reduz ruído antes de atacar contaminação real
2. **Depois fragmentação** (sub-hipóteses #019.04-07)
   - work/work-instant, payments/payout, reporting × 3, orders/my-orders
3. **Por último contaminação core** (sub-hipóteses #019.01-03)
   - Mais delicado
   - Requer mover código entre camadas

**Apenas DEPOIS** dessa decisão estratégica, executar.

### Passo 5 — Cherry-picks pendentes (Fase 1 do documento de hipóteses)

⚠️ **Estes ficam para DEPOIS de #019 ter um plano.**

```
#009  fix gate (5 lacunas em validate-schema-code-coherence)  → ACEITA
#010  hygiene allowlist C3 → permanente                       → ACEITA
#011  hygiene allowlist C8 → resolvida                        → ACEITA
#012  docs DECISION-0019                                       → ACEITA
#013  docs DECISION-0020 com adaptação                         → ACEITA
```

**Origem dos commits:** `unificard_03_05_arquivado/` (acessível via path direto ou Git remote).

---

## 8. REGRAS OPERACIONAIS — INVIOLÁVEIS

### 1. Modo de operação

**Default:** GUARDIÃO-LEITURA
- Apenas leitura
- Sem `git checkout/stash/reset/commit/cherry-pick`
- Sem rede
- Sem instalação de pacotes
- Sem build automático que escreva no disco (use `--noEmit` ou `tsc -p ... --noEmit`)

**Para escrever:** EXECUTOR — apenas com autorização explícita de Clayton + escopo definido.

**Para casos críticos** (mover pastas, dropar dados, instalar): exige confirmação explícita por turno.

### 2. Regra de ouro inviolável

```
1 hipótese → 1 mudança → build → commit → próxima
```

**Sem exceção.** Esse é o erro que custou as 36 horas.

### 3. Multi-IA por padrão para impacto Alto

Hipóteses de impacto Alto (#004, #005, #008, #014, #015, #016, #017, #019):
- Auditoria de pelo menos 2 IAs antes da execução
- Decisões estratégicas vão para Clayton, não saem de uma sessão isolada

### 4. Não decidir hipóteses estratégicas sozinha

Hipóteses EM AVALIAÇÃO requerem decisão de Clayton:
- Não decretar
- Registrar dados/decisões faltantes
- Pedir validação multi-IA

### 5. Atualizar documento de hipóteses após executar

Após executar uma hipótese:
- Status: ACEITA → **EXECUTADA**
- Preencher "Evidência de execução" (commit, build, gate)
- Atualizar tabela-índice
- Próxima sessão pega próxima hipótese

### 6. Não inventar convenções novas

- Seguir `00_AGENT_PROTOCOL.md`
- Seguir `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`
- Seguir `SSOT_REGISTRY_UNIFICARD.md`
- Não criar normativos paralelos (esse foi o erro #001 da Claude Code)

### 7. Antes de qualquer mudança, perguntar:

> *"Isso é uma mudança isolada ou estou mexendo em várias coisas ao mesmo tempo?"*

Se forem várias → **NÃO faça**.

---

## 9. O QUE NÃO FAZER (lições das 36h)

❌ Refatoração massiva
❌ Alterar múltiplos domínios juntos
❌ Reescrever arquitetura inteira
❌ Copiar código de `unificard_03_05_arquivado/` direto
❌ Atacar Hipótese #019 inteira de uma vez
❌ Decidir estratégias de impacto Alto sem Clayton
❌ Criar normativos paralelos aos existentes
❌ Pular validação de build entre commits
❌ Mexer em working tree com 1544 entries sem categorizar
❌ Confiar em "parece igual no disco" — coerência é por compilação

---

## 10. PROGRESSO DA SESSÃO 04/05/2026

### Executado

✅ Volta para baseline 01/05 via `bkp_unificard_01_05` → renomeado para `C:\unificard\`
✅ Estado anterior preservado em `C:\unificard\unificard_03_05_arquivado/` (dentro do repo, temporário)
✅ Fatiamento do marketplace commitado (`14111f7c`) — 1+ mês de trabalho registrado
✅ Fix narrowing aplicado (`5bafe88e`) — única correção TS necessária
✅ Merge de baseline limpa (`e96323cc`) — HEAD atual
✅ Build em 0 erros confirmado
✅ Coleta multi-IA do material das 36h
✅ Documento `RELATORIO_36_HORAS_NORTE.md` (606 linhas, na raiz)
✅ Documento `HIPOTESES_DAS_36_HORAS_2026-05_v2.md` (1432 linhas, com Clayton, salvar no repo)
✅ Descoberta de Hipótese #019 (contaminação core/modules)

### Pendente para próxima sessão

⏳ Salvar documento de hipóteses v2 em `docs/decisions/`
⏳ Atualizar para v3 com Hipótese #019
⏳ Marcar #003 (narrowing) e fatiamento como EXECUTADAS
⏳ Mapeamento read-only para Hipótese #019
⏳ Sessão estratégica multi-IA sobre #019
⏳ Cherry-picks da Fase 1 (#009, #010, #011, #012, #013)

### Hipóteses já EXECUTADAS

```
#003  Fix C4 bank-balance-by-region          ❓ Não foi feita ainda — confundir com fix narrowing
      (Atenção: fix narrowing é DIFERENTE de fix C4. Fix C4 ainda é cherry-pick pendente)

✅ Fix narrowing (validate-pipeline-e2e-transversal.ts)  commit 5bafe88e
✅ Fatiamento marketplace                                commit 14111f7c
```

⚠️ **Correção importante:** o fix narrowing (`5bafe88e`) NÃO É a Hipótese #003. Hipótese #003 é o fix C4 do `bank-balance-by-region.service.ts` (commit `7033c77e` no `_arquivado/`). São coisas diferentes. A próxima sessão deve clarificar isso ao atualizar para v3.

---

## 11. FRASE QUE DEFINE A PRÓXIMA FASE

> **O problema não é abandonar o core. É repurificar o core para que ele volte a ser núcleo de verdade única, conforme a Lei de Coerência.**

> **Você não está mais descobrindo o sistema. Você está disciplinando ele.**

> **Sistema é bem desenhado. Mal protegido. Próxima fase: blindagem executável.**

> **Sem Ferrari. Sem pressa. Sem heroísmo. Só execução limpa.**

---

## 12. CONTATO E CONTINUIDADE

**Pessoa:** Clayton Pereira Chagas
**Email Git:** clayton@unificard.com
**Repo:** github.com/cpchagasii1104/unifycard.git
**Branch ativa:** `rescue-structural`

**Multi-IA:**
- Claude (Auditor)
- ChatGPT (Crítico)
- Codex (Executor read-only / write controlado)
- Clayton (Orquestrador / Decisor final)

**Princípio operacional desta sessão:**
> Não reaproveitamos código quebrado. Reaproveitamos a visão estratégica que motivou as mudanças. Cada alteração é uma hipótese a ser testada, não uma solução a ser copiada.

---

## ASSINATURA

**Sessão encerrada por:** Claude (Auditor)
**Data:** 2026-05-04
**Próxima sessão começa em:** Passo 0 desta mensagem (Seção 7)
**Documentos vivos:**
- `RELATORIO_36_HORAS_NORTE.md` (na raiz, histórico)
- `HIPOTESES_DAS_36_HORAS_2026-05_v2.md` (precisa salvar no repo + virar v3)
- Esta mensagem (transferência)

---

**FIM DA TRANSFERÊNCIA**

> Tudo que esta sessão produziu sobrevive a partir desta mensagem.
> Próxima IA: leia tudo, valide Passo 0, depois Passo 1.
> Não pule. Não acelere. O método é o ativo.
>
> **Sequência ideal de execução:**
> Passo 0 → Passo 1 → Passo 2 → mapeamento (3.1, 3.2, 3.3) → **UM caso isolado de #019 (Passo 3.4)**.
>
> **Não atacar mais de um caso por sessão.** Mesmo que pareça fácil.
> Mesmo que sobrar tempo. Esse é o erro que custou as 36 horas.
