# Implementação do Campo `audience_description` no Frontend

## Status do Backend

✅ O backend já está preparado para receber o campo `audience_description`:
- Campo existe no banco de dados (migration 124)
- Campo está nos tipos TypeScript (`CreateGroupInput` e `UpdateGroupInput`)
- Campo está sendo salvo e recuperado pelo repository
- Campo foi adicionado ao schema de validação Zod nas rotas

## Especificações do Campo

### Tipo
- **Tipo**: `string` (opcional)
- **Tamanho máximo**: 500 caracteres
- **Validação**: Opcional, sem validação adicional

### Mapeamento
- **Frontend → Backend**: `audience_description` (snake_case)
- **Backend → Frontend**: `audienceDescription` (camelCase)

## Implementação no Frontend

### Localização
O campo deve ser adicionado **abaixo do campo `description`** no formulário de criação de grupos.

### Especificações do Campo

```typescript
// Exemplo de implementação em React/TypeScript

<FormField
  name="audience_description"
  label="Público-alvo"
  type="textarea"
  placeholder="Descreva brevemente o público-alvo do grupo"
  maxLength={500}
  optional
/>
```

### Detalhes de Implementação

1. **Tipo**: `textarea` (campo de texto multilinha)
2. **Rótulo**: "Público-alvo"
3. **Placeholder**: "Descreva brevemente o público-alvo do grupo"
4. **Validação**: 
   - Campo opcional (não obrigatório)
   - Máximo de 500 caracteres
5. **Posicionamento**: Imediatamente após o campo `description`
6. **Estilo**: Deve seguir o mesmo padrão visual dos demais campos do formulário

### Exemplo de Formulário

```tsx
// Estrutura sugerida do formulário

<Form>
  {/* Campos anteriores */}
  
  <FormField
    name="description"
    label="Descrição"
    type="textarea"
    required
    // ... outras props
  />
  
  {/* NOVO CAMPO */}
  <FormField
    name="audience_description"
    label="Público-alvo"
    type="textarea"
    placeholder="Descreva brevemente o público-alvo do grupo"
    maxLength={500}
    rows={3}
    optional
  />
  
  {/* Campos seguintes */}
</Form>
```

### Payload de Envio

O campo deve ser incluído no payload ao criar/atualizar um grupo:

```typescript
{
  name: "Nome do Grupo",
  description: "Descrição do grupo",
  audience_description: "Público-alvo do grupo", // NOVO CAMPO
  category_id: "uuid-da-categoria",
  // ... outros campos
}
```

### Resposta da API

O campo será retornado na resposta da API como `audienceDescription` (camelCase):

```typescript
{
  groupId: "uuid",
  name: "Nome do Grupo",
  description: "Descrição do grupo",
  audienceDescription: "Público-alvo do grupo", // Campo retornado
  // ... outros campos
}
```

## Notas Importantes

- ✅ Campo é **opcional** - não é obrigatório preenchê-lo
- ✅ Máximo de **500 caracteres**
- ✅ Deve aparecer **após o campo description**
- ✅ Estilo deve ser **consistente** com os demais campos
- ✅ Backend já está **100% preparado** para receber este campo

## Testes Sugeridos

1. Criar grupo sem `audience_description` (deve funcionar)
2. Criar grupo com `audience_description` (deve salvar corretamente)
3. Verificar limite de 500 caracteres
4. Verificar que o campo aparece na listagem/detalhes do grupo
5. Testar atualização do campo





