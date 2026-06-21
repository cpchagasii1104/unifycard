# INBOX — Tarefas da IA-DIRETORA para as instâncias

> Só a IA-DIRETORA escreve aqui. Cada IA responde em `respostas/IA-<X>.md` (ver METODO.md).
> HEAD vivo de referência: `dd270f41` · branch `rescue-structural`.

---

## RODADA 2 — PROVA-VIVA · alvo ÚNICO: **IA-BANCO** · ABERTA

> ⚠️ Em transição: a IA-BANCO está respondendo a Rodada 2 no §14.9 do
> `PLANO_ORQUESTRACAO_SISTEMICA_UNIFICARD.md` (em voo). Quando fechar, a DIRETORA migra o
> resultado para o `CONSOLIDADO.md`. Da Rodada 3 em diante, responder AQUI (`respostas/IA-BANCO.md`).

Probes READ-ONLY pendentes (consolidados dos INCONCLUSIVOs da Rodada 1):
1. Trigger `0077` graph-governance aplicado? (negative-proof de U1). [IA-SEMANTICA/U1]
2. RLS nos 6 planos de autoridade (`company_users`, `actor_delegations`,
   `financial_approval_authorities`, `tenant_operator_grants`, `reconciliation_disputes`,
   `reversals`): rls/forced/policies? [IA-AUTORIDADE/IA-DINHEIRO]
3. REVOKE C63 (`20260428200000`) aplicado? + coluna `purpose_concept_id` (0132) viva em `availability`? [IA-TEMPO]
4. Trigger append-only `inventory_movements` habilitado hoje (migration `20260411120000` desabilita p/ backfill)? + drift movements vs balances. [IA-COMERCIO]
5. `rides_*` aplicadas (`to_regclass('rides_rides')`)? FK `rides_rides.bank_transaction_id`→`bank_transactions`? [IA-LOGISTICA]
6. `services`/`service_offerings`/`company_concept_publications`: to_regclass + rowcount + FK `service_id→services`. [IA-OFERTA]
7. `financial_approval_*` contagem (0/0/0?) + `economic_policy_lines.bps` materializado + `service_payment_requests` rls=f × `service_payment_executions` rls=t. [IA-DINHEIRO]
8. `actor_has_permission()` ainda `RETURN FALSE`? + dev/migration count vivo (drift disco×`schema_migrations`?). [baseline]

---

## RODADA 3 — RESEAL U1 · alvo ÚNICO: **IA-YALA** · **FECHADA (PASS → promulgada, commit `2a0d3c21`)**

U1 (widening `concept_relations` 3→6) foi **EXECUTADO** pela executora (IA-DIRETORA). Reseal adversarial READ-ONLY — verifique de 1ª mão (disco vence narrativa) o **tripé** + as **12 condições de fechamento** do ChatGPT. Escreva o VEREDITO (PASS/FAIL/INCONCLUSIVO) em `respostas/IA-YALA.md` (crie).

Evidência a reprovar (working tree; migration `20260620130000` aplicada; `schema_migrations`=396):
- **Código:** `graph.adapter.ts:9` (GraphRelationType = 6) + `graph-governance.service.ts:9-16` (RELATION_TYPES = 6).
- **Migration:** `migrations/20260620130000_widen_concept_relations_relation_type_3to6.sql` (DROP IF EXISTS + ADD CHECK; idempotente; forward-only; `category_relations` NÃO tocado; trigger 0077 intocado).
- **DB vivo:** `concept_relations_relation_type_check` = 6 tipos; trigger `trg_concept_relation_governance` ativo; drift=0 (disco=DB=396).
- **Gates:** typecheck 34→34 (no_new_errors) · validate:architectural 35→35 (critical_new=0) · check:migrations 396 OK.
- **Negative-proofs (mordem):** NP1a governado+`bogus` → "viola a restrição" (CHECK) · NP2 não-governado+válido → "write blocked" (trigger 0077).
- **E2E governado:** 6 tipos aceitos (incl. `requires`/`part_of`/`substitutes`); `bogus` falha; não-governado falha.

Nota de re-baseline (achada na execução): `concept_relations` é **global, sem `tenant_id`** (DECISION-0092 dropou; o `.md` 0076 original tinha tenant_id — superado). Não afeta U1 (CHECK é por coluna `relation_type`).

## RODADA 4 — RESEAL A1 · alvos: **IA-DOCUMENTOS · IA-DECISOES-DT · IA-YALA** · **FECHADA (3× PASS → promulgada, commit `6c93c648`)**

A1 (reindexar `DECISOES.md` 0112→0141) **EXECUTADO** pela executora. ChatGPT APPROVED_WITH_SMALL_ADJUSTMENTS (incorporados: fonte = header do .md primeiro, divergência→DIVERGENCE_REVIEW; coluna Verificado honesta; checks documentais). Reseal READ-ONLY — cada um na própria `respostas/IA-*.md`:
- **IA-DOCUMENTOS** → confirmar que o índice **NÃO virou norma** (segue índice/auditoria); sem norma acidental; "Verificado=NÃO-AUDITADO" não finge auditoria material.
- **IA-DECISOES-DT** → consistência cartorial: cada DECLARADO bate com o header do `.md`; 0112→0141 sem buraco/duplicata; LOG e DECISIONs `.md` intocados; nº livre = 0142.
- **IA-YALA** → veredito final PASS/FAIL adversarial (docs-only: tripé não se aplica; reprovar de 1ª mão — git diff só `DECISOES.md`, 30 linhas, status do header).

Evidência (working tree; `git diff` só em `docs/02_decisions/DECISOES.md`): bloco 0112–0141 (30 linhas, sem buraco/dup), DECLARADO=header, Verificado=NÃO-AUDITADO, sem divergência header×LOG. Checks da executora: escopo OK · LOG/.md intocados · 30 distintos · 0 dup · 0 faltando.

## RODADA 5 — U1b PRÉ-SEED: fechar slug + domain + colisões + label · alvo ÚNICO: **IA-SEMANTICA** · **FECHADA (proposta canônica entregue · prova-viva resolvida pela DIRETORA · aguarda ratificação de Clayton)**

READ-ONLY. O READ-FIRST do U1b bateu em STOP (guards do ChatGPT morderam). Antes de qualquer seed, a IA-SEMANTICA (dona do eixo, DECISION-0070: taxonomia não se inventa no runtime) deve **PROPOR** (não executar) a forma canônica. Responda em `respostas/IA-SEMANTICA.md`, carimbando HEAD vivo (`6c93c648`).

**Objetivo (proposta canônica, READ-ONLY):**
1. **slug final** de cada um dos 10 concepts (convenção viva = **kebab-case**).
2. **domain final** de cada concept (`concepts.domain` é NOT NULL + FK→`domains`).
3. para cada concept que já exista: **reutilizar** ou **nascer novo**? (justificar).
4. **colisões** com concepts de `educacao-e-conhecimento` (decoracao/fotografia/musica/video = LEARNING).
5. **labels**: ficam fora de escopo (projeção retorna slug) ou exigem fatia separada?
6. **forma da seed migration** de concepts (precedente: `20260616120000_seed_concepts_temporal_purpose`).
7. **forma da seed governada** das 9 arestas em `concept_relations` (caminho `set_config app.graph_governance`, já provado no U1).

**Direção preliminar (AVALIAR, não executar):**
`festa-de-casamento`→cultura-lazer-e-eventos · `local-de-evento`→cultura-lazer-e-eventos|servicos · `buffet-alimentacao`→servicos · `fotografia-video`→servicos · `musica-som`→servicos · `decoracao-festa`→servicos · `beleza-cabelo-maquiagem`→servicos · `locacao-de-traje`→servicos|produtos-e-comercio · `transporte`→mobilidade-e-logistica · `cerimonial`→servicos.
Arestas ratificadas por Clayton: `requires` (local·buffet·fotografia·musica·decoracao) · `related_to` (beleza·traje·transporte·cerimonial). SEM `suggests`.

**Pontos de atenção obrigatórios:**
1. NÃO reutilizar concept de `educacao-e-conhecimento` se ele é aprendizado/curso/conteúdo, não serviço de festa.
2. NÃO criar concept duplicado só por variação de slug; se houver equivalência REAL, reportar.
3. `domain` ≠ categoria de navegação — seguir a semântica viva + decisões existentes (0105).
4. NÃO criar label agora se a projeção puder retornar slug; label/display = fatia separada se necessário.
5. NÃO tocar services · service_offerings · company_concept_publications · tenant_concept_offerings · RFQ · presença · dinheiro · worker · payout.
6. **DECISION-0142 HELD** até a forma canônica final (slug/domain/árvore) estar fechada.

**Evidência esperada:** tabela final (concept · slug-kebab · domain · novo|reusar · justificativa), política de label, forma da seed-migration + seed-governada-de-aresta. Tudo READ-ONLY; é PROPOSTA para Clayton ratificar.

## RODADA 5b — U1b: revisar as 10 folhas pela LENTE DE REUSO (folha = SSOT global) · alvo ÚNICO: **IA-SEMANTICA** · **FECHADA (SET FINAL entregue; REVERTEU a R5 → 4 REUSAR + 6 NOVO; aguarda ratificação de Clayton)**

READ-ONLY. Pergunta de Clayton + exemplo do **segurança** revelaram que as folhas são **infra SSOT global**, não folhas da vertical casamento. Antes de fixar a árvore, a IA-SEMANTICA revisa cada folha pela lente de **REUSO universal**. Responda em `respostas/IA-SEMANTICA.md` (append; HEAD `6c93c648`).

**Princípio governante (Clayton):** um provider serve N verticais — *o segurança atende casa-noturna, show, festa particular, obra, condomínio*; *o fotógrafo atende casamento, festa infantil, show*. Logo a folha é **UM concept SSOT context-neutral**, alcançado por **N arestas de entrada** (muitos galhos → uma folha, grafo global DAG). O provider vincula-se à folha **1×** e fica descobrível em todos os galhos.

**Mandato:**
1. **Nenhum slug de FOLHA embute vertical** ("festa"/"casamento"/etc.). Folha = nome universal do serviço (`seguranca`, `fotografia-video`, `decoracao`, `transporte`…). Só o **raiz** (`festa-de-casamento`) é específico da intenção.
2. **`decoracao-festa` → `decoracao`** (neutra). Colisão com a `decoracao` de LEARNING resolvida por **DOMAIN** (`servicos` ≠ `educacao-e-conhecimento`; UNIQUE é `(domain,slug)` → coexistem), **não** por slug-baking.
3. Revisar as **10** uma a uma: confirmar slug universal + domain; flag qualquer nó que seja **genuinamente** específico de evento (justificar) vs folha universal.
4. **Proibido duplicar folha** no futuro (uma `seguranca` só) — registrar isso como invariante de naming do catálogo de folhas (ontologia de serviço global).
5. Profundidade: piloto **raso** (intent-root → folha, 1 salto). Galhos intermediários (`part_of`) = futuro, NÃO agora.

**Entregar:** set FINAL de 10 (slug universal + domain + novo/reusar + justificativa) + a invariante "uma folha por serviço, naming neutro". **STOPs:** só `concepts`/`concept_relations`; sem services/offerings/publications/RFQ/presença/dinheiro/labels-por-impulso. **DECISION-0142 HELD.**

## RODADA 6 — RESEAL U1b · alvo ÚNICO: **IA-YALA** · **FECHADA (PASS — sem warnings; aguarda promulgação Clayton + DECISION-0142)**

U1b (seed governado da árvore-piloto festa-de-casamento, versão-REUSO) **EXECUTADO**. Reseal adversarial READ-ONLY de 1ª mão. Escreva VEREDITO em `respostas/IA-YALA.md` (HEAD vivo — note: pós-U1b, schema_migrations=398).

Evidência a reprovar (working tree: 2 migrations novas, ZERO código):
- **MIG A** `migrations/20260620140000_*` — 6 concepts NOVOS via `app.concept_governance`; guard-pré (4 reusados) + guard-pós (6).
- **MIG B** `migrations/20260620150000_*` — 9 arestas via `app.graph_governance`; JOIN `(slug,domain)` explícito; ON CONFLICT `concept_relations_edge_uq`; **guard de ÁRVORE EXATA** (9 ratificadas E total=9).
- **Árvore == decisão de Clayton:** 5 requires (local-de-evento·buffet·fotografia·musica·decoracao) + 4 related_to (servicos-pessoais-beleza·locacao-de-traje·transporte·cerimonial). SEM `suggests`.
- **Versão-REUSO:** fotografia/musica/decoracao (educacao-e-conhecimento) + servicos-pessoais-beleza REFERENCIADOS, NÃO recriados/movidos. Arestas cross-domain legítimas.
- **Negative-proofs (mordem):** NP-concept = "concept insert blocked" (0075); NP-graph = "write blocked" (0077). **Idempotência:** re-seed A/B = INSERT 0 0.
- **Sem expansão de escopo:** ZERO código/endpoint novo (projeção via reader existente); sem label/category/services/offerings/publications/RFQ/presença/dinheiro.

Checklist YALA (do GO ratificado): árvore final == decisão · versão-REUSO preservada · domain não usado como filtro · sem duplicação de folha · sem `suggests` · sem provider/discovery · sem money/presence · migrations idempotentes e governadas. **DECISION-0142 registrará árvore final + invariante (concept_id, nunca domain)** na promulgação.

**Checks adicionais (ChatGPT):**
- **Escopo do diff:** confirmar que U1b tocou SOMENTE as 2 migrations; reprovar se houver alteração em código TS/frontend/labels/categories/services/service_offerings/company_concept_publications/tenant_concept_offerings/RFQ/presença/dinheiro/worker/payout.
- **Concepts proibidos:** reprovar se nasceram `fotografia-video`/`musica-som`/`decoracao-festa`/`beleza-cabelo-maquiagem` (a versão-REUSO os veta).
- **Invariante p/ 0142:** confirmar que a promulgação proposta registra: concept_id=identidade · domain=auxiliar · discovery casa por concept_id · proibido filtrar provider discovery por domain · role/contexto na relação/oferta, não na folha.
- **Cartório:** conferir STATUS/CONSOLIDADO/INBOX coerentes pós-U1b. Se algum ainda declarar U1b como READ-FIRST STOP sem o EXECUTED/PENDING-YALA, marcar **RESÍDUO CARTORIAL** (warning), **NÃO** reprovar a migration se o material estiver correto. _(Nota DIRETORA: STATUS já recebeu prepend "U1b EXECUTADO" 2026-06-20(2); CONSOLIDADO/INBOX idem — revalide.)_

**Saída obrigatória:** `VEREDITO: PASS | FAIL | PASS_WITH_WARNINGS | INCONCLUSIVE` · HEAD/BRANCH/WORKTREE/MIGRATIONS/SCHEMA_MIGRATIONS · ACHADOS CRÍTICOS · PROVAS (escopo/concepts/arestas/negative-proofs/idempotência/projeção/fronteira) · RESÍDUOS (cartoriais/warnings/pendências-0142) · RECOMENDAÇÃO (promulgar | bloquear | corrigir antes).

## RODADA 7 — F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS (auditoria READ-ONLY) · GO Clayton/ChatGPT · ABERTA

**Natureza:** READ-ONLY / auditoria de convergência. SEM execução/migration/código/cartório soberano (só sua resposta em `respostas/IA-<X>.md`). NÃO "corrigir rapidinho". Carimbe HEAD vivo.

**Por quê:** U1b fechou a cabeça semântica (CONCEPT→needs). Antes de F-OFFER-SSOT-CONVERGENCE, provar **onde PF/PJ/prestador declara "eu faço isso"** e se converge para `CONCEPT → SERVICE → SERVICE_OFFERING → AVAILABILITY` ou cria **verdade paralela**.

**PERGUNTA CENTRAL:** *Onde o actor declara capacidade REAL de fazer algo, e essa declaração vira descoberta/contratação/agenda SEM duplicar SSOT?*

**SAÍDA OBRIGATÓRIA de cada IA** (em `respostas/IA-<X>.md`): (1) HEAD vivo · (2) revalidou no disco/banco sim/não/parcial · (3) arquivos/tabelas lidos · (4) **MATRIZ**: `SUPERFÍCIE | O QUE DECLARA | QUEM ESCREVE | SSOT ou READ-MODEL | ACTOR/OWNER | CONCEPT_ID? | AUTORIDADE | TEMPO | RISCO | RECOMENDAÇÃO` · (5) VEREDITO: PASS_TO_CONVERGENCE | PARTIAL | BLOCKER | INCONCLUSIVE · (6) lista de verdades paralelas · (7) lista de STOPs para F-OFFER. **Nenhuma edição.**

**FORA DE ESCOPO (todos):** implementar F-OFFER · migration · endpoint · label · dinheiro · payout · presença · RFQ · engine. **IA-DINHEIRO NÃO entra** (a pergunta é capacidade operacional, não liquidação).

— **IA-ACTOR:** perfil PF · perfil profissional · actor · actor_capabilities · actor_capability_grants · abas do perfil · fluxo pós-cadastro · PF×profissional×representante-PJ. *Onde PF declara habilidade/capacidade? Vira CONCEPT/SERVICE ou só metadata/read-model? Há campo paralelo ("fotógrafo"/"segurança") fora da cadeia? Perfil coleta ou cria verdade? GET cria actor/capacidade por acidente? activeActor/userActor/companyActor separados?*
— **IA-OFERTA:** services · service_offerings · company_concept_publications · tenant_concept_offerings · provider console · service discovery · store onboarding. *Qual tabela responde "este actor FAZ este concept"? Qual responde "este actor VENDE este pacote"? publications viraram SSOT paralelo? preço em lugar errado? service/offering sem concept_id? category substituindo concept?*
— **IA-AUTORIDADE:** canRepresentActor · canManageCompany · actor_capability_grants · company_users · actor_delegations · RBAC · rotas de criar/editar/publicar serviço/oferta/perfil-pro/PJ. *Quem pode declarar que um actor faz X? PF por si? representante por PJ? funcionário por delegação? capability grant dormant ou participa? herança perigosa? actionContext.actorId como autoridade? rota onde produto permite e autoridade não prova?*
— **IA-TEMPO:** availability · owner_type · owner_id · disponibilidade da oferta · agenda perfil/PJ · booking/request. *A disponibilidade real da oferta vive onde? owner_type suporta service_offering? perfil/PJ cria agenda paralela? agenda do actor × agenda da oferta separadas? disponibilidade sem vínculo com oferta concreta?*
— **IA-COMERCIO (sombra futura, READ-ONLY-mapa):** products · inventory · catalog · canonical_products · estoque · store onboarding · variant. *Existe hoje caminho para cruzar serviço × recurso material? (ex. futuro: mecânica troca-de-óleo → modelo/ano → óleo/peça disponível). Já tem substrato ou é macro futura? Risco de produto/estoque criar SSOT paralelo ao service_offering? Tabelas candidatas futuras p/ disponibilidade material? NÃO propor implementação — só readiness + riscos.*
— **IA-BANCO (prova-viva):** *services/service_offerings/publications/tenant_concept_offerings existem no banco vivo? colunas que ligam a concept_id/actor_id/provider_actor_id/service_id/offering_id? FKs fortes/fracas/SET NULL/ausentes? availability referencia owner_type service_offering? há tabelas de perfil/PJ que gravam capabilities/categories/services? drift schema_migrations×disco? Provar sem editar.*

**Fechamento (DIRETORA consolida):** matriz única dizendo o SSOT de "eu faço isso" · de "eu vendo isso" · de "posso nesse horário" · quais superfícies são só UI/read-model · quais rotas/tabelas criam verdade paralela · decisões de Clayton necessárias · se F-OFFER pode abrir ou há BLOCKER. **Depois da Rodada 7: voltar ao ChatGPT antes de qualquer execução material.**

## RODADAS FUTURAS
_(a IA-DIRETORA posta aqui; rodadas fechadas vão para `_arquivo/`)_
