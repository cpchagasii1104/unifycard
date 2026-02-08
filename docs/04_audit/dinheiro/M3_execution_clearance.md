# PARECER DE AUTORIZAÇÃO — EXECUÇÃO M3

## STATUS
MODO: GUARDIÃO  
Data: 2026-02-05  
Norma de Referência: docs/01_normative/07_NOMENCLATURA_CANONICA.md  
Auditoria Base: docs/04_audit/dinheiro/M3_percentage_semantics_audit.md  

---

## VALIDAÇÃO DE CONFORMIDADE

### ✅ CHECKLIST OBRIGATÓRIO

- [x] Renomeia apenas para `*Bps`
- [x] NÃO converte valores
- [x] NÃO altera tipo
- [x] NÃO altera cálculo
- [x] NÃO toca em métricas derivadas
- [x] NÃO toca em ambíguos

---

## ARQUIVOS PERMITIDOS PARA EXECUÇÃO M3

### CATEGORIA: COMISSÕES E TAXAS DE PLATAFORMA

**1. backend/src/modules/services/service-order.service.ts:865-866**
- Campo: `PLATFORM_FEE_PERCENTAGE`
- Classificação: **Percentual verdadeiro**
- Ação permitida: Renomear para `PLATFORM_FEE_BPS`
- Conversão: NÃO (manter valor 0-100, apenas renomear)

**2. backend/src/modules/services/service-order.types.ts:127**
- Campo: `platformFeePercentage`
- Classificação: **Percentual verdadeiro**
- Ação permitida: Renomear para `platformFeeBps`
- Conversão: NÃO (manter valor 0-100, apenas renomear)

**3. backend/src/modules/marketplace/regional-fee.types.ts:26,41**
- Campo: `feePercentage`
- Classificação: **Percentual verdadeiro**
- Ação permitida: Renomear para `feeBps`
- Conversão: NÃO (manter valor 0-100, apenas renomear)

---

### CATEGORIA: PENALIDADES

**4. backend/src/modules/marketplace/marketplace.service.ts (penalty_rate)**
- Campo: `penalty_rate`
- Classificação: **Percentual verdadeiro**
- Ação permitida: Renomear para `penaltyBps`
- Conversão: NÃO (manter valor 0-100, apenas renomear)

---

### CATEGORIA: COMPENSAÇÃO

**5. backend/src/contracts/marketplace/ResourceCompensation.contract.ts**
- Campos: `percentValue`, `variablePercent`
- Classificação: **Percentual verdadeiro**
- Ação permitida: Renomear para `percentValueBps`, `variablePercentBps`
- Conversão: NÃO (manter valor 0-100, apenas renomear)

---

### CATEGORIA: DESCONTOS

**6. Campos `discountPercentage`**
- Classificação: **Percentual verdadeiro**
- Ação permitida: Renomear para `discountBps`
- Conversão: NÃO (manter valor 0-100, apenas renomear)

---

### CATEGORIA: SOCIAL / VOTOS

**7. backend/src/modules/groups/groups.repository.ts**
- Campo: `profit_percentage`
- Classificação: **Percentual verdadeiro**
- Ação permitida: Renomear para `profitBps`
- Conversão: NÃO (manter valor 0-100, apenas renomear)

**8. Campos `percentage` em votos / métricas sociais**
- Classificação: **Percentual verdadeiro**
- Ação permitida: Renomear para `*Bps` (contexto específico)
- Conversão: NÃO (manter valor 0-100, apenas renomear)

---

### CATEGORIA: MARGENS E MARKUPS

**9. Campos `*_margin_percentage`**
- Classificação: **Percentual verdadeiro**
- Ação permitida: Renomear para `*MarginBps`
- Conversão: NÃO (manter valor 0-100, apenas renomear)

---

### CATEGORIA: TAXAS / SLA / REPUTAÇÃO

**10. Campos `*Rate`, `*Percentage` calculados**
- Classificação: **Percentual verdadeiro**
- Ação permitida: Renomear para `*Bps` (apenas se armazenados, não calculados dinamicamente)
- Conversão: NÃO (manter valor 0-100, apenas renomear)
- **RESTRIÇÃO:** Apenas campos armazenados. Métricas calculadas em tempo de execução são EXCLUÍDAS.

---

## ARQUIVOS EXPLICITAMENTE EXCLUÍDOS

### ❌ FRAÇÕES (NÃO SÃO PERCENTUAIS)

**1. backend/src/modules/marketplace/unifycard-method.types.ts:23**
- Campo: `feePercentage`
- Classificação: **Fração (0-1)**
- **EXCLUÍDO:** Não é percentual, é fração decimal
- **AÇÃO PROIBIDA:** Não renomear, não tocar

**2. backend/src/modules/marketplace/payment-method.types.ts:31**
- Campo: `feePercentage`
- Classificação: **Fração (0-1)**
- **EXCLUÍDO:** Não é percentual, é fração decimal
- **AÇÃO PROIBIDA:** Não renomear, não tocar

---

### ❌ AMBÍGUOS (REQUEREM DECISÃO SEMÂNTICA)

**3. backend/src/modules/marketplace/marketplace.service.ts**
- Campo: `percentage` (splits)
- Classificação: **Ambíguo**
- **EXCLUÍDO:** Semântica indefinida
- **AÇÃO PROIBIDA:** Não renomear, não tocar

**4. Campos `percentage` (override)**
- Classificação: **Ambíguo**
- **EXCLUÍDO:** Forma indefinida
- **AÇÃO PROIBIDA:** Não renomear, não tocar

**5. `commission.value` quando type === 'percentage'**
- Classificação: **Ambíguo**
- **EXCLUÍDO:** Sem unidade explícita
- **AÇÃO PROIBIDA:** Não renomear, não tocar

**6. `*Rate` armazenado como 0–1 e exibido como 0–100**
- Classificação: **Ambíguo**
- **EXCLUÍDO:** Conflito semântico (fração vs percentual)
- **AÇÃO PROIBIDA:** Não renomear, não tocar

---

### ❌ MÉTRICAS CALCULADAS (NÃO ARMAZENADAS)

**7. Campos `*Rate`, `*Percentage` calculados dinamicamente**
- Classificação: **Métrica calculada**
- **EXCLUÍDO:** Não são campos armazenados, são resultados de cálculo
- **AÇÃO PROIBIDA:** Não renomear, não tocar

---

## REGRAS DE EXECUÇÃO OBRIGATÓRIAS

### PERMITIDO
- ✅ Renomear identificadores de campos classificados como "Percentual verdadeiro"
- ✅ Aplicar sufixo `Bps` aos nomes de campos
- ✅ Manter valores numéricos inalterados (0-100 permanece 0-100)
- ✅ Manter tipos inalterados (`number` permanece `number`)

### PROIBIDO
- ❌ Converter valores (ex: 3 → 300, 0.03 → 300)
- ❌ Alterar tipos (ex: `number` → `integer`)
- ❌ Alterar cálculos ou lógica de negócio
- ❌ Tocar em campos classificados como "Fração"
- ❌ Tocar em campos classificados como "Ambíguo"
- ❌ Tocar em métricas calculadas dinamicamente
- ❌ Criar helpers ou funções de conversão
- ❌ Usar casts (`as any`, `as unknown`)
- ❌ Alterar SQL ou queries
- ❌ Modificar arquivos não listados neste parecer

---

## DECLARAÇÃO FINAL

### ✅ EXECUÇÃO M3 ESTÁ AUTORIZADA

**Condições:**
1. A execução deve respeitar INTEGRALMENTE as regras acima
2. A execução deve tocar SOMENTE os arquivos/campos listados como "PERMITIDOS"
3. A execução deve EXCLUIR COMPLETAMENTE os arquivos/campos listados como "EXCLUÍDOS"
4. A execução deve manter valores e tipos inalterados (apenas renomeação)
5. A execução deve gerar log obrigatório em `docs/03_execution_log/M3_percentage_naming.md`

**Violação de qualquer condição:**
→ EXECUÇÃO INVÁLIDA
→ ABORTAR IMEDIATAMENTE

---

## VALIDAÇÃO DE CONFORMIDADE COM M3-A, B, C e D

### M3-A: Percentuais Verdadeiros
✅ **CONFORME** — Apenas campos classificados como "Percentual verdadeiro" estão autorizados

### M3-B: Candidatos Claros a BPS
✅ **CONFORME** — Lista de candidatos claros respeitada

### M3-C: Exclusão de Ambíguos
✅ **CONFORME** — Todos os campos ambíguos estão explicitamente excluídos

### M3-D: Exclusão de Frações e Métricas
✅ **CONFORME** — Frações e métricas calculadas estão explicitamente excluídas

---

**Parecer emitido por:** IA GUARDIÃ  
**Status:** AUTORIZADO COM RESTRIÇÕES  
**Data:** 2026-02-05
