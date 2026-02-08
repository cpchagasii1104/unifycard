# 📜 CONTRATO DE EVENTOS v1.2 — UNIFICARD

**Status:** ATIVO  
**Versão:** v1.2  
**Data:** 28/12/2025  
**Escopo:** Backend, Frontend, Feed, Economia, IA, Escrow, Penalidades  
**Caráter:** NORMATIVO (quebrar este contrato é bug arquitetural)

---

## 0. Princípio Fundamental

> **"No UnifiCard, eventos são operações auditáveis, justas e automáticas. O sistema cobra, bloqueia, executa, avalia, registra e distribui. O humano só participa e entrega."**

### 0.1 Regra-Mãe (INEGOCIÁVEL)

```
NENHUM organizador controla manualmente pagamentos.
TODO repasse financeiro é feito AUTOMATICAMENTE pelo sistema.
```

Isso vale para: Banda, Fornecedores, Limpeza, Segurança, Local, Produtor, Grupo, Comunidade, Plataforma.

**O humano NUNCA executa repasse.**

---

## 1. Definições Canônicas

### 1.1 Actor

Entidade que inicia uma ação no sistema.

Tipos:
* `user` → pessoa física
* `page` → empresa, organização, igreja, clube, banda, etc.
* `group` → comunidade, interesse comum, agregador de pessoas

**Regra absoluta:**
> Nenhum evento existe sem um Actor.

### 1.2 Diferença Page × Group

| Aspecto | Page | Group |
|---------|------|-------|
| **Natureza** | Entidade que produz/vende | Pessoas com interesse comum |
| **Economia** | Recebe como organizador (70%) | Fundo interno (escrow) |
| **Criação de evento** | ✅ Todos os tipos | ⚠️ Apenas comunitários |
| **CNPJ potencial** | Sim | Não |
| **Saque direto** | ✅ Após evento | ❌ Via votação |

### 1.3 Evento

Evento é uma **operação estruturada** com:
* Início e fim definidos
* Participantes cadastrados
* Economia rastreável
* Consequências automáticas

Evento **não é post social**. É **central de gerenciamento**.

### 1.4 Entidades de Evento

Durante a criação, o organizador cadastra:

| Entidade | Campos obrigatórios |
|----------|---------------------|
| Artista/Banda | Quantidade, valor acordado, regra de check-in |
| Fornecedor | Tipo, valor, critério de entrega |
| Segurança | Quantidade, valor por pessoa |
| Limpeza | Valor fixo ou variável |
| Staff | Quantidade, função, valor |
| Local/Venue | Percentual ou valor fixo |

Tudo **registrado antes do evento**, **auditável**, **executado automaticamente**.

---

## 2. Modelo Arquitetural de Eventos

### 2.1 Tabela Canônica

> **Todos os eventos do sistema DEVEM existir na tabela `events`.**

### 2.2 Discriminador Central: `event_type`

```text
cultural | gastronomic | social | professional | community | spiritual | sports | private
```

### 2.3 Modelo de Vínculos

```
Evento
├── organizador (actor) ────────── 1:1 OBRIGATÓRIO
├── entidade_vinculada (page) ──── 0:1 OPCIONAL
├── grupos_associados (group[]) ── 0:N OPCIONAL
├── participantes (actor[]) ────── 0:N COM CONTRATO
│   └── Cada um com: valor, regra de check-in, critério de liberação
└── prestadores (service_provider[]) ── 0:N COM CONTRATO
```

---

## 3. Taxonomia Oficial de `event_type`

```text
cultural | gastronomic | social | professional | community | spiritual | sports | private
```

---

## 4. Matriz Actor × EventType (v1.2)

| Event Type    | User | Page | Group |
| ------------- | ---- | ---- | ----- |
| cultural      | ✅    | ✅    | ❌     |
| gastronomic   | ⚠️    | ✅    | ❌     |
| social        | ✅    | ❌    | ✅     |
| professional  | ✅    | ✅    | ❌     |
| community     | ✅    | ✅    | ✅     |
| spiritual     | ✅    | ✅    | ✅     |
| sports        | ✅    | ✅    | ✅     |
| private       | ✅    | ❌    | ❌     |

### 4.1 Restrições para Group

```typescript
if (organizer.type === 'group') {
  assert(event_type in ['community', 'social', 'spiritual', 'sports']);
  assert(ticket_price_cents <= 5000); // R$50
  assert(max_active_events <= 2);
}
```

---

## 5. ECONOMIA DE EVENTOS (REVISÃO COMPLETA v1.2)

### 5.1 Regra-Mãe: ESCROW OBRIGATÓRIO

```
TODO dinheiro de evento pago entra em FUNDO BLOQUEADO (escrow).
NINGUÉM pode sacar NADA antes do evento acontecer.
```

### 5.2 Ciclo de Vida Financeiro

```
┌─────────────────────────────────────────────────────────────┐
│                    CICLO FINANCEIRO                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  COMPRA ──► ESCROW ──► EVENTO ──► VALIDAÇÃO ──► SPLIT      │
│     │          │          │           │            │        │
│  Registra   Bloqueia   Acontece   Check-ins    Distribui   │
│  no ledger  o valor    no mundo   validados    automático  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Status Financeiro do Evento

| Status | Saldo | Ação permitida |
|--------|-------|----------------|
| `DRAFT` | Nenhum | - |
| `PUBLISHED` | Acumulando em escrow | Compras entram |
| `PRE_EVENT` | Bloqueado | Nenhum saque |
| `DURING` | Bloqueado | Nenhum saque |
| `POST_EVENT` | Em liberação | Split automático |
| `COMPLETED` | Zerado | Tudo distribuído |
| `CANCELLED` | Reembolso | Devolver compradores |

### 5.4 Split NÃO É Instantâneo

**Regra definitiva:**

```
O split NÃO acontece no momento da compra.
O split acontece APÓS o evento, baseado em:
  - Check-ins realizados
  - Presenças confirmadas
  - Entregas validadas
```

### 5.5 Check-in É o Gatilho de Pagamento

**Regra absoluta:**

```
SEM CHECK-IN = SEM PAGAMENTO
```

| Situação | Resultado |
|----------|-----------|
| Prestador não fez check-in | ❌ Não recebe |
| Banda não compareceu | ❌ Não recebe |
| Check-in parcial (3 de 5 músicos) | 💰 Recebe 60% |
| Evento cancelado pelo organizador | 🔁 Regras de cancelamento |
| Evento cancelado por força maior | 🔁 Reembolso parcial |

### 5.6 Fórmula de Split Pós-Evento

```typescript
async function executePostEventSplit(eventId: string) {
  const event = await getEvent(eventId);
  const escrowBalance = await getEscrowBalance(eventId);
  
  // 1. Validar check-ins
  const participants = await getEventParticipants(eventId);
  const validatedParticipants = participants.filter(p => p.checkedIn);
  
  // 2. Calcular splits baseado em presença
  for (const participant of validatedParticipants) {
    const checkInRate = participant.checkedInCount / participant.expectedCount;
    const adjustedAmount = participant.agreedAmount * checkInRate;
    
    await createSplitTransaction({
      eventId,
      recipientId: participant.actorId,
      amount: adjustedAmount,
      reason: 'POST_EVENT_SPLIT',
      checkInRate,
    });
  }
  
  // 3. Distribuir restante conforme regra padrão
  // 70% organizador | 15% cidade | 10% região | 5% grupos
}
```

### 5.7 Se Page For Deletada com Evento Ativo

```typescript
async function handlePageDeletion(pageId: string) {
  // 1. Cancelar eventos futuros
  await db.query(`
    UPDATE events 
    SET status = 'CANCELLED',
        cancelled_reason = 'page_deleted',
        cancelled_at = now()
    WHERE actor_id = $1 AND start_time > now()
  `, [pageId]);
  
  // 2. Notificar compradores
  const buyers = await getEventBuyers(pageId);
  for (const buyer of buyers) {
    await sendNotification(buyer, 'EVENT_CANCELLED_PAGE_DELETED');
  }
  
  // 3. Reembolsar do FUNDO DO EVENTO (não da plataforma)
  for (const buyer of buyers) {
    await refundFromEventEscrow(buyer.ticketId);
  }
  
  // 4. Se fundo insuficiente → page fica com saldo negativo PERMANENTE
  const deficit = await calculateDeficit(pageId);
  if (deficit > 0) {
    await blockPagePermanently(pageId, deficit);
  }
}
```

### 5.8 Economia de Group

| Situação | Regra |
|----------|-------|
| Group cria evento gratuito | ✅ Permitido |
| Group cria evento até R$50 | ✅ Vai para fundo interno |
| Group recebe 70% | ❌ NUNCA (vai para fundo) |
| Saque do fundo | Via votação de admins |
| CNPJ disfarçado | Sistema detecta e bloqueia |

---

## 6. SISTEMA DE PENALIDADES (NOVO v1.2)

### 6.1 Princípio

```
Falta de compromisso ou responsabilidade 
DESTRÓI a credibilidade do sistema.
Penalidades existem para PROTEGER quem cumpre.
```

### 6.2 Tabela de Penalidades por Ator

#### Para ORGANIZADORES (user/page)

| Infração | Penalidade | Duração |
|----------|------------|---------|
| Evento cancelado <24h antes | -20 score + multa 10% do escrow | Permanente no histórico |
| Evento cancelado <7 dias | -10 score | 6 meses |
| >30% de reclamações em evento | -15 score + revisão obrigatória | Até resolver |
| 3 eventos com <20% check-in | Suspensão de criação | 30 dias |
| Informações falsas no evento | -50 score + ban temporário | 90 dias |
| Fraude comprovada | Ban permanente + saldo negativo | Permanente |

#### Para PRESTADORES (banda, fornecedor, staff)

| Infração | Penalidade | Duração |
|----------|------------|---------|
| Não comparecer sem aviso | -30 score + 0% pagamento | Permanente no histórico |
| Aviso <24h de não comparecimento | -15 score + 50% pagamento | 6 meses |
| Check-in parcial (<50%) | -10 score + pagamento proporcional | 3 meses |
| 3 faltas em 90 dias | Suspensão de convites | 60 dias |
| Entrega inferior ao acordado | -20 score + pagamento parcial | 6 meses |

#### Para COMPRADORES

| Infração | Penalidade | Duração |
|----------|------------|---------|
| No-show (comprou e não foi) | -5 score | 3 meses |
| 3 no-shows em 90 dias | Restrição de compra antecipada | 30 dias |
| Chargeback fraudulento | Ban permanente | Permanente |
| Comportamento reportado | Revisão + possível suspensão | Caso a caso |

#### Para GROUPS

| Infração | Penalidade | Duração |
|----------|------------|---------|
| Evento com <10% de presença | -20 score do grupo | 6 meses |
| Tentativa de operar como empresa | Conversão forçada para Page ou ban | Imediato |
| Admin abandonou sem substituto | Grupo congelado | Até novo admin |
| Fundo usado indevidamente | Auditoria + possível dissolução | Caso a caso |

### 6.3 Escala de Score e Consequências

```
SCORE 100-80: 🟢 EXCELENTE
  - Prioridade no feed
  - Limites expandidos
  - Badge de confiança

SCORE 79-60: 🟡 BOM
  - Operação normal
  - Sem restrições

SCORE 59-40: 🟠 ATENÇÃO
  - Avisos periódicos
  - Limites reduzidos (50%)
  - Revisão de novos eventos

SCORE 39-20: 🔴 CRÍTICO
  - Suspensão de criação de eventos
  - Só pode participar, não organizar
  - Pagamentos atrasados (7 dias)

SCORE <20: ⛔ BLOQUEADO
  - Conta suspensa
  - Saldo congelado
  - Requer apelação manual
```

### 6.4 Recuperação de Score

| Ação positiva | Pontos recuperados |
|---------------|-------------------|
| Evento com >80% check-in | +5 |
| Zero reclamações em evento | +3 |
| Prestador com entrega 100% | +5 |
| 30 dias sem infração | +2 |
| Resolução de disputa amigável | +5 |

### 6.5 Regras de Multa Financeira

```typescript
const PENALTY_RATES = {
  // Cancelamento pelo organizador
  CANCEL_LESS_THAN_24H: 0.10,    // 10% do escrow vai para compradores
  CANCEL_LESS_THAN_7D: 0.05,     // 5% do escrow
  CANCEL_LESS_THAN_30D: 0.02,   // 2% do escrow
  
  // No-show de prestador
  PROVIDER_NO_SHOW: 1.0,         // 100% do valor acordado não é pago
  PROVIDER_PARTIAL: 0.5,         // 50% se aviso tardio
  
  // Fraude
  FRAUD_PENALTY: 2.0,            // 200% do valor (se tiver saldo)
};
```

### 6.6 Proteção Anti-Gaming

```typescript
// Detectar tentativas de burlar o sistema
const GAMING_DETECTION = {
  // Criar conta nova para escapar de score baixo
  newAccountAfterBan: 'BLOCK_BY_DEVICE_AND_CPF',
  
  // Cancelar e recriar para resetar
  recreateAfterCancel: 'INHERIT_PREVIOUS_PENALTIES',
  
  // Múltiplas contas
  multipleAccounts: 'MERGE_SCORES_KEEP_LOWEST',
  
  // Check-in falso
  fakeCheckIn: 'GEO_VALIDATION_REQUIRED',
};
```

---

## 7. Avaliação Automática (NOVO v1.2)

### 7.1 Princípio

```
Avaliação é FACTUAL, não OPINATIVA.
Baseada em dados do sistema, não em reviews subjetivos.
```

### 7.2 Métricas Automáticas

```typescript
interface AutomaticEvaluation {
  // Para Organizadores
  checkInRate: number;           // % de compradores que fizeram check-in
  complaintRate: number;         // % de reclamações
  cancellationRate: number;      // % de eventos cancelados
  onTimeStart: boolean;          // Evento começou no horário?
  
  // Para Prestadores
  showed: boolean;               // Compareceu?
  checkInTime: Date;             // Horário do check-in
  deliveryQuality: 'full' | 'partial' | 'none';
  
  // Para Compradores
  attended: boolean;             // Foi ao evento?
  behaviorReports: number;       // Reclamações contra
}

// Score calculado automaticamente
function calculateScore(actor: Actor, evaluations: AutomaticEvaluation[]): number {
  let score = actor.baseScore;
  
  for (const eval of evaluations) {
    if (!eval.showed) score -= 30;
    if (eval.checkInRate < 0.5) score -= 10;
    if (eval.complaintRate > 0.3) score -= 15;
    if (eval.deliveryQuality === 'none') score -= 20;
    if (eval.deliveryQuality === 'full') score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}
```

### 7.3 Impacto do Score

| Área | Como score afeta |
|------|------------------|
| **Feed** | Maior score = maior visibilidade |
| **Convites** | Só recebe convites se score > 40 |
| **Limites** | Score baixo = limites de valor reduzidos |
| **Criação** | Score < 20 = não pode criar eventos |
| **Pagamentos** | Score baixo = delay de 7 dias no recebimento |

---

## 8. Dashboard de Transparência (NOVO v1.2)

### 8.1 Histórico do Ator

Todo actor (user, page, group) tem dashboard com:

```
┌─────────────────────────────────────────────────────────────┐
│                    MEU HISTÓRICO                            │
├─────────────────────────────────────────────────────────────┤
│ Score Atual: 78/100 🟡                                      │
│                                                             │
│ Eventos que participei: 23                                  │
│ ├── Como organizador: 5                                     │
│ ├── Como prestador: 12                                      │
│ └── Como participante: 6                                    │
│                                                             │
│ Financeiro:                                                 │
│ ├── Total recebido: R$ 4.320,00                            │
│ ├── Total pago: R$ 890,00                                  │
│ └── Impacto gerado: R$ 540,00 (para comunidade)            │
│                                                             │
│ Reputação:                                                  │
│ ├── Check-ins: 95%                                         │
│ ├── Reclamações: 2%                                        │
│ └── Cancelamentos: 0                                        │
│                                                             │
│ Penalidades ativas: 0                                       │
│ Penalidades históricas: 1 (resolvida em 15/10/2025)        │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Ledger Público do Evento

Cada evento tem registro público:

```
┌─────────────────────────────────────────────────────────────┐
│              LEDGER DO EVENTO #12345                        │
├─────────────────────────────────────────────────────────────┤
│ Total arrecadado: R$ 5.000,00                              │
│                                                             │
│ Distribuição:                                               │
│ ├── Banda "Os Fulanos": R$ 2.000,00 ✅ (check-in OK)       │
│ ├── Segurança: R$ 500,00 ✅ (4/4 presentes)                │
│ ├── Limpeza: R$ 300,00 ✅ (entrega confirmada)             │
│ ├── Organizador: R$ 1.200,00 ✅                            │
│ ├── Cidade (Curitiba): R$ 500,00 ✅                        │
│ ├── Região (Sul): R$ 300,00 ✅                             │
│ └── Grupo associado: R$ 200,00 ✅                          │
│                                                             │
│ Status: ✅ COMPLETO (distribuído em 28/12/2025 03:00)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Wizard de Criação (Atualizado v1.2)

Fluxo obrigatório:

```
Actor → EventType → Contexto → PARTICIPANTES/PRESTADORES → Economia → Revisão → Publicar
                                       ↑
                              NOVO: Cadastro obrigatório
                              de todos os envolvidos
                              com valores e regras
```

### 9.1 Cadastro de Participantes (Obrigatório para eventos pagos)

```typescript
interface EventParticipant {
  actorId: string;
  actorType: 'user' | 'page';
  role: 'artist' | 'vendor' | 'security' | 'cleaning' | 'staff' | 'venue';
  
  // Economia
  agreedAmountCents: number;
  paymentType: 'fixed' | 'percentage' | 'per_person';
  
  // Check-in
  expectedHeadcount: number;        // Quantas pessoas devem vir
  checkInRequired: boolean;         // Exige check-in para pagar?
  minimumCheckInRate: number;       // Ex: 0.8 = 80% mínimo
  
  // Liberação
  releaseCondition: 'after_start' | 'after_end' | 'after_validation';
}
```

---

## 10. PAC (Perfil Artístico Cultural)

> PAC NÃO é origem de evento. É metadata do Actor.

---

## 11. Feed como Executor

O Feed:
* Prioriza atores com score alto
* Esconde atores com score < 40
* Mostra badges de confiança
* Ordena por relevância + reputação

---

## 12. Página Explorar Eventos

Estrutura definida em v1.1. Sem alterações.

---

## 13. Compatibilidade com Legado

`cultural_events`: congelado, migrável, deprecado.

---

## 14. Governança (Atualizado v1.2)

### 14.1 Proteções Automáticas

| Situação | Ação do sistema |
|----------|-----------------|
| Page com >3 eventos cancelados/30d | Suspensão + revisão |
| Prestador com 3 no-shows/90d | Suspensão de 60 dias |
| Comprador com 3 no-shows/90d | Restrição de compra antecipada |
| Score < 20 | Conta suspensa |
| Fraude detectada | Ban permanente |

### 14.2 Thresholds Configuráveis

```typescript
const GOVERNANCE_THRESHOLDS = {
  // Cancelamento
  cancelPenaltyWindow24h: 0.10,
  cancelPenaltyWindow7d: 0.05,
  
  // Score
  minScoreToCreate: 40,
  minScoreToReceiveInvites: 40,
  criticalScoreThreshold: 20,
  
  // Limites
  maxEventsPerDayUser: 3,
  maxEventsPerDayPage: 10,
  maxEventsActiveGroup: 2,
  
  // Check-in
  minCheckInRateForFullPayment: 0.80,
  geoValidationRadius: 500, // metros
};
```

---

## 15. Quebra de Contrato

Qualquer implementação que:

* Crie evento fora de `events`
* Calcule economia no frontend
* Burle `event_type`
* Ignore Actor
* Permita saque antes do evento
* Pague prestador sem check-in
* Ignore penalidades

➡️ **É considerada BUG ARQUITETURAL.**

---

## 16. Encerramento

Este contrato existe para:

* **Eliminar calote** — Escrow obrigatório
* **Eliminar fraude** — Check-in como gatilho
* **Eliminar desorganização** — Cadastro obrigatório
* **Eliminar informalidade** — Ledger público
* **Proteger quem cumpre** — Sistema de penalidades

> **Código muda. Contrato não.**

---

## Histórico

| Data | Versão | Mudança |
|------|--------|---------|
| 28/12/2025 | v1.0 | Contrato inicial |
| 28/12/2025 | v1.1 | Group como actor, Página Explorar |
| 28/12/2025 | v1.2 | Escrow, Split pós-evento, Penalidades, Avaliação automática |

---

*Este documento é a ÚNICA fonte de verdade para o sistema de eventos.*
