# FLUXO MÍNIMO: SERVICE ORDERS + AGENDA
## Frontend - Exposição de Capacidades Backend

**Data:** 2025-01-XX  
**Escopo:** Service Orders, Availability, Bookings, Calendar por funcionário/empresa  
**Objetivo:** Desenhar fluxo mínimo de frontend sem criar lógica nova

---

## 1. RESUMO DO FLUXO

### Fluxo Principal (Cliente → Funcionário → Empresa)

1. **Cliente solicita serviço** → Cria Service Order (status: DRAFT)
2. **Sistema verifica disponibilidade** → Checa conflitos na agenda do funcionário
3. **Funcionário/Empresa confirma ordem** → Service Order vira CONFIRMED + Calendar Event criado automaticamente
4. **Agenda é reservada** → Calendar Event bloqueia horário na agenda do funcionário
5. **Funcionário visualiza na agenda** → Vê evento vinculado à ordem
6. **Funcionário inicia serviço** → Service Order vira IN_PROGRESS + Calendar Event atualiza
7. **Funcionário completa serviço** → Service Order vira COMPLETED + Calendar Event finaliza

### Fluxos Secundários

- **Bloqueio manual de agenda**: Funcionário/Empresa cria Calendar Event tipo BLOCK/UNAVAILABLE
- **Cancelamento**: Qualquer parte pode cancelar (ordem + evento sincronizados)
- **Visualização de agenda**: Por funcionário (individual) ou empresa (consolidada)

---

## 2. CAPACIDADES BACKEND UTILIZADAS

### 2.1. Service Orders

| Capacidade | Endpoint | Usuário Primário | Momento do Fluxo |
|-----------|----------|------------------|------------------|
| **Criar Ordem** | `POST /service-orders` | Cliente | Início: solicitação de serviço |
| **Listar Ordens** | `GET /service-orders` | Cliente, Funcionário, Empresa | Visualização: lista de ordens |
| **Buscar Ordem** | `GET /service-orders/:id` | Cliente, Funcionário, Empresa | Detalhes: visualização completa |
| **Confirmar Ordem** | `POST /service-orders/:id/confirm` | Funcionário, Empresa | Após verificação: confirmação |
| **Iniciar Ordem** | `POST /service-orders/:id/start` | Funcionário | Execução: início do serviço |
| **Completar Ordem** | `POST /service-orders/:id/complete` | Funcionário | Finalização: conclusão |
| **Cancelar Ordem** | `POST /service-orders/:id/cancel` | Cliente, Funcionário, Empresa | Qualquer momento: cancelamento |

### 2.2. Calendar Events

| Capacidade | Endpoint | Usuário Primário | Momento do Fluxo |
|-----------|----------|------------------|------------------|
| **Criar Evento** | `POST /calendar/events` | Funcionário, Empresa | Bloqueio manual: criar bloqueio/férias |
| **Listar Eventos** | `GET /calendar/events` | Funcionário, Empresa | Visualização: agenda do funcionário |
| **Buscar Evento** | `GET /calendar/events/:id` | Funcionário, Empresa | Detalhes: visualização de evento |
| **Verificar Disponibilidade** | `POST /calendar/availability/check` | Sistema, Funcionário, Empresa | Antes de confirmar: checar conflitos |

### 2.3. Unified Availability (Opcional - Futuro)

| Capacidade | Endpoint | Usuário Primário | Momento do Fluxo |
|-----------|----------|------------------|------------------|
| **Criar Disponibilidade** | `POST /availability` | Funcionário, Empresa | Configuração: horários disponíveis |
| **Listar Disponibilidades** | `GET /availability` | Funcionário, Empresa | Visualização: janelas disponíveis |
| **Atualizar Disponibilidade** | `PUT /availability/:id` | Funcionário, Empresa | Configuração: ajustar horários |

### 2.4. Service Availability (Opcional - Futuro)

| Capacidade | Endpoint | Usuário Primário | Momento do Fluxo |
|-----------|----------|------------------|------------------|
| **Criar Disponibilidade de Serviço** | `POST /services/:id/availability` | Empresa | Configuração: horários do serviço |
| **Listar Disponibilidades** | `GET /services/:id/availability` | Cliente, Empresa | Visualização: horários disponíveis |

---

## 3. FLUXO SEQUENCIAL DETALHADO

### 3.1. Fluxo: Cliente Solicita Serviço

```
1. Cliente acessa página do serviço
   → Visualiza informações do serviço
   → Vê disponibilidade (se configurada)

2. Cliente preenche formulário de solicitação
   → Seleciona data/hora desejada
   → Informa localização (opcional)
   → Adiciona notas/observações

3. Cliente submete solicitação
   → POST /service-orders (status: DRAFT)
   → Sistema retorna ordem criada

4. Cliente vê confirmação
   → "Solicitação enviada, aguardando confirmação"
   → Redireciona para "Minhas Ordens"
```

### 3.2. Fluxo: Funcionário/Empresa Confirma Ordem

```
1. Funcionário/Empresa acessa "Ordens Pendentes"
   → Lista de Service Orders com status DRAFT
   → Filtro por funcionário (se empresa)

2. Funcionário visualiza detalhes da ordem
   → GET /service-orders/:id
   → Vê informações: cliente, serviço, horário, localização

3. Funcionário verifica disponibilidade (opcional, mas recomendado)
   → POST /calendar/availability/check
   → Sistema retorna: disponível ou lista de conflitos

4. Se disponível, Funcionário confirma
   → POST /service-orders/:id/confirm
   → Sistema:
     - Atualiza ordem para CONFIRMED
     - Cria Calendar Event automaticamente
     - Bloqueia horário na agenda

5. Funcionário vê confirmação
   → "Ordem confirmada, evento criado na agenda"
   → Redireciona para agenda ou lista de ordens
```

### 3.3. Fluxo: Funcionário Executa Serviço

```
1. Funcionário acessa "Minha Agenda"
   → GET /calendar/events?actorId={workerActorId}
   → Vê eventos do dia/semana (incluindo SERVICE_ORDER)

2. Funcionário visualiza evento vinculado à ordem
   → Clica no evento → Vê detalhes da Service Order
   → GET /service-orders/:id

3. No horário agendado, Funcionário inicia serviço
   → POST /service-orders/:id/start
   → Sistema:
     - Atualiza ordem para IN_PROGRESS
     - Atualiza Calendar Event para IN_PROGRESS

4. Após conclusão, Funcionário completa serviço
   → POST /service-orders/:id/complete
   → Sistema:
     - Atualiza ordem para COMPLETED
     - Atualiza Calendar Event para COMPLETED
```

### 3.4. Fluxo: Bloqueio Manual de Agenda

```
1. Funcionário/Empresa acessa "Minha Agenda"
   → Visualiza calendário

2. Funcionário cria bloqueio manual
   → Clica em "Bloquear Horário"
   → Preenche: título, data/hora início, data/hora fim, tipo (BLOCK/UNAVAILABLE)

3. Sistema verifica conflitos
   → POST /calendar/availability/check
   → Se conflito, alerta (mas permite criar se usuário confirmar)

4. Sistema cria evento
   → POST /calendar/events (tipo: BLOCK ou UNAVAILABLE)
   → Evento aparece na agenda bloqueando horário
```

### 3.5. Fluxo: Visualização de Agenda por Empresa

```
1. Empresa acessa "Agenda da Empresa"
   → Seleciona funcionário(s) ou "Todos"
   → GET /calendar/events?actorId={workerActorId} (múltiplas chamadas se necessário)

2. Sistema consolida eventos
   → Frontend agrupa eventos por funcionário
   → Exibe calendário consolidado

3. Empresa visualiza conflitos
   → Identifica visualmente sobreposições
   → Pode verificar disponibilidade antes de confirmar ordens
```

---

## 4. TELAS MÍNIMAS NECESSÁRIAS

### 4.1. Service Orders

| Tela | Rota Sugerida | Descrição | Usuários |
|------|---------------|-----------|----------|
| **Lista de Service Orders** | `/service-orders` | Lista todas as ordens (com filtros: status, funcionário, cliente) | Cliente, Funcionário, Empresa |
| **Detalhe de Service Order** | `/service-orders/:id` | Visualização completa da ordem + ações (confirmar, iniciar, completar, cancelar) | Cliente, Funcionário, Empresa |
| **Criar Service Order** | `/service-orders/new` ou modal | Formulário para criar nova ordem (pode ser modal na página do serviço) | Cliente |
| **Minhas Ordens (Cliente)** | `/my-service-orders` | Lista de ordens do cliente logado | Cliente |
| **Ordens Pendentes (Funcionário)** | `/service-orders/pending` | Lista de ordens DRAFT aguardando confirmação | Funcionário, Empresa |

### 4.2. Calendar / Agenda

| Tela | Rota Sugerida | Descrição | Usuários |
|------|---------------|-----------|----------|
| **Agenda do Funcionário** | `/calendar` ou `/calendar/:workerActorId` | Calendário visual (semana/mês) com eventos do funcionário | Funcionário |
| **Agenda da Empresa** | `/company/calendar` | Calendário consolidado de todos os funcionários | Empresa |
| **Detalhe de Calendar Event** | `/calendar/events/:id` | Visualização completa do evento (pode abrir Service Order se vinculado) | Funcionário, Empresa |
| **Criar Bloqueio Manual** | Modal ou `/calendar/events/new` | Formulário para criar evento tipo BLOCK/UNAVAILABLE | Funcionário, Empresa |
| **Verificar Disponibilidade** | Modal ou componente inline | Interface para verificar disponibilidade antes de confirmar ordem | Funcionário, Empresa |

### 4.3. Integração com Serviços (Opcional - Futuro)

| Tela | Rota Sugerida | Descrição | Usuários |
|------|---------------|-----------|----------|
| **Página do Serviço** | `/services/:id` | Detalhes do serviço + botão "Solicitar Serviço" | Cliente |
| **Disponibilidade do Serviço** | Aba na página do serviço | Visualização de horários disponíveis do serviço | Cliente |

---

## 5. COMPONENTES REUTILIZÁVEIS

### 5.1. Componentes de Service Order

- **ServiceOrderCard**: Card de ordem (lista)
- **ServiceOrderDetail**: Detalhes completos da ordem
- **ServiceOrderActions**: Botões de ação (confirmar, iniciar, completar, cancelar)
- **ServiceOrderStatusBadge**: Badge de status (DRAFT, CONFIRMED, etc.)
- **ServiceOrderForm**: Formulário de criação/edição

### 5.2. Componentes de Calendar

- **CalendarView**: Calendário visual (semana/mês)
- **CalendarEventCard**: Card de evento (lista)
- **CalendarEventDetail**: Detalhes do evento
- **AvailabilityChecker**: Modal/componente para verificar disponibilidade
- **BlockEventForm**: Formulário de bloqueio manual

### 5.3. Componentes Compartilhados

- **DateTimePicker**: Seletor de data/hora
- **LocationPicker**: Seletor de localização (endereço, coordenadas)
- **ActorSelector**: Seletor de funcionário (para empresas)
- **StatusFilter**: Filtro de status (DRAFT, CONFIRMED, etc.)

---

## 6. DEPENDÊNCIAS

### 6.1. APIs do Frontend (Criar)

- `frontend/src/api/service-orders.ts` - Cliente para Service Orders
- `frontend/src/api/calendar.ts` - Cliente para Calendar Events

### 6.2. APIs do Frontend (Já Existem)

- `frontend/src/api/availability.ts` - Unified Availability (já existe)
- `frontend/src/api/services.ts` - Services (verificar se existe)

### 6.3. Dependências de Backend

- ✅ Service Orders: 100% implementado
- ✅ Calendar Events: 100% implementado
- ✅ Verificação de Disponibilidade: 100% implementado
- ⚠️ Unified Availability: Implementado, mas pode não estar sendo usado ainda
- ⚠️ Service Availability: Implementado, mas pode não estar sendo usado ainda

### 6.4. Dependências de Dados

- **Actors**: Sistema de actors deve estar funcionando (worker_actor_id, customer_actor_id)
- **Services**: Serviços devem existir (service_id)
- **Companies**: Empresas devem existir (para agenda consolidada)

---

## 7. OBSERVAÇÕES IMPORTANTES

### 7.1. Integração Automática

- **Calendar Event é criado automaticamente** quando Service Order é confirmada
- **Status é sincronizado** entre Service Order e Calendar Event
- **Não precisa criar Calendar Event manualmente** ao confirmar ordem

### 7.2. Verificação de Disponibilidade

- **Recomendado antes de confirmar**, mas não obrigatório (backend valida)
- **Backend bloqueia confirmação** se houver conflito
- **Frontend pode mostrar preview** de disponibilidade antes de confirmar

### 7.3. Permissões

- **Cliente**: Pode criar ordens, ver suas ordens, cancelar suas ordens
- **Funcionário**: Pode ver suas ordens, confirmar, iniciar, completar, cancelar
- **Empresa**: Pode ver todas as ordens dos funcionários, gerenciar agenda consolidada

### 7.4. Estados e Transições

- **DRAFT → CONFIRMED**: Requer ação explícita (confirmar)
- **CONFIRMED → IN_PROGRESS**: Requer ação explícita (iniciar)
- **IN_PROGRESS → COMPLETED**: Requer ação explícita (completar)
- **Qualquer → CANCELLED**: Requer ação explícita (cancelar)

---

## 8. PRÓXIMOS PASSOS (AGUARDAR INSTRUÇÕES)

- [ ] Validar fluxo com stakeholders
- [ ] Criar APIs do frontend (service-orders.ts, calendar.ts)
- [ ] Implementar telas mínimas
- [ ] Testar integração backend → frontend


