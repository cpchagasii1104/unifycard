# 🎶 Passo 2 — Fluxo de Evento Cultural (Contrato Conceitual)

**FASE: Definição Conceitual (Pré-Implementação)**

## 🎯 Objetivo

Descrever **o ciclo completo de um evento cultural**, cobrindo:

* ✅ Quem cria
* ✅ Quem participa
* ✅ Quem hospeda
* ✅ Como o dinheiro/impacto é dividido
* ✅ Como tudo entra no ledger
* ✅ Como a auditoria observa

**Sem exceções. Sem atalhos.**

---

## 🧠 Visão Geral do Fluxo

```
PAC (ARTISTA / BANDA)
        ↓ cria
EVENTO CULTURAL
        ↓ vincula
PAC (BAR / VENUE / CIRCLE)
        ↓ publica
DIVULGAÇÃO / INGRESSO
        ↓ gera
IMPACTO + (FINANCEIRO SE HABILITADO)
        ↓ registra
LEDGER + AUDITORIA
```

---

## 🧩 Entidades Envolvidas

### 1️⃣ Criador do Evento

**Sempre um PAC** com tipo:
* `ARTIST` (artista individual)
* `BAND` (banda/coletivo musical)
* `PRODUCER` (produtor cultural)
* `COLLECTIVE` (coletivo cultural)

**Requisitos:**
* ✅ PAC ativo
* ✅ Permissão `can_publish_events` (vem do tipo)
* ✅ Reputação mínima (definida depois, mas já prevista na Fase 11)

**Regra:** Um evento pode ter **múltiplos criadores** (ex: banda + produtor), mas sempre há um **criador principal**.

---

### 2️⃣ Evento Cultural

Evento é uma **entidade própria**, não um post comum.

**Campos conceituais principais:**

```typescript
interface CulturalEvent {
  id: string;
  tenant_id: string;
  created_by_pac_id: string;           // PAC criador principal
  co_creators_pac_ids?: string[];      // Outros PACs co-criadores (opcional)
  event_type: EventType;               // SHOW, OFICINA, FESTIVAL, RODA, AULA
  title: string;
  description: string;
  datetime_start: string;              // ISO 8601
  datetime_end: string;                // ISO 8601
  location_pac_id?: string;            // PAC local (BAR/VENUE/CIRCLE) - opcional no início
  status: EventStatus;                  // DRAFT → PUBLISHED → CONFIRMED → COMPLETED → CANCELLED
  revenue_split: RevenueSplit;         // Percentual de repasse
  visibility: 'PUBLIC' | 'LOCAL' | 'PRIVATE';
  ticket_price?: number;                // Em centavos (opcional, só se PJ VERIFIED)
  max_attendees?: number;               // Limite de público (opcional)
  created_at: string;
  updated_at: string;
  completed_at?: string;                // Quando evento foi marcado como COMPLETED
}
```

**Tipos de Evento:**

```typescript
type EventType =
  | 'SHOW'        // Show / Apresentação
  | 'OFICINA'     // Oficina / Workshop
  | 'FESTIVAL'    // Festival / Evento múltiplo
  | 'RODA'        // Roda de samba / Jam session
  | 'AULA'        // Aula / Curso
  | 'EXPOSICAO'   // Exposição / Mostra
  | 'DEBATE'      // Debate / Mesa redonda
  | 'INTERVENCAO' // Intervenção urbana
```

**Estados do Evento:**

```typescript
type EventStatus =
  | 'DRAFT'       // Rascunho (não público)
  | 'PUBLISHED'   // Publicado (visível)
  | 'CONFIRMED'   // Local confirmou (território ativo)
  | 'COMPLETED'   // Evento aconteceu
  | 'CANCELLED'   // Cancelado
  | 'ARCHIVED'    // Arquivado (após ledger fechado)
```

---

### 3️⃣ Local / Hospedagem

**PAC do tipo:**
* `BAR` (bar com música)
* `VENUE` (casa de eventos / teatro)
* `CIRCLE` (círculo cultural)
* `COLLECTIVE` (coletivo com espaço)

**Funções:**
* ✅ Confirmar que o evento ocorre ali
* ✅ Vincular **território real** (localização física)
* ✅ Ativar impacto regional
* ✅ Receber percentual de repasse (se definido)

**Regra crítica:**
> ⚠️ Evento **não é CONFIRMED** sem local confirmar.

**Fluxo de confirmação:**
1. Criador cria evento e **sugere** um local (opcional)
2. Local recebe notificação (se PAC vinculado)
3. Local **confirma** ou **rejeita**
4. Se confirmado → status muda para `CONFIRMED`
5. Se rejeitado → evento volta para `PUBLISHED` (sem local)

---

## 💰 Repasse Percentual (Fechado)

Cada evento define um **split fixo**, público e imutável após publicação.

### Estrutura

```typescript
interface RevenueSplit {
  artist_percent: number;      // % para artista/banda criador
  location_percent: number;    // % para local (bar/casa)
  regional_fund_percent: number;  // % para fundo cultural regional
  user_region_percent: number;    // % para região do usuário que interage
  // Soma deve ser = 100
}
```

### Exemplo Prático

**Show de Banda em Bar:**

```json
{
  "artist_percent": 60,
  "location_percent": 20,
  "regional_fund_percent": 10,
  "user_region_percent": 10
}
```

**Oficina Coletiva (sem local):**

```json
{
  "artist_percent": 70,
  "location_percent": 0,
  "regional_fund_percent": 20,
  "user_region_percent": 10
}
```

### Regras

* ✅ **Soma = 100%** (validação obrigatória)
* ✅ **Alteração só enquanto DRAFT** (após PUBLISHED, imutável)
* ✅ **Fica visível no evento** (transparência total)
* ✅ **Entra no ledger como contrato social** (auditável)

---

## 📍 Impacto Regional (Chave do Diferencial)

Quando um usuário interage com o evento (ingresso, apoio, presença):

### Fluxo de Impacto Regional

1. **Sistema identifica:**
   * Localização do usuário (cidade/estado)
   * Região vinculada ao evento (via local ou criador)
   * Percentual regional definido no split

2. **Geração de impacto:**
   * Impacto é gerado para a **região** (não só para o criador)
   * Entra no ledger regional (novo conceito, mas usa mesma estrutura)
   * Reputação do PAC criador sobe proporcionalmente

3. **Exemplo:**
   * Usuário de São Paulo compra ingresso de show no Rio
   * 10% do impacto vai para "Região Sudeste" (ou mais específico)
   * 60% vai para artista
   * 20% vai para local
   * 10% vai para fundo cultural

👉 **Cultura vira redistribuição automática**, não discurso.

---

## 📊 Ledger (Impacto + Financeiro)

### Para cada evento COMPLETED:

O sistema gera eventos no ledger:

#### Tipos de Evento no Ledger

```typescript
type CulturalEventLedgerType =
  | 'EVENT_CREATED'              // Evento criado (+1 impacto para criador)
  | 'EVENT_PUBLISHED'            // Evento publicado (+2 impacto)
  | 'EVENT_CONFIRMED'            // Local confirmou (+1 impacto para local)
  | 'EVENT_ATTENDED'             // Usuário participou (+1 impacto)
  | 'TICKET_PURCHASED'           // Ingresso comprado (+3 impacto + financeiro)
  | 'EVENT_REVENUE_SPLIT_APPLIED' // Repasse aplicado (financeiro)
  | 'REGIONAL_IMPACT_ALLOCATED'  // Impacto regional distribuído
  | 'EVENT_COMPLETED'            // Evento finalizado (+5 impacto para criador)
```

### Estrutura de Cada Entrada

```typescript
interface CulturalEventLedgerEntry {
  id: string;
  tenant_id: string;
  event_id: string;                    // ID do evento cultural
  ledger_type: CulturalEventLedgerType;
  actor_id: string;                    // Quem recebe (PAC ou região)
  actor_type: 'pac' | 'region';
  impact_delta: number;                // Impacto gerado
  financial_delta_cents?: number;      // Valor financeiro (se aplicável)
  revenue_split_applied?: RevenueSplit; // Split usado neste evento
  source_type: 'cultural_event';
  source_id: string;                   // event_id
  metadata: {
    event_type: EventType;
    location_pac_id?: string;
    user_region?: string;
    ticket_count?: number;
  };
  created_at: string;
}
```

### Exemplo de Fluxo Completo

**Evento: Show de Banda no Bar**

1. **EVENT_CREATED** → +1 impacto para banda
2. **EVENT_PUBLISHED** → +2 impacto para banda
3. **EVENT_CONFIRMED** → +1 impacto para bar (local)
4. **TICKET_PURCHASED** (10 ingressos) → 
   * +3 impacto para banda (por ingresso)
   * +30 impacto total
   * Financeiro: R$ 500,00 → split aplicado
5. **EVENT_REVENUE_SPLIT_APPLIED** →
   * Banda: R$ 300,00 (60%)
   * Bar: R$ 100,00 (20%)
   * Fundo: R$ 50,00 (10%)
   * Região: R$ 50,00 (10%)
6. **REGIONAL_IMPACT_ALLOCATED** →
   * +5 impacto para região (10% de 50 ingressos)
7. **EVENT_COMPLETED** → +5 impacto para banda

**Total de impacto para banda:** 1 + 2 + 30 + 5 = **38 pontos**

**Nada agregado sem rastro.**

---

## 🔐 CNPJ e Financeiro (Reaplicando a Regra)

### Se o PAC **não tem PJ VERIFIED**:

**Permitido:**
* ✅ Evento pode existir
* ✅ Divulgação pública
* ✅ Impacto é registrado
* ✅ Reputação é construída

**Bloqueado:**
* ❌ Venda de ingressos com valor real
* ❌ Saque de dinheiro
* ❌ Repasse financeiro direto

**O que acontece com o financeiro:**
* Fica em **escrow** (conta bloqueada)
* Ou é **redirecionado a fundo cultural**
* Usuário vê: "Ingresso gratuito" ou "Contribuição voluntária"

### Se PAC tem PJ VERIFIED:

**Permitido:**
* ✅ Tudo acima +
* ✅ Venda de ingressos
* ✅ Recebimento de repasses
* ✅ Operações financeiras completas
* ✅ Saque (se reputação adequada)

**Auditoria:**
* Observa picos e padrões (Fase 13)
* Alertas se comportamento suspeito

---

## 🚨 Antifraude (Já Coberto pela Fase 13)

O fluxo já nasce protegido:

### Alertas Automáticos

* **Eventos repetitivos suspeitos** → alerta LOW/MEDIUM
  * Ex: mesmo criador, mesmo local, múltiplos eventos em curto período
* **Impacto alto sem público** → alerta MEDIUM
  * Ex: evento com 1000+ impacto mas 0 ingressos vendidos
* **Funcionário validando local suspeito** → alerta HIGH
  * Ex: funcionário valida local que não existe fisicamente
* **Repasse estranho** → alerta MEDIUM
  * Ex: split que não soma 100%, ou valores negativos

**Regra:**
> Nada trava automaticamente, mas **tudo é visível**.

---

## 🧱 Estados do Evento (Detalhado)

### Fluxo Normal

```
DRAFT
  ↓ (criador publica)
PUBLISHED
  ↓ (local confirma - opcional)
CONFIRMED
  ↓ (evento acontece)
COMPLETED
  ↓ (ledger fechado)
ARCHIVED
```

### Fluxo com Cancelamento

```
PUBLISHED / CONFIRMED
  ↓ (criador cancela)
CANCELLED
  ↓ (ledger negativo? - fora de escopo por enquanto)
ARCHIVED
```

### Regras de Transição

* **DRAFT → PUBLISHED**: Criador pode publicar
* **PUBLISHED → CONFIRMED**: Local confirma (opcional, mas recomendado)
* **CONFIRMED → COMPLETED**: Criador marca como completo (após data/hora)
* **COMPLETED → ARCHIVED**: Sistema arquiva automaticamente após 30 dias
* **Qualquer → CANCELLED**: Criador pode cancelar (notifica participantes)

**Nota sobre CANCELLED:**
> CANCELLED gera ledger negativo de reputação?
> 👉 **Não agora** (fora de escopo). Só registra o cancelamento.

---

## 🔄 Interações com Evento

### Tipos de Interação

```typescript
type EventInteraction =
  | 'INTERESTED'      // Interessado (curtir/salvar)
  | 'ATTENDING'       // Vai participar (confirmado)
  | 'TICKET_PURCHASED' // Comprou ingresso (se habilitado)
  | 'SUPPORTED'       // Apoiou (sem ingresso, mas com impacto)
```

### Impacto por Interação

* **INTERESTED**: +0 impacto (apenas sinalização)
* **ATTENDING**: +1 impacto (presença confirmada)
* **TICKET_PURCHASED**: +3 impacto + financeiro (se habilitado)
* **SUPPORTED**: +2 impacto (apoio sem ingresso)

---

## 📍 Impacto Regional (Detalhado)

### Como Funciona

1. **Identificação de Região:**
   * Sistema identifica região do usuário (cidade/estado)
   * Sistema identifica região do evento (via local ou criador)

2. **Cálculo de Impacto Regional:**
   * Percentual definido no `revenue_split.user_region_percent`
   * Impacto é distribuído para a região
   * Exemplo: 10 ingressos × 3 impacto = 30 impacto total
   * 10% regional = 3 impacto para região

3. **Ledger Regional:**
   * Novo conceito: `regional_impact_ledger`
   * Ou usar `impact_ledger` com `actor_type = 'region'`
   * Região tem "saldo de impacto" agregado

4. **Uso do Impacto Regional:**
   * Pode ser usado para:
     * Fundo cultural regional
     * Projetos locais
     * Redistribuição automática
   * (Implementação futura)

---

## ✅ Decisões Encerradas — Passo 2

* ✅ **Evento não é só post** — é entidade própria
* ✅ **Local confirma território** — validação presencial (Fase 12)
* ✅ **Split é público e imutável** — transparência total
* ✅ **Ledger é obrigatório** — nada sem rastro
* ✅ **Impacto regional é automático** — redistribuição justa
* ✅ **Financeiro só com PJ VERIFIED** — compliance garantido
* ✅ **Antifraude já coberto** — Fase 13 observa tudo

---

## 📌 Onde Estamos

* ✅ **Passo 1:** Modelo do PAC — fechado
* ✅ **Passo 2:** Fluxo de Evento Cultural — fechado
* ⏳ **Passo 3:** PROMPT DEFINITIVO — Cultura & Eventos — aguardando

---

## 🔜 Próximo Passo

Quando você disser **"segue passo 3"**, será entregue:

* O **PROMPT DEFINITIVO** para o Cursor
* Na ordem correta:
  * Tabelas (cultural_profiles, cultural_events, event_interactions, regional_impact)
  * Serviços (cultural-profile.service, cultural-event.service)
  * Endpoints (CRUD de PACs, CRUD de eventos, interações)
  * Integrações com impacto, reputação e auditoria
* Sem refatorar nada existente

**Tudo pronto para virar código.**

---

**Status:** ✅ Fluxo conceitual fechado e aprovado
**Próximo:** Passo 3 — PROMPT DEFINITIVO para implementação













