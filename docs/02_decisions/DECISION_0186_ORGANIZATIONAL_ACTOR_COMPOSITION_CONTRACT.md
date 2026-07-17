# DECISION-0186 — ORGANIZATIONAL ACTOR COMPOSITION CONTRACT · Actor organizacional institucional (condomínio, igreja, associação) = COMPOSIÇÃO sobre os substratos existentes (page-actor/group-actor + Groups internos + grants), NENHUM novo `actor_type`, rejeição de `organization_*` como casa canônica, e ordenação das integrações futuras — sem materializar nada

**Status:** DECIDIDA POR CLAYTON · PROMULGADA DOCS-ONLY · NÃO SELADA · AGUARDA UMA ÚNICA AUDITORIA YALA
**Data:** 2026-07-17
**Frente:** F-ORGANIZATIONAL-ACTOR-COMPOSITION
**Base:** `rescue-structural @ 904e4ca7cf543416e952fd9fd09e9e8f580f61aa`
**Origem:** GATE READ-ONLY "MODELAGEM DE CONDOMÍNIOS, IGREJAS E ORGANIZAÇÕES COMUNITÁRIAS" (2026-07-17, auditoria concluída com ZERO alteração, Veredito B — modelo existente suficiente com decisão de integração), ratificado pela IA diretora e por Clayton com **duas correções obrigatórias** incorporadas nesta DECISION: (1) não pré-decidir `ownerType='group'` no Bank — registrar como dívida congelada e remeter a forma física a GATE financeiro próprio (D8); (2) separar expressamente "Actor organizacional institucional" (esta DECISION) do "Actor institucional sistêmico do tenant" (`DT-C1-INSTITUTIONAL-SYSTEM-ACTOR-PENDING`, fora daqui) (D7). GO explícito: `GO DECISION-0186 · ORGANIZATIONAL ACTOR COMPOSITION CONTRACT · DOCS-ONLY`.

**Complementa (sem reescrever):** DECISION-0157 (freeze do vocabulário de `actor_type` — permanece o freio) · DECISION-0075/0081/0084 (nascimento PJ fiscal-first) · DESENHO_FASE_3C_GROUP_ACTOR (group-actor + âncora civil §5) · DECISION-0136/0173/0184/0185 (substrato de authority por grants) · DECISION-0101 D6 (proibição de system actor improvisado — reafirmada, não resolvida). **Nenhuma é editada.**

---

## PROVA DE RASTREABILIDADE NORMATIVA (00_AGENT_PROTOCOL §2.2.2)

**Domínios tocados (união cautelosa §2.2.6):** ACTOR/IDENTIDADE · SOCIAL/GRUPOS · COMPANY/PJ · AUTHORITY · TERRITÓRIO/ADDRESS (fronteira) · NAVEGAÇÃO/ONTOLOGIA/PÁGINA · FINANCEIRO (fronteira — só registro de DT, zero decisão física) · NOMENCLATURA. Docs-only.

**Lidos integralmente de 1ª mão nesta promulgação:** `00_AGENT_PROTOCOL` (§2.2 leitura normativa, §2.2.2 prova, §2.3.2 GATE) · `02_ACTORS_SSOT` (§2 Actor = unidade ontológica de ação; §3 unicidade — proibido representar o mesmo Actor em estruturas paralelas; §4 categorias — "Instituição" é categoria válida e nova categoria exige norma explícita, nunca só código) · `18_DOMAIN_ONTOLOGY_UNIFICARD` (§3.2 invariantes únicas — restrição de lucro é ESPECIALIZAÇÃO; §7 `organizacoes-e-instituicoes` = entidade base nível 1, `comunidades-e-grupos` = nível 3; §8.2 precedente ONG: `causas-sociais` REMOVIDA como domínio — ONG = organização + contexto + dimensão) · `07_NOMENCLATURA_CANONICA` (§3.1 hierarquia constitucional `actor_human`/`actor_organizational`/`actor_system`; `actor_organizational` NUNCA soberano; toda ação rastreável até `actor_human`) · `DECISION-0157` (vocabulário canônico `user·page·group·channel`; legados CONGELADOS, zero writer novo; tolerar ≠ ratificar) · `LEI_DE_COERENCIA_SISTEMICA` (§4.9.5 validação obrigatória de authority em voto/publicação-como-page/gestão de membros; §4.9.7 civil ≠ operacional; §4.10 fronteira: membership ≠ delegação — coexistem, não se substituem) · `DESENHO_FASE_3C_GROUP_ACTOR_DOIS_MOMENTOS` (§5 âncora civil: `groups.owner_actor_id` obrigatório → actor `user` → `global_user_id` → identity/tax_id; §6 authority mínimo) · `ARQUETIPOS_PAGINA_CANONICOS` (o sistema não cria novas páginas; compõe contextos sobre arquétipos fixos) · `REMEDIATION_DT_LOG` (`DT-C1-INSTITUTIONAL-SYSTEM-ACTOR-PENDING` OPEN; `DT-ORGANIZATION-SPRINT78-FROZEN` OPEN) · código vivo citado em D0.

**PILARES:** ACTOR + AUTHORITY + ONTOLOGIA. **SSOT DE ACTOR:** `actors`. **SSOT DE AUTHORITY:** `actor_capability_grants` + capability exata (DECISION-0136). **SSOT DE IDENTIDADE:** identidade canônica (03). **SSOT FINANCEIRO:** `bank_ledger`/UnifyBank — intocado. **SSOT TERRITORIAL:** `addresses` + `address_assignments` + `cities` — intocado.

**Precedência:** Constituição > Leis > SSOT Registry > Ontologia > DECISIONs seladas > cartório > código > runtime > conveniência.

**Declarado:** membership NÃO decide autoridade · role-texto NÃO decide autoridade · residência NÃO decide autoridade · voto NÃO move dinheiro · estrutura NÃO emerge autoridade · frontend NÃO cria verdade · setor/segmento NÃO é entidade-base (ontologia §8.2).

**Suficiência:** o conjunto acima cobre identidade e categorias (02), classificação ontológica (18), vocabulário físico congelado (0157) e constitucional (07 §3.1), authority (0136/LEI §4.9.5), páginas (arquétipos), âncora civil de grupos (3C) e o corpo físico vivo (migrations + código citados em D0). Nenhum documento cuja relevância fosse inevitável ficou fora; conflito aparente entre 07 §3.1 e 0157 é RESOLVIDO por esta DECISION em D3 (não é conflito — são camadas distintas).

---

## D0 — FATOS FÍSICOS QUE ANCORAM A DECISION (prova de 1ª mão, read-only, 2026-07-17)

1. **Group JÁ É Actor pleno:** `groups.actor_id` 1:1 com `actors` (`uq_actors_group`, migration `20260530576000_group_actor_integrity.sql`), `actor_type='group'`, âncora civil `owner_actor_id` NOT NULL → actor `user` → `global_user_id` (DESENHO 3C §5).
2. **Company/PJ realiza-se como page-actor** vinculado (`actors.company_id`), nascimento atômico fiscal-first (DECISION-0075), DRAFT e não-comercial por nascimento.
3. **Vocabulário físico congelado:** CHECK de `actors.actor_type` tem 10 valores/3 gerações; DECISION-0157 congelou o canônico em `user·page·group·channel`; `actor_organizational` existe no CHECK como LEGADO-CONGELADO (zero writer permitido).
4. **Bank físico:** `bank_accounts.owner_type IN ('actor','system','escrow')` — comentário vivo em `backend/src/modules/bank/bank-account.repository.ts:33`: "Genesis: owner_type IN ('actor','system','escrow'). API usa 'user'|'company'|'system'|'escrow'." — ou seja, `user` e `company` da API são AMBOS traduzidos para o físico `'actor'`.
5. **Falsa representação vigente:** `backend/src/modules/bank/bank-integration.service.ts:55-67` — `resolveGroupAccount` resolve conta de grupo com `ownerType: 'company'` e TODO explícito ("Adicionar 'group' como ownerType se necessário"); fallback de resolução por `group_id` em `bank-account.repository.ts:296-304`.
6. **Espelho local:** `group_accounts.balance_cents BIGINT NOT NULL DEFAULT 0` (migration `20260530430000_groups_missing_tables.sql`) coexiste com `bank_account_id` → risco de segunda verdade financeira.
7. **Cap-3:** `groups.service.ts:434-436` e `:871-873` limitam a 3 grupos por usuário.
8. **`group_members`:** `user_id` + `role` TEXT livre (sem CHECK); AUSENTE de todo predicado de autorização (authority real = `actor_capability_grants` + `canRepresentActor`).
9. **Módulo `organization` CONTIDO 501:** `backend/src/modules/organization/organization.routes.ts:18-33` — handler blanket 501 fail-closed ANTES de qualquer service/repository/DB; as 4 tabelas (`organization_members`/`organization_invites`/`organization_roles`/`organization_units`) INEXISTENTES; migrations apenas no archive (`DT-ORGANIZATION-SPRINT78-FROZEN`, OPEN desde 2026-05-16).
10. **Endereço de grupo:** apenas `metadata` JSONB — fora de `addresses`/`address_assignments`.
11. **`DT-C1-INSTITUTIONAL-SYSTEM-ACTOR-PENDING` OPEN** (REMEDIATION_DT_LOG): ausência de sujeito institucional soberano DO TENANT para conteúdo sistêmico — frente distinta, ver D7.

---

## D0-ESCOPO

Esta DECISION é **docs-only**. Ratifica o contrato de composição organizacional e ordena o futuro. **NÃO materializa nada:** zero código · zero migration · zero DDL/DML · zero schema · zero dado · zero Group/Actor/membership/capability criados · zero Bank/`owner_type` · zero frontend · zero remoção física do módulo `organization` · zero alteração da DECISION-0157 · zero resolução do Actor sistêmico do tenant. Cada integração listada em D9 exige **GATE + GO próprios**.

---

## D1 — COMPOSIÇÃO CANÔNICA: ACTOR INSTITUCIONAL + GROUPS INTERNOS

A organização humanamente constituída (condomínio, igreja, associação, comunidade organizada) é representada por **UM Actor institucional principal** que detém: identidade, página universal, endereço canônico (futuro, D9), ativos (`actor_assets`), contas/ledger (futuro, D8/D9), contratos e autoridade.

As **estruturas internas** (conselho, torre, ministério, comissão, assembleia) são **Groups internos** vinculados ao Actor institucional (vínculo físico a definir em GATE próprio — D9.1), detendo: pertencimento, coordenação, votos leves e comunicação segmentada.

**Regra de não-herança:** o Group interno **NÃO herda** autoridade, conta, endereço ou capacidade financeira do Actor institucional. Só recebe o que for concedido explicitamente via grant (D5).

**Diferenças de setor** (condomínio vs igreja vs associação) vivem em **concepts, templates, blocos de página, papéis e capabilities** — precedente ONG da ontologia (18 §8.2: setor = especialização/contexto, nunca entidade-base). A página é a casca universal por blocos (ARQUETIPOS_PAGINA_CANONICOS); NÃO existe "página de condomínio" nem "página de igreja".

---

## D2 — PROIBIÇÃO DE NOVOS `actor_type`

É **PROIBIDO** criar qualquer novo valor de `actor_type` por segmento, nominalmente incluindo (não exaustivo):

```text
condominium · church · association · community · ngo · school · club · union · council
```

DECISION-0157 permanece o freio: o vocabulário canônico é `user·page·group·channel`; qualquer novo `actor_type` exigiria nova DECISION soberana, e a ontologia (18 §3.2/§8.2) já NEGA entidade-base a setores. É igualmente **PROIBIDO reviver** `actor_organizational` (ou qualquer legado congelado) como writer.

---

## D3 — RECONCILIAÇÃO: CATEGORIA CONSTITUCIONAL × FORMA OPERACIONAL

O aparente conflito entre a hierarquia constitucional (07_NOMENCLATURA §3.1: `actor_human`/`actor_organizational`/`actor_system`) e o vocabulário físico congelado (DECISION-0157: `user·page·group·channel`) é resolvido assim:

```text
actor_human          — categoria constitucional → forma operacional materializada: user
actor_organizational — categoria constitucional → formas operacionais materializadas: page · group
actor_system         — categoria constitucional → forma operacional futura (sem writer hoje; ver D7)
```

`actor_organizational` **não foi abandonado**: é a categoria constitucional da qual `page` (organização formalmente constituída, via Company/PJ) e `group` (organização/estrutura informal com âncora civil) são as formas operacionais físicas. A hierarquia constitucional permanece vigente por inteiro: `actor_organizational` NUNCA é soberano; toda ação rastreável até um `actor_human` (via `company_users`/responsável fiscal no page-actor; via `owner_actor_id` no group-actor). Os VALORES FÍSICOS legados `actor_human`/`actor_organizational`/`actor_system` no CHECK continuam CONGELADOS-LEGADO (0157) — a categoria vive na Constituição, não em linhas novas do banco.

---

## D4 — BIFURCAÇÃO FORMAL / INFORMAL

```text
Organização FORMALMENTE constituída (CNPJ)
  → nasce pelo caminho Company/PJ fiscal-first (DECISION-0075)
  → Actor institucional = PAGE-ACTOR
  → natureza expressa por concept/company_type/template ("condomínio", "igreja", "associação"),
    NUNCA por actor_type

Organização INFORMAL (sem CNPJ)
  → Actor institucional = GROUP-ACTOR
  → âncora civil humana obrigatória (owner_actor_id → user-actor → identidade), DESENHO 3C §5
```

O caminho PJ NÃO deforma a organização não-comercial: o nascimento é fiscal e institucional, DRAFT, Δbank=0, sem oferta obrigatória — marketplace/PDV/ofertas são capacidades posteriores gated. O rótulo "company" é resíduo SEMÂNTICO/nominal a tratar por vocabulário/template (D9.7), não por schema.

**Formalização futura (informal → formal) é TRANSIÇÃO GOVERNADA, nunca instituição duplicada.** O 02_ACTORS_SSOT §3 proíbe representar o mesmo Actor em estruturas paralelas: quando uma organização informal (group-actor) obtiver CNPJ, o processo de vinculação/transição será desenhado em GATE próprio — é PROIBIDO simplesmente criar um segundo Actor institucional desconectado do primeiro.

---

## D5 — MEMBERSHIP ≠ AUTORIDADE

Fixa-se, alinhado à LEI_DE_COERENCIA (§4.9.5 e fronteira §4.10):

```text
Membro        ≠ representante
Papel (role)  ≠ capability
Voto          ≠ movimentação financeira
Residência    ≠ poder administrativo
```

Papéis com poder (síndico, tesoureiro, líder, conselheiro-gestor) exercem-se EXCLUSIVAMENTE via:

```text
actor humano responsável
+ canRepresentActor
+ capability específica
+ grant vigente (actor_capability_grants, DECISION-0136)
+ escopo
+ trilha de auditoria
```

`group_members`/`company_users` permanecem trilho SOCIAL/OPERACIONAL. O papel DESCREVE a função; o grant CONCEDE a autoridade. Capabilities organizacionais nomeadas (ex.: gestão de membros, assembleia, ativos, aprovações) **ainda não existem e NÃO são criadas aqui** — serão nomeadas em decisão/GATE futuro (D9), nunca inventadas dentro de material.

---

## D6 — `organization_*` REJEITADO COMO CASA CANÔNICA (sem remoção física)

O módulo `organization` (Sprint 78) está **definitivamente REJEITADO como casa canônica** da composição organizacional. A composição vive em `actors` + `groups` + memberships canônicos + `actor_capability_grants` — nunca em `organization_roles`/`organization_members`/`organization_invites`/`organization_units`.

**Distinção obrigatória:**

```text
descontinuação arquitetural como casa   (decidida AQUI)
≠
remoção física imediata do código contido (NÃO autorizada aqui — frente posterior própria)
```

Estado preservado: as 4 tabelas continuam AUSENTES do banco; `organization_members` permanece **tombstone**; as rotas seguem CONTIDAS em 501 blanket fail-closed (`organization.routes.ts`); migrations permanecem apenas no archive (archive NÃO é SSOT vigente). É **PROIBIDO** religar o módulo, materializar as tabelas ou usá-lo "por aproveitamento" em qualquer frente desta composição. A futura audiência "somente membros" (D9.4) **deriva do membership canônico vigente** — jamais ressuscita o schema tombstone, ainda que reutilize o NOME semântico "organization_members" como rótulo de audiência.

Efeito no cartório: `DT-ORGANIZATION-SPRINT78-FROZEN` muda de "congelada aguardando demanda" para **REJEITADA-COMO-CASA (limpeza física = frente posterior)** — o critério de descongelamento (a)/(b)/(c) daquela DT fica SUPERADO por esta DECISION.

---

## D7 — SEPARAÇÃO EXPRESSA: ACTOR ORGANIZACIONAL INSTITUCIONAL ≠ ACTOR SISTÊMICO DO TENANT

```text
Esta DECISION usa "Actor organizacional institucional" para entidades
humanamente constituídas, como condomínio, igreja e associação.

Ela NÃO decide, cria ou autoriza o "Actor institucional sistêmico do tenant"
registrado em DT-C1-INSTITUTIONAL-SYSTEM-ACTOR-PENDING.
```

O sujeito institucional DO TENANT para avisos oficiais, boas-vindas e conteúdo sistêmico é frente DISTINTA, da categoria constitucional `actor_system`, regida por DECISION-0101 D6 (proibido `SYSTEM_ACTOR_ID` hardcoded; proibido get-or-create em runtime) e pendente de decisão própria. Nada nesta DECISION cria, antecipa ou restringe aquela frente. Fica vedado que "Actor institucional" ganhe dois significados incompatíveis: nesta DECISION e em todo material dela derivado, o termo refere-se SEMPRE a organizações humanas.

---

## D8 — DTs FINANCEIRAS CONGELADAS (registro SEM solução física)

Duas dívidas são registradas e CONGELADAS; a solução física NÃO é escolhida aqui:

**DT-GROUP-ACCOUNT-OWNERTYPE-COMPANY-MASQUERADE** — `resolveGroupAccount` (`bank-integration.service.ts:55-67`) resolve conta de grupo declarando `ownerType: 'company'` (TODO explícito no código). Fato agravante que PROÍBE pré-decisão: o repositório traduz `user` E `company` para o MESMO físico `owner_type='actor'` (`bank-account.repository.ts:33`; valores físicos = `actor|system|escrow`). Logo, "adicionar `group` como ownerType" poderia ser apenas mais uma classificação paralela de API sobre o mesmo físico — quando Group JÁ É Actor.

**DT-GROUP-ACCOUNTS-BALANCE-CENTS-PARALLEL-TRUTH** — `group_accounts.balance_cents` (migration `20260530430000`) é campo local coexistindo com `bank_account_id`. Se tratado como saldo próprio, é segunda verdade financeira. O saldo real vem EXCLUSIVAMENTE do `bank_ledger`/UnifyBank; campo local só pode ser read model descartável, nunca autoridade.

**Resolução prevista (NÃO executada aqui):**

```text
GATE Bank para definir a resolução canônica da conta do group-actor,
eliminar a falsa representação como company e decidir se a conta deve
ser resolvida diretamente pelo Actor, sem criar novo owner_type físico.
```

**Hipótese preferencial registrada (não vinculante):**

```text
Group é Actor; portanto, a conta tende a pertencer ao Actor,
não a uma nova classe financeira chamada group.
```

A forma exata fica para o GATE financeiro (D9.8 — último da ordem). Até lá: nenhum caller novo pode ampliar o uso da máscara `'company'`; nenhum leitor novo pode tratar `balance_cents` como verdade.

---

## D9 — ORDEM DAS INTEGRAÇÕES FUTURAS (cada uma atrás de GATE + GO próprios)

Nenhum item abaixo está autorizado por esta DECISION. A ordem é vinculante; pular etapa exige decisão soberana nova.

| # | Integração | Conteúdo mínimo | Fora dela |
|---|---|---|---|
| 1 | **Vínculo Grupo → Actor institucional** | GATE read-only decide a forma física (coluna governada em `groups` vs tabela de vínculo vs relação entre Actors) LENDO o schema vivo; depois material mínimo: vínculo canônico + tenant coherence + autoridade de criar/encerrar grupo interno + lifecycle/histórico + guard anti-herança de autoridade + RLS + testes/mutations | Bank, endereço, audiência, frontend completo |
| 2 | **Membership actor-first + papéis governados** | migrar `group_members` do padrão user-based; role governado (fim do TEXT livre — D3 adiada do 3C); entrada/saída/vigência; proprietário × morador × conselheiro; remoção do cap-3 para grupos institucionais; SEM capability implícita | grants automáticos por papel |
| 3 | **Capabilities organizacionais nomeadas** | nomear e registrar (ex.: gestão de membros/assembleia/ativos/aprovações) no substrato 0136/0173-0185; grants a group-actor como grantee | qualquer capability financeira |
| 4 | **Audiência "somente membros"** | regra de visibilidade derivada do membership canônico vigente (hoje: public/connections/same_city); audiência decide quem VÊ, não concede autoridade | ressuscitar `organization_members` físico (D6) |
| 5 | **Endereço canônico + página universal** | organização usa `addresses`+`address_assignments`+cidade/bairro canônicos (fim do JSONB); blocos "instituição" na página universal (membros/grupos/votações/eventos/ativos/prestação de contas) | página nova por vertical |
| 6 | **Governança formal** | assembleia com eleitorado elegível/quorum/abertura-encerramento/voto único/ata/resultado imutável/efeito autorizado; votação produz DECISÃO/AUTORIZAÇÃO (integra `financial_approval_*`), nunca move dinheiro | execução financeira |
| 7 | **Projetos e procurement cívico** | projeto real (orçamento/fornecedores/etapas/cronograma/medições/documentos) compondo procurement+agreements+Agenda+ativos; substitui "CREATE_PROJECT = post"; resíduo semântico "company" para PJ não-comercial (vocabulário/rotulagem/template) tratado aqui ou em decisão própria | novo Actor/domínio |
| 8 | **Financeiro (ÚLTIMO)** | GATE Bank de D8; conta institucional; contribuições/cobranças; integração aprovação→execução; prestação de contas; reversal; fim do risco `balance_cents` | tudo, até GO próprio |

---

## EXPRESSAMENTE NÃO AUTORIZADO POR ESTA DECISION

código · migration · schema/dados · remoção física do módulo `organization` · criação de Group/Actor/membership/capability · Bank/`owner_type` · frontend · alteração da DECISION-0157 · resolução do Actor sistêmico do tenant · auditoria/selo em nome da Yala · qualquer item de D9 sem GATE+GO próprios.

---

## CONSEQUÊNCIAS NO CARTÓRIO

1. `REMEDIATION_DT_LOG.md`: registro da promulgação; abertura de `DT-GROUP-ACCOUNT-OWNERTYPE-COMPANY-MASQUERADE` e `DT-GROUP-ACCOUNTS-BALANCE-CENTS-PARALLEL-TRUTH` (D8, congeladas); anotação de superação do critério de descongelamento em `DT-ORGANIZATION-SPRINT78-FROZEN` (D6, sem fechar a DT — limpeza física pendente).
2. `dividatecnica.md`: espelho resumido da promulgação e das 2 DTs financeiras.
3. Após o commit docs-only: **STOP** — o arco inteiro segue para UMA única auditoria Yala.
