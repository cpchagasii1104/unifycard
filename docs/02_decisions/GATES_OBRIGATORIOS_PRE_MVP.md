# GATES OBRIGATÓRIOS PRÉ-MVP

## Status
APROVADO • CANÔNICO • VINCULANTE

## Contexto

Este documento formaliza e fixa os **GATES OBRIGATÓRIOS PRÉ-MVP** identificados nos documentos normativos, de decisão e técnicos do UnifiCard.

Estes gates são **bloqueantes** e **não-opcionais**. Nenhum avanço para MVP pode ocorrer sem que todos os gates sejam satisfeitos.

---

## AUTORIDADE DOCUMENTAL

Este documento é um **Architecture Decision Record (ADR)** que:
- Declara gates como obrigatórios
- Não propõe novos gates
- Não discute opções
- Apenas formaliza e fixa gates identificados

**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)

---

## GATES OBRIGATÓRIOS PRÉ-MVP

### GATE 1 — VALIDAÇÃO EMPÍRICA PASSO 0

- Definição:
  Validação empírica obrigatória dos três testes estruturais antes de avanço para MVP.

- Condição de aprovação:
  Todos os três testes devem resultar em PASS:
  - Teste 1: Busca vs Navegação (Categorias) = PASS
  - Teste 2: Ledger Financeiro (Economy vs UnifyBank) = PASS
  - Teste 3: Permissões (Determinismo) = PASS

- Evidência esperada:
  Documento `VALIDACAO_EMPIRICA_PASSO_0.md` preenchido com resultado PASS para todos os três testes. Se QUALQUER teste = FAIL → correção estrutural obrigatória antes de qualquer avanço de MVP.

**Fonte:** `docs/99_archive/to_review/VALIDACAO_EMPIRICA_PASSO_0.md`

---

### GATE 2 — SSOT DE LEITURA DE CATEGORIAS

- Definição:
  Single Source of Truth (SSOT) de leitura para categorias deve estar implementado e validado.

- Condição de aprovação:
  Context é OBRIGATÓRIO em qualquer leitura de categorias. Método canônico único `getCategoriesForTenant(tenantId, context)` implementado com guards no repository, service e endpoint HTTP.

- Evidência esperada:
  `npm run test:ssot` passa 100%. Nenhuma query de categorias executa sem context. Bug "categoria aparece em um lugar e some em outro" resolvido.

**Fonte:** `docs/02_decisions/adr/ADR-001-SSOT-READING.md`

---

### GATE 3 — INTEGRIDADE DE MIGRAÇÕES

- Definição:
  Migrations devem ser reprodutíveis, com numeração única e ausência de colisões.

- Condição de aprovação:
  Todas as migrations possuem numeração sequencial única. Nenhum número é reutilizado. Sufixos alfabéticos (ex: 028a, 028b) usados apenas para mesma posição lógica. Gaps intencionais não são preenchidos. Nenhuma migration duplicada existe.

- Evidência esperada:
  Verificação de numeração única passa 100%. Nenhuma colisão de números de migration detectada. Sistema de migrations executa em ordem sem erros de dependência.

**Fonte:** `backend/migrations/README.md`, auditorias de migrations

---

### GATE 4 — SEPARAÇÃO CANÔNICA UI × DOMÍNIO

- Definição:
  Abas de perfil não são domínios canônicos. UI não é ontologia. Domínios canônicos são módulos/core.

- Condição de aprovação:
  Perfil do usuário é exclusivamente READ MODEL DE VISUALIZAÇÃO. Abas de perfil (Pessoal, Profissional, Interesses, etc.) são organização visual apenas, não são domínios canônicos. Nenhuma lógica de domínio canônico depende de abas de perfil.

- Evidência esperada:
  Nenhum código de domínio canônico referencia abas de perfil. Perfil não contém flags de decisão, estados operacionais, permissões ou scores acionáveis. Separação entre UI (visualização) e domínio (core/módulos) validada.

**Fonte:** `docs/01_normative/USER_PROFILE_CONTRACT.md`, princípios inegociáveis

---

## EFEITO VINCULANTE

Este documento é:
- **CANÔNICO:** fonte de verdade institucional
- **IMUTÁVEL:** não pode ser alterado sem processo formal
- **OBRIGATÓRIO:** aplica-se a código, banco, serviços, IAs e decisões humanas
- **VINCULANTE:** qualquer violação invalida a implementação

**Aplicação:**
- Código que viola gates → **BLOQUEAR BUILD**
- Proposta que viola gates → **RECUSAR**
- Decisão que viola gates → **INVÁLIDA**

---

## DOCUMENTOS CANÔNICOS CITADOS

Este documento formaliza gates identificados em:
- `docs/99_archive/to_review/VALIDACAO_EMPIRICA_PASSO_0.md`
- `docs/02_decisions/adr/ADR-001-SSOT-READING.md`
- `backend/migrations/README.md`
- `docs/01_normative/USER_PROFILE_CONTRACT.md`

---

**Status:** CANÔNICO • IMUTÁVEL • VINCULANTE  
**Autoridade:** NÍVEL 1 (CORE / LEI DO SISTEMA)  
**Data de criação:** 2026-01-22
