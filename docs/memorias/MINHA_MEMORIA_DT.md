# MINHA MEMÓRIA DT

> Instância permanente **IA-DT** — especialista em Dívidas Técnicas (READ-ONLY ESTRITO).
> Única escrita permitida: este arquivo. NÃO fecho/abro DT no log oficial, NÃO edito
> `REMEDIATION_DT_LOG.md`, NÃO corrijo, NÃO commito, NÃO migro. Só mapeio/classifico/alerto.
> Arquivos protegidos (nunca tocar): `CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`.
> Fontes soberanas: cada DECISION + `REMEDIATION_DECISIONS_LOG.md` + `REMEDIATION_DT_LOG.md` +
> `STATUS_EXECUCAO_GLOBAL.md`/`opus.md` + runtime/schema vivo.

---

## 🗺️ MAPA DE LEITURA (índice — começar por aqui)

> Memória da IA-DT é **mapa + insumo operacional**, não cartório nem norma. Ler do topo para baixo = mais recente → histórico. **Sempre revalidar HEAD vivo antes de usar** (o repo anda rápido; pulou ~4× só em 2026-06-09).

| # | Seção | Para quê |
|---|---|---|
| 0 | **📊 Snapshot de métricas** (abaixo) | linha de base: dívida sobe ou desce? como medir |
| 1 | **🧭 Doutrina de manutenção** | régua permanente: como o sistema se mantém (13 pontos) — NÃO autoriza execução |
| 2 | **Aprendizado cruzado — identidade** | 3 camadas (`global_user_id`/`user_id`/`actor_id`) = desenho, NÃO drift; STOP constitucional |
| 3 | **Correção de trilho — DECISION-0114** | escopo: só Fundo Regional + AP/AR; NÃO grupo, NÃO R2 |
| 4 | **Auditoria por raiz/dependência** | 8 raízes, grafo, ordem estratégica, STOPs |
| 5 | **Reconciliação viva (0113)** | estado vivo do arco authority; DT-mãe OPEN; R2 congelada |
| 6 | **[STALE] Estado verificado + inventário PJ** | histórico ancorado em `a312174a` (preservado, não reusar como verdade) |
| 7 | **Notas append-only da executora** | hardening fiscal-id · MIME/scanner · actionContext spoof |

**Estado vivo (revalidar):** HEAD `31ee7ff1` · branch `rescue-structural` · dev 365 · **DT-mãe 0113 OPEN** · **R2 CONGELADA** · raiz ativa = A (0113, denominador encolhendo: 1 Classe-A vivo + sweep Yala).

---

## 📊 SNAPSHOT DE MÉTRICAS — 2026-06-09 · HEAD `31ee7ff1`
Status: LINHA DE BASE (para a próxima medição comparar), NÃO EXECUÇÃO. Fonte: `grep` do `REMEDIATION_DT_LOG.md` + `git log`.

| Métrica | Valor | Nota |
|---|---|---|
| DTs registradas (histórico) | **285** headers | estável |
| CLOSED/RESOLVED (linha status) | **107** | método status-line |
| OPEN (linha status) | **179** | ⚠️ **teto** — infla com "Status original: OPEN" preservado em DTs já fechadas |
| CLOSED datadas junho | **66** | — |
| OPEN abertas junho | **76** | descoberta do sweep 0113 |
| CLOSED datadas maio | **39** | burn acelerou: 39→66 |
| Commits 7d | **192** | velocidade alta |
| Mix 7d | fix **83** · feat **37** · docs **46** | **fix-dominante = pagando dívida** |

### Leitura (régua de interpretação)
- **Contagem bruta de folhas sobe (+10 em junho) — e isso é SAUDÁVEL nesta fase.** O sweep adversarial 0113 **descobre** (abre) folhas latentes pré-existentes antes de fechar a raiz ("denominador completo antes do selo"). OPEN subindo = visibilidade subindo, não sistema degradando.
- **Descoberta ≠ dano novo.** As aberturas documentam risco que já existia (readers spoofáveis), agora visível.
- **Sinais de que estamos no trilho:** burn acelerou (maio 39 → junho 66); mix fix-dominante (83 fix vs 37 feat); raiz A com denominador encolhendo (4 Classe-A → 1).
- **Métrica que importa = RAIZ, não folha.** Contar DT "por cabeça" mistura raiz com folha (fechar 1 raiz ≫ fechar 1 folha).

### Dashboard a acompanhar (próxima medição)
1. **# raízes OPEN** (hoje ~8).
2. **Denominador 0113 restante** (hoje 1 Classe-A vivo + sweep final Yala).
3. **Razão fechadas/abertas por semana** (hoje ~1:1,15; deve virar **>1** quando o sweep secar = ponto de inversão).
4. **Mix fix:feat** (manter fix-dominante).
5. **# prováveis-superadas aguardando reconciliação** (~8; índice `DECISOES.md` STALE).

**Ponto de inversão esperado:** quando a Yala não achar canal novo, descoberta seca → fechamento alcança → OPEN bruto começa a cair. Hoje = fase "abrir para fechar a raiz".
**Sinal de regressão (AUSENTE hoje):** OPEN subindo **+** CLOSED estagnado **+** mix feature-dominante.

---

## 🧭 DOUTRINA DE MANUTENÇÃO — "Como o Unificard deve continuar se mantendo" — IA-DT — 2026-06-09
Status: **RÉGUA PERMANENTE DE MANUTENÇÃO — NÃO é autorização de execução.** Orienta auditorias futuras.
Fonte: síntese 1ª mão de `GOVERNANCA_DE_SISTEMA_E_PREVENCAO_DE_REGRESSAO`, `ARCHITECTURE_GUARDRAILS`, `OPERATING_MODE`, `LEI_DE_COERENCIA §4/§7`, `00_AGENT_PROTOCOL` + estado vivo. Gates confirmados materiais (npm + scripts).

> **Princípio mestre:** a robustez não vem de documentação — vem da **impossibilidade técnica de violação**. Se uma violação ocorre sem quebrar o sistema, o sistema NÃO está protegido (`GOVERNANCA §7/§9`).

### Régua permanente (pontos a preservar)
1. **Lei sem gate executável é dívida, não proteção.** Regra crítica = constraint DB + guard runtime + gate CI. Drift novo: detectar → virar gate → só então "fechado". Gates âncora verdes a cada fatia (`actor-writer-boundaries`, `bank-ledger-boundaries`, `regression-guards`, `architectural --strict`).
2. **SSOT por domínio, sem realidade paralela.** money→`bank_ledger`, identidade→`actors`/`identities`, tempo→`unified_availability`, semântica→`CONCEPT`, estoque→`inventory_movements`. Perfil/aba/feed/status = projeção, nunca cópia concorrente. Ordem causal `LEI §7` inviolável.
3. **`global_user_id` ≠ `user_id` ≠ `actor_id` — 3 camadas constitucionais, NÃO colapsar.** Mapper existe (`03 §8` + writer único `§4.8.1`); manter = enforçar resolver em todo reader. "Matar 3 vocabulários" = convergir `actor_type`, nunca unificar IDs.
4. **`actorId` declarado pelo cliente é HINT, não autoridade.** Prova server-side via `req.user` + `canRepresentActor`/`canManageCompany`/self (`DECISION-0113`, 5 canais).
5. **Denominador completo antes de selo.** Varredura exaustiva própria; mapa nunca é exaustivo por si.
6. **Yala sela PROVA, não narrativa.** Verificação adversarial obrigatória; nada "fechado" sem selo + prova material.
7. **Código vivo vence memória.** Revalidar HEAD/migrations/DTs a cada fatia (repo anda rápido).
8. **READ-FIRST antes de execução.** Observa→simula→insight→decision-log→(talvez)executa. Camada observacional nunca escreve produção; simulação nunca auto-executa; em dúvida, caminho mais conservador; incerteza (`confidence`/`dataQuality`) é dado de 1ª classe (`null`, não `0`); nada assume contexto global (City Readiness).
9. **Uma raiz, uma frente, um modo.** Raiz fecha família (≠ folha/produto/financeira). PJ/grupo/Bank/marketplace nunca no mesmo corte. GUARDIÃO ou EXECUTOR, declarado antes.
10. **Financeiro exige paralelas.** grupo/Bank/split/payout só com **três paralelas** + E2E fail-first; SQL a `bank_*` só em `modules/bank/`; dinheiro só `*_cents BIGINT`.
11. **DT precisa de critério de convergência.** Norma assintótica: toda exceção carrega prazo/critério. Conviver com violação ≠ ratificar drift.
12. **Sweep horizontal equilibrado com vertical humana real.** Varredura ampla (cobrir todos os canais/superfícies) NÃO substitui a leitura vertical de 1ª mão do humano/handler — a lição 0113 nasceu de tratar o mapa horizontal como exaustivo. Equilibrar largura (denominador) com profundidade (handler real).
13. **Cartório e índices precisam de higiene documental.** `REMEDIATION_DT_LOG`/`REMEDIATION_DECISIONS_LOG` = verdade soberana; índices (`DECISOES.md` hoje STALE: só 0064–0111, falta 0112/0113/0114/ADENDO) devem reconciliar. Status no log pode estar defasado vs runtime — cruzar antes de agir; reconciliação é frente da executora/cartório (IA-DT sinaliza).

### Termômetro de saúde
Saudável: gates verdes · DT com prazo · "fechado" só após selo+prova · drift novo vira gate · frente única · `null` em dúvida · memória reancorada.
Degradando: gate desligado "temporário" · DT virando baseline sem prazo · "fechado" por narrativa · PJ+grupo+Bank no mesmo corte · número inventado · instância com amnésia.

### Elo com o propósito
Manutenção rigorosa é **pré-condição** do "lucro volta para a sociedade": o valor só circula de volta à comunidade se ledger é único, autoridade é provada, identidade não fragmenta e nenhuma camada cria verdade paralela. Sistema permissivo viraria mais um intermediário capturador.

_Régua permanente — orienta auditoria, não autoriza execução._

---

## APRENDIZADO CRUZADO — IDENTIDADE: 3 CAMADAS SÃO DESENHO, NÃO DRIFT — IA-DT — 2026-06-09
Status: CORREÇÃO DE CLASSIFICAÇÃO (régua), NÃO EXECUÇÃO
Fonte: resposta da IA-DOCUMENTOS (cruzou ≥6 docs soberanos: `03_IDENTITY_CANONICA`, `02_ACTORS_SSOT`, `IDENTITY_SSOT_PRECEDENCE`, `08_AUTORIDADE_CANONICA §10.1/§10.2`, `CORE_IDENTITY_AND_ACTORS_CONTRACT §3`, `LEI_COERENCIA §4.8`) + Constituição Art. I + tese actor-first. **Consistente com o que a IA-DT já leu de 1ª mão** (SSOT_REGISTRY §5.1, LEI §4.8.1) — integrado.

### Veredito incorporado
`global_user_id` / `user_id` / `actor_id` = **TRÊS CAMADAS ONTOLÓGICAS por desenho constitucional**, cada uma com SSOT próprio e **PROIBIÇÃO de fusão** (`03 §3/§4`; `02 §5/§10`; Const. Art. I). **NÃO é drift.** Identidade **identifica** (`global_user_id`/`identities`, CPF/KYC); usuário é **conta técnica/tenant + dono da wallet no Bank** (`user_id`/`users`); actor **age** (`actor_id`/`actors`). O **mapper ÚNICO EXISTE na norma**: `(global_user_id,tenant_id)→user_id` [`03 §8`] → `ensureUserActor` → `actor_id` [`§4.8.1` writer único] → `actors.global_user_id→identities`. `user_identity_links` foi **MORTA de propósito** (`08 §10.2`). `08 §10.1` enumera os 3 como "base canônica de identidade operacional — NÃO criam autoridade, só rastreiam atuação".

### Impacto na minha auditoria (MUDA 3 coisas)
1. **RE-SPLIT da raiz J:** o "3 IDs paralelos sem mapper" da memória de onboarding está **enganoso** — não é DT, é camada constitucional + mapper existente. Os frentes reais são **3 eixos distintos**, não um:
   - **(a) enforcement do resolver** (readers com lookup direto `user/global_user→actor` fora da cadeia) = **JÁ É raiz A / 0113** (`DT-DIRECT-QUERY-ACTOR-READERS`, `DT-OPERATIONAL-READ-ACTORID-UNVALIDATED`). Drift de aplicação, não de norma.
   - **(b) backfill ~94 actors `global_user_id NULL`** = frente DECISION-0062 (dados violam; modelo certo).
   - **(c) convergência `actor_type`** (`user`/`page` vs `person`/`company` vs `system`) = `DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION` (`§4.8.7`) — eixo próprio, **distinto dos 3 IDs**.
2. **STOP CONSTITUCIONAL novo (alto valor):** **NÃO colapsar os 3 IDs de identidade.** "Matar os 3 vocabulários" = convergir **`actor_type`**, NUNCA unificar IDs. Colapsar = **regressão constitucional** (viola `03 §3/§4`, `02 §5/§10`, Art. I) + mata actor-first/capability-additive. Se alguém "simplificar a costura" achando que limpa drift, derruba a separação soberana — **alertar a executora antes de qualquer frente de identidade**.
3. **Reforça centralidade de A:** o drift identidade-resolver é o **mesmo** readers-bypass do 0113 → fechar 0113 também fecha esse pedaço. Alavancagem de A ainda maior. Não é frente nova.

### NÃO muda
Ranking (A #1), R2 congelada, grupo-dinheiro raiz separada, escopo 0114. Correção é de **classificação + 1 STOP**, não de prioridade.

_Régua: 3 camadas de identidade = NÃO matar (constitucional). 3 vocabulários de `actor_type` = convergir (legítimo). Não confundir os eixos._

---

## CORREÇÃO DE TRILHO — ESCOPO DA DECISION-0114 — IA-DT — 2026-06-09
Status: RÉGUA MENTAL (correção de classificação), NÃO EXECUÇÃO
Fonte: leitura 1ª mão `DECISION_0114_REGION_FUND_AND_AP_AR_INITIAL_AUTHORITY.md` + `REMEDIATION_DECISIONS_LOG.md` L6759 + 3 DTs latentes (L11538–11557) — confirmado por IA-DECISÕES, promulgado por Clayton.

> **Régua:** cartório não é guarda-chuva. Decisão existente não se estica para domínio que não decidiu. **Grupo-dinheiro NÃO é Fundo Regional com camiseta diferente** — é outra raiz, outro cartório, outra faca.

### O que a DECISION-0114 É (promulgada 2026-06-07, docs-only)
Cobre **só**: (1) Fundo Regional; (2) AP/AR latente; (3) **autoridade inicial do fundador** (via SSOT, sem CPF hardcoded); (4) **STOP** contra reativação sem modelo + gate + E2E.

### O que a 0114 NÃO cobre
group-wallet · split-engine de grupo · group_community_fund · autogestão financeira de grupos · **R2 delegação**. Nenhum desses herda nada da 0114.

### Correções aplicadas a esta memória (seções abaixo)
- **H · money-latent:** NÃO depende de "criar a 0114" — **a 0114 já existe**. Depende de **decisão futura de MODELO** (D3 delegação do Fundo Regional · D5 modelo AP/AR: tenant/company/delegado/híbrido) **+ gate + E2E** no mesmo corte. → H é **decision-pending (modelo) primeiro, execution-pending depois**. (Onde as seções abaixo dizem "DECISION-0114 + gate", ler como "decisão de MODELO D3/D5 + gate", não "criar 0114".)
- **C · grupo-dinheiro (R3):** precisa de **decisão própria**, não herda 0114. É **FINANCEIRA** → **três paralelas**, **fora de micro-fatia**. `CONTRATO_GRUPOS_V2` governa as contas (dois bolsos, cofre desligado), mas a **autogestão/governança do fundo de grupo** (gasto/votação = AUTG-1) **não está decidida**.

### Número de cartório
Próxima DECISION livre = **0115** (maior promulgado = 0114 + ADENDO ao 0113). **0115 NÃO está reservada** — ACTIVE=B, delete-guard, R2 técnica e grupo-dinheiro **podem disputar**; **Clayton decide a prioridade**. Índice `docs/02_decisions/DECISOES.md` está **STALE** (cobre só 0064–0111; falta 0112/0113/0114/ADENDO) — reconciliação documental é do cartório.

### Recomendação (régua de operação)
1. Guardar esta correção como régua. 2. **Não esticar a 0114** como guarda-chuva. 3. Voltar ao **denominador da 0113**. 4. Executar **só micro-fatia não-financeira já classificada** (ex.: `groups/:id/economy`→isMember, norma decide). 5. Manter **grupo-dinheiro congelado** até três paralelas + decisão própria.

_Resumo seco: 0114 não autoriza grupo-dinheiro._

---

## AUDITORIA POR RAIZ/DEPENDÊNCIA — IA-DT — 2026-06-09 · HEAD `e95a7ee3`
Status: MAPA DE ALAVANCAGEM, NÃO EXECUÇÃO
Fonte: grep do inventário vivo (`REMEDIATION_DT_LOG.md`, ~200 headers) + `dividas.md` + reconciliação abaixo + git log vivo + 1ª mão do denominador 0113

> **Delta vivo nesta sessão:** HEAD `f5cf3524` → **`e95a7ee3`** (executora commitou ao vivo: payment-method `/default` `5c3e1108` + reads list/by-id `e95a7ee3`). dev 365. Revalidar HEAD sempre — pulou 2× só nesta sessão.
> **Limite honesto:** NÃO reverifiquei de 1ª mão as ~200 DTs; classifico por raiz a partir do material acima. Sem prova fresca = PROVÁVEL/G, não verdade.

### 8 raízes governantes (alavancagem)
| Raiz | Classe | Status | Filhas | Bloqueia | Ação |
|---|---|---|---|---|---|
| **A · 0113 authority** (`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`) | RAIZ/BLOQUEADORA | OPEN | 5-canais, `DT-OPERATIONAL-READ`, `DT-DIRECT-QUERY-ACTOR-READERS`, `DT-CANACTAS-STALE`, behavioral-coverage, `groups/:id/economy`, +4 a classificar | **R2** | finalizar denominador + sweep Yala |
| **B · R2 delegação** (`DT-PJ-AUTHORIZED-LINKS-SUBSTRATE-MISSING`+`DT-ACTOR-DELEGATIONS-ZERO-RUNTIME`) | RAIZ/R2 | OPEN-CONGELADA | cluster risco (6), `AUTHORITY-AUDIT-LIMITED-TO-FINANCIAL`, role-vocabulary (sócio/diretor/procurador), `TRANSITIONAL-RESPONSIBILITY` | equipe PJ / antifraude | frozen até A selar |
| **C · grupo/dinheiro R3** (`DT-SPLIT-ENGINE-GROUP-WALLET-LEGACY-LOOKUP`) | RAIZ/FINANCEIRA | OPEN-CONGELADA | wallet-provision, 3-parallel-substrates, idempotência, unique-index, allocations, owner-FK | autogestão (grupo governar fundo) | 3 paralelas + "go" Clayton |
| **D · marketplace/semântica R4** (`DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD`) | RAIZ/PRODUTO | GOVERNED 0105/0106 | HYBRID-ATOMIC, DOMAIN-FORK, ACTIVATION-VOCAB, ONBOARDING-DOMAIN, CANONICAL-CATALOG, SERVICE-RAMO | última milha comercial | palavra Clayton; `financeiro-*` viga Bank (não renomear) |
| **E · PJ KYB docs (Pilar 1)** (`DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING`) | RAIZ/DECIDED | GOVERNED 0112, em execução | MALWARE-SCAN, KYB-DOCS-IN-ONBOARDING (CLOSED 06-07), LIFECYCLE-CONFLATION residual | "PJ verifica de verdade" | ordem dura §10 |
| **F · PJ lifecycle/delete/capability (Pilar 2)** | RAIZ parcial | OPEN | 3B3-CAPABILITIES, ACTIVATION-FLAGS + **2 gaps SEM DT** (delete-guard, PROVISIONAL→ACTIVE) | "opera/remove conforme estado" | abrir DT antes; decisão Clayton |
| **G · schema-drift/fantasma** (`DT-FANTASMA-ORPHAN-COLLECTIVE`, `MODULES-ASPIRATIONAL-VS-RUNTIME`) | RAIZ dormente | OPEN | módulos FROZEN, HEALTH-FROZEN, SCHEMA-DRIFT-5-TABLES | nada crítico | deferir (não amputar) |
| **H · money-latent** (`DT-MONEY-LATENT-REACTIVATION-TRAP`) | FINANCEIRA/DEPENDENTE | OPEN | REGION-FUND-DELEGATION-MODEL, AP-AR-FINANCE-AUTHORITY-MODEL | religar settlements/AP/AR/regions | DECISION-0114 + gate no mesmo corte |

(+ **J · CPF SSOT** `CPF-SSOT-DUAL-WRITE`+`ACTOR-TYPE-VOCABULARY-FRAGMENTATION` — F4/F5 governada; **K · payout externo** 6 DTs — NOT AUTHORIZED.)

### Grafo
```
A · 0113 (OPEN) ── desbloqueia ──> B · R2 (CONGELADA) ──> cluster risco + role-vocabulary (=AUTH-1/2)
  canais 1/2/3 ✅ · canal-5 economy/dispatch/payment-method ✅ · groups/:id/economy ⛔ VIVO
  + DT-OPERATIONAL-READ · DT-DIRECT-QUERY · DT-CANACTAS · behavioral-coverage
  + [PENDENTE 1ª mão] b2b-contracts · availability-conflicts · organization-units · invoice
C · R3 grupo (FINANCEIRA, 3 paralelas) = AUTG-1 (recebe, não governa)
D · R4 (PRODUTO)  E · Pilar1 (executando)  F · Pilar2 (2 gaps sem DT)
H · money-latent (0114)  G · fantasma (deferir)  I · TEMPORAL/C63 (CONVERGIDO ✅)
```

### Ordem estratégica
- **N1 read-only:** (1) fechar denominador 0113 de 1ª mão dos 4 não-classificados (b2b/availability/org-units/invoice → A-G); (2) reconciliar superadas (§abaixo); (3) R2.0 read-only (revalidar `actor_delegations` FK/CHECK/audit + 2º reader `actor-capabilities.service.ts:161`).
- **N2 execuções pequenas (sem $/R2):** (1) `groups/:id/economy`→`isMember` (norma V2 §2.6 decide); (2) folhas single-channel residuais; (3) `DT-CANACTAS` reconciliar. → **sweep Yala 5 canais → 0113 pode fechar.**
- **N3 raízes grandes:** R2 (após selo) → R3 grupo (3 paralelas+"go") → H money-latent (0114). Sequência: A antes de B; C/H exigem paralelas; D/F = Clayton.

### STOPs
1. Não fechar 0113 sem sweep adversarial Yala (5 canais). 2. R2 congelada até A. 3. R3/money-latent/payout = 3 paralelas, nunca no corte de A/B. 4. `financeiro-*` viga Bank — não renomear. 5. delete-guard/PROVISIONAL→ACTIVE = abrir DT+desenho antes. 6. D marketplace = palavra Clayton. 7. Fantasma/FROZEN = deferir, não amputar. 8. Nunca PJ+grupo+Bank+marketplace no mesmo corte. Autorais intocados.

### Candidatas a reconciliação documental (NÃO fechar — sinalizar cartório)
- `DT-PJ-IS-VERIFIED-DEPRECATED-COMPAT` (coluna dropada 3.3-B2) · `DT-PJ-VERIFIED-AT-LEGACY-THIRD-GHOST` (ghost exorcizado) · `DT-ACTOR-DELEGATIONS-ZERO-RUNTIME` (writer vivo → PARTIAL) · folhas A gateadas nesta sessão (payment-method reads `e95a7ee3`, economy 3 rotas `1a5c3057`, dispatch `f5cf3524`) · `DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING` (já CLOSED 06-07).

### Próximo prompt recomendado a Clayton
> "IA-DT READ-ONLY: feche o denominador 0113 de 1ª mão dos 4 não-classificados (b2b-contracts, availability-conflicts, organization-units, invoice) — rota viva/proxy? dado privado/público? gate valida recurso ou só caller? `:id`=actor/recurso/owner? Classe A-G? bloqueia DT-mãe? Tabela + registrar na memória. Não corrigir, não abrir R2, não fechar DT."

_Frase-guia: dívida isolada é sintoma; raiz fecha família; decisão não é DT; código vivo venceu a memória (HEAD pulou 2× nesta sessão); Clayton decide prioridade; Yala sela prova._

---

## RECONCILIAÇÃO VIVA — IA-DT — 2026-06-09 · HEAD `f5cf3524`
Status: ATUALIZAÇÃO DE MEMÓRIA, NÃO EXECUÇÃO
Fonte: transcrito Clayton (sessão IA-DT anterior, que travou) + leitura 1ª mão do repo vivo

> Reancoragem da própria IA-DT (instância sucessora). NÃO é resposta a `PEDIDO DA EXECUTORA`.
> Não abre/fecha DT oficial, não autoriza R2, não declara 0113 fechada, não afirma "backend limpo".
> Tudo de `## Estado verificado` em diante ficou ancorado em `a312174a` e está **STALE** — preservado como histórico, não como verdade viva.

### A. Estado vivo confirmado (1ª mão, HEAD `f5cf3524`, dev 365)
- HEAD `f5cf3524` · branch `rescue-structural` · dev 365. O `a312174a` da memória antiga está muito atrás.
- **Frente PJ/storage DESTRAVOU:** `F-PJ-DOCUMENT-STORAGE-PORT` executado (`900bd80b`); KYB user-submit em andamento. A "TRAVA ATIVA / executora parada" da memória antiga **não vale mais** (não tratar como verdade viva).
- `GET /payment-methods/default?actorId` → **CORRIGIDO** (`canRepresentActor`, `payment-method.routes.ts:118`, canal-3 query). **NÃO é pendência.**
- `GET /groups/:id/economy` → **AINDA VIVO** (1ª mão `groups.routes.ts:1017`: só `requirePermission(['groups:read'])`, sem `isMember`).

### B. Estado stale/superado (histórico, não reusar como verdade)
- `## Estado verificado` (a312174a) + "TRAVA ATIVA storage-port" → **SUPERADO**.
- Inventário "DTs PJ OPEN" abaixo: válido como mapa PJ, mas anterior ao avanço 0113 — **revalidar status por DT antes de agir**.
- Denominador 0113 de **4 Classe-A vivos encolheu para 1** (ver D).

### C. Fio 0113 PRESERVADO (só existia no transcrito; a sessão travou antes de gravar isto)
- **DT-mãe `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` segue OPEN.** O fechamento prematuro ("superfícies vivas") foi **RETRATADO** pela Yala (caso (d): feed/inbox/events) + 2º vetor `x-actor-id`.
- **Enquadramento canônico (Clayton):** 0113 = **QUALQUER `actorId` declarado pelo cliente** — 5 canais: `actionContext` · `x-actor-id` · query `actor_id` · params `actorId` · params `id` de recurso privado (IDOR).
- **Regra atual: denominador COMPLETO, não amostragem.** Yala = **selo adversarial OBRIGATÓRIO**. **Não existe selo com denominador incompleto.** Mapa nunca é exaustivo por si — toda fatia de autoridade começa por varredura própria + verificação adversarial.
- **R2 (delegação) CONGELADA** até 0113 fechar de verdade (5 canais cobertos + selo). Desenho R2 continua correto (não-greenfield: `actor_delegations` existe; gap é semântico/cadeia §4.9.9/audit), mas a premissa "0113 fechada" envelheceu.

### D. Estado vivo do denominador 0113 (transcrito + git, HEAD `f5cf3524`)
**Corrigidos / selados:**
- canal `x-actor-id` → primitivo `9996cbd2` **SELADO Yala** (`f50dce81`); abriu 3º padrão `DT-DIRECT-QUERY-ACTOR-READERS`.
- canal-3 money **re-selado** (`0ca989b7`); canal-3 não-money classificado/corrigido (cultural `24c8d92d`; over-gate removido em reporting `c0e32502` / payout `af790602`; impact `20183b07`).
- events visibility **B1–B4** + canal-5 **A/B/C** concluídos (`5d816e40`…`25958e4f`).
- events money-reads settlement/RFQ **re-selados** após o furo `/quotes` (`fc53a6c6` / `3b8309d3`).
- economic-overview (`b3fea106`); account by-id (`e63a6ae7`); account list `/` + `/owner/:ownerId` (`1a5c3057`); opportunity-dispatch `/actors/:id/dispatches` (`f5cf3524`).
**Ainda vivo:**
- `groups/:id/economy` — vivo em `f5cf3524` (1ª mão). Conserto = `isMember` (norma já decide — ver F); correção de executora, não decisão Clayton.

### E. Pendências BLOQUEANTES da DT-mãe 0113 (sem inventar fechamento)
1. `groups/:id/economy` → `isMember` (único Classe-A vivo restante do denominador da sessão).
2. `b2b-contracts` por actor — **verificar 1ª mão** (não classificado ainda).
3. `availability conflicts` por actor — **verificar 1ª mão**.
4. `organization units` por actor — **verificar 1ª mão**.
5. `invoice` — revalidar escopo da permissão (canal-3 tratado; confirmar amplitude).
6. behavioral coverage — `DT-F6_5-BEHAVIORAL-COVERAGE-DEV-EMPTY`.
7. `DT-CANACTAS-CHECKOWNERSHIP-STALE-VS-CANMANAGECOMPANY`.
8. **Sweep adversarial FINAL dos 5 canais pela Yala** — sem isto, a mãe NÃO fecha.

### F. Pendências NÃO bloqueantes (frentes próprias / money-latent)
- marketplace identity/sla = **F-OK** (gate operador `can_manage_marketplace`), salvo decisão futura sobre escopo de `marketplace_manage_catalog`.
- settlement / AP / AR / regions = proxy-dead/money-latent → `DT-MONEY-LATENT-REACTIVATION-TRAP` (gate no corte de reativação; prova viva: services rejeitam "migrated to Bank").
- `DT-EVENTS-MONEY-WRITES` = frente financeira própria.
- Pilar 1 PJ (KYB docs) e Pilar 2 (delete guard / PROVISIONAL→ACTIVE / capability) = frentes PJ próprias (detalhe no histórico abaixo).

### G. Decisões Clayton registradas (sessão)
- **D1** — `marketplace_manage_catalog` = operador/admin cross-actor **por agora** → marketplace identity/sla = **F-OK**.
- **D2** — fundo regional / AP / AR / settlements = decisão de **REATIVAÇÃO**; default **admin-gated**; público só **curado/agregado**.
- **D3** — lista geral de contas = **admin/finance-only** via `financial:view_all_ledger` (já aplicado em `1a5c3057`).
- groups economy = **NORMA já decide** (CONTRATO_GRUPOS_V2 §2.6): membro ativo vê agregado; não-membro não vê por padrão. Não é decisão Clayton.

### H. Próximo papel da IA-DT (sucessora)
- READ-ONLY estrito; escrever só neste arquivo; responder `PEDIDO DA EXECUTORA` no topo quando houver solicitação técnica.
- Revalidar HEAD a cada fatia. 1ª mão em classe sensível (nunca confiar só em breadth de agente — estado anda rápido).
- **Não** declarar 0113 fechada; **não** dizer "backend inteiro limpo" sem sweep adversarial final; **não** autorizar R2; **não** editar log oficial.
- Próximo insumo útil (read-only): fechar o denominador de 1ª mão dos itens **E2–E5** (b2b-contracts, availability conflicts, organization units, invoice) — mapear/classificar A-G, não corrigir.

_Frase-guia: memória não é cartório, mas evita a IA acordar com amnésia. Denominador completo antes de selo. R2 só depois que o crachá falso morrer._

---

## [STALE — superado pela RECONCILIAÇÃO VIVA de 2026-06-09; preservado como histórico] Estado verificado (ancorado em `a312174a`)

- **HEAD:** `a312174a` ("decisions: DECISION-0112 ADENDO - Clayton resolve os 4 parametros de produto (docs-only)")
- **Branch:** `rescue-structural`
- **Working tree:** limpo exceto untracked esperados — 3 autorais protegidos + `docs/memorias/` (quarentena). Nenhum outro arquivo tocado.
- **DB:** `unificard_dev`, **365 migrations** (confirmado nas fatias 2026-06-06).
- **TRAVA ATIVA confirmada:** executora parada; `F-PJ-DOCUMENT-STORAGE-PORT` NÃO começou; verificação READ-ONLY da DECISION-0112 + ADENDO §10 ainda é pré-condição.

## Escopo desta análise

Fechamento PJ — DTs abertas, pilares, dependências e ordem segura.
**PJ fechada (def. Clayton):** empresa nasce → verifica-se via KYB documental real (sem fantasma, sem vazamento) → opera conforme estado → pode ser removida com segurança — tudo sobre SSOT.

**Leitura desta sessão:** DECISION-0112 íntegra + ADENDO §10; cluster PJ inteiro do DT log
(linhas ~10719–11570); checagem de delete/capability/ACTIVE. **Achado-chave:** o cluster
PJ de verificação/KYB/nascimento foi **massivamente fechado** entre 2026-06-03 e 2026-06-06
(≈30 DTs CLOSED). O que resta para "PJ fechada" concentra-se em **Pilar 1 (documentos KYB)** +
**Pilar 2 (lifecycle/delete/capability)** + um anel externo de **antifraude/risco e
marketplace/semântica** que NÃO bloqueia o fechamento mínimo de PJ.

## Lista completa de DTs PJ OPEN

> Status conforme última linha do log (2026-06-06). "PARTIAL/GOV" = PARTIALLY MITIGATED ou GOVERNED/DECISIONED (norma cravada, runtime/resíduo pende).

| DT | Status | Contexto | Risco | Mitigação atual |
|---|---|---|---|---|
| **DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING** | OPEN / DECIDED-GOVERNED (0112) | Sem provider real de storage de documento legal; `uploads/` é estático **público sem auth**; `media`/`group-image` são placeholder/imagem | documento KYB sem casa segura/auditada/LGPD; vazamento por URL | desenho cravado (0112 D1–D13 + §10); runtime pendente — **não fechar sem provider vivo** |
| **DT-PJ-DOCUMENT-MALWARE-SCAN-MISSING** | OPEN (novo, 0112 §10 A2) | Sem antivírus no caminho documental KYB | PDF infectado aberto pelo reviewer = cavalo de Troia (execução de malware no operador) | norma: `MalwareScanPort` obrigatório em prod; dev=`NoopMalwareScanner`; fail-closed/quarantine |
| **DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING** | OPEN | SSOT `fiscal_identity_documents` + writer + gate vivos, mas **só admin** e `file_reference` opaco; wizard não coleta documento | finalização não coleta KYB; usuário sem onde enviar Cartão CNPJ/contrato social | gated por (1) storage provider e (2) autoridade user-facing — ambos STOP |
| **DT-PJ-HUMAN-LINK-DOCUMENTS-LGPD-MISSING** | OPEN | Docs de pessoa (sócio/representante/procuração) ficaram fora da F2-B; dado pessoal sensível LGPD, muda na transferência | se enfiados em `fiscal_identity_documents`, acopla continuidade fiscal a LGPD-de-pessoa | 0087 manteve docs-de-pessoa fora, trilho próprio |
| **DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING** | OPEN | Validação presencial QR (FASE 12) = fóssil neutralizado (501); evidência presencial como insumo KYB segue greenfield | perder evidência forte (presença física) OU perpetuar verificação paralela | writer tombstonado; UX órfã separada (DT-PRESENTIAL-UX, CLOSED); greenfield futuro |
| **DT-PJ-IDENTITY-PRECEDENCE-NORM-GAP** | PARTIAL/GOV | Precedência identidade fiscal PJ promulgada (0082/0084); falta reflexo técnico/normativo da casa fiscal | norma de precedência incompleta | casa fiscal `fiscal_identities` viva (0085); norma incorporada, resíduo documental |
| **DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT** | PARTIAL/GOV (0098) | Par `(primary_company_type_id, primary_concept_id)`=SSOT; `businessType`/`businessCategory`/`hybrid`=entrada/legado | segunda-verdade de classificação concorrente ao par | rota+writer do par vivos; onboarding migrado; resíduo: `businessCategory` legado + `hybrid` marketplace |
| **DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING** | PARTIAL/GOV (0098/0102) | Wizard consome catálogo governado e chama rota do par; falta eixo A (produtos/serviços/ambos via GRAPH) + matriz elegibilidade | seleção vira string/metadata morta ou `hybrid` atômico | fluxo ponta-a-ponta vivo (e2e 22/22); resíduo eixo-A/elegibilidade |
| **DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN** | OPEN | Marketplace usa `hybrid` como valor atômico vivo p/ decidir superfícies (viola 0097 D5 / Lei 7 GRAPH) | achata dois N0 numa string; remover "no escuro" quebra `mapCategoryToActorType` | 0098 marca `hybrid` DEPRECATED; proíbe nova lógica nele |
| **DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK** | OPEN / GOV (0106) | `MarketplaceDomain` (6, frontend hardcoded) diverge de `concepts.domain`/N0 (13); mapa promulgado por 0106 | duas verdades de "domínio" | mapa cravado (0106); resta consumo downstream (`concept→allowed domains`, DomainSelector derivar de N0) |
| **DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD** | PARTIAL/GOV (0105) | `concepts.domain` é multi-camada: N0 atuação + `financeiro-*` (RFC C2, **load-bearing Bank**) + `item-comercial` (SKU) | mapear marketplace pro N0 quase-vazio; confundir camada financeira com atuação | 0105 legitimou as 3 camadas (sem rename); resíduo = reflexo normativo em 18_DOMAIN_ONTOLOGY |
| **DT-PJ-CANONICAL-CATALOG-SHARED-ITEMS-NOT-PER-VERTICAL** | OPEN | Regra de produto Clayton: catálogo canônico compartilhado; não duplicar produto por vertical | Trilhos A/B criarem itens por vertical = fragmentação (viola N0/N1/N2 ProductTemplate único) | regra registrada; γ/CNAE seed já respeita (só sugere concept); Trilhos A/B não implementados |
| **DT-PJ-COMPANY-LIFECYCLE-STATUS-CONFLATION** | PARTIAL MITIGATED | 3 eixos separados (status/company_status/kyb_status); residual: upload legado promove DRAFT→PROVISIONAL | rota `uploadCompanyDocument` reachable promoveria DRAFT sem par soberano | anti-fraude conta DRAFT+PROVISIONAL; botão upload escondido p/ DRAFT; endereçar com frente KYB docs |
| **DT-PJ-TRANSITIONAL-RESPONSIBILITY-MISSING** | OPEN | Sem processo formal de venda/transferência de empresa (M0 exige sobreviver à troca de dono sem apagar histórico) | transferência informal apaga rastreabilidade | nenhuma (docs-only); evento append-only de transferência = futuro (D5) |
| **DT-PJ-ANTI-LARANJA-CORRELATION-MISSING** | OPEN | Sem grafo/correlação antifraude (laranja) | abertura PJ sem detecção de testa-de-ferro | greenfield (substrato de risco ausente) |
| **DT-PJ-TRANSVERSAL-RISK-SIGNALS-MISSING** | OPEN | Sem `risk_signals` transversal | risco PJ não rastreado cross-domínio | greenfield |
| **DT-RISK-HUMAN-OPERATIONS-SUBSTRATE-MISSING** | OPEN | Sem substrato de operações humanas de risco | sem trilha de revisão humana de risco | greenfield |
| **DT-RISK-FALSE-POSITIVE-SAFEGUARD-MISSING** | OPEN | Sem salvaguarda de falso-positivo em risco | cura de risco vira ruído | greenfield |
| **DT-PJ-AUTHORIZED-LINKS-SUBSTRATE-MISSING** | OPEN | Vínculo autorizado CPF→PJ (sócio/diretor/procuração) sem substrato governado | "responder ≠ operar ≠ representar" sem base; senha compartilhada | `roleDescription` texto livre é paliativo; base = `actor_delegations` |
| **DT-PJ-CREDENTIAL-SHARING-RISK-GUARD-MISSING** | OPEN | Sem guard contra compartilhamento de credencial PJ | login compartilhado = anti-padrão de autoridade | greenfield |
| **DT-RISK-ENTERPRISE-CASE-REVIEW-SUBSTRATE-MISSING** | OPEN | Sem substrato de revisão de caso enterprise | risco enterprise sem fila de revisão | greenfield |
| **DT-COMMERCIAL-PRICE-FEDERATED-SSOT** | OPEN | `price_cents` federado em 3 tabelas vivas sem precedência canônica | checkout/PDV/oferta leem fontes diferentes e divergem | bloquear acoplamento de PJ comercial a preço até mapear precedência |
| **DT-COMPANY-MARKETPLACE-ACTIVATION-FLAGS-PARALLEL-CAPABILITY** | OPEN (`###`) | Flags de capacidade (`catalog_ready`/`pdvEnabled`/…) em **memória volátil** (Map), fora do SSOT | capability não-persistida, perdida no restart; segunda-verdade | não usar como fonte soberana; D-CONCEPT/D-CONTEXT-RESOLVER decide |
| **DT-COMPANY-3B3-CAPABILITIES-OMITTED** | OPEN (`###`) | Ativação operacional NÃO grava capabilities (sem fonte canônica `company_type/concept→capabilities`) | empresa "ativa" sem capability derivada | empresa operacional = page-actor + responsible + par válido; sem tabela de capability no schema |
| **DT-PJ-IS-VERIFIED-DEPRECATED-COMPAT** | OPEN (provável resolvido de fato) | `is_verified` deprecated; **mas coluna `companies.is_verified` foi DROPADA** na 3.3-B2 | nome legado confunde; projetá-lo reintroduziria 2ª-verdade | 3.1-A textual aplicada; coluna dropada — **status no log não atualizado p/ CLOSED; confirmar** |
| **DT-PJ-VERIFIED-AT-LEGACY-THIRD-GHOST** | OPEN (higiene, sem urgência) | `verifiedAt` = ghost de código (coluna não existe); write removido na 2.5 | reintrodução futura por reader | ghost exorcizado; resta higiene textual de menções em doc/comentário |

## DTs cobertas pelo Pilar 1 — KYB documental

> Plano oficial (DECISION-0112 §6 + ADENDO §10, ordem cravada por Clayton).

| DT | Fatia que resolve/mitiga | Bloqueia | É bloqueada por |
|---|---|---|---|
| DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING | **1. F-PJ-DOCUMENT-STORAGE-PORT** | malware-scan, user-submit, admin-review, release-gate | verificação READ-ONLY 0112+§10 (pré-condição ativa) |
| DT-PJ-DOCUMENT-MALWARE-SCAN-MISSING | **2. F-PJ-DOCUMENT-MALWARE-SCAN-PORT** | download/review de documento real | storage port (fatia 1) |
| DT-PJ-KYB-DOCUMENTS-NOT-IN-ONBOARDING | **3. F-PJ-KYB-DOCUMENTS-USER-SUBMIT** + **4. F-PJ-KYB-DOCUMENTS-ADMIN-REVIEW-UI** | finalização com coleta documental | storage port + malware scan + autoridade user-facing (A4) |
| DT-PJ-COMPANY-LIFECYCLE-STATUS-CONFLATION (residual) | endereçar junto da frente KYB docs (3) | — | substrato documental canônico (alinhar `uploadCompanyDocument` ao 0087) |
| (KYB release gate financeiro) | **5. F-PJ-KYB-RELEASE-GATE** | saída de dinheiro PJ | review documental + KYB approved com lastro |

**Notas Pilar 1:**
- A ordem é **dura**: storage (1) → malware scan (2) → user-submit (3) → admin-review UI (4) → release-gate (5). Sequência cravada no ADENDO §10.
- O gate KYB financeiro de autoridade (`evaluateKybLayer`) **já existe e é testado** (DT-PJ-KYB-AUTHORITY-GATE-MISSING **CLOSED**, F2-C 16/16). A fatia 5 é o release gate **financeiro de saída** com lastro documental, não o gate de autoridade base.
- `mime_type`/`size_bytes` ausentes em `fiscal_identity_documents` = adição futura na fatia 1 (decisão da fatia, migration pequena forward-only) — **não** nesta etapa.

## DTs cobertas pelo Pilar 2 — Lifecycle / Delete / Capability

| DT | Fatia que resolve/mitiga | Bloqueia | É bloqueada por |
|---|---|---|---|
| **(sem DT registrada)** delete guard via Bank port | frente futura `F-PJ-COMPANY-DELETE-GUARD` (**a criar**) | remoção segura de empresa | desenho de guard (saldo/obrigações via Bank port antes de soft-delete) |
| **(sem DT registrada)** PROVISIONAL → ACTIVE | frente futura de promoção de lifecycle | "opera conforme estado" | critério de ACTIVE (hoje só DRAFT→PROVISIONAL existe) |
| DT-COMPANY-3B3-CAPABILITIES-OMITTED | frente de capability derivada (`company_type/concept→capabilities`) | gating por estado real | D-CONCEPT / D-CONTEXT-RESOLVER |
| DT-COMPANY-MARKETPLACE-ACTIVATION-FLAGS-PARALLEL-CAPABILITY | absorver/derivar/aposentar flags voláteis | capability soberana | mesma decisão D-CONCEPT/D-CONTEXT-RESOLVER |

**⚠️ ACHADO MATERIAL (Pilar 2):**
- **NÃO existe DT registrada para "delete guard via Bank port".** Clayton nomeou o eixo, mas o
  log não tem `DT-PJ-COMPANY-DELETE-GUARD-*`. `deleteCompany` existe (`companies.service`, faz
  `DELETE FROM company_domains`). **Recomendo abrir DT própria** antes de executar — remover
  empresa com saldo/obrigações no Bank sem guard é risco financeiro/causal.
- **NÃO existe DT para PROVISIONAL→ACTIVE.** Só DRAFT→PROVISIONAL está entregue
  (DT-PJ-COMPANY-APPEARS-BEFORE-ONBOARDING-FINALIZED CLOSED). O CHECK lifecycle aceita
  `DRAFT/PROVISIONAL/ACTIVE/SUSPENDED`, mas **quem promove a ACTIVE e sob qual critério não
  está definido** — gap de "opera conforme o estado".
- Capability hoje é **read-only MVP** (`actor-capabilities`, lê `company_users.can_*` + `actor_delegations`); não há tabela de capability persistida (DT-COMPANY-3B3 confirma).

## DTs PJ fora dos dois pilares

| DT | Por que fica fora | Sugestão |
|---|---|---|
| DT-PJ-HUMAN-LINK-DOCUMENTS-LGPD-MISSING | Docs de **pessoa** (LGPD), trilho próprio — 0112 §5 exclui explicitamente | frente própria pós-Pilar 1; substrato actor/CPF LGPD-first |
| DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING | Greenfield de evidência presencial (writer já neutralizado) | desenhar se vira insumo KYB OU trilho humano OU aposentar |
| DT-PJ-TRANSITIONAL-RESPONSIBILITY-MISSING (+ transferência D5) | Venda/transferência de empresa — fora do nascimento/verificação/operação | evento append-only de transferência (futuro) |
| Cluster antifraude/risco (anti-laranja, risk-signals, human-ops, false-positive, credential-sharing, enterprise-case-review) | Camada enterprise de risco = greenfield; não bloqueia PJ mínima | frente própria após substrato de vínculo (`actor_delegations`) existir |
| DT-PJ-AUTHORIZED-LINKS-SUBSTRATE-MISSING | Vínculo/delegação governada (sócio/diretor/procuração) | base `actor_delegations`; habilita o cluster de risco |
| DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT / DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING | Classificação/ativação — já PARTIAL/GOV, fluxo vivo; resíduo é eixo-A/legado | eixo-A (produtos/serviços/ambos GRAPH) + aposentar `businessCategory`/`hybrid` |
| DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN / DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK / DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD | Semântica/marketplace — não bloqueia nascer/verificar/operar/remover | reconciliar vocabulário (0106 mapa cravado) consumindo downstream |
| DT-PJ-CANONICAL-CATALOG-SHARED-ITEMS-NOT-PER-VERTICAL | Trilhos A/B (catálogo) — pós-fechamento de PJ base | catálogo deriva de `canonical_products`; ativação por empresa |
| DT-COMMERCIAL-PRICE-FEDERATED-SSOT | Precedência de preço comercial — frente própria | mapear leitura/escrita de `price_cents` antes de acoplar |
| DT-PJ-IS-VERIFIED-DEPRECATED-COMPAT / DT-PJ-VERIFIED-AT-LEGACY-THIRD-GHOST | Higiene de vestígios (coluna já dropada / ghost exorcizado) | confirmar/atualizar status no log; higiene textual |

## Ordem segura de resolução

**Trilho A — Pilar 1 (KYB documental, ordem cravada DECISION-0112 §10):**
0. (pré) verificação READ-ONLY de 0112 + ADENDO §10 — **trava ativa, executora aguarda**.
1. `F-PJ-DOCUMENT-STORAGE-PORT` — port S3-compatible + provider local-dev (disco privado fora de `/uploads/`) + prod-sem-provider fail-closed + hash/MIME/size/anti-path-traversal + `file_reference` opaco. **Sem upload user-facing, sem wizard, sem Bank.**
2. `F-PJ-DOCUMENT-MALWARE-SCAN-PORT` — `MalwareScanPort` + `NoopMalwareScanner` (dev) + estado quarantine/unscanned + bloqueio de download/review até scan. **Antes de qualquer download humano.**
3. `F-PJ-KYB-DOCUMENTS-USER-SUBMIT` — rota user-facing (gate autoridade A4: `companyId→fiscal_identity_id` + `canManageCompany`); produz `file_reference` via port.
4. `F-PJ-KYB-DOCUMENTS-ADMIN-REVIEW-UI` — UI admin + download autorizado/auditado via port.
5. `F-PJ-KYB-RELEASE-GATE` — gate financeiro confiando em KYB approved com lastro documental.

**Trilho B — Pilar 2 (pode correr em paralelo ao Pilar 1, eixos independentes):**
- B1. **Abrir DT** + frente `F-PJ-COMPANY-DELETE-GUARD` (delete guard via Bank port) — **isolado**, não depende do Pilar 1.
- B2. Definir critério + frente PROVISIONAL→ACTIVE (depende de KYB approved? decisão de produto).
- B3. Capability derivada por estado (DT-COMPANY-3B3 + flags voláteis) — depende de D-CONCEPT/D-CONTEXT-RESOLVER.

**Trilho C — anel externo (pós-fechamento de PJ base, não bloqueia):**
substrato de vínculo (`actor_delegations`) → antifraude/risco enterprise → transferência D5 → marketplace/semântica → Trilhos A/B catálogo → preço comercial.

**Dependências de sequência (Clayton):** storage **antes** de upload; malware scan **antes** de review/download; submit **antes** de review UI; KYB release gate **depois** do review documental; delete guard **isolado** (paralelo); lifecycle ACTIVE **depende** de KYB.

## Dependências críticas

- **Storage port é a raiz do Pilar 1.** Tudo (malware scan, submit, review, release) depende dele. Sem provider vivo, nada de documento real anda — e o caminho legado vazava (`uploads/` público).
- **Malware scan trava o download humano.** Reviewer não pode abrir documento não-escaneado (cavalo de Troia). Fica entre storage e qualquer review/download real.
- **Autoridade user-facing (A4)** é pré-requisito do submit do dono: `companyId→fiscal_identity_id` + `canManageCompany`. Posse de ID **não basta** (D7).
- **`financeiro-*` em `concepts.domain` é VIGA (load-bearing do Bank)** — hardcoded em `bank-integration.service.ts:635` e `concept-financial-resolver.service.ts`. **NÃO renomear/mover** sem tratar o hardcode. A decisão real de DT-CONCEPTS-DOMAIN recai sobre `item-comercial`, não sobre `financeiro-*`.
- **DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD bloqueia** o mapeamento seguro `MarketplaceDomain→N0` e a camada `concept/company_type→allowed domains` (mas 0105 já desbloqueou a premissa de catálogo).
- **delete guard depende do Bank port** (saldo/obrigações antes de remover) — e **não tem DT nem desenho ainda**.

## DTs que dependem de decisão do Clayton

- **Pilar 1 inteiro:** já decidido em DECISION-0112 + ADENDO §10 (4 parâmetros resolvidos). Falta só a **palavra de "executar"** após a verificação READ-ONLY (trava ativa).
- **PROVISIONAL→ACTIVE:** critério de promoção = decisão de produto (depende de KYB? de operação?).
- **delete guard:** desenho ainda não promulgado — precisa de DECISION/desenho antes de executar.
- DT-PJ-MARKETPLACE-HYBRID / DOMAIN-FORK / OPERATIONAL-ACTIVATION-VOCAB / ONBOARDING-DOMAIN: "NÃO executar eixo-A/marketplace/createCompany antes da palavra de Clayton" (0097 §9 / 0098 D8/D12 / 0102 §13).
- DT-PJ-CANONICAL-CATALOG (Trilhos A/B): "NÃO executar antes da palavra de Clayton"; **peixaria/pescados = decisão de produto PENDENTE** (não inventar slug).
- DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD: separar/documentar camadas = decisão de Clayton (não inferência de IA).
- DT-GROUPS-VOTES-ANONYMITY (adjacente, não-PJ): regra de produto de privacidade pendente.

## DTs que exigem Banco (migration/schema)

- **Pilar 1:** fatia 1 pode adicionar `mime_type`/`size_bytes` em `fiscal_identity_documents` (migration pequena forward-only — decisão da fatia). Malware scan pode reusar `document_status` ou coluna futura (sem migration obrigatória).
- **Substratos greenfield (via RFC/migration):** vínculo autorizado (`actor_delegations` expandido), risk_signals, anti-laranja, transferência D5, capability persistida (`company_type/concept→capabilities`).
- **Lembrete normativo:** migration só em ambiente recriado do zero; forward-only pós `GENESIS_CONSTITUCIONAL_v1` (Lei 2); tabela nova exige RFC/contrato (gate 2.3.2 / proibição 2.3.3). Dev hoje = 365.

## DTs que exigem Decisões

- **delete guard:** sem DECISION nem desenho — abrir antes de executar (Pilar 2).
- **PROVISIONAL→ACTIVE:** critério não promulgado.
- **Capability derivada:** D-CONCEPT / D-CONTEXT-RESOLVER (governa DT-COMPANY-3B3 + flags voláteis).
- **`item-comercial` vs `produtos-e-comercio`:** legitimar camada / absorver / separar via `layer` (resíduo de 0105; reflexo normativo em 18_DOMAIN_ONTOLOGY pendente).
- **Marketplace `hybrid`→trilhos** e **`MarketplaceDomain`→N0** (0106 mapa cravado; consumo pendente).

## STOPs para a executora futura

1. **NÃO começar `F-PJ-DOCUMENT-STORAGE-PORT`** antes da verificação READ-ONLY de 0112+§10 (trava ativa). A executora está parada por isso — respeitar.
2. **NUNCA** servir documento KYB por estático público (`/uploads/`); `file_reference` é opaco; arquivo bruto **fora do banco**; provider local **só em dev**, prod sem provider = **fail-closed** (D2/D3/D6/D13).
3. **NÃO** baixar/revisar documento real antes do malware scan (fatia 2 antes de download humano).
4. **Upload exige AUTORIDADE** (`canManageCompany`), não posse de ID; **download ≠ submit** (gates distintos). Upload **não** aprova KYB, **não** muda `company_status`/`kyb_status`.
5. **NÃO recriar `company_documents`** (tabela fantasma, morta) — SSOT é `fiscal_identity_documents`. O upload/readers/admin legados estão tombstonados (501); não reanimar.
6. **NÃO renomear/mover `financeiro-*`** em `concepts.domain` — é viga do Bank (hardcode). Mexer só com tratamento do hardcode.
7. **NÃO executar** eixo-A/marketplace/`hybrid`/Trilhos A/B/createCompany-vocab/elegibilidade de domínio antes da palavra de Clayton (0097/0098/0102).
8. **delete guard:** **abrir DT + desenho antes** de tocar `deleteCompany`; remover empresa com saldo/obrigações sem guard Bank = risco financeiro/causal.
9. **NÃO** fechar DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING sem provider vivo (decisão ≠ runtime).
10. **Padrão DOCS-ONLY × IMPLEMENTADO:** antes de "implementar" uma DT PJ, cruze (a) linha Status real no log, (b) Verificado em DECISOES.md, (c) probe ao schema. Muitas DTs PJ já estão CLOSED na prática (ex.: DT-PJ-IS-VERIFIED-DEPRECATED-COMPAT — coluna já dropada).
11. **NÃO** reabrir as ~30 DTs PJ CLOSED (nascimento atômico, casa fiscal, KYB writer/gate, segunda-verdade extinta, 5 writers neutralizados, publicação/revogação/cascata, CNAE/concept/labels, role/lifecycle DRAFT→PROVISIONAL) sem prova material de regressão.

---
_Última atualização: 2026-06-06 · HEAD `a312174a` · branch `rescue-structural` · dev 365 · análise Fechamento PJ._

---
<!-- append-only: acrescentado pela EXECUTORA unificard — 2026-06-06 — não editar/reescrever conteúdo do especialista -->

## Nota de coordenação — hardening futuro fiscal_identity_id

Registrar como sugestão de hardening futuro:

`DT-PJ-COMPANIES-FISCAL-IDENTITY-ID-NOT-NULL-HARDENING`

Contexto:
- `createCompany` é fiscal-first e cria `fiscal_identities` antes de `companies`.
- O banco vivo tem 0 companies com `fiscal_identity_id NULL`.
- Porém `companies.fiscal_identity_id` ainda é nullable.
- A garantia hoje está no código, não em constraint.

Regra:
Não abrir DT oficial agora. Registrar apenas como recomendação para consolidação futura.

---
<!-- append-only: acrescentado pela EXECUTORA unificard — 2026-06-06 — não editar/reescrever conteúdo do especialista -->

## Alerta de segurança para frente futura — F-PJ-KYB-DOCUMENTS-USER-SUBMIT

Origem: verdito ChatGPT sobre F-PJ-DOCUMENT-STORAGE-PORT (commit 900bd80b).

O `DocumentStoragePort` valida o `mimeType` RECEBIDO — aceitável NESTA fatia porque
ainda não há upload user-facing. Mas na futura `F-PJ-KYB-DOCUMENTS-USER-SUBMIT` a
rota NÃO pode confiar cegamente no MIME enviado pelo cliente/browser. Exigir lá:
- validar MIME declarado **E** assinatura/magic bytes quando possível;
- NÃO confiar em extensão;
- NÃO confiar em `originalFilename`;
- scanner (MalwareScanPort) ANTES de qualquer review/download humano.

Não é correção desta fatia (storage-port). É requisito de segurança da fatia
user-submit. Registrar como dependência/risco de escopo, não como DT oficial agora.

---
<!-- append-only: acrescentado pela EXECUTORA unificard — 2026-06-06 — autorizado por Clayton — não editar/reescrever conteúdo do especialista -->

## Nota de coordenação — actionContext.actorId sem ownership validado

Achado durante `F-PJ-KYB-DOCUMENTS-USER-SUBMIT` (confirmado por executora + verificadora no código):
`req.actionContext.actorId` pode ser **spoofável** em rotas user-facing se não houver validação
explícita `actor↔req.user`. O `action-context.middleware.ts` exige `actorId` (header/body/query) e
valida só formato/scope⊇tenant — **sem SELECT em actors, sem checar contra `req.user`**.

Risco:
Qualquer rota NÃO-admin que use `actionContext.actorId` como autoria soberana pode aceitar autoria
indevida (atribuir ação a outro actor). As rotas admin se salvam por `requireRole(['admin'])`, mas o
padrão é frágil.

Aplicação imediata (decisão de Clayton — opção B):
Na rota user-facing de documentos KYB, usar `req.user.userId → ensureUserActor()` para a autoria, e
depois validar autoridade sobre a empresa (`companyId → fiscal_identity_id` + `canManageCompany`).

Sugestão futura (NÃO abrir agora):
Avaliar DT oficial `DT-PJ-ACTIONCONTEXT-ACTOR-OWNERSHIP-UNVALIDATED`. Não corrigir globalmente nesta
fatia. Apenas memória; não editar REMEDIATION_DT_LOG agora.
