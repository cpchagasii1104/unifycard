# Governança de Sistema e Prevenção de Regressão

## 1. Objetivo

Este documento consolida os princípios, decisões e ações necessárias para garantir que o sistema evolua **sem regressão**, respeitando integralmente as leis já definidas e impedindo desvios de comportamento.

---

## 2. Princípios Fundamentais

### 2.1 Imutabilidade Comportamental
O comportamento já definido no sistema não pode ser reinterpretado ou flexibilizado.

- Regras existentes são definitivas
- Fluxos definidos não podem ser alterados implicitamente
- Qualquer mudança deve ser explícita, controlada e auditável

---

### 2.2 Sistema Governado por Leis
O sistema não é orientado por código, mas por leis.

- Código implementa leis
- Código não decide regras
- Nenhuma camada pode sobrescrever governança

---

### 2.3 Ausência de Liberdade Interpretativa

- Não pode existir "quase igual"
- Não pode existir "equivalente"
- Não pode existir comportamento implícito

Se não está explicitamente definido → é inválido.

---

## 3. Problemas Identificados

### 3.1 Regras apenas documentadas
- Regras existem fora do sistema
- Implementações divergem
- Drift inevitável

### 3.2 Falta de travas estruturais
- Nenhum ponto impede violações
- Sistema aceita inconsistências

### 3.3 Cursor sem controle
- Fluxo não é rigidamente validado
- Transições indevidas são possíveis

### 3.4 Falta de rastreabilidade obrigatória
- Violações podem ocorrer sem registro
- Falhas não são detectadas imediatamente

---

## 4. Diretrizes de Implementação

### 4.1 Leis devem virar Constraints

Toda regra crítica deve ser implementada como:

- Constraint de banco de dados
- Validação obrigatória em runtime

Se uma regra não quebra o sistema ao ser violada → ela não é uma regra real.

---

### 4.2 Máquina de Estados Implícita

O sistema deve operar com transições controladas:

- Estados bem definidos
- Transições permitidas explicitamente
- Qualquer transição inválida deve falhar

Exemplo:

```
A → B → C permitido
A → C direto = erro
```

---

### 4.3 Controle de Cursor

O cursor não pode ser livre.

- Deve seguir um fluxo determinístico
- Deve validar estado atual antes de avançar
- Deve impedir saltos ou reinterpretações

---

### 4.4 Logging de Falsificação

Qualquer tentativa de violação deve gerar log automaticamente.

Casos obrigatórios:

- Violação de regra
- Escrita inconsistente
- Desvio do SSOT
- Transição inválida

O log deve ser:

- Automático
- Não opcional
- Independente da lógica de aplicação

---

### 4.5 Compatibilidade Reversa

Toda alteração deve ser:

- Backward compatible
ou
- Explicitamente bloqueada

Não é permitido assumir que "não quebra".

---

## 5. Ações Necessárias

### 5.1 Estruturar Constraints

- Mapear todas as leis existentes
- Implementar constraints no banco
- Garantir falha imediata em violação

---

### 5.2 Implementar Guardas de Runtime

- Validar todas as entradas
- Validar transições de estado
- Bloquear execuções inválidas

---

### 5.3 Criar Sistema de Falsification Log

- Estrutura centralizada de logging
- Registro automático de violações
- Auditoria contínua

---

### 5.4 Definir Máquina de Estados

- Modelar estados do sistema
- Definir transições válidas
- Impedir qualquer desvio

---

### 5.5 Auditoria de Fluxo (Cursor)

- Garantir sequência correta
- Bloquear saltos de etapa
- Validar coerência do fluxo

---

## 6. Riscos

### 6.1 Regressão Silenciosa
Mudanças que não quebram imediatamente, mas alteram comportamento ao longo do tempo.

Impacto:
- Perda de confiabilidade
- Inconsistência de dados
- Difícil rastreamento

---

### 6.2 Drift de Regra
Implementações divergindo da definição original.

Impacto:
- Sistema deixa de refletir o modelo
- Regras deixam de ser confiáveis

---

### 6.3 Quebra de Fluxo
Cursor seguindo caminhos inválidos.

Impacto:
- Estados inconsistentes
- Execuções inválidas

---

### 6.4 Falta de Auditoria
Violações sem registro.

Impacto:
- Impossibilidade de diagnóstico
- Erros acumulados

---

### 6.5 Flexibilização Indevida
Código introduzindo exceções não autorizadas.

Impacto:
- Sistema perde governança
- Regras deixam de ser absolutas

---

## 7. Regra Central

Se uma violação consegue ocorrer sem quebrar o sistema:

→ O sistema não está protegido.

---

## 7.1 SSOT Temporal

SSOT temporal deve ser único — múltiplas fontes são proibidas.

**Fonte canônica:**
- `unified_availability` + `unified_bookings`

**Fontes legadas (PROIBIDO WRITE):**
- `schedules` + `schedule_slots`
- READ-ONLY durante migração
- Migração obrigatória via DECISION-0014

**Violação:**
- Qualquer INSERT/UPDATE em schedules ou schedule_slots
- Classificada como CRITICAL (C63)

---

## 8. Estado Final Esperado

- Zero regressão silenciosa
- Zero liberdade interpretativa
- Zero bypass de regras
- Total rastreabilidade
- Fluxo determinístico

O sistema deixa de ser permissivo e passa a ser **restritivo por definição**.

---

## 9. Conclusão

A robustez do sistema não vem de documentação, mas de **impossibilidade técnica de violação**.

Leis devem ser executáveis.

Qualquer outra abordagem é frágil.
