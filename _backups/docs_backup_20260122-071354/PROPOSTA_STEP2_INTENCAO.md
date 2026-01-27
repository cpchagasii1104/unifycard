# 🎯 PROPOSTA: Step 2 Reformulado — "O que você quer que aconteça?"

## Contexto

O Step 2 atual pergunta "Selecione o tipo de evento" e mostra categorias técnicas (Cultural, Gastronômico, Social...).

**Problema:** Usuários pensam em resultado, não em taxonomia. Um show de rock e um churrasco podem ambos ser "reunir pessoas", mas um é cultural e outro é social.

**Solução:** Mudar a pergunta para intenção + derivar automaticamente o `event_type` oficial.

---

## 🧠 Modelo Mental

```
USUÁRIO PENSA          →     SISTEMA DERIVA
─────────────────────────────────────────────
"Quero apresentar"     →     cultural | gastronomic
"Quero reunir"         →     social | community  
"Quero ensinar"        →     professional
"Quero celebrar"       →     private | social
"Quero competir"       →     sports
"Quero inspirar"       →     spiritual
```

O backend **continua recebendo** `event_type: 'cultural'`.
O frontend **traduz** a escolha do usuário.

---

## 🖼️ Design Visual Proposto

### Tela Principal (Step 2)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Step 2 de 5                                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         O que você quer que aconteça?                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │      🎭       │  │      🤝       │  │      🎓       │       │
│  │               │  │               │  │               │       │
│  │  Apresentar   │  │    Reunir     │  │   Ensinar     │       │
│  │    algo       │  │   pessoas     │  │    algo       │       │
│  │               │  │               │  │               │       │
│  │ shows, expo,  │  │ encontros,    │  │ workshops,    │       │
│  │ performances  │  │ networking    │  │ palestras     │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │      🎉       │  │      ⚽       │  │      🙏       │       │
│  │               │  │               │  │               │       │
│  │   Celebrar    │  │   Competir    │  │   Inspirar    │       │
│  │    algo       │  │  / Treinar    │  │ / Conectar    │       │
│  │               │  │               │  │               │       │
│  │ aniversários, │  │ jogos, camp., │  │ retiros,      │       │
│  │ formaturas    │  │ treinos       │  │ meditações    │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                 │
│  ┌───────────────┐                                             │
│  │      🍽️       │                                             │
│  │               │                                             │
│  │  Oferecer     │                                             │
│  │  experiência  │                                             │
│  │  gastronômica │                                             │
│  │               │                                             │
│  │ degustação,   │                                             │
│  │ food truck    │                                             │
│  └───────────────┘                                             │
│                                                                 │
│                                     [Voltar]  [Próximo →]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Derivação

Quando usuário seleciona uma intenção, o sistema pode:

### Opção A: Derivação Direta (mais simples)

| Intenção selecionada | event_type derivado |
|---------------------|---------------------|
| 🎭 Apresentar algo | `cultural` |
| 🤝 Reunir pessoas | `social` |
| 🎓 Ensinar algo | `professional` |
| 🎉 Celebrar algo | `private` |
| ⚽ Competir/Treinar | `sports` |
| 🙏 Inspirar/Conectar | `spiritual` |
| 🍽️ Experiência gastronômica | `gastronomic` |

### Opção B: Sub-seleção Contextual (mais rico)

Se o usuário seleciona **"🎭 Apresentar algo"**, aparece uma sub-pergunta:

```
┌─────────────────────────────────────────────────────────────────┐
│  O que você vai apresentar?                                     │
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │    🎸        │  │    🎨        │  │    🍳        │       │
│  │   Música     │  │    Arte      │  │ Gastronomia  │       │
│  │  show, band  │  │ expo, galeria│  │  degustação  │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                 │
│  → Música/Arte    → event_type: cultural                       │
│  → Gastronomia    → event_type: gastronomic                    │
└─────────────────────────────────────────────────────────────────┘
```

**Recomendação:** Começar com **Opção A** (derivação direta) e evoluir para Opção B se necessário.

---

## 📝 Mapeamento Completo para Implementação

```typescript
// frontend/src/components/events/wizard/intentionMapping.ts

export type Intention = 
  | 'present'      // Apresentar algo
  | 'gather'       // Reunir pessoas
  | 'teach'        // Ensinar algo
  | 'celebrate'    // Celebrar algo
  | 'compete'      // Competir/Treinar
  | 'inspire'      // Inspirar/Conectar
  | 'gastronomy';  // Experiência gastronômica

export type EventType = 
  | 'cultural' 
  | 'gastronomic' 
  | 'social' 
  | 'professional' 
  | 'community' 
  | 'spiritual' 
  | 'sports' 
  | 'private';

export const INTENTION_TO_EVENT_TYPE: Record<Intention, EventType> = {
  present: 'cultural',
  gather: 'social',
  teach: 'professional',
  celebrate: 'private',
  compete: 'sports',
  inspire: 'spiritual',
  gastronomy: 'gastronomic',
};

export const INTENTION_CARDS = [
  {
    id: 'present',
    icon: '🎭',
    label: 'Apresentar algo',
    description: 'Shows, exposições, performances',
    eventType: 'cultural' as EventType,
  },
  {
    id: 'gather',
    icon: '🤝',
    label: 'Reunir pessoas',
    description: 'Encontros, networking, happy hours',
    eventType: 'social' as EventType,
  },
  {
    id: 'teach',
    icon: '🎓',
    label: 'Ensinar algo',
    description: 'Workshops, palestras, conferências',
    eventType: 'professional' as EventType,
  },
  {
    id: 'celebrate',
    icon: '🎉',
    label: 'Celebrar algo',
    description: 'Aniversários, formaturas, festas',
    eventType: 'private' as EventType,
  },
  {
    id: 'compete',
    icon: '⚽',
    label: 'Competir / Treinar',
    description: 'Jogos, campeonatos, treinos',
    eventType: 'sports' as EventType,
  },
  {
    id: 'inspire',
    icon: '🙏',
    label: 'Inspirar / Conectar',
    description: 'Retiros, meditações, cultos',
    eventType: 'spiritual' as EventType,
  },
  {
    id: 'gastronomy',
    icon: '🍽️',
    label: 'Experiência gastronômica',
    description: 'Degustações, food trucks, jantares',
    eventType: 'gastronomic' as EventType,
  },
] as const;
```

---

## 🔐 Regras de Permissão por Actor

A matriz de permissão continua funcionando, mas baseada no `eventType` derivado:

```typescript
// Matriz existente (não muda)
const ACTOR_EVENT_TYPE_MATRIX: Record<EventType, { user: boolean; page: boolean }> = {
  cultural: { user: true, page: true },
  gastronomic: { user: true, page: true },
  social: { user: true, page: false },      // Page não pode criar social
  professional: { user: true, page: true },
  community: { user: true, page: true },
  spiritual: { user: true, page: true },
  sports: { user: true, page: true },
  private: { user: true, page: false },     // Page não pode criar privado
};

// No Step2, filtrar intenções baseado em actor_type
const availableIntentions = INTENTION_CARDS.filter(
  card => ACTOR_EVENT_TYPE_MATRIX[card.eventType]?.[actorType] === true
);
```

---

## ✅ O que NÃO muda (conformidade com governança)

| Aspecto | Status |
|---------|--------|
| Tabela `events` | ❌ Não muda |
| Coluna `event_type` | ❌ Não muda |
| Valores permitidos | ❌ Não muda |
| API de criação | ❌ Não muda |
| CONTRATO v1 | ❌ Não muda |
| Split Engine | ❌ Não muda |

---

## 🚀 Implementação Sugerida

### Arquivo a modificar:
`frontend/src/components/events/wizard/Step2EventType.tsx`

### Mudanças:
1. Importar `INTENTION_CARDS` do novo mapeamento
2. Trocar título de "Tipo de Evento" para "O que você quer que aconteça?"
3. Renderizar cards de intenção em vez de cards de tipo
4. Ao selecionar, chamar `onUpdate({ event_type: card.eventType })`

### Novo arquivo:
`frontend/src/components/events/wizard/intentionMapping.ts`
- Contém constantes e mapeamentos (código acima)

---

## 🧪 Casos de Teste

| Cenário | Intenção | event_type | Resultado esperado |
|---------|----------|------------|-------------------|
| Show de rock | Apresentar algo | cultural | ✅ Correto |
| Churrasco | Celebrar algo | private | ✅ Correto |
| Workshop | Ensinar algo | professional | ✅ Correto |
| Partida de futebol | Competir | sports | ✅ Correto |
| Missa | Inspirar | spiritual | ✅ Correto |
| Degustação de vinho | Gastronômica | gastronomic | ✅ Correto |

---

## 📋 Checklist de Implementação

- [ ] Criar `intentionMapping.ts`
- [ ] Refatorar `Step2EventType.tsx`
- [ ] Manter filtro por actor_type funcionando
- [ ] Testar que backend continua recebendo `event_type` corretamente
- [ ] Atualizar CSS para novo layout de cards

---

## 🧭 Frase-guia

> **O usuário escolhe o que quer fazer.
> O sistema sabe como classificar.**

---

*Proposta criada em 28/12/2024*
*Conformidade: REGULAMENTO_EXECUCAO.md, ANTI_PATTERNS.md, GOLDEN_PATH.md*
*Não viola governança - apenas UX + mapeamento frontend*
