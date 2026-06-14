# DECISION-0128 — Core de Aprovação Financeira: grants comuns não executam dinheiro; cartão físico usa o Core

**Status:** **PROMULGADA / NORMATIVA.** Runtime **NÃO** implementado — a implementação depende de frente executora própria (ver §16). Esta DECISION fecha a **decisão de produto/autoridade** (D1–D10 do READ-FIRST), **não** a implementação.

**Data:** 2026-06-14 · **Branch:** `rescue-structural` · **Frente:** F-CORE-FINANCIAL-APPROVAL-DECISION-CARTORIO · **Tipo:** DOCS-ONLY / DECISION-ONLY

**Precedência (normas internas soberanas — nenhuma fonte externa é norma):**
`AUTHORITY_LAW` (Art.2/3/14: responsabilidade no CPF; precedência da trava mais restritiva) · `AUTHORITY_PRECEDENCE` (vence a mais restritiva) · `08_AUTORIDADE_CANONICA` (autoridade delegada e rastreável ao CPF; RBAC só aplica, nunca cria) · `SSOT_EXCLUSIVE_BANK_RULE` (UnifyBank é a ÚNICA SSOT financeira; o sistema GOVERNA, não paga) · `CORE_PERMISSOES_FINANCEIRAS_CANONICO` (criar≠aprovar≠executar) · `CORE_APROVACAO_FINANCEIRA_CANONICO` (aprovação ANTES da execução; 4-olhos acima de limite) · `CORE_ESTORNOS_FINANCEIROS_CANONICO` (taxonomia + autoria) · **DECISION-0110/0111** (escrow/KYB/firewall) · **DECISION-0113** (actorId/tenant client-declared = HINT) · **DECISION-0123** (dispute/reversal HOLD) · **DECISION-0125** (`company_users.can_*` company-scoped) · **DECISION-0126** (`tenant_operator_grants.can_*` tenant-scoped) · **DECISION-0127** (trust tenant-level; baseline 0113 → 2).

> **Nota de método:** referências de mercado (maker-checker, PCI-DSS) aparecem **apenas como analogia/compatibilidade**, nunca como fonte soberana. A norma do Unificard é interna.

---

## 1. Contexto

O READ-FIRST `F-CORE-FINANCIAL-APPROVAL-READ-FIRST` (CLOSED) confirmou materialmente:
- `bank-http` e `payout` são os **2 resíduos restantes** do baseline DECISION-0113 — ambos **move-money** (não falha de binding, e sim ausência do Core de Aprovação a que se vincular);
- `company_users.can_*` **não** autoriza execução financeira (DECISION-0125 §Hard stops);
- `tenant_operator_grants.can_*` **não** autoriza execução financeira (DECISION-0126/0127 §Hard stops);
- `can_execute_*` **não** deve nascer como grant comum;
- `availableBalanceCents` é **leitura/projeção**, nunca autorização (axioma em 4 arquivos do substrato);
- recovery obligations **precisam bloquear** payout (drain antes de pagar, revalidação na transação);
- dispute/reversal **continuam contidos** (DECISION-0123) até o Core.

Esta DECISION cartorializa a decisão de Clayton sobre como o dinheiro é governado a partir daqui.

## 2. Escopo

Cobre: `bank-http`; `payout`; transferência; payout de `actor_wallet`; recovery obligations; dispute/reversal; **cartão físico Unificard futuro**; leitura financeira; grants comuns (company/tenant); domínios não-financeiros (PDV/estoque/produtos/serviços/CRM/agenda/membros) e social/visibilidade — **na fronteira com o financeiro**.

## 3. Decisão principal

- **`company_users.can_*`** — pode autorizar operação **company-scoped não-financeira**. **NÃO** autoriza execução financeira.
- **`tenant_operator_grants.can_*`** — pode autorizar operação **tenant-scoped não-financeira / compliance / reporting**. **NÃO** autoriza execução financeira.
- **Core de Aprovação Financeira** — **obrigatório** para **qualquer** movimento de dinheiro. Separa **request → approval → execution**; aplica **ATL/KYC/KYB/Guarda/risco/recovery/limites**; chama o **Bank** para registrar o ledger (SSOT); **emite evento/auditoria depois** do financeiro.

## 4. Hierarquia de autoridade (vence a trava mais restritiva — não negociável)

```
1. ATL (Authority Trust Level)
2. KYC / KYB
3. GUARDA (responsável econômico único, teto, prazo)
4. IA / Sistemas (nunca soberana)
5. PRODUTO / operação (camada mais fraca)
```
Grants de empresa/tenant são **subordinados** (fontes de *permissão* dentro de "Produto"), nunca camadas de precedência. **Produto não supera trava financeira.** Responsabilidade econômica termina sempre no **CPF raiz** (1 responsável único por ação).

## 5. Domínios NÃO financeiros (grant por empresa/tenant é legítimo)

Estoque: `can_view_inventory` · `can_manage_inventory` · `can_adjust_inventory`.
PDV: `can_use_pdv` · `can_manage_pdv`.
Produtos/serviços: `can_manage_products` · `can_manage_services`.
CRM / agenda / membros: podem seguir grants por empresa/tenant (`company_users` company-scoped / `tenant_operator_grants` tenant-scoped).

> **Regra de fronteira (vinculante):** se a operação gerar **cobrança, split, crédito, comissão, pagamento, payout** ou **qualquer efeito financeiro**, ela **sai do grant comum** e **entra no Core de Aprovação Financeira**. O grant comum nunca move dinheiro por si.

## 6. Social / visibilidade (modelo próprio — não financeiro)

Camadas: `public` · `tenant/community` · `friends` · `group/company` · `private` · `moderation/compliance`. O **dono controla a visibilidade**; a plataforma pode **moderar/compliance com trilha auditável**. **Não existe "admin vê tudo" solto.** O modelo social NÃO usa o modelo financeiro (e vice-versa).

## 7. Leitura financeira (ver saldo ≠ mover dinheiro)

- Saldo **próprio:** dono / representante autorizado (binding server-side, DECISION-0113).
- Saldo **da empresa:** financeiro / owner autorizado (company-scoped).
- **Tenant-wide:** operador institucional financeiro / compliance (`tenant_operator_grants`, DECISION-0126).
- **Cross-tenant:** decisão futura platform-wide (DECISION_REQUIRED).

Leitura **nunca** substitui o Bank. **Sem SQL direto** em `bank_*` fora do módulo Bank (SSOT_EXCLUSIVE_BANK_RULE).

## 8. Transferência

Fluxo: usuário/empresa **solicita** → Core **valida** → trilho interno/system **executa** → Bank **registra** → evento **nasce depois**.
**Proibido:** `can_execute_transfer` como grant comum; transfer direto por `tenant_operator_grants`; transfer direto por `company_users`.

## 9. Payout

Fluxo: representante financeiro autorizado **solicita** → Core **valida saldo real no Bank** → Core **verifica recovery obligations** → Core aplica **ATL/KYC/KYB/Guarda/risco/limites** → Core **trava concorrência** → trilho interno **executa com idempotência**.
`availableBalanceCents` **não autoriza saque** (é projeção de leitura). Segue **request → approval → execution** (CORE_APROVACAO §445-458).

## 10. Recovery obligations

Obrigação **ativa bloqueia payout**. A revalidação precisa ocorrer **dentro da transação** futura de execução (drain antes de computar o valor; pagar `min(solicitado, disponível_pós_drain)`). Dinheiro comprometido por recovery **não pode sair** (DECISION-0053).

## 11. Dispute / reversal

**Continua contido** (DECISION-0123). **Não reabrir** rota HTTP humana. Reabertura futura exige: **Core de Aprovação** + **taxonomia** (CORE_ESTORNOS) + **aprovação** + **E2Es específicos** + mover reversão sistêmica para **job/evento interno** (nunca `authoritySource='system'` por HTTP humano).

## 12. `can_execute_financial_*`

**Não criar como grant comum.** Se existir, será **primitive interna do Core de Aprovação Financeira**. **Não** mora em `company_users`. **Não** mora em `tenant_operator_grants` comum. **Não** é role textual. **Não** é bypass. A fonte material de execução vive no eixo financeiro próprio (ex.: ACL por conta `bank_account_operators` + `approval_requests`), governada pelo Core.

## 13. Cartão físico Unificard (futuro)

O cartão **não fala direto com Bank/ledger** e **não consulta `availableBalanceCents`** como autorização. O cartão **chama o Core de Aprovação Financeira**.

Fluxo: **autorização de compra** → Core valida **cartão ativo, usuário, empresa, limites, KYC/KYB, ATL, Guarda, recovery, risco** → se aprovado, cria **hold/autorização** → **liquidação posterior** registra no Bank → **evento/auditoria nasce depois**.

Dados sensíveis: **não guardar PAN/CVV/trilha sensível** no Unificard. Guardar no máximo **token/referência do provedor, status, limites e trilha de autorização**, salvo decisão futura específica de compliance. *(PCI-DSS citado aqui apenas como analogia de compatibilidade de mercado, não como norma soberana.)*

## 14. Proibições explícitas

Não criar saldo paralelo · não criar ledger paralelo · não usar snapshot como autorização · não usar `availableBalanceCents` como autorização · não usar `company_users` para execução financeira · não usar `tenant_operator_grants` para execução financeira · não usar role genérica · não usar `actorId`/`body.actor`/`actionContext` como autoridade (DECISION-0113) · não mover dinheiro antes do Core · não reabrir dispute/reversal · não plugar cartão direto no ledger · não plugar `actor_wallet` em payout legado sem frente própria.

## 15. Sequência futura recomendada (mapping — nenhuma autorizada aqui)

1. **F-CORE-FINANCIAL-APPROVAL-MODEL** — modelar o runtime do Core (se possível ainda sem mover dinheiro).
2. **F-BANK-HTTP-AUTHORITY-BINDING** — só depois do Core.
3. **F-ACTOR-WALLET-PAYOUT-WIRING** — lock, recovery, ledger, idempotência.
4. **F-PAYOUT-EXECUTION-SEAL** — só após Core.
5. **F-DISPUTE-REVERSAL-REOPEN** — só após Core.
6. **F-CARD-AUTHORIZATION-CORE** — futuro, sem ledger direto.

## 16. Fora de escopo desta DECISION

Não implementar runtime · não criar migrations · não mexer em Bank/payout · não corrigir R20 (`bank_splits` imutabilidade / `target_actor_id` nullable) · não criar cartão · não criar provider PCI/compliance.

## 17. Efeitos sobre DTs / baseline

- `bank-http` e `payout` **permanecem no baseline DECISION-0113 = 2** até o Core de Aprovação existir (HARD STOP move-money).
- Esta DECISION **fecha a decisão de produto D1–D10** do READ-FIRST do Core, mas **NÃO fecha a implementação** (que segue DECISION_REQUIRED, dependente de frente executora).
- DTs derivadas seguem como dívida explícita: `DT-RECOVERY-PAYOUT-GATE` (PARCIAL), execução financeira / platform-wide / cross-tenant operator (DECISION_REQUIRED), deprecação de `businessAuthorizationService`/RBAC v1 órfão.

## 18. Estado

DECISION-0128 **PROMULGADA / NORMATIVA**, runtime não implementado. Baseline DECISION-0113 inalterado (**2**: `bank-http`, `payout`). Próximo passo institucional = **F-CORE-FINANCIAL-APPROVAL-MODEL** (sob GO próprio). Sem código, sem migration, sem alteração de Bank/payout/ledger/wallet nesta frente.
