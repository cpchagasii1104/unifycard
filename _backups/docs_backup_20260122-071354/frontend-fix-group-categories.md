# Correção: Carregamento de Categorias de Grupos

## Problema Identificado

O frontend está chamando `/categories?scope=group` quando deveria usar `/groups/categories`.

## Endpoint Correto

**Endpoint:** `GET /api/groups/categories`

**Fonte:** Tabela `categories` (CORE) com `scope='group'` e `is_active=true`

**Resposta:**
```json
{
  "categories": [
    {
      "categoryId": "uuid",
      "name": "Nome da Categoria",
      "slug": "slug-da-categoria",
      "icon": "🎯",
      "description": "Descrição opcional"
    }
  ]
}
```

**Nota:** O endpoint agora usa o sistema CORE de categorias, garantindo consistência com a validação do backend.

## Arquivos a Corrigir no Frontend

### 1. `src/api/groups.ts`

**ANTES:**
```typescript
// ❌ ERRADO
export const getGroupCategories = async () => {
  const response = await fetch('/api/categories?scope=group');
  return response.json();
};
```

**DEPOIS:**
```typescript
// ✅ CORRETO
export const getGroupCategories = async () => {
  const response = await fetch('/api/groups/categories');
  if (!response.ok) {
    throw new Error('Erro ao carregar categorias');
  }
  const data = await response.json();
  return data.categories; // Retorna array de categorias
};
```

### 2. `src/components/groups/CreateGroupWizard.tsx`

**Validação obrigatória:**
```typescript
// Garantir que category_id existe antes de permitir avançar
const canProceed = () => {
  if (!formData.category_id) {
    return false;
  }
  // Verificar se category_id existe na lista de categorias carregadas
  const categoryExists = categories.some(
    cat => cat.categoryId === formData.category_id
  );
  return categoryExists;
};

// Exibir erro se categorias não carregarem
if (categoriesError) {
  return (
    <div className="error-message">
      Erro ao carregar categorias. Por favor, recarregue a página.
    </div>
  );
}

// Exibir erro se nenhuma categoria estiver disponível
if (categories.length === 0 && !isLoadingCategories) {
  return (
    <div className="error-message">
      Nenhuma categoria disponível. Entre em contato com o suporte.
    </div>
  );
}
```

**Exemplo completo de uso:**
```typescript
import { useState, useEffect } from 'react';
import { getGroupCategories } from '@/api/groups';

function CreateGroupWizard() {
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState(null);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [formData, setFormData] = useState({
    category_id: '',
    // ... outros campos
  });

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setIsLoadingCategories(true);
        setCategoriesError(null);
        const data = await getGroupCategories();
        setCategories(data);
      } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        setCategoriesError(error.message || 'Erro ao carregar categorias');
      } finally {
        setIsLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  const canProceed = () => {
    // Não permitir avançar sem category_id válido
    if (!formData.category_id) {
      return false;
    }
    // Verificar se category_id existe na lista carregada
    return categories.some(cat => cat.categoryId === formData.category_id);
  };

  return (
    <div>
      {/* Exibir erro se categorias não carregarem */}
      {categoriesError && (
        <div className="alert alert-error">
          {categoriesError}
        </div>
      )}

      {/* Exibir erro se nenhuma categoria disponível */}
      {!isLoadingCategories && categories.length === 0 && (
        <div className="alert alert-error">
          Nenhuma categoria disponível. Entre em contato com o suporte.
        </div>
      )}

      {/* Dropdown de categorias */}
      <select
        value={formData.category_id}
        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
        disabled={isLoadingCategories || categoriesError}
        required
      >
        <option value="">Selecione uma categoria</option>
        {categories.map((category) => (
          <option key={category.categoryId} value={category.categoryId}>
            {category.icon} {category.name}
          </option>
        ))}
      </select>

      {/* Botão de avançar - desabilitado se category_id inválido */}
      <button
        onClick={handleNext}
        disabled={!canProceed()}
      >
        Avançar
      </button>
    </div>
  );
}
```

### 3. `src/pages/GruposPage.tsx`

**Se houver chamada direta:**
```typescript
// ❌ ERRADO
const response = await fetch('/api/categories?scope=group');

// ✅ CORRETO
const response = await fetch('/api/groups/categories');
```

## Checklist de Implementação

- [ ] Substituir todas as chamadas `/categories?scope=group` por `/groups/categories`
- [ ] Atualizar função `getGroupCategories()` em `src/api/groups.ts`
- [ ] Adicionar validação em `CreateGroupWizard` para garantir `category_id` válido
- [ ] Adicionar tratamento de erro quando categorias não carregarem
- [ ] Desabilitar botão "Avançar" se `category_id` não estiver selecionado
- [ ] Exibir mensagem de erro clara se categorias não carregarem
- [ ] Testar que o erro "Categoria não encontrada" não ocorre mais no submit

## Validações Obrigatórias

1. **Antes de permitir avançar:**
   - `category_id` deve estar preenchido
   - `category_id` deve existir na lista de categorias carregadas

2. **Tratamento de erros:**
   - Se categorias não carregarem → exibir erro e não permitir avançar
   - Se nenhuma categoria disponível → exibir erro e não permitir avançar
   - Se `category_id` inválido no submit → exibir erro (backend já valida)

## Notas Importantes

- ✅ **NÃO criar** lista local de categorias (fallback)
- ✅ **NÃO criar** categoria default
- ✅ **NÃO remover** validação do backend
- ✅ Usar **apenas** `/groups/categories` como fonte única
- ✅ Backend já valida `category_id` no create/update

## Testes

1. Carregar categorias → deve funcionar
2. Selecionar categoria → deve permitir avançar
3. Tentar avançar sem categoria → deve bloquear
4. Erro ao carregar categorias → deve exibir mensagem clara
5. Submit com category_id válido → deve funcionar
6. Submit com category_id inválido → backend retorna erro 400

