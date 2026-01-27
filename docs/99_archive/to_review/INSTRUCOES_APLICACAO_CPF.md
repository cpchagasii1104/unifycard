# 🔧 APLICAÇÃO DA CORREÇÃO — CPF

## ARQUIVOS ENTREGUES

| Arquivo | Destino |
|---------|---------|
| `devLog.ts` | `backend/src/utils/devLog.ts` |
| `profile.service.ts` | `backend/src/core/profile/profile.service.ts` |

---

## ORDEM DE EXECUÇÃO

### 1. Criar devLog no backend

```bash
mkdir -p backend/src/utils
cp devLog.ts backend/src/utils/devLog.ts
```

### 2. Adicionar alias no tsconfig.json (se não existir)

```json
{
  "compilerOptions": {
    "paths": {
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

### 3. Substituir profile.service.ts

```bash
cp profile.service.ts backend/src/core/profile/profile.service.ts
```

### 4. Garantir constraint no banco

```sql
-- Verificar
SELECT conname FROM pg_constraint WHERE conrelid = 'user_profiles'::regclass;

-- Se não existir 'user_profiles_user_id_unique':
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
```

### 5. Reiniciar backend

```bash
cd backend && npm run dev
```

---

## VALIDAÇÃO

### Teste 1: Salvar CPF

1. Abrir `/profile`
2. Digitar CPF válido
3. Clicar Salvar
4. Verificar logs:

```
[DEV:profile.cpf.extraction.sources] ...
[DEV:profile.cpf.extraction.found] ✅ ...
[DEV:profile.cpf.save.upsert] ...
[DEV:profile.cpf.save.success] ✅ ...
```

### Teste 2: Banco

```sql
SELECT u.email, up.cpf 
FROM users u 
LEFT JOIN user_profiles up ON up.user_id = u.user_id 
WHERE u.email = 'dev@unificard.local';
```

---

## O QUE FOI CORRIGIDO

| Problema | Solução |
|----------|---------|
| Log via console.log | Substituído por `devLog` (GOLDEN_PATH) |
| Extração única de CPF | Extração multi-fonte (4 locais) |
| Erro engolido | Log estruturado + erro explícito se 0 rows |
| Constraint ausente | Verificação + criação on-the-fly |

---

*Correção alinhada com GOLDEN_PATH — Claude + ChatGPT — 02/01/2026*
