# CONEXÃO MANUAL: EVENTOS → SERVICE ORDERS
## Implementação de Criação Manual de Service Orders a partir de Necessidades

**Data:** 2025-01-XX  
**Status:** ✅ Implementado  
**Escopo:** Conexão manual entre necessidades de eventos e Service Orders

---

## ARQUIVOS ALTERADOS

### Arquivos Modificados (3 arquivos)

1. **`frontend/src/components/events/EventNeedsList.tsx`** + `.css`
   - Adicionado botão "Criar Service Order" em cada necessidade
   - Navegação para CreateServiceOrderPage com parâmetros
   - Prop `eventId` adicionada

2. **`frontend/src/pages/CreateServiceOrderPage.tsx`** + `.css`
   - Aceita query params: `eventId`, `needId`, `needCategory`, `needDescription`
   - Carrega informações do evento automaticamente
   - Preenche campos com dados da necessidade
   - Salva referência ao evento no metadata da Service Order
   - Banner informativo quando vem de evento

3. **`frontend/src/components/events/EventPage.tsx`**
   - Passa `eventId` para EventNeedsList

---

## FLUXO HUMANO PASSO A PASSO

### Passo 1: Usuário visualiza necessidade do evento
**Ação humana:**
- Acessa página do evento
- Vê seção "Necessidades do Evento"
- Visualiza lista de necessidades (ex: "Decoração", "Buffet", etc.)

**O que o usuário vê:**
- Lista de necessidades com status "PENDENTE"
- Botão "Criar Service Order" em cada necessidade

---

### Passo 2: Usuário clica em "Criar Service Order"
**Ação humana:**
- Clica no botão "Criar Service Order" de uma necessidade específica

**Ação sistema:**
- Navega para `/service-orders/new?eventId=...&needId=...&needCategory=...&needDescription=...`
- Carrega informações do evento (título, datas, etc.)

---

### Passo 3: Sistema preenche campos automaticamente
**Ação sistema:**
- Preenche campo "Descrição" com categoria/descrição da necessidade
- Preenche campo "Notas do Cliente" com informações do evento
- Sugere data/hora do evento nos campos de agendamento
- Exibe banner: "Origem: Necessidade do evento • Categoria: [categoria]"

**O que o usuário vê:**
- Formulário pré-preenchido parcialmente
- Banner informativo sobre origem
- Campos ainda editáveis

---

### Passo 4: Usuário completa informações faltantes
**Ação humana:**
- Preenche "ID do Serviço" (obrigatório)
- Preenche "ID do Funcionário" (obrigatório)
- Ajusta data/hora se necessário
- Adiciona localização se necessário
- Pode editar descrição e notas

**Decisão:** ✅ 100% Humana (usuário escolhe serviço e funcionário)

---

### Passo 5: Usuário submete formulário
**Ação humana:**
- Clica em "Criar Ordem"

**Ação sistema:**
- Cria Service Order via `POST /service-orders`
- Salva no metadata:
  ```json
  {
    "eventId": "uuid-do-evento",
    "needId": "uuid-da-necessidade",
    "needCategory": "Decoração",
    "origin": "event_need"
  }
  ```
- Redireciona para página de detalhes da Service Order

---

### Passo 6: Usuário visualiza Service Order criada
**Ação sistema:**
- Exibe Service Order criada
- Mostra todas as informações (incluindo referência ao evento no metadata)

**O que o usuário vê:**
- Service Order com status DRAFT
- Informações do evento preservadas
- Pode confirmar/iniciar normalmente

---

## GARANTIA DE NÃO AUTOMAÇÃO

### ✅ Decisões 100% Humanas

1. **Escolha de Serviço**
   - ✅ Usuário deve informar ID do serviço manualmente
   - ✅ Sistema não sugere serviços
   - ✅ Sistema não busca serviços automaticamente

2. **Escolha de Funcionário**
   - ✅ Usuário deve informar ID do funcionário manualmente
   - ✅ Sistema não sugere funcionários
   - ✅ Sistema não busca funcionários automaticamente

3. **Data/Hora**
   - ✅ Sistema apenas sugere (preenche campos)
   - ✅ Usuário pode alterar livremente
   - ✅ Não há validação automática de conflitos antes de criar

4. **Criação da Service Order**
   - ✅ Apenas quando usuário clica em "Criar Ordem"
   - ✅ Não cria automaticamente
   - ✅ Não cria múltiplas ordens

### ✅ Sem Sugestões Automáticas

1. **Fornecedores**
   - ✅ Não busca fornecedores
   - ✅ Não sugere fornecedores
   - ✅ Não cria ranking de fornecedores

2. **Serviços**
   - ✅ Não busca serviços relacionados
   - ✅ Não sugere serviços baseado na categoria
   - ✅ Não cria serviços automaticamente

3. **Orçamentos**
   - ✅ Não calcula orçamentos
   - ✅ Não sugere valores
   - ✅ Não cria propostas

### ✅ Apenas Preenchimento de Campos

1. **Descrição**
   - ✅ Preenche com categoria/descrição da necessidade
   - ✅ Usuário pode editar
   - ✅ Não valida conteúdo

2. **Notas do Cliente**
   - ✅ Preenche com informações do evento
   - ✅ Usuário pode editar
   - ✅ Não valida conteúdo

3. **Data/Hora**
   - ✅ Sugere data/hora do evento
   - ✅ Usuário pode alterar
   - ✅ Não valida disponibilidade antes de criar

### ✅ Metadata Apenas Informacional

1. **Referência ao Evento**
   - ✅ Apenas armazena IDs (eventId, needId)
   - ✅ Não cria relacionamento automático
   - ✅ Não dispara ações automáticas

2. **Origem**
   - ✅ Flag `origin: "event_need"` apenas informativa
   - ✅ Não altera comportamento da Service Order
   - ✅ Não cria automações

---

## EXEMPLO DE METADATA SALVO

### Service Order criada a partir de necessidade:

```json
{
  "id": "service-order-uuid",
  "serviceId": "service-uuid",
  "workerActorId": "worker-actor-uuid",
  "customerActorId": "customer-actor-uuid",
  "description": "Decoração",
  "customerNotes": "Necessidade do evento: Aniversário de 30 anos\nCategoria: Decoração",
  "metadata": {
    "eventId": "event-uuid",
    "needId": "need-uuid",
    "needCategory": "Decoração",
    "origin": "event_need"
  },
  "status": "DRAFT",
  ...
}
```

---

## CHAMADAS DE API

### Endpoints Utilizados (Todos Existentes)

1. **GET /events/:id** (já existia)
   - Buscar informações do evento
   - Usado em: CreateServiceOrderPage (carregar dados do evento)

2. **POST /service-orders** (já existia)
   - Criar Service Order
   - Usado em: CreateServiceOrderPage (criar ordem)

---

## FUNCIONALIDADES IMPLEMENTADAS

### ✅ 1. Botão "Criar Service Order"
- [x] Aparece em cada necessidade
- [x] Navega com parâmetros do evento/necessidade
- [x] Visível apenas se eventId disponível

### ✅ 2. Preenchimento Automático
- [x] Carrega informações do evento
- [x] Preenche descrição com categoria
- [x] Preenche notas com informações do evento
- [x] Sugere data/hora do evento
- [x] Banner informativo sobre origem

### ✅ 3. Salvamento de Referência
- [x] Salva eventId no metadata
- [x] Salva needId no metadata
- [x] Salva needCategory no metadata
- [x] Salva flag origin: "event_need"

### ✅ 4. Edição Manual
- [x] Usuário pode editar todos os campos
- [x] Usuário deve escolher serviço manualmente
- [x] Usuário deve escolher funcionário manualmente
- [x] Nenhuma sugestão automática

---

## OBSERVAÇÕES IMPORTANTES

### Limitações Aceitas (Fora do Escopo)

1. **Não há busca de serviços**
   - Usuário deve informar ID do serviço
   - Não há sugestão baseada na categoria

2. **Não há busca de funcionários**
   - Usuário deve informar ID do funcionário
   - Não há sugestão de funcionários disponíveis

3. **Não há validação de disponibilidade**
   - Sistema não verifica conflitos antes de criar
   - Validação acontece apenas ao confirmar (backend)

4. **Não há rastreamento de status**
   - Necessidade não muda de status automaticamente
   - Não há conexão bidirecional (Service Order → Necessidade)

### Melhorias Futuras (Não Implementadas)

- Busca/seleção de serviços
- Busca/seleção de funcionários
- Atualização de status da necessidade quando Service Order é criada
- Lista de Service Orders vinculadas a uma necessidade
- Rastreamento de progresso da necessidade

---

## TESTE DE VALIDAÇÃO

### Cenários Testados

1. ✅ Clicar "Criar Service Order" → Navega para formulário
2. ✅ Formulário pré-preenchido com dados do evento
3. ✅ Usuário completa campos obrigatórios
4. ✅ Service Order criada com metadata correto
5. ✅ Referência ao evento preservada
6. ✅ Usuário pode editar todos os campos

### Garantias

- ✅ Nenhuma automação adicionada
- ✅ Nenhuma sugestão automática
- ✅ Todas as decisões são humanas
- ✅ Apenas preenchimento de campos
- ✅ Metadata apenas informacional

---

**Status:** ✅ Implementação Concluída  
**Pronto para:** Testes e validação


