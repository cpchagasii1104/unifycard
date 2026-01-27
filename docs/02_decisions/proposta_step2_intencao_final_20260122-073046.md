# 🎯 PROPOSTA FINAL APROVADA: Step 2 — "O que você quer que aconteça?"

> **Status**: ✅ APROVADO (28/12/2024)
> **Validado por**: Claude + ChatGPT
> **Conformidade**: REGULAMENTO_EXECUCAO.md, ANTI_PATTERNS.md, GOLDEN_PATH.md

---

## 📋 RESUMO EXECUTIVO

O Step 2 do wizard de criação de eventos muda de **"Selecione o tipo de evento"** para **"O que você quer que aconteça?"**.

- **O que muda**: UX e pergunta apresentada ao usuário
- **O que NÃO muda**: Backend, banco de dados, taxonomia oficial, contratos

---

## 🎨 DESIGN FINAL

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
│  │  Apresentar   │  │    Reunir     │  │   Ensinar     │       │
│  │    algo       │  │   pessoas     │  │    algo       │       │
│  │ shows, expo,  │  │ encontros,    │  │ workshops,    │       │
│  │ performances  │  │ networking    │  │ palestras     │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │      🎉       │  │      🏆       │  │      🙏       │       │
│  │   Celebrar    │  │   Competir    │  │   Inspirar    │       │
│  │    algo       │  │  / Desafiar   │  │ / Conectar    │       │
│  │ aniversários, │  │ campeonatos,  │  │ retiros,      │       │
│  │ formaturas    │  │ rallys        │  │ meditações    │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐                          │
│  │      🍽️       │  │      📣       │                          │
│  │  Experiência  │  │   Promover    │                          │
│  │  gastronômica │  │  / Divulgar   │                          │
│  │ degustações,  │  │ lançamentos,  │                          │
│  │ food trucks   │  │ ativações     │                          │
│  └───────────────┘  └───────────────┘                          │
│                                                                 │
│                                     [Voltar]  [Próximo →]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 CÓDIGO DE IMPLEMENTAÇÃO

### Arquivo: `frontend/src/components/events/wizard/intentionMapping.ts`

```typescript
// intentionMapping.ts
// Mapeamento de intenções (UX) para event_types (backend)
// APROVADO: 28/12/2024

export type Intention = 
  | 'present'      // Apresentar algo
  | 'gather'       // Reunir pessoas
  | 'teach'        // Ensinar algo
  | 'celebrate'    // Celebrar algo
  | 'compete'      // Competir / Desafiar
  | 'inspire'      // Inspirar / Conectar
  | 'gastronomy'   // Experiência gastronômica
  | 'promote';     // Promover / Divulgar

export type EventType = 
  | 'cultural' 
  | 'gastronomic' 
  | 'social' 
  | 'professional' 
  | 'community' 
  | 'spiritual' 
  | 'sports' 
  | 'private';

export interface IntentionCard {
  id: Intention;
  icon: string;
  label: string;
  description: string;
  eventType: EventType;
}

export const INTENTION_CARDS: readonly IntentionCard[] = [
  {
    id: 'present',
    icon: '🎭',
    label: 'Apresentar algo',
    description: 'Shows, exposições, performances',
    eventType: 'cultural',
  },
  {
    id: 'gather',
    icon: '🤝',
    label: 'Reunir pessoas',
    description: 'Encontros, networking, happy hours',
    eventType: 'social',
  },
  {
    id: 'teach',
    icon: '🎓',
    label: 'Ensinar algo',
    description: 'Workshops, palestras, cursos',
    eventType: 'professional',
  },
  {
    id: 'celebrate',
    icon: '🎉',
    label: 'Celebrar algo',
    description: 'Aniversários, formaturas, festas',
    eventType: 'private',
  },
  {
    id: 'compete',
    icon: '🏆',
    label: 'Competir / Desafiar',
    description: 'Campeonatos, rallys, competições',
    eventType: 'sports',
  },
  {
    id: 'inspire',
    icon: '🙏',
    label: 'Inspirar / Conectar',
    description: 'Retiros, meditações, cultos',
    eventType: 'spiritual',
  },
  {
    id: 'gastronomy',
    icon: '🍽️',
    label: 'Experiência gastronômica',
    description: 'Degustações, jantares, food trucks',
    eventType: 'gastronomic',
  },
  {
    id: 'promote',
    icon: '📣',
    label: 'Promover / Divulgar',
    description: 'Lançamentos, ativações, test drives',
    eventType: 'community',
  },
] as const;

// Matriz de permissões por actor_type (preservada do sistema atual)
export const ACTOR_INTENTION_MATRIX: Record<Intention, { user: boolean; page: boolean }> = {
  present: { user: true, page: true },
  gather: { user: true, page: false },      // Page não pode criar social
  teach: { user: true, page: true },
  celebrate: { user: true, page: false },   // Page não pode criar privado
  compete: { user: true, page: true },
  inspire: { user: true, page: true },
  gastronomy: { user: true, page: true },
  promote: { user: true, page: true },
};

// Helper: filtrar intenções disponíveis para um actor_type
export function getAvailableIntentions(actorType: 'user' | 'page'): IntentionCard[] {
  return INTENTION_CARDS.filter(
    card => ACTOR_INTENTION_MATRIX[card.id]?.[actorType] === true
  );
}

// Helper: obter event_type a partir de intention
export function intentionToEventType(intention: Intention): EventType {
  const card = INTENTION_CARDS.find(c => c.id === intention);
  if (!card) {
    throw new Error(`Intention inválida: ${intention}`);
  }
  return card.eventType;
}
```

---

## 🔄 MAPEAMENTO OFICIAL

| Intenção (UX) | event_type (Backend) | Descrição |
|---------------|---------------------|-----------|
| 🎭 Apresentar algo | `cultural` | Shows, exposições, performances |
| 🤝 Reunir pessoas | `social` | Encontros, networking, happy hours |
| 🎓 Ensinar algo | `professional` | Workshops, palestras, cursos |
| 🎉 Celebrar algo | `private` | Aniversários, formaturas, festas |
| 🏆 Competir / Desafiar | `sports` | Campeonatos, rallys, competições |
| 🙏 Inspirar / Conectar | `spiritual` | Retiros, meditações, cultos |
| 🍽️ Experiência gastronômica | `gastronomic` | Degustações, jantares, food trucks |
| 📣 Promover / Divulgar | `community` | Lançamentos, ativações, test drives |

---

## 🧪 CASOS DE TESTE VALIDADOS

| # | Caso Real | Intenção | event_type | Status |
|---|-----------|----------|------------|--------|
| 1 | Show de rock | 🎭 Apresentar | cultural | ✅ |
| 2 | Churrasco com amigos | 🎉 Celebrar | private | ✅ |
| 3 | Evento automotivo (Red Bull) | 📣 Promover | community | ✅ |
| 4 | Evento de moto (encontro) | 🤝 Reunir | social | ✅ |
| 5 | Campeonato esportivo | 🏆 Competir | sports | ✅ |
| 6 | Evento escolar (formatura) | 🎉 Celebrar | private | ✅ |
| 7 | Evento escolar (feira) | 🎭 Apresentar | cultural | ✅ |
| 8 | Evento religioso (missa) | 🙏 Inspirar | spiritual | ✅ |
| 9 | Evento religioso (retiro) | 🙏 Inspirar | spiritual | ✅ |
| 10 | Encontro de colecionadores | 🤝 Reunir | social | ✅ |

**Cobertura: 10/10 casos**

---

## ✅ CONFORMIDADE COM GOVERNANÇA

| Documento | Status | Verificação |
|-----------|--------|-------------|
| REGULAMENTO_EXECUCAO.md | ✅ | Não cria tipo persistido, usa CORE |
| ANTI_PATTERNS.md | ✅ | Não cria motor paralelo, não calcula no frontend |
| GOLDEN_PATH.md | ✅ | Feed continua como HUB, fluxo preservado |

---

## ❌ O QUE NÃO FOI FEITO (por design)

- ❌ Não criou campo `intention` no banco
- ❌ Não criou nova taxonomia de `event_type`
- ❌ Não criou sub-seleções (adiado para futuro)
- ❌ Não mudou API de criação de eventos
- ❌ Não mudou Split Engine

---

## 📅 HISTÓRICO

| Data | Evento |
|------|--------|
| 28/12/2024 | Proposta inicial (Claude) |
| 28/12/2024 | Refinamentos aplicados (Claude) |
| 28/12/2024 | Validação governança (ChatGPT) |
| 28/12/2024 | **APROVADO** |

---

*Documento oficial de referência para implementação*
