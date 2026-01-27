# 🔧 CORREÇÃO: /categories/tree Retornando Vazio

## 📋 DIAGNÓSTICO OBRIGATÓRIO

Execute no PostgreSQL:

```sql
-- 1) Contar categorias por status
SELECT 
  COALESCE(status, 'NULL') as status,
  COUNT(*) as total
FROM categories
GROUP BY status
ORDER BY status;

-- 2) Contar categorias visíveis
SELECT 
  COUNT(*) AS visiveis
FROM categories
WHERE status IS NULL OR status IN ('active','auto_active');
```

### INTERPRETAÇÃO

- **Se `visiveis = 0`** → Não existe nenhuma categoria que o `/tree` possa retornar
- **Se tabela vazia** → É necessário rodar seed

---

## 🔧 CORREÇÃO RÁPIDA (DEV)

Se existirem categorias `pending`, execute:

```sql
-- Ativar categorias pending
UPDATE categories
SET status = 'active'
WHERE status = 'pending';

-- Ativar categorias sem status (NULL)
UPDATE categories
SET status = 'active'
WHERE status IS NULL;
```

**OU execute o script:**
```bash
psql -d unificard -f backend/scripts/fix-categories-status.sql
```

---

## 🌱 SEEDAR CATEGORIAS (RECOMENDADO)

### Opção 1: Seed SQL Direto (MAIS RÁPIDO)
```bash
psql -d unificard -f backend/scripts/seed-categories-basic.sql
```

### Opção 2: Seed TypeScript (DEV)
```bash
cd backend
npx ts-node src/scripts/seed-dev-categories.ts
```

### Opção 3: Seeds Específicos
```bash
# Categorias profissionais
npx ts-node src/scripts/seed-professional-categories.ts

# Categorias físicas
npx ts-node src/scripts/seed-physical-categories.ts

# Categorias de aprendizado
npx ts-node src/scripts/seed-learning-categories.ts

# Categorias de interesses
npx ts-node src/scripts/seed-interests-categories.ts
```

---

## ♻️ INVALIDAR CACHE

### Opção 1: Reiniciar Backend
```bash
# CTRL + C no terminal
npm run dev
```

### Opção 2: Script de Invalidação
```bash
cd backend
node scripts/invalidate-category-cache.js
```

---

## 🧪 TESTE FINAL

1. Chamar `/categories/tree` no browser ou network tab
2. Confirmar payload não vazio
3. Confirmar UI renderiza categorias
4. Confirmar autocomplete funciona
5. Confirmar perfil profissional funciona
6. Confirmar microfone habilitado

---

## ✅ CRITÉRIO DE ACEITE

- [ ] Existem categorias no banco
- [ ] Pelo menos uma com `status = 'active'`
- [ ] `/categories/tree` retorna dados
- [ ] UI não mostra "Nenhuma categoria disponível"
- [ ] Console sem erros

---

## 📊 RELATÓRIO PÓS-CORREÇÃO

Após executar as correções, informe:

1. **🔢 Quantas categorias existem** (total)
2. **🟢 Quantas estão active**

Com isso, se ainda falhar, será possível identificar exatamente qual campo está filtrando tudo (country_code, tenant, cache ou parent_id).

