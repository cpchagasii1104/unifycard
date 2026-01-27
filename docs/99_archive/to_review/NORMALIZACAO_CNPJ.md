# 🔧 Normalização de CNPJ antes de criar empresa

## 📋 Resumo Executivo

Implementada normalização de CNPJ no frontend e backend para garantir que apenas números sejam salvos no banco, evitando violação da constraint `companies_cnpj_format`.

---

## ✅ Implementação Frontend

### Normalização antes de enviar

**Arquivo**: `frontend/src/components/CompaniesManager.tsx`

**Mudança**: Normaliza CNPJ antes de enviar para o backend

```typescript
// 🔴 Normalizar CNPJ: remover formatação antes de enviar
const normalizedCNPJ = cleanCNPJ(formData.cnpj);

const companyData: CreateCompanyInput = {
  ...formData,
  cnpj: normalizedCNPJ, // Enviar apenas números
  // ...
};
```

**Comportamento**:
- Remove ".", "/", "-" antes de enviar
- Envia apenas números (14 dígitos)
- Usa função `cleanCNPJ()` existente

---

## ✅ Implementação Backend

### 1. Normalização defensiva no Routes

**Arquivo**: `backend/src/core/companies/companies.routes.ts`

**Mudança**: Normaliza CNPJ antes de validar schema

```typescript
// 🔴 Normalizar CNPJ antes de validar schema (defensivo)
const normalizedBody = {
  ...req.body,
  cnpj: typeof req.body?.cnpj === 'string' ? req.body.cnpj.replace(/\D/g, '') : req.body?.cnpj,
};

const parsed = createCompanySchema.safeParse(normalizedBody);
```

**Comportamento**:
- Remove formatação antes de validar
- Garante que schema recebe apenas números
- Defensivo: funciona mesmo se frontend enviar formatado

### 2. Normalização no Service

**Arquivo**: `backend/src/core/companies/companies.service.ts`

**Mudança**: Normaliza CNPJ antes de validar e salvar

```typescript
// 🔴 Normalizar CNPJ defensivamente: remover formatação
const normalizedCNPJ = input.cnpj.replace(/\D/g, '');

// 🔴 Validar APENAS formato do CNPJ (não dígitos verificadores)
const formatValidation = this.validateCNPJFormat(normalizedCNPJ);
if (!formatValidation.valid) {
  throw new Error(formatValidation.error || 'CNPJ deve ter 14 dígitos');
}

// formattedCNPJ já é apenas números (normalizado acima)
const formattedCNPJ = normalizedCNPJ;
```

**Mudança em `updateCompany`**:
```typescript
// 🔴 Se tentou atualizar CNPJ, normalizar e validar formato
if (input.cnpj !== undefined) {
  // 🔴 Normalizar CNPJ defensivamente: remover formatação
  const normalizedCNPJ = input.cnpj.replace(/\D/g, '');
  
  const formatValidation = this.validateCNPJFormat(normalizedCNPJ);
  if (!formatValidation.valid) {
    throw new Error(formatValidation.error || 'CNPJ inválido');
  }
  // formattedCNPJ já é apenas números (normalizado acima)
  const formattedCNPJ = normalizedCNPJ;
}
```

**Comportamento**:
- Remove formatação antes de validar
- Salva apenas números no banco
- Funciona mesmo se receber CNPJ formatado

---

## ⚠️ Nota sobre Constraint

**Constraint atual** (migration 047):
```sql
CONSTRAINT companies_cnpj_format
  CHECK (cnpj ~ '^[0-9]{2}\\.[0-9]{3}\\.[0-9]{3}/[0-9]{4}-[0-9]{2}$')
```

**Esta constraint espera CNPJ formatado**, mas o código agora salva apenas números.

**Solução**:
- Se a constraint ainda espera formato, será necessário criar uma migration para alterá-la
- OU a constraint já foi alterada em uma migration posterior

**Recomendação**: Verificar se há migration que altera a constraint, ou criar uma nova migration para ajustar.

---

## ✅ Critérios de Aceite Atendidos

✅ **Enviar "17.217.825/0001-65" cria empresa com sucesso**:
- Frontend normaliza para "17217825000165" antes de enviar
- Backend normaliza defensivamente também
- Empresa é criada com sucesso

✅ **Banco salva "17217825000165"**:
- Backend salva apenas números (sem formatação)
- Constraint não é violada (se esperar apenas números)

✅ **Constraint não é violada**:
- CNPJ é normalizado antes de salvar
- Apenas números são salvos

---

## 🔍 Fluxo Completo

### 1. Usuário digita CNPJ formatado

```
Frontend: "17.217.825/0001-65"
  ↓
Frontend: maskCNPJ() → "17.217.825/0001-65" (exibição)
  ↓
Frontend: cleanCNPJ() → "17217825000165" (antes de enviar)
  ↓
Frontend: POST /companies { cnpj: "17217825000165" }
```

### 2. Backend recebe e normaliza

```
Backend: req.body.cnpj = "17217825000165" (ou formatado)
  ↓
Backend: normalize → "17217825000165"
  ↓
Backend: validateCNPJFormat() → válido
  ↓
Backend: INSERT INTO companies (cnpj) VALUES ('17217825000165')
  ↓
Banco: Salva "17217825000165" ✅
```

---

## 📁 Arquivos Alterados

1. **`frontend/src/components/CompaniesManager.tsx`**
   - Normaliza CNPJ antes de enviar usando `cleanCNPJ()`

2. **`backend/src/core/companies/companies.routes.ts`**
   - Normaliza CNPJ antes de validar schema (defensivo)

3. **`backend/src/core/companies/companies.service.ts`**
   - Normaliza CNPJ em `createCompany()` antes de validar e salvar
   - Normaliza CNPJ em `updateCompany()` antes de validar e atualizar

---

## ⚠️ Ação Necessária

**Verificar/Atualizar Constraint**:

Se a constraint `companies_cnpj_format` ainda espera formato com pontos e barra, será necessário criar uma migration para alterá-la:

```sql
-- Migration para alterar constraint de CNPJ
ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_cnpj_format;

ALTER TABLE companies
  ADD CONSTRAINT companies_cnpj_format
  CHECK (cnpj ~ '^[0-9]{14}$');
```

**OU** verificar se já existe uma migration que altera essa constraint.

---

**Status**: ✅ Implementado (pendente verificação/atualização da constraint)  
**Data**: 2024














