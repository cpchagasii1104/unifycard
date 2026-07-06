## LOTE L5 — Pacote de decisão: módulos FROZEN / FANTASMA

**Data:** 2026-07-06 · **Branch:** rescue-structural · **Autor:** sessão de auditoria (read-only)

## O que é isto

12 dívidas técnicas do `REMEDIATION_DT_LOG.md` (todas registradas em 2026-05-16/17, nenhuma atualizada desde então no próprio log) descrevem módulos que ficaram **congelados** (código existe, decisão arquitetural pendente) ou **fantasma** (código chama tabelas que não existem no banco). Cada item foi reauditado agora contra o estado real do código e do banco `unificard_dev`.

**Achado geral mais importante:** entre maio e agora, uma frente paralela (DECISION-0113, sweep "canal-1", commits de 2026-06-16 a 2026-06-19) já **resolveu operacionalmente 3 dos 12 itens** aplicando um padrão de contenção (`501 *_SCHEMA_GHOST_CONTAINED` / `*_DISABLED` antes de tocar banco) — sem que o `REMEDIATION_DT_LOG.md` fosse atualizado para refletir isso. Por outro lado, **3 módulos continuam live e sem essa mesma contenção** (work-instant, venue, policy-engine — mais o órfão `core/residence`), ou seja, alcançáveis por URL direta e quebrando com erro cru de banco em vez de um 501 limpo. O padrão de contenção já é institucional e barato — a decisão mais urgente deste lote é replicá-lo nos que faltam.

**Como decidir:** para cada item, leia a situação (1-2 frases) e escolha uma das opções — ou peça outra. Nenhuma opção foi executada; isto é só o pacote de decisão. Custo: **S** = horas, **M** = dias, **L** = semanas/frente própria.

---

## 1. Saúde (DT-HEALTH-MODULE-FROZEN) — **JÁ RESOLVIDO, log desatualizado**

**Situação: DIVERGÊNCIA (positiva).** O log descreve a aba Saúde retornando 500 e pede decisão entre 4 caminhos arquiteturais. Na realidade, `profile-health.routes.ts` já foi alterado (commit `075781b83`, ligado a **DECISION-0071 / F-SAUDE-501**, já citada em memória do projeto) para que **todas** as rotas de saúde respondam `501 PROFILE_HEALTH_DISABLED` de forma explícita, sem tocar em tabela alguma. Tabelas (`user_health_facts`, `health_declarations`, etc.) seguem ausentes; `categories.scope` CHECK segue sem `'health'` — mas isso não importa mais porque nada tenta gravar lá.

- **(a) Fechar a DT como CLOSED/CONTAINED** (nenhum código novo — só atualizar `REMEDIATION_DT_LOG.md`) — **S**
- **(b) Além de fechar, decidir o caminho definitivo** (CORE-COMPLETE/DOMAIN-OWN/HYBRID/ACTOR-CENTRIC) quando saúde virar prioridade de produto — **L**
- **Recomendação:** (a) — não há nada quebrado hoje; a decisão arquitetural de fundo (b) só vale a pena quando houver pressão real (transplante/doação).

---

## 2. Work-instant (DT-MODULE-WORK-INSTANT-FROZEN-PRE-P4-P5)

**Situação: DIVERGÊNCIA (risco real).** O log presumia que "esconder rotas frontend" bastaria. Fato: nunca houve frontend chamando este módulo, mas o **backend segue montado e alcançável** em `/work/instant/*` (via `work.module.ts` → `app.builder.ts:441`), sem nenhuma das guardas 501 que módulos irmãos (saúde, automation, organization) já ganharam. Qualquer chamada direta às 14 rotas bate em `worker_skills`/`instant_requests`/etc. inexistentes e estoura erro cru de banco (500 não tratado), não um 501 limpo. Achado adicional: `actor_delegations` saiu de 0→9 rows, mas todas `revoked` (0 ativas) — a pré-condição de descongelamento continua não cumprida.

- **(a) Aplicar o mesmo padrão de contenção já usado em automation/organization/saúde** (501 `WORK_INSTANT_SCHEMA_GHOST_CONTAINED` nas 14 rotas, antes de qualquer service) — **S**
- **(b) Tombstone formal** (mover pasta para archive + guard anti-revival) — **M**
- **(c) Frente nomeada de ativação** (decisões P4+P5 + matching real) — **L**
- **Recomendação:** (a) — é o mesmo custo/padrão já pago 3x este trimestre; fecha a exposição real hoje mesmo sem decidir o futuro do módulo.

---

## 3. Venue (DT-MODULE-VENUE-FROZEN-PRE-RESTAURANT-VERTICAL)

**Situação:** vertical restaurant (tabs/menus/QR) segue congelada; frontend escondido corretamente (`App.tsx` comentado). **Mesma classe de risco do item 2:** backend segue **montado publicamente** (`venuePublicRoutes`, `app.builder.ts:214-215`, sem exigir login) batendo em `tabs`/`menus`/`menu_items` inexistentes — sem a guarda 501 que os módulos irmãos já têm. `pdv` (módulo vizinho) já ganhou 4 commits de firewall financeiro desde maio, mas isso não cobre as tabelas próprias de venue. Nenhuma decisão de vertical restaurant emergiu.

- **(a) Aplicar o padrão de contenção 501 nas rotas de venue** (mesma receita do item 2) — **S**
- **(b) Tombstone completo (mover para archive)** — **M**
- **(c) Frente de vertical restaurant** (decisão + `pdv` + `venue` juntos) — **L**
- **Recomendação:** (a) — mais urgente que os outros porque esta rota é **pública** (sem auth), não só autenticada.

---

## 4. Presence — módulo FROZEN (DT-MODULE-PRESENCE-FROZEN-PRE-P4-DECISION)

**Situação: sem divergência, e é o único dos "congelados" já 100% seguro.** `modules/presence` está **totalmente desmontado** do `app.builder.ts` (nem transitivamente, ao contrário de work-instant) — não há URL alcançável hoje. Decisão arquitetural P4 (qual SSOT de presença entre os 9 modelos paralelos) segue sem ser tomada; o candidato preferencial (`live_presence`) segue com 0 rows — nem ele foi testado.

- **(a) Manter FROZEN sem prazo (já é o estado mais seguro possível)** — **S**
- **(b) Tombstone formal + guard anti-revival** (documenta a segurança atual de forma permanente) — **M**
- **(c) Abrir a decisão P4 agora** (escolher SSOT entre os 9 modelos, migrar `presence` para `live_presence`) — **L**
- **Recomendação:** (c) — é a única DT deste lote com prioridade HIGH que ainda bloqueia produto (v2 do modo operante depende dela); vale abrir a decisão mesmo sem pressão de cliente.

---

## 5. Policy Engine (DT-MODULE-POLICY-ENGINE-AUDIT-URGENTE + sucessora PREMATURO-AGUARDA-ECOSSISTEMA-RISK)

**Situação:** a auditoria de maio já respondeu a pergunta central — **não é** authority paralela, é overlay correto de risk-management que usa a authority chain como gatekeeper (achado mantido, sem retratação). Frontend devidamente escondido (`RiskCommandCenterPage`/`PolicyManagementPage` comentados em `App.tsx`). **Mesma classe de risco dos itens 2 e 3:** backend segue montado (`app.builder.ts:599-600`, dentro de `protectedScope` — exige login, ao menos) referenciando `policy_rules`/`policy_decisions` inexistentes, sem guarda 501. Ecossistema pré-requisito (`actor_risk_profile`, `trust_profiles`, `trust_score_snapshots`) existe no banco mas com 0 rows — condição (b) do critério de descongelamento do próprio log segue não cumprida; `evidence_packs`/`business_audit_logs` continuam inexistentes. (Nota lateral: um módulo irmão, `risk-command-center`, também está montado em `app.builder.ts:595-596` e provavelmente merece o mesmo tratamento — fora do escopo estrito desta DT, mas mesma família.)

- **(a) Aplicar o padrão de contenção 501** nas rotas de policy-engine (e considerar o mesmo para `risk-command-center`) — **S**
- **(b) Manter como está (já exige autenticação, risco menor que 2/3)** — **S**
- **(c) Investir na maturação do ecossistema risk/trust para desbloquear de verdade** (fora de escopo deste lote — é frente de fraude/dinheiro) — **L**
- **Recomendação:** (a) — mesmo padrão, mesmo custo baixo, fecha o último buraco relevante da família "auditoria FANTASMA top-5 de maio".

---

## 6. Automation (DT-MODULE-AUTOMATION-AUDIT-PRE-OVERLAP-CHECK) — **JÁ RESOLVIDO, log desatualizado**

**Situação: DIVERGÊNCIA (positiva).** O log pedia uma auditoria de overlap (automation.alerts vs financial_alerts; scheduled_actions vs event_outbox) como pré-requisito antes de qualquer ação. Essa auditoria formal nunca foi feita — **mas o risco operacional que a motivava já foi neutralizado**: commit `ac5571b7e` (2026-06-19, DECISION-0113 R8N) contém as 9 rotas de dados de automation com `501 AUTOMATION_SCHEMA_GHOST_CONTAINED` antes de qualquer service, e a rota `run-due` já tinha `403 AUTOMATION_RUN_DUE_HTTP_DISABLED` (guard R18). Tabelas próprias (`alerts`, `scheduled_actions`) seguem ausentes, mas nenhuma chamada externa consegue mais alcançá-las.

- **(a) Fechar a DT como CONTAINED** (atualizar `REMEDIATION_DT_LOG.md`, sem código novo) — **S**
- **(b) Ainda assim responder as 3 perguntas de overlap do log**, por completude institucional (é barato e a pergunta "automation.alerts é o mesmo conceito que financial_alerts?" seguirá relevante se algum dia alguém quiser reativar) — **S**
- **Recomendação:** (a) + (b) — fechar o item como resolvido operacionalmente, e aproveitar para responder as 3 perguntas já que ficaram pendentes e são baratas.

---

## 7. DT-FANTASMA-ORPHAN-COLLECTIVE (8 módulos sem caller)

**Situação:** dos 8 órfãos (`core/residence`, `core/root-config`, `core/user-group-allocation`, `modules/care`, `modules/social-chat`, `modules/work-instant`, `modules/media`, `modules/presence`), 6 seguem sem nenhum caller frontend nem sinal de mudança (`root-config`, `user-group-allocation`, `care`, `social-chat`, `media`/`getPresignUrl` continua com zero call sites, `presence`/`api/presence.ts` continua sem uso fora do próprio arquivo). **DIVERGÊNCIA em `core/residence`:** o log dizia "zero callers"; na verdade está **montado e alcançável** em `/identity/residence` (via `identity.routes.ts:1573-1575`, tabela própria `global_user_residence` também inexistente — mesma classe de risco dos itens 2/3/5). Além disso, existe hoje um caminho **novo e vivo** para o mesmo conceito (endereço residencial): DECISION-0074, rota `/profile/residence-address`, de fato chamada por `frontend/src/api/residenceAddress.ts` → `components/Profile.tsx`. `core/residence` não é mais "aspiracional sem demanda" — é rota exposta e substituída por um caminho que já funciona em produção.

- **(a) Remover `core/residence`** (desmontar de `identity.routes.ts` + apagar o diretório — substituto provado, sem perda) — **S**
- **(b) Aplicar só a contenção 501 em `core/residence`** sem remover ainda — **S**
- **(c) Manter os outros 7 como estão (sem ação)** — **S**
- **Recomendação:** (a) para `core/residence` (caso resolvido, custo trivial, fecha uma exposição real); (c) para os outros 7 sem indício de retomada.

---

## 8. DT-MODULES-ASPIRATIONAL-VS-RUNTIME

**Situação: DIVERGÊNCIA.** O inventário-mãe (157 módulos, maio/2026) nunca foi re-auditado. O próprio `MODULES_INVENTORY.md`, citado como "SSOT na raiz" por várias DTs deste lote, foi **movido para `docs/99_archive/raiz_2026-05-31/`** na limpeza de documentação (commit de move em 2026-05-31) — está fora do lugar que as outras DTs apontam, e a classificação em si tem quase 2 meses (superada em pelo menos 3 dos 12 itens deste próprio lote, como visto acima).

- **(a) Re-rodar o inventário completo (157 módulos) do zero** — **L**
- **(b) Só corrigir as referências de path nas DTs** que citam `MODULES_INVENTORY.md` (apontar para o novo local) + anotar que 3 itens do lote L5 já mudaram de estado — **S**
- **(c) Deixar como está (histórico, sem re-auditoria)** — **S**
- **Recomendação:** (b) — trivial e evita o próximo executor procurar um arquivo que não existe mais na raiz e presumir que nada mudou desde maio.

---

## 9. DT-BANK-SATELLITE-MODULES-DORMANT (16 módulos)

**Situação: sem divergência.** Todas as ~17 tabelas checadas (alerts, settlement, circuit-breaker, disputes, freezes, governance x2, payouts, rate-limit, reversals, risk, sla, treasury x2, idempotency) seguem com **0 rows**, idêntico a maio — nenhuma pressão de ativação emergiu em 7 semanas; única exceção é `risk_financial_limits_by_level` com 4 rows de configuração/seed (não é uso operacional). `core/intent` (único dos 16 recomendado para **arquivamento formal**) confirma: `intent_idempotency_keys` nunca existiu; o genérico `idempotency_keys` (também 0 rows) cobre o caso.

- **(a) Manter DORMANT como bloco (nenhuma ação)** — **S**
- **(b) Executar o ARQUIVAR_FORMAL de `core/intent`** (único caso com recomendação de arquivamento, não apenas congelamento) — **S**
- **(c) Sessão dedicada "ratificar ou arquivar" para os 16** (já prevista pelo próprio log) — **M**
- **Recomendação:** (b) — fechar o único caso simples agora; os outros 15 seguem sem pressão real, não vale sessão dedicada ainda.

---

## 10. DT-PRESENCE-FRAGMENTATION-CONFIRMED

**Situação: sem divergência.** 8-9 tabelas paralelas de presença/check-in, todas com 0 rows, sem nenhuma mudança em 7 semanas — confirma a própria previsão do log ("decisão só quando 1º caso real emergir").

- **(a) Manter como está (aguardar 1º caso real)** — **S**
- **(b) Tomar a decisão de SSOT preventivamente** (`live_presence`, recomendação preliminar do próprio log) mesmo sem caso real — **M**
- **(c) Depreciar formalmente os modelos que claramente não vão vencer** (ex.: schema próprio de `modules/presence`) — **M**
- **Recomendação:** (a); ver item 4 — abrir a decisão P4 resolveria este item pela mesma raiz.

---

## 11. DT-OPERATIONAL-BINDING-FRAGMENTATION

**Situação: DIVERGÊNCIA.** 6+ tabelas paralelas de vínculo seguem fragmentadas (nenhuma decisão de convergência tomada). `actor_delegations` saiu de 0→9 rows — mas todas `status='revoked'`, 0 ativas — indício de que o modelo já foi exercitado (ao menos em teste/seed), embora sem uso operacional real ainda. `company_users` variou 9→3 e `group_members` 5→1 (provável reset/churn de dados de dev); `role_permissions` dobrou (68→136).

- **(a) Manter fragmentado até 1º caso real de freelancer multi-empresa** (critério original do log) — **S**
- **(b) Investigar agora a origem das 9 rows revogadas em `actor_delegations`** (foi teste, seed, ou uso real abandonado?) — **S**
- **(c) Abrir a decisão arquitetural soberana** (SSOT único vs coexistência vs híbrido, opções a/b/c do log) — **L**
- **Recomendação:** (b) primeiro — barato, e pode revelar que o "primeiro caso real" já aconteceu sem ninguém perceber; só depois vale considerar (c).

---

## 12. DT-ORGANIZATION-SPRINT78-FROZEN — **JÁ RESOLVIDO, log desatualizado**

**Situação: DIVERGÊNCIA (positiva).** O log registrava um risco aberto explícito: "4 botões da aba Equipe levam a erro 500". Hoje isso está corrigido em **duas camadas**: (1) `CompanyTeamTab.tsx` já tem os 4 botões removidos/comentados citando esta própria DT; (2) o backend (`organization.routes.ts`, commit `fb262919d`, 2026-06-16) já faz fail-closed — as 13 rotas retornam `501 ORGANIZATION_SCHEMA_GHOST_CONTAINED` antes de tocar em `organization_members/invites/roles/units` (que seguem inexistentes). Único resíduo: o comentário deixado em `CompanyTeamTab.tsx` ainda diz "retornam HTTP 500 em runtime", que ficou desatualizado — o backend responde 501 limpo desde então.

- **(a) Fechar a DT como CLOSED/CONTAINED** (atualizar `REMEDIATION_DT_LOG.md` + corrigir o comentário desatualizado em `CompanyTeamTab.tsx`) — **S**
- **(b) Retomar Sprint 78** (migrar `company_users` → `organization_*`, decisão arquitetural ampla) — **L**
- **Recomendação:** (a) — nada a fazer em código; só higiene de documentação/registro.

---

## Tabela-resumo para decisão rápida

| # | Item | Recomendação | Custo |
|---|---|---|---|
| 1 | Saúde | **Já resolvido** — só fechar a DT no log | S |
| 2 | Work-instant | Aplicar contenção 501 (mesmo padrão de automation/organization) | S |
| 3 | Venue | Aplicar contenção 501 (rota é **pública**, mais urgente) | S |
| 4 | Presence (FROZEN) | Abrir decisão P4 (SSOT de presença) agora | L |
| 5 | Policy Engine | Aplicar contenção 501 (e avaliar `risk-command-center` junto) | S |
| 6 | Automation | **Já resolvido** — fechar a DT + responder as 3 perguntas de overlap por completude | S |
| 7 | Fantasma-Orphan-Collective | Remover `core/residence` (superado, exposto); manter os outros 7 | S |
| 8 | Aspirational-vs-Runtime | Corrigir path do inventário + anotar 3 itens já resolvidos | S |
| 9 | Bank-Satellite-Dormant | Arquivar formalmente `core/intent` | S |
| 10 | Presence-Fragmentation | Manter (mesma raiz do item 4) | S |
| 11 | Operational-Binding-Fragmentation | Investigar origem das 9 delegações revogadas | S |
| 12 | Organization-Sprint78 | **Já resolvido** — fechar a DT + corrigir comentário desatualizado | S |

**Nota geral:** 7 dos 12 itens tiveram divergência material entre o log (maio/2026) e o estado real do código/banco em 2026-07-06. Das divergências, **3 são boas notícias já entregues por outra frente** (saúde, automation, organization — todas seguem o mesmo padrão institucional de contenção `501 *_GHOST_CONTAINED`, DECISION-0113/DECISION-0071) e só precisam de higiene de registro. As **3 exposições reais restantes** (work-instant, venue, policy-engine) e o órfão `core/residence` seguem live e sem essa mesma contenção — é a ação de menor custo e maior valor deste lote inteiro: replicar um padrão já pago 3x, em 4 lugares que faltam. Nenhuma ação foi executada nesta auditoria — este documento é somente o pacote de decisão.
