# Remover Empresa de Teste

## Objetivo
Remover completamente a empresa de teste do ambiente de desenvolvimento:
- **CNPJ:** 32.121.543/0001-53
- **Nome:** Teste
- **Usuário:** Clayton Pereira Chagas

## O que o script faz

1. **Identifica a empresa** pelo CNPJ
2. **Verifica dependências:**
   - `company_users` (relacionamentos usuário-empresa)
   - `events` (eventos criados pela empresa)
   - `accounts` (contas financeiras)
   - `company_documents` (documentos enviados)
3. **Desvincula dados (preserva histórico):**
   - Eventos: remove vínculo `actor_id` e `actor_type` (não apaga eventos)
   - Accounts: remove vínculo `owner_id` e `owner_type` (preserva histórico financeiro)
4. **Remove relacionamentos:**
   - `company_users` (removido explicitamente)
   - `company_documents` (removido por CASCADE)
5. **Remove a empresa** (hard delete)

## Como executar

### Opção 1: Via psql (recomendado)

```bash
cd backend
psql $DATABASE_URL -f scripts/remove-test-company.sql
```

### Opção 2: Via PowerShell (Windows)

```powershell
cd backend
$env:DATABASE_URL = (Get-Content .env | Select-String "DATABASE_URL" | ForEach-Object { $_.Line.Split('=', 2)[1] })
Get-Content scripts/remove-test-company.sql | psql $env:DATABASE_URL
```

### Opção 3: Copiar e colar no cliente SQL

1. Abrir cliente SQL (pgAdmin, DBeaver, etc.)
2. Conectar no banco de dados
3. Copiar conteúdo de `scripts/remove-test-company.sql`
4. Executar

## Resultado esperado

O script exibirá mensagens como:
```
NOTICE: Empresa encontrada: Teste (ID: xxx, User: xxx)
NOTICE: Dependências encontradas:
NOTICE:   - company_users: X
NOTICE:   - events: X
NOTICE:   - accounts: X
NOTICE: ✅ Empresa removida com sucesso: Teste
```

E ao final:
```
resultado
-------------------
✅ Empresa removida com sucesso
```

## Validação pós-remoção

1. Acessar `/empresas` no frontend
2. A empresa "Teste" não deve mais aparecer
3. O usuário deve conseguir criar uma nova empresa normalmente

## Observações importantes

- ✅ **Histórico financeiro preservado:** Transações e ledger não são apagados
- ✅ **Eventos preservados:** Eventos não são apagados, apenas desvinculados
- ✅ **Apenas ambiente dev:** Este script é seguro apenas para desenvolvimento
- ⚠️ **Não executar em produção:** Este script não deve ser usado em produção

## Rollback

Se precisar reverter (não recomendado):
- Restaurar backup do banco de dados
- Ou recriar a empresa manualmente














