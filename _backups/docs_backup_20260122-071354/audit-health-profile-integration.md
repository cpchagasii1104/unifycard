# 🔍 AUDITORIA: Integração Health no Perfil

## Data: 2026-01-10
## Status: ❌ Health NÃO aparece na UI

---

## 📋 RESUMO EXECUTIVO

**Problema**: Categorias com `scope='health'` existem no backend, mas não aparecem na UI do Perfil.

**Causa Raiz Identificada**: 
1. ❌ **Frontend**: Aba "Saúde" não existe em `Profile.tsx`
2. ❌ **Backend**: Filtro hardcoded em `autocomplete` limita a `scope='professional'`
3. ❌ **Frontend**: Não existe componente `ProfileHealth` ou similar

---

## 🔍 1. AUDITORIA BACKEND

### 1.1 Endpoint `/categories/tree`

**Arquivo**: `src/core/categories/categories.service.ts`
**Linha**: 405-509

**Status**: ✅ **FUNCIONA CORRETAMENTE**

- `getCategoryTree()` **NÃO filtra por scope**
- Retorna **TODAS** as categorias do banco
- Inclui categorias com `scope='health'`
- Campo `scope` é retornado (adicionado anteriormente)

**Conclusão**: Backend retorna categorias health corretamente.

---

### 1.2 Endpoint `/categories/autocomplete`

**Arquivo**: `src/core/categories/categories.repository.ts`
**Linha**: 591-592

**Status**: ❌ **FILTRO HARDCODED**

```typescript
// 🔴 CORREÇÃO: Filtrar apenas categorias com scope='professional'
scopeCondition = `(scope = 'professional' OR scope = 'global')`;
```

**Problema**: 
- Quando `context === 'professional'`, filtra apenas `scope='professional'` ou `'global'`
- **NÃO inclui** `scope='health'`
- Isso impede autocomplete de categorias health no contexto profissional

**Impacto**: 
- Autocomplete não retorna categorias health
- Mas isso só afeta se o contexto for 'professional'
- Para health, precisaria de contexto 'health' ou remover filtro

**Conclusão**: Filtro hardcoded impede autocomplete de health quando context='professional'.

---

### 1.3 Service `assignSkillToUser`

**Arquivo**: `src/core/categories/categories.service.ts`
**Linha**: 690

**Status**: ❌ **VALIDAÇÃO HARDCODED**

```typescript
if (category.scope !== 'professional') {
  throw new Error('Categoria deve ter scope profissional');
}
```

**Problema**: 
- Validação hardcoded que só aceita `scope='professional'`
- **Bloqueia** persistência de categorias health

**Impacto**: 
- Não é possível salvar categorias health como "skills"
- Mas health pode ter modelo de dados diferente (não é skill)

**Conclusão**: Validação hardcoded bloqueia health, mas pode ser intencional se health não usa skills.

---

### 1.4 Persistência de Dados Health

**Busca**: Não encontrado endpoint específico para health profile

**Status**: ❓ **NÃO ENCONTRADO**

- Não existe `getHealthProfile()` ou similar
- Não existe `updateHealthProfile()` ou similar
- Não existe tabela `user_health_categories` ou similar

**Conclusão**: **Backend não tem persistência específica para health**. Precisa ser criada.

---

## 🔍 2. AUDITORIA FRONTEND

### 2.1 Componente Profile.tsx

**Arquivo**: `c:\unificard\frontend\src\components\Profile.tsx`
**Linha**: 42, 1459-1490

**Status**: ❌ **ABA HEALTH NÃO EXISTE**

```typescript
type Tab = "personal" | "professional" | "physical" | "learning" | "legal";
// ❌ FALTA: "health"
```

**Tabs definidas**:
- ✅ `personal` → Pessoal
- ✅ `professional` → Profissional
- ✅ `physical` → Interesses e Gostos
- ✅ `learning` → Aprendizado
- ✅ `legal` → Pessoa Jurídica
- ❌ **FALTA**: `health` → Saúde

**Renderização** (linha 1492-2024):
```typescript
{activeTab === "professional" && <ProfileProfessional />}
{activeTab === "physical" && <ProfilePhysical />}
{activeTab === "learning" && <ProfileLearning />}
// ❌ FALTA: {activeTab === "health" && <ProfileHealth />}
```

**Conclusão**: **Aba "Saúde" não existe no Profile.tsx**.

---

### 2.2 Componente ProfileProfessional.tsx

**Arquivo**: `c:\unificard\frontend\src\components\ProfileProfessional.tsx`
**Linha**: 174-201

**Status**: ✅ **FILTRO CORRIGIDO** (já foi ajustado anteriormente)

```typescript
const filterProfessionalCategories = (tree: CategoryTree[]): CategoryTree[] => {
  return tree
    .filter((category) => {
      if (category.level !== 0) return false;
      return category.scope === 'professional'; // ✅ Filtra por scope
    })
    // ...
};
```

**Conclusão**: ProfileProfessional filtra corretamente por `scope='professional'`, não afeta health.

---

### 2.3 Componente ProfileLearning.tsx

**Status**: ❓ **NÃO VERIFICADO**

- Provavelmente filtra por `scope='learning'`
- Não afeta health diretamente

---

### 2.4 Componente ProfileHealth

**Status**: ❌ **NÃO EXISTE**

- Não existe `ProfileHealth.tsx`
- Não existe `ProfileHealthSection.tsx`
- Não existe integração com health

**Conclusão**: **Componente Health não existe no frontend**.

---

### 2.5 Interface Category

**Arquivo**: `c:\unificard\frontend\src\api\categories.ts`
**Linha**: 7-17

**Status**: ✅ **TEM SCOPE** (já foi adicionado anteriormente)

```typescript
export interface Category {
  // ...
  scope?: string; // ✅ Campo scope existe
}
```

**Conclusão**: Interface suporta scope, incluindo 'health'.

---

## 📊 3. DIAGNÓSTICO FINAL

### ❌ Problemas Identificados

1. **Frontend - Aba não existe**
   - Arquivo: `Profile.tsx` linha 42, 1459-1490
   - Problema: Tab "health" não está definida
   - Impacto: Usuário não vê aba Saúde

2. **Frontend - Componente não existe**
   - Arquivo: Não existe
   - Problema: `ProfileHealth.tsx` não foi criado
   - Impacto: Mesmo se aba existir, não há componente para renderizar

3. **Backend - Persistência não existe**
   - Arquivo: Não existe
   - Problema: Não há endpoint/service para salvar dados health
   - Impacto: Dados health não podem ser persistidos

4. **Backend - Autocomplete filtrado** (menor impacto)
   - Arquivo: `categories.repository.ts` linha 591-592
   - Problema: Filtro hardcoded para 'professional'
   - Impacto: Autocomplete não retorna health quando context='professional'

---

## ✅ 4. PLANO DE CORREÇÃO MÍNIMO

### Prioridade 1: Frontend - Criar Aba e Componente

1. **Adicionar tab "health" em Profile.tsx**
   - Linha 42: Adicionar `"health"` ao type Tab
   - Linha 1459-1490: Adicionar botão da aba
   - Linha 2018: Adicionar renderização do componente

2. **Criar ProfileHealth.tsx**
   - Reutilizar padrão de ProfileLearning ou ProfileProfessional
   - Filtrar categorias por `scope='health'`
   - Implementar questionário inicial (altura, peso, óculos, sono, tipo sanguíneo)

### Prioridade 2: Backend - Criar Persistência

3. **Criar endpoint/service para health profile**
   - `GET /profile/health` → Retornar dados health do usuário
   - `POST /profile/health` → Salvar dados health
   - Criar tabela `user_health_profile` ou similar

### Prioridade 3: Backend - Ajustar Autocomplete (opcional)

4. **Remover filtro hardcoded** (se necessário)
   - Permitir autocomplete de health quando context apropriado
   - Ou criar context='health' específico

---

## 🎯 5. PRÓXIMOS PASSOS

1. ✅ Auditoria completa (este documento)
2. ⏳ Criar ProfileHealth.tsx baseado em ProfileLearning
3. ⏳ Adicionar aba "Saúde" em Profile.tsx
4. ⏳ Criar endpoints backend para health profile
5. ⏳ Implementar questionário inicial
6. ⏳ Adicionar microcopy canônico (autodeclaração, sem diagnóstico)

---

## 📝 NOTAS CANÔNICAS

Conforme CANONICAL_CONTEXT_FOR_AI.md:
- ✅ Saúde é **autodeclarada**
- ✅ **NÃO gera diagnóstico**
- ✅ **NÃO afeta matching, preço ou acesso**
- ✅ Serve apenas para **sugestões e descobertas**

