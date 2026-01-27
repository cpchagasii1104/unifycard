# IMPLEMENTAÇÃO: EVENTOS ASSISTIDOS (MVP)
## Frontend - Fluxo de Necessidades de Eventos

**Data:** 2025-01-XX  
**Status:** ✅ Implementado  
**Escopo:** MVP visual para assistência na organização de eventos

---

## ARQUIVOS CRIADOS/MODIFICADOS

### Novos Componentes (6 arquivos)

1. **`frontend/src/components/events/EventNeedsWizard.tsx`** + `.css`
   - Wizard de perguntas condicionais (sim/não)
   - Gera lista de necessidades baseada em respostas
   - Sugestões por tipo de evento

2. **`frontend/src/components/events/EventNeedsList.tsx`** + `.css`
   - Lista de necessidades do evento
   - Permite editar/remover/adicionar itens
   - Exibe status (PENDENTE)

3. **`frontend/src/components/events/EventNeedsOptInModal.tsx`** + `.css`
   - Modal de opt-in após criar evento
   - Pergunta: "Quer ajuda para organizar?"
   - Integra com wizard de necessidades

### Arquivos Modificados (3 arquivos)

4. **`frontend/src/api/events.ts`**
   - Adicionada função `updateEvent()` (PATCH /events/:id)
   - Adicionado tipo `UpdateEventInput`

5. **`frontend/src/components/events/EventCreationWizard.tsx`**
   - Modificado para mostrar modal após criar evento
   - Integração com EventNeedsOptInModal
   - Salva necessidades no metadata do evento

6. **`frontend/src/components/events/EventPage.tsx`**
   - Adicionada seção "Necessidades do Evento"
   - Integração com EventNeedsList
   - Permite editar necessidades

---

## ESTRUTURA DO WIZARD

### EventNeedsWizard

**Fluxo:**
1. Exibe perguntas condicionais (checkboxes)
2. Categorias sugeridas baseadas no tipo de evento
3. Campo "Outros serviços" (texto livre)
4. Gera lista de necessidades
5. Tela de revisão
6. Confirma e salva

**Categorias por tipo de evento:**
- `social`: Decoração, Buffet, Som, Fotografia, Limpeza
- `cultural`: Som, Segurança, Limpeza, Fotografia
- `gastronomic`: Buffet, Decoração, Limpeza
- `professional`: Som, Limpeza, Fotografia
- `sports`: Segurança, Limpeza, Transporte
- `community`: Decoração, Buffet, Som, Limpeza
- `spiritual`: Decoração, Som, Limpeza
- `private`: Decoração, Buffet, Som, Fotografia, Limpeza

---

## EXEMPLO DE METADATA SALVO

```json
{
  "location_type": "physical",
  "location_name": "Parque Central",
  "custom_subtype_text": null,
  "eventNeeds": [
    {
      "id": "need-1234567890-abc123",
      "category": "Decoração",
      "status": "PENDENTE",
      "description": null,
      "createdAt": "2025-01-XXT00:00:00.000Z"
    },
    {
      "id": "need-1234567891-def456",
      "category": "Buffet/Comida",
      "status": "PENDENTE",
      "description": null,
      "createdAt": "2025-01-XXT00:00:00.000Z"
    },
    {
      "id": "need-1234567892-ghi789",
      "category": "Outros",
      "status": "PENDENTE",
      "description": "Transporte para convidados",
      "createdAt": "2025-01-XXT00:00:00.000Z"
    }
  ],
  "needsAssistanceEnabled": true,
  "needsWizardCompleted": true
}
```

---

## FLUXO COMPLETO

### 1. Criação de Evento
- Usuário completa wizard de criação
- Clica em "Salvar rascunho" ou "Publicar"
- Evento é criado no backend

### 2. Modal de Opt-in
- Modal aparece automaticamente após criar evento
- Pergunta: "Quer ajuda para organizar e encontrar fornecedores?"
- Opções: "Sim, preciso de ajuda" / "Não, obrigado"

### 3. Wizard de Necessidades (se SIM)
- Usuário responde perguntas (sim/não)
- Sistema sugere categorias baseado no tipo de evento
- Usuário pode adicionar "Outros serviços"
- Sistema gera lista de necessidades

### 4. Salvamento
- Lista é salva no `metadata.eventNeeds` do evento
- Flags `needsAssistanceEnabled` e `needsWizardCompleted` são setadas
- Usuário é redirecionado para página do evento

### 5. Visualização/Edição
- Página do evento exibe seção "Necessidades do Evento"
- Usuário pode editar/remover/adicionar itens
- Mudanças são salvas via PATCH /events/:id

---

## CHAMADAS DE API

### Endpoints Utilizados (Todos Existentes)

1. **POST /events** (já existia)
   - Criar evento
   - Usado em: EventCreationWizard

2. **POST /events/:id/publish** (já existia)
   - Publicar evento
   - Usado em: EventCreationWizard

3. **GET /events/:id** (já existia)
   - Buscar evento
   - Usado em: EventPage, EventCreationWizard

4. **PATCH /events/:id** (NOVO - adicionado ao client)
   - Atualizar evento (metadata)
   - Usado em: EventCreationWizard, EventPage

---

## GARANTIAS DE QUE NÃO HOUVE MUDANÇA DE DOMÍNIO

### ✅ Regras de Negócio Preservadas

1. **Eventos**
   - ✅ Criação de eventos inalterada
   - ✅ Publicação de eventos inalterada
   - ✅ Status e transições inalterados
   - ✅ Validações do backend mantidas

2. **Metadata**
   - ✅ Apenas armazenamento de dados (não lógica)
   - ✅ Não altera comportamento do evento
   - ✅ Não interfere com outros campos

3. **Necessidades**
   - ✅ Apenas lista de itens (não orçamento)
   - ✅ Status apenas informativo (PENDENTE)
   - ✅ Não cria Service Orders automaticamente
   - ✅ Não cria automações

### ✅ Sem Lógica de Negócio no Frontend

1. **Wizard de Necessidades**
   - ✅ Apenas coleta respostas (sim/não)
   - ✅ Gera lista baseada em respostas
   - ✅ Não valida se necessidade é válida
   - ✅ Não busca fornecedores

2. **Lista de Necessidades**
   - ✅ Apenas CRUD de itens
   - ✅ Não calcula custos
   - ✅ Não cria Service Orders
   - ✅ Não notifica fornecedores

3. **Salvamento**
   - ✅ Apenas atualiza metadata
   - ✅ Não altera status do evento
   - ✅ Não dispara ações automáticas

### ✅ Sem Novos Endpoints

- ✅ Todas as APIs usadas já existiam (exceto PATCH que foi adicionado ao client)
- ✅ Nenhum endpoint novo criado
- ✅ Nenhuma alteração no backend

### ✅ Sem Automações

- ✅ Wizard é manual (usuário responde)
- ✅ Lista é manual (usuário edita)
- ✅ Nenhuma ação automática adicionada
- ✅ Nenhuma notificação automática

---

## FUNCIONALIDADES IMPLEMENTADAS

### ✅ 1. Modal de Opt-in
- [x] Aparece após criar evento
- [x] Pergunta clara sobre assistência
- [x] Opções: SIM / NÃO
- [x] Integração com wizard

### ✅ 2. Wizard de Necessidades
- [x] Perguntas condicionais (sim/não)
- [x] Sugestões por tipo de evento
- [x] Campo "Outros serviços"
- [x] Geração de lista
- [x] Tela de revisão

### ✅ 3. Lista de Necessidades
- [x] Exibição de necessidades
- [x] Edição de itens
- [x] Remoção de itens
- [x] Adição manual de itens
- [x] Status visual (PENDENTE)

### ✅ 4. Integração com Evento
- [x] Salvamento no metadata
- [x] Exibição na página do evento
- [x] Edição na página do evento
- [x] Preservação de outros campos do metadata

---

## OBSERVAÇÕES IMPORTANTES

### Limitações Aceitas (Fora do Escopo)

1. **Não há busca de fornecedores**
   - Lista apenas identifica necessidades
   - Não conecta com fornecedores ainda

2. **Não há orçamento**
   - Apenas lista de necessidades
   - Sem valores ou estimativas

3. **Não há Service Orders automáticas**
   - Necessidades não viram Service Orders automaticamente
   - Conexão é apenas conceitual (futuro)

4. **Não há notificações**
   - Nenhuma notificação automática
   - Usuário precisa verificar manualmente

### Melhorias Futuras (Não Implementadas)

- Busca de fornecedores por necessidade
- Criação de Service Order a partir de necessidade
- Orçamento/estimativas
- Notificações de mudanças
- Integração com agenda de fornecedores

---

## TESTE DE VALIDAÇÃO

### Cenários Testados

1. ✅ Criar evento → Modal aparece
2. ✅ Clicar "Sim" → Wizard abre
3. ✅ Responder perguntas → Lista gerada
4. ✅ Confirmar → Necessidades salvas
5. ✅ Ver evento → Necessidades exibidas
6. ✅ Editar necessidades → Mudanças salvas
7. ✅ Clicar "Não" → Modal fecha, evento criado

### Garantias

- ✅ Nenhuma regra de negócio alterada
- ✅ Nenhum endpoint novo criado
- ✅ Nenhuma automação adicionada
- ✅ Frontend continua sendo apenas leitura + ação explícita

---

**Status:** ✅ MVP Implementado  
**Pronto para:** Testes e validação


