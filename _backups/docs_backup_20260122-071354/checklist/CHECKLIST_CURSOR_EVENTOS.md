# 🔧 CHECKLIST DE IMPLEMENTAÇÃO — CURSOR AI

> **Missão**: Deixar eventos 100% funcional no feed e em /eventos
> **Referência**: `PROPOSTA_STEP2_INTENCAO_FINAL.md`
> **Data**: 28/12/2024

---

## ⚠️ PRÉ-REQUISITO OBRIGATÓRIO

Antes de qualquer código, executar no banco de dados:

```bash
psql $DATABASE_URL < HOTFIX_MIGRATION_070.sql
```

**Verificar sucesso com:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'posts' AND column_name IN ('event_id', 'type', 'visibility');
```

Deve retornar 3 linhas. Se não retornar, **PARAR** e resolver.

---

## 📋 FASE 1: Criar arquivo de mapeamento

### Task 1.1: Criar `intentionMapping.ts`

**Arquivo**: `frontend/src/components/events/wizard/intentionMapping.ts`

**Ação**: Criar arquivo novo com o código exato do documento `PROPOSTA_STEP2_INTENCAO_FINAL.md`

**Checklist**:
- [ ] Arquivo criado
- [ ] Tipos `Intention` e `EventType` definidos
- [ ] Array `INTENTION_CARDS` com 8 cards
- [ ] `ACTOR_INTENTION_MATRIX` preservando regras de permissão
- [ ] Funções helper `getAvailableIntentions()` e `intentionToEventType()`

---

## 📋 FASE 2: Refatorar Step2EventType

### Task 2.1: Atualizar `Step2EventType.tsx`

**Arquivo**: `frontend/src/components/events/wizard/Step2EventType.tsx`

**Mudanças obrigatórias**:

1. **Importar** o novo mapeamento:
```typescript
import { 
  INTENTION_CARDS, 
  getAvailableIntentions, 
  intentionToEventType,
  type Intention 
} from './intentionMapping';
```

2. **Remover** arrays antigos:
- ❌ Remover `EVENT_TYPES`
- ❌ Remover `ACTOR_EVENT_TYPE_MATRIX`

3. **Mudar título**:
```typescript
// ANTES
<h2>Step 2: Tipo de Evento</h2>

// DEPOIS  
<h2>O que você quer que aconteça?</h2>
```

4. **Mudar descrição**:
```typescript
// ANTES
<p>Selecione o tipo de evento que você deseja criar:</p>

// DEPOIS
<p>Escolha o que melhor descreve seu evento:</p>
```

5. **Atualizar lógica de renderização**:
```typescript
const availableIntentions = getAvailableIntentions(actorType);

// No render:
{availableIntentions.map(card => (
  <button
    key={card.id}
    className={`event-type-card ${selectedIntention === card.id ? 'selected' : ''}`}
    onClick={() => handleIntentionSelect(card.id)}
  >
    <div className="event-type-icon">{card.icon}</div>
    <div className="event-type-label">{card.label}</div>
    <div className="event-type-description">{card.description}</div>
  </button>
))}
```

6. **Atualizar handler de seleção**:
```typescript
const handleIntentionSelect = (intentionId: Intention) => {
  const eventType = intentionToEventType(intentionId);
  onUpdate({
    event_type: eventType,
    event_subtype: null,
    custom_subtype_text: null,
  });
};
```

**Checklist**:
- [ ] Imports atualizados
- [ ] Arrays antigos removidos
- [ ] Título mudado
- [ ] Descrição mudada
- [ ] Cards renderizam intenções (não tipos)
- [ ] Handler converte intenção → event_type
- [ ] Backend continua recebendo `event_type` correto

---

## 📋 FASE 3: Unificar fluxos de criação

### Task 3.1: Atualizar modal em EventosPage

**Arquivo**: `frontend/src/pages/EventosPage.tsx`

**Objetivo**: Modal simples deve abrir o wizard, não form próprio

**Opção A (recomendada)**: Remover modal e redirecionar

```typescript
// Substituir onClick do botão "Criar evento"
const handleCreateClick = () => {
  navigate('/events/create'); // Rota do wizard
};

// Remover todo o JSX do modal (linhas ~297-379)
```

**Opção B**: Manter modal como preview, mas abrir wizard

```typescript
// No modal, substituir form por:
<div className="eventos-modal">
  <h2>Criar Evento</h2>
  <p>Vamos criar seu evento passo a passo</p>
  <button onClick={() => navigate('/events/create')}>
    Começar
  </button>
</div>
```

**Checklist**:
- [ ] Modal não cria evento diretamente
- [ ] Clique leva ao wizard
- [ ] Fluxo único de criação garantido

---

## 📋 FASE 4: Verificar rotas

### Task 4.1: Confirmar rota do wizard

**Arquivo**: `frontend/src/App.tsx` (ou equivalente de rotas)

**Verificar**:
```typescript
<Route path="/events/create" element={<EventCreationWizard />} />
```

**Checklist**:
- [ ] Rota `/events/create` existe
- [ ] Componente `EventCreationWizard` é renderizado
- [ ] Não há conflitos de rota

---

## 📋 FASE 5: Atualizar CSS (se necessário)

### Task 5.1: Ajustar grid para 8 cards

**Arquivo**: `frontend/src/components/events/wizard/Step2EventType.css`

**Verificar** que o grid comporta 8 cards (antes eram 8, agora são 8):

```css
.event-types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  /* ... */
}
```

**Checklist**:
- [ ] Grid responsivo funciona com 8 cards
- [ ] Cards não quebram em mobile
- [ ] Visual consistente

---

## 🧪 FASE 6: Testes manuais

### Task 6.1: Testar criação via feed

1. Ir para `/social`
2. Clicar em "Criar evento" (se disponível no feed)
3. Verificar que abre wizard
4. Selecionar cada intenção e verificar que `event_type` correto é enviado

**Checklist**:
- [ ] Wizard abre
- [ ] 8 intenções aparecem (ou menos se page)
- [ ] Seleção funciona
- [ ] Próximo step recebe `event_type` correto

### Task 6.2: Testar criação via /eventos

1. Ir para `/eventos`
2. Clicar em "+ Criar evento"
3. Verificar que abre wizard (não modal antigo)
4. Completar fluxo até revisão

**Checklist**:
- [ ] Botão leva ao wizard
- [ ] Modal antigo não aparece
- [ ] Fluxo completo funciona

### Task 6.3: Testar permissões de actor

1. Logar como Pessoa Física
2. Verificar que todas as 8 intenções aparecem

3. Alternar para Page/Empresa
4. Verificar que "Reunir pessoas" e "Celebrar algo" **NÃO** aparecem

**Checklist**:
- [ ] User vê 8 intenções
- [ ] Page vê 6 intenções (sem social/private)
- [ ] Matriz de permissão funcionando

### Task 6.4: Testar página /eventos carregando

1. Ir para `/eventos`
2. Verificar que **NÃO** aparece erro "coluna p.event_id não existe"
3. Verificar que eventos existentes carregam (se houver)

**Checklist**:
- [ ] Página carrega sem erro
- [ ] Lista de eventos funciona
- [ ] Filtros funcionam (se implementados)

---

## ❌ NÃO FAZER (importante)

- ❌ Não criar campo `intention` no banco
- ❌ Não modificar API de criação de eventos
- ❌ Não criar novos valores de `event_type`
- ❌ Não tocar no Split Engine
- ❌ Não modificar migrations além da 070

---

## 📊 RESUMO DE ARQUIVOS

| Arquivo | Ação |
|---------|------|
| `HOTFIX_MIGRATION_070.sql` | Executar no banco |
| `wizard/intentionMapping.ts` | **CRIAR** |
| `wizard/Step2EventType.tsx` | **MODIFICAR** |
| `wizard/Step2EventType.css` | Verificar (ajustar se necessário) |
| `pages/EventosPage.tsx` | **MODIFICAR** (remover modal) |

---

## ✅ CRITÉRIO DE CONCLUSÃO

A implementação está **COMPLETA** quando:

1. [ ] `/eventos` carrega sem erro de coluna
2. [ ] Wizard mostra intenções (não tipos)
3. [ ] Seleção de intenção envia `event_type` correto ao backend
4. [ ] Permissões por actor funcionam
5. [ ] Não existe mais modal de criação duplicado
6. [ ] Feed e /eventos usam mesmo wizard

---

*Checklist criado em 28/12/2024*
*Para uso exclusivo do Cursor AI*
