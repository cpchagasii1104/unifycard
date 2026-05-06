# PROMPT 53.1 — Risk Enforcement Hardening (obrigatório pós-53)

**Status:** **EXECUTADO** (código + migration 0057 + doc touchpoints)  
**Decisão:** aprovação **parcial** do 53; **não** reverter 53; **sim** endurecer cobertura.

**Princípio:** o cérebro (risk + identidade) já existe; falta conexão uniforme ao corpo (fluxos financeiros + consistência de `actor_id` + limites).

---

## 1. `bank_accounts` — backfill + `VALIDATE CONSTRAINT`

**Problema hoje:** `CHECK … NOT VALID` permite linhas legadas sem `actor_id` → bypass de enforcement baseado em actor.

**Exigido:**

1. Inventariar `bank_accounts` com `owner_type = 'actor'` e `actor_id IS NULL`.
2. Backfill determinístico (UUID em `owner_id`, mapeamento user→actor documentado, ou fila manual).
3. `ALTER TABLE bank_accounts VALIDATE CONSTRAINT bank_accounts_actor_required_for_actor_owner;`
4. Falha de validate → corrigir linha a linha até zero violações.

**Não:** dropar o CHECK; não relaxar regra para produção.

---

## 2. Enforcement centralizado — cobertura total

**Problema hoje:** P2P coberto; outros fluxos dependem de `actorId` explícito e chamada ad hoc.

**Exigido:**

- Ponto único de entrada documentado: `assertActorFinancialPermission(tenantId, actorId, action)` (ou wrapper por domínio).
- **Obrigatório** antes de mutação financeira relevante (não após ledger):
  - payout (criação / execução / batch conforme modelo atual)
  - governance funding / financial actions que disparem dinheiro
  - payment execution (caminho que debita / confirma pagamento do comprador)
  - transferências internas (além de P2P já coberto)
  - reversal **request** (quem pede) — distinto de `reversal_executed` (já gera evento)
- Ações mapeadas em enum/canonical list (`financial_transfer`, `financial_payment`, `financial_payout`, `financial_reversal_request`, …).

**Compatível com 53:** não mover dinheiro no risk; apenas **negar ou exigir step-up** antes da operação.

---

## 3. Score — derivado ou job periódico

**Problema hoje:** `risk_score` persistido pode divergir do histórico se eventos forem corrigidos ou pesos mudarem.

**Exigido (uma das linhas):**

- **A)** Score **sempre derivado** na leitura (agregar `actor_events` + regras versionadas), perfil guarda só `risk_level` + `flags` + `last_evaluated_at`; ou  
- **B)** Manter score materializado + **job** (ex.: 15 min / hora) `evaluateActorRisk` para todos os actors com eventos recentes.

Documentar versão da regra (`risk_rules_version` em metadata ou tabela).

---

## 4. Limites financeiros dinâmicos (estrutura mínima)

**Problema hoje:** `medium` → `reducedLimits` é conceito sem tabela/caps aplicáveis.

**Exigido (53.1 ou 53.2 explícito):**

- Estrutura mínima: ex. `actor_financial_limits` ou campos em perfil: `max_transfer_cents_per_day`, `max_payment_cents_single`, por `risk_level`.
- Serviço `getEffectiveLimits(actorId)` usado pelos mesmos fluxos que chamam `assertActorFinancialPermission`.
- Nível `blocked` continua bloqueio total nas ações mapeadas.

---

## 5. Critérios de aceite (53.1)

- [ ] Zero linhas `actor` sem `actor_id` após backfill + constraint validada.
- [ ] Lista fechada de rotas/serviços financeiros com enforcement documentada no código (comentário + doc).
- [ ] Score alinhado a política (derivado ou job + versão de regra).
- [ ] Limites aplicáveis em pelo menos um fluxo real (ex.: cap de transferência P2P por nível).

---

## Referências

- `docs/03_execution_log/PROMPT_53_RISK_IDENTITY_ENGINE.md`
- `backend/migrations/0056_actor_risk_identity_engine.sql`
- `backend/src/modules/risk-identity/*`
