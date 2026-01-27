# Fastify Schema Validation Check

## Purpose

This CI check enforces the architectural rule that **Fastify routes MUST NOT define a `schema` field**. All validation must be done manually inside handlers using Zod.

## Rule

- ❌ **FORBIDDEN**: `fastify.post('/route', { schema: { body: mySchema } }, handler)`
- ✅ **REQUIRED**: Manual Zod validation inside handlers using `schema.safeParse(req.body)`

## Usage

### Run locally

```bash
npm run check:fastify-schema
```

### In CI

The check runs automatically in GitHub Actions as part of the `validate-backend` job.

## How it works

The script scans all TypeScript files in `backend/src` and:

1. Identifies files containing Fastify route definitions (`fastify.post`, `fastify.put`, etc.)
2. Checks for `schema:` patterns within route configurations
3. Fails if any violations are found

## Error message

If violations are found, the script will:

- List all violations with file paths and line numbers
- Provide clear error messages
- Show examples of correct usage

## Fixing violations

1. Remove the `schema` field from the Fastify route definition
2. Add manual Zod validation inside the handler:

```typescript
// ❌ WRONG
fastify.post('/route', {
  schema: {
    body: mySchema,
  },
}, async (req, reply) => {
  // handler
});

// ✅ CORRECT
fastify.post('/route', async (req, reply) => {
  // Validate payload
  const parsed = mySchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: 'Invalid request body',
      details: parsed.error.errors,
    });
  }

  // Use parsed.data instead of req.body
  const data = parsed.data;
  // handler logic
});
```

## Files

- `check-fastify-schema.js` - Main check script (Node.js)
- `check-fastify-schema.ts` - TypeScript version (alternative)
- `check-fastify-schema.sh` - Shell script version (alternative)







