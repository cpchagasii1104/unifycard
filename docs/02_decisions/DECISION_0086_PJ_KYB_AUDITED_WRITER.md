# DECISION-0086 — F2-A KYB PJ: writer auditado da identidade fiscal

**Status:** PROMULGADA POR CLAYTON — DECISÃO TÉCNICA (F2-A, derivada da D2-técnica/DECISION-0085 e da F1). **DOCS-ONLY / SEM MIGRATION / SEM CÓDIGO / SEM SCHEMA** (2026-06-03). Autoriza a próxima fase (implementação F2-A: migration da request + serviço submit/review + testes), mas **não a executa**.
**Sessão:** 2026-06-03 — frente `F-PJ-KYB-AUDITED-WRITER` (pós read-only F2 KYB).
**Decisor:** Clayton. **Commit âncora (fundação F1):** `8929379e`.
**Natureza:** fixa o **desenho do writer KYB auditado** que transiciona `fiscal_identities.kyb_status`. **NÃO** cria tabela, **NÃO** roda migration, **NÃO** cria rota, **NÃO** cria gate, **NÃO** cria documentos, **NÃO** altera schema/runtime.
**Documento canônico:** este arquivo.
**Deriva de:** `DECISION-0081` (M0), `DECISION-0082` (D1), `DECISION-0083` (D3-princípio), `DECISION-0084` (D2-princípio), `DECISION-0085` (D2-técnica); F1 (`8929379e`).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-KYC-DOCUMENTS-SUBSTRATE-MISSING` (atualizada), `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (criada).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra a **decisão técnica** do writer KYB (F2-A). Implementação (migration da request + serviço + testes) é **fase seguinte** (autorizada, não executada aqui). Documentos = **F2-B**; gate de authority = **F2-C** — fora desta DECISION.

## 2. Contexto / gap

- F1 (DECISION-0085 / commit `8929379e`): `fiscal_identities.kyb_status` **nasce 'pending'** com campos KYB prontos (`reviewed_by_actor_id`, `reviewed_at`, `decision_reason`) + CHECK auditoria-no-approved. Mas **nada transiciona** o status e **nada o lê como gate**.
- Espelho-ouro do writer: `identity-validation.service` (KYC PF) — request global + review atômico + role-gated. **Padrão a espelhar**, sem misturar PF/PJ.
- `company_validation_requests`/`reviewCompanyValidation`: workflow **vivo, porém company-cêntrico** (tenant + `company_id` + audit por `user_id`) que valida `companies.company_status` (PROJEÇÃO), **não** a fonte fiscal.
- `authority-decision` ignora page-actor no KYC (`KYC_NOT_APPLICABLE_ACTOR_TYPE`) → o gate KYB é **F2-C**.

A F2-A é o **cartório mínimo auditado**: quem submete, quem revisa, e a transição de `kyb_status`. Nada além disso.

## 3. Decisões promulgadas

### 3.1 Fonte da verdade KYB
A fonte da verificação da PJ é **`fiscal_identities.kyb_status`**. **NÃO** é: `companies.company_status`, `companies.is_verified`, `company_validation_requests`, `identities.kyc_status`, metadata/blob, actor/page-actor.

### 3.2 Writer KYB
F2-A adota um **novo writer auditado** para KYB PJ, espelhando o padrão de `identity-validation`, **sem misturar PF/PJ**. Keyed por **`fiscal_identity_id`**. **NÃO** por `global_user_id`, `company_id` (como fonte), CPF, `actor_id` (como chave), `tenant_id`.

### 3.3 Tabela de request
Nome decidido: **`fiscal_identity_kyb_requests`**. Escopo: workflow **global** da identidade fiscal PJ; keyed por `fiscal_identity_id`; **não** substitui `fiscal_identities`; **não** é SSOT fiscal; **não** é documento; **não** é `company_validation_requests`.

### 3.4 Fluxo mínimo F2-A
F2-A cobre **apenas**: submit · queue · review · approve · reject. Transições: **`pending → approved`** e **`pending → rejected`**. **Fora da F2-A:** `suspended`, `closed`, resubmit pós-rejected, `under_review`, `needs_more_info`.

### 3.5 `under_review` — fora
`under_review` **NÃO** entra na F2-A. A F2-A é o cartório mínimo auditado; claim/lock de operador e estados intermediários ficam para fase posterior. Request começa `pending` e termina `approved`/`rejected`.

### 3.6 Auditoria
Auditoria usa **actor humano** quando representa decisão operacional. Direção: **`submitted_by_actor_id`** e **`reviewed_by_actor_id`**. `user_id`, se algum endpoint exigir por compatibilidade, é **auxiliar, não autoridade**. Toda aprovação/rejeição registra: **quem decidiu · quando · motivo · request original · `fiscal_identity_id`**.

### 3.7 Atomicidade
Review **atômico** — na MESMA transação: UPDATE `fiscal_identity_kyb_requests` + UPDATE `fiscal_identities.kyb_status` + auditoria em `fiscal_identities` quando approved/rejected. Falha no meio → **rollback total**. **Sem DML cru; sem update direto fora do writer.**

### 3.8 Relação com `company_validation_requests`
F2-A **NÃO** reaproveita `company_validation_requests` como fonte KYB. Ela pode continuar como **workflow legado/projeção**, mas **não é fonte**. **Risco reconhecido:** `reviewCompanyValidation` hoje escreve `companies.company_status='VERIFIED'`/`is_verified=true` — possível **segunda verdade** se `kyb_status` continuar `pending`. **Decisão:** F2-A **declara** `fiscal_identities.kyb_status` como fonte; F2-A **NÃO reconcilia** `reviewCompanyValidation` no código; a reconciliação `company_status`/`is_verified` × `kyb_status` vira **DT/resíduo explícito** (`DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH`).

### 3.9 Documentos PJ — fora
Documentos PJ ficam **fora da F2-A**. **F2-B** futura cria/decide o SSOT de documentos PJ, ancorado em `fiscal_identity_id`. **Proibido:** salvar contrato social/cartão CNPJ/procuração em metadata/blob como SSOT; tratar `company_validation_requests.metadata` como depósito documental definitivo.

### 3.10 Gate de authority — fora
Gate fica **fora da F2-A**. **F2-C** futura adiciona camada KYB ao authority/compliance: aplicável a **page-actor/PJ**; lê `companies.fiscal_identity_id → fiscal_identities.kyb_status`; bloqueia operação comercial/financeira de PJ se status `!= approved`.

### 3.11 Operação PJ
Enquanto a **F2-C não existir**: `kyb_status='approved'` é fonte **declarada**, mas **ainda não é enforcement global**; **operação comercial PJ continua bloqueada por decisão de projeto** até o gate existir; **não declarar PJ comercial pronta**.

### 3.12 UnifyBank / conta PJ
F2-A **não cria, não altera, não opera** conta bancária. Diretriz: conta/extrato da empresa acompanha a **empresa/fiscal identity**, não o CPF; uso financeiro depende de **KYB approved no gate futuro**; criação da conta é decisão separada.

## 4. Schema alvo conceitual — NÃO EXECUTAR (desenho, não SQL)

```text
TABELA FUTURA: fiscal_identity_kyb_requests  (GLOBAL — sem tenant_id)

Campos candidatos:
  kyb_request_id        UUID PRIMARY KEY DEFAULT gen_random_uuid()
  fiscal_identity_id    UUID NOT NULL
  status                TEXT NOT NULL DEFAULT 'pending'
  submitted_by_actor_id UUID NOT NULL
  reviewed_by_actor_id  UUID NULL
  reviewed_at           TIMESTAMPTZ NULL
  decision              TEXT NULL
  decision_reason       TEXT NULL
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints candidatas:
  FK fiscal_identity_id   -> fiscal_identities(fiscal_identity_id)
  FK submitted_by_actor_id -> actors(id)
  FK reviewed_by_actor_id  -> actors(id)
  CHECK status IN ('pending','approved','rejected')
  PARTIAL UNIQUE (fiscal_identity_id) WHERE status='pending'   -- 1 pending por identidade fiscal
  CHECK: status IN ('approved','rejected') => reviewed_by_actor_id IS NOT NULL
                                              AND reviewed_at IS NOT NULL
                                              AND decision_reason IS NOT NULL

NÃO incluir: documentos, metadata como SSOT, global_user_id, company_id como chave do fluxo,
tenant_id (salvo se o desenho futuro provar necessidade).
```
**Isto é desenho alvo, NÃO SQL executável.** Forma final (nomes/constraints exatos) é da implementação F2-A.

## 5. Testes futuros (implementação F2-A, estender harness efêmero)

submit cria 1 pending · submit duplicado bloqueado (partial-unique) · review approved → `kyb_status='approved'` + auditoria · review rejected → `kyb_status='rejected'` · review de não-pending → erro · atomicidade (falha no meio → rollback, request e `kyb_status` inalterados) · approved/rejected exige reviewer+reviewed_at+reason (CHECK) · zero toque em `identities` PF · zero Bank · KYB de actor errado/fiscal inexistente → fail-closed.

## 6. Fora da F2-A (vinculante)

```text
NÃO documentos PJ (F2-B). NÃO gate authority evaluateKybLayer (F2-C). NÃO suspended/closed.
NÃO resubmit pós-rejected. NÃO under_review/needs_more_info. NÃO reconciliar reviewCompanyValidation.
NÃO Bank/ledger/split. NÃO frontend. NÃO KYC PF / identities. NÃO conta bancária. NÃO migration/código aqui.
```

## 7. Ordem futura

```text
1. (esta DECISION) F2-A KYB writer promulgada.
2. Implementação F2-A: migration de fiscal_identity_kyb_requests + serviço submit/queue/review
   (atômico, role-gated) + testes (estender harness efêmero F-ATOMIC).
3. F2-B: SSOT de documentos PJ (fiscal_identity_documents, ancorado em fiscal_identity_id, append-only).
4. F2-C: gate evaluateKybLayer no authority-decision (page-actor lê kyb_status; bloqueia se != approved).
5. Reconciliação company_status/is_verified × kyb_status (DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH).
```
**PJ comercial segue bloqueada** (decisão de projeto) até a F2-C. Implementação **não** autorizada nesta sessão.

## 8. Superada por

(em aberto — decisão vigente)
