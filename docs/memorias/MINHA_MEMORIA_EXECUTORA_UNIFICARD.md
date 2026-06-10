# MINHA_MEMORIA_EXECUTORA_UNIFICARD.md
# EXECUTORA UNIFICARD — Instância de execução controlada (a que edita quando há GO)

> **Protocolo de uso:** esta memória é insumo operacional, **não norma soberana**. Antes de usar qualquer evidência material, **revalidar HEAD, branch, status, schema/código vivo e a fonte soberana aplicável**. Esta instância edita sob GO da IA Diretora/Clayton; as especialistas só editam a própria memória. Protocolo completo: `docs/memorias/README.md`.

**Data de criação:** 2026-06-09
**Branch:** rescue-structural
**HEAD aproximado:** 7430a32c (pós marketplace actor-target DB-backed fechado + DTs residuais + correção de caller)
**Modo:** EXECUTORA — edito código/docs SOMENTE sob GO explícito da IA Diretora; Yala verifica adversarialmente.

> Este é o ÚNICO arquivo que escrevo como memória própria; acrescento, nunca apago (append-only).
> Arquivos protegidos (nunca tocar): `CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`, `clayton.md`, `dividas.md`.

---

## 1. IDENTIDADE DA INSTÂNCIA

Sou a **executora `unificard`**. Diferente das instâncias permanentes READ-ONLY (IA-DT, IA-ACTOR-USERS, IA-DINHEIRO, IA-BANCO-DE-DADOS, IA-DECISOES, IA-DOCUMENTOS, IA-TEMPO, IA-USUARIOS-E-ACESSO), **eu sou a mão que edita** — mas só quando recebo um **GO** da IA Diretora (Clayton).

Regras de papel (vinculantes):
- **Sou a única instância autorizada a editar código/docs quando recebo GO** — as outras mapeiam/classificam/alertam, não executam.
- **NÃO decido regra social/produto sozinha.** Quando a correção depende de uma decisão de produto/política, eu PARO e reporto (STOP), não escolho no chute.
- **Reporto dúvidas** em vez de inventar resposta. Esta memória tem uma seção formal de dúvidas abertas (§3) para outras instâncias responderem.
- **Esteira:** IA Diretora emite GO e serializa/sela; eu executo UMA fatia (READ-FIRST → patch → e2e → 4 gates → docs → commit → relatório); Yala verifica READ-ONLY adversarial.
- **Formato de resposta = lei:** todo relatório em bloco(s) copiável(is) no chat (nunca arquivo), com bloco `RESPOSTA PARA: IA DIRETORA` e, quando há reseal, bloco separado `RESPOSTA PARA: YALA`.

---

## 2. REGRAS QUE APRENDI EXECUTANDO (régua operacional)

1. **READ-FIRST antes de patch.** Ler a rota, o service, o repository, os tipos e os callers ANTES de tocar. Declarar P1 ("corrige sintoma ou causa raiz?") a cada fatia.
2. **`actorId` vindo do cliente é HINT, não autoridade** — em qualquer um dos 5 canais DECISION-0113: (1) `actionContext.actorId`; (2) header `x-actor-id`; (3) query `actor_id`/`actorId`; (4) params `:actorId`; (5) params `:id` de recurso privado (IDOR). Provar server-side com `req.user` + `canRepresentActor`.
3. **`can_manage_marketplace` é DEFAULT de TODA company** (`actor-registry.getDefaultCapabilities('company')`). Logo `requirePermission('marketplace_*')` prova capability + representação do PRÓPRIO actor, **NÃO** autoridade sobre o actor ALVO. Toda rota `marketplace_*` + actor alvo em params/query/body = **A até prova de gate no alvo**. O mesmo vale para `can_hold_assets` (também default de company → `marketplace_execute_payments`).
4. **`requirePermission` (capability) NÃO substitui `canRepresentActor`** quando há actor alvo filtrado. Capability/permissão de MÓDULO ≠ autoridade sobre o RECURSO/ACTOR. (Mesma armadilha de `dashboard:view`="ownership suficiente".)
5. **Há DOIS `requirePermission` diferentes:** `fastify.requirePermission` (rbac.plugin → `actor_has_permission` = **stub fail-closed `RETURN FALSE`**, nega todos hoje até FASE 6) vs `require-permission.guard.requirePermission` (capability-based via `actor_registry.capabilities_json` = LIVE/enforced). Marketplace usa o segundo (vivo).
6. **`actor_has_permission` é stub fail-closed** (migration `20260422000100`, C47/DECISION-0013, "até FASE 6"). Mascara leaks `query.actorId` em rotas `fastify.requirePermission` — inerte por máscara temporária, não por gate. **FASE 6 não pode avançar antes de 0113 fechar** OU deve preservar `canRepresentActor` dentro de `requirePermission`. (`DT-RBAC-FAIL-CLOSED-STUB-FASE6-REACTIVATION-TRAP`.)
7. **UnifyCard acquiring = tombstone / C-INERTE** (Proxy reject-all, `unifycard_transactions` 0 linhas, tabelas de método ausentes). NÃO corrigir rota morta com `canRepresentActor` (teatro). Reativação só via frente financeira governada. (`DT-UNIFYCARD-ACQUIRING-LEGACY-TOMBSTONE`.)
8. **Bank/ledger/saldo/split/payout/settlement = STOP pesado (M).** Se uma rota toca isso, classificar M e PARAR — money exige três paralelas / frente própria, não patch no corte 0113 simples. "Money não pega carona em visibility."
9. **Rotas in-memory (Maps) podem virar reactivation trap.** W2/W3/W4 (sla-contracts/reputation-generate/disputes) são `.set()` em memória hoje; materializar em DB/fila sem `canRepresentActor(body.actor_id)` no mesmo corte revive o leak. **Gate-on-materialization** — não patchar Map efêmero agora (sem substrato), registrar DT.
10. **Não corrigir rota morta com teatro de segurança.** Se o caminho já é fail-closed (Proxy/stub) ou dead, gate é teatro — registrar tombstone/vigia em vez de patch.
11. **GET não cria actor.** Sem `ensureUserActor`/`getActiveActor` como atalho de autoridade em leitura.
12. **Fechar o ARQUIVO, não o endpoint.** O denominador do arquivo importa: "default gateado não protege se a lista está aberta". Classificar TODOS os GETs/writes do arquivo, não só o do GO literal.
13. **`:id` de recurso ≠ actor.** Para by-id de recurso privado, resolver o OWNER real do recurso (ex.: `method.actorId`, `invoice.actorId`) e `canRepresentActor` sobre ele — nunca `canRepresentActor(params.id)` direto.
14. **NUNCA afirmar "limpo / sem caller" antes da varredura inteira retornar** — especialmente `frontend/src`. Erro real cometido em 2026-06-09: declarei "inventory/movements sem caller in-repo" com grep de backend incompleto; o grep de `frontend/src` (ainda rodando) revelou `getMovements(variantId)` chamando o caminho sem actorId. Mesmo anti-padrão "canal-3 limpo já mentiu". Esperar o grep antes de escrever a afirmação no doc.
15. **Auto-correção sem defensividade.** Quando Yala/grep me pega num erro, confirmo de 1ª mão, corrijo, e registro QUE o erro ocorreu e por quê — não apago o rastro nem racionalizo.

---

## 3. DÚVIDAS ABERTAS PARA OUTRAS INSTÂNCIAS

> Formato: cada dúvida é endereçada a UMA especialidade. A instância responde só o que é dela, NÃO edita código, e devolve para a IA Diretora consolidar. Marcar `[x]` quando respondida (com link/commit).

- [ ] **Para instância Dinheiro (IA-DINHEIRO):**
  W5 `POST /disputes/:disputeId/resolve` (refund/partial_refund/credit, `amountCents`/`currency`) e W6 `POST /payment-plan/:paymentPlanId/apply-sla-penalties` (manipula `split.amountCents`/penalty) hoje são in-memory (`marketplace-sla.service.ts` Maps). **Quando materializarem, tocam `bank_ledger` (saída/divisão real de valor) ou ficam em projeção comercial?** Como deve ser estruturada a verificação "três paralelas" antes de qualquer patch nessas duas? O `redirect_to: regional_fund/customer/platform` das penalties (W2 sla-contracts) é liquidação Bank ou só política?

- [ ] **Para instância Banco de Dados (IA-BANCO-DE-DADOS):**
  `inventory_movements` não tem escopo de actor no SELECT de `getMovementsByVariant` (retorna todos os actors da variante). Quando a opção de escopo for decidida, **o escopo deve ser no nível de query (WHERE actor_id IN representáveis / RLS) ou na aplicação?** Existe RLS por tenant/actor em `inventory_movements`, `economic_identities`, `trust_events`, ou o isolamento é só `tenant_id` no WHERE? Há índice que suporte filtrar por conjunto de actors representáveis sem table scan?

- [ ] **Para instância Users/Actor (IA-ACTOR-USERS):**
  Para `GET /inventory/movements` SEM actorId (variant-wide, sem actor alvo único na entrada), **existe um helper canônico "listar actors representáveis pelo usuário"** que eu deva usar para a opção (b) "escopar aos representáveis", ou eu inventaria um? `canRepresentActor` é o mesmo primitivo independente do canal (body/params/query) — confirma que não há diferença semântica de autoridade entre `body.actor_id` e `params.actorId`?

- [ ] **Para instância DT (IA-DT):**
  `inventory/movements` sem actorId é **A-por-shape mas a vuln-class é "missing scope", não um canal 0113** (não há hint de cliente sendo confiado). **Ela conta no denominador da DT-mãe 0113 ou é raiz própria?** A família reactivation-trap (money-latent / unifycard-tombstone / rbac-fail-closed / agora marketplace-governance-inmemory) precisa de um índice-pai único, ou cada DT se vincula lateralmente como está?

- [ ] **Para instância Documentos/Decisões (IA-DECISOES):**
  Corrigir `inventory/movements` exige uma **DECISION de produto** (escolher entre a/obrigar actorId, b/escopar representáveis, c/agregar sem actor_id, d/só admin institucional) **antes** do patch, ou a executora pode escolher sob norma existente (`actor-first` / `frontend nunca cria verdade`)? Existe DECISION soberana governando autoridade de SLA/reputação/disputa (W2/W3/W4) à qual eu deva alinhar o gate-on-materialization?

---

## 4. PENDÊNCIAS QUE A EXECUTORA NÃO DEVE RESOLVER SOZINHA

- **W5/W6 money** (refund/credit/split/penalty) — exigem três paralelas + decisão Dinheiro.
- **inventory/movements scope** — decisão de produto (a/b/c/d), não escolho sozinha.
- **FASE 6 RBAC** — sequenciamento normativo; não libero.
- **R2 / delegação** — congelado; não toco.
- **Qualquer decisão de produto/social** — vocabulário de actor, política de penalidade, quem vê extrato tenant-wide, etc.

---

## 5. COMO OUTRAS IAs DEVEM RESPONDER A ESTE DOCUMENTO

1. **Ler** este documento (especialmente §3 Dúvidas abertas).
2. **Responder apenas o que pertence à sua especialidade** — não opinar fora do eixo.
3. **NÃO editar código** — são instâncias READ-ONLY; resposta é insumo.
4. **NÃO transformar dúvida em implementação** — descrever a régua/decisão, não codar.
5. **Devolver a resposta para a IA Diretora consolidar** — ela sequencia e emite o GO; eu executo só então.

---

## 6. ESTADO VIVO (revalidar HEAD antes de usar)

**HEAD `7430a32c` · branch `rescue-structural` · dev 365 · DT-mãe 0113 OPEN · R2 CONGELADO · FASE 6 não liberada.**

Marketplace actor-target **DB-backed = FECHADO e selado** (6 caminhos PASS Yala): inventory by-actor + movements?actorId (`3edf5494`) · economic-identities GET + trust-events GET (`ebd029d9`) · recalculate + reputation-snapshots GET (`0933b188`) · economic-identities CREATE body.actor_id (`31ee7ff1`).

Resíduos rastreados (DT/STOP, NÃO resolvidos):
- `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE` (OPEN) — A latente em dado (rows=0) **com caller frontend vivo** (`api/marketplace.ts:740`); decisão de escopo.
- `DT-MARKETPLACE-GOVERNANCE-INMEMORY-ACTOR-TARGET-REACTIVATION-TRAP` (OPEN) — W2/W3/W4 in-memory; gate-on-materialization.
- STOP money-aware W5/W6 — três paralelas antes de patch.

---

## 7. NOTAS APPEND-ONLY (cronológico)

- **2026-06-10 (2) — F-G10-C1-PRECONDITION Cluster 1: unread-counts hardening.** GO Clayton/IA Diretora: `groups` MEMBER-SCOPED via `group_members` (sujeito `req.user.userId` server-side), `services` público-only, `feed`/`events` intocados, contrato preservado. **Aprendizado-régua novo (§2.19): "endpoint morto-mas-200 — provar que a rota EXECUTA antes de endurecê-la".** A query de `feed` referencia `posts.visibility`, coluna INEXISTENTE no schema vivo (posts vivo = `is_published`/`is_deleted`; `visibility` por post é fantasma — família DT-PRESSURE-GROUPS-VISIBILITY-FANTASMA); o `try/catch` único fazia os 4 contadores devolverem sempre `{0,0,0,0}`. Patch só nos predicados seria teatro (nunca executaria). Solução: erro isolado por contador (`countOrZero`), query do feed preservada byte-a-byte (e2e F6.5.4 C4 pinna o literal `visibility = 'PUBLIC'` — atualizar esse check é fatia futura com GO), resíduo → `DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN`. **§2.20: mapear "público" no schema VIVO, não no schema imaginado** — "apenas conteúdo público" virou `is_published AND NOT is_deleted AND fora-de-grupo` (fronteira não-pública materializada hoje = grupo); interpretação reportada para ratificação, não decidida em silêncio. Identidade do sujeito provada na fonte: JWT `sub` = `users.id` (≡`users.user_id`), `actors.user_id→users.id`, `group_members.user_id` recebe esse mesmo id — `req.user.userId` é o sujeito correto do member-scoping. Fail-first real: e2e novo 14/20 antes → 20/20 depois.

- **2026-06-10 — DECISION-0115 docs-only (nascimento humano vertical G10).** Depois da auditoria FASE B (PASS IA Diretora) provar que a jornada de nascimento roda com writers canônicos em 5/7 fases, Clayton cravou: o erro agora seria implementar — o bloqueio é **cartorial**. Promulguei 5 decisões-raiz (D1 tenant inicial vivo; D2 nascimento identity/actor garantido; D3 gender 5 valores; D4 jornada self/auth-derived sem FASE 6; D5 sem evento econômico no G10) + 6 DTs OPEN. **Aprendizado-régua novo (§2.16):** quando a auditoria acha a raiz certa, PROMULGAR antes de implementar — patch sobre raiz não-decidida vira folha solta. **§2.17:** sempre NOMEAR a tensão normativa em vez de fingir compatibilidade — D3 (gender 3→5) **emenda o enum da DECISION-0080 RATIFICADA**; o CHECK vivo de `global_users.gender` só aceita 3, então persistir 5 é fatia futura com migration, não patch agora — registrei como `DT-GENDER-INPUT-PERSISTENCE-VOCABULARY-DIVERGENCE`. **§2.18:** consultar a DECISION antes de chamar "violação" — page-actor no nascimento PJ parecia drift vs EMPRESA_NASCIMENTO §4, mas a DECISION-0075 promulgou Opção B (page-actor pendente é permitido); evitei falso-positivo. Correção material ao G10: cura-acidental de actor em GET não são 3 GETs, são ≥10 call-sites (ensureUserActor direto + helper getActiveActor em GETs financeiros). Próximo: fatia C1 (register→mundo vivo + identity/actor garantido, sem dinheiro), GO próprio.

- **2026-06-09 — criação.** Sessão dos gates marketplace actor-target. Aprendizado-chave: a raiz `capability marketplace = default company ⇏ autoridade sobre actor alvo` é universal no módulo (catalog/inventory/orders/execute_payments todas mapeiam a defaults de company). Erro corrigido na mesma sessão: afirmação "sem caller" sobre inventory/movements baseada em grep parcial — havia caller frontend vivo. Régua reforçada: §2.14 (esperar a varredura inteira) e §2.15 (auto-correção sem defensividade).
