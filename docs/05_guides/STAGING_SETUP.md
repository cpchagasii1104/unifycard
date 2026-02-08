# Configuração de Staging - Unificard

## Objetivo

Preparar ambiente de staging para validação real do Fundo Regional.

## Configuração

### 1. Variáveis de Ambiente

Copie `.env.staging.example` para `.env.staging` e configure:

```bash
cp .env.staging.example .env.staging
```

**Variáveis obrigatórias:**
- `NODE_ENV=staging`
- `DATABASE_URL_STAGING` - URL do banco de staging
- `FUND_VISIBILITY_ENABLED=true` - Feature flag do fundo

### 2. Database

O sistema usa `DATABASE_URL_STAGING` quando `NODE_ENV=staging`.

**Importante:**
- Banco separado de dev/prod
- Dados persistentes
- Split engine funciona igual ao prod
- Ledger não usa mocks

### 3. Executar em Staging

```bash
# Definir ambiente
export NODE_ENV=staging

# Ou no Windows PowerShell
$env:NODE_ENV="staging"

# Executar servidor
npm run dev
```

## Logs Estruturados

Logs são gerados automaticamente para:

1. **Transações WORK criadas**
   - Formato: `work_transaction_created`
   - Campos: timestamp, module, regionId, amount, transactionId, tenantId, assignmentId, jobId, workerId

2. **Splits executados**
   - Formato: `split_executed`
   - Campos: timestamp, module, regionId, amount, transactionId, tenantId, splitTargetType, splitPercentage

3. **Créditos em conta REGION**
   - Formato: `region_credit`
   - Campos: timestamp, module, regionId, amount, transactionId, tenantId

**Exemplo de log:**
```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "module": "work",
  "regionId": "state-123",
  "amount": 10.00,
  "transactionId": "uuid-here",
  "tenantId": "tenant-uuid",
  "logType": "region_credit"
}
```

## Feature Flag

### FUND_VISIBILITY_ENABLED

Controla visibilidade do Fundo Regional:

- `true` (default): Fundo visível no frontend e rotas ativas
- `false`: Fundo oculto, rotas retornam 404

**Configurar:**
```bash
FUND_VISIBILITY_ENABLED=false  # Desabilitar
FUND_VISIBILITY_ENABLED=true  # Habilitar (default)
```

## Validação

### Checklist de Staging

- [ ] Banco de staging configurado
- [ ] `NODE_ENV=staging` definido
- [ ] `DATABASE_URL_STAGING` configurado
- [ ] Servidor inicia sem erros
- [ ] É possível criar transação WORK
- [ ] Split engine funciona (10% REGION)
- [ ] Fundo Regional acumula dinheiro real
- [ ] Logs estruturados aparecem no console
- [ ] Feature flag funciona (testar true/false)

### Testar Split Engine

1. Criar assignment no WORK
2. Completar assignment (gera pagamento)
3. Verificar logs:
   - `work_transaction_created`
   - `split_executed` (REGION)
   - `region_credit`
4. Verificar saldo do fundo via `/economy/fund/summary`

## Observações

- Logs são estruturados em JSON
- Sem ferramentas externas obrigatórias
- Feature flag permite desligar fundo se necessário
- Dados são persistentes (não mocks)











