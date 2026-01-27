# 🎭 Perfil de Atuação Cultural (PAC) — Modelo Final

**FASE: Definição Conceitual (Pré-Implementação)**

## 🎯 Objetivo do PAC

Representar **atores culturais** (artista, banda, bar, casa, círculo etc.) **sem criar novos tipos de usuário**, reutilizando tudo que já existe:

* ✅ Ator ativo (Fase 8-9)
* ✅ Impacto (Fase 10)
* ✅ Reputação (Fase 11)
* ✅ Permissões (Fase 11)
* ✅ Validação presencial (Fase 12)
* ✅ Auditoria (Fase 13)

---

## 🧠 Princípios (Imutáveis)

1. **PAC não é identidade jurídica** — é perfil de atuação especializado
2. **PAC pertence a um ator base** (PF ou PJ) — herda tudo do ator
3. **PAC tem tipo cultural** — define comportamento e capacidades
4. **PAC herda impacto, reputação e auditoria** — usa sistema existente
5. **Financeiro pesado só com PJ VERIFIED** — compliance garantido

---

## 🧱 Modelo de Dados — `cultural_profiles`

### Campos Essenciais

```sql
id                      UUID PRIMARY KEY
tenant_id              UUID NOT NULL REFERENCES tenants(tenant_id)
owner_actor_id         VARCHAR(255) NOT NULL  -- ID do ator base (PF ou PJ)
owner_actor_type       VARCHAR(20) NOT NULL    -- 'user' | 'page'
type                    VARCHAR(50) NOT NULL   -- Tipo cultural (enum)
display_name            VARCHAR(255) NOT NULL
slug                    VARCHAR(255) UNIQUE    -- URL-friendly identifier
description             TEXT
linked_company_id       UUID REFERENCES companies(company_id)  -- PJ vinculada (opcional)
location                JSONB                   -- { city, state, address, lat, lng }
active                  BOOLEAN NOT NULL DEFAULT true
created_at              TIMESTAMP WITH TIME ZONE
updated_at              TIMESTAMP WITH TIME ZONE
```

### Tipos Culturais (Enum)

```typescript
type CulturalProfileType =
  | 'ARTIST'           // Artista individual
  | 'BAND'             // Banda / Coletivo musical
  | 'BAR'              // Bar com música ao vivo
  | 'VENUE'            // Casa de eventos / Teatro
  | 'COLLECTIVE'       // Coletivo cultural
  | 'PRODUCER'         // Produtor cultural
  | 'CIRCLE'           // Círculo cultural
  | 'EDUCATOR'         // Educador / Oficineiro
  | 'CURATOR'          // Curador / Programador
```

### Índices

* `(tenant_id, owner_actor_id, owner_actor_type)` — busca por dono
* `(tenant_id, type)` — busca por tipo
* `(tenant_id, linked_company_id)` — busca por empresa vinculada
* `(tenant_id, slug)` — busca por slug (único)
* `(tenant_id, active)` — busca perfis ativos

---

## 🎛️ Comportamento por Tipo (Capacidades)

Cada `type` habilita **capacidades**, não permissões finais (essas vêm da Fase 11 - Reputação).

### Capacidades Base

```typescript
interface CulturalCapabilities {
  can_publish_events: boolean;        // Pode criar eventos
  can_host_events: boolean;           // Pode hospedar eventos de outros
  can_define_revenue_split: boolean;  // Pode definir % de repasse
  can_sell_tickets: boolean;          // Pode vender ingressos (requer PJ VERIFIED)
  requires_location: boolean;         // Exige local físico
  requires_company: boolean;          // Exige PJ vinculada
}
```

### Mapeamento por Tipo

| Tipo | Publicar Eventos | Hospedar | Repasse | Vender | Local | PJ |
|------|------------------|----------|---------|--------|-------|-----|
| **ARTIST** | ✅ | ❌ | ✅ | ✅* | ❌ | Opcional |
| **BAND** | ✅ | ❌ | ✅ | ✅* | ❌ | Opcional |
| **BAR** | ✅ | ✅ | ✅ | ✅* | ✅ | Obrigatório |
| **VENUE** | ✅ | ✅ | ✅ | ✅* | ✅ | Obrigatório |
| **COLLECTIVE** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **PRODUCER** | ✅ | ❌ | ✅ | ✅* | ❌ | Opcional |
| **CIRCLE** | ✅ | ❌ | ✅ | ❌ | Opcional | ❌ |
| **EDUCATOR** | ✅ | ❌ | ✅ | ✅* | ❌ | Opcional |
| **CURATOR** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

*✅* = Requer PJ VERIFIED para operação financeira real

---

## 💰 Regra Financeira (Global)

### Sem PJ VERIFIED

* ✅ Divulgação de eventos
* ✅ Geração de impacto social
* ✅ Construção de reputação
* ✅ Participação em eventos
* ❌ Saque de dinheiro
* ❌ Repasse financeiro direto
* ❌ Venda de ingressos com valor real

### Com PJ VERIFIED

* ✅ Tudo acima +
* ✅ Venda de ingressos
* ✅ Recebimento de repasses
* ✅ Operações financeiras
* ✅ Permissões seguem reputação (Fase 11)

**Regra de ouro:** Financeiro pesado só com PJ VERIFIED + Reputação adequada.

---

## 🧩 Relação com Sistema Existente

### Herança de Ator Base

O PAC **herda** do ator base (PF ou PJ):

* **Impacto**: Impacto gerado pelo PAC conta para o ator base
* **Reputação**: Reputação do ator base afeta permissões do PAC
* **Auditoria**: Eventos do PAC são auditados como eventos do ator base
* **Validação**: Se ator base é PJ PROVISIONAL, PAC também tem limitações

### Identidade Única

* Um ator (PF ou PJ) pode ter **múltiplos PACs**
* Cada PAC tem **slug único** (ex: `@banda-rock`, `@bar-samba`)
* PAC pode ser **vinculado a uma empresa** (para BAR/VENUE)

---

## 🔐 Antifraude (Já Coberto)

O PAC **não cria novas brechas** porque:

* ✅ **Impacto** → vai para ledger (Fase 10)
* ✅ **Permissões** → dependem de reputação (Fase 11)
* ✅ **Existência PJ** → exige validação presencial (Fase 12)
* ✅ **Padrões suspeitos** → geram alertas (Fase 13)

**Tudo que o PAC faz passa pelos mesmos controles.**

---

## 📊 Exemplos de Uso

### Exemplo 1: Artista Individual (PF)

```json
{
  "owner_actor_id": "user-123",
  "owner_actor_type": "user",
  "type": "ARTIST",
  "display_name": "João Silva",
  "slug": "@joao-silva",
  "linked_company_id": null,
  "location": null
}
```

**Comportamento:**
* Pode criar eventos
* Pode definir repasse (artista 70%, local 20%, fundo 10%)
* **Sem PJ**: só impacto, sem saque
* **Com PJ VERIFIED**: pode vender ingressos e receber

---

### Exemplo 2: Bar com Música (PJ)

```json
{
  "owner_actor_id": "page-456",
  "owner_actor_type": "page",
  "type": "BAR",
  "display_name": "Bar do Samba",
  "slug": "@bar-do-samba",
  "linked_company_id": "company-789",
  "location": {
    "city": "Rio de Janeiro",
    "state": "RJ",
    "address": "Rua X, 123",
    "lat": -22.9068,
    "lng": -43.1729
  }
}
```

**Comportamento:**
* Pode hospedar eventos de artistas
* Pode confirmar presença física (validação)
* Pode definir repasse local (15-20% típico)
* **Requer PJ VERIFIED** para operar financeiro

---

### Exemplo 3: Coletivo (PF sem CNPJ)

```json
{
  "owner_actor_id": "user-999",
  "owner_actor_type": "user",
  "type": "COLLECTIVE",
  "display_name": "Coletivo Arte na Rua",
  "slug": "@arte-na-rua",
  "linked_company_id": null,
  "location": null
}
```

**Comportamento:**
* Pode criar eventos
* Gera impacto social
* Constrói reputação
* **Não pode** vender ingressos ou sacar (sem PJ)

---

## ✅ Decisões Encerradas (PAC)

* ❌ **Não é novo usuário** — é perfil de atuação
* ❌ **Não exige CNPJ para existir** — inclusão cultural
* ❌ **Não saca sem PJ VERIFIED** — compliance
* ❌ **Não cria novas brechas** — usa sistema existente
* ✅ **Usa tudo que já existe** — impacto, reputação, auditoria

---

## 🔜 Próximo Passo

**Passo 2:** Desenhar o **fluxo de evento cultural**

> artista/banda ↔ bar/casa ↔ região ↔ repasse percentual ↔ ledger

---

## 📌 Notas de Implementação Futura

### Quando implementar:

1. Criar migration `083_cultural_profiles.sql`
2. Criar serviço `cultural-profile.service.ts`
3. Criar rotas `/cultural-profiles/*`
4. Integrar com sistema de eventos (próximo passo)
5. Frontend: criar/editar PACs em "Minhas Empresas" ou novo menu

### Validações necessárias:

* Slug único por tenant
* Tipo válido (enum)
* Se `requires_company = true`, validar `linked_company_id` existe e é VERIFIED
* Se `requires_location = true`, validar `location` preenchido

---

**Status:** ✅ Modelo conceitual fechado e aprovado
**Próximo:** Passo 2 — Fluxo de Evento Cultural


























