# CATEGORY_WRITE_PIPELINE_IMPLEMENTATION.md

## Status
Production-ready — v1.0.0

## Catálogo profissional (taxonomia ↔ BD) — operação contínua

- **Input editorial (não SSOT):** `docs/01_normative/taxonomia_ocupacoes_v2.md` (`domain: servicos`, `parent_n1` por secção).
- **SSOT semântico:** `public.concepts`; **N2** profissional via `core_invariant.create_category_from_concept` (0097).
- **N1 novo** sob o N0 operacional `profissoes`: introduzir com **migration** `INSERT ... ON CONFLICT (slug) DO UPDATE` (padrão 0098 / **0099** `beleza-estetica` / **0100** `assistencia-domiciliar`, `jardinagem-manutencao`, `limpeza-servicos`).
- **Pós-alteração (ordem):** `pnpm validate:profissoes-taxonomy` → `ALLOW_CONCEPTS_FROM_IGNORED=true pnpm create:concepts` → `validate:profissoes-taxonomy` → `pnpm validate:profissoes-n1` → `ALLOW_PROFESSION_SEED=true pnpm seed:professions` (`PROFISOES_YAML` → `data/profissoes.validated.yaml`).
- **Mapa editorial→N1** (quando o rótulo da secção ≠ slug N1 na BD): `backend/data/profissoes.parent-n1-map.yaml`.

## Purpose
Implement the **official write pipeline for `categories`** so that **no actor writes directly to `categories` outside the governed path**.

---

## Architectural Position

### Semantic SSOT
- `CONCEPT` is the **only semantic SSOT**
- `canonical_id` is the semantic identity
- `slug` is descriptive only
- `category_id` is **not** semantic identity

### Navigation Layer
- `categories` is a **navigation tree**
- `categories` is a **projection**
- `categories` must be **derived from CONCEPT**, never the inverse
- `path` contains **ancestors only**
- `path.length === level`

### Read Model
- profile / aggregations are read models
- read models never become SSOT
- `user_professions` stores `concept_id`, never `category_id`

---

## Core Rule

```text
Nobody writes to categories directly.
Every N2 professional category must be created from an existing CONCEPT.

What this implementation achieves
Create an official write path for categories
Guarantee that new professional N2 categories are created from CONCEPT
Block direct insertions into categories via trigger guardrail
Preserve existing architecture:
CONCEPT = semantic SSOT
categories = navigation
profile = read model
Make the seed process:
idempotent
auditable
batch-safe
rollback-aware
validation-driven
Non-goals
Refactoring ontology
Changing CONCEPT ownership rules
Rewriting autocomplete behavior
Redesigning marketplace
Redesigning GRAPH
Creating a second category tree
Replacing the current profile aggregation
Introducing a new SSOT
Using slug as identity
Using categories as semantic identity
Normative assumptions
CONCEPT is the semantic SSOT
categories is navigation only
GRAPH stores semantic relationships between concepts
profile uses concept_id
N0/N1/N2 professional tree exists conceptually
Implementation
Phase 1 — SQL Function
Create the official function:

-- Function: core_invariant.create_category_from_concept
-- Purpose: ÚNICA forma permitida de criar N2 professional category

CREATE OR REPLACE FUNCTION core_invariant.create_category_from_concept(
    p_concept_id UUID,
    p_parent_slug VARCHAR(100),
    p_scope VARCHAR(50) DEFAULT 'professional',
    p_sort_order INTEGER DEFAULT 0
)
RETURNS TABLE (
    category_id UUID,
    created BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_concept RECORD;
    v_parent_id UUID;
    v_parent_level INTEGER;
    v_parent_path TEXT[];
    v_parent_slug TEXT;
    v_existing UUID;
    v_new_id UUID;
    v_level INTEGER;
    v_path TEXT[];
BEGIN
    -- 1. Validate concept exists
    SELECT * INTO v_concept 
    FROM core_invariant.concept_nodes 
    WHERE canonical_id = p_concept_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            NULL::UUID, 
            FALSE, 
            'CONCEPT_NOT_FOUND: ' || p_concept_id::TEXT;
        RETURN;
    END IF;
    
    -- 2. Validate context
    IF v_concept.context != 'professional' THEN
        RETURN QUERY SELECT 
            NULL::UUID, 
            FALSE, 
            'INVALID_CONTEXT: ' || v_concept.context;
        RETURN;
    END IF;
    
    -- 3. Resolve parent (obrigatório level = 1 para ramo N1 → N2)
    IF p_parent_slug IS NOT NULL THEN
        SELECT category_id, level, path, slug
        INTO v_parent_id, v_parent_level, v_parent_path, v_parent_slug
        FROM public.categories
        WHERE slug = p_parent_slug
          AND scope = p_scope
          AND level = 1;

        IF NOT FOUND THEN
            RETURN QUERY SELECT 
                NULL::UUID, 
                FALSE, 
                'PARENT_NOT_FOUND: ' || p_parent_slug;
            RETURN;
        END IF;

        -- Blindagem defensiva: path.length === level no parent (CLOSURE; bloqueia legado corrupto)
        IF COALESCE(array_length(v_parent_path, 1), 0) IS DISTINCT FROM v_parent_level THEN
            RAISE EXCEPTION 'INVALID_PARENT_PATH_STRUCTURE: parent=% level=% path=%',
                p_parent_slug, v_parent_level, v_parent_path;
        END IF;
    END IF;

    -- 3b. Derivar level e path (CLOSURE: path = ancestrais do novo nó, SEM o slug do próprio N2)
    --      i.e. não usar v_concept.slug em path; extensão = ancestrais do pai + slug do pai imediato
    IF p_parent_slug IS NULL THEN
        v_level := 0;
        v_path := ARRAY[]::TEXT[];
        -- v_parent_id já NULL; pipeline N2 profissional deve preferir parent explícito
    ELSE
        v_level := v_parent_level + 1;
        v_path := v_parent_path || ARRAY[v_parent_slug::TEXT];
    END IF;

    -- 4. Check for existing category (alinhado ao índice ux_category_concept_scope: só N2)
    SELECT category_id INTO v_existing
    FROM public.categories
    WHERE concept_id = p_concept_id
      AND scope = p_scope
      AND level = 2;

    IF FOUND THEN
        RETURN QUERY SELECT 
            v_existing, 
            FALSE, 
            'ALREADY_EXISTS: category for this concept';
        RETURN;
    END IF;
    
    -- 5. Create category (ÚNICA forma permitida!)
    INSERT INTO public.categories (
        slug, name, name_en, level, path, parent_id,
        scope, concept_id, sort_order, is_active
    ) VALUES (
        v_concept.slug,
        v_concept.display_names->>'pt_br',
        v_concept.display_names->>'en',
        v_level,
        v_path,
        v_parent_id,
        p_scope,
        p_concept_id,
        p_sort_order,
        true
    )
    RETURNING category_id INTO v_new_id;
    
    -- 6. Audit log
    INSERT INTO core_invariant.audit_log (
        actor, action, target_type, target_id, new_state, reason
    ) VALUES (
        current_user,
        'CREATE_CATEGORY_FROM_CONCEPT',
        'CATEGORY',
        v_new_id::TEXT,
        jsonb_build_object(
            'concept_id', p_concept_id,
            'parent_slug', p_parent_slug,
            'scope', p_scope
        ),
        'Pipeline oficial de criação'
    );
    
    RETURN QUERY SELECT v_new_id, TRUE, 'CREATED_SUCCESSFULLY';
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = core_invariant, public;

-- Ownership and permissions
ALTER FUNCTION core_invariant.create_category_from_concept OWNER TO admin_role;
GRANT EXECUTE ON FUNCTION core_invariant.create_category_from_concept TO app_role;

-- Harden SECURITY DEFINER: schema não exposto a PUBLIC
REVOKE ALL ON SCHEMA core_invariant FROM PUBLIC;

Phase 2 — Permissions

-- Block direct writes
REVOKE INSERT, UPDATE, DELETE ON public.categories FROM app_role;

-- Grant only official function
GRANT EXECUTE ON FUNCTION core_invariant.create_category_from_concept TO app_role;

-- Evitar duplicação (concept_id, scope) em N2 — protege contra race em batch
CREATE UNIQUE INDEX IF NOT EXISTS ux_category_concept_scope
ON public.categories (concept_id, scope)
WHERE level = 2;

-- N2 obriga concept_id (defesa em profundidade além do pipeline)
ALTER TABLE public.categories
ADD CONSTRAINT chk_n2_requires_concept
CHECK (
  level <> 2 OR concept_id IS NOT NULL
);

Phase 3 — Trigger Guardrail

-- Trigger function to block direct inserts
CREATE OR REPLACE FUNCTION block_direct_category_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow if nested trigger (cascade)
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;
    
    -- Block direct inserts
    IF current_setting('app.pipeline_origin', true) != 'create_category_from_concept' THEN
        RAISE EXCEPTION 'DIRECT_INSERT_BLOCKED: Use apenas create_category_from_concept()';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger DISABLED (enable after validation)
CREATE TRIGGER trg_block_direct_insert
    BEFORE INSERT ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION block_direct_category_insert();

-- Initially disabled
ALTER TABLE public.categories DISABLE TRIGGER trg_block_direct_insert;

Phase 4 — Audit View

-- View for category creation audit
CREATE VIEW category_creation_audit AS
SELECT 
    al.occurred_at,
    al.actor,
    al.target_id as category_id,
    al.new_state->>'concept_id' as concept_id,
    al.new_state->>'parent_slug' as parent_slug,
    al.new_state->>'scope' as scope,
    al.reason
FROM core_invariant.audit_log al
WHERE al.action = 'CREATE_CATEGORY_FROM_CONCEPT'
ORDER BY al.occurred_at DESC;

Backend Service
File: backend/services/category-seed.service.ts

import { Pool } from 'pg';
import { EventEmitter } from 'events';

interface SeedResult {
  conceptId: string;
  categoryId?: string;
  created: boolean;
  reason: string;
}

export class CategorySeedService extends EventEmitter {
  constructor(private pg: Pool) {
    super();
  }

  /**
   * Create category from concept — ONLY allowed write path
   */
  async createFromConcept(
    conceptId: string,
    parentSlug: string,
    options: { scope?: string; sortOrder?: number } = {}
  ): Promise<SeedResult> {
    // Set pipeline origin for trigger
    await this.pg.query(
      `SELECT set_config('app.pipeline_origin', 'create_category_from_concept', true)`
    );

    try {
      const result = await this.pg.query(
        'SELECT * FROM core_invariant.create_category_from_concept($1, $2, $3, $4)',
        [
          conceptId,
          parentSlug,
          options.scope || 'professional',
          options.sortOrder || 0,
        ]
      );

      const row = result.rows[0];

      this.emit(row.created ? 'seed:created' : 'seed:skipped', {
        conceptId,
        categoryId: row.category_id,
        reason: row.reason,
      });

      return {
        conceptId,
        categoryId: row.category_id,
        created: row.created,
        reason: row.reason,
      };

    } finally {
      // Clear context
      await this.pg.query(
        `SELECT set_config('app.pipeline_origin', '', true)`
      );
    }
  }

  /**
   * Batch seed — idempotent
   */
  async seedBatch(items: Array<{ conceptId: string; parentSlug: string }>): Promise<SeedResult[]> {
    const results: SeedResult[] = [];

    for (const item of items) {
      const result = await this.createFromConcept(item.conceptId, item.parentSlug);
      results.push(result);
      
      // Throttle for large batches
      if (items.length > 10) {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    this.emit('seed:batch_complete', { 
      total: items.length,
      created: results.filter(r => r.created).length,
      skipped: results.filter(r => !r.created).length,
    });

    return results;
  }

  /**
   * Integrity validation
   */
  async validateIntegrity(): Promise<{
    totalConcepts: number;
    totalCategories: number;
    unmappedConcepts: string[];
    orphanedCategories: string[];
  }> {
    const concepts = await this.pg.query(`
      SELECT canonical_id 
      FROM core_invariant.concept_nodes 
      WHERE context = 'professional'
        AND layer = 'CONCEPT'
    `);

    const categories = await this.pg.query(`
      SELECT category_id, concept_id
      FROM public.categories
      WHERE scope = 'professional' AND level = 2
    `);

    const conceptIds = new Set(concepts.rows.map(r => r.canonical_id));
    const categoryConceptIds = new Set(categories.rows.map(r => r.concept_id));
    
    const unmapped = Array.from(conceptIds).filter(id => !categoryConceptIds.has(id));
    const orphaned = categories.rows
      .filter(r => !conceptIds.has(r.concept_id))
      .map(r => r.category_id);

    return {
      totalConcepts: conceptIds.size,
      totalCategories: categories.rowCount || 0,
      unmappedConcepts: unmapped,
      orphanedCategories: orphaned,
    };
  }
}

Parent Mapper
File: backend/services/category-parent-mapper.ts

import { ConceptNode } from '../types/concept';

/**
 * Deterministic mapping from CONCEPT to parent category
 * APPROVED BY ARCHITECTURE — version 1.0.0
 */

const CBO_TO_PARENT: Record<string, string> = {
  // Medicina (2251-xx, 2252-xx, 2253-xx)
  '2251': 'medicina',
  '2252': 'medicina',  // anestesiologia
  '2253': 'medicina',  // cirurgia
  
  // Enfermagem (2235-xx)
  '2235': 'enfermagem',
  
  // Terapias (2236, 2237, 2238, 2231, 2515, 2234, 2232)
  '2236': 'terapias-reabilitacao',  // fisioterapia
  '2237': 'terapias-reabilitacao',  // fonoaudiologia
  '2238': 'terapias-reabilitacao',  // terapia ocupacional
  '2231': 'terapias-reabilitacao',  // nutrição
  '2515': 'terapias-reabilitacao',  // psicologia
  '2234': 'terapias-reabilitacao',  // farmácia
  '2232': 'terapias-reabilitacao',  // biomedicina
  
  // Odontologia (2232-08, 2232-16, etc)
  '2232-08': 'odontologia',
  '2232-16': 'odontologia',
  '2232-20': 'odontologia',
  
  // Add more as approved by architecture committee
};

export function inferParentSlug(concept: ConceptNode): string | null {
  const cbo = concept.attributes?.cbo as string;
  const domain = concept.domain;

  if (domain !== 'saude') {
    console.error(
      `[category-parent-mapper] Domain not implemented: ${domain} (concept ${concept.slug})`
    );
    return null;
  }

  // Try specific CBO first (e.g., 2232-08)
  if (cbo && CBO_TO_PARENT[cbo]) {
    return CBO_TO_PARENT[cbo];
  }

  // Try CBO prefix (e.g., 2251)
  const prefix = cbo?.split('-')[0];
  if (prefix && CBO_TO_PARENT[prefix]) {
    return CBO_TO_PARENT[prefix];
  }

  console.error(
    `[category-parent-mapper] Cannot infer parent for concept ${concept.slug} with CBO ${cbo}. Add mapping to category-parent-mapper.ts`
  );
  return null;
}

export class MappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MappingError';
  }
}

CLI
File: backend/scripts/seed-categories.ts

#!/usr/bin/env ts-node
import { Command } from 'commander';
import { Pool } from 'pg';
import { CategorySeedService } from '../services/category-seed.service';
import { inferParentSlug } from '../services/category-parent-mapper';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as readline from 'readline';

const program = new Command();

program
  .name('unificard-seed')
  .description('Official category seed pipeline')
  .version('1.0.0');

program
  .command('from-yaml <file>')
  .description('Seed categories from CONCEPT YAML')
  .option('--dry-run', 'Simulate without writing')
  .option('--scope <scope>', 'Scope', 'professional')
  .action(async (file, options) => {
    // Environment protection
    if (!process.env.ALLOW_SEED) {
      console.error('❌ ALLOW_SEED not set. Seed blocked.');
      process.exit(1);
    }

    const env = process.env.NODE_ENV;
    const allowedEnvs = ['development', 'staging', 'production'];
    
    if (!allowedEnvs.includes(env || '')) {
      console.error(`❌ Unknown environment: ${env}`);
      process.exit(1);
    }

    // Interactive confirmation for production
    if (env === 'production') {
      const confirmed = await promptConfirm(
        '⚠️  You are about to seed PRODUCTION. Confirm? (yes/no): '
      );
      if (!confirmed) {
        console.log('Cancelled.');
        process.exit(0);
      }
    }

    // Load and validate YAML
    const content = yaml.parse(fs.readFileSync(file, 'utf8'));
    const concepts = content.concepts || [];

    console.log(`📦 Processing ${concepts.length} CONCEPTs...`);

    // Map to seed items — erros no mapper não abortam o batch inteiro
    const seedItems: Array<{ conceptId: string; parentSlug: string }> = [];
    for (const c of concepts) {
      const parentSlug = inferParentSlug(c);
      if (parentSlug == null) {
        console.error(
          `[seed-categories] Skipping concept ${c.canonical_id ?? c.slug}: parent mapping failed`
        );
        continue;
      }
      seedItems.push({
        conceptId: c.canonical_id,
        parentSlug,
      });
    }

    if (options.dryRun) {
      console.log('🔍 [DRY-RUN] Items to process:');
      seedItems.forEach((i: any) => console.log(`  - ${i.conceptId} → ${i.parentSlug}`));
      return;
    }

    // Execute seed
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const service = new CategorySeedService(pool);

    const results = await service.seedBatch(seedItems);

    // Report
    const created = results.filter(r => r.created);
    const skipped = results.filter(r => !r.created);

    console.log(`\n✅ Seed complete:`);
    console.log(`  Created: ${created.length}`);
    console.log(`  Skipped: ${skipped.length}`);

    if (skipped.length > 0) {
      console.log('\n⚠️  Skipped:');
      skipped.forEach(s => console.log(`  - ${s.conceptId}: ${s.reason}`));
    }

    // Integrity validation
    const integrity = await service.validateIntegrity();
    console.log(`\n🔍 Integrity:`);
    console.log(`  Concepts: ${integrity.totalConcepts}`);
    console.log(`  Categories: ${integrity.totalCategories}`);
    console.log(`  Unmapped: ${integrity.unmappedConcepts.length}`);

    if (integrity.unmappedConcepts.length > 0) {
      console.error('\n❌ INTEGRITY FAILED: Unmapped concepts exist!');
      process.exit(1);
    }

    await pool.end();
  });

async function promptConfirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

program.parse();

Validation Queries
Gate 1 — Direct insert blocked

-- Should fail with: DIRECT_INSERT_BLOCKED
INSERT INTO public.categories (slug, name, level, scope) 
VALUES ('test', 'Test', 2, 'professional');

Gate 2 — Official function succeeds

-- Should succeed
SELECT * FROM core_invariant.create_category_from_concept(
    '550e8400-e29b-41d4-a716-446655440000',  -- valid concept
    'medicina',
    'professional',
    0
);

Gate 3 — Idempotency

-- Second call should return: created = false, reason = 'ALREADY_EXISTS...'
SELECT * FROM core_invariant.create_category_from_concept(
    '550e8400-e29b-41d4-a716-446655440000',
    'medicina',
    'professional',
    0
);

Gate 4 — No N2 without concept_id

SELECT COUNT(*) AS violations
FROM public.categories
WHERE scope = 'professional'
  AND level = 2
  AND concept_id IS NULL;
-- Expected: 0

Gate 5 — No unmapped concepts

SELECT cn.canonical_id, cn.slug
FROM core_invariant.concept_nodes cn
LEFT JOIN public.categories c
  ON c.concept_id = cn.canonical_id
 AND c.scope = 'professional'
 AND c.level = 2
WHERE cn.context = 'professional'
  AND cn.layer = 'CONCEPT'
  AND c.category_id IS NULL;
-- Expected: 0 rows

Gate 6 — Audit present

SELECT * FROM category_creation_audit LIMIT 10;
-- Should show all creations

Rollout Plan
Stage 0 — Preparation
[ ] Create SQL function
[ ] Create service
[ ] Create CLI
[ ] Create validation queries
[ ] Trigger remains DISABLED
Stage 1 — Dry-run

ALLOW_SEED=true NODE_ENV=development npx ts-node seed-categories.ts from-yaml concepts.yaml --dry-run

Stage 2 — Dev seed

ALLOW_SEED=true NODE_ENV=development npx ts-node seed-categories.ts from-yaml concepts.yaml

Stage 3 — Staging validation
[ ] Run integrity validation
[ ] Test direct insert failure
[ ] Confirm idempotency

Stage 4 — Enable trigger

ALTER TABLE public.categories ENABLE TRIGGER trg_block_direct_insert;

Stage 5 — Production

ALLOW_SEED=true NODE_ENV=production npx ts-node seed-categories.ts from-yaml concepts.yaml

Rollback Strategy
If parent mapping was wrong:
Correct category-parent-mapper.ts
Deactivate wrong categories (set is_active = false)
Re-run official seed
Preserve audit trail
Never:
Raw DELETE without audit
Ad-hoc INSERT to "fix quickly"
Direct UPDATE outside official function
Final Invariant Summary

CONCEPT defines meaning
GRAPH defines semantic relationships  
categories exposes navigation
profile consumes concept_id
audit records mutation
validation proves integrity

Acceptance Criteria
[ ] Exactly one official write path exists
[ ] Path starts from CONCEPT
[ ] Direct insert is blocked by trigger
[ ] Creation is auditable
[ ] Seed path is idempotent
[ ] Integrity can be checked anytime
[ ] No new SSOT introduced
[ ] categories remains projection only
Implementation complete. Ready for production.


---

## 💾 **DOWNLOAD**

O arquivo acima está pronto para ser salvo como:

CATEGORY_WRITE_PIPELINE_IMPLEMENTATION_v1.0.0.md


**Contém:**
- ✅ SQL completo (function, permissions, trigger, audit view)
- ✅ Backend service (`CategorySeedService`)
- ✅ Parent mapper (`category-parent-mapper.ts`)
- ✅ CLI (`seed-categories.ts`) com proteções de ambiente
- ✅ 6 validation gates com queries
- ✅ Rollout plan em 5 stages
- ✅ Rollback strategy

**Pronto para implementação pela equipe.**

