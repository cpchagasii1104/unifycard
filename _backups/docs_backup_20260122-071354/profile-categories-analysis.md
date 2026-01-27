# Análise: Categorias para Perfil de Usuário

## 1. Categorias Raiz Reutilizáveis

### Categorias raiz existentes (scope='group'):
- `social` - Social (Grupos e organizações sociais)
- `musica` - Música (Grupos musicais)
- `educacao` - Educação (Instituições educacionais)

**Status:** ❌ **NÃO reutilizáveis diretamente**
- Essas categorias têm `scope='group'` e são específicas para grupos
- Perfil precisa de categorias com `scope IN ('professional', 'interest', 'learning', 'cause')`

## 2. Taxonomias de Perfil Possíveis

### Scopes já implementados (migration 126):
- ✅ `professional` - Perfil profissional (já tem categorias)
- ✅ `interest` - Hobbies/interesses (já tem categorias)
- ✅ `learning` - Aprendizado (já tem categorias)
- ✅ `cause` - Causas sociais (já tem categorias)

### Categorias raiz profissionais (exemplos da migration 126):
- `construcao-reformas`
- `tecnologia-informatica`
- `comercio-varejo`
- `beleza-estetica`
- `saude-bem-estar`
- `educacao-profissional`
- `transporte-logistica`
- `alimentacao`
- `limpeza-conservacao`
- `manutencao-reparos`
- `seguranca`
- `eventos-entretenimento`
- `administracao-gestao`
- `direito-consultoria`
- `marketing-comunicacao`
- `artes-cultura`
- `turismo-hospitalidade`
- `agropecuaria`

### Categorias raiz de interesses:
- `assistir-consumir-conteudo`
- `jogar-brincar`
- `fazer-criar`
- `sair-socializar`
- `movimento-corpo`
- `relaxar-contemplar`
- `coletar-organizar`

### Categorias raiz de aprendizado:
- `criatividade-expressao`
- `tecnologia-digital`
- `negocios-empreendedorismo`
- `saude-bem-estar-aprendizado`
- `idiomas`
- `habilidades-sociais`
- `ciencias-conhecimento`
- `desenvolvimento-pessoal`

## 3. Confirmação de Scope

**Status:** ✅ **JÁ EXISTE**

Migration 126 já adiciona:
- `scope IN ('professional', 'interest', 'learning', 'cause')`
- Constraint atualizada
- Categorias já migradas para esses scopes

## 4. Ajuste Necessário

**Status:** ✅ **APLICADO**

**Arquivo:** `src/core/category/category.types.ts:13,51`

**Patch aplicado:**
- `Category.scope` atualizado para incluir scopes de perfil
- `CategoryFilters.scope` atualizado para incluir scopes de perfil

## 5. Estrutura Atual

**Tabela:** `user_skills_categories` (migration 040)
- ✅ Relaciona `global_user_id` com `category_id`
- ✅ Suporta múltiplas categorias por usuário (UNIQUE por par)
- ✅ Não exige que categoria seja leaf
- ✅ Não tem scope geográfico

**Status:** ✅ **PRONTA** - Não precisa alteração estrutural

## Confirmação Final

**Pode seguir sem alteração estrutural:** ✅ **SIM**

**Ajuste necessário:**
- Atualizar `CategoryFilters.scope` para incluir scopes de perfil (1 linha)

**Categorias de perfil prontas para uso:** ✅ **SIM**

