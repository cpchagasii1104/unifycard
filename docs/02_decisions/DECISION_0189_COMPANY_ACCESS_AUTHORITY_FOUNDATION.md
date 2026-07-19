# DECISION-0189 — F-COMPANY-ACCESS-AUTHORITY-FOUNDATION

**Data:** 2026-07-19
**Status:** PROMULGADA (ratificação soberana de Clayton, decisões R1–R20 do plano v4)
**Modo:** F1 = DOCS-ONLY ESTRITO (zero código, zero migration, zero schema nesta fatia)
**Base:** HEAD `8397b41cb` (1 commit docs à frente do `e76757898` esperado — apenas registro de selos YALA no execution-log; nenhuma mudança material)
**Escopo:** EMPRESA APENAS. Grupos/canais/banda/fundo regional FORA (doutrinas próprias). PORTA 01 fechada. Δbank=0. Fiscal HOLD. D9.2-B/B-CITY-2 intocadas. `actor_capability_grants` intocado (exceção `regional_treasury` preservada).
**Anexo de denominadores:** `docs/04_audit/F_COMPANY_ACCESS_AUTHORITY_DENOMINADORES_2026-07-19.md`

---

## 0. PROBLEMA (verificado de primeira mão no código)

1. **Ownership genérico autoriza leitura financeira** — `authorization.service.canActAs` autoriza donos/gestores ANTES de qualquer flag específica; `view_financial` tem `capability: null` ("ownership suficiente"). Um `role='owner'` sem nenhuma flag financeira lê saldo.
2. **`actorCapabilitiesService` age como decisor** — `GET /bank/balance?actorId=` e `GET /bank/statement?actorId=` decidem por sopa de capabilities de projeção (`bank.view_balance` é BASE de page → **todo membro ativo vê o saldo da empresa**).
3. **`GET /bank/transaction/:id/splits` não tem autorização de recurso** — qualquer autenticado com um UUID vê a topologia completa de pernas.
4. **Scopes de delegação carregam permissões funcionais** (`getScopesForRole`: staff→`publish_feed`,`create_events`) e `role='admin'`→`['*']` — wildcard vivo.
5. **Vínculo jurídico vive na delegação** (`relationship_type`+`granted_by_actor_id` em `actor_delegations`) — aposentar a delegação sem casa nova destruiria verdade governada.
6. **`is_active` e `member_status` coexistem** em `company_users` com leitores divergentes.
7. **`role='owner'`/`is_primary` decidem autoridade** em `canManageCompany`, `checkOwnership` e ramos legados.
8. **Writers diretos** `POST/PUT/DELETE /companies/:id/members` mudam status/authority sem comando governado; `DELETE` é físico.
9. **Vocabulário incompleto**: não existe PermissionKey de governança; `create_events` mapeia para `can_publish_feed`; `can_manage_employees`/`can_manage_services`/`can_view_reports` sem chave unívoca.

---

## 1. MODELO PROMULGADO — TRÍADE DE AUTORIDADE EMPRESARIAL (R2)

Toda permissão empresarial declara TRÊS pernas, nenhuma substitui outra:

| Perna | Pergunta | Casa |
|---|---|---|
| **PermissionKey** | qual ação? | `permission-keys.ts` (vocabulário soberano no código) |
| **Actor capability** | o TIPO de actor suporta? | `actor_registry.capabilities_json` |
| **Subject grant** | ESTE usuário pode NESTE actor? | `company_users.can_*` (coluna tipada, allowlist) |

**Resource policy** (sobre QUAL recurso) é resolvida server-side pelo handler — nada do cliente define o objeto.

### 1.1 Registry exaustivo de policies (R3)

Todo `PermissionKey` do mapa canônico recebe classificação EXPLÍCITA no
`company-policy-registry` (F2). Classificações:

- `company_grant` — autorizada por subject grant em `company_users` (coluna mapeada; allowlist tipada, NUNCA SQL de string do cliente);
- `company_grant_terminal` — como acima, e TERMINAL: nenhum fallback de ownership/role/is_primary/capability-base; curto-circuita ANTES dos ramos legados;
- `self_only` — só o próprio actor humano (carteira própria etc.);
- `manual_assignment` — atribuição manual (admin institucional);
- `legacy_ownership_contained` — mantém decisor atual (ownership=flag de governança, SEM role) até frente própria; listada como resíduo contido;
- `territory` / `group_substrate` — fora do domínio empresa; para GRUPO, `manage_members` FALHA FECHADO enquanto o substrato D9.2 estiver dormente (R6) — "fora da campanha" ≠ fallback antigo.

**Boot fail-closed:** chave sem classificação, classificação `company_grant*` sem coluna mapeada, ou catálogo DB divergente do código (digest) → **a inicialização falha** (mesmo padrão de `assertSensitivePermissionsHaveCapabilityMapping`).

### 1.2 Chaves TERMINAIS (R5)

`view_financial` · `financial_terms:confirm` · `financial:execute_payout` · `manage_financial` · `manage_members` (empresa) · `company:manage_governance` (inclui alteração de grants protegidos, suspensão/revogação protegida e transferência de governança). Leituras financeiras privadas (balance/statement/splits) são gateadas por `view_financial` terminal.

Testes obrigatórios (F3): owner-rótulo sem flag→403 · `is_primary` sem flag→403 · `can_manage_company` sem `can_view_financial`→403 · `can_manage_financial` sem `can_view_financial`→403 · delegação `publish_feed`→403 financeiro.

### 1.3 `canRepresentActor` = seleção de contexto (R4)

`canRepresentActor` responde apenas "este principal pode VESTIR este actor?". **NUNCA autoriza sozinho uma operação empresarial.** Toda operação exige depois `canActAs(actor, chave exata, recurso server-side)`.

**Contenção promulgada:** a representação de contexto de EMPRESA permanece **gestão-gated** (`can_manage_company` — SEM `role='owner'` após F4) nesta campanha. Membro comum obtém ação EXCLUSIVAMENTE por rotas que consultam `canActAs` com a chave exata (ex.: `requirePermission('publish_feed')`). Alargar a representação a membro comum é mudança POR ROTA, fora desta campanha, sempre acompanhada de `canActAs`. Consequência fail-closed: as ~438 chamadas bare de `canRepresentActor` (anexo §2) NÃO se alargam — permanecem gestor-only; nenhuma rota fica mais permissiva por efeito desta campanha.

---

## 2. VOCABULÁRIO DE GOVERNANÇA (mapa canônico v1.7 — promulgado aqui, materializado na F2)

### 2.1 Novas PermissionKeys (domínio COMPANIES)

| PermissionKey nova | Semântica exata |
|---|---|
| `company:manage_governance` | conceder/revogar grants PROTEGIDOS; administrar/suspender/revogar detentores de grants protegidos; transferência atômica de governança |
| `company:manage_employees` | administrar dados operacionais de empregados (agenda de trabalho, associações operacionais) |
| `company:manage_services` | administrar catálogo de serviços da empresa |
| `company:view_reports` | relatórios operacionais da empresa |

### 2.2 Erratas ao mapa (R10)

- `create_events` → capability `can_create_events` (HOJE: `can_publish_feed` — errata promulgada; cutover material na F2/F3, com verificação de que os registry-rows de company carregam `can_create_events`).
- `manage_members` é CONTEXTUAL (R6): empresa → subject grant `company_users.can_manage_members`; grupo → substrato próprio (dormente ⇒ fail-closed). O mapeamento global `manage_members→can_delegate` morre para o contexto empresa; `delegate` permanece chave DISTINTA (representação entre actors).

### 2.3 Tabela normativa (chave × capability × grant × delegável × convidável × protegida)

| PermissionKey | Actor capability | Subject grant (`company_users`) | Delegável¹ | Convidável² | Protegida³ |
|---|---|---|---|---|---|
| `publish_feed` | `can_publish_feed` | `can_publish_feed` (NOVA) | sim | sim | não |
| `create_events` | `can_create_events` (errata) | `can_create_events` (NOVA) | sim | sim | não |
| `view_financial` | — (tipo empresa sempre elegível) | `can_view_financial` (NOVA) | **não** (financeiro fora de delegação — D4) | sim | não |
| `manage_financial` | `can_hold_assets` | `can_manage_financial` (existente) | não | não | **sim** |
| `manage_members` (empresa) | `can_manage_members` | `can_manage_members` (NOVA) | não | não | **sim** |
| `company:manage_governance` | — | `can_manage_company` (existente) | não | não | **sim** |
| `company:manage_employees` | — | `can_manage_employees` (existente) | não | sim | não |
| `company:manage_services` | — | `can_manage_services` (existente) | não | sim | não |
| `company:view_reports` | — | `can_view_reports` (existente) | não | sim | não |

¹ Delegável = pode viver em `actor_delegations` para REPRESENTANTE EXTERNO (não-membership). A mesma chave pode legitimamente existir nos dois mecanismos para RELAÇÕES DIFERENTES; o que é proibido é a MESMA relação (principal, empresa) ter os dois (§6.3).
² Convidável = pode compor um convite (F5). Protegidas NUNCA são convidáveis na V1 — entram só por concessão de governança pós-aceite.
³ Protegida = só `company:manage_governance` concede/revoga/transfere. Conjunto protegido V1: `can_manage_company`, `can_manage_members`, `can_manage_financial`.

Grants existentes SEM PermissionKey própria nesta versão (fora do catálogo convidável; writers dedicados preservados): `can_view_consolidated_inventory` (DECISION-0116), `can_view_audit_logs`, `can_view_risk`, `can_manage_risk`, `can_manage_policy` (R2 fine-grants). `role` e `role_description` viram RÓTULOS (§5). `is_primary` = preferência de UI.

### 2.4 `GESTOR_INICIAL_PERMISSION_SET_V1` (R9 + item 5)

Conjunto FECHADO, expresso em chaves canônicas, materializado server-side no bootstrap (`createCompany`), com `permission_set_version='V1'` gravado no evento de criação. Futuras permissões NÃO entram automaticamente.

```
GESTOR_INICIAL_PERMISSION_SET_V1 = {
  company:manage_governance → can_manage_company = true,
  manage_members            → can_manage_members = true,
  manage_financial          → can_manage_financial = true,
  view_financial            → can_view_financial = true,
  publish_feed              → can_publish_feed = true,
  create_events             → can_create_events = true,
  company:manage_employees  → can_manage_employees = true,
  company:manage_services   → can_manage_services = true,
  company:view_reports      → can_view_reports = true,
}
```

`can_view_consolidated_inventory` permanece FALSE no nascimento (DECISION-0116 adendo preservado).
**Não-regressão verificada:** o criador hoje nasce com `can_manage_company/financial/employees/services/view_reports` (server-side, `companies.service:516`); as novas flags dão explicitamente o que o ownership dava implicitamente (post/eventos/saldo). Nenhuma capability atual do criador se perde.

**R9 (decidido — opção B):** publicar em nome da empresa NÃO é direito automático de membro ativo. `company.post` (projeção do `actorCapabilitiesService`) deixa de ser adicionada incondicionalmente: passa a ser DERIVADA de `can_publish_feed` e permanece projeção — **nunca é authority e nunca substitui `publish_feed`**.

---

## 3. CASA DO VÍNCULO JURÍDICO (R11) — `company_member_relationships`

O vínculo jurídico NÃO vive em `role` (eixos ortogonais) e NÃO se perde com a aposentadoria da delegação de membership.

Tabela temporal normalizada (F2):

- `id` UUID PK · `tenant_id` · `company_id` · `company_user_id` (FK composta tenant-safe a `company_users`);
- `relationship_type` — vocabulário GOVERNADO (mesmos 7 valores do CHECK atual: `partner|director|administrator|attorney|legal_representative|employee|contractor`), NULL = não classificado (declarado);
- `department_key` TEXT NULL — vocabulário controlado por CHECK de formato (`^[a-z][a-z0-9_]*$`); substitui os scopes `dept:*` em JSON; SEM FK a entidade inexistente (honestidade: não há entidade canônica de departamento; quando nascer, migração governada);
- `declared_by_user_id` + `declared_by_actor_id` — autoria dupla (principal humano E actor em cujo nome agiu);
- `valid_from` / `valid_to` (NULL = vigente) · `predecessor_id` (self-FK — cadeia causal, sucessor de `previous_link_id`);
- UNIQUE parcial: um vínculo VIGENTE por membership (`WHERE valid_to IS NULL`);
- escrita SEMPRE com evento em `company_member_events` na MESMA transação.

**Backfill determinístico (F2):** para cada `company_users` existente, vínculo derivado da delegação mais recente com `relationship_type` não-nulo (proveniência real); sem delegação → derivação role→relationship do mapa atual (`admin→administrator`, `staff→employee`, `contractor→contractor`, senão NULL), registrada como `source='backfill_role_derivation'` no evento.

### 3.1 Trilha de eventos — `company_member_events` (append-only)

`event_type` ∈ {`bootstrap`,`invited_accepted`,`suspended`,`resumed`,`revoked`,`reentered`,`grants_changed`,`governance_transferred`,`relationship_declared`,`backfill`}; snapshot JSONB do estado ANTERIOR (revogação preserva o conjunto zerado); autoria dupla; `details` (inclui `permission_set_version` quando aplicável); UPDATE/DELETE proibidos por trigger. Nasce na MESMA transação da mutação — nunca mutação sem evento nem evento sem mutação.

---

## 4. DOIS TETOS + ANTI-TAKEOVER (R7)

### 4.1 Grant ceiling (teto de concessão)

`requested ⊆ convidáveis(catálogo vigente) ⊆ grants do concedente`. Proibida autoelevação. Revalidado NA TRANSAÇÃO do aceite (locks §7). Mudar permissões de convite = revogar e reemitir (linhas de permissão do convite são IMUTÁVEIS).

### 4.2 Administration ceiling (teto de administração)

`target_grants ⊆ manager_manageable_ceiling`:

- ninguém altera/suspende/revoga/rebaixa membro cujo conjunto de grants NÃO esteja contido no seu próprio conjunto administrável;
- `manage_members` administra APENAS membros sem grants protegidos, e concede/remove APENAS grants não-protegidos ⊆ os próprios;
- grants protegidos (§2.3) exigem `company:manage_governance`;
- revogar/suspender detentor de grant protegido exige `company:manage_governance`;
- transferência de governança é COMANDO ATÔMICO (concede ao novo, rebaixa o anterior na mesma tx, evento `governance_transferred`);
- **toda operação de governança serializa por lock da linha da EMPRESA** (`SELECT ... FROM companies ... FOR UPDATE`) — mata a corrida de duas revogações concorrentes contra a proteção do último gestor;
- proteção do último gestor: a empresa NUNCA fica sem pelo menos um membro ATIVO com `can_manage_company`; a checagem roda DENTRO da tx sob o lock da empresa;
- takeover "mantendo artificialmente um último gestor" é bloqueado pela regra do teto (quem tem só `manage_members` não toca gestores; quem tem governança pode — governança É a autoridade máxima da empresa, transferível apenas atomicamente).

---

## 5. LIFECYCLE DE MEMBERSHIP (R17)

- `company_users.member_status ∈ {active, suspended, revoked}` — **`invited` DEIXA de ser estado de membership** (vive exclusivamente em `company_access_invitations`); CHECK atualizado na F4 após prova de zero linhas `invited` inesperadas (fixtures migradas governadamente; nunca descartar convite real silencioso);
- **`is_active` MORRE** (F4): inventário COMPLETO via catálogo do banco (views/functions/triggers/índices/RLS/constraints) + runtime/scripts/seeds/testes; DROP só com denominador fechado; guard `no-is_active` morde runtime/schema atual e ignora migrations históricas; prova em fresh DB E upgrade DB;
- `role` e `is_primary` = rótulos/preferência de UI — **nenhum decide autoridade**; `'OR role=owner'` morre em TODOS os pontos (`authorization.service:378,653`, `checkOwnership` ramos `is_primary`/`role='admin'`, `companies.service.canManageCompany:1019` e demais do anexo §5);
- suspensão CONGELA grants (colunas intactas) mas `member_status='suspended'` NEGA toda autoridade (todo resolver filtra `member_status='active'`);
- revogação ZERA grants + preserva snapshot anterior no evento `revoked`;
- reentrada pós-`revoked` = substituição INTEGRAL do conjunto (`DO UPDATE ... WHERE existing.member_status='revoked'`); ON CONFLICT NUNCA reativa `active`/`suspended`;
- DELETE físico de membership MORRE (revogação lógica; histórico preservado);
- só BOOTSTRAP (`createCompany`) e ACEITE canônico (writer interno F4; rota pública F5) criam/reativam `active`; `POST/PUT/DELETE /members` viram comandos governados (`suspend`/`resume`/`revoke`/`alter-grants`/`transfer-governance`/`declare-relationship`);
- convidador ≡ convidado pela **Identity SSOT** (`global_user_id`, nunca actor) → rejeitar autoelevação; humano com múltiplos user-actors resolve SEMPRE pela Identity canônica;
- a bridge social (`actor-relationship-membership-bridge`) NÃO materializa `active` — fail-closed até integrar com convite (F5+).

---

## 6. SSOT DE AUTORIDADE DE MEMBERSHIP (R8) — delegação aposentada COM destinos

### 6.1 Cutover (F4, nunca antes)

Membership empresarial DEIXA de usar `actor_delegations` como fonte de autoridade SOMENTE depois de: (a) casa jurídica criada+backfillada (F2); (b) grants funcionais com destino explícito (§2.3) materializados (F2) e religados no decisor (F3/F4); (c) dual-write transitório provado atômico (F2→F4). No cutover: delegações de membership encerradas por REVOKE LÓGICO + evento causal (`reason='membership_cutover_0189'`), snapshot preservado, SEM DELETE. Estado material de dev: **0 delegações ativas** (9 históricas revogadas/expiradas) — cutover não órfã autoridade viva.

### 6.2 Delegação continua válida para representação EXTERNA

Representante não-membership (procurador externo etc.) segue por `actor_delegations` com chaves delegáveis (§2.3). Grupos/canais/scopes `dept:*` históricos/exceção `regional_treasury`: INTOCADOS — guards e triggers ESCOPADOS ao relacionamento empresarial.

### 6.3 Exclusividade POR RELAÇÃO (R12)

Para a MESMA relação (principal ↔ actor de empresa): autoridade não vem simultaneamente de membership E delegação. Membership ATIVA + delegação empresarial ATIVA para a mesma empresa = proibido — imposto por WRITER + CONSTRAINT TRIGGER tenant-safe nas DUAS direções (CHECK não cruza tabelas). O trigger só é ATIVADO na F4 (após o fim da dual-write transitória, que o violaria por desenho).

---

## 7. CONCORRÊNCIA (R13 — modelo escolhido)

- **Leitura financeira sensível:** transação única onde a linha de `company_users` do leitor é lida `FOR SHARE` ANTES da leitura do recurso, no MESMO client — revogação concorrente (UPDATE na linha) serializa: espera ou precede linearmente; `BEGIN` em READ COMMITTED NÃO é tratado como snapshot único; quando a decisão depender da linha de conta/ownership, essa linha também é travada (`FOR SHARE`) — dentro do domínio Bank quando for tabela SSOT financeira (§4.6/§4.7 da LEI: locking de bank_* só no Bank);
- **Aceite de convite — ordem FIXA de locks (anti-deadlock):**
  1. `companies` (linha da empresa, `FOR UPDATE` — serializa governança);
  2. `company_access_invitations` (o convite, `FOR UPDATE`);
  3. `company_users` do CONVIDADOR (`FOR UPDATE`);
  4. `company_users` do CONVIDADO, se existente (`FOR UPDATE`).
  A MESMA ordem em toda operação de governança que toque múltiplas linhas.
- **Proteção do último gestor:** contagem de gestores roda sob o lock (1) — duas revogações concorrentes não enxergam ambas "outro gestor".

---

## 8. CONVITE E ACEITE (R14/R15 — norma; material na F5)

### 8.1 Tabelas

- `company_access_invitations`: tenant/company/inviter (Identity)/invitee (Identity — vínculo IMUTÁVEL)/`token_hash`/`idempotency_key`/`request_hash`/`catalog_version`/status `pending|accepted|declined|revoked|expired`/`expires_at`/timestamps de transição/autoria humana+actor/RLS/FKs compostas tenant-safe;
- `company_access_invitation_permissions` (normalizada): FK ao convite + FK ao catálogo versionado; LIMITE de quantidade; zero texto livre; IMUTÁVEL após criação.
- Unicidade: UM pendente por (empresa, Identity convidada).

### 8.2 Idempotência (R14)

Chave OPACA fornecida pelo cliente + `request_hash` = SHA-256 do payload canônico, armazenados separadamente. `UNIQUE(tenant_id, operation, inviter_global_user_id, idempotency_key)`. Mesma chave+mesmo hash → resultado original; mesma chave+hash diferente → 409; chave nova+payload igual → nova intenção (se o lifecycle permitir). Hash-como-chave é PROIBIDO.

### 8.3 Token e lookup (R15)

- Token do convite: `randomBytes(32)` (256 bits), armazenado SOMENTE como hash, uso único (consumido na tx do aceite), expiração por `NOW()` DENTRO da tx (worker/lazy apenas materializa `expired` — nunca é condição de segurança), revogável, comparação constant-time, NUNCA logado em claro;
- Código de indicação (32 bits, legado) = SOMENTE lookup de pessoa: endpoint administrativo AUTENTICADO (exige `manage_members`), rate limit FAIL-CLOSED (novo serviço — NÃO reusa o caminho fail-open de `auth.routes:114`), resolve server-side para Identity via actor humano (`actor_type` humano aceito pela Identity canônica), resposta mínima/uniforme, zero permissão materializada. Hardening global do código legado = DT separada.

### 8.4 Aceite (F5)

Caller autenticado ≡ Identity convidada; token válido; `NOW() < expires_at`; locks §7; convidador segue `active` (senão falha); dois tetos revalidados; catálogo VIGENTE revalidado (R16 — chave não-convidável no catálogo atual → rejeita, reemitir); materializa EXATAMENTE as permissões persistidas (body do aceite NUNCA altera grants); `active` novo OU reentrada só de `revoked` (substituição integral); membership + relationship + assignments + evento na MESMA tx; token consumido na MESMA tx; NENHUMA `actor_delegation` de membership.

### 8.5 Estados do alvo

`active` existente → 409 · `suspended` → comando `resume`, nunca convite · `revoked` → reentrada governada · `pending` existente → idempotência/conflito · self-invite pela Identity → deny.

---

## 9. CATÁLOGO SEM DUPLO SSOT (R16)

PermissionKeys no CÓDIGO NORMATIVO (`permission-keys.ts` + `company-policy-registry`) são SOBERANAS. O catálogo no banco (`company_permission_catalog`) é MATERIALIZAÇÃO versionada: migrations materializam; startup compara versão+digest (SHA-256 da serialização canônica das linhas) e DIVERGÊNCIA QUEBRA O BOOT; chave nunca muda de significado (mudança = chave/versão nova); convite pendente revalida contra o catálogo VIGENTE no aceite.

---

## 10. POLÍTICA DE SPLITS E LEITURAS FINANCEIRAS (R18/R19)

Autorização PELO RECURSO (transação/conta carregadas server-side; contas→actors resolvidos server-side; nada do cliente define o objeto) + RESPOSTA POR PAPEL:

- autoridade terminal `view_financial` sobre a conta de ORIGEM/base → visão INTEGRAL;
- dono humano da conta de origem (self-authority provada pelo recurso: `owner_type='user' AND owner_id=userId` — NUNCA por actorId arbitrário) → integral;
- participante destinatário → SÓ a própria perna + resumo sanitizado (sem pernas de terceiros, sem metadata bruta);
- auditor explícito → permissão própria FUTURA (DT registrada);
- UUID alheio/inexistente → resposta uniforme (mesmo status/corpo);
- `Cache-Control: no-store` em toda leitura financeira privada;
- leitura sensível gera AUDIT EVENT antes da resposta — falha de auditoria NÃO pode resultar em disclosure sem rastro (fail-closed);
- **R19:** toda superfície financeira conhecida fecha em: migrada | provada projeção-sem-decisão | desativada fail-closed. **DT NÃO sela abertura financeira conhecida.**
- `actorCapabilitiesService` vira PROJEÇÃO PURA: nenhum endpoint o usa para allow/deny; membro comum vê só as PRÓPRIAS capabilities efetivas; roster de delegações/delegadores exige `manage_members`.

---

## 11. POLÍTICA DE MIGRAÇÃO E ROLLBACK SEGURO

- Migrations novas APPEND-ONLY (nunca reescrever históricas); determinísticas; provadas em FRESH DB e UPGRADE DB (efêmeros descartáveis) antes de aplicar ao dev;
- Colunas novas nascem `NOT NULL DEFAULT false` (aditivas — rollback = não usar);
- Dual-write transitório (F2→F4): writer escreve delegação antiga E casa nova NA MESMA TRANSAÇÃO (repositories aceitam client externo — fim das transações internas independentes); falha em qualquer lado → ROLLBACK; Authority continua lendo a fonte antiga até F3/F4; desligada NA F4 (F6 só remove código morto);
- DROP de `is_active` e CHECK novo de `member_status` só após denominador fechado e prova de zero linhas inesperadas;
- nenhum dado não-fixture apagado; nenhuma migration roda fora do runner oficial (`migrate.ts`).

---

## 12. CONDENAÇÕES EXPLÍCITAS (item 15)

| Condenado | Substituto |
|---|---|
| Projection (`actorCapabilitiesService`, `company.post`) como authority | decisor canônico + registry de policies |
| `canRepresentActor` isolado autorizando operação | representação (contexto) + `canActAs`(chave exata) |
| `role`/`is_primary` como authority | subject grants tipados; role/is_primary = rótulo/UI |
| ownership genérico para permissão sensível | handlers TERMINAIS (§1.2) |
| wildcard scopes (`['*']` de `getScopesForRole('admin')`) | grants explícitos por coluna |
| convite direto para `active` (POST /members) | comando governado + convite/aceite canônico |
| DELETE físico de membership | revogação lógica + evento + snapshot |
| dupla autoridade membership+delegação na MESMA relação | exclusividade por writer+trigger (§6.3) |
| `is_active` | `member_status` |
| scopes `dept:*` em JSON para membership | `department_key` normalizada na casa jurídica |
| idempotency key = hash do payload | chave opaca do cliente + `request_hash` separado |
| token de convite de baixa entropia / logado | 256 bits, hash-only, single-use, nunca em log |

---

## 13. MATRIZ DE AUTORIDADE (rota/operação × recurso × permissão × resposta × estado)

Legenda de estado: **[F3]**=migra na F3 · **[F4]**=migra na F4 · **[F5]**=nasce na F5 · **[OK]**=já conforme · **[CONTIDO]**=fail-closed por contenção (§1.3) · **[DT]**=resíduo legítimo não-financeiro.

### 13.1 Financeiro privado (leitura) — TODAS fecham na F3 (R19)

| Rota/operação | Recurso real (server-side) | Permissão exata | Resposta | Estado |
|---|---|---|---|---|
| `GET /bank/balance` (sem actorId) | conta do próprio user (owner_type='user') | self-authority provada pelo recurso | integral | [OK] |
| `GET /bank/balance?actorId=` (empresa) | conta da empresa via actor.company_id | `view_financial` TERMINAL | integral | [F3] |
| `GET /bank/statement` (sem actorId) | contas do próprio global_user | self | integral | [OK] |
| `GET /bank/statement?actorId=` (empresa) | contas do actor | `view_financial` TERMINAL | integral | [F3] |
| `GET /bank/transaction/:id/splits` | transação+conta origem carregadas server-side | `view_financial` na origem OU self-origem OU perna própria | integral / perna própria+resumo / uniforme | [F3] |
| `GET /bank/regional-fund` | fundo territorial por residência | transparência PÚBLICA do fundo (DECISION-0177) — NÃO submetida a `view_financial` privado | projeção territorial | [OK] |
| `GET /accounts/me` · `/accounts/:id/balance` etc. (`account.routes`) | conta resolvida server-side | self OU `view_financial` se conta de empresa | integral | [F3 — auditar cada handler; desativar fail-closed o que não migrar] |
| `GET /ledger/*` (`ledger.routes`) | entradas de conta | self OU `view_financial` | integral | [F3 — idem] |
| `GET /actors/:id/recent-counterparts` | contrapartes recentes (deriva de dados financeiros) | representação + (empresa: `view_financial`) | resumo | [F3] |
| Invoices/AP/AR/event-settlement (leitura) | documento fiscal/comercial da empresa | `view_financial` (leitura) | integral | [F3 — inventário no anexo; o que não migrar = fail-closed] |
| Economic-overview / reports financeiros | agregados da empresa | `view_financial` / `company:view_reports` conforme superfície | integral | [F3] |

### 13.2 Projeções (nunca decidem)

| Superfície | Papel | Estado |
|---|---|---|
| `GET /actors/:id/capabilities` (`actor-capabilities.routes`) | projeção UX; membro comum vê SÓ as próprias capabilities efetivas; roster de delegações exige `manage_members` | [F3] |
| `home-feed` / `profile-inference` (usam `resolveForUser` como gate de acesso) | trocam o gate por `canRepresentActor` (contexto); zero decisão financeira | [F3] |
| `company.post` na projeção | derivada de `can_publish_feed` (R9-B) | [F3] |

### 13.3 Membership/grants (writes) — F4/F5

| Operação | Permissão exata | Estado |
|---|---|---|
| Bootstrap do gestor inicial (`createCompany`) | server-side SET_V1 | [F2 materializa V1] |
| Convidar membro | `manage_members` + grant ceiling | [F5] |
| Aceitar convite | Identity convidada + token + tetos + catálogo | [F5] |
| Suspender/retomar/revogar membro comum | `manage_members` + administration ceiling | [F4] |
| Alterar grants não-protegidos | `manage_members` + ambos os tetos | [F4] |
| Conceder/revogar grant protegido · administrar gestor · transferir governança | `company:manage_governance` + lock empresa + último-gestor | [F4] |
| Declarar vínculo jurídico | `manage_members` (grava na casa jurídica + evento) | [F4] |
| `POST/PUT/DELETE /companies/:id/members` legados | viram comandos acima; DELETE físico morre | [F4] |
| `PATCH can_view_consolidated_inventory` (writer 0116) | reclassificado sob administration ceiling (governança, por ser concessão de leitura agregada) | [F4] |
| Bridge social → membership | fail-closed (não materializa active) | [F4] |

### 13.4 Social/eventos com actor de empresa (enforcement existente via `canActAs`)

`publish_feed` (posts) e `create_events`: já passam por `requirePermission`/`canActAs`; a autoridade MATERIAL muda de delegação/ownership para subject grant no cutover F4 (com actor capability preservada e KYB-gate DECISION-0094 intocado). Estado: [F4].

### 13.5 Resíduos contidos (não alargados por esta campanha)

Rotas bare-`canRepresentActor` com actor de empresa (anexo §2): permanecem gestão-gated ([CONTIDO]); migração por rota = frentes futuras (F-CANREPRESENTACTOR-SCOPE-AWARE). Chaves `legacy_ownership_contained` do registry: listadas no anexo §6.

---

## 14. GATES POR FATIA (resumo executável)

- **F2:** fresh+upgrade efêmeros · catálogo/digest boot · registry exaustivo (todas as chaves classificadas) · backfill provado · dual-write atômica provada por falha injetada · nenhuma rota depende das colunas dormentes · Δbank=0 · typecheck · runner;
- **F3:** testes adversariais §1.2+§10 (mínimos do plano: 17 casos) · guard global "actorCapabilitiesService não decide" (allowlist só de projeção comprovada) · no-store · audit-event fail-closed · tenant cruzado deny · Δbank=0;
- **F4:** inventário DB de `is_active` via catálogo (views/functions/triggers/índices/RLS/constraints) · fresh+upgrade · role/is_primary mortos como authority · exclusividade ativa · anti-takeover (testes de concorrência: dupla revogação, transferência atômica, empresa nunca órfã) · representante externo intocado · grupo intocado · Δbank=0;
- **F5:** 19 testes do plano (token, tetos, idempotência, lifecycle, cross-tenant, logs sem token) · Δbank=0;
- **F6:** runner completo · suite · fresh+upgrade · re-auditoria dos denominadores · cartório · DTs legítimas · relatório "IMPLEMENTAÇÃO CONCLUÍDA — CANDIDATA A AUDITORIA YALA INDEPENDENTE".

---

## 15. DÍVIDAS REGISTRADAS POR ESTA DECISION (resíduos legítimos — fora de escopo financeiro)

- DT-REFERRAL-CODE-32BIT-GLOBAL-HARDENING — hardening global do código de indicação legado (não é credencial de autoridade desta campanha);
- DT-COMPANY-AUDITOR-ROLE — papel de auditor explícito para leitura financeira integral;
- DT-GROUP-MANAGE-MEMBERS-SUBSTRATE — `manage_members` de grupo fail-closed até D9.2 acordar;
- DT-CANREPRESENTACTOR-PER-ROUTE-EXACT-PERMISSION — migração por rota dos consumers bare (contidos, gestão-gated);
- DT-COMPANY-FINE-GRANTS-PERMISSION-KEYS — chaves próprias para `can_view_audit_logs`/`can_view_risk`/`can_manage_risk`/`can_manage_policy`/`can_view_consolidated_inventory`.

---

*Promulgada por ratificação soberana (R1–R20). Executor: Claude (sessão 2026-07-19). F1 é docs-only; nenhuma linha de runtime/schema alterada nesta fatia.*
