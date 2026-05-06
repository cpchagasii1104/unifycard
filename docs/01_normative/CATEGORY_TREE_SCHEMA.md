> ⚠️ **LEGADO — NÃO REFLETE O SCHEMA ATUAL.** Modelo antigo (ex.: `id` BIGINT, sem coluna `path`, campos como `sector`). Estrutura e contratos vigentes: migrações core (ex. `043_category_core_canonical.sql` e posteriores) e **`docs/01_normative/CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md`** (SSOT, incluindo semântica de `path`).

SCHEMA DEFINITIVO — ÁRVORE CANÔNICA DO SISTEMA
FONTE ÚNICA DE VERDADE (SSOT)

================================================
TABELA: categories
================================================

id                BIGINT PK
parent_id         BIGINT FK -> categories.id (nullable)
slug              VARCHAR(120) UNIQUE NOT NULL
name              VARCHAR(255) NOT NULL
level             INT NOT NULL               // 0,1,2,3...
sector             VARCHAR(64) NOT NULL      // ex: MOBILIDADE, SAUDE, EDUCACAO
is_active          BOOLEAN DEFAULT true
is_leaf            BOOLEAN DEFAULT false
created_at         TIMESTAMP
updated_at         TIMESTAMP

REGRAS:
- slug é IMUTÁVEL
- parent_id define a árvore
- level é DERIVADO (validação, não fonte)
- nenhuma categoria depende de módulo
- nenhuma categoria é criada por contexto

================================================
TABELA: category_contexts
================================================

id                BIGINT PK
category_id       BIGINT FK -> categories.id
context           VARCHAR(64) NOT NULL
metadata          JSONB
created_at        TIMESTAMP
updated_at        TIMESTAMP

EXEMPLOS DE context:
- PROFILE_PROFESSIONAL
- EVENT
- GROUP
- JOB
- MARKETPLACE
- DRIVER
- DELIVERY
- GOVERNMENT

REGRAS:
- NÃO cria categoria nova
- APENAS adiciona regras contextuais
- metadata é opcional e não obrigatória

================================================
TABELA: manufacturers
================================================

id                BIGINT PK
slug              VARCHAR(120) UNIQUE NOT NULL
name              VARCHAR(255) NOT NULL
sector             VARCHAR(64) NOT NULL      // ex: AUTOMOTIVO
is_active          BOOLEAN DEFAULT true
created_at         TIMESTAMP
updated_at         TIMESTAMP

REGRAS:
- fabricante existe UMA VEZ
- nunca depende de módulo
- nunca duplicado por contexto

================================================
TABELA: models
================================================

id                BIGINT PK
manufacturer_id   BIGINT FK -> manufacturers.id
slug              VARCHAR(120) NOT NULL
name              VARCHAR(255) NOT NULL
year_start        INT
year_end          INT
is_active          BOOLEAN DEFAULT true
created_at         TIMESTAMP
updated_at         TIMESTAMP

UNIQUE (manufacturer_id, slug)

================================================
TABELA: category_manufacturer_rel
================================================

id                BIGINT PK
category_id       BIGINT FK -> categories.id
manufacturer_id   BIGINT FK -> manufacturers.id

USO:
- peças compatíveis
- serviços especializados
- eventos focados
- logística

================================================
TABELA: category_model_rel
================================================

id                BIGINT PK
category_id       BIGINT FK -> categories.id
model_id          BIGINT FK -> models.id

================================================
USO NOS MÓDULOS (REGRA GLOBAL)
================================================

QUALQUER módulo que precise de classificação:

- salva category_id
- salva manufacturer_id (se aplicável)
- salva model_id (se aplicável)

EXEMPLOS:

driver.vehicle.category_id
event.category_id
group.category_id
job.category_id
product.category_id

================================================
PROIBIÇÕES ABSOLUTAS
================================================

- NÃO criar tabelas de categorias por módulo
- NÃO criar enums de categoria em código
- NÃO duplicar fabricantes
- NÃO duplicar modelos
- NÃO inferir categoria via texto

================================================
INVARIANTE SISTÊMICO
================================================

SE DUAS COISAS SIGNIFICAM A MESMA ATIVIDADE,
ELAS APONTAM PARA O MESMO category_id

================================================
ESTE DOCUMENTO É FINAL.
================================================

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_INDEX.md
- CATEGORY_TREE_ARCHITECTURAL_CLOSURE.md
- CATEGORY_TREE_MIGRATION_PLAN.md
<!-- AUTO-GENERATED-END -->