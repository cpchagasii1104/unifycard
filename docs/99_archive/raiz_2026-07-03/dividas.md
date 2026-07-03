# DÍVIDAS TÉCNICAS — PLANO DE FECHAMENTO POR RAIZ (vivo)

> **Autor:** instância **IA-DT** (especialista em dívidas técnicas), a pedido de Clayton (diretor).
> **Modo:** READ-ONLY / GUARDIÃO — este documento é **mapa e fila**, não norma soberana, não executa nada.
> **Executor único futuro:** `unificard`. **Verificadora/selo:** Yala.
> **Fontes soberanas:** cada DECISION, `REMEDIATION_DECISIONS_LOG.md`, `REMEDIATION_DT_LOG.md`, `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`, schema/runtime vivo.

---

## 0. Estado vivo verificado (auditoria desta sessão)

> ⚠️ **ATUALIZAÇÃO 2026-06-08 (premissa ENVELHECEU — ler antes do resto deste arquivo):** o §0 abaixo
> está ancorado em `6c8be18c` e diz "arco DECISION-0113 EXECUTADO ponta a ponta / DT-mãe CLOSED". **ISSO
> FOI SUPERADO.** Desde então: **(a)** a Yala retratou o "todas as superfícies vivas" — achou resíduo
> (feed/inbox/events) → **DT-mãe REABERTA/OPEN**; **(b)** F6.5.x em curso (6.5.1–6.5.6a entregues/seladas;
> 6.5.6b events + 6.5.7/8/9 pendentes); **(c)** apareceu um **2º vetor de spoof** — `x-actor-id`/query
> `actor_id` via `resolveActiveActorFromRequest` — primitivo corrigido em `9996cbd2` (**aguardando selo Yala**);
> **(d)** enquadramento canônico (Clayton): **DECISION-0113 = QUALQUER `actorId` declarado pelo cliente**
> (5 canais: actionContext.actorId · x-actor-id · query actor_id · params actorId · params id de recurso privado).
> **HEAD vivo ≈ `5205ecbb`** (avançou muito além de `6c8be18c`). **Qualquer uso futuro deste plano DEVE
> revalidar HEAD/migrations/DTs antes de execução.** A tabela de fatias abaixo cobre só o 1º vetor e pára em F6.4.
>
> **Impacto em R2:** o desenho R2 (§2/§3) **continua correto** (R2 não é greenfield; `actor_delegations` existe;
> gap é semântico/cadeia §4.9.9/audit/risco), MAS **a pré-condição "0113 fechada" está mais longe** do que este
> plano supõe. **R2 NÃO está autorizado.** Pré-condição correta agora: fechar o arco **considerando os DOIS
> vetores** (actionContext.actorId **e** x-actor-id/actor_id) → concluir F6.5.x → **Yala selar `9996cbd2`** →
> **sweep de confirmação dos consumidores do resolver** → fechar/enquadrar `DT-CANACTAS-CHECKOWNERSHIP-STALE`
> → **só então R2.0 read-only**. Dois achados a somar ao desenho R2 (verificados de 1ª mão): **(1)**
> `actor-capabilities.service.ts:161` TAMBÉM lê `findActiveByUserActor` (2º reader — blast-radius de R2.1);
> **(2)** `actor_delegations` **não tem FK→`actors` nem CHECK em `status`** nem audit append-only — FK exige
> cuidado (há 94 atores legados com `global_user_id IS NULL`). **Síntese:** _R2 é a próxima raiz provável depois
> do fechamento REAL da DECISION-0113. O plano R2 é bom, mas está congelado até os dois vetores de spoof de
> actorId estarem fechados e selados._

- **HEAD:** `6c8be18c` · **Branch:** `rescue-structural` · **Migrations dev:** **365** — **CONFIRMADO** _(NOTA: stale — ver atualização acima; HEAD vivo ≈ `5205ecbb`)_
- **Working tree:** limpo exceto untracked não-relacionados (autorais protegidos, `Clayton.md`, `Cleiton.md`, `docs/memorias/`) — não tocados.
- **Arco DECISION-0113 (authority-binding) — EXECUTADO ponta a ponta:**
  | Fatia | Commit | Estado |
  |---|---|---|
  | F1 RBAC bind `req.user` | `2d35c91a` | ✅ |
  | F2 escalation (company-members/organization) | `04b74909` | ✅ |
  | F3 money LIVE (3 rotas) | `e6c369fe` | ✅ |
  | F5.1 plan + identity-config self-only | `bc103e34` | ✅ |
  | F5.2 profile-C1 representabilidade | `9363670e` | ✅ |
  | F5.3 lifestyle/LGPD autoria provada | `e85d9f8b` | ✅ |
  | F6.1 5 reads financeiros | `77cd8a0f` | ✅ |
  | F6.2/6.3 identity-config GET self + /me/* | `da7f1377` | ✅ |
  | F6.4 criação de grupo + self | `6c8be18c` | ✅ (HEAD) |

- **DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`** → ~~CLOSED (superfícies vivas)~~ **RETRATADO → REABERTA/OPEN (2026-06-08)** — a Yala achou resíduo (caso (d): feed/inbox/events) + 2º vetor (x-actor-id); fecha só com os 5 canais cobertos + selo Yala. Ver atualização no topo do §0.
- **DTs-folha do arco 0113:** `PLAN-PUT-PRIVILEGE-SPOOF`, `IDENTITY-CONFIG-ACTOR-SPOOF`, `PROFILE-C1-EXISTENCE-ONLY-RESOLVER`, `LIFESTYLE-CONSENT-AUTHORSHIP-UNBOUND` → **todas CLOSED**.
- **`DT-CANACTAS-CHECKOWNERSHIP-STALE-VS-CANMANAGECOMPANY` (F6)** → **OPEN** — entregue em código, **aguardando selo final de Yala**.
- **Money latente / Fundo Regional / AP-AR** → `DT-MONEY-LATENT-REACTIVATION-TRAP`, `DT-REGION-FUND-DELEGATION-MODEL-PENDING`, `DT-AP-AR-FINANCE-AUTHORITY-MODEL-PENDING` → **OPEN** (CONFIRMADO).

> **Status do plano-mãe anterior (HEAD `0e649e46`):** **aprovado como MAPA DE RAÍZES**, mas **superado como FILA** no trecho F5/F6 — isso já andou. Continua válido para R2 (delegação), R3 (grupo), R4 (marketplace), R6 (higiene) e money latente.

---

## 1. Próximo passo REAL (governança, antes de abrir nova raiz)

**A fila mudou. A próxima ação NÃO é F5.1 (já fechou). É selar o arco 0113 e só então escolher a próxima raiz.**

1. **Yala verifica a F6 completa** (commits `77cd8a0f`, `da7f1377`, `6c8be18c`).
2. **Se Yala der verde:**
   - fechar formalmente `DT-CANACTAS-CHECKOWNERSHIP-STALE-VS-CANMANAGECOMPANY`;
   - confirmar/selar a DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` (já marcada CLOSED-superfícies-vivas; o selo Yala dá o fecho de governança e trata o RESÍDUO-DIFERIDO).
3. **Só depois** abrir a próxima raiz (R2 / R3 / R4) — uma de cada vez.

> Enquanto o selo de F6 não vier: **não abrir raiz nova.** A espinha 0113 precisa fechar com cartório antes de empilhar a próxima.

---

## 2. Escolha da próxima raiz (recomendação)

Depois do selo, a escolha é entre:

| Opção | Raiz | Fecha | Toca Bank/split? | Três paralelas? | Recomendação |
|---|---|---|---|---|---|
| **A** | **R2 — Delegação / authorized links** | base p/ sócio, diretor, financeiro, procuração, equipe, antifraude (~8 DTs) | Não (substrato de autoridade) | Não | **PREFERIDA** |
| B | R3 — Grupo / ECON-1 | dinheiro de grupo (~6 DTs) | **Sim** (Bank/split/payout) | **Sim, obrigatório** | adiar |

**Recomendação da IA-DT (alinhada à diretora):** **entrar em R2 (Delegação) antes de R3 (Grupo).**
Razão: delegação formal é **infraestrutura** para PJ, equipe, financeiro futuro, ERP/CRM/PDV e antifraude. Sem ela, cada módulo inventa o próprio "crachá" → fragmentação de autoridade sobre o ledger. R3 é pesado (toca Bank/split/payout, exige três paralelas) — não entrar nele ainda.

---

## 3. Mapa-mãe das raízes (histórico, parcialmente superado — referência para R2/R3/R4/R6)

> R1 está **fechado** (arco 0113). As demais permanecem como mapa.

### R1 — Authority-binding (DECISION-0113) — ✅ EXECUTADO (selo F6 pendente)
- Resultado: autoria soberana em superfícies vivas; fim do duplo-spoof (privilégio + sujeito).
- Resíduo: selo Yala de F6 + RESÍDUO-DIFERIDO da DT-mãe.

### R2 — Delegação / authorized links (`actor_delegations`) — **PRÓXIMA RAIZ PROVÁVEL**
- **Raiz:** `DT-PJ-AUTHORIZED-LINKS-SUBSTRATE-MISSING` + `DT-ACTOR-DELEGATIONS-ZERO-RUNTIME` (OPEN).
- **Filhas (cascata):** `DT-PJ-ANTI-LARANJA-CORRELATION-MISSING`, `DT-PJ-TRANSVERSAL-RISK-SIGNALS-MISSING`, `DT-PJ-CREDENTIAL-SHARING-RISK-GUARD-MISSING`, `DT-RISK-ENTERPRISE-CASE-REVIEW-SUBSTRATE-MISSING`, `DT-RISK-HUMAN-OPERATIONS-SUBSTRATE-MISSING`, `DT-RISK-FALSE-POSITIVE-SAFEGUARD-MISSING`, `DT-PJ-TRANSITIONAL-RESPONSIBILITY-MISSING`, residual sócio/diretor/procuração (de `COMPANY-USER-ROLE-VOCABULARY`), `DT-AUTHORITY-AUDIT-LIMITED-TO-FINANCIAL`.
- **Pré-condição:** R1 fechada (✅, pendente selo) + **desenho greenfield** + decisão de Clayton sobre escopo. O primitivo `canRepresentActor` (F1) já existe — a delegação **lê** dele; falta o **substrato populável** (vínculos formais).
- **Alavancagem:** ALTA (~8 DTs). **Risco:** autoridade/identidade (não Bank). **Ordem interna:** desenho read-only → substrato `actor_delegations` → vínculos (sócio/diretor/procuração) → grafo de risco.

### R3 — Dinheiro de grupo / ECON-1 — **CONGELADO até "go" + três paralelas**
- **Raiz:** convergência da conta de grupo (`CONTRATO_GRUPOS_V2` VIGENTE — dois bolsos: `actor_wallet` + `group_community_fund`). **Cofre DESLIGADO.**
- **Filhas (ordem dura):** `DT-ENSURE-ACTOR-WALLET-NOT-IDEMPOTENT-UNDER-RACE` → `DT-GROUP-ACTOR-WALLET-NOT-PROVISIONED` → `DT-SPLIT-ENGINE-GROUP-WALLET-LEGACY-LOOKUP` (BLOQUEANTE de ECON-2) → `DT-GROUP-MONEY-THREE-PARALLEL-SUBSTRATES` + `DT-BANK-ACCOUNTS-UNIQUE-INDEX-INSUFFICIENT` → `DT-USER-GROUP-ALLOCATIONS-SILENT-CALL-CLEANUP`.
- **Armadilha:** nunca repontar o split antes de provisionar a conta.

### R4 — Semântica / domínio marketplace — **CONGELADO até palavra de Clayton**
- **Raiz:** `DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD` (GOVERNED 0105; **`financeiro-*` é viga do Bank — NÃO TOCAR**).
- **Filhas:** `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` (GOVERNED 0106), `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` (OPEN), residual de `OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` / `ONBOARDING-DOMAIN-SELECTION-MISSING` (eixo A), `DT-PJ-CANONICAL-CATALOG-SHARED-ITEMS-NOT-PER-VERTICAL` (Trilhos A/B).

### R6 — Cauda second-truth / higiene / stale — **CAMADA C (oportunístico)**
- `DT-PJ-VERIFIED-AT-LEGACY-THIRD-GHOST` (só texto), `DT-PJ-IS-VERIFIED-DEPRECATED-COMPAT` (drop pós-migração — revalidar coluna), `DT-PJ-EPHEMERAL-FIXTURES-STALE-VS-BASELINE-365` + fixtures stale.

---

## 4. Money latente — confirmado OPEN, não esquecer

O plano-mãe acertou: **money latente não está fechado.**
- `DT-MONEY-LATENT-REACTIVATION-TRAP` — **OPEN.** Serviços mortos por proxy, mas carregam risco se religados **sem gate no mesmo corte**. Reativar exige binding de autoria junto.
- `DT-REGION-FUND-DELEGATION-MODEL-PENDING` — **OPEN.** Espera modelo de delegação do Fundo Regional.
- `DT-AP-AR-FINANCE-AUTHORITY-MODEL-PENDING` — **OPEN.** Espera modelo de autoridade AP/AR (tenant-finance vs company-finance vs delegado).
- **Regra:** nenhum desses 3 religa sem decisão de modelo + gate de autoria no mesmo PR. Pertencem a F4 do arco 0113 / DECISION-0114, **congelados** até Clayton decidir os modelos.

---

## 5. Decisões pendentes de Clayton

1. **Selo de governança:** dar ok para Yala selar F6 e fechar formalmente a DT-mãe 0113 (passo 1 da §1).
2. **Próxima raiz:** confirmar **R2 (delegação)** como próxima (recomendado) vs R3/R4.
3. **R2 escopo:** autorizar desenho do substrato `actor_delegations` populado (sócio/diretor/procuração) + escopo do grafo de risco.
4. **DECISION-0114 modelos:** Fundo Regional (delegação) + AP/AR (autoridade) — gate de money latente.
5. **R3 grupo:** "go" + autorização das três paralelas (quando for a vez).
6. **R4 marketplace:** "palavra" para executar (remoção do `hybrid` atômico + consumo do mapa 0106).
7. **Higiene R6:** timing do DROP de `is_verified` (política de dados não-zero).

---

## 6. Perguntas para outras instâncias (antes de prompt executor da próxima raiz)

**PEDIDO PARA IA-NORMAS (R2):**
- Existe norma/contrato que já fixe a forma da cadeia de delegação (`delegation_chain`, níveis, temporalidade, fecho humano §4.8/§4.9.9)? O que pode ser materializado sem nova DECISION?
- Documentos: `08_AUTORIDADE_CANONICA`, `AUTHORITY_LAW`, `SSOT_REGISTRY §5.16`, `LEI_DE_COERENCIA §4.9.9`.
- Voltar: o que já está promulgado vs o que exige DECISION nova para R2.

**PEDIDO PARA IA-BANCO (R2/R6):**
- `actor_delegations` no schema vivo: existe? colunas/CHECK/FK/índice? (confirmar antes de "substrato ausente").
- `companies.is_verified` ainda existe ou já caiu (3.3-B2)? (reconciliar R6).
- Query: `\d+ actor_delegations`; `SELECT column_name FROM information_schema.columns WHERE table_name='companies' AND column_name='is_verified';`
- Voltar: forma real para desenhar R2 sem reinventar.

**PEDIDO PARA IA-CÓDIGO (R2):**
- Mapear callers de `canRepresentActor`/`canActAs`/`actorDelegationRepository`; onde o runtime hoje lê delegação (mesmo que vazia); rotas que dependeriam de vínculo formal (company-members, financeiro futuro).
- Voltar: pontos de costura para popular delegação sem quebrar o binding 0113.

**PEDIDO PARA IA-BLAST-RADIUS (R2):**
- O que muda quando `actor_delegations` deixa de ser zero-runtime? Quem passa a poder representar quem? Regressões: owner intacto, delegado aceito só no escopo, terceiro rejeitado.
- Ordem segura de fatias do substrato + e2es novos.

---

## 7. DTs que NÃO devem ser atacadas agora

- **R3 grupo** inteiro (cofre DESLIGADO; espera "go" + três paralelas).
- **R4 marketplace** (`hybrid`, eixo-A, Trilhos A/B — "não executar antes da palavra de Clayton").
- **Money latente** Fundo Regional / AP-AR (espera modelos 0114).
- `financeiro-*` em `concepts.domain` (**viga do Bank — nunca renomear sem tratar o hardcode**).
- `DT-PROFILE-PROFESSIONAL-SERVICE-TABLES-ARCHIVE-ONLY` (não restaurar archive; exige desenho).
- `DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING` (greenfield; defer).
- `DT-PJ-HUMAN-LINK-DOCUMENTS-LGPD-MISSING` (trilho próprio; defer).
- KYB **produção** (`*-PRODUCTION-STORAGE-PROVIDER`, `*-PRODUCTION-MALWARE-SCANNER`) — deploy/infra; só quando for para produção.
- Cauda LOW (naming/cents Bank, referral, regional-funds-deprecation), módulos FROZEN/DORMANT, `DT-GROUPS-VOTES-SCHEMA-DRIFT` (dormente).

---

## 8. Recomendação final

- **Agora:** Yala sela F6 (`77cd8a0f` / `da7f1377` / `6c8be18c`) → fechar `DT-CANACTAS-...` + selar DT-mãe 0113. **Nenhuma raiz nova antes disso.**
- **Próxima frente READ-ONLY:** desenho de R2 (delegação) — despachar os PEDIDOs da §6 (IA-NORMAS/BANCO/CÓDIGO/BLAST-RADIUS) e confirmar o substrato `actor_delegations` no vivo.
- **Próxima frente EXECUTÁVEL (após selo + desenho + ok de Clayton):** **R2 — substrato de delegação / authorized links.**
- **Congelar:** R3 grupo, R4 marketplace, money latente (region/AP-AR), e tudo da §7.

> **Síntese:** o arco de autoria (R1/DECISION-0113) está **materialmente fechado**; falta só o **selo de Yala** sobre F6. A maior alavanca seguinte, de baixo risco e que vira infraestrutura para quase tudo (PJ, equipe, financeiro, antifraude), é **R2 — Delegação**. Grupo (R3) é pesado e fica para depois, com três paralelas. Money latente segue **OPEN e vigiado** — não religar sem modelo + gate no mesmo corte.

---

## 9. Disciplinas vinculantes (toda execução futura)

- PJ, grupo, Bank e marketplace **nunca** na mesma execução.
- Financeiro só com **E2E específico fail-first**; grupo/Bank/split/payout só com **três paralelas**.
- SQL a `bank_*` só dentro de `backend/src/modules/bank/`.
- Nada chamado de "fechado" sem prova material; usar **CONFIRMADO / PROVÁVEL / PENDENTE / BLOQUEADO**.
- Reconfirmar HEAD/branch/migrations **no momento de cada fatia** (o repo anda rápido — esta sessão já viu o HEAD pular `a312174a → 0e649e46 → 6c8be18c`).
- Reconciliação documental do log de DTs é frente da executora/cartório — a IA-DT **sinaliza**, não edita o log.

---

_Gerado pela IA-DT em 2026-06-08 · HEAD `6c8be18c` · branch `rescue-structural` · dev 365 migrations · auditoria read-only._

VEJA O PLANO QUE HAVIA SIDO GERADO E ATUALIZE ELE COM O QUE JÁ FOI FEITO:

# R2 — DELEGAÇÃO / AUTHORIZED LINKS · DESENHO READ-ONLY (pré-execução)

> **Instância:** IA-DT (READ-ONLY) · **Para:** executora `unificard` (futuro) · **Selo:** Yala.
> **Plano-mãe vivo:** `C:\unificard\dividas.md` (HEAD `6c8be18c`). Este arquivo detalha **só a raiz R2**, pronto para virar a §"R2 detalhado" de `dividas.md` quando Clayton aprovar.
> **Pré-condição de governança:** Yala selar F6 do arco 0113 + fechar `DT-CANACTAS-CHECKOWNERSHIP-STALE` antes de abrir R2 em execução.

## Context — por que R2 e por que agora

Com o arco de autoria (DECISION-0113) materialmente fechado, a próxima raiz de maior alavancagem e **baixo risco** (não toca Bank) é **R2 — Delegação / authorized links**: a base para sócio, diretor, financeiro, procuração, equipe e antifraude. Sem ela, cada módulo inventa o próprio "crachá" e a autoridade sobre o ledger fragmenta. Clayton (diretora) recomendou R2 antes de R3 (grupo). Este desenho é **read-only**: mapeia o substrato vivo, o gap real e a sequência segura de fatias — não executa.

## Estado vivo verificado (READ-ONLY, HEAD `6c8be18c`, dev 365)

**Correção material vs o plano-mãe (que tratava R2 como "greenfield"):** R2 **NÃO é greenfield**. O substrato existe; o gap é semântico/normativo.

- **Tabela `actor_delegations` — EXISTE** (`backend/migrations/20260530493000_create_actor_delegations.sql`):
  `delegation_id, tenant_id, user_actor_id, institutional_actor_id, scopes_json (JSONB), is_transitive, expires_at, status('active'|'revoked'|'expired'), created_at, updated_at, revoked_at`. Índices `(tenant,user)` e `(tenant,institution)`.
- **Repository — EXISTE** (`backend/src/core/actor-delegation/actor-delegation.repository.ts`): `create` (com `softBlockService.validateDelegation` + revoga ativas anteriores do mesmo par), `findActiveByUserActor`, `revoke`.
- **Writer VIVO — EXISTE** (parcial): `company-members.service.ts:96` cria delegação ao adicionar membro; `:201` revoga. (Também `seed-smoke-p3.ts` — script.) → **`DT-ACTOR-DELEGATIONS-ZERO-RUNTIME` está PROVAVELMENTE PARTIAL/STALE** (há writer vivo). **REVALIDAR.**
- **Reader/binding — EXISTE e amplamente fiado:** `authorization.service.canRepresentActor` (`:333`) lê `findActiveByUserActor` (`:554`) e casa `institutionalActorId === actorId` (`:560`). O arco 0113 já consome `canRepresentActor` em ~12 rotas (identity, profile-C1/learning/interest/lifestyle, me-active-location, marketplace event-settlement/payment-method/unifycard-method, organization, social-2.0, rbac.plugin).

**Conclusão:** o **primitivo de delegação** (tabela + repo + leitura + binding) está vivo. O que falta para R2 fechar seu cluster é **três camadas ausentes**, abaixo.

## Gap real de R2 (o que falta materialmente)

1. **Semântica de vínculo PJ (authorized links).** A delegação atual é genérica (`scopes_json`), criada pela adição de membro. **Não modela** o tipo de vínculo humano (sócio / diretor / administrador / procurador / responsável legal), nem a distinção normativa **responder ≠ operar ≠ representar ≠ validar** (DECISION-0083). O residual de `DT-PJ-COMPANY-USER-ROLE-VOCABULARY` (hoje `roleDescription` texto livre) deve aterrissar aqui como **autoridade governada**, não rótulo.
2. **Campos da cadeia (§4.9.9 / SSOT §5.16).** A norma exige `delegation_chain`: `actor_origem`, `actor_destino`, escopo, validade temporal, **referência ao elo anterior**, **fecho até actor humano §4.8**, e **trilha append-only**. A tabela atual **não tem**: `granted_by_actor_id` (quem concedeu, com que autoridade), `previous_link_id` (encadeamento), nem trilha append-only (o `revoke` é flip de status, não evento). `expires_at` (temporalidade) já existe; `is_transitive` existe mas sem fecho humano enforçado.
3. **Camada de risco (greenfield, sub-front próprio).** `anti-laranja`, `risk_signals`, `credential-sharing-guard`, `enterprise-case-review`, `risk-human-operations`, `risk-false-positive` — pressupõem (1) e (2) prontos. Não começam antes.

## DTs no cluster R2 (status vivo a revalidar)

| DT | Status no log | Papel em R2 |
|---|---|---|
| `DT-PJ-AUTHORIZED-LINKS-SUBSTRATE-MISSING` | OPEN | **Raiz** — semântica de vínculo PJ (camada 1) |
| `DT-ACTOR-DELEGATIONS-ZERO-RUNTIME` | OPEN — **REVALIDAR (provável PARTIAL)** | há writer vivo (company-members); falta governança/cobertura |
| `DT-AUTHORITY-AUDIT-LIMITED-TO-FINANCIAL` | OPEN | trilha append-only de grant/revoke (camada 2) |
| `DT-PJ-TRANSITIONAL-RESPONSIBILITY-MISSING` | OPEN | responsável transitório na transferência (liga a D5) |
| `DT-PJ-ANTI-LARANJA-CORRELATION-MISSING` | OPEN | camada 3 (risco) |
| `DT-PJ-TRANSVERSAL-RISK-SIGNALS-MISSING` | OPEN | camada 3 (risco) |
| `DT-PJ-CREDENTIAL-SHARING-RISK-GUARD-MISSING` | OPEN | camada 3 (risco) |
| `DT-RISK-ENTERPRISE-CASE-REVIEW-SUBSTRATE-MISSING` | OPEN | camada 3 (risco) |
| `DT-RISK-HUMAN-OPERATIONS-SUBSTRATE-MISSING` | OPEN | camada 3 (risco) |
| `DT-RISK-FALSE-POSITIVE-SAFEGUARD-MISSING` | OPEN | camada 3 (risco) |
| residual `DT-PJ-COMPANY-USER-ROLE-VOCABULARY` (sócio/diretor/procuração) | CLOSED-com-residual | governar o rótulo como autoridade (camada 1/2) |
| `DT-CANACTAS-CHECKOWNERSHIP-STALE-VS-CANMANAGECOMPANY` | OPEN (F6) | reconciliar leitura `canActAs`×`canManageCompany` (camada 2/3) — **liga ao selo de F6** |

> **Alavancagem R2:** ALTA (fecha/encaminha ~8–10 DTs). **Risco:** autoridade/identidade (sensível) — **não toca Bank/ledger**. Por isso é preferível a R3.

## Sequência interna de R2 (fatias)

### R2.0 — Auditoria read-only (PRIMEIRA; não executa código)
- **Objetivo:** cravar alvos antes de qualquer schema. Confirmar: o que exatamente `company-members` grava em `scopes_json`; se `canRepresentActor` é o **único** reader (ou há outros); se `canActAs`/`canManageCompany` divergem (DT-CANACTAS); reconciliar status de `DT-ACTOR-DELEGATIONS-ZERO-RUNTIME` (provável PARTIAL); mapear gap exato vs §4.9.9.
- **Saída:** mapa de callers + tabela gap-vs-norma. **Despachar os 4 PEDIDOs** (§"Perguntas").
- **STOP:** se a auditoria revelar que `canManageCompany` já cobre tudo que R2 pretende, **reduzir escopo** (não construir camada redundante).

### R2.1 — Schema: semântica de vínculo + campos de cadeia (migration forward-only)
- **Objetivo:** estender o substrato para authorized links governados.
- **Mudanças prováveis (a ratificar por IA-NORMAS/Clayton):** coluna `relationship_type` (enum governado: `partner|director|administrator|attorney|legal_representative|employee|...`), `granted_by_actor_id`, `previous_link_id` (FK self, cadeia §4.9.9); **trilha append-only** de grant/revoke (tabela `actor_delegation_events` OU colunas — **decisão de modelagem**). `scopes_json` preservado.
- **DTs encaminhadas:** `DT-PJ-AUTHORIZED-LINKS-SUBSTRATE-MISSING`, base de `DT-AUTHORITY-AUDIT-LIMITED-TO-FINANCIAL`.
- **Gates:** schema-only; CHECK/FK/índice testados em DB efêmera; sem writer nesta fatia.
- **STOP:** não tocar `bank_*`; migration pequena, forward-only; não recriar `company_users` (vínculo formal) — authorized link **complementa**, não substitui.

### R2.2 — Writer governado de authorized link (code-only)
- **Objetivo:** grant/revoke de vínculo autorizado com **gate de autoridade** (só `owner`/`canManageCompany` concede; autoria provada via `canRepresentActor` — **depende de R1 ✅**). Distingue responder/operar/representar/validar. Aterra o residual sócio/diretor/procuração como **autoridade governada**.
- **DTs fechadas:** `DT-PJ-AUTHORIZED-LINKS-SUBSTRATE-MISSING` (com R2.1), residual `COMPANY-USER-ROLE-VOCABULARY`; encaminha `DT-PJ-TRANSITIONAL-RESPONSIBILITY-MISSING`.
- **Arquivos prováveis:** `actor-delegation.repository.ts` (estender), novo service de authorized-links, `company-members.service.ts` (passar a gravar com `relationship_type`/`granted_by`/chain), rotas de concessão.
- **Gates/E2Es:** 4 gates + e2e fail-first (concedente sem autoridade rejeitado; owner concede; vínculo expira; revoke append-only; PF intacta).
- **STOP:** writer não pode conceder escopo financeiro real sem o modelo AP/AR (DECISION-0114) decidido → escopo financeiro de delegação fica **fora** até lá.

### R2.3 — Reconciliar leitura (canActAs × canManageCompany) + cobertura
- **Objetivo:** fechar `DT-CANACTAS-CHECKOWNERSHIP-STALE-VS-CANMANAGECOMPANY` (F6) — garantir que `canActAs`/checkOwnership e `canManageCompany` leem a **mesma** verdade de delegação; cobrir consumidores vivos (company-members, financeiro futuro) sem divergência.
- **Pré-condição:** **selo Yala de F6** (esta DT é do arco 0113) — R2.3 é a ponte natural entre o fecho de R1 e R2.
- **STOP:** não reabrir `company_status` nem criar segundo reader.

### R2.4 — Camada de risco (greenfield; SUB-FRONT PRÓPRIO, depois)
- `anti-laranja`, `risk_signals`, `credential-sharing-guard`, `enterprise-case-review`, `risk-human-operations`, `risk-false-positive`. **Só após R2.1–R2.3** + decisão de escopo de Clayton. Desenho read-only próprio antes. **Não nesta abertura de R2.**

## Decisões pendentes de Clayton (para R2)

1. **Abrir R2** como próxima raiz (recomendado) — confirmar após selo de F6.
2. **Modelagem da trilha de audit:** tabela `actor_delegation_events` (append-only) vs colunas — preferência?
3. **Vocabulário de `relationship_type`** (sócio/diretor/administrador/procurador/responsável legal/…): lista governada — quem cunha (IA-NORMAS + Clayton).
4. **Escopo financeiro de delegação:** fica **fora** de R2 até o modelo AP/AR (0114) — confirmar.
5. **Camada de risco (R2.4):** escopo/timing (greenfield) — adiar para sub-front próprio.

## Perguntas para outras instâncias (antes do prompt executor de R2.1)

**PEDIDO PARA IA-NORMAS:**
- A cadeia `delegation_chain` (§4.9.9 / SSOT §5.16) exige `previous_link_id` + fecho humano §4.8 como **obrigatórios** no MVP, ou bastam `granted_by` + temporalidade? `relationship_type` é norma ou produto?
- Documentos: `LEI_DE_COERENCIA §4.8/§4.9/§4.9.9`, `SSOT_REGISTRY §5.16`, `08_AUTORIDADE_CANONICA`, `DECISION-0083`.
- Voltar: campos obrigatórios mínimos de R2.1 + vocabulário governado de vínculo.

**PEDIDO PARA IA-BANCO:**
- `actor_delegations` vivo: confirmar colunas/índices atuais (já lidos: sem `granted_by`/`previous_link_id`/audit); há FK de `user_actor_id`/`institutional_actor_id` → `actors`? `status` tem CHECK? Quantas linhas vivas hoje (mede "zero-runtime")?
- Query: `\d+ actor_delegations`; `SELECT status, count(*) FROM actor_delegations GROUP BY 1;`
- Voltar: forma real + contagem para revalidar `DT-ACTOR-DELEGATIONS-ZERO-RUNTIME`.

**PEDIDO PARA IA-CÓDIGO:**
- Mapear todos os readers de `actor_delegations`/`findActiveByUserActor` além de `canRepresentActor`; o que `company-members.service` grava em `scopes_json` (l.96); divergência `canActAs` × `canManageCompany` (DT-CANACTAS); callers de `softBlockService.validateDelegation`.
- Voltar: lista de consumidores + ponto exato onde inserir `relationship_type`/`granted_by` sem quebrar o binding 0113.

**PEDIDO PARA IA-BLAST-RADIUS:**
- O que muda ao gravar `relationship_type`/`granted_by`/chain em `company-members` (quem lê delegação hoje quebra com colunas novas?); regressões: owner concede, delegado age só no escopo, terceiro rejeitado, expiração honrada.
- Ordem segura: R2.1 (schema) → R2.2 (writer) → R2.3 (reconciliação leitura); cada fatia com e2e fail-first.

## DTs a revalidar (status possivelmente stale)
- `DT-ACTOR-DELEGATIONS-ZERO-RUNTIME` — **provável PARTIAL** (writer vivo via company-members). **PENDENTE IA-BANCO** (contagem de linhas) + IA-CÓDIGO.

## O que NÃO atacar dentro de R2 agora
- Escopo financeiro de delegação (espera AP/AR 0114).
- Camada de risco R2.4 (greenfield; sub-front próprio).
- `company_users` como vínculo formal — authorized link **complementa**, não substitui.
- Qualquer coisa de R3 (grupo) / R4 (marketplace) — outra raiz, outra execução.

## Recomendação final (R2)
- **Antes de R2:** Yala sela F6 → fecha `DT-CANACTAS-...` → confirma DT-mãe 0113.
- **Primeira frente de R2 = R2.0 (auditoria read-only)** + despacho dos 4 PEDIDOs. Sem schema antes disso.
- **Sequência:** R2.0 → R2.1 (schema) → R2.2 (writer governado) → R2.3 (reconciliação leitura, ligada ao selo F6) → **(depois)** R2.4 risco.
- **Síntese:** R2 é a raiz certa a seguir — alta alavancagem, **sem Bank**, e o primitivo já existe; o trabalho é dar **semântica de vínculo PJ + cadeia §4.9.9 + audit**, não construir do zero. Risco fica isolado para um sub-front posterior.

## Verificação (como validar antes de executar cada fatia)
- Reconfirmar HEAD/branch/migrations no início de cada fatia.
- R2.1: CHECK/FK/índice provados em DB efêmera; zero `bank_*`.
- R2.2/R2.3: e2e fail-first de autoria (concedente sem poder rejeitado; binding 0113 intacto); 4 gates + `arch --strict critical_new=0`.
- Nenhuma fatia de R2 abre antes do selo de F6 e das respostas dos PEDIDOs §NORMAS/§BANCO/§CÓDIGO.
