# LEI DE COERÊNCIA SISTÊMICA — UNIFICARD

Status: CANÔNICO · VIGENTE · NÃO INTERPRETÁVEL
Tipo: LEI FUNDAMENTAL DE ARQUITETURA SISTÊMICA
Escopo: GLOBAL

Subordinação:

* CONSTITUICAO_UNIFICARD.md
* LEIS_OPERACIONAIS_UNIFICARD.md

Referência obrigatória:

* SSOT_REGISTRY_UNIFICARD.md
* 18_DOMAIN_ONTOLOGY_UNIFICARD.md
* CORE_IMUTAVEL.md
* 07_NOMENCLATURA_CANONICA.md
* VOCABULARIO_CANONICO_UNIFICARD.md
* 00_AGENT_PROTOCOL.md

**Documentos operacionais (raiz do repositório; não substituem esta lei):**

* `CURSOR_PROMPT_ACTOR_IDENTITY.md` — execução e arquivo §**4.8** (identity / actor / writer)
* `CURSOR_PROMPT_AUTHORITY_LAYER.md` — execução §**4.9** e §**5.16** (authority, convergência de código; remissão normativa sempre aqui)

---

# 1. FINALIDADE

Esta lei define a **estrutura macro do sistema UnifiCard** e estabelece como todas as suas dimensões coexistem de forma coerente.

Ela existe para:

* unificar pilares, SSOTs, CORE, módulos e navegação
* eliminar ambiguidades estruturais
* impedir conflitos entre camadas
* garantir que o sistema opere como **um único organismo econômico coerente**

---

# 2. PRINCÍPIO FUNDAMENTAL

> **O sistema é único.
> Nenhuma camada pode criar uma realidade paralela.**

---

# 3. ESTRUTURA MACRO DO SISTEMA

O sistema é composto por **5 camadas coexistentes e complementares**:

---

## 3.1 PILARES (DIMENSÕES UNIVERSAIS)

Representam as dimensões fundamentais da realidade do sistema.

Pilares canônicos:

* money
* time
* identity
* state
* event
* authority

Função:

* definir **dimensões universais**
* atravessar todos os módulos
* NÃO dependem de implementação

### 3.1.1 Taxonomia (ontologia, dimensão, SSOT)

* **ConceptPillars** (ontologia — `18_DOMAIN_ONTOLOGY_UNIFICARD.md`): impacto e invariantes semânticos do núcleo conceitual.
* **Pilares listados nesta secção**: dimensões universais da realidade do sistema, **formalizadas pela mesma ontologia** (`ConceptPillars`) e aqui utilizadas como **base estrutural na lei**. **Não constituem taxonomia paralela**: são o **mesmo núcleo ontológico noutro nível de uso** (lei macro vs documento de ontologia).
* **SSOT** (secção 3.2): execução — fontes de verdade que materializam cada dimensão.

### 3.1.2 Desambiguação de `event`

* **Pilar `event` (§3.1)**: dimensão universal — acontecimentos como realidade sistémica (causalidade, histórico, o que *ocorreu* no modelo).
* **Domínio de produto** (ex.: “evento” agendado, bilheteira, calendário social): agregado ou módulo de negócio — **não** confundir com o pilar abstracto; usar nome de módulo/entidade explícito na implementação e na norma operacional.
* **Infraestrutura** (fila, message bus, webhooks, *streaming* técnico): transporte ou canal — **não** substitui o pilar nem um SSOT decisório de estado.

---

## 3.2 SSOT (FONTES DE VERDADE)

Cada pilar possui uma ou mais fontes únicas de verdade.

Exemplos:

* money → `bank_ledger`
* identity → `actors`
* inventory → `inventory_movements`
* semântica → `CONCEPT`

Função:

* decidir estado real
* impedir duplicação
* garantir consistência

---

## 3.3 CORE IMUTÁVEL (INFRAESTRUTURA)

São sistemas estruturais que viabilizam os pilares.

Exemplos:

* agenda universal (tempo)
* actors (identidade)
* auditoria append-only
* persistência de ocorrências no domínio (entidade de negócio; ver §3.1.2 — distinto do pilar `event` e de filas técnicas)

Função:

* implementar pilares
* garantir funcionamento sistêmico
* NÃO definir domínio de negócio

---

## 3.4 MÓDULOS (DOMÍNIOS OPERACIONAIS)

São unidades funcionais do sistema.

Exemplos:

* bank
* marketplace
* social
* agenda
* services
* etc

Função:

* materializar comportamento
* compor múltiplos pilares
* entregar valor ao usuário

---

## 3.5 NAVEGAÇÃO (ORGANIZAÇÃO DO SISTEMA)

Inclui:

* N1
* N2
* estrutura de exploração

Função:

* organizar acesso ao sistema
* NÃO define semântica
* NÃO define verdade

---

# 4. REGRA DE SOBERANIA

## 4.1 PILARES

> Apenas o pilar define sua própria lógica.

---

## 4.2 SSOT

> Apenas o SSOT define o estado final.

---

## 4.3 CORE

> CORE implementa, mas não decide domínio.

---

## 4.4 MÓDULOS

> Módulos usam pilares, mas não os controlam.

---

## 4.5 NAVEGAÇÃO

> Navegação organiza, mas não define significado.

---

## 4.6 DOMÍNIO FINANCEIRO — ACESSO AO SSOT

Módulos **fora** do domínio **Bank** (código sob `modules/bank` / contratos por ele expostos) **não** podem:

* executar SQL direto sobre as tabelas SSOT financeiras de runtime: `bank_ledger`, `bank_transactions`, `bank_accounts`, `bank_splits` (emenda 2026-08-02, ratificada: o split é invariante da Lei 5, `BANK_SEMANTICS.md` já o declarava soberano e o enforcement — `validate-schema-code-coherence.mjs:636` — já o cobria; a lei estava mais estreita que o próprio gate);
* usar essas tabelas em strings de *query* embutidas em serviços de outros domínios;
* calcular saldo canónico ou movimentar dinheiro real sem passar pelas APIs do Bank;
* **inferir** saldo ou posição financeira (incluindo heurísticas ou agregações que substituam o ledger);
* **reconstruir** estado financeiro canónico fora do SSOT e das APIs do Bank;
* **derivar** resultado financeiro decisório apenas a partir de cadeias de eventos, logs ou *snapshots* comerciais, em substituição ao fluxo canónico do Bank.

Toda leitura/escrita e **toda derivação financeira** que afete verdade contábil ou decisão de dinheiro real **DEVE** ocorrer via **serviços ou repositórios do domínio Bank**. Migrações versionadas, scripts de backfill e ferramentas operacionais podem tocar o schema; isso **não** autoriza lógica de produto duplicada fora do Bank.

---

## 4.7 CONCORRÊNCIA E CONSISTÊNCIA TRANSACIONAL (FINANCEIRO)

Operações que envolvem:

* bloqueio pessimista (`SELECT … FOR UPDATE`) sobre linhas do SSOT financeiro;
* ordenação determinística de contas (incluindo regra anti-*deadlock*);
* participação na **mesma** transação SQL que persiste movimento contábil;

**DEVEM** existir **no domínio Bank**, ou ser **expostas** por métodos do Bank que aceitam o *client* PostgreSQL da transação já aberta (padrão já usado para transferências e reversões).

É **proibido** a módulos externos:

* definir locking ou ordem de `FOR UPDATE` sobre `bank_*` em substituição a esta regra;
* reimplementar invariantes de saldo ou dupla entrada fora do Bank.

---

## 4.8 DOMÍNIO IDENTITY — ACTOR ÂNCORA E WRITER ÚNICO

### 4.8.1 Writer único

Toda criação de `actors` em **runtime de aplicação** (API, serviços, plugins Fastify, scripts DEV que simulam produto) passa exclusivamente por `actor-writer.service`
(`backend/src/modules/identity/actor-writer.service.ts`):
- `ensureUserActor(tenantId, userId)` — actor humano (`actor_type = 'user'`)
- `ensurePageActor(tenantId, companyId, responsibleActorId)` — entidade empresarial (`actor_type = 'page'`) com âncora humana obrigatória

`INSERT INTO actors` direto é **proibido** fora das exceções normadas abaixo.

**Exceções canónicas** (único `INSERT INTO actors` permitido em `backend/src/` fora do writer):
- `core/identity/identity.service.ts` — **Gate 0** (registo / bootstrap de identidade; ficheiro congelado).
- `modules/social/actor.repository.ts` — **persistência interna** invocada pelo writer e pelo port social (contrato técnico único de INSERT).
- Testes automatizados (`__tests__/`, `*.test.ts`, `*.spec.ts`).

**Ferramentas DEV alinhadas ao domínio real:** o simulador financeiro interno e o seed de companies/serviços criam `users` / `companies` quando necessário e chamam `ensureUserActor` / `ensurePageActor` — sem `INSERT` paralelo em `actors`.

**Bank (lifecycle utilizador):** contas com `owner_type` de utilizador usam `owner_id = users.user_id` (identidade civil da app), resolvendo `bank_accounts.actor_id` a partir do actor `user`; não se usa `actor_id` como owner de wallet onde o contrato do Bank espera `user_id`.

Correções históricas de violação: `modules/groups/votes.service` (actor obtido antes da transação via writer).

### 4.8.2 Actor âncora (responsabilidade civil)

`actors.responsible_actor_id` é obrigatório para entidades não-humanas:
- Aponta para actor humano (CPF) que responde perante o sistema
- Actor humano: `responsible_actor_id = NULL` (é a âncora final)
- Actor sistema: `responsible_actor_id = NULL` (infraestrutura, não civil)
- Garantia no banco: trigger `trg_actors_responsibility`

Proibições:
- `responsible_actor_id` apontando para actor não-humano (sem CPF na cadeia)
- Entidade não-humana sem `responsible_actor_id` (EXCEPTION após Fase 4)

### 4.8.3 CNPJ — responsável legal

Criação de empresa identifica o responsável via:

```
company_users WHERE company_id = X
  AND can_manage_company = true
  ORDER BY role = 'owner' DESC, created_at ASC
  → global_user_id → users → actor humano
  → responsible_actor_id do actor 'page'
```

Sistema não aceita entidade não-humana ativa sem CPF responsável (após Fase 4).

### 4.8.4 Quarentena em cascata

Bloquear actor humano via `atl_blocked_actors` bloqueia efetivamente
todas as entidades onde ele é `responsible_actor_id`.

Consulta: `isActorEffectivelyBlocked()` em `modules/risk-identity`.

### 4.8.5 Actors de sistema

`actor_type IN ('actor_system', 'system')` são infraestrutura.
Não requerem `responsible_actor_id`.
Não representam pessoa física ou jurídica.
Não participam de quarentena por responsabilidade civil.

### 4.8.6 Scripts, migrações e saneamento (não-runtime)

Migrações versionadas, SQL em `backend/scripts/sql/` e scripts operacionais de saneamento **não** são o runtime da API. Podem alterar `actors` com governança e revisão explícitas. **Não** criam precedente para `INSERT INTO actors` em código de produto ou em handlers de pedido.

### 4.8.7 Ontologia social preferencial (vs. legado Genesis)

**Contrato preferido para código novo:** humano = `actor_type = 'user'`; entidade empresarial operacional = `actor_type = 'page'` com `company_id` referenciando `companies`.

O `CHECK` em `actors.actor_type` pode incluir valores legados (`person`, `company`, …) por compatibilidade com o schema genesis — **não** devem ser escolhidos em fluxos novos quando existir equivalente `user` / `page` + tabelas `users` / `companies`.

---

## 4.9 DOMÍNIO AUTHORITY — PERMISSÃO, ACTING ON BEHALF E DELEGAÇÃO

**Fronteira:** §**4.8** define **quem existe** e **quem responde civilmente** (`responsible_actor_id`). §**4.9** define **quem pode executar** operações no sistema em nome de qual **actor** (contexto operacional). **Não** cria identidade, **não** altera ledger, **não** substitui o Bank.

**Terminologia (§7):** na composição sistémica, **AUTORIDADE** = este domínio (§4.9). **Quarentena / bloqueio** (`atl_blocked_actors`, cascata §4.8.4) **restringe ou impede** a atuação mesmo que existam permissões teóricas — deve ser avaliado **antes** ou **como gate** da resolução de authority.

### 4.9.1 Objeto normativo

**Autoridade operacional** = a decisão booleana (ou estruturada) determinística:

```text
No tenant T, o utilizador U pode executar a ação P no recurso R atuando como actor A?
```

- **T** — `tenant_id` (contexto multi-tenant obrigatório).
- **U** — identidade da app (`users.user_id`), alinhada a §4.8.1 / Bank wallet.
- **A** — `actor_id` sob o qual a operação é apresentada (humano `user` ou entidade `page`, etc.).
- **P** — permissão canónica (`permissionKey` ou equivalente no mapa normativo de permissões).
- **R** — recurso alvo quando aplicável (entidade, conta, voto, etc.).

### 4.9.2 Acting on behalf (atuação em nome de)

**Acting on behalf** = o pedido declara **actor A** como contexto de atuação; o sistema **só** prossegue se **U** estiver **autorizado** a agir como **A** para **P** (e **R**).

Isto é **distinto** de `responsible_actor_id`: a âncora civil (§4.8.2) fixa **responsabilidade**; a authority (§4.9) fixa **permissão operacional** na sessão/request. Um humano pode ser âncora de uma empresa e, ainda assim, **não** ter permissão para uma ação específica sem vínculo ou delegação adequados.

### 4.9.3 Fontes de autoridade (ordem conceitual)

A resolução **deve** ser **determinística** (mesmos inputs → mesma decisão) e **auditável**. Fontes típicas (evolutivas no código, **sem** segunda SSOT paralela):

1. **Ownership** — U é o dono do actor A (ex.: actor `user` correspondente a U) ou titular reconhecido da entidade (ex.: vínculo canónico empresa–utilizador via `company_users` e regras do módulo de membros).
2. **Delegation** — delegação explícita e válida (ex.: persistência em `actor_delegation` ou tabela sucessora normada) concedendo a U a capacidade de agir como A para um conjunto de permissões ou escopo. A estrutura normativa da **cadeia**, **níveis** e **limites** está em §**4.9.9**.
3. **System / capability** — capacidades atribuídas a actors de sistema ou rotas internas, **estritamente** delimitadas na norma e no mapa de permissões; **proibido** usar isto para contornar ownership em produto.

A ordem de precedência exata e os detalhes de implementação **devem** residir num **único serviço ou fachada de authority** referenciado no SSOT (ver `SSOT_REGISTRY_UNIFICARD.md` §5.16), não espalhada em `if` ad hoc por módulos.

### 4.9.4 Mapa canónico de permissões

Toda permissão de produto **deve** constar do **mapa canónico** (`MAPA_CANONICO_PERMISSIONS_v1.md` e derivados) e/ou contratos gerados; chaves **desconhecidas** **não** podem ser aceites em caminhos de produção. É **proibido** inventar `permissionKey` apenas no código de feature.

### 4.9.5 Validação obrigatória

Antes de **ações sensíveis**, o runtime **deve** resolver authority:

- mutações que afetem **dinheiro** (chamadas ao domínio Bank, liquidação, payout, etc.) — além de §4.6–§4.7;
- **voto**, publicação em nome de actor `page`, gestão de membros, alteração de dados de empresa;
- qualquer operação onde o utilizador escolhe **actor** diferente do seu `user` padrão.

**Quarentena:** se `isActorEffectivelyBlocked` (ou sucessor) for verdadeiro para **A** ou para a âncora relevante, a ação **deve** falhar independentemente de delegação.

**Nota:** enquanto a convergência completa não for atingida, verificações específicas de domínio (ex.: membership/admin em grupos, organizers, ou serviços financeiros especializados) podem permanecer nos seus repositórios ou serviços. O alvo normativo é a sua migração para o modelo canónico de `PermissionKey` e validação via fachada de authority.

### 4.9.6 Integração com o Bank

O Bank permanece SSOT de **valor** (§4.6). A authority **não** valida saldo; **garante** que o contexto **authorship** / actor apresentado na operação financeira é **coerente** com um utilizador **autorizado** a ordenar aquela movimentação em nome do owner correto (`user_id` / `company_id` conforme contrato da conta). Dupla verificação: **identity + authority + bank invariants**.

### 4.9.7 Proibições

- **Proibido** substituir §4.9 por apenas **middleware** HTTP sem serviço de domínio testável.
- **Proibido** duplicar matrizes de permissão por módulo sem remeter ao mapa canónico e ao SSOT.
- **Proibido** confundir **ser** `responsible_actor_id` com **poder** executar todas as ações (civil ≠ operacional).
- **Proibido** criar tabelas ou enums de permissão **paralelos** ao SSOT de authority sem atualizar a lei e o registry.

### 4.9.8 Estado de implementação e evolução

O repositório pode já conter `authorization.service`, `actor-delegation`, `permission-keys` e rotas que consomem `canActAs`. Isto **não** dispensa a norma: a implementação **deve** convergir para o contrato §4.9 e para **§5.16** do SSOT (fachada única, extensão controlada). Novas migrations para delegação / papéis **devem** ser propostas em RFC breve referenciada na lei ou no prompt operacional, sem violar §5 (não-duplicação).

**Enforcement de dependências (código):** análise estática de imports entre pastas (ex. `dependency-cruiser`) **complementa** esta lei; regras executáveis e fases de endurecimento estão em `docs/01_normative/ARCHITECTURE_DEPENDENCY_BOUNDARIES.md`. **Não** substituem revisão humana nem invariantes de banco.

Toda decisão de authority no runtime dos módulos de produto (`backend/src/modules/*`, excetuando exclusões normadas como domínio `bank`, `identity`, testes e scripts) **deve** ser mediada pela fachada `authority.service` (`backend/src/modules/authority/`), que: aplica verificação de quarentena (§4.8.4); delega a resolução de permissão ao `authorization.service` (core); e mantém consistência com §4.9 e com §**5.16** do SSOT. A utilização direta de `authorization.service` fora desta fachada nos referidos módulos é considerada **estado de transição** e **deve** convergir para `authority.service`.

**Norma de delegação encadeada:** §**4.9.9** (esta secção não cria schema nem altera comportamento actual do código por si só).

### 4.9.9 Delegação normativa — cadeia, níveis e temporalidade

**Conceito.** **Delegação de autoridade** é a capacidade de um **actor** (contexto de origem) permitir que **outro** contexto de atuação execute ações **em seu nome**, mantendo **cadeia explícita** de responsabilidade até um **actor humano** reconhecido pelo sistema (§4.8). Delegação **transmite** permissão operacional de forma **rastreável**; **não cria** identidade nova, **não** substitui o ledger, **não** altera por si só `responsible_actor_id`.

**Princípios invioláveis:** (i) SSOT de identidade (§4.8, §5.1); (ii) responsabilidade humana civil onde a lei a exige (`responsible_actor_id` para entidades não-humanas relevantes); (iii) **rastreabilidade** de cada decisão de “pode” até fonte §4.9.3; (iv) **coerência temporal** — delegação válida só dentro da sua janela de validade ou até revogação explícita.

**Estrutura mínima (conceitual).** Qualquer prova ou registo de delegação **deve** poder exprimir, de forma auditável:

* **actor_origem** — quem delega (actor cujo poder operacional é partilhado).
* **actor_destino** — sob qual actor (ou vínculo resolvível para `actor_id`) a ação será avaliada em `canActAs` / fachada §4.9.8.
* **escopo** — permissões ou `permissionKey`(s) permitidas, ou referência inequívoca ao mapa canónico (§4.9.4).
* **validade temporal** — início e fim, ou condição de invalidade; **proibida** delegação “sem tempo” no sentido de ser impossível determinar se ainda vigora.
* **origem_da_autoridade** — própria (ownership / papel canónico) ou **delegada**, com referência ao **elo anterior** na cadeia quando não for nível 0.
* **preservação da âncora** — a cadeia **deve** permanecer **resolvível** até actor humano §4.8; `responsible_actor_id` **não** é apagado nem contornado por delegação operacional.

**Cadeia de delegação.** A delegação **pode** ser **encadeada** (ex.: A → B → C). Regras obrigatórias:

* cada elo mantém **referência** ao anterior (cadeia **não ambígua**);
* **nenhuma** delegação pode existir **sem** cadeia **completa** até um **actor humano** que feche responsabilidade no modelo §4.8.

**Níveis e subníveis (conceituais, não taxonomia de produto fixa).** “Nível” é **consequência** do comprimento da cadeia delegada, não estrutura rígida paralela:

* **Nível 0** — autoridade **própria**: U age como actor que lhe pertence canonicamente (ex.: `user` de U), sem elo delegado explícito.
* **Nível 1** — delegação **directa** de actor_origem para actor_destino.
* **Nível N** (N ≥ 2) — delegação **encadeada**; N conta elos **delegados** desde a primeira concessão explícita até a actuação corrente.

**Subníveis** (granularidade de escopo dentro de um mesmo elo) **devem** mapear para **escopo** auditável no mapa canónico ou RFC, **não** para “níveis” paralelos não rastreados.

**Limites explícitos (proibições de delegação):**

* **Proibido** cadeia **infinita** ou sem **política** de profundidade máxima **verificável** pelo sistema.
* **Proibido** delegação **sem** escopo definido (ex.: “pode tudo” sem amarra ao mapa ou sem RFC que o defina).
* **Proibido** delegação que **rompa** ou **oculte** `responsible_actor_id` / §4.8.2.
* **Proibido** delegação que **crie** poder **fora** das fontes §4.9.3 (nova autoridade mágica).

**Integração com authority actual.** `authority.service` permanece **único ponto de entrada** em módulos de produto (§4.9.8). `canActAs` e sucessores **devem**, quando a implementação evoluir, **considerar** a **cadeia de delegação** (`delegation_chain`, conceito em §5.16) **além** de ownership imediato. **Esta subsecção não altera** comportamento de código existente até RFC e alterações explícitas.

**Fronteira com outros domínios.** **Não** confundir delegação canónica com **membership** de grupos, organizers ou equipas (§4.9.5): podem **coexistir**; **não** se substituem mutuamente salvo RFC e lei actualizada.

**Schema.** Esta subsecção **não** exige tabela nova; persistência futura **deve** ser proposta em RFC, alinhada a §**5.16**, **sem** segundo SSOT de delegação.

**Ref (consolidação actor-centric, sem duplicar §4.8–§4.9):** `docs/01_normative/ACTOR_TRACEABILITY_CONTRACT.md` — formaliza vocabulário de rastreabilidade e responsabilidade de actors no sistema; **não** substitui esta lei.

## 4.10 DOMÍNIO SEMÂNTICA — RESOLUÇÃO CANÔNICA TRANSACIONAL

### 4.10.1 Resolver soberano

A resolução de identidade semântica (`concept_ref`) nos fluxos transacionais
(intent, checkout, offer, pedido) é responsabilidade **exclusiva** de:

`backend/src/modules/marketplace/adapters/concept-offer-refs.adapter.ts`

Nenhuma outra camada pode:
- inferir `concept_ref` para fins transacionais
- ler `canonical_products.concept_id` diretamente e usar o valor como decisão de execução
- resolver canônico alternativo ou aplicar fallback que viole C.1 / C.4

### 4.10.2 Encadeamento obrigatório

Todo fluxo transacional segue:

product → canonical_products (READY) → concept_id → concept_ref

com predicado READY:
concept_resolution_status = 'confirmed'
AND concept_id IS NOT NULL
AND btrim(name::text) <> ''
AND category_id IS NOT NULL
AND type = 'INDUSTRIAL'

### 4.10.3 Suporte a canônicos globais (scope = 'global')

Quando canonical_products.scope = 'global' e tenant_id IS NULL:
- O adapter deve aceitar a linha diretamente (via UUID em products.canonical_product_id)
- Proibido: procurar equivalente scoped, aplicar precedência de catálogo, ou substituir o ID
- Para descoberta por GTIN/fingerprint: scoped vence global quando ambos existem para o mesmo tenant

### 4.10.4 Contrato de erro

Falhas na resolução semântica devem ser discriminadas por causa (ver C.5).
O adapter é o único gerador desses códigos. Rotas e services propagam sem reinterpretar.

### 4.10.5 Proibições

- Leitura direta de canonical_products.concept_id como concept_ref em fluxo transacional
- Bypass do adapter via SQL ad-hoc em service ou rota
- ORDER BY para "escolher" entre canônicos quando o ID já está definido

### 4.10.6 Integração sistêmica

Na ordem de composição sistêmica (§7):
SEMÂNTICA (CONCEPT — §4.10) → IDENTIDADE (actors — §4.8) → AUTORIDADE (§4.9) → TEMPO → ESTADO → FINANCEIRO → EVENTO

O domínio semântico precede identidade e financeiro porque define o que está sendo
transacionado. Sem concept_ref válido, a operação financeira carece de significado.

---

# 5. REGRA DE NÃO-DUPLICAÇÃO

É proibido:

* criar SSOT paralelo
* duplicar lógica de pilar
* manter estado concorrente

---

# 6. REGRA DE NÃO-SEQUESTRO

Nenhum módulo pode:

* redefinir regras de um pilar
* inferir estado fora do SSOT
* criar lógica alternativa

---

# 7. REGRA DE COMPOSIÇÃO SISTÊMICA

Toda operação deve seguir a ordem:

```text
SEMÂNTICA (CONCEPT)
→ IDENTIDADE (actors — §4.8)
→ QUARENTENA / RISCO (bloqueio ATL e cascata — §4.8.4; quando aplicável)
→ AUTORIDADE (permissões, acting on behalf, delegação / cadeia §4.9.9 — §4.9)
→ TEMPO (agenda)
→ ESTADO (state machine)
→ FINANCEIRO (ledger)
→ EVENTO (registro)
```

## 7.1 COMPATIBILIDADE COM O PROTOCOLO OPERACIONAL

A sequência definida nesta **secção 7** é a **ordem sistémica completa**.

O protocolo de agentes (`00_AGENT_PROTOCOL.md` §**2.3.2**) define uma **versão operacional reduzida**:

```text
Mutation → Estado → Dinheiro → Evento
```

**Regras:**

* O protocolo é um **subconjunto** da ordem sistémica de §7 — **não** a substitui.
* A cadeia do protocolo **nunca** pode **violar** a ordem de §7 (causas primárias, precedência de semântica / identidade / autoridade / tempo onde aplicável ao escopo).
* Conflito aparente entre as duas formulações → aplicar precedência normativa institucional (Constituição, Leis, este documento e protocolo conforme hierarquia em `00_AGENT_PROTOCOL.md` §**2.2.7**) e, se persistir ambiguidade operacional, **decisão humana** — **proibido** “escolher” unilateralmente uma ordem que enfraqueça §7.

---

# 8. REGRA DE LINGUAGEM ÚNICA

O sistema deve falar uma única linguagem:

* CONCEPT define significado
* VOCABULÁRIO define valores válidos

É proibido:

* valores fora do vocabulário
* semântica implícita
* uso de slug ou category como identidade

---

# 9. REGRA DE CONSISTÊNCIA ENTRE MÓDULOS

Se múltiplos módulos usam o mesmo pilar:

> o resultado deve ser idêntico

Divergência = falha sistêmica

---

# 10. REGRA DE COEXISTÊNCIA DAS CAMADAS

Todas as camadas coexistem, mas:

| Camada    | NÃO pode           |
| --------- | ------------------ |
| Pilar     | depender de módulo |
| SSOT      | ser duplicado      |
| CORE      | decidir domínio    |
| Módulo    | controlar pilar    |
| Navegação | definir semântica  |

---

# 11. REGRA DE EVOLUÇÃO

Mudanças no sistema devem:

* respeitar esta estrutura
* manter compatibilidade histórica
* evitar quebra de coerência

---

# 12. REGRA DE COOPERATIVISMO

O sistema existe para:

* permitir participação ativa
* incentivar contribuição
* redistribuir valor conforme engajamento

Regra:

> quem participa mais, contribui mais e gera valor, deve ser proporcionalmente recompensado

---

# 13. AUDITORIA

Esta lei:

* é critério de PASS/FAIL
* deve ser usada em revisão de código
* deve ser aplicada em CI

---

# 14. SUPREMACIA

Esta lei prevalece sobre:

* decisões de produto
* atalhos técnicos
* convenções locais

**Sem prejuízo** da **subordinação** declarada no cabeçalho deste documento e da **precedência** em `00_AGENT_PROTOCOL.md` **2.2.7** (Constituição > Leis > SSOT Registry > Ontologia > demais).

---

# 15. INTEGRAÇÃO OPERACIONAL (AGENTES)

A aplicação obrigatória desta lei pelos agentes está formalizada em `00_AGENT_PROTOCOL.md`:

* **2.3.2** — GATE obrigatório (linha **Precedência causal**, alinhada a §**7.1** desta lei, e linha **Fronteira financeira**, alinhada a §4.6–§4.7)
* **2.2.2** — Prova de rastreabilidade (bullets **SSOT governante** e **pilar afetado**)

> **Emenda 2026-08-02 (ratificada por Clayton):** as três remissões anteriores apontavam para o que
> **não existe** — "2.2.8 Validação de coerência sistémica" (a 2.2.8 real é Contratos de API HTTP),
> "itens 5 e 6" numa secção de 4 bullets, e uma linha "Coerência sistémica" que o GATE nunca teve.
> Verificado na fonte antes de corrigir. Remissão para o inexistente ensina o leitor a não conferir.

**Remissão lexical:** `LEI_COERENCIA_SISTEMICA_UNIFICARD.md` remete ao presente ficheiro.

---

# FRASE FINAL

> **o UnifiCard só funciona se todas as partes operarem como um único sistema coerente**

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 00_AGENT_PROTOCOL.md
- 07_NOMENCLATURA_CANONICA.md
- 18_DOMAIN_ONTOLOGY_UNIFICARD.md
- CONSTITUICAO_UNIFICARD.md
- CORE_IMUTAVEL.md
- LEIS_OPERACIONAIS_UNIFICARD.md
- MAPA_CANONICO_PERMISSIONS_v1.md
- SSOT_REGISTRY_UNIFICARD.md
- VOCABULARIO_CANONICO_UNIFICARD.md

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- 00_SUMARIO.md
- ACTOR_TRACEABILITY_CONTRACT.md
- ARCHITECTURE_DEPENDENCY_BOUNDARIES.md
- BANK_DOMAIN_RULES.md
- PROHIBITED_STRUCTURES.md
- SSOT_REGISTRY_UNIFICARD.md
<!-- AUTO-GENERATED-END -->