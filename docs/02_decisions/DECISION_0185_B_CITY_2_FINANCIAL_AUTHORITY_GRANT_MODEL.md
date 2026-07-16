# DECISION-0185 — B-CITY-2 · Financial Authority Grant Model: casa canônica única (`actor_capability_grants`), terceiro `scope_type='regional_treasury'` fechado, tenant+cidade-scoped, matriz particionada e fechada, três registries disjuntos e correção do registro físico das grant keys — tornando DECIDÍVEL e coerente o registro FUTURO das duas capabilities financeiras regionais nomeadas pela DECISION-0184, sem materializar nada

**Status:** DECIDIDA POR CLAYTON · PROMULGADA DOCS-ONLY · NÃO SELADA · AGUARDA UMA ÚNICA AUDITORIA YALA
**Data:** 2026-07-16
**Frente:** B-CITY-2 · FINANCIAL AUTHORITY GRANT MODEL
**Base:** `rescue-structural @ 14814ad25dd39560a88d7667b91d1ae58ecac632`
**Origem:** STOP GOVERNADO do material B-CITY-2 no PASSE 1 (2026-07-16), **anterior a qualquer write/DDL**. Prova de 1ª mão (`pg_constraint` · `unificard_dev` read-only): as constraints vivas de `actor_capability_grants` rejeitam FISICAMENTE as duas capabilities financeiras nomeadas pela DECISION-0184. A DECISION-0184 nomeou as capabilities mas **não decidiu** a casa física de grant, o scope financeiro, a shape, a matriz, a coerência tenant–cidade nem a partição dos registries. Clayton ratifica o STOP e concede `GO DECISION B-CITY-2 FINANCIAL AUTHORITY GRANT MODEL`.

**Complementa (sem reescrever):** DECISION-0136 (schema/lifecycle/RLS/eventos/revogação/vigência/SSOT de `actor_capability_grants`) · DECISION-0173 (matriz `scope_type × capability_key`; 6 keys actor + 6 keys territory; `territory` global e city-scoped; matriz fechada; ausência de authority financeira em `territory`) · DECISION-0184 (nomes/classificação/não-fusibilidade das duas capabilities; policy admin; PORTA; Curitiba v1). **Nenhuma das três é editada.**

---

## PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios tocados (união cautelosa §2.2.6):** AUTHORITY (grant/scope/capability) · FINANCEIRO/LEDGER (fronteira — jurisdição da autoridade) · ACTOR/IDENTIDADE · TERRITÓRIO (cidade canônica) · TENANT/RLS · NOMENCLATURA/REGISTRY · IDEMPOTÊNCIA/UNICIDADE · EVENTO/AUDITORIA. **Nenhum** grant/key/policy/PORTA/saldo/tx real — docs-only.

**PILAR:** AUTHORITY + MONEY. **SSOT DE AUTHORITY:** `actor_capability_grants` (+ capability exata). **SSOT DE ACTOR:** `actors`. **SSOT TERRITORIAL:** `cities` e demais IDs territoriais canônicos. **SSOT FINANCEIRO:** `bank_ledger`/UnifyBank.

**Precedência:** Constituição > Leis Operacionais > SSOT Registry > Ontologia > normas aplicáveis > DECISIONs seladas > cartório > código > runtime > conveniência.

**Declarado:** residência NÃO decide autoridade · role/`admin=true` NÃO decide autoridade · pertencer a Curitiba NÃO decide autoridade · estrutura NÃO emerge autoridade · frontend NÃO cria verdade · cartório registra estado, não substitui código/SSOT · possuir uma capability NÃO implica a outra.

**Esta DECISION NÃO cria** grant/key física/policy/PORTA/conta/caller/firewall/movimentação — não toca o SSOT de authority nem o SSOT financeiro. **Declarados NÃO-SSOT:** contratos de shape/matriz/registry (transformação de forma e governança de vocabulário) · cartório (estado operacional).

---

## D0 — FATO FÍSICO QUE ORIGINA A DECISION (prova de 1ª mão, read-only)

Constraints vivas de `actor_capability_grants` (`pg_constraint`, `unificard_dev`, 2026-07-16):

```text
chk_acg_scope_type            = scope_type ∈ {actor, territory}                       ← só DOIS
chk_acg_capability_nonfinancial = capability_key ∈ {as 12 atuais}  (INCONDICIONAL)
chk_acg_scope_capability_matrix = actor→{6 não-fin}  ·  territory→{6 territory:*_neighborhood}
chk_acg_scope_shape           = actor(tenant NOT NULL, scope_actor_id NOT NULL, city NULL)
                                territory(tenant NULL, scope_actor_id NULL, city NOT NULL)
```

Estado atual: `scope_type ∈ {actor, territory}` · `regional_treasury` **INEXISTENTE** · `treasury:regional_*` é **DB-rejeitada em qualquer linha** (grants vivos: só `scope_type='territory'`; nenhuma capability financeira).

A **DECISION-0184 nomeou** `treasury:regional_policy_manage` e `treasury:regional_fund_activation_manage`, mas **não decidiu**: (a) a casa física de grant; (b) o scope financeiro; (c) a shape; (d) a matriz; (e) a coerência tenant–cidade; (f) a partição dos registries. O **STOP material foi correto e anterior a qualquer write ou DDL**.

---

## D0-ESCOPO

Esta DECISION é **docs-only**. Fecha o modelo institucional e físico **FUTURO** de grants para capabilities financeiras regionais. **NÃO materializa nada:** zero código · zero migration · zero DDL · zero DML · zero key física · zero grant · zero policy · zero PORTA · zero caller · zero movimentação. **NÃO autoriza** o material B-CITY-2 (exige GO próprio) nem a ativação (exige PORTA posterior separada). **NÃO altera/reescreve** DECISION-0136/0173/0184 — complementa por extensão governada posterior.

---

## D1 — CASA CANÔNICA ÚNICA

`actor_capability_grants` é a **única** casa para grants de capabilities de Actor — inclusive as financeiras regionais. A casa existente é **evoluída de forma governada**, nunca duplicada.

**PROIBIDO:** nova tabela de grants financeiros · segundo lifecycle · segundo registry de concessões · dual-write · fallback entre casas · sincronização eventual entre authorities · evento de autoridade paralelo · segunda verdade em runtime.

Uma casa dedicada seria a pior alternativa: duplicaria SSOT, RLS, eventos, revogação, vigência e unicidade. Reutilizar `territory` também seria incorreto: misturaria autoridade territorial global e não-financeira com autoridade monetária tenant-scoped.

---

## D2 — NOVO SCOPE FINANCEIRO

`scope_type = 'regional_treasury'` — **exato, sem aliases**. Rejeitados os nomes: `financial` · `treasury` · `regional_finance` · `city_treasury`.

Classificação: **FINANCEIRO · CITY-SCOPED · TENANT-SCOPED · FECHADO**.

O novo scope **NÃO** é subtipo de `territory` · **NÃO** herda capabilities territoriais · **NÃO** transforma `territory` em scope financeiro.

---

## D3 — SHAPES MUTUAMENTE EXCLUSIVOS

```text
actor:              tenant_id NOT NULL · scope_actor_id NOT NULL · scope_city_id NULL
territory:          tenant_id NULL     · scope_actor_id NULL     · scope_city_id NOT NULL
regional_treasury:  tenant_id NOT NULL · scope_actor_id NULL     · scope_city_id NOT NULL
```

**Explicitado:** `grantee_actor_id` identifica quem RECEBE a capability · `scope_actor_id` **NÃO** representa o beneficiário do grant · em `regional_treasury` o escopo é **tenant + cidade** · o grant **NÃO** é global para todos os tenants da cidade · o grant **NÃO** é escopado à residência do grantee.

**Por que `tenant_id NOT NULL` em `regional_treasury` (e NÃO espelhar `territory`=NULL):** o grant territorial é global porque governa o catálogo territorial canônico; a autoridade financeira regional governa uma **policy tenant-scoped**, uma **conta regional mapeada por tenant**, uma **PORTA financeira por tenant** e o **dinheiro/ledger daquele tenant**. Com `tenant_id=NULL` um grant financeiro para Curitiba poderia ser interpretado como autoridade sobre **todos** os tenants da cidade. A forma segura é **tenant + cidade + capability + Actor beneficiário**.

**PROIBIDO:** `regional_treasury` com `tenant_id NULL` · com `scope_city_id NULL` · com `scope_actor_id` preenchido.

---

## D4 — CIDADE CANÔNICA

`scope_city_id → cities.city_id` (FK canônica). **PROIBIDO** como origem/autoridade do grant: nome textual · slug · CEP · código externo sem resolução canônica · profile · residência · first match · tenant como substituto da cidade.

O schema é estruturalmente city-scoped. O **primeiro material permanece Curitiba-only**; qualquer outra cidade é **FAIL-CLOSED** até nova decisão, policy, provisioning, grants e PORTA próprios.

---

## D5 — MATRIZ FECHADA E PARTICIONADA

A matriz continua **fechada** (nunca prefixo/wildcard/regex/negação).

### Actor e territory — as 12 capabilities atuais permanecem EXATAMENTE intactas

Inventário de 1ª mão (`chk_acg_capability_nonfinancial` vivo):

```text
6 keys ACTOR:      calendar:block · calendar:unblock · services:create · services:edit ·
                   services:disable · service_order:view
6 keys TERRITORY:  territory:create_neighborhood · territory:approve_neighborhood ·
                   territory:correct_neighborhood · territory:deactivate_neighborhood ·
                   territory:manage_neighborhood_aliases · territory:register_neighborhood_succession
```

Contrato: `scope_type ∈ {actor, territory}` → `capability_key` pertence **exatamente** às 12 atuais.

### Regional treasury

Contrato: `scope_type = 'regional_treasury'` → `capability_key` pertence **exatamente** a:

```text
treasury:regional_policy_manage
treasury:regional_fund_activation_manage
```

Nenhuma terceira key · nenhum wildcard · nenhum prefix match · nenhum `treasury:*`.

---

## D6 — CONTRATOS FÍSICOS FUTUROS DOS CHECKS (ordem ao material futuro)

O material futuro deverá alterar **conscientemente**:

- `chk_acg_scope_type` → admitir exatamente `actor` · `territory` · `regional_treasury`.
- `chk_acg_capability_nonfinancial` → transformar em **implicação guardada por scope**: `scope_type ∈ {actor, territory}` → somente as 12 capabilities atuais (permanece FECHADO; não se aplica a `regional_treasury`).
- **Adicionar CHECK novo e fechado** `chk_acg_capability_regional_treasury`: `scope_type = 'regional_treasury'` → somente `treasury:regional_policy_manage` e `treasury:regional_fund_activation_manage`.
- `chk_acg_scope_capability_matrix` → **ampliar** com um ramo fechado para `regional_treasury`.
- `chk_acg_scope_shape` → **ampliar** com a shape `tenant + cidade` (D3).

**PROIBIDO:** remover CHECK · converter allowlist em regex aberta · usar `LIKE 'treasury:%'` · aceitar qualquer capability desconhecida · relaxar `actor` ou `territory` · reaproveitar o ramo `territory` para dinheiro.

---

## D7 — CAPABILITIES FINANCEIRAS (semântica preservada da DECISION-0184)

**`treasury:regional_policy_manage`** — lifecycle da policy regional: draft · linhas em draft · validação · ativação · depreciação · encerramento · substituição de versão. **NÃO** abre PORTA · **NÃO** movimenta dinheiro.

**`treasury:regional_fund_activation_manage`** — PORTA financeira regional: abertura · fechamento · vigência · encerramento antecipado · auditoria. **NÃO** cria/edita policy · **NÃO** movimenta dinheiro manualmente · **NÃO** bloqueia reversal.

Ambas: **CRITICAL_FINANCIAL**.

---

## D8 — SEPARAÇÃO E NÃO FUSIBILIDADE

`treasury:regional_policy_manage` **≠** `treasury:regional_fund_activation_manage`. Exigem **dois grants independentes**; possuir uma **não** implica a outra.

**PROIBIDO:** grant combinado · capability agregadora · role financeira implícita · wildcard · herança · alias · `admin=true` · grant por grupo textual · possuir policy admin como autorização para abrir a PORTA.

---

## D9 — UNICIDADE ATIVA

Unicidade ativa regional (semântica a fixar pelo material):

```text
tenant_id + grantee_actor_id + capability_key + scope_city_id + scope_type='regional_treasury'
```

Não permitir dois grants ativos equivalentes. Novas concessões após revogação respeitam o **lifecycle canônico existente**. O material futuro deve **reutilizar**: status · vigência · revogação · razão de revogação · eventos append-only · timestamps · RLS · imutabilidade aplicável. **Não** criar lifecycle financeiro paralelo.

---

## D10 — COERÊNCIA TENANT–ACTOR–CIDADE

O `grantee` deve ser um **Actor existente e válido**. Para `regional_treasury`:

```text
grant.tenant_id = tenant do contexto server-side
                = tenant autorizado para o grantee Actor
                = tenant da policy/conta/PORTA futura
```

A cidade é **adicional** ao tenant, nunca seu substituto. **PROIBIDO:** caller-supplied tenant como autoridade · cross-tenant grant · Actor de outro tenant · grant global por cidade · `OR tenant_id IS NULL` · fallback territorial · inferência por residência.

`canRepresentActor` continua **separado e cumulativo**: representabilidade humana **+** grant financeiro regional. Um **não** substitui o outro.

---

## D11 — TRÊS REGISTRIES DISJUNTOS

```text
1. Authority Grant Keys ....... casa: actor-capability-grant.types.ts + CHECK físico de
                                actor_capability_grants · gramática domain:action ·
                                uso: capability_key de grants
2. Permission Capabilities .... casa: permission-keys.ts · gramática can_* (sem colon) ·
                                uso: permissões do sistema — NÃO são grant keys
3. TreasuryOperationSource .... casa: registry próprio de tags de operação ·
                                uso: origem/classe operacional de tesouraria — NÃO concede authority
```

**Correção formal:** a afirmação anterior de que **toda** grant key vem de `permission-keys.ts` é **imprecisa**. Contrato correto: o registry físico real das **grant keys** é `actor-capability-grant.types.ts` + CHECK de `actor_capability_grants`; `permission-keys.ts` governa **permission capabilities** (`can_*`); operation source vive em **registry próprio**.

---

## D12 — COLISÃO TEXTUAL "treasury:"

Os nomes selados pela DECISION-0184 são **preservados**. O prefixo textual `treasury:` pode coincidir entre registries, mas **tipo · casa · uso · jurisdição são disjuntos**.

**PROIBIDO:** operation source usada como capability · capability usada como operation source · permission capability usada como grant key · scanner global baseado apenas em `startsWith('treasury:')` · union de strings misturando registries · cast entre tipos · fallback por prefixo. A futura implementação deve ter **guard dedicado de partição** entre registries.

---

## D13 — REGISTRO FÍSICO FUTURO

O material futuro deve registrar as duas keys **somente** no registry real de grant keys: `actor-capability-grant.types.ts` + CHECK físico de `actor_capability_grants` + matriz `scope × capability`. **NÃO** adicioná-las a `permission-keys.ts` · **NÃO** registrá-las como `TreasuryOperationSource` · **NÃO** criar segundo manifest. Tipos derivados nascem **exclusivamente** da fonte canônica viva.

---

## D14 — GRANT NÃO É AUTHORITY DE MOVIMENTAÇÃO ISOLADA

Mesmo um grant ativo **não** movimenta dinheiro sozinho.

```text
POLICY ADMIN: Actor representável + grant treasury:regional_policy_manage +
              tenant/cidade coerentes + writer canônico + trilha append-only
PORTA:        Actor representável + grant treasury:regional_fund_activation_manage +
              tenant/cidade coerentes + policy válida + material selado +
              registro de PORTA + firewall governado
```

**PROIBIDO:** grant abrindo dinheiro automaticamente · policy ativa abrindo dinheiro · firewall abrindo dinheiro · residência concedendo authority · pertencer a Curitiba concedendo authority.

---

## D15 — EMISSÃO DE GRANTS FORA DESTA DECISION

Esta DECISION **não cria nem autoriza** grants reais. **Grants regionais financeiros: ZERO.**

**PROIBIDO:** self-grant · grant por residência · grant por role · `admin=true` · bootstrap implícito · migration seed · platform bootstrap automático · founder bypass · grant por possuir a outra capability · grant pela abertura da PORTA.

A emissão inicial de grants dependerá de **ato governado posterior**. Esta DECISION **não** cria writer público de concessão. A mesma pessoa poderá ter as duas capabilities **somente** por dois grants independentes (preserva DECISION-0184).

---

## D16 — PRESERVAÇÃO DAS DECISIONs ANTERIORES

**DECISION-0136** preservada: casa única · lifecycle · RLS · eventos · revogação · vigência · SSOT.
**DECISION-0173** preservada: seis capabilities actor · seis capabilities territory · scope `territory` global e city-scoped · matriz fechada · ausência de authority financeira em `territory`. Esta DECISION apenas **adiciona um terceiro scope fechado**.
**DECISION-0184** preservada: nomes das duas capabilities · classificação · não-fusibilidade · policy admin · PORTA · Curitiba v1. Esta DECISION **complementa** a casa, a shape e a matriz.

Nenhuma das anteriores é editada.

---

## D17 — CURITIBA-FIRST

O futuro schema será city-scoped. O futuro material B-CITY-2 aceitará **operacionalmente somente o UUID canônico de Curitiba**. **PROIBIDO no primeiro material:** outra cidade · estado · nacional · bairro · neighborhood grants · inferência por CEP · provisioning de nova cidade · grant global. Nova cidade exige **novo ato governado**.

---

## D18 — MATERIAL FUTURO

Após selo **e** novo GO, o material poderá: adicionar `regional_treasury` ao schema · alterar os CHECKs conscientemente · registrar as duas grant keys · atualizar tipos derivados · criar guard de matriz · criar guard de partição dos registries · provar RLS e tenant coherence · manter **grants reais zero** · retomar o restante do envelope B-CITY-2.

O material **não** poderá: criar grants · abrir PORTA · criar policy real · ligar firewall · movimentar dinheiro.

---

## D19 — GUARDS E MUTATIONS FUTUROS (o material futuro deve provar cada vetor)

```text
 1. scope_type com exatamente três valores
 2. actor shape preservada
 3. territory shape preservada
 4. regional_treasury shape tenant+city
 5. 12 keys atuais intactas
 6. regional_treasury com exatamente duas keys
 7. wildcard rejeitado
 8. terceira key financeira rejeitada
 9. treasury key em actor rejeitada
10. treasury key em territory rejeitada
11. nonfinancial key em regional_treasury rejeitada
12. tenant NULL em regional_treasury rejeitado
13. city NULL rejeitada
14. scope_actor_id preenchido rejeitado
15. cross-tenant rejeitado
16. duplicate active grant rejeitado
17. grants reais zero
18. permission-keys.ts sem as grant keys
19. operation sources sem as grant keys
20. registry cross-use rejeitado
21. startsWith('treasury:') como autoridade rejeitado
22. self-grant/bootstrap implícito ausentes
23. DECISIONs anteriores preservadas
24. Bank e B-CITY intactos
```

Mutations devem provar **cada** vetor.

---

## D20 — FRONTEIRAS

**Fora desta DECISION:** código · migration · DDL · DML · grant writer · grants reais · policy regional · PORTA · orquestrador · reversal · sink · frontend · Social · bairro · nacional · transparência · ativação.

**Não retomar material automaticamente.** `SELO DA DECISION ≠ GO MATERIAL ≠ ABERTURA DA PORTA`. Próximo ato elegível: **auditoria Yala docs-only**; após o selo, **`GO MATERIAL B-CITY-2` explícito**; a ativação monetária continua dependente de PORTA posterior e separada.

---

## ESTADO FÍSICO NO ATO DA PROMULGAÇÃO (1ª mão, read-only)

`actor_capability_grants`: `scope_type` vivo = `{territory}` apenas · `regional_treasury` INEXISTENTE · grants financeiros regionais **ZERO** · 12 keys da matriz **intactas**. Bank **16/1/0/0/0** · Curitiba **0** · policy regional **0** · PORTA **NÃO criada** · caller **ZERO** · firewall **OFF** · `permission-keys.ts` **INTACTO** · keys físicas **ZERO** · **Δbank=0** · DECISION-0136/0173/0184 **byte-intactas**.

**STATUS: PROMULGADA DOCS-ONLY · NÃO SELADA · AGUARDA UMA ÚNICA AUDITORIA YALA. Material B-CITY-2 SUSPENSO e NÃO INICIADO; retomada somente após selo desta DECISION e novo GO material explícito.**
