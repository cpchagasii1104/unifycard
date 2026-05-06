# Checklist de MVP para sistemas financeiros

Referência para garantir que **nada crítico fique de fora** antes do lançamento. Inspirado em práticas de Stripe, Square, Nubank e Adyen.

---

## 1. Ledger e integridade

| Item | Descrição | UnifiCard |
|------|-----------|-----------|
| Ledger append-only | INSERT permitido; UPDATE/DELETE bloqueados | ✅ Migration 0027 |
| Double-entry | Toda transação = débito + crédito (soma zero) | ✅ bank_ledger |
| Saldo derivado do ledger | Nenhum “saldo em coluna” como fonte da verdade | ✅ calculateBalance |
| Bloqueio de saldo negativo | Rejeitar transferência se saldo &lt; valor | ✅ INSUFFICIENT_FUNDS |
| Limite de valor (overflow) | Rejeitar valores acima do limite seguro | ✅ AMOUNT_OVERFLOW |
| Invariantes no banco | Triggers/constraints como última linha de defesa | ✅ coverage, negative balance |

---

## 2. Idempotência e referências

| Item | Descrição | UnifiCard |
|------|-----------|-----------|
| Idempotência por referência | (tenant_id, reference_type, reference_id) → uma transação | ✅ UNIQUE + retorno existente |
| Retry em concorrência | Em caso de UNIQUE violation, retornar transação existente | ✅ Retry + SELECT existing |
| Webhooks/eventos duplicados | Mesmo evento não gera segunda transação | ✅ reference_type/reference_id |
| Payout/settlement duplicado | Mesmo idempotency key não duplica liquidação | ✅ settlePaymentToSeller, confirmBankPayout |

---

## 3. Reconciliação e auditoria

| Item | Descrição | UnifiCard |
|------|-----------|-----------|
| Registro de discrepâncias | Gateway vs ledger vs banco | ✅ reconciliation_discrepancies |
| Ajustes rastreáveis | Ajuste ligado a transação real (FK) | ✅ adjustment_transaction_id |
| Histórico imutável | Ledger não alterável; correções via novas linhas | ✅ Append-only |
| Rastreabilidade (quem/quando) | actor_id, tenant_id, created_at nas transações | ✅ bank_transactions |

---

## 4. Fluxo de pagamento ponta a ponta

| Item | Descrição | UnifiCard |
|------|-----------|-----------|
| Captura → escrow | Pagamento do user fica em custódia | ✅ executePayment / transfer to escrow |
| Settlement | Escrow → clearing → seller_pending | ✅ settlePaymentToSeller |
| Release | seller_pending → seller_available (após janela) | ✅ releaseSellerFunds |
| Payout solicitado | seller_available → seller_payout | ✅ requestSellerPayout |
| Confirmação bancária | seller_payout → bank_settlement | ✅ confirmBankPayout |
| Teste de fluxo real | Um spec que percorre todo o pipeline | ✅ real-payment-flow.spec.ts |

---

## 5. Segurança e limites

| Item | Descrição | UnifiCard |
|------|-----------|-----------|
| Limite de cobertura | Ex.: máx. 80% do capacity em créditos não-system | ✅ Trigger coverage |
| Validação de valor | amount_cents &gt; 0 e ≤ limite | ✅ Overflow + positivo |
| Isolamento por tenant | Nenhuma operação cross-tenant | ✅ tenant_id em queries |
| Autoria (authorship) | Quem age e em nome de quem | ✅ FinancialAuthorshipContext |

---

## 6. Testes e CI

| Item | Descrição | UnifiCard |
|------|-----------|-----------|
| Suite de caos/regressão | Testes que quebram se invariantes falharem | ✅ Financial Chaos Suite |
| CI bloqueia em falha | Migrate e testes não ignoram erro | ✅ Sem continue-on-error |
| Teste de saldo negativo | Transferência acima do saldo deve falhar | ✅ Ledger 11, 13 |
| Teste de idempotência | Mesma referência não duplica | ✅ Idempotency 1–5 |
| Teste de concorrência | Race conditions não corrompem ledger | ✅ Race 6–9 |

---

## 7. Observability (próximo passo)

| Item | Descrição | UnifiCard |
|------|-----------|-----------|
| Logs estruturados de evento financeiro | transaction_id, reference_type, account_id, amount_cents, actor_id, tenant_id | ⏳ A implementar |
| Métricas: ledger_drift | Soma débitos = soma créditos (por tenant/período) | ⏳ A implementar |
| Métricas: duplicate_reference_attempt | Contagem de tentativas idempotentes | ⏳ A implementar |
| Métricas: settlement_latency | Tempo entre captura e settlement | ⏳ A implementar |
| Métricas: payout_queue | Volume/quantidade pendente de payout | ⏳ A implementar |
| Dashboard de integridade | Ledger health, coverage usage, reconciliação | ⏳ A implementar |

---

## 8. MVP mínimo para lançamento

### Obrigatório

- [x] Ledger imutável e double-entry  
- [x] Saldo negativo e overflow bloqueados  
- [x] Idempotência por referência e retry em concorrência  
- [x] Reconciliação e ajustes rastreáveis  
- [x] Fluxo completo: user → escrow → settlement → release → payout → bank_settlement  
- [x] Chaos suite (19/20 ou 20/20) + CI que falha em erro  
- [ ] Observability básica (logs estruturados + 2–3 métricas críticas)

### Recomendado antes de escala

- [ ] Dashboard de integridade (ledger health, coverage, reconciliação)  
- [ ] Testes adicionais: double spend, replay attack, ledger drift  
- [ ] Documentação de runbook para incidentes financeiros  

### Pós-MVP

- [ ] Métricas avançadas e alertas  
- [ ] Fragmentação / detecção de fraude  
- [ ] Relatórios regulatórios e exportação para contabilidade  

---

## 9. Referência rápida

- **Não duplicar:** saldo, ledger, idempotência, definição de actor, reconciliação → tudo no **core (bank)**.  
- **MVP =** core (identity, actors, bank, observability) + módulo marketplace + API + frontend mínimo.  
- **Foco imediato:** 20/20 Chaos → Observability financeira → validar fluxo real em ambiente próximo de produção.

Este checklist pode ser atualizado conforme o UnifiCard atender cada item ou adotar novos critérios de MVP.
