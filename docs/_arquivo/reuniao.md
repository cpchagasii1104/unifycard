# reuniao.md — Estratégia Kernel / Quarentena / Êxodo Runtime

## 0. Natureza

Este arquivo é ATA DE REUNIÃO ESTRATÉGICA READ-ONLY.

Não é DECISION.
Não é DT oficial.
Não é STATUS oficial.
Não é GO para executora.
Não autoriza edição, deleção, migration, commit ou refactor.

Objetivo: consolidar quatro visões de IA + decisão de Clayton sobre a melhor estratégia para reduzir retrabalho no Unificard sem regredir o que já está sólido.

---

## 1. Participantes

```text
Clayton:
  visionário do projeto
  decide produto, ambição, risco social e direção final

IA-Repo-A:
  acesso vivo ao repositório
  papel: provar estado vivo de backend/runtime/app.builder/schema

IA-Repo-B:
  acesso vivo ao repositório
  papel: provar estado vivo de frontend/exposição/rotas/menus/gates

IA-Freeze-A:
  sem repo vivo
  trabalha com arquivos congelados + reuniao.md
  papel: análise estratégica, riscos, coerência arquitetural

IA-Freeze-B:
  sem repo vivo
  trabalha com arquivos congelados + reuniao.md
  papel: contraponto estratégico, simplificação, redução de retrabalho
```

---

## 2. Estado vivo informado pelas IAs com repo

```text
Coleta IA-Repo em 2026-06-17 23:55:23 -03:00.

HEAD:
  ca3c99a669fd62638286d382a81875f86313770f

Branch:
  rescue-structural

git status:
  Worktree já estava suja antes desta ata.
  Modificados:
    docs/memorias/MINHA_MEMORIA_ACTOR_USERS.md
    docs/memorias/MINHA_MEMORIA_BANCO_DE_DADOS.md
    docs/memorias/MINHA_MEMORIA_DECISOES.md
    docs/memorias/MINHA_MEMORIA_DINHEIRO.md
    docs/memorias/MINHA_MEMORIA_DOCUMENTOS.md
    docs/memorias/MINHA_MEMORIA_DT.md
    docs/memorias/MINHA_MEMORIA_TEMPO.md
    opus.md
  Untracked relevantes:
    reuniao.md
    backend/*output*.txt
    backend/gate*_output.txt
    backend/e2e_test_output.txt
    clayton.md
    CRIACAO_DE_EMPRESAS.md
    DECISION-0131-INSTRUMENTO-DECISAO.md
    F-AUTHORITY-MAP-0131-v2.md
    G10_CONSOLIDACAO_EXECUTIVA_ONBOARDING.md
    PLANO-DEFINITIVO-0131-EXECUTORA.md
    docs/memorias/MINHA_MEMORIA_YALA.md
    imagens/mapas PNG

Migrations disco:
  backend/migrations contém 394 arquivos .sql.
  Primeiras: 0001_extensions.sql, 0002_identity.sql, 0003_bank_core.sql, 0004_marketplace.sql, 0005_events.sql.
  Últimas: 20260616130000_suppliers_owner_actor_id.sql,
           20260616210000_create_actor_capability_grants.sql,
           20260616220000_rename_service_payment_amount_to_amount_cents.sql,
           20260616230000_align_service_money_nomenclature_07.sql,
           20260617120000_actor_referral_codes_and_actor_links.sql.

Migrations banco:
  Não consultado. A reunião usou prova de disco + gate de numeração.

Arquivos críticos lidos:
  C:/unificard/reuniao.md
  C:/unificard/STATUS_EXECUCAO_GLOBAL.md
  C:/unificard/REMEDIATION_DT_LOG.md
  C:/unificard/REMEDIATION_DECISIONS_LOG.md
  C:/unificard/backend/package.json
  C:/unificard/backend/BOOT.ts
  C:/unificard/backend/src/app.builder.ts
  C:/unificard/frontend/src/App.tsx
  C:/unificard/frontend/src/config/actorContextConfig.ts
  C:/unificard/frontend/src/api/social.ts
  C:/unificard/frontend/src/api/social-2.0.ts
  C:/unificard/docs/03_execution_log/20260618_F_AUTHORITY_Z2_R7A_EVENT_RFQ_ACTOR_BINDING.md
  C:/unificard/docs/03_execution_log/20260617_F_REFERRAL_REGISTER_ACTOR_CODE_GATE.md
  C:/unificard/docs/03_execution_log/20260617_F_AUTHORITY_Z2_R6_2_SOCIAL_POSTS_ACTOR_BINDING.md

Gates executados, se algum:
  Comando:
    pnpm --dir C:/unificard/backend run check:migrations
  Resultado:
    PASSOU. Total de migrations: 394. Numeração única OK. Sufixos válidos OK.
  Data/hora:
    2026-06-17 23:55 -03:00
  HEAD:
    ca3c99a669fd62638286d382a81875f86313770f
  Alterou algo?
    Não observado.

Observações:
  backend/BOOT.ts é entrypoint único e delega build para src/app.builder.ts.
  app.builder.ts registra uma superfície protegida grande: auth/tenant/action-context/rbac e muitos módulos de domínio.
  Runtime atual não é Kernel mínimo; ele carrega camadas maduras, camadas recém-seladas e módulos/rotas com resíduos, ghosts ou decisões pendentes.
  Frontend expõe muitas rotas reais em App.tsx e mantém algumas rotas comentadas/redirects para evitar fantasmas.
```

```text
CORROBORAÇÃO INDEPENDENTE — 2ª IA-Repo (gates de authority EXECUTADOS ao vivo, não só citados do STATUS).
Coleta 2026-06-17, HEAD ca3c99a6, branch rescue-structural. Nenhum git add/commit; git inalterado.

Gates de selo rodados diretamente (auditores READ-ONLY, exit 0):
  node scripts/audit-event-rfq-actor-binding.mjs           -> GATE OK [event-rfq-actor-binding]
  node scripts/audit-referral-register-actor-code-gate.mjs -> GATE OK [referral-register-actor-code-gate]
  node scripts/audit-actor-referral-actor-scoped.mjs       -> GATE OK [actor-referral-actor-scoped]
  node scripts/audit-social-posts-actor-binding.mjs        -> GATE OK [social-posts-actor-binding]
  node scripts/audit-bank-ledger-boundaries.mjs            -> GATE OK [bank-ledger §4.6]
  node scripts/check-migration-numbering.js                -> PASSOU (394 migrations, numeração única)
  >> Os 3 selos da §3 (R7a, referral, social) e o SSOT bank_ledger PASSAM no repo VIVO,
     não apenas no documento congelado. Prova material, não citação.

Prova direta de R7b (acceptQuote) OPEN — leitura de código vivo:
  backend/src/modules/events/event-rfq.routes.ts, POST .../quotes/:quoteId/accept (linhas 468-499):
    - linha 477: checa apenas PRESENÇA de actionContext.actorId (400 se ausente);
    - linha 489: passa actionContext.actorId DIRETO como ator comprador ao service;
    - NÃO há chamada a canRepresentActor antes do sink.
  >> Confirma materialmente: R7b usa actorId declarado como AUTORIDADE, violando o invariante
     "actorId é hint, não autoridade". OPEN / money-adjacent (cria booking + payment_request pending).

Prova direta da DT-mãe 0113 OPEN — REMEDIATION_DT_LOG.md (entrada R7a, topo):
  "O parent canal-1 DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE e a DT-mãe
   DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED permanecem OPEN."
  >> Os selos locais NÃO fecham 0113. Confirmado no log canônico, não inferido.

DIVERGÊNCIA (frozen × vivo):
  Fonte congelada afirmou:
    MEMORY.md (auto-memória do agente) aponta "HEAD vivo 20fe30cc / dev 385".
  Repo vivo mostra:
    HEAD ca3c99a6, 394 migrations (mais recente 20260617120000).
  Evidência:
    git rev-parse HEAD + check:migrations.
  Veredito provisório:
    Memória congelada está ATRÁS do repo vivo; usar repo vivo como verdade. Sem ação.
  Decisão necessária:
    Nenhuma para a reunião; apenas não tratar MEMORY.md como estado vivo.

Prova direta das COLISÕES DE BOOT (lidas em app.builder.ts, reforça tese Kernel×Quarentena da §6):
  - /api/events recebe TRÊS registros: eventLifecycleRoutes (l.496) + eventsModule (l.~549)
    + eventModule (l.~550). Comentário no próprio arquivo nota o conflito.
  - unifybankModule registrado em /bank E em /admin (l.502-503).
  - fundModule com comentário "LEGACY: core/economy/fund desabilitado conforme
    SSOT_EXCLUSIVE_BANK_RULE.md" mas REGISTRADO logo abaixo (não desabilitado de fato).
  >> Sintoma material de "runtime carrega várias épocas": registro duplo/legado-ligado é
     superfície maior que o Kernel. Candidatos diretos a inventário de desregistro (estratégia C),
     SEM patch nesta reunião.

Migrations banco: NÃO consultado (sem credencial Postgres na sessão: "SASL: client password
  must be a string"). Não forcei conexão. Divergência disco×banco fica em aberto para quem
  tiver acesso de leitura ao banco.
```

```text
TIER 0 — PROVA VIVA (2ª IA-Repo, resposta direta a "Quais itens entram no TIER 0 com prova viva?").
HEAD ca3c99a6, 2026-06-18. READ-ONLY. PROVADO = li/rodei; BLOQUEADO = exige banco (sem credencial).

[T0.1] Migrations disco × banco .......... PARCIAL.
  PROVADO: disco = 394 (check:migrations PASSOU, numeração única).
  BLOQUEADO: contagem/última do banco (schema_migrations) — sem credencial Postgres.
  >> Item legítimo do TIER 0, mas precisa de IA-Repo com leitura ao banco. Não inventar.

[T0.2] SELECT read-only schema_migrations .. BLOQUEADO (mesma causa). Fica para quem tiver DB.

[T0.3] to_regclass dos candidatos ghost ... BLOQUEADO no banco; PARCIAL no código:
  ghosts já contidos por gate no repo: contacts-schema, contextual-thread-schema,
  organization-schema (audit-*-ghost-containment.mjs presentes em validate:regression-guards).
  Confirmar existência REAL das tabelas exige to_regclass no banco vivo.

[T0.4] fundModule ......................... PROVADO = NO-OP DE RUNTIME (não é risco financeiro).
  app.builder.ts l.313 destrutura { fundModule }, na MESMA posição (índice 8) do Promise.all,
  mapeado para l.365 `Promise.resolve({ fundModule: async () => {} })`.
  O import real `./core/economy/fund/fund.module` está COMENTADO (l.364).
  l.429 `register(fundModule, { prefix: '/fund' })` registra um plugin VAZIO → /fund tem ZERO rotas.
  >> CORREÇÃO MATERIAL DE PRIORIDADE: /fund NÃO escreve dinheiro e não expõe nada. O risco do
     fundo regional / tese econômica NÃO está em fundModule — está nos WORKERS de treasury/governança
     (ver T0.7) e em src/core/unifybank/regional-fund-governance.* + src/modules/marketplace/regional-fund.*.

[T0.5] Colisões de boot ................... PROVADO (app.builder.ts, linhas exatas):
  - /api/events recebe TRÊS registros: eventLifecycleRoutes (l.496) + eventsModule (l.549)
    + eventModule (l.550). Comentários l.492-494 e l.547 reconhecem o conflito.
  - unifybankModule registrado DUAS vezes: /bank (l.502) E /admin (l.503).
  - categoryReviewModule também em /admin (l.504) — /admin acumula superfícies distintas.
  - /fund (l.429) = plugin vazio (ver T0.4).
  >> Candidatos diretos de inventário/desregistro (TIER 2). Sem patch nesta reunião.

[T0.6] R7b acceptQuote .................... PROVADO = OPEN, money-adjacent, sem canRepresentActor.
  event-rfq.routes.ts POST .../quotes/:quoteId/accept (l.468-499): l.477 só checa PRESENÇA de
  actionContext.actorId; l.489 passa actionContext.actorId DIRETO como ator comprador; NÃO chama
  canRepresentActor. Service cria booking + payment_request pending (money-adjacent).
  >> Buraco real de authority, não faxina. Frente própria (Nível 3 — money). Prioridade.

[T0.7] Workers + /internal financeiro ..... PROVADO (BOOT.ts) — achado mais importante do TIER 0:
  DEFAULT-OFF (gated isFinancialWorkerEnabled('ENABLE_*'), executores de dinheiro selados):
    - Payout Worker (ENABLE_PAYOUT_WORKER)        — OFF  [DECISION-0128, system-only seal]
    - Reversal Worker (ENABLE_REVERSAL_WORKER)    — OFF  [dispute/reversal contido]
    - Bank Settlement Worker (ENABLE_BANK_SETTLEMENT_WORKER) — OFF [Core EXECUTION HOLD]
  INICIAM POR PADRÃO NO BOOT (SEM gate ENABLE), money/estado-adjacentes:
    - Settlement Worker (escrowed→seller_pending, 10s)  — move ESTADO de PaymentIntent
    - Release Worker (settled→seller_available, 10s)    — move ESTADO de PaymentIntent
    - Treasury Split Engine (settlements → regional_fund, community_fund) — TRILHO DO FUNDO REGIONAL
    - Governance Funding Worker (community_project_funding → PaymentIntent) — money
    - Governance Funding Commitment Worker (treasury→escrow→PaymentIntent) — move fundos
    - Treasury Distribution Worker (→ governance_financial_actions)
    - Governance Financial Action Worker (ações financeiras via PaymentIntent) — money
    - Governance Execution Worker (executa propostas aprovadas)
    - + reconciliation/alert/metrics/risk/sla/ledger-snapshot (observabilidade, baixo risco)
  >> DIVERGÊNCIA MATERIAL com a percepção "executores de dinheiro estão default-off": a EXECUÇÃO
     terminal (payout/reversal/bank-settlement) está contida, MAS a TUBULAÇÃO que cria PaymentIntents
     e alimenta o fundo (treasury-split / governance-funding*) sobe por DEFAULT no boot, sem ENABLE.
     Em DB virgem as filas estão vazias, então não move nada HOJE — mas ligaria sozinha assim que
     houvesse dado. Entra no TIER 0 como superfície financeira viva a classificar (Nível 3).
  /internal financeiro (app.builder.ts l.170-184): financialSimulator/Dashboard/OperationsPanel/
     AuditExport/Dispute/Freeze/governanceProposal/treasuryAccount controllers, prefixo /internal,
     registrados FORA do protectedScope. Observabilidade útil vs superfície de operação financeira:
     separar antes de decidir Kernel.

RESUMO TIER 0 (2ª IA-Repo): PROVADOS no código = T0.4, T0.5, T0.6, T0.7. PARCIAL = T0.1, T0.3.
  BLOQUEADO (precisa IA-Repo com banco) = T0.2 e a metade-banco de T0.1/T0.3.
  Pergunta devolvida à mesa: quem tem leitura ao Postgres fecha T0.1/T0.2/T0.3; o restante do
  TIER 0 já está provado e pode subir para a decisão de Kernel (TIER 1) de Clayton.
```

```text
T0.7 — PROVA APROFUNDADA (rodada de prova viva ordenada pela IA Diretora 2026-06-18).
Régua aplicada: FATO PROVADO vs HIPÓTESE CRÍTICA vs DECISÃO. Lidos os FONTES dos workers, não só BOOT.ts.
Pergunta da Diretora respondida: "Quais workers iniciam sem ENABLE_*? Chamam bank_ledger /
bankTransactionService / PaymentIntent / treasury / governance funding / settlement?"

=== FATO PROVADO (Evidence Pack: PROVA) ===
[F1] Existe um gate ENABLE_* real e ele cobre SÓ os 3 executores terminais.
  BOOT.ts: payout/reversal/bank-settlement envolvidos em isFinancialWorkerEnabled('ENABLE_*').
  Os demais workers NÃO têm esse gate. O único `if (intervalId !== null) return;` neles é
  guarda de REENTRÂNCIA (singleton de setInterval), NÃO dormência financeira. Confirmado lendo
  cada arquivo: nenhum isFinancialWorkerEnabled/ENABLE_/process.env de dormência nos pipeline.

[F2] Os workers default-on TOCAM trilho financeiro (não são só metadados):
  - governance-funding-commitment-worker.ts:
      l.13 import { bankTransactionService } from '@modules/bank/bank-transaction.service'
      l.11 getTreasuryAccount; l.16 createPaymentIntent.
      Faz "lock treasury → valida saldo → treasury→escrow transfer → PaymentIntent" (atômico).
      >> USA bankTransactionService DIRETO. Move fundos. SEM ENABLE.
  - settlement-worker.ts: settleEscrowedPaymentIntent (escrow → seller_pending). Move ESTADO
      de PaymentIntent. SEM ENABLE.
  - release-worker.ts: releaseSettledPaymentIntent (seller_pending → seller_available). SEM ENABLE.
  - treasury-split-worker.ts: executeSplit (settlements → regional_fund/community_fund). Header diz
      "não escreve bank_ledger diretamente", mas roteia split do fundo. SEM ENABLE.
  - governance-funding-worker.ts / governance-financial-action-worker.ts: createPaymentIntent. SEM ENABLE.
  - treasury-distribution-worker.ts: cria governance_financial_actions (alimenta o action-worker). SEM ENABLE.
  - governance-execution-worker.ts: cria treasury_distribution / governance_funding a partir de
      propostas aprovadas (regional_fund_distribution, community_project_funding). SEM ENABLE.
  >> A TUBULAÇÃO governança→treasury→PaymentIntent→split sobe inteira no boot, sem flag.

=== O QUE NÃO É FATO (corrige meu próprio T0.7 anterior; honestidade) ===
[N1] "Move dinheiro HOJE" = FALSO. Todos consomem FILAS (claimNext*/status='pending').
  Em DB virgem as filas estão vazias → os workers giram em vazio e não movem nada agora.
  >> O firewall que segura o dinheiro HOJE é o ESTADO DE DADOS VAZIO, não um ENABLE_*.

=== VEREDITO (na régua da Diretora) ===
T0.7 deixa de ser "hipótese live-only" e passa a:
  FATO PROVADO / RISCO CRÍTICO DE FIREWALL.
  O fato provado é a AUSÊNCIA de gate explícito sobre uma tubulação que comprovadamente usa
  bankTransactionService/PaymentIntent/treasury/split. A criticidade é de FIREWALL: a contenção
  depende de fila vazia, não de decisão declarada. Assim que existir um row pending (proposta de
  governança aprovada, settlement, commitment), a tubulação executa sozinha.
  Isso NÃO rebaixa R7b: R7b (P1) é buraco de AUTHORITY já provado; T0.7 é fragilidade de
  CONTENÇÃO/firewall. São dois problemas distintos, ambos reais, nenhum mascara o outro.

=== Evidence Pack classificação por item ===
  T0.7 (workers default-on sem ENABLE + tocam trilho)  -> PROVA (FATO PROVADO / risco firewall)
  T0.1/T0.2/T0.3 (migrations banco, schema_migrations, to_regclass) -> GATE-CHECK PENDENTE (precisa Postgres)
  T0.4 (fundModule /fund no-op)                          -> DESCARTE técnico (fundo regional = DECISÃO PENDENTE de produto)
  T0.5 (colisões de boot)                                -> PROVA (alvo de TIER 2 desregistro)
  T0.6 (R7b acceptQuote)                                 -> PROVA (risco vivo de authority; P1)

=== NÃO EXECUTAR (esta reunião) ===
  Não adicionar ENABLE_* aos workers, não desregistrar, não tocar BOOT.ts. Só registrei prova.
  A decisão de pôr gate / mover para Quarentena é de Clayton (TIER 1/TIER 2), não da executora aqui.
```

```text
VISÃO DO TODO — PROVA DA TESE "POLÍTICA DE ATIVAÇÃO RUNTIME" (2ª IA-Repo, a pedido da IA Diretora 2026-06-18).
A Diretora afirmou: "o runtime está vivo por herança, não por política explícita de ativação."
Fui ao código testar se existe uma camada central de ativação. RESULTADO: a tese se sustenta, com correção
de precisão — NÃO é ausência total; é uma governança de ativação FRAGMENTADA que cobre o MENU, não o RUNTIME.

PROVA (Evidence Pack: PROVA):
[A] Existe registro governado — mas só do MENU, não do boot.
    src/core/navigation/module-registry.ts (DECISION-0117 F): MODULE_REGISTRY com status LIVE/STUB/TOMBSTONE.
    Consumido APENAS por module-projection.routes.ts (GET /navigation/modules) para o frontend.
    O próprio cabeçalho diz: "O menu NÃO concede autoridade — toda rota revalida no backend."
    >> Governa o que o usuário VÊ, não o que o servidor REGISTRA/RODA.

[B] Há feature-flags, mas o boot quase não os consulta.
    src/app.builder.ts l.532-533: featureFlagsService consultado para EXATAMENTE 1 módulo
    (isProcurementCampaignEnabled). Nenhum outro dos ~70 registros de rota passa por flag.

[C] As feature-flags são fail-OPEN (default ligado).
    src/core/features/feature-flags.ts: isFeatureEnabled() — "Se não definido, usar padrão (habilitado)".
    Cobre só 4 features (RFQ/BUNDLES/FINANCIAL/MESSAGING) em nível de service, não de boot.

[D] Os ENABLE_* reais estão espalhados, sem manifesto central.
    financial-worker-gate.ts (3 workers terminais) + env-validation (MARKETPLACE_SEED/PAYMENTS/WEBSOCKET)
    + staging.config (PROCUREMENT) + publication (INVITATIONS). Cada um lê process.env por conta própria.

[E] Logo, a MAIORIA da superfície sobe por código direto, sem decisão de ativação:
    ~70 módulos de rota em app.builder.ts e ~17 workers de pipeline em BOOT.ts NÃO passam por
    [A], [B], [C] nem [D]. São register()/start() hardcoded — "vivos por herança".

SÍNTESE DO TODO (conecta os sintomas num só diagnóstico):
  R7b        = buraco de AUTHORIDADE (rota acionável confia em actorId declarado).
  Workers    = buraco de ATIVAÇÃO FINANCEIRA (pipeline default-on, firewall = fila vazia).
  Ghosts     = buraco de SCHEMA (tabela some, código persiste contido por gate).
  Boot/colisão = buraco de SUPERFÍCIE (registro duplo/legado-ligado).
  Frontend   = buraco de PROMESSA (menu/ambição × backend real).
  >> RAIZ COMUM PROVADA: não há um PONTO ÚNICO que decida "isto fica vivo". A ativação é
     herdada (boot direto), fragmentada (4 mecanismos distintos) e fail-open (default ligado).
     "Kernel + Quarentena" é a resposta de produto/operacional; "Política de Ativação Runtime"
     é a resposta SISTÊMICA que impede o problema de voltar. A IA-Repo CONFIRMA materialmente a
     leitura da Diretora.

OBSERVAÇÃO IA-Repo (discordância leve / nuance que AFINA a direção, não contradiz):
  A frase "ausência de política de ativação" NÃO é 100% literal. Existe governança — module-registry
  (DECISION-0117 F) + feature-flags — só que mira o MENU e é fail-open. Isso, na prática, FORTALECE a
  direção: a "Política de Ativação Runtime" NÃO nasce do zero — ela ESTENDE um registry que JÁ EXISTE,
  do menu para o boot/worker (status LIVE/STUB/TOMBSTONE já é o vocabulário certo).
  >> Consequência prática para D1: o custo de promulgar a política é MENOR do que parece — é estender
     uma estrutura canônica existente, não criar uma nova camada. Caminho de implementação mais barato
     quando virar frente. (Insumo para Clayton; NÃO é decisão nem GO.)

NÃO EXECUTAR: nenhuma flag/registry/gate novo criado aqui. Só prova. A política é DECISION de Clayton.
```

---

## 3. O que está sólido e NÃO deve regredir

```text
- bank_ledger como única verdade de saldo
  Confirmado por DECISION-0024 em REMEDIATION_DECISIONS_LOG.md e por gates recentes de bank-ledger-boundaries em STATUS_EXECUCAO_GLOBAL.md.
- actorId do cliente como hint, não autoridade
  Confirmado por STATUS_EXECUCAO_GLOBAL.md nas frentes R6.1, R6.2, referral e R7a.
- req.user.userId como subject soberano
  Confirmado em R7a W1-W5, social posts e services actor binding.
- canRepresentActor como prova de representação
  Confirmado como gate material nas frentes de authority recentes.
- CONCEPT como fonte de significado
  Confirmado em REMEDIATION_DECISIONS_LOG.md como SSOT semântico; frontend não cria CONCEPT.
- 07_NOMENCLATURA_CANONICA como trava de linguagem
  Confirmado em STATUS_EXECUCAO_GLOBAL.md R7a e em docs/CORE_DOCUMENTS.md.
- R7a W1-W5 selado, se confirmado no repo vivo
  Confirmado: STATUS_EXECUCAO_GLOBAL.md 2026-06-18 = CLOSED / YALA PASS MATERIAL; W6 acceptQuote fora do escopo.
- referral actor-scoped selado, se confirmado no repo vivo
  Confirmado: F-REFERRAL-REGISTER-ACTOR-CODE-GATE = CLOSED / YALA PASS MATERIAL; migration 20260617120000 presente.
- social posts actor binding selado, se confirmado no repo vivo
  Confirmado: F-AUTHORITY-Z2-R6.2-SOCIAL-POSTS-ACTOR-BINDING = CLOSED / YALA PASS MATERIAL.

Não deve regredir também:
- services actor binding R6.1 CLOSED / YALA PASS MATERIAL.
- groups/dashboard/reports/intent-execute/money-latent containments CLOSED / YALA PASS MATERIAL, sem fechar Z2 inteiro.
- DT mãe 0113 permanece OPEN; não usar os selos locais como desculpa para fechar authority global.
- R7b acceptQuote permanece OPEN / DECISÃO PENDENTE; não deve ser tratado como corrigido por R7a.
```

---

## 4. Problema central discutido

```text
O banco teve Genesis.
O backend ainda carrega lógica de várias épocas.
Parte do código pode ser boa, mas desconectada do schema vivo.
Parte pode ser legado perigoso.
Parte pode estar pronta para reacoplar.
Parte deve sair do runtime.

O retrabalho atual vem de tratar tudo que existe como se fosse produto vivo.
```

---

## 5. Hipótese estratégica principal

```text
Criar um Kernel MVP vivo e colocar o restante em Quarentena.

Kernel:
  pequeno, provado, exposto, com schema/authority/gates/E2E.

Quarentena:
  código ou módulo que pode ser útil, mas não deve ficar vivo no runtime até provar fundação.

Promoção:
  só volta ao Kernel se provar CONCEPT, actor, authority, estado, schema, E2E, guard e frontend honesto.
```

---

## 6. Matriz de classificação

| Item / módulo / rota | Estado vivo | Classificação proposta | Motivo | Risco | Próxima ação sugerida |
| -------------------- | ----------- | ---------------------- | ------ | ----- | --------------------- |
| BOOT.ts + app.builder.ts | vivo | PRESERVAR com poda futura | entrypoint único, buildApp provado | runtime amplo demais mascara Kernel | manter; futura DECISION para lista Kernel |
| auth / health / tenant / action-context / rbac plugin | vivo | PRESERVAR | base de autenticação, tenancy e contexto | rbac não pode substituir canRepresentActor antes de 0113 fechar | não mexer sem frente própria |
| bank_ledger / bank core / bank boundaries | vivo | NÃO MEXER | SSOT financeiro único, gates recentes verdes | regressão financeira sistêmica | só tocar com GO financeiro e gates completos |
| canRepresentActor / authorization.service | vivo | NÃO MEXER | prova de representação usada nas frentes seladas | mudar sem E2E reabre spoof cross-actor | apenas frente dedicada |
| R7a event-rfq W1-W5 | vivo/selado | PRESERVAR | CLOSED / YALA PASS MATERIAL; E2E 20/20 registrado | W6 no mesmo arquivo segue aberto | preservar selo; não remover baseline de W6 |
| R7b acceptQuote / eventRFQService.acceptQuote | vivo/parcial | DECISÃO CLAYTON + REACOPLAR | money-adjacent, cria booking/payment_request pending; OPEN | criar tabela/gate errado ressuscita obrigação financeira ruim | frente própria antes de qualquer patch |
| referral actor-scoped entrada de cadastro | vivo/selado | PRESERVAR | CLOSED / YALA PASS MATERIAL; actor_referral_codes em migration | economia/split de referral fora do escopo | preservar; novas mudanças só com money authority |
| social posts POST /social/posts | vivo/selado | PRESERVAR | actor binding CLOSED / YALA PASS MATERIAL | rota legada /social/posts/create segue resíduo | preservar gate atual |
| /social/posts/create legado | dead-at-db / ungated | QUARENTENAR | registrado como carry-over; não cria post no schema canônico | se tabela/compat voltar, vira bypass | desregistrar/contener em futura frente; sem patch agora |
| services POST/PUT /services | vivo/selado | PRESERVAR | R6.1 CLOSED / YALA PASS MATERIAL | service tem callers internos; gate errado quebraria fluxos | preservar boundary atual |
| feed-action R6.3 | parcial/pendente | REACOPLAR | citado como continuidade recorrente | action/actor binding incompleto | frente específica depois do Kernel |
| marketplace protegido amplo | vivo/amplo | QUARENTENAR parcialmente | app.builder registra muitas rotas e subrotas de épocas diferentes | superfície operacional maior que MVP | classificar por submódulo antes de bootar no Kernel |
| marketplace stubs vazios | vivo no registro, implementação vazia | DELETAR DEPOIS ou QUARENTENAR | vários registerMarketplace*Routes exportam função vazia | ruído de produto vivo falso | inventário e decisão futura |
| PDV | vivo | PRESERVAR ou QUARENTENAR parcial | registrado em /pdv; há frente Batch-7 implemented/hold reseal | se não estiver selado final, pode inflar Kernel | confirmar reseal antes de Kernel |
| contacts / CRM | vivo/parcial | DECISÃO CLAYTON | memória registra tenant-only PII e decisão pendente sobre tenant 1:1 vs multiempresa | leak se multiempresa | decisão de produto/authority antes de promover |
| suppliers / purchase-orders | vivo/parcial | REACOPLAR | owner_actor_id apareceu em migration recente, mas memória indica sequência por GO | backfill/owner errado cria autoridade falsa | seguir sequência própria; não misturar com reunião |
| votes | contido/ghost | QUARENTENAR | writes fail-closed; reads quebrados por schema ghost; DTs raiz OPEN | criar tabela ressuscita módulo sem eligibility | manter fora do Kernel até decisão |
| venue public/menu | frontend comentado; backend público existe | QUARENTENAR | App.tsx comenta rotas por DT-MODULE-VENUE-FANTASMA; backend registra venue public | tabela ghost pode virar produto falso | não expor no frontend; avaliar boot |
| organization routes | backend vivo; frontend comentado | QUARENTENAR | App.tsx comenta organização; backend registra /organization | runtime maior que exposição honesta | desregistrar ou manter invisível até fundação |
| payouts / invoices / risk/policy dashboards | backend vivo; frontend muitas rotas comentadas | QUARENTENAR | módulos existem, UI não expõe integralmente | financial/admin surface sem Kernel claro | só promover por fluxo E2E |
| financial/internal observability | vivo público no app antes do protected scope com prefixo /internal | DECISÃO CLAYTON | ferramenta útil de operação | superfície interna precisa política clara | decidir se entra Kernel operador ou fica off |
| workers default-off payout/reversal/bank-settlement | código vivo, execução condicionada | PRESERVAR CONTIDO | BOOT usa ENABLE_* estrito | ligar sem decisão move dinheiro | manter default-off |
| workers financeiros/governança iniciados por padrão | vivo | DECISÃO CLAYTON | BOOT inicia múltiplos workers além do MVP | side effects de runtime se schema/filas incompletos | avaliar para Kernel: quais ficam ligados |
| frontend App.tsx rotas essenciais home/perfil/empresas/social/serviços/banco | expostas | PRESERVAR parcial | rotas reais e protegidas | algumas dependem de módulos amplos | Kernel frontend honesto por fluxo |
| frontend rotas comentadas/redirects | não expostas | PRESERVAR COMO CONTENÇÃO | evita fantasma visível | reexpor sem backend/schema reabre retrabalho | manter comentários/redirects até GO |
| actorContextConfig com ações para /em-desenvolvimento | exposto como intenção | QUARENTENAR UI | reconhece ambição sem prometer runtime | pode virar menu inchado se tratado como produto pronto | separar descoberta/ambição de Kernel |

Classificações permitidas:

```text
PRESERVAR:
  sólido, canônico, necessário ao Kernel.

QUARENTENAR:
  promissor, mas não deve ficar vivo agora.

REACOPLAR:
  lógica útil, mas precisa schema/authority/gate antes de voltar.

DELETAR DEPOIS:
  peso morto confirmado, sem valor estratégico.

DECISÃO CLAYTON:
  depende de regra de produto/social/ambição.

NÃO MEXER:
  selado, sensível ou fora de escopo.
```

---

## 7. Perguntas que a reunião precisa responder

```text
1. Qual é o Kernel mínimo do MVP?
2. O que deve sair do runtime imediatamente?
3. O que pode ficar no código, mas não registrado no boot?
4. O que deve sumir do frontend?
5. Onde “só criar tabela” é correto?
6. Onde criar tabela ressuscitaria legado ruim?
7. O que é valor estratégico e deve ser reconstruído depois?
8. O que é peso morto mesmo?
9. Qual sequência reduz retrabalho?
10. Quais decisões cabem somente a Clayton?
```

---

## 8. Propostas das IAs

### IA-Repo-A

```text
Diagnóstico:
  O backend possui fundação canônica forte, mas o runtime atual é muito maior que um Kernel MVP.
  Há selos locais robustos (R6/R7a/referral/social/services), porém eles coexistem com módulos registrados
  que são parciais, ghosts, stubs, default-off ou dependentes de decisão Clayton.

Provas:
  HEAD ca3c99a669fd62638286d382a81875f86313770f em rescue-structural.
  app.builder.ts registra dezenas de módulos protegidos e públicos.
  check:migrations PASSOU com 394 migrations.
  STATUS_EXECUCAO_GLOBAL.md confirma R7a W1-W5, referral e social posts como CLOSED / YALA PASS MATERIAL.
  O mesmo status confirma DT mãe 0113 OPEN e R7b acceptQuote OPEN / DECISÃO PENDENTE.

Recomendação:
  Adotar B + C como estratégia: definir Kernel MVP e desregistrar do runtime o que não pertence ao Kernel.
  Não mover/deletar ainda. Primeiro inventário por rota/módulo com prova: schema, authority, estado, E2E, guard e frontend.
  Quarentena deve preservar aprendizado: por que saiu, risco reduzido, condição de volta e gates futuros.

Riscos:
  Tratar módulo registrado como produto vivo aumenta retrabalho.
  Criar apenas tabela para ghost pode ressuscitar legado sem authority.
  Fechar 0113 por inferência dos selos locais seria erro.
  Ligar workers financeiros default-off sem decisão pode mover dinheiro fora do Kernel.

Não executar ainda:
  Não editar código, boot, migrations ou frontend nesta reunião.
  Não fechar DT/DECISION.
  Não tocar acceptQuote/R7b.
  Não deletar stubs/legados agora.
```

### IA-Repo-B

```text
Diagnóstico:
  O frontend expõe uma mistura de fluxo real, ambição controlada e contenções.
  App.tsx tem rotas protegidas para social, grupos, serviços, agenda, empresas, marketplace, PDV, CRM,
  service-orders, banco e admin; também mantém rotas comentadas para votes, venue, organization,
  subscriptions, payouts, invoices, risk e policy.

Provas:
  frontend/src/App.tsx lido: rotas públicas /, /login, /register, /pay/:slug, /share/* e marketplace.
  Rotas protegidas incluem /home, /social, /servicos, /eventos, /perfil, /empresas, /banco, /pdv,
  /contacts, /crm, /service-orders, /services e admin.
  App.tsx comenta explicitamente venue por DT-MODULE-VENUE-FANTASMA.
  frontend/src/config/actorContextConfig.ts direciona várias ações para /em-desenvolvimento?feature=...
  frontend/src/api/social.ts lança NOT_IMPLEMENTED para social-ledger legado e aponta para Bank statement.

Recomendação:
  Fazer Kernel frontend honesto: manter só telas cujo backend/schema/authority estejam provados.
  Menus de ambição podem existir como "em desenvolvimento", mas não devem parecer produto vivo.
  Rotas comentadas devem permanecer fora até prova de backend e decisão de produto.

Riscos:
  UI expor módulo parcial força remediação reativa.
  Rotas backend vivas mas UI oculta podem continuar carregando risco operacional se registradas no boot.
  Frontend que passa actorId deve ser tratado como declaração/hint; autoridade fica server-side.

Não executar ainda:
  Não remover rotas.
  Não alterar menus.
  Não trocar copy.
  Registrar recomendações na ata e aguardar decisão.
```

### IA-Freeze-A

```text
Diagnóstico:
Provas usadas:
Recomendação:
Riscos:
Não executar ainda:
```

### IA-Freeze-B

```text
Diagnóstico:
Provas usadas:
Recomendação:
Riscos:
Não executar ainda:
```

### IA-Codex — Auditoria estratégica sobre a ata

```text
Natureza:
  Opinião/auditoria estratégica registrada a pedido de Clayton.
  Não é DECISION.
  Não é GO.
  Não autoriza patch fora desta ata.

Provas usadas:
  reuniao.md lido antes da opinião.
  2.txt lido como consolidação estratégica externa.
  docs/01_normative/07_NOMENCLATURA_CANONICA.md consultado para fronteira semântica,
  actorId, Bank/ledger e gates financeiros.

Diagnóstico:
  A direção da reunião está correta: o problema não é "recomeçar o Unificard", e sim
  recomeçar a superfície viva do Unificard.

  O runtime está maior que o produto validado.
  O repo já contém fundação sólida, mas também carrega boot amplo, colisões, workers,
  rotas internas e módulos parcialmente vivos que podem forçar retrabalho se forem tratados
  como produto pronto.

  A ata já corrigiu um ponto importante: não declarar convergência das 4 IAs enquanto
  IA-Freeze-A e IA-Freeze-B seguem pendentes. O correto, por enquanto, é "convergência IA-Repo".

Prioridades:
  P0 — Manter NÃO-GO:
    A reunião segue read-only. Nada de código, boot, migration, frontend, STATUS, DT,
    DECISION ou memória fora desta ata.

  P1 — Fechar TIER 0 banco vivo:
    migrations disco = 394 está provado, mas falta banco.
    Próxima IA com acesso ao Postgres deve provar schema_migrations e to_regclass dos
    candidatos ghost/parcial. Sem isso, parte da decisão Kernel ainda fica cega.

  P2 — Tratar R7b acceptQuote como frente prioritária de alto risco:
    R7a W1-W5 está selado, mas W6 acceptQuote permanece OPEN.
    Como usa actionContext.actorId sem canRepresentActor e é money-adjacent, não é faxina.
    É fronteira de authority/dinheiro e precisa frente própria Nível 3.

  P3 — Classificar workers financeiros/governança que sobem por padrão:
    Payout/Reversal/Bank Settlement estão default-off, mas treasury/governance/funding
    e transições de PaymentIntent sobem por default segundo a ata.
    Mesmo com DB virgem, isso é superfície financeira viva e precisa decisão de Kernel.

  P4 — Separar /internal financeiro:
    Observabilidade financeira pode ser útil, mas controllers financeiros registrados fora
    do protectedScope precisam classificação explícita: operador Kernel, quarentena ou gate.

  P5 — Inventariar colisões de boot antes de desregistrar:
    /api/events múltiplo, /bank + /admin para unifybankModule e /admin acumulado indicam
    runtime de várias épocas. Isso reforça estratégia C, mas ainda não autoriza patch.

  P6 — Confirmar fundModule como baixa prioridade imediata:
    A ata provou fundModule como plugin vazio/no-op em /fund.
    Portanto, a prioridade econômica não está nele, e sim nos workers/rotas de treasury,
    governance funding e regional fund.

  P7 — Preservar selos:
    bank_ledger SSOT, canRepresentActor, req.user.userId, R7a W1-W5, referral actor-scoped,
    social posts e services actor binding não devem ser reabertos por refactor de Kernel.

Leitura pela 07_NOMENCLATURA_CANONICA:
  "Kernel", "Quarentena" e "Êxodo Runtime" são bons nomes estratégicos de reunião,
  mas se virarem mecanismo oficial precisam de DECISION/RFC e glossário/processo próprio.
  Não devem nascer no código como semântica paralela.

  actorId continua nome canônico de identidade econômica, mas não prova autoridade.
  Autoridade operacional deve vir de subject soberano server-side + canRepresentActor
  ou gate equivalente decidido.

  Bank/ledger continuam fronteira financeira. Qualquer fluxo que cause efeito financeiro,
  PaymentIntent, split, ledger, funding ou estado financeiro deve entrar em régua de alto risco,
  com allowlist/gates proporcionais.

Recomendação:
  Consolidar a estratégia como:
    B) Kernel MVP + Quarentena;
    C) desregistro do runtime fora do Kernel, após DECISION;
    F) reacoplamento por valor, não por existência.

  A primeira execução futura não deve deletar nem mover arquivos.
  Deve reduzir superfície viva:
    desregistrar boot fora do Kernel;
    esconder frontend fora do Kernel;
    preservar código em quarentena com condição de volta.

Sequência sugerida:
  1. Fechar TIER 0 read-only com banco vivo.
  2. Clayton decide Kernel MVP.
  3. IA Diretora transforma decisão em prompt executor.
  4. Executora desregistra runtime fora do Kernel.
  5. Quarentena registra motivo, risco reduzido, valor preservado, condição de retorno e gates.
  6. Reacoplar só módulos com valor claro e prova proporcional ao risco.

Não executar ainda:
  Não tocar R7b antes de frente própria.
  Não ligar/desligar worker agora.
  Não mexer em BOOT.ts agora.
  Não limpar frontend agora.
  Não criar tabela para ghost agora.
  Não transformar "Kernel/Quarentena" em estrutura oficial sem DECISION.
```

### IA-Codex — Auditoria viva complementar 2026-06-18 00:39 -03:00

```text
Natureza:
  Colaboração adicional concentrada na ata.
  READ-ONLY.
  Sem código, sem migration, sem BOOT, sem frontend.

HEAD / branch:
  ca3c99a669fd62638286d382a81875f86313770f / rescue-structural.

Comandos/ações read-only:
  - Leitura de reuniao.md antes da opinião.
  - git rev-parse HEAD; git branch --show-current; git status --short.
  - Leitura de migrate.ts e migration-runner-core para confirmar tabela de controle.
  - SELECT read-only via pg contra DATABASE_URL local, sem expor credenciais.
  - Leitura de event-rfq.routes.ts, event-rfq.service.ts e trecho de BOOT.ts.

Prova nova — T0.1/T0.2 banco vivo:
  Banco consultado:
    current_database = unificard_dev
    current_schema = public
  Disco:
    backend/migrations = 394 arquivos .sql.
  Banco:
    schema_migrations existe.
    schema_migrations count = 394.
    latest = 2026-06-17T11:18:52.468Z.
    últimas registradas:
      20260617120000_actor_referral_codes_and_actor_links.sql
      20260616230000_align_service_money_nomenclature_07.sql
      20260616220000_rename_service_payment_amount_to_amount_cents.sql
      20260616210000_create_actor_capability_grants.sql
      20260616130000_suppliers_owner_actor_id.sql
      20260616120100_availability_purpose_concept_id.sql
      20260616120000_seed_concepts_temporal_purpose.sql
      20260615210000_purchase_orders_owner_actor_id.sql
  Veredito:
    Para o banco local unificard_dev, migrations disco x banco fechou como ALINHADO: 394 x 394.
    Isso encerra o bloqueio T0.1/T0.2 neste ambiente local.
    Se Clayton quiser decisão sobre outro banco, repetir SELECT read-only no alvo correto.

Prova nova — T0.3 ghosts/to_regclass:
  Confirmados ausentes no banco local:
    contacts = false
    contextual_threads = false
    organization_members = false
    organization_invites = false
    organization_roles = false
    organization_units = false
    votes = false
  Confirmados presentes:
    actor_referral_codes = true
    bank_ledger = true
    payment_intents = true
    governance_funding_commitments = true
    treasury_distributions = true
    service_payment_requests = true
    service_payment_executions = true
    service_booking_decisions = true
    events = true
  Veredito:
    contacts, contextual_threads, organization_* e votes são ghosts reais no banco local.
    Criar tabela para eles sem owner/authority/gate seria ressuscitar legado, não reacoplar produto.

Correção importante — RFQ:
  to_regclass('event_rfqs') = false NÃO é, por si só, ghost.
  Prova em event-rfq.service.ts:
    RFQ vive em events.metadata.rfqs.
    Quotes vivem em metadata do RFQ.
  Portanto, a ausência de tabela event_rfqs não contradiz R7a/R7b.
  O risco de R7b é de authority + money-adjacent, não de tabela RFQ ausente.

Prova nova — R7b acceptQuote:
  event-rfq.routes.ts:
    POST /events/:eventId/rfqs/:rfqId/quotes/:quoteId/accept.
    linha 477 exige apenas presença de actionContext.actorId.
    linha 489 passa actionContext.actorId como organizerActorId.
    não há canRepresentActor antes do sink.
  event-rfq.service.ts:
    acceptQuote atualiza events.metadata.rfqs.
    cria availability.
    cria booking via unifiedAvailabilityService.
    cria service_booking_decision.
    cria service_payment_request pendente com:
      payerActorId = organizerActorId.
      receiverActorId = quote.providerActorId.
      amountCents = quote.priceCents.
  Banco local:
    service_payment_requests existe.
    service_payment_requests row_count = 0.
  Veredito:
    R7b é P1/P2 de alto risco: authority bug vivo em código, mas sem dado real hoje.
    Não é execução financeira terminal, porém materializa obrigação/pedido pendente se acionado.

Prova nova — tabelas financeiras/governança vivas e vazias:
  Presentes e row_count = 0:
    bank_ledger
    bank_transactions
    bank_splits
    payment_intents
    governance_financial_actions
    governance_funding_commitments
    treasury_distributions
    service_payment_requests
    service_payment_executions
  Veredito:
    O banco local está virgem nas tabelas de efeito financeiro consultadas.
    Isso reforça que agora é a janela barata para reduzir superfície viva antes de haver dado real.

Prova nova — workers:
  BOOT.ts confirma:
    ENABLE_PAYOUT_WORKER, ENABLE_REVERSAL_WORKER e ENABLE_BANK_SETTLEMENT_WORKER são default-off.
    governance execution, governance financial action, treasury distribution, treasury split,
    governance funding e governance funding commitment iniciam por padrão.
  Com row_count = 0 nas filas/tabelas consultadas, eles não movem nada agora.
  Mas a contenção depende de dado vazio, não de flag explícita.
  Veredito:
    T0.7 permanece FATO PROVADO / risco de firewall.
    Deve ser decisão de Kernel: default-on, default-off ou quarentena.

Prioridade revisada após auditoria:
  1. NÃO-GO continua.
  2. T0 banco local agora está fechado: disco 394 x banco 394.
  3. R7b acceptQuote é a primeira frente de bug de authority/money-adjacent.
  4. Workers/governança default-on são a primeira frente de firewall/runtime.
  5. Ghosts confirmados (contacts/contextual_threads/organization_*/votes) devem ficar fora do Kernel.
  6. fundModule continua baixa prioridade técnica: /fund é no-op; fundo regional vive noutros trilhos.
  7. Próxima decisão de Clayton deve separar duas perguntas:
     A) que fluxo de produto entra no Kernel?
     B) que superfície runtime sobe por default enquanto o produto ainda é virgem?

Não executar ainda:
  Não corrigir R7b nesta reunião.
  Não adicionar ENABLE_*.
  Não desregistrar workers.
  Não criar tabelas ghosts.
  Não alterar BOOT.ts.
  Não alterar App.tsx.
  Não promover Kernel/Quarentena a mecanismo oficial sem DECISION.
```

### IA-Codex — Auditoria de promessa visível × runtime 2026-06-18 01:08 -03:00

```text
Natureza:
  Colaboração adicional registrada a pedido de Clayton.
  Li reuniao.md antes de opinar.
  READ-ONLY.
  Sem código, sem migration, sem BOOT, sem frontend.

Foco:
  Auditar a tese "política de ativação runtime" pelo lado da PROMESSA VISÍVEL:
  o que o menu/app declara como vivo pode ser confundido com o que deve subir no runtime
  ou entrar no Kernel.

Provas read-only consultadas:
  backend/src/core/navigation/module-registry.ts.
  backend/src/core/navigation/module-projection.routes.ts.
  backend/src/core/config/feature-flags.service.ts.
  backend/src/core/features/feature-flags.ts.
  backend/src/core/unifybank/unifybank.module.ts.
  backend/src/modules/ledger/ledger.module.ts.
  frontend/src/App.tsx.
  frontend/src/config/appsRegistry.ts.
  frontend/src/components/social/SocialLedger.tsx.
  frontend/src/api/social.ts.
  frontend/src/components/RegionalFundUser.tsx.

Achado 1 — LIVE de menu não pode virar ativação runtime:
  MODULE_REGISTRY tem status LIVE/STUB/TOMBSTONE e é útil, mas hoje governa projeção de menu.
  module-projection.routes.ts projeta liveEntriesForContext('personal') diretamente para PF.
  Para empresa há filtros de membership, KYB e template; para PF, LIVE vira promessa visível.
  Veredito:
    Usar o status LIVE atual como fonte direta para boot/runtime seria perigoso.
    Ele mistura "pode aparecer" com "deve registrar rota", "deve iniciar worker" e
    "pertence ao Kernel".

Achado 2 — regional-fund já é promessa visível enquanto D4 segue indeciso:
  module-registry.ts marca regional-fund como LIVE em contexto pessoal, rota /fundo-regional.
  frontend/src/config/appsRegistry.ts marca regional-fund como ready, rota /fundo-regional.
  App.tsx registra /fundo-regional e /fund apontando para RegionalFundUser.
  RegionalFundUser chama getUserRegionalFund, que usa /bank/regional-fund.
  unifybankModule registra rotas de regional-fund-governance dentro do módulo Bank.
  Ao mesmo tempo, a §11 diz que D4 (Fundo regional entra no Kernel agora ou fica preparado/quarentenado)
  ainda NÃO foi decidido.
  Veredito:
    Isto é uma divergência de promessa: o produto já comunica "Fundo Regional pronto/vivo",
    mas a decisão estratégica de Kernel ainda está aberta.
    Não significa deletar o fundo regional. Significa que D4 precisa decidir também:
      - visibilidade frontend;
      - registro de rotas;
      - workers/splits;
      - governança;
      - transparência read-only.

Achado 3 — social-ledger é LIVE, mas o componente usa API legada extinta:
  module-registry.ts marca social-ledger como LIVE em /ledger.
  App.tsx registra /ledger para SocialLedger.
  SocialLedger importa getLedger/getLedgerSummary de frontend/src/api/social.ts.
  api/social.ts lança NOT_IMPLEMENTED para getLedger e getLedgerSummary, declarando social-ledger
  em regime de extinção e apontando para Bank statement.
  backend/src/modules/ledger/ledger.module.ts existe, mas o componente SocialLedger não usa
  frontend/src/api/ledger.ts.
  Veredito:
    social-ledger é uma promessa visível incoerente: aparece como LIVE, mas seu caminho de UI
    ainda chama API explicitamente extinta.
    Este é exemplo perfeito de por que "menu LIVE" não pode ser o mesmo que "Kernel".

Achado 4 — unifybankModule reforça necessidade de dimensão por prefixo/contexto:
  app.builder.ts registra unifybankModule em /bank e /admin.
  unifybankModule registra o mesmo conjunto interno de rotas sob o prefixo recebido:
    test-currency, P2P, donation, bank HTTP, transparency, transparency-admin,
    regional-fund-governance, user-group-allocation, métricas e finance consolidation.
  Veredito:
    Política de ativação não pode ser binária "módulo on/off".
    Ela precisa declarar prefixo/contexto permitido. Caso contrário, ligar Bank pode ligar junto
    superfície admin, governança, métricas e fundo regional por acoplamento de módulo.

Recomendação nova para D1:
  A DECISION de política de ativação deve separar, no mínimo, quatro dimensões:
    1. visibilityStatus: aparece no menu/app?
    2. routeStatus: registra rota no boot?
    3. workerStatus: inicia worker?
    4. kernelStatus: pertence ao Kernel deste ciclo?

  Opcional, mas recomendado:
    5. prefixScope/contextScope: onde pode subir? (/bank, /admin, /internal, PF, PJ, company)
    6. authorityTier/moneyTier: qual gate mínimo antes de promover?

  Regra curta:
    LIVE visual NÃO é GO runtime.
    READY no frontend NÃO é GO Kernel.
    Registrar rota NÃO é permissão de produto.
    Iniciar worker financeiro NÃO pode depender de fila vazia.

Prioridade ajustada:
  Além de R7b e workers, incluir "promessas visíveis incoerentes" no inventário TIER 1:
    - regional-fund: visível/ready, mas D4 aberto.
    - social-ledger: LIVE/rota real, mas API legada NOT_IMPLEMENTED.
    - unifybankModule: Bank/Admin acoplados por prefixo.

Não executar ainda:
  Não alterar MODULE_REGISTRY.
  Não alterar appsRegistry.
  Não remover rotas /fundo-regional, /fund ou /ledger.
  Não trocar SocialLedger para api/ledger nesta reunião.
  Não separar unifybankModule agora.
  Registrar apenas a divergência para a decisão de Clayton.
```

---

## 9. Convergências

```text
Convergência IA-Repo (IA-Repo-A + IA-Repo-B). Freeze A/B PENDENTES — não declarar "convergência das 4 IAs"
até as duas cadeiras Freeze preencherem suas respostas (correção ordenada por Clayton/IA Diretora 2026-06-18):
- A estratégia Kernel MVP + Quarentena reduz retrabalho melhor que continuar tratando todo código registrado como produto vivo.
- Quarentena não é cemitério: deve preservar aprendizado, motivo de saída e condição de retorno.
- Bank/ledger, actor authority, CONCEPT e 07_NOMENCLATURA são fundação e não devem regredir.
- Selos locais recentes são válidos, mas não fecham a DT mãe 0113.
- R7b acceptQuote é a principal fronteira pendente de event-rfq e não deve ser mascarada por R7a.
- "Só criar tabela" é perigoso quando o módulo depende de authority/owner/gate ainda não decidido.
```

---

## 10. Divergências

```text
Pontos em disputa:
- Se o primeiro passo executor deve ser apenas inventário/DECISION ou já desregistro de boot fora do Kernel.
- Se financial/internal observability entra no Kernel operador ou fica em quarentena por superfície interna ampla.
- Se módulos com backend vivo e frontend comentado devem ser desregistrados já ou apenas marcados como não expostos.
- Onde Clayton quer aceitar ambição visível em /em-desenvolvimento versus limpar menu para MVP estrito.
- Como tratar workers iniciados por padrão que não são default-off no BOOT.

Quem precisa decidir:
  Clayton:
    ambição de MVP, risco social aceitável, tenant 1:1 vs multiempresa para contacts/CRM,
    quais fluxos são produto vivo.
  IA Diretora:
    transformar a ata em DECISION/prompt executor.
  repo vivo:
    provar módulo por módulo antes de promoção/quarentena.
  futura DECISION:
    lista formal do Kernel, política de boot, critérios de promoção e sequência de êxodo.
```

---

## 11. Decisão de Clayton

```text
Clayton decidiu (DIREÇÃO MACRO 2026-06-18 — assumiu a cadeira de IA Diretora; NÃO é GO executor):
  1. Adotar POLÍTICA DE ATIVAÇÃO RUNTIME como resposta sistêmica raiz (nada fica vivo por herança;
     nada sobe no boot/frontend/worker sem decisão explícita de ativação).
  2. Adotar Kernel MVP + Quarentena como estratégia macro de produto/operação.
  3. Tratar R7b acceptQuote como FRENTE PRÓPRIA PRIORITÁRIA (authority/money-adjacent) — não esperar
     a estratégia inteira; é problema distinto de ativação.
  4. Exigir GATE EXPLÍCITO para TODO worker money-adjacent. Princípio único: default-on só com
     decisão explícita; default-off se não estiver no Kernel.
  5. Decidir o default de cada worker POR ESCOPO (não em bloco): settlement/release ~ escrow no Kernel;
     treasury-split ~ fundo regional no ciclo; governance workers ~ governança deliberativa no ciclo;
     observability ~ operador interno real vs devtool.
  6. NÃO deletar/mover código agora; NÃO ligar RBAC FASE 6/payout/governança financeira;
     NÃO tratar fundo regional como lixo técnico.
  7. Primeira execução futura será DESREGISTRO/CONTENÇÃO, não reconstrução.
  Autorização concedida nesta reunião: apenas PREPARAR DECISION/prompt executor futuro. Continua NÃO-GO.

Clayton NÃO decidiu ainda (5 decisões separadas que ele mesmo enumerou — D1..D5):
  D1 — Política: redação formal de "nada sobe vivo sem decisão explícita" (vira DECISION?).
  D2 — Kernel: quais fluxos exatos ficam vivos neste ciclo (lista final).
  D3 — Workers: quais workers money-adjacent ficam default-on.
  D4 — Fundo regional: entra no Kernel agora ou fica preparado/quarentenado.
  D5 — Governança deliberativa: entra no ciclo de launch ou fica fora.
  (+ herdadas: contacts/CRM tenant multiempresa; destino de /internal financeiro.)

Próxima pergunta para Clayton:
  Para D2 — qual é o Kernel MVP mínimo que deve ficar vivo no boot E no frontend neste ciclo?
  (sugestão IA-Repo registrada na §6/§8: cadastro·login·perfil PF·actor/identity·agenda básica·
   PJ fiscal-first·KYB básico·referral·social post básico·services básico·wallet/bank read·home simples.)
```

---

## 12. Resultado final da reunião

Escolher uma ou combinar:

```text
Resultado provisório IA-Repo:
  Combinar B + C + F.

  B) criar Kernel MVP + Quarentena:
    Sim, como eixo principal.

  C) desregistrar módulos fora do Kernel:
    Sim, mas somente após DECISION/prompt executor com lista de boot.

  F) reconstruir módulos específicos em cima da fundação:
    Sim, para módulos estratégicos com schema/authority incompletos.

  D/E:
    Não agora. Mover/deletar só depois de prova e decisão.

  A/G:
    Não recomendados como estratégia principal; mantêm retrabalho.
```

---

## 13. Próximo passo permitido

```text
Próximo passo:
  ainda READ-ONLY.
  IA Diretora deve consolidar esta ata e pedir DECISION de Clayton sobre:
    1. lista Kernel MVP;
    2. política de Quarentena;
    3. primeira onda de desregistro de runtime;
    4. módulos que ficam apenas no código;
    5. módulos que somem do frontend;
    6. R7b acceptQuote;
    7. workers e superfícies financeiras internas.

É GO?
  NÃO

Quem executaria se virar GO:
  executora unificard

Gates mínimos exigidos se houver execução:
  validate:actor-writer-boundaries
  validate:bank-ledger-boundaries
  validate:regression-guards
  validate-architectural-patterns --strict
  pnpm --dir C:/unificard/backend run check:migrations
  git status --short antes/depois
  E2Es específicos se tocar fluxo financeiro/authority/tempo
```
