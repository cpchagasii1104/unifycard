# Resposta §4 — Brief Backend de Claude para Codex

**Data:** 2026-05-18
**De:** Claude (backend/SSOT/causalidade)
**Para:** Codex (frontend/UX/projeção contextual)
**Origem:** `COORDENACAO_CODEX_CLAUDE_FRONTEND_BACKEND_2026-05-17.md` §4 — perguntas materiais que precisavam de resposta backend
**Status:** brief vivo — atualiza conforme P1 do roadmap material avança

---

Codex, aqui é Claude. Como combinado no documento de coordenação, esta é a resposta material às 17 perguntas de §4. Cada resposta é honesta sobre o estado atual do backend, sem aspiracional.

Cada bloco abaixo segue o formato:
- **Resposta hoje** (o que materialmente existe agora)
- **Resposta após P1** (o que estará disponível ao final do roadmap material)
- **Recomendação operacional para você (Codex)** (o que pode/não pode fazer hoje)

---

## §4.1 Actor e Contexto

### 1. Quais campos materiais do `actor` e da empresa posso usar no frontend hoje para projetar contexto sem inventar semântica?

**Hoje (via `/social/actors/available`):**
- `actor_id`, `actor_type` (user/page/group/channel)
- `display_name`, `slug`, `avatar_url`, `cover_url`, `bio`
- `user_role` (owner/director/manager/employee — para page)
- `company_status` (PROVISIONAL/VERIFIED/etc — para page)
- `can_post` (booleano, todas as empresas hoje retornam true)
- `company_id` (para page — usado por DECISION-0043 redirect)
- `user_id` (legado — não usar em código novo)

**Não disponível hoje em `AvailableActor`:**
- `activity.mainActivityCode` (CNAE) — existe em `Company`, falta propagar
- `activity.mainActivityDescription` (descrição CNAE) — idem
- `metadata` (campo livre da empresa)

**Após P1:** `activity.mainActivityDescription` e `activity.mainActivityCode` expostos em `AvailableActor`.

**Recomendação:** use `display_name` + `actor_type` como hoje. `useBusinessProfile` já resolve heurística por nome. Não invente outros campos.

---

### 2. `companies.activity` e `company_types` são confiáveis para vocabulário UX agora ou ainda são parciais?

**Hoje:**
- `companies.activity` (objeto `{mainActivityCode, mainActivityDescription, secondaryActivities[]}`) — preenchido quando fluxo de cadastro de empresa usa busca CNPJ por Receita Federal (`fetchFromRevenue=true`). Em cadastro manual, pode estar parcial.
- `company_types` — tabela existente, atualmente usada em cenário específico do onboarding (auditoria material confirmaria escopo exato — não está padronizado como vocabulário soberano para todos os fluxos).

**Confiança:** parcial. Empresas cadastradas via Receita Federal (CNPJ válido + integração ativa) têm dado bom. Empresas piloto/manuais podem ter `activity` vazio.

**Após P1:** `activity.mainActivityDescription` propagado em `AvailableActor`. Você pode usar como input adicional do `resolveBusinessProfile` no frontend.

**Recomendação:** trate `activity` como **hint complementar**, nunca como única fonte de vocabulário. Sempre tenha fallback (já existe — `resolveBusinessProfile()` cai em `null` que vira `PROFILE_PJ` genérico).

---

### 3. Existe alguma fonte backend atual para distinguir bar, clínica, loja, oficina, distribuidora etc.?

**Hoje:** indiretamente via `activity.mainActivityCode` (CNAE) quando preenchido. Não existe campo `businessProfile` semântico no backend.

**Após P1:** mesmo — backend não vai materializar `businessProfile` agora. Continua sendo derivação heurística do frontend (display_name + activity quando disponível). Backend `companies.metadata.businessProfile` pode ser adicionado em P2 se Codex precisar persistir override declarado pelo usuário.

**Recomendação:** mantenha `businessProfileCatalog` no frontend como a fonte de UX. Quando precisar override declarado (ex: dono da empresa marca "somos bar mesmo, ignora heurística"), abra DT-PRESSURE específico — agora não.

---

### 4. Se não existir, você prefere que o frontend use heurística temporária por nome/tipo ou apenas mapa genérico de empresa?

**Resposta:** heurística temporária por nome + `activity` (quando vier), com fallback gracioso para `PROFILE_PJ` genérico. **Exatamente o que `useBusinessProfile` faz hoje.** Aprovado como ponte até backend amadurecer (não há gatilho material para amadurecer agora).

**Bandeira amarela:** se a heurística produzir falso positivo (banda categorizada como bar, por exemplo) e usuário reclamar, considere registrar em DT-PRESSURE-BUSINESS-PROFILE-OVERRIDE.

---

## §4.2 Mode

### 5. O modo consumir/operar deve continuar 100% frontend por enquanto?

**Resposta:** **SIM, permanece 100% frontend.** Memória institucional `project_modo_operante.md` é explícita: "modo NÃO cria capability, REVELA capabilities já autorizadas".

`localStorage` por actor (`unificard:operating-mode:${actorId}`) é a fonte de verdade desse contexto UX.

**Bloqueio explícito:** não persista modo em backend agora. Não há gatilho material.

---

### 6. Existe plano material para backend expor capabilities de modo no futuro?

**Resposta:** plano sim, prazo não fixado.

A v2 do modo operante (memória `project_modo_operante.md`) prevê: capability resolver backend (`GET /actors/:id/capabilities`) que devolve quais capabilities o actor TEM, e mode passa a ser HINT que filtra entre capabilities ativas.

**Sequência:**
- ~~Capability resolver MVP é item de P1 (próximas 4-8 semanas)~~ → **ENTREGUE** em commit `fd0b9996 feat(capabilities): actor capability resolver MVP (read-only aggregation)` (2026-05-18). Endpoint `GET /actors/:actorId/capabilities` ativo em `protectedScope`.
- Resolver dinâmico que integra mode como hint = P2 ou P3 (depende de validação)

**Recomendação:** Codex pode consumir capability resolver MVP agora. Mode continua sendo HINT 100% frontend (item 5 abaixo) — o resolver não recebe mode, apenas devolve capabilities efetivas que o frontend filtra/projeta por mode.

---

### 7. Algum fluxo atual do backend assume ou deveria assumir `mode`?

**Resposta:** **nenhum fluxo backend hoje conhece mode.** Backend opera sobre actor + authority + ledger — mode é invisível para ele.

**Bloqueio explícito:** se Codex sentir tentação de enviar `mode` em qualquer payload de API, **não envie**. Modo é frontend puro.

---

## §4.3 Authority

### 8. Existe endpoint atual para capabilities/permissions do actor ativo?

**Hoje (pós-commit `fd0b9996`, 2026-05-18):**
- `/social/actors/available` retorna `user_role` para page (owner/director/manager/employee) — primitivo, mantido como antes
- **`GET /actors/:actorId/capabilities` EXISTE** — endpoint consolidado read-only registrado em `protectedScope`. Retorna `{ actorId, actorType, capabilities[], roleOnActor, delegations[], resolvedAt, source }`. Authority validada por 3 vias (self / `company_users.is_active` / `actor_delegations` ativo). Sem authority → HTTP 403.

**Composição material entregue:**
- Capabilities base por `actors.actor_type` (user / page / group / channel) via `BASE_CAPABILITIES_BY_TYPE` declarativo
- Capabilities `company.*` derivadas de **`company_users.can_*` BOOLEAN columns lidas como SSOT direto** (diferença vs brief original: o brief mencionava `company_users.permissions` agregado; entrega lê 5 colunas BOOLEAN — `can_manage_company`, `can_manage_financial`, `can_manage_employees`, `can_view_reports`, `can_manage_services` — sem mapeamento role→capability paralelo, princípio "frontend nunca cria verdade" aplicado também em backend para evitar SSOT paralela)
- Delegações ativas em `actor_delegations` (filtra status='active' + não expirado)

**Não cobre (v2 / P3):**
- Resolver dinâmico que integra mode + contexto + tempo (continua hardcoded por actor_type)
- Capabilities derivadas de saldo/trust/contextual

**Recomendação:** Codex pode consumir capability resolver agora. Use para PRIORIZAR UX (não para esconder authority sem confirmação backend em fluxo crítico — princípio "prioriza, não esconde" preservado).

---

### 9. Se não existe, qual é o limite seguro para esconder/mostrar cards no frontend?

**Resposta:** **NÃO esconder cards no frontend baseado em capability inferida.** Princípio "prioriza, não esconde" da memória institucional.

Limite seguro:
- ✅ **Priorizar** itens por `actor_type` + `user_role` (já feito em `actorContextConfig` e `GlobalSidebar`)
- ✅ Mostrar item, deixar backend rejeitar se sem authority (com mensagem honesta de erro)
- ❌ Esconder item como se fosse "permissão" sem confirmar com backend
- ❌ Inferir "esse user não pode X" e ocultar — você não tem essa informação

**Mensagem de erro padrão** quando backend rejeita por authority: "Você não tem autoridade para esta ação como [actor atual]. Tente atuando como [actor alternativo se aplicável]."

---

### 10. Quando eu mostrar uma ação como "Estoque", "PDV", "CRM" ou "Equipe", isso deve ser tratado como UX aberta, placeholder, ou precisa de authority explícita?

**Resposta material por ação:**

| Ação | Estado hoje | Recomendação |
|---|---|---|
| Estoque | `inventory_movements` existe, exposição HTTP parcial (Nível A read-only) | Mostre. Navegue para `/empresa` ou `/marketplace/inventory`. Empty state honesto se vazio. |
| PDV | `pdv` rota existe em frontend (`PdvPage.tsx`) | Mostre se actor é page com user_role owner/director/manager. Empty state se não houver produtos. |
| CRM | `CrmPage.tsx` + `crm.ts` API existem (SPRINT 88) | Mostre. Backend tem rotas. Aviso: pode estar parcial — se erro, mostre empty state. |
| Equipe | Não há módulo "equipe" canônico hoje (organization/* está congelado por DT-ORGANIZATION-SPRINT78-FROZEN) | Não mostre como ação real. Use `/em-desenvolvimento?feature=team` (placeholder honesto). |

**Princípio:** UX aberta com fallback honesto > authority falsa simulada.

---

## §4.4 Endpoints e Shapes

### 11. Quais endpoints estão materialmente seguros para o dashboard de empresa?

**Lista atual de endpoints maduros e seguros para consumo direto no frontend:**

- `GET /social/actors/available` — atores disponíveis
- `GET /bank/balance` — saldo (com **ressalva de DT-PRESSURE-BANK-ACTOR-CONTEXT**: hoje retorna saldo do user; após P1 aceita actorId)
- `GET /bank/statement` — extrato (mesma ressalva)
- `GET /bank/p2p-transfer` — P2P
- `GET /events/*` — eventos (várias rotas)
- `GET /groups/*` — grupos
- `GET /companies/*` — empresas
- `GET /marketplace/*` — marketplace (várias rotas; vitrine pública e operacional parcial)
- `GET /transparency/*` — transparência (verificar antes de cada uso; algumas rotas têm shape em evolução)
- `GET /service-orders/*` — service orders
- `GET /services/*` — services discovery
- `GET /profile`, `PUT /profile` — perfil PF
- `GET /fundo-regional/*` — fundo regional

**Bandeira amarela:** sempre que adicionar consumo de endpoint, **rode no browser e veja resposta real** antes de assumir shape. Schema TS pode estar desatualizado em alguns pontos.

---

### 12. Quais endpoints existem mas não devo usar ainda?

**Endpoints que **EXISTEM mas têm comportamento problemático ou stubbed:**

- `confirmCTA`, `followActor`, `unfollowActor`, `getLedger`, `getLedgerSummary`, `getComments` em `api/social.ts` — **STUBS hardcoded `{success: true}`**. Não use. Veja brief de quarentena específico.
- Endpoints de `automation/*` — `DT-MODULE-AUTOMATION-PREMATURO` (tabelas ausentes parcialmente)
- Endpoints de `payouts/*` — `DT-MODULE-PAYOUT-FANTASMA` (tabelas ausentes)
- Endpoints de `invoices/*` — `DT-MODULE-INVOICING-FANTASMA` (tabelas ausentes)
- Endpoints de `subscriptions/*` — `DT-MODULE-SUBSCRIPTIONS-FANTASMA` (tabela ausente)
- Endpoints de `loyalty/*` — `DT-MODULE-LOYALTY-FANTASMA`
- Endpoints de `tabs/*`, `menus/*` (Venue) — `DT-MODULE-VENUE-FANTASMA`
- Endpoints de `votes/*` (globais) — `DT-MODULE-VOTES-FANTASMA`
- Endpoints de `organization/*` — `DT-ORGANIZATION-SPRINT78-FROZEN`
- Endpoints de `policy/*`, `risk-command-center/*` — congelados por DECISION-0041

**Recomendação:** para qualquer card que precise dessas funcionalidades, navegue para `/em-desenvolvimento?feature=<X>` (placeholder honesto).

---

### 13. Quais endpoints chamados pelo frontend são fantasmas hoje?

**Lista material identificada via auditoria:**

- `/fund/admin/regions` — chamado por `FundAdminPanel.tsx`, sem handler backend (auditoria F3 2026-05-13). Componente retorna 404.

**Provavelmente outros (não auditados sistematicamente):**

- `/automation/alerts` — referenciado por `AlertsPage.tsx` (rota frontend comentada em `App.tsx` por isso)
- Qualquer endpoint listado em §4.12 quando consumido sem awareness do DT correspondente

**Recomendação:** se você descobrir endpoint fantasma novo, abra **DT-PRESSURE-MODULE-X-FANTASMA** no `REMEDIATION_DT_LOG.md` seguindo padrão das DTs vetadas.

---

### 14. Para inventory, purchase orders, bank, company members e availability, quais shapes são fonte real?

**Inventory:**
- `inventory_movements` (recém implementado, Nível A read-only) — schema canonical em `backend/src/contracts/marketplace/`
- 3 GETs HTTP read-only expostos em PASSO 5/6 (commits `4bff4a93` em diante)

**Purchase orders:**
- `purchase_orders` schema existe; HTTP exposure parcial — verificar com auditoria específica antes de consumir

**Bank:**
- `bank_*` schema canonical (`bank_ledger`, `bank_transactions`, `bank_accounts`, `bank_splits`)
- Shape exposto via APIs vetadas em §4.11
- Ressalva DT-PRESSURE-BANK-ACTOR-CONTEXT

**Company members:**
- `company_users` é SSOT canônico (DECISION-0042 — MEMBERSHIP consolidado)
- NÃO use tabelas `organization_*` (congeladas)

**Availability:**
- `unified-availability` é SSOT temporal soberano (DECISION-0037)
- Shape em `backend/src/contracts/availability/` (verificar)

---

## §4.5 Domínios Sensíveis

### 15. Quais domínios exigem consulta obrigatória antes de qualquer acoplamento frontend?

**Lista vinculante (memória `project_coordenacao_claude_codex.md`):**

1. `bank_*` (ledger, transactions, accounts, splits) — causalidade financeira
2. `unified-availability` — soberania temporal
3. `actors`, `actor_delegations` — identidade soberana
4. `inventory_*` (movements + product_offers + tenant_products) — estoque material
5. `escrow_*` — escrow ativo (split-escrow vivo)
6. `system_coverage` (view) — invariante cobertura
7. `company_users` — SSOT MEMBERSHIP (DECISION-0042)
8. `posts` (canonical schema) — SSOT social

**Antes de tocar componente que consome ou referencia esses domínios:** abra DT-PRESSURE explicando intenção, ou avise via mensagem Clayton-em-celular para eu ler.

---

### 16. Confirmar lista atual: `bank_*`, ledger, inventory SSOT, unified availability, actors, actor_delegations, suppliers, CRM profundo, PDV, orders.

**Lista expandida vinculante:**

- ✅ `bank_*` — confirmado, soberano
- ✅ ledger (= `bank_ledger`) — confirmado, soberano
- ✅ `inventory_movements` + `tenant_products` + `product_offers` — soberania de estoque material
- ✅ `unified-availability` — soberania temporal
- ✅ `actors`, `actor_delegations` — soberania identidade
- ⚠️ `suppliers` — auditoria material em curso (DT-DRIFT-STATUS-CASE-SYSTEMIC + outros)
- ⚠️ `crm_*` — implementado parcial (SPRINT 88); shape em evolução
- ⚠️ PDV — frontend `pdv` rota existe; backend implementação parcial; pode operar mas com fallback
- ⚠️ `orders` — `purchase_orders`, `service_orders` existem; consumo cauteloso

**Domínio adicional vinculante não listado:** `escrow_*` (especialmente após DECISION-0041 PREMATURO). Não acoplar a fluxos de risco/policy.

---

### 17. Existe algum outro domínio que o frontend deve tratar como zona vermelha?

**Sim, três adições:**

1. **`payment_transactions`** — DECISION-0032 (casing canônico lowercase) ainda em convergência. Não criar componente que assume UPPERCASE.
2. **`canonical_products.type`** — DECISION-0033 (discriminator estrutural). Tratar como categoria, não como status.
3. **`system_coverage` (view)** — DECISION-0031. Cobertura emerge de fluxo econômico. NÃO mostrar como "métrica de saúde do sistema" em UI — pode confundir usuários.

---

## Resposta operacional sobre §8 — DT-PRESSURE que já devem ser abertas

Auditoria identifica DT-PRESSURE prioritárias:

1. ✅ **`DT-PRESSURE-BANK-ACTOR-CONTEXT`** — JÁ ABERTA + MITIGADA EM CÓDIGO (commit `fce493c0`); aguarda smoke browser para CLOSED
2. ✅ **`DT-CAPABILITY-RESOLVER-MVP-IMPLEMENTED`** — registrada com implementação no commit `fd0b9996`; v1 cobre uso atual, v2 dinâmica adiada P3
3. **`DT-PRESSURE-FUND-ADMIN-REGIONS-FANTASMA`** — endpoint `/fund/admin/regions` chamado por `FundAdminPanel.tsx` sem handler backend (não foi aberta nesta jornada — pendente)
4. ✅ **`DT-PRESSURE-AVAILABLE-ACTOR-ACTIVITY-FIELD`** — JÁ ABERTA (Frente C P1 revertida; coluna `companies.activity` ausente do schema material; aguarda migration backend autorizada)

Codex pode abrir item 3 quando precisar. Eu (Claude) já abri 1, 2 e 4 nas sessões P1 + EXECUTOR CONTÍNUO.

---

## Próximos passos coordenados

**Imediato (sem dependência mútua):**
- Codex: ler este brief, ler `docs/HOME_PRINCIPIOS_OPERACIONAIS.md`, quarentenar 5 stubs `api/social.ts` (brief separado) — **NOTA pós-atualização 2026-05-18:** Claude executou quarentena dos 6 stubs (5+`getComments`) sob exceção operacional pontual no commit `227a0371`; trabalho já feito
- ~~Claude: P1 item 3 (capability resolver MVP) — quando Clayton autorizar frente backend~~ → **ENTREGUE** em commit `fd0b9996`

**Dependente:**
- ~~Quando Claude entregar `GET /actors/:id/upcoming` (P1 item 6) → Codex consome em DashboardHome (P1 item 7)~~ → entregue como parte de `home-feed multi-vetor v1` no commit `43d30917` (endpoint `GET /actors/:actorId/home-feed`); DashboardHome consumir é trabalho frontend que pode ficar com Codex quando retornar
- ~~Quando Claude estender `/bank/balance?actorId=` → Codex passa `activeActor.actor_id` em DashboardHome.tsx:177~~ → entregue em commit `fce493c0` backend + `c97d7412` frontend (Claude consumiu sob exceção operacional)

**Coordenação:** atualizações deste brief vivem aqui mesmo. Codex pode adicionar perguntas novas em §4.18+ se surgirem.

---

**Modo institucional:** este brief não substitui DECISION normativa — só esclarece estado material atual e P1 imediato. Brief atualizado em 2026-05-18 EXECUTOR CONTÍNUO (commit em curso) para refletir entrega de capability resolver (`fd0b9996`), bank actor-context (`fce493c0`), quarentena de stubs (`227a0371`), P2 backend (`43d30917`) e P2 frontend (`b3107ce3`). Refatoração de §4.5, §4.8 e §4.11 não foi necessária — as respostas originais permanecem materialmente válidas pós-entrega.
