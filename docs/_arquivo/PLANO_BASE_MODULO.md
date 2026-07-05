# PLANO_BASE_MODULO.md

> **ESTADO OPERACIONAL DO §GLOBAL BLOCK:** ver `STATUS_EXECUCAO_GLOBAL.md`  
> **REGRA NORMATIVA:** definida neste ficheiro (secção §GLOBAL BLOCK).  
> ⚠️ **Estado operacional pode variar por data.** Ver sempre `STATUS_EXECUCAO_GLOBAL.md`.

**Versão:** 2.5 — A2 elegíveis (`is_identity_required`) + §STATE_TRANSITION_RULES com A1–A4 alinhados ao plano identity  
**Função:** molde obrigatório para **auditar e refatorar qualquer módulo** de `backend/src/modules/<nome>/`  
**Instanciar como:** `PLANO_<NOME>_REFATOR_ARQUITETURAL.md` (preencher todos os `⟨ ⟩`)

---

## LEITURA OBRIGATÓRIA ANTES DE QUALQUER AÇÃO

O Cursor DEVE ler os documentos abaixo **na sequência exata** antes de iniciar qualquer sessão. Em caso de reinício ou retomada: reler a partir do §A (estado atual do plano instanciado) e confirmar trilho antes de agir.

```text
ORDEM DE LEITURA (bootstrap obrigatório por 00_AGENT_PROTOCOL.md §2.2.1):

1. docs/01_normative/00_AGENT_PROTOCOL.md          — protocolo único de operação
2. docs/01_normative/CONSTITUICAO_UNIFICARD.md     — constituição imutável
3. docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md — leis (Forward-Only, SSOT, etc.)
4. docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md — lei fundamental
5. docs/01_normative/07_NOMENCLATURA_CANONICA.md   — lei de nomenclatura (OBRIGATÓRIA por campo)
6. docs/01_normative/SSOT_REGISTRY_UNIFICARD.md    — quem é dono de cada verdade
7. docs/01_normative/SSOT_EXCLUSIVE_BANK_RULE.md   — regra exclusiva Bank

Leitura modular adicional (carregar conforme domínio declarado em §2):
- Financeiro/ledger → INVARIANTES_OPERACIONAIS_LEDGER.md + AUTHORITY_MAP_FINANCIAL_v1.md
- Identidade        → IDENTITY_SSOT_PRECEDENCE.md
- Eventos           → EVENT_OUTBOX_E_ENTREGA_CANONICO.md
- Schema/DDL        → CORE_IMUTAVEL.md
```

**Se qualquer arquivo não existir ou estiver ilegível → ABORTAR IMEDIATAMENTE.**

### Índice de âncoras normativas (v2.5)

| Âncora | Onde está o texto completo |
|--------|----------------------------|
| **§ORDEM_GLOBAL** | §3.1 — sequência entre módulos |
| **§IDENTITY_INVARIANT** | §6.5 + lei resumida abaixo |
| **§RESPONSABILIDADE_CIVIL** | Secção homónima (CPF/CNPJ, histórico) |
| **§PILARES_TRANSVERSAIS** | Secção homónima + §11 (impacto por sistema) |
| **§CI** | Enforcement externo (GitHub + guards) |
| **§GLOBAL BLOCK** | Paragem sistémica |
| **§CONTINUOUS_EXECUTION_MODE** | Execução contínua segura (pré-requisitos) |
| **STATUS_EXECUCAO_GLOBAL.md** | Memória de orquestração entre módulos |
| **§STATE_TRANSITION_RULES** | Quem muda estado global e com que prova |

---

## §A — ESTADO ATUAL DO PLANO (ler primeiro em retomadas)

> **Instrução de retomada:** Em toda nova sessão ou chat, ler esta seção antes de qualquer ação. Ela define exatamente onde o plano parou e o que está autorizado a executar a seguir.

```text
ESTADO (atualizar após cada sessão):

- Módulo:           ⟨ modules/<nome>/ ⟩
- Status global:    ⟨ EM PLANEJAMENTO | FASE S | BLOCO 1 | BLOCO 2 | ENCERRADO ⟩
- Fase atual:       ⟨ descrever a fase exata — ex: "FASE S concluída, aguardando BLOCO 1" ⟩
- Próxima ação:     ⟨ descrição literal do que o Cursor deve fazer ao retomar ⟩
- Bloqueios ativos: ⟨ listar PROPOSTAs abertas, decisões pendentes, gates com falha ⟩
- Última execução:  ⟨ YYYY-MM-DD HH:MM UTC — o que foi feito ⟩

CONTEXTO DO AMBIENTE:
- DATABASE_STATE:   ⟨ EMPTY | BOOTSTRAP | PARTIAL | LIVE ⟩
- Linhas críticas:  ⟨ contar actors, identities, tabelas-chave do módulo ⟩
- Excepção §5.3:    ⟨ ATIVA | INATIVA — se ativa: confirmar §0.3 nunca em LIVE ⟩

INVARIANTE GLOBAL IDENTITY (§6.5) — confirmar no alvo com queries reais:
□ global_users sem identities:        ⟨ N — zero esperado para trilho pleno ⟩
□ A2 (actors humanos **elegíveis** sem GU): ⟨ N — zero esperado ⟩ — métrica = `PLANO_IDENTITY_RECONCILIATION.md` §2.1 (`is_identity_required = true`)
□ §GLOBAL BLOCK:                      ⟨ ATIVO | INATIVO ⟩
```

**Referência de sistema (snapshot auditoria identity — 2026-04-14, ambiente PARTIAL com DATABASE_URL):** contagens para calibrar risco; **instâncias do plano devem substituir** por valores do ambiente alvo. **Nota:** após 2026-04-15, **A2** mede só actores com `is_identity_required = true` (default conservador até CP-5).

| Métrica (alvo da auditoria) | Valor referência |
|----------------------------|------------------|
| `actors` (total) | 400 |
| `identities` | 2 |
| `global_users` | 33 |
| `users` | 35 |
| `global_users` sem linha em `identities` | 31 |
| A2 elegíveis (user/person/actor_human, `global_user_id` NULL, `is_identity_required` true) | ver precheck |
| Actores com `global_user_id` mas sem `identities` | 0 |

→ Com estes números, **§6.5 falha** e **§GLOBAL BLOCK** aplica-se a execução de módulos não-identity até PROPOSTA de reconciliação. Atualizar tabela após backfill/correcções.

---

## 0. Contexto operacional e estado do ambiente

### 0.1 Estado do ambiente (obrigatório)

**Regra:** sem `DATABASE_STATE` preenchido e classificação explícita → análise inválida.

```text
DATABASE_STATE:

- identities:    ⟨ N ⟩ linhas
- global_users:  ⟨ N ⟩ linhas
- actors:        ⟨ N ⟩ linhas
- users:         ⟨ N ⟩ linhas
- ⟨ tabela principal do módulo ⟩: ⟨ N ⟩ linhas
- ⟨ outras tabelas críticas ⟩: ⟨ N ⟩ linhas

CLASSIFICAÇÃO (marcar exatamente uma):
☐ EMPTY       — sem linhas de negócio relevantes (cold-start puro)
☐ BOOTSTRAP   — só infra / identidade mínima; sem catálogo nem transações
☐ PARTIAL     — poucos registos (seed, teste); sem carga real representativa
☐ LIVE        — dados de negócio reais — cautela máxima em DDL e dados
```

**Regra de cautela:**
- EMPTY / BOOTSTRAP → migrations estruturais com §5.3 válido
- PARTIAL / LIVE → PROPOSTA obrigatória + §12.1 completo

### 0.2 Contexto global persistente

```text
CONTEXTO GLOBAL (⟨ YYYY-MM-DD ⟩):
- Fase do sistema: ⟨ bootstrap | crescimento | produção ⟩
- Implicações:     ⟨ descrever com base em §0.1 ⟩
```

### 0.3 Limite da exceção de bootstrap (trava anti-produção)

A exceção §5.3 é **expressamente proibida** em:
- ambiente LIVE
- bypass do Gate 2 ou escrita financeira fora do Bank
- decisão de domínio estrutural (novo SSOT, segunda verdade)

Reutilização fora deste contexto → violação → §8.8 (`FALSIFICATION_LOG.md`).

---

## 1. Cabeçalho

| Campo | Valor |
|-------|--------|
| **Módulo** | ⟨ `modules/<nome>/` ⟩ |
| **Status** | ⟨ EM PLANEJAMENTO \| EM EXECUÇÃO \| PAUSADO \| ENCERRADO ⟩ |
| **Data de abertura** | ⟨ YYYY-MM-DD ⟩ |
| **Executor** | Cursor (autónomo no escopo §AC) |
| **Log de falsificação** | `docs/01_normative/FALSIFICATION_LOG.md` |
| **Log de execução** | `docs/03_execution_log/⟨módulo⟩-AUDIT-⟨YYYYMMDD⟩.md` |

---

## 2. Base normativa (obrigatória)

Toda DDL, nome de campo, fronteira de SSOT e decisão de domínio seguem:

| Documento | Papel |
|-----------|--------|
| `00_AGENT_PROTOCOL.md` | Protocolo do agente — operação e bootstrap |
| `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` | Lei fundamental — nenhuma realidade paralela |
| `07_NOMENCLATURA_CANONICA.md` | Lei de nomenclatura — cada campo novo passa aqui |
| `SSOT_REGISTRY_UNIFICARD.md` | Quem é dono de cada verdade |
| `SSOT_EXCLUSIVE_BANK_RULE.md` | Regra exclusiva Bank |

### 2.1 Prova de rastreabilidade normativa (obrigatória)

Antes de qualquer análise ou alteração material:

```text
PROVA NORMATIVA:

- Domínio:
- Documentos lidos (lista exata):
- SSOT aplicável:
- Pilar afetado (money | time | identity | state | event | authority):
- Justificativa de suficiência:
```

Se não for possível preencher com honestidade → ABORTAR → leitura read-only e PROPOSTA apenas.

---

## 3. Ordem de precedência

```
ATL > KYC > GUARDA > SISTEMA > PRODUTO
```

Conflito entre camadas → prevalece a mais restritiva (mais à esquerda). Produto nunca flexibiliza regra de camada superior.

### 3.1 Ordem de execução entre módulos (prioridade estrutural)

Execução de refactors ou trilhos dependentes **respeita** esta ordem; módulo posterior **não** avança se o anterior estiver inconsistente (ver também **§6.5**, **§GLOBAL BLOCK**).

```text
1. Identity (identities, global_users, actors — vínculo civil ↔ operacional)
2. Core (tempo, eventos, base estrutural partilhada)
3. Marketplace / Events / Social (domínio de produto)
4. Bank (SSOT financeiro já separado — não misturar com identity)

Regra: FASE S (§6) e invariantes globais (§6.5) têm precedência sobre calendário de módulos.
```

## §ORDEM_GLOBAL

Secção normativa **§3.1** acima. **Não** avançar módulo posterior na sequência se o anterior estiver inconsistente (FASE S / **§IDENTITY_INVARIANT** / **§GLOBAL BLOCK**).

### 3.2 Dependência entre módulos (explícita)

Um módulo **não** inicia execução material (migrations, escritas normativas) se:

```text
□ O módulo anterior na ordem §3.1 tiver FASE S ≠ OK ou estiver abandonado sem encerramento
□ Existir dependência de SSOT não resolvido (ex.: Identity com §6.5 violado → §GLOBAL BLOCK ATIVO)
□ STATUS_EXECUCAO_GLOBAL.md (raiz do repo) marcar o trilho ou dependência como BLOQUEADO
```

**Regra:** dependência fraca (ex.: apenas leitura de norma) é permitida; dependência forte (schema, writers, invariantes) → **PARAR** até pré-requisito verde ou PROPOSTA explícita.

---

## 4. Gates do SSOT

| Gate | Papel |
|------|--------|
| Gate 0 | Pré-requisitos de contexto / abertura do plano |
| Gate 1 | SSOT Registry + nomenclatura `07` para nova "verdade" |
| Gate 2 | **Bloqueio estrutural** — sem escrita financeira fora do Bank; sem violar precedência §3 |
| Gate 3 | Plano e fronteiras formalizados; não executar BLOCO de código sem FASE S OK |

### 4.1 Enforcements do Gate 2

Antes de qualquer PROPOSTA que envolva escrita, novo estado ou fronteira:

- [ ] Escrita financeira ou equivalente **fora** do SSOT do Bank?
- [ ] Leitura decisória a partir de estrutura legacy sem reconciliação?
- [ ] Tentativa de criar estado paralelo?

SIM em qualquer → PARAR → §8.8 → PROPOSTA → AGUARDAR APROVAÇÃO.

---

## 5. Modo restrito (Cursor)

### 5.1 Kill switch (abort imediato)

Parar execução material se:

- Ausência de PROVA NORMATIVA válida (§2.1)
- Violação ou risco claro de Gate 2 (§4.1)
- FASE S com STATUS ≠ OK (§6)
- Invariante global Identity violada (§6.5) ou §GLOBAL BLOCK ativo
- Ambiguidade de domínio não resolvida (duas leituras normativas possíveis)
- Incapacidade de classificar entidade em §10 sem adivinhar

Nesses casos: apenas read-only + §8.8 + PROPOSTA.

### 5.2 Proibição de execução silenciosa

As ações abaixo **nunca** ocorrem sem registro no plano ou §14:

- Criação ou alteração de tabela (DDL)
- Alteração de campo relevante (schema / contrato de API)
- Mudança de fluxo de decisão
- Introdução de novo writer (INSERT/UPDATE canônico)
- Alteração de dependência entre módulos

Sem registro → considerar como não executado → retro-registro obrigatório antes de continuar.

### 5.3 Exceção de bootstrap (controlada)

Em EMPTY / BOOTSTRAP / PARTIAL sem dados de negócio:

- Aplicar migrations sem ciclo completo de PROPOSTA (mas: SQL revisto, forward-only, idempotente)
- Registrar **obrigatoriamente** no §14 com referência a §5.3 + §0.1 + §0.3

Nunca dentro desta exceção: Gate 2, DROP de colunas monetárias, nova segunda verdade.

---

## §AC — ESCOPO AUTÓNOMO DO CURSOR

> Esta seção define **exatamente** o que o Cursor pode executar sem confirmação humana explícita e o que **sempre** exige parada e espera.

### Releitura obrigatória antes de cada módulo (anti-drift)

Antes de **iniciar** trabalho material num novo módulo (ou após pausa longa), o executor **deve**:

```text
□ Reler §A do plano instanciado e STATUS_EXECUCAO_GLOBAL.md (raiz)
□ Reler docs/01_normative/SSOT_REGISTRY_UNIFICARD.md (secção pertinente ao domínio)
□ Reler docs/01_normative/IDENTITY_SSOT_PRECEDENCE.md
□ Revalidar §GLOBAL BLOCK / §6.5 no ambiente alvo (queries reais se for tocar schema/dados)
```

Sem isto → risco de propagar decisão errada entre módulos → tratar como **§5.1** se houver ambiguidade.

### §AC.1 Loop de execução contínua (trilho)

Enquanto existir trabalho modular pendente **e** não houver **§GLOBAL BLOCK** ativo:

```text
1. Abrir STATUS_EXECUCAO_GLOBAL.md — confirmar módulo elegível e dependências; actualizar linha se EM EXECUÇÃO
2. Selecionar próximo módulo segundo MODULOS.txt / prioridade §3.1 / matriz de dependência
3. Executar releitura obrigatória (bloco acima)
4. Instanciar plano a partir deste template (PLANO_<NOME>_REFATOR_ARQUITETURAL.md)
5. Executar: FASE S (§6) → inventário (§7) → detecção (§8–§10)
6. Se FASE S = OK e §6.5 satisfeito no alvo: gerar PROPOSTA (§13) quando houver mudança material
7. Se aprovado: executar migrations/código conforme §12 e §13; registar §14
8. Actualizar STATUS_EXECUCAO_GLOBAL.md + §A; avançar para o próximo módulo

Regra: NÃO parar sem motivo normativo; NÃO saltar módulo na ordem §3.1 sem decisão explícita em §A.
```

### §AC.2 Regra de execução autónoma (reforço)

O Cursor **só** pode executar alterações materiais **sem** aprovação humana explícita quando **simultaneamente**:

```text
□ DATABASE_STATE ∈ { EMPTY, BOOTSTRAP, PARTIAL } (nunca LIVE para DDL sensível sem PROPOSTA)
□ FASE S = OK (§6) e §6.5 (Identity) satisfeito no alvo — ou escopo read-only
□ Escopo NÃO envolve: identity reconciliation em massa, Bank (escritas fora de modules/bank/), novo SSOT
□ Não envolve criação de nova tabela com papel de SSOT para facto já normado
```

Caso contrário → **PROPOSTA obrigatória** (§13) + **PARADA** conforme lista abaixo.  
*(Itens P1–P10 abaixo permanecem; conflito → prevalece a regra mais restritiva.)*

### §CONTINUOUS_EXECUTION_MODE (modo execução contínua segura)

Ligar **automação em cadeia** (vários módulos sem parar por norma) **só** quando **simultaneamente**:

```text
□ §GLOBAL BLOCK = INATIVO (identity consistente no alvo — §6.5 / §IDENTITY_INVARIANT)
□ §CI satisfeito: CI a correr; regression guards no trilho; branch protection recomendado (§CI)
□ STATUS_EXECUCAO_GLOBAL.md presente e actualizado (memória entre módulos)
□ PLANO_IDENTITY_RECONCILIATION.md concluído ou explicitamente N/A (EMPTY) com registo em §A
```

Se qualquer caixa falhar → execução contínua **não** é considerada segura; limitar-se a sessões isoladas + read-only + PROPOSTA.

### O que o Cursor PODE fazer de forma autónoma (sem pedir confirmação):

```text
AUTÓNOMO — SEM PARAR:

1. Leitura e análise (grep, tsc, information_schema, contagens)
2. Preencher FASE S (§6) com evidência real — tabelas, colunas, drift
3. Preencher §7 (inventário), §8 (detecção), §9 (duplicidade), §10 (classificação)
4. Verificar nomenclatura de cada campo contra 07_NOMENCLATURA_CANONICA.md
5. Redigir PROPOSTA (§13) para qualquer mudança material — sem executar
6. Registrar no §14 (EXECUTION LOG) após execução permitida
7. Criar migrations forward-only em EMPTY/BOOTSTRAP/PARTIAL (§5.3) com:
   - SQL idempotente (DO $$ + information_schema)
   - Registro obrigatório no §14 com referência §5.3
   - SEM tocar Bank, SEM DROP de colunas monetárias
8. Corrigir nomenclatura em código TypeScript (nomes de variáveis, campos de interface)
   quando a correção NÃO altere schema ou contrato de API persistido
9. Remover código morto com zero callers confirmados por grep
10. Adicionar comentários normativos em arquivos existentes
11. Atualizar §A (estado atual do plano) ao final de cada sessão
```

### O que o Cursor DEVE PARAR e aguardar decisão humana:

```text
PARAR — AGUARDAR CLAYTON:

P1. Qualquer migration em ambiente LIVE
P2. Qualquer alteração que toque em tabelas de Bank (bank_ledger, bank_transactions, bank_splits)
    fora de modules/bank/ — mesmo que seja "só renomear"
P3. Criação de novo SSOT ou segunda verdade para o mesmo facto normado
P4. DROP ou remoção de coluna monetária canônica (*_cents, amount_cents, etc.)
P5. Alteração de contrato de API pública que quebre clientes existentes
P6. Decisão sobre actor_type, identity, KYC constraint — domínio de identidade
P6b. Violação de §6.5 (Invariante global Identity) ou §GLOBAL BLOCK ativo
P7. Qualquer ambiguidade de domínio onde dois caminhos normativos são possíveis
P8. FASE S com STATUS INCONSISTENTE + ausência de exceção §5.3 válida
P9. Conflito entre normas (dois documentos normativos contradizem-se)
P10. Qualquer ação fora do que está listado acima em AUTÓNOMO

FORMATO DA PARADA:
"PARADA [P⟨N⟩] — ⟨motivo em uma linha⟩
PROPOSTA: ⟨ver §13⟩
AGUARDANDO APROVAÇÃO"
```

### Cadência de sessão (chunk size):

```text
CADÊNCIA (uma sessão = um bloco):

Sessão 1: FASE S + §7 + §8 (leitura pura — nunca falha por norma)
Sessão 2: §9 + §10 + §11 (análise — nunca falha por norma)
Sessão 3: PROPOSTAs para migrations (§12 + §13) — aguardar aprovação entre sessões
Sessão 4: Execução de migrations aprovadas + §14
Sessão 5: BLOCO 1 (escritas/nomenclatura) — só após FASE S OK + migrations aprovadas
Sessão 6: BLOCO 2 (leituras/limpeza) — só após BLOCO 1 completo
Sessão 7: CI Guards + validação final

Regra: atualizar §A ao final de cada sessão.
NÃO misturar domínios (schema + código + gates) na mesma sessão.
```

---

## 6. FASE S (schema vs código) — obrigatória

**STATUS deve ser declarado explicitamente antes de qualquer execução material.**

### 6.1 Checklist

```bash
# 1. Tabelas usadas pelo módulo
grep -rn "FROM \|INSERT INTO \|UPDATE " backend/src/modules/<nome>/ --include="*.ts" \
  | grep -oP "(?<=FROM |INTO |UPDATE )[a-z_]+" | sort -u

# 2. Tabelas existentes no banco (rodar no alvo)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN (⟨lista acima⟩);

# 3. Colunas com problema de tipo
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (⟨tabelas do módulo⟩)
  AND (
    (data_type = 'numeric' AND column_name LIKE '%price%')
    OR (data_type LIKE 'timestamp%' AND data_type NOT ILIKE '%with time zone%')
    OR (data_type = 'boolean' AND column_name NOT LIKE 'is_%')
    OR (column_name LIKE '%amount%' AND data_type != 'bigint')
  );
```

### 6.2 Verificação de nomenclatura (obrigatória — 07_NOMENCLATURA_CANONICA.md)

Para cada coluna/campo do módulo, verificar:

```text
CHECKLIST NOMENCLATURA (07_NOMENCLATURA_CANONICA.md):

□ Valores monetários: *_cents (BIGINT) — nunca NUMERIC, nunca DECIMAL, nunca FLOAT
□ Booleanos: prefixo is_ ou has_ (ex: is_active, has_invoice)
□ Timestamps: TIMESTAMPTZ — nunca TIMESTAMP sem TZ
□ Status fields: snake_case, vocabulário canônico (ver §4.9 do doc)
□ IDs externos: *_id suffix (ex: actor_id, tenant_id)
□ Campos de auditoria: created_at, updated_at (TIMESTAMPTZ NOT NULL)
□ Soft delete: deleted_at (nullable TIMESTAMPTZ) — nunca is_deleted
□ Nomes de tabela: snake_case plural
□ Nomes de coluna: snake_case, sem prefixo de tabela
□ Enums: snake_case lowercase (ex: 'pending', 'active', 'cancelled')

VIOLAÇÕES ENCONTRADAS:
⟨ preencher com evidência: arquivo + linha + valor atual + valor correto ⟩
```

### 6.3 Status

```text
STATUS FASE S: ⟨ INCONSISTENTE | OK ⟩

Problemas identificados:
⟨ lista numerada com: tabela, coluna, problema, severidade, referência DDL ⟩

Migrations necessárias:
⟨ lista de migrations propostas — não aplicar sem §13 aprovado, salvo §5.3 ⟩
```

**Regra global:** `sem FASE S OK → não executar BLOCO` (excepção §5.3 com §0.1 explícito).

### 6.4 Prova de FASE S (obrigatória — sem isto, STATUS inválido)

O Cursor NÃO pode declarar `STATUS FASE S: OK` sem preencher este bloco com evidência real.  
"Analisei o código" ou "parece correto" não constitui prova — é necessário output de query ou grep.

```text
PROVA FASE S (preencher com output real — não deixar vazio):

Query de tabelas executada:
  ⟨ colar o SELECT exato rodado em information_schema ⟩

Resultado (output real):
  ⟨ colar as linhas retornadas pelo banco — ou "0 linhas" se vazio ⟩

Grep de writers executado:
  ⟨ colar o comando grep exato ⟩

Resultado:
  ⟨ colar os arquivos encontrados, ou "nenhuma ocorrência" ⟩

Colunas com tipo errado encontradas:
  ⟨ colar resultado da query de tipos da §6.1, ou "nenhuma" ⟩

Violações de nomenclatura encontradas:
  ⟨ colar resultado do checklist §6.2, ou "nenhuma" ⟩

Confirmação:
  □ Rodei os comandos acima no ambiente alvo (não simulei)
  □ Os resultados acima são o output real, não inferência
```

**Se qualquer campo ficar como ⟨ ⟩ → STATUS inválido → tratar como INCONSISTENTE → §5.1.**

## §IDENTITY_INVARIANT (GLOBAL)

Lei mínima (detalhe operacional e queries: **§6.5** abaixo):

```text
PROIBIDO no ambiente alvo (salvo PROPOSTA + reconciliação explícita):

- global_user sem linha correspondente em identities (mesmo global_user_id)
- actor humano **elegível** (`is_identity_required = true`; ver `PLANO_IDENTITY_RECONCILIATION.md` §2.1) sem `global_user_id` quando a norma exige vínculo civil

Se violado → §GLOBAL BLOCK — nenhum módulo dependente executa até correção.
```

### 6.5 Invariante global (Identity) — bloqueio transversal

Antes de qualquer execução material em **módulos que não sejam exclusivamente identity**, o executor deve confirmar o estado civil ↔ operacional no **ambiente alvo** (queries reais — não inferência).

**NÃO pode existir (salvo PROPOSTA aprovada + plano de reconciliação explícito):**

```text
□ global_users sem linha correspondente em identities (mesmo global_user_id)
□ actors de tipo humano **e** `is_identity_required = true` (política em `PLANO_IDENTITY_RECONCILIATION.md` §2.1)
  sem `global_user_id` quando a regra de negócio exige identidade civil — actores com `is_identity_required = false` documentados em CP-5 **não** entram nesta contagem
```

Se qualquer item estiver violado no alvo → **BLOQUEIO GLOBAL** (ver **§GLOBAL BLOCK**): não executar migrations de domínio nem expandir módulos dependentes até PROPOSTA de correção; read-only e auditoria permitidos.

Norma de precedência civil vs operacional: `docs/01_normative/IDENTITY_SSOT_PRECEDENCE.md`.  
Autoridade de documento/KYC: tabela **`identities`**; confusão entre camadas ≠ dois SSOT — ver **§PILARES TRANSVERSAIS**.

---

## §RESPONSABILIDADE_CIVIL — CPF/CNPJ e histórico normado

Esta secção fixa **regra de produto** alinhada à norma: identidade civil não é “asset de OT”; é eixo de rastreabilidade e responsabilidade histórica.

```text
§RESPONSABILIDADE_CIVIL — ÂNCORA E HISTÓRICO

- CPF/CNPJ (`tax_id` em identities) é âncora de identidade e de responsabilidade histórica no modelo normado.
- Uma identity persiste como referência de verdade civil; encerrar conta, mudar email ou permissões
  NÃO apaga obrigatoriamente o vínculo histórico exigido por compliance — concretizar em política de dados e DDL (soft-delete, retenção), nunca “segundo CPF”.
- Vínculos empresa ↔ pessoa física são temporais; o histórico por período deve permanecer rastreável (actors, responsible_actor_id, eventos — conforme domínio).
- Leitura decisória de KYC/documento: sempre `identities` + ordem em IDENTITY_SSOT_PRECEDENCE.md — não inferir de caches ou actors.
```

---

## §GLOBAL BLOCK — Paragem sistémica

Quando **qualquer** condição abaixo for verdadeira no ambiente alvo ou no trilho de execução:

```text
□ Identity inconsistente (§6.5)
□ Gate 2 violado (§4.1) ou risco claro de escrita financeira fora do Bank
□ FASE S INCONSISTENTE (§6) sem excepção §5.3 válida para o alvo
□ Módulo anterior na ordem §3.1 ainda INCONSISTENTE
```

**ENTÃO:** ⛔ **PARAR execução de todos os módulos** que dependam dessa cadeia. Permitido: read-only, PROPOSTA, preenchimento de §A/§13, correção dedicada ao bloqueio.

Só retomar após resolução explícita (PROPOSTA aprovada ou dados reconciliados + FASE S OK).

---

## §STATE_TRANSITION_RULES — Transição de estado global

**Regra de ouro:** **sem evidência verificável → sem alteração de estado** em `STATUS_EXECUCAO_GLOBAL.md` nem no campo **§GLOBAL BLOCK** aí declarado.  
Nem humano nem agente “assumem” INATIVO sem queries reais no ambiente alvo.

### Quem pode alterar

- **Humano com dono de release** (ex.: decisão explícita + merge), ou
- **Agente** apenas se seguir esta secção e **colar evidência** no plano instanciado (§A), em `STATUS_EXECUCAO_GLOBAL.md` (nota datada), ou em `docs/03_execution_log/…` com referência à PROPOSTA.

### Transição: §GLOBAL BLOCK `ATIVO` → `INATIVO`

Só após **todas** as condições abaixo no **mesmo** ambiente alvo (nomear qual: dev/staging/prod):

```text
□ Query A1: COUNT de global_users sem identities = 0
   (anti-join: global_users g WHERE NOT EXISTS identities i ON i.global_user_id = g.global_user_id)
□ Query A2: COUNT = 0 — mesma definição que `PLANO_IDENTITY_RECONCILIATION.md` §2.1 (actores `user`/`person`/`actor_human` com `global_user_id IS NULL` **e** `is_identity_required = true`). Scripts: `pnpm run identity:precheck:a1-a4` (backend).
□ Queries A3 e A4 = 0 / 0 linhas conforme plano §2.1
□ Output SQL colado (ou path para log) + data UTC + quem executou
```

Se qualquer contagem ≠ 0 → **permanece ATIVO** até PROPOSTA/`PLANO_IDENTITY_RECONCILIATION.md` executado e revalidado.

### Transição: módulo `BLOQUEADO` → `PENDENTE` / `EM EXECUÇÃO`

```text
□ Dependência listada em STATUS_EXECUCAO_GLOBAL resolvida (evidência: FASE S OK ou norma explícita)
□ Se a dependência era Identity: §GLOBAL BLOCK INATIVO (se aplicável ao trilho)
```

### Transição: módulo `EM EXECUÇÃO` → `CONCLUÍDO`

```text
□ FASE S = OK (§6.4 com prova)
□ BLOCO 1 e BLOCO 2 do plano instanciado concluídos (se o plano os usar)
□ CI / guards acordados executados no trilho (§15 / §CI)
□ §14 (EXECUTION LOG) com entrada de encerramento
```

### Proibições

- Alterar estado só porque “parece ok” ou “o Cursor achou”.
- Mudar **§GLOBAL BLOCK** sem colar outputs de query ou referência a log com mesmos números.

---

## §CI — Enforcement externo (pipeline + repositório)

O template e o código **assumem** integridade só se o **pipeline** e a **política de repositório** forem reais — não apenas documentação.

```text
O sistema NÃO é considerado “protegido” para execução contínua sem:

□ Workflow de CI a correr nos trilhos definidos em .github/workflows (ex.: regression guards, typecheck)
□ Guards do backend activos no CI: validate:regression-guards (ou equivalente no monorepo)
□ Branch protection / rulesets no GitHub: checks obrigatórios para merge em main (e ramos de integração acordados)

Se CI não corre, guards são ignorados no merge, ou checks não são obrigatórios:
→ execução contínua autónoma (§AC.1) NÃO deve ser assumida como segura
→ completar enforcement sistémico (humano no GitHub) antes de escalar automação

Nota: configuração de branch protection não vive no git; referir §CI em auditorias de governança.
```

---

## 7. Inventário (snapshot)

```bash
# Contar arquivos do módulo
find backend/src/modules/<nome>/ -name "*.ts" | wc -l
find backend/src/modules/<nome>/ -name "*.routes.ts" | wc -l
find backend/src/modules/<nome>/ -name "*repository*" -o -name "*repo*" | wc -l
find backend/src/modules/<nome>/ -name "*service*" | wc -l
```

| Métrica | Valor |
|---------|-------|
| Arquivos totais | ⟨ N ⟩ |
| Routes (`*.routes.ts`) | ⟨ N ⟩ |
| Repositories | ⟨ N ⟩ |
| Services | ⟨ N ⟩ |
| Outros (handlers, jobs, workers) | ⟨ N ⟩ |

---

## 8. Detecção de problemas

Preencher Sim/Não/NA + evidência (arquivo + linha).

### 8.1 Schema incompleto

```bash
# Tabelas referenciadas no código sem DDL na cadeia ativa de migrations
grep -rn "FROM \|INSERT INTO " backend/src/modules/<nome>/ --include="*.ts" \
  | grep -oP "(?<=FROM |INTO )[a-z_]+" | sort -u
```

⟨ comparar com `information_schema` — listar gaps ⟩

### 8.2 Duplicação de domínio

⟨ serviços com nomes semelhantes; dois caminhos para o mesmo facto normado ⟩

### 8.3 Event bus paralelo

```bash
grep -rn "domainEventBus\|eventBus\|EventEmitter\|publish(" \
  backend/src/modules/<nome>/ --include="*.ts"
# Classificar: interno (ok) vs cross-domain sem outbox (violação §EVENT_OUTBOX)
```

### 8.4 Escrita fora do SSOT

```bash
# Escrita em tabelas financeiras fora de modules/bank/
grep -rn "INSERT INTO bank_\|UPDATE bank_\|INSERT INTO ledger\|UPDATE ledger" \
  backend/src/modules/<nome>/ --include="*.ts"
# Esperado: 0 linhas
```

### 8.5 Uso de legacy

```bash
grep -rn "DEPRECATED\|legacy\|@deprecated\|TODO.*remov" \
  backend/src/modules/<nome>/ --include="*.ts"
```

### 8.6 Colunas fantasmas

⟨ código usa colunas que não existem no DDL do alvo — listar com evidência ⟩

### 8.7 Violação da Lei de Coerência Sistémica

```text
Verificar:
□ Existe criação de realidade paralela?
□ Existe estado fora do SSOT que deveria estar normado?
□ Existe duplicação de verdade para o mesmo agregado?
□ Existe inferência ou cache decisório que substitui o SSOT?

SIM em qualquer → FALHA ESTRUTURAL CRÍTICA → bloqueia execução → §8.8 + PROPOSTA
```

### 8.8 Registro obrigatório

Qualquer falha detectada em §8.1–8.7 → entrada em `docs/01_normative/FALSIFICATION_LOG.md`.

Formato mínimo:
```text
YYYY-MM-DD | módulo/<nome> | §8.⟨N⟩ | ⟨descrição da falha em uma linha⟩ | ⟨status: aberto/resolvido⟩
```

---

### 8.9 Acoplamento sistémico — pilares (greps obrigatórios)

#### AC-1. Identity writer
```bash
grep -rn "INSERT INTO actors" backend/src/modules/<nome>/ --include="*.ts"
```
Esperado: 0 linhas.
Qualquer resultado → confirmar se usa ensureUserActor() / ensurePageActor() via actor-writer.service.ts.
Caso contrário → FLAG + PROPOSTA (§13).
Ref: LEI_DE_COERENCIA §4.8.1

#### AC-2. Responsabilidade civil
```bash
grep -rn "actor_type.*page\|actor_type.*company\|actor_type.*hub" \
  backend/src/modules/<nome>/ --include="*.ts" | grep -i "INSERT\|create"
```
Para cada linha encontrada: confirmar presença de responsible_actor_id apontando para actor humano.
Ausência → FLAG + PROPOSTA.
Ref: LEI_DE_COERENCIA §4.8.2

#### AC-3. Authority local (duplicação proibida)
```bash
grep -rn "isAdmin\b\|\.role ===\|hasPermission\b\|canEdit\b\|canDelete\b" \
  backend/src/modules/<nome>/ --include="*.ts" | grep -v "node_modules\|\.spec\|\.test"
```
Esperado: 0 linhas de lógica de permissão hardcoded.
Qualquer resultado → avaliar migração para domínio authority/rbac.
Ref: LEI_DE_COERENCIA §4.9

#### AC-4. Agenda Universal (tempo próprio proibido)
```bash
# Verificar se o módulo cria tabelas de tempo próprias nas migrations
grep -rn "CREATE TABLE.*availability\|CREATE TABLE.*schedule\|CREATE TABLE.*time_slot\|CREATE TABLE.*calendar" \
  backend/migrations/ 2>/dev/null

# Verificar se o módulo referencia essas tabelas no código
grep -rn "schedule_slots\b\|unified_availability\|availability_windows" \
  backend/src/modules/<nome>/ --include="*.ts" | head -10
# Se 0 e o módulo lida com agendamento → investigar se cria estrutura própria
```
Se módulo cria tabela própria de disponibilidade/slots → FLAG.
Verificar se deve referenciar Agenda Universal em vez de criar estrutura paralela.
Ref: CORE_IMUTAVEL §AGENDA UNIVERSAL

---

## 9. Detecção de duplicidade

| Eixo | Pergunta | Resposta |
|------|----------|----------|
| core vs módulo | Mesmo conceito com semântica diferente? | ⟨ ⟩ |
| services vs modules | Facade redundante ou serviço duplicado? | ⟨ ⟩ |
| Múltiplos writers | Mais de um ponto de INSERT/UPDATE para o mesmo agregado? | ⟨ ⟩ |
| Múltiplas fontes de verdade | Dois lugares que "mandam" no mesmo estado? | ⟨ ⟩ |

```bash
# Writers do agregado principal
grep -rn "INSERT INTO <tabela_principal>" backend/src/ --include="*.ts" \
  | grep -v ".spec\|.test\|node_modules"
# Listar cada writer e classificar: canônico / duplicado / legacy
```

### 9.1 Comparação obrigatória com `src/core/`

```bash
# Verificar se o conceito central deste módulo já existe em core/
# Substituir <conceito> pelo nome da entidade principal (ex: event, order, payment)

# 1. Services com mesmo nome ou propósito
find backend/src/core/ -name "*<conceito>*" -name "*.ts" 2>/dev/null

# 2. Mesmo INSERT INTO <tabela_principal> em core/
grep -rn "INSERT INTO <tabela_principal>" backend/src/core/ --include="*.ts" \
  | grep -v ".spec\|.test\|node_modules"

# 3. Imports cruzados (core importa módulo ou vice-versa de forma inesperada)
grep -rn "from.*modules/<nome>" backend/src/core/ --include="*.ts" | grep -v node_modules
grep -rn "from.*core/" backend/src/modules/<nome>/ --include="*.ts" \
  | grep -v node_modules | grep -v "@core/"  # imports de @core/ são normais
```

```text
RESULTADO DA COMPARAÇÃO COM core/:

Conceito equivalente encontrado em core/: ⟨ sim/não — se sim: qual arquivo ⟩
Writers duplicados entre core/ e módulo: ⟨ sim/não — se sim: listar ⟩
Import circular ou dependência invertida: ⟨ sim/não — se sim: descrição ⟩

Se SIM em qualquer → PROPOSTA obrigatória (§13) antes de continuar.
```

### 9.2 SSOT transversal (obrigatório — além da comparação com `core/`)

Verificar se o módulo **reutiliza** os SSOT já normados ou se introduz paralelo (segunda verdade):

```text
□ Identity — actors / identities / global_users: sem reimplementar KYC ou “inferir” pessoa fora de identities + IDENTITY_SSOT_PRECEDENCE.md
□ Bank — ledger / transações: sem escrita decisória fora de modules/bank/ (SSOT_EXCLUSIVE_BANK_RULE)
□ Tempo — timestamps canónicos: TIMESTAMPTZ; sem campo paralelo de “tempo decisório” sem política

Se o módulo:
- reimplementa lógica já normada noutro SSOT
- cria campo ou tabela paralela para o mesmo facto
- toma decisão de negócio a partir de cache/actor sem reconciliação com o SSOT aplicável

→ PROPOSTA obrigatória (§13) + avaliar §8.7 e §PILARES TRANSVERSAIS
```

---

## 10. Classificação de domínio

Para cada entidade/tabela relevante do módulo:

| Entidade | Classe | Estado no alvo | Notas |
|----------|--------|----------------|-------|
| ⟨ nome ⟩ | SSOT / pré-financeiro / observacional | EMPTY/BOOTSTRAP/PARTIAL/LIVE | |

---

## §PILARES TRANSVERSAIS

Nenhum módulo pode introduzir **segunda verdade** para estes eixos; sempre reutilizar os SSOT e contratos normados:

```text
□ Identidade civil / KYC → identities (+ IDENTITY_SSOT_PRECEDENCE.md); actors = projeção operacional
□ Tempo → TIMESTAMPTZ (UTC); sem “tempo local” decisório sem política explícita
□ Dinheiro realizado → Bank (bank_ledger, bank_transactions — SSOT_EXCLUSIVE_BANK_RULE)
□ Autoridade de ação → actor_id + permissões; sem atalhos que contornem identity quando a norma exige vínculo civil
```

Violação → §8.7 + §GLOBAL BLOCK conforme gravidade.

## 11. Acoplamento sistémico

Ref normativo: `docs/01_normative/ACTOR_TRACEABILITY_CONTRACT.md`

Impacto por sistema (preencher por módulo):

> Executar §8.9 antes de preencher esta tabela — os greps de acoplamento sistémico informam o nível de impacto real por pilar.

| Sistema | Impacto | Notas |
|---------|---------|-------|
| Bank | ⟨ baixo/médio/alto ⟩ | |
| Events | ⟨ ⟩ | |
| Identity (actors, identities) | ⟨ ⟩ | |
| Risk / ATL / compliance | ⟨ ⟩ | |

---

## 12. Migrations: checklist pré-apply

### 12.1 Checklist obrigatório

```text
Antes de qualquer migration no alvo:

□ FASE S (§6) concluída com STATUS explícito
□ DATABASE_STATE e classificação §0.1 definidos
□ Impacto em dados avaliado (contagens, NULLs, magnitude monetária)
□ Migration forward-only e idempotente (DO $$ + information_schema)
□ Gate 2 e §4.1 verificados
□ Nomenclatura verificada contra 07_NOMENCLATURA_CANONICA.md
□ Vínculo normativo: PROPOSTA + APROVADO (§13) OU exceção bootstrap (§5.3) com linha no §14

Se qualquer item falhar → NÃO EXECUTAR → §5.1
```

### 12.2 Ordem de ataque

```text
1. Não financeiro / não crítico (baixo acoplamento ao Bank)
2. Catálogo / configuração do domínio
3. Estado de negócio sem liquidação
4. Integração com intenções de pagamento (sem escrever ledger)
5. Por último: impacto financeiro direto

Dúvida na ordem → PARAR → PROPOSTA (§13)
```

### 12.3 Template de migration (forward-only obrigatório)

```sql
-- Arquivo: backend/migrations/⟨TIMESTAMP⟩_⟨módulo⟩_⟨descricao⟩.sql
-- Ref: PROPOSTA-⟨YYYYMMDD-HHMM⟩ APROVADO | bootstrap §5.3
-- Gate 2: ⟨ confirmar não toca bank_* ⟩
-- Nomenclatura: ⟨ confirmar 07_NOMENCLATURA_CANONICA.md ⟩

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = '⟨tabela⟩'
      AND column_name  = '⟨coluna⟩'
  ) THEN
    ALTER TABLE ⟨tabela⟩ ADD COLUMN ⟨coluna⟩ ⟨tipo⟩;
  END IF;
END $$;

COMMIT;
```

---

## 13. Proposta controlada

```text
PROPOSTA-⟨YYYYMMDD-HHMM⟩:

- Problema identificado: ⟨descrição objetiva com evidência — arquivo + linha⟩
- Opções:
    A. ⟨opção A⟩
    B. ⟨opção B⟩
- Impacto:
    SSOT:     ⟨ ⟩
    Bank:     ⟨ ⟩
    Events:   ⟨ ⟩
    Identity: ⟨ ⟩
- Nomenclatura verificada: ⟨ sim/não — referência §07 ⟩
- Recomendação: ⟨ opção X por ⟨motivo⟩ ⟩

AGUARDANDO APROVAÇÃO
```

Execução só após:
```text
APROVADO: executar opção X  [assinado por Clayton / decisão explícita]
```

### 13.1 Vínculo PROPOSTA → execução

Toda execução material deve referenciar: identificador da PROPOSTA + `APROVADO: opção X`.  
Sem essa ligação → execução inválida para governação.

---

## 14. EXECUTION LOG

```text
Regra: cada entrada deve indicar:
- FASE S (§6): OK | INCONSISTENTE
- Exceção bootstrap (§5.3): sim | não — se sim, confirmar §0.3
- PROPOSTA: identificador + APROVADO quando não for bootstrap
```

| Data / hora (UTC) | Tipo | Ação | Referência normativa |
|-------------------|------|------|---------------------|
| ⟨ inicial ⟩ | Abertura | Criação do plano a partir de PLANO_BASE_MODULO.md v2.4 | §0, §1, §2 |
| | | ⟨ próximos eventos ⟩ | |

---

## 15. CI Guards (criar no final do módulo)

Seguindo **07_NOMENCLATURA_CANONICA.md §17.6**, cada módulo deve ter ao menos:

### 15.1 Gate de fronteira financeira

```bash
# backend/scripts/audit-⟨módulo⟩-boundaries.sh
#!/bin/bash
# Gate financeiro: nenhum INSERT/UPDATE em bank_* fora de modules/bank/

VIOLATIONS=$(grep -rn \
  "INSERT INTO bank_\|UPDATE bank_\|INSERT INTO ledger\b\|UPDATE ledger\b" \
  backend/src/ --include="*.ts" \
  | grep -v "modules/bank/\|scripts/\|node_modules")

if [ -n "$VIOLATIONS" ]; then
  echo "GATE FAIL [financeiro]: escritas em bank_* fora de modules/bank/"
  echo "$VIOLATIONS"
  exit 1
fi
echo "GATE OK [financeiro]"
```

### 15.2 Gate de nomenclatura (campos monetários)

```bash
# Detectar campos monetários com tipo errado
psql "$DATABASE_URL" -c "
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (⟨tabelas do módulo⟩)
  AND (column_name LIKE '%amount%' OR column_name LIKE '%price%' OR column_name LIKE '%cents%')
  AND data_type != 'bigint';
"
# Esperado: 0 linhas
```

### 15.3 Registro em GATES.md

```text
Após criar os guards, adicionar linha em docs/04_audit/GATES.md:

| ⟨módulo⟩ | audit-⟨módulo⟩-boundaries.sh | ⟨YYYY-MM-DD⟩ | soft/blocking |
```

---

## 16. Regra final

```
sem FASE S OK → não executar nada que assuma schema ou estado persistido
```

Exceções: documentação pura, spikes read-only, grep/auditoria sem escrita.  
§5.3 não revoga esta regra para ambientes LIVE sem PROPOSTA aprovada.

---

## 17. Ligações úteis (preencher por módulo)

- Log de execução: `docs/03_execution_log/⟨módulo⟩-AUDIT-⟨YYYYMMDD⟩.md`
- FALSIFICATION_LOG: `docs/01_normative/FALSIFICATION_LOG.md`
- Índice operacional: `STATUS_EXECUCAO.md`
- **Orquestração global:** `STATUS_EXECUCAO_GLOBAL.md` (raiz)
- Plano identity (reconciliação): `PLANO_IDENTITY_RECONCILIATION.md` (raiz) — A2 = actores **elegíveis** (`is_identity_required`, §2.1)  
- Runbook identity: `EXECUTAR/IDENTITY_RECONCILIATION_RUNBOOK.md` (CP-1…CP-7, triagem Grupo C, precheck antes de lotes em `actors`)  
- **Implementação física** dos comandos `identity:*`: `backend/package.json` + ficheiros em `backend/scripts/`; a **raiz** do monorepo (`package.json`) expõe os mesmos nomes como *proxy* (`npm run identity:precheck:a1-a4`, etc.) — confirmar no repo antes de afirmar “infra pronta” em auditoria isolada. Requer `DATABASE_URL` em `backend/.env`.  
- Raiz: `npm run validate:system-state`, `validate:tax-id-ledger` (ledger dedup)  
- Deduplicação `tax_id` (quando A4 > 0): `PLANO_DEDUPLICACAO_TAX_ID.md` (raiz)
- Inventário modular: `MODULOS.txt`
- Gates ativos: `docs/04_audit/GATES.md`

---

**Fim do template v2.5 (2026-04-15 — A2 elegíveis, `is_identity_required`, scripts identity + gates).**  
Não substitui norma; reforça aderência. Copiar e instanciar por módulo.  
Divergência entre este template e `PLANO_BASE_MODULO.md` → prevalece o template mais recente com data explícita.
