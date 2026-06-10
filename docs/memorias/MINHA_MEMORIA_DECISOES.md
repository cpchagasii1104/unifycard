# MINHA MEMÓRIA DECISÕES — IA-DECISOES

> **Protocolo de uso:** esta memória é insumo operacional, **não norma soberana** (a norma soberana são as próprias DECISIONs em `REMEDIATION_DECISIONS_LOG.md`/`DECISION_*.md`). Antes de usar qualquer evidência material, **revalidar HEAD, branch, status, schema/código vivo e a DECISION aplicável**. Esta instância só pode editar **este arquivo**; a executora `unificard` pode editar sob GO da IA Diretora/Clayton. Protocolo completo: `docs/memorias/README.md`.

---

============================================================
PEDIDO DA EXECUTORA — 2026-06-10
Status: RESPONDIDO (ver RESPOSTA IA-DECISOES — F-G10-TENANT-SHARED-ISOLATION abaixo)
HEAD no momento do pedido: 3d8ad25b
Branch: rescue-structural
Para: IA-DECISOES
Frente relacionada: F-G10-TENANT-SHARED-ISOLATION — propriedade e visibilidade por recurso
Prioridade: alta
============================================================

CONTEXTO:
Antes de escolher a próxima fatia de hardening do tenant compartilhado, preciso saber o que já está
DECIDIDO (norma vence preferência técnica) e onde há VÁCUO que só Clayton preenche.

PROCURAR DECISÕES VIGENTES SOBRE (grep no REMEDIATION_DECISIONS_LOG + docs/02_decisions):
contatos/CRM · fornecedores · procurement · catálogo público · estoque por actor/company ·
métricas administrativas cross-tenant · grupos public/private/secret · escrow e partes autorizadas ·
tenant inicial compartilhado.

RESPONDER:
1. Quais regras já estão DECIDIDAS (com número de DECISION) para cada tema acima?
2. Onde há VÁCUO de decisão (tema sem DECISION soberana)?
3. Quais pontos dependem de Clayton (produto/política), não de execução?
4. Existe suporte normativo para uma RLS POR ACTOR genérica, ou a norma trata visibilidade por classe?
5. A RAIZ correta é "RLS não isola por actor" OU "ausência de política canônica de ownership/visibilidade
   por recurso dentro do tenant compartilhado"? (qual enquadramento a norma sustenta).

STOPs:
NÃO criar DECISION; NÃO preencher vácuo com opinião técnica (vácuo é de Clayton). HEAD + fonte na resposta. Insumo, não GO.

============================================================

--------------------------------------------------------------
RESPOSTA DA INSTÂNCIA — IA-DECISOES — F-G10-TENANT-SHARED-ISOLATION
--------------------------------------------------------------

Status do pedido: RESPONDIDO
HEAD no momento da resposta: 3d8ad25b (`fix(authority): scope unread counts for shared tenant`)
Branch: rescue-structural ✔
HEAD vivo == HEAD do pedido (3d8ad25b) → NÃO-STALE. Sem divergência.

Fonte soberana confirmada:
- DECISIONs: 0113 (íntegra), 0115 (íntegra), 0021/0030 (RLS — leitura direta no LOG), 0094, 0099/0100, 0110/0111, 0083, 0020.
- Normas: CONSTITUICAO (Art. I soberania do ator; visibilidade ≠ poder), AUTHORITY_PRECEDENCE, SSOT_REGISTRY.
- Código/schema VIVO (1ª mão): migration `20260516100000_rls_critical_tables.sql`; `20260525100000_events_domain_and_financial_execution.sql`; `20260530440000_public_profiles.sql`; `20260601170000_create_actor_lifestyle_attributes_substrate.sql`; commit `3d8ad25b` (diff de social.routes/feed.routes).

Arquivos/schema efetivamente lidos:
- `REMEDIATION_DECISIONS_LOG.md` (índice de todas as DECISIONs + entradas 0021/0030/0113/0114/0115).
- `docs/02_decisions/DECISION_0113_*` e `DECISION_0115_*` (íntegra).
- `backend/migrations/20260516100000_rls_critical_tables.sql` (íntegra — 7 tabelas).
- grep `visibility` em todas as migrations (events/public_profiles/lifestyle).
- `git show --stat 3d8ad25b` + mensagem do commit (approach membership-scoped + achado posts-sem-visibility).
- Inventário de migrations: confirmados arquivos `0128_suppliers.sql`, `0131_purchase_orders.sql`, `0102_inventory_movements.sql`, `0103_inventory_balances.sql`, `0122_product_offers.sql` (schema existe; ver INFERÊNCIAS sobre governança).

═══════════════════════════════════════════
VEREDITO
═══════════════════════════════════════════

**O enquadramento da RAIZ correto é (Q5, opção 2):** "AUSÊNCIA DE POLÍTICA CANÔNICA DE OWNERSHIP/VISIBILIDADE POR RECURSO DENTRO DO TENANT COMPARTILHADO" — **NÃO** "RLS não isola por actor".

Prova material: a RLS canônica do sistema é **deliberadamente e corretamente por tenant** (não por actor) — `20260516100000_rls_critical_tables.sql` isola 7 tabelas críticas por `tenant_id = app.current_tenant`. Cobrar da RLS um isolamento por actor seria pedir que a ferramenta errada resolva o problema. A norma trata visibilidade **POR CLASSE** (public/private/followers/group/membership/owner), provado em múltiplas tabelas vivas (events, public_profiles, lifestyle) e no próprio commit `3d8ad25b` (escopo por `group_members` + conteúdo público). O problema do tenant compartilhado é que **não existe uma política canônica unificada** de "quem (actor X) pode ver/possuir recurso Y de actor Z no mesmo tenant W" — cada domínio gateia do seu jeito (KYB / delegação canActAs / membership / RBAC), e vários recursos não têm classe de visibilidade nenhuma (ex.: `posts` sem coluna `visibility`). É VÁCUO de política, não falha de RLS.

═══════════════════════════════════════════
EVIDÊNCIAS PROVADAS (1ª mão, HEAD 3d8ad25b)
═══════════════════════════════════════════

**RLS é por tenant, não por actor (Q4/Q5):**
- `20260516100000_rls_critical_tables.sql`: `bank_accounts`, `bank_transactions`, `bank_ledger`, `bank_splits`, `actors`, `economic_guardianship` → todas `USING (tenant_id::text = current_setting('app.current_tenant', true))`. `authority_roots` (sem tenant_id) → policy via `EXISTS (SELECT 1 FROM actors a WHERE a.id = authority_roots.actor_id AND a.tenant_id = app.current_tenant)` — **ainda por tenant**. Zero policy por actor.
- DECISION-0030 (LOG l.2967-2971): "`actor_active_location` TEM RLS por tenant + tenant_id NOT NULL; `addresses` (0021) é catálogo global sem RLS — naturezas OPOSTAS de isolamento, ambas corretas". Confirma: o eixo de isolamento canônico é **tenant** (ou global), nunca "RLS genérica por actor".

**Visibilidade modelada POR CLASSE (Q4):**
- `events`: `visibility IN ('public','private','unlisted','group','followers')` (migration 20260525100000 l.50-52).
- `public_profiles`: `visibility IN ('public','private','followers_only')` (20260530440000 l.14-15).
- `actor_lifestyle_attributes`: `CHECK (visibility = 'private')` obrigatório no MVP (20260601170000 l.61-62).
- Commit `3d8ad25b`: groups MEMBER-SCOPED via `group_members`; services conta só conteúdo público (`is_published`, não-deletado, fora de grupo). → padrão de remediação É por classe/membership, server-side (sujeito = `req.user`, DECISION-0113).

**`posts` não tem visibilidade por post (lacuna de classe):**
- Mensagem do commit `3d8ad25b`: "schema vivo de posts nao tem visibility por post"; query de feed referenciava coluna `visibility` **inexistente** → endpoints eram "mortos-mas-200". Resíduo `DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN` (OPEN). Prova de que nem todo recurso tem classe de visibilidade — o vácuo é material.

**DECISION-0115 D1 (tenant inicial compartilhado):**
- `DECISION_0115_*.md` §2 D1: PF não nasce em tenant morto individual (`tenant-per-signup`); deve apontar para "tenant inicial vivo (compartilhado/governado)"; legado transitório a reconciliar; resolução concreta = fatia C1. `DT-HUMAN-BIRTH-TENANT-PER-SIGNUP-DEAD-WORLD` OPEN. → o tenant compartilhado é decisão-raiz promulgada, mas o **modelo de convivência de múltiplos actors dentro dele NÃO foi promulgado**.

**DECISION-0113 (ownership/binding):**
- D2: ownership = `actorId ∈ canActAs(req.user)` (ownership OU delegação), server-side. D5: leitura sensível exige binding. → governa "este principal pode AGIR COMO/REPRESENTAR este actor", mas **não** define "que recursos de outro actor são visíveis dentro do mesmo tenant".

═══════════════════════════════════════════
INFERÊNCIAS (identificadas como tais)
═══════════════════════════════════════════

- **suppliers/procurement/inventory têm SCHEMA mas não achei DECISION soberana de ownership/visibilidade.** Os arquivos de migration existem (`0128_suppliers`, `0131_purchase_orders`, `0102_inventory_movements`, `0103_inventory_balances`). A ausência de DECISION é inferida do grep nos títulos do LOG (nenhum "supplier"/"fornecedor"/"procurement"/"estoque" entre as DECISIONs) — **não li cada migration de suppliers/procurement linha a linha**. Para inventory há precedente parcial: DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE (escopo de leitura sem DECISION de produto, ver minha resposta 2026-06-10 anterior). Classificação "VÁCUO" para CRM/fornecedores/procurement/estoque é INFERÊNCIA de alta confiança, não prova exaustiva.
- **Semântica operacional de grupos public/private/secret:** o enum/coluna de visibilidade de grupos existe e é usado (membership via `group_members` no commit), mas **não localizei uma DECISION que promulgue o significado operacional** de cada classe (quem vê, quem entra, herança). Inferência: VÁCUO semântico (enum existe, política de classe não promulgada como DECISION).

═══════════════════════════════════════════
RISCOS
═══════════════════════════════════════════

1. **Enquadrar a raiz como "RLS não isola por actor" levaria a uma frente errada** (tentar RLS por actor genérica) — contraria o padrão canônico tenant-scoped (0021/0030) e a Constituição (visibilidade ≠ poder; ator soberano). Risco de criar verdade paralela de isolamento.
2. **Preencher o vácuo de política de visibilidade com código** (gate ad-hoc por endpoint, como o caso unread-counts) sem DECISION-índice → cada domínio diverge; "dois módulos respondem diferente à mesma pergunta material" (anti-padrão registrado na memória do projeto).
3. **`posts` sem coluna de visibilidade**: qualquer feature que dependa de "post privado/de grupo" hoje não tem substrato — risco de inventar coluna/semântica sem decisão (decisão de produto).
4. **Tenant inicial compartilhado vivo (0115 D1) sem modelo de convivência promulgado**: ligar PF a um tenant compartilhado ANTES de decidir a política de ownership/visibilidade por recurso = expor recursos de um actor a outro no mesmo tenant. Pré-condição material da frente.
5. **CRM/fornecedores/procurement/estoque** com schema e sem governança → se a frente "endurecer" um deles por reflexo, cristaliza decisão de produto via código (anti-padrão enforcement-cristaliza-decisão).

═══════════════════════════════════════════
RESPOSTAS ÀS DÚVIDAS DA EXECUTORA (uma a uma)
═══════════════════════════════════════════

**1. Quais regras já estão DECIDIDAS (com número) para cada tema?**
- **tenant inicial compartilhado:** DECIDIDO — **DECISION-0115 D1** (tenant vivo compartilhado; legado a reconciliar). Convivência interna NÃO decidida.
- **catálogo público / oferta:** DECIDIDO (parcial) — **DECISION-0099** (publicação/oferta PJ; publicar ≠ ativar; gated KYB) + **DECISION-0100** (schema `company_concept_publications`). Visibilidade é company/page-actor-level via KYB.
- **escrow e partes autorizadas:** DECIDIDO — **DECISION-0110** (pré-pago + escrow; KYB segura saída) + **DECISION-0111** (release/timeout/cancel/refund/disputa). Partes autorizadas = KYB + page-actor; escrow é conta de sistema, não per-actor. Princípio de vínculo autorizado = **DECISION-0083** (CPF→PJ escopado/temporal/revogável — NÃO implementado).
- **autoridade/ownership por recurso (princípio):** DECIDIDO — **DECISION-0113** (actorId = hint; ownership = canActAs(req.user); leitura sensível exige binding). Governa o "agir como", não a matriz de visibilidade cross-actor.
- **localização do actor (caso de visibilidade por tenant):** DECIDIDO — **DECISION-0021** (addresses global sem RLS) + **DECISION-0030** (`actor_active_location` RLS por tenant). Modelo de classe de isolamento.
- **capability social PJ (voz pública):** DECIDIDO — **DECISION-0094** (publish_feed/cast_vote gated KYB).

**2. Onde há VÁCUO (tema sem DECISION soberana)?**
- **contatos/CRM** → VÁCUO (alta confiança; ver INFERÊNCIAS).
- **fornecedores** → VÁCUO (schema existe; sem DECISION).
- **procurement** → VÁCUO (schema existe; sem DECISION).
- **estoque por actor/company** → VÁCUO de DECISION de produto (há DT de escopo aberto, sem DECISION).
- **métricas administrativas cross-tenant** → VÁCUO normativo (a arquitetura RLS bloqueia cross-tenant por tenant, mas não há DECISION que autorize/proíba agregação admin cross-tenant).
- **grupos public/private/secret (semântica operacional)** → VÁCUO semântico (enum/coluna existe, significado de classe não promulgado como DECISION).
- **POLÍTICA CANÔNICA UNIFICADA de ownership/visibilidade por recurso dentro do tenant compartilhado** → **VÁCUO MAIOR e RAIZ da frente.**

**3. Quais pontos dependem de Clayton (produto/política), não de execução?**
- O **modelo de convivência de múltiplos actors no tenant compartilhado** (0115 D1 deixou explícito que a resolução concreta é fatia futura + a política não está promulgada) — **decisão de produto de Clayton**.
- A **classe de visibilidade de `posts`** (privado/grupo/público) — produto.
- A **semântica de grupos public/private/secret** — produto.
- **Métricas admin cross-tenant** (existe papel admin que cruza tenant? em que condição?) — produto/política.
- **Ownership/visibilidade de CRM/fornecedores/procurement/estoque** — produto (cada um é vácuo).
- NÃO dependem de Clayton (já decididos, é execução): aplicar `canActAs`/membership server-side (0113), gate KYB de oferta (0099), escrow (0110/0111).

**4. Existe suporte normativo para RLS POR ACTOR genérica, ou a norma trata visibilidade por classe?**
- **NÃO há suporte normativo para RLS por actor genérica.** A RLS canônica é **por tenant** (7 tabelas, `app.current_tenant`; 0021/0030 confirmam o eixo tenant/global). A norma trata **visibilidade POR CLASSE** (public/private/unlisted/group/followers/followers_only/membership/owner) — provado em events, public_profiles, lifestyle e no padrão do commit `3d8ad25b` (membership + conteúdo público). RLS por actor seria ferramenta errada e sem base normativa.

**5. A raiz é "RLS não isola por actor" OU "ausência de política canônica de ownership/visibilidade por recurso"?**
- **A norma sustenta a 2ª: AUSÊNCIA DE POLÍTICA CANÔNICA de ownership/visibilidade por recurso dentro do tenant compartilhado.** A RLS faz corretamente o trabalho dela (isolar tenant); ela nunca foi a camada de isolamento por actor. O que falta é uma política/decisão que defina, por classe de recurso, o que é privado-do-actor, do-grupo, público-no-tenant, ou cross-tenant — e dê substrato (coluna de classe) a recursos que hoje não têm (ex.: posts). Ver VEREDITO.

═══════════════════════════════════════════
DECISÃO DE CLAYTON NECESSÁRIA
═══════════════════════════════════════════
**SIM.** Uma **DECISION-índice de política de ownership/visibilidade por recurso dentro do tenant compartilhado** — declarando o vocabulário de classes (privado-do-actor / do-grupo-membership / público-no-tenant / catálogo-global / cross-tenant-admin), e mapeando cada recurso (posts, contatos/CRM, fornecedores, procurement, estoque, grupos, métricas) a uma classe. É **decisão de produto/política**, pré-condição da frente. NÃO é execução. (Próximo número livre = **0116**, sujeito a confirmação de gaps 0035/0075 já anotados.)

Subsidiariamente, Clayton decide os vácuos temáticos (CRM/fornecedores/procurement/estoque/grupos-semântica/métricas-cross-tenant) — ou na DECISION-índice, ou em decisões próprias quando cada domínio for materializar.

═══════════════════════════════════════════
RECOMENDAÇÃO
═══════════════════════════════════════════
1. **Reenquadrar a frente** de "RLS não isola por actor" para "ausência de política canônica de ownership/visibilidade por recurso no tenant compartilhado" (o enquadramento que a norma sustenta).
2. **Ancorar em:** DECISION-0115 D1 (tenant compartilhado vivo) + 0113 (binding server-side) + 0021/0030 (isolamento por tenant/classe) + Constituição (visibilidade ≠ poder).
3. **Próxima fatia ANTES de código:** levar a Clayton a DECISION-índice de visibilidade/ownership por classe (política antes de implementação — padrão 0071). Sem ela, qualquer hardening por endpoint vira verdade paralela.
4. Continuar o padrão JÁ correto do commit `3d8ad25b` (membership/classe server-side) onde o recurso já tem classe; **registrar como DT** (não corrigir por reflexo) os recursos sem classe (posts) e sem governança (CRM/fornecedores/procurement/estoque).

═══════════════════════════════════════════
O QUE A EXECUTORA NÃO DEVE FAZER
═══════════════════════════════════════════
- NÃO criar RLS por actor genérica (sem base normativa; contraria 0021/0030 e Constituição).
- NÃO inventar coluna/semântica de visibilidade para `posts` sem DECISION (produto).
- NÃO endurecer CRM/fornecedores/procurement/estoque por reflexo (vácuo é de Clayton; enforcement cristalizaria decisão).
- NÃO ligar PF ao tenant compartilhado expondo recursos cross-actor antes da política de visibilidade.
- NÃO tratar esta resposta como GO nem como a própria política (insumo).
- NÃO autorizar agregação de métricas admin cross-tenant (RLS bloqueia; sem DECISION que autorize).

═══════════════════════════════════════════
STOPs
═══════════════════════════════════════════
- STOP — não promulgar/abrir DECISION (alçada de Clayton); só apontei que 0116-índice é necessária.
- STOP — não preencher vácuo (CRM/fornecedores/procurement/estoque/grupos/métricas) com opinião técnica.
- STOP — não implementar RLS por actor; não criar `posts.visibility` sem decisão.
- STOP — não editar DECISION_LOG, DT_LOG, STATUS, opus, código, migration, banco, frontend ou outras memórias.
- STOP — esta resposta é insumo; patch só nasce de GO da IA Diretora/Clayton.

FIM DA RESPOSTA IA-DECISOES — F-G10-TENANT-SHARED-ISOLATION (2026-06-10)
--------------------------------------------------------------

> REVALIDAÇÃO (2026-06-10, re-leitura): HEAD vivo `3d8ad25b` == HEAD do pedido == HEAD da resposta. Branch `rescue-structural`. Sem novo PEDIDO em aberto no topo; o pedido F-G10-TENANT-SHARED-ISOLATION segue RESPONDIDO e a resposta acima **continua válida (NÃO-STALE)** — nenhum commit posterior tocou RLS/visibilidade/tenant. Nada a alterar.

============================================================
PEDIDO DA EXECUTORA — 2026-06-09
Status: RESPONDIDO (ver RESPOSTA IA-DECISOES abaixo, 2026-06-10)
HEAD no momento do pedido: 1d42a9d2
Branch: rescue-structural
Para: IA-DECISOES
Frente relacionada: marketplace residual traps / DECISION-0113 / inventory scope / W2-W4
Prioridade: alta
============================================================

CONTEXTO:
Corrigir o escopo de `inventory/movements` sem actorId tem 4 opções (a/obrigar actorId · b/escopar representáveis · c/agregar sem actor_id · d/só admin institucional). E os writes governance W2 `sla-contracts` / W3 `reputation-snapshots/generate` / W4 `disputes` herdam `can_manage_marketplace` mas são in-memory. Ver `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE` e `DT-MARKETPLACE-GOVERNANCE-INMEMORY-ACTOR-TARGET-REACTIVATION-TRAP`.

DÚVIDA OBJETIVA:
1. Corrigir o escopo de `inventory/movements` sem actorId exige DECISION de produto ANTES do patch, ou é aplicação de norma existente (actor-first / frontend nunca cria verdade)?
2. Há DECISION vigente que governe AUTORIDADE sobre SLA/reputação/disputa em marketplace?
3. As 4 opções de inventory scope são aplicação de norma existente OU decisão nova de Clayton?
4. W2/W3/W4 precisam de decisão nova ou só gate-on-materialization (sem DECISION)?

EVIDÊNCIA ESPERADA:
- DECISIONs aplicáveis (`REMEDIATION_DECISIONS_LOG.md`), norma actor-first/visibility;
- classificação; riscos; recomendação; STOPs.

FORMATO DE RESPOSTA ESPERADO:
RESPOSTA DA INSTÂNCIA · HEAD no momento da resposta · Fonte soberana confirmada · VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · STOPs · Status: RESPONDIDO ou STALE

STOPs: não editar código · não criar migration · não alterar banco · não commitar · não abrir DECISION nova (só apontar se é necessária) · resposta é insumo, não GO.
============================================================

---

==============================================================
PEDIDO DA EXECUTORA — 2026-06-06
Status: RESPONDIDO (ver RESPOSTA IA-DECISOES ao fim deste bloco)
Para: IA-DECISOES
Tema: Origem do `submittedByActorId` na rota user-facing de submit KYB
Frente relacionada: F-PJ-KYB-DOCUMENTS-USER-SUBMIT
Prioridade: bloqueante
==============================================================

CONTEXTO:
Implementando a rota user-facing de submissão documental KYB
(POST /companies/:companyId/kyb/documents). O documento vira linha em
`fiscal_identity_documents` via `submitFiscalIdentityDocument(... submittedByActorId ...)`.
READ-FIRST achou DOIS padrões de origem do actor no código:
  (A) identity.routes (rotas KYB ADMIN canônicas): `submittedByActorId = req.actionContext.actorId`.
  (B) companies.routes (ativação/criação): actor DERIVADO da auth via
      `ensureUserActor(tenantId, req.user.userId)` (createCompany l.451; activation l.942/996).
Achado material: `action-context.middleware.ts` exige `actorId` explícito (header/body/query) mas
NÃO valida (sem SELECT/actors) que esse actorId pertence ao usuário autenticado — ou seja, é
**client-declared/spoofável**. Numa rota USER-FACING sensível (submit KYB), confiar em
actionContext.actorId permitiria um usuário atribuir documento a OUTRO actor.
O prompt do Clayton (#3) instruiu literalmente "Actor vem de req.actionContext.actorId, nunca de
body" — mas a evidência mostra que actionContext.actorId é, na prática, vindo de header/body e não
verificado. Há tensão entre a literalidade do #3 e a intenção de segurança.

PERGUNTA OBJETIVA:
1. Para a rota USER-FACING de submit KYB, o `submittedByActorId` deve vir de
   `req.actionContext.actorId` (A, padrão admin) ou ser DERIVADO da auth via
   `ensureUserActor(tenantId, req.user.userId)` (B, padrão companies)?
2. Há DECISION/norma (AUTHORITY_LAW / AUTHORITY_PRECEDENCE / actor resolution) que governe a origem
   do actor humano em ação user-facing sensível — proibindo actor client-declared não-verificado?
3. Se a resposta for (A), há requisito de VALIDAR que actionContext.actorId pertence ao usuário
   autenticado antes de gravar (e onde isso já é feito)?

EVIDÊNCIA ESPERADA:
- DECISION/norma citável (arquivo/seção) ou veredito de que (B) é o padrão norma-alinhado;
- confirmação se actionContext valida ownership do actorId (ou não);
- recomendação clara A vs B + STOPs.

FORMATO DE RESPOSTA ESPERADO:
- VEREDITO
- EVIDÊNCIAS
- RISCOS
- RECOMENDAÇÃO
- STOPs

(Responder ABAIXO deste pedido, sem apagar/alterar conteúdo antigo. A executora está PARADA
nesta frente até a resposta + go do Clayton.)

--- ATUALIZAÇÃO 2026-06-06 — CLAYTON RATIFICOU **B** (confirmar contra a norma) ---

Veredito recomendado por ChatGPT/Clayton: **B** — autoria auth-derived
(`req.user.userId → ensureUserActor() → actor_id`), depois autoridade da empresa
(`companyId → fiscal_identity_id` + `canManageCompany`/vínculo). NÃO usar
`req.actionContext.actorId` como autoria soberana em rota user-facing enquanto for
spoofável fora de contexto admin validado. Posse de companyId não é autorização.

Perguntas (responder no formato do protocolo):
1. Confirme se **B** é compatível com as normas/decisões vigentes.
2. Cite a norma/decisão aplicável sobre autoridade/autoria (AUTHORITY_LAW /
   AUTHORITY_PRECEDENCE / actor resolution).
3. Confirme que `actionContext.actorId` NÃO deve ser autoria soberana em rota
   user-facing sem validação actor↔user.
4. Confirme que rotas admin com `requireRole(['admin'])` são outro caso e não devem
   ser misturadas com submit user-facing.
5. Isso exige DECISION nova agora, ou pode ser registrado como **aplicação da norma
   vigente**?

Resposta esperada: VEREDITO · NORMAS/DECISIONs APLICÁVEIS · APLICAÇÃO À FRENTE
`F-PJ-KYB-DOCUMENTS-USER-SUBMIT` · O QUE A EXECUTORA DEVE FAZER · STOPs.

==============================================================

--------------------------------------------------------------
RESPOSTA IA-DECISOES — 2026-06-06 (hora não disponível ao agente)
Status: RESPONDIDO
Frente: F-PJ-KYB-DOCUMENTS-USER-SUBMIT
--------------------------------------------------------------

VEREDITO:
**B está CORRETO e é norma-alinhado.** Em rota USER-FACING sensível (submit KYB), a **autoria** (`submittedByActorId`) deve ser **auth-derived**: `req.user.userId → ensureUserActor(tenantId, userId) → actor_id`. **NÃO** usar `req.actionContext.actorId` como autoria soberana enquanto for client-declared/spoofável. Depois da autoria, aplica-se a **autoridade da empresa** (`companyId → fiscal_identity_id` + `canManageCompany`/vínculo) — posse de `companyId` não é autorização. **Isto NÃO exige DECISION nova — é APLICAÇÃO da norma vigente.** A tensão com a literalidade do prompt #3 ("actor vem de actionContext, nunca de body") se resolve a favor da **intenção de segurança**: na prática `actionContext.actorId` É derivado de body/header/query (o próprio middleware tem fallback `body.actorId`), então o #3 literal é autocontraditório; a intenção (ator = usuário autenticado, resolvido server-side) prevalece.

EVIDÊNCIAS (leitura direta, HEAD `dec7057a`):
- `backend/src/core/action-context/action-context.middleware.ts`: lê `actorId` de header `x-action-context` / `body.actionContext` / `query` / **fallback `body.actorId` (l.93-103)**; valida só presença+formato (l.116-121) e que `scope` inclui `tenantId` (l.143). **NÃO há SELECT em `actors`; NÃO valida actor↔user.** Comentário do próprio arquivo (l.33-34): "NÃO infere actorId de req.user / NÃO cria fallback". → `actionContext.actorId` é **client-declared e spoofável**. CONFIRMA o achado da executora.
- `companies.routes` (B): autoria derivada de `ensureUserActor(tenantId, req.user.userId)` (createCompany l.451; activation l.942/996) — padrão server-side, não confia em input.

NORMAS/DECISIONs APLICÁVEIS:
- `SSOT_REGISTRY_UNIFICARD.md §5.16` — **PROIBIDO** "resolver permissão só em middleware HTTP sem serviço de domínio"; **PROIBIDO** confundir `responsible_actor_id` (civil, §4.8) com permissão operacional (§4.9). (Diretamente contra usar actionContext como autoria.)
- `SSOT_REGISTRY_UNIFICARD.md §5.1` — writer do actor humano = **`ensureUserActor`** (actor-writer.service); lookup/atribuição de actor humano passa pelo writer, não por id solto de input.
- `AUTHORITY_PRECEDENCE.md` (ATL→KYC→GUARDA→IA→**PRODUTO**) — produto é a camada mais fraca; a conveniência/literalidade do prompt (#3) **não suaviza** trava de autoridade/segurança. "Vence a trava mais restritiva."
- `AUTHORITY_LAW.md` — "Toda ação econômica possui UM responsável econômico único" + cadeia de responsabilidade resolvível (LEI §4.8/§4.9). Autoria não-verificável quebra a cadeia.
- `DECISION-0112 ADENDO §10 A4` — submit user-facing **exige autoridade por vínculo** (`canManageCompany`); **"posse de ID não basta"**. (Já promulgado; B é a sua aplicação.)
- `DECISION-0088 §3.1/§3.6` e `DECISION-0094 §4.7` — gates KYB resolvem `page→company→fiscal` **server-side**, **fail-closed**; nunca confiam em input do cliente. Mesmo princípio para autoria.
- Lei operacional cross-layer (memória): **"frontend nunca cria verdade"** — autoria/autoridade não podem ser concedidas por input.

APLICAÇÃO À FRENTE `F-PJ-KYB-DOCUMENTS-USER-SUBMIT`:
- `submittedByActorId` = **`ensureUserActor(tenantId, req.user.userId)`** (NÃO `actionContext.actorId`).
- Manter `actionContext` apenas para **intent/source/scope** (rastreabilidade/auditoria), se desejado — mas a **autoria** vem da auth.
- Em seguida, gate de autoridade da empresa: resolver `companyId → fiscal_identity_id` + `canManageCompany` (vínculo), **fail-closed** se quebrado. Posse de `companyId` ≠ autorização.
- Rotas ADMIN canônicas (`/identity/pj/kyb/*`, `requireRole(['admin'])`) são **outro caso** — o ator já passou por gate de role validado; **não misturar** o padrão admin (actionContext.actorId sob role) com o submit user-facing. São fluxos distintos.

RESPOSTA ÀS 5 PERGUNTAS DA ATUALIZAÇÃO:
1. **B é compatível com a norma vigente?** SIM.
2. **Norma/decisão aplicável?** SSOT_REGISTRY §5.16 + §5.1; AUTHORITY_PRECEDENCE; AUTHORITY_LAW (§4.8/§4.9); DECISION-0112 §10 A4; DECISION-0088 §3.1/§3.6; DECISION-0094 §4.7 (citadas acima).
3. **`actionContext.actorId` NÃO deve ser autoria soberana em rota user-facing sem validação actor↔user?** CONFIRMADO — o middleware não valida ownership (evidência acima); confiar nele para autoria viola §5.16 e a cadeia de responsabilidade.
4. **Rotas admin (`requireRole(['admin'])`) são outro caso?** SIM — não misturar com submit user-facing.
5. **Exige DECISION nova?** **NÃO** — é **aplicação da norma vigente**. Pode ser registrado como tal (log de execução da frente / nota no ADENDO §10), sem cartório novo. (Se Clayton quiser blindagem extra, vira nota de execução, não DECISION.)

RISCOS:
- Confiar em `actionContext.actorId` (A) numa rota user-facing = **atribuição de documento KYB a OUTRO actor** (autoria forjada) → quebra de cadeia de responsabilidade fiscal/civil e potencial fraude de KYB. Risco material em substrato sensível (identidade).
- Se mantiverem `actionContext.actorId` por compat, é **obrigatório** validar `actorId == ensureUserActor(req.user.userId)` antes de gravar (defesa) — mas para autoria, derivar direto (B) é mais simples e à prova de spoof.

RECOMENDAÇÃO:
Implementar **B** + gate `canManageCompany`. Não tratar como DECISION nova; registrar como aplicação da norma na execução da frente. Opcional/higiene futura: corrigir/`harden` `action-context.middleware` para validar ownership do actorId (DT própria — FORA do escopo IA-DECISOES decidir o como; é IA-DT/executora).

STOPs:
- **STOP** — não usar `req.actionContext.actorId` como autoria do submit user-facing sem validação actor↔user (spoofável; §5.16).
- **STOP** — não tratar posse de `companyId` como autorização; exigir `canManageCompany`/vínculo (0112 §10 A4).
- **STOP** — não misturar o fluxo admin (`requireRole`) com o user-facing.
- **STOP** — não abrir DECISION nova para isto (é aplicação de norma; abrir cartório aqui seria inflar numeração).
- **STOP** — fail-closed se `page→company→fiscal` ou `req.user→actor` não resolver (0088/0094).

FIM DA RESPOSTA IA-DECISOES
--------------------------------------------------------------

==============================================================

# MINHA MEMÓRIA DECISÕES

> Memória de trabalho da instância permanente **IA-DECISÕES**.
> Criada em 2026-06-06. Atualizável SOMENTE por esta instância, SOMENTE neste arquivo.
> Não é fonte normativa. É mapa, aprendizado e alerta. A verdade soberana é a
> DECISION original + REMEDIATION_DECISIONS_LOG + STATUS/opus + runtime/schema vivo.

---

## Papel da instância

Sou a instância especialista em **Decisões Arquiteturais** do Unificard/UnifyBank.

- NÃO implemento código, schema, migration, contrato, frontend.
- NÃO reescrevo DECISION antiga (decisão superada → NOVA decisão; cabeçalho antigo descreve a SESSÃO DE PROMULGAÇÃO, não o estado atual).
- NÃO commito, NÃO atualizo DECISOES.md / REMEDIATION_DECISIONS_LOG / DT_LOG / STATUS.
- NÃO corrijo contradição — apenas registro, mapeio e alerto.
- Única escrita permitida: este arquivo (`docs/memorias/MINHA_MEMORIA_DECISOES.md`).
- Arquivos protegidos (nunca tocar/stagear/commitar): `CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`.

Meu valor: dar à executora e a Clayton um mapa confiável de "o que já foi decidido, por quem, em que estado, e onde declarado ≠ verificado".

---

## Estado inicial verificado

- **HEAD:** `eba663b5` (decisions: DECISION-0112 storage documental KYB/PJ, docs-only)
- **Branch:** `rescue-structural` (esperada ✔)
- **Working tree:** limpo exceto 3 untracked = exatamente os arquivos protegidos (`CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`). Não toco neles.
- **Banco:** unificard_dev (não acessei — não houve necessidade nesta primeira tarefa).
- `docs/memorias/` não existia; criada para abrigar este arquivo.

**⚠️ Divergência HEAD × working tree detectada no fim desta tarefa (2026-06-06):**
Ao concluir, `git status --short` revelou DOIS arquivos modificados **uncommitted que NÃO escrevi**:
`REMEDIATION_DT_LOG.md` e `docs/02_decisions/DECISION_0112_PJ_DOCUMENT_STORAGE_PROVIDER.md`.
No snapshot de início de sessão o tree estava limpo. As edições são autorais e coerentes
(provável trabalho da **executora** aplicando respostas de Clayton), conteúdo:
(a) **DECISION-0112 ganhou `§10 ADENDO`** onde **Clayton RESOLVE os 4 parâmetros de produto**
(A1 provider = `DocumentStoragePort` S3-compatible/contrato, dev local fora de `/uploads/`, prod-sem-provider fail-closed; A2 antivírus OBRIGATÓRIO em prod via novo `MalwareScanPort`, dev=Noop, sem-scanner=fail-closed/quarantine; A3 retenção = regra de produto LGPD, sem delete auto, `retention_review_required`/`deletion_eligible_at`; A4 submit user-facing SIM após port+autoridade `canManageCompany`, admin revisa).
(b) **DT_LOG ganhou `DT-PJ-DOCUMENT-MALWARE-SCAN-MISSING` (OPEN)** governada pela 0112 §10.
Meu arquivo de memória está isolado em `docs/memorias/`; **não toquei/stageei/reverti** esses dois.

**RESOLVIDO (mesma sessão, 2026-06-06):** os edits uncommitted que detectei foram **commitados pela
executora** — HEAD avançou `eba663b5 → a312174a` = *"DECISION-0112 ADENDO - Clayton resolve os 4
parâmetros de produto (docs-only)"*. Working tree voltou a limpo. Linha do tempo fechada:
(1) `eba663b5` promulga 0112 docs-only com §7 pendente; (2) auditoria peer recomenda fechar §7 por
ADENDO dentro da 0112 (NÃO DECISION-0113 nova); (3) `a312174a` faz exatamente isso. **Convergência
independente valida minha "Estratégia de reconciliação" (fechar via adendo, nunca duplicar/reescrever).**

---

## Documentos lidos

Lidos integralmente (bootstrap normativo, precedência 2.2.7):
1. `docs/01_normative/00_AGENT_PROTOCOL.md` (940 linhas)
2. `docs/01_normative/CONSTITUICAO_UNIFICARD.md` (178)
3. `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md` (226)
4. `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` (487)

Mapeados via extração estruturada (read-only, agentes Explore — leitura em profundidade dos logs grandes):
5. `docs/01_normative/07_NOMENCLATURA_CANONICA.md` (6296) — referenciado, não exaustivo
6. `REMEDIATION_DECISIONS_LOG.md` (6742) — todas as entradas DECISION
7. `docs/02_decisions/DECISOES.md` — índice/auditoria operacional (declarado × verificado)
8. `docs/02_decisions/` — inventário de arquivos canônicos (DECISION/RFC/ADR/CONTRACT)
9. `REMEDIATION_DT_LOG.md` (11560) — DTs e vínculos com DECISIONs
10. `STATUS_EXECUCAO_GLOBAL.md` (12697) + `opus.md` (4127) — estado consolidado

**Nota:** `DECISOES.md` está em `docs/02_decisions/DECISOES.md` (não na raiz).

---

## Regras sobre DECISIONs

1. **Decisão antiga nunca é reescrita.** Superada → nova DECISION que a referencia.
2. **Cabeçalho "DOCS-ONLY / SEM MIGRATION / SEM CÓDIGO" descreve a sessão de promulgação**, não o estado atual. Implementação posterior NÃO autoriza editar o cabeçalho antigo → vira **estado consolidado** (registrado em DECISOES.md, não no doc original).
3. **DECISOES.md = índice/auditoria operacional**, NÃO fonte normativa soberana. Não autoriza reescrever DECISION.
4. **Divergência declarado × verificado exige frente documental própria** (nova DECISION ou nota de estado consolidado), nunca correção silenciosa do antigo.
5. **Precedência normativa (00_AGENT_PROTOCOL 2.2.7):** Constituição > Leis Operacionais > SSOT Registry > 18_DOMAIN_ONTOLOGY > demais. Código pode estar errado perante a norma (permitido; hierarquia epistemológica).
6. **Numeração duplicada no LOG = séries paralelas históricas.** Ler o TÍTULO de cada ocorrência, nunca assumir pelo número.
7. SSOTs nomeados (para prova de rastreabilidade 2.2.2): financeiro = `bank_ledger`/`bank_transactions` (Lei 5); semântico = CONCEPT/`concepts` (Lei 7); temporal = `unified_availability`/`unified_bookings`; identidade/ator = `actors`/`actor_id` (writer §4.8.1); autoridade = LEI §4.9.
8. **Precedência de AUTORIDADE (trava, distinta da precedência documental 2.2.7):** `docs/ssot/AUTHORITY_PRECEDENCE.md` fixa ordem IMUTÁVEL **ATL → KYC → GUARDA → IA/SISTEMAS → PRODUTO**. "Vence sempre a trava MAIS RESTRITIVA"; sem ponderação/exceção/override/caso-a-caso. **PRODUTO é a camada mais fraca** — nenhum parâmetro de produto suaviza trava de autoridade/segurança. Subordinado a `AUTHORITY_LAW.md` + `08_AUTORIDADE_CANONICA.md`; aplicado em `GATES.md` (Gate A) e `AUTHORITY_RECOVERY.md`. Confirmado por leitura direta 2026-06-06. Implicação p/ família PJ/KYB: §7 (produto) da 0112 jamais relaxa D1–D13 (técnica/segurança).

---

## Decisões por domínio

> Série Tier 1 (0064–0112) confirmada por arquivos `.md` em `docs/02_decisions/`.
> Série Tier 2 (≤0063) vive no REMEDIATION_DECISIONS_LOG; tem duplicações (ver seção própria).

**Financeiro / Bank (SSOT: bank_ledger/bank_transactions — Lei 5):**
0024 (ledger-only SSOT), 0025 (mono-currency BRL), 0029 (reference_id TEXT), 0030¹ (system_coverage BIGINT), 0031¹ (coverage emerge de fluxo), 0032¹ (payment status lowercase), 0036 (bank_splits account-centric), 0044/0045 (quad-classificação boundary), 0046 (actor_wallet), 0047/0048 (Economic Policy Engine — resolve vs materializa), 0049 (regional_origin_basis), 0051 (regional_fund PJ-only), 0052 (refund split-aware), 0053 (wallet recovery obligations), 0054 (financial approval substrate), 0055/0056 (debit recovery), 0057 (user wallet owner convention), 0058/0059/0060 (payout wiring/external settlement/bank destinations), 0110 (política financeira serviço), 0111 (release/cancel/dispute/refund serviço).

**Identidade / Actor (SSOT: actors/actor_id — §4.8.1):**
0020 (Location Core), 0021 (tenant-awareness addresses; jurisdição/soberania), 0022 (group_invites actor-based), 0023/0042 (company_users MEMBERSHIP SSOT), 0026 (C22 users.id+user_id allowlisted), 0030² (actor localização temporal-operacional), 0050 (cartório service_provider), 0061 (public profile canonicalidade), 0062 (CPF/CNPJ SSOT global), 0063 (C1 perfil profissional declarativo), 0067/0069 (actor-first learning/interest), 0080 (gender → Identity SSOT), 0097/0098 (nascimento/ativação PJ), 0103 (CNAE fiscal evidence).

**Semântico / CONCEPT (SSOT: concepts — Lei 7):**
C2-009..013 (concepts commerce), 0018 (slug→UUID híbrido), 0064/0065/0066 (learning/interest governance + directives), 0068 (conceptID surfacing), 0070 (expansão IA ≠ identidade), 0104 (CNAE→concept suggestion = sinal, não autoridade), 0105 (concepts.domain multi-camada), 0106 (MarketplaceDomain→N0), 0107 (concept display name labels).

**Temporal / Agenda (SSOT: unified_availability):**
0014 (consolidação schedules→unified_availability, fecha C63), 0037 (unified_availability soberana), 0072 (B1 materialization).

**Autoridade / Authority (LEI §4.9):**
0013 (RBAC fail-closed actor_has_permission), 0041 (policy-engine isolado, não authority paralela), 0094 (PJ social authority KYB gate), 0101 (revogação KYB cascata).

**Marketplace / Inventory (SSOT quantidade: inventory_movements):**
0033¹ (canonical_products.type discriminator), 0099/0100 (publicação/oferta PJ + schema company_concept_publications), 0102 (elegibilidade domínios), 0108 (produto por categoria/ramo), 0109 (Trilho B serviços taxonomia Bank-free).

**Perfil / Profile (read model, não SSOT — 2.3.4):**
0043 (convergência contextual progressiva), 0071 (lifestyle/saúde LGPD — PENDENTE), 0073 (educação ≠ credencial), 0074 (residência→Location Core), 0076/0077/0078/0079 (geo/CEP/neighborhood), 0095/0096 (completeness ≠ fiscal; UX presencial).

**PJ / KYB (cluster próprio — fiscal_identities / fiscal_identity_documents):**
0081/0082/0084 (fiscal identity & CNPJ canonical home — princípios), 0083 (authorized links enterprise risk — NÃO implementado), 0085 (technical design), 0086 (audited writer), 0087 (KYB documents SSOT = `fiscal_identity_documents`), 0088 (authority gate), 0089/0090/0091/0092/0093 (reconciliação verificação/lifecycle/is_verified cleanup), 0112 (storage documental provider — FRENTE ATIVA).

**Social:**
0031² (reactions polimórfica), 0032² (post_cta prematuro), 0033² (post_media→posts.media_ids), 0034 (post_projects prematuro).

**Navegação / Gate / Arquitetura:**
0017 (gate coerência repo↔schema), 0019 (concept-resolver core→modules), 0027/0028 (status UPPERCASE allowlisted/ratificado), 0038 (código aspiracional ≠ capacidade), 0039 (modo operante v1 hardcoded), 0040 (FANTASMAs frontend).

**Storage:** 0112 (PORT canônico `DocumentStoragePort`, fail-closed prod).

**Contratos Core (não numerados):** DECISION_CORE_CONTRACT, DECISION_CORE_HARDENING_CONTRACT, DECISION_SAFETY_AND_CONTAINMENT_CONTRACT, DECISION_GATE_ZERO_B. ADRs: ADR-001 (SSOT reading), ADR-002 (core frozen).

---

## Decisões superadas

- **Nenhuma DECISION tem campo "Superada por" preenchido** no REMEDIATION_DECISIONS_LOG (padrão é deixar em aberto). Superação aparece só por relação implícita:
  - 0111 supera parcialmente 0110 (política fina de serviço refina política financeira).
  - 0110 completa 0109 (D4/D5 da fundação Trilho B).
  - 0106 materializa/reconcilia 0102 (fork de vocabulário CNAE/N0).
  - 0108 aplica 0105 (camadas semânticas de concepts.domain).
  - 0031¹ encerra DT-COVERAGE-BOOTSTRAP-REQUIRED **sem código** (decisão arquitetural: smoke estava errado, sistema certo) — Q3-E2E v1 DEPRECADO.
- **Alerta:** ausência de campo "superada por" torna a cadeia de superação implícita e frágil. Candidata a frente de reconciliação (ver Estratégia).

---

## Decisões parcialmente implementadas

- **0074** (residência→Location Core): F1/F2 executados; falta convergência total. DECISOES.md marca PARCIAL.
- **0076/0077/0079** (geo enrichment / neighborhood): PARCIAL (colunas existem, política não totalmente exercida).
- **0101** (revogação KYB cascata): PARCIAL — writer de saída (`approved→rejected`) é DT OPEN.
- **0102** (elegibilidade domínios): PARCIAL — DomainSelector neutralizado.
- **0108** (produto por categoria/ramo): PARCIAL — guard-fix é frente própria; Op1/Op2 implementados.
- **0109** (Trilho B): fundação implementada (schema ponte, seed salão, guard, availability adapter) mas **trilho não exercido (0 linhas em produção)**; booking/payment bloqueados. 4 DTs OPEN.
- **0110** (política financeira serviço): promulgada + firewall fecha 3 rotas; **cadeia canônica (request→execution→escrow→release+KYB) ABERTA**. 6 DTs OPEN.
- **0111** (release/timeout/refund): política D1–D11 promulgada; runtime ausente; flag `SERVICE_FINANCIAL_RUNTIME_ENABLED` OFF. 6 DTs OPEN.
- **0112** (storage documental): desenho técnico D1–D13 promulgado; aguarda 4 parâmetros de produto de Clayton + F-PJ-DOCUMENT-STORAGE-PORT.

---

## Decisões docs-only que viraram runtime

> Achado MAIS valioso do índice DECISOES.md: 13–15 DECISIONs cujo cabeçalho diz
> "DOCS-ONLY / SEM MIGRATION / SEM CÓDIGO" mas o runtime/schema **já está implementado**.
> Causa: promulgação = uma sessão (docs-only); execução = fatias posteriores que
> não reabriram o doc. **Estado consolidado, não autorização para editar cabeçalho.**

| DECISION | Cabeçalho declara | Runtime verificado |
|---|---|---|
| **0085** | SEM MIGRATION / SEM CÓDIGO | `fiscal_identities` (49 linhas vivas) |
| **0086** | SEM MIGRATION / SEM CÓDIGO | `fiscal_identity_kyb_requests` + service |
| **0087** ⭐ | SEM MIGRATION / SEM CÓDIGO | tabela `fiscal_identity_documents` + service + gate + rotas admin + e2e (caso canônico) |
| **0088** | SEM CÓDIGO | `evaluateKybLayer` + e2e |
| **0089** | SEM CÓDIGO | Fase 1 display viva |
| **0092** | SEM SCHEMA | CHECK lifecycle existe |
| **0093** | SEM MIGRATION | drop `is_verified` aplicado |
| **0100** | não autoriza migration | `company_concept_publications` + service |
| **0103** | SEM SCHEMA | `fiscal_identity_economic_activities` + service |
| **0104** | SEM SCHEMA / SEM SEED | `cnae_concept_suggestions` + 8 linhas seed |
| **0107** | SEM SCHEMA / SEM SEED | `concept_labels` + 7 labels MVP |
| **0078** | DOCS-ONLY | `cep_resolution_cache` + serviços vivos |
| **0080** | DOCS-ONLY | coluna `global_users.gender` existe |

Também viraram runtime (docs→code firewall): 0110, 0111 (F-SERVICE-FINANCIAL-FIREWALL-CODE); 0107 (cadeia completa schema+seed+endpoints+wizard = FECHADA).

---

## Decisões redundantes ou próximas

- **0020 (Location Core, geo-estático) × 0030² (actor localização temporal-operacional):** NÃO são redundantes — 0020 é território/infraestrutura (countries/states/cities/addresses), 0030² é atividade dinâmica do actor. Mas se tocadas juntas, risco de confusão. Memória do projeto já alerta: NÃO criar DECISION duplicada de Location; 0020 é canônica.
- **0047 × 0048 (Policy Engine):** próximas e complementares — 0047 cria camada (resolve+materializa), 0048 corrige para "policies=resolve, Bank=materializa, sem coexistência". Ler como par.
- **0064/0065/0066 (learning/interest):** trio governança + 2 directives; ler como bloco (frente selada `SELO_C1_LEARNING_INTEREST`).
- **0099/0100 (publicação PJ):** norma + schema do mesmo tema.
- **0105/0106/0107 (semântica concepts):** camadas/mapa/labels — bloco próximo, não redundante.
- **0109/0110/0111 (serviços Trilho B):** fundação → política financeira → política fina. Cadeia, não redundância.

---

## Decisões que criaram DTs

| DECISION | DTs criadas (amostra) |
|---|---|
| 0013 | DT-RBAC-ACTOR-HAS-ANY-ROLE-LOST-IN-REBASE |
| 0024 | DT-bank-cachedBalanceCents-naming-heterogeneity, DT-bank-balance-consolidation-region-fallback-tenant |
| 0030¹/0031¹ | DT-COVERAGE-BOOTSTRAP-REQUIRED, DT-q3-e2e-v2-service-booking-sem-reserve |
| 0032¹ | DT-C36-actor-debts-case-drift, DT-DECISION-0032-FASE-1-PARTIAL-EXECUTION |
| 0036 | DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO (resolvida), DT-PLATFORM-ACCOUNTS-NAMING |
| 0042 | DT-MEMBERSHIP-MIGRATIONS-INTERROMPIDAS |
| 0048 | DT-POLICY-ENGINE-LEGACY-DEPRECATION, DT-CATEGORY-AS-POLICY-SELECTOR, DT-PE1-EXECUTOR-GUARDRAIL, DT-CAMADA1-FEE-SPLIT |
| 0059/0060 | DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT (OPEN, gated) |
| 0061 | DT-PUBLIC-PROFILES-NO-FRONTEND-CONSUMER |
| 0062 | DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY (F0–F5 em progresso) |
| 0109/0110/0111 | 4 + 6 + 6 DTs de serviço OPEN |
| 0112 | (pré-requisito de F-PJ-DOCUMENT-STORAGE-PORT) |

---

## Decisões que fecharam DTs

| DECISION | DT fechada |
|---|---|
| 0014 | C63 (WRITE em schedules/schedule_slots) |
| 0031¹ | DT-COVERAGE-BOOTSTRAP-REQUIRED (CLOSED sem código) |
| 0032¹ | DT-PAYMENT-CASING-DRIFT, DT-PAYMENT-RESOLVER-INVALID-STATUS-VALUES |
| 0036 | DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION, DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO |
| 0042 | DT-MEMBERSHIP-SSOT-DECISION-REQUIRED |
| 0043 | DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT |
| 0046 | DT-ACTOR-WALLET-CANONICALIZATION |
| 0048 | DT-OUTBOX-ATOMICITY, DT-CAMADA1-FEE-SPLIT, DT-POLICY-ENGINE-LEGACY-DEPRECATION, DT-CATEGORY-AS-POLICY-SELECTOR |
| 0049 | DT-REGIONAL-ORIGIN-BASIS-POLICY |
| 0053 | DT-PE5-REFUND-POST-DMONEY-CHAIN, DT-ACTOR-WALLET-DEBIT-MISSING, DT-DMONEY-FINALIZATION-FLOW-MISSING |
| 0054 | DT-CORE-APPROVAL-REQUESTS-MISSING |
| 0060 | DT-ACTOR-BANK-DESTINATION-MISSING |
| 0062 (F0.1) | DT-BANK-BALANCE-BY-CPF-GHOST-USERS-CPF |
| (PJ frentes 2026-06-06) | DT-PJ-COMPANY-APPEARS-BEFORE-ONBOARDING-FINALIZED, DT-PJ-LEGACY-COMPANY-DOCUMENT-UPLOAD-USES-NON-SSOT, DT-PJ-LEGACY-COMPANY-DOCUMENTS-READERS-GHOST, DT-PJ-CNPJ-DUPLICATE-ON-ENTRY-MISSING, DT-PJ-ONBOARDING-ROLE-DUPLICATE, DT-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH |

---

## Decisões que dependem de Clayton

> ~98% das DECISIONs registram aprovação de Clayton. Aqui só as que têm
> **ação pendente bloqueada** aguardando decisão humana AGORA.

- **0112** — 4 parâmetros de PRODUTO não promulgados: (1) provider de produção; (2) antivírus no MVP?; (3) política de retenção; (4) porta de submit (dono vs admin). STOP correto: achado material = `/uploads/` servido público sem auth (vazamento literal). **Liberar dinheiro sem documento confiável = "ponte de gelatina" (Clayton).**
- **0059/0060** — payout externo: DT-ACTOR-WALLET-PAYOUT-EXTERNAL-SETTLEMENT PARADO até Clayton autorizar settlement externo.
- **0110/0111** — reabertura do firewall financeiro de serviço só após cadeia canônica desenhada + E2Es fail-first; flag OFF por decisão.
- **0071** — política LGPD lifestyle/saúde: D1 tomada, implementação pendente (sexualOrientation FORA do MVP; saúde→501). Ordem vinculante: política antes de código.
- **DT-FOLLOW-MECHANICS-DECISION-PENDING** — decisão arquitetural de produto pendente.
- **DT-C36-actor-debts-case-drift / DT-DRIFT-STATUS-CASE-SYSTEMIC** — vocabulário canônico de casing final aguarda Clayton.
- **Restaurante / peixaria** (Trilho B): adiado/fora por decisão de produto (piloto = salão).

---

## Decisões que não devem ser reabertas

- **0020 (Location Core)** — canônica; memória do projeto proíbe DECISION duplicada de localização.
- **0024/0025 (bank ledger-only SSOT / mono-currency)** — fundação financeira; reabrir só por emenda formal.
- **0014/0037 (SSOT temporal unified_availability)** — soberania temporal consolidada.
- **0048 (policy resolve vs Bank materializa)** — convergência fechada; não recriar coexistência.
- **0062 (CPF/CNPJ SSOT)** — em execução F0–F5; não reabrir, executar.
- **Frente C1 Learning/Interest** — SELADA (`SELO_C1_LEARNING_INTEREST`); resíduos são frentes próprias, não reabertura.
- **0031¹ (coverage emerge de fluxo)** — decisão de NÃO implementar; reabrir exigiria evidência fortíssima (anti "jeitinho institucional").
- **Constituição (Artigos I–XII)** — imutável; só emenda formal pública.

---

## Contradições aparentes

1. **Numeração duplicada 0030–0033** (série REMEDIATION-financeira × série social):
   - 0030: system_coverage BIGINT │ actor localização temporal-operacional
   - 0031: coverage emerge de fluxo │ reactions polimórfica
   - 0032: payment status lowercase │ post_cta prematuro
   - 0033: canonical_products.type │ post_media legacy
   - **Não é contradição material** (contextos disjuntos), mas é armadilha de referência. SEMPRE citar pelo título, nunca só pelo número.
2. **Gaps de numeração:** 0035 e 0075 sem header no LOG. (0075 tem `.md` — Company Birth Page-Actor Drift; 0035 possivelmente em ramo não mergeado ou gap.) Verificar antes de afirmar ausência.
3. **0001–0013 sem header formal** no LOG — podem nunca ter sido formalizados como entrada (mas 0013/0014+ aparecem citados). Não assumir inexistência.
4. **Cabeçalho docs-only × runtime implementado** (0085–0107, ver seção própria): contradição APENAS aparente — é estado consolidado por fatias posteriores. Resolução correta = nota de estado (DECISOES.md já faz), NUNCA editar o doc original.
5. **`/uploads/` público (app.builder) × 0112 D7 (download exige autorização auditável):** contradição REAL entre runtime legado e decisão. Achado material; STOP legítimo. Não é minha alçada corrigir — alertar.
6. **DECISION-0032² (post_cta): "PREMATURO" + "ratificada" + abre DT OPEN** — tensão de status (decisão é ratificar NÃO-materializar agora). Ler como: código bloqueado, DT registra futuro.

---

## Estratégia de reconciliação

Quando uma reconciliação for necessária, propor **NOVA DECISION** (nunca editar antiga):

1. **Reconciliação de estado consolidado (PJ/KYB 0085–0107):** uma DECISION-índice que declare formalmente "estas decisões docs-only foram materializadas pelas fatias X; cabeçalhos preservados; estado vivo = runtime". DECISOES.md já é a auditoria; faltaria o ato normativo que a ratifica. → Sugerir a Clayton, não executar.
2. **Cadeia de superação explícita:** como nenhuma DECISION tem campo "superada por", uma frente leve poderia adicionar esse vínculo bidirecional (0110←0111, 0109←0110, 0102←0106). Documental, não código.
3. **Numeração duplicada:** NÃO renumerar (quebraria referências históricas). Em vez disso, convenção de citação `DECISION-0030 (financeiro/coverage)` vs `DECISION-0030 (actor/localização)`. Registrar a convenção, não mudar os docs.
4. **Vocabulário de casing (DT-DRIFT-STATUS-CASE-SYSTEMIC):** aguarda decisão de Clayton; quando vier, UMA DECISION canônica de casing fecha o cluster de DTs.

Regra: **reconciliação documental sempre precede reconciliação de código.** Política antes de implementação (padrão 0071).

---

## Perguntas pendentes para Clayton

1. ~~**DECISION-0112** — 4 parâmetros de produto~~ **RESOLVIDO 2026-06-06** (commit `a312174a`, `§10 ADENDO` da 0112): A1 provider = `DocumentStoragePort` S3-compatible (contrato, não vendor; dev local fora de `/uploads/`, prod-sem-provider fail-closed); A2 antivírus OBRIGATÓRIO em prod via novo `MalwareScanPort` (dev Noop, sem-scanner fail-closed/quarantine; abre `DT-PJ-DOCUMENT-MALWARE-SCAN-MISSING`); A3 retenção = regra de produto LGPD, sem delete-auto, `retention_review_required`/`deletion_eligible_at`; A4 submit user-facing SIM após port+autoridade `canManageCompany`, admin revisa. Próximo: fatia `F-PJ-DOCUMENT-STORAGE-PORT` (runtime ainda não autorizado).
2. **Payout externo (0059/0060)** — autorizar settlement externo ou manter PARADO?
3. **Vocabulário de casing** — definir o canônico para fechar DT-DRIFT-STATUS-CASE-SYSTEMIC / DT-C36.
4. **Reconciliação de cabeçalhos docs-only→runtime** — quer um ato normativo (DECISION-índice) que ratifique o estado consolidado, ou DECISOES.md (auditoria) é suficiente?
5. **0035 / 0075** — confirmar se há decisão perdida em ramo não mergeado, ou se são gaps intencionais.
6. **Follow mechanics** — decisão de produto pendente (DT-FOLLOW-MECHANICS-DECISION-PENDING).

---

## Alertas para a executora unificard

> Alertas DESTA instância para a instância executora. São avisos, não ordens.

1. **NÃO editar cabeçalho de DECISION antiga** ao implementar algo que ela previa. Cabeçalho = sessão de promulgação. Estado novo → registrar em DECISOES.md / STATUS, ou nova DECISION.
2. **Citar DECISION sempre pelo título quando o número for 0030/0031/0032/0033** (duplicados entre série financeira e social). Risco real de aplicar a decisão errada.
3. **Antes de abrir DT/decisão nova em money/authority/actor/identidade:** grep no REMEDIATION_DECISIONS_LOG + DT_LOG pelo tema. Provável que já exista DECISION soberana → reenquadrar como "execução pendente", não decisão nova. (Memória: o erro do DT-PAYMENT-RESOLVER aberto sobre tema já decidido em 0032.)
4. **`/uploads/` público sem auth (app.builder) é vazamento literal** e contradiz 0112 D7. NÃO subir nada de upload documental antes do `DocumentStoragePort` fail-closed. Achado material já registrado.
5. **Flag `SERVICE_FINANCIAL_RUNTIME_ENABLED` deve permanecer OFF** até cadeia canônica de serviço (request→execution→escrow→release+KYB+timeout) desenhada + E2Es fail-first. Firewall (0110 D8) não é decoração.
6. **Frentes que tocam Trilho B (0109/0110/0111):** booking/order/payment estão atrás da porta corta-fogo Bank por decisão. Não "ligar" para testar.
7. **Quando uma frente tentar decidir por CÓDIGO algo que é decisão de PRODUTO** (ex.: política de retenção de documento, mecânica de follow, casing canônico) → PARAR e escalar a Clayton. Enforcement (CHECK/FK/trigger) que cristaliza decisão nova = anti-padrão.
8. **0062 (CPF/CNPJ SSOT) e 0071 (LGPD) estão em execução/pendentes** — são as frentes de identidade/privacidade vivas. Não reabrir como decisão; executar conforme decidido.
9. **94 atores legados com `global_user_id IS NULL`** (backfill é fatia futura, DECISION-0062) — não tratar como bug a amputar.
10. **Gap documental confirmado (2026-06-06):** `SSOT_REGISTRY_UNIFICARD.md` **NÃO lista** `fiscal_identity_documents` nem `fiscal_identities` (0 ocorrências). O SSOT documental KYB vive na DECISION-0087/0112 mas não está refletido no registro central. → Fatia docs-only de **sincronização do SSOT_REGISTRY** (não recriar SSOT, só registrar o que 0087 já é soberano). Achado de auditoria peer, confirmado por mim.
11. **Família PJ/KYB subordina-se a `AUTHORITY_PRECEDENCE` (ATL→KYC→GUARDA→IA→PRODUTO).** Convém a 0112 explicitar essa subordinação (hoje implícita) para blindar contra "jeitinho de produto" nos §7. Reparo docs-only sugerido, não obrigatório.

---

---
---

# ANÁLISE — FECHAMENTO PJ (sessão 2, 2026-06-06)

> Append, não reescrita. Preserva tudo acima. Modo READ-ONLY estrito.

## Estado verificado
- **HEAD:** `a312174a` (esperado ✔) — "DECISION-0112 ADENDO - Clayton resolve os 4 parâmetros"
- **Branch:** `rescue-structural` (✔)
- **Working tree:** limpo exceto 3 autorais protegidos + `docs/memorias/` untracked (✔). Migrations dev 365 (confirmado por logs; não acessei DB).

## Escopo desta análise
Fechamento PJ — PROVISIONAL→ACTIVE, capability por estado, decisões PJ/KYB. Pilar 1 (KYB documental) já desenhado em 0087/0112+ADENDO §10 — **não executar**. Foco no Pilar 2 (lifecycle/delete/capability).

## Regras sobre DECISIONs (reforço aplicável a esta análise)
- DECISOES.md = índice/auditoria, não soberano. Fonte = DECISION original + logs + STATUS/opus + runtime/schema vivo.
- Cabeçalho DOCS-ONLY = sessão de promulgação; runtime pode ter evoluído depois (ex.: 0097 diz "nasce provisional", runtime hoje nasce DRAFT — evolução pós-0097 via DT, NÃO reabrir 0097).
- Divergência declarado×verificado → frente documental própria, nunca editar DECISION antiga.

## Mapa tema PJ → DECISION ou GAP
| Tema | DECISION que governa | Status | Observação |
|---|---|---|---|
| Nascimento PJ (2 momentos, fiscal-first) | **0097** (D1/D2) ratifica **0075** (Opção B) | DECIDIDO docs-only; runtime vivo | `createCompany` materializado |
| Empresa nasce inerte (DRAFT) | DT-PJ-COMPANY-APPEARS-BEFORE-ONBOARDING (CLOSED) | IMPLEMENTADO | runtime evoluiu: 0097 dizia "provisional", hoje nasce **DRAFT** (não regride) |
| Vocabulário de ativação (par `primary_company_type_id`+`primary_concept_id`) | **0098** + **0097** D5/D6 | DECIDIDO docs-only | writer `activateCompanyOperationally`; rota `POST /companies/:id/operational-activation` viva |
| Validação compat type↔concept | **0098** D2 (`company_type_allowed_concepts`) | DECIDIDO | sem fallback de concept |
| **DRAFT→PROVISIONAL** (transição) | **0092/0093/0098** + DT lifecycle | **DECIDIDO + IMPLEMENTADO** | atômico com gravação do par; e2e 7/7; CHECK `chk_companies_company_status_lifecycle` |
| **PROVISIONAL→ACTIVE** (transição) | — | **GAP** | CHECK permite ACTIVE, mas **nenhuma DECISION define trigger/regra**; runtime nunca seta ACTIVE |
| Separação dos eixos de estado | **0097 D4** / **0089** / **0092** / **0093** | DECIDIDO | 3 colunas + KYB, independentes (ver abaixo) |
| Capability **financeira** por KYB | **0088** (F2-C) | DECIDIDO docs-only; `evaluateKybLayer` implementado | gate em `kyb_status='approved'`, fail-closed, strict p/ dinheiro |
| Capability **social** (publish_feed/cast_vote) por KYB | **0094** | DECIDIDO docs-only | gate de broadcast/voz pública |
| Capability **publicação/oferta** por KYB | **0099/0100/0101** | DECIDIDO docs-only | `company_concept_publications` gated kyb approved + cascata de revogação |
| Capability por **LIFECYCLE** (o que ACTIVE habilita) | — | **GAP (provável intencional)** | capability ancora em KYB, não em `company_status` |
| **DELETE / remoção segura de empresa** | — | **GAP** | `deleteCompany` existe em código (compensação manual por DELETEs, sem tx — 0075); soft-delete via `companies.status='closed'` sem desenho governante |
| KYB documental (storage/provider) | **0087** (SSOT) + **0112** + ADENDO §10 | DECIDIDO docs-only; runtime pendente | Pilar 1 — não executar; ordem F-STORAGE-PORT→...→RELEASE-GATE |

## A) PROVISIONAL → ACTIVE
1. **Existe DECISION governando a transição?** PARCIAL. **DRAFT→PROVISIONAL** sim (0092/0093/0098, implementado). **PROVISIONAL→ACTIVE: NÃO.** O CHECK lista ACTIVE como estado válido, mas nenhuma DECISION define **quem/quando/por quê** promove PROVISIONAL→ACTIVE. Runtime hoje só faz `DRAFT→PROVISIONAL` (e nunca regride) — ACTIVE nunca é setado.
2. **Qual?** DRAFT→PROVISIONAL: 0098 (rota de ativação/par) + 0092/0093 (company_status=lifecycle). PROVISIONAL→ACTIVE: **nenhuma**.
3. **ACTIVE depende de KYB aprovado?** **NÃO decidido — e a arquitetura diz que NÃO deveria depender.** 0097 D4 crava os quatro eixos como INDEPENDENTES; capability é gateada em `kyb_status` diretamente (0088/0094/0099), não no lifecycle. Logo `company_status='ACTIVE' ≠ KYB approved`. **⚠️ Risco:** uma frente futura pode tentar wirar "ACTIVE = KYB approved" e violar a independência — precisa de DECISION explícita antes.
4. **company_status é lifecycle e kyb_status é verificação?** **SIM, fortemente decidido** (0097 D3/D4, 0089, 0092, 0093). `company_status`/`is_verified`/validação presencial **nunca** verificam PJ; `fiscal_identities.kyb_status` é a verdade fiscal única.
5. **GAP registrado:** (a) regra/trigger de PROVISIONAL→ACTIVE indefinida; (b) semântica de ACTIVE (o que muda ao virar ACTIVE) indefinida — possível por design (capability ≠ lifecycle), mas precisa de declaração explícita para "operar conforme o estado" do objetivo macro.

## B) Capability/permissão por estado
**Modelo soberano: capability ancora em `kyb_status`, NÃO em `company_status`.** Os eixos (0097 D4 + DT-PJ-COMPANY-LIFECYCLE-STATUS-CONFLATION):
- `companies.status` — operacional/soft-delete: `active/inactive/suspended/closed` (CHECK).
- `companies.company_status` — lifecycle PJ: `DRAFT/PROVISIONAL/ACTIVE/SUSPENDED` (CHECK); `VERIFIED/APPROVED` só compat legado.
- `fiscal_identities.kyb_status` — verificação fiscal: `pending/approved/rejected/suspended/closed` (CHECK).

1. **DRAFT pode fazer?** Sem DECISION de capability formal; comportamento governado por DT lifecycle: estar em configuração; conta no limite anti-fraude (`DRAFT+PROVISIONAL ≤ 3/CPF`); NÃO aparece como "cadastrada"; frontend esconde upload (docs são pós-finalização).
2. **PROVISIONAL pode fazer?** Existir; aparecer como provisória; **receber crédito/split** (0088 §3.8 — "dinheiro entra"); manter presença/perfil básico (0094 §4.3). **NÃO pode** (porque kyb≠approved): sacar/transferir/pagar/payout como debitante (0088), publish_feed/cast_vote como PJ (0094), publicar oferta (0099/0100/0101).
3. **ACTIVE pode fazer?** **Nenhuma DECISION governa o que ACTIVE especificamente habilita** (capability segue KYB, não lifecycle). GAP — provavelmente intencional, mas não declarado.
4. **KYB-approved libera?** Operação financeira sensível (0088 F2-C); voz pública social — publish_feed/cast_vote (0094); publicação/oferta — `company_concept_publications` (0099/0100), revogada em cascata se KYB cair (0101).
5. **Separação lifecycle × KYB?** SIM, decidido (0089/0092/0093/0097 D4).
6. **Espalhamento:** capability-por-KYB está em **3 DECISIONs** (0088 financeiro · 0094 social · 0099/0100/0101 publicação) — coerentes, mesma âncora `kyb_status`. Falta apenas uma DECISION-índice que declare "capability = função de kyb_status; lifecycle não concede capability".

## C) DECISIONs relevantes
| DECISION | Tema | Decidiu | Não decidiu | Relação com PJ fechada |
|---|---|---|---|---|
| **0075** | Nascimento page-actor (drift) → Opção B | fiscal-first transacional vence | atomicidade real (createCompany sem tx; DELETEs manuais) | base do nascimento; dívida de tx aberta |
| **0085/0086** | Fiscal identity técnica + writer KYB auditado | `fiscal_identities`; transições `pending→approved/rejected` | `suspended`/`closed`/resubmit/`under_review` | KYB writer = coração da verificação |
| **0087** | SSOT documental KYB | `fiscal_identity_documents`, âncora `fiscal_identity_id`, mínimo p/ approved | provider/storage (→0112) | Pilar 1 (documental) |
| **0088** | F2-C gate KYB financeiro | dinheiro de PJ exige kyb approved; fail-closed; strict; crédito entra/saída bloqueada | gate comercial não-financeiro (2ª onda) | capability financeira |
| **0089** | Reconciliação verificação | `status`=lifecycle limpo; `company_status`=impuro; kyb=fonte única | schema cleanup completo (→0092/0093) | separação de eixos |
| **0092/0093** | Lifecycle/is_verified cleanup | `company_status`=lifecycle (DRAFT/PROVISIONAL/ACTIVE/SUSPENDED); VERIFIED/APPROVED só compat | trigger PROVISIONAL→ACTIVE | espinha do lifecycle |
| **0094** | Gate KYB social | publish_feed/cast_vote de PJ exigem kyb approved (Opção E) | demais ações sociais; impl. | capability social |
| **0097** | Nascimento + ativação operacional (modelo) | 2 momentos; 4 eixos independentes; page-actor; CONCEPT | qualquer execução; trigger→ACTIVE; delete | planta-mãe da PJ |
| **0098** | Vocabulário ativação (par primary_*) | par é SSOT; businessType/Category/hybrid = legado; 2 eixos separados | reconciliação runtime; rota | ativação operacional |
| **0099/0100/0101** | Publicação/oferta + cascata | publish≠activate; `company_concept_publications` gated kyb; revogação cascateia | execução completa | capability comercial |
| **0102** | Elegibilidade de domínios no onboarding | governança KYB→domínios | writer (DomainSelector neutralizado) | onboarding |
| **0103** | CNAE como evidência fiscal | CNAE vem da casa fiscal, não de `companies` | exec (F-COMPANY-ACTIVITY-GHOST-CLEANUP) | evidência fiscal |
| **0112 (+ADENDO §10)** | Storage documental KYB | port S3-compatible; malware scan port; retenção LGPD; submit user-facing | runtime (fatias futuras) | Pilar 1 |

## O que já foi decidido e não deve ser reaberto
- `company_documents` **morta** — não recriar (tombstone upload+readers+admin; 0087/0090).
- `fiscal_identity_documents` é o **SSOT documental KYB** (âncora `fiscal_identity_id`) — 0087.
- `company_status` **não é KYB** / não verifica PJ — 0089/0092/0093/0097 D3.
- `kyb_status` pertence à **fiscal identity**, fonte única de verificação — 0085/0088/0094.
- Upload documental **não aprova KYB** e **não muda company_status/kyb_status** — 0088/0090/0097.
- Upload documental **não libera financeiro** (dinheiro só com kyb approved via F2-C) — 0088.
- **Frontend não cria verdade** — projeta o par soberano e kyb_status; onboarding não salva verdade operacional em metadata — 0098 D10/D11.
- Nascimento **fiscal-first transacional** (Opção B) — 0075/0097 D2 (não reabrir A/B).
- Empresa nasce **inerte** (DRAFT), não nasce vendendo — 0097 D1.
- Par `primary_*` é o SSOT da ativação; `hybrid` atômico é anti-padrão — 0098.
- Os **4 eixos são independentes** (KYB ≠ lifecycle ≠ prontidão operacional ≠ visibilidade) — 0097 D4.

## O que ainda depende de Clayton
- **DECISION-0112 ADENDO §10:** parâmetros de produto **já resolvidos** (a312174a); falta só autorizar execução das fatias (F-PJ-DOCUMENT-STORAGE-PORT etc.). Executora parada por STOP legítimo — trava ativa.
- **PROVISIONAL→ACTIVE:** decisão de produto pendente — quem/quando promove e o que ACTIVE significa (GAP A).
- **Remoção/encerramento seguro de empresa:** decisão de produto pendente — soft-delete vs hard-delete, efeito em fiscal identity/page-actor/ledger (GAP DELETE).
- **2ª onda de capability** (0088 §6, 0099): gate KYB de operação comercial não-financeira (produto/oferta/evento) — desenho posterior.
- **Reconciliação de vocabulário** (0098): aposentar businessType/businessCategory/hybrid — execução pendente.

## Contradições aparentes
1. **0097 D1 "nasce provisional" × runtime "nasce DRAFT".** Não é conflito material — é evolução pós-0097 (DT-PJ-COMPANY-APPEARS, decisão Clayton "Caminho 1"). 0097 não deve ser reaberta; o estado vivo é DRAFT→PROVISIONAL. Candidato a nota de sincronização, não a reescrita.
2. **Objetivo macro "opera conforme o estado" × capability ancora em KYB, não em lifecycle.** Aparente tensão: "o estado" que governa capability é `kyb_status`, não `company_status`. Precisa explicitar qual "estado" o produto quer dizer (provável: KYB). Não é contradição entre DECISIONs — é lacuna de declaração.
3. **Risco latente (não-contradição ainda):** wirar `ACTIVE = KYB approved` violaria 0097 D4 (eixos independentes). Alertar antes que alguém implemente.

## Recomendações para consolidação (via NOVA DECISION, nunca reescrita)
1. **DECISION de transição PROVISIONAL→ACTIVE** — definir trigger, regra e o que ACTIVE habilita (ou declarar explicitamente que ACTIVE é puramente lifecycle e não concede capability). Fecha GAP A.
2. **DECISION de remoção/encerramento seguro de empresa** — soft-delete (`companies.status='closed'`) vs hard-delete; efeito em page-actor, fiscal_identity, company_users, ledger (fronteira negativa Bank); idempotência/tx (resolve dívida de tx da 0075). Fecha GAP DELETE — pré-condição do objetivo macro "pode ser removida com segurança".
3. **DECISION-índice de capability-por-KYB** — declarar formalmente "capability = f(kyb_status); lifecycle não concede capability", consolidando 0088/0094/0099 sob um princípio. Blinda contra o risco #3.
4. **Nota de sincronização 0097** (DRAFT vs provisional) — docs-only, sem reabrir a DECISION.
Ordem sugerida: norma (capability-índice) → PROVISIONAL→ACTIVE → remoção segura. Identidade/estado antes de comportamento.

## STOPs para a executora futura
1. **STOP — não executar Pilar 1** (F-PJ-DOCUMENT-STORAGE-PORT e seguintes) até a verificação read-only da 0112+ADENDO §10 ser concluída (trava ativa declarada no envelope).
2. **STOP — não wirar `company_status='ACTIVE' = KYB approved`** sem DECISION explícita (violaria 0097 D4; capability é por `kyb_status`).
3. **STOP — não implementar PROVISIONAL→ACTIVE** sem DECISION de transição (GAP A — regra/trigger indefinidos).
4. **STOP — não implementar delete/encerramento de empresa** sem DECISION de remoção segura (GAP DELETE; `deleteCompany` atual é compensação manual sem tx).
5. **STOP — não promover lifecycle via upload de documento** (residual OPEN da DT-PJ-COMPANY-LIFECYCLE-STATUS-CONFLATION: `uploadCompanyDocument` legado ainda promoveria DRAFT→PROVISIONAL; rota reachable). Endereçar junto da frente documental 0087.
6. **STOP — não recriar `company_documents`** nem reabrir circuito legado (tombstoned).
7. **STOP — não fundir eixos** em `company_status` (manter 3 colunas + KYB separados — 0097 D4).
8. **STOP — não aposentar businessType/businessCategory/hybrid** fora de frente de reconciliação própria (0098 D8 — acoplamento real no marketplace).

---

_Fim da análise sessão 2. Próximas atualizações: append por tema, preservando histórico._

---
<!-- append-only: acrescentado pela EXECUTORA unificard — 2026-06-06 — não editar/reescrever conteúdo do especialista -->

## Nota de coordenação — ACTIVE=B ratificado por Clayton

Clayton ratificou que, no MVP, `company_status='ACTIVE'` deve ser tratado como vestigial / compatível / não-operacional.

Consequências:
- Não criar writer runtime `PROVISIONAL → ACTIVE`.
- Não usar `ACTIVE` como proxy de KYB.
- Não liberar financeiro por `company_status`.
- O “botão de poder” da PJ é `fiscal_identities.kyb_status`, combinado com gates de autoridade/KYB já decididos.
- Capability deve permanecer ancorada em KYB/authority, não em lifecycle decorativo.

Observação:
Esta memória não canoniza a decisão. A decisão ACTIVE=B precisa ser registrada institucionalmente em futura frente documental ou próximo commit autorizado.

--------------------------------------------------------------
RESPOSTA IA-DECISOES — 2026-06-06 (hora não disponível ao agente)
Status: RESPONDIDO
--------------------------------------------------------------

NOTA DE FORMATO: a comunicação acima é uma *Nota de coordenação*, não um `PEDIDO DA EXECUTORA` com `Status: ABERTO` (não há campo Status para virar). Respondi mesmo assim. Para o próximo, use o template `PEDIDO DA EXECUTORA … Status: ABERTO` para eu poder flipar o status conforme o protocolo.

VEREDITO:
A nota ratifica **ACTIVE=B** (`company_status='ACTIVE'` = vestigial/compat/não-operacional no MVP; capability ancora em `fiscal_identities.kyb_status` + gates de autoridade). **Isto é consistente com a norma vigente e NÃO contradiz nenhuma DECISION** — é a resolução, na direção segura, do **GAP A** que registrei na sessão 2 (transição/semântica de PROVISIONAL→ACTIVE indefinida; risco de wirar "ACTIVE = KYB approved"). Alinha-se a 0097 D4 (os 4 eixos são independentes) e ao modelo de capability-por-KYB (0088/0094/0099). **Porém:** como a própria executora reconhece, **a minha memória NÃO canoniza** — ACTIVE=B é hoje *estado de coordenação ratificado verbalmente*, ainda **sem cartório**. Precisa de **nova DECISION** (não editar 0092/0093/0097). Próximo número livre = **0113**.

DECISIONs LIDAS:
- 0097 (D4 — 4 eixos independentes; nascimento/ativação)
- 0092 / 0093 (company_status = lifecycle; CHECK DRAFT/PROVISIONAL/ACTIVE/SUSPENDED; VERIFIED/APPROVED só compat)
- 0088 (F2-C — capability financeira gateada em kyb_status)
- 0094 (capability social gateada em kyb_status)
- 0099 / 0100 / 0101 (capability publicação/oferta gateada em kyb_status + cascata)

MAPA DECISÓRIO:
| Tema | DECISION | O que decidiu | O que não decidiu | Status |
|---|---|---|---|---|
| Lifecycle company_status | 0092/0093 | `company_status` é lifecycle; CHECK inclui ACTIVE; VERIFIED/APPROVED só compat | se algo promove/lê ACTIVE p/ capability | DECIDIDO docs-only |
| Eixos independentes | 0097 D4 | KYB ≠ lifecycle ≠ prontidão ≠ visibilidade | semântica fina de cada estado lifecycle | DECIDIDO docs-only |
| Capability por KYB | 0088/0094/0099 | dinheiro/voz/oferta exigem kyb approved | índice único declarando "lifecycle não concede capability" | DECIDIDO docs-only |
| **ACTIVE=B (vestigial)** | **—** (nota de coordenação) | que ACTIVE é não-operacional no MVP; capability fica em KYB | **falta cartório** (nova DECISION) | **RATIFICADO, NÃO CANONIZADO → GAP A em fechamento** |
| PROVISIONAL→ACTIVE writer | — | (executora: NÃO criar writer) | — | resolvido por não-fazer; consolidar na 0113 |

LACUNAS:
- **ACTIVE=B sem DECISION formal** — é o único item desta nota. Recomendo DECISION-0113.
- **SUSPENDED (lifecycle PJ)** — semântica/trigger ainda indefinidos (quem suspende, efeito). Candidato a entrar na mesma 0113 (semântica completa do lifecycle).
- **Remoção/encerramento seguro de empresa (GAP DELETE da sessão 2)** — segue ABERTO; não é tocado por esta nota.

DECISÕES QUE NÃO DEVEM SER REABERTAS:
- Os 4 eixos são independentes (0097 D4) — ACTIVE=B reforça, não revoga.
- Capability vem de `kyb_status`/authority, nunca de `company_status` (0088/0094/0099).
- `company_status` não verifica PJ (0089/0092/0093/0097 D3).
- `VERIFIED`/`APPROVED` em company_status = só compat legado (0093) — ACTIVE=B não os ressuscita.
- Não editar 0092/0093/0097 para "encaixar" ACTIVE=B — isso é nova DECISION, não emenda de cabeçalho.

DEPENDÊNCIAS DE CLAYTON:
- ACTIVE=B já **ratificado** por Clayton (verbal/coordenação); falta apenas o **ato documental** (autorizar a frente da DECISION-0113 ou o commit). Decisão de *quando* canonizar é de Clayton.
- Remoção segura de empresa (GAP DELETE) — ainda pendente de decisão de produto de Clayton.

RECOMENDAÇÃO:
1. Registrar **DECISION-0113 docs-only** fixando a **semântica do lifecycle `company_status`**: ACTIVE = vestigial/compat/não-operacional; nenhum writer `PROVISIONAL→ACTIVE`; capability não deriva de lifecycle (consolida o princípio de 0088/0094/0099). Aproveitar para declarar SUSPENDED. Texto-base = minha "Recomendação para consolidação" #1+#2 da sessão 2.
2. **Não** alterar 0092/0093/0097 (cabeçalho descreve a sessão; ACTIVE=B é estado consolidado/novo, não emenda).
3. Manter ACTIVE no CHECK (não remover) — é compat; só não promover/ler para capability.

STOPs:
- **STOP** — não criar writer runtime `PROVISIONAL→ACTIVE` (reafirma STOP #3 da sessão 2; agora ratificado).
- **STOP** — não usar `company_status='ACTIVE'` como proxy de KYB nem liberar financeiro por lifecycle (reafirma STOP #2 da sessão 2).
- **STOP** — não tratar esta nota (nem esta memória) como norma soberana; é insumo. Capability/ACTIVE só viram regra vigente após a DECISION-0113.
- **STOP** — não fundir eixos em `company_status` (0097 D4).

FIM DA RESPOSTA IA-DECISOES (sessão 3 / ACTIVE=B)
--------------------------------------------------------------

---

--------------------------------------------------------------
RESPOSTA IA-DECISOES — 2026-06-10
Status: RESPONDIDO
Frente: marketplace residual traps / DECISION-0113 / inventory scope / W2-W4
HEAD no momento da resposta: b6cc69a3 (decisions: DECISION-0115 human birth vertical root decisions)
Branch: rescue-structural ✔
Revalidado no vivo: SIM — leitura direta de DECISION-0113 completa, DECISION-0115, STATUS_EXECUCAO_GLOBAL, REMEDIATION_DECISIONS_LOG (entradas 0113/0114/0115 + ADENDO 0113), DT registradas.
Nota: HEAD da resposta (b6cc69a3) é POSTERIOR ao HEAD do pedido (1d42a9d2). DECISION-0115 promulgada entre os dois. NÃO afeta este pedido (0115 não toca marketplace/inventory/W2-W4/0113).
--------------------------------------------------------------

**VEREDITO POR QUESTÃO:**

**Q1 — `inventory/movements` sem actorId: exige DECISION de produto ANTES do patch?**

DEPENDE da opção escolhida. Não é binário.

- Opções (a) obrigar actorId e (b) escopar representáveis = **aplicação direta da norma vigente** (DECISION-0113 D1/D2/D5 + actor-first). NÃO exigem nova DECISION. São o padrão mandado pela norma. Porém: há **caller frontend vivo** (`api/marketplace.ts:740 getMovements(variantId)` chama SEM actorId) — a execução de (a) ou (b) QUEBRA esse caller; isso exige confirmação de Clayton sobre qual opção + tratamento do frontend, mas não exige nova DECISION arquitetural no log.
- Opções (c) agregar sem actor_id e (d) só admin institucional = **decisão de produto** (alteram o contrato semântico do endpoint). SIM, exigem confirmação de Clayton (ao menos verbal/envelope) antes do patch.

Resumo Q1: (a)/(b) = norma vigente + confirmação simples de Clayton sobre qual + tratamento do caller. (c)/(d) = decisão de produto antes do patch. Nova DECISION formal só se (c)/(d) forem escolhidas.

---

**Q2 — Há DECISION vigente que governe AUTORIDADE sobre SLA/reputação/disputa em marketplace?**

NÃO há DECISION específica de domínio para autoridade em SLA-contracts/reputation-snapshots/disputes.

O que existe:
- DECISION-0113 (princípio): actorId body-driven precisa de `canRepresentActor(body.actor_id)` — binding com principal autenticado. Aplica-se a W2/W3/W4 no momento da materialização.
- AUTHORITY_PRECEDENCE: vence a trava mais restritiva; produto é a camada mais fraca.
- `can_manage_marketplace` (default company): gate herdado em runtime — registrado no DT como suficiente para writes governance, mas SEM DECISION explícita de domínio definindo quem é elegível (só company? marketplace admin? qualquer representável?).

GAP confirmado: não há DECISION que formalize o modelo de autoridade de domínio para governança de marketplace (SLA/reputação/disputa). É lacuna documentada pelo DT `DT-MARKETPLACE-GOVERNANCE-INMEMORY-ACTOR-TARGET-REACTIVATION-TRAP`.

---

**Q3 — As 4 opções de inventory scope: aplicação de norma ou decisão nova?**

| Opção | Classificação | Exige nova DECISION? |
|---|---|---|
| (a) obrigar actorId | Aplicação de norma (DECISION-0113 D1/D2; actor-first) | NÃO — só confirmação de Clayton qual das duas norma-alinhadas |
| (b) escopar representáveis | Aplicação de norma (DECISION-0113 D2/D5; canActAs) | NÃO — mais refinada que (a); idem |
| (c) agregar sem actor_id | Decisão de produto (muda semântica/contrato do endpoint) | SIM — ao menos registro no DT com confirmação de Clayton |
| (d) só admin institucional | Decisão de produto (cria categoria de acesso nova) | SIM — ao menos registro no DT com confirmação de Clayton |

---

**Q4 — W2/W3/W4: nova DECISION ou gate-on-materialization?**

Gate-on-materialization SEM nova DECISION agora. Justificativa:
1. W2/W3/W4 são in-memory (Maps `.set()`) — zero rows DB, zero efeito persistido. Não há código de produção a corrigir agora.
2. Princípio já governado: quando materializados, aplicar `canRepresentActor(body.actor_id)` + `can_manage_marketplace`. Execução futura de DECISION-0113 — não decisão nova.
3. Nova DECISION agora = inflação de numeração sem conteúdo novo; DT `DT-MARKETPLACE-GOVERNANCE-INMEMORY-ACTOR-TARGET-REACTIVATION-TRAP` JÁ é o mecanismo de gate-on-materialization.
4. SE Clayton quiser formalizar o modelo de autoridade de domínio (quem pode SLA/reputação/disputa) antes da materialização, aí vira nova DECISION — mas é opcional/antecipado, não bloqueante agora.

---

**EVIDÊNCIAS:**

- DECISION-0113 lida na íntegra: D1 (hint não-soberano) · D2 (binding obrigatório canActAs) · D5 (leitura sensível exige binding) · D8 (defesa em profundidade) — confirmam que (a)/(b) são aplicação de norma.
- STATUS_EXECUCAO_GLOBAL.md (2026-06-09): DTs OPEN confirmadas; W5/W6 com STOP money-aware explícito.
- REMEDIATION_DECISIONS_LOG.md: nenhuma DECISION de domínio para SLA/reputação/disputa encontrada.
- DT `DT-MARKETPLACE-GOVERNANCE-INMEMORY-ACTOR-TARGET-REACTIVATION-TRAP`: W2/W3/W4 in-memory; `can_manage_marketplace` herdado; gate-on-materialization é a rota correta.
- Caller frontend `api/marketplace.ts:740` (`getMovements` sem actorId): achado material que impacta opções (a)/(b).

---

**RISCOS:**

1. Aplicar (a)/(b) sem tratar o caller frontend → quebra silenciosa do frontend. Patch coordenado obrigatório.
2. Escolher (c)/(d) sem decisão formal → produto sem cartório; precedente de autoridade não governada.
3. Materializar W2/W3/W4 sem `canRepresentActor` → reactivation-trap; leak cross-actor em writes governance.
4. STOP ativo W5/W6: `disputes/:id/resolve` (refund/credit) e `payment-plan/:id/apply-sla-penalties` (split) são money-aware (M) — exigem três paralelas antes de qualquer patch. NÃO confundir com W2/W3/W4 (in-memory, sem Bank).
5. Abrir nova DECISION de domínio prematuramente → inflação de numeração; Clayton pode não ter contexto de como o Trilho B se materializa.

---

**RECOMENDAÇÃO:**

1. inventory/movements: Clayton escolhe (a) ou (b) — norma-alinhadas, sem nova DECISION. Patch + tratamento do caller frontend no mesmo corte. Se (c)/(d), registrar no DT antes.
2. W2/W3/W4: manter como DT com aviso gate-on-materialization. NÃO abrir nova DECISION agora. Na materialização do Trilho B, executor pega o DT e aplica `canRepresentActor` + gate de domínio — nessa hora, se o modelo for não-trivial, Clayton decide.
3. DECISION de domínio (SLA/reputação/disputa): NÃO abrir agora. Deixar para quando a materialização do Trilho B for iminente.
4. W5/W6: STOP ativo — não tocar antes das três paralelas.

---

**STOPs:**

- STOP — não executar patch de inventory/movements com opção (c) ou (d) sem confirmação/registro de Clayton.
- STOP — não materializar W2/W3/W4 em DB sem `canRepresentActor(body.actor_id)` (DECISION-0113 D2).
- STOP — não tocar W5/W6 (`disputes/resolve`, `payment-plan/apply-sla-penalties`) sem três paralelas (money-aware M).
- STOP — não tratar esta resposta como GO; é insumo para IA Diretora/Clayton decidir qual opção de scope de inventory executar.
- STOP — não abrir nova DECISION para W2/W3/W4 agora (DT já é o gate correto).
- STOP — não confundir W2/W3/W4 (in-memory, sem Bank) com W5/W6 (money-aware, Bank).

FIM DA RESPOSTA IA-DECISOES — 2026-06-10
--------------------------------------------------------------
