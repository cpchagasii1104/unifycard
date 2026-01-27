# GATES — SSOT UnifiCard

Este documento define os **Gates formais de execução** do plano de correção SSOT.
Cada Gate é **binário**: PASSA ou FALHA.
Não existe “quase”, “parcial” ou “depois a gente vê”.

Gate passado **não pode ser reaberto** sem registro explícito no FALSIFICATION_LOG.

---

## VISÃO GERAL DOS GATES

| Gate | Nome | Objetivo |
|-----|------|----------|
| 0 | Baseline & Evidência | Congelar estado real do sistema |
| 1 | SSOT Registry | Declarar autoridades únicas |
| 2 | Bloqueio Estrutural | Impedir novas violações |
| 3 | Remoção de Escritas | Eliminar writers proibidos |
| 4 | Consolidação Bancária | Centralizar dinheiro no Bank |
| 5 | Limpeza Final | Remover legado e validar SSOT |

---

## GATE 0 — BASELINE & EVIDÊNCIA

### Objetivo
Congelar o estado real do sistema **antes de qualquer correção**.

### Critérios de PASS
- `IMPACT_MATRIX.md` preenchido
- `baseline/impact_matrix_snapshot.md` salvo
- `WRITE_SURFACE_BASELINE.md` preenchido
- `baseline/write_surface_grep.txt` gerado (mesmo vazio)
- `FALSIFICATION_LOG.md` criado
- Evidência vazia explicada (se aplicável)

### Critérios de FAIL
- Evidência inventada
- Arquivos ausentes
- Snapshot editado após criação

**Status:** FECHADO

---

## GATE 1 — SSOT REGISTRY

### Objetivo
Declarar explicitamente **quem decide o quê** no sistema.

### Critérios de PASS
- `SSOT_REGISTRY.md` preenchido
- SSOT financeiro ancorado em:
  - `bank_ledger`
  - `bank_transactions`
  - `bank_splits`
- Estruturas proibidas explicitadas

### Critérios de FAIL
- SSOT implícito
- Saldo declarado fora do ledger
- Estrutura inventada sem evidência

**Status:** FECHADO

---

## GATE 2 — BLOQUEIO ESTRUTURAL

### Objetivo
Impedir **novas violações** de SSOT no código.

### Ações esperadas
- Proibir escrita em estruturas legacy
- Criar guardas, asserts ou lint
- Bloquear uso proibido em novos códigos

### Critérios de PASS
- Nenhum novo writer proibido possível
- Código novo não consegue violar SSOT

### Critérios de FAIL
- “Depois a gente corrige”
- Escrita legacy ainda possível

**Status:** A EXECUTAR

---

## GATE 3 — REMOÇÃO DE ESCRITAS PROIBIDAS

### Objetivo
Eliminar **todos os writers proibidos** identificados na Matriz de Impacto.

### Ações esperadas
- Refatorar ou deletar arquivos “MORREM”
- Atualizar `WRITE_SURFACE_BASELINE.md`
- Registrar falsificações encontradas

### Critérios de PASS
- Nenhuma escrita proibida restante
- Evidência atualizada
- Comparação antes/depois comprovada

### Critérios de FAIL
- Writer residual
- Uso “temporário” não documentado

**Status:** A EXECUTAR

---

## GATE 4 — CONSOLIDAÇÃO BANCÁRIA

### Objetivo
Garantir que **todo dinheiro passa pelo Bank**.

### Ações esperadas
- Eventos → Bank
- Splits finais no Bank
- Ledger bancário como única verdade

### Critérios de PASS
- Nenhuma decisão financeira fora do Bank
- Leitura legacy apenas informativa

### Critérios de FAIL
- Decisão híbrida
- Saldo paralelo

**Status:** A EXECUTAR

---

## GATE 5 — LIMPEZA FINAL

### Objetivo
Remover **legado morto** e validar o SSOT final.

### Ações esperadas
- Deletar tabelas proibidas
- Remover código morto
- Validar sistema sem legacy

### Critérios de PASS
- Schema limpo
- Código sem referência proibida
- SSOT único operacional

### Critérios de FAIL
- Legacy mantido “por segurança”
- Referência oculta

**Status:** A EXECUTAR

---

## REGRA FINAL

> Gate só passa com **evidência**.  
> Evidência sem Gate **não vale**.  
> Gate sem evidência **é fraude**.

---

FIM DO GATES
