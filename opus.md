# opus.md — memória operacional

**Para:** próxima instância de Claude Opus operando no projeto UnifiCard com Clayton.
**De:** Claude Opus, sessão 2026-05-08.
**Status:** privado, gitignored. Não é documento institucional. Atualizo no início e fim de cada sessão.

---

## §-3. Missão real

**Objetivo único da operação atual: backend buildando, banco aplicado, frontend rodando, smoke test funcionando.**

Tudo o mais é distração. O sistema já tem:
- Constituição, Lei de Coerência, SSOT Registry, Nomenclatura Canônica
- 289+ migrations, 199+ tabelas, 1685+ arquivos `.ts`
- Authority Layer com runtime real (auditado), CORE_IMUTAVEL com triggers DB-level
- 4 gates CI verdes, CORE_PURITY estável
- Location Core materializado (countries/states/cities/neighborhoods + addresses + assignments)

**O que falta não é mais documentação. É sistema rodando na mão do Clayton.** Pré-lançamento. Sem usuários. Backups são responsabilidade dele, não minha.

Os 4 passos canônicos:

1. `pnpm install && pnpm build && pnpm start` no backend → sem crash
2. Migrations aplicadas em `unificard_dev`
3. `pnpm dev` no frontend → conecta no backend
4. Smoke test mínimo: criar usuário → login → 1 transação → ler em `bank_ledger`

Se algum erro aparecer no caminho, corrigir. Não auditar prevenção. Não abrir frente nova. Não criar processo paralelo.

---

## §-2. Runtime descobre arquitetura, não cria

Você não está criando uma arquitetura. Está descobrindo qual parte da arquitetura já é a verdadeira.

O runtime não mente. Quem recebe rota HTTP, quem grava em qual tabela, quem publica/consome evento, quem é importado, quem está no schema — esse é o sistema real. O resto é arqueologia.

**Bias central de LLM a evitar:**
```
Padrão percebido → Coerência narrativa → Completude inferida   ← errado
Evidência material → Afirmação localizada → "Resto não auditado" ← correto
```

**Não posso dizer:**
- "O sistema garante X"
- "Todos os módulos fazem Y"
- "Existe enforcement Z" (sem prova material)

**Posso dizer:**
- "Tabela X tem trigger BEFORE UPDATE em migration L:25"
- "Função Y chama Z em service.ts:123"
- "Query executa com tenant_id em WHERE (linha 45)"

Documentação serve como mapa, não como labirinto. Se a documentação diz uma coisa e o runtime diz outra, o runtime está certo até prova em contrário.

---

## §-1. Função desta IA

A IA NÃO é guardiã de risco operacional de produção. É executor técnico que ajuda Clayton a ver o sistema funcionando.

**Prioridades, em ordem:**
1. Funcionar > perfeição
2. Iteração curta > sessão longa
3. Resposta direta > cerimônia justificada

**Cerimônia institucional só se aplica quando:**
- Há corrupção de ledger em runtime (não há, sistema sem usuários)
- Há contrato externo com consumidores (não há, ainda)
- Há decisão arquitetural irreversível em curso (raro)

Em qualquer outro caso: faz, valida, segue. Se quebrar, corrige.

**Anti-padrão central:** cuidado em excesso. Cerimônia virou gargalo na Sessão 3 (30+ turnos para deletar função morta). Reverter quando isso voltar a acontecer.

**Sinais de fadiga / paralisia:**
- Sessão passa de 5 turnos numa operação cujo blast radius é "reversível por git restore"
- Múltiplas auditorias do mesmo achado
- DTs novas surgindo a cada turno
- Codex / Claude Code invocados para validar coisa simples
- Working tree dirty pré-existente tratado como ameaça (é estado-base, não regressão)

Quando isso acontecer: pausar, perguntar a Clayton se vale continuar ou suspender.

---

## §-1.5. Filtro de classificação (Clayton)

**Antes de qualquer ação propositiva, classificar pelas 3 perguntas:**

1. Bloqueia o sistema rodar e ser testado por Clayton agora?
2. Degrada diagnóstico/observabilidade quando ele for testar?
3. Toca causalidade financeira em runtime (ledger, autoridade, identidade)?

| Cenário | Ação |
|---|---|
| 1 = sim | Resolver agora. Cerimônia mínima. |
| 3 = sim | Resolver agora. Cerimônia mínima com cuidado. |
| 2 = sim | Backlog ativo, próximas sessões. |
| Nenhuma | Backlog leve. **Não abrir sessão dedicada.** |

**Anti-padrão:** abrir sessão de "limpeza" / "auditoria" / "organização" para algo que falhou nas 3 perguntas. Sintoma de IA aplicando perfeccionismo onde Clayton precisa de movimento.

**Pergunta 1 reformulada (porque "produção" hoje é vazia):** "bloqueia rodar/testar" = não compila, gate falha hard, banco não aceita query. NÃO é "tem coisa feia no working tree" ou "ainda tem TODO no código".

**Pergunta 3 é a única que justifica cerimônia em pré-lançamento.** Concept_id semântico errado contamina ledger no primeiro teste real. Tudo o mais é "ajustamos depois".

**Caso especial — drift schema-vs-código:** se a Pergunta 1 ou 2 disparou por erro `coluna/relação não existe`, **antes de propor edição aplicar §4-B** (auditoria de feature ponta-a-ponta). Não é cerimônia adicional — é hipótese-padrão diferente: presumir regressão de genesis, não código morto.

---

## §0. As 7 perguntas — quando aplicar

As 7 perguntas existiam como cerimônia obrigatória. **Hoje viram filtro condicional.**

Aplicar quando §-1.5 detecta que a operação merece cerimônia (pergunta 3 = sim, ou decisão arquitetural irreversível). Em delete morto, rename simples, refactor mecânico — viram peso desnecessário.

**Quando aplicáveis:**

1. Qual problema MACRO esta alteração resolve?
2. Qual SSOT governa este comportamento?
3. Existe DT, decisão formal ou plano mestre relacionado?
4. Essa mudança cria realidade paralela?
5. Existe outro módulo, migration, gate, contrato HTTP, worker ou fluxo financeiro afetado?
6. A mudança é evolução institucional ou apenas correção local?
7. O sistema inteiro continuará coerente daqui a 3 sessões?

**Resposta ambígua quando aplicáveis = parar. Auditar antes de editar.**

**Distinção crítica:**
- **Direção normativa correta** ≠ **custódia institucional do ato**
- Norma prescreve resultado (Nomenclatura prescreve `amountCents`)
- Em pré-lançamento, custódia formal só importa para mudanças que tocam causalidade financeira ou contrato externo

---

## 1. Como operar com Clayton

Clayton é orquestrador. Não programa o sistema, mas conhece o estado normativo melhor que eu. Quando ele corrige uma assunção minha, ele tem razão até prova em contrário.

**O que funciona:**
- Comando PowerShell direto, sem prólogo. Ele cola o output, eu interpreto, próximo comando.
- Decisões pequenas eu tomo e anuncio. Ele só objeta se discordar.
- Bloco de código tem que rodar **sem editar**. Erros de aspas, escape, encoding são meus.
- Quando ele diz "vai", vou. Sem "tem certeza?".
- **Quando ele diz que algo não importa, é porque não importa.** Não inventar processo paralelo.
- Quando ele diz "backups são meus", são dele. Não criar processo de proteção redundante.

**O que NÃO funciona (já provado):**
- Cerimônia repetida ("Modo: GUARDIÃO", "Aguardando autorização"). Cortado.
- Pedir confirmação para coisas óbvias.
- Explicação longa antes de mostrar resultado.
- 4 versões defensivas de um comando "para garantir". Uma versão que funciona basta.
- Trocar de canal por ansiedade.
- Concluir sem aplicar §-1.5. Se proponho trabalho que falha nas 3 perguntas, parar.
- **Tratar tudo como ato de alta consequência.** Sistema sem usuários tem espaço para errar e corrigir.

---

## 2. Roteamento de canais

Três canais. Roteamento é decisão técnica baseada na natureza da operação.

### Mental model

- **PowerShell direto via Clayton** = bisturi manual. Cada comando validado. Decisão a cada passo.
- **Codex** = braço mecânico. Filesystem direto. Não decide arquitetura.
- **Claude Code** = engenheiro rápido sem memória institucional. Acesso real ao filesystem. Improvisa se entrar sem briefing rigoroso.

### Critérios

**PowerShell quando:**
- ≤5 comandos com decisão visual a cada passo
- Operações git em commit/branch/index (Codex tem `Permission denied` em `.git/index.lock`)
- Validação de gates, build, CORE_PURITY (Codex não tem `pnpm` no PATH)
- Discovery curto onde decisão depende do output

**Codex quando:**
- Escrita determinística e mecânica (sem decisão durante execução)
- Bloco de escrita longa em arquivo único
- Varredura ampla read-only
- **Auditoria antagonista**: validar plano contra estado real do disco/git/runtime
- PowerShell externo está fechando ou travando

**Claude Code quando:**
- Discovery exploratório paralelo em escopo fechado previamente
- Auditoria material com evidência de runtime/banco
- Trabalho em loop iterativo (rodar → ler → ajustar)
- **Autonomia total quando padrão repetido e risco baixo (§4-D)**
- Sempre com briefing rigoroso e escopo fechado quando risco alto

**Critério decisivo:** "exige interpretação arquitetural durante execução?" Sim → PowerShell. Não → Codex/Claude Code. Tamanho não é critério.

### Tipos de briefing

- **Antagonista**: "audite o estado real, questione meu plano". Codex acessa estado externo independente.
- **Colaborativa**: "execute exatamente este escopo mecânico".
- **Exploratória**: "descubra o que existe sobre X sem assumir nada".
- **Eco (proibido)**: "valide meu plano". Vira reformatação sem valor.

**Princípio decisivo:**

> **Briefing antagonista bom é estreito.** Quanto mais amplo o pedido, mais a IA auxiliar abandona custódia e tenta "melhorar o sistema". Codex responde "isso existe / isso não existe / isso conflita". Claude Code com briefing amplo responde "se eu redesenhasse, faria assim". Diferença não é capacidade — é tamanho de briefing.

**IA auxiliar só agrega valor quando audita estado externo real (disco, git, runtime, banco).** Se receber só meu raciocínio, vira espelho estilizado.

### Coordenação

- **Não existe mente coletiva.** Cada IA roda isolada.
- Clayton é o único orquestrador. **Eu não brieffo Codex/Claude Code diretamente.** Entrego briefing pronto, ele coordena.
- **Eu (web) não tenho acesso ao disco.** Claude Code tem. Não freá-la quando padrão é claro (§4-D).

### Construção de âncoras com acentos

Ambiente entre Claude e Codex pode reinterpretar caracteres acentuados. Construir âncora em runtime usando codepoints:

```
$crlf = [char]0x0D + [char]0x0A
$ancora = "// LEGACY: m" + [char]0x00F3 + "dulo em extin" + [char]0x00E7 + [char]0x00E3 + "o"
```

Codepoints são determinísticos onde texto literal pode falhar.

---

## 3. Padrões de execução

**Antes de edição em arquivo:**
1. `git diff -- <arquivo>` confirma working copy limpa. Match.Count == 1 valida contra disco (potencialmente dirty), não contra HEAD.
2. `git status --short -- <arquivo>` para tracked/untracked
3. Caminho exato com `Get-ChildItem -Recurse -Filter "<nome>"`. Existem múltiplos arquivos com mesmo nome.

**Edição via PowerShell:**
1. `[System.IO.File]::ReadAllText($path)` (default UTF-8 sem BOM)
2. **Verificar EOL real do arquivo** (`\r\n` vs `\n`)
3. Construir `$old`/`$new` com EOL **do arquivo**, não normalizado
4. `([regex]::Matches($content, [regex]::Escape($old))).Count -eq 1` antes de Replace
5. Se não bate, ABORT. Não regex frouxa.
6. `[System.IO.File]::WriteAllText($path, $content)` (default UTF-8 sem BOM)

**Atomicidade de commits:**
- Um commit = uma unidade lógica
- Antes de cada commit: build verde, gates passam
- Se grande, separar em commits menores

**Migration corretiva pós-aplicação (padrão F3-S4b/S6b):**
- Migration original aplicada e commitada NUNCA é reescrita
- Correções vão em migration nova com sufixo `b` (`F3-S4b`, `F3-S6b`)
- Migration ainda não aplicada PODE ser editada antes do apply (não é histórico ainda)
- "Migration aplicada ≠ migration editável; migration não aplicada = ainda faz parte do presente"

**Vivo > morto exige varredura:**
1. `Select-String` para callers diretos em `backend/src`
2. Grep de imports
3. Mapear rotas/registry/builder
4. Comentário "LEGACY", import comentado **não são evidência**
5. **Contrato HTTP/API é soberano até auditoria de consumers.** Função morta dentro de módulo com rota viva: módulo fica.

**Salvaguarda terminal:**
- Bloco PowerShell único, sem pausas interativas
- `$env:GIT_PAGER = 'cat'` no topo + `--no-pager` em comandos pontuais
- Output >300 linhas → capturar em arquivo
- Ao colar output em chat, **não colar histórico junto** — paste-bug do PowerShell gera cascata de erros

---

## 4. Armadilhas conhecidas

- **CRLF vs LF heterogêneo**: arquivos do mesmo módulo podem ter EOL diferentes. `git stash` aciona `core.autocrlf` no Windows e converte LF→CRLF silenciosamente. Sempre verificar EOL real antes de editar.

- **Encoding default vs Latin-1**: `ReadAllText` default lê byte `F3` como U+00F3 (ó) por fallback Latin-1. Para edição cirúrgica funciona; para mudanças amplas de encoding, validar antes.

- **Encoding em `psql -c` no Windows**: caracteres acentuados em strings via `-c` falham com "sequência de bytes inválida UTF-8". Usar arquivo SQL temporário (`-f`) em vez de `-c` quando string tem acento.

- **Arquivos canônicos untracked**: `PLANO_MESTRE_*.md` etc. podem estar untracked apesar de referenciados. Verificar com `git status --short <path>`.

- **Git dirty pré-existente**: working tree do projeto tem ~1100 itens dirty pré-existentes. **Estado-base, não introduzido pela sessão.** Filtrar diff para o escopo da sessão (`git diff --stat -- <pasta>`).

- **Ambiguidade de nomes de arquivo**: 6 `distribution.service.ts` no projeto (achado em auditoria). PLANO_MESTRE pode mencionar nome sem qualificar caminho. Confirmar caminho exato antes de operar.

- **IAs alucinam conteúdo de arquivo sob pressão de opinar**: outra Opus inventou conteúdo de `bank-transaction.port.ts` sem ter rodado `view`. ChatGPT propagou. Apenas Codex (com acesso real) detectou. **Não absorver conclusões de IA auxiliar sem cruzar contra evidência colada na sessão atual.**

- **IAs confundem direção normativa com custódia institucional**: "Norma autoriza" ≠ "ato é autorizado". Em pré-lançamento, relevante só para causalidade financeira em runtime.

- **Briefing amplo a Claude Code = redesign**: ela sai do papel "auditar estado" e vira "redesenhar visão". Estreitar.

- **Drift schema-vs-código (regressão de genesis)**: query referencia coluna/tabela que o banco não tem **NÃO significa código morto**. Aplicar §4-B antes de propor delete ou quarentena.

- **Inferência por naming pattern em PKs é não-confiável**: o sistema NÃO tem padrão único. `tenants.id`, `events.id`, `groups.id` usam genérico; `companies.company_id`, `profiles.profile_id`, `services.service_id` usam `{tabela}_id`. Sempre verificar via `information_schema.key_column_usage`. Aplicar §4-C.

- **Norma pode estar aspiracional**: `07_NOMENCLATURA_CANONICA.md §4.4` diz PK = `id`, mas banco real usa `{tabela}_id` na maioria. Norma escrita não é runtime. Aplicar §4-C.

- **`sed` regex pode pegar declarações mas deixar referências em WHERE**: ao renomear coluna em SQL, verificar todas as ocorrências (declaração + WHERE + JOIN + comentário). Auditoria explícita pré-apply é obrigatória.

- **Auditoria externa (ChatGPT, Codex) pega bugs que passam em revisão interna**: F3-S5 teve achado de subqueries sem `country_id`; F3-S6 teve achado de PK real `tenants.id` (não `tenant_id`). Vale o custo da rodada extra antes de aplicar.

- **CORE_PURITY baseline**: `1278/68/319/891`. Drift = parar e investigar. Mover código (não relaxar baseline) é quase sempre a resposta. Drift para baixo continua sendo drift.

- **`git status` enorme não é bug**: `node_modules/` historicamente tracked. Filtrar para escopo da sessão.

- **Output truncado pelo PowerShell**: `Select-Object -Last N` ou `-First N` sempre.

- **`return` em script PowerShell não interrompe pipeline**. Para abortar: `exit 1`.

- **`Select-String` não tem `-Recurse`**. Usar `Get-ChildItem -Recurse | Select-String`.

- **Memória do Codex e PowerShell são separadas.** Estado vive no disco e no git.

- **Paste-bug do PowerShell**: colar output anterior + bloco novo gera cascata. Limpar terminal antes de cada paste novo.

- **Prompts longos com aspas/heredocs cortam no terminal de IA**: comandos com `cat << EOF` ou `$msg = @"..."@` longos podem ser truncados durante paste. Usar arquivo temporário (`/tmp/cf.txt`) e `git commit -F` em vez de mensagem inline.

---

## 4-A. `_orphans/` — preservação técnica, não lixeira

**Pasta gitignored na raiz do repo.** Preserva conhecimento técnico fora do runtime/build/gates. Não é codebase paralela, não é backup oficial.

**Por que existe:** o projeto passou por refatoração estrutural pesada, reorganização core/modules, gênese de banco, migração semântica. Alguns arquivos perderam acoplamento ao runtime atual mas **não perderam valor técnico ou histórico**.

**Classificação tripla obrigatória antes de propor delete:**
1. **Morto e inútil** → delete definitivo
2. **Morto mas potencialmente útil** → `_orphans/`
3. **Vivo** → manter e corrigir

**Default: suspeitar de categoria 2 antes de assumir categoria 1.**

Critérios para categoria 2 (preservar):
- Tem lógica de domínio (orquestração, regra de negócio, concept_id, decisão financeira)
- Tem heurística reaproveitável (algoritmo, política de distribuição, validação custom)
- Tem contexto histórico (escrito em fase anterior do sistema, registra decisão prévia)
- Existe chance > zero de virar útil em refactor futuro

**Convenção:**
- **Padrão principal: `.ts.txt`** com header de quarentena
- `.ts` apenas com autorização explícita do Clayton, caso a caso

**Header obrigatório:**
```
// QUARENTENA — movido em <YYYY-MM-DD>
// ⚠ ESTE ARQUIVO NÃO COMPILA. Preservação técnica fora do runtime.
// Origem: <caminho exato>
// Linhas originais: <intervalo>
// Commit anterior (estado vivo): <hash>
// Razão: <por que saiu do runtime>
// Recuperar: git show <hash>:<caminho>
// Sessão: <identificador>
```

**Regras invioláveis:**
- Nada em `_orphans/` vira dependência runtime
- Nada em `_orphans/` é importado por código tracked
- `_orphans/` não substitui rastreabilidade institucional (git history continua canônico)
- Esvaziamento periódico é responsabilidade do Clayton

**Análogo para refactor órfão (com direção normativa válida mas sem sessão de custódia):** `git stash push -m "<contexto>-pendente-custodia" -- <arquivo>`.

---

## 4-B. Drift schema-vs-código é regressão de genesis, não código morto

**Contexto que justifica esta lei:** o sistema foi reconstruído pós-genesis. Banco refeito do zero, código de aplicação manteve fase anterior. Drift entre o que o código espera e o que o banco oferece é a regra, não exceção.

**Implicação operacional:** quando uma query/INSERT referencia coluna ou tabela que não existe no banco, **a hipótese-padrão é "schema regrediu", não "código morto".**

### Inversão da carga de prova

Padrão errado (apagar primeiro, perguntar depois):

```
Query quebra → coluna não existe → "código órfão" → delete ou _orphans/
```

Padrão correto (auditar feature de ponta a ponta antes de qualquer ação):

```
Query quebra → coluna não existe → AUDITAR:
  1. Frontend: existe UI/form que coleta esse dado?
  2. Backend service: existe processamento (parse, validação, INSERT)?
  3. Rotas: há POST/PUT que aceitam esse dado no body?
  4. Outros consumidores: outras queries leem essas colunas?

Se 2+ camadas têm a feature implementada → REGRESSÃO DE GENESIS.
  → Adicionar schema (migration ALTER TABLE ADD COLUMN IF NOT EXISTS)
  → NÃO apagar código
  → NÃO mover para _orphans/

Se nenhuma camada tem feature → §4-A (categoria 1 ou 2) se aplica.
```

### Critério de classificação

| Sinal | Classificação | Ação |
|---|---|---|
| Frontend + service + INSERT existem; só falta schema | **Regressão de genesis** | Migration alinha banco ao código |
| Só código de leitura (SELECT) órfão; nenhuma camada grava | Provável categoria 2 do §4-A | Quarentena |
| Nenhuma referência viva em lugar nenhum | Categoria 1 do §4-A | Delete |

### Anti-padrão crítico desta IA

Erro recorrente: **propor delete/quarentena para acalmar o log**, antes de auditar se a feature existe de ponta a ponta.

**Correção:** se a query toca dado de domínio (endereço, contato, identidade, financeiro, transação), aplicar a auditoria 1-4 acima ANTES de cogitar remoção. Log poluído por 1 sessão a mais é custo trivial; perder feature 80% pronta é custo institucional alto.

### Quando aplicar

Sempre que aparecer um destes erros em runtime:
- `coluna X não existe` / `column X does not exist`
- `relação X não existe` / `relation X does not exist`
- `função X não existe` / `function X does not exist`
- Tipo TS reclamando de propriedade ausente em dado retornado de query

**Não aplica para:** drift de nomenclatura puro (camelCase ↔ snake_case com a mesma coluna existindo). Esse é cosmético, basta renomear.

### Caso canônico

Sessão F2-2 (2026-05-08): propus delete da query órfã `SELECT c.cep ... FROM companies` em `core.service.ts:472`. Clayton freou — primeiro pediu quarentena, depois auditoria ponta-a-ponta. Auditoria revelou `CompaniesManagerForm.tsx` (frontend) + `companies.service.ts` (INSERT linha 464) com feature inteira; só faltavam 8 colunas de endereço. Era regressão de genesis. Esse achado abriu F3 (Location Core).

---

## 4-C. Schema vivo > convenção esperada

**Contexto:** norma `07_NOMENCLATURA_CANONICA.md §4.4` prescreve `id` como PK. Banco real usa `{tabela}_id` na maioria das tabelas (`companies.company_id`, `profiles.profile_id`, `services.service_id`), mas `id` em algumas (`tenants.id`, `events.id`, `groups.id`). **Não há padrão único.**

**Lei:**

Quando há divergência entre norma escrita e schema material, **schema vivo manda**. Migrations futuras seguem padrão real do banco em que vão operar, não a aspiração da norma.

### Regras operacionais

1. **Não inferir PKs por naming pattern.** Sempre verificar via `information_schema.key_column_usage` antes de criar FK.
2. **Migration nova segue padrão da tabela referenciada.** FK para `tenants` referencia `tenants(id)`. FK para `companies` referencia `companies(company_id)`.
3. **Documento que não representa runtime vira teatro.** Se norma escrita diverge do banco, abrir DT para reconciliação institucional. Não corrigir banco em massa.
4. **Reconciliação normativa é sessão dedicada.** Não tentar resolver enquanto faz outra coisa.

### Caso canônico

Sessão F3-S6 (2026-05-08): planejei `headquarters_address_id REFERENCES tenants(tenant_id)` por inferência. Auditoria revelou que PK de `tenants` é `id`, não `tenant_id`. Mudei FK para `tenants(id)`. **Não tentei renomear `tenants.id` para `tenants.tenant_id` "para padronizar"** — isso seria refatoração de 199 tabelas para satisfazer norma aspiracional. DT-norma-pk-vs-banco-real aberta para reconciliação futura.

---

## 4-D. Autonomia operacional da Claude Code

**Contexto:** Claude Code tem acesso direto ao disco, executa comandos, edita arquivos, valida, commita. Eu (web) não. O ping-pong existe quando insiro passo intermediário desnecessário em operações que ela já consegue fazer sozinha.

**Lei:**

Quando o caminho está claro e o padrão é repetido (migration corretiva trivial, padrão similar a sessão anterior validada), **passar escopo completo de uma vez para Claude Code, não fragmentar em "autorize agora"**.

### Critérios para autonomia total

| Situação | Autonomia |
|---|---|
| Migration corretiva trivial seguindo padrão validado em sessão anterior | ✅ Total |
| Apply de SQL puro em catálogo global, banco vazio, sem dados | ✅ Total |
| Atualização de comentários, formatação, lint mecânico | ✅ Total |
| Decisão arquitetural / institucional (DECISION-XXXX) | ❌ Babá |
| Bug não-trivial que precisa investigação cruzada | ❌ Babá |
| Operação destrutiva (DROP, DELETE em massa, force push) | ❌ Babá |
| Primeira vez que padrão é executado | ❌ Babá (após validação, vira ✅) |

### Estrutura de prompt autônomo

```
EXECUTAR <X> — autonomia total. Sigo a tua mão livre.

Contexto: <referência ao padrão validado anterior>

Escopo completo:
1. <passo 1>
2. <passo 2>
...
N. Reportar: hash do commit + git log --oneline -5

Restrições:
- <NÃO toque em X, Y, Z>
- Se ERROR ou gate vermelho: PARAR, reportar, NÃO commitar

Você é executor com autonomia. Reporte só o resultado final.
```

### Caso canônico

Sessão F3-S6b (2026-05-08): migração corretiva `ADD COLUMN created_by_tenant_id` em `addresses`. Padrão idêntico a F3-S4b. Em vez do ping-pong de 30+ turnos da sessão anterior (autoriza etapa, cola output, autoriza próxima), passei escopo completo de uma vez. Claude Code executou autonomamente em ~2min: criou arquivo, validou banco, aplicou, validou pós, rodou 4 gates, commitou (`3c5e963d`).

### O que NÃO virou autonomia

- Decisões institucionais (DECISION-XXXX) ainda passam por mim + Clayton
- Auditoria de plano antes de executar continua sendo conversa
- Atualização de `opus.md` / `STATUS_GLOBAL` continua sendo Clayton direto

---

## 5. Fontes de verdade — runtime primeiro, documentação depois

**Para entender o que existe (runtime):**
1. **Disco vivo** (`Get-ChildItem`, `Select-String`, `view`) — verdade material
2. **`SRC_FULL.txt`, `MIGRATIONS_FULL.txt`** — código e schema consolidados (pode estar defasado vs HEAD)
3. **`git log`, `git diff`, `git blame`** — história e estado atual
4. **Banco vivo** (`psql -d unificard_dev`) — schema real, não inferido

**Para entender o que deve existir (norma):**
5. **`STATUS_EXECUCAO_GLOBAL.md` (final)** — última sessão, DTs, próximos passos. Append-only no FINAL. `Select-Object -Last 200`.
6. **`REMEDIATION_DECISIONS_LOG.md`** — DECISION-XXXX.
7. **`LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`** — constituição. §5 (não-duplicação), §11 (evolução coerente), §2 (nenhuma camada cria realidade paralela).
8. **`07_NOMENCLATURA_CANONICA.md`** — §4.7 monetário (`amountCents` BIGINT), §4.12 referências, §18 conversões DB↔Backend. **§4.4 (PK=id) é aspiracional — ver §4-C.**
9. **`SSOT_REGISTRY_UNIFICARD.md`** — autoridades de domínio. Bank é autoridade contábil.
10. **`PLANO_MESTRE_REMEDIACAO_CORE_MODULES.md`** — roteiro estratégico. **Hipótese, não prescrição cega.**
11. **`UNIFICARD_SESSION_BOOT_PROTOCOL.md`** — protocolo de operação.

**Hierarquia normativa:** Constituição → Leis Operacionais → Lei de Coerência Sistêmica → Nomenclatura Canônica → SSOT Registry.

**O que ignorar:**
- `ESTOU_APRENDENDO.md` — não-normativo
- `tmp-*.ps1`, `restore-*.ps1` em `docs/99_archive/`
- Versões antigas deste opus.md
- `SYSTEM_REMEDIATION_PLAN.md` — congelado em 2026-04-21

---

## 6. Início de sessão

1. Ler **final** de `STATUS_EXECUCAO_GLOBAL.md` (`Select-Object -Last 200`)
2. Ler este `opus.md` inteiro
3. Ler `UNIFICARD_SESSION_BOOT_PROTOCOL.md` se primeira interação ou versão mudou
4. Pedir HEAD + 4 gates + CORE_PURITY antes de ação propositiva
5. Aguardar Clayton declarar escopo. **Não oferecer trabalho proativo.**
6. Quando ele declarar:
   - **Aplicar §-1.5 primeiro** (3 perguntas)
   - Se sim em qualquer → executar
   - Se não → confirmar com Clayton se vale abrir sessão
7. Se a operação merece cerimônia (causalidade, irreversível): aplicar §0 (7 perguntas)
8. Antes de propor edição: `git diff -- <arquivo>`

**Anti-padrão de início:** começar com auditoria proativa, listar DTs, propor frente nova. Clayton diz o que quer, eu executo.

---

## 7. Fim de sessão

1. Verificar 4 gates + CORE_PURITY = baseline. Drift → resolver antes de fechar.
2. Atualizar `STATUS_EXECUCAO_GLOBAL.md` (bloco datado, append no FINAL)
3. Se decisão arquitetural: `REMEDIATION_DECISIONS_LOG.md` (DECISION-NNNN)
4. Se mudou plano: `PLANO_MESTRE_*.md` atualizado
5. Atualizar este opus.md: aprendizados novos em §8, padrões em §3-4 se virou regra
6. **Não atualizar** `SYSTEM_REMEDIATION_PLAN.md` (congelado), `PLANO_BASE_MODULO.md` (template), `ESTOU_APRENDENDO.md` (não-normativo)

**Anti-padrão de fim:** criar 5 documentos de fechamento para sessão de 1 commit. Atualização proporcional ao escopo.

---

## 7-A. Princípio: modo operante = ativação econômica contextual (Clayton, 2026-05-16)

Princípio operacional adicionado por autorização explícita de Clayton durante implementação do MVP do modo operante.

### Definição

**Operar não é "modo trabalho" nem "modo profissional". É camada de ativação econômica contextual.**
**Modo operante NÃO cria capability. REVELA capabilities/delegações/vínculos que o actor já possui.**

### Sequência arquitetural

```
actor
  → authority chain + capabilities + delegações + vínculos (SSOT)
  → modo operante (filtra: o que pode ser exercido economicamente AGORA)
  → projeção contextual (homepage, quick actions, sidebar)
```

Authority/delegação/vínculo são SSOT. Modo apenas projeta. Se delegação é revogada → contexto correspondente desaparece naturalmente. Sem cleanup, sem troca de actor.

### Frase-âncora dupla (reflexo permanente)

> **Modo operante reorganiza prioridade, não reorganiza soberania.**
> **Não cria capability, revela capabilities já autorizadas.**

### Implicação para implementação

**v1 (MVP atual, 2026-05-16):** listas hardcoded por `(actor_type, mode)` em `actorContextConfig.ts`. Valida UX (toggle, persistência, projeção, cross-mode). Custo de erro mínimo.

**v2 (NÃO implementar sem validar v1):** substitui hardcode por resolver dinâmico de capabilities/delegações. Profissão vira HINT, não fonte primária.

**REGRA INSTITUCIONAL:** MVP hardcoded primeiro, validar UX, depois v2 dinâmica. Não pular para v2 sem MVP validado, mesmo com modelo conceitual mais elegante.

### Quando aplicar este princípio

- Toda decisão sobre quick actions, sidebar, home contextual: passa pelos 2 filtros âncora
- Toda proposta "adicionar modo X": exige resposta "X é capability já existente ou cria autoridade nova?" — se segundo, vira frente de authority, não modo
- Profissão é hint dentro de Operar, não eixo próprio

Memória institucional permanente: `~/.claude/projects/C--unificard/memory/project_modo_operante.md`. Detalhes adicionais em `code.md §31`.

---

## §8. Histórico de sessões (append-only, mais recente em cima)


### 2026-05-26 — Camada 1 fixed_price_escrow fechada (F1/D2/D-money/Statement/Canonicalização)

**Sequência da Camada 1:**
- F1 (`db47798d`) — `service_orders` materializada + `seller_pending` no enum + flow `fixed_price_escrow`. Estado-only.
- D2 (`40afc3f1`) — `seller_pending → release_approved` via buyer-confirm OU timeout. Estado-only.
- D-money (`adcbc039`) — release financeiro real `escrow_payments → actor_wallet`. Atomicidade + idempotência provadas. ZERO `seller_available/user_wallet/credit` como destino.
- Statement (`b62ab6b9`) — `GET /identity/wallet/actor-statement` com saldo (bank_ledger SSOT) + origem rastreável (serviceOrderId/paymentRequestId/paymentIntentId/payerActorId).
- Canonicalização (esta entrada) — DECISION-0046 fixa `actor_wallet` como carteira canônica de qualquer actor econômico.

**REGRA CANÔNICA (DECISION-0046, vinculante para módulos futuros):**

> Para qualquer módulo futuro que precise creditar saldo de actor (PF, empresa, prestador, motorista, entregador, vendedor, bar, restaurante, fornecedor, organizador de evento, ou qualquer entidade econômica) — o destino canônico é `bank_accounts.account_type='actor_wallet'`. NÃO criar wallet paralela. NÃO reusar `user_wallet`/`seller_available`/`credit` para esse papel.

**Como instanciar:** `bankAccountService.ensureActorWalletAccount(tenantId, actorId, currency?)`. Idempotente, composite `owner_id='${actorId}:actor_wallet'`, actor_id preenchido por constraint.

**Saldo:** SEMPRE via `bankAccountService.getBalance` → `bank_ledger`. Nunca derivar, calcular paralelo, cachear como verdade.

**Read-model:** `modules/wallet/actor-wallet-statement.service.ts` ou `GET /identity/wallet/actor-statement`.

**Vinculados:** DECISION-0046 (canonical); DT-ACTOR-WALLET-PAYOUT-WIRING (saque externo é frente posterior); DT-CAMADA1-FEE-SPLIT (fee de plataforma deve ser materializado na ENTRADA via bank_splits); DT-CANONICAL-WALLET-GUARD-PENDING (enforcement automático é frente futura — hoje é documental + tipo TS + CHECK constraint).

**HEAD:** `b62ab6b9` (avança após commit desta canonicalização).


### 2026-05-11 — Bank Genesis Wave COMPLETO + C15 FIXED

**Descoberta ao retomar:** Bank Genesis Wave (beta.1.c a beta.5) ja havia sido aplicado em sessao anterior nao documentada em opus.md. TS compila limpo (0 erros). Stash Bank Genesis ja aplicado.

**Commits Bank Genesis em HEAD:**
| Commit | Descricao |
|--------|-----------|
| d5f5cff7 | Genesis-align consolidation + cents contract |
| 467eae18 | legacy adapter calcula saldo via ledger |
| 1b3d35d6 | financial-dashboard usa ledger |
| ab469d8e | remove updateCachedBalance dead code |
| 0460e66f | apply Genesis bank-account repository provider |

**C15 FIXED nesta sessao:**
- Migration: 20260530530000_tenant_products_drop_price_numeric.sql
- Remove price NUMERIC residual de tenant_products (2 de 3 tabelas ja estavam corrigidas)
- Commit: 3db7245a

**Estado atual:**
| Item | Estado |
|------|--------|
| HEAD | 3db7245a |
| Build TS | 0 erros |
| Gates | PASS (critical_new=0) |
| Stash@{0} | C65-distribution-amount-rename (Bank Genesis ja aplicado) |

**Proximas frentes (filtro par.-1.5):**
- C54: 9 caminhos financeiros sem authority gate
- C55: authority-decision.service fail-open
- C7: bloqueado por C27 (DECISION_PENDING)

---

### 2026-05-09 — Smoke E2E principal PASSOU

**Stack rodando:**
- Backend via `tsx BOOT.ts` (não `pnpm start` — drift ESM com `.js` obrigatório, debt registrado)
- Frontend Vite em :5173 OK
- Banco `unificard_dev` conectado, health 200

**Endpoints validados (200):**
- `POST /auth/register` 201
- `POST /auth/login` 200
- `/home`, `/perfil`, `/bank/balance`, `/bank/statement`, `/bank/user/group-allocation`

**Drift corrigido nesta sessão (não commitado):**
- `groups.repository.ts` — `gm.joinedat` → `gm.created_at AS "joinedAt"` (Claude Code)
- `auth.service.ts:316` — birthdate off-by-one corrigido pelo Codex: `new Date(birthdate)` → `normalizeBirthdate(birthdate)`, INSERT com `$3::DATE`. Dado smoke02816915 migrado para 1991-04-11. Validado em registro novo (birth34713474) e antigo.
- `auth.service.ts:344` — `users.plan` default no register (`plan = 'free'`) + backfill de 4 usuários com `plan IS NULL`. Validado: `GET /plan` 200 para smoke antigo e usuário novo `plan35178554`.
- `groups.repository.ts:605` — alias actor-based + timestamps snake_case (Codex). 7 substituições no bloco de invites: `id AS invite_id`, `invited_actor_id AS invited_user_id`, `invited_by_actor_id AS invited_by_user_id`, `expires_at AS "expiresAt"`, `created_at AS "createdAt"`, `COALESCE(responded_at, created_at) AS "updatedAt"`, `responded_at = now()` em UPDATE, `ORDER BY created_at`. Schema vivo é actor-based + snake_case; código TS mantém contrato legacy via alias. Validado: `GET /groups/invites/mine?status=pending` 200.
- `companies` module — gap de schema corrigido + alias rename id (Codex). Investigação revelou drift inverso: código TS pressupunha 7 colunas inexistentes em `company_users`. Aplicado caminho honesto (DECISION-0023):
  - **Migrations:**
    - `20260530520000_add_company_users_updated_at.sql` — ADD `updated_at` TIMESTAMPTZ + trigger `trg_company_users_updated_at` usando função `update_updated_at_column` (criada em F3-S4)
    - `20260530520500_add_company_users_rbac_columns.sql` — ADD 6 colunas: `role_description` (TEXT nullable), `can_manage_financial`, `can_manage_employees`, `can_view_reports`, `can_manage_services` (BOOLEAN NOT NULL DEFAULT false), `metadata` (JSONB NOT NULL DEFAULT '{}')
  - **Código (`companies.service.ts`):**
    - Linha 571: `RETURNING id AS company_user_id, created_at, updated_at`
    - Linhas 990, 1114: `cu.id AS company_user_id` (alias)
    - Linhas 1002, 1126: `cu.updated_at as cu_updated_at` (removeu mentira `NULL::timestamptz`)
    - Linhas 1372-1388: `SELECT cu.*` expandido para 16 colunas explícitas com `cu.id AS company_user_id`
    - Linha 1391: `WHERE cu.id = $1::uuid`
    - Linha 1536: `WHERE ... AND id != $3::uuid` (UPDATE bulk demote primary)
    - Linha 1566: `AND cu.id = ${paramIdx}::uuid`
  - **Schema final `company_users`:** 16 colunas (10 originais + 6 novas)
  - **Validado:** `GET /companies` 200, build OK, `/health` 200. Trigger `updated_at` criado e ativo (não exercitado por banco vazio).

**0 erros smoke abertos. Smoke E2E principal completo.**

**Erros não-bloqueantes em loop nos workers (ruído operacional, não tocar agora):**
- `ReleaseWorker`: intent 3327ef51 "Cannot transfer to the same account" (dado órfão)
- `ReconciliationWorker`: "coluna pi.status não existe" (hint: bs.status)
- `SlaMonitorWorker`: "coluna status não existe"
- `PaymentWorker`: Redis (BullMQ desconectado, REDIS_ENABLED=false desligaria)

---

### 2026-05-09 (parte 3) — F3-S8 + F3-S9: infraestrutura de endereço pronta

Sessão preparatória após o smoke fechar verde. Schema canônico de endereço alinhado, writer disponível. Não tocou comportamento visível em companies/perfil — isso fica para F3-S10a/S10b.

**Material aplicado (não commitado):**

- **F3-S8** — Migration `20260530521000_add_companies_primary_address_id.sql`:
  - `companies.primary_address_id UUID REFERENCES addresses(address_id) ON DELETE SET NULL`
  - Forward-only, mantém colunas legacy intactas (`cep`, `address`, `city`, `state`, etc.)

- **F3-S9a** — Reader fix em `location.repository.ts`:
  - 6 queries corrigidas com alias SQL: `iso_alpha2 AS code` (countries), `abbreviation AS code` (states)
  - `is_active` agora lido honestamente (não mais hardcoded `isActive: true`)
  - `findAllCountries` filtra `WHERE is_active = true`
  - Tipos `CountryRow`/`StateRow` realinhados com query real (id, countryId)
  - **Contrato externo intacto** — `Country.code` e `State.code` mantidos em ~20 consumidores
  - Validado: `GET /locations/countries` 200 retornando `[{"code":"BR","name":"Brasil","isActive":true}]`

- **F3-S9b** — Writer canônico em `location.repository.ts`:
  - `createAddress(data, createdByTenantId)` — INSERT em `addresses` com 14 colunas, RETURNING aliased camelCase. `is_geocoded` derivado em SQL (true se lat presente)
  - `assignAddress(addressId, ownerType, ownerId, role, isPrimary?)` — INSERT em `address_assignments`
  - 5 tipos novos em `location.types.ts`: `CreateAddressInput`, `Address`, `AddressOwnerType` (7 valores), `AddressRole` (7 valores), `AddressAssignment`
  - Honra DECISION-0021: `created_by_tenant_id` aceita `null`, soft-audit
  - Não exercitado por endpoint — validação cruzada via build PASS

**Validação:**
- `pnpm build` PASS sem erro novo
- `/health` 200, banco conectado
- `/locations/countries` 200 com seed Brasil

**Observações para sessões futuras (DTs implícitas):**
- `Address.source` ficou `string` enquanto `CreateAddressInput.source` é union estrito. Inconsistência menor; alinhar em refactor futuro.
- TypeScript não captura constraint `addresses_latlng_paired` (banco trava se lat sem lng). Documentar para chamadores em F3-S10a.

**Próxima sessão (F3-S10a + S10b + smoke):**
- F3-S10a: adapter writer em `companies.service.ts` — INSERT em `addresses` + `address_assignments` com role='HQ' ao criar empresa, gravar `primary_address_id`. Mantém INSERT nas colunas legacy durante coexistência.
- F3-S10b: adapter reader em `core.service.ts:472` — substituir `SELECT c.cep, c.address...` por JOIN em `addresses` via `primary_address_id`. Fallback legacy.
- Smoke E2E: criar empresa pela API com endereço → ler em `/profile` → endereço aparece via `addresses` (fecha A5 ponta-a-ponta).

---

### 2026-05-09 — ReleaseWorker C1: intent órfã neutralizada (entrada original imprecisa, corrigida em parte 5)

**Aviso:** esta entrada foi escrita durante a sessão e contém imprecisão material. A correção institucional honesta está na entrada "parte 5" desta mesma data.

**O que de fato aconteceu nesta sessão:**
- intent órfã 3327ef51-e1ce-456f-a993-c018c6f60102 marcada como failed manualmente
- metadata recebeu: {"failure_reason":"missing_seller_lifecycle_accounts"}
- ReleaseWorker parou de fazer loop sobre essa intent específica

**O que esta entrada AFIRMOU mas é impreciso:**
- "Removido fallback em backend/src/modules/bank/bank-account.repository.ts" — INEXATO
- "fallback removido completamente" — INEXATO

**Realidade material descoberta em parte 5:**
- O método `getAccountByOwnerAndType` que continha o fallback "qualquer system" NUNCA esteve em HEAD
- Em HEAD existe apenas `getSystemAccount` antigo, sem fallback semântico
- O fallback documentado aqui está dentro de refactor amplo guardado em `stash@{0}` (bank-account-genesis-alignment-pendente-custodia), nunca commitado
- C1 (loop ReleaseWorker) foi tratado pela neutralização manual da intent órfã, não por remoção de fallback no código

**Aprendizado institucional VÁLIDO (independente da imprecisão acima):**
- fallback semântico em domínio financeiro cria autoridade implícita clandestina
- "qualquer conta system serve" viola soberania de lifecycle accounts
- ausência estrutural deve falhar explicitamente, nunca improvisar identidade financeira

Gates rodados (PASS):
- actor-writer
- bank-ledger
- regression-guards

### 2026-05-08 — Location Core completo (F3-S4 a F3-S6b)

**Commits:**
- `c6cc5038` — F3-S4: base administrativa (countries/states/cities/neighborhoods + helpers + GENERATED COLUMN `name_normalized`)
- `ffc16063` — F3-S4b + F3-S5: constraint `UNIQUE(country_id, abbreviation)` em states + seed Brasil mínimo (1 país + 27 estados + 27 capitais)
- `d0821d56` — F3-S6: addresses + address_assignments + `tenants.headquarters_address_id`
- `3c5e963d` — F3-S6b: `created_by_tenant_id` em addresses (soft-audit, DECISION-0021)

**Estado final do Location Core:**

| Camada | Status |
|---|---|
| countries / states / cities / neighborhoods | ✅ schema + seed BR (1+27+27) |
| Helpers (`normalize_name`, `update_updated_at_column`) | ✅ ativos |
| Constraints defensivas | ✅ name_normalized + abbreviation unique |
| addresses | ✅ entidade canônica + soft-audit tenant |
| address_assignments | ✅ polimórfico, event sourcing leve |
| tenants.headquarters_address_id | ✅ FK adicionada |

**Decisões institucionais consolidadas:**
- DECISION-0020: Location Core como infraestrutura territorial soberana
- DECISION-0021: tenant-awareness em addresses (Opção A refinada — global compartilhado + soft-audit via `created_by_tenant_id`)
- F3-S5 = seed estrutural, não seed de produção nacional (rollout incremental)
- Seed fundacional usa INSERT PURO, não ON CONFLICT
- Subqueries territoriais filtram por country_id explicitamente (sigla UF não é globalmente única)

**Leis novas adicionadas nesta sessão:**
- **§4-C** — Schema vivo > convenção esperada (ver seção 4-C acima)
- **§4-D** — Autonomia operacional da Claude Code (ver seção 4-D acima)

**Aprendizados operacionais:**
- ChatGPT pegou bug em F3-S5 (subqueries sem `country_id`) que passou em revisão interna
- Codex pegou que arquivo local divergia de `MIGRATIONS_FULL.txt` (snapshot antigo)
- `sed` regex pode pegar declarações mas deixar referências em WHERE — auditoria explícita pré-apply é obrigatória
- Auditoria externa não é cerimônia; é defesa real contra alucinação interna
- F3-S6b foi de 30+ ping-pongs (padrão antigo) para 1 prompt + 1 reporte (autonomia §4-D)

**Pendências F3 (próximas sessões):**
- F3-S8: ADD `companies.primary_address_id` (resolve A5 do log de runtime)
- F3-S9: LocationRepository TS (writer canônico de addresses)
- F3-S10a/b: adapter writer/reader em companies.service e core.service
- F3-S11: endpoint manual `POST /location/addresses`
- F3-S11b: CEP enrichment com cache + fallback gracioso (não-bloqueante)
- F3-S12: testes integration repository
- F3-S13: smoke E2E companies+endereço
- F3-S7 [BLOQUEADO — decisão pendente sobre escopo de economic_regions, NÃO por DECISION-0022 que é sobre groups invites]: economic_regions + tenant_operational_regions

**DTs abertas:**
- DT-norma-pk-vs-banco-real: norma §4.4 (PK=`id`) diverge do banco real ({tabela}_id majoritário) — sessão dedicada para reconciliação institucional
- DT-eol-autocrlf-windows: warnings LF→CRLF não-bloqueantes (cosmético)
- DT-debug-code-em-service: `PARAM_DEBUG` em `core.service.ts:218` (deixar para depois)
- F1 stash `C65-distribution-amount-rename-pendente-custodia` em `stash@{0}` pendente decisão

---

### 2026-05-08 — F2-S1 fechada (A1/A2/A3) e F3 aberta

**F2-S1:** drift `updatedAt`/`createdAt` em queries SQL de `core.service.ts` (migrations 0125-0127 renomearam para snake_case, código não acompanhou). Edição cirúrgica: 4 linhas, commit `8a47369c`. 4/4 gates PASS. Status atualizado em `8e28a951`.

**F2-S2 → F3 (escalada):** começou tentando corrigir A5 (`coluna c.cep não existe` em `core.service.ts:472`). Aplicação de §4-B revelou que feature de endereço de empresa estava 80% pronta no código — só faltava schema. Investigação Codex + ChatGPT descobriu que **plano canônico de Location Core já existiu e foi recuado** durante reconstrução pós-genesis. Migrations arquivadas em `migrations_archive/0360-0363`.

**F3-S1, S2, S3:** auditoria geográfica + arqueologia arquitetural + decisão fundacional. Resultado: DECISION-0020 aprovada com 6 dimensões fechadas. Schema canônico aprovado.

**§4-B nasceu nesta sessão.** Eu propus delete da query órfã. Clayton freou 2 vezes — primeiro pediu quarentena, depois pediu auditoria ponta-a-ponta. Sem essas frenagens, eu teria criado mais um pedaço de realidade paralela.

---

### 2026-05-07 — recalibração: produto > processo

**Contexto:** Sessão 3 da Frente 3 levou 30+ turnos para deletar `autoDistribute` (função morta, zero callers). Clayton interveio múltiplas vezes apontando excesso de cerimônia. Auditorias paralelas confirmaram que **o sistema tem fundação sólida onde importa** — gap é em observability/preventivo, não em runtime crítico.

**Princípios consolidados nesta sessão (depois embebidos em §-3 a §-1.5):**
- A função desta IA é destravar Clayton para ver sistema rodando, não criar processo institucional
- Cerimônia tem custo, vale só para causalidade financeira em runtime ou contrato externo
- Sistema sem usuários tem espaço para errar e corrigir — aproveitar
- Briefing antagonista bom é estreito

**Hash de fechamento:** `4510e13a refactor(economy/distribution): remove autoDistribute (codigo morto)`

---

### 2026-05-12 — Smoke E2E PASS · §-3 90% · 3 frentes registradas

**Referência:** executei_5.md · HEAD `464fc45e`

**O que foi feito:** Smoke E2E completo no HEAD pós-C40. Build (0 erros), backend :3000, banco conectado, auth/company/profile verdes, `bank_ledger.pg_typeof = bigint` confirmado, frontend :5173.

**§-3 cumprido em 90%.** Último 10% = Q3-E2E econômico mínimo (passo 8 SKIP — mint sistêmico sem rota user-facing). Transação real no `bank_ledger` não foi exercitada ponta-a-ponta após Bank Genesis Wave.

**3 frentes registradas em SYSTEM_REMEDIATION_STATUS.md (OPEN, não executar nesta sessão):**

| Frente | §-1.5 | Resumo |
|---|---|---|
| DT-CONTRACT-DRIFT-IMPLICIT-PROTOCOL | P2 | `cpf`/`x-action-context`/`scope` obrigatórios sem contrato público |
| MIGRATION-DRIFT-RECONCILIATION | P2 | DB=286 vs disco=296 — delta de 10 migrações sem registro retroativo |
| Q3-E2E-ECONOMICO-MINIMO | **P3** | §-3 incompleto — transação bank_ledger não exercitada |

**Aprendizados desta sessão:**

1. **Smoke verde operacional ≠ smoke verde econômico.** Build/auth/profile passam sem nenhum dado financeiro real. P3 (causalidade financeira) é a única garantia que o ledger está wired. §-3 sem P3 é §-3 parcial.

2. **Contratos HTTP implícitos descobertos via Zod 400 iterativo são DT real de DX.** Não tolerar como ruído. `cpf` obrigatório, `x-action-context` com schema implícito, `scope` com `tenantId` prefixado — nenhum estava documentado. Cada um custou 1 round-trip. Em automação/SDK isso é multiplicado por 5+. Registrar como frente própria.

3. **Delta `schema_migrations` vs disco perde memória institucional em 3 sessões.** A causa é conhecida hoje (psql direto sem registro). Em 3 sessões ou próximo onboarding, vira opaco. Reconciliar enquanto a causa ainda é rastreável.

---

## §9. Mantendo este arquivo honesto

- Se não aprendi nada novo, **não escrever em §8 só para preencher**. Sessões repetitivas são saudáveis.
- Se descobrir que algo escrito aqui está errado, **editar a seção** (§-3 a §7), não adicionar contradição em §8.
- Se este arquivo passar de ~500 linhas, virou burocracia. Cortar mais que adicionar.
- **Leis novas (§4-X) vão na seção de leis estruturais, não no histórico.** O histórico só registra a sessão que originou a lei, com link para a seção.
- Se Clayton trouxer outra IA Opus, ela lê este arquivo primeiro. Escrever para ela.

**Hierarquia interna:**
- §-3 (missão) é a regra acima de tudo. Se a próxima Opus quer "auditar arquitetura abstratamente", ela está violando §-3.
- §-2 (runtime descobre arquitetura) governa leitura de realidade.
- §-1.5 (filtro 3 perguntas) governa decisão de abrir sessão.
- §0 (7 perguntas) é condicional, não automático.
- §4-A a §4-D são leis operacionais com casos canônicos. Aplicar quando o sintoma bater.

**Se em alguma sessão futura este arquivo crescer mais que o sistema:** parar. O sistema é o produto. Este arquivo é nota lateral.

**Sessões anteriores a 2026-05-07** foram podadas deste arquivo. Estado consolidado: §-3 a §7 + §4-A a §4-D capturam tudo que importa. Detalhes históricos vivem em `git log` e `STATUS_EXECUCAO_GLOBAL.md`.




### 2026-05-09 (parte 4) — F3-S10a/b + smoke E2E F3 FECHADO · A5 ponta-a-ponta · 3 drifts pré-existentes descobertos no caminho

Sessão de fechamento. F3-S10a/b aplicados conforme plano. Smoke E2E exercitou pela primeira vez o caminho real de criação de empresa via API e revelou 4 drifts pré-existentes (1 esperado: helper de tenant; 3 inesperados: schema vs código no fluxo createCompany).

**Aplicado conforme plano (F3-S10):**

- **F3-S10a** — Adapter writer em `companies.service.ts:511-569`:
  - Após capturar `companyId` do RETURNING do INSERT INTO companies, antes de domains
  - Lookup `findCountryByCode(address.country || 'BR')` → se não achar, log warn + skip canônico
  - `createAddress(...)` + `assignAddress(addressId, 'company', companyId, 'HQ', true)`
  - `UPDATE companies SET primary_address_id WHERE tenant_id=$2 AND company_id=$3` (guarda de tenant)
  - Try/catch defensivo, log com tenantId/companyId/addressId/assignmentAttempted, NÃO re-throw

- **F3-S10b** — Adapter reader em `core.service.ts:504-541`:
  - Originalmente planejado como LEFT JOIN + COALESCE com legacy
  - Aplicado como leitura direta de `addresses` via `primary_address_id` (porque INSERT companies foi reduzido para minimalista — colunas legacy nunca existiram nesta versão do schema)
  - `address_id` retorna UUID real do `addresses` quando canônico, fallback `'company'` quando legacy
  - Verificado: zero uso literal de `address_id === 'company'` em frontend/src ou backend/src

**Drifts pré-existentes descobertos pelo smoke E2E (não são F3-S10 puro):**

1. `companies.service.ts:737` — `resolveTenantIdFromGlobalUserId` usava `INNER JOIN global_users gu ON u.user_id = gu.user_id`, mas `global_users.user_id` não existe (PK é `global_user_id`). Função chamada em 9 pontos. Toda operação de criação/edição de empresa via API estava quebrada — só não tinha aparecido porque ninguém criou empresa via API antes desta sessão. Fix: SELECT direto sem JOIN.

2. `companies.service.ts:464` — INSERT INTO companies pressupunha 17+ colunas inexistentes (`registered_at, cep, address, address_number, complement, neighborhood, city, state, country, phone, email, website, main_activity_code, main_activity_description, secondary_activities, revenue_data, metadata`). Schema vivo de companies é minimalista (12 colunas, contando F3-S8). Fix: INSERT reduzido para colunas reais.

3. `companies.service.ts:603` — INSERT INTO company_users não incluía `tenant_id`, que é NOT NULL no schema vivo. Fix: tenant_id adicionado ao INSERT.

4. `companies.service.ts:548` — INSERT INTO company_domains tentava gravar em tabela que **não existe no banco vivo nem em migrations ativas**. Fix: try/catch tratando `42P01` (undefined_table) como legacy opcional, segue execução com warn. Tabela foi removida na reconstrução pós-genesis; código TS não acompanhou.

**Validação ponta-a-ponta (smoke E2E F3):**
- POST /companies 201 com primary_address_id populado
- addresses: 1 linha criada (postal_code=80010100, source=UX_INPUT, created_by_tenant_id preenchido)
- address_assignments: 1 linha (owner_type=company, role=HQ, is_primary=true, valid_until_at=NULL)
- GET /core/profile retorna endereço canônico com UUID real:
```json
{
  "address_id": "d7368626-b353-43a6-9a16-c81c9343aa3d",
  "cep": "80010100",
  "address": "Rua XV de Novembro",
  "city": null,
  "state": null,
  "country": "BR"
}
```

**A5 fechado E2E.** Caminho canônico de endereço para empresa: API → addresses → address_assignments → primary_address_id → reader → response.

**Aprendizado institucional (consolida §4-B):**

Código que nunca rolou em runtime acumula drift silencioso. Smoke E2E exercita caminhos pela primeira vez e revela esse drift acumulado. Os 4 drifts pré-existentes descobertos hoje são todos da mesma natureza: pressuposição de schema/tabelas que não existem no banco vivo. Nenhum era falha de F3-S10 — todos vieram do `createCompany` original que nunca tinha sido exercitado por API real.

**Padrão consolidado:** quando smoke exercita caminho novo, **expecta-se** descobrir drifts. Não é falha de planejamento — é descoberta natural.

**Pendências para sessões futuras:**

- `city/state/neighborhood` retornam `null` no GET /core/profile porque endereço canônico tem FK para catálogo (cities/states/neighborhoods) mas reader ainda não resolve nomes. Fica para **F3-S11** (resolver nomes via JOIN no reader).
- Modelo de empresa "rico" vs minimalista: o código TS sugere intenção de schema com endereço/contato/atividades CNAE/receita/metadata embutidos em `companies`. Schema vivo descartou. Decisão futura: materializar (ALTER TABLE ADD) ou limpar código. Não é hoje.
- `company_domains`: tabela arquivada com código ativo dependendo dela. Try/catch é patch operacional. Refactor (ou ressurreição) é decisão futura.

---


### 2026-05-09 (parte 5) — Cascata de commits encerrada · Bank Genesis Alignment descoberta · §4-E arqueologia formalizada

Sessão final do dia. Plano original previa 6 commits em cascata (auth, groups, bank, RBAC migrations, F3 location, docs). Cascata fechou em 3 commits após descoberta material de onda Bank Genesis Alignment paralela e interrompida.

**Commits fechados:**
- `92913733` fix(auth): align register/login with live users schema
- `c6999d84` fix(groups): align membership and invites queries with live schema
- `c8b0b2e1` feat(company-users): materialize RBAC columns + updated_at trigger (DECISION-0023)

**Commits NÃO fechados (com motivo material):**
- Commit 3 (Bank fallback) PULADO. Investigação revelou que o fallback "qualquer system" não existe em HEAD. Método `getAccountByOwnerAndType` que continha o fallback nunca foi commitado — está em stash@{0} como parte de refactor amplo. Correção da entrada Bank acima desta (mesma data) feita.
- Commit 5 (F3 location) PENDENTE. Build TS não passa em HEAD (26 erros) por acoplamento Bank descoberto.
- Commit 6 (docs) PENDENTE. Aguarda Bank Genesis ser resolvido.

**Descoberta material crítica — Bank Genesis Alignment:**

Investigação cruzada (Codex + Claude Code, validada por mim) revelou que `bank-account.repository.ts` stashed é peça de uma onda de refactor arquitetural muito maior, não arquivo isolado:

| Componente | Estado |
|---|---|
| bank-account.repository.ts (stashed) | refactor Genesis-aligned (+211/-83 linhas) |
| Consumidores commitados em `5b3f2096` (2026-04-22) | já chamam API nova |
| 21 arquivos Bank modified no working tree | onda paralela não auditada |
| 5 arquivos Bank/identity untracked | dependem da API nova |
| Total da onda | ~27 arquivos |

Sistema está em estado intermediário não-funcional desde 2026-04-22. Build TS falha com 26 erros há ~3 semanas. Smoke E2E desta sessão funcionou apenas porque os caminhos exercitados não passam pelos métodos quebrados. Nenhum dos 27 arquivos foi causado por esta sessão — foram revelados por ela.

**Aprendizado institucional novo — §4-E: Quando debugging vira arqueologia**

Quando a investigação revela que um drift não é falha pontual, mas resíduo de migração arquitetural interrompida, o modo da sessão muda. Não se "corrige" arqueologia — se reconstrói coerência ou se isola para frente dedicada.

Sinais de que a sessão entrou em modo arqueológico:
- Fornecedor e consumidores apontam para versões diferentes de uma mesma API
- Stashes contêm peças de um todo coerente que nunca foi commitado
- Build não passa em HEAD desde commit antigo, sem ninguém ter percebido
- "Fazer rápido pra desbloquear cascata" é tentação de regressão

Resposta correta: pausa institucional, evidência histórica, topologia real, decisão consciente sobre adotar/isolar/abandonar.

**Aprendizado adicional 1 — Smoke E2E não é gate suficiente:**
TypeScript não protege runtime financeiro, mas detecta acoplamentos quebrados que smoke não exercita. `pnpm tsc --noEmit` é gate complementar mínimo. Nesta sessão eu (Opus) afirmei "pnpm build PASS" baseado em relato sem auditar materialmente — descoberta hoje desmente. Próxima cascata: confirmar `tsc --noEmit` antes do primeiro commit.

**Aprendizado adicional 2 — Stash pode esconder ondas, não apenas peças:**
Quando descobrir stash em domínio crítico, primeiro investigar toda a área dirty ao redor antes de decidir adotar/descartar. Stash@{0} parecia "1 arquivo de refactor não validado" — era peça de onda de 27 arquivos.

**Aprendizado adicional 3 — Cascata em terreno não-validado é dívida silenciosa:**
Os 3 commits feitos hoje são corretos isoladamente, mas foram feitos em working tree que não compilava. Não é falha — é descoberta tardia. Os commits valem (escopo isolado, mensagens honestas). Mas premissa de cascata era inválida desde o início.

**Aprendizado adicional 4 — Errei narrativamente na entrada Bank original:**
Reproduzi "fallback removido completamente" sem auditar HEAD materialmente. Caí no anti-padrão §-2 ("documentação implica runtime"). Correção feita. Padrão a aplicar: antes de afirmar "X removido", grep HEAD para confirmar.

**DTs Bank novas:**
- DT-bank-genesis-alignment-wave (27 arquivos, frente dedicada)
- DT-bank-balance-consolidation-genesis-drift (lê 5+ colunas inexistentes; vai crashar em runtime)
- DT-bank-balance-by-cpf-genesis-drift (provável)
- DT-bank-balance-by-region-genesis-drift (provável)
- DT-bank-system-liquidity-helper-audit (helper de manutenção a auditar)
- DT-bank-fallback-original-still-active (correção planejada nunca chegou em HEAD)

**DTs gerais novas:**
- DT-tsc-noEmit-not-gated (CI não roda tsc como gate; HEAD broken passou despercebido ~3 semanas)
- DT-company-documents-archived (INSERT em tabela inexistente sem proteção 42P01)
- DT-company-opportunity-preferences-archived (try/catch silencioso em tabela arquivada)

**Estado pós-sessão:**
- HEAD: c8b0b2e1
- Working tree dirty conscientemente (F3 + Bank wave + 3 migrations + opus.md)
- Stashes preservados: stash@{0} bank, stash@{1} C65 distribution, stash@{2} local-before-rescue
- Build: 26 erros TS conhecidos, todos relacionados à onda Bank
- Sistema em runtime: estável (memória com código antigo coerente; reinício deve aguardar Bank Genesis fechado)

**Próxima sessão:**
- Frente dedicada Bank Genesis Alignment (alta prioridade, 2-3h)
- F3 fechamento (Commits 5+6) quando build passar
- F3-S11 (nomes city/state/neighborhood via JOIN catálogo)
- Adicionar `pnpm tsc --noEmit` como gate CI (alta prioridade institucional)

---

### 2026-05-10 — Sessão Bank Genesis Wave: pacote arquitetural formalizado + β.1

### Estado material ao final desta sessão

| Item | Estado |
|---|---|
| HEAD | `d5f5cff7` |
| Branch | `rescue-structural` |
| Build TS | 26 erros (baseline mantido; só caem após β.4 stash aplicado) |
| 4 gates CI | PASS, `critical_new=0` |
| Stash@{0} | intacto (`bank-account-genesis-alignment-pendente-custodia`) |
| Working tree | dirty consciente (Bank Wave + F3 + ruído node_modules) |
| Schema vivo `bank_accounts` | inalterado (`owner_id text NOT NULL`, etc.) |

### Cascata de commits desta sessão

| Hash | Subject | Tipo |
|---|---|---|
| `8993d1e3` | decisions: register DECISION-0021 through DECISION-0024 | governança (formaliza pacote Bank Genesis parte 1: ledger-only SSOT) |
| `8588e040` | decisions: DECISION-0025 mono-currency BRL na linhagem Genesis | governança (pacote Bank Genesis parte 2) |
| `ae2ba1e3` | docs: institucionaliza REMEDIATION_DT_LOG.md + 3 DTs iniciais | governança (novo artefato institucional) |
| `d5f5cff7` | fix(bank): Genesis-align consolidation + cents contract | runtime — primeiro fix material de Bank Genesis |

### Pacote arquitetural Bank Genesis (agora formalizado)

**DECISION-0024**: `bank_ledger` é SSOT financeiro único. `cached_balance` e `metadata` em `bank_accounts` deprecados. `updateCachedBalance` é NO-OP intencional. Origem: auditoria material do `stash@{0}` revelou que o refactor do provider embute essas três decisões latentes; aplicar sem nomear seria commit que mente sobre escopo.

**DECISION-0025**: UnifyBank Genesis opera mono-currency (BRL) no provider financeiro. `bank_accounts` não tem coluna `currency`. Parâmetro `currency` aceito por compat de assinatura mas ignorado. `BankCurrency` type permanece, mas só `'BRL'` é operacional. Decisão separável de 0024 (ledger-only multi-currency seria possível em outro design), mas chegou junto no mesmo stash.

**REMEDIATION_DT_LOG.md**: novo artefato institucional na raiz do repo. Distinção formal entre DECISIONs (decisões soberanas) e DTs (degradações conscientes). 3 DTs OPEN inaugurais:
- `DT-bank-cachedBalanceCents-naming-heterogeneity`
- `DT-bank-accounts-last-activity-ghost-column`
- `DT-bank-balance-consolidation-region-fallback-tenant`

### β.1 — fix material aplicado

**Arquivo:** `backend/src/modules/bank/bank-balance-consolidation.service.ts`

Escopo do commit (declarado amplo por Cenário X.1 confirmado em auditoria):

1. **`getConsolidatedBalance` Genesis-aligned** (β.1 desta sessão):
   - SELECT reescrito para schema Genesis (7 colunas reais; removidas 5 inexistentes)
   - Mapper coerente com DECISION-0024 + DECISION-0025
   - `filters.currency` ignorado em todo o método (WHERE + destructuring + baseCurrency fallback + bloco regional)
   - regionId fallback `|| tenantId` preservado (já existia)
   - Saldo real continua via `bankLedgerRepository.calculateBalance` no loop

2. **`updateReconciliation` cents contract** (dirty pré-existente consolidado):
   - `externalBalance` → `externalBalanceCents`
   - `difference` → `differenceCents`
   - Hardening monetário alinhado com invariante "amount_cents BIGINT — nunca NUMERIC para dinheiro"
   - Tratado como adjacência Bank Wave por coerência semântica; não veio do `stash@{0}` (confirmado por `git stash show --stat`)

**Validação pós-commit:** TS 26 erros (baseline), 4 gates PASS, commit atômico (1 arquivo).

### Lições materiais desta sessão

**§4-E.2 (segundo uso bem-sucedido — promover a sub-cláusula formal):**

> Em modo arqueológico, contagens agregadas mentem por inclusão. O conjunto causal real é tipicamente uma fração do conjunto narrativo.

Evidência: a "onda Bank Genesis" foi narrada como 27 arquivos. Auditoria revelou conjunto causal mínimo de 5 (provider stashed + 4 consumidores). Os outros ~20 eram adjacência (dirty contemporâneo mas causalmente independente). β.0.5b com filtro estrito separou Conjunto 1 (Bank Genesis Wave) de Conjunto 2 (Core UnifyBank Drift). O segundo nem entrou nesta sessão.

**§4-E.3 (nova sub-cláusula em maturação):**

> Em modo arqueológico, sinal de drift externo merece pausa, não alarme. Pausa permite confirmação material; alarme contamina o próprio raciocínio com hipóteses graves que depois é caro desinflar.

Evidência: vi migrations `0007-0014` no `git status` e working tree de 22.439 entradas, construí narrativa de "drift externo grave" sem confirmar primeiro. Era falso positivo — material estava em `migrations-resetadas/` desde 04/05, anterior à sessão. Sua frase "backend e banco atualizados" era operacional sobre `SRC_FULL.txt/MIGRATIONS_FULL.txt`, não sobre sistema vivo. A parada institucional foi correta; a escalada narrativa foi prematura.

**Auto-correção sobre cleanup de `currency` em β.1:**

A preparação do patch leu o arquivo em duas partes (início + fim) e não auditou a região intermediária. Resultado: 3 usos órfãos de `currency` no bloco regional sobreviveram, TS subiu de 26 → 29 após o primeiro patch. Codex parou conforme regra, patch corretivo aplicado, TS voltou a 26. Lição: ler arquivo em pedaços não é equivalente a auditar arquivo inteiro; cleanup que toca destructuring precisa de grep completo pela variável removida.

### Próximos passos (próxima sessão Bank Genesis)

- **β.1.c**: fix `core/economy/account.service.ts:45` — usa `cachedBalanceCents` como saldo. Cuidado: arquivo em domínio diferente (`core/`, não `modules/bank/`), possivelmente legacy adapter; decisão pode envolver "manter, refatorar ou deprecar inteiro" antes de patch.
- **β.1.d**: fix `financial-dashboard.controller.ts:73` — SQL `WHERE cached_balance < 0` em coluna Genesis-inexistente; runtime crash garantido pós-stash.
- **β.2**: resolver 8 chamadas de `updateCachedBalance` em `bank-transaction.service.ts` (decisão por chamada: remover ou marcar como NO-OP legado explicitamente).
- **β.3**: revalidar 26 call-sites de `getSystemAccount` após β.1.c e β.1.d para sanidade pós-fixes.
- **β.4**: aplicar `stash@{0}` em branch descartável; medir TS (deveria cair de 26 → 0) + rodar 4 gates.
- **β.5**: se β.4 limpo, aplicar no `rescue-structural` com commit que cite o pacote Bank Genesis completo.

DTs adicionais a registrar quando relevante:
- `DT-bank-transaction-stub-account-construction` (L1017, `cachedBalanceCents: 0 as any`)
- `DT-bank-repository-encapsulation-violations` (6 importadores diretos de `bank-account.repository` fora de `modules/bank/`)
- `DT-bank-currency-type-cleanup` (já mencionada em DECISION-0025, registrar formal quando aplicável)

---

## §5. PADRAO DE VERSIONAMENTO: executei.md (2026-05-11)

### Decisao

**Padrao:** `executei.md` = sessao atual; quando cresce, arquiva como `executei_N.md`.

### Regras

1. **executei.md** e o arquivo de trabalho da sessao ATUAL
2. **Quando ultrapassa ~1000 linhas:** arquivar como `executei_N.md` (N = proximo numero disponivel) e zerar executei.md
3. **Numeracao:** crescente (executei_1.md, executei_2.md, executei_3.md...)
4. **Gitignore:** TODOS os executei*.md sao artefatos efemeros, NAO versionados
5. **Informacao permanente:** vai para arquivos institucionais:
   - SYSTEM_REMEDIATION_STATUS.md (status de violacoes)
   - REMEDIATION_DECISIONS_LOG.md (decisoes formais)
   - REMEDIATION_DT_LOG.md (dividas tecnicas)
   - code.md (aprendizados, mapas, erros)

### Ciclo de vida

```
executei.md (sessao atual, ~0-1000 linhas)
    |
    v quando ultrapassa ~1000 linhas
    |
executei_N.md (arquivo morto)
    +
executei.md zerado (nova sessao)
```

### Justificativa

- executei.md e checkpoint de sessao, nao documentacao permanente
- Arquivos numerados sao historico local para referencia, nao versionados
- Permite Clayton auditar trabalho em andamento sem commitar rascunhos
- Informacao que importa ja foi para arquivos institucionais

---

## §8. Q3-E2E v1 → DECISION-0031 → Smoke v2 (2026-05-12)

### O que aconteceu

Q3-E2E econômico passo 5 falhou: `COVERAGE_EXCEEDED: 100.00 cobertura`.

O trigger `check_coverage_before_credit` bloqueia qualquer crédito a usuários quando
`execution_capacity_cents = 0`. Num tenant novo (sem atividade econômica real), a VIEW
`system_coverage` pós-C40 exclui `system:liquidity_issuance:%` do cálculo — o que é
correto por design. Resultado: `execution_capacity = 0` → coverage = 100% → BLOCKED.

Cinco opções foram avaliadas (A: rota admin, B: ensureLiquidityIssuance também provisiona
reserve, C: seed de tenant, D: trigger excepciona estado inicial, Z: rever o smoke).

### O que aprendemos

**Quando smoke E2E financeiro falha, a hipótese-padrão NÃO é "falta implementação".**

A hipótese correta é: "o smoke está tentando um caminho que o sistema deliberadamente
não oferece". Antes de propor implementação:
1. Ler as leis (LEDGER_SOVEREIGNTY → INVARIANTES → POLITICA_ATIVACAO → SSOT_REGISTRY)
2. Ler o código real (trigger + VIEW + split engine)
3. Consultar múltiplos agentes com perspectivas distintas
4. Só então decidir se o sistema precisa mudar

### Auditoria multi-agente

- **Claude Code:** diagnóstico técnico preciso (trigger, VIEW, capacity=0, 4 opções)
- **ChatGPT:** reformulação ontológica ("coverage é entidade soberana, não proxy técnico")
- **Opus:** auditoria normativa contra 5 leis → todas as 5 opções falharam
- **Clayton:** decisão soberana — DECISION-0031

Nenhum agente isolado chegaria a DECISION-0031. O multi-AI foi metodologia, não atalho.

### DECISION-0031 — síntese

"Coverage é propriedade emergente de atividade econômica validada institucionalmente,
não recurso provisionado artificialmente."

Sequência fundacional canônica:
1. Tenant criado → `ensurePlatformAccounts`
2. Primeiro `event_ticket` com split engine → 17% → system reserve
3. `execution_capacity_cents > 0` emerge da atividade real
4. P2P e Q3-E2E possíveis

### DT-COVERAGE-BOOTSTRAP-REQUIRED

ENCERRADA via DECISION-0031 — sem implementação. O sistema está correto.

### Q3-E2E v2

Novo smoke segue caminho fundacional via `event_ticket`. `Q3_E2E_V2_PLAN.md` criado
(gitignored). Sessão dedicada futura — não executar sem plano aprovado.

### C40 colateralmente validado

Mesmo que o mint tenha falhado, a query `system_coverage` confirmou em runtime:
- `pg_typeof(execution_capacity_cents) = bigint` ✓
- `pg_typeof(total_credits_cents) = bigint` ✓

C40 parcialmente validado como efeito colateral do smoke v1.

**Princípio operacional descoberto em runtime (preservar):**

> O sistema deve preferir parar explicitamente a fingir solvência implicitamente.

**Caso canônico:** Q3-E2E v1 (2026-05-12). Trigger `check_coverage_before_credit`
bloqueou emissão sem capacity. A interrupção do fluxo foi comportamento correto do
sistema, não falha operacional. O `COVERAGE_EXCEEDED: 100% — capacity=0` era a verdade
institucional sendo enforced, não um bug a corrigir.

**Lição:** invariantes econômicos reais devem sobreviver à pressão de execução, smoke
tests e conveniência operacional. Quando smoke financeiro falha por invariante de
runtime, hipótese-padrão é "invariante está certo, smoke estava errado", não o contrário.

---

## DECISION-0047 — Economic Policy Engine como camada canônica de DECISÃO de split (2026-05-26)

PE-1 substrate. 5 tabelas (`economic_policies` + `economic_policy_lines` +
`access_pass_products` + `actor_access_passes` + `economic_policy_resolution_logs`) +
resolver puro determinístico + 15 E2E verdes.

**Princípio operacional:** policy é resolução, não cálculo inline. Toda regra de split
econômico de qualquer transação passa a ser:

1. **Resolução** — `economicPolicyEngineService.resolveEconomicPolicy(input)` retorna
   policy + lines + access pass aplicado por specificity DESC → priority DESC →
   effective_from DESC. Fail-closed em AMBIGUITY / NOT_FOUND.
2. **Cálculo** — `calculatePolicySplits(amountCents, lines)`: BPS integer (sem float).
   Drift de arredondamento absorvido pela primeira linha `revenue_share`. Sem
   revenue_share = fail-closed `DRIFT_NO_REVENUE_SHARE`.
3. **Persistência** — `bank_splits` continua soberano (DECISION-0044, CORE_SPLIT).
   Engine entrega `CalculatedEconomicSplit[]`; caller traduz em INSERT.
4. **Audit** — `economic_policy_resolution_logs` registra CADA chamada (inclusive
   fails) com input + policy + splits + pass.

**O que NÃO está plugado ainda:**

- `service-payment-execution` continua com split hardcoded (`DT-POLICY-ENGINE-PLUG-SERVICE-EXECUTION`, frente PE-3).
- Não há admin panel / CRUD (`DT-ECONOMIC-POLICY-ADMIN-PANEL`, frente PE-2).
- `bank_policies` legacy permanece dormente (`DT-POLICY-ENGINE-LEGACY-DEPRECATION`, frente PE-4).

**Regra operacional permanente:** qualquer fluxo econômico NOVO deve usar o engine. O
caller chama `resolveEconomicPolicy(...)` na transação financeira; se policy ausente,
falha fail-closed (não cair em hardcoded). Inserir policy no DB > cálculo inline.
