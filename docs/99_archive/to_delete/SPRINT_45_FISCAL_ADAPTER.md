# SPRINT 45: FISCAL ADAPTER (PLUGIN EXTERNO, NÃO CORE)

## RESUMO EXECUTIVO

Implementado camada ADAPTER para emissão fiscal externa:
- ✅ Interface canônica `FiscalProvider`
- ✅ Implementação `MockFiscalProvider` para testes/desenvolvimento
- ✅ `FiscalIssuanceService` para orquestrar emissão externa
- ✅ Integração automática quando documento muda para ISSUED
- ✅ Falhas externas não quebram o sistema

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/src/modules/marketplace/fiscal-provider.types.ts`** (NOVO)
   - Tipos para resultados de emissão/cancelamento
   - `FiscalIssueResult`, `FiscalCancelResult`, `FiscalStatus`, `FiscalDocumentData`

2. **`backend/src/modules/marketplace/fiscal-provider.interface.ts`** (NOVO)
   - Interface canônica `FiscalProvider`
   - Métodos: `issue()`, `cancel()`, `getStatus()`, `isAvailable()`

3. **`backend/src/modules/marketplace/fiscal-provider.mock.ts`** (NOVO)
   - Implementação `MockFiscalProvider`
   - Simula sucesso/falha baseado em taxa configurável
   - Útil para desenvolvimento e testes

4. **`backend/src/modules/marketplace/fiscal-issuance.service.ts`** (NOVO)
   - Service para orquestrar emissão externa
   - Resolve provider baseado em env/config
   - Chama provider e atualiza documento
   - Não bloqueia se provider falhar

5. **`backend/src/modules/marketplace/fiscal-document.service.ts`** (ALTERADO)
   - `issueDocument()` dispara emissão externa automaticamente
   - `cancelDocument()` dispara cancelamento externo automaticamente
   - Falhas externas não bloqueiam operação interna

6. **`backend/src/modules/marketplace/index.ts`** (ALTERADO)
   - Exporta `fiscalIssuanceService`, `mockFiscalProvider` e tipos

## INTERFACE CANÔNICA

```typescript
interface FiscalProvider {
  issue(document: FiscalDocumentData): Promise<FiscalIssueResult>;
  cancel(documentId: string, chaveAcesso?: string, reason?: string): Promise<FiscalCancelResult>;
  getStatus(documentId: string, chaveAcesso?: string): Promise<FiscalStatus>;
  isAvailable(): Promise<boolean>;
}
```

## FLUXO DE EMISSÃO

### 1. Documento muda para ISSUED

```typescript
// FiscalDocumentService.issueDocument()
1. Atualizar status para ISSUED (interno)
2. Disparar emissão externa (não bloqueia)
   → FiscalIssuanceService.issueDocument()
```

### 2. Provider externo

```typescript
// FiscalIssuanceService.issueDocument()
1. Resolver provider (mock ou real)
2. Verificar se disponível
3. Chamar provider.issue()
4. Se sucesso: atualizar documento com chave_acesso, protocolo
5. Se falha: registrar erro no metadata, manter DRAFT
```

### 3. Resultado

- **Sucesso**: Documento atualizado com `chave_acesso`, `protocolo`
- **Falha**: Erro registrado no metadata, documento permanece DRAFT
- **Provider não disponível**: Log apenas, não falha

## REGRAS ARQUITETURAIS

### ✅ Core não conhece SEFAZ

- Core não importa providers específicos
- Core usa apenas interface `FiscalProvider`
- Provider é resolvido dinamicamente

### ✅ Provider é opcional

- Se provider não disponível → não falha
- Se provider falhar → registra erro, não quebra venda
- Sistema continua funcionando sem provider

### ✅ Falha externa não derruba sistema

- Try/catch em todas as chamadas ao provider
- Erros registrados no metadata do documento
- Venda não é bloqueada por falha fiscal externa

### ✅ Provider é plugável

- Mock para desenvolvimento
- Futuro: SEFAZ real, outros provedores
- Resolvido via env/config

## CONFIGURAÇÃO

### Variável de Ambiente

```bash
FISCAL_PROVIDER=mock  # ou 'sefaz', 'other' (futuro)
```

### Resolução do Provider

```typescript
// fiscal-issuance.service.ts
const providerType = process.env.FISCAL_PROVIDER || 'mock';

if (providerType === 'mock') {
  return mockFiscalProvider;
}
// Futuro: outros providers
```

## TESTES MANUAIS

### 1. Emitir Documento (Mock)

```bash
# Criar documento via pagamento
POST /marketplace/payments/execute
# → Documento criado em DRAFT

# Emitir documento
POST /marketplace/fiscal-documents/:id/issue
# → Status muda para ISSUED
# → Mock provider é chamado
# → Documento atualizado com chave_acesso mock
```

### 2. Simular Falha

```typescript
// Configurar mock com taxa de sucesso baixa
const mockProvider = new MockFiscalProvider(0.0); // 0% sucesso

// Tentar emitir
// → Falha registrada no metadata
// → Documento permanece DRAFT
// → Venda não é bloqueada
```

### 3. Provider Não Disponível

```bash
# Desabilitar provider (não configurar)
FISCAL_PROVIDER=none

# Emitir documento
# → Status muda para ISSUED (interno)
# → Provider não é chamado
# → Log de aviso
# → Sistema continua funcionando
```

## VALIDAÇÕES

### ✅ Falha Externa Não Bloqueia

```typescript
try {
  await fiscalIssuanceService.issueDocument(tenantId, documentId);
} catch (issuanceError) {
  // Log mas não bloqueia emissão interna
  console.warn('Erro ao emitir no provider externo:', issuanceError);
}
```

### ✅ Provider Opcional

```typescript
const provider = await this.resolveProvider();
if (!provider) {
  console.warn('Provider não disponível');
  return; // Não falha
}
```

### ✅ Status Atualizado Independentemente

```typescript
// Status interno muda primeiro
const updatedDocument = await fiscalDocumentRepository.updateDocumentStatus(
  tenantId,
  documentId,
  'ISSUED'
);

// Depois tenta emissão externa (não bloqueia)
await fiscalIssuanceService.issueDocument(tenantId, documentId);
```

## OBSERVAÇÕES

1. **Core desacoplado**: Core não conhece SEFAZ, apenas interface
2. **Provider plugável**: Mock agora, SEFAZ real depois
3. **Falhas isoladas**: Erro externo não derruba sistema
4. **Emissão automática**: Disparada quando status muda para ISSUED
5. **Metadata rico**: Erros e sucessos registrados no metadata

## PRÓXIMOS PASSOS

- [ ] Implementar `SefazFiscalProvider` (integração real com SEFAZ)
- [ ] Adicionar retry automático para falhas temporárias
- [ ] Adicionar webhook para notificações da SEFAZ
- [ ] Adicionar UI para visualizar status de emissão externa





