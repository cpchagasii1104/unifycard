# CHECKLIST ENFORCEMENT PRÉ-MVP

## Status
TÉCNICO • OBRIGATÓRIO

## Contexto

Este checklist técnico valida o cumprimento dos gates pré-MVP antes da abertura de MVP público.

Cada item deve ser verificado e marcado como concluído antes de prosseguir.

---

## CHECKLIST

### GATE 1 — VALIDAÇÃO EMPÍRICA PASSO 0

- [ ] Teste 1: Busca vs Navegação (Categorias) = PASS
- [ ] Teste 2: Ledger Financeiro (Economy vs UnifyBank) = PASS
- [ ] Teste 3: Permissões (Determinismo) = PASS
- [ ] Documento `VALIDACAO_EMPIRICA_PASSO_0.md` preenchido com resultados

**Status:** PASS / FAIL

---

### GATE 2 — SSOT DE LEITURA DE CATEGORIAS

- [ ] `npm run test:ssot` passa 100%
- [ ] Guards implementados no repository
- [ ] Guards implementados no service
- [ ] Guards implementados no endpoint HTTP
- [ ] Nenhuma query de categorias executa sem context

**Status:** PASS / FAIL

---

### GATE 3 — INTEGRIDADE DE MIGRAÇÕES

- [ ] Verificação de numeração única passa
- [ ] Nenhuma colisão de números de migration detectada
- [ ] Nenhuma migration duplicada existe
- [ ] Sistema de migrations executa em ordem sem erros

**Status:** PASS / FAIL

---

### GATE 4 — SEPARAÇÃO CANÔNICA UI × DOMÍNIO

- [ ] Nenhum código de domínio canônico referencia abas de perfil
- [ ] Perfil não contém flags de decisão
- [ ] Perfil não contém estados operacionais
- [ ] Perfil não contém permissões
- [ ] Perfil não contém scores acionáveis

**Status:** PASS / FAIL

---

## RESULTADO FINAL

- [ ] Todos os gates = PASS
- [ ] MVP público pode ser aberto

**Se QUALQUER gate = FAIL → MVP público bloqueado.**

---

**Data de verificação:**  
**Responsável:**  
**Status final:** PASS / FAIL



