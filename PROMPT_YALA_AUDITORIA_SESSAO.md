# DOSSIÊ PARA A YALA — auditoria adversarial do material construído na sessão 2026-07-03/04

> **Papel que peço a você (YALA):** auditor adversarial independente. A executora (que escreveu este
> código) **não pode selar o próprio trabalho** — é você quem verifica se o que ela construiu tem
> problema invisível. Pense como ATACANTE, não como auditor de estrutura. **Disco vence narrativa:**
> não acredite em nenhuma afirmação abaixo sem confirmar no código, arquivo:linha, em 1ª pessoa.
> As afirmações da executora estão aqui **para você REFUTAR**, não para aceitar.
>
> **Contexto do projeto:** UnifiCard, branch `rescue-structural`. Lei vigente: DECISION-0113
> (actorId declarado pelo cliente = HINT; autoridade real = `canRepresentActor(tenantId, userId,
> actorId)` server-side, fail-closed). Substrato: multi-tenant com RLS no financeiro; a "vitrine"
> (`public_profiles`) é a ÚNICA leitura cross-tenant deliberada. Precedente: uma auditoria forense
> anterior já achou que a Slice A desta mesma frente AMPLIFICOU uma vuln (V2 confused-deputy) que a
> executora não tinha visto — **presuma que pode haver um irmão de V2 ainda escondido.**

---

## ESCOPO EXATO (só estes arcos; nada além)

**Arco A — Descoberta / vitrine pública cross-tenant.** Commits `c4089e292`, `152ab1145` (fix V2),
`398cca11c` (frontend), `9be73be99` (prompt de intenção). Arquivos:
- `backend/src/modules/public-profiles/public-profile.{types,repository,service,routes}.ts`
- `backend/src/modules/search/search-omni.service.ts` (pista global `searchGlobalPublic`)
- `frontend/src/api/public-profiles.ts` · `components/PublicProfileVisibilityCard.tsx` ·
  `components/PublishProfileIntentPrompt.tsx` · alterações em `OmniSearchDropdown.tsx`/`SearchPage.tsx`/`PerfilPage.tsx`
- guard `backend/scripts/audit-public-profile-discovery-contract.mjs` + E2E
  `validate-pipeline-e2e-public-profile-discovery.ts`

**Arco B — Fix V1 (BOLA/IDOR no lifecycle de eventos).** Commit `4cefb9365`. Arquivos:
- `backend/src/core/events/event.routes.ts` (helper `resolveRepresentedActor`, 18 handlers)
- guard `backend/scripts/audit-event-lifecycle-authority.mjs` + E2E
  `validate-pipeline-e2e-event-lifecycle-authority.ts`

---

## AFIRMAÇÕES DA EXECUTORA (refute cada uma no disco)

**Arco A:**
1. "A escrita da vitrine só ocorre sob o actor PROVADO (`canRepresentActor`), nunca sob `body.actorId`
   — V2 fechada." → Confirme em `public-profile.service.ts createProfile` E em `publishForActor`/
   `upsertByActor`. **Há OUTRO caminho de escrita** (rota, service, repo) que grave `public_profiles`
   sob um actor não-provado? PATCH `/:id` e `/:id/visibility` provam ownership do perfil-alvo?
2. "A leitura global (`searchGlobalPublic`) só devolve projeção segura — nunca PII." → Confirme as
   COLUNAS do SELECT e o que chega no CLIENTE (`OmniIdentityHit`). O `tenant_id` de origem vaza para
   a resposta HTTP? `email`/`user_id`/`global_user_id`/`kyc`/`metadata` aparecem em algum caminho?
3. "Só `visibility='public'` aparece na vitrine; `private`/`followers_only` não." → Confirme o filtro.
   Um perfil `private` pode ser lido por qualquer rota cross-tenant? E `followers_only` (existe no
   CHECK mas não deveria ser oferecido na Fase 1)?
4. "`public_profiles` não tem RLS de propósito (leitura cross-tenant), mas a ESCRITA é tenant-scoped."
   → Um atacante do tenant B consegue criar/editar/despublicar uma plaquinha de um actor do tenant A?
   `upsertByActor`/`createProfile` usam `runQueryWithTenant`? Há caminho que escape o tenant-scope?
5. "Só `profile_type IN ('user','page')` na busca." → Um `group`/`cultural_profile` publicado pode
   aparecer na busca indevidamente, ou ser usado para spoof de identidade?
6. "O toggle e o prompt de intenção não criam verdade local (zero localStorage)." → Confirme.

**Arco B:**
7. "Os 18 handlers de mutação de evento agora passam por `resolveRepresentedActor` que prova
   `canRepresentActor` fail-closed." → **Varra TODOS os handlers de `event.routes.ts`** (não só os 18):
   há algum handler de mutação/estado que toque `eventService.<mut>` SEM passar pela catraca? Algum que
   use `req.body.actor_id`/`req.params`/`req.query` como autoridade? O `POST /:id/checkout` e os
   `economic/v2/*` (payment/refund/chargeback) estão cobertos?
8. "O service `event.service.ts:316` (`if (event.actorId !== actorId)`) agora é seguro porque `actorId`
   é provado." → Confirme que o fluxo LEGÍTIMO de grupo (user representa admin do grupo dono do evento)
   ainda funciona, e que o fluxo de ATAQUE (actorId = dono não-representável) morre no
   `resolveRepresentedActor` antes do service.
9. "O guard `audit-event-lifecycle-authority.mjs` trava a regressão." → Ele tem falso-NEGATIVO? Um
   atacante consegue reintroduzir o padrão de V1 de um jeito que o guard NÃO morde? (ex.: novo helper
   fraco com outro nome; bypass sutil que seta `represents=true`).

---

## HIPÓTESES DE ATAQUE PARA VOCÊ TESTAR (vá além das afirmações)

- **Irmão de V2:** existe alguma OUTRA superfície (posts, services, rentals, offerings) que, como a
  POST /public-profiles legada fazia, prove autoridade sobre o próprio actor mas escreva/leia sob um
  actor alheio? A vitrine cross-tenant amplifica qualquer um desses?
- **Amplificação cross-tenant:** algum dado que ANTES ficava preso no tenant agora vaza pela vitrine
  ou pela pista global da busca? (a executora ligou `searchGlobalPublic` — o que mais isso expõe?)
- **Herança da delegação-escopo:** `canRepresentActor` ignora `scopes[]` (DT-AUTHORITY-LATENTS-PASSO-3
  ①). O fix V1 e o publish da vitrine dependem de `canRepresentActor`. Quando delegação for ligada,
  isso vira over-privilege nesses caminhos? (é latente, mas mapeie a superfície).
- **E2E teatral:** os E2Es provam o que dizem provar, ou passam por setup que mascara o caminho real?
  (ex.: o E2E de eventos INSERE o evento direto no banco — isso pula alguma checagem que o fluxo real
  teria? o hook de auth simula `req.user` — algum handler real teria `req.user` ausente e falharia
  diferente?)

---

## FORMATO DE RESPOSTA QUE PEÇO

Para cada achado: **severidade** (CRÍTICA/ALTA/MÉDIA/BAIXA) · **arquivo:linha** · **vetor concreto**
(inputs → efeito) · **CONFIRMED** (você reproduziu/verificou no disco) ou **PLAUSIBLE** (suspeita não
confirmada). Liste também o que você VERIFICOU e considerou SÓLIDO (calibração). Se algum "achado" for
falso-positivo por leitura de doc/narrativa em vez de código, diga — a executora prefere um
falso-positivo desmontado a um crítico fantasma publicado. **Nenhuma escrita no banco; read-only.**

---

*Dossiê montado pela executora para verificação independente. Ela NÃO viu este material com olhos de
atacante — é esse o seu trabalho. Se achar que ela criou um problema invisível, esse é exatamente o
resultado que protege o sistema.*
