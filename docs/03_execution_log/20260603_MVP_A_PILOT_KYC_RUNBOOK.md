# RUNBOOK — Pré-aprovação de KYC para PILOTO FECHADO do MVP-A

**Tipo:** RUNBOOK operacional (docs-only). **NÃO** é DECISION, **NÃO** cria UI pública de KYC, **NÃO** implementa nada.
**Sessão:** 2026-06-03 · **Branch:** rescue-structural · **HEAD origem:** `0ae43ab4`.
**Escopo:** procedimento mínimo, legítimo e **auditável** para deixar usuários-piloto com `identities.kyc_status='approved'` — pré-condição para comprar ingresso no MVP-A (o gate de compliance bloqueia débito de KYC pendente: `KYC_PENDING_BLOCKS_FINANCIAL`).
**Validado empiricamente** em DB efêmera (ver §5). **Não substitui** a futura UI pública de KYC.

---

## 1. Por que existe

- A compra de ingresso (event_ticket → débito da carteira) é bloqueada pelo gate
  `requireFinancialRiskClearance` → `authority-decision.service` (camada KYC) quando o comprador
  está `identities.kyc_status='pending'` (estado em que toda identity nasce pós-`/auth/register`).
- O MVP-A interno foi provado com **comprador KYC-cleared**. Para o piloto fechado, os usuários
  precisam ser aprovados **pelo caminho real e auditado**, não por gambiarra.
- **`UPDATE identities SET kyc_status='approved'` cru é SOMENTE de teste** (usado no smoke
  `q3-e2e-v3-fundacional.ts`). **Proibido para o piloto** (pula request + trilha de auditoria).

## 2. Caminho legítimo (já existe — API admin, FRENTE C2)

Serviço: `backend/src/core/identity/identity-validation.service.ts`
Rotas: `backend/src/core/identity/identity.routes.ts` — todas com `preHandler: requireRole(['admin'])`.
Tabela de auditoria: `identity_validation_requests` (migration `20260530553000`).

| Passo | Endpoint | Auth | Efeito |
|------|----------|------|--------|
| (pré) | `POST /auth/register` | usuário | cria `identities` em `kyc_status='pending'`/`kyc_level='none'` |
| 1 | `POST /identity/submit-validation` | admin | cria `identity_validation_requests` (status `pending`). Body: `{ globalUserId, targetKycLevel?: 'basic'\|'complete' (default 'basic'), notes? }` → retorna `data.id` (requestId) |
| 2 | `GET /identity/admin/validation-queue?status=pending` | admin | lista a fila de pedidos |
| 3 | `PATCH /identity/admin/validation-requests/:requestId/review` | admin | decide. Body: `{ decision: 'approved', reason? }`. **Atômico** (BEGIN/COMMIT): `UPDATE identity_validation_requests` (status, `reviewed_at`, `reviewed_by_user_id`, `decision_reason`) **+** `UPDATE identities` (`kyc_status='approved'`, `kyc_level=targetKycLevel`) |

Observações de evidência (código):
- `submitIdentityValidation` exige a identity existir e estar `pending` (senão `IDENTITY_NOT_FOUND` /
  `IDENTITY_ALREADY_APPROVED` / `IDENTITY_REJECTED_NEEDS_DECISION`). UNIQUE parcial barra request
  duplicada (`IDENTITY_HAS_PENDING_VALIDATION`).
- `reviewIdentityValidation(requestId, 'approved', reason, reviewerUserId)` é atômico; falha em
  qualquer passo faz ROLLBACK (ou tudo grava, ou nada).
- `submitted_by_user_id` e `reviewed_by_user_id` são `users.id` do **operador** (carregam o tenant
  do operador via FK → auditoria). O **reviewer deve ser um operador admin real**, distinto do
  subject em produção.

## 3. Procedimento do PILOTO (passo a passo para o operador)

Pré-requisito: o operador precisa de uma conta com **role `admin`** no tenant (autoridade sistêmica;
`requireRole(['admin'])`). Concessão de role admin é decisão/ação própria — fora deste runbook.

Para CADA usuário-piloto:
1. Usuário cria conta normalmente (`POST /auth/register`) → identity nasce `pending`.
2. Operador descobre o `globalUserId` do usuário (ex.: via perfil/admin; ou `SELECT global_user_id
   FROM users WHERE id=<userId>` em ambiente controlado).
3. Operador chama `POST /identity/submit-validation` com `{ globalUserId, targetKycLevel: 'complete' }`
   → guarda o `requestId` retornado.
4. (opcional) `GET /identity/admin/validation-queue?status=pending` para conferir.
5. Operador chama `PATCH /identity/admin/validation-requests/<requestId>/review` com
   `{ decision: 'approved', reason: 'pré-aprovação piloto fechado MVP-A' }`.
6. Pronto: `identities.kyc_status='approved'` + trilha em `identity_validation_requests`
   (quem submeteu, quem revisou, motivo, timestamps). O comprador passa no gate por mérito.

## 4. Regras duras

- **Proibido** `UPDATE identities` cru para aprovar no piloto (só em teste).
- **Proibido** remover/burlar o gate KYC, criar bypass, ou aprovar sem request/review.
- A aprovação **deve** passar por `submitIdentityValidation` + `reviewIdentityValidation` (a trilha
  de auditoria é a garantia).
- Este runbook **não** cria UI pública de KYC; é procedimento operacional para piloto fechado. A UI
  pública de KYC (submit do próprio usuário + fila do operador) é **frente própria futura**.
- MVP-A **exige comprador KYC-cleared**: este runbook é pré-requisito da costura de UX do piloto.

## 5. Validação empírica (DB efêmera — 2026-06-03)

Executado em `unificard_smoke_mvp_a_kyc_setup_*` (descartável; `unificard_dev` intocada; DB dropada
ao fim). Probe temporário chamou os **serviços reais** (não UPDATE cru), após registro via HTTP:
```
BEFORE kyc = {"kyc_status":"pending","kyc_level":"none"}
SUBMITTED requestId=<uuid> status=pending          (submitIdentityValidation)
REVIEWED  status=approved reviewer=<users.id>       (reviewIdentityValidation, atômico)
AFTER  kyc = {"kyc_status":"approved","kyc_level":"complete"}
AUDIT  = {status:approved, has_reviewer:true, decision_reason:"pilot KYC approval", has_submitter:true}
PROBE_RESULT=PASS
```
→ O caminho auditado produz `kyc_status='approved'` **com trilha completa** (submitter, reviewer,
motivo, timestamps). O probe foi **removido** após a validação (não versionado).

## 6. Fora de escopo / não tocado

Bank/ledger/split, `mockUnifyCardCharge`, compliance/KYC gate, frontend, schema/migrations,
`unificard_dev`. Nenhuma UI pública de KYC criada. Nenhuma DECISION/DT nova.

## 7. Próximo passo

Com o procedimento de KYC do piloto definido e provado, o próximo movimento é o **executor de UX do
MVP-A** (frontend-only): ocultar cascas fora do MVP, corrigir `/extrato`, e copy honesta no
EventCheckout. O on-ramp externo (`mockUnifyCardCharge`) permanece bloqueador de produção pública e
**não** é necessário para o piloto (carteira pré-financiada, sem recarga na UI).
