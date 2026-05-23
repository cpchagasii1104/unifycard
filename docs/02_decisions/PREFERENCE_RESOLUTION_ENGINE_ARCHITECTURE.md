<!--
STATUS: PROPOSTA — Não implementado
Criado: 2026-04-29
Origem: Gerado por Claude Code (Opus 4.5) a partir de auditoria real do código-fonte
        do UnifiCard. A auditoria leu SRC_FULL e identificou que ProfileInferenceService
        e MatchingService são implementações funcionais mas sem API unificada.

Gap identificado pela auditoria:
  "O ProfileInference e MatchingService são implementações funcionais mas poderiam
   ser unificados em um Preference Resolution Engine centralizado que exponha uma
   API consistente para todos os módulos consumirem."

Pré-requisito técnico confirmado em 2026-04-30:
  O G2 Pipeline E2E PASS validou que concept_id está sendo gravado corretamente
  nas transações financeiras (checkpoint A8). Isso significa que o SSOT semântico
  que o PRE vai consumir está íntegro — conceitos têm UUIDs reais no ledger.

Próximos passos antes de implementar:
  1. Confirmar que ProfileInferenceService e MatchingService são os candidatos
     corretos para unificação (revisar contratos atuais)
  2. Decidir se o PRE é um serviço interno do core ou um módulo separado
  3. Validar que o roteiro de implementação (Seção 10) está alinhado com o
     plano mestre do projeto
  4. Registrar decisão formal no REMEDIATION_DECISIONS_LOG.md antes de iniciar
-->
# PREFERENCE RESOLUTION ENGINE (PRE)
## Arquitetura Normativa para o Unificard

---

## 1. DECLARAÇÃO DE PROPÓSITO

O Preference Resolution Engine (PRE) é a camada de orquestração semântica que converte o perfil unificado de um actor_human em vetores de preferência contextualizados por módulo. Ele é o tradutor entre a identidade semântica do usuário e as necessidades operacionais de cada domínio.

**Princípio constitucional:** O PRE não cria dados. Ele resolve, pondera e distribui dados que já existem nos SSOTs.

---

## 2. POSICIONAMENTO NORMATIVO

```
CONSTITUIÇÃO (12 Artigos)
    ↓
LEI 7 — Governança Semântica
    ↓
SSOT REGISTRY
    ├── CONCEPT (SSOT semântico)
    ├── actors (SSOT identidade)
    ├── bank_ledger (SSOT financeiro)
    └── unified_availability (SSOT temporal)
    ↓
PREFERENCE RESOLUTION ENGINE ← NOVO
    ↓
MÓDULOS CONSUMIDORES
    ├── social (targeting)
    ├── events (sugestão)
    ├── work (matching)
    ├── groups (sugestão)
    ├── rides (personalização)
    ├── catalog (recomendação)
    └── feed (ranking)
```

**Regra de fronteira:** O PRE é um serviço de resolução (read-only em relação aos SSOTs). Ele NÃO persiste preferências — apenas as resolve em tempo de execução.

---

## 3. ESTRUTURA DE DADOS

### 3.1 PreferenceVector (Output do PRE)

```typescript
interface PreferenceVector {
  // Identificação
  globalUserId: string;           // FK → actors.actor_id
  resolvedAt: string;             // ISO 8601 TIMESTAMPTZ
  requestingModule: ModuleType;   // 'social' | 'events' | 'work' | ...
  context: ResolutionContext;     // Contexto da requisição

  // Componentes semânticos
  concepts: WeightedConcept[];    // Conceitos ponderados
  categories: WeightedCategory[]; // Categorias ponderadas

  // Componentes comportamentais
  lifestyle: LifestyleProfile;    // Dados declarados
  demographics: DemographicProfile; // Dados derivados
  behavioralTone: BehavioralTone; // Estado inferido

  // Metadados de resolução
  resolutionMeta: ResolutionMeta; // Como foi resolvido
}

interface WeightedConcept {
  conceptId: string;              // FK → concepts.concept_id
  weight: number;                 // 0.0 - 1.0
  source: ConceptSource;          // De onde veio
  scope: CategoryScope;           // 'physical' | 'learning' | 'professional' | ...
  confidence: number;             // 0.0 - 1.0 (quão certo estamos)
  lastUpdatedAt: string;          // TIMESTAMPTZ
}

interface WeightedCategory {
  categoryId: string;             // FK → categories.id
  weight: number;                 // 0.0 - 1.0
  level: number;                  // 1, 2, 3... (profundidade na árvore)
  scope: CategoryScope;
}

interface LifestyleProfile {
  drinks?: 'never' | 'socially' | 'regularly';
  smokes?: boolean;
  relationshipStatus?: 'single' | 'dating' | 'married' | 'complicated';
  exerciseFrequency?: 'never' | 'sometimes' | 'regularly' | 'daily';
}

interface DemographicProfile {
  ageRange?: { min: number; max: number };
  location?: GeoLocation;
  languages?: string[];
}

type BehavioralTone = 
  | 'explore'      // Descobrir coisas novas
  | 'learn'        // Aprofundar conhecimento
  | 'create'       // Produzir/organizar
  | 'relax'        // Lazer/consumo passivo
  | 'connect'      // Social/interpessoal
  | 'work'         // Produtividade/profissional
  | 'transact';    // Compra/venda

interface ResolutionContext {
  location?: GeoLocation;         // Onde o usuário está
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek?: 'weekday' | 'weekend';
  intent?: string;                // Intenção explícita (texto)
  recentInteraction?: string;     // ID da última interação
}

interface ResolutionMeta {
  sourcesUsed: ConceptSource[];   // Quais fontes foram consultadas
  inferenceDepth: number;         // Quanto do graph foi percorrido
  cacheHit: boolean;              // Veio do cache?
  executionTimeMs: number;        // Performance
}

type ConceptSource = 
  | 'declared_interests'          // global_users.metadata.interests
  | 'declared_learning'           // global_users.metadata.learningPreferences
  | 'memory_preferences'          // user_memory_preferences
  | 'education'                   // user_education
  | 'professional_profile'        // user_companies + work history
  | 'interaction_history'         // likes, saves, clicks
  | 'inferred_from_graph'         // concept_relations
  | 'inferred_from_state'         // profile-inference.service
  | 'inferred_from_behavior';     // padrões de uso

type ModuleType = 
  | 'social' 
  | 'events' 
  | 'work' 
  | 'groups' 
  | 'rides' 
  | 'catalog' 
  | 'feed' 
  | 'care'
  | 'marketplace';
```

---

## 4. ARQUITETURA DO SERVIÇO

### 4.1 Camadas Internas

```
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER (REST/gRPC)                    │
│  POST /resolve                                              │
│  POST /resolve/batch                                        │
│  GET /health                                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              RESOLUTION ORCHESTRATOR                        │
│  - Valida requisição contra normas                          │
│  - Determina estratégia de resolução                        │
│  - Coordena collectors e weighters                          │
│  - Aplica module-specific adjustments                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ COLLECTORS  │ │  WEIGHTERS  │ │  INFERERS   │
│             │ │             │ │             │
│ • Identity  │ │ • Module    │ │ • Graph     │
│ • Memory    │ │   weights   │ │   traversal │
│ • History   │ │ • Temporal  │ │ • State     │
│ • Semantic  │ │   decay     │ │   machine   │
│ • Context   │ │ • Conflict  │ │ • Cross-    │
│             │ │   resolution│ │   domain    │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │
       └───────────────┼───────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              ASSEMBLER (monta PreferenceVector)             │
│  - Deduplica concepts                                       │
│  - Normaliza weights (sum = 1.0 por scope)                  │
│  - Aplica hard constraints (blindagens canônicas)           │
│  - Gera resolutionMeta                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              CACHE LAYER (Redis/PostgreSQL)                 │
│  - TTL: 5 minutos (contexto mutável)                        │
│  - Chave: hash(globalUserId + module + contextSnapshot)     │
│  - Invalidação: evento de mudança de preferência            │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Collectors (Fontes de Dados)

Cada collector é responsável por extrair preferências de um SSOT específico:

| Collector | Fonte | Tipo de Dado | Confiança Base |
|-----------|-------|--------------|----------------|
| IdentityCollector | actors.metadata | Declarado | 0.9 |
| MemoryCollector | user_memory_preferences | Comportamental | 0.7 |
| HistoryCollector | interaction_logs | Comportamental | 0.6 |
| SemanticCollector | concepts + concept_relations | Inferido | 0.5 |
| StateCollector | profile_inference | Inferido | 0.6 |
| ContextCollector | Requisição atual | Contextual | 0.8 |

### 4.3 Module Weights (Ajustes por Módulo)

Cada módulo recebe o mesmo PreferenceVector base, mas com pesos diferentes:

```typescript
const MODULE_WEIGHTS: Record<ModuleType, ModuleWeightConfig> = {
  social: {
    // Para matching de pessoas
    physicalInterests: 0.30,      // 30% — hobbies em comum
    lifestyle: 0.25,              // 25% — compatibilidade de vida
    demographics: 0.20,           // 20% — idade, localização
    learning: 0.10,               // 10% — interesses intelectuais
    professional: 0.10,           // 10% — área de atuação
    behavioralTone: 0.05,         // 5%  — momento de vida
  },
  events: {
    // Para sugestão de eventos
    physicalInterests: 0.35,      // 35% — "gosta de rock"
    behavioralTone: 0.25,         // 25% — "está no modo relax"
    location: 0.20,               // 20% — proximidade
    learning: 0.10,               // 10% — workshops
    professional: 0.05,           // 5%  — networking
    lifestyle: 0.05,              // 5%  — horários compatíveis
  },
  work: {
    // Para matching de trabalho
    professional: 0.40,           // 40% — skills profissionais
    learning: 0.25,               // 25% — direção de carreira
    physicalInterests: 0.15,      // 15% — hobbies correlacionáveis
    reputation: 0.15,             // 15% — reputação cross-domain
    demographics: 0.05,           // 5%  — localização
  },
  groups: {
    // Para sugestão de grupos
    physicalInterests: 0.40,      // 40% — interesses comuns
    learning: 0.30,               // 30% — aprendizado em grupo
    location: 0.20,               // 20% — proximidade
    lifestyle: 0.10,              // 10% — compatibilidade
  },
  rides: {
    // Para personalização de corridas
    location: 0.40,               // 40% — rotas frequentes
    lifestyle: 0.30,              // 30% — preferências (música, conversa)
    behavioralTone: 0.20,         // 20% — modo atual
    demographics: 0.10,           // 10% — necessidades especiais
  },
  catalog: {
    // Para recomendação de produtos
    physicalInterests: 0.35,      // 35% — gostos pessoais
    learning: 0.20,               // 20% — materiais de estudo
    professional: 0.20,           // 20% — ferramentas de trabalho
    behavioralTone: 0.15,         // 15% — modo de compra
    lifestyle: 0.10,              // 10% — hábitos de consumo
  },
  feed: {
    // Para ranking de feed
    behavioralTone: 0.30,         // 30% — momento de vida
    physicalInterests: 0.25,      // 25% — conteúdo relevante
    interactionHistory: 0.25,     // 25% — padrões de engajamento
    learning: 0.10,               // 10% — conteúdo educativo
    professional: 0.10,           // 10% — conteúdo profissional
  },
};
```

---

## 5. FLUXO DE RESOLUÇÃO

### 5.1 Sequência de Execução

```
1. RECEBER REQUISIÇÃO
   Input: { globalUserId, module, context }

2. VALIDAR NORMAS (Gate Obrigatório)
   ✓ actor existe e não está bloqueado
   ✓ module é válido
   ✓ context não viola privacidade (Artigo X)

3. CHECK CACHE
   Se cache hit válido → retornar cached vector

4. COLETAR DADOS (paralelo)
   ├─ IdentityCollector → interests[], learningPreferences{}
   ├─ MemoryCollector → user_memory_preferences[]
   ├─ HistoryCollector → interaction_logs (últimos 90 dias)
   ├─ SemanticCollector → concept_relations (graph depth 2)
   ├─ StateCollector → profile_inference state
   └─ ContextCollector → location, time, intent

5. PONDERAR (por módulo)
   Aplicar MODULE_WEIGHTS[module]
   Aplicar temporal decay (interesses antigos perdem peso)
   Resolver conflitos (ex: "não bebe" vs "bar de cerveja")

6. INFERIR (graph traversal)
   Para cada concept no perfil:
     ├─ Buscar relações 'enables' → adicionar com peso reduzido
     ├─ Buscar relações 'evolves_to' → adicionar com peso reduzido
     └─ Buscar relações 'related_to' → adicionar com peso mínimo

7. ASSEMBLAR
   Deduplicar concepts (soma weights)
   Normalizar (weights por scope somam 1.0)
   Aplicar blindagens canônicas

8. CACHEAR E RETORNAR
   Salvar no cache (TTL 5min)
   Retornar PreferenceVector
```

### 5.2 Exemplo de Resolução Completa

**Cenário:** Maria abre o módulo EVENTOS às 19h em São Paulo

**Input:**
```json
{
  "globalUserId": "uuid-maria",
  "module": "events",
  "context": {
    "location": { "lat": -23.55, "lng": -46.63 },
    "timeOfDay": "evening",
    "dayOfWeek": "weekend"
  }
}
```

**Coleta:**
```
IdentityCollector:
  - interests: ['rock', 'fotografia', 'viagens'] (concept_ids)
  - learningPreferences: { 'fotografia': 'intermediate' }
  - lifestyle: { drinks: 'socially', smokes: false }

MemoryCollector (últimos 90 dias):
  - 'rock': confidence 0.92, usageCount 47
  - 'fotografia': confidence 0.78, usageCount 23
  - 'show': confidence 0.65, usageCount 12

HistoryCollector:
  - 15 likes em posts de shows de rock
  - 8 saves de eventos de fotografia
  - 3 compras de ingressos (último: show de rock)

SemanticCollector (graph depth 2):
  - 'rock' → enables → 'musica-producao' (weight 0.3)
  - 'rock' → related_to → 'show-rock' (weight 0.5)
  - 'fotografia' → enables → 'fotografia-curso' (weight 0.3)
  - 'fotografia' → evolves_to → 'fotografo-profissional' (weight 0.2)

StateCollector:
  - Current state: 'curious' (Physical + Learning)
  - Trending: 'in_transition' (aprendendo mais)

ContextCollector:
  - Sexta à noite em SP → provavelmente quer sair
  - Localização: centro → eventos próximos
```

**Ponderação (módulo EVENTOS):**
```
Concepts ponderados:
  1. show-rock: 0.85 (interesse direto + histórico + contexto noite)
  2. fotografia-exposicao: 0.60 (interesse + learning + menos urgente à noite)
  3. musica-producao: 0.25 (inferido, peso reduzido)
  4. bar-rock: 0.40 (contexto noite + lifestyle social)

Categories ponderadas:
  1. Entretenimento > Música > Rock: 0.90
  2. Arte > Fotografia: 0.55
  3. Lazer > Bares: 0.45

BehavioralTone: 'relax' (sexta à noite) → prioriza lazer
```

**Output (PreferenceVector):**
```json
{
  "globalUserId": "uuid-maria",
  "resolvedAt": "2026-04-30T19:00:00Z",
  "requestingModule": "events",
  "context": { "location": { "lat": -23.55, "lng": -46.63 }, "timeOfDay": "evening" },
  "concepts": [
    { "conceptId": "show-rock", "weight": 0.85, "source": "interaction_history", "scope": "physical", "confidence": 0.92 },
    { "conceptId": "bar-rock", "weight": 0.40, "source": "inferred_from_behavior", "scope": "physical", "confidence": 0.65 },
    { "conceptId": "fotografia-exposicao", "weight": 0.60, "source": "declared_interests", "scope": "physical", "confidence": 0.78 },
    { "conceptId": "musica-producao", "weight": 0.25, "source": "inferred_from_graph", "scope": "learning", "confidence": 0.50 }
  ],
  "categories": [
    { "categoryId": "entretenimento-musica-rock", "weight": 0.90, "level": 3, "scope": "physical" },
    { "categoryId": "arte-fotografia", "weight": 0.55, "level": 2, "scope": "physical" }
  ],
  "lifestyle": { "drinks": "socially", "smokes": false },
  "demographics": { "location": { "lat": -23.55, "lng": -46.63 } },
  "behavioralTone": "relax",
  "resolutionMeta": {
    "sourcesUsed": ["declared_interests", "interaction_history", "inferred_from_graph", "inferred_from_state"],
    "inferenceDepth": 2,
    "cacheHit": false,
    "executionTimeMs": 145
  }
}
```

---

## 6. INTEGRAÇÃO COM MÓDULOS

### 6.1 Como cada módulo consome o PRE

```typescript
// EVENTS — Sugestão de eventos
async function suggestEvents(globalUserId: string, location: GeoLocation) {
  const prefs = await preferenceEngine.resolve({
    globalUserId,
    module: 'events',
    context: { location, timeOfDay: getCurrentTimeOfDay() }
  });

  return eventsService.searchByPreferences({
    conceptIds: prefs.concepts
      .filter(c => c.weight > 0.3)  // Só conceitos relevantes
      .map(c => c.conceptId),
    location: prefs.demographics.location,
    behavioralTone: prefs.behavioralTone,
    // "Shows de rock para quem gosta de rock"
  });
}

// SOCIAL — Matching de pessoas
async function findMatches(globalUserId: string) {
  const prefs = await preferenceEngine.resolve({
    globalUserId,
    module: 'social',
    context: { intent: 'connect' }
  });

  return matchingService.findSimilarUsers({
    conceptOverlap: prefs.concepts,
    lifestyleMatch: prefs.lifestyle,
    demographicRange: prefs.demographics,
    // "João também curte rock e fotografia"
  });
}

// WORK — Sugestão de vagas
async function suggestJobs(globalUserId: string) {
  const prefs = await preferenceEngine.resolve({
    globalUserId,
    module: 'work',
    context: {}
  });

  return workService.suggestJobs({
    professionalSkills: prefs.concepts.filter(c => c.scope === 'professional'),
    correlatedInterests: prefs.concepts.filter(c => c.scope === 'physical'),
    // "Vaga em estúdio de design para fotógrafo amador"
  });
}

// GROUPS — Sugestão de grupos
async function suggestGroups(globalUserId: string) {
  const prefs = await preferenceEngine.resolve({
    globalUserId,
    module: 'groups',
    context: {}
  });

  return groupsService.suggestGroups({
    interests: prefs.concepts.filter(c => c.scope === 'physical'),
    learnings: prefs.concepts.filter(c => c.scope === 'learning'),
    // "Grupo de fotógrafos de shows"
  });
}

// RIDES — Personalização de corridas
async function personalizeRide(globalUserId: string, origin: GeoLocation, destination: GeoLocation) {
  const prefs = await preferenceEngine.resolve({
    globalUserId,
    module: 'rides',
    context: { location: origin }
  });

  return ridesService.findBestDriver({
    route: { origin, destination },
    preferences: {
      music: prefs.concepts.some(c => c.conceptId.includes('rock')),
      conversation: prefs.behavioralTone === 'connect',
      // "Motorista que também curte rock"
    }
  });
}

// CATALOG — Recomendação de produtos
async function recommendProducts(globalUserId: string) {
  const prefs = await preferenceEngine.resolve({
    globalUserId,
    module: 'catalog',
    context: {}
  });

  return catalogService.searchByPreferences({
    conceptIds: prefs.concepts.map(c => c.conceptId),
    behavioralTone: prefs.behavioralTone,
    // "Equipamento de fotografia porque você está aprendendo"
  });
}

// FEED — Ranking de conteúdo
async function rankFeed(globalUserId: string, candidatePosts: Post[]) {
  const prefs = await preferenceEngine.resolve({
    globalUserId,
    module: 'feed',
    context: {}
  });

  return candidatePosts
    .map(post => ({
      post,
      score: calculateRelevance(post, prefs)
    }))
    .sort((a, b) => b.score - a.score);
}
```

---

## 7. BLINDAGENS CANÔNICAS

### 7.1 Regras de Proteção

```typescript
// 🔴 BLINDAGEM 1: Education NÃO participa de matching
// Learning = direção/interesse declarado, NÃO valida competência
function applyCanonicalGuards(vector: PreferenceVector): PreferenceVector {
  // Remover concepts educacionais de matching profissional
  if (vector.requestingModule === 'work') {
    vector.concepts = vector.concepts.filter(
      c => !(c.source === 'education' && c.scope !== 'professional')
    );
  }

  // 🔴 BLINDAGEM 2: Nunca expor dados sensíveis
  // Artigo X — Direito à Opacidade Pessoal
  if (vector.requestingModule !== 'social') {
    delete vector.lifestyle.relationshipStatus;
  }

  // 🔴 BLINDAGEM 3: Não inferir sem consentimento
  // Se usuário optou por não compartilhar localização
  if (userPrivacySettings.location === false) {
    delete vector.demographics.location;
  }

  // 🔴 BLINDAGEM 4: Temporal decay mínimo
  // Interesses não usados há >180 dias são removidos
  vector.concepts = vector.concepts.filter(
    c => daysSince(c.lastUpdatedAt) < 180
  );

  // 🔴 BLINDAGEM 5: Diversidade obrigatória
  // Sempre manter 20% de discovery (nunca 100% filtrado)
  const maxWeight = Math.max(...vector.concepts.map(c => c.weight));
  if (maxWeight > 0.8) {
    // Reduzir peso máximo e distribuir para outros
    redistributeWeights(vector);
  }

  return vector;
}
```

---

## 8. IMPLEMENTAÇÃO SUGERIDA

### 8.1 Estrutura de Arquivos

```
backend/src/core/preference-resolution/
├── preference-resolution.module.ts
├── preference-resolution.service.ts      # Orquestrador principal
├── preference-resolution.controller.ts   # API REST
├── dto/
│   ├── resolve-preferences.dto.ts
│   ├── preference-vector.dto.ts
│   └── resolution-context.dto.ts
├── collectors/
│   ├── base.collector.ts
│   ├── identity.collector.ts
│   ├── memory.collector.ts
│   ├── history.collector.ts
│   ├── semantic.collector.ts
│   ├── state.collector.ts
│   └── context.collector.ts
├── weighters/
│   ├── base.weighter.ts
│   ├── module-weight.config.ts
│   ├── temporal-decay.service.ts
│   └── conflict-resolution.service.ts
├── inferers/
│   ├── graph-traversal.service.ts
│   └── state-inference.service.ts
├── guards/
│   └── canonical-guard.service.ts
└── cache/
    └── preference-cache.service.ts
```

### 8.2 Dependências

```typescript
// preference-resolution.module.ts
@Module({
  imports: [
    // SSOTs (read-only access)
    TypeOrmModule.forFeature([
      Actor,                    // SSOT Identity
      Concept,                  // SSOT Semântico
      ConceptRelation,          // Graph semântico
      Category,                 // Taxonomia
      UserMemoryPreference,     // Preferências aprendidas
      // NÃO importar bank_* — PRE não toca dinheiro
    ]),
    // Serviços existentes
    ProfileInferenceModule,     // Para state detection
    MemoryModule,               // Para user_memory_preferences
  ],
  providers: [
    PreferenceResolutionService,
    IdentityCollector,
    MemoryCollector,
    HistoryCollector,
    SemanticCollector,
    StateCollector,
    ContextCollector,
    TemporalDecayService,
    ConflictResolutionService,
    GraphTraversalService,
    CanonicalGuardService,
    PreferenceCacheService,
  ],
  exports: [PreferenceResolutionService],
})
export class PreferenceResolutionModule {}
```

---

## 9. MÉTRICAS E MONITORAMENTO

### 9.1 KPIs do PRE

| Métrica | Target | Descrição |
|---------|--------|-----------|
| Resolution Time | < 200ms | Tempo médio de resolução |
| Cache Hit Rate | > 60% | % de requisições atendidas pelo cache |
| Inference Depth | 2-3 | Profundidade média do graph traversal |
| Concept Coverage | > 80% | % de usuários com ≥3 concepts resolvidos |
| Cross-Domain Rate | > 30% | % de vetores com concepts de múltiplos scopes |

### 9.2 Logs de Auditoria

```typescript
// Todo resolve() gera log estruturado
{
  event: 'PREFERENCE_RESOLVED',
  actorId: 'uuid-maria',
  module: 'events',
  conceptsCount: 12,
  inferenceDepth: 2,
  executionTimeMs: 145,
  cacheHit: false,
  sources: ['declared_interests', 'interaction_history', 'inferred_from_graph'],
  timestamp: '2026-04-30T19:00:00Z'
}
```

---

## 10. ROTEIRO DE IMPLEMENTAÇÃO

### Fase 1: Infraestrutura (Sprint 1-2)
- [ ] Criar estrutura de diretórios
- [ ] Implementar collectors base
- [ ] Implementar cache layer
- [ ] Testes unitários dos collectors

### Fase 2: Resolução (Sprint 3-4)
- [ ] Implementar orquestrador
- [ ] Implementar weighters por módulo
- [ ] Implementar graph traversal
- [ ] Implementar canonical guards
- [ ] Testes de integração

### Fase 3: Integração (Sprint 5-6)
- [ ] Integrar com módulo EVENTS
- [ ] Integrar com módulo SOCIAL
- [ ] Integrar com módulo WORK
- [ ] Integrar com módulo GROUPS
- [ ] A/B testing de relevância

### Fase 4: Otimização (Sprint 7-8)
- [ ] Otimizar cache hit rate
- [ ] Ajustar module weights com dados reais
- [ ] Implementar feedback loop
- [ ] Monitoramento e alerting

---

## 11. CONCLUSÃO

O Preference Resolution Engine é a peça que falta para ativar o diferencial competitivo do Unificard. Ele não cria nova semântica — apenas resolve e distribui a semântica que já existe nos SSOTs.

**O que o PRE permite:**
- ✅ Cada módulo consumir preferências de forma consistente
- ✅ Cross-domain correlation real (não mockada)
- ✅ Personalização contextual por momento de vida
- ✅ Feedback loop de interações
- ✅ Diferenciação competitiva: "O Unificard conecta tudo"

**O que o PRE NÃO faz (e nunca fará):**
- ❌ Criar SSOT paralelo
- ❌ Modificar bank_ledger
- ❌ Inferir semântica fora de CONCEPT
- ❌ Usar category_id como identidade
- ❌ Persistir preferências (só resolve)

---

*Documento gerado em conformidade com:*
- *LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md (§7)*
- *00_AGENT_PROTOCOL.md (Modo GUARDIÃO)*
- *07_NOMENCLATURA_CANONICA.md*
- *SSOT_REGISTRY_UNIFICARD.md*
