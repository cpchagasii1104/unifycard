# PLANO DE CONSOLIDAÇÃO - UnifyCard
## Execução Sequencial com Risco Controlado

**Data:** 13 de Janeiro de 2026  
**Objetivo:** Eliminar duplicações e ambiguidades sem quebrar o sistema  
**Método:** PRs sequenciais, testáveis, reversíveis  

---

## 🎯 PRINCÍPIOS

1. **Um PR = Uma mudança atômica**
2. **Cada PR é testável independentemente**
3. **Cada PR tem rollback trivial**
4. **Não refatorar + consolidar no mesmo PR**
5. **CI bloqueia regressão após cada fase**

---

## 📋 FASES E PRs

### FASE 0 - FUNDAÇÃO (1 dia)

#### PR-00: Documento Institucional
```
Arquivo: ARCHITECTURAL_SOURCE_OF_TRUTH.md
Mudanças: Adicionar documento (0 código)
Risco: ZERO
Rollback: Delete arquivo
CI: Nenhum
```

**Objetivo:** Criar "tribunal" para PRs futuros

---

### FASE 1 - BLOQUEIO DE REGRESSÃO (2 dias)

#### PR-01: CI - Bloquear Core → Modules
```
Arquivo: .github/workflows/architecture-guard.yml (ou similar)
Script: scripts/check-imports.sh
Mudanças:
  - Criar script que falha se detectar import de @modules/* em src/core/**
  - Adicionar job no CI
  - IMPORTANTE: Primeiro rodar localmente, listar violações, depois ativar bloqueio
Risco: BAIXO (só adiciona verificação)
Rollback: Remover job do CI
```

**Checklist antes de merge:**
- [ ] Script detecta as 40 violações conhecidas
- [ ] CI passa em branch sem violações
- [ ] CI falha em branch com violação simulada

---

#### PR-02: CI - Bloquear Imports Relativos Cruzados
```
Arquivo: scripts/check-imports.sh (expandir)
Mudanças:
  - Bloquear ../../ atravessando de core → modules
  - Bloquear ../../../ atravessando de modules → core → modules
Risco: BAIXO
Rollback: Remover regra
```

---

### FASE 2 - CORRIGIR IMPORTS INVERTIDOS (1 semana)

**Método:** Para cada import de `@modules/*` em `core/`:

1. Identificar dependência
2. Criar interface/port no core
3. Implementar adapter no module
4. Injetar no bootstrap (DI)
5. Remover import direto

---

#### PR-03: Inversão - Core/Payment → Modules/PaymentLinks
```
Problema detectado:
  - core/payment/algo.ts importa modules/payments/payment-link.service

Solução:
  1. Criar: core/payment/payment-link.port.ts
     ```typescript
     export interface PaymentLinkProvider {
       createLink(params: CreateLinkParams): Promise<PaymentLink>;
     }
     ```
  
  2. Implementar: modules/payments/payment-link.adapter.ts
     ```typescript
     export class PaymentLinkAdapter implements PaymentLinkProvider { ... }
     ```
  
  3. DI no bootstrap:
     ```typescript
     // server.ts
     import { paymentService } from '@core/payment';
     import { PaymentLinkAdapter } from '@modules/payments';
     
     paymentService.setLinkProvider(new PaymentLinkAdapter());
     ```

Risco: MÉDIO (muda fluxo de dependência)
Rollback: Reverter commit
Testes: Rodar suite completa de payment
```

---

#### PR-04 a PR-10: Repetir para cada inversão
```
Seguir mesmo padrão de PR-03 para:
  - Core → Modules/Events (X imports)
  - Core → Modules/Dashboard (X imports)
  - Core → Modules/CRM (X imports)
  - Etc (1 PR por módulo com inversão)
```

**Cada PR:**
- [ ] Cria port/interface no core
- [ ] Implementa adapter no module
- [ ] DI no bootstrap
- [ ] Remove import direto
- [ ] Testes passam
- [ ] CI aprovado

---

### FASE 3 - CONSOLIDAR DUPLICAÇÕES (2 semanas)

**Ordem de execução:**
1. Events (mais crítico)
2. Dashboard
3. Availability
4. Location
5. Matching

**Método por domínio:**

---

#### PR-11: Events - Declarar Fonte de Verdade
```
Mudanças:
  1. Atualizar ARCHITECTURAL_SOURCE_OF_TRUTH.md
     - Declarar: core/events = invariantes
     - Declarar: modules/events = orquestração
  
  2. Adicionar comentário em ambos os arquivos:
     ```typescript
     // core/events/event.service.ts
     /**
      * FONTE DE VERDADE: Invariantes e validações de evento
      * Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md
      * NÃO DUPLICAR esta lógica em modules/events
      */
     
     // modules/events/event.service.ts
     /**
      * FONTE DE VERDADE: Orquestração de features de evento
      * Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md
      * Usa core/events para validações
      */
     ```

Risco: ZERO (só documentação)
Rollback: Reverter commit
```

---

#### PR-12: Events - Separar Responsabilidades
```
Objetivo: Garantir que core/events NÃO contém orquestração

Mudanças:
  1. Analisar core/events/event.service.ts (605 linhas)
  2. Identificar lógica de orquestração (ex: criar + notificar + agenda)
  3. Mover orquestração para modules/events
  4. Core fica apenas com: validações, contratos, invariantes
  
  Antes (core):
  ```typescript
  async createEvent(input) {
    // validação ✅ (fica)
    validate(input);
    
    // criação ✅ (fica)
    const event = await create(input);
    
    // orquestração ❌ (move para module)
    await notifyService.send(...);
    await agendaService.schedule(...);
    await feedService.publish(...);
    
    return event;
  }
  ```
  
  Depois (core):
  ```typescript
  async createEvent(input) {
    validate(input);
    const event = await create(input);
    return event;
  }
  ```
  
  Depois (module):
  ```typescript
  async createEventWithOrchestration(input) {
    const event = await coreEventService.createEvent(input);
    await notifyService.send(...);
    await agendaService.schedule(...);
    await feedService.publish(...);
    return event;
  }
  ```

Risco: MÉDIO (muda comportamento de chamadas)
Rollback: Reverter commit
Testes: Suite completa de events
Validação: Testar criação de evento em dev/staging antes de prod
```

---

#### PR-13: Events - Migrar Imports
```
Objetivo: Garantir que todo mundo usa o lugar certo

Mudanças:
  1. Encontrar imports de modules/events/event.service
  2. Analisar uso:
     - Se usa validação → trocar para @core/events
     - Se usa orquestração → manter @modules/events
  
  3. Codemod (script):
     ```bash
     # Para cada arquivo que importa event.service
     # Analisar se usa validateEvent, checkInvariants, etc
     # Trocar import para @core/events
     ```

Risco: MÉDIO
Rollback: Reverter commit
Testes: Suite completa + smoke test em todas features
```

---

#### PR-14 a PR-18: Repetir para Dashboard, Availability, Location, Matching
```
Seguir mesmo padrão:
  - PR-X: Declarar fonte
  - PR-X+1: Separar responsabilidades
  - PR-X+2: Migrar imports
```

---

### FASE 4 - PAYMENT COMO NÚCLEO CANÔNICO (1 semana)

#### PR-19: Payment - Criar Núcleo Canônico
```
Objetivo: Consolidar lógica de payment em core/payment

Estrutura nova:
core/payment/
├── payment.service.ts              (orquestração canônica)
├── payment-intent.service.ts       (fonte de verdade)
├── payment-split.service.ts        (lógica de split)
├── payment-execution.service.ts    (execução auditável)
├── payment.types.ts                (tipos compartilhados)
└── ports/
    └── payment-provider.port.ts    (interface para PIX, etc)

Mudanças:
  1. Criar estrutura acima
  2. Mover lógica de payment-intent.service existente
  3. Consolidar lógica de split (estava em N lugares)
  4. NÃO mexer em satélites ainda (próximo PR)

Risco: MÉDIO (cria nova estrutura)
Rollback: Delete diretório
Testes: Copiar testes existentes
```

---

#### PR-20: Payment - Migrar Satélites
```
Objetivo: payment-links, events-payment, etc usam core

Para cada satélite:
  1. Trocar lógica interna por chamada ao core
  2. Satélite vira orchestrator fino
  
Exemplo (payment-links):
  Antes:
  ```typescript
  async createLink(params) {
    // validação ❌ (duplicado)
    validate(params);
    
    // split ❌ (duplicado)
    const splits = calculateSplits(...);
    
    // criar link ✅ (único dele)
    const link = await createLink(...);
  }
  ```
  
  Depois:
  ```typescript
  async createLink(params) {
    // usa core para validação e split
    const intent = await paymentService.createIntent({
      amount: params.amount,
      splits: params.splits,
    });
    
    // cria link (única responsabilidade dele)
    const link = await createLink({
      ...params,
      paymentIntentId: intent.id,
    });
  }
  ```

Risco: ALTO (muda 10 serviços)
Rollback: Reverter commit
Testes: Suite completa de cada módulo payment
Validação: Staging obrigatório antes de prod
```

---

#### PR-21: Payment - Deprecar Código Duplicado
```
Objetivo: Remover lógica duplicada após migração

Mudanças:
  1. Encontrar métodos não mais usados
  2. Adicionar @deprecated com data
  3. Após 2 semanas sem uso (métrica): deletar

Risco: BAIXO (código já não é usado)
Rollback: Reverter commit
```

---

### FASE 5 - PADRONIZAR IMPORTS (1 semana)

#### PR-22: Criar Barrel Canônico - Economy
```
Objetivo: Um único caminho para importar accountService

Mudanças:
  1. Confirmar que core/economy/account.service.ts é barrel correto
  2. Encontrar todos imports alternativos:
     - @core/economy/accounts/account.service
     - ../economy/accounts/account.service
     - ../../economy/accounts/account.service
  
  3. Codemod: trocar todos para @core/economy/account.service
  4. CI: bloquear imports alternativos

Risco: BAIXO (só muda import paths)
Rollback: Reverter commit
Testes: Apenas compilação (TypeScript valida)
```

---

#### PR-23 a PR-30: Repetir para cada domínio
```
Domínios com imports inconsistentes:
  - events
  - dashboard
  - authorization
  - payment
  - actor-delegation
  - matching
  - availability
  - location

Cada PR:
  1. Declarar path canônico
  2. Codemod para migrar
  3. CI para bloquear alternativos
```

---

### FASE 6 - DISCIPLINA DE IDs (3 dias)

#### PR-31: Documento ID_SEMANTICS.md
```
Arquivo: ID_SEMANTICS.md
Conteúdo:
  - Quando usar user_id
  - Quando usar actor_id
  - Quando usar contact_id
  - Exemplos de cada caso
  - Checklist para PR

Risco: ZERO (só documentação)
```

---

#### PR-32: CI - Validar IDs em Migrations
```
Script: scripts/validate-migration-ids.sh

Regras:
  - Tabelas de conteúdo/ownership devem usar actor_id
  - Tabelas de CRM/vendas devem usar contact_id
  - Tabelas de auditoria/sessão devem usar user_id

Funcionamento:
  1. Parsear nova migration
  2. Detectar criação de tabela
  3. Verificar se IDs estão corretos para o domínio
  4. Falhar se incorreto (com sugestão)

Risco: BAIXO (só validação)
```

---

## 📊 CRONOGRAMA

### Semana 1
```
Dia 1: PR-00, PR-01 (fundação + CI básico)
Dia 2-3: PR-02, PR-03, PR-04 (CI completo + primeiras inversões)
Dia 4-5: PR-05 a PR-10 (inversões restantes)
```

### Semana 2
```
Dia 1-2: PR-11, PR-12, PR-13 (Events completo)
Dia 3: PR-14, PR-15 (Dashboard)
Dia 4-5: PR-16, PR-17, PR-18 (Availability, Location, Matching)
```

### Semana 3
```
Dia 1-2: PR-19, PR-20 (Payment núcleo + satélites)
Dia 3: PR-21 (Payment deprecação)
Dia 4-5: PR-22, PR-23, PR-24 (Padronização imports - início)
```

### Semana 4
```
Dia 1-3: PR-25 a PR-30 (Padronização imports - resto)
Dia 4-5: PR-31, PR-32 (ID semantics + CI)
```

**Total:** 4 semanas (~32 PRs)

---

## 🎯 MÉTRICAS DE SUCESSO

### Após cada fase

**Fase 1 (CI):**
- [ ] CI detecta 40 violações conhecidas
- [ ] CI passa em branches limpos
- [ ] CI falha em branches com violação

**Fase 2 (Inversões):**
- [ ] Zero imports de @modules/* em core/
- [ ] Todos ports/adapters testados
- [ ] Suite de testes passa 100%

**Fase 3 (Duplicações):**
- [ ] Cada domínio tem fonte única documentada
- [ ] Zero duplicação funcional
- [ ] Imports apontam para fonte correta

**Fase 4 (Payment):**
- [ ] Core payment é núcleo canônico
- [ ] 10 satélites usam core (não duplicam)
- [ ] Zero lógica de split fora do core

**Fase 5 (Imports):**
- [ ] Um path canônico por símbolo
- [ ] CI bloqueia paths alternativos
- [ ] Zero imports relativos cruzando camadas

**Fase 6 (IDs):**
- [ ] Documentação clara
- [ ] CI valida novas migrations
- [ ] Zero uso incorreto de IDs

---

## ⚠️ RISCOS E MITIGAÇÕES

### Risco: Quebrar feature existente

**Mitigação:**
- Testes automatizados antes de cada PR
- Staging obrigatório para PRs de risco ALTO
- Rollback trivial (1 revert)
- Deployment gradual (canary em prod)

---

### Risco: Desenvolvedor criar nova violação

**Mitigação:**
- CI bloqueia merge
- Documento institucional vinculante
- Code review obrigatório
- Checklist em template de PR

---

### Risco: Conflitos de merge entre PRs

**Mitigação:**
- PRs pequenos e atômicos
- Merge sequencial (não paralelo)
- Base sempre atualizada antes de PR
- Rebase se necessário

---

### Risco: Performance degradada após consolidação

**Mitigação:**
- Benchmark antes/depois
- Profiling em staging
- Rollback se degradação >10%
- Otimização em PR separado

---

## 📋 CHECKLIST GLOBAL

### Antes de começar
- [ ] ARCHITECTURAL_SOURCE_OF_TRUTH.md revisado e aprovado
- [ ] Time alinhado com plano
- [ ] Ambiente de staging pronto
- [ ] Suite de testes cobrindo casos críticos

### Durante execução
- [ ] Um PR por vez (merge antes do próximo)
- [ ] Testes passando antes de merge
- [ ] Code review em cada PR
- [ ] Staging validado em PRs de risco ALTO

### Após conclusão
- [ ] CI ativo e bloqueando regressões
- [ ] Documentação atualizada
- [ ] Time treinado nas novas regras
- [ ] Métricas de sucesso validadas

---

## 🏁 CONCLUSÃO

**Este plano:**
- ✅ Elimina duplicações sem refatoração cega
- ✅ Corrige arquitetura mantendo contratos
- ✅ Cada PR é testável e reversível
- ✅ Risco controlado (PRs atômicos)
- ✅ CI impede regressão

**Após conclusão:**
- ✅ Uma fonte de verdade por domínio
- ✅ Arquitetura limpa e escalável
- ✅ Manutenção simples
- ✅ Onboarding rápido

**Tempo total:** 4 semanas  
**Risco geral:** Controlado  
**Benefício:** Sistema pronto para escalar com saúde  

---

**Próxima ação:** Aprovar plano → Executar PR-00 (documento institucional)
