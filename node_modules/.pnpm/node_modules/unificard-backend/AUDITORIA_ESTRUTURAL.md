# AUDITORIA ESTRUTURAL - UNIFYCARD BACKEND
**Data:** 2025-01-20  
**Escopo:** Backend + Frontend (análise estrutural)  
**Objetivo:** Diagnosticar dependências, ativação por cidade e consistência de contratos

---

## 1. MAPA DE MÓDULOS

### 1.1 Módulos Core (Infraestrutura)

| Módulo | Estado | Dependências Diretas | Dependências Indiretas |
|--------|--------|---------------------|----------------------|
| **auth** | ATIVO | - | - |
| **rbac** | ATIVO | auth | - |
| **config** | ATIVO | - | - |
| **economy** | ATIVO | - | eventBus, ledger |
| **notify** | ATIVO | eventBus | - |
| **reviews** | ATIVO | - | eventBus → reputation |
| **reputation** | ATIVO | eventBus (core.review.created) | reviews |
| **identity** | ATIVO | - | - |
| **categories** | ATIVO | - | - |
| **world** | ATIVO | - | - |
| **tenants** | ATIVO | world | - |
| **orchestrator** | PARCIAL | eventBus | work, rides (adapters) |
| **policy** | ATIVO | - | - |
| **policy-resolution** | ATIVO | policy | decision-log |
| **insight** | ATIVO | orchestrator (canonical events) | decision-log |
| **simulation** | ATIVO | policy, policy-resolution | decision-log |
| **decision-log** | ATIVO | - | - |
| **memory** | ATIVO | - | - |
| **root-config** | ATIVO | - | - |

### 1.2 Módulos Business

| Módulo | Estado | Dependências Diretas | Dependências Indiretas |
|--------|--------|---------------------|----------------------|
| **work** | ATIVO | economy, eventBus, reputation | notify, orchestrator |
| **work-instant** | PARCIAL | work | - |
| **rides** | ATIVO | economy, eventBus | notify, orchestrator, world (geography) |
| **events** | PARCIAL | - | - |
| **social** | PARCIAL | work, schedule | - |
| **social-actions** | PARCIAL | social | - |
| **social-chat** | PARCIAL | social | - |
| **schedule** | PARCIAL | - | - |
| **care** | PARCIAL | - | - |
| **assistant** | PARCIAL | memory, ai-kernel | - |
| **groups** | ATIVO | economy, eventBus | - |
| **catalog** | ATIVO | - | - |

### 1.3 Módulos de Desenvolvimento

| Módulo | Estado | Dependências Diretas |
|--------|--------|---------------------|
| **devtools** | ATIVO | ai-kernel |

---

## 2. DEPENDÊNCIAS ESTRUTURAIS

### 2.1 Dependências Diretas (Imports)

**Economy como Hub:**
- `work` → `economy` (transações, splits)
- `rides` → `economy` (transações, splits)
- `groups` → `economy` (distribuição de fundos)
- `social` → `economy` (pagamentos work)

**EventBus como Hub:**
- `work` → `eventBus` (publica: work.job.created, work.assignment.completed)
- `rides` → `eventBus` (publica: rides.driver.zone.changed, rides.city.created)
- `groups` → `eventBus` (publica: group.created, group.fund.received)
- `reputation` → `eventBus` (consome: core.review.created)
- `notify` → `eventBus` (consome: work.*, rides.*)
- `orchestrator` → `eventBus` (consome: work.*, rides.* via adapters)

**Orchestrator como Hub:**
- `orchestrator` → `work.adapter` (traduz work.* → canonical events)
- `orchestrator` → `rides.adapter` (traduz rides.* → canonical events)
- `insight` → `orchestrator` (lê canonical events)
- `simulation` → `orchestrator` (lê canonical events via event-log.source)

### 2.2 Dependências Indiretas (Eventos)

**Cadeia de Eventos Work:**
```
work.assignment.completed
  → eventBus.publish
    → notify handlers (work-notify.handlers)
    → orchestrator (work.adapter) → canonical events
      → insight (lê event_log)
      → simulation (lê event_log)
```

**Cadeia de Eventos Reviews:**
```
reviews.createReview
  → eventBus.publish('core.review.created')
    → reputation handlers (reputation.events)
      → reputationService.applyReview
```

**Cadeia de Eventos Groups:**
```
groups.createGroup
  → eventBus.publish('group.created')
    → orchestrator (groups.executors) → canonical events
```

### 2.3 Dependências Implícitas (Assumidas, Não Verificadas)

**CRÍTICAS:**
1. **Economy assume que `accounts` existem** - nenhuma verificação de pré-existência
2. **Work assume que `economy` está ativo** - falha silenciosa se economy não responder
3. **Rides assume geografia (world)** - usa `rides_cities`, `rides_zones` sem verificar se cidade está ativa
4. **Orchestrator assume adapters registrados** - se adapter não registrar handler, eventos são perdidos
5. **Insight/Simulation assumem `event_log` populado** - podem retornar vazio sem erro

**MODERADAS:**
1. **Policy Resolution assume PolicyRegistry populado** - retorna null silenciosamente
2. **Decision Log assume diretório `logs/decisions/`** - cria em runtime, pode falhar
3. **Notify assume providers configurados** - falha silenciosa se provider não existir
4. **Reputation assume `global_user_id` resolvível** - pode falhar se identity não estiver ativo

---

## 3. ATIVAÇÃO POR CIDADE

### 3.1 Módulos com Ativação por Cidade

**RIDES (Implementado):**
- Tabela `rides_cities` com campo `enabled` (boolean)
- Campo `is_active` em queries
- Service `citiesService.createCity()` cria cidade com `enabled = true`
- **PROBLEMA:** Nenhuma verificação de pré-requisitos antes de ativar
- **PROBLEMA:** Nenhum "city readiness check" antes de permitir corridas

**WORK (Não Implementado):**
- Nenhuma verificação de cidade
- Funciona globalmente por tenant
- **RISCO:** Pode criar jobs em cidades sem infraestrutura

**EVENTS (Não Implementado):**
- Nenhuma verificação de cidade
- **RISCO:** Pode criar eventos em cidades sem infraestrutura

**CATALOG (Não Implementado):**
- Nenhuma verificação de cidade
- **RISCO:** Pode criar produtos em cidades sem infraestrutura

**GROUPS (Não Implementado):**
- Nenhuma verificação de cidade
- Funciona globalmente por tenant

### 3.2 Verificações de Pré-requisitos

**Onde DEVERIA existir e NÃO existe:**

1. **Rides - Antes de ativar cidade:**
   - ❌ Verificar se `rides_zones` existem
   - ❌ Verificar se `rides_service_types` estão configurados
   - ❌ Verificar se `rides_pricing_config` existe
   - ❌ Verificar se há motoristas cadastrados

2. **Work - Antes de criar job:**
   - ❌ Verificar se cidade do tenant está ativa
   - ❌ Verificar se há workers na região

3. **Events - Antes de criar evento:**
   - ❌ Verificar se cidade está ativa
   - ❌ Verificar se há organizadores na região

4. **Catalog - Antes de criar produto:**
   - ❌ Verificar se cidade está ativa
   - ❌ Verificar se há merchants na região

### 3.3 Módulos que Podem Quebrar se Ativados Isoladamente

**ALTA PROBABILIDADE:**
1. **Rides** - Se ativado sem:
   - `rides_cities` criadas
   - `rides_zones` definidas
   - `rides_pricing_config` configurado
   - Resultado: Queries retornam vazio, sem erro explícito

2. **Work** - Se ativado sem:
   - `economy` ativo (contas não criadas)
   - Resultado: Transações falham silenciosamente

3. **Groups** - Se ativado sem:
   - `economy` ativo (contas de grupo não criadas)
   - Resultado: Distribuições falham

**MÉDIA PROBABILIDADE:**
1. **Insight** - Se ativado sem:
   - `orchestrator` gerando canonical events
   - Resultado: Retorna array vazio, sem erro

2. **Simulation** - Se ativado sem:
   - `event_log` populado
   - Resultado: Retorna valores zerados, sem erro

**BAIXA PROBABILIDADE:**
1. **Catalog** - Funciona isoladamente (read-only)
2. **Memory** - Funciona isoladamente
3. **Assistant** - Funciona isoladamente (depende apenas de memory)

---

## 4. CONTRATOS ESTRUTURAIS

### 4.1 Eventos Publicados sem Consumidores

**Eventos Órfãos (Publicados, mas sem handlers):**
1. `work.job.created` - ✅ Tem handler (notify, orchestrator)
2. `work.application.created` - ✅ Tem handler (notify)
3. `work.assignment.created` - ✅ Tem handler (notify, orchestrator)
4. `work.assignment.completed` - ✅ Tem handler (notify, orchestrator)
5. `rides.driver.zone.changed` - ❌ **SEM HANDLERS** (apenas publicado)
6. `rides.driver.city.changed` - ❌ **SEM HANDLERS** (apenas publicado)
7. `rides.city.created` - ❌ **SEM HANDLERS** (apenas publicado)
8. `group.created` - ✅ Tem handler (orchestrator)
9. `group.member.joined` - ✅ Tem handler (orchestrator)
10. `group.member.left` - ✅ Tem handler (orchestrator)
11. `group.fund.received` - ✅ Tem handler (orchestrator)
12. `core.review.created` - ✅ Tem handler (reputation)

**Eventos com Handlers Frágeis:**
1. `work.*` - Handlers registrados em `event-bus.ts` (linha 135-136), mas se `notify` não estiver ativo, falha silenciosamente
2. `group.*` - Handlers registrados em `event-bus.ts` (linha 140-143), mas se `orchestrator` não estiver ativo, eventos são perdidos

### 4.2 Eventos Consumidos com Suposições Frágeis

**Suposições Perigosas:**
1. **Reputation Handler:**
   - Assume `payload.entityType` sempre válido
   - Assume `payload.entityId` sempre existe
   - Assume `global_user_id` sempre resolvível
   - **RISCO:** Se review for criado com entityType inválido, falha silenciosamente

2. **Notify Handlers:**
   - Assume `payload.userId` sempre existe
   - Assume templates existem no banco
   - **RISCO:** Se template não existir, falha silenciosamente (try/catch no event-bus)

3. **Orchestrator Adapters:**
   - Assume `payload` sempre tem estrutura esperada
   - **RISCO:** Se evento tiver payload diferente, adapter pode falhar

### 4.3 Policies Declaradas mas Nunca Resolvidas em Runtime

**Policies no Registry:**
1. `economy.regional_split_percentage = 0.10` - ✅ Resolvida em `simulation-engine.ts`
2. `fund.cashback_enabled = true` - ❌ **NUNCA RESOLVIDA** (declarada, mas não usada)
3. `simulation.allowed = true` - ✅ Resolvida em `regional-split.simulation.ts`

**Policies Resolvidas Dinamicamente:**
- `economy.regional_split_percentage` - ✅ Resolvida via `PolicyResolutionEngine` em simulações
- **PROBLEMA:** Apenas simulações usam resolução dinâmica. Work e Rides usam valores hardcoded.

### 4.4 Insights que Não Geram DecisionLog

**Insights Gerados:**
1. `trend` (fund) - ✅ Gera DecisionLog (insight.service.ts linha 72)
2. `projection` (fund) - ✅ Gera DecisionLog (insight.service.ts linha 72)
3. `anomaly` (work) - ✅ Gera DecisionLog (insight.service.ts linha 72)

**PROBLEMA:** Apenas insights de domínio `fund` ou `economy` geram DecisionLog. Insights de `work` geram log, mas outros domínios não.

### 4.5 Simulações que Não Cobrem Eventos Reais

**Simulações Implementadas:**
1. `simulateRegionalSplit15Percent` - ✅ Cobre `payment.processed` events
   - **PROBLEMA:** Apenas eventos de `work` são simulados (filtro `sourceModule: 'work'`)
   - **PROBLEMA:** Não cobre eventos de `rides` ou outros módulos

**Eventos Reais Não Cobertos:**
- `rides.*` - Nenhuma simulação cobre eventos de rides
- `events.*` - Nenhuma simulação cobre eventos de eventos
- `groups.*` - Nenhuma simulação cobre distribuições de grupos

---

## 5. ESTADO REAL DOS MÓDULOS

### 5.1 ATIVO (Funciona Ponta-a-Ponta)

1. **auth** - Login, registro, JWT
2. **rbac** - Permissões, roles, verificação
3. **economy** - Contas, transações, splits, distribuições
4. **work** - Jobs, applications, assignments, pagamentos
5. **rides** - Cidades, zonas, motoristas, veículos, corridas, pricing
6. **groups** - Criação, membros, fundos, distribuições
7. **reviews** - Criação, listagem, agregação
8. **reputation** - Scores, atualização automática via eventos
9. **notify** - Templates, queue, workers, handlers
10. **orchestrator** - Recebe eventos, adapta para canonical, loga
11. **policy** - Registry, leitura, valores
12. **policy-resolution** - Resolve políticas com contexto
13. **insight** - Gera insights de tendência, projeção, anomalia
14. **simulation** - Simula split regional alternativo
15. **decision-log** - Registra observações, persiste em JSON
16. **catalog** - Busca produtos, ofertas (read-only)

### 5.2 PARCIAL (Existe mas Incompleto)

1. **work-instant** - Estrutura existe, mas funcionalidade limitada
2. **events** - CRUD básico, mas sem integração com economy/notify
3. **social** - CRUD básico, integração parcial com work
4. **social-actions** - Estrutura existe, mas funcionalidade limitada
5. **social-chat** - Estrutura existe, mas funcionalidade limitada
6. **schedule** - CRUD básico, mas sem integração com outros módulos
7. **care** - Estrutura existe, mas funcionalidade limitada
8. **assistant** - Integração com memory, mas funcionalidade limitada
9. **orchestrator** - Funciona, mas apenas work e rides têm adapters

### 5.3 PASSIVO (Não Quebra Nada, mas Não Gera Valor)

1. **memory** - Estrutura existe, mas uso limitado
2. **categories** - CRUD básico, mas sem integração
3. **identity** - Resolve global_user_id, mas uso limitado
4. **world** - Geografia, mas uso limitado fora de rides
5. **root-config** - Configuração global, mas uso limitado

### 5.4 MORTO (Código sem Uso Real)

1. **devtools** - Apenas para desenvolvimento
2. **health** - Apenas para monitoramento
3. **instrumentation** - Apenas para métricas

---

## 6. RISCOS SISTÊMICOS

### 6.1 Pontos onde o Sistema pode Entrar em Estado Inválido

**ALTA SEVERIDADE:**
1. **Economy sem Contas:**
   - Se `economy` não criar contas automaticamente, `work` e `rides` falham silenciosamente
   - **Localização:** `work/assignments/assignment.service.ts` (linha 87, 125)
   - **Sintoma:** Transações retornam erro, mas não há verificação prévia

2. **Rides sem Cidade Ativa:**
   - Se cidade não estiver `enabled`, queries retornam vazio
   - **Localização:** `rides/cities/cities.service.ts` (linha 33)
   - **Sintoma:** Nenhuma corrida pode ser criada, sem erro explícito

3. **Orchestrator sem Adapters:**
   - Se adapter não registrar handler, eventos são perdidos
   - **Localização:** `orchestrator/adapters/work.adapter.ts` (linha 142)
   - **Sintoma:** Eventos publicados, mas não transformados em canonical events

4. **Policy Resolution sem Policies:**
   - Se PolicyRegistry não tiver política, retorna null silenciosamente
   - **Localização:** `policy-resolution/policy-resolution-engine.ts` (linha 25)
   - **Sintoma:** Simulações usam valores default, sem aviso

**MÉDIA SEVERIDADE:**
1. **Decision Log sem Diretório:**
   - Se diretório `logs/decisions/` não puder ser criado, falha silenciosamente
   - **Localização:** `decision-log/decision-log.service.ts` (linha 20)
   - **Sintoma:** Observações não são persistidas, sem erro

2. **Notify sem Templates:**
   - Se template não existir, handler falha silenciosamente
   - **Localização:** `notify/handlers/work-notify.handlers.ts`
   - **Sintoma:** Notificações não são enviadas, sem erro

3. **Reputation sem Global User ID:**
   - Se `global_user_id` não puder ser resolvido, falha silenciosamente
   - **Localização:** `reputation/reputation.service.ts` (linha 154)
   - **Sintoma:** Reputação não é atualizada, sem erro

**BAIXA SEVERIDADE:**
1. **Insight sem Eventos:**
   - Se `event_log` estiver vazio, retorna array vazio
   - **Localização:** `insight/insight-engine.ts` (linha 44)
   - **Sintoma:** Nenhum insight gerado, sem erro

2. **Simulation sem Eventos:**
   - Se `event_log` estiver vazio, retorna valores zerados
   - **Localização:** `simulation/simulation-engine.ts` (linha 47)
   - **Sintoma:** Simulação retorna zero, sem erro

### 6.2 Módulos que Assumem Existência de Outros sem Garantia

**CRÍTICAS:**
1. **Work assume Economy:**
   - `work/assignments/assignment.service.ts` chama `transactionService.transfer()` sem verificar se economy está ativo
   - **RISCO:** Se economy não estiver ativo, transações falham

2. **Rides assume Geography:**
   - `rides/location/location.service.ts` usa `rides_cities`, `rides_zones` sem verificar se cidade está ativa
   - **RISCO:** Se cidade não estiver ativa, localização falha silenciosamente

3. **Groups assume Economy:**
   - `groups/groups.service.ts` chama `distributionService.autoDistribute()` sem verificar se economy está ativo
   - **RISCO:** Se economy não estiver ativo, distribuições falham

4. **Orchestrator assume Adapters:**
   - `orchestrator/canonical-orchestrator.service.ts` recebe eventos, mas adapters podem não estar registrados
   - **RISCO:** Se adapter não registrar handler, eventos são perdidos

**MODERADAS:**
1. **Insight assume Orchestrator:**
   - `insight/insight.service.ts` lê `event_log` sem verificar se orchestrator está gerando eventos
   - **RISCO:** Se orchestrator não estiver ativo, insights retornam vazio

2. **Simulation assume Event Log:**
   - `simulation/regional-split.simulation.ts` lê `event_log` sem verificar se está populado
   - **RISCO:** Se event_log estiver vazio, simulação retorna zero

3. **Reputation assume Identity:**
   - `reputation/reputation.service.ts` chama `resolveGlobalUserId()` sem verificar se identity está ativo
   - **RISCO:** Se identity não estiver ativo, reputação falha silenciosamente

### 6.3 Locais onde uma Cidade pode ser "Ativada" sem Infraestrutura Mínima

**RIDES:**
- **Localização:** `rides/cities/cities.service.ts` (linha 33)
- **Problema:** `createCity()` cria cidade com `enabled = true` por padrão
- **Falta:** Verificação de:
  - Zonas definidas
  - Tipos de serviço configurados
  - Pricing configurado
  - Motoristas cadastrados
- **RISCO:** Cidade ativada, mas sem capacidade de processar corridas

**WORK:**
- **Localização:** Nenhuma verificação de cidade
- **Problema:** Jobs podem ser criados em qualquer cidade
- **Falta:** Verificação de:
  - Cidade do tenant está ativa
  - Workers na região
- **RISCO:** Jobs criados em cidades sem workers

**EVENTS:**
- **Localização:** Nenhuma verificação de cidade
- **Problema:** Eventos podem ser criados em qualquer cidade
- **Falta:** Verificação de:
  - Cidade está ativa
  - Organizadores na região
- **RISCO:** Eventos criados em cidades sem infraestrutura

**CATALOG:**
- **Localização:** Nenhuma verificação de cidade
- **Problema:** Produtos podem ser criados em qualquer cidade
- **Falta:** Verificação de:
  - Cidade está ativa
  - Merchants na região
- **RISCO:** Produtos criados em cidades sem merchants

---

## 7. RESUMO EXECUTIVO

### 7.1 Pontos Fortes

1. **Arquitetura Modular:** Módulos bem separados, com dependências claras
2. **Event-Driven:** EventBus centralizado permite desacoplamento
3. **Multi-tenant:** RLS implementado corretamente
4. **Observation Mode:** Sistema de políticas e resolução preparado para governança
5. **Read-only Layers:** Insight, Simulation, Decision Log não alteram produção

### 7.2 Pontos Fracos

1. **Falta de Verificações de Pré-requisitos:** Módulos assumem que dependências estão ativas
2. **Falhas Silenciosas:** Muitos erros são capturados e ignorados (try/catch sem log)
3. **Eventos Órfãos:** Alguns eventos são publicados sem consumidores
4. **Policies Não Utilizadas:** Algumas policies são declaradas mas nunca resolvidas
5. **Ativação por Cidade Incompleta:** Apenas Rides tem verificação de cidade, mas sem pré-requisitos

### 7.3 Riscos de Crescimento

**ALTO RISCO:**
- Sistema pode crescer por cidade, mas cidades podem ser ativadas sem infraestrutura mínima
- Módulos podem ser ativados isoladamente, mas falham silenciosamente se dependências não estiverem ativas

**MÉDIO RISCO:**
- Eventos podem ser publicados sem consumidores, gerando "lixo" no event_log
- Policies podem ser declaradas mas nunca utilizadas, gerando confusão

**BAIXO RISCO:**
- Insights e simulações retornam vazio se não houver dados, mas não quebram o sistema

### 7.4 Recomendações Estruturais (Não Implementação)

1. **City Readiness Check:** Criar função que verifica pré-requisitos antes de ativar cidade
2. **Dependency Verification:** Criar função que verifica se dependências estão ativas antes de usar
3. **Event Consumer Registry:** Registrar quais eventos têm consumidores para detectar órfãos
4. **Policy Usage Tracking:** Rastrear quais policies são realmente utilizadas em runtime
5. **Error Propagation:** Melhorar propagação de erros para evitar falhas silenciosas

---

**FIM DO RELATÓRIO**



