# SPRINT 53: FISCAL PROVIDER SEFAZ (SKELETON REAL, SEM HOMOLOGAÇÃO)

## RESUMO EXECUTIVO

Implementado provider SEFAZ real (skeleton) sem emissão real por padrão:
- ✅ Provider SEFAZ implementado como plugin
- ✅ Feature flags para controle de emissão
- ✅ Registro de tentativas (append-only)
- ✅ Validação de payload e geração de draft
- ✅ Sem emissão real por padrão (SEFAZ_ENABLED=false)

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/188_create_fiscal_provider_attempts.sql`** (NOVO)
   - Tabela `fiscal_provider_attempts` (append-only)
   - Enums: `fiscal_provider_type`, `fiscal_provider_action`, `fiscal_provider_attempt_status`
   - Campos: `id`, `tenant_id`, `fiscal_document_id`, `provider`, `action`, `status`, `error_code`, `error_message`, `metadata`, `created_at`
   - Índices compostos para queries comuns
   - Triggers para prevenir UPDATE/DELETE

2. **`backend/src/modules/marketplace/fiscal-provider.sefaz.ts`** (NOVO)
   - Implementação do `SefazFiscalProvider`
   - Validação de payload
   - Geração de draft (XML/JSON)
   - Preparação de transporte (HTTP client skeleton)
   - Sem emissão real por padrão

3. **`backend/src/modules/marketplace/fiscal-provider-attempt.repository.ts`** (NOVO)
   - Repository para tentativas de providers fiscais
   - Métodos: `createAttempt`, `listAttemptsByDocument`, `listAttemptsByProviderAndStatus`

4. **`backend/src/modules/marketplace/fiscal-provider-attempt.types.ts`** (NOVO)
   - Tipos TypeScript para tentativas
   - `FiscalProviderAttempt`, `CreateFiscalProviderAttemptInput`

5. **`backend/src/modules/marketplace/fiscal-issuance.service.ts`** (ALTERADO)
   - Integração com `SefazFiscalProvider`
   - Registro de tentativas em todas as ações (ISSUE, CANCEL, STATUS)
   - Referência à tentativa no metadata do documento

6. **`backend/.env.example`** (NOVO)
   - Exemplo de variáveis de ambiente
   - Feature flags documentadas
   - Sem valores reais (apenas placeholders)

## FEATURE FLAGS

### Variáveis de Ambiente

```bash
# Provider fiscal a ser usado
FISCAL_PROVIDER=mock|sefaz

# SEFAZ - Habilitar emissão real (false por padrão)
SEFAZ_ENABLED=false|true

# SEFAZ - Ambiente
SEFAZ_ENV=homolog|prod

# SEFAZ - UF
SEFAZ_UF=XX

# SEFAZ - Timeout
SEFAZ_TIMEOUT_MS=30000

# SEFAZ - Endpoint
SEFAZ_ENDPOINT=https://...

# SEFAZ - Certificado
SEFAZ_CERT_PATH=/path/to/cert.pfx
SEFAZ_CERT_PASS=...
```

### Regras de Ativação

1. **Provider Mock (padrão):**
   - `FISCAL_PROVIDER=mock` ou não definido
   - Sempre disponível

2. **Provider SEFAZ:**
   - `FISCAL_PROVIDER=sefaz`
   - `SEFAZ_ENABLED=true` (para emissão real)
   - Variáveis obrigatórias: `SEFAZ_ENV`, `SEFAZ_UF`, `SEFAZ_ENDPOINT`, `SEFAZ_CERT_PATH`

## PROVIDER SEFAZ (SKELETON)

### Funcionalidades Implementadas

1. **Validação de Payload:**
   - Valida campos obrigatórios
   - Valida estrutura do documento
   - Valida itens

2. **Geração de Draft:**
   - Monta payload mínimo (XML/JSON)
   - Estrutura conforme especificação SEFAZ (skeleton)
   - Placeholders para dados reais (emitente, destinatário, etc.)

3. **Preparação de Transporte:**
   - HTTP client skeleton
   - Timeout configurável
   - Preparação para certificado digital

4. **Sem Emissão Real:**
   - Por padrão, retorna `SEFAZ_DISABLED` se `SEFAZ_ENABLED=false`
   - Se habilitado, prepara request mas não envia (skeleton)
   - Endpoint mock local pode retornar sucesso

### Métodos

#### `isAvailable()`
- Verifica se variáveis de ambiente existem
- Verifica se certificado existe
- Retorna `true` apenas se tudo configurado

#### `issue(document)`
- Valida payload
- Monta draft (XML/JSON)
- Se `SEFAZ_ENABLED=false` → retorna `SKIPPED`
- Se `SEFAZ_ENABLED=true` → prepara request (skeleton)

#### `cancel(documentId, chaveAcesso, reason)`
- Valida chave de acesso
- Stub com validação
- Retorna `NOT_IMPLEMENTED` (skeleton)

#### `getStatus(documentId, chaveAcesso)`
- Stub
- Retorna `UNKNOWN` (skeleton)

## REGISTRO DE TENTATIVAS

### Tabela `fiscal_provider_attempts`

**Campos:**
- `id`: UUID
- `tenant_id`: UUID
- `fiscal_document_id`: UUID
- `provider`: `mock` | `sefaz`
- `action`: `ISSUE` | `CANCEL` | `STATUS`
- `status`: `SUCCESS` | `FAILED` | `SKIPPED`
- `error_code`: VARCHAR(100) (opcional)
- `error_message`: TEXT (opcional)
- `metadata`: JSONB
- `created_at`: TIMESTAMP

**Regras:**
- Append-only (sem UPDATE/DELETE)
- Registra TODAS as tentativas (incluindo SKIPPED)
- Auditável e rastreável

### Integração

Tentativas são registradas automaticamente em:
- `issueDocument()` → `ISSUE`
- `cancelDocument()` → `CANCEL`
- `getDocumentStatus()` → `STATUS`

## FLUXO DE EMISSÃO

### 1. Documento Criado
```typescript
// Documento criado em DRAFT
const document = await fiscalDocumentService.createFromOrder(...);
```

### 2. Emissão Externa
```typescript
// FiscalIssuanceService.resolveProvider()
// → Verifica FISCAL_PROVIDER
// → Se 'sefaz', carrega SefazFiscalProvider

// SefazFiscalProvider.issue()
// → Valida payload
// → Monta draft
// → Se SEFAZ_ENABLED=false → retorna SKIPPED
// → Se SEFAZ_ENABLED=true → prepara request (skeleton)

// FiscalIssuanceService.issueDocument()
// → Registra tentativa (SUCCESS/FAILED/SKIPPED)
// → Atualiza documento com resultado
```

### 3. Registro de Tentativa
```typescript
// Tentativa registrada em fiscal_provider_attempts
{
  provider: 'sefaz',
  action: 'ISSUE',
  status: 'SKIPPED', // ou 'SUCCESS' ou 'FAILED'
  errorCode: 'SEFAZ_DISABLED',
  metadata: { ... }
}
```

## SEGURANÇA

### Certificado Digital

- **Caminho:** `SEFAZ_CERT_PATH` (arquivo local, não commitado)
- **Senha:** `SEFAZ_CERT_PASS` (variável de ambiente, nunca hardcoded)
- **Verificação:** Provider verifica se arquivo existe antes de usar

### Feature Flags

- **Padrão:** `SEFAZ_ENABLED=false` (sem emissão real)
- **Ativação:** Apenas com `SEFAZ_ENABLED=true` explicitamente
- **Ambiente:** `SEFAZ_ENV=homolog` por padrão (não produção)

## PRÓXIMOS PASSOS

- [ ] Implementar envio real para SEFAZ (quando necessário)
- [ ] Implementar assinatura XML com certificado digital
- [ ] Implementar cancelamento real
- [ ] Implementar consulta de status real
- [ ] Adicionar testes de integração (mock endpoint)

## OBSERVAÇÕES

1. **Não altera core:** Provider é plugin, não toca em economia/ledger
2. **Falha sem quebrar:** Provider falha sem derrubar venda
3. **Sem emissão real por padrão:** `SEFAZ_ENABLED=false` garante segurança
4. **Tentativas auditáveis:** Todas as tentativas são registradas
5. **Skeleton real:** Estrutura pronta para implementação real futura





