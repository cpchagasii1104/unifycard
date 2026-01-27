# CHECKLIST TÉCNICO - IMPLEMENTAÇÃO UNIFYCARD

## PRIORIDADE IMEDIATA (P0)

### 1. Correções de Migrations
- [ ] Renomear `028_catalog_canonical.sql` → `028a_catalog_canonical.sql`
- [ ] Renomear `028_categories_system.sql` → `028b_categories_system.sql`
- [ ] Renomear `055_categories_ai_blindage.sql` → `055a_categories_ai_blindage.sql`
- [ ] Renomear `055_categories_ai_validation.sql` → `055b_categories_ai_validation.sql`
- [ ] Documentar gaps (007, 008, 018, 040, 041) em migrations/README.md

### 2. Limpeza de Dependências
- [ ] Remover `express` do package.json
- [ ] Remover `@types/express` do package.json
- [ ] Rodar `npm install` para atualizar lock file

### 3. UnifyBank - Migration
```sql
-- Criar arquivo: migrations/057_unifybank_test_currency.sql
-- Conteúdo: Ver seção 8.1 do relatório
```

## PRIORIDADE ALTA (P1)

### 4. UnifyBank - Services
```
src/core/unifybank/
├── unifybank.module.ts
├── test-currency.service.ts
├── test-currency.routes.ts
├── card.service.ts
├── card.routes.ts
├── pos.service.ts
└── pos.routes.ts
```

### 5. Sistema de Voz - Backend
```
src/modules/assistant/
├── channels/
│   └── voice.channel.ts
└── services/
    └── transcription.service.ts
```

### 6. PlanGateService
```
src/core/plans/
├── plan-gate.service.ts
├── plan-gate.routes.ts
└── plan.types.ts
```

### 7. Governança de Categorias
```
src/core/categories/
├── category-review.service.ts
├── category-review.routes.ts
└── semantic-validator.service.ts
```

## PRIORIDADE MÉDIA (P2)

### 8. Integração Split em Rides
- [ ] Adicionar split em `ride-completion.service.ts`
- [ ] Emitir evento `rides.payment.completed`
- [ ] Testar fluxo completo

### 9. City Readiness
- [ ] Implementar `CityReadinessService`
- [ ] Adicionar checks em work, rides, events
- [ ] Criar migration para tabela `city_readiness`

### 10. Frontend - Componentes Novos
- [ ] `VoiceInput.tsx` - Entrada de voz
- [ ] `CategoryReviewQueue.tsx` - Queue de revisão admin
- [ ] `TestCurrencyAdmin.tsx` - Painel admin moeda teste

## TESTES OBRIGATÓRIOS

### E2E a Criar
- [ ] `work.e2e.spec.ts` - Fluxo completo work + payment
- [ ] `economy.e2e.spec.ts` - Split + Ledger
- [ ] `categories.e2e.spec.ts` - Criação IA + Aprovação
- [ ] `unifybank.e2e.spec.ts` - Emissão + Pagamento

## VERIFICAÇÕES PRÉ-DEPLOY

- [ ] TypeScript compila sem erros (`npm run build`)
- [ ] Todas migrations executam em sequência
- [ ] Health check responde 200
- [ ] Auth flow funciona (login → token → protected route)
- [ ] Split executa com 4 destinos
- [ ] Categorias criam com sanitização

---

**Usar este checklist para acompanhar progresso.**
