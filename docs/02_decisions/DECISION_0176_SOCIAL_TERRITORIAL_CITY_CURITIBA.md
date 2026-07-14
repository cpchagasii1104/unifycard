# DECISION-0176 — Audiência Social Territorial por Cidade · Piloto Curitiba

- **Status:** DECIDIDO · DOCS-ONLY · MATERIAL NÃO INICIADO · AGUARDA AUDITORIA YALA (2026-07-14).
- **Base:** `rescue-structural` @ `0cf36aeab`.
- **Autoridade:** Clayton (soberana), sobre o arco read-only S-CITY-0 + S-CITY-0B (matriz de readers vivos de `posts` fechada; forma da audiência territorial preparada).
- **Escopo:** decisão de doutrina e contrato conceitual da **audiência social territorial por cidade** (`same_city`), piloto **Curitiba-only**. **NÃO** autoriza nem materializa: código, migration, DDL/DML, coluna, seed, alteração de runtime Social, alteração de Address/onboarding/writer territorial, Bank, fundo, split, ledger, bairro, N5, nacional. A materialização é envelope próprio com GO/GATE/auditoria/selo.
- **Predecessoras vigentes:** DECISION-0161 (event audience actor-adaptive; enforcement na leitura), DECISION-0162 (post audience relationship refinement; `postVisibilitySql`; enforcement na leitura pela ótica do autor — RATIFICADA/EXECUTADA), DECISION-0074 (residência PF → Location Core), F-ADDRESS-ONBOARDING-CANONICAL-FLOW (writer actor-territorial selado; `resolveActorTerritory(ACTOR_RESIDENCE)`), DECISION-0175 (escala territorial nacional — TRANCADA).

---

## 0. Prova de rastreabilidade normativa (00_AGENT_PROTOCOL §2.2.2)

**Domínios:** Social · Publication · Audience/Visibility · Actor · Address/Territory (fonte consumida) · privacidade · Bank (fronteira negativa).

**SSOTs (nome exato, onde vive):**
- Actor = `actors`;
- residência e vínculo territorial = `addresses` + `address_assignments` (owner_type='actor', role='RESIDENCE', DECISION-0074 + onboarding selado);
- leitura territorial = `resolveActorTerritory(tenantId, actorId, ACTOR_RESIDENCE)` (casa read-only selada);
- publicação = casa canônica viva do Publication Engine (`PublicationEngineService`, actor_id canônico);
- estado/audiência da publicação = contrato canônico do Social/Publication (`posts.visibility` governado + esta extensão territorial);
- território = `countries`/`states`/`cities`/`neighborhoods` por IDs canônicos;
- dinheiro = UnifyBank / `bank_ledger` (fronteira negativa);
- estado operacional = `REMEDIATION_DT_LOG.md`.

**Precedência (00_AGENT_PROTOCOL §2.2.7):** CONSTITUIÇÃO > LEIS > SSOT REGISTRY > ONTOLOGIA > DEMAIS NORMAS > DECISÕES > CARTÓRIO > CÓDIGO > CONVENIÊNCIA.

**Ratificação:** o **frontend nunca cria verdade**; a verdade operacional vive nas casas backend canônicas definidas pelos SSOTs e contratos. **Facade, cache, helper SQL, rota ou serviço paralelo NÃO se tornam SSOT por existirem no backend** — se divergirem do SSOT/norma, são dívida material, não verdade concorrente.

---

## D0 — Escopo

Piloto **Social City exclusivamente para Curitiba**: publicações de Actors PF com **residência actor-scoped vigente**, audiência territorial **por cidade**; o **backend decide**, o frontend apenas solicita e projeta. **FORA:** bairro, N5, Bank, fundos, split, ledger, aliases, nacional, outras cidades, listas de moradores, membership persistida.

## D1 — SSOTs e não duplicação

Residência continua no domínio **Address**; cidade continua no **Location Core**. Social **não** copia endereço, **não** cria residência, **não** cria território. O snapshot da publicação é **estado da audiência daquela publicação**, **não** SSOT residencial (PROHIBITED_STRUCTURES — sem segunda verdade territorial).

## D2 — Dimensão ortogonal (não enum paralelo)

O vocabulário vigente de `posts.visibility` permanece **inalterado**: `public` · `connections` · `only_me`. **`same_city` NÃO entra nesse CHECK.** A audiência territorial é **dimensão ORTOGONAL**: `visibility relacional` **+** `restrição territorial opcional`. A autorização final é a **INTERSEÇÃO** das travas aplicáveis (ver D8).

## D3 — Snapshot no publish

**Decisão: SNAPSHOT NO MOMENTO DA PUBLICAÇÃO.** Forma conceitual:
```
author Actor → actor/RESIDENCE principal vigente → city_id canônico → audience_city_id da publicação
```
**Nome escolhido: `audience_city_id`.** **NÃO** usar `author_residence_city_id` — o campo representa a **plateia territorial da publicação**, não uma cópia da residência do autor.

## D4 — Forma física futura (ratificada conceitualmente; sem materializar)

```
posts.audience_city_id UUID NULL   FK → cities
```
**Sem** criar migration neste ato. **Sem** tabela auxiliar. **Sem** enum de scope adicional agora. **Sem** segunda verdade territorial. **Sem** pré-autorizar `audience_neighborhood_id` (a forma é extensível a bairro no futuro, mas o bairro segue bloqueado por N5).

## D5 — Semântica de NULL e falha fechada

- `audience_city_id IS NULL` → publicação **sem restrição territorial** (comportamento comum).
- autor solicita `same_city` **+** **não** possui `actor/RESIDENCE` vigente → **recusa fail-closed** → **zero write**.

**Proibido:** gravar `same_city` com cidade NULL; interpretar cidade ausente como público; aceitar `city_id` do frontend como autoridade; usar fallback `profile/RESIDENCE`; usar `actor_active_location`.

## D6 — Curitiba-only (trava contra expansão silenciosa)

A forma física pode ser extensível, mas a **ativação material aceita SOMENTE o `city_id` canônico de Curitiba**:
```
resolved author city = Curitiba → same_city elegível
resolved author city ≠ Curitiba → territorial_audience_not_enabled → zero write
```
**Proibida** ativação automática para as demais 26 cidades existentes. **DECISION-0175 (nacional) permanece TRANCADA.** A forma exata da trava é definida no material read-first, mas **deverá**: ser server-side · usar ID canônico · não depender do frontend · não usar nome textual · falhar fechada · possuir **guard contra expansão silenciosa** (uma coluna genérica NÃO pode liberar as 27 cidades).

## D7 — Predicado do leitor

```
viewerActorId + tenantId → resolveActorTerritory(ACTOR_RESIDENCE) → viewer_city_id vigente
→ comparação server-side com posts.audience_city_id
```
Comportamentos: sem residência actor-scoped → **não elegível** (deny); infraestrutura indisponível → **erro propagado** (NUNCA convertido em `false` silencioso); **nenhuma PII** entregue ao Social/frontend; **nenhuma lista de moradores**; **nenhum cache global de "é morador"**. Proibidos: fallback `profile`, `actor_active_location`, cidade textual, CEP, `city_id` do frontend como autoridade.

## D8 — Álgebra de autorização

Autorização final = **INTERSEÇÃO**:
```
tenant
AND status da publicação
AND autoria/moderação governada
AND visibility relacional
AND audiência territorial (quando audience_city_id não-NULL)
```
**A trava mais restritiva vence.** Autoria própria é **cláusula explícita**, não bypass acidental. Moderação **somente por capability governada existente**. Nenhum `admin=true`, role textual ou rota interna cria bypass implícito (PROHIBITED_STRUCTURES).

## D9 — Uma casa canônica de audiência (não canonizar helper por nome)

Existe **um contrato canônico único de decisão de audiência de publicação**. **O nome técnico `postVisibilitySql` NÃO é canonizado como SSOT.** O material pode **evoluir, encapsular ou substituir** o helper atual, desde que preserve **uma única decisão** e **elimine divergências**. **Todos os readers vivos de `posts` devem: (a) compor essa casa canônica; ou (b) ser aposentados.** **Proibido** duplicar o predicado por rota.

## D10 — Readers paralelos e dívida nova (não reabre o selo de 0162)

**Achado read-only (S-CITY-0B), verificado no backend:** o enforcement de audiência vive hoje num único ponto (`social-2.0.service`, via `postVisibilitySql` — feed, posts-do-Actor). Fora dessa casa, há readers paralelos **vivos** que **não** o compõem:
- `/feed` contextual (core/feed) — `WHERE tenant_id=$1` apenas (sem predicado de audiência);
- `/api/feed` legado (services/feed/FeedService) — vocabulário divergente (`'PUBLIC'` maiúsculo vs vivo minúsculo; ramo `1=1`);
- `social.routes` legado (registrado no mesmo `/social`) — sem enforcement canônico;
- **detalhe por ID** — sem casa canônica enforced identificada;
- demais readers compostos (event-feed/service-feed plugins, groups, social-group) — a provar no material.

**Formulação correta (registrada):** a **DECISION-0162 fechou o enforcement no caminho canônico auditado** (permanece válida). O **S-CITY-0B descobriu readers paralelos vivos fora dessa casa** — **achado adicional de convergência, não reabertura do selo anterior.** Cria-se nova dívida:
```
DT-SOCIAL-AUDIENCE-PARALLEL-READERS-BYPASS · OPEN · BLOCKING S-CITY-1
```
Essa DT será **fechada pelo envelope material Social City**, que deverá: compor todos os readers vivos **ou** aposentar os paralelos; **provar detalhe por ID**; impedir bypass por comentário, repost, preview, cache ou rota legada.

## D11 — Temporalidade

- edição de **conteúdo** mantém o snapshot;
- edição **explícita da audiência** re-resolve a residência e cria **novo snapshot** (se autor sem residência e pedir `same_city` → falha fechada, D5);
- **repost** é nova publicação e recebe novo snapshot;
- post **legado** com `audience_city_id=NULL` mantém comportamento atual;
- mudança de endereço do **autor** **não** retargeta publicação antiga;
- mudança de endereço do **leitor** altera **sua** elegibilidade atual;
- histórico da audiência **não** é reescrito silenciosamente.

## D12 — Privacidade e fronteiras

Social recebe **apenas decisão booleana** ou o `city_id` necessário à policy; **nenhum** endereço/CEP/número/complemento/coordenada sai de Address; logs **não** carregam endereço; erros **não** revelam residência específica; frontend **não** recebe lista de moradores; cache **não** transforma decisão territorial em PII (DECISION-0171 §11; CONSTITUIÇÃO Art. VIII/X). **Ratificado:** Address **intocado**; Bank **intocado**; bairro **bloqueado por N5**; nacional **trancado**; **Δbank=0**.

---

## Efeito

- **DECISION-0176 DECIDIDA / DOCS-ONLY.** Fixa: `same_city` como dimensão ORTOGONAL à visibility; snapshot territorial no publish em `audience_city_id`; predicado do leitor via `resolveActorTerritory`; NULL = sem restrição / same_city sem residência = falha fechada; Curitiba-only com guard anti-expansão; uma casa canônica única de audiência; e a nova dívida `DT-SOCIAL-AUDIENCE-PARALLEL-READERS-BYPASS` (bloqueante do S-CITY-1).
- **Material Social City permanece TRANCADO** até GO/GATE/auditoria próprios.
- **AGUARDA UMA ÚNICA AUDITORIA YALA.** Nenhum material é iniciado por este documento.
