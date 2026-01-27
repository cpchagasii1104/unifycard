# SPRINT 84 — KYC BÁSICO + DADOS OBRIGATÓRIOS FISCAIS

## OBJETIVO

Garantir que dados mínimos existam para fiscal/payment links: CPF/CNPJ, nome, endereço, e regras mínimas por regime.

---

## 1. VALIDADORES CANÔNICOS

### 1.1. `backend/src/core/kyc/kyc.validators.ts`

**Funções:**
- `validateCPF(cpf: string): ValidationResult` - Valida CPF com dígito verificador
- `validateCNPJ(cnpj: string): ValidationResult` - Valida CNPJ com dígito verificador
- `validateEmail(email: string): ValidationResult` - Valida email básico
- `validatePhone(phone: string): ValidationResult` - Valida telefone básico
- `normalizeTaxId(value: string): string` - Normaliza CPF/CNPJ (só dígitos)
- `normalizePhone(value: string): string` - Normaliza telefone (só dígitos)
- `validateTaxId(taxId: string, type: 'PERSON' | 'COMPANY'): ValidationResult` - Valida baseado no tipo

**Regras:**
- ✅ CPF/CNPJ com dígito verificador
- ✅ Apenas validação técnica (sem Receita)
- ✅ Retorna lista de erros explicáveis

---

## 2. STATUS DE KYC NO CONTACT

### 2.1. Migration `223_add_kyc_status_to_contacts.sql`

**Campo adicionado:**
- `kyc_status` ENUM: `UNVERIFIED` (default) | `BASIC_VERIFIED`
- Índice por `(tenant_id, kyc_status)` onde `kyc_status = 'BASIC_VERIFIED'`

### 2.2. ContactService

**Métodos adicionados:**
- `validateKyc(contactId)` - Valida CPF/CNPJ + nome + email/phone, se OK marca BASIC_VERIFIED
- `getKycStatus(contactId)` - Busca status KYC do contato

**Validação KYC básica:**
- ✅ Nome obrigatório
- ✅ Tax_id (CPF/CNPJ) obrigatório e válido
- ✅ Email OU telefone obrigatório (pelo menos um)
- ✅ Se válido, atualiza status para BASIC_VERIFIED

### 2.3. Rota

**POST /marketplace/contacts/:id/kyc/validate**

Valida KYC básico do contato.

**Resposta:**
```json
{
  "valid": true,
  "errors": []
}
```

Se válido, atualiza status para `BASIC_VERIFIED` automaticamente.

---

## 3. REGRAS FISCAIS POR REGIME

### 3.1. `backend/src/modules/marketplace/fiscal-kyc.rules.ts`

**Mapa de campos obrigatórios:**

```typescript
REQUIRED_FIELDS_BY_REGIME = {
  MEI: {
    emitter: { taxId: true, name: true, state: false, city: false },
    buyer: { taxId: false, name: false },
  },
  SIMPLES: {
    emitter: { taxId: true, name: true, state: true, city: true },
    buyer: { taxId: true, name: true },
  },
  PRESUMIDO: {
    emitter: { taxId: true, name: true, state: true, city: true },
    buyer: { taxId: true, name: true },
  },
  REAL: {
    emitter: { taxId: true, name: true, state: true, city: true },
    buyer: { taxId: true, name: true },
  },
};
```

**Funções:**
- `validateEmitterFields(regime, emitter)` - Valida campos do emissor
- `validateBuyerFields(regime, buyer)` - Valida campos do comprador

---

## 4. INTEGRAÇÃO COM FISCALDOCUMENT

### 4.1. FiscalDocumentService.issueDocument()

**Mudança:**
- Antes de mudar status para ISSUED, valida KYC básico
- Valida emissor (company tax_profile)
- Se existir buyer (contact_id), valida kyc_status != UNVERIFIED
- Se falhar, lança erro `FISCAL_KYC_INCOMPLETE` com payload de campos faltantes
- **NÃO bloqueia criação do documento DRAFT**

**Código:**
```typescript
// SPRINT 84: Validar KYC básico antes de emitir
const kycValidation = await validateFiscalKyc(tenantId, {
  documentId: document.id,
});

if (!kycValidation.canIssue) {
  const error = new Error('FISCAL_KYC_INCOMPLETE');
  error.code = 'FISCAL_KYC_INCOMPLETE';
  error.missingFields = kycValidation.missingFields;
  error.warnings = kycValidation.warnings;
  throw error;
}
```

---

## 5. ENDPOINT READ-ONLY DE PRÉ-CHECK

### 5.1. `POST /marketplace/fiscal/kyc/check`

**Input:**
```json
{
  "emitterActorId": "...", // Opcional
  "buyerContactId": "...", // Opcional
  "documentId": "..." // Opcional (busca dados do documento)
}
```

**Output:**
```json
{
  "canIssue": false,
  "missingFields": [
    "CNPJ do emissor",
    "UF do emissor",
    "Cidade do emissor"
  ],
  "warnings": [
    "Comprador não possui KYC básico verificado"
  ]
}
```

**Comportamento:**
- ✅ READ-ONLY (não altera dados)
- ✅ Não bloqueia nada
- ✅ Apenas informa o que falta

---

## 6. GUARDRAILS

- ✅ **NÃO bloquear venda** - Venda continua funcionando normalmente
- ✅ **Bloquear apenas emissão fiscal** - Se dados mínimos faltarem, não emite
- ✅ **Nenhuma integração Receita** - Apenas validação técnica
- ✅ **Nenhum ranking/score** - Apenas validação explícita
- ✅ **Nenhuma penalidade invisível** - Erros são claros e explicáveis
- ✅ **Tudo auditável** - Todas as validações registradas

---

## 7. FLUXO: VENDA → DRAFT → ISSUE

### 7.1. Venda (Payment SUCCESS)

1. Pagamento executado com sucesso
2. Cria documento fiscal em **DRAFT** (sem validação KYC)
3. Salva `contact_id` no metadata se fornecido
4. **Nada bloqueia a venda**

### 7.2. Emissão Fiscal (issueDocument)

1. Documento está em DRAFT
2. Sistema valida KYC básico:
   - Emissor: CNPJ + nome + (UF/cidade conforme regime)
   - Comprador: CPF/CNPJ + nome (se informado) + KYC verificado
3. Se válido: muda status para **ISSUED**
4. Se inválido: lança erro `FISCAL_KYC_INCOMPLETE` com campos faltantes

---

## 8. EXEMPLOS DE ERRO

### 8.1. Emissor sem CNPJ

```json
{
  "code": "FISCAL_KYC_INCOMPLETE",
  "message": "FISCAL_KYC_INCOMPLETE",
  "missingFields": ["CNPJ do emissor"],
  "warnings": []
}
```

### 8.2. Comprador sem KYC verificado

```json
{
  "code": "FISCAL_KYC_INCOMPLETE",
  "message": "FISCAL_KYC_INCOMPLETE",
  "missingFields": [],
  "warnings": ["Comprador não possui KYC básico verificado"]
}
```

### 8.3. Regime SIMPLES sem UF/cidade

```json
{
  "code": "FISCAL_KYC_INCOMPLETE",
  "message": "FISCAL_KYC_INCOMPLETE",
  "missingFields": [
    "UF do emissor",
    "Cidade do emissor"
  ],
  "warnings": []
}
```

---

## 9. ARQUIVOS CRIADOS/ALTERADOS

### Backend
- `backend/src/core/kyc/kyc.validators.ts` (NOVO)
- `backend/migrations/223_add_kyc_status_to_contacts.sql` (NOVO)
- `backend/src/modules/marketplace/contact.types.ts` (ALTERADO - adicionado KycStatus)
- `backend/src/modules/marketplace/contact.repository.ts` (ALTERADO - adicionado kyc_status)
- `backend/src/modules/marketplace/contact.service.ts` (ALTERADO - métodos validateKyc, getKycStatus)
- `backend/src/modules/marketplace/contact.routes.ts` (ALTERADO - rota POST /contacts/:id/kyc/validate)
- `backend/src/modules/marketplace/fiscal-kyc.rules.ts` (NOVO)
- `backend/src/modules/marketplace/fiscal-kyc.service.ts` (NOVO)
- `backend/src/modules/marketplace/fiscal-kyc.routes.ts` (NOVO)
- `backend/src/modules/marketplace/fiscal-document.service.ts` (ALTERADO - validação KYC em issueDocument)
- `backend/src/modules/marketplace/marketplace.routes.ts` (ALTERADO - registro de fiscal-kyc.routes)

### Documentação
- `SPRINT_84_KYC_BASICO.md` (NOVO)

---

## 10. CRITÉRIO DE PRONTO

✅ Contact tem status KYC
✅ Validação é explícita e explicável
✅ Fiscal NÃO emite sem dados mínimos
✅ Venda continua funcionando normalmente
✅ Nenhuma integração externa
✅ Nenhuma automação punitiva
✅ Endpoint read-only de pré-check funcional
✅ Documentação completa

---

## 11. NOTAS

- KYC básico valida apenas dados técnicos (formato, dígitos verificadores)
- Não integra com Receita Federal
- Status KYC é atualizado automaticamente quando validação passa
- Regras por regime são declarativas (não calculam nada)
- Erros são claros e explicáveis (lista de campos faltantes)
- Nada bloqueia venda, apenas emissão fiscal



