# RAIO-X SISTÊMICO — 2026-06-21 (12 eixos · READ-ONLY · pós cadeia-de-oferta pré-dinheiro)

> Workflow `raio-x-sistemico-12-eixos` (12 Explore agents, READ-ONLY, 1ª mão). HEAD `03a3f0f1`. Síntese IA-DIRETORA.
> Objetivo: antes de abrir Caminho A / dinheiro, mapear se há blocker escondido e confirmar a sequência.

## Matriz por eixo (compacta)
| eixo | estado | blocker principal | próxima frente | modo |
|---|---|---|---|---|
| **IA-01 Cadastro/Auth/Onboarding** | ✅ fecha (register atômico global_user→identity→actor; login; tenant server-side; token revocation) | frontend register **não envia birthdate/gender** (DTO mismatch); onboarding-completion ghost (quem nunca toca /perfil) | F-REGISTER-DTO + onboarding-completion | **FAST-PATH** |
| **IA-02 Perfil/SSOT/Abas** | parcial | **gender dual-read** (global_users.gender vs profiles.metadata) SSOT ambíguo; education routes **ghost** | F-PROFILE-SSOT (gender canônico + cleanup blob) | MODO B |
| **IA-03 PJ/Empresa** | parcial | **KYB reviewer workflow SEM writer** (pending→approved não existe no backend) → bloqueia operação PJ | DECISION KYB-approval + frontend criar-empresa | **DECISION** |
| **IA-04 Oferta/Jornada** | ✅ fecha + provado (B1) | só B2 frontend + Caminho A + resíduos | B2 + resíduos | fast-path |
| **IA-05 Ativação Pública (Caminho A)** | ⚠️ inseguro | activation só checa `canRepresentActor(provider)`, **sem KYB/operacional da empresa**; sem gate transacional publication↔offering; sem imutabilidade pós-active | F-ACTIVATION-SECURE (gate KYB+state-machine) | MODO B |
| **IA-06 Tempo/Booking** | ✅ fecha (F-OFFER-5/6) | **fork legado rides/availability** (48 user-owned legado, 0 na nova); G7 concorrência sem teste real; detect_availability_conflicts stub | F-TEMPO-CONSOLIDAÇÃO-LEGADO | MODO B |
| **IA-07 Marketplace Geral** | parcial | category.metadata não propagado (domain filter bloqueado); search frontend stale; discovery↔booking chicken-egg | DECISION marketplace V2 | DECISION |
| **IA-08 Produtos** | parcial | DECISION-0108 guard indeciso; **RFC-003 price NUMERIC vs BIGINT** dual; booking-decision/payment orphan | F-PRODUTOS-RFC003 + 0108 | MODO B |
| **IA-09 Locações/Aluguel** | ❌ enum-only | bloqueado por DECISION-0110/0109 (firewall dinheiro); **sem modelo de rental** (bem/caução/período) | DECISION rental design | DECISION |
| **IA-10 Frontend/API Contract** | gap | `offerings.ts` DTO **ausente**; sem ServiceOfferingSelector; payment_request sem FK→offering | B2 (contratos+telas da jornada) | MODO B |
| **IA-11 Dinheiro/Ledger/Split/Payout** | HOLD | fee-bps-migration pendente; **payout HOLD-GOLIVE (decision pack Clayton)**; **RLS migration 395 PENDING (não aplicada em dev)**; recovery não-materializada | (não abrir) | **HOLD** |
| **IA-12 Banco/Schema/Gates/Cartório** | são + frágil | **DECISION-0131 pendente** (bloqueia closure de autoridade); Z2 sweep 25+ POST; ghosts contidos | DECISION-0131 ratificação | DECISION |

## Leitura cruzada (a sequência se confirma? há blocker escondido?)
**A direção `A → B2 → dinheiro` se CONFIRMA** — não há blocker catastrófico que a derrube. Mas o raio-X revela 3 nuances materiais:

1. **Caminho A é MAIOR do que "adicionar um gate" (dependência escondida A↔IA-03):** a ativação segura (IA-05) precisa checar KYB da empresa — **mas o workflow de APROVAÇÃO de KYB (pending→approved) NÃO tem writer no backend** (IA-03). Então Caminho A = **(A0) KYB-approval-writer + (A1) activation-gate-checa-KYB**. Sem A0, o gate de A1 não tem o que checar. É DECISION + MODO B.
2. **Loose end de segurança independente:** **RLS migration 395 está committada mas NÃO aplicada em dev** (IA-11) — role `unificard_app` NOBYPASSRLS criada efêmera. Vale fechar isso (aplicar/verificar) independentemente da próxima frente — é higiene de segurança do substrato.
3. **Dinheiro tem vários pré-reqs (confirma que NÃO é o próximo):** fee-bps-migration + payout HOLD-GOLIVE (seu decision pack) + RLS + recovery. Money por último, como você já intuiu.

**Frentes de baixo custo/alto valor imediato (FAST-PATH):** IA-01 register-DTO (frontend manda birthdate/gender) + onboarding-completion — pequenas, destravam o cadastro real.

**O que torna a jornada TANGÍVEL sem tocar trust/dinheiro:** B2 (frontend da jornada provada em B1) — MODO B, não depende de Caminho A (funciona com ofertas ativadas internamente). Mas B2 público sem A = exposição de ativação self-serve.

## Recomendação de sequência (decisão de Clayton)
```
Higiene paralela (qualquer ordem, baratas):  IA-01 register-DTO (FAST-PATH) · aplicar/verificar RLS 395 (IA-11 higiene)
Para PÚBLICO seguro:  Caminho A = A0 KYB-approval-writer (DECISION) → A1 activation-gate (MODO B)  [+ IA-06 consolidação legado antes de público]
Para TANGÍVEL/demo:   B2 frontend da jornada (MODO B) — usa ofertas ativadas internamente; público só depois de A
Por último:           Dinheiro (IA-11) — após A + decision pack payout + fee-bps + RLS
Frentes de design (quando priorizar o mundo):  IA-07 marketplace V2 · IA-08 produtos RFC-003 · IA-09 rental · IA-12/DECISION-0131
```
**Próxima execução só após Clayton escolher a frente.** Nada aberto sem comando.
