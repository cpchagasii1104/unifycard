# Implementação: Categorias de Grupos

**Data**: 2024-12-19  
**Escopo**: Categorização de grupos com estrutura hierárquica (levels 0, 1, 2)

---

## 1. ESTRUTURA CRIADA

### Backend

1. **Seed de Categorias de Grupo** (`src/scripts/seed-group-categories.ts`):
   - Estrutura hierárquica em 3 níveis (Level 0, 1, 2)
   - Scope: `'group'`
   - 7 categorias Level 0 principais:
     - Cultura e Arte
     - Esporte e Lazer
     - Negócios e Empreendedorismo
     - Impacto Social
     - Educação e Aprendizado
     - Fé e Espiritualidade
     - Hobbies e Interesses

2. **Validação de Categoria** (`src/modules/groups/groups.service.ts`):
   - Método `validateCategoryForGroup()` atualizado para usar `categories` com `scope='group'`
   - Validação em `createGroup()` e `updateGroup()`

3. **Endpoint de Categorias** (`src/modules/groups/groups.routes.ts`):
   - `GET /groups/categories` já existe e funciona
   - Busca de `categories` com `scope='group'`
   - Retorna `allowedScopes` da categoria raiz

---

## 2. ESTRUTURA DE CATEGORIAS

### Level 0 (Tipos Principais)

1. **Cultura e Arte**
   - Música (Banda, Orquestra, Coral, DJs e Produtores, Coletivo Musical)
   - Artes Visuais (Coletivo de Artistas, Grafiteiros, Fotógrafos, Ilustradores)
   - Teatro e Performance (Grupo de Teatro, Companhia de Dança, Coletivo de Performance)
   - Literatura e Poesia (Sarau, Clube do Livro, Coletivo Literário)

2. **Esporte e Lazer**
   - Futebol (Time de Futebol, Futebol de Rua, Pelada)
   - Lutas e Artes Marciais (Academia de Lutas, Grupo de Capoeira, Coletivo de Artes Marciais)
   - Ciclismo (Grupo de Ciclismo, Bike Anjo, Pedal Coletivo)
   - Corrida e Caminhada (Grupo de Corrida, Caminhada Coletiva)

3. **Negócios e Empreendedorismo**
   - Networking (Rede de Negócios, Grupo de Networking, Associação Comercial)
   - Empreendedorismo (Coletivo de Empreendedores, Startup Community, Grupo de Mentoria)
   - Cooperativas (Cooperativa, Associação de Trabalhadores)

4. **Impacto Social**
   - Voluntariado (Grupo de Voluntários, Ação Social, Mutirão)
   - Causas Específicas (Meio Ambiente, Direitos Humanos, Inclusão Social, Segurança Alimentar)
   - Assistência (Grupo de Apoio, Assistência Comunitária)

5. **Educação e Aprendizado**
   - Estudos (Grupo de Estudos, Cursinho Popular, Preparatório)
   - Oficinas e Workshops (Oficina Comunitária, Workshop Coletivo)
   - Troca de Conhecimento (Círculo de Aprendizado, Troca de Saberes)

6. **Fé e Espiritualidade**
   - Igrejas (Igreja, Templo, Centro Espiritual)
   - Grupos de Fé (Grupo de Oração, Círculo de Fé, Estudo Bíblico)

7. **Hobbies e Interesses**
   - Games (Clan de Games, E-sports, RPG)
   - Motoclubes (Motoclube, Grupo de Motociclistas)
   - Colecionismo (Colecionadores, Troca e Venda)

---

## 3. BLINDAGENS IMPLEMENTADAS

### Comentários 🔴 BLINDAGEM

1. **`seed-group-categories.ts`**:
   - Explica que categorias de grupo NÃO decidem nada
   - Explica que NÃO criam score
   - Explica que NÃO bloqueiam funcionalidades
   - Explica que são contexto, não hierarquia

2. **`groups.service.ts`**:
   - Validação de categoria com `scope='group'`
   - Comentários explicando uso de `categories` (não `group_categories`)

---

## 4. ENDPOINTS

### Backend

1. **`GET /groups/categories`**:
   - Lista categorias de grupos disponíveis
   - Busca de `categories` com `scope='group'`
   - Retorna `allowedScopes` da categoria raiz
   - Read-only (não permite criação via API ainda)

2. **`POST /groups`**:
   - Aceita `category_id` opcional
   - Valida categoria com `scope='group'`

3. **`PUT /groups/:id`**:
   - Aceita `category_id` opcional
   - Valida categoria com `scope='group'`

---

## 5. ASSOCIAÇÃO DE GRUPO A CATEGORIAS

### Funcionalidade

- Grupos podem ser associados a categorias via `category_id`
- Validação garante que apenas categorias com `scope='group'` são permitidas
- Categoria é opcional (grupos podem existir sem categoria)

### Validação

- `validateCategoryForGroup()` verifica:
  - Se categoria existe
  - Se `scope === 'group'`
  - Retorna erro explícito se inválido

---

## 6. SEED EXECUTÁVEL

### Como Executar

```bash
cd c:\unificard\backend
pnpm ts-node src/scripts/seed-group-categories.ts
```

### Comportamento

- Idempotente: pode ser executado múltiplas vezes
- Verifica se categoria já existe antes de criar
- Cria categorias com `status='active'`
- Scope: `'group'`

---

## 7. TIPOS

### TypeScript

- `Group.categoryId?: string` - UUID da categoria (opcional)
- Categorias são do tipo `Category` com `scope='group'`
- Validação via `validateCategoryForGroup()`

---

## ARQUIVOS ALTERADOS/CRIADOS

### Backend
1. `src/scripts/seed-group-categories.ts` (NOVO)
   - Seed de categorias de grupo em 3 níveis
   - 7 categorias Level 0 principais
   - Múltiplas categorias Level 1 e Level 2

2. `src/modules/groups/groups.service.ts`
   - Atualizado `validateCategoryForGroup()` para usar `categories` com `scope='group'`
   - Atualizado `createGroup()` para usar validação canônica

3. `src/modules/groups/groups.routes.ts`
   - Endpoint `GET /groups/categories` já existe e funciona

---

## VALIDAÇÕES

- ✅ Backend: `pnpm run build:check` → PASS
- ✅ Backend: `pnpm run build` → PASS

---

## PRÓXIMOS PASSOS (NÃO IMPLEMENTADOS NESTA ETAPA)

- ❌ Integração com feed (futuro)
- ❌ Integração com monetização (futuro)
- ❌ UI final (futuro)
- ❌ Filtros por categoria no feed (futuro)

---

## MAPA DE CATEGORIAS CRIADAS

### Cultura e Arte
- Level 0: `cultura-arte`
- Level 1: `musica`, `artes-visuais`, `teatro-performance`, `literatura-poesia`
- Level 2: Múltiplas (ex: `banda`, `orquestra`, `coral`, etc.)

### Esporte e Lazer
- Level 0: `esporte-lazer`
- Level 1: `futebol`, `lutas-artes-marciais`, `ciclismo`, `corrida-caminhada`
- Level 2: Múltiplas (ex: `time-futebol`, `futebol-rua`, etc.)

### Negócios e Empreendedorismo
- Level 0: `negocios-empreendedorismo`
- Level 1: `networking`, `empreendedorismo`, `cooperativas`
- Level 2: Múltiplas (ex: `rede-negocios`, `coletivo-empreendedores`, etc.)

### Impacto Social
- Level 0: `impacto-social`
- Level 1: `voluntariado`, `causas-especificas`, `assistencia`
- Level 2: Múltiplas (ex: `grupo-voluntarios`, `meio-ambiente`, etc.)

### Educação e Aprendizado
- Level 0: `educacao-aprendizado`
- Level 1: `estudos`, `oficinas-workshops`, `troca-conhecimento`
- Level 2: Múltiplas (ex: `grupo-estudos`, `oficina-comunitaria`, etc.)

### Fé e Espiritualidade
- Level 0: `fe-espiritualidade`
- Level 1: `igrejas`, `grupos-fe`
- Level 2: Múltiplas (ex: `igreja`, `grupo-oracao`, etc.)

### Hobbies e Interesses
- Level 0: `hobbies-interesses`
- Level 1: `games`, `motoclubes`, `colecionismo`
- Level 2: Múltiplas (ex: `clan-games`, `motoclube`, etc.)

---

**Status Final**: ✅ **CATEGORIAS DE GRUPOS IMPLEMENTADAS E VALIDADAS**

