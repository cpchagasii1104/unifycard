# Inventario de Violacoes Arquiteturais

Data: 14 de Janeiro de 2026
Status: BASELINE (antes da correcao)

## Resumo

| Tipo de Violacao | Quantidade |
|------------------|------------|
| Core -> @modules/ | 24 |
| Imports relativos cruzados | 16 |
| **Total** | **40** |

---

## Core -> @modules/ (VIOLACAO P0)

Regra: Core NUNCA importa Modules diretamente.
Correcao: Port/Interface no core + Adapter no module + DI no bootstrap.

### Lista de Violacoes (24)

```
src/core/action-context/action-context.middleware.ts
  import { actorRepository } from '@modules/social/actor.repository';

src/core/actor-registry/actor-registry.service.ts
  import { actorRepository } from '@modules/social/actor.repository';

src/core/authorization/authorization.service.ts
  import { actorRepository } from '@modules/social/actor.repository';

src/core/availability/unified-availability.service.ts
  import { actorRepository } from '@modules/social/actor.repository';
  import { ActorEffect } from '@modules/social/actor-effects.types';

src/core/companies/company-members.service.ts
  import { actorRepository } from '@modules/social/actor.repository';

src/core/events/register-handlers.ts
  import { registerEventFeedHandlers } from '@modules/social/event-feed.handlers';

src/core/feed/feed-plugin.registry.ts
  import { ActorIntent } from '@modules/social/actor-intents.types';

src/core/feed/feed-plugin.resolver.ts
  import { ActorIntent } from '@modules/social/actor-intents.types';

src/core/feed/feed-plugin.routes.ts
  import { ActorIntent } from '@modules/social/actor-intents.types';

src/core/feed/feed-plugin.service.ts
  import { ActorIntent } from '@modules/social/actor-intents.types';

src/core/feed/feed-plugin.types.ts
  import { ActorIntent } from '@modules/social/actor-intents.types';

src/core/observability/observability-passive.projector.ts
  import { ActorEffect } from '@modules/social/actor-effects.types';

src/core/profile/commitments.routes.ts
  import { eventsService } from '@modules/events/events.service';
  import { groupsService } from '@modules/groups/groups.service';
  import { socialInboxService } from '@modules/inbox/social-inbox.service';
  import { actorRepository } from '@modules/social/actor.repository';

src/core/profile/impact-overview.routes.ts
  import { actorRepository } from '@modules/social/actor.repository';

src/core/profile/pending-responsibilities.routes.ts
  import { actorRepository } from '@modules/social/actor.repository';

src/core/profile/profile-health.routes.ts
  import { resolveActiveActorFromRequest } from '@modules/social/actor.utils';

src/core/profile/profile.routes.ts
  import { actorRepository } from '@modules/social/actor.repository';

src/core/read-models/read-model.projector.ts
  import { ActorEffect } from '@modules/social/actor-effects.types';

src/core/reputation/__tests__/soft-block.test.ts
  import { alertService } from '@modules/automation/alert.service';

src/core/unifybank/donation.service.ts
  import { SocialRepository } from '@modules/social/social.repository';
```

---

## Imports Relativos Cruzando Camadas (16)

Regra: Use sempre @core/* ou @modules/* para imports entre camadas.

### Lista de Violacoes (16)

```
src/core/checkout/CheckoutService.ts
  import { bankIntegrationService } from '../../modules/bank/bank-integration.service';

src/core/economy/group-account.service.ts
  import { groupsRepository } from '../../modules/groups/groups.repository';

src/core/events/__tests__/event-economy.service.test.ts
  import { actorRepository } from '../../../modules/social/actor.repository';

src/core/events/__tests__/event.service.test.ts
  import { actorRepository } from '../../../modules/social/actor.repository';

src/core/jobs/subscription-expiration.job.ts
  import { organizerBillingService } from '../../modules/events/organizers/organizer-billing.service';

src/core/orchestrator/executors/groups-activity.executors.ts
  import { socialService } from '../../../modules/social/social.service';
  import { groupsRepository } from '../../../modules/groups/groups.repository';
  import { SocialRepository } from '../../../modules/social/social.repository';

src/core/unifybank/bank-p2p-transfer.service.ts
  import { bankTransactionService } from '../../modules/bank/bank-transaction.service';
  import { bankAccountService } from '../../modules/bank/bank-account.service';

src/core/unifybank/donation.service.ts
  import { bankIntegrationService } from '../../modules/bank/bank-integration.service';
  import { bankTransactionService } from '../../modules/bank/bank-transaction.service';
  import { bankAccountService } from '../../modules/bank/bank-account.service';

src/core/unifybank/regional-fund-governance.service.ts
  import { bankTransactionService } from '../../modules/bank/bank-transaction.service';
  import { bankAccountService } from '../../modules/bank/bank-account.service';

src/core/unifybank/transparency.service.ts
  import { bankAccountService } from '../../modules/bank/bank-account.service';
```

---

## Dependencias Identificadas por Modulo

| Modulo | Dependencias no Core | Arquivos Afetados |
|--------|---------------------|-------------------|
| @modules/social | actorRepository, ActorIntent, ActorEffect, socialService, SocialRepository | 18 |
| @modules/bank | bankIntegrationService, bankTransactionService, bankAccountService | 6 |
| @modules/groups | groupsService, groupsRepository | 3 |
| @modules/events | eventsService, organizerBillingService | 2 |
| @modules/inbox | socialInboxService | 1 |
| @modules/automation | alertService | 1 |

---

## Estrategia de Correcao

### Fase 2 - Criar Ports/Interfaces

Para cada dependencia, criar interface no core:

```typescript
// src/core/ports/actor-repository.port.ts
export interface IActorRepository {
  findById(id: string): Promise<Actor | null>;
  findByUserId(userId: string): Promise<Actor | null>;
  // ... metodos necessarios
}
```

### Fase 3 - Criar Adapters

Implementar adapter no module:

```typescript
// src/modules/social/adapters/actor-repository.adapter.ts
import { IActorRepository } from '@core/ports/actor-repository.port';
import { actorRepository } from '../actor.repository';

export const actorRepositoryAdapter: IActorRepository = actorRepository;
```

### Fase 4 - Dependency Injection

Registrar no bootstrap:

```typescript
// src/bootstrap.ts
import { actorRepositoryAdapter } from '@modules/social/adapters/actor-repository.adapter';
container.register('IActorRepository', actorRepositoryAdapter);
```

---

## Comandos de Validacao

```bash
# Verificar todas as violacoes arquiteturais
npm run check:arch

# Verificar apenas Core -> Modules
npm run check:core-imports

# Verificar apenas imports relativos
npm run check:relative-imports

# Listar violacoes em arquivo
npm run violations:list
```

---

## Proximos Passos

1. [x] CI implementado (detecta violacoes)
2. [ ] Criar ports para dependencias mais usadas (actorRepository)
3. [ ] Corrigir arquivos de alta prioridade (profile, feed)
4. [ ] Verificar zero violacoes
5. [ ] CI bloqueante ativo

---

## Referencias

- ARCHITECTURAL_SOURCE_OF_TRUTH.md
- ARCHITECTURE_GUARDRAILS.md
