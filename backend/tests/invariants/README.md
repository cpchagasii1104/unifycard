# Institutional Test Harness - Invariantes Canônicos

## Objetivo

Este diretório contém testes automatizados que validam os **invariantes canônicos** documentados em `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`.

## Filosofia dos Testes

**REGRA FUNDAMENTAL:** Qualquer teste que **passe sem erro** indica que o invariante foi **VIOLADO**.

Todos os testes devem **FALHAR** (esperar erro explícito) para provar que o invariante está protegido.

## Estrutura

```
tests/invariants/
├── README.md                    # Este arquivo
├── index.test.ts                # Entry point (importa todos os testes)
├── auth-invariants.test.ts      # Invariantes de autenticação
├── tenant-invariants.test.ts    # Invariantes de tenant
├── rbac-invariants.test.ts      # Invariantes de RBAC
├── permission-invariants.test.ts # Invariantes de permissions
├── event-invariants.test.ts     # Invariantes de eventos
└── financial-db-structural.test.ts  # Ledger no DB (opt-in: RUN_FINANCIAL_DB_STRUCTURAL=1 + DATABASE_URL)
```

## Como Executar

### Executar todos os testes de invariantes:
```bash
pnpm test:invariants
```

### Executar no CI (com fail-fast):
```bash
pnpm test:invariants:ci
```

### Invariantes financeiros no PostgreSQL (read-only)

Validam `reference_*`, soma de splits, `target_actor_id` e `system_coverage`.

- **CI (GitHub `backend-ci.yml`):** após `migrate` + `seed`, com `RUN_FINANCIAL_DB_STRUCTURAL=1` e `pnpm test:financial-db-structural:ci` (fail-fast).
- **Local (opt-in):**

```bash
set DATABASE_URL=postgresql://...
set RUN_FINANCIAL_DB_STRUCTURAL=1
pnpm test:financial-db-structural:ci
```

Guards estáticos (sem DB, obrigatório no CI): `pnpm validate:regression-guards`.

## Critério de Sucesso

**CI DEVE FALHAR** se qualquer invariante for quebrado.

Isso significa:
- ✅ Se um teste **FALHA** (espera erro e recebe erro) → Invariante está protegido ✅
- ❌ Se um teste **PASSA** (espera erro mas não recebe) → Invariante foi violado ❌

## Adicionando Novos Testes

Para adicionar um novo teste de invariante:

1. Identifique o invariante em `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`
2. Crie um teste que **tenta violar** o invariante
3. Use `expect().rejects.toThrow()` para garantir que o erro é lançado
4. Se o teste **passar**, o invariante foi violado e o CI deve falhar

### Exemplo:

```typescript
it('deve rejeitar operação sem tenantId', async () => {
  // Tentar violar: chamar método sem tenantId
  await expect(
    service.method(null as any) // tenantId ausente
  ).rejects.toThrow(/tenantId is required/);
});
```

## Integração com CI

Os testes de invariantes devem ser executados como **gate obrigatório** no CI:

```yaml
# .github/workflows/ci.yml
- name: Test Invariants
  run: pnpm test:invariants:ci
```

Se qualquer teste passar (indicando violação de invariante), o build falha.

## Documentação Relacionada

- `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md` - Documentação dos invariantes
- `docs/audit/ADVERSARIAL-SECURITY-PASS.md` - Testes adversariais
- `docs/audit/CONCURRENCY-RACE-CONDITION-STRESS-PASS.md` - Testes de concorrência




