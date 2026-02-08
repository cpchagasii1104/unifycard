# Governance Overview — Visão Geral de Governança

**Status:** `CORE`  
**Governing Contract:** `CORE_IMUTAVEL.md`  
**Data de Criação:** 2025-01-22  
**Última Atualização:** 2025-01-22

---

## Declaração de Governança

Este documento fornece uma visão geral do sistema de governança do Unificard, projetado para evitar degradação arquitetural ao longo do tempo.

**OBJETIVO:** Garantir que os invariantes canônicos do sistema sejam preservados e que mudanças críticas sejam revisadas adequadamente.

---

## Componentes do Sistema de Governança

### 1. CODEOWNERS

**Arquivo:** [`.github/CODEOWNERS`](../../.github/CODEOWNERS)

Define proprietários de código que devem revisar mudanças em áreas críticas.

**Áreas Protegidas:**
- `backend/src/core/` — Proteção máxima
- `backend/src/plugins/` — Proteção alta
- `backend/tests/invariants/` — Proteção máxima
- `docs/audit/` — Proteção máxima
- `docs/contracts/` — Proteção máxima

**Como Funciona:**
- GitHub automaticamente solicita review de CODEOWNER quando PR toca em área protegida
- Merge bloqueado até aprovação (se branch protection configurado)

---

### 2. PR Template

**Arquivo:** [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md)

Template obrigatório para todos os PRs, incluindo:

- Checklist de invariantes
- Checklist de testes
- Checklist de documentação
- Checklist de segurança

**Objetivo:** Garantir que PRs incluam todas as informações necessárias para revisão adequada.

---

### 3. Checklist de Invariantes

**Arquivo:** [`docs/operations/checklists/PR-CHECKLIST-INVARIANTS.md`](../operations/checklists/PR-CHECKLIST-INVARIANTS.md)

Checklist obrigatório que verifica:

- ✅ Auth & Session invariants
- ✅ Tenant & Isolation invariants
- ✅ RBAC & Permissions invariants
- ✅ Session Invalidation invariants
- ✅ Events & Async Context invariants
- ✅ Database & Schema invariants
- ✅ Logs & Observability invariants

**Objetivo:** Garantir que nenhum PR viole invariantes canônicos.

---

### 4. Processo de Revisão

**Arquivo:** [`docs/governance/CODE-REVIEW-PROCESS.md`](CODE-REVIEW-PROCESS.md)

Define o processo completo de revisão de código:

1. Pré-requisitos (testes, lint, build)
2. Abertura do PR (template, labels, review)
3. Revisão automática (CODEOWNER, CI/CD)
4. Revisão manual (checklist, segurança, arquitetura)
5. Aprovação (approve, request changes, comment)
6. Merge (após aprovação)

**Objetivo:** Garantir que mudanças críticas sejam revisadas adequadamente.

---

### 5. SSOT de Invariantes

**Arquivo:** [`docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`](../audit/SYSTEM-CANONICAL-INVARIANTS.md)

Single Source of Truth para todos os invariantes canônicos do sistema.

**Invariantes Documentados:**
- Auth (JWT, tokenVersion, tenantId, fronteira)
- Tenant (isolamento, queries)
- Bootstrap (ordem de plugins)
- Actor (validação, criação)
- RBAC (bootstrap, contexto)
- Permissions (resolução, determinismo)
- Session (invalidação, tokenVersion)
- Events (context safety, handlers)
- Cross-Tenant Leakage (prevenção)

**Objetivo:** Documentar todos os invariantes que devem ser preservados.

---

### 6. Testes de Invariantes

**Diretório:** `backend/tests/invariants/`

Testes automatizados que verificam invariantes canônicos.

**Testes Implementados:**
- `auth-invariants.test.ts` — Invariantes de autenticação
- `tenant-invariants.test.ts` — Invariantes de tenant
- `rbac-invariants.test.ts` — Invariantes de RBAC
- `permission-invariants.test.ts` — Invariantes de permissões
- `event-invariants.test.ts` — Invariantes de eventos

**Objetivo:** Detectar violações de invariantes automaticamente.

---

## Fluxo de Governança

```
┌─────────────────┐
│  Autor cria PR  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Preenche PR Template    │
│ - Checklist Invariantes │
│ - Checklist Testes      │
│ - Checklist Docs        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ GitHub detecta área    │
│ protegida (CODEOWNERS)  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Solicita review de     │
│ CODEOWNER automaticamente│
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ CODEOWNER revisa:      │
│ - Checklist Invariantes │
│ - Segurança             │
│ - Arquitetura          │
│ - Testes                 │
└────────┬────────────────┘
         │
         ▼
    ┌────┴────┐
    │ Aprovado?│
    └────┬────┘
         │
    ┌────┴────┐
    │   Sim   │
    └────┬────┘
         │
         ▼
┌─────────────────────────┐
│ Merge permitido         │
│ (se CI/CD passar)       │
└─────────────────────────┘
```

---

## Regras de Rejeição

### Rejeição Automática

PRs são rejeitados automaticamente se:

- ❌ Testes de invariantes falharem
- ❌ Checklist de invariantes não preenchido
- ❌ Violação de invariante detectada

### Rejeição Manual

CODEOWNER pode rejeitar se:

- ❌ Vulnerabilidade de segurança introduzida
- ❌ Arquitetura degradada
- ❌ Testes insuficientes
- ❌ Documentação ausente (quando necessária)

---

## Exceções

Exceções aos invariantes só são permitidas através de:

1. **ADR (Architecture Decision Record):** Documentar decisão arquitetural
2. **Aprovação de Arquitetura:** Revisão de arquiteto sênior
3. **Atualização de SSOT:** Atualizar `SYSTEM-CANONICAL-INVARIANTS.md` com novo invariante

**REGRA:** Nenhuma exceção é permitida sem processo formal.

---

## Branch Protection

### Configuração Recomendada

Configure branch protection no GitHub para `main`/`master`:

1. **Require pull request reviews before merging**
   - ✅ Required number of approvals: `1`
   - ✅ Require review from CODEOWNERS

2. **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - ✅ Status checks: `test`, `lint`, `build`, `test:invariants`

3. **Require conversation resolution before merging**
   - ✅ Todos os comentários devem ser resolvidos

4. **Do not allow bypassing the above settings**
   - ✅ Mesmo admins não podem bypass

### Como Configurar

1. Vá para: `Settings` → `Branches` → `Branch protection rules`
2. Adicione regra para `main` (ou `master`)
3. Configure as opções acima
4. Salve

**Documentação:** Veja [`CODE-REVIEW-PROCESS.md`](CODE-REVIEW-PROCESS.md) para detalhes.

---

## Responsabilidades

### Autor do PR

- ✅ Preencher checklist de invariantes
- ✅ Executar testes localmente
- ✅ Solicitar review de CODEOWNER
- ✅ Responder a comentários
- ✅ Corrigir issues identificados

### CODEOWNER

- ✅ Revisar PR dentro de 2 dias úteis
- ✅ Verificar checklist de invariantes
- ✅ Aprovar ou requerer mudanças
- ✅ Explicar razões de rejeição
- ✅ Manter qualidade arquitetural

### Maintainers

- ✅ Garantir que branch protection está configurado
- ✅ Monitorar métricas de review
- ✅ Resolver conflitos de aprovação
- ✅ Atualizar processo quando necessário

---

## Métricas Recomendadas

Métricas para monitorar saúde do sistema de governança:

- ⏱️ **Tempo médio de review:** Meta: < 2 dias úteis
- ✅ **Taxa de aprovação:** Meta: > 80%
- 🔄 **Taxa de PRs que requerem mudanças:** Meta: < 30%
- 🚨 **Taxa de violações de invariantes:** Meta: 0%
- 📊 **Cobertura de testes de invariantes:** Meta: 100%

---

## Referências

### Documentos Principais

- **SSOT de Invariantes:** [`docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`](../audit/SYSTEM-CANONICAL-INVARIANTS.md)
- **Processo de Revisão:** [`docs/governance/CODE-REVIEW-PROCESS.md`](CODE-REVIEW-PROCESS.md)
- **Checklist de Invariantes:** [`docs/operations/checklists/PR-CHECKLIST-INVARIANTS.md`](../operations/checklists/PR-CHECKLIST-INVARIANTS.md)

### Arquivos de Configuração

- **CODEOWNERS:** [`.github/CODEOWNERS`](../../.github/CODEOWNERS)
- **PR Template:** [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md)

### Testes

- **Testes de Invariantes:** `backend/tests/invariants/`
- **Documentação:** [`docs/audit/INSTITUTIONAL-TEST-HARNESS.md`](../audit/INSTITUTIONAL-TEST-HARNESS.md)

---

## Changelog

- **2025-01-22:** Criação inicial do sistema de governança

---

## Próximos Passos

1. ✅ Configurar branch protection no GitHub
2. ✅ Substituir `@unificard/core-team` por time real no CODEOWNERS
3. ✅ Configurar CI/CD para executar testes de invariantes
4. ✅ Monitorar métricas de review
5. ✅ Atualizar processo baseado em feedback

