# Limpeza Canônica de Empresa

## Objetivo

Tornar uma empresa **TOTALMENTE INOPERANTE e invisível**, sem violar o **Database Canonical Truth Contract**.

## Regras Absolutas

✅ **NÃO apaga** eventos, audit logs ou decisões históricas  
✅ **NÃO truncar** tabelas append-only  
✅ **NÃO reescrever** passado  
✅ **NÃO criar** atalhos fora do core  
✅ **Preserva histórico** para auditoria  

## O que o script faz

1. **Marca Company como `closed`** (estado canônico existente)
2. **Desativa todos os `company_users`** (`is_active = false`)
3. **Suspende todos os `company_members`** (`status = 'suspended'`)
4. **Revoga todas as delegações** relacionadas aos Actors da Company
5. **Pausa todos os Services** dos Actors da Company (`status = 'paused'`)
6. **Desativa `company_domains`** (`enabled = false`)

## O que o script NÃO faz

❌ **NÃO apaga** eventos (preserva histórico)  
❌ **NÃO apaga** audit logs  
❌ **NÃO apaga** transações financeiras  
❌ **NÃO apaga** decisões históricas  
❌ **NÃO apaga** qualquer registro append-only  

## Como executar

### Opção 1: Via função SQL (recomendado)

```sql
-- Por CNPJ
SELECT * FROM close_company_canonical('32.121.543/0001-53');

-- Por company_id
SELECT * FROM close_company_canonical('550e8400-e29b-41d4-a716-446655440000');
```

### Opção 2: Via script TypeScript

```bash
cd backend
npm run ts-node scripts/close-company-canonical.ts 32.121.543/0001-53
```

ou

```bash
npm run ts-node scripts/close-company-canonical.ts 550e8400-e29b-41d4-a716-446655440000
```

### Opção 3: Via psql

```bash
cd backend
psql $DATABASE_URL -c "SELECT * FROM close_company_canonical('32.121.543/0001-53');"
```

## Resultado esperado

O script retorna:

```json
{
  "company_id": "550e8400-e29b-41d4-a716-446655440000",
  "company_name": "Empresa Teste",
  "status_before": "active",
  "status_after": "closed",
  "actions_taken": [
    { "action": "company_closed", "count": 1 },
    { "action": "company_users_deactivated", "count": 3 },
    { "action": "company_members_suspended", "count": 2 },
    { "action": "delegations_revoked", "count": 5 },
    { "action": "services_paused", "count": 10 },
    { "action": "company_domains_disabled", "count": 2 }
  ]
}
```

## Critério de sucesso

Após a execução:

✅ A empresa **não pode ser usada** para absolutamente nada  
✅ **Nenhuma ação** pode ser executada por ela  
✅ O **histórico permanece auditável**  
✅ O **sistema continua consistente** com o core  
✅ A empresa **não aparece** em feeds, buscas ou listagens  
✅ A empresa **não pode ser actingActor**  
✅ A empresa **não pode receber fundos**  
✅ A empresa **não pode executar ações**  

## Validação pós-fechamento

1. Verificar que `companies.status = 'closed'`
2. Verificar que todos os `company_users.is_active = false`
3. Verificar que todos os `company_members.status = 'suspended'`
4. Verificar que todas as `actor_delegations.status = 'revoked'` (onde aplicável)
5. Verificar que todos os `services.status = 'paused'` (onde aplicável)
6. Verificar que todos os `company_domains.enabled = false`

## Observações importantes

- ✅ **Histórico preservado:** Eventos, logs e transações não são apagados
- ✅ **Auditoria intacta:** Todas as decisões históricas permanecem
- ✅ **Core consistente:** O sistema continua funcionando normalmente
- ✅ **Seguro para DEV:** Pode ser usado em ambiente de desenvolvimento
- ⚠️ **Produção:** Usar com cuidado em produção (empresa ficará inoperante permanentemente)

## Instalação da função SQL

A função `close_company_canonical()` deve ser criada no banco de dados antes do uso:

```bash
cd backend
psql $DATABASE_URL -f scripts/close-company-canonical.sql
```

## Rollback

Se precisar reverter (não recomendado):

1. Restaurar backup do banco de dados
2. Ou reverter manualmente cada ação (não recomendado)

## Conformidade canônica

Este script está em conformidade com:

- ✅ `Database_Canonical_Truth_Contract.md` — Preserva histórico
- ✅ `EMPRESA_NASCIMENTO_CANONICO.md` — Respeita estados canônicos
- ✅ `CORE_IMUTAVEL.md` — Não viola core imutável
- ✅ `CHECK_DUPLICIDADE_OBRIGATORIO.md` — Não cria duplicação

