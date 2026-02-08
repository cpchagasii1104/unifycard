# MAPA ENFORCEMENT TÉCNICO PRÉ-MVP

## Status
TÉCNICO • OBRIGATÓRIO

## Contexto

Este documento mapeia como o enforcement técnico ocorrerá para cada gate pré-MVP.

---

## GATES PRÉ-MVP

### GATE 1 — VALIDAÇÃO EMPÍRICA PASSO 0

- Local de enforcement:
  Revisão manual bloqueante antes de merge para produção

- Tipo de verificação:
  Semi-automática

- Artefato gerado:
  Documento `VALIDACAO_EMPIRICA_PASSO_0.md` preenchido e assinado

---

### GATE 2 — SSOT DE LEITURA DE CATEGORIAS

- Local de enforcement:
  CI/CD pipeline

- Tipo de verificação:
  Automática

- Artefato gerado:
  Teste `npm run test:ssot` passando 100%

- Nota:
  Tree e Search agora compartilham SSOT de leitura sem divergência. Ambos usam `getCategoriesForTenant` como método canônico único. Não existem guards divergentes entre endpoints.

---

### GATE 3 — INTEGRIDADE DE MIGRAÇÕES

- Local de enforcement:
  CI/CD pipeline

- Tipo de verificação:
  Automática

- Artefato gerado:
  Script de verificação de numeração única executado e passando

---

### GATE 4 — SEPARAÇÃO CANÔNICA UI × DOMÍNIO

- Local de enforcement:
  Revisão de código bloqueante

- Tipo de verificação:
  Semi-automática

- Artefato gerado:
  Checklist de validação preenchido e aprovado

---

## DOCUMENTOS CANÔNICOS CITADOS

- `docs/02_decisions/GATES_OBRIGATORIOS_PRE_MVP.md`
- `docs/01_normative/ENFORCEMENT_MINIMO_PRE_MVP.md`
- `docs/03_technical/CHECKLIST_ENFORCEMENT_PRE_MVP.md`

---

**Status:** TÉCNICO • OBRIGATÓRIO  
**Data de criação:** 2026-01-22

