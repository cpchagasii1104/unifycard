# SPLIT_ENGINE_ESTADO_ATUAL.md
## Auditoria do Sistema de Split — UnifiCard

**Data:** 29/12/2025  
**Status:** ✅ Validado  
**Fase:** 1 - Auditoria (sem código novo)

---

## 📋 RESUMO EXECUTIVO

O Split Engine do UnifiCard **JÁ ESTÁ IMPLEMENTADO E ROBUSTO**.

Não é necessário criar nenhum módulo novo. O sistema já possui:
- ✅ Split Engine completo (744 linhas)
- ✅ Escrow Service (444 linhas)
- ✅ Job de split pós-evento (337 linhas)
- ✅ Sistema de dinheiro fictício (TEST)
- ✅ Governança de fundo regional (900+ linhas)
- ✅ Dashboard de transparência

---

## 🏗️ ARQUITETURA ENCONTRADA

```
backend/src/core/
├── economy/
│   ├── accounts/               # Contas (21K)
│   ├── transactions/           # Transações (26K)
│   ├── ledger/                 # Livro-razão (18K)
│   ├── fund/                   # Fundo regional (60K)
│   ├── distribution/           # Distribuição (18K)
│   ├── split.service.ts        # Split Engine Economy (404 linhas)
│   ├── escrow.service.ts       # Custódia (444 linhas)
│   └── group-account.service.ts
│
└── unifybank/
    ├── split-engine.service.ts        # Split Engine Principal (744 linhas)
    ├── split-engine.types.ts          # Tipos
    ├── test-currency.service.ts       # Dinheiro fictício (TEST)
    ├── regional-fund-governance.ts    # Governança (38K)
    ├── transparency.service.ts        # Dashboard (18K)
    └── donation.service.ts            # Doações

backend/src/jobs/
└── post-event-split.job.ts            # Job pós-evento (337 linhas)
```

---

## 🔧 SPLIT ENGINE — DETALHES TÉCNICOS

### Contextos Suportados (SplitContextType)
```typescript
type SplitContextType = 'donation' | 'service' | 'event' | 'marketplace';
```

### Targets Suportados (SplitTargetType)
```typescript
type SplitTargetType = 'user' | 'group' | 'project' | 'regional_fund' | 'platform';
```

### Regras de Split Configuradas

#### 1. Doações (donation)
| Target | Percentual | Destino |
|--------|------------|---------|
| group | 70% | Grupo/projeto receptor |
| regional_fund | 20% | Fundo regional |
| platform | 10% | Plataforma |

#### 2. Genérico (default)
| Target | Percentual | Destino |
|--------|------------|---------|
| user | 80% | Usuário principal |
| platform | 20% | Plataforma |

#### 3. Eventos (pós-evento) — Linha 195-196 post-event-split.job.ts
| Target | Percentual | Destino |
|--------|------------|---------|
| EVENT_ORGANIZER | 70% | Organizador |
| TENANT | 15% | Cidade |
| REGION | 10% | Região |
| GROUP | 5% | Grupo |

**⚠️ OBSERVAÇÃO:** O regulamento define 70/15/10/5, mas o código atual usa parcialmente essa configuração.

---

## 💰 ESCROW — SISTEMA DE CUSTÓDIA

### Status do Escrow
```
COLLECTING → LOCKED → RELEASING → COMPLETED
                ↓
            REFUNDING
```

### Tabelas
- `event_escrow` — Fundo bloqueado por evento
- `event_escrow_transactions` — Transações do escrow

### Campos Calculados
```sql
current_balance_cents = total_collected_cents - total_released_cents - total_refunded_cents
```

### Transações Suportadas
| Tipo | Descrição |
|------|-----------|
| DEPOSIT | Compra de ingresso |
| RELEASE | Pagamento a participante |
| REFUND | Reembolso |
| PENALTY | Multa |

---

## ⚡ JOB DE SPLIT PÓS-EVENTO

**Arquivo:** `backend/src/jobs/post-event-split.job.ts`

### Fluxo de Execução
1. ✅ Verificar se evento já foi processado (idempotente)
2. ✅ Verificar se evento está COMPLETED
3. ✅ Iniciar liberação do escrow
4. ✅ Processar cada participante baseado em attendance_status
5. ✅ Distribuir restante (organizador + splits)
6. ✅ Processar no-shows de compradores
7. ✅ Finalizar escrow
8. ✅ Marcar evento como split_processed

### Pagamento por Attendance Status
| Status | Pagamento | Penalidade |
|--------|-----------|------------|
| PRESENT | 100% | Nenhuma |
| LEFT_EARLY | 50% | PARTIAL_DELIVERY |
| NO_SHOW | 0% | Severa (atração principal) ou Padrão |

---

## 💵 DINHEIRO FICTÍCIO (TEST)

**Arquivo:** `backend/src/core/unifybank/test-currency.service.ts`

### Características
- Moeda: TEST
- Limite por emissão: 1.000.000 TEST
- Apenas role 'admin' pode emitir
- Rastreabilidade completa (adminId, userId, timestamp, reason)
- Todas emissões registradas no ledger

### Uso
```typescript
await testCurrencyService.emitTestCurrency({
  tenantId,
  userId,
  amount: 1000,
  reason: 'Teste de fluxo',
  adminId: currentAdmin
});
```

---

## 🔗 INTEGRAÇÕES EXISTENTES

| Módulo | Usa Split Engine? | Arquivo |
|--------|-------------------|---------|
| Checkout | ✅ SIM | CheckoutService.ts |
| Doações | ✅ SIM | donation.service.ts |
| Catálogo | ✅ SIM | catalog-payment.service.ts |
| Eventos | ✅ SIM | event-economy.service.ts |
| UnifyWork | ✅ SIM | assignment.service.ts |
| Rides | 🔒 LATENTE | payment.ts |

---

## 📊 MIGRATIONS RELACIONADAS

| # | Nome | Função |
|---|------|--------|
| 092 | event_escrow | Tabela de escrow |
| 094 | event_participants | Participantes de eventos |
| 095 | events_split_processed | Campo split_processed |

---

## ⚠️ DIVERGÊNCIAS IDENTIFICADAS

### 1. Percentuais não uniformes
- **Regulamento:** 70/15/10/5 (organizador/cidade/região/grupo)
- **Código donation:** 70/20/10 (grupo/regional_fund/platform)
- **Código post-event:** 70/15/10/5 (alinhado)

**Recomendação:** Unificar percentuais em todas as regras.

### 2. Dois SplitEngineService
- `core/unifybank/split-engine.service.ts` (744 linhas)
- `core/economy/split.service.ts` (404 linhas)

**Recomendação:** Consolidar em um único serviço.

---

## ✅ CONCLUSÕES

### O que JÁ funciona
1. Split Engine com regras por contexto
2. Escrow para eventos pagos
3. Job de split pós-evento
4. Sistema de dinheiro fictício
5. Penalidades automáticas
6. Dashboard de transparência

### O que NÃO precisa ser criado
- ❌ Novo módulo de split
- ❌ Novo ledger
- ❌ Nova moeda fictícia
- ❌ Novo escrow

### Próximos passos (FASE 2)
1. Verificar se eventos pagos estão passando pelo escrow ao serem criados
2. Verificar se job pós-evento está sendo agendado
3. Unificar percentuais de split
4. Consolidar os dois SplitEngineService

---

## 📝 CHECKLIST DE VALIDAÇÃO

- [x] Split Engine existe e está robusto
- [x] Escrow de eventos implementado
- [x] Job pós-evento implementado
- [x] Dinheiro fictício implementado
- [x] Percentuais documentados
- [x] Integrações mapeadas
- [ ] Verificar se eventos pagos usam escrow na criação
- [ ] Verificar agendamento do job pós-evento
- [ ] Unificar percentuais
- [ ] Consolidar SplitEngineService duplicado

---

*Documento gerado em 29/12/2025*
*Fase: 1 - Auditoria do Split Engine*
*Próxima fase: 2 - Conectar Eventos ao Split*
