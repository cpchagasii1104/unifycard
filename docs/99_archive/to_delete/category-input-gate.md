# Category Input Gate - Pipeline de Validação

## Objetivo

Implementar um pipeline obrigatório de validação para categorias profissionais e hobbies que seja:
- 100% síncrono
- Zero aprovação humana no MVP
- Seguro contra conteúdo malicioso
- Escalável (performance e concorrência)
- Semanticamente correto
- Auditável
- Com custo controlado

## Pipeline Obrigatório (Ordem Fixa)

### ETAPA 1 — BLOQUEIO LÉXICO SEGURO (0–2ms)

**Serviço:** `CategoryLexicalGateService`

**Regras:**
- Match APENAS por palavra completa (split por whitespace)
- NUNCA usar substring simples
- Blacklist explícita
- Whitelist para exceções legítimas

**Performance:** 0-2ms (apenas comparações em memória)

**Exemplos:**
- ❌ "punheteiro" → DENY (BLACKLIST_EXACT_MATCH)
- ❌ "ladrão" → DENY (BLACKLIST_WORD_MATCH)
- ✅ "sexólogo" → ALLOW (WHITELIST)

---

### ETAPA 2 — OCCUPATION FORM CHECK (Sintático)

**Serviço:** `OccupationFormCheckerService`

**Heurística obrigatória:**

Aceitar SOMENTE se cumprir pelo menos 1:
1. Sufixos ocupacionais: ista, or(a), eiro(a), ólogo(a), nte, ário(a), dor(a)
2. Prefixos de função: analista de, gerente de, técnico em/de, etc.
3. Estrutura: "cargo + de/em + área" (mínimo 3 palavras)

**Rejeitar:**
- Palavra única sem sufixo ocupacional
- Termos genéricos sem qualificação

**Sugestões:**
- "futebol" → "Jogador de Futebol"
- "cinema" → "Cineasta"
- "marketing" → "Analista de Marketing"

---

### ETAPA 3 — DATASET LOCAL (CBO) + FUZZY MATCH

**Serviço:** `CBOMatcherService`

**Funcionalidades:**
- Busca por similaridade usando `pg_trgm`
- Match exato por sinônimos
- Normalização de gênero (enfermeiro ↔ enfermeira)

**Performance:** <50ms com índices adequados

**Threshold:** Similaridade >= 0.5 para considerar match

---

### ETAPA 4 — EMBEDDINGS SEMÂNTICOS (FALLBACK - OPCIONAL)

**Status:** Implementação futura (não obrigatória para MVP)

**Quando implementar:**
- Usar `pgvector` para busca por similaridade semântica
- Pré-computar embeddings para ocupações conhecidas
- Threshold: >= 0.90 para ACCEPT

---

## Auditoria

**Tabela:** `category_input_audit`

**Campos registrados:**
- `input_original` - Texto original do usuário
- `normalized` - Texto normalizado
- `context` - professional | interest | hobby | education
- `decision` - ALLOW | DENY | REVIEW
- `reason_code` - Código da razão
- `confidence` - Nível de confiança
- `canonical_id` - ID da ocupação CBO (se match)
- `lexical_decision` - Resultado da ETAPA 1
- `form_check_decision` - Resultado da ETAPA 2
- `cbo_match_code` - Código CBO (se match)
- `embedding_similarity` - Similaridade semântica (se aplicável)

---

## Fluxo de Integração

```
createCategoryWithAI()
  ↓
1. Sanitização
  ↓
2. ETAPA 1: Lexical Gate (0-2ms)
  ↓ [DENY → Erro + Auditoria]
3. ETAPA 2: Form Check (0-1ms)
  ↓ [DENY → Erro + Auditoria]
4. ETAPA 3: CBO Match (<50ms)
  ↓ [Match → Vincula canonical_id]
5. suggestCategoryPath (IA)
  ↓
6. Política de Admissão Semântica
  ↓
7. ensureCompleteHierarchy (se ALLOW)
  ↓
8. Auditoria completa
```

---

## Performance Esperada

- **ETAPA 1:** 0-2ms
- **ETAPA 2:** 0-1ms
- **ETAPA 3:** <50ms
- **Total:** <60ms (sem IA)

---

## Testes Obrigatórios

| Input | Contexto | Resultado Esperado |
|-------|----------|-------------------|
| "Futebol" | professional | ❌ DENY (Form Check) |
| "Jogador de Futebol" | professional | ✅ ALLOW |
| "Punheteiro" | professional | ❌ DENY (Lexical) |
| "Dentista" | professional | ✅ ALLOW |
| "Enfermeira" | professional | ✅ ALLOW (CBO match) |
| "Futebol" | interest | ✅ ALLOW (contexto diferente) |

---

## Critério de Done

- ✅ Zero categorias lixo
- ✅ Zero duplicatas
- ✅ Performance estável (<150ms total)
- ✅ Sem falsos positivos óbvios
- ✅ Logs auditáveis
- ✅ Build passa




























