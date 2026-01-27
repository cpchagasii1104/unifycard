# 📋 CONTRATO ESPERADO PELO BACKEND — UNIFICARD

**Fonte:** Análise direta do código-fonte  
**Data:** 01/01/2026  
**Arquivos analisados:**
- `backend/src/core/categories/categories.repository.ts`
- `backend/src/core/categories/categories.service.ts`
- `backend/src/core/companies/companies.service.ts`
- `backend/src/core/profile/profile-professional.service.ts`

---

## 1️⃣ CONTRATO: CATEGORIAS

### Arquivo: `categories.repository.ts` (linhas 36-46)

```typescript
private async getStatusCondition(): Promise<string> {
  const hasStatus = await this.hasStatusColumn();
  if (!hasStatus) {
    return '1=1';  // Se coluna não existe, retorna TODAS
  }
  return '(status IN (\'active\', \'auto_active\') OR status IS NULL)';
}
```

### FILTROS APLICADOS:

| Campo | Condição | Obrigatório? |
|-------|----------|--------------|
| `status` | `IN ('active', 'auto_active') OR IS NULL` | Sim (se coluna existir) |
| `country_code` | `= $param OR IS NULL` | Não (fallback para global) |
| `tenant_id` | **NÃO É FILTRO** | N/A |
| `parent_id` | **NÃO É FILTRO** no findAll | N/A |

---

### 1.1 ENDPOINT: `/categories/tree`

**Arquivo:** `categories.repository.ts` (linhas 754-818)  
**Método:** `findAll(countryCode?: string)`

```
CONTRATO:
├── status: 'active' | 'auto_active' | NULL
├── country_code: OPCIONAL
│   └── Se fornecido: (country_code = $1 OR country_code IS NULL)
│   └── Se não fornecido: sem filtro de país
├── tenant_id: NÃO É FILTRO (categorias são globais)
└── parent_id: NÃO É FILTRO (retorna todas, árvore construída no service)
```

**Query real (linha 764-773):**
```sql
SELECT category_id, parent_id, name, slug, description, level, path, 
       keywords, country_code, created_at, updated_at
FROM categories
WHERE (status IN ('active', 'auto_active') OR status IS NULL)
  AND (country_code = $1 OR country_code IS NULL)  -- se countryCode fornecido
ORDER BY level ASC, country_code DESC NULLS LAST, name ASC
```

---

### 1.2 ENDPOINT: `/categories/autocomplete`

**Arquivo:** `categories.repository.ts` (linhas 427-589)  
**Método:** `autocomplete(query, context?, countryCode?, limit?)`

```
CONTRATO:
├── status: 'active' | 'auto_active' | NULL
├── country_code: OPCIONAL
│   └── Se fornecido: (country_code = $param OR country_code IS NULL)
├── tenant_id: NÃO É FILTRO
├── context: OPCIONAL
│   └── Se 'professional': retorna APENAS categorias LEAF (sem filhos)
│   └── Outros contexts: level >= 1
└── Busca: name, slug, keywords, path (prefixo + contém)
```

**Filtro de LEAF para professional (linhas 493-504):**
```typescript
if (context === 'professional') {
  leafCondition = `NOT EXISTS (
    SELECT 1 FROM categories c2
    WHERE c2.parent_id = categories.category_id
  )`;
} else {
  leafCondition = 'level >= 1';
}
```

---

### 1.3 ENDPOINT: Perfil Profissional

**Arquivo:** `profile-professional.service.ts`  
**Fluxo:**
1. Busca skills em `user_skills_categories` por `global_user_id`
2. Para cada skill, chama `categoriesService.getCategoryById(category_id)`
3. `getCategoryById` usa `findById` que aplica `getStatusCondition()`

```
CONTRATO:
├── category_id: deve existir em categories
├── status: 'active' | 'auto_active' | NULL (via findById)
└── Se categoria não existe ou status inválido: skill é IGNORADA (não quebra)
```

**Tratamento de erro (linhas ~70-85):**
```typescript
const category = await categoriesService.getCategoryById(row.category_id);
if (!category) {
  console.warn('[ProfileProfessional] Categoria inválida ignorada:', {
    category_id: row.category_id,
  });
  continue;  // Ignora, não quebra
}
```

---

## 2️⃣ CONTRATO: CNPJ (Companies)

### Arquivo: `companies.service.ts` (linhas 221-235)

```typescript
async createCompany(globalUserId: string, input: CreateCompanyInput) {
  // 🔴 Normalização: remove TUDO que não é dígito
  const normalizedCNPJ = input.cnpj.replace(/\D/g, '');
  
  // 🔴 Validação de formato
  const formatValidation = this.validateCNPJFormat(normalizedCNPJ);
  if (!formatValidation.valid) {
    throw new Error(formatValidation.error || 'CNPJ deve ter 14 dígitos');
  }

  const formattedCNPJ = normalizedCNPJ;  // Apenas dígitos
  
  // ... insert no banco com formattedCNPJ
}
```

### CONTRATO:

```
Backend assume CNPJ:
├── Entrada aceita: qualquer formato (com ou sem máscara)
│   └── Exemplo: "12.345.678/0001-90" ou "12345678000190"
├── Normalização: SIM (remove não-dígitos)
│   └── input.cnpj.replace(/\D/g, '')
├── Validação:
│   └── Deve ter EXATAMENTE 14 dígitos
│   └── Não pode ser todos dígitos iguais (ex: 11111111111111)
│   └── NÃO valida dígitos verificadores (validação completa é separada)
└── Formato salvo no banco: APENAS DÍGITOS (14 caracteres)
    └── Exemplo: "12345678000190"
```

### Validação de formato (linhas ~180-195):

```typescript
validateCNPJFormat(cnpj: string): { valid: boolean; error?: string } {
  const clean = cnpj.replace(/\D/g, '');
  
  if (clean.length !== 14) {
    return { valid: false, error: 'CNPJ deve ter 14 dígitos' };
  }

  if (/^(\d)\1+$/.test(clean)) {
    return { valid: false, error: 'CNPJ inválido (todos os dígitos são iguais)' };
  }

  return { valid: true };
}
```

---

## 3️⃣ RESUMO DOS CONTRATOS

### CATEGORIAS — O que o banco DEVE ter para funcionar:

| Campo | Requisito |
|-------|-----------|
| `status` | `'active'` ou `'auto_active'` ou `NULL` |
| `country_code` | Pode ser `NULL` (global) ou código de país |
| `tenant_id` | **NÃO É USADO** em filtros |
| `parent_id` | `NULL` para categorias raiz |
| Categorias raiz | **DEVEM EXISTIR** para árvore funcionar |

### CNPJ — O que o banco DEVE aceitar:

| Campo | Requisito |
|-------|-----------|
| `cnpj` | Exatamente 14 dígitos numéricos |
| Constraint | Deve aceitar `'^[0-9]{14}$'` |

---

## 4️⃣ PONTOS DE VERIFICAÇÃO (para cruzar com banco)

Execute estas queries e compare com os contratos:

```sql
-- 1. Categorias: verificar status
SELECT status, COUNT(*) FROM categories GROUP BY status;
-- ESPERADO: active, auto_active, ou NULL (não pending/rejected)

-- 2. Categorias raiz: verificar existência
SELECT COUNT(*) FROM categories WHERE parent_id IS NULL AND status IN ('active', 'auto_active');
-- ESPERADO: > 0

-- 3. CNPJ: verificar constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'companies'::regclass AND conname LIKE '%cnpj%';
-- ESPERADO: apenas UMA constraint com regex '^[0-9]{14}$'
```

---

## 5️⃣ MAPA DE ARQUIVOS

```
backend/src/core/categories/
├── categories.repository.ts    ← FILTROS DE BUSCA (getStatusCondition)
├── categories.service.ts       ← LÓGICA DE NEGÓCIO
└── categories.routes.ts        ← ENDPOINTS

backend/src/core/companies/
├── companies.service.ts        ← NORMALIZAÇÃO E VALIDAÇÃO DE CNPJ
└── companies.routes.ts         ← ENDPOINTS

backend/src/core/profile/
└── profile-professional.service.ts  ← USA getCategoryById
```

---

*Documento gerado por análise direta do código-fonte*
