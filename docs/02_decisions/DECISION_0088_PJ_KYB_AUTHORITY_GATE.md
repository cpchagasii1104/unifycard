# DECISION-0088 — F2-C KYB PJ: gate de autoridade financeira

**Status:** PROMULGADA POR CLAYTON — DECISÃO TÉCNICA (F2-C, derivada de M0/D1/D3/D2 e da cadeia KYB F2-A/F2-B). **DOCS-ONLY / SEM CÓDIGO / SEM MIGRATION / SEM SCHEMA** (2026-06-03). Fixa o desenho do gate; a implementação vem em **executor próprio**.
**Sessão:** 2026-06-03 — frente `F-PJ-KYB-AUTHORITY-GATE` (pós read-only F2-C).
**Decisor:** Clayton. **Commit âncora:** `b3eb499a` (pós F2-B implementada).
**Natureza:** fixa o **desenho do gate KYB PJ** em authority/compliance que bloqueia operação financeira sensível de page-actor/PJ quando `fiscal_identities.kyb_status != 'approved'`. **NÃO** implementa, **NÃO** altera `authority-decision.service`, **NÃO** toca Bank/KYC PF/`identities`.
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0083` (D3-princípio — vínculos/autoridade), `DECISION-0084` (D2-princípio), `DECISION-0085` (D2-técnica), `DECISION-0086` (F2-A KYB writer), `DECISION-0087` (F2-B documentos).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-KYB-AUTHORITY-GATE-MISSING` (criada), `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (atualizada).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra o **desenho** do gate KYB PJ. Implementação (camada `evaluateKybLayer` em `authority-decision.service` + testes efêmeros) é **fase seguinte** (executor próprio). Esta sessão **não liga a fechadura — assina a regra**.

## 2. Contexto / gap (read-only F2-C, HEAD `b3eb499a`)

- **FATO:** `authority-decision.service.evaluateFinancialSensitiveAction` = precedência **ATL → KYC → GUARDA**, chokepoint único via `modules/risk-identity/risk-financial-gate.ts` ("único ponto de entrada para enforcement financeiro"), chamado por `modules/bank/bank-transaction.service.ts` com `actorId = fromAccount.actorId` (o **debitante**).
- **FATO:** `evaluateKycLayer` aplica só a `actor_type ∈ {user, person}`; **page-actor faz skip** (`KYC_NOT_APPLICABLE_ACTOR_TYPE`). → **Hoje uma PJ move dinheiro sem nenhuma checagem de identidade/KYB.**
- **FATO:** `fiscal_identities.kyb_status` (fonte, F2-A) + documentos (F2-B) existem e são enforçados no review; mas **falta enforcement na operação financeira**. Esse é o buraco que a F2-C fecha.

## 3. Decisões promulgadas

### 3.1 Fonte do gate
O gate lê o caminho **page-actor → `actors.company_id` → `companies.fiscal_identity_id` → `fiscal_identities.kyb_status`**. **Fonte: `fiscal_identities.kyb_status`.** **Proibido** como fonte: `companies.company_status`, `companies.is_verified`, `company_validation_requests`, `metadata`, `identities.kyc_status`.

### 3.2 Escopo da F2-C
Cobre **apenas** as ações financeiras sensíveis do chokepoint atual: **`financial_transfer`** · **`financial_payment`** · **`financial_payout`** · **`financial_reversal_request`**.
**NÃO cobre nesta fase** (segunda onda, enforcement próprio nos módulos): criar produto · criar serviço · criar oferta · criar evento · ativar catálogo · booking/orçamento não-financeiro · onboarding operacional produto/serviço/ambos.

### 3.3 Actor alvo
KYB aplica **somente** a `actor_type='page'` (natureza PJ/company). KYC PF continua para `user`/`person`. **KYC e KYB são mutuamente exclusivos por `actor_type`** — sem colisão, sem duplicação PF/PJ.

### 3.4 Precedência
Ordem futura: **`ATL → KYC(PF) → KYB(PJ) → GUARDA/RISK`**. KYB entra **depois** de KYC e **antes** de GUARDA/RISK.

### 3.5 Regra de aprovação
Para page/PJ em ação financeira sensível: `kyb_status='approved'` → **passa**; qualquer outro status → **bloqueia**. Bloquear: `pending` · `rejected` · `suspended` · `closed` · fiscal ausente · company ausente · vínculo page→company quebrado · company sem `fiscal_identity_id`.

### 3.6 Fail-closed
Falha de resolução `page→company→fiscal` é **bloqueio**. **Não** fazer fail-open para dinheiro de PJ.

### 3.7 Strict para dinheiro
KYB é **strict** para operação financeira de PJ, **mesmo se o authority-mode geral estiver permissive**. Motivo: operação financeira de PJ sem KYB aprovado é exatamente o risco que a F2-C fecha.

### 3.8 Crédito/split recebido
Empresa pending **pode existir** e **pode receber** crédito/split, se o fluxo de crédito não exigir débito da própria PJ. Mas **não pode**: sacar · transferir · pagar · payout · iniciar ação financeira sensível **como debitante**. **Modelo: dinheiro pode entrar; dinheiro não sai até KYB approved.**

### 3.9 MVP-A / PF intacto
A implementação futura **deve provar** que o MVP-A/evento **não** é bloqueado. **Teste obrigatório:** checkout/event_ticket deve debitar **actor user/PF**, não page/PJ. **Se algum fluxo do MVP-A estiver usando page-actor como debitante, PARAR e reportar antes de ligar o gate.**

### 3.10 `financial_reversal_request`
`financial_reversal_request` **entra** no gate quando iniciado por **page-actor/PJ**. Exceções operacionais/plataforma, se existirem, devem ser **desenhadas em fatia própria**, não presumidas.

### 3.11 Reasons/códigos candidatos (implementação futura — não implementar agora)
`KYB_NOT_APPLICABLE_ACTOR_TYPE` · `KYB_APPROVED` · `KYB_PENDING_BLOCKS_FINANCIAL` · `KYB_REJECTED_BLOCKS_FINANCIAL` · `KYB_NOT_APPROVED_BLOCKS_FINANCIAL` · `KYB_FISCAL_IDENTITY_MISSING` · `KYB_COMPANY_LINK_MISSING`.

## 4. Testes futuros obrigatórios (executor F2-C, DB efêmera)

1. PF/user KYC approved continua passando. 2. PF/user KYC pending continua bloqueando como antes. 3. Page/PJ KYB pending bloqueia `financial_transfer`. 4. …bloqueia `financial_payment`. 5. …bloqueia `financial_payout`. 6. Page/PJ KYB rejected bloqueia. 7. Page/PJ KYB approved passa. 8. Page sem `company_id` bloqueia. 9. Company sem `fiscal_identity_id` bloqueia. 10. Gate lê `kyb_status`, não `company_status`/`is_verified`. 11. `company_status='VERIFIED'` + `kyb_status='pending'` **bloqueia**. 12. MVP-A/`event_ticket` **não** é afetado. 13. Bank ledger/split **não** alterados pelo gate. 14. Authority audit/trace registra a camada KYB. 15. Modo permissive **não** libera dinheiro de PJ sem KYB approved. 16. `financial_reversal_request` segue a regra.

## 5. O que fica fora (vinculante)

implementação/código · migration/schema · gating de produto/oferta/evento PJ (2ª onda) · reconciliação `company_status × kyb_status` · trilho humano/LGPD · storage provider · frontend · Bank (a F2-C apenas **lê** via a camada, nunca altera) · KYC PF/`identities`.

## 6. Ordem futura

```text
1. (esta DECISION) F2-C gate promulgado.
2. Implementação F2-C: camada evaluateKybLayer em authority-decision (ATL→KYC→KYB→GUARDA),
   só actor_type='page', lê kyb_status, fail-closed, strict para money + testes efêmeros
   (provando MVP-A/PF intacto e PJ gateada).
3. Segunda onda: gating de operações comerciais não-financeiras de PJ (produto/oferta/evento).
4. Reconciliação company_status × kyb_status (DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH).
```
**PJ comercial deixa de ser bloqueada "por decisão de projeto" e passa a ter enforcement real** quando a F2-C for implementada.

## 7. Superada por

(em aberto — decisão vigente)
