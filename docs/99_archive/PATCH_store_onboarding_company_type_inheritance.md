# Patch: store-onboarding — herança de categorias por tipo de empresa

> **Pasta `leia-esta-pasta`:** documento de **referência / histórico** apenas. **Migrações:** só `backend/migrations/` (não existem cópias `.up.sql` duplicadas nesta pasta).

> **Estado no repositório:** **Implementado.** A lógica de herança (`tenants.company_type_id` → `company_types.default_department_slugs` / `default_branch_slugs` → `categories`) vive em `backend/src/modules/marketplace/store-onboarding.service.ts`, com observabilidade e validação de N1 descritas em `isto-e-para-voce/STATUS_EXECUCAO.md`. O código abaixo é a **especificação original** que guiou a implementação.

## Arquivo
`backend/src/modules/marketplace/store-onboarding.service.ts`

## Problema
Quando uma empresa é criada com `company_type_id`, o onboarding
exige que o usuário selecione `departmentCategoryId` e
`selectedCategoryIds` manualmente. O tipo de empresa já sabe
quais categorias são padrão — deveria herdar automaticamente.

## Nova função: resolveOnboardingCategories

Adicionar antes do método `createStoreOnboarding`:

```typescript
/**
 * Resolve categorias de onboarding a partir do tipo de empresa.
 * Se o tenant tiver company_type_id, deriva department e branches
 * automaticamente a partir de company_types.default_*_slugs.
 * Retorna null se não for possível resolver (onboarding manual).
 */
private async resolveOnboardingCategories(
  tenantId: string
): Promise<{ departmentCategoryId: string; selectedCategoryIds: string[] } | null> {
  // 1. Buscar company_type_id do tenant
  const tenantRow = await runQueryWithTenant<{
    company_type_id: string | null;
  }>(
    tenantId,
    `SELECT company_type_id FROM tenants WHERE id = $1 LIMIT 1`,
    [tenantId]
  );
  if (!tenantRow?.company_type_id) return null;

  // 2. Buscar slugs padrão do tipo de empresa
  const typeRow = await runQueryWithTenant<{
    default_department_slugs: string[];
    default_branch_slugs: string[];
  }>(
    tenantId,
    `SELECT default_department_slugs, default_branch_slugs
     FROM company_types
     WHERE id = $1 LIMIT 1`,
    [tenantRow.company_type_id]
  );
  if (!typeRow) return null;

  const { default_department_slugs, default_branch_slugs } = typeRow;
  if (!default_department_slugs?.length) return null;

  // 3. Resolver category_ids a partir dos slugs (categories é global)
  const allSlugs = [...default_department_slugs, ...default_branch_slugs];
  const rows = await runQueriesWithTenant<{
    category_id: string;
    slug: string;
  }>(
    tenantId,
    `SELECT category_id, slug FROM categories
     WHERE slug = ANY($1::text[]) AND is_active = true`,
    [allSlugs]
  );

  const bySlug = new Map(rows.map((r) => [r.slug, r.category_id]));

  // Departamento: primeiro slug que resolver
  const departmentCategoryId = bySlug.get(default_department_slugs[0]!);
  if (!departmentCategoryId) return null;

  const selectedCategoryIds = default_branch_slugs
    .map((s) => bySlug.get(s))
    .filter((id): id is string => !!id);

  if (!selectedCategoryIds.length) return null;

  return { departmentCategoryId, selectedCategoryIds };
}
```

## Modificação em createStoreOnboarding

Adicionar no início do método, antes da validação de categorias:

```typescript
async createStoreOnboarding(
  tenantId: string,
  input: StoreOnboardingInput,
  createdByActorId: string,
  createdByUserId?: string
): Promise<StoreOnboardingResult> {

  // Herança automática de categorias por tipo de empresa
  // Se o tenant tem company_type_id e o input não especificou
  // categorias explicitamente, resolver a partir do tipo.
  let resolvedInput = input;
  if (!input.departmentCategoryId) {
    const inherited = await this.resolveOnboardingCategories(tenantId);
    if (inherited) {
      resolvedInput = {
        ...input,
        departmentCategoryId: inherited.departmentCategoryId,
        selectedCategoryIds: [
          ...inherited.selectedCategoryIds,
          ...(input.selectedCategoryIds ?? []),
        ],
      };
    }
  }

  // A partir daqui usar resolvedInput em vez de input
  // (substituir todas as referências a input por resolvedInput)

  // 1. Validar categorias
  await this.validateMarketplaceCategories(tenantId, [
    resolvedInput.departmentCategoryId,
    ...resolvedInput.selectedCategoryIds,
  ]);

  // ... resto do método usando resolvedInput
}
```

## Invariantes preservadas
- Herança é **opcional** — se `input.departmentCategoryId` vier
  preenchido, o comportamento atual é mantido integralmente ✅
- `validateMarketplaceCategories` continua sendo chamado —
  categorias herdadas passam pela mesma validação ✅
- "Categoria aplicada ≠ categoria criada" — o patch nunca cria
  categorias, só resolve IDs de categorias globais existentes ✅
- Idempotente — re-run não duplica (find-or-create já existe
  no loop de produtos) ✅

## Verificação pós-patch
```bash
# Tenant com company_type_id = 'salao' deve resolver:
# departmentCategoryId = id de 'marketplace-servicos-pessoais'
# selectedCategoryIds  = ids de cabelo + estetica-spa + barbearia

# Tenant sem company_type_id: input.departmentCategoryId obrigatório
# (comportamento atual inalterado)
```
