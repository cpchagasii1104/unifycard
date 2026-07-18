# DECISION-0188 — MEMBERSHIP ACTOR-FIRST CONTRACT · membership de Groups converge de user-first para Actor-first: nova casa canônica futura `group_actor_memberships`, classes de elegibilidade fechadas (user·page·group-raiz), lifecycle histórico `active→left|removed`, invites/requests como casa de intenções explícitas, role sem poder, cap 3 civil-humano, correção das 6 superfícies de namespace, e estratégia material OBRIGATORIAMENTE estagiada (D9.2-A fundação dormente · D9.2-B cutover) — sem materializar nada

**Status:** DECIDIDA POR CLAYTON · PROMULGADA DOCS-ONLY · NÃO SELADA · AGUARDA UMA ÚNICA AUDITORIA YALA
**Data:** 2026-07-18
**Frente:** F-ORGANIZATIONAL-ACTOR-COMPOSITION · D9.2
**Base:** `rescue-structural @ 2ff31d6e3ae08fbe24c5c2afb69052c5be3456e0`
**Origem:** DECISION-0186 (composição organizacional) e DECISION-0187 (institutional binding) SELADAS; material D9.1 SELADO e DORMENTE; **GATE READ-ONLY D9.2** (2026-07-18, zero alteração, base `2ff31d6e3`) retornou **VEREDITO B** — substrato suficiente e backfill trivial (1 row, 100% determinística), mas abertos os itens institucionais: classes de elegibilidade, casa canônica, lifecycle, destino do role, invites/requests, owner-membership, semântica do cap 3, estratégia de flip e as 6 superfícies de namespace divergente. Clayton concede `GO DECISION-0188 · MEMBERSHIP ACTOR-FIRST CONTRACT · DOCS-ONLY`. **Este GO é exclusivamente docs-only** — não autoriza código, migration, dados, backfill, rotas, frontend, aplicação do D9.1, capabilities, grants, D9.3 ou Bank.

**Complementa (sem reescrever):** DECISION-0186 (D9 ordem; D5 membership≠autoridade) · DECISION-0187/D9.1 (binding ≠ membership; candidate keys) · DECISION-0131 (B3 mapper `actor_id` universal de composição — nunca re-key; B4 medir→backfill→flip→guard; B7 actorId declarado nunca é autoridade) · DECISION-0157 (freeze `actor_type`) · AUTHORITY_LAW Art.17 (role ≠ autoridade) · DESENHO 3C (D3 role adiada — resolvida aqui). **Nenhuma é editada.**

---

## PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios (união cautelosa):** ACTOR · IDENTIDADE · SOCIAL/GROUPS · AUTHORITY (fronteira — zero capability nova) · COMPANY/PJ · MULTI-TENANCY/RLS · NOMENCLATURA · LEGADO/COMPATIBILIDADE; AUDIENCE e VOTOS só como fronteira; FINANCEIRO fronteira negativa. Docs-only.

**Lidos integralmente de 1ª mão no GATE D9.2 desta sessão (base deste contrato):** 00_AGENT_PROTOCOL · CONSTITUICAO · LEIS_OPERACIONAIS · SSOT_REGISTRY (§5.1/§5.16) · 02_ACTORS_SSOT · 03_IDENTIDADE (§8 resolução tenant-scoped) · 07_NOMENCLATURA (§3.1/§4.38/§4.39) · 18_ONTOLOGY · LEI_DE_COERENCIA (§4.8/§4.9) · AUTHORITY_LAW · ACTOR_TRACEABILITY · DECISION-0131 ÍNTEGRA · 0157 · 0163 · 0186 · 0187 · material+selo D9.1 · DESENHO 3C · migrations `20260530190000`/`20260530430000`/`576000`/`578000` · código vivo (groups.service/routes/repository, votes, events-sprint76, actor-capabilities) · REMEDIATION_DT_LOG · dividatecnica.

**SSOTs:** Actor=`actors` · Identidade=`global_user_id` (resolução `(global_user_id, tenant_id)→user_id`) · Authority=`actor_capability_grants`+`canRepresentActor`+`actor_delegations` · Composição institucional=`group_institutional_bindings` (dormente) · Financeiro=`bank_ledger` (FORA). **NÃO-SSOT:** `group_members.role` · metadata · frontend · invites (processo de intenção, não estado de pertencimento).

**Precedência:** Constituição > Leis > SSOT Registry > Ontologia > DECISIONs seladas > cartório > código > runtime > conveniência.

**Declarado:** membership NÃO decide autoridade · role NÃO decide autoridade (Art.17) · `actionContext.actorId` NUNCA é identidade nem autoridade (0131 B7) · binding ≠ membership · representação ≠ pertencimento · residência/audience/conta NÃO provam membership · frontend NÃO cria verdade.

---

## D0 — FATOS FÍSICOS DO GATE D9.2 QUE ANCORAM A DECISION (1ª mão, read-only)

1. `group_members` (migration `20260530190000`): `user_id` FK users · `role` TEXT livre sem CHECK · **sem status/lifecycle** · **sem actor_id** · UNIQUE(tenant,group,user) · FKs simples · **sem RLS** · **DELETE físico** no writer (`removeMember`) — sem história. É a **única casa user-first** da família.
2. `group_invites` (migration `20260530430000`): **JÁ actor-first físico** (`invited_actor_id`/`invited_by_actor_id` FK actors) · status CHECK pending|accepted|rejected|expired|cancelled · ⚠ UNIQUE(group_id, invited_actor_id) **sem tenant e cobrindo todos os status** (rejeição bloqueia re-convite para sempre) · **sem RLS**. `group_vote_responses`: actor-first (voto já é Actor).
3. **Não existe casa de join-request** — request = a mesma `group_invites` com `invited_by = próprio candidato` (convenção implícita).
4. **Dados vivos:** 1 membership (owner, role='owner'); mapeamento user→user-actor **100% determinístico** (0 ambíguos, 0 órfãos, 0 tenant mismatch); 0 invites. Backfill = trivial.
5. **6 superfícies de namespace divergente vivas:** `/join` e `/leave` persistem `actionContext.actorId` (client-declared, namespace ACTOR) como `user_id` · `/invites/mine` e `/:id/request` usam `globalUserId‖id` contra colunas de ACTOR (request injeta global numa FK de actors; cap contado com global) · `acceptInvite` compara `invited_actor_id` com fallback triplo `userId‖globalUserId‖id` · `createInvite` compara actor×user (`members.userId === invitedActorId`). Só não corromperam porque o banco está ~vazio.
6. **Role É autoridade hoje:** `isUserAdminOrOwner` (role='admin' em `group_members`) concede poder de convite/gestão — violação viva do Art.17 (não-financeira). No banco: nenhum admin além do owner.
7. `acceptInvite`: ponte actor→user resolve `actors.user_id` (só user-actor vira membro DE FATO); invite accepted + addMember em **duas operações não transacionais**; **sem canRepresentActor**.
8. **Reader vivo fora do módulo:** events-sprint76 B3 (audiência 'group' na discovery) lê `group_members.user_id`. `actor-capabilities`/`recent-counterparts`: latentes (comentários). Votes: **não** lê membership.
9. Cap participação 3 (`getUserGroupCount` por user_id, só groups ativos; owner conta; pendentes não contam) · cap criação 1 (policy por owner_actor).
10. D9.1: `group_institutional_bindings` **NÃO aplicada** em dev; candidate keys `uq_groups_tenant_id_id`/`uq_actors_tenant_id_id` nascem com ela.

---

## D0-ESCOPO

Docs-only. Fecha o contrato institucional da membership Actor-first e a estratégia material estagiada. **NÃO materializa nada:** zero código · migration · schema · dado · backfill · rota · frontend · aplicação do D9.1 · vínculo real · capability · grant · D9.3 · Bank. Cada ato material (D9.2-A e D9.2-B) exige **GO próprio** após o selo desta DECISION.

---

## D1 — DEFINIÇÃO CANÔNICA

```text
Membership = fato histórico e governado de que um Actor pertence a um Group.
```

Membership **NÃO é**: ownership civil · responsabilidade civil · institutional binding · convite · pedido de entrada · role · authority · delegação · capability · audience · residência · conta · saldo.

**O membro persistido é sempre um Actor canônico.** A pessoa humana que representa um Actor institucional **não se torna membro em seu lugar** — a membership pertence ao Actor representado.

---

## D2 — CLASSES DE ACTOR ELEGÍVEIS (v1, fechadas)

**PERMITIDAS:**

- **A · `user`** — user-actor canônico; participação civil da pessoa humana; entrada própria resolvida **server-side** (nenhum Actor declarado pelo cliente é aceito como identidade).
- **B · `page`** — organização formal; exige coerência viva com Company/PJ; entrada, aceite e saída exigem **`canRepresentActor(page_actor_id)`** pelo principal humano.
- **C · `group`** — SOMENTE group-actor em modo **instituição informal raiz** (sem parent institucional ativo; não pode ser Group interno do D9.1); entrada, aceite e saída exigem **`canRepresentActor(group_actor_id)`**.

**PROIBIDOS:** `channel` · `system` · valores legados · `actor_organizational` físico · Actor cross-tenant · Actor inexistente · Actor sem coerência estrutural · novo actor_type segmental.

**PROIBIDOS TAMBÉM (anti-duplicação de verdade):** Group membro de si mesmo · instituição-parent como membro automático do Group interno · Group interno como membro do parent · parent↔filho do D9.1 criando membership recíproca para duplicar a composição (composição = binding, nunca membership) · humano representante E Actor representado criando **duas** memberships para o mesmo pertencimento institucional.

---

## D3 — CASA CANÔNICA FUTURA: `group_actor_memberships`

Nova casa canônica futura **`group_actor_memberships`** — shape conceitual: tenant-scoped · `group_id` · `member_actor_id` · lifecycle histórico · autoria de entrada e saída · idempotência · RLS · writer único.

**REJEITADAS como casa futura:** evolução permanente de `group_members.user_id` · tabela polimórfica `member_type + member_id` (identidade paralela ao Actor) · `actor_relationships` (aresta social ≠ membership) · `group_institutional_bindings` (composição ≠ membership) · grants · delegações · metadata · category · purpose · role · frontend.

**Justificativa vinculante:** `group_members` não possui lifecycle, história, RLS, coerência tenant composta nem identidade Actor-first — evoluí-la integralmente seria um **rebuild in-place sob writers vivos**. A nova casa nasce correta; a antiga é migrada e congelada de forma governada.

---

## D4 — DESTINO DE `group_members`

- Permanece **fonte legada até o cutover**; NÃO recebe coluna nova como segunda verdade permanente; **sem dual-write indefinido**.
- Após o flip: **deixa de ser SSOT** → casa congelada/tombstone ou projeção estritamente read-only; remoção física = frente posterior própria; `user_id` **não** permanece como identidade concorrente.
- Durante a transição: comparação legado×nova é **PROVA, não fallback**; mismatch **falha fechado**; PROIBIDO `user_id OR actor_id`; PROIBIDO leitura "tenta uma casa, depois a outra".

---

## D5 — IDENTIDADE PERSISTIDA

Identidade única: **`member_actor_id → actors.id`**, com **coerência composta** (membership + Group + Actor membro + autores + tenant).

`user_id` e `global_user_id` servem **somente** para resolver o user-actor canônico. **NUNCA:** persistidos na nova casa como identidade de membership · comparados diretamente com `actor_id` · usados como fallback · aceitos do frontend como Actor · usados em coluna de outro namespace. O mapper da DECISION-0131 (B3) **resolve** identidade — **não re-keya o Core**.

---

## D6 — CARDINALIDADE

- Group tem N membros · Actor pertence a N Groups.
- Máx **1 membership ATIVA** por `tenant_id + group_id + member_actor_id` (unicidade ativa).
- Históricas plurais coexistem · membership **nunca é inferida** · reentrada = **NOVA linha** · linha terminal **nunca é reativada** · nenhuma instituição adquire membros por herança do D9.1.

---

## D7 — LIFECYCLE V1

```text
active → left | removed        (sem transições de retorno)
```

- `active` = pertencimento vigente · `left` = saída voluntária · `removed` = encerramento administrativo governado.
- Estados terminais: preservam história · não reativam · não são apagados · reentrada só por nova linha. **DELETE PROIBIDO.**
- **FORA do v1:** `banned` · `suspended` · `archived` — banimento/suspensão são restrições DISTINTAS do fato histórico de membership e exigem decisão própria futura. Group arquivado **não apaga** memberships; efeito operacional = policy/read-model.

---

## D8 — OWNER MEMBERSHIP (invariante)

- O humano de `groups.owner_actor_id` **deve possuir membership ativa** no próprio Group.
- A membership do owner **não substitui** ownership civil; ownership vive exclusivamente em `groups.owner_actor_id`; role **não cria** ownership.
- Owner **não pode sair nem ser removido** enquanto for owner.
- Transferência de ownership: primeiro a casa civil canônica, depois reconciliação transacional de memberships — **FORA do material D9.2**, salvo compatibilidade estritamente necessária e já normatizada.
- A membership do owner **conta** para o cap humano vigente.

---

## D9 — INVITES E REQUESTS (casa de intenções explícitas)

`group_invites` permanece a casa Actor-first do processo de entrada, **evoluída para casa explícita de intenções**. Contrato futuro exigido:

- `tenant_id` · Group · Actor candidato · Actor iniciador · **`intent_kind` fechado: `invite` | `request`** · status fechado `pending|accepted|rejected|expired|cancelled` · autoria · timestamps · expiração · idempotência · RLS · coerência tenant.
- **PROIBIDA** a convenção implícita "request = invited_by igual ao próprio convidado" como única fonte semântica — a intenção **declara** sua direção.
- **Cardinalidade:** máx **1 intenção PENDENTE** por `tenant + group + candidate_actor` · históricos terminais coexistem · **rejeição/expiração NÃO bloqueia novo convite para sempre** (corrige o UNIQUE vivo) · pending invite e pending request para o mesmo par **não coexistem**.
- **Aceite/aprovação:** termina a intenção **E** cria a membership **NA MESMA TRANSAÇÃO** · idempotente · nunca invite accepted sem membership · nunca membership (via convite/request) sem intenção terminalizada.

---

## D10 — AUTORIDADE NA ENTRADA E GESTÃO (sem capability nova)

- **user-actor:** self join/accept exige que o principal resolva server-side para o MESMO user-actor; `actionContext.actorId` nunca é identidade nem authority.
- **page/group-raiz:** o principal humano prova **`canRepresentActor(candidate_actor_id)`**; o representante **não vira membro** pessoalmente; a membership pertence ao Actor representado.
- **Convidar, aprovar request, remover membro:** exige **`canRepresentActor(group_actor_id)`** (o group-actor do Group) — não role, não capability nova, não grant novo; apenas authority já existente.
- **D9.2 não nomeia nem concede capabilities organizacionais** — D9.3 permanece a frente futura de authority organizacional.

---

## D11 — ROLE

- `group_members.role` é **legado**: não é SSOT · não concede authority · não substitui owner · não cria grants · não decide conta, voto financeiro ou representação.
- A nova casa **não cria role administrativa canônica** nesta etapa. No máximo: classificação neutra `member`; owner **derivado** de `groups.owner_actor_id` (nunca persistido como fonte soberana).
- Valores legados `owner|admin|member`: preservados **só** para auditoria/projeção temporária durante o cutover. **O `admin` legado perde qualquer efeito autorizativo no flip** (`isUserAdminOrOwner` deixa de conceder poder). Banco vivo: nenhum admin além do owner → **não há autoridade real a converter em grant** nesta etapa.
- Roles organizacionais governadas = D9.3 ou decisão posterior própria.

---

## D12 — CAP DE PARTICIPAÇÃO 3 (política civil humana)

O cap 3 é **política CIVIL da pessoa humana**. Aplica-se somente a: memberships **ativas** de **user-actors** (incluindo a do owner) em Groups **ativos**.

**Não contam:** memberships históricas · convites pendentes · requests pendentes · Groups arquivados · **page-actors** · **group-actors institucionais** · Actors que a pessoa apenas **representa**.

Membership institucional: **não consome o cap pessoal do representante** · **não recebe cap institucional novo nesta DECISION** · sujeita a futura política própria, se necessária.

**PROIBIDA** contagem simultânea por `user_id` e `actor_id`; a resolução do cap humano parte do **user-actor canônico**, sem misturar namespaces.

---

## D13 — SUPERFÍCIES DE NAMESPACE (as 6, nominais, a convergir no cutover)

```text
1. POST /groups/:id/join          (actionContext.actorId persistido como user_id)
2. POST /groups/:id/leave         (idem)
3. GET  /groups/invites/mine      (globalUserId‖id contra coluna de ACTOR)
4. POST /groups/:id/request       (globalUserId em FK de actors; cap com global)
5. acceptInvite                   (fallback triplo userId‖globalUserId‖id ×  actor)
6. createInvite / comparações     (actor × user_id em getMembers)
```

**Fixado:** principal autenticado resolvido server-side · `global_user_id` resolve identidade e **nunca** é persistido como Actor · `user_id` legado resolve user-actor · `actor_id` é a identidade canônica da nova membership · `actionContext.actorId` **nunca** é identidade declarativa nem authority · **nenhum fallback triplo** · **nenhuma comparação Actor×User** · **nenhum frontend escolhe namespace persistido**.

O reader vivo de **audience em events (B3)** que consulta `group_members.user_id` **migra no mesmo cutover** para preservar o comportamento atual — **compatibilidade de reader, NÃO abertura de audience D9.4**.

---

## D14 — COMPATIBILIDADE COM D9.1 (ratificada)

Binding não cria membership · instituição parent não vira membro · membros do parent ≠ membros do filho (e vice-versa) · representante do parent não vira membro · membership não altera a authority dual do D9.1 · membership não cria/retira binding · Group interno não usa membership para fingir raiz · **a migration futura D9.2 poderá depender das candidate keys criadas pela migration D9.1** (`uq_groups_tenant_id_id`/`uq_actors_tenant_id_id`) — dependência que **NÃO autoriza aplicar o D9.1 em dev neste ato**.

---

## D15 — RLS E INTEGRIDADE FUTURA

Novas casas exigem: `tenant_id NOT NULL` · FKs compostas · unicidade ativa tenant-scoped · RLS **ENABLE+FORCE** · policies fechadas · writer único · autoria server-side · idempotência · locks concorrentes · lifecycle histórico · app **sem DML direto** · cross-tenant fail-closed.

A ausência de RLS em `groups` e nas tabelas legadas permanece **dívida aberta** (`DT-GROUPS-TABLE-NO-RLS` e família); o material D9.2 **não pode ampliar o envelope** para remediar genericamente as tabelas antigas.

---

## D16 — ESTRATÉGIA MATERIAL OBRIGATORIAMENTE ESTAGIADA

Uma única DECISION; **DOIS atos soberanos materiais**:

### D9.2-A — FUNDAÇÃO ACTOR-FIRST DORMENTE
**PODE:** criar `group_actor_memberships` (lifecycle/RLS/ACL) · writers internos **sem callers de produto** · evolução estrutural de `group_invites` para `intent_kind` explícito · guards · mutations · testes · medição e prova determinística do backfill · read-model de shadow validation interno.
**NÃO PODE:** alterar rotas vivas · alterar readers vivos · backfill em dev · flip · escrever nas duas casas simultaneamente · congelar `group_members` · alterar cap · ativar membership institucional.
**Após material, Yala e selo: STOP.**

### D9.2-B — CUTOVER ACTOR-FIRST (somente após novo Gate/GO específico)
**PODE (governado):** aplicar as migrations necessárias no ambiente autorizado · backfill determinístico · validação de igualdade · **flip atômico** de writers · flip dos readers obrigatórios · correção das 6 superfícies de namespace · migração do reader events B3 · **retirada da authority por role** · ativação da regra do cap humano · congelamento da casa legada.
**NÃO PERMITE:** fallback · dual-write prolongado · dual-read indefinido · mismatch tolerado · frontend escolhendo casa · remoção física imediata da tabela antiga.

**Fundação e cutover exigem GOs materiais SEPARADOS.**

---

## D17 — GUARDS FUTUROS (cobertura mínima exigida)

segunda casa Actor-first · `actor_id` paralelo permanente em `group_members` · dual-write · fallback user OR actor · `global_user_id` persistido · `actionContext` como identidade · comparação cross-namespace · role como authority · membership criando grant · membership alterando `canRepresentActor` · membership inferida por binding/metadata/category/address/audience · DELETE · reativação de linha terminal · dois registros ativos · Actor proibido · cross-tenant · invite accepted sem membership · membership sem intenção terminalizada · self-invite como semântica implícita · unique de invites cobrindo históricos para sempre · cap contado duas vezes · reader vivo user-first após flip · D9.2 tocando Bank · D9.2 abrindo D9.3/D9.4.

---

## D18 — FRONTEIRAS (fora e trancados)

Aplicação de D9.1 em dev · vínculo institucional real · capabilities · grants · roles governadas · D9.3 · nova audience · D9.4 · endereço · D9.5 · assembleias · projetos · procurement · financeiro · D9.8 · módulo organization · frontend rico · remoção física de `group_members` · alterações no Bank.

**Bank:** byte-intacto · zero conta · zero transaction · zero ledger · zero split · **Δbank=0**.

---

## EXPRESSAMENTE NÃO AUTORIZADO POR ESTA DECISION

Material D9.2-A e D9.2-B (exigem GOs próprios pós-selo) · código · migration · schema/dados · backfill · rotas · frontend · aplicação do D9.1 · capability/grant · D9.3/D9.4+ · Bank · alteração das DECISIONs 0157/0186/0187 e do material D9.1 · auditoria/selo em nome da Yala.

---

## CONSEQUÊNCIAS NO CARTÓRIO

1. `REMEDIATION_DT_LOG.md`: entrada de promulgação (registra também, sem corrigir, os fatos vivos do GATE: 6 superfícies de namespace divergente · role-como-autoridade `isUserAdminOrOwner` · DELETE físico de membership · UNIQUE de invites bloqueando re-convite — todos convergem no cutover D9.2-B).
2. `dividatecnica.md`: espelho resumido (changelog).
3. Após o commit docs-only: **STOP** — arco (GATE D9.2 + DECISION-0188 + cartório) segue para UMA única auditoria Yala. O selo NÃO abre automaticamente: fundação D9.2-A · cutover D9.2-B · D9.3 · audience · Bank.
