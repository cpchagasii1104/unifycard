# EventSpec - Especificação Declarativa de Evento

**Status:** ATIVO  
**Versão:** v1.0  
**Data:** 17/01/2026  
**Escopo:** Domínio EVENTS - Subfluxo Festa de Aniversário

---

## 1. Princípio Fundamental

> **EventSpec NÃO decide nada. É apenas especificação declarada pelo usuário.**

O EventSpec é um **snapshot imutável versionado** que armazena as respostas do usuário a um questionário declarativo. Ele:

- ✅ **Coleta** informações passo a passo
- ✅ **Armazena** respostas de forma auditável
- ✅ **Versiona** especificações para rastreabilidade
- ❌ **NÃO busca** fornecedores
- ❌ **NÃO ranqueia** nada
- ❌ **NÃO decide** nada
- ❌ **NÃO usa** categorias em lógica de decisão

---

## 2. Arquitetura

### 2.1 Questionário Declarativo (DSL)

O questionário é definido em formato JSON (DSL - Domain Specific Language):

- **Localização:** `backend/src/core/events/specs/birthday-questionnaire.dsl.json`
- **Estrutura:**
  - `version`: Versão do DSL
  - `macro_intention`: Intenção macro (ex: "celebrate")
  - `subflow`: Subfluxo específico (ex: "birthday_party")
  - `steps`: Array de steps com perguntas
  - `rules`: Regras institucionais (no_ranking, no_scoring, etc.)

### 2.2 EventSpec

Estrutura imutável que armazena:

- **Identificação:** `spec_id`, `tenant_id`, `actor_id`, `actor_type`
- **Versão:** `spec_version` (atualmente v1)
- **Tipo:** `macro_intention`, `subflow`
- **Respostas:** `answers` (JSONB flexível por `question_id`)
- **Metadados:** `metadata` (questionnaire_version, completed_steps, etc.)
- **Auditoria:** `created_at`, `created_by`

### 2.3 Persistência

- **Tabela:** `event_specs` (Migration 157)
- **Características:**
  - Imutável (append-only)
  - Versionado (`spec_version`)
  - Indexado para consultas eficientes
  - JSONB para flexibilidade em `answers` e `metadata`

---

## 3. Fluxo de Perguntas (Festa de Aniversário)

### STEP 1 — Contexto Básico
- Data do evento (data ou janela)
- Cidade / Região
- Número estimado de pessoas (faixa)
- Já possui local? (sim/não)

### STEP 2 — Tipo de Aniversário (DESCRITIVO)
- Infantil
- 15 anos
- Adulto

⚠️ **Isso é categoria DESCRITIVA apenas. NÃO usado para decisão de negócio.**

### STEP 3 — Ramificação por Subtipo

**Se infantil:**
- Faixa etária da criança
- Temas desejados (lista aberta)
- Serviços desejados (ex: animação, decoração)

**Se 15 anos:**
- Estilo desejado (ex: tradicional, moderno)
- Temas desejados
- Serviços desejados (DJ, decoração, buffet)

**Se adulto:**
- Estilo do evento (ex: churrasco, jantar, festa)
- Serviços desejados
- Tipo de alimentação desejada

### STEP 4 — Infraestrutura
- Se não possui local:
  - Tipo de local desejado (ex: salão, chácara)
  - Raio de distância
- Serviços de apoio:
  - Segurança
  - Limpeza
  - Recepção
  - Som/Iluminação

### STEP 5 — Economia (DECLARATIVO)
- Faixa de orçamento (min/max)
- Prioridade declarada:
  - Economizar
  - Equilibrar
  - Caprichar

⚠️ **Informações DECLARATIVAS apenas. NÃO usado para ranking ou decisão automática.**

---

## 4. Regras Institucionais (HARD)

### 4.1 Proibições Absolutas

É **TERMINANTEMENTE PROIBIDO**:

- ❌ Ranking automático
- ❌ Score implícito
- ❌ "Fornecedor recomendado"
- ❌ Ordenação sem critério explícito
- ❌ Inferir preferências de eventos anteriores
- ❌ Criar categorias que descrevam pessoas
- ❌ Usar categorias em lógica de decisão

### 4.2 Uso Permitido de Categorias

Categorias **só podem**:
- ✅ Agrupar perguntas
- ✅ Organizar leitura
- ✅ Descrever o evento (descritivo apenas)

### 4.3 EventSpec é Imutável

- EventSpec **não pode ser atualizado** depois de criado
- Se precisar "atualizar", criar novo spec com nova versão
- EventSpec é **append-only** para auditoria completa

---

## 5. Uso do EventSpec

### 5.1 Criar EventSpec

```typescript
import { eventSpecService } from '@core/events/specs/event-spec.service';

const spec = await eventSpecService.createEventSpec(
  tenantId,
  userId,
  {
    tenant_id: tenantId,
    actor_id: actorId,
    actor_type: 'user',
    macro_intention: 'celebrate',
    subflow: 'birthday_party',
    answers: {
      event_date: '2026-02-15',
      city_region: 'São Paulo',
      estimated_attendance: '51-100',
      has_venue: 'yes',
      birthday_category: 'adulto',
      // ... outras respostas
    },
  }
);
```

### 5.2 Buscar EventSpec

```typescript
// Por ID
const spec = await eventSpecService.getEventSpecById(tenantId, specId);

// Por query
const specs = await eventSpecService.queryEventSpecs(tenantId, {
  actor_id: actorId,
  macro_intention: 'celebrate',
  subflow: 'birthday_party',
});
```

### 5.3 Associar a Evento

```typescript
// Após criar o evento, associar o spec
const spec = await eventSpecService.associateEventToSpec(
  tenantId,
  specId,
  eventId
);
```

---

## 6. Critério de Sucesso

Se o usuário completar o fluxo, o sistema deve ter:

- ✅ EventSpec completo
- ✅ Auditável (timestamp, user_id, version)
- ✅ Versionado (`spec_version = 1`)
- ✅ Sem nenhuma decisão implícita
- ✅ Sem ranking ou score
- ✅ Apenas especificação declarada pelo usuário

---

## 7. Próximos Passos (NÃO nesta etapa)

**NÃO implementar nesta etapa:**
- ❌ Busca de fornecedores
- ❌ RFP (Request for Proposal)
- ❌ Ranking
- ❌ Analytics
- ❌ Recomendações automáticas

**Esta etapa é APENAS coleta declarativa.**

---

## 8. Referências

- **Contrato de Eventos:** `docs/contracts/CONTRATO_EVENTOS_V1.md`
- **Migration:** `backend/migrations/157_create_event_specs.sql`
- **Tipos:** `backend/src/core/events/specs/event-spec.types.ts`
- **Service:** `backend/src/core/events/specs/event-spec.service.ts`
- **DSL:** `backend/src/core/events/specs/birthday-questionnaire.dsl.json`

---

**Última atualização:** 17/01/2026



