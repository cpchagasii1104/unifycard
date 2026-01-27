# Usuário de Teste Local — Instruções

Script para criar usuário de teste local para desenvolvimento.

## ⚠️ IMPORTANTE

Este é um **seed de desenvolvimento**, não uma feature de produto.
- Não cria tela de cadastro
- Não altera arquitetura
- Apenas cria dados de teste no banco

## Como usar

### 1. Rodar o script

```powershell
# Opção 1: Via npm (se o script estiver no package.json)
npm run dev:user

# Opção 2: Direto com ts-node (garantido)
npx ts-node -r tsconfig-paths/register src/scripts/create-dev-user.ts
```

### 2. Credenciais geradas

O script vai mostrar:
- **Tenant ID** (UUID) — use este no login
- **Email**: `dev@unificard.local`
- **Senha**: `dev1234`

### 3. Login no frontend

No frontend (http://localhost:5173), use:

- **Tenant ID**: Cole o UUID mostrado pelo script (não use "dev-tenant")
- **Email**: `dev@unificard.local`
- **Senha**: `dev1234`

## Exemplo de saída

```
🚀 Criando usuário de teste local...

📦 Verificando tenant de desenvolvimento...
✅ Tenant "Dev Tenant" já existe
   Slug: dev-tenant
   ID: 123e4567-e89b-12d3-a456-426614174000

📦 Verificando usuário de desenvolvimento...
✅ Usuário "dev@unificard.local" criado
   ID: 987fcdeb-51a2-43f1-b789-123456789abc

✨ Usuário de teste criado com sucesso!

📋 Credenciais para login no frontend:
   Tenant ID: 123e4567-e89b-12d3-a456-426614174000
   Email: dev@unificard.local
   Senha: dev1234

💡 Nota: Use o Tenant ID (UUID) acima no campo "Tenant ID" do login.
```

## Características

- **Idempotente**: Pode rodar múltiplas vezes sem erro
- **Seguro**: Senha hasheada com bcrypt (salt rounds 10)
- **Isolado**: Usuário criado apenas no tenant de desenvolvimento
- **RLS**: Respeita Row Level Security do sistema

## Solução de problemas

### Erro: "DATABASE_URL não está configurada"
- Verifique se o arquivo `.env` existe na raiz do projeto
- Verifique se `DATABASE_URL` está configurada

### Erro: "Falha ao criar tenant"
- Verifique se o banco de dados está rodando
- Verifique se as migrations foram executadas

### Login falha no frontend
- Certifique-se de usar o **UUID do tenant**, não o slug "dev-tenant"
- Verifique se o backend está rodando na porta 3000
- Verifique se o email está em minúsculas (o sistema normaliza)

## Arquivo criado

- `src/scripts/create-dev-user.ts` — Script de seed
- Comando: `npm run dev:user`

