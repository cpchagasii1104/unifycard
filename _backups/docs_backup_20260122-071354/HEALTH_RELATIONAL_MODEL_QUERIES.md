# Queries de Matching - Modelo Relacional de Saúde

Este documento contém exemplos de queries SQL para demonstrar como o modelo relacional de saúde permite matching avançado com clínicas, odontologia, visão, etc.

## Estrutura do Modelo

- **health_taxonomies**: Taxonomia controlada (o que o sistema entende)
- **user_health_facts**: Fatos declarados pelo usuário (relacional)
- **health_consents**: Consentimentos isolados e auditáveis

## Exemplos de Queries

### 1. Usuários com Condição X

```sql
-- Buscar usuários com "Miopia"
SELECT DISTINCT
  u.actor_id,
  u.tenant_id,
  f.value_text AS miopia_value,
  f.created_at AS declared_at
FROM user_health_facts f
INNER JOIN health_taxonomies t ON t.taxonomy_id = f.taxonomy_id
WHERE t.slug = 'condicoes-visuais'
  AND f.value_text ILIKE '%miopia%'
  AND f.tenant_id = $1
ORDER BY f.created_at DESC;
```

### 2. Usuários que Precisam de Serviço Y

```sql
-- Buscar usuários que precisam de consulta odontológica
SELECT DISTINCT
  f.actor_id,
  f.tenant_id,
  f.value_date AS last_dental_visit,
  CASE 
    WHEN f.value_date < NOW() - INTERVAL '6 months' THEN 'Necessita consulta'
    ELSE 'Consulta recente'
  END AS status
FROM user_health_facts f
INNER JOIN health_taxonomies t ON t.taxonomy_id = f.taxonomy_id
WHERE t.slug = 'ultima-consulta-odontologica'
  AND f.tenant_id = $1
  AND (f.value_date IS NULL OR f.value_date < NOW() - INTERVAL '6 months')
ORDER BY f.value_date ASC NULLS FIRST;
```

### 3. Match entre Clínicas e Perfis

```sql
-- Buscar usuários que usam óculos e precisam de exame de visão
SELECT DISTINCT
  f.actor_id,
  f.tenant_id,
  glasses_fact.value_boolean AS uses_glasses,
  exam_fact.value_date AS last_exam,
  CASE 
    WHEN exam_fact.value_date IS NULL THEN 'Nunca fez exame'
    WHEN exam_fact.value_date < NOW() - INTERVAL '1 year' THEN 'Exame vencido'
    ELSE 'Exame em dia'
  END AS exam_status
FROM user_health_facts glasses_fact
INNER JOIN health_taxonomies glasses_tax ON glasses_tax.taxonomy_id = glasses_fact.taxonomy_id
LEFT JOIN user_health_facts exam_fact 
  ON exam_fact.actor_id = glasses_fact.actor_id
  AND exam_fact.tenant_id = glasses_fact.tenant_id
LEFT JOIN health_taxonomies exam_tax 
  ON exam_tax.taxonomy_id = exam_fact.taxonomy_id
  AND exam_tax.slug = 'ultimo-exame-visao'
WHERE glasses_tax.slug = 'uso-oculos'
  AND glasses_fact.value_boolean = true
  AND glasses_fact.tenant_id = $1
ORDER BY exam_fact.value_date ASC NULLS FIRST;
```

### 4. Usuários com Medicamentos Contínuos

```sql
-- Buscar usuários que tomam medicamentos contínuos
SELECT DISTINCT
  f.actor_id,
  f.tenant_id,
  f.value_text AS medications,
  f.notes,
  f.created_at AS declared_at
FROM user_health_facts f
INNER JOIN health_taxonomies t ON t.taxonomy_id = f.taxonomy_id
WHERE t.slug = 'medicamentos-continuos'
  AND f.tenant_id = $1
  AND f.value_text IS NOT NULL
ORDER BY f.created_at DESC;
```

### 5. Usuários por Categoria de Saúde

```sql
-- Buscar todos os fatos de saúde de uma categoria específica
SELECT 
  f.actor_id,
  t.name AS taxonomy_name,
  t.fact_type,
  CASE 
    WHEN f.value_text IS NOT NULL THEN f.value_text
    WHEN f.value_number IS NOT NULL THEN f.value_number::text
    WHEN f.value_boolean IS NOT NULL THEN f.value_boolean::text
    WHEN f.value_date IS NOT NULL THEN f.value_date::text
    ELSE NULL
  END AS fact_value,
  f.created_at
FROM user_health_facts f
INNER JOIN health_taxonomies t ON t.taxonomy_id = f.taxonomy_id
WHERE t.category = 'vision'  -- ou 'dental', 'medications', etc.
  AND f.tenant_id = $1
ORDER BY f.actor_id, f.created_at DESC;
```

### 6. Estatísticas de Saúde por Categoria

```sql
-- Contar quantos usuários têm fatos em cada categoria
SELECT 
  t.category,
  COUNT(DISTINCT f.actor_id) AS users_count,
  COUNT(f.fact_id) AS facts_count
FROM user_health_facts f
INNER JOIN health_taxonomies t ON t.taxonomy_id = f.taxonomy_id
WHERE f.tenant_id = $1
GROUP BY t.category
ORDER BY users_count DESC;
```

### 7. Usuários com Necessidades de Acessibilidade

```sql
-- Buscar usuários que precisam de acessibilidade
SELECT DISTINCT
  f.actor_id,
  f.tenant_id,
  f.value_text AS accessibility_needs,
  f.notes,
  f.created_at
FROM user_health_facts f
INNER JOIN health_taxonomies t ON t.taxonomy_id = f.taxonomy_id
WHERE t.slug = 'necessidades-acessibilidade'
  AND f.tenant_id = $1
  AND f.value_text IS NOT NULL
ORDER BY f.created_at DESC;
```

### 8. Match com Consentimento Ativo

```sql
-- Buscar fatos apenas de usuários que consentiram
SELECT 
  f.actor_id,
  t.name AS taxonomy_name,
  f.value_text,
  c.consented_at,
  c.consent_scope
FROM user_health_facts f
INNER JOIN health_taxonomies t ON t.taxonomy_id = f.taxonomy_id
INNER JOIN health_consents c 
  ON c.actor_id = f.actor_id
  AND c.tenant_id = f.tenant_id
  AND (c.consent_scope = t.category OR c.consent_scope = 'all')
WHERE f.tenant_id = $1
  AND c.is_consented = true
  AND c.revoked_at IS NULL
ORDER BY f.created_at DESC;
```

## Validação

Para validar que o modelo funciona:

1. **Executar seed de taxonomias:**
   ```bash
   cd backend
   npx ts-node src/scripts/seed-health-taxonomies.ts
   ```

2. **Criar uma declaração de saúde via API:**
   ```bash
   POST /profile/health/declarations
   {
     "section": "vision",
     "payload": {
       "usesGlasses": true,
       "conditions": "Miopia -2.5",
       "lastExam": "2024-01-01"
     },
     "consent": true,
     "consentScope": "vision"
   }
   ```

3. **Verificar que fatos foram criados:**
   ```sql
   SELECT * FROM user_health_facts 
   WHERE actor_id = '<actor_id>' 
   ORDER BY created_at DESC;
   ```

4. **Executar queries de matching acima**

## Próximos Passos

- [ ] Criar endpoints de matching no backend
- [ ] Integrar com módulo de clínicas/serviços
- [ ] Criar dashboard de estatísticas de saúde
- [ ] Implementar notificações baseadas em fatos (ex: "Seu exame de visão está vencido")





