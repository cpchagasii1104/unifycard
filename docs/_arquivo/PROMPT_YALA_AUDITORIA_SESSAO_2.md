# DOSSIÊ YALA #2 — auditoria adversarial do 2º lote (KYC-gate + triagem impersonação + delegação-escopo)

> **Papel (YALA):** auditor adversarial independente. A executora escreveu este código e **não sela o
> próprio trabalho**. Pense como ATACANTE. **Disco vence narrativa** — confirme cada afirmação no
> código, arquivo:linha, em 1ª pessoa. As afirmações estão aqui para você **REFUTAR**.
>
> **Precedente que importa:** no dossiê #1 (vitrine + fix V1), você achou que o fix V1 caiu na
> "régua pela metade" — cobriu handlers via um helper mas deixou 3 mutações roteadas a OUTROS
> services sem autoridade (F1/F2/F3), e o guard era cego a elas. **Presuma o mesmo padrão aqui:**
> um gate pode ter irmão não-coberto; um guard pode ter falso-negativo; um E2E pode ser teatral.
>
> **Contexto:** UnifiCard, branch `rescue-structural`, HEAD `cca3180c9`. Lei: DECISION-0113
> (actorId declarado = HINT; autoridade = `canRepresentActor(tenantId, userId, actorId)` server-side
> fail-closed). AUTHORITY_LAW Art.4.2 (KYC mínimo p/ criar/controlar CNPJ). DECISION-0125 §escopo
> (autoridade escopada, blanket=fail-closed). Substrato multi-tenant, RLS no financeiro.

---

## ESCOPO (3 arcos deste lote; nada de dinheiro foi tocado)

**Arco C — KYC-gate na ativação de empresa.** Commit `a1b8f84d1`.
- `backend/src/core/companies/companies.service.ts` → `activateCompanyOperationally` (gate KYC)
- guard `audit-company-activation-kyc-gate.mjs` + E2E `validate-pipeline-e2e-pj-activation-route.ts` (T0)
- 6 fixtures de E2E atualizadas (founder KYC-aprovado antes de ativar)

**Arco D — Triagem handler-level (4 writes de impersonação).** Commit `4dc6981d6`.
- `backend/src/core/identity/identity.routes.ts` → POST `/update` (BOLA civil)
- `backend/src/modules/social/social-2.0.routes.ts` → POST `/posts/:id/reactions` e `/comments`
- `backend/src/core/feed/feed.routes.ts` → POST `/action`
- guard `audit-actor-impersonation-writes.mjs` + E2E `validate-pipeline-e2e-identity-update-authority.ts`

**Arco E — Contenção da delegação-escopo.** Commit `5f64c623e`.
- `backend/src/core/authorization/authorization.service.ts` → `canRepresentActor` (rule 5, delegação)
- guard `audit-delegation-scope-containment.mjs` + E2E `validate-pipeline-e2e-delegation-scope-containment.ts`

---

## AFIRMAÇÕES DA EXECUTORA (refute no disco)

**Arco C (KYC-gate):**
1. "A ativação exige `identities.kyc_status='approved'` do responsável, fail-closed." → Confirme o
   join `users→identities` e o `!== 'approved'`. **O gate tem irmão?** Existe OUTRO caminho que promova
   a empresa (DRAFT→PROVISIONAL/ACTIVE) sem passar por `activateCompanyOperationally`? (UPDATE direto
   de `company_status`, outro writer, rota alternativa). Se sim, o KYC-gate é contornável.
2. "A empresa pode nascer DRAFT sem KYC (Art.4.1); só a ativação gateia." → O `createCompany` realmente
   não move além de DRAFT? Um DRAFT já consegue fazer algo economicamente relevante sem ativar?
3. "6 E2E fixtures aprovam o founder antes de ativar; as outras 6 já aprovavam." → Alguma das 12
   mascara o gate (ex.: bypass, is_test, ou aprova o user ERRADO)? O E2E T0 (pending→403) é honesto?

**Arco D (impersonação):**
4. "identity POST /update agora prova canRepresentActor antes de escrever a identidade civil." →
   Confirme que a prova está ANTES da resolução `actor.user_id`/`getIdentityProfile`/`updateGlobalIdentity`.
   **Há OUTRA rota de identity** (PUT /configurations, confirm-civil-data, ou admin) que escreva
   civil/global identity sob um alvo client-declared sem prova?
5. "social reactions/comments provam representação; follow/unfollow/switch/vote/cta são self/safe." →
   Refute: algum desses 5 que classifiquei SAFE na verdade age sob actor alheio? (especialmente
   `switch` e `cta` — confirme o subject server-side).
6. "feed /action prova representação." → Confirme; e veja se o GET /feed (leitura) vaza feed de outro.
7. "O guard audit-actor-impersonation-writes tem negative-proof." → Ele tem falso-NEGATIVO? Cobre os
   4 handlers ou só alguns? Um 5º handler de impersonação passaria batido?

**Arco E (delegação-escopo):**
8. "canRepresentActor por delegação exige scopes.includes('*'); escopada não concede representação." →
   Confirme. **A contenção é completa?** Um delegado escopado ainda consegue agir via OUTRO caminho
   (canActAs, checkPermission, ou uma rota que não passe por canRepresentActor)? A semântica de '*'
   está certa (é mesmo o marcador FULL, consistente com `checkDelegationPermission`)?
9. "É fail-closed e latente (0 delegações)." → Confirme que a mudança não quebra ownership/empresa/
   grupo (rules 1-4 de canRepresentActor). O E2E isola de fato só a rule 5?

---

## HIPÓTESES DE ATAQUE (vá além)

- **Irmão do KYC-gate:** algum writer promove company_status sem o gate? (grep `company_status =`,
  outros services, migrations de trigger).
- **Irmão do BOLA de identity:** varra TODA mutação em identity.routes.ts (não só /update) que toque
  `global_users`/`identities`/`profiles` — alguma sob actor/globalUser client-declared sem prova?
- **Impersonação residual em social:** os handlers que classifiquei SAFE (follow/switch/vote/cta) —
  algum escreve autoria/efeito sob um actor que o caller não representa?
- **Delegação por outro vetor:** além de canRepresentActor, `canActAs`/`checkPermission` concedem
  algo a uma delegação escopada que deveria ser negado? A contenção cobre o vetor certo?
- **E2E teatral:** os E2Es INSEREM direto no banco (evento/staff/delegação/identidade) e stubam
  `requireRole`. Isso pula alguma checagem que o fluxo real teria? O gate testado é o gate real?

---

## FORMATO

Por achado: **severidade** · **arquivo:linha** · **vetor concreto** (inputs→efeito) ·
**CONFIRMED** (reproduzido no disco) ou **PLAUSIBLE**. Liste o que verificou e considerou SÓLIDO
(calibração). Falso-positivo por leitura de doc/narrativa em vez de código → diga (a executora
prefere um FP desmontado a um crítico fantasma). **Read-only; nenhuma escrita no banco.**

---

*Dossiê da executora para verificação independente. Se ela deixou um irmão não-coberto (como no
lote #1), achá-lo é exatamente o resultado que protege o sistema.*
