# DECISION-0187 — GROUP INSTITUTIONAL BINDING CONTRACT · casa canônica única e futura do vínculo Group interno → Actor organizacional institucional (`group_institutional_bindings`), ancoragem `groups.id` × `actors.id`, cardinalidade 1-parent-ativo, modo raiz×interno anti-ciclo v1, lifecycle append-only active→retired, autoridade dual v1 sem capability nova — sem materializar nada

**Status:** DECIDIDA POR CLAYTON · PROMULGADA DOCS-ONLY · NÃO SELADA · AGUARDA UMA ÚNICA AUDITORIA YALA
**Data:** 2026-07-17
**Frente:** F-ORGANIZATIONAL-ACTOR-COMPOSITION · D9.1
**Base:** `rescue-structural @ 4e688db7ecd513df18aa7979b84eb4a3e887abaa`
**Origem:** DECISION-0186 (SELADA PELA YALA · Veredito A) delegou a forma física do vínculo ao GATE D9.1; o GATE READ-ONLY D9.1 (2026-07-17, zero alteração, HEAD `4e688db7e`) retornou **VEREDITO B** — as casas sobreviventes eram coluna-em-`groups` vs tabela dedicada, e os itens institucionais (casa, ancoragem, cardinalidade, exclusividade, reparenting, anti-ciclo, autoridade v1) exigiam decisão soberana. Clayton concede `GO DECISION-0187 · GROUP INSTITUTIONAL BINDING CONTRACT · DOCS-ONLY` fixando todos os itens. Este GO **não** autoriza material/migration/schema/runtime/dados/frontend/membership/audience/endereço/Bank.

**Complementa (sem reescrever):** DECISION-0186 (composição organizacional; não-herança; bifurcação formal/informal; D9 ordem) · DECISION-0157 (freeze `actor_type`) · DESENHO_FASE_3C (group-actor 1:1 + âncora civil) · DECISION-0136/0173/0184/0185 (authority por grants — intocada) · DECISION-0160 (vocabulário da aresta social — intocado). **Nenhuma é editada.**

---

## PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios (união cautelosa):** ACTOR/IDENTIDADE · SOCIAL/GROUPS · COMPANY/PJ · AUTHORITY (fronteira — nenhuma capability criada) · ONTOLOGIA/PÁGINA · NOMENCLATURA · MULTI-TENANCY/RLS · FINANCEIRO (fronteira negativa). Docs-only.

**Lidos integralmente de 1ª mão no GATE D9.1 desta mesma sessão (base deste contrato):** 00_AGENT_PROTOCOL §2.2/§2.2.2/§2.3.2 · CONSTITUICAO · LEIS_OPERACIONAIS (Leis 1-7) · SSOT_REGISTRY (§5.1/§5.16/5.10) · 02_ACTORS_SSOT · 03_IDENTITY_CANONICA · 07_NOMENCLATURA §3.1/§4.38/§4.39 · 18_DOMAIN_ONTOLOGY §6/§7/§8.2 · LEI_DE_COERENCIA §4.8/§4.9/§4.10 · AUTHORITY_LAW · ACTOR_TRACEABILITY_CONTRACT · DESENHO_PAGINA_DO_ACTOR (§5) · DESENHO_FASE_3C · DECISION-0157 · DECISION-0160 · DECISION-0186 · migrations e código citados em D0 · cartório (REMEDIATION_DT_LOG/dividatecnica).

**SSOTs:** Actor=`actors` · Identidade=`global_user_id` · Authority=`actor_capability_grants`+`canRepresentActor` · Financeiro=`bank_ledger` (FORA) · Território=`addresses`/`address_assignments` (FORA) · Temporal=`unified_availability` (FORA). **NÃO-SSOT:** `groups.metadata` JSONB · categories/purpose · GRAPH (liga CONCEPTs, não Actors) · cartório · frontend.

**Precedência:** Constituição > Leis > SSOT Registry > Ontologia > DECISIONs seladas > cartório > código > runtime > conveniência.

**Declarado:** membership NÃO decide estrutura · role/purpose/category/slug NÃO decidem parent · residência NÃO decide nada · vínculo NÃO concede autoridade · frontend NÃO cria verdade · estrutura NÃO emerge autoridade · setor NÃO é actor_type.

---

## D0 — FATOS FÍSICOS DO GATE D9.1 QUE ANCORAM ESTA DECISION (1ª mão, read-only)

1. O vínculo C (group-actor ↔ Actor institucional) **não existe em nenhuma forma física**: zero colunas parent/institution nas migrations; zero campos em DTOs; zero metadata como vínculo; `organization_*` = 4× `to_regclass` NULL + blanket 501.
2. Vínculo A (Group↔group-actor) saudável: `uq_actors_group`+`uq_groups_actor`+FK RESTRICT (migration `20260530576000`); DB 1:1, mismatch=0.
3. Vínculo B (âncora civil): `owner_actor_id` NOT NULL (`20260530578000`) → user-actor com `global_user_id`; `trg_actors_responsibility` ativo.
4. `actor_relationships` (migration `20260704120000`): par NÃO-ordenado ÚNICO (LEAST/GREATEST), labels sociais/comerciais congelados (DECISION-0160), lifecycle de consentimento, "NÃO concede autoridade" — a unicidade por par IMPEDE coexistência de sentido CRM + sentido estrutural para o mesmo par.
5. `groups` vive SEM RLS (`relrowsecurity=f`) — lacuna pré-existente (ver D10).
6. Caps vivos: criação = 1 grupo/usuário (`GroupCreationPolicy.INITIAL_LIMIT=1`) · participação = 3 (`joinGroup`). Intocados aqui.
7. `createGroup` só aceita autoria humana (`ensureUserActor`); `canRepresentActor` de group-actor resolve via owner civil (+trilho de grants separado); grantee de grants pode ser qualquer actor (FK física).

---

## D0-ESCOPO

Docs-only. Fecha o **contrato futuro** da casa, forma, cardinalidade, lifecycle e autoridade v1 do vínculo institucional. **NÃO materializa nada:** zero código · migration · DDL/DML · schema · dado · Group/Actor/vínculo/capability/grant · Bank · frontend. O material D9.1 exige **GO próprio** após o selo desta DECISION.

---

## D1 — CASA CANÔNICA ÚNICA: `group_institutional_bindings`

A única casa física futura do vínculo institucional é a tabela dedicada **`group_institutional_bindings`**: estreita · tenant-scoped · append-only em sua história civil · exclusivamente composição institucional.

**Ela NÃO é:** membership · relação social · GRAPH · authority · delegação · endereço · conta · estrutura financeira · ressurreição de `organization_*`.

**REJEITADOS formalmente como casa (com a prova do GATE):**
- coluna `institutional_actor_id` em `groups` — UPDATE destrutivo apagaria a história ou exigiria segunda casa de eventos; herda a superfície sem RLS de `groups`; coluna é o idioma do repo para IDENTIDADE imutável (`groups.actor_id`, `actors.company_id`), e composição tem vigência;
- `actor_relationships` — par não-ordenado único colide com CRM; vocabulário 0160 congelado; lifecycle de consentimento ≠ composição estrutural direcional;
- `group_members` — membership user-based ≠ composição (0186 D5; LEI fronteira §4.9);
- `groups.owner_actor_id` — âncora civil humana NOT NULL; substituí-la quebraria a cadeia CPF (§4.8.2);
- `actors.responsible_actor_id` — responsabilidade civil exige humano; instituição não é responsável civil;
- metadata JSONB · category · purpose · role · slug — nenhuma verdade estrutural fora de casa governada (Lei 7; AUTHORITY_LAW Art.17);
- `actor_capability_grants` · `actor_delegations` — authority/delegação ≠ estrutura (0186 "vínculo ≠ capability");
- hierarquia Group→Group genérica — sem substrato; não representa a bifurcação formal/informal;
- qualquer tabela do Bank — Lei 5; Δbank=0.

**Justificativa vinculante:** a composição possui vigência, retirada, possível mudança futura e necessidade de preservar histórico. Uma coluna atualizável em `groups` apagaria a história ou exigiria segunda casa de eventos. A tabela dedicada mantém **uma única verdade de composição** e permite retire + novo vínculo **sem UPDATE destrutivo** do parent — o mesmo idioma de vigência já canônico em `address_assignments` e nos grants (0136).

---

## D2 — ANCORAGEM FÍSICA

Endpoints futuros:

```text
group_id             → groups.id
institution_actor_id → actors.id
```

O vínculo **NÃO é aresta genérica Actor↔Actor**. Razões: o filho é especificamente o agregado **Group**; seu group-actor já se resolve canonicamente pelo 1:1 vivo (`groups.actor_id ↔ actors.group_id`); ancorar em `groups.id` impede que qualquer Actor arbitrário seja tratado como Group interno; o parent continua **Actor** para preservar a bifurcação da DECISION-0186 D4 (formal → page-actor; informal → group-actor raiz).

O read-model poderá expor o group-actor resolvido pelo 1:1 existente, mas é **PROIBIDO persistir segunda referência concorrente** ao mesmo group-actor (02_ACTORS_SSOT §3 — sem estruturas paralelas).

---

## D3 — CARDINALIDADE

- Uma instituição pode possuir **zero ou muitos** Groups internos.
- Um Group **pode existir sem instituição** (grupo standalone e instituição informal raiz).
- Um Group possui **no máximo UM vínculo institucional ATIVO**.
- Vínculos históricos encerrados podem existir em quantidade plural.
- **Dois vínculos ativos para o mesmo Group = PROIBIDO** — unicidade ativa futura equivalente a `tenant_id + group_id` sob estado ativo (partial unique).
- **NENHUMA** unicidade que limite a instituição a um só Group.
- **Nenhum Group adquire instituição por inferência** (nem por category, purpose, endereço, membership ou nome).

---

## D4 — TIPOS DE INSTITUIÇÃO PAI

`institution_actor_id` poderá apontar SOMENTE para:

1. **`page`** — organização formal nascida pelo caminho PJ/Company (DECISION-0075/0186 D4);
2. **`group`** — organização informal representada por group-actor **raiz** (sem parent ativo, ver D5).

**PROIBIDOS como parent:** `user` · `channel` · `system` · valores legados congelados (0157) · `actor_organizational` físico · qualquer futuro actor_type não autorizado · Actor de outro tenant.

A natureza (condomínio, igreja, associação, comunidade, ONG) **não é decidida por actor_type** — permanece derivada de CONCEPT, templates e projeções governadas (0186 D1/D2; precedente ONG da ontologia §8.2).

---

## D5 — MODO ESTRUTURAL E ANTI-CICLO V1

Dois modos **mutuamente exclusivos** para um group-actor:

```text
A · INSTITUIÇÃO INFORMAL RAIZ — sem parent ativo; PODE ser institution_actor_id
    de outros Groups; pode possuir múltiplos Groups internos.
B · GROUP INTERNO — com parent ativo; NÃO PODE simultaneamente ser instituição
    pai de outro Group.
```

**Consequências obrigatórias:**
- Group com filhos institucionais ativos **não pode receber parent**.
- Group com parent ativo **não pode receber filhos**.
- **Self-link PROIBIDO.**
- **Cadeia Group→Group→Group PROIBIDA no MVP.**
- **Ciclo direto ou indireto PROIBIDO.**
- **Nenhuma hierarquia recursiva geral é criada.**
- Retirar o parent pode futuramente tornar o Group elegível a instituição raiz, desde que não haja outra violação.

Aplicação: no **writer** (revalidação em transação) + proteção **física na medida possível** + **guard** + provas dirigidas. **Modelo recursivo multinível NÃO é autorizado por esta DECISION** — se algum dia for desejado, exigirá DECISION própria.

---

## D6 — LIFECYCLE

```text
active → retired
```

- Criação = nova linha ativa.
- Encerramento = marca `retired` **preservando a linha**, registrando **quem** e **quando** retirou. **DELETE PROIBIDO.**
- **Reparenting:** NUNCA por UPDATE de `institution_actor_id`; exige retirar o vínculo ativo anterior + criar nova linha; preserva ambos no histórico; quando oferecido como operação única futura, deve ser **atômico**; **nunca** intervalo com dois parents ativos; **replay idempotente** retorna o mesmo resultado; tentativa incompatível **falha fechada**.

Colunas mínimas exigidas do futuro material (nomes exatos seguem 07_NOMENCLATURA na etapa executora): tenant · Group · Actor institucional · estado · instante de criação · Actor autor da criação · instante de retirada · Actor autor da retirada · chave de idempotência ou mecanismo canônico equivalente · trilha append-only suficiente.

---

## D7 — AUTORIDADE V1 (SEM CAPABILITY NOVA)

**Nenhuma capability organizacional é criada nesta etapa** (elas pertencem a D9.3). Até lá, criar ou retirar vínculo exigirá **cumulativamente**:

- Actor autenticado resolvido **server-side**;
- tenant explícito e coerente;
- `canRepresentActor(institution_actor_id)` **verdadeiro**;
- `canRepresentActor(group_actor_id)` **verdadeiro**;
- revalidação dos dois Actors e do Group **dentro da transação**;
- ausência de parent/filhos incompatíveis (D5);
- autoria append-only;
- operação **fail-closed**.

As duas representações são provadas **separadamente**: representar a instituição NÃO implica representar o Group; representar o Group NÃO implica representar a instituição. **Membership, owner textual, role, residência, category, purpose, frontend ou metadata NÃO substituem nenhum dos dois predicados.**

---

## D8 — ESCOPO DO FUTURO MATERIAL D9.1 (fechado por este contrato)

**PODE (somente):** criar `group_institutional_bindings` · writer interno de vincular Group existente · writer interno de retirar vínculo · resolução do group-actor pela casa 1:1 existente · autoridade dual (D7) · tenant coherence · unicidade ativa · anti-self-link · modo raiz×interno · anti-ciclo MVP · RLS desde o nascimento · autoria/histórico · guard dedicado (D11) · mutations e provas DB/E2E · read-model interno mínimo se inevitável à prova.

**NÃO PODE:** criar Group · alterar `createGroup` · alterar caps 1/3 · permitir criação operando como page-actor · criar capabilities · alterar membership/roles · criar audience · alterar página universal · vincular endereço · tocar `actor_relationships` · tocar módulo `organization` · retirar blanket 501 · criar `organization_units`/`organization_members` · tocar Group Bank/`group_accounts`/`balance_cents` · tocar frontend · abrir D9.2+.

**A criação atômica de "novo Group interno + vínculo" fica FORA** até decisão de authority organizacional posterior (D9.3).

---

## D9 — INVARIANTES DE NÃO-HERANÇA (ratificados)

O vínculo institucional **NÃO**: concede authority · concede capability · cria delegação · altera `canRepresentActor` · concede membership · concede role · concede voto · concede conta · concede saldo · concede endereço · concede localização · concede audience · torna a instituição responsável civil pelo Group · substitui `owner_actor_id` · substitui `responsible_actor_id` · altera a âncora CPF · cria novo Actor · altera o group-actor · duplica identidade · **formaliza automaticamente organização informal**.

Cada efeito futuro terá **casa e autorização próprias** (D9.2–D9.8 da DECISION-0186).

---

## D10 — MULTI-TENANCY, RLS E INTEGRIDADE

Exigências do futuro material: `tenant_id` obrigatório · Group + group-actor + instituição no **mesmo tenant**, comprovado física E server-side · cross-tenant fail-closed · **RLS habilitada e FORÇADA desde a migration** · policies fechadas · nenhuma escrita direta do app fora do writer canônico · nenhuma FK simples considerada suficiente isoladamente quando permitir tenant mismatch (usar o padrão de coerência composta já canônico) · nenhum SECURITY DEFINER sem `search_path` pinado e EXECUTE governado · nenhuma autorização derivada de payload do cliente.

**OBSERVAÇÃO REGISTRADA (não amplia o D9.1):** `groups` vive sem RLS (`relrowsecurity=f`, achado do GATE D9.1). Fica registrado como **DT-GROUPS-TABLE-NO-RLS** (cartório) — remediar `groups` inteira é frente separada; o D9.1 apenas **não herda** a lacuna (a casa nova nasce com RLS).

---

## D11 — GUARDS OBRIGATÓRIOS DO FUTURO MATERIAL

Guard dedicado deve morder: segundo writer · segunda tabela de composição · coluna paralela em `groups` · `metadata.organizationId` ou equivalente · category/purpose/role como parent · uso de `actor_relationships` · uso de membership · grants/delegations como composição · herança de authority · herança de conta · herança de endereço · novo actor_type · revival de `actor_organizational` · uso de `organization_*` · dois parents ativos · self-link · cross-tenant · Group interno atuando como parent · instituição-group raiz recebendo parent enquanto tiver filhos · UPDATE destrutivo de parent · DELETE de histórico · criação de Group dentro do writer de binding · alteração dos caps · imports/chamadas ao Bank · frontend decidindo vínculo.

---

## D12 — FRONTEIRAS (fora e trancados)

D9.2 membership actor-first · D9.3 capabilities/authority organizacional · D9.4 audience somente-membros · D9.5 endereço e blocos de página · D9.6 assembleias · D9.7 projetos/procurement · D9.8 financeiro · Actor sistêmico do tenant (`DT-C1-INSTITUTIONAL-SYSTEM-ACTOR-PENDING`) · limpeza física do módulo `organization` · hierarquia multinível · expansão nacional/territorial · qualquer integração Bank.

**Bank:** byte-intacto · zero transaction · zero split · zero ledger · zero conta · **Δbank=0**.

---

## EXPRESSAMENTE NÃO AUTORIZADO POR ESTA DECISION

Material D9.1 (exige GO próprio pós-selo) · código · migration · DDL/DML · schema/dados · frontend · membership · audience · endereço · Bank · capabilities · alteração das DECISIONs 0157/0186 · auditoria/selo em nome da Yala.

---

## CONSEQUÊNCIAS NO CARTÓRIO

1. `REMEDIATION_DT_LOG.md`: entrada de promulgação + registro de `DT-GROUPS-TABLE-NO-RLS` (OPEN, observação do GATE D9.1; remediação = frente separada).
2. `dividatecnica.md`: espelho resumido (changelog).
3. Após o commit docs-only: **STOP** — o arco (GATE D9.1 + esta DECISION + cartório) segue para UMA única auditoria Yala. O selo NÃO abre o material D9.1: material exige (1) auditoria Yala, (2) selo final, (3) novo GO humano explícito e separado.
