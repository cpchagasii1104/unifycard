# Auditoria Completa: Módulo de Aprendizado

**Data**: 2024-12-19  
**Escopo**: Backend + Frontend + Integrações

---

## 1. ONDE O APRENDIZADO VIVE NO CÓDIGO

### Backend

| Arquivo | Função | Localização |
|---------|--------|-------------|
| `src/core/profile/profile-learning.types.ts` | Tipos TypeScript | Definições de `LearningProfile`, `LearningCategory`, `UpdateLearningProfileInput` |
| `src/core/profile/profile-learning.service.ts` | Lógica de negócio | `getLearningProfile()`, `updateLearningProfile()` |
| `src/core/profile/profile-learning.routes.ts` | Endpoints REST | `GET /profile/learning`, `PUT /profile/learning` |
| `src/core/profile/profile-inference.service.ts` | Inferências entre trilhas | Usa `learning` para detectar estado do usuário |
| `src/core/opportunity/opportunity.service.ts` | Oportunidades contextuais | Usa `learningProfile` para gerar oportunidades |
| `src/core/feed/feed.service.ts` | Feed contextual | Usa estado inferido (que inclui learning) para gerar conteúdo |
| `src/core/matching/matching.service.ts` | Matching humano | Usa estado inferido (que inclui learning) para sugerir conexões |
| `src/core/core.service.ts` | Perfil completo | Inclui `learningProfile` no score de completude (10%) |

### Frontend

| Arquivo | Função | Localização |
|---------|--------|-------------|
| `c:/unificard/frontend/src/api/learning.ts` | Cliente API | `getLearningProfile()`, `updateLearningProfile()` |
| `c:/unificard/frontend/src/components/ProfileLearning.tsx` | Componente UI | Aba "Aprendizado" no Profile |
| `c:/unificard/frontend/src/components/Profile.tsx` | Integração | Registra aba "Aprendizado" |

### Persistência

- **Armazenamento**: `global_users.metadata` (JSONB)
- **Campos**: `metadata.learnings`, `metadata.learningPreferences`, `metadata.learningMetadata`
- **Estrutura**: Array de categorias com `categoryId`, `categoryName`, `categoryPath`, `level`, `preferences`

---

## 2. DADOS COLETADOS EXATAMENTE

### Estrutura de Dados

```typescript
interface LearningProfile {
  globalUserId: string;
  learnings: LearningCategory[]; // Array de categorias selecionadas
  preferences: {
    [categoryId: string]: {
      details?: string[];        // Ex: ["Básico", "Intermediário"]
      notes?: string;            // Observações sobre o aprendizado
      progress?: 'beginner' | 'intermediate' | 'advanced' | null; // Nível de progresso
    };
  };
  metadata: Record<string, any>; // Dados adicionais flexíveis
}

interface LearningCategory {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  level: number;
  preferences?: {
    progress?: 'beginner' | 'intermediate' | 'advanced' | null;
    details?: string[];
    notes?: string;
  };
}
```

### Dados Coletados

1. **Categorias de Aprendizado** (`learnings[]`)
   - `categoryId`: UUID da categoria
   - `categoryName`: Nome da categoria
   - `categoryPath`: Caminho hierárquico (ex: ["Criatividade", "Fotografia"])
   - `level`: Nível hierárquico (0 = raiz, 1+ = filhos)

2. **Preferências por Categoria** (`preferences[categoryId]`)
   - `progress`: Nível de progresso (`beginner`, `intermediate`, `advanced`, `null`)
   - `details`: Array de strings (ex: ["Básico", "Intermediário"])
   - `notes`: Texto livre com observações

3. **Metadata** (`metadata`)
   - Campo genérico `Record<string, any>` para dados adicionais

### Fonte dos Dados

- **Categorias**: Tabela `categories` com `scope = 'learning'`
- **Seleção**: Usuário seleciona categorias via UI (`ProfileLearning.tsx`)
- **Persistência**: Armazenado em `global_users.metadata` (JSONB)

---

## 3. COMO ESTÁ SENDO TRATADO

### ✅ Como Interesse

**Evidência**:
- Usado em `profile-inference.service.ts` para detectar estado `curious` (Físico + Aprendizado)
- Usado em `feed.service.ts` para gerar "Conteúdo de Aprendizado"
- Usado em `matching.service.ts` para gerar "Matching de Aprendizado"

**Status**: ✅ **CORRETO** - Tratado como interesse/direção

### ⚠️ Como Capacidade (RISCO)

**Evidência**:
- Campo `progress` (`beginner`, `intermediate`, `advanced`) sugere capacidade/nível
- Usado em `opportunity.service.ts` como **gatekeeper**: oportunidades só aparecem se `hasIntermediateOrAdvanced === true`
- Usado em `profile-inference.service.ts` para sugerir transição para profissional baseado em progresso

**Status**: ⚠️ **RISCO** - Pode virar capacidade ao invés de interesse

### ❌ Como Progresso (RISCO)

**Evidência**:
- Campo `progress` é explícito: `'beginner' | 'intermediate' | 'advanced'`
- Usado para **filtrar** oportunidades (linha 47-49 de `opportunity.service.ts`)
- Usado para **sugerir** transição profissional (linha 215-236 de `profile-inference.service.ts`)

**Status**: ❌ **RISCO ALTO** - Já está sendo usado como progresso/capacidade

### ⚠️ Como Score (RISCO INDIRETO)

**Evidência**:
- `core.service.ts` linha 644-656: Aprendizado contribui com **10% do score de completude**
- Score calculado como: `learningScore = learningProfile?.learnings?.length > 0 ? 10 : 0`
- Não usa `progress` no score, mas usa **presença de aprendizados**

**Status**: ⚠️ **RISCO BAIXO** - Contribui para score de completude, mas não usa progresso

---

## 4. CONEXÕES COM FEED / OPORTUNIDADES / MATCHING

### Feed Contextual (`feed.service.ts`)

**Uso**:
- Linha 51: Gera "Conteúdo de Aprendizado" se `userState === 'curious' || 'in_transition' || 'professional_training'`
- **Não usa diretamente** `learningProfile`, usa apenas `userState` (que é inferido de learning)

**Risco**: ✅ **BAIXO** - Feed é sugestivo, não decisório

### Oportunidades (`opportunity.service.ts`)

**Uso**:
- Linha 36: Busca `learningProfile` diretamente
- Linha 47-49: **GATEKEEPER**: `hasIntermediateOrAdvanced` é obrigatório
- Linha 54: **BLOQUEIO**: Se `!hasIntermediateOrAdvanced`, retorna array vazio
- Linha 88: Usa `hasIntermediateOrAdvanced` para gerar oportunidades profissionais

**Risco**: ❌ **ALTO** - Progresso é usado como **gatekeeper** para oportunidades

**Código crítico**:
```typescript
const hasIntermediateOrAdvanced = learningProfile.learnings.some(
  l => l.preferences?.progress === 'intermediate' || l.preferences?.progress === 'advanced'
);

// Se qualquer condição falhar → não retorna oportunidades
if (!hasActiveLearning || !hasIntermediateOrAdvanced || !hasProfessionalAffinity) {
  return { opportunities: [], hasMore: false };
}
```

### Matching (`matching.service.ts`)

**Uso**:
- Linha 40: Gera "Matching de Aprendizado" se `userState === 'curious' || 'in_transition' || 'professional_training'`
- **Não usa diretamente** `learningProfile`, usa apenas `userState`

**Risco**: ✅ **BAIXO** - Matching é sugestivo, não decisório

### Inferências (`profile-inference.service.ts`)

**Uso**:
- Linha 112-114: Calcula `hasIntermediateOrAdvanced` no snapshot
- Linha 215-236: **SUGESTÃO DE TRANSIÇÃO**: Se `hasIntermediateOrAdvanced && professional.count === 0`, sugere considerar como profissão
- Linha 146-147: Detecta estado `professional_training` se `learning.count > 0 && professional.count > 0`
- Linha 151-152: Detecta estado `in_transition` se `learning.count > 0 && professional.count === 0`

**Risco**: ⚠️ **MÉDIO** - Progresso influencia sugestões de transição profissional

---

## 5. RISCOS IDENTIFICADOS

### ❌ RISCO 1: Virar Score

**Evidência**:
- `core.service.ts` linha 644-656: Aprendizado contribui com 10% do score de completude
- Score baseado em **presença** de aprendizados, não em progresso

**Severidade**: ⚠️ **BAIXA** - Contribui para score, mas não usa progresso diretamente

**Mitigação necessária**: Remover contribuição de aprendizado para score de completude (se conforme contratos)

---

### ❌ RISCO 2: Virar Gatekeeper

**Evidência**:
- `opportunity.service.ts` linha 47-54: **BLOQUEIO HARD** - Oportunidades só aparecem se `hasIntermediateOrAdvanced === true`
- Usuários com `progress === 'beginner'` ou `null` são **excluídos** de oportunidades

**Severidade**: ❌ **ALTA** - Progresso é usado como **gatekeeper** para oportunidades

**Código problemático**:
```typescript
// Se qualquer condição falhar → não retorna oportunidades
if (!hasActiveLearning || !hasIntermediateOrAdvanced || !hasProfessionalAffinity) {
  return { opportunities: [], hasMore: false };
}
```

**Mitigação necessária**: Remover gatekeeper de progresso, tornar oportunidades sugestivas (não bloqueantes)

---

### ⚠️ RISCO 3: Virar Educação Disfarçada

**Evidência**:
- Campo `progress` (`beginner`, `intermediate`, `advanced`) é **hierárquico** e **avaliativo**
- Usado para **sugerir transição profissional** baseado em nível
- Estrutura similar a educação: categorias, níveis, progresso

**Severidade**: ⚠️ **MÉDIA** - Estrutura similar a educação, mas propósito diferente (interesse vs. formação)

**Mitigação necessária**: Garantir que aprendizado não seja usado como validação de competência

---

### ⚠️ RISCO 4: Virar Capacidade ao Invés de Interesse

**Evidência**:
- Campo `progress` sugere **capacidade** (o que você sabe) ao invés de **interesse** (o que você quer aprender)
- Usado para **filtrar** oportunidades (gatekeeper)
- Usado para **sugerir** transição profissional

**Severidade**: ⚠️ **MÉDIA** - Progresso pode ser interpretado como capacidade

**Mitigação necessária**: Renomear ou redefinir `progress` para enfatizar **direção/interesse** ao invés de **capacidade**

---

## 6. LACUNAS PARA AUTODIREÇÃO / INTERESSE REAL / SUGESTÕES FUTURAS

### ✅ Qualidades Existentes

1. **Estrutura de Categorias Hierárquica**
   - Permite seleção flexível de temas de aprendizado
   - Suporta categorias customizadas via AI

2. **Preferências por Categoria**
   - Permite detalhamento por categoria
   - Campo `notes` permite contexto livre

3. **Integração com Inferências**
   - Sistema detecta estados baseados em learning
   - Sugere transições entre trilhas

4. **Feed Contextual**
   - Gera conteúdo baseado em estado inferido
   - Não é decisório (sugestivo)

---

### ❌ Lacunas Identificadas

#### 1. Autodireção

**Problema**: Campo `progress` é **avaliativo** (beginner/intermediate/advanced), não **direcional**

**Lacuna**: Falta campo para expressar **intenção/direção**:
- "Quero aprender X"
- "Estou explorando Y"
- "Tenho interesse em Z"

**Sugestão**: Adicionar campo `intent` ou `direction` ao invés de (ou além de) `progress`

---

#### 2. Interesse Real

**Problema**: `progress` sugere **capacidade** (o que você sabe), não **interesse** (o que você quer)

**Lacuna**: Falta distinção entre:
- "Estou aprendendo X" (ativo)
- "Quero aprender X" (intenção)
- "Já sei X" (capacidade - não deveria estar aqui)

**Sugestão**: Adicionar campo `status` ou `phase`:
- `exploring`: Explorando interesse
- `learning`: Aprendendo ativamente
- `practicing`: Praticando

---

#### 3. Base para Sugestões Futuras

**Problema**: Sistema usa `progress` para **filtrar** (gatekeeper), não para **sugerir**

**Lacuna**: Falta mecanismo para:
- Sugerir próximos passos baseados em interesse
- Conectar pessoas com interesses similares (sem filtrar por progresso)
- Sugerir recursos baseados em direção (não em nível)

**Sugestão**: Usar `categoryPath` e `interests` para matching, não `progress`

---

#### 4. Temporalidade

**Problema**: Não há campo para expressar **quando** ou **por quanto tempo** o interesse existe

**Lacuna**: Falta distinção entre:
- Interesse recente (explorando)
- Interesse de longo prazo (direção)
- Interesse temporário (experimentando)

**Sugestão**: Adicionar campo `startedAt` ou `interestDuration`

---

#### 5. Contexto de Aprendizado

**Problema**: Campo `notes` é genérico, não captura **contexto** de aprendizado

**Lacuna**: Falta campos para:
- **Por que** está aprendendo (motivação)
- **Como** está aprendendo (método)
- **Onde** está aprendendo (contexto)

**Sugestão**: Adicionar campos `motivation`, `method`, `context`

---

## 7. RESUMO EXECUTIVO

### ✅ Pontos Fortes

1. Estrutura flexível de categorias
2. Integração com inferências (detecção de estado)
3. Feed contextual sugestivo (não decisório)
4. Matching sugestivo (não decisório)

### ❌ Problemas Críticos

1. **Progresso como Gatekeeper** (ALTA SEVERIDADE)
   - Oportunidades bloqueadas para `beginner` ou `null`
   - Viola princípio de "sugestivo, não decisório"

2. **Progresso como Capacidade** (MÉDIA SEVERIDADE)
   - Campo `progress` sugere capacidade, não interesse
   - Usado para sugerir transição profissional

3. **Contribuição para Score** (BAIXA SEVERIDADE)
   - Aprendizado contribui com 10% do score de completude
   - Não usa progresso, mas usa presença

### ⚠️ Riscos

1. Virar educação disfarçada (estrutura similar)
2. Virar capacidade ao invés de interesse (campo `progress`)
3. Virar gatekeeper (já está acontecendo em oportunidades)

### 📋 Lacunas

1. Falta campo para **intenção/direção** (além de progresso)
2. Falta distinção entre **interesse** e **capacidade**
3. Falta mecanismo para **sugestões baseadas em direção** (não em nível)
4. Falta **temporalidade** (quando/interesse começou)
5. Falta **contexto** (por que/como/onde está aprendendo)

---

## 8. RECOMENDAÇÕES PRIORITÁRIAS

### 🔴 CRÍTICO: Remover Gatekeeper de Progresso

**Ação**: Remover filtro `hasIntermediateOrAdvanced` de `opportunity.service.ts`

**Justificativa**: Oportunidades devem ser **sugestivas**, não bloqueadas por progresso

---

### ⚠️ IMPORTANTE: Redefinir Campo `progress`

**Ação**: Renomear ou redefinir `progress` para enfatizar **direção/interesse**

**Opções**:
1. Renomear para `direction` ou `phase`
2. Adicionar campo `intent` além de `progress`
3. Remover `progress` e usar apenas `notes` para contexto

---

### ⚠️ IMPORTANTE: Revisar Contribuição para Score

**Ação**: Avaliar se aprendizado deve contribuir para score de completude

**Justificativa**: Aprendizado é interesse/direção, não completude de perfil

---

### 📋 DESEJÁVEL: Adicionar Campos de Autodireção

**Ação**: Adicionar campos para capturar **intenção**, **temporalidade**, **contexto**

**Justificativa**: Melhorar base para sugestões futuras baseadas em direção real

---

**Status Final**: ⚠️ **REQUER CORREÇÕES** - Progresso está sendo usado como gatekeeper e capacidade, violando princípios de autodireção e interesse real.

