# ARCHITECTURAL_SOURCE_OF_TRUTH.md
UnifiCard — Fonte de Verdade Arquitetural (v1)

**Status:** CANÔNICO · Vinculante  
**Data:** 13 de Janeiro de 2026  
**Versão:** 1.0  
**Objetivo:** Eliminar ambiguidade de implementação e impedir regressão arquitetural.

---

## 1) REGRA SUPREMA DE DEPENDÊNCIA

> **CORE NUNCA IMPORTA MODULES.**

- Qualquer import de `@modules/*` ou `../modules/*` dentro de `src/core/**` é **violação P0**.
- A correção é sempre: **inversão** (port/interface no core, adapter no module).
- **Não há exceção.** Período.

**Exemplo correto:**
```typescript
// ✅ CORRETO
// core/payment/payment.port.ts
export interface PaymentProvider {
  charge(amount: number): Promise<void>;
}

// modules/payment-pix/pix.adapter.ts
import { PaymentProvider } from '@core/payment/payment.port';
export class PixAdapter implements PaymentProvider { ... }
```

**Exemplo ERRADO:**
```typescript
// ❌ ERRADO - BLOQUEADO POR CI
// core/payment/payment.service.ts
import { PixService } from '@modules/payment-pix'; // VIOLAÇÃO P0
```

---

## 2) DEFINIÇÕES CANÔNICAS

### CORE (`src/core/`)

**CORE é soberano.** Contém:
- ✅ Contratos, invariantes, tipos canônicos
- ✅ Serviços de base (infra, primitives)
- ✅ Ports/interfaces (para dependências externas)
- ✅ Engines de domínio (ledger, economy, authorization)

**CORE NÃO contém:**
- ❌ Orquestração contextual de produto
- ❌ Handlers de rota de domínio de feature
- ❌ Dependências de modules
- ❌ Lógica de apresentação/UI

---

### MODULES (`src/modules/`)

**MODULES contêm:**
- ✅ Orquestração por feature/domínio
- ✅ Fluxos, handlers, routes
- ✅ Integrações e adapters para ports do core
- ✅ Lógica de composição de múltiplos cores

**MODULES NÃO contêm:**
- ❌ Regras de negócio base (essas ficam no core)
- ❌ Invariantes econômicos
- ❌ Lógica que outros modules precisam reusar

---

## 3) FONTE DE VERDADE POR DOMÍNIO

### Events

**Fonte:** `@core/events` (invariantes) + `@modules/events` (orquestração)

**Regras:**
- ✅ Contratos de evento: `@core/events/event.types.ts`
- ✅ Validações de evento: `@core/events/event.service.ts`
- ✅ Orquestração de criação: `@modules/events/event.service.ts`
- ❌ **Proibido:** lógica de validação duplicada nos dois lugares

**Imports canônicos:**
```typescript
// Tipos e contratos
import { Event, CreateEventInput } from '@core/events/event.types';

// Validação e invariantes
import { eventService } from '@core/events/event.service';

// Orquestração de feature
import { eventFeatureService } from '@modules/events/event.service';
```

---

### Dashboard

**Fonte única:** `@modules/dashboard`

**Regras:**
- ✅ Dashboard é composição de múltiplos domínios
- ✅ Core contém apenas tipos compartilhados (se necessário)
- ❌ **Proibido:** lógica de dashboard no core

**Import canônico:**
```typescript
import { dashboardService } from '@modules/dashboard/dashboard.service';
```

---

### Availability

**Status:** Em consolidação  
**Direção:** Unificação em `@core/availability`

**Regras temporárias:**
- ⚠️ Até consolidar: **apenas UMA implementação** é fonte de verdade
- ❌ **Proibido:** duplicação funcional

**Futuro (após consolidação):**
```typescript
import { availabilityService } from '@core/availability/availability.service';
```

---

### Location

**Fonte única:** `@core/location`

**Regras:**
- ✅ Parsing de endereço: `@core/location`
- ✅ Normalização de coordenadas: `@core/location`
- ❌ **Proibido:** duplicar parsing/normalização em múltiplos serviços

---

### Matching

**Fonte única:** `@core/matching`

**Regras arquiteturais:**
- ✅ Matching é **sugestão**, não decisão
- ❌ **Proibido:** score humano, ranking moral
- ❌ **Proibido:** filtragem por educação/atributo humano
- ✅ Blindagens canônicas obrigatórias (ver `OBSERVABILITY_O-*.md`)

**Import canônico:**
```typescript
import { matchingService } from '@core/matching/matching.service';
```

---

### Payment

**Fonte:** `@core/payment` (núcleo canônico)

**Arquitetura:**
```
core/payment/
├── payment.service.ts         (orquestração canônica)
├── payment-intent.service.ts  (fonte de verdade)
├── payment-split.service.ts   (puro, declarativo)
└── payment-execution.service.ts (execução/registro auditável)

modules/*-payment/
├── events-payment/            (satélite: usa core)
├── service-payment/           (satélite: usa core)
├── payment-links/             (satélite: usa core)
└── ...
```

**Regras:**
- ✅ `payment_intents` é base canônica
- ✅ Variações só existem como projeções
- ❌ **Proibido:** duplicar split/execution/idempotência fora do core
- ❌ **Proibido:** módulos "payment-*" escreverem diretamente em tabelas base

**Imports canônicos:**
```typescript
// Núcleo
import { paymentService } from '@core/payment/payment.service';
import { paymentIntentService } from '@core/payment/payment-intent.service';

// Satélites (só orquestração)
import { paymentLinkService } from '@modules/payments/payment-link.service';
```

---

### Authorization

**Fonte única:** `@core/authorization`

**Regras:**
- ✅ Permission Map: `@core/authorization/permission-keys.ts` (v1.2)
- ✅ Authorization Service: `@core/authorization/authorization.service.ts`
- ✅ Permission Guard: `@core/authorization/require-permission.guard.ts`
- ❌ **Proibido:** lógica de autorização fora do core

---

### Actor Delegation

**Fonte única:** `@core/actor-delegation`

**Regras:**
- ✅ Actor Registry: `@core/actor-registry`
- ✅ Delegations: `@core/actor-delegation`
- ❌ **Proibido:** verificação de delegação fora do core

---

### Economy (Ledger)

**Fonte única:** `@core/economy`

**Regras:**
- ✅ Account Service: `@core/economy/accounts/account.service.ts`
- ✅ Movements (append-only): `@core/economy`
- ✅ Distribution: `@core/economy/distribution`
- ❌ **Proibido:** criar movements fora do core economy

**Import canônico:**
```typescript
import { accountService } from '@core/economy/accounts/account.service';
```

---

## 4) RE-EXPORTS (BARRELS) — GOVERNANÇA PERMITIDA

**Re-exports são permitidos quando:**
- ✅ Criam caminho canônico único
- ✅ Evitam imports múltiplos para o mesmo símbolo
- ✅ Facilitam refatoração futura

**Exemplo correto:**
```typescript
// core/economy/account.service.ts (barrel)
export * from './accounts/account.service';

// Uso
import { accountService } from '@core/economy/account.service';
```

**Proibido:**
- ❌ Múltiplos caminhos "equivalentes" que gerem ambiguidade
- ❌ Barrels que re-exportam de modules para core

---

## 5) IMPORTS: REGRAS ABSOLUTAS

### Aliases Obrigatórios

**Use sempre:**
```typescript
✅ import { X } from '@core/payment';
✅ import { Y } from '@modules/crm';
```

**Nunca use:**
```typescript
❌ import { X } from '../../core/payment';
❌ import { X } from '../../../modules/crm';
```

**Exceção única:** imports relativos **dentro do mesmo módulo**
```typescript
✅ import { X } from './payment.types'; // mesmo diretório
✅ import { X } from '../utils/helper'; // dentro do mesmo módulo
```

---

### Caminho Canônico Único

**Para cada símbolo exportado, existe UM ÚNICO caminho correto.**

Se `accountService` pode ser importado de 3 lugares diferentes:
- ❌ `@core/economy/account.service`
- ❌ `@core/economy/accounts/account.service`
- ❌ `../economy/accounts/account.service`

**Escolha UM** e bloqueie os outros no CI.

---

## 6) REGRAS DE IDENTIDADE (IDs)

### user_id
**Uso:** Autenticado humano que opera o sistema

**Quando usar:**
- ✅ Login, sessão, JWT
- ✅ Auditoria de ação humana
- ❌ **NÃO usar** quando a ação pode ser de empresa/group

---

### actor_id
**Uso:** Entidade que age (user, company, group, event, etc)

**Quando usar:**
- ✅ Criação de conteúdo
- ✅ Ownership de recurso
- ✅ Delegações
- ✅ Permissions
- ✅ Transações financeiras

---

### contact_id
**Uso:** Relação CRM/pagador (pode não ser user do sistema)

**Quando usar:**
- ✅ Cliente de venda
- ✅ Pagador de invoice
- ✅ Segmentação de marketing
- ❌ **NÃO usar** para autorização

---

### Regra de ouro

**Em caso de dúvida:**
- Se pode ser empresa/group → `actor_id`
- Se é humano logado → `user_id`
- Se é cliente externo → `contact_id`

---

## 7) REGRAS DE PR / CI

### Checklist obrigatório para merge

Todo PR deve responder:

**1. Qual é a fonte de verdade deste domínio?**
- [ ] Está documentado neste arquivo?
- [ ] Implementação está no local correto?

**2. Este código cria uma segunda implementação funcional?**
- [ ] NÃO (seguro para merge)
- [ ] SIM (justificar ou bloquear)

**3. Core está importando Modules?**
- [ ] NÃO (seguro)
- [ ] SIM (BLOQUEAR - P0)

**4. Existe um único caminho de import canônico?**
- [ ] SIM (usar aliases @core/@modules)
- [ ] NÃO (corrigir antes de merge)

**5. IDs estão sendo usados corretamente?**
- [ ] user_id apenas para humano logado
- [ ] actor_id para entidades que agem
- [ ] contact_id para CRM/pagadores

---

### Bloqueios automáticos (CI)

**P0 - Falha build:**
```
❌ core/* importando modules/*
❌ Imports relativos atravessando camadas (../../)
❌ Duplicação de símbolo exportado (mesmo nome, dois paths)
```

**P1 - Warning + revisão obrigatória:**
```
⚠️ Novo payment service fora de @core/payment
⚠️ Nova lógica de authorization fora de @core/authorization
⚠️ Novo ledger/movement fora de @core/economy
```

---

## 8) CONSOLIDAÇÃO PENDENTE

### Domínios com duplicação ativa

**A ser resolvido (P0):**
- [ ] `event.service.ts` (core vs modules)
- [ ] `dashboard.service.ts` (core vs modules)
- [ ] `availability.service.ts` (core vs modules)
- [ ] `location.service.ts` (core vs modules)
- [ ] `matching.service.ts` (core vs modules)

**Método de resolução:**
1. Declarar fonte única neste documento
2. Deprecar a implementação não-canônica
3. Migrar imports
4. Deletar código duplicado
5. CI para prevenir regressão

---

## 9) VERSIONAMENTO DESTE DOCUMENTO

**Versão:** 1.0  
**Data:** 13 de Janeiro de 2026  
**Status:** ATIVO - Vinculante para todos os PRs  

**Próximas revisões:**
- Após consolidação de duplicações (→ v1.1)
- Após implementação de CI (→ v1.2)
- Trimestral (manutenção)

---

## 10) REFERÊNCIAS

**Documentos relacionados:**
- `OBSERVABILITY_O-01.md` → Blindagens éticas
- `PERMISSION_MAP_v1.2.md` → Mapa de permissions
- `GOVERNANCE.md` → Regras operacionais
- `AUTONOMY_RULES.md` → Princípios de autonomia

---

**Fim do documento institucional.**

**Este documento é lei arquitetural. Violações são dívida técnica P0.**
