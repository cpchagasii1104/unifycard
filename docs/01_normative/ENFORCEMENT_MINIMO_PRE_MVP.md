# ENFORCEMENT MÍNIMO PRÉ-MVP

## Status
APROVADO • CANÔNICO • VINCULANTE

## Contexto

Este documento estabelece o enforcement mínimo obrigatório para os gates pré-MVP do UnifiCard.

Nenhum MVP público pode ser aberto se qualquer gate pré-MVP falhar.

---

## REGRA ABSOLUTA

**NENHUM MVP PÚBLICO PODE SER ABERTO SE QUALQUER GATE PRÉ-MVP FALHAR.**

Esta regra é:
- **BINÁRIA:** passa ou não passa
- **SEM EXCEÇÕES:** não há circunstâncias que permitam bypass
- **BLOQUEANTE:** violação bloqueia abertura de MVP público

---

## GATES PRÉ-MVP OBRIGATÓRIOS

### GATE 1 — VALIDAÇÃO EMPÍRICA PASSO 0

**Condição obrigatória:**
Todos os três testes empíricos devem resultar em PASS:
- Teste 1: Busca vs Navegação (Categorias) = PASS
- Teste 2: Ledger Financeiro (Economy vs UnifyBank) = PASS
- Teste 3: Permissões (Determinismo) = PASS

**Bloqueio:**
Se QUALQUER teste = FAIL → MVP público bloqueado.

---

### GATE 2 — SSOT DE LEITURA DE CATEGORIAS

**Condição obrigatória:**
Context é OBRIGATÓRIO em qualquer leitura de categorias. Método canônico único `getCategoriesForTenant(tenantId, context)` implementado com guards no repository, service e endpoint HTTP.

**Bloqueio:**
Se SSOT de leitura não estiver implementado e validado → MVP público bloqueado.

---

### GATE 3 — INTEGRIDADE DE MIGRAÇÕES

**Condição obrigatória:**
Todas as migrations possuem numeração sequencial única. Nenhum número é reutilizado. Sufixos alfabéticos (ex: 028a, 028b) usados apenas para mesma posição lógica. Gaps intencionais não são preenchidos. Nenhuma migration duplicada existe.

**Bloqueio:**
Se houver colisão de numeração ou migrations duplicadas → MVP público bloqueado.

---

### GATE 4 — SEPARAÇÃO CANÔNICA UI × DOMÍNIO

**Condição obrigatória:**
Perfil do usuário é exclusivamente READ MODEL DE VISUALIZAÇÃO. Abas de perfil são organização visual apenas, não são domínios canônicos. Nenhuma lógica de domínio canônico depende de abas de perfil.

**Bloqueio:**
Se houver violação da separação UI × Domínio → MVP público bloqueado.

---

## APLICAÇÃO

Este enforcement aplica-se a:
- Código
- Banco de dados
- Serviços
- IAs
- Decisões humanas

**Violação deste enforcement:**
- Código → **BLOQUEAR BUILD**
- Proposta → **RECUSAR**
- Decisão → **INVÁLIDA**

---

## DOCUMENTOS CANÔNICOS CITADOS

- `docs/02_decisions/GATES_OBRIGATORIOS_PRE_MVP.md`

---

**Status:** CANÔNICO • IMUTÁVEL • VINCULANTE  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)  
**Data de criação:** 2026-01-22



