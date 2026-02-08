# Validação Arquitetural Automática - UnifiCard

## 🔒 Regras Imutáveis Validadas

Este validador bloqueia automaticamente PRs que violam regras arquiteturais fundamentais do UnifiCard.

### Regras Validadas

1. **Perfil do Usuário não pode ser consultado por write side**
   - Write side: economy, ledger, work, events, reputation, plan
   - Violação: Importar `profileService`, `getCompleteProfile`, etc.

2. **Perfil do Usuário não pode ser usado em decisões/limites/permissões**
   - Violação: Usar perfil em `validateAccess`, `checkPermission`, `getLimits`, etc.

3. **Categorias no perfil devem ter evento versionado**
   - Violação: Categorias em `metadata` sem `event`, `version`, `rule_id`

4. **Dados do perfil não podem influenciar comportamento do sistema**
   - Violação: Usar dados do perfil em condicionais que alteram fluxo

---

## 🚀 Uso

### Execução Local

```bash
pnpm run validate:architectural
```

### Integração no CI

#### GitHub Actions

```yaml
name: Architectural Validation

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: pnpm install
      - run: pnpm run validate:architectural
```

#### GitLab CI

```yaml
validate:architectural:
  stage: test
  script:
    - pnpm install
    - pnpm run validate:architectural
  only:
    - merge_requests
```

---

## 📊 Classificações

### 🚫 Bloqueia Freeze
- Write side consultando perfil
- **Ação:** PR bloqueado, não pode ser mergeado

### 🔴 Violação Crítica
- Perfil usado em decisões
- Categorias sem versionamento
- **Ação:** PR bloqueado, requer correção

### ⚠️ Violação Estrutural
- Dados do perfil influenciando comportamento
- **Ação:** PR bloqueado, requer refatoração

---

## 🔍 Exemplos de Violações

### ❌ Violação 1: Write Side Consultando Perfil

```typescript
// src/core/economy/account.service.ts
import { profileService } from '../profile/profile.service'; // ❌ BLOQUEADO

class AccountService {
  async createAccount(userId: string) {
    const profile = await profileService.getProfile(tenantId, userId); // ❌ BLOQUEADO
    // ...
  }
}
```

**Correção:** Consultar `users` ou `global_users` diretamente, não o perfil agregado.

### ❌ Violação 2: Perfil em Decisão

```typescript
// src/core/plan/plan-gate.service.ts
import { coreService } from '../core.service'; // ❌ BLOQUEADO

class PlanGateService {
  async validateFeatureAccess(userId: string) {
    const profile = await coreService.getCompleteProfile(tenantId, userId); // ❌ BLOQUEADO
    if (profile.professional_profile?.skills.length > 5) { // ❌ BLOQUEADO
      return true;
    }
  }
}
```

**Correção:** Usar `users.plan` diretamente, não dados do perfil agregado.

### ❌ Violação 3: Categoria Sem Versionamento

```typescript
// src/core/profile/profile.service.ts
const interests = globalUser.metadata.interests; // ❌ BLOQUEADO (sem versionamento)
```

**Correção:** Criar evento `UserCategoryAssigned` com `rule_id` e `rule_version`.

---

## ✅ Comportamento Correto

### ✅ Write Side Consultando Core Diretamente

```typescript
// src/core/economy/account.service.ts
import { runQueryWithTenant } from '@core/database/pool';

class AccountService {
  async createAccount(userId: string) {
    const user = await runQueryWithTenant(
      tenantId,
      'SELECT user_id, plan FROM users WHERE user_id = $1',
      [userId]
    ); // ✅ CORRETO: Consulta core diretamente
    // ...
  }
}
```

### ✅ Decisão Baseada em Core, Não Perfil

```typescript
// src/core/plan/plan-gate.service.ts
import { runQueryWithTenant } from '@core/database/pool';

class PlanGateService {
  async validateFeatureAccess(userId: string) {
    const user = await runQueryWithTenant(
      tenantId,
      'SELECT plan FROM users WHERE user_id = $1',
      [userId]
    ); // ✅ CORRETO: Consulta core, não perfil agregado
    return user.plan === 'pro' || user.plan === 'enterprise';
  }
}
```

---

## 📝 Comentário Automático no PR

Quando violações são detectadas, o validador gera um comentário no PR com:

- Lista de violações por classificação
- Arquivo e linha de cada violação
- Regra violada
- Código que viola

**Não sugere workarounds** - apenas sinaliza a violação.

---

## 🔧 Configuração

### Ajustar Diretórios de Write Side

Editar `scripts/validate-architectural-rules.ts`:

```typescript
const WRITE_SIDE_PATTERNS = [
  /src\/core\/economy\//,
  /src\/core\/ledger\//,
  // Adicionar novos padrões aqui
];
```

### Ajustar Padrões de Detecção

Editar padrões regex conforme necessário:

```typescript
const DECISION_PATTERNS = [
  /validateFeatureAccess|validateAccess/,
  // Adicionar novos padrões aqui
];
```

---

## ⚠️ Importante

Este validador é **bloqueante**. PRs com violações **não podem ser mergeados**.

Não há workarounds ou exceções. As regras são imutáveis.

---

**Status:** ✅ Validador ativo e bloqueando violações automaticamente

