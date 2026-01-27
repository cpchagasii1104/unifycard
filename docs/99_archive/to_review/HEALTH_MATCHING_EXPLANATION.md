# Como os Dados de Saúde são Usados para Matching com Clínicas

## Visão Geral

O modelo relacional de saúde permite matching inteligente entre usuários e clínicas/serviços de saúde através de **fatos estruturados** armazenados em `user_health_facts`.

## Estrutura de Dados

### 1. Taxonomias (`health_taxonomies`)
**O que o sistema entende:**
- Exemplos: "Uso de Óculos", "Miopia", "Último Exame de Visão", "Uso de Aparelho Ortodôntico"
- Cada taxonomia tem:
  - `category`: general, vision, dental, medications, mobility, mental
  - `factType`: condition, medication, device, service_need, allergy
  - `slug`: identificador único (ex: "uso-oculos", "condicoes-visuais")

### 2. Fatos do Usuário (`user_health_facts`)
**O que o usuário declara:**
- Vínculo com taxonomia (`taxonomy_id`)
- Valor estruturado:
  - `value_text`: "Miopia -2.5", "Metformina 500mg"
  - `value_boolean`: true/false (ex: usa óculos)
  - `value_date`: "2024-01-01" (ex: último exame)
  - `value_number`: 2.5 (ex: grau de miopia)

## Exemplos de Matching

### 1. Matching com Clínicas de Oftalmologia

**Query:**
```sql
-- Usuários que usam óculos e precisam de exame
SELECT DISTINCT
  f.actor_id,
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
LEFT JOIN health_taxonomies exam_tax 
  ON exam_tax.taxonomy_id = exam_fact.taxonomy_id
  AND exam_tax.slug = 'ultimo-exame-visao'
WHERE glasses_tax.slug = 'uso-oculos'
  AND glasses_fact.value_boolean = true
  AND (exam_fact.value_date IS NULL OR exam_fact.value_date < NOW() - INTERVAL '1 year')
```

**Uso:**
- Clínicas de oftalmologia podem buscar usuários que:
  - Usam óculos (`uses_glasses = true`)
  - Não fizeram exame há mais de 1 ano
  - Têm condições visuais específicas (miopia, astigmatismo, etc.)

### 2. Matching com Clínicas Odontológicas

**Query:**
```sql
-- Usuários que precisam de consulta odontológica
SELECT DISTINCT
  f.actor_id,
  f.value_date AS last_dental_visit,
  CASE 
    WHEN f.value_date < NOW() - INTERVAL '6 months' THEN 'Necessita consulta'
    ELSE 'Consulta recente'
  END AS status
FROM user_health_facts f
INNER JOIN health_taxonomies t ON t.taxonomy_id = f.taxonomy_id
WHERE t.slug = 'ultima-consulta-odontologica'
  AND (f.value_date IS NULL OR f.value_date < NOW() - INTERVAL '6 months')
```

**Uso:**
- Clínicas odontológicas podem buscar usuários que:
  - Não fizeram consulta há mais de 6 meses
  - Usam aparelho ortodôntico (`uso-aparelho-ortodontico = true`)
  - Têm necessidades urgentes (`necessidades-urgentes-odontologia`)

### 3. Matching com Farmácias

**Query:**
```sql
-- Usuários que tomam medicamentos contínuos
SELECT DISTINCT
  f.actor_id,
  f.value_text AS medications,
  f.notes AS dosage_info
FROM user_health_facts f
INNER JOIN health_taxonomies t ON t.taxonomy_id = f.taxonomy_id
WHERE t.slug = 'medicamentos-continuos'
  AND f.value_text IS NOT NULL
```

**Uso:**
- Farmácias podem:
  - Oferecer descontos para medicamentos que o usuário toma
  - Notificar sobre disponibilidade de medicamentos
  - Sugerir genéricos ou alternativas

### 4. Matching com Serviços de Acessibilidade

**Query:**
```sql
-- Usuários com necessidades de acessibilidade
SELECT DISTINCT
  f.actor_id,
  f.value_text AS accessibility_needs,
  mobility_fact.value_text AS mobility_aids
FROM user_health_facts f
INNER JOIN health_taxonomies t ON t.taxonomy_id = f.taxonomy_id
LEFT JOIN user_health_facts mobility_fact
  ON mobility_fact.actor_id = f.actor_id
LEFT JOIN health_taxonomies mobility_tax
  ON mobility_tax.taxonomy_id = mobility_fact.taxonomy_id
  AND mobility_tax.slug = 'auxiliares-mobilidade'
WHERE t.slug = 'necessidades-acessibilidade'
  AND f.value_text IS NOT NULL
```

**Uso:**
- Eventos e estabelecimentos podem:
  - Verificar se precisam de rampas, elevadores, banheiros adaptados
  - Oferecer serviços acessíveis
  - Garantir que o local atende às necessidades do usuário

## Interface do Usuário

### Como o Usuário Preenche

1. **Seleciona uma seção** (Visão, Odontologia, Medicamentos, etc.)
2. **Vê taxonomias disponíveis** (ex: "Uso de Óculos", "Último Exame de Visão")
3. **Preenche valores estruturados:**
   - Checkbox para dispositivos (ex: "Usa óculos" = Sim/Não)
   - Data para exames/consultas (ex: "Último exame" = 2024-01-01)
   - Texto para condições/medicamentos (ex: "Miopia -2.5", "Metformina 500mg")
4. **Salva fato** → Cria registro em `user_health_facts`

### Como os Dados são Armazenados

**Antes (texto livre):**
```json
{
  "declarationText": "Tenho miopia e uso óculos",
  "payload": { "usesGlasses": true, "conditions": "Miopia" }
}
```
❌ Difícil de fazer matching (precisa parsear texto)

**Agora (estruturado):**
```sql
-- Fato 1: Usa óculos
INSERT INTO user_health_facts (taxonomy_id, value_boolean) 
VALUES ('taxonomy-uso-oculos', true);

-- Fato 2: Condição visual
INSERT INTO user_health_facts (taxonomy_id, value_text) 
VALUES ('taxonomy-condicoes-visuais', 'Miopia -2.5');
```
✅ Fácil de fazer matching (query direta por taxonomia)

## Benefícios do Modelo Estruturado

### 1. Matching Preciso
- **Antes:** "Tenho miopia" (texto livre) → difícil de encontrar
- **Agora:** `taxonomy_id = 'condicoes-visuais' AND value_text LIKE '%miopia%'` → query direta

### 2. Agregação de Dados
- Contar quantos usuários têm miopia
- Encontrar usuários que precisam de exame
- Agrupar por categoria (visão, odontologia, etc.)

### 3. Notificações Inteligentes
- "Seu exame de visão está vencido" (compara `value_date` com hoje)
- "Você não fez consulta odontológica há 6 meses"
- "Medicamento disponível na farmácia parceira"

### 4. Integração com Clínicas
- Clínicas podem buscar usuários por:
  - Condições específicas
  - Necessidades de serviços
  - Histórico de exames/consultas
  - Uso de dispositivos (óculos, aparelho, etc.)

## Exemplo Completo: Matching Oftalmologia

**Cenário:** Clínica de oftalmologia quer encontrar usuários que:
1. Usam óculos
2. Não fizeram exame há mais de 1 ano
3. Têm miopia

**Query:**
```sql
SELECT DISTINCT
  u.actor_id,
  glasses.value_boolean AS uses_glasses,
  exam.value_date AS last_exam,
  condition.value_text AS condition_text
FROM user_health_facts glasses
INNER JOIN health_taxonomies glasses_tax ON glasses_tax.taxonomy_id = glasses.taxonomy_id
LEFT JOIN user_health_facts exam 
  ON exam.actor_id = glasses.actor_id
LEFT JOIN health_taxonomies exam_tax 
  ON exam_tax.taxonomy_id = exam.taxonomy_id
  AND exam_tax.slug = 'ultimo-exame-visao'
LEFT JOIN user_health_facts condition
  ON condition.actor_id = glasses.actor_id
LEFT JOIN health_taxonomies condition_tax
  ON condition_tax.taxonomy_id = condition.taxonomy_id
  AND condition_tax.slug = 'condicoes-visuais'
WHERE glasses_tax.slug = 'uso-oculos'
  AND glasses.value_boolean = true
  AND (exam.value_date IS NULL OR exam.value_date < NOW() - INTERVAL '1 year')
  AND condition.value_text ILIKE '%miopia%'
```

**Resultado:**
- Lista de usuários que atendem aos critérios
- Clínica pode enviar ofertas personalizadas
- Matching preciso e eficiente

## Conclusão

O modelo relacional de saúde transforma **texto livre** em **dados estruturados**, permitindo:
- ✅ Matching preciso com clínicas
- ✅ Queries eficientes
- ✅ Notificações inteligentes
- ✅ Integração com serviços de saúde
- ✅ Análise e estatísticas

**Dados estruturados = Matching inteligente = Melhor experiência para usuários e clínicas**





