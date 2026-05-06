---

# RFC G2 — Validação E2E Transversal

**Status:** APROVADO — IMPLEMENTAÇÃO PENDENTE  
**Data:** 2026-04-29  
**Gap:** G2 (E2E transversal ausente)  
**Decisão base:** SYSTEM_REMEDIATION_PLAN §10 (prioridade por impacto real), P5 (toda correção roda contra seed realista)  
**Responsável:** Clayton  
**Sucessor lógico:** após C63 FIXED (sessão 2026-04-29) e G1 FECHADO (sessão 2026-04-29)

---

## 1. Problema

O sistema declara 12 módulos concluídos e 32 violações FIXED. Não existe prova viva
de que o fluxo transversal funciona ponta-a-ponta. `validate-financial-flow-real.ts`
cobre apenas o core financeiro isolado (mint → transfer → split), não o caminho
real de negócio.

Sem E2E transversal, "FIXED" é alegação documental, não evidência de comportamento.

## 2. Escopo

### 2.1 Fluxo canônico a validar

```
evento → RFQ → booking → payment → settlement → split → ledger
```

### 2.2 Serviços envolvidos (auditoria SRC_FULL 2026-04-29)

| Etapa | Serviço | Path |
|---|---|---|
| RFQ | event-rfq.service.ts | `backend/src/modules/events/` |
| Booking decision | service-booking-decision.service.ts | `backend/src/modules/services/` |
| Payment execution | payment-execution.service.ts | `backend/src/modules/marketplace/` |
| Payment execution (alt) | service-payment-execution.service.ts | `backend/src/modules/services/` |
| Payment execution (alt) | event-payment-execution.service.ts | `backend/src/core/events/` |
| Settlement | bank-settlement-worker.ts | `backend/src/workers/` |
| Treasury split | treasury-split.service.ts | `backend/src/modules/treasury-split/` |

**Observação importante:** existem 3 caminhos de payment-execution. O RFC NÃO decide
qual é canônico — a implementação validará em SRC atualizado e escolherá o caminho
que reflete fluxo de negócio real (provável: marketplace para serviços, event para
ingressos, services para bookings de profissional).

## 3. Invariantes não-negociáveis (devem PASS no script)

### 3.1 SSOT financeiro
- `bank_ledger` é única verdade contábil
- Soma de débitos = soma de créditos por transação (dupla entrada)
- Nenhum saldo inferido fora do ledger
- `concept_id` presente em toda transação (LEI §4.10.6)

### 3.2 Causalidade
- Ordem semântica → identidade → autoridade → tempo → estado → financeiro → evento (LEI §7)
- Split só ocorre APÓS settlement (não antes, não simultaneamente)
- Settlement só ocorre APÓS payment execution
- Booking só após RFQ aceita
- Sem evento gerando estado fora de ordem

### 3.3 Identidade
- `actor_id` presente em toda transação financeira
- Cadeia até actor humano rastreável
- `requesterActorId` e `payerActorId` válidos no domínio do tenant

### 3.4 Authority
- Toda movimentação financeira passa por authority gate (§4.6)
- `authority_source` registrada em bank_transactions
- Nenhum bypass detectado

## 4. Critério de PASS (binário, sem interpretação)

Script retorna exit code 0 e imprime `E2E_TRANSVERSAL: PASS` apenas se TODOS:

- [ ] RFQ criada com sucesso, `actor_id` presente
- [ ] Quote aceita, booking gerado com FK válida para RFQ
- [ ] Payment execution dispara, retorna `transactionId`
- [ ] `bank_transactions` tem linha com `concept_id` correto
- [ ] `bank_ledger` tem entradas em dupla entrada (soma zero)
- [ ] Settlement processado (status `settled`)
- [ ] Split gerado com soma exata = amount do payment
- [ ] Saldos finais batem: soma de créditos = soma de débitos no tenant
- [ ] Nenhuma violação de ordem causal detectada (timestamps monotônicos)

## 5. Critério de FAIL (sem interpretação, exit code != 0)

Qualquer um dos seguintes força FAIL:

- Divergência de cents em qualquer ponto (1 cent já é FAIL)
- Ausência de lançamento esperado em bank_ledger
- Execução fora de ordem temporal
- `actor_id` NULL em qualquer ponto da cadeia
- Side-effect fora do ledger (saldo derivado, cálculo paralelo)
- `concept_id` ausente em qualquer transação financeira
- Authority bypass detectado
- Split criado antes de settlement
- Soma do split != amount do payment

## 6. Saída esperada

### 6.1 Estruturada (JSON em stdout)

```json
{
  "result": "PASS" | "FAIL",
  "reason": "string (em FAIL) | null (em PASS)",
  "checks": {
    "rfq_created": true|false,
    "booking_created": true|false,
    "payment_executed": true|false,
    "ledger_double_entry": true|false,
    "settlement_processed": true|false,
    "split_consistent": true|false,
    "actor_chain_present": true|false,
    "concept_id_present": true|false,
    "causality_ordered": true|false
  },
  "evidence": {
    "rfq_id": "uuid",
    "booking_id": "uuid",
    "transaction_id": "uuid",
    "settlement_id": "uuid|null",
    "split_count": "number",
    "ledger_entries_count": "number",
    "amount_cents_total": "number"
  }
}
```

### 6.2 Humanamente legível (stderr)

Resumo final: linha única `E2E_TRANSVERSAL: PASS` ou `E2E_TRANSVERSAL: FAIL [motivo]`.

## 7. Dependências explícitas (BLOQUEADORES PARA IMPLEMENTAÇÃO)

Antes de codar o script, validar contra SRC_FULL atualizado:

1. **Assinatura real** dos 5+ serviços (parâmetros, retornos)
2. **Schema atual** das tabelas: `event_rfq`, `bookings`, `payment_intents`, `bank_transactions`, `bank_ledger`, `bank_splits`
3. **Caminho canônico de payment-execution** entre os 3 disponíveis
4. **Existência de seed** que crie tenant, users com actors, conta de sistema com saldo
5. **Modo de execução** (script standalone vs job vs CI step)

Implementação SEM essas validações é proibida (P5 do PLAN).

## 8. Plano de implementação (próxima sessão)

### Etapa 1 — Validação de dependências
- Carregar SRC_FULL atualizado
- Confirmar assinaturas dos 5 serviços
- Decidir caminho canônico de payment-execution
- Verificar seed disponível (`seed-dev-complete` ou similar)

### Etapa 2 — Estrutura do script
- Localização: `backend/src/scripts/validate-e2e-transversal.ts`
- Padrão: seguir `validate-financial-flow-real.ts` existente (pool + dotenv + main)
- Tenant: usar `E2E_TENANT_ID` ou default

### Etapa 3 — Implementação
- 1 commit por fase do fluxo (RFQ → booking → payment → settlement → split)
- Após cada commit: rodar script + 4 gates
- Sem agrupar fases (P2 do PLAN)

### Etapa 4 — Adicionar ao package.json
- Novo script: `validate:e2e-transversal`
- Execução: `pnpm --dir backend run validate:e2e-transversal`

### Etapa 5 — Adicionar ao CI (após PASS local)
- Novo step em `validate-backend` no `.github/workflows/ci.yml`
- Requer `DATABASE_URL` configurado em CI (decisão de infra pendente)

## 9. Critério de conclusão de G2

G2 só pode ser marcado FECHADO após:

- Script `validate-e2e-transversal.ts` existe e roda
- Script retorna PASS contra seed realista
- Script integrado ao package.json
- 4 gates verdes em estado pós-script
- Documentação atualizada (STATUS, MODULOS T-block, estouaprendendo)
- Decisão sobre inclusão em CI registrada (pode ficar fora de CI inicialmente
  por exigir DATABASE_URL — ALLOWLISTED com deadline)

## 10. O que este RFC NÃO faz

- NÃO substitui `validate-financial-flow-real.ts` (que valida core isolado)
- NÃO altera serviços existentes
- NÃO cria nova abstração
- NÃO inclui validação de UI/frontend
- NÃO cobre fluxos secundários (refund, chargeback, cancellation) — escopo separado
- NÃO valida performance (apenas correção)

## 11. Referências

- SYSTEM_REMEDIATION_PLAN §10 (prioridade por impacto real)
- SYSTEM_REMEDIATION_PLAN §P5 (seed realista executando fluxos)
- LEI_DE_COERENCIA_SISTEMICA §4.6, §4.10.6, §7
- `validate-financial-flow-real.ts` (modelo estrutural — não funcional)
- OBSERVACOES-PRODUTO ("Gate C.17 não executado: catalog → concept_ref → intent → ledger")
- estouaprendendo §13 (gap G2 documentado em 2026-04-25)

---

Após criar, confirmar path exato e não executar nada além disso.
