# DECISION-0150 — Onboarding Enforcement Policy (Opção B + b1) · F-ONBOARDING-ENFORCEMENT-DECISION / F-ONBOARDING-MARCOS-PROJECTION

**Status:** **PROMULGADA / POLÍTICA + PROJEÇÃO READ-ONLY THIN** (Clayton 2026-06-23). Declara a política vigente e expõe marcos PF read-only; **não cria enforcement novo** (o sistema já gateia risco por regra própria).
**Data:** 2026-06-23 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `1c3df5b4` · **Insumo:** `docs/onboarding/ONBOARDING_ENFORCEMENT_DECISION_PACK.md` (P10).
**Deriva de / coerente com:** DECISION-0113/0118 (authority server-side) · DECISION-0120 (trava civil = evento, P4) · P3 (services-offering-activation-gate) · P5 (booking subject-model) · DECISION-0110 (checkout firewall). **Vinculada a:** [[DT-INTERNAL-SSOT-ADMIN-TENANT-QUERY-HYGIENE]] (não), [[project_actor_unidade_operacional_soberana]] (actor-first/capability-additive).

---

## §A — A DECISÃO (Opção B + b1)
1. **Onboarding PF é PROGRESSIVO / UX-hint.** `requiresOnboarding` (hardcoded no register; derivado no login de `metadata.onboarding_completed`) é **sinal de navegação**, NÃO autoridade. **Nenhum endpoint pode recusar por `!onboarding`.** Login/feed/browse/wallet acessíveis day-1.
2. **Ações de risco têm HARD GATE PRÓPRIO no backend** (não dependem de onboarding nem de frontend): ativar/publicar/criar offering/service = **P3** (civil-min PF / KYB PJ) · confirmar booking = **P5** (owner-only) · purchase_order/payout = owner/selado · checkout/payment = **DECISION-0110** firewall · KYB PJ = company onboarding (gate próprio, separado do onboarding PF).
3. **Criar empresa/page shell = AUTH-ONLY (b1).** `POST /companies` exige só autenticação; o civil-mínimo já é coletado no register (fullName+CPF+birthdate+gender); o risco PJ entra depois (KYB/publicação/ativação/dinheiro). Shell é inócuo.
4. **Frontend NUNCA é catraca de ação de risco.** `metadata` NUNCA é autoridade civil (P4). **Nenhum marco read-only vira SSOT/autorização.**

## §B — Marcos read-only (projeção, NÃO autoridade)
Expostos em `GET /identity/me` sob `milestones` (derivação pura, ZERO query nova; lêem SSOTs já carregados):
```
civilIdentityPresent    ← global_users.{cpf, full_name, birthdate, gender} presentes
civilIdentityConfirmed  ← identity_civil_confirmation_events (DECISION-0120)
profileMinimumCompleted ← profiles.metadata.onboarding_completed (projeção progressiva)
```
**Diferidos (per-actor / per-company, fora da sessão) → follow-up `F-ONBOARDING-MARCOS-PROJECTION-PJ`:** `actorReady` (actor humano + !isActorEffectivelyBlocked) · `companyReady` (company.status/kyb_status) · `providerReady`/`sellerReady` (concept publication + KYB/civil-min, P3). Estes exigem contexto de actor/company, não cabem numa projeção de sessão.
**Invariante:** marcos são diagnóstico/UI-hint. NÃO autorizam dinheiro, NÃO substituem identity/authority/KYB/P3/P5.

## §C — Enforcement (guard anti-regressão)
`audit-onboarding-not-backend-gate.mjs` (na cadeia regression-guards): **MORDE se o sinal de onboarding PF (`requiresOnboarding`/`isOnboardingCompleted`) for usado como bloqueio backend (throw/4xx)** — i.e., virar catraca. Allowlist: auth.service (computa o hint) + profile.service (casa do getter puro). Company onboarding PJ usa tokens próprios (gate legítimo de KYB) e não é alvo.

## §D — Fora de escopo / HOLD
Não autoriza: enforcement amplo · bloquear login/feed/browse · gate civil em criar-empresa · tocar P3/P5/checkout/payout/PORTA-1/RLS-live/role/env/bank_* · migration · novo SSOT.

**Materialização:** thin (1 projeção read-only em /identity/me + 1 guard). Frontend pode adotar `milestones` como hint (follow-up de UI, não bloqueante). **Δ dinheiro = 0.**
