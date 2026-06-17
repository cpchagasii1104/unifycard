# DECISION-0139 — Actor-Scoped Referral Code & Earnings

**Status:** **PROMULGADA / DOCS-ONLY.** Zero código, zero migration, zero schema, zero seed, zero runtime,
zero banco, zero RBAC, zero UI. Promulga soberanamente que **o código de indicação e os earnings de
indicação pertencem economicamente ao `actor` dono (`owner_actor_id`)**, não ao CPF por reflexo — preservando
o CPF/`actor_human` como **raiz legal, civil, fiscal e rastreável**. Esta DECISION **refina e supersede
parcialmente a DECISION-0134** (que já promulgou "código pertence ao actor" no plano de lookup/autoridade),
adicionando a **dimensão econômica/earnings**, registrando o **gap material USER_ONLY** e travando o vetor
`body/metadata.referral_code` arbitrário.

**Data:** 2026-06-17 · **Branch:** `rescue-structural` · **HEAD:** `1565a184` · **dev:** 393 (sem migration) ·
**Tipo:** Produto / Arquitetura / Autoridade / Econômico · **Frente:** F-ACTOR-SCOPED-REFERRAL-PREFLIGHT
(docs-only) · **Responsável:** Clayton / IA Diretora (executor: Claude) · **Validação prévia:** Clayton.

**Relação:** **build-on / supersede parcial de `DECISION-0134`** (Actor referral como lookup + baseline de
capability grants). A 0134 §2 (código pertence ao actor; lookup, não authority) **permanece vigente**; a 0139
**adiciona** a posse econômica do código + destino de earnings + o STOP do `referral_code` arbitrário.
**Deriva de / subordinada a:** `CONSTITUICAO_UNIFICARD` (actor = unidade econômica soberana) · `AUTHORITY_LAW`
(CPF = única raiz de autoridade) · `07_NOMENCLATURA_CANONICA` · `LEI_DE_COERENCIA_SISTEMICA` · `DECISION-0113`
(actorId declarado é HINT; autoridade = `canRepresentActor`) · `DECISION-0131` (gramática de autoridade) ·
`DECISION-0134` (referral lookup + baseline).

---

## §1 — Regra soberana (PROMULGADA)

1. **CPF / `actor_human` é raiz legal, civil, fiscal e rastreável** de toda a cadeia.
2. **CPF nunca é substituído por `referral_code`** (código é lookup humano, não identidade legal).
3. **`actor` é unidade operacional/econômica soberana** dentro do Unificard.
4. **`actor_organizational` não é soberano legalmente**, mas é **unidade econômica interna** (pode ter wallet e código).
5. **Cada `actor` pode ter código de indicação próprio.**
6. **`referral_code` pertence a `owner_actor_id`** (ao actor que o gerou — não ao CPF, não ao CNPJ por reflexo).
7. **`referral_code` é lookup, não authority.**
8. **`referral_code` não concede permissão sozinho** (autoridade = `actor_id` + grants + `canRepresentActor`/delegação/owner).
9. **`body/metadata.referral_code` arbitrário NÃO pode definir dono econômico** (vetor de injeção; resolução é server-side por `owner_actor_id`).
10. **Earnings de indicação pertencem ao `actor` dono do código.**
11. **Destino canônico de earnings = `actor_wallet` / `bank_account` do `owner_actor_id`.**
12. **CPF raiz preserva rastreabilidade, mas NÃO captura earnings por reflexo** (a raiz legal não é dona econômica cega).
13. **Outro CPF pode operar um `actor` por autoridade/delegação, mas operar NÃO transfere ownership econômico**
    (delegação = uso controlado de autoridade, cadeia até CPF original + CPF ocupante — `08 §6.2`; nunca transferência de posse).

**Frase canônica:**
> "O código de indicação e seus earnings pertencem ao **actor** que os gerou (`owner_actor_id`); o CPF é a
> **raiz legal e rastreável**, não o dono econômico por reflexo. Operar um actor por delegação não transfere posse."

---

## §2 — Exemplos canônicos

1. **Clayton PF usa o código do actor PF:** earnings → `actor_wallet` do **actor PF**.
2. **Clayton cria uma banda:** a banda é **outro actor**; o código da banda pertence ao **actor da banda**;
   earnings → `actor_wallet` da **banda**.
3. **Clayton cria empresa / página / grupo:** cada actor pode ter código próprio; earnings → `actor_wallet`
   **daquele actor**.
4. **Um CPF com 100 actors e 100 códigos:** todos **rastreiam ao CPF raiz**; cada código pertence
   **economicamente ao actor específico** — earnings **não se misturam** entre actors do mesmo CPF.

---

## §3 — Janela econômica de 5 anos — PENDENTE CLAYTON (NÃO promulgada aqui)

> "A janela econômica de 5 anos para vínculo/alienação por indicação foi mencionada como decisão de produto,
> mas não foi localizada prova documental formal nesta auditoria. **Não fica promulgada por esta DECISION até
> ratificação explícita de Clayton ou referência documental.**"

Esta DECISION **NÃO afirma** que os 5 anos já estão ratificados. Fica como **PENDENTE CLAYTON**, a resolver
em DECISION/ratificação própria.

---

## §4 — Estado atual material: USER_ONLY (auditoria READ-ONLY)

A auditoria actor-scoped referral retornou **veredito USER_ONLY** — o diferencial Unificard **ainda não está
materialmente implementado**. Estado vivo:

- `users.referral_code` é a **fonte viva** (user-scoped).
- `user_referral_links` liga **user ↔ user** (`referrer_user_id`/`referred_user_id`/`referral_code_used`).
- check-referral **resolve user**; split referral **resolve conta do user**.
- **actors derivados NÃO nascem com código próprio.**
- `generateShareableLink` aceita `referral_code` solto em `body`/`metadata` → **vetor DIVERGENT** (regra §1.9).
- `referral_codes(owner_actor_id)` existe só em **archive/docs**, **não como fonte viva**.

**Achado positivo (infra financeira já actor-native):**
- `bank_accounts.owner_type` no DB é **`'actor'`**; `actor_wallet` existe para **qualquer actor**;
  `getActorWalletAccount` / `ensureActorWalletAccount` já suportam o actor econômico.

**Conclusão:** o gap **NÃO** está no Bank/wallet (já é actor-native). O gap está na **identidade canônica do
código** (falta `actor_referral_codes` / vínculo actor↔actor) e no **resolver do split** (resolve user, não `owner_actor_id`).

---

## §5 — Próxima macrofrente material (PLANEJADA, não implementada)

**`F-ACTOR-REFERRAL-CODE-SUBSTRATE`** — escopo futuro provável (gated, NÃO executar agora):

- criar `actor_referral_codes` com `owner_actor_id` FK `actors`; `UNIQUE(tenant_id, code)`;
  `UNIQUE(tenant_id, owner_actor_id)` se um código ativo por actor;
- evoluir `user_referral_links` para `referrer_actor_id` / `referred_actor_id`, mantendo `user_id`/`global_user_id`
  como **breadcrumb civil**;
- **gerar código no nascimento de actor derivado**;
- split referral usa `getActorWalletAccount(ownerActorId)`;
- **bloquear `body/metadata.referral_code` arbitrário** (resolução server-side por `owner_actor_id`);
- reescrever E2E user-only; criar guards.

**STOPs (vinculantes para a frente futura):**
- implementação é **money-adjacent**; antes de código exige **3 paralelas READ-ONLY** (ou reaproveitamento das
  auditorias com re-anchor);
- **não tocar Bank Core** fora das APIs canônicas; **não escrever em `bank_ledger`**;
- **não implementar sem E2Es:** PF→PF · banda→banda · empresa→empresa · grupo/página→actor próprio · mesmo CPF
  com múltiplos actors **não mistura earnings**;
- **não fechar enquanto `body.referral_code` puder injetar dono econômico**;
- **code/slug/referral continua lookup, NUNCA authority.**

Resíduo material registrado em **`DT-ACTOR-SCOPED-REFERRAL-USER-ONLY`** (OPEN).

---

## §6 — Reconciliação com DECISION-0134 (append-only, sem reescrever história)

- A **0134 §2** promulgou: código de indicação **pertence ao actor** (lookup humano), **não** é authority, CPF/CNPJ
  originam N actors, código único por actor. **Permanece vigente.**
- A **0139** **build-on / supersede parcial**: adiciona a **dimensão econômica** (earnings → `actor_wallet` do
  `owner_actor_id`; CPF não captura por reflexo), o **estado material USER_ONLY**, o **vetor `body.referral_code`**
  e a **frente material** `F-ACTOR-REFERRAL-CODE-SUBSTRATE`. A história da 0134 **não é apagada nem reescrita**;
  recebe apenas um ponteiro para esta DECISION.

---

## §7 — NÃO decidido / fora de escopo

Janela de 5 anos (PENDENTE Clayton) · implementação de `actor_referral_codes` · resolver/split por `owner_actor_id` ·
evolução de `user_referral_links` · geração de código no nascimento do actor · bloqueio do `body.referral_code` ·
qualquer `move_money` / escrita em `bank_ledger` · migration/schema · runtime · frontend · RBAC. **Nada material
foi tocado por esta DECISION (docs-only).**

---

## §8 — Referências

`DECISION-0134` (referral lookup + baseline; refinada/superseded parcial por esta) · `DECISION-0113`
(actorId HINT / `canRepresentActor`) · `DECISION-0131` (gramática de autoridade) · `AUTHORITY_LAW` (CPF raiz) ·
`LEI_DE_COERENCIA_SISTEMICA` · `07_NOMENCLATURA_CANONICA` · `bank_accounts.owner_type='actor'` /
`getActorWalletAccount` / `ensureActorWalletAccount` (infra actor-native viva) · `DT-ACTOR-SCOPED-REFERRAL-USER-ONLY` ·
`docs/03_execution_log/20260617_F_ACTOR_SCOPED_REFERRAL_PREFLIGHT.md`.
