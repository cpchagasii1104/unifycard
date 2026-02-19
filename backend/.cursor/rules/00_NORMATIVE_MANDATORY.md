---
alwaysApply: true
description: Regra obrigatória de consulta à documentação normativa antes de qualquer mudança no código
---

# REGRA OBRIGATÓRIA: CONSULTA À DOCUMENTAÇÃO NORMATIVA

## PRINCÍPIO FUNDAMENTAL

**NENHUMA mudança no código pode ser feita sem primeiro consultar e obedecer a documentação normativa.**

Problemas passados foram criados exatamente porque não respeitaram as regras, documentação e padrões estabelecidos.

## OBRIGAÇÕES ANTES DE QUALQUER MUDANÇA

### 1. LEITURA OBRIGATÓRIA DO PROTOCOLO DO AGENTE

Antes de QUALQUER ação, DEVE ler:
- `c:\unificard\docs\01_normative\00_AGENT_PROTOCOL.md`

Este arquivo define:
- Como iniciar (bootstrap obrigatório)
- Qual autoridade reconhecer
- Como executar tarefas
- Modos de operação (GUARDIÃO vs EXECUTOR)

### 2. CONSULTA À NOMENCLATURA CANÔNICA

Antes de criar, renomear ou modificar qualquer identificador, DEVE consultar:
- `c:\unificard\docs\01_normative\07_NOMENCLATURA_CANONICA.md`

**Regras obrigatórias:**
- **Backend/API**: camelCase obrigatório (`actorId`, `amountCents`, `percentBps`)
- **Banco de dados**: snake_case obrigatório (`actor_id`, `amount_cents`, `percent_bps`)
- **Valores monetários**: sempre `_cents` (BIGINT) no backend, `amount_cents` no banco
- **Percentuais**: sempre `_bps` (basis points) no backend, `percent_bps` no banco
- **NUNCA** misturar snake_case no backend ou camelCase no banco

### 3. VERIFICAÇÃO DE CONTRATOS CANÔNICOS

Antes de criar ou modificar qualquer contrato (interface/type), DEVE:
1. Verificar se já existe contrato canônico em `src/contracts/`
2. Consultar `c:\unificard\docs\01_normative\05_CONTRATOS_CANONICOS.md`
3. Garantir que o contrato está 100% alinhado com nomenclatura canônica
4. **NUNCA** criar contrato paralelo ou formato simplificado se já existe SSOT

### 4. VERIFICAÇÃO DE SSOT (Single Source of Truth)

Antes de criar qualquer estrutura que possa ser SSOT, DEVE consultar:
- `c:\unificard\docs\01_normative\SSOT_CONTRACT.md`
- `c:\unificard\docs\01_normative\SSOT_EXCLUSIVE_BANK_RULE.md`

**Regras críticas:**
- **NUNCA** criar saldo, ledger, transação ou split fora do UnifyBank
- **NUNCA** criar estrutura financeira paralela
- Toda escrita financeira DEVE passar pelo serviço autorizado do Bank

### 5. VERIFICAÇÃO DE IDENTIDADE CANÔNICA

Antes de usar ou criar campos de identidade, DEVE consultar:
- `c:\unificard\docs\01_normative\03_IDENTITY_CANONICA.md`
- `c:\unificard\docs\01_normative\02_ACTORS_SSOT.md`

**Regras obrigatórias:**
- Identidade operacional = `actor_id` (tenant-scoped)
- Identidade global = `global_user_id` (cross-tenant, read-model)
- **NUNCA** usar `user_id` como identidade operacional (é legado)

## PROCESSO OBRIGATÓRIO DE REFATORAÇÃO

Antes de extrair, mover ou refatorar qualquer módulo:

1. **Ler documentação relevante** (nomenclatura, contratos, SSOT)
2. **Criar contratos canônicos primeiro** (se necessário)
3. **Migrar nomenclatura para camelCase** (backend) ou snake_case (banco)
4. **Alinhar ao contrato canônico existente** (não criar formato paralelo)
5. **Validar que não viola SSOT** (especialmente financeiro)
6. **Só então extrair/mover código**

**ORDEM CORRETA:**
1. Contrato primeiro
2. Nomenclatura alinhada
3. Extração depois

**NUNCA:**
- Extrair antes de alinhar nomenclatura
- Criar contrato paralelo se já existe SSOT
- Manter snake_case "temporariamente" no backend
- Tocar em parte financeira sem consultar SSOT_EXCLUSIVE_BANK_RULE.md

## VALIDAÇÃO OBRIGATÓRIA

Após qualquer mudança, DEVE:
1. Rodar `npx tsc --noEmit` e verificar se erros aumentaram
2. Verificar se nomenclatura está 100% alinhada (camelCase backend, snake_case banco)
3. Confirmar que não criou estrutura financeira paralela
4. Confirmar que contratos estão alinhados ao canônico

## CONSEQUÊNCIA DE VIOLAÇÃO

Qualquer mudança feita sem consultar a documentação normativa:
- **É considerada inválida por definição**
- **Pode causar regressão arquitetural**
- **Pode reintroduzir problemas que já foram resolvidos**

## REFERÊNCIAS OBRIGATÓRIAS

Sempre consultar antes de mudanças:
- `c:\unificard\docs\01_normative\00_AGENT_PROTOCOL.md` - Protocolo do agente
- `c:\unificard\docs\01_normative\07_NOMENCLATURA_CANONICA.md` - Nomenclatura
- `c:\unificard\docs\01_normative\05_CONTRATOS_CANONICOS.md` - Contratos
- `c:\unificard\docs\01_normative\SSOT_CONTRACT.md` - SSOT
- `c:\unificard\docs\01_normative\SSOT_EXCLUSIVE_BANK_RULE.md` - Regras financeiras

---

**LEMBRE-SE:** A documentação existe para manter o sistema correto e evitar que ele se perca. Respeitar a documentação é obrigatório, não opcional.

