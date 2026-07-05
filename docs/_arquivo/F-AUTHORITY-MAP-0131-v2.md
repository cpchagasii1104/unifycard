# F-AUTHORITY-MAP-0131 — v2 (CONSOLIDADO)

**Supersede a v1.** Insumo READ-ONLY para DECISION-0131. NÃO é promulgação, NÃO é código, NÃO é GO.

- **Fontes desta versão:** v1 era de snapshot. v2 incorpora verificação de **1ª mão** de 6 instâncias especialistas contra o **HEAD vivo `20fe30cc` / dev 385** — incluindo **banco vivo** (YALA, IA-BANCO) e **textos soberanos** (IA-DOCUMENTOS, IA-DECISOES). Eu (coordenador) **não tenho banco vivo nem os textos soberanos no snapshot** — consolido a evidência de 1ª mão delas; o que verifiquei sozinho (nível snapshot) está marcado.
- **Hierarquia corrigida:** v1 dizia "fatos de código são autoritativos". Errado. **NORMA > código** (o código conforma à norma). O cânone foi lido e confirma a maior parte das asserções (§3).

## §0 — Correções aceitas (o que a v1 errou)

1. **T11 (event.routes) NÃO está aberto — está BOUND.** Verifiquei no meu próprio snapshot: in-file 296-299 binda `req.body.actor_id` via `userRepresentsActor`→`canRepresentActor`, fail-closed 403 (`F-0113-EVENT-ACTOR-BODY-BINDING`, CLOSED 06-13). **Foi erro meu de leitura** (li só as ~150 primeiras linhas; o que classifiquei como handler era o mapper snake→camel). T11 → `CONTIDO/bound`. Resíduo real: sweep **por handler** (event.routes tem ~25 POST; YALA confirmou binding em 7, não todos).
2. **"6º canal" é impreciso.** `body.actor` é a **variante body dos 5 canais já definidos pela DECISION-0113**, não um canal novo. Adotar: *"qualquer actorId declarado pelo cliente (5 canais 0113 + variante body) exige binding canRepresentActor"* — sem criar taxonomia paralela.
3. **Citação §10.2 errada.** 08_AUTORIDADE §10.2 deprecia **`user_identity_links`**, não `organization_members`. `organization_members` é tombstone por **outro** motivo (tabela AUSENTE — `to_regclass` NULL no vivo).
4. **Inversão de hierarquia.** Os textos soberanos **existem no repo** (não estavam no meu snapshot); confirmá-los é passo da norma, não opcional. IA-DOCUMENTOS já o fez (§3).

## §1 — Mapa atualizado (estado vivo)

| # | Mecanismo | Estado (vivo `20fe30cc`) | Bloqueia cartão? |
|---|---|---|---|
| T1 | `requireRole` (88×) | `ADAPTADOR_TRANSITÓRIO` (role≠autoridade já é Art.17) | Não |
| T2 | `businessAuthorizationService` (26×) | `ADAPTADOR_TRANSITÓRIO` (sem DECISION que formalize aposentadoria) | Não |
| T3 | RBAC legado | `DORMENTE/TOMBSTONE` — **vivo: roles=8, perms=76, user_roles=1**, `actor_has_permission`=`RETURN FALSE`. Guard deve travar a **troca do stub**, não só a tabela | Não |
| T4 | `organization_members` | `TOMBSTONE` confirmado (`to_regclass`=NULL; 12 refs mortas) | Não |
| T5 | dispute/reversal | `CONTIDO_FAIL_CLOSED` **4/4** (não só reversal); `parseActor` removido; motor intacto | **Sim** (rehab c/ binding = DECISION de cartão) |
| T6 | `canManageCompany` | `DIVERGENTE` estrutural, mas **vivo: 0 divergências** (2 rows). Normalização é profilática | Não |
| T7 | `checkOwnership`/`canActAs` | `RECONCILED-ADITIVO` — execução (unir 2 lógicas em OR + comentário stale), não decisão | Não |
| T8 | `actor_delegations` | **RESOLVIDO vivo: 9 rows, TODAS revogadas, 0 ativas.** Wired (V5); `company_members` já removido. Trilho p/ A4, **sem grant vivo**. R2/delegação **não-ativável** como autoridade viva enquanto houver resíduos 0113/superfícies clássicas sem reseal e sem proveniência+E2E de delegação ativa | Não |
| T9 | role='owner'/'admin' supergrant | `DIVERGENTE` — princípio já decidido (Art.17); reverbera em `canRepresentActor` V2 | Não |
| T10 | platform/cross-tenant | `GREENFIELD/deferido (P4)` — `platform_operator_grants` AUSENTE no vivo | **Sim** |
| T11 | event.routes body.actor | **`CONTIDO/bound`** (corrigido — §0.1). Resíduo: sweep por-handler | Não |
| T12 | `financial:*` | Materializado. **Vivo: `financial_approval_policies/authorities/events` = 0/0/0** → approve **fail-closed p/ todos**. `execute_payout` só gateia leitura de relatório hoje; executor HTTP=403 | **Sim** (scope só `actor_wallet_payout`) |

## §2 — Eixos/achados que a v1 NÃO tinha (dos especialistas)

- **T13 TEMPORAL (faltava no mapa):** existe o **padrão-ouro** — resolver polimórfico `availability-owner-authority.ts` (DECISION-0118 D2): *"(owner_type, owner_id) identificam o RECURSO, não o actor autorizado"*. **Adotar como exemplar canônico** do princípio "recurso ≠ actor de autoridade". **Mas há 3 vocabulários temporais divergentes** nos substratos vivos (`actor_delegations`: status/expires_at/revoked_at · `financial_approval_authorities`: is_active/revoked_at/revoked_by/reason · `tenant_operator_grants`: is_active/updated_at **só**) → o "contrato temporal comum" (item 8) está **materialmente NÃO cumprido**; `tenant_operator_grants` exige **migration**. Não colapsar tempo-de-autoridade com tempo-de-agenda.
- **T14 MAPPER DE IDENTIDADE (o mais profundo):** os planos usam **3 chaves divergentes** — `company_users`/`tenant_operator_grants`→`global_user_id`; `financial_approval_authorities`→`user_id`; `actor_delegations`→actor ids. **"Planos disjuntos por escopo" não COMPÕEM sem um mapper canônico** `user_id ↔ global_user_id ↔ actor_id`. É o problema das 3 camadas de identidade no eixo de autoridade. **Decisão nova de Clayton.**
- **T15 RLS:** **nenhum** plano de autoridade tem RLS (só `bank_ledger`/`user_roles`). Isolamento de tenant é app-level. Hardening = decisão/migration própria.
- **Superfícies ≠ mecanismos:** o mapa cobre mecanismos; faltam **superfícies** com leak (GET `/contacts`, `/suppliers`, `/dashboard/metrics/*`, `/groups/mine` com type-confusion actorId/userId — IA-ACTOR-USERS) e a família viva **`DT-0113-CLASSIC-CHANNEL-READERS`** (IA-DT) = o resíduo 0113 vivo. Mapa de mecanismos **não substitui** sweep de superfícies.
- **KYB no Core = emergente, não explícito (YALA):** PJ é bloqueado só por acidente do modelo (page-actor com `global_user_id` NULL), não por gate KYB. Frágil. Gate explícito PJ→KYB material vai na **DECISION de cartão**.
- **Seed = ato soberano (YALA):** inserir a 1ª row em `financial_approval_policies/authorities` é o momento em que payout vira vivo (hoje 0/0/0 = fail-closed). Tratar como **DECISION/reseal**, não migration de dado casual. Idem: ligar o stub RBAC (T3) e semear delegação ativa (T8).

## §3 — Âncora normativa: JÁ DECIDIDO (cânone) × GENUINAMENTE CLAYTON

**JÁ DECIDIDO PELO CÂNONE — 0131 CITA, não re-decide** (IA-DOCUMENTOS leu de 1ª mão):
- role/status/flag ≠ autoridade → **AUTHORITY_LAW Art.17**
- actorId do cliente (5 canais + body) = hint; binding obrigatório → **DECISION-0113**
- delegação temporal + fecho humano → **Art.1.3 / LEI §4.9.9 / SSOT_REGISTRY §5.16**
- tombstone `user_identity_links` → **08 §10.2**; stub RBAC → **0013/C47 (FASE 6)**; `organization_members` não-autoridade → **0130 D1/D11**
- aprovação financeira = substrato Core, **aprovar≠executar**, 4-eyes → **0128/0129/0130**
- membership SSOT = `company_users` → **0042**; grant fino = `can_*` → **0125**; tenant-scope → **0126**; Core=jurisdição → **0021**
- **NÃO duplicar 2ª SSOT de delegação** → **SSOT_REGISTRY §5.16** (`actor_delegations` é a persistência única)

**GENUINAMENTE DE CLAYTON — 0131 PROMULGA (decisão real):**
1. **cargo-template** (greenfield): materializa grants atomicamente · `grant_origin` · revogação **cascateia** · runtime lê só grant material ativo.
2. **contrato temporal comum** (unificar os 3 vocabulários; `tenant_operator_grants` ganha migration).
3. **mapper de identidade canônico** (T14 — `user_id ↔ global_user_id ↔ actor_id`). *O item de maior alavancagem; sem ele os planos não compõem.*
4. **normalização T6** (member_status=SSOT · is_active=projeção · role='owner' não-eterno) — refina 0042/0125.
5. **RLS nos planos de autoridade?** (hardening = migration).
6. confirmar **deferimento de platform** (T10).
7. **vocabulário dos 5 estados** + hard-rule de jure do canal-body + **tombstone guards** (incl. travar o swap do stub RBAC).

*(Cartão = DECISION própria, 0132+: scope `physical_card_authorization`, gate KYB explícito, rehab de dispute/chargeback, plano platform.)*

## §4 — Estado vivo (provado por YALA/IA-BANCO; eu não tenho banco)

- `financial_approval_policies` **0** · `authorities` **0** · `policy_events` **0** → **payout fail-closed p/ todos no dev vivo** (mais seguro do que se temia).
- `actor_delegations` **9 rows, 9 revogadas, 0 ativas**.
- `company_users` **2 rows, 0 divergências** is_active×member_status.
- `organization_members` **AUSENTE**; `platform_operator_grants` **AUSENTE**; `cargo_templates` **AUSENTE** (greenfield); `user_identity_links` **AUSENTE**.
- RBAC legado **semeado** (roles=8/perms=76/user_roles=1), decisor `actor_has_permission`=`RETURN FALSE`.

## §5 — Gate restante (agora preciso e curto) + sequência

Os dois gates que os especialistas exigiam **já foram feitos**: confirmação contra o cânone (IA-DOCUMENTOS) e prova viva do banco (YALA/IA-BANCO). Resta:

1. **Verificação:** (a) sweep **por-handler** de event.routes (~25 POST — confirmar que todos bindam); (b) **sweep de superfícies** (contacts/suppliers/metrics/groups-mine + `DT-0113-CLASSIC-CHANNEL-READERS`); (c) **proveniência das 9 delegações revogadas** + E2E de delegação **ativa** antes de ativar A4.
2. **Clayton decide** só os 7 itens novos do §3 (não re-decidir 0113→0130).
3. **Opus registra a 0131** como **DECISION-ÍNDICE** que CITA a cadeia 0113→0130 + promulga só o novo, ancorada em AUTHORITY_LAW/ENFORCEMENT/§10-§11/§5.16 + AUTHORITY_PRECEDENCE.
4. **Yala reseal.**
5. **Cartão = DECISION própria** (0132+) com suas pré-condições.

**STOPs:** não promulgar a 0131 sobre células `REQUER-PROVA-VIVA` sem a prova (já resolvidas em §4) · não declarar 0113 fechada de carona · R2/delegação não deve ser ativada como autoridade viva enquanto houver resíduos 0113/superfícies clássicas sem reseal e enquanto `actor_delegations` não tiver proveniência + E2E de delegação ativa · não criar 2ª SSOT de delegação · não tratar `financial_approval_authorities` como "futuro" (está vivo, DB-enforced, mas **não semeado**) · cartão BLOQUEADO até DECISION própria.
