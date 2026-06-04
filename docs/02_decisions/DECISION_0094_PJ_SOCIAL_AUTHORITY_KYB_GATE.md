# DECISION-0094 — Gate KYB na authority social de PJ

**Status:** PROMULGADA POR CLAYTON — DECISÃO ESTRATÉGICA (a authority social real de page-actor/PJ para `publish_feed` e `cast_vote` deve ser **KYB-aware**, ancorada em `fiscal_identities.kyb_status`). **DOCS-ONLY / SEM CÓDIGO / SEM MIGRATION / SEM SCHEMA / SEM FRONTEND** (2026-06-04). Fixa a regra e a ordem; **não** implementa — executor posterior fará o gate KYB escopado.
**Sessão:** 2026-06-04 — frente `F-PJ-SOCIAL-AUTHORITY-KYB-GATE` (pós auditoria read-only Fase 3.1-B).
**Decisor:** Clayton. **Commit âncora:** `1c01bab9` (pós Fase 3.1 docs / DECISION-0093).
**Natureza:** a auditoria Fase 3.1-B provou que o **enforcement real** de post/voto social NÃO é KYB-aware — `authorityService.canPerformAction` delega em `authorizationService.canActAs`, que decide por **ownership/delegation/system** e **nunca** consulta `fiscal_identities.kyb_status`. A correção da Fase 3.0 atuou só no **input/display** (`reputation.getPermissions`). Logo há **gap display × enforcement**: a UI esconde post/voto de PJ pending, mas a API permite (se houver ownership/delegação). Esta DECISION crava que `publish_feed`/`cast_vote` de PJ exigem `kyb_status='approved'` no **enforcement**, fechando o gap na direção segura (não broadcastar empresa não-auditada).
**Documento canônico:** este arquivo.
**Deriva de:** auditoria Fase 3.1-B; `DECISION-0093` (compat), `DECISION-0092` (Fase 3), `DECISION-0089` (fonte única), `DECISION-0088` (gate KYB financeiro F2-C — paralelo).
**Subordinada a:** `CONSTITUICAO_UNIFICARD.md`, `AUTHORITY_LAW.md`, `IDENTITY_SSOT_PRECEDENCE.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`.
**Vinculada a:** `DT-PJ-AUTHORITY-SOCIAL-KYB-GATE-UNVERIFIED` (atualizada — veredito + decisão), `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (atualizada).

---

## 1. Status

PROMULGADA POR CLAYTON. DOCS-ONLY. Registra o **veredito** (authority social = delegation-only, NÃO KYB-aware), a **regra** (`publish_feed`/`cast_vote` de PJ exigem `kyb_status='approved'`) e a **ordem** (executor gate → higiene → só então a Fase 3.1-A compat textual). Implementação é fatia executora própria.

## 2. Fatos materiais a registrar (auditoria Fase 3.1-B, HEAD `1c01bab9`)

1. `reputation.getPermissions` é **input/display, não enforcement final** (declarado `:252-255`); foi corrigido para `kyb_status` na Fase 3.0, mas seu `canPost` é consumido só em `actor.repository:657` → display.
2. O **enforcement real** de `publish_feed` (`social-2.0.service`) e `cast_vote` (`social-votes.service`) chama **`authorityService.canPerformAction(actorId, permissionKey, undefined, {tenantId, userId})`**.
3. `authorityService.canPerformAction` (`modules/authority/authority.service.ts:30`) aplica `isActorEffectivelyBlocked` (quarentena/risco) e **delega em `authorizationService.canActAs`**.
4. `authorizationService.canActAs` decide por **`AuthoritySource = 'ownership' | 'delegation' | 'system'`** (via `actorDelegationRepository`).
5. `canActAs` **NÃO consulta `fiscal_identities.kyb_status`** (grep `kyb` em `core/authorization` = vazio; único arquivo com `kyb` no caminho social/authority/risk é `reputation.service`).
6. O caminho atual **não usa `company_status` nem `is_verified`** como fonte de authority (são passthrough/mensagem/display).
7. **Resultado atual:** o display pode esconder post/voto de PJ pending; a API/enforcement ainda pode **permitir** post/voto se houver ownership/delegação.
8. Isso é **gap display × enforcement** (pré-existente — a regra "PJ verificada para postar" sempre viveu só no display).
9. A origem correta da verificação PJ continua sendo **`fiscal_identities.kyb_status`**.
10. F2-C já resolveu **dinheiro** (gate KYB financeiro); este documento resolve o desenho de **capability social pública** (voz/broadcast).

## 3. Princípio normativo

Dinheiro e **voz pública** são poderes distintos que uma PJ não-auditada não deveria exercer. O F2-C fechou o dinheiro; faltava a voz. Capability social pública (broadcast/influência) de page-actor não pode depender só de delegação — quem fala **como empresa** no espaço público precisa ser uma empresa **verificada** (KYB approved). Display e enforcement devem falar a mesma língua, ambos ancorados em `kyb_status`.

## 4. Decisões promulgadas

### 4.1 Regra-mãe (vinculante)
Para **page-actor/PJ**, ações sociais públicas com efeito de **broadcast ou influência institucional** não podem depender apenas de ownership/delegation. Para PJ, **`publish_feed` e `cast_vote` exigem `fiscal_identities.kyb_status = 'approved'`**.

### 4.2 Escopo inicial
Cobre inicialmente: **`publish_feed`** e **`cast_vote`**.
**Não cobre** nesta fase: leitura de perfil; existência da empresa; criação de empresa; `requestValidation`/QR; operação financeira (já F2-C); frontend; catálogo/produto/oferta/evento (salvo decisão futura).

### 4.3 Política para PJ pending
PJ com `kyb_status` ≠ `approved`: **pode existir**, **pode manter presença/perfil básico**, mas **não pode publicar feed como PJ**, **não pode votar como PJ**, e **não recebe capability social pública plena**. **Estados bloqueados:** `pending`, `rejected`, `suspended`, `closed`, `null`/sem `fiscal_identity` (fail-closed).

### 4.4 PF/user
PF/user/person **não muda**. KYC PF e regras humanas permanecem nos fluxos próprios. **Não aplicar KYB PJ a PF.**

### 4.5 Grupos/outros actor types
**Não alterar** grupos/outros actor types. O gate KYB social é **escopado a page-actor/PJ**.

### 4.6 Fonte proibida
O gate social **não pode inferir** aprovação por: `company_status='VERIFIED'`, `company_status='APPROVED'`, `is_verified=true`, metadata, frontend, query param, ou `reputation` input. **Fonte única = `fiscal_identities.kyb_status='approved'`.**

### 4.7 Implementação futura
Executor posterior implementa **camada KYB social escopada** (**Opção E** — menor blast radius):
- corrigir `publish_feed` e `cast_vote` para page-actor;
- resolver `page → company → fiscal_identity → kyb_status` **server-side**;
- **fail-closed** para page sem company/fiscal;
- PF/user inalterado.
**Não** exigir refactor amplo para helper compartilhado nesta fase — helper compartilhado com F2-C é **higiene futura, não pré-requisito** (porém o `resolveKybApproved` já criado na Fase 3.0 pode ser reusado).

### 4.8 Paridade com display
Após a implementação: `reputation.getPermissions` e `authorityService.canPerformAction` devem **concordar**. O display **não** pode dizer "bloqueado" enquanto a API permite; a API **não** pode permitir enquanto o display bloqueia por KYB.

### 4.9 Relação com F2-C
F2-C continua o **gate financeiro**. O social authority KYB **não substitui** F2-C — evita **broadcast/influência pública** de PJ sem KYB. **Dinheiro e voz pública são gates distintos**, ambos ancorados em `kyb_status`.

## 5. Ordem de implementação futura (vinculante na sequência)

```text
Fase Social Gate 1 — executor:
  - gate KYB para page-actor em publish_feed;
  - gate KYB para page-actor em cast_vote;
  - resolver kyb_status server-side (page→company→fiscal_identity);
  - fail-closed para page sem fiscal; PF/user inalterado;
  - testes pending/approved/rejected/no-fiscal/PF.
Fase Social Gate 2 — higiene:
  - avaliar helper compartilhado com F2-C;
  - limpar mensagens stale (social-votes "validação presencial");
  - alinhar responses/códigos; revisar outras actions sociais futuras.
Fase 3.1-A — compat textual:
  - SÓ DEPOIS do portão;
  - deprecar comentários/types/messages (VERIFIED/APPROVED, is_verified);
  - sem schema.
```

A **Fase Social Gate 1 é prioritária** — fecha o gap display×enforcement. A compat textual (3.1-A) espera o portão: **primeiro o portão, depois a placa.**

## 6. O que fica fora (vinculante)

implementação/código · migration/schema · alteração de frontend · alteração de PF/KYC · alteração de grupos/outros actor types · ampliar escopo além de `publish_feed`/`cast_vote` · refactor de helper compartilhado (higiene futura) · alteração do gate F2-C · Bank/ledger/split · `company_status`/`is_verified` schema.

## 7. Superada por

(em aberto — decisão vigente)
