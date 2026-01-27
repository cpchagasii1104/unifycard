# IMPLEMENTAÇÃO: SERVICE ORDERS + AGENDA (MVP)
## Frontend - 4 Telas Mínimas

**Data:** 2025-01-XX  
**Status:** ✅ Implementado  
**Escopo:** MVP visual para expor Service Orders e Agenda

---

## ARQUIVOS CRIADOS/ALTERADOS

### APIs do Frontend (2 arquivos)

1. **`frontend/src/api/service-orders.ts`**
   - Cliente API para Service Orders
   - Funções: create, list, get, confirm, start, complete, cancel
   - Tipos: ServiceOrder, CreateServiceOrderInput, ServiceOrderFilters

2. **`frontend/src/api/calendar.ts`**
   - Cliente API para Calendar Events
   - Funções: create, list, get, checkAvailability
   - Tipos: CalendarEvent, CreateCalendarEventInput, AvailabilityCheckResult

### Páginas (4 arquivos + 4 CSS)

3. **`frontend/src/pages/ServiceOrdersPage.tsx`** + `.css`
   - Lista de Service Orders
   - Filtros por status
   - Visualização por cliente ou funcionário

4. **`frontend/src/pages/ServiceOrderDetailPage.tsx`** + `.css`
   - Detalhe completo da ordem
   - Ações: confirmar, iniciar, completar, cancelar
   - Histórico de transições

5. **`frontend/src/pages/CalendarPage.tsx`** + `.css`
   - Agenda do funcionário
   - Navegação por mês
   - Lista de eventos (SERVICE_ORDER, BLOCK, UNAVAILABLE)

6. **`frontend/src/pages/CreateServiceOrderPage.tsx`** + `.css`
   - Formulário para criar ordem (cliente)
   - Campos: serviço, funcionário, data/hora, localização, descrição

### Rotas (1 arquivo alterado)

7. **`frontend/src/App.tsx`**
   - Adicionadas 4 rotas:
     - `/service-orders` → ServiceOrdersPage
     - `/service-orders/new` → CreateServiceOrderPage
     - `/service-orders/:id` → ServiceOrderDetailPage
     - `/calendar` → CalendarPage

---

## ESTRUTURA DE COMPONENTES

### Service Orders

```
ServiceOrdersPage
├── Filtros (status)
├── Lista de ordens
└── Card de ordem (clicável)

ServiceOrderDetailPage
├── Informações da ordem
├── Histórico
└── Ações (confirmar, iniciar, completar, cancelar)

CreateServiceOrderPage
├── Formulário
└── Validações básicas
```

### Calendar

```
CalendarPage
├── Controles de navegação (mês)
├── Lista de eventos
└── Card de evento (clicável → Service Order se vinculado)
```

---

## CHAMADAS DE API

### Service Orders

| Função | Endpoint | Método | Uso |
|--------|----------|--------|-----|
| `createServiceOrder` | `/service-orders` | POST | Criar ordem (DRAFT) |
| `listServiceOrders` | `/service-orders` | GET | Listar ordens (com filtros) |
| `getServiceOrder` | `/service-orders/:id` | GET | Buscar ordem por ID |
| `confirmServiceOrder` | `/service-orders/:id/confirm` | POST | Confirmar (DRAFT → CONFIRMED) |
| `startServiceOrder` | `/service-orders/:id/start` | POST | Iniciar (CONFIRMED → IN_PROGRESS) |
| `completeServiceOrder` | `/service-orders/:id/complete` | POST | Completar (IN_PROGRESS → COMPLETED) |
| `cancelServiceOrder` | `/service-orders/:id/cancel` | POST | Cancelar |

### Calendar

| Função | Endpoint | Método | Uso |
|--------|----------|--------|-----|
| `createCalendarEvent` | `/calendar/events` | POST | Criar bloqueio manual |
| `listCalendarEvents` | `/calendar/events` | GET | Listar eventos (com filtros) |
| `getCalendarEvent` | `/calendar/events/:id` | GET | Buscar evento por ID |
| `checkAvailability` | `/calendar/availability/check` | POST | Verificar conflitos |

---

## ESTADOS LOCAIS MÍNIMOS

### ServiceOrdersPage
- `orders`: ServiceOrder[] - Lista de ordens
- `isLoading`: boolean - Estado de carregamento
- `error`: string | null - Erro (se houver)
- `statusFilter`: ServiceOrderStatus | 'ALL' - Filtro de status

### ServiceOrderDetailPage
- `order`: ServiceOrder | null - Ordem atual
- `isLoading`: boolean - Estado de carregamento
- `error`: string | null - Erro (se houver)
- `isActioning`: boolean - Estado de ação (confirmar/iniciar/etc)

### CalendarPage
- `events`: CalendarEvent[] - Lista de eventos
- `isLoading`: boolean - Estado de carregamento
- `error`: string | null - Erro (se houver)
- `selectedDate`: Date - Data selecionada (para navegação de mês)

### CreateServiceOrderPage
- `formData`: Partial<CreateServiceOrderInput> - Dados do formulário
- `isSubmitting`: boolean - Estado de submissão

---

## FUNCIONALIDADES IMPLEMENTADAS

### ✅ Service Orders

- [x] Listar ordens (com filtros por status)
- [x] Visualizar detalhes da ordem
- [x] Criar nova ordem (cliente)
- [x] Confirmar ordem (funcionário)
- [x] Iniciar ordem (funcionário)
- [x] Completar ordem (funcionário)
- [x] Cancelar ordem (qualquer parte)

### ✅ Calendar

- [x] Visualizar agenda do funcionário
- [x] Navegar por mês
- [x] Ver eventos vinculados a Service Orders
- [x] Navegar para Service Order a partir do evento

### ⚠️ Não Implementado (Fora do Escopo)

- [ ] Verificação de disponibilidade antes de confirmar (UI)
- [ ] Criar bloqueio manual (UI)
- [ ] Calendário visual (grid)
- [ ] Pagamentos
- [ ] Notificações
- [ ] Redistribuição

---

## DEPENDÊNCIAS

### Backend (100% Pronto)
- ✅ Service Orders endpoints
- ✅ Calendar Events endpoints
- ✅ Verificação de disponibilidade

### Frontend (Criado)
- ✅ API clients (service-orders.ts, calendar.ts)
- ✅ Páginas (4 telas)
- ✅ Rotas (App.tsx)

### Contextos
- ✅ `useActiveActor` - Para identificar actor ativo
- ✅ `showToast` - Para feedback visual

---

## PRÓXIMOS PASSOS (FUTURO)

1. **Melhorias de UX**
   - Calendário visual (grid mensal/semanal)
   - Verificação de disponibilidade antes de confirmar
   - Modal para criar bloqueio manual

2. **Integrações**
   - Link com página de serviços
   - Seleção de funcionário (para empresas)
   - Mapa de localização

3. **Funcionalidades Avançadas**
   - Filtros avançados
   - Exportação de agenda
   - Notificações (quando implementado no backend)

---

## OBSERVAÇÕES

1. **Source of Truth**: Backend é a única fonte de verdade. Frontend apenas exibe e orquestra ações.

2. **Sincronização Automática**: Calendar Event é criado automaticamente ao confirmar Service Order (backend).

3. **Permissões**: Validação de permissões é feita no backend. Frontend apenas habilita/desabilita botões baseado em status.

4. **Estados**: Estados locais são mínimos. Dados sempre vêm do backend após ações.

5. **Erros**: Tratamento básico de erros com toast. Mensagens vêm do backend.

---

**Status:** ✅ MVP Implementado  
**Pronto para:** Testes e validação


