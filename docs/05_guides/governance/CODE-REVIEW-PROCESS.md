# Code Review Process — Processo de Revisão de Código

**Status:** `CORE`  
**Governing Contract:** `CORE_IMUTAVEL.md`  
**Data de Criação:** 2025-01-22  
**Última Atualização:** 2025-01-22

---

## Declaração de Governança

Este documento define o processo obrigatório de revisão de código para garantir que os invariantes canônicos do sistema sejam preservados ao longo do tempo.

**REGRA INQUEBRÁVEL:** Nenhum PR pode ser mergeado sem aprovação de CODEOWNER quando toca em áreas protegidas.

---

## Áreas Protegidas

### Core (Proteção Máxima)

Todas as mudanças em `backend/src/core/` requerem aprovação obrigatória de CODEOWNER.

**Módulos Críticos:**
- `auth/` — Autenticação e sessões
- `authorization/` — Permissões e RBAC
- `categories/` — Categorias (FROZEN)
- `events/` — Event bus e handlers
- `database/` — Pool e queries
- `identity/` — Identidade global
- `social/` — Actors e social
- `tenants/` — Tenants
- `action-context/` — Contexto de ação
- `companies/` — Empresas
- `profile/` — Perfil

### Plugins (Proteção Alta)

Todos os plugins em `backend/src/plugins/` requerem aprovação obrigatória.

### Invariantes (Proteção Máxima)

- `backend/tests/invariants/` — Testes de invariantes
- `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md` — SSOT de invariantes
- `docs/audit/*.md` — Documentação de auditoria

### Contratos Públicos (Proteção Máxima)

- `docs/contracts/` — Contratos de API pública
- Rotas públicas em `auth.routes.ts`, `health.module.ts`

---

## Processo de Revisão

### 1. Pré-requisitos

Antes de abrir um PR:

1. ✅ Preencher checklist de invariantes: [`PR-CHECKLIST-INVARIANTS.md`](../operations/checklists/PR-CHECKLIST-INVARIANTS.md)
2. ✅ Executar testes de invariantes: `npm run test:invariants`
3. ✅ Executar linter: `npm run lint`
4. ✅ Executar build: `npm run build`
5. ✅ Executar testes: `npm test`

### 2. Abertura do PR

1. Usar template: [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md)
2. Preencher todos os checkboxes obrigatórios
3. Adicionar labels apropriados (`core`, `security`, `breaking-change`, etc.)
4. Solicitar review de CODEOWNER (se tocar em área protegida)

### 3. Revisão Automática

O GitHub automaticamente:

1. ✅ Solicita review de CODEOWNER quando PR toca em área protegida
2. ✅ Bloqueia merge até aprovação (se branch protection configurado)
3. ✅ Executa CI/CD (se configurado)

### 4. Revisão Manual

O CODEOWNER deve verificar:

#### 4.1 Checklist de Invariantes

- [ ] Todos os invariantes relevantes respeitados
- [ ] Nenhuma validação removida
- [ ] Nenhum fallback silencioso adicionado
- [ ] Logs canônicos adicionados (se operação crítica)

#### 4.2 Segurança

- [ ] Nenhuma vulnerabilidade introduzida
- [ ] Isolamento de tenant mantido
- [ ] Permissões verificadas corretamente
- [ ] Sessões invalidadas corretamente

#### 4.3 Arquitetura

- [ ] Padrões do projeto seguidos
- [ ] Nenhuma dependência circular criada
- [ ] Performance considerada
- [ ] Escalabilidade mantida

#### 4.4 Testes

- [ ] Testes adicionados/atualizados
- [ ] Testes de invariantes passam
- [ ] Cobertura adequada

#### 4.5 Documentação

- [ ] Documentação atualizada (se aplicável)
- [ ] ADR criado/atualizado (se mudança estrutural)
- [ ] Comentários de código adicionados (se lógica complexa)

### 5. Aprovação

O CODEOWNER pode:

- ✅ **Aprovar:** PR pode ser mergeado
- ❌ **Requer mudanças:** PR precisa ser corrigido
- 💬 **Comentar:** PR precisa de esclarecimentos

### 6. Merge

Após aprovação:

1. ✅ Todos os checkboxes do PR preenchidos
2. ✅ Aprovação de CODEOWNER (se área protegida)
3. ✅ CI/CD passa (se configurado)
4. ✅ Sem conflitos
5. ✅ Merge permitido

---

## Regras de Rejeição

### Rejeição Automática

PRs são rejeitados automaticamente se:

- ❌ Remover validação de `tenantId` em query crítica
- ❌ Remover validação de `tokenVersion` em auth
- ❌ Permitir RBAC sem contexto completo
- ❌ Permitir eventos sem `tenantId`
- ❌ Remover `NOT NULL` de `tenant_id` em migrations
- ❌ Remover índices compostos `(tenant_id, id)`
- ❌ Remover RLS policies
- ❌ Adicionar fallback silencioso para invariantes
- ❌ Testes de invariantes falharem

### Rejeição Manual

CODEOWNER pode rejeitar se:

- ❌ Checklist de invariantes não preenchido
- ❌ Violação de invariante detectada
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
   - ✅ Dismiss stale pull request approvals when new commits are pushed
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

## Métricas

Métricas recomendadas para monitorar:

- ⏱️ Tempo médio de review
- ✅ Taxa de aprovação
- 🔄 Taxa de PRs que requerem mudanças
- 🚨 Taxa de violações de invariantes detectadas
- 📊 Cobertura de testes de invariantes

---

## Referências

- **SSOT de Invariantes:** [`docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`](../audit/SYSTEM-CANONICAL-INVARIANTS.md)
- **Checklist de Invariantes:** [`docs/operations/checklists/PR-CHECKLIST-INVARIANTS.md`](../operations/checklists/PR-CHECKLIST-INVARIANTS.md)
- **Template de PR:** [`.github/PULL_REQUEST_TEMPLATE.md`](../../.github/PULL_REQUEST_TEMPLATE.md)
- **CODEOWNERS:** [`.github/CODEOWNERS`](../../.github/CODEOWNERS)

---

## Changelog

- **2025-01-22:** Criação inicial do processo de revisão

