# Institutional Test Harness — Documentação

**Data:** 2025-01-22  
**Status:** ✅ IMPLEMENTADO  
**Localização:** `backend/tests/invariants/`

---

## Objetivo

Transformar os **invariantes canônicos** documentados em `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md` em **testes automatizados** que validam que os invariantes estão protegidos.

---

## Filosofia dos Testes

**REGRA FUNDAMENTAL:** Qualquer teste que **passe sem erro** indica que o invariante foi **VIOLADO**.

Todos os testes devem **FALHAR** (esperar erro explícito) para provar que o invariante está protegido.

### Exemplo:

```typescript
it('deve rejeitar token sem tokenVersion', async () => {
  // Tentar violar: criar token sem tokenVersion
  const token = jwt.sign({ sub: 'user-id' }, secret);
  
  // Esperar erro explícito
  await expect(
    authService.verifyAccessToken(token)
  ).rejects.toThrow(/tokenVersion/);
  
  // Se este teste PASSAR, o invariante foi VIOLADO ❌
  // Se este teste FALHAR (erro lançado), o invariante está protegido ✅
});
```

---

## Estrutura de Arquivos

```
backend/tests/invariants/
├── README.md                    # Documentação do harness
├── index.test.ts                # Entry point (importa todos os testes)
├── auth-invariants.test.ts      # Invariantes de autenticação (1.1, 1.2, 1.3)
├── tenant-invariants.test.ts    # Invariantes de tenant (2.1, 2.2)
├── rbac-invariants.test.ts      # Invariantes de RBAC (5.1, 5.2)
├── permission-invariants.test.ts # Invariantes de permissions (6.1, 6.2)
└── event-invariants.test.ts     # Invariantes de eventos (8.1, 8.2)
```

---

## Invariantes Testados

### 1. Auth Invariants (`auth-invariants.test.ts`)

- ✅ **1.1:** `tokenVersion` é obrigatório em todos os JWTs
- ✅ **1.2:** `tenantId` é obrigatório em todos os JWTs
- ⚠️ **1.3:** Fronteira Auth × Tenant (requer setup de servidor)

### 2. Tenant Invariants (`tenant-invariants.test.ts`)

- ✅ **2.1:** Isolamento de Tenant (cross-tenant leakage prevention)
- ⚠️ **2.2:** TenantId Obrigatório (requer testes específicos)

### 3. RBAC Invariants (`rbac-invariants.test.ts`)

- ⚠️ **5.1:** Contexto Completo para Autorização (requer setup de servidor)
- ⚠️ **5.2:** RBAC em Escopo Protegido (requer setup de servidor)

### 4. Permission Invariants (`permission-invariants.test.ts`)

- ✅ **6.1:** Permission Resolution (validação de inputs críticos)
- ⚠️ **6.2:** Determinismo de Permissions (requer setup de banco)

### 5. Event Invariants (`event-invariants.test.ts`)

- ✅ **8.1:** TenantId em Eventos (validação de `tenantId` obrigatório)
- ⚠️ **8.2:** Handlers Validam Contexto (requer setup de handlers)

---

## Como Executar

### Executar todos os testes de invariantes:
```bash
cd backend
pnpm test:invariants
```

### Executar no CI (com fail-fast):
```bash
cd backend
pnpm test:invariants:ci
```

---

## Integração com CI

### GitHub Actions

```yaml
name: Test Invariants

on: [push, pull_request]

jobs:
  test-invariants:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd backend && pnpm install
      - run: cd backend && pnpm test:invariants:ci
        # Se qualquer teste passar, o build falha
```

### Critério de Sucesso

**CI DEVE FALHAR** se qualquer invariante for quebrado.

Isso significa:
- ✅ Se um teste **FALHA** (espera erro e recebe erro) → Invariante está protegido ✅
- ❌ Se um teste **PASSA** (espera erro mas não recebe) → Invariante foi violado ❌

---

## Adicionando Novos Testes

### Passo 1: Identificar o Invariante

Leia `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md` e identifique o invariante a ser testado.

### Passo 2: Criar Teste que Tenta Violar

```typescript
it('deve rejeitar operação sem tenantId', async () => {
  // Tentar violar: chamar método sem tenantId
  await expect(
    service.method(null as any) // tenantId ausente
  ).rejects.toThrow(/tenantId is required/);
});
```

### Passo 3: Validar que o Teste Falha Corretamente

Execute o teste e verifique que:
- ✅ O teste **FALHA** (erro é lançado) → Invariante está protegido
- ❌ O teste **PASSA** (erro não é lançado) → Invariante foi violado

### Passo 4: Adicionar ao Arquivo Apropriado

Adicione o teste ao arquivo correspondente:
- `auth-invariants.test.ts` → Invariantes de autenticação
- `tenant-invariants.test.ts` → Invariantes de tenant
- `rbac-invariants.test.ts` → Invariantes de RBAC
- `permission-invariants.test.ts` → Invariantes de permissions
- `event-invariants.test.ts` → Invariantes de eventos

---

## Testes que Requerem Setup Adicional

Alguns testes requerem setup adicional (servidor Fastify, banco de dados, handlers):

### ⚠️ Testes que Requerem Setup de Servidor

- **1.3:** Fronteira Auth × Tenant
- **5.1:** Contexto Completo para Autorização
- **5.2:** RBAC em Escopo Protegido

**TODO:** Implementar com `supertest` ou setup de servidor de teste.

### ⚠️ Testes que Requerem Setup de Banco

- **1.1:** Validação de `tokenVersion` contra banco
- **6.2:** Determinismo de Permissions

**TODO:** Implementar com mock de banco ou setup de teste.

### ⚠️ Testes que Requerem Setup de Handlers

- **8.2:** Handlers Validam Contexto

**TODO:** Implementar com mock de handlers.

---

## Status de Implementação

### ✅ Implementados (Testes Básicos)

- ✅ Auth: `tokenVersion` obrigatório
- ✅ Auth: `tenantId` obrigatório
- ✅ Tenant: Isolamento (cross-tenant leakage)
- ✅ Tenant: `tenantId` obrigatório em `getCompanyById`
- ✅ Permission: Validação de inputs críticos
- ✅ Event: `tenantId` obrigatório em eventos

### ⚠️ Parcialmente Implementados (Documentados, Requerem Setup)

- ⚠️ Auth: Fronteira Auth × Tenant
- ⚠️ RBAC: Contexto Completo
- ⚠️ RBAC: Escopo Protegido
- ⚠️ Permission: Determinismo
- ⚠️ Event: Handlers Validam Contexto

---

## Próximos Passos

1. **Implementar testes com setup de servidor:**
   - Usar `supertest` para testar rotas HTTP
   - Validar fronteiras Auth × Tenant
   - Validar RBAC em escopo protegido

2. **Implementar testes com setup de banco:**
   - Mock de banco ou setup de teste
   - Validar `tokenVersion` contra banco
   - Validar determinismo de permissions

3. **Implementar testes com setup de handlers:**
   - Mock de handlers de eventos
   - Validar validação de contexto em handlers

4. **Adicionar testes para invariantes restantes:**
   - Session Invariants (7.1, 7.2)
   - Bootstrap Invariants (3.1, 3.2)
   - Actor Invariants (4.1)

---

## Referências

- `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md` - Documentação dos invariantes
- `backend/tests/invariants/README.md` - Documentação do harness
- `backend/jest.config.js` - Configuração do Jest
- `backend/package.json` - Scripts de teste

---

**Última Revisão:** 2025-01-22  
**Próxima Revisão:** Conforme evolução dos testes


