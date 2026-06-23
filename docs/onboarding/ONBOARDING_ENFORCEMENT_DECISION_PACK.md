# Decision Pack — Onboarding Enforcement (F-ONBOARDING-ENFORCEMENT-DECISION)

**Data:** 2026-06-23 · **HEAD:** `cdd12ce2` · **Tipo:** DECISION PACK (READ-FIRST, **docs-only — nenhum enforcement implementado**) · **Branch:** `rescue-structural`
**Para:** Clayton decidir a política. Ordem soberana: IDENTIDADE → AUTORIDADE → TEMPO → ESTADO → FINANCEIRO.

## 1. Estado atual (de 1ª mão)
- **User onboarding (PF) = `UX_HINT_ONLY` — ZERO gate backend.** `requiresOnboarding` é hardcoded `true` no `register()` (auth.service.ts:440) e, no `login()`, **derivado** de `isOnboardingCompleted()` (lê `profiles.metadata.onboarding_completed`, profile.service.ts:619-622). Nenhum endpoint recusa por `!onboarding`. O frontend só **redireciona** `/perfil` vs `/home` (App.tsx:114-118) e mostra modal (não bloqueia inputs).
- **`onboarding_completed` é PROJEÇÃO** (auto-setado em `upsertProfile` quando fullName+birthdate+gender existem). **NÃO é autoridade** (coerente com P4: autoridade civil = `identity_civil_confirmation_events`).
- **SSOT real:** `global_users.{cpf, full_name, birthdate, gender}` (dados pessoais, coletados no register = HARD) + `identity_civil_confirmation_events` (trava civil, DECISION-0120).
- **Frontend NÃO é catraca de nenhuma ação de risco** (zero gate em rotas protegidas).
- **Ações de risco JÁ têm hard gate por regra dedicada** (não por onboarding): a Opção B já está, de fato, implícita no sistema.

## 2. Matriz de ações (gate ATUAL verificado → recomendação)
| Ação | Gate atual | Já gateada por | Recomendação | Bloqueia MTP? |
|---|---|---|---|---|
| login / ver feed / browse marketplace | NO_GATE | — | SHOULD_NOT_GATE (progressivo) | não |
| editar perfil | SOFT (banner civil) | P4 canEditPersonalData (evento) | KEEP | não |
| **criar empresa** (`POST /companies`) | **NO_GATE (só auth)** | — (civil-mínimo já coletado no register) | **DECISION** (ver §5) | não |
| publicar como page / criar service / criar offering draft | BACKEND_HARD_GATE | P3 services-offering-activation-gate (civil-min PF / KYB PJ) | KEEP | não |
| **ativar service_offering** (draft→active) | BACKEND_HARD_GATE | P3 (publicação + KYB + capacidade) | KEEP | não |
| criar availability | NO_GATE | canRepresentActor | SHOULD_NOT_GATE | não |
| criar booking (requester) | NO_GATE | P5 BookingSubject + canRepresentActor | SHOULD_NOT_GATE | não |
| confirmar booking (provider) | BACKEND_HARD_GATE | P5 / booking-decision (owner-only) | KEEP | não |
| criar purchase_order draft | BACKEND_HARD_GATE | owner authority | KEEP | não |
| **checkout / payment** | money (HOLD) | DECISION-0110 firewall (CheckoutService sink) | KEEP HOLD; gate de perfil é moot até dinheiro ligar | — |
| payout / settlement | BACKEND_HARD_GATE | request-only + approve + executor selado | KEEP | — |

**Conclusão:** toda ação de risco já falha-fechado por uma regra própria (P3/P5/KYB/firewall/payout). O onboarding de usuário é corretamente progressivo (UX). **Não há ação de risco dependendo só de onboarding/frontend.**

## 3. Modelo proposto de marcos (DERIVADOS, read-only — NÃO nova autoridade)
Formalizar como projeções lidas dos SSOTs existentes (sem novo writer/flag soberano):
```
civil_identity_present     ← global_users.{cpf, full_name, birthdate, gender} != null (garantido no register)
civil_identity_confirmed   ← identity_civil_confirmation_events (DECISION-0120)
profile_minimum_completed  ← onboarding_completed (projeção atual)  [progressivo, UX]
actor_ready                ← actor humano existe + não bloqueado (isActorEffectivelyBlocked)
company_ready              ← company.status / kyb_status (Company onboarding, já HARD)
seller_ready / provider_ready ← concept publication + KYB/civil-min (P3, já HARD)
```
Nomenclatura canônica (snake no banco / camelCase API; `is/has/can/requires`). Estes marcos **unificam a UX** e dão um vocabulário único — **sem** virar autoridade (cada um lê seu SSOT).

## 4. Separação hard/soft/progressivo
- **HARD GATE backend (já existe, manter):** ativar offering · publicar page · criar service/offering · confirmar booking · purchase_order · checkout(money) · payout · KYB PJ.
- **SOFT GATE / banner (UX):** trava civil de edição (P4) · modal primeiro acesso.
- **PROGRESSIVO / não-bloqueante:** perfil pessoal · telefone · endereço · interesses · agenda · profissional/saúde.

## 5. Opções de decisão
- **Opção A — onboarding leve/progressivo em tudo:** não recomendado isoladamente, mas é o estado das ações NÃO-risco (que já é assim). Não remove os hard gates de risco.
- **Opção B — progressivo p/ navegação/social + hard gate backend só p/ risco:** ✅ **já é o modelo de-facto** (P3/P5/KYB/firewall/payout). Decisão = **RATIFICAR** + formalizar os marcos derivados (§3) + decidir o fork de "criar empresa" (§abaixo).
- **Opção C — onboarding obrigatório amplo:** ❌ bloquearia uso day-1 (wallet/social), contraria a tese actor-first/capability-additive.

**Recomendação técnica: Opção B (ratificar + formalizar marcos).** Não há enforcement novo material urgente — o sistema já coloca catraca onde há risco e placa onde é progressivo.

**Fork de "criar empresa" (`POST /companies` = só auth):**
- (b1) **Manter auth-only (recomendado):** o register já coleta civil-mínimo (fullName+CPF+birthdate+gender); a "empresa" criada é só shell — toda ação material de PJ (KYB, publicar, ativar oferta, dinheiro) já é HARD-gated. Criar shell sem confirmação civil é inócuo.
- (b2) Adicionar gate explícito `civil_identity_present`/`actor_ready` em `POST /companies` — redundante hoje (dados já existem), mas torna a pré-condição explícita.

## 6. Riscos
- Bloquear cedo demais (Opção C) → mata adoção day-1.
- Deixar criação de empresa/oferta sem identidade mínima → **mitigado**: register coleta civil-mínimo; P3 gateia ativação/publicação.
- **Frontend-only gate** em ação de risco → **não ocorre hoje** (todas as de risco têm backend hard gate).
- Metadata como autoridade → **proibido** (P4 + guards). Os marcos §3 são derivados, não autoridade.
- Split-brain com P4 → evitado (marcos leem `identity_civil_confirmation_events`, não metadata).

## 7. Próxima fatia material (se Clayton aprovar Opção B)
`F-ONBOARDING-MARCOS-PROJECTION` (docs→thin code): expor os marcos §3 como projeções read-only num único resolver (consumido pela UX) + **guard anti-regressão**: nenhuma ação de risco pode cair para `NO_GATE` (lista de endpoints de risco × gate esperado) + nenhum marco pode virar writer/autoridade. **Sem** migration, **sem** dinheiro. Decisão do fork "criar empresa" entra como 1 linha de política.

---
**RECOMENDO DECISION: Opção B — RATIFICAR o modelo implícito (hard gate só p/ risco, já existente) + formalizar os marcos derivados; "criar empresa" = manter auth-only (b1).** Nenhum enforcement implementado neste pacote (docs-only). STOP aguardando sua escolha.
