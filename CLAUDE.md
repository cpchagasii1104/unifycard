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
| **Fundo regional / território** | `DECISION-0049` · `DECISION-0192` (sujeito territorial = **comprador**) · `DECISION-0177` |
| **Grupos / economia de grupo** | 🔴 `docs/01_normative/CONTRATO_GRUPOS_V2.md` — **é LEI**, com cláusula *"implementação que contradiga é BUG por definição"* |
| **Categoria no split** | `DECISION-0048` — categoria **seleciona** policy; **não** calcula split; **não** é identidade |
| **Ontologia / N0-N1-N2** | `18_DOMAIN_ONTOLOGY_UNIFICARD.md` — N0/N1/N2 são **navegação** e **NUNCA** participam de roteamento financeiro |
| **Identidade semântica** | Lei 7 — CONCEPT é o SSOT; `categories` é árvore; `slug`/`metadata` **nunca** são identidade |
| **Migrations** | Lei 2 — **forward-only**; tag `GENESIS_CONSTITUCIONAL_v1` existe; **nunca** editar migration existente |
| **Votação / enquete / pauta** | Já existem **3** substratos + vocabulário promulgado (`START_VOTE`, `VOTE_REGISTERED`, `poll`, domínio `votes` em `MAPA_CANONICO_PERMISSIONS_v1.md`). **Não crie o 4º.** |
| **O que está vivo HOJE** | `REMEDIATION_DT_LOG.md` — **leia o topo** |

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

## 6. Ao registrar

Escreva no cartório **durante** a fatia, não depois. O registro não é para o dono — é **para o próximo você**, que não vai lembrar de nada disto.
