# Pull Request — Unificard

## 📋 Tipo de Mudança

Marque o tipo de mudança que este PR introduz:

- [ ] 🐛 Bug fix (correção que não quebra funcionalidade existente)
- [ ] ✨ Nova feature (adição que não quebra funcionalidade existente)
- [ ] 💥 Breaking change (mudança que quebra compatibilidade)
- [ ] 📚 Documentação (mudanças apenas em docs)
- [ ] 🔧 Refatoração (mudança de código sem mudança de comportamento)
- [ ] ⚡ Performance (melhoria de performance)
- [ ] 🧪 Testes (adição ou correção de testes)
- [ ] 🔒 Segurança (correção de vulnerabilidade)

---

## 🎯 Descrição

Descreva brevemente o que este PR faz e por que é necessário:

<!-- Exemplo:
Este PR corrige um bug onde queries de actors não filtravam por tenant_id, 
permitindo potencial vazamento de dados entre tenants.
-->

---

## 🔍 Checklist de Invariantes

⚠️ **OBRIGATÓRIO:** Este PR **DEVE** respeitar todos os invariantes canônicos.

Consulte: [`docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`](../../docs/audit/SYSTEM-CANONICAL-INVARIANTS.md)

### Auth & Session
- [ ] Nenhuma mudança em `/auth/*` quebra fronteira pública/protegida
- [ ] `tokenVersion` sempre validado em JWTs
- [ ] `tenantId` sempre presente em JWTs
- [ ] Logout/refresh invalidam sessões corretamente

### Tenant & Isolation
- [ ] Todas as queries críticas filtram por `tenant_id`
- [ ] Nenhuma query usa apenas `actor_id`, `company_id`, `account_id` isolado
- [ ] `runQueryWithTenant()` usado para todas as queries críticas
- [ ] Nenhum vazamento cross-tenant possível

### RBAC & Permissions
- [ ] RBAC nunca roda sem `tenantId`, `userId`, `actorId` válidos
- [ ] `requirePermission` valida contexto completo antes de executar
- [ ] Permission resolution sempre determinística e auditável
- [ ] Logs canônicos adicionados para decisões de autorização

### Events & Async
- [ ] Todos os event handlers validam `tenantId` no início
- [ ] `EventBus.publish()` rejeita eventos sem `tenantId`
- [ ] Nenhum handler executa fora de contexto de tenant válido

### Database & Schema
- [ ] Nenhuma migration remove `NOT NULL` de `tenant_id`
- [ ] Nenhuma migration remove índices compostos `(tenant_id, id)`
- [ ] Nenhuma migration remove RLS policies
- [ ] Schema continua reforçando invariantes

### Logs & Observability
- [ ] Logs canônicos adicionados para operações críticas
- [ ] Logs incluem `tenantId`, `userId`, `actorId` quando aplicável
- [ ] Logs de erro incluem contexto suficiente para debug

---

## 🧪 Testes

- [ ] Testes unitários adicionados/atualizados
- [ ] Testes de integração adicionados/atualizados (se aplicável)
- [ ] Testes de invariantes passam: `npm run test:invariants`
- [ ] Nenhum teste existente foi quebrado

---

## 📚 Documentação

- [ ] Documentação atualizada (se aplicável)
- [ ] ADR criado/atualizado (se mudança estrutural)
- [ ] Changelog atualizado (se breaking change)
- [ ] Comentários de código adicionados (se lógica complexa)

---

## 🔒 Segurança

- [ ] Nenhuma credencial ou secret exposta
- [ ] Validação de inputs adicionada (se novo endpoint)
- [ ] Rate limiting considerado (se novo endpoint)
- [ ] Permissões verificadas (se novo endpoint)

---

## ✅ Checklist Final

- [ ] Código segue padrões do projeto
- [ ] Linter passa sem erros: `npm run lint`
- [ ] TypeScript compila sem erros: `npm run build`
- [ ] Testes passam: `npm test`
- [ ] Self-review realizado
- [ ] Comentários desnecessários removidos
- [ ] Código comentado removido

---

## 🚨 Breaking Changes

Se este PR contém breaking changes, descreva:

1. O que mudou
2. Por que mudou
3. Como migrar código existente
4. Versão da API afetada (se aplicável)

---

## 📸 Screenshots / Logs

Se aplicável, adicione screenshots ou logs relevantes:

<!--
Exemplo:
```
[AUTHZ] Iniciando resolução de permissão {
  tenantId: 'tenant-123',
  userId: 'user-456',
  actorId: 'actor-789',
  permissionKey: 'work.job.create',
  timestamp: '2025-01-22T10:00:00.000Z'
}
```
-->

---

## 🔗 Issues Relacionadas

Fixes #(issue)

---

## 👥 Reviewers

@unificard/core-team (obrigatório para mudanças em `core/`)

---

## 📝 Notas Adicionais

Adicione qualquer informação adicional relevante:

<!--
Exemplo:
- Este PR é parte de uma série de correções de segurança
- Requer deploy coordenado com frontend
- Performance impact: +5ms em queries de actors
-->
