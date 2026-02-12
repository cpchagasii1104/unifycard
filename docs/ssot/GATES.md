# GATES — SSOT UnifiCard

Este documento define os **Gates formais de execução** do plano de correção SSOT
e da **Autoridade Constitucional** do sistema.

Cada Gate é **BINÁRIO**: PASSA ou FALHA.  
Não existe “quase”, “parcial”, “depois a gente vê” ou “exceção operacional”.

Gate passado **NÃO pode ser reaberto** sem:
- registro explícito em `FALSIFICATION_LOG.md`
- nova evidência
- justificativa normativa

---

## VISÃO GERAL DOS GATES

| Gate | Nome | Objetivo |
|-----:|------|----------|
| A | Autoridade Constitucional | Selar a Lei de Autoridade |
| 0 | Baseline & Evidência | Congelar estado real do sistema |
| 1 | SSOT Registry | Declarar autoridades únicas |
| 2 | Bloqueio Estrutural | Impedir novas violações |
| 3 | Remoção de Escritas | Eliminar writers proibidos |
| 4 | Consolidação Bancária | Centralizar dinheiro no Bank |
| 5 | Limpeza Final | Remover legado e validar SSOT |

> **Regra de precedência:**  
> Gate A **sempre** precede qualquer outro Gate.  
> Se o Gate A falhar, **todos os demais Gates são inválidos**.

---

## GATE A — AUTORIDADE CONSTITUCIONAL (NOVO · OBRIGATÓRIO)

### Objetivo
Garantir que o sistema possua **Lei de Autoridade escrita, selada e não interpretável**,
antes de qualquer execução técnica.

Sem este Gate, **não existe SSOT legítimo**.

---

### Critérios de PASS (TODOS obrigatórios)

#### 1. Lei Constitucional
- `AUTHORITY_LAW.md` existe, versionado e aprovado
- Artigos numerados, definições fechadas e precedência explícita
- Nenhuma ambiguidade normativa aberta

#### 2. Anexos Constitucionais
Existem e estão versionados:
- `AUTHORITY_ANNEX_IRREVERSIBLE_ACTIONS.md`
- `AUTHORITY_ANNEX_EVASION.md`
- `AUTHORITY_ANNEX_TEST_OF_BREAK.md`

#### 3. Conteúdo Obrigatório Verificado
A Lei define explicitamente:
- raiz humana irrenunciável (CPF)
- separação Autoridade × Permissão
- responsabilidade econômica única
- ATL determinístico e não-configurável
- quarentena sem exceção
- herança de ATL por associação
- guarda sem cadeia e com responsabilidade solidária
- IA com limites de escopo, volume, irreversibilidade e kill switch
- tentativa = violação consumada
- ordem de precedência entre travas

#### 4. Teste de Falsificação
- Todos os **20 cenários** do `AUTHORITY_ANNEX_TEST_OF_BREAK.md`
  são explicitamente bloqueados por artigo constitucional
- Nenhum cenário possui workaround legítimo

---

### Critérios de FAIL

- Lei inexistente ou incompleta
- Anexo ausente
- Conceito “implícito” ou “interpretável”
- Exceção não normatizada
- Dependência de decisão futura
- Tentativa de empurrar definição para código

**Status:** ⏳ **A EXECUTAR (BLOQUEANTE)**

---

## GATE 0 — BASELINE & EVIDÊNCIA

### Objetivo
Congelar o estado real do sistema **antes de qualquer correção**.

### Critérios de PASS
- `IMPACT_MATRIX.md` preenchido
- Snapshot de impacto salvo
- `WRITE_SURFACE_BASELINE.md` preenchido
- `baseline/write_surface_grep.txt` gerado (mesmo vazio)
- `FALSIFICATION_LOG.md` criado
- Evidência vazia explicada (se aplicável)

### Critérios de FAIL
- Evidência inventada
- Arquivos ausentes
- Snapshot editado após criação

**Status:** ✅ **FECHADO**

---

## GATE 1 — SSOT REGISTRY

### Objetivo
Declarar explicitamente **quem decide o quê** no sistema,
**subordinado à Lei de Autoridade**.

### Critérios de PASS
- `SSOT_REGISTRY.md` alinhado à `AUTHORITY_LAW.md`
- Autoridades únicas declaradas por domínio
- Campos obrigatórios presentes:
  - ResponsibleActor
  - UltimateLiabilityActor
  - EconomicLiabilityActor
  - AuthorityCeiling
- SSOT financeiro ancorado exclusivamente em:
  - `bank_ledger`
  - `bank_transactions`
  - `bank_splits`
- Domínios NÃO-SSOT explicitamente declarados
- Estruturas proibidas referenciadas (`PROHIBITED_STRUCTURES.md`)

### Critérios de FAIL
- Autoridade implícita
- Saldo fora do ledger
- Domínio sem responsável humano
- SSOT definido por código

**Status:** ⏳ **AGUARDANDO (DEPENDE DO GATE A)**

---

## GATE 2 — BLOQUEIO ESTRUTURAL

### Objetivo
Impedir **novas violações** de SSOT e Autoridade no código.

### Ações esperadas
- Bloqueio mecânico de escrita em estruturas proibidas
- Guardas contra autoridade implícita
- Impedir:
  - flags de poder
  - enums decisórios
  - override emergencial

### Critérios de PASS
- Nenhum novo writer proibido possível
- Código novo não consegue violar SSOT nem Autoridade

### Critérios de FAIL
- Escrita legacy ainda possível
- Autoridade inferida de estrutura

**Status:** ⏳ **A EXECUTAR**

---

## GATE 3 — REMOÇÃO DE ESCRITAS PROIBIDAS

### Objetivo
Eliminar **todos os writers proibidos** identificados.

### Ações esperadas
- Refatorar ou deletar arquivos “MORREM”
- Atualizar `WRITE_SURFACE_BASELINE.md`
- Registrar falsificações encontradas

### Critérios de PASS
- Nenhuma escrita proibida restante
- Evidência antes/depois comprovada

### Critérios de FAIL
- Writer residual
- Uso “temporário” não documentado

**Status:** ✅ **FECHADO (PASSOU TECNICAMENTE)**

---

## GATE 4 — CONSOLIDAÇÃO BANCÁRIA

### Objetivo
Garantir que **todo dinheiro passa pelo Bank**.

### Ações esperadas
- Eventos → Bank
- Splits finais exclusivamente no Bank
- Ledger bancário como única verdade contábil

### Critérios de PASS
- Nenhuma decisão financeira fora do Bank
- Nenhuma aritmética financeira em JS
- Leitura legacy apenas informativa

### Critérios de FAIL
- Decisão híbrida
- Saldo paralelo
- Status financeiro fora do ledger

**Status:** ✅ **FECHADO (ESCOPO BANK)**  
**Observação:** outros domínios serão validados após Gate A.

---

## GATE 5 — LIMPEZA FINAL

### Objetivo
Remover **legado morto** e validar o SSOT final.

### Ações esperadas
- Deletar tabelas proibidas
- Remover código morto
- Reset de schema para mínimo canônico
- Executar checklist completo de falsificação

### Critérios de PASS
- Schema limpo
- Código sem referência proibida
- SSOT único ponta a ponta

### Critérios de FAIL
- Legacy mantido “por segurança”
- Referência oculta
- Decisão fora do Bank ou da Lei

**Status:** ⏳ **A EXECUTAR**

---

## REGRA FINAL

> Gate só passa com **evidência**.  
> Evidência sem Gate **não vale**.  
> Gate sem evidência **é fraude**.

---

FIM DO GATES — SSOT UNIFICARD
