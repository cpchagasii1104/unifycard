# CLAUDE.md — leia antes de propor qualquer coisa

> **Este arquivo NÃO é fonte de verdade.** Ele é um **roteador**: aponta para os documentos que já decidem. Se algo aqui contradisser `docs/01_normative/` ou `docs/02_decisions/`, **a norma vence** e este arquivo está errado — corrija-o.

## 1. Sua condição

Você chegou com capacidade total e **memória zero**. O UnifiCard tem anos de decisão acumulada e passou por 3 reconstruções. Quase tudo que vai te parecer *faltando*, *estranho*, *mal resolvido* ou *boa ideia nova* **já foi pensado e decidido** — frequentemente pelo dono do projeto, e frequentemente **já está escrito**.

A continuidade não vive em você. Vive no **cartório** (`REMEDIATION_DT_LOG.md`, topo = mais recente), em `docs/01_normative/` e em `docs/02_decisions/`.

**As normas existem para que o sistema não seja redecidido por quem chegou hoje.** Quem chega hoje é você, toda vez.

## 2. A pergunta que você faz PRIMEIRO

> ❌ "Como eu construo isso?"   ·   ✅ **"Onde isso já existe?"**

Antes de escrever *"falta X"*, *"não existe X"*, *"precisa criar X"* — **prove** que X não existe sob outro nome, em outro módulo, ou dormente. Enquadre como **"existe em `arquivo:linha`, no lugar errado / não religado"**.

**Um "não existe" falso é o erro mais caro possível aqui**, porque cria uma **segunda verdade** — e duas verdades sobre *"para quem vai o dinheiro"* divergem em silêncio até ninguém saber qual manda. O trabalho padrão neste repositório é **RELOCAR lógica que funciona**, não autorá-la.

Ao despachar subagente, escreva o mandato como **inventário-primeiro, desenho-nunca**.

## 3. Roteamento — assunto → fonte que JÁ decide

| Vai mexer em… | Leia ANTES |
|---|---|
| **Qualquer coisa** | `docs/01_normative/00_AGENT_PROTOCOL.md` §2.2 (prova de rastreabilidade) + §2.3.2 (GATE antes de alterar tabela/SSOT) |
| **Dinheiro / split / saldo** | pacote §8 obrigatório: `SSOT_EXCLUSIVE_BANK_RULE.md` · `SSOT_CONTRACT.md` · `SSOT_REGISTRY_UNIFICARD.md` · `PROHIBITED_STRUCTURES.md` |
| **Percentuais / política econômica** | `DECISION-0166` — D1 base · D6 *admin configura, admin NÃO move dinheiro* · D7 ordem · D8 painel |
| **"100% de quê?" · base do split · sobra do centavo** | ✅ `DECISION-0194` **SELADA 2026-07-28** — D2 *uma base por policy, misturar é PROIBIDO* · D3 *duas etapas encadeadas* · D1.1 *custo operacional sai ANTES, não-votável e visível* · D3.1-BIS *sobra = linha `revenue_share` bps=0 com destino de custo*. ⚠️ **Doutrina selada ≠ código conforme** — motor ignora `applies_to`, validação sem trava de base única, allowlist vazia. Ver a tabela do selo no cartório antes de presumir conformidade. |
| **Fundo regional / território** | `DECISION-0049` · `DECISION-0177` · ⚠️ `DECISION-0192` **NÃO-SELADA · REPROVADA (veredito C) na auditoria de 2026-07-27** — reverte silenciosamente 0166 D8 e apaga o ramo PJ de 0166 D0. **NÃO é autoridade de roteamento até correção+selo.** Vale 0166/0177. |
| **Grupos / economia de grupo** | 🔴 `docs/01_normative/CONTRATO_GRUPOS_V2.md` — **é LEI**, com cláusula *"implementação que contradiga é BUG por definição"* |
| **Categoria no split** | `DECISION-0048` — categoria **seleciona** policy; **não** calcula split; **não** é identidade |
| **Ontologia / N0-N1-N2** | `18_DOMAIN_ONTOLOGY_UNIFICARD.md` — N0/N1/N2 são **navegação** e **NUNCA** participam de roteamento financeiro |
| **Identidade semântica** | Lei 7 — CONCEPT é o SSOT; `categories` é árvore; `slug`/`metadata` **nunca** são identidade |
| **Migrations** | Lei 2 — **forward-only**; tag `GENESIS_CONSTITUCIONAL_v1` existe; **nunca** editar migration existente |
| **Votação / enquete / pauta** | Já existem **3** substratos + vocabulário promulgado (`START_VOTE`, `VOTE_REGISTERED`, `poll`, domínio `votes` em `MAPA_CANONICO_PERMISSIONS_v1.md`). **Não crie o 4º.** |
| **"onde isso já existe?" — QUALQUER assunto** | 🔴 `docs/04_audit/INDICE_ONDE_ESTA_O_QUE_2026-07-29.md` — assunto → documento que governa, com **status e data**. Inclui as armadilhas: `0191` tem header mentindo "não-selada" (está selada); `DECISION-0020` é citada e **não existe**; `10_EVENTS_CANONICA` **não é** sobre eventos-produto. **É ponteiro, não fonte** — norma vence. |
| **O que está vivo HOJE** | 🔴 `docs/04_audit/PAINEL_DIVIDA_VIVA.md` — **é O PLACAR** (decisão de Clayton, 2026-07-30): estado atual, números medidos com data, registro de sessões. Cabe na cabeça. Toda fatia que fecha dívida atualiza ele. |
| **História, causa-raiz, provas** | `REMEDIATION_DT_LOG.md` — **leia o topo**. É cartório append-only, **não é placar** |
| ⛔ **`dividatecnica.md`** | **HISTÓRICO.** Declara-se obrigatório e mentiu por 24 dias (placar de 06/07 dizendo 163 guards quando eram 227). Evidência sim, estado atual **não**. Não atualize — atualize o PLACAR |

## 3.1 ☠️ ANTES DE RODAR MIGRATION — NUNCA contra `unificard_dev`

`unificard_dev` é o **banco OFICIAL** desde 2026-07-29 (`DT-OFFICIAL-DATABASE-LOCK-FAIL-CLOSED`)
e contém dado curado insubstituível: **75 bairros de Curitiba** (N3 selada, *"NUNCA recarregar"*),
48 policies, 3 grants, a conta do fundo regional. **Apagá-lo é perda irreversível.**

Validação de migration é em **banco efêmero**, criado e destruído na hora — o mecanismo é
`EXPECTED_DATABASE_NAME`, exercido pelos harnesses `run-*-ephemeral.ps1`. A regra está em
`docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md` → "REGRA DE AMBIENTE (CRÍTICA)".

> ⚠️ **Correção deste parágrafo em 2026-07-31.** Até hoje esta seção avisava que a Lei mandava
> `dropdb unificard_dev` e pedia para desobedecê-la. **A Lei já tinha sido corrigida em
> `4060df0a2`** (autorizada por Clayton) e hoje diz o contrário — "⛔ NUNCA contra
> `unificard_dev`" — preservando o texto antigo num bloco de histórico. Este arquivo ficou
> avisando de um perigo que já não existia. **Roteador que descreve norma vencida é a mesma
> doença que ele existe para evitar** — se você achar outra divergência entre este arquivo e
> `docs/01_normative/`, a norma vence e é este arquivo que se corrige.

## 4. Armadilhas — parecem indecididas e NÃO são

- **`user_group_allocation`** ("usuário escolhe doar X% do que gasta"): **REVOGADO POR LEI** (`CONTRATO_GRUPOS_V2` — *"não é fonte do split comunitário, dívida a aposentar"*). O modelo correto é **PULL por membership**. A tabela **nem existe** no banco vivo. Não ressuscite.
- **Percentuais 70/3/10/17, 97/3, 5% de indicação**: são **defaults hardcoded de desenvolvedor** em `bank-split-engine.service.ts`, **NUNCA ratificados**. Tornar configuráveis = certo. Tratar como decisão do dono = **falso**.
- **Motor legado ≠ canônico.** `bank-split-engine.service.ts` é legado, cercado por tripwire. O canônico é `economic_policy_engine` + PE-3 → `createTransactionWithExplicitSplitLines`. **Não faça o legado ler policy** — `DECISION-0048` removeu `resolveSplitPolicy` e o arquivo diz *"NÃO reintroduzir"*.
- **Comentários podem MENTIR.** Casos reais confirmados: `regional-fund-governance.service.ts` diz que filtra elegibilidade "por região" e **a query não filtra região nenhuma**; `user-group-allocation.service.ts` se anuncia *"CONTINUOUS PRODUCTION"* estando revogado. **Confirme no código, não no comentário.**
- **Bloqueios podem estar VENCIDOS.** Ex.: o hold do nível `neighborhood` alega *"catálogo de bairros não governado"* — mas os 75 bairros oficiais de Curitiba foram selados (frente N3). Sempre verifique se a justificativa de um bloqueio ainda é verdadeira **e** se havia outras causas não resolvidas.
- **Cap de participação em grupos = 3** (D12/`DECISION-0188`), vivo com trigger/lock — não é configuração.
- **Janela de indicação:** 1 ano está vivo e hardcoded; a de 5 anos é **PENDENTE, nunca promulgada** (`DECISION-0139`).

## 5. O rito (não se autorize)

**GATE** (read-only, mapa) → **GO do dono** → **executora** (escreve) → **verificação de 1ª mão da direção** → **auditoria independente** → **selo docs-only** no cartório.

- Executora que bate em **pin de campanha selada**: **para e reporta**. Reconciliar pin é ato da direção.
- Executora cujo **próprio código** viola regra existente: **conserta sozinha**.
- **Um guard que nunca falha é decoração** — force o vermelho antes de confiar nele.
- **Deleção de módulo pré-existente exige autorização explícita do dono**, mesmo com decisão que a justifique.
- Windows: `Write`/`Edit` geram **CRLF** — normalize para LF e rode `git diff --check` antes de commitar.
- Rode o **runner completo** (`npm run validate:regression-guards`), não só o E2E da sua fatia.

## 6. A regra do acesso (DECISION-0193 · protocolo §7.1)

⚠️ **DECISION-0193 está NÃO-SELADA (veredito B em 2 auditorias) — isto é orientação, não lei, até correção+selo.**

**Tocou um arquivo em trabalho real e descobriu qual norma o governa? Deixe a migalha antes de sair** — 5 linhas, teto duro:

```
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO | LEGADO-CERCADO | DORMENTE | CONTIDO | REVOGADO
// ║ NORMA:   <caminho real do documento que governa>
// ║ NÃO:     <o que não fazer aqui>
// ║ EM VEZ:  <o caminho correto, NOMEADO>
// ╚════════════════════════════════════════════════════════════════
```

Sem campanha, sem varredura — só de carona no trabalho que já ia acontecer. **`EM VEZ` é obrigatório**: dizer "não" sem dizer "faça isto" é o que faz a IA seguinte inventar um terceiro caminho. **Anote só o que verificou** — cabeçalho falso é pior que ausente. **Achou comentário que mente? Corrigir é obrigatório.**

## 7. Ao registrar

Escreva no cartório **durante** a fatia, não depois. O registro não é para o dono — é **para o próximo você**, que não vai lembrar de nada disto.
