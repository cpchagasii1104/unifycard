# Implementação: Filtro de Abrangência por Categoria

## Objetivo

Ao selecionar uma categoria no formulário de criação de grupo, filtrar o select de abrangência (scope) baseado nos `allowed_scopes` da categoria raiz.

## Endpoint Atualizado

**GET `/api/groups/categories`**

**Resposta:**
```json
{
  "categories": [
    {
      "categoryId": "uuid",
      "name": "Nome da Categoria",
      "slug": "slug-da-categoria",
      "icon": "🎯",
      "description": "Descrição opcional",
      "allowedScopes": ["national", "state", "city"] // NOVO CAMPO
    }
  ]
}
```

**Nota:** `allowedScopes` vem do `metadata.allowed_scopes` da categoria raiz. Se não definido, retorna todos os scopes por padrão: `["national", "state", "city", "neighborhood"]`.

## Implementação no Frontend

### 1. Armazenar allowedScopes ao carregar categorias

```typescript
// src/api/groups.ts
export interface GroupCategory {
  categoryId: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  allowedScopes: string[]; // NOVO CAMPO
}

export const getGroupCategories = async (): Promise<GroupCategory[]> => {
  const response = await fetch('/api/groups/categories');
  if (!response.ok) {
    throw new Error('Erro ao carregar categorias');
  }
  const data = await response.json();
  return data.categories;
};
```

### 2. Filtrar select de abrangência ao selecionar categoria

```typescript
// src/components/groups/CreateGroupWizard.tsx
import { useState, useEffect, useMemo } from 'react';
import { getGroupCategories, GroupCategory } from '@/api/groups';

function CreateGroupWizard() {
  const [categories, setCategories] = useState<GroupCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [scope, setScope] = useState<string>('national');

  // Buscar categorias ao montar componente
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getGroupCategories();
        setCategories(data);
      } catch (error) {
        console.error('Erro ao carregar categorias:', error);
      }
    };
    loadCategories();
  }, []);

  // Obter categoria selecionada
  const selectedCategory = useMemo(() => {
    return categories.find(cat => cat.categoryId === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  // Obter scopes permitidos para a categoria selecionada
  const allowedScopes = useMemo(() => {
    if (!selectedCategory) {
      return ['national', 'state', 'city', 'neighborhood']; // Default: todos
    }
    return selectedCategory.allowedScopes || ['national', 'state', 'city', 'neighborhood'];
  }, [selectedCategory]);

  // Resetar scope se não estiver na lista permitida
  useEffect(() => {
    if (selectedCategory && !allowedScopes.includes(scope)) {
      // Se scope atual não está permitido, usar o primeiro permitido
      setScope(allowedScopes[0] || 'national');
    }
  }, [selectedCategory, allowedScopes, scope]);

  // Opções de scope com labels
  const scopeOptions = [
    { value: 'national', label: 'Nacional' },
    { value: 'state', label: 'Estadual' },
    { value: 'city', label: 'Municipal' },
    { value: 'neighborhood', label: 'Bairro' },
  ];

  return (
    <form>
      {/* Select de Categoria */}
      <div className="form-field">
        <label htmlFor="category_id">
          Categoria <span className="required">*</span>
        </label>
        <select
          id="category_id"
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          required
        >
          <option value="">Selecione uma categoria</option>
          {categories.map((category) => (
            <option key={category.categoryId} value={category.categoryId}>
              {category.icon} {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* Select de Abrangência - FILTRADO por allowedScopes */}
      <div className="form-field">
        <label htmlFor="scope">
          Abrangência <span className="required">*</span>
        </label>
        <select
          id="scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          required
          disabled={!selectedCategoryId} // Desabilitar até selecionar categoria
        >
          {scopeOptions
            .filter(option => allowedScopes.includes(option.value))
            .map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </select>
        {selectedCategory && allowedScopes.length < 4 && (
          <span className="field-hint">
            Apenas {allowedScopes.length} tipo(s) de abrangência permitido(s) para esta categoria
          </span>
        )}
      </div>

      {/* Outros campos do formulário */}
    </form>
  );
}
```

### 3. Tratamento de Erro do Backend

```typescript
// Ao fazer submit, capturar erro de abrangência inválida
const handleSubmit = async (formData: CreateGroupFormData) => {
  try {
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Verificar se é erro de abrangência inválida
      if (error.message?.includes('abrangência') || error.message?.includes('scope')) {
        setError('A abrangência selecionada não é permitida para esta categoria. Por favor, selecione uma abrangência válida.');
        return;
      }
      
      throw new Error(error.message || 'Erro ao criar grupo');
    }

    // Sucesso
    const group = await response.json();
    // ... redirecionar ou atualizar UI
  } catch (error) {
    console.error('Erro ao criar grupo:', error);
    setError(error instanceof Error ? error.message : 'Erro desconhecido');
  }
};
```

## Validações Obrigatórias

1. **Select de abrangência:**
   - Deve estar desabilitado até uma categoria ser selecionada
   - Deve mostrar apenas os scopes permitidos em `allowedScopes`
   - Deve resetar automaticamente se o scope atual não estiver na lista permitida

2. **Tratamento de erro:**
   - Se backend retornar erro de abrangência inválida → exibir mensagem clara
   - Não permitir seleção manual fora da lista (select já filtra)

3. **Comportamento:**
   - Ao selecionar categoria → filtrar opções de scope
   - Ao mudar categoria → resetar scope se necessário
   - Ao fazer submit → validar que scope está na lista permitida

## Exemplo de Fluxo

1. Usuário seleciona categoria "Eventos Locais"
2. Backend retorna `allowedScopes: ["city", "neighborhood"]`
3. Select de abrangência mostra apenas "Municipal" e "Bairro"
4. Se scope atual era "Nacional", resetar para "Municipal" (primeiro da lista)
5. Usuário seleciona "Municipal"
6. Submit funciona corretamente

## Notas Importantes

- ✅ `allowedScopes` vem da categoria **raiz** (se categoria tem parent_id, busca a raiz)
- ✅ Se `allowedScopes` não estiver definido no metadata, permite todos os scopes por padrão
- ✅ Select de abrangência deve estar **desabilitado** até categoria ser selecionada
- ✅ Não permitir seleção manual fora da lista (select já filtra automaticamente)
- ✅ Exibir mensagem clara se backend retornar erro de abrangência inválida





