# RUNTIME BOUNDARY RULE

## Principle

Snake_case is allowed only at the persistence boundary (DB).
CamelCase is required in domain and internal logic.

## Rule

Every DB read must be followed by explicit mapping:

```ts
// boundary: DB -> domain mapping
const mapped = mapXxxRowToDomain(row);
```

## Forbidden

Direct SQL row property usage outside boundary:

```ts
// forbidden
row.user_id
row.created_at
row.amount_cents
```

## Allowed

Snake_case access only inside mapper:

```ts
function mapUserRowToDomain(row) {
  return {
    userId: row.user_id,
    createdAt: row.created_at,
  };
}
```

## Scope

- Applies to scripts, services, and adapters
- Does not apply to pure SQL or migrations
- Does not apply to tests that reflect DB shape

## Enforcement

Validated automatically by:

```bash
npm run validate:scripts:row-mapping
```
