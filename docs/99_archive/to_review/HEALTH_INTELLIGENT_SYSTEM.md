# Sistema Inteligente de Coleta de Dados de Saúde

## Visão Geral

O sistema de saúde do UnifiCard foi evoluído para um **modelo inteligente de coleta de dados estruturados**, eliminando texto livre e permitindo matching preciso com clínicas.

## Características Principais

### 1. Perguntas Condicionais (Fluxo Guiado)

**Exemplo - Seção Visão:**
1. **Pergunta 1:** "Você usa óculos?" → Sim/Não
2. **Se SIM:** Mostra pergunta 2 automaticamente
3. **Pergunta 2:** "Quais condições visuais você tem?" → Seleção múltipla (Miopia, Astigmatismo, Hipermetropia, Presbiopia, Daltonismo)
4. **Se tem Miopia ou Astigmatismo:** Pergunta grau do óculos
5. **Pergunta 3:** "Quando foi seu último exame?" → Data

**Exemplo - Seção Odontologia:**
1. **Pergunta 1:** "Você usa aparelho ortodôntico?" → Sim/Não
2. **Pergunta 2:** "Quais condições bucais você tem?" → Seleção múltipla (Facetas, Implantes, Próteses, Gengivite, Sensibilidade, Bruxismo)
3. **Pergunta 3:** "Quando foi sua última consulta?" → Data

### 2. Seleção Múltipla de Condições Comuns

**Condições Visuais:**
- Miopia
- Astigmatismo
- Hipermetropia
- Presbiopia
- Daltonismo

**Condições Bucais:**
- Facetas
- Implantes Dentários
- Próteses Dentárias
- Gengivite
- Sensibilidade Dentária
- Bruxismo

**Condições Gerais:**
- Hipertensão
- Diabetes Tipo 1
- Diabetes Tipo 2
- Asma
- Alergias

### 3. Dados Estruturados (Não Texto Livre)

**Antes (texto livre):**
```
"Tenho miopia e uso óculos"
```
❌ Difícil de fazer matching

**Agora (estruturado):**
```sql
-- Fato 1: Usa óculos
user_health_facts: taxonomy_id='uso-oculos', value_boolean=true

-- Fato 2: Tem miopia
user_health_facts: taxonomy_id='miopia', value_boolean=true

-- Fato 3: Grau de miopia
user_health_facts: taxonomy_id='grau-oculos-miopia', value_text='-2.5'
```
✅ Matching preciso e eficiente

## Como Funciona o Matching

### Exemplo 1: Clínica de Oftalmologia

**Query:**
```sql
-- Buscar usuários que usam óculos, têm miopia e precisam de exame
SELECT DISTINCT
  f.actor_id,
  glasses.value_boolean AS uses_glasses,
  miopia.value_boolean AS has_myopia,
  exam.value_date AS last_exam,
  CASE 
    WHEN exam.value_date IS NULL THEN 'Nunca fez exame'
    WHEN exam.value_date < NOW() - INTERVAL '1 year' THEN 'Exame vencido'
    ELSE 'Exame em dia'
  END AS exam_status
FROM user_health_facts glasses
INNER JOIN health_taxonomies glasses_tax ON glasses_tax.taxonomy_id = glasses.taxonomy_id
INNER JOIN user_health_facts miopia ON miopia.actor_id = glasses.actor_id
INNER JOIN health_taxonomies miopia_tax ON miopia_tax.taxonomy_id = miopia.taxonomy_id
LEFT JOIN user_health_facts exam ON exam.actor_id = glasses.actor_id
LEFT JOIN health_taxonomies exam_tax ON exam_tax.taxonomy_id = exam.taxonomy_id
WHERE glasses_tax.slug = 'uso-oculos'
  AND glasses.value_boolean = true
  AND miopia_tax.slug = 'miopia'
  AND miopia.value_boolean = true
  AND (exam.value_date IS NULL OR exam.value_date < NOW() - INTERVAL '1 year')
```

**Resultado:**
- Lista precisa de usuários que:
  - Usam óculos ✅
  - Têm miopia ✅
  - Precisam de exame ✅
- Clínica pode enviar ofertas personalizadas

### Exemplo 2: Clínica Odontológica

**Query:**
```sql
-- Buscar usuários com facetas que não fizeram consulta há 6+ meses
SELECT DISTINCT
  f.actor_id,
  facetas.value_boolean AS has_facets,
  consulta.value_date AS last_consultation
FROM user_health_facts facetas
INNER JOIN health_taxonomies facetas_tax ON facetas_tax.taxonomy_id = facetas.taxonomy_id
LEFT JOIN user_health_facts consulta ON consulta.actor_id = facetas.actor_id
LEFT JOIN health_taxonomies consulta_tax ON consulta_tax.taxonomy_id = consulta.taxonomy_id
WHERE facetas_tax.slug = 'facetas'
  AND facetas.value_boolean = true
  AND consulta_tax.slug = 'ultima-consulta-odontologica'
  AND (consulta.value_date IS NULL OR consulta.value_date < NOW() - INTERVAL '6 months')
```

**Resultado:**
- Usuários com facetas que precisam de acompanhamento
- Clínica pode oferecer manutenção preventiva

## Benefícios do Sistema Inteligente

### 1. Coleta Estruturada
- ✅ Perguntas guiadas (não texto livre)
- ✅ Seleção múltipla de condições comuns
- ✅ Perguntas condicionais (se usa óculos → pergunta condições)
- ✅ Dados organizados automaticamente

### 2. Matching Preciso
- ✅ Query direta por taxonomia
- ✅ Filtros combinados (usa óculos + miopia + exame vencido)
- ✅ Agregação de dados (quantos usuários têm X)
- ✅ Notificações inteligentes

### 3. Integração com Clínicas
- ✅ Clínicas podem buscar usuários específicos
- ✅ Ofertas personalizadas baseadas em condições
- ✅ Acompanhamento preventivo (exames vencidos)
- ✅ Matching por necessidade de serviço

## Estrutura de Dados

### Taxonomias Criadas (35 total)

**Visão (8):**
- Uso de Óculos
- Uso de Lentes de Contato
- Miopia
- Astigmatismo
- Hipermetropia
- Presbiopia
- Daltonismo
- Grau do Óculos (Miopia)
- Grau do Óculos (Astigmatismo)
- Último Exame de Visão

**Odontologia (8):**
- Uso de Aparelho Ortodôntico
- Facetas
- Implantes Dentários
- Próteses Dentárias
- Gengivite
- Sensibilidade Dentária
- Bruxismo
- Última Consulta Odontológica
- Necessidades Urgentes

**Geral (7):**
- Hipertensão
- Diabetes Tipo 1
- Diabetes Tipo 2
- Asma
- Alergias
- Acompanhamento Médico
- Último Check-up

**Medicamentos (3):**
- Medicamentos Contínuos
- Dosagem de Medicamentos
- Prescrito Por

**Mobilidade (3):**
- Auxiliares de Mobilidade
- Necessidades de Acessibilidade
- Condições de Mobilidade

**Mental (3):**
- Acompanhamento Psicológico
- Condições de Saúde Mental
- Medicamentos Psiquiátricos

## Interface do Usuário

### Fluxo de Coleta

1. **Usuário seleciona seção** (ex: "Visão")
2. **Sistema pergunta:** "Você usa óculos?" → Checkbox
3. **Se SIM:**
   - Mostra seleção múltipla de condições visuais
   - Se seleciona "Miopia" → pergunta grau
   - Pergunta último exame
4. **Dados salvos automaticamente** em `user_health_facts`
5. **Raio-X estruturado** exibido com todos os fatos salvos

### Exemplo Visual

```
┌─────────────────────────────────────┐
│ 1. Você usa óculos?                 │
│ ☑ Sim, uso óculos                   │
│ ☐ Sim, uso lentes de contato        │
└─────────────────────────────────────┘
         ↓ (se marcou óculos)
┌─────────────────────────────────────┐
│ 2. Quais condições visuais você tem?│
│ ☑ Miopia                            │
│ ☐ Astigmatismo                      │
│ ☐ Hipermetropia                     │
│ ☐ Presbiopia                        │
│ ☐ Daltonismo                        │
└─────────────────────────────────────┘
         ↓ (se marcou miopia)
┌─────────────────────────────────────┐
│ 3. Qual o grau do seu óculos?       │
│ [ -2.5 ] [Salvar]                   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ 4. Quando foi seu último exame?     │
│ [2024-01-01] [Salvar]              │
└─────────────────────────────────────┘
```

## Conclusão

O sistema inteligente de coleta de dados de saúde:
- ✅ Elimina texto livre
- ✅ Coleta dados estruturados
- ✅ Permite matching preciso
- ✅ Facilita integração com clínicas
- ✅ Oferece experiência guiada ao usuário

**Dados estruturados = Matching inteligente = Melhor experiência para todos**





