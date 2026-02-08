# FLUXO MÍNIMO: EVENTOS ASSISTIDOS
## Criação de Eventos com Assistência para Organização

**Data:** 2025-01-XX  
**Objetivo:** Desenhar fluxo mínimo para criação de eventos com assistência, sem implementar código  
**Status:** 📋 Design

---

## 1. RESUMO DO FLUXO

**Conceito:** Após criar um evento, o sistema oferece assistência para organizar e encontrar fornecedores através de perguntas condicionais, gerando uma lista de necessidades que pode ser conectada futuramente com Service Orders.

**Fluxo Principal:**
1. Usuário cria evento (básico: título, data, local)
2. Sistema pergunta: "Quer ajuda para organizar e encontrar fornecedores?"
3. Se SIM → Perguntas condicionais (sim/não) sobre necessidades
4. Sistema gera LISTA DE NECESSIDADES (não orçamento ainda)
5. Lista fica vinculada ao evento (metadata ou estrutura separada)
6. Conexão conceitual: cada necessidade pode virar Service Order futuramente

**Decisões:**
- **Humanas:** Criar evento, aceitar assistência, responder perguntas, escolher necessidades
- **Sugeridas:** Sistema sugere categorias de necessidades baseado no tipo de evento
- **Sistema:** Armazena lista, vincula ao evento, permite edição

---

## 2. PASSOS NUMERADOS (HUMANO → SISTEMA)

### PASSO 1: Usuário cria evento básico
**Ação humana:**
- Preenche formulário: título, descrição, data/hora início, data/hora fim, localização, tipo de evento
- Clica em "Criar Evento"

**Ação sistema:**
- Valida dados (backend)
- Cria evento com status `DRAFT`
- Retorna evento criado

**Decisão:** ✅ Humana (criar evento)

---

### PASSO 2: Sistema oferece assistência
**Ação sistema:**
- Após criar evento, exibe modal/pergunta:
  - "Quer ajuda para organizar e encontrar fornecedores?"
  - Botões: "Sim, preciso de ajuda" / "Não, obrigado"

**Ação humana:**
- Escolhe SIM ou NÃO

**Decisão:** ✅ Humana (aceitar ou recusar assistência)

---

### PASSO 3A: Se NÃO → Finaliza criação
**Ação sistema:**
- Fecha modal
- Redireciona para página de detalhes do evento
- Evento permanece em `DRAFT` (usuário pode publicar depois)

**Decisão:** ✅ Humana (recusou assistência)

---

### PASSO 3B: Se SIM → Perguntas condicionais
**Ação sistema:**
- Exibe wizard de perguntas (sim/não)
- Perguntas baseadas no tipo de evento (sugestão do sistema)

**Perguntas sugeridas (exemplos):**
- "Você precisa de decoração?" (SIM/NÃO)
- "Você precisa de buffet/comida?" (SIM/NÃO)
- "Você precisa de som/iluminação?" (SIM/NÃO)
- "Você precisa de fotografia/filmagem?" (SIM/NÃO)
- "Você precisa de segurança?" (SIM/NÃO)
- "Você precisa de limpeza pós-evento?" (SIM/NÃO)
- "Você precisa de transporte para convidados?" (SIM/NÃO)
- "Você precisa de outros serviços?" (SIM/NÃO) → Campo texto livre

**Ação humana:**
- Responde SIM ou NÃO para cada pergunta
- Se "outros serviços", preenche texto livre
- Clica em "Gerar Lista de Necessidades"

**Decisão:** ✅ Humana (responde perguntas) | ⚠️ Sugerida (sistema sugere perguntas baseado no tipo de evento)

---

### PASSO 4: Sistema gera lista de necessidades
**Ação sistema:**
- Processa respostas SIM
- Cria LISTA DE NECESSIDADES com:
  - Categoria (ex: "Decoração", "Buffet", "Som/Iluminação")
  - Status: `PENDENTE` (não contratado ainda)
  - Vinculado ao evento

**Estrutura sugerida (metadata do evento ou tabela separada):**
```json
{
  "eventNeeds": [
    {
      "id": "uuid",
      "category": "Decoração",
      "status": "PENDENTE",
      "description": null,
      "createdAt": "2025-01-XX"
    },
    {
      "id": "uuid",
      "category": "Buffet",
      "status": "PENDENTE",
      "description": null,
      "createdAt": "2025-01-XX"
    },
    {
      "id": "uuid",
      "category": "Outros",
      "status": "PENDENTE",
      "description": "Transporte para convidados",
      "createdAt": "2025-01-XX"
    }
  ]
}
```

**Ação sistema:**
- Salva lista no metadata do evento (ou estrutura separada)
- Exibe lista gerada para usuário
- Botão: "Ver Lista de Necessidades" / "Continuar"

**Decisão:** ✅ Sistema (gera lista baseado em respostas)

---

### PASSO 5: Usuário visualiza lista de necessidades
**Ação sistema:**
- Exibe página/tela com lista de necessidades
- Cada item mostra:
  - Categoria
  - Status: `PENDENTE`
  - Ações futuras (não implementadas ainda):
    - "Buscar fornecedores" (futuro)
    - "Criar Service Order" (futuro)
    - "Remover" (já pode)

**Ação humana:**
- Pode editar/remover itens da lista
- Pode adicionar novos itens manualmente
- Pode voltar para editar evento

**Decisão:** ✅ Humana (edita lista)

---

### PASSO 6: Conexão conceitual com Service Orders
**Ação sistema (futuro, não implementado):**
- Cada necessidade pode virar Service Order
- Quando usuário clicar em "Criar Service Order" (futuro):
  - Sistema cria Service Order vinculada à necessidade
  - Service Order tem categoria baseada na necessidade
  - Service Order aparece na agenda do fornecedor

**Conexão com Agenda:**
- Evento já cria Calendar Event quando publicado (backend existente)
- Service Orders criadas a partir de necessidades aparecem na agenda (já implementado)

**Decisão:** ⚠️ Futuro (não implementado ainda)

---

## 3. CAPACIDADES BACKEND REUTILIZADAS

### 3.1. Criação de Eventos (✅ Existente)
**Endpoint:** `POST /events` (ou `/events-sprint76/events`)  
**Módulo:** `backend/src/modules/events/` ou `backend/src/core/events/`  
**Uso:** Criar evento básico (título, data, local, tipo)

**Campos utilizados:**
- `organizerActorId` (ou `actor_id`)
- `title`
- `description`
- `startAt` (ou `datetime_start`)
- `endAt` (ou `datetime_end`)
- `eventType` (ou `event_type`)
- `metadata` ← **Usar para armazenar lista de necessidades**

---

### 3.2. Buscar Evento por ID (✅ Existente)
**Endpoint:** `GET /events/:id`  
**Módulo:** `backend/src/modules/events/` ou `backend/src/core/events/`  
**Uso:** Buscar evento para exibir/editar lista de necessidades

---

### 3.3. Atualizar Evento (✅ Existente)
**Endpoint:** `PATCH /events/:id` (ou `PUT /events/:id`)  
**Módulo:** `backend/src/modules/events/` ou `backend/src/core/events/`  
**Uso:** Atualizar `metadata` com lista de necessidades

---

### 3.4. Publicar Evento (✅ Existente)
**Endpoint:** `POST /events/:id/publish`  
**Módulo:** `backend/src/modules/events/` ou `backend/src/core/events/`  
**Uso:** Publicar evento (já cria Calendar Event automaticamente no backend)

**Observação:** Calendar Event é criado automaticamente ao publicar (backend já implementado)

---

### 3.5. Service Orders (✅ Existente - Conexão Futura)
**Endpoints:** `POST /service-orders`, `GET /service-orders`, etc.  
**Módulo:** `backend/src/modules/services/service-order.*`  
**Uso:** Futuro - Criar Service Order a partir de necessidade

**Conexão:**
- Necessidade → Service Order (futuro)
- Service Order → Calendar Event (já implementado)

---

### 3.6. Calendar Events (✅ Existente - Conexão Automática)
**Endpoints:** `GET /calendar/events`, etc.  
**Módulo:** `backend/src/modules/services/calendar.*`  
**Uso:** Evento publicado cria Calendar Event automaticamente (backend)

---

## 4. TELAS MÍNIMAS NECESSÁRIAS

### 4.1. Criar Evento (ou Wizard de Criação)
**Nome:** `EventCreationPage` ou `CreateEventWizard`  
**Já existe?** ✅ Sim (`frontend/src/pages/EventCreationPage.tsx`)  
**Modificações necessárias:**
- Adicionar passo final: "Quer ajuda para organizar?"
- Se SIM, redirecionar para wizard de necessidades

---

### 4.2. Wizard de Necessidades (NOVO)
**Nome:** `EventNeedsWizard`  
**Componente:** `frontend/src/components/events/EventNeedsWizard.tsx`  
**Funcionalidade:**
- Exibe perguntas condicionais (sim/não)
- Baseado no tipo de evento (sugestão de perguntas)
- Gera lista de necessidades
- Salva no metadata do evento

**Fluxo:**
1. Tela de perguntas (sim/não)
2. Tela de confirmação (lista gerada)
3. Salvar e redirecionar

---

### 4.3. Lista de Necessidades do Evento (NOVO)
**Nome:** `EventNeedsPage`  
**Página:** `frontend/src/pages/EventNeedsPage.tsx`  
**Funcionalidade:**
- Exibe lista de necessidades do evento
- Permite editar/remover itens
- Permite adicionar novos itens manualmente
- Mostra status de cada necessidade (`PENDENTE`)
- Ações futuras (não implementadas): "Buscar fornecedores", "Criar Service Order"

**Rota:** `/events/:id/needs`

---

### 4.4. Detalhes do Evento (MODIFICAR)
**Nome:** `EventDetailPage`  
**Já existe?** Provavelmente sim  
**Modificações necessárias:**
- Adicionar seção "Necessidades do Evento"
- Link para "Ver Lista Completa" → `/events/:id/needs`
- Se não tem necessidades, botão "Adicionar Necessidades"

---

## 5. ESTRUTURA DE DADOS (METADATA)

### 5.1. Armazenamento
**Local:** Campo `metadata` do evento (JSONB)  
**Estrutura:**
```json
{
  "eventNeeds": [
    {
      "id": "uuid",
      "category": "Decoração",
      "status": "PENDENTE",
      "description": null,
      "createdAt": "2025-01-XXT00:00:00Z"
    }
  ],
  "needsAssistanceEnabled": true,
  "needsWizardCompleted": true
}
```

**Alternativa (se metadata não for suficiente):**
- Criar tabela `event_needs` (futuro, se necessário)
- Por enquanto, usar metadata

---

### 5.2. Categorias de Necessidades (Sugestão)
**Baseado no tipo de evento:**
- `Decoração`
- `Buffet/Comida`
- `Som/Iluminação`
- `Fotografia/Filmagem`
- `Segurança`
- `Limpeza`
- `Transporte`
- `Outros` (texto livre)

**Sugestão por tipo de evento:**
- `social` (aniversário, casamento): Decoração, Buffet, Som, Fotografia, Limpeza
- `cultural` (show, exposição): Som, Iluminação, Segurança, Limpeza
- `gastronomic` (degustação): Buffet, Decoração, Limpeza
- `professional` (conferência): Som, Iluminação, Limpeza
- `sports` (campeonato): Segurança, Limpeza, Transporte
- etc.

---

## 6. REGRAS E LIMITAÇÕES

### 6.1. Regras Absolutas (Não Violar)
- ✅ NÃO implementar orçamento ainda
- ✅ NÃO implementar pagamento
- ✅ NÃO implementar automação (sistema não busca fornecedores automaticamente)
- ✅ NÃO criar ranking ou score
- ✅ NÃO violar contratos do feed, agenda, perfil e categorias

### 6.2. Decisões Humanas
- ✅ Usuário decide se quer assistência
- ✅ Usuário responde perguntas (sim/não)
- ✅ Usuário edita lista de necessidades
- ✅ Usuário pode remover necessidades

### 6.3. Sugestões do Sistema
- ⚠️ Sistema sugere perguntas baseado no tipo de evento
- ⚠️ Sistema sugere categorias de necessidades
- ⚠️ Sistema não força nada (usuário pode ignorar sugestões)

### 6.4. Conexão Conceitual (Futuro)
- 🔮 Necessidade → Service Order (futuro)
- 🔮 Service Order → Calendar Event (já implementado)
- 🔮 Evento → Calendar Event (já implementado ao publicar)

---

## 7. FLUXO VISUAL RESUMIDO

```
1. Criar Evento
   ↓
2. "Quer ajuda?" → SIM
   ↓
3. Wizard de Perguntas (sim/não)
   ↓
4. Gerar Lista de Necessidades
   ↓
5. Visualizar/Editar Lista
   ↓
6. (Futuro) Criar Service Orders a partir de necessidades
```

---

## 8. OBSERVAÇÕES IMPORTANTES

### 8.1. Metadata vs Tabela Separada
**Decisão:** Usar `metadata` do evento por enquanto  
**Razão:** Não criar estrutura nova sem necessidade  
**Futuro:** Se necessário, criar tabela `event_needs`

### 8.2. Conexão com Service Orders
**Estado atual:** Apenas conceitual (não implementado)  
**Futuro:** Cada necessidade pode virar Service Order  
**Benefício:** Integração natural com agenda e fornecedores

### 8.3. Conexão com Agenda
**Estado atual:** Automática (backend já implementa)  
**Quando evento é publicado:** Calendar Event é criado automaticamente  
**Service Orders futuras:** Aparecem na agenda do fornecedor (já implementado)

---

**Status:** ✅ Design Concluído  
**Próximo passo:** Aguardar aprovação para implementação


