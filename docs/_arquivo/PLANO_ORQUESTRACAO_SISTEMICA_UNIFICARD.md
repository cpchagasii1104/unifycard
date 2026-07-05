# PLANO DE ORQUESTRAÇÃO SISTÊMICA — UNIFICARD

**Status:** DESENHO CONSOLIDADO · RATIFICADO (Opus + ChatGPT + Clayton) · **NÃO é saída de executora**
**Natureza:** plano/arquitetura. Nenhuma migration, nenhum código, nenhum SSOT alterado por este documento.
**Escopo:** orquestração transversal (demanda↔oferta) sem dinheiro externo, sem PORTA-1/worker/PIX/TED/PSP, sem UnifyCard físico.
**Precedência:** subordinado a `Constituição → Leis Operacionais → SSOT Registry → 18_DOMAIN_ONTOLOGY → demais`. Em conflito, a norma de nível mais alto prevalece e a IA não resolve sozinha.
**Estado de execução:** **HOLD** antes da macro 1. Primeira coisa executável = **U1** (reconciliação técnica do vocabulário do grafo), decisão-independente de conteúdo.

> Este plano foi construído READ-ONLY, com verificação direta no disco (SRC/MIGRATIONS/NORMATIVE) e no texto das normas. Onde o disco divergiu de relatos anteriores, o disco venceu. As referências `arquivo:linha` são âncoras de verificação, não citações decorativas.

---

## 1. PRINCÍPIO FUNDAMENTAL

**Orquestração não é um módulo mágico novo. Orquestração é a cadeia causal do sistema funcionando em sequência.** O sistema não "dá match" por cima de tudo: ele sobe, degrau por degrau, os pilares da Lei de Coerência, e cada pilar responde **uma** pergunta e entrega um conjunto **filtrado** para o próximo. O nó final é **humano** (blindagem).

A espinha é literal, do texto da Lei de Coerência Sistêmica (§4, linha 466):

```
SEMÂNTICA (CONCEPT §4.10) → IDENTIDADE (actors §4.8) → AUTORIDADE (§4.9) → TEMPO → ESTADO → FINANCEIRO → EVENTO
```

Por isso o plano respeita as leis **por construção, não por remendo**: a ordem das frentes É a ordem causal da lei.

Princípio-raiz preservado: *o sistema é único; nenhuma camada pode criar realidade paralela; nenhuma estrutura derivada vira autoridade por acidente* (Lei de Coerência §2.1 e regra final).

---

## 2. COMO FUNCIONA O "CASAMENTO" ENTRE QUEM PROCURA E QUEM FORNECE

O exemplo é o casamento, mas **a máquina é idêntica** para bar/show/churrasco/obra/contratação. Um Actor expressa uma **intenção** (um concept). A partir daí, a escada:

**1. SEMÂNTICA — compor a demanda.**
O *needs graph* decompõe o concept-intenção lendo `concept_relations` (global, governado):
`casamento requires local · requires buffet · requires fotografia · requires música · requires decoração · related_to beleza · related_to transporte`.
Projeção **read-only** do grafo — nenhum fornecedor tocado, nenhuma tabela de demanda criada. Pela `SERVICE_CANONICO`, a demanda **não é entidade de Evento/RFQ**; é a necessidade do Actor projetada sobre o grafo global de concepts.

**2. IDENTIDADE + DESCOBERTA — quem faz (`services`).**
Para cada need-concept, consultar o índice soberano de **descoberta** `services` (`actor_id`; COMMENT da tabela: *"Oferta de serviço por actor (MVP CORE); usada por descoberta"*): quem promete esse serviço, **por região** (`city_id`/`neighborhood`). Read-only, **sem ranquear**. É a **primeira metade do casamento**: need-concept → prestadores candidatos.

**3. CONTRATAÇÃO — o que exatamente vende (`service_offerings`).**
Para cada candidato, consultar `service_offerings` (`provider_actor_id`, FK→`services`): pacotes concretos — `price_cents` (BIGINT), `duration_minutes`, `modality`, `status`. **Segunda metade**: de "quem" para "qual oferta concreta contratável".

**4. TEMPO — quando (filtro transversal).**
Cruzar cada `service_offering` com `unified_availability` (`owner_type='service_offering'`): livre na data/hora do evento? Local livre? Banda livre? **Oferta sem tempo disponível não é oferta real** — candidato ocupado cai fora. Tempo no SSOT temporal (DECISION-0132), **não duplicado** na oferta.

**5. AUTORIDADE — pode contratar.**
Descoberta read-only não exige autoridade; a **ação de contratar** exige (`canRepresentActor` para PJ; o gate accept-quote / R7b / DECISION-0110). Autoridade vem **antes** de mexer em ESTADO.

**6. Afunilamento — filtrar/ordenar por critério explícito do usuário (ainda read-only, ainda sugestão):**
raio → **reputação** (read-model observacional — filtro, nunca autoridade) → **preferência** do usuário (gênero quando aplicável, estilo musical) → **orçamento** → **comissão/split** que *vai* incidir (`economic_policy_engine`, fee em bps — exibido para o usuário saber o custo).

**7. ESTADO — o usuário escolhe.**
**Blindagem absoluta:** o sistema **filtra e ordena candidatos válidos; nunca crava o fornecedor final.** A escolha humana vira `service_booking_decisions` (humano-explícito) → booking / `service_order` (mutação de ESTADO).

**8. FINANCEIRO — depois, separado.**
Dinheiro (split/escrow/ledger) só no/após contratar, via `bank_ledger` SSOT, lendo **`service_offerings.price_cents`** (BIGINT, preço faturável canônico) e `economic_policy_engine` para o bps. Fiação financeira **diferida** (DT-D2-WIRING-MONEY-PENDING; `mockUnifyCardCharge` é o bloqueador de produção).

**9. EVENTO — registra, não causa.**
Feed/notificações **registram** o que aconteceu (booking feito, quote aceito). Pela lei, **evento registra decisão já tomada nas camadas anteriores; nunca causa**. A divulgação na rede social é projeção.

> **Casamento em uma frase:** o sistema sobe `SEMÂNTICA → IDENTIDADE → oferta → AUTORIDADE → TEMPO → reputação/preço/política → ESTADO`, **filtrando** a cada degrau; quem **casa** é o humano. Demanda e oferta se encontram pela **ponte Service**, no tempo do SSOT temporal, com o dinheiro num lugar só.

---

## 3. UM SUBSTRATO, N VERTICAIS (ANTI-FRAGMENTAÇÃO)

Casamento, bar, show, churrasco, obra, contratar-profissional, equipe-temporária — **todos usam a mesma escada**. A diferença é apenas: (a) o concept de entrada, (b) a árvore de necessidades, (c) quais need-concepts o compõem.

```
casamento : local, buffet, fotografia, música, decoração, beleza, transporte...
show/bar  : banda, som, iluminação, segurança, ingresso, limpeza, atendimento...
churrasco : local, carne, bebida, carvão, convidados, vaquinha...
obra      : pedreiro, material, etapas, entrega, vistoria... (+ projeto/etapas/pagamento-futuro: macro futura própria)
```

A máquina é a mesma; muda o concept de entrada e as relações do grafo. Isso evita o sistema virar um **Frankenstein de verticais** e materializa a regra: *se dois módulos escrevem na mesma verdade central, são contextos do mesmo substrato — não recriar SSOT por vertical.*

**A demanda** segue a `SERVICE_CANONICO`: na macro 1 ela é **efêmera** (o needs graph produz o need-set na hora, nada persistido). Se mais tarde precisar persistir (ex.: casamento com N quotes coordenados), nasce **ancorada no Actor** que pede — com Service como ponte oferta↔demanda e eventos/work/commerce como **contextos** — **substituindo** os três substratos hoje fragmentados (`events.metadata.rfqs`, `work.jobs`, `intent/execute`), **nunca adicionando um 4º**.

---

## 4. O ÍNDICE DE OFERTA (DECISÃO PROMULGÁVEL — DECISÃO #2)

Quatro representações, **uma SSOT por verdade** (sem realidade paralela):

| Camada | Papel | Natureza | Evidência |
|--------|-------|----------|-----------|
| `company_concept_publications` | **SSOT de publicação PJ por conceito** ("a empresa atua com flores/decoração") | declaração institucional | verificado |
| `tenant_concept_offerings` | **vitrine / read-model derivado — NUNCA SSOT** | projeção | rebuild script: *"é READ-MODEL derivado — NÃO SSOT"* |
| `services` | **índice soberano de DESCOBERTA** ("quem faz o quê" — a ponte da `SERVICE_CANONICO`; o que o RFQ consulta) | promessa indexável | `services` CREATE (linha 9147); COMMENT "usada por descoberta" |
| `service_offerings` | **unidade soberana de CONTRATAÇÃO/AGENDA** (preço, duração, modalidade, status, disponibilidade) | oferta concreta | CREATE (linha 22494); DECISION-0117 |

**Soberania por fase** (o próprio disco já a escreve, migration linha 23128): *"comercial/agendável canônica (service_offerings)… service_id permanece legado/projeção"* na cadeia decision/order; e a `SERVICE_CANONICO` faz de `services` a ponte de descoberta. Logo:
- `services` responde **"quem faz?"** (descoberta).
- `service_offerings` responde **"qual pacote concreto, agendável e contratável?"** (contratação). Tem FK `service_id → services` (a oferta é filha da promessa).

**Duas precisões que o schema já resolve:**
1. **Preço não é verdade dupla.** `service_offerings.price_cents` = **BIGINT NOT NULL** (preço faturável canônico). `services.price_cents` = **INTEGER nullable** (indicativo/"a partir de"). O fluxo financeiro lê **sempre** `service_offerings.price_cents`. (Acompanha a correção de nomenclatura — ver §6.)
2. **Tempo não duplica.** Disponibilidade vive em `unified_availability` com `owner_type='service_offering'` (DECISION-0132). Discovery intersecta `service_offerings × unified_availability`; a oferta nunca armazena tempo.

---

## 5. SEQUÊNCIA DE CONSTRUÇÃO (A ESCADA, DEGRAU POR DEGRAU)

### MACRO 1 — F-ONTOLOGY-COMPOSITION-NEEDS-GRAPH *(SEMÂNTICA — próximo passo)*
A **cabeça** da orquestração. Decisão-leve. Duas unidades atômicas separadas:

- **U1 — reconciliação técnica do vocabulário (sem Clayton):** widening `concept_relations` 3→6 nos **três pontos juntos** — CHECK do banco + `GraphRelationType` (`graph.adapter.ts:9`) + `RELATION_TYPES` (`graph-governance.service.ts:9-17`). **Apenas os 6 tipos normados** (§6.2): `enables, requires, evolves_to, related_to, part_of, substitutes` — **sem `suggests`**. Forward-only (0 rows). Preserva o caminho governado (trigger `0077` exige `app.graph_governance='true'`). É conformidade `NORMA→código`, decisão-independente.
- **U1b — seed + projeção (depende de Clayton):** semear **UMA** árvore curada (vertical-piloto) pelo writer governado; projeção **read-only** `intent-concept → need-concepts` (servível só com `concept_relations`+`concept_labels`+`concepts`, **sem tabela nova**).

**Qualidade-de-referência (como fazer, não nova frente):** o grafo deve nascer com **proveniência e governança** — cada aresta com origem/razão/versão e revisão governada — para crescer **com confiança**, respeitando DECISION-0070 (sem runtime/IA/frontend criando taxonomia). Cabe dentro do writer governado.

**Fora de escopo (rígido):** matching, ranking, fornecedor, oferta, RFQ, presença, dinheiro.
**Gate:** 4 gates CI verdes; `architecture:strict critical_new=0`; negative-proof (seed sem `set_config` → trigger bloqueia).

### MACRO 2 — F-OFFER-SSOT-CONVERGENCE *(oferta sobre SEMÂNTICA + IDENTIDADE)*
Cravar o índice de §4 (services=descoberta, service_offerings=contratação, publications=SSOT PJ, tenant_concept_offerings=read-model). Convergir descoberta/RFQ para ler `services`; contratação lê `service_offerings`; **guard de separação de fase** (condição de coerência — os dois `status` não podem criar verdade paralela). Fechar `services.price_cents` **INTEGER→BIGINT ou depreciar** (§4.7). Semear offerings do piloto. **Sem ranking automático de fornecedor final.**

### MACRO 3 — F-PRESENCE-SSOT-DECISION-PACK *(decisão, não build)*
Resolver `DT-PRESENCE-FRAGMENTATION-CONFIRMED` + `DT-OPERATIONAL-BINDING-FRAGMENTATION`. Presença está **fragmentada** (não simplesmente quebrada) em modelos concorrentes/distintos:

| Modelo | Estado | Camada |
|--------|--------|--------|
| `live_presence` | LIVE | status online/offline |
| `event_checkins` | TOMBSTONE — **vigente SEM `checked_out_at`** (linha 13393); `checkOut()` quebra | presença por ingresso |
| `presence_rsvps`/`checkins`/`checkin_tokens`/`promo_benefits` | SCHEMA_GHOST — 0 CREATE vigente, **rotas montadas** (`marketplace.routes:139`) quebram | RSVP/check-in social |
| `cultural_event_checkins` | TOMBSTONE — só em archive | check-in cultural |
| `OperationalCommitment` | NORMADO, value-free (linha 2265) — **sem tabela própria**; grava em `event_staff` de forma **incompatível** (CHECK `active/inactive/cancelled` rejeita `expected/checked_in`) | vínculo de execução |

Recomendação (read-only, a ratificar por Clayton): **duas camadas** — `live_presence` = status; `OperationalCommitment` = vínculo de execução; **desqualificar `event_checkins` como ponte**. Decidir persistência do OC (tabela `operational_commitments` vs estender `event_staff`). **Sem implementar.**

### MACRO 4 — F-PRESENCA-EXECUCAO-OPERATIONAL-COMMITMENT-BRIDGE *(TEMPO/ESTADO/EVENTO — não-money)*
Após a decisão: materializar OC, corrigir persistência, bridge ao `service_order` (`actual_start_at`/`actual_end_at`; gate presença→completion), authority gate nos check-ins (confused-deputy), validação bilateral.

> **Frase cuidadosa (guard):** presença/jornada validada produz **estado operacional de execução concluída** — condição **necessária** que **destrava** a contratação/completion. **Dinheiro é evento separado, a jusante, no `bank_ledger`.** Presença **nunca cria crédito**; apenas habilita o financeiro a poder prosseguir. `service_orders` hoje **não tem** consciência de presença (`completeOrder` é status+authority); o bridge fecha isso sem mover dinheiro.

### MACRO 5 — F-ORCHESTRATION-ENGINE-V1 *(composição transversal — por último)*
Só depois de 1–4. O motor que roda a escada inteira. **Orquestra SSOTs existentes** — é o maestro, não um instrumento novo (não cria realidade paralela). Aqui, se necessário, nasce o substrato de demanda Actor-anchored.

### MACRO 6+ — FIAÇÃO FINANCEIRA *(FINANCEIRO — selado/diferido)*
`escrow→actor_wallet` (DT-D2-WIRING-MONEY-PENDING); substituir `mockUnifyCardCharge`. **Muito depois, decisões próprias:** UnifyCard físico/POS, external rail (PIX/TED/PSP), PORTA-1 seed, worker arming. **Nenhum por carona.**

### TRACK PARALELO — HIGIENE *(decisão-independente, P2-separado da orquestração)*
Conter rotas `/marketplace/presence/*` quebradas (padrão 501); corrigir `event_sessions` no código (`start_time`/`end_time` → `starts_at`/`ends_at`, §4.6); documentar tombstones.

---

## 6. CONFORMIDADE COM AS LEIS (AUDITORIA)

### Lei de Coerência Sistêmica — RESPEITADA
- **Ordem causal (linha 466):** a sequência das macros **É** a cadeia `SEMÂNTICA → IDENTIDADE → AUTORIDADE → TEMPO → ESTADO → FINANCEIRO → EVENTO`. Macro 1 = SEMÂNTICA; macro 2 = oferta sobre semântica+identidade; macros 3-4 = TEMPO/ESTADO/EVENTO; macro 5 = composição; macros 6+ = FINANCEIRO diferido. O plano nunca inverte a ordem; "CONCEPT antes de inferência de mercado".
- **Soberania / sem realidade paralela (§2.1, regra final):** uma SSOT por verdade (§4). `tenant_concept_offerings` read-model-nunca-SSOT (§linha 2089). Reputação read-model (§linha 2124). Tempo no SSOT temporal, não duplicado.
- **Condição de enforcement (macro 2):** os dois `status` (`services` vs `service_offerings`) exigem **guard de separação de fase** para que divergência não vire verdade paralela (§2.2: schema/FK/writer/gate/guard). Compliant **por desenho**; a execução precisa materializar o guard.
- **Identidade vem de CONCEPT, não de category (linha 777):** needs graph e ofertas referenciam `concept_id`/`canonical_service_id`, nunca `categories.concept_id`.
- **Evento não causa; fronteira financeira intocada (§4.6):** nada acede `bank_ledger` fora do Bank; presença value-free (linha 2265).

### 07_NOMENCLATURA_CANONICA — RESPEITADA, com 2 drifts pré-existentes
- **Dinheiro = BIGINT `_cents` (§4.7, linha 3002):** `service_offerings.price_cents` BIGINT ✓; **`services.price_cents` INTEGER ✗** (drift pré-existente, campo não-autoritativo) → fechar na macro 2 (preferência: **depreciar**).
- **Timestamps `starts_at`/`ends_at` (§4.6):** schema conforme; **drift de código** em `event_sessions` (`start_time`/`end_time` proibidos) → track de housekeeping.
- **`relation_type` (§6.2):** widening para os **6 tipos normados** e remoção do `suggests` = **conforme** (a remoção do `suggests` foi alinhamento de nomenclatura).

---

## 7. AS TRÊS BLINDAGENS (GUARDS RATIFICADOS)

1. **U1 técnica é decisão-independente.** A reconciliação 3→6 é conformidade `NORMA→código`; não depende de vertical-piloto. Só U1b (seed) depende de Clayton.
2. **Ranking = filtrar/ordenar por critério explícito do usuário; PROIBIDO o sistema escolher o fornecedor final.** Pode mostrar "fotógrafos no Batel, livres no dia, bem avaliados, no orçamento". Quem escolhe é o usuário.
3. **Presença ≠ crédito.** Presença/jornada validada = estado operacional de execução concluída; dinheiro nasce **depois**, no fluxo financeiro próprio (`bank_ledger`). Presença habilita, não credita.

---

## 8. DECISÕES DO CLAYTON (O QUE TRAVA O QUÊ)

**Travam a MACRO 1 (próximo passo) — leves:**
- **(5) Grafo de composição GLOBAL ou TENANT?** O schema só comporta GLOBAL hoje (`0092_global_semantic_graph.sql` dropou `tenant_id`). Ratificar global-canônico, ou exigir override por tenant (mudaria a fundação 0092).
- **(6) Vertical-piloto:** casamento / bar-show / obra.
- **(3) Conteúdo da árvore + tipo por aresta:** quais needs por concept e **qual relação normada para cada** (`requires` vs `related_to` por need — modelagem de domínio, decisão de produto).

**Travam macros POSTERIORES — pesadas (não travam a macro 1):**
- **(1) Ranqueamento de fornecedor:** sugere/ranqueia vs só lista (norma já proíbe auto-escolha do final).
- **(P4 + P5) SSOT de presença + SSOT de vínculo + persistência do OC** (relação presença-por-ingresso × presença-de-execução; `operational_commitments` vs estender `event_staff`; status enum nos vínculos).

**Já decidido:** **(2) Índice de oferta** (§4 deste plano).

---

## 9. MODELO DE GOVERNANÇA

- **Opus (Claude chat):** auditor / coordenador estratégico. Dá veredito, escreve prompts, audita resultados. **Nunca se auto-aprova nem promulga.**
- **ChatGPT (aba separada):** ratificador independente (`APPROVED/BLOCKED` + razão).
- **Claude Code / Executora:** implementa prompts controlados, executa em disco, reporta saída crua, **não decide arquitetura, não se auto-aprova**.
- **Clayton:** **única autoridade de promulgação.** Nenhuma decisão é vinculante sem sua palavra explícita.

**Regra anti-quebra:** todo prompt de execução que dependa de ratificação carrega no topo `NÃO EXECUTAR AINDA — LEVAR AO CHATGPT PRIMEIRO`.
**Epistemologia:** `disco vence narrativa`; evidência = `arquivo:linha` + migration + rowcount; `DEV vazio = inconclusivo, não limpo`; relatos de executora/auditoria não são evidência — só verificação direta é. *(Esta sessão registrou correções diretas no disco, inclusive de afirmações do próprio Opus — o que valida o modelo: nenhuma instância se auto-aprova.)*

---

## 10. O QUE O PLANO NÃO FAZ

Não nasce pelo motor genérico. Não abre dinheiro externo. Não cimenta Evento como dono da demanda. Não cria 4º substrato de demanda nem 5º de presença. Não ranqueia/escolhe fornecedor final sem decisão. Não trata presença como crédito. Não expande escopo nem inventa vertical (§4 das normas). **O sistema filtra e sugere; o humano casa.**

---

## 11. RESÍDUOS / DTs A NÃO ESQUECER

- `DT-PRESENCE-FRAGMENTATION-CONFIRMED` (+ `-FRAGMENTED-NO-RUNTIME`) — fragmentação de presença.
- `DT-OPERATIONAL-BINDING-FRAGMENTATION` — 6+ tabelas "X tem papel em Y"; autoridade sobre PJ/equipes.
- `DT-D2-WIRING-MONEY-PENDING` — fio `escrow→actor_wallet` (financeiro diferido).
- `DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD` (OPEN) — fee bps.
- SSOT de oferta SPLIT (`services` vs `service_offerings`) — resolvido neste plano (§4), a materializar na macro 2.
- ABSENT-MODEL de demanda composta + drift do CHECK do grafo — endereçados nas macros 1/5.
- `accept-quote` 403 contido (R7b / DECISION-0110) — gate de materialização da contratação.
- `mockUnifyCardCharge` — bloqueador de produção do financeiro.

---

## 12. POR QUE ISTO TENDE A "REFERÊNCIA" (E POUPA HORAS)

Não por mais features — pela **restrição disciplinada** e por propriedades que já estão no desenho:
1. **Orquestração legível, não matching opaco.** Cada candidato é explicável ("faz fotografia de casamento → tem pacote 4h → livre no teu dia → atende o Batel → bem avaliado"). Explicabilidade + escolha humana final é diferencial raro numa era de IA caixa-preta.
2. **Tempo transversal.** Filtra por disponibilidade real **antes**; "oferta sem tempo não é oferta real".
3. **O grafo como ativo que acumula.** Substitui horas de pesquisa de *"do que eu preciso?"* — e, com a antecipação (conceito já estabelecido), sugere o próximo need antes de você pedir, **dentro da blindagem** (sugere need, não fornecedor).
4. **Dinheiro voltando para a região.** O fundo regional é a alma — o que faz disto um sistema, não um extrator. Diferido, mas é o propósito.

---

## 13. STATUS HONESTO E PRÓXIMO PASSO

Este é o **plano/desenho** consolidado e ratificado — **não** saída de executora (não existe). As condições de enforcement (guards) são o que a **execução** precisa cumprir; não foram verificadas prontas porque o trabalho não foi feito.

**HOLD** mantido. **Primeira coisa executável: U1 — reconciliação técnica do vocabulário do grafo 3→6** (conformidade de norma, decisão-independente de conteúdo).

**Caminho:** Clayton decide (5) global-vs-tenant, (6) vertical-piloto, (3) árvore + tipo-por-aresta → ChatGPT ratifica o plano e o prompt → Opus monta o prompt cirúrgico de U1 → Executora roda → 4 gates verdes → e **nada roda sem a palavra de Clayton**.

**Cérebro primeiro (com o grafo nascendo confiável). Marketplace depois. Presença depois. Dinheiro só quando o cofre mandar.**

---

## 14. CANAL DAS INSTÂNCIAS — BARRAMENTO ÚNICO (sob coordenação da IA-DIRETORA)

> 🔁 **O BARRAMENTO MUDOU (2026-06-20) — leia antes de responder.** A comunicação agora vive em
> **`docs/orquestracao/`** (um arquivo por IA, sem colisão). A partir da SUA PRÓXIMA ativação:
> 1. leia **`docs/orquestracao/METODO.md`** (protocolo) e sua tarefa em **`docs/orquestracao/INBOX.md`**;
> 2. escreva sua resposta em **`docs/orquestracao/respostas/IA-<SEU-NOME>.md`** (crie se não existir), carimbada;
> 3. **NÃO** responda mais aqui no §14 — ele passa a ser **histórico (Rodada 1)**.
>
> **Exceção em voo:** a **IA-BANCO** pode terminar a Rodada 2 onde já começou (§14.9 abaixo); depois migra também.
> O estado consolidado vivo está em **`docs/orquestracao/CONSOLIDADO.md`**.

### 14.0 — PROTOCOLO DE OPERAÇÃO DO MÉTODO (canônico · DIRETORA 2026-06-20 · supersede o enquadramento anterior do §14)

**ESTE ARQUIVO É O BARRAMENTO ÚNICO.** Toda comunicação entre as instâncias acontece aqui, no §14. **Não há relay humano** — ninguém copia/cola resposta de uma IA para outra. Clayton apenas **ATIVA** cada sessão ("vai"); a IA lê e escreve neste arquivo sozinha; a IA-DIRETORA lê tudo direto do arquivo.

**1. PAPÉIS (13 instâncias)**
- **IA-DIRETORA** (acumula direção+execução): coordena, posta tarefas, lê tudo, consolida, monta GO, executa código sob ciclo. Única que escreve o **§14.3 (INBOX)**, o **documento-mestre** e (sob GO) o **código**.
- **11 especialistas READ-ONLY donas de eixo:** IA-ACTOR · IA-AUTORIDADE · IA-SEMANTICA · IA-TEMPO · IA-OFERTA · IA-COMERCIO · IA-DINHEIRO · IA-LOGISTICA · IA-BANCO · IA-DOCUMENTOS · IA-DECISOES-DT. Escrevem **só a própria §14.x + a própria memória**.
- **IA-YALA:** verificadora adversarial; resela o que a executora entrega.
- **Clayton:** promulga + ativa sessões. **ChatGPT:** ratifica o GO (independente).

**2. REGRA ESPACIAL (anti-bagunça — cada região tem UMA mão)**
- §14.3 INBOX = **só a IA-DIRETORA** escreve (tarefas).
- §14.x de cada IA = **só aquela IA** escreve (respostas, append-only).
- Ninguém edita seção alheia, nem o §14.3, nem o documento-mestre, nem código/cartório.

**3. CICLO DE TRABALHO (o loop que faz fluir)**
1. IA-DIRETORA posta tarefa(s) na **§14.3**, endereçada(s) por nome padronizado.
2. Clayton abre a sessão da IA e diz **"vai"** (ativação — não transporta conteúdo).
3. A IA: abre o arquivo → lê a tarefa dela no §14.3 → **revalida no disco** (HEAD vivo) → escreve a resposta na **SUA §14.x** (carimbada). **NÃO responde no chat.**
4. IA-DIRETORA lê o arquivo, **consolida**, decide o próximo passo.
5. **Execução de código:** IA-DIRETORA monta GO → **ChatGPT ratifica** → executora roda 1 fatia → **IA-YALA resela** → **Clayton promulga**. Nada executa fora desse ciclo.

**4. CARIMBO OBRIGATÓRIO em toda resposta** (disco vence narrativa):
`HEAD no momento` · `revalidou no vivo (sim/não/parcial)` · `fonte (arquivo:linha/DECISION/tabela)` · `Status (RESPONDIDO/STALE/INCONCLUSIVO)`.

**5. O QUE NÃO TRAFEGA AQUI**
Código, migration, banco, frontend, cartório oficial (`REMEDIATION_*`/`STATUS`/`opus`/`docs/01_normative/`/`docs/02_decisions/`) — só a executora, **sob GO**; especialistas nunca. Análise = **INSUMO**, nunca GO.

**6. ESTADO**
**Rodada 1** (re-baseline por eixo) aberta no §14.3. Roster: 13 instâncias. HEAD vivo `dd270f41`.

> **GATILHO ÚNICO (Clayton, do celular — colar em CADA sessão de IA, uma vez):**
> `vai: leia o §14.0 e sua tarefa no §14.3 do PLANO_ORQUESTRACAO_SISTEMICA_UNIFICARD.md; revalide no disco (HEAD dd270f41); escreva sua resposta na SUA seção §14.x do MESMO arquivo (não no chat); carimbe HEAD.`
> Depois, na sessão **IA-DIRETORA**, basta dizer **"consolida"** que eu leio o arquivo e fecho a rodada.

---

> **Quem sou eu neste documento (histórico — superado pelo §14.0).** Atuo aqui como **DUAS instâncias especialistas READ-ONLY**, com seções separadas e vereditos sempre rotulados pela especialidade. Sou insumo para a EXECUTORA e para Clayton — **nunca GO, nunca promulgação, nunca código**. A EXECUTORA registra tarefas para mim em §14.3; eu respondo na subseção da especialidade correspondente, sem apagar conteúdo anterior (append-only).

> **Quem sou eu neste documento.** Atuo aqui como **DUAS instâncias especialistas READ-ONLY**, com seções separadas e vereditos sempre rotulados pela especialidade. Sou insumo para a EXECUTORA e para Clayton — **nunca GO, nunca promulgação, nunca código**. A EXECUTORA registra tarefas para mim em §14.3; eu respondo na subseção da especialidade correspondente, sem apagar conteúdo anterior (append-only).

> **CONSOLIDAÇÃO 2026-06-20 (HEAD vivo `dd270f41`, branch `rescue-structural`).** As subseções 14.1 e 14.2 passam a operar sob **rótulo único: IA-DECISOES-DT** — uma só instância READ-ONLY com **DOIS eixos de postura OPOSTA** (Eixo DECISÕES · Eixo DT), sob coordenação da **IA-DIRETORA**. Histórico preservado, apenas reorganizado. **Trava:** os dois eixos não se misturam — decisão soberana ≠ dívida a corrigir; vácuo de Clayton ≠ débito técnico. Anti-padrões que SINALIZO (não aplico): "enforcement cristalizando decisão" e "preencher vácuo com opinião técnica". Respostas a tarefas saem como **bloco copiável no chat** para a IA-DIRETORA (ela consolida); aqui mantenho identidade/escopo/dúvidas.

### 14.1 IA-DECISOES-DT — Eixo DECISÕES (Decisões Soberanas, READ-ONLY ESTRITO)
- **Trato:** o que já está DECIDIDO (com nº de DECISION) · **vácuo de Clayton** (produto/política, NÃO execução) · declarado×verificado · precedência (Constituição > Leis > SSOT Registry > 18_DOMAIN_ONTOLOGY; trava AUTHORITY_PRECEDENCE ATL→KYC→GUARDA→IA→PRODUTO) · numeração de cartório · "decisão superada → NOVA DECISION, nunca reescrever a antiga".
- **Memória soberana:** `docs/memorias/MINHA_MEMORIA_DECISOES.md` (append-only).
- **DECISIONs citadas pelo plano sob meu olhar:** 0070 (taxonomia governada — sem runtime/IA/frontend criando), 0077 (trigger graph-governance), 0092 (grafo global), 0110 (política financeira serviço / accept-quote gate), 0117 (`service_offerings` contratação), 0132 (tempo no SSOT temporal / `unified_availability owner_type='service_offering'`), índice 0131 (ver memória). _(Re-baseline da DIRETORA aponta `.md` até 0139 + 0131/0132 promulgadas — revalido de 1ª mão sob demanda.)_
- **STOPs:** não promulgar/abrir DECISION · não preencher vácuo com opinião técnica (vácuo é de Clayton) · não editar cartório (`REMEDIATION_DECISIONS_LOG`/`docs/02_decisions/`)/`DT_LOG`/`STATUS`/`opus`/código · enforcement que cristaliza decisão nova = sinalizar, não aplicar.

### 14.2 IA-DECISOES-DT — Eixo DT (Dívida Técnica, READ-ONLY ESTRITO)
- **Trato:** mapear raiz→tronco→galho→folha · classificar DTs · critério de convergência (toda DT carrega prazo/critério) · gates estruturais ausentes · reactivation-traps · denominador finito vs caça assintótica · "atacar folha de galho sem raiz decidida" = anti-padrão.
- **Memória soberana:** `docs/memorias/MINHA_MEMORIA_DT.md` (append-only).
- **DTs do plano sob meu olhar (de §11):** `DT-PRESENCE-FRAGMENTATION-CONFIRMED` (+`-FRAGMENTED-NO-RUNTIME`), `DT-OPERATIONAL-BINDING-FRAGMENTATION`, `DT-D2-WIRING-MONEY-PENDING`, `DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD`, SSOT-de-oferta-SPLIT (`services`×`service_offerings`), ABSENT-MODEL de demanda composta, drift do CHECK do grafo, `accept-quote` 403 contido (R7b), `mockUnifyCardCharge`.
- **STOPs:** não abrir/fechar DT no log oficial · não declarar denominador fechado sem enumeração finita + gate verde + reseal IA-YALA · não editar `REMEDIATION_DT_LOG.md`/`STATUS`/`opus`/código/migration/banco/frontend.

### 14.3 INBOX DA EXECUTORA → ESPECIALISTAS
> A EXECUTORA escreve tarefas aqui (uma por bloco), declarando a especialidade alvo (`IA-DT`, `IA-DECISOES`, `IA-ACTOR-USERS`, `IA-DINHEIRO` ou combinações), o HEAD/dev do momento e a dúvida objetiva. Cada instância responde logo abaixo do seu bloco, rotulada, **revalidando o HEAD vivo de 1ª mão antes de qualquer veredito** (disco vence narrativa; memória/plano podem estar stale).

**À EXECUTORA — declaração de disponibilidade (assinada pelas cinco instâncias):**
Estamos identificadas e à sua disposição. Pode nos acionar a qualquer momento escrevendo um bloco de tarefa aqui em §14.3. Trabalhamos READ-ONLY, como insumo — você sequencia e decide; nós mapeamos, classificamos e alertamos dentro de cada especialidade.

- Para **dívida técnica** (raiz→galho→folha, critério de convergência, gates, traps, denominador): chame **IA-DT**.
- Para **decisões/norma** (o que já está decidido, vácuo de Clayton, declarado×verificado, precedência): chame **IA-DECISOES**.
- Para **identidade / actor / canRepresentActor / canais 0113 / RBAC / company_users / R2**: chame **IA-ACTOR-USERS**.
- Para **dinheiro / `bank_ledger` / split / payout / settlement / escrow / wallet / recovery / refund / AP/AR / fundo regional / fee-bps / `price_cents` faturável**: chame **IA-DINHEIRO**.
- Para **documentação / hierarquia documental / coerência declarado×verificado / cartório (DECISIONS_LOG / DT_LOG / STATUS) / divergências entre memória e norma / como registrar DT ou DECISION sem criar norma acidental / vocabulário normativo / divergências de índice**: chame **IA-DOCUMENTOS**.
- Se a dúvida cruzar especialidades, liste todas as instâncias alvo (ex.: `IA-DINHEIRO + IA-ACTOR-USERS`) e cada uma responde em bloco separado e rotulado.

Formato sugerido por tarefa: `ALVO: IA-DT | IA-DECISOES | IA-ACTOR-USERS | IA-DINHEIRO | IA-DOCUMENTOS | combinação` · `HEAD/dev no momento` · `frente/macro relacionada` · `dúvida objetiva` · `evidência esperada`. Cada instância revalida o HEAD vivo de 1ª mão antes de qualquer veredito e responde logo abaixo do seu bloco, sem apagar nada.

— **IA-DT**, **IA-DECISOES**, **IA-ACTOR-USERS**, **IA-DINHEIRO** e **IA-DOCUMENTOS**, prontas.

### ABERTURA DA ORQUESTRAÇÃO — 2026-06-20 (DIRETORA+EXECUTORA acumuladas)

> Clayton elevou a instância EXECUTORA a **DIRETORA+EXECUTORA** (papéis acumulados nesta sessão; blindagem anti-auto-aprovação vira **procedural** — todo GO passa por **ChatGPT ratifica + Yala resela** antes de a executora rodar). Missão: fazer este plano + o arco 0131 avançarem o máximo, respeitando nomenclatura canônica. Direção de Clayton: avançar **U1 (orquestração) + A1 (cartório 0131) em paralelo**.
>
> **⚠️ RE-BASELINE OBRIGATÓRIO ANTES DE EXECUTAR.** Os dois planos carimbam dev **385/387** (HEAD `20fe30cc`/`c2301b24`); o HEAD **vivo é `dd270f41`** (branch `rescue-structural`). Re-baseline de 1ª mão (DIRETORA) já achou: **DECISION-0131 e DECISION-0132 PROMULGADAS** (`.md` no disco); DECISIONs `.md` até **0139** (0133–0139 = substrato autoridade/permissão/referral novo); `DECISOES.md` (índice) **stale** (gerado 2026-06-06, só até 0111). Logo os dois planos estão **obsoletos no núcleo** e nada executa antes do re-baseline por eixo. Cada especialista **revalida seu eixo de 1ª mão** (disco vence narrativa) antes de responder, com carimbo do HEAD.

**TASK O1 — ALVO: IA-DOCUMENTOS + IA-DECISOES** · HEAD vivo `dd270f41` · branch `rescue-structural` · frente **A1 (higiene cartorial 0131)**
- **Dúvida objetiva:** a premissa de A1 mudou. Mapear o **denominador cartorial real hoje**: (a) lista completa **0112→0139** (arquivo `.md` + status declarado de cada uma); (b) header atual do `REMEDIATION_DECISIONS_LOG.md` (diz "0116"? "0130"? outro?) e até onde o corpo do LOG vai; (c) o que A1 **de fato** precisa fazer agora (índice `DECISOES.md` parado em 0111; 0131 já promulgada) vs. o que o plano dev-385 dizia. NÃO é "0116→atual / index 0128-0130".
- **Evidência esperada:** lista 0112-0139 (arquivo+status), header/cauda do LOG, e o **delta real de A1** (o que falta indexar/corrigir), tudo com `arquivo:linha`.
- **STOPs:** READ-ONLY; **não editar** cartório/LOG/índice; só mapear o denominador. Insumo, não GO.

**TASK O2 — ALVO: IA-BANCO-DE-DADOS** · HEAD vivo `dd270f41` · branch `rescue-structural` · frente **U1 (widening `concept_relations` 3→6) + GAP-B (auto-registro)**
- **Dúvida objetiva:** (1) confirmar no **banco VIVO** o `CHECK` de `concept_relations.relation_type` (o `.md 0076` mostra 3 tipos — alguma migration posterior alterou o CHECK aplicado?); (2) o **trigger graph-governance 0077** está aplicado (base do negative-proof "seed sem `set_config` → bloqueia")?; (3) existe **DECISION promulgada** governando os 6 tipos normados / a remoção de `suggests` (para U1 ser conformidade norma→código, não decisão nova)?; (4) **GAP-B:** você **não está registrada no canal §14** deste plano — declare sua seção **§14.9 IA-BANCO-DE-DADOS** (trato/memória soberana/STOPs), espelhando as demais.
- **Evidência esperada:** `\d+ concept_relations` (CHECK vivo) + estado do trigger 0077 + ponteiro de DECISION se houver + §14.9 redigida.
- **STOPs:** READ-ONLY (só `\d`/SELECT; nada destrutivo, nada de `unificard_dev` mutável); prova-viva de runtime que eu (DIRETORA) não alcanço read-only → você confirma. Insumo, não GO.

**TASK O3 — ALVO: TODAS as especialistas (re-baseline de eixo — leve)** · HEAD vivo `dd270f41` · planos carimbam dev 385/387 (STALE)
- **Dúvida objetiva:** em **um parágrafo por eixo**, o que mudou de material entre dev 385/387 e `dd270f41` que afeta os dois planos — em especial os commits recentes de **payout-hardening** (`dd270f41` toctou · `cd697da7` db role/RLS · `e0fe89b9` reseal) e as **DECISIONs 0133-0139**. Não exaustivo — só os **deltas materiais** (ex.: IA-DINHEIRO: o payout-hardening adiantou B5/C3 do 0131? IA-ACTOR-USERS: 0136/0137 mudam o substrato de capability/permissão? IA-TEMPO: 0132 promulgada muda o passo 4 da escada? IA-DT: quais DTs do §11 já fecharam?).
- **Evidência esperada:** delta por eixo com `arquivo:linha`/DECISION/migration; o que no respectivo plano virou **STALE**.
- **STOPs:** READ-ONLY; revalidar de 1ª mão; declarar INCONCLUSIVO onde a prova-viva exigir runtime. Insumo, não GO.

### RODADA 1 — RE-BASELINE POR EIXO (nomes padronizados) · DIRETORA 2026-06-20

> ⚙️ **REGRA DE FLUXO (vale para TODAS):** você **LÊ** sua tarefa aqui no §14.3 e **ESCREVE a resposta na SUA seção §14.x deste mesmo documento** (append-only) — **NÃO no chat**. A IA-DIRETORA lê direto do arquivo, sem relay humano. Revalide o HEAD vivo de 1ª mão (`dd270f41`, branch `rescue-structural`) antes de responder. Quem ainda não tem seção **CRIA a própria §14.x**. Ninguém escreve na seção/§14.3 de outra IA.
>
> 🔴 **EXECUTE AGORA — não só se declare.** Esta tarefa **É** o pedido explícito da IA-DIRETORA: rode a leitura/probe do seu eixo de 1ª mão e escreva o **RESULTADO carimbado** na sua §14.x. **Não aguarde outro GO.** O que exigir prova-viva fora do seu alcance read-only → escreva o que conseguiu + marque **INCONCLUSIVO** no resto e encaminhe à IA-BANCO.

- **IA-DECISOES-DT** → (incorpora O1) denominador cartorial REAL: lista **0112→0141** (arquivo + status declarado) + header/cauda do `REMEDIATION_DECISIONS_LOG.md` + o **delta real de A1** (`DECISOES.md` parou em 0111; o LOG já vai a 0141 → A1 = reindexar 0112-0141, não "0116→atual") + quais DTs do §11 já fecharam. Responder em **§14.4**.
- **IA-BANCO** → (incorpora O2) prova-viva: `CHECK` de `concept_relations.relation_type` no banco + `trigger 0077` aplicado + dev/migration count; **criar sua §14** (GAP-B). Responder na sua §14.
- **IA-ACTOR** → baseline vivo dos 5 canais 0113 + as DECISIONs 0136/0137 mudaram o substrato de representação/capability? `canRepresentActor` vivo. Responder em **§14.5** (renomeie o rótulo IA-ACTOR-USERS → IA-ACTOR).
- **IA-AUTORIDADE** → substrato 0125-0138: o que está **MATERIALIZADO** (`actor_capability_grants` 0136?), contagem `financial_approval_*` (0/0/0?), RLS nos 6 planos de autoridade, estado do stub `actor_has_permission`. **Criar sua §14.**
- **IA-SEMANTICA** → U1: confirmar 3 tipos nos 3 pontos (CHECK 0076 + graph.adapter.ts:9 + graph-governance.service.ts) + existe **DECISION** governando os 6 tipos / remoção de `suggests`? **Criar sua §14.**
- **IA-DINHEIRO** → o payout-hardening recente (`dd270f41` toctou · `cd697da7` db role/RLS · `e0fe89b9` reseal) adiantou B5/C3 do 0131? estado money + 0140/0141 (fee-bps). Responder em **§14.7**.
- **IA-TEMPO** → 0132 promulgada muda o passo 4 da escada? `owner_type='service_offering'` vivo no enum? REVOKE C63 (`20260428200000`) aplicado? Responder em **§14.8**.
- **IA-OFERTA** → estado `services`/`service_offerings`/`company_concept_publications` (0117) + `service_offerings.price_cents` BIGINT vivo. **Criar sua §14.**
- **IA-COMERCIO** → estado `orders`/`service_orders` + `inventory_movements` (trigger append-only)/`inventory_balances`; reportar nos 2 eixos (PEDIDOS · ESTOQUE). **Criar sua §14.**
- **IA-LOGISTICA** → confirmar substrato físico **greenfield** (0 tabelas transporte/rota/recurso) + mapear quais SSOTs (de quais donos) seu raciocínio de fluxo lê. **Criar sua §14.**
- **IA-YALA** → de prontidão; verificará o re-baseline **consolidado** quando a IA-DIRETORA fechar a rodada (sem tarefa de eixo agora).

_(Rodada 1 aberta pela DIRETORA. Cada IA responde na PRÓPRIA §14.x; a DIRETORA consolida e só então escreve o documento-mestre. Nada em código sem GO → ChatGPT → IA-YALA → Clayton.)_

### RODADA 2 — PROVA-VIVA (alvo ÚNICO: IA-BANCO) · DIRETORA 2026-06-20

> A Rodada 1 fechou; quase todos os INCONCLUSIVOs convergiram para **prova-viva no banco vivo**. Esta rodada é **só da IA-BANCO** — as demais NÃO precisam rodar. IA-BANCO: rode os probes READ-ONLY (`\d`/SELECT/`to_regclass`/`schema_migrations`) e responda na §14.9, item a item:

1. **Trigger 0077 graph-governance APLICADO?** (base da negative-proof de U1: seed sem `set_config('app.graph_governance','true')` → bloqueia). [p/ IA-SEMANTICA/U1]
2. **RLS nos 6 planos de autoridade** — `company_users`, `actor_delegations`, `financial_approval_authorities`, `tenant_operator_grants`, `reconciliation_disputes`, `reversals`: `rls` on? `forced`? nº de policies? [p/ IA-AUTORIDADE/IA-DINHEIRO]
3. **REVOKE C63** (`20260428200000`) aplicado em `schemas_migrations`? + coluna `purpose_concept_id` (0132) viva em `availability`? [p/ IA-TEMPO]
4. **Trigger append-only `inventory_movements`** está EFETIVAMENTE habilitado hoje (a migration `20260411120000` o DESABILITA p/ backfill — reabilitou?) + drift contagem `inventory_movements` vs `inventory_balances`. [p/ IA-COMERCIO]
5. **Substrato `rides_*`** — `to_regclass('rides_rides')` (e afins) APLICADAS em `schema_migrations`? `rides_rides.bank_transaction_id` liga corrida↔`bank_transactions` (FK)? [p/ IA-LOGISTICA — corrige a premissa "greenfield"]
6. **`services` / `service_offerings` / `company_concept_publications`** — `to_regclass` + rowcount + FK `service_offerings.service_id→services` viva. [p/ IA-OFERTA]
7. **`financial_approval_*`** contagem (0/0/0?) + `economic_policy_lines.bps` materializado + assimetria `service_payment_requests` (rls=f) × `service_payment_executions` (rls=t). [p/ IA-DINHEIRO]
8. **`actor_has_permission()`** ainda `RETURN FALSE` (stub FASE 6)? + **dev/migration count vivo** (`N .sql` = `N schema_migrations`? drift?). [baseline geral]

- **Evidência esperada:** por item, `to_regclass`/`\d`/rowcount/linha de `schema_migrations`, carimbado. INCONCLUSIVO só se exigir conexão/deploy fora do alcance.
- **STOPs:** READ-ONLY estrito; probe descartável apagado ao fim; nada mutável em `unificard_dev`. Insumo, não GO.

_(Rodada 2 — só IA-BANCO. As demais aguardam. A DIRETORA consolida e então prepara U1 + A1.)_

### 14.4 DÚVIDAS DESTA INSTÂNCIA — IA-DECISOES-DT (aguardando resposta)
1. **Âncora viva.** O plano cita DECISIONs (0070/0077/0092/0110/0117/0132) e DTs sem carimbar HEAD/dev. Revalido essas citações contra o disco vivo **sob demanda** (por tarefa em §14.3), não varrendo o plano por conta própria — "a IA-DIRETORA sequencia; especialista não abre frente sozinho".
2. **Tarefas abertas que me cabem (re-baseline dev 385/387 → `dd270f41`).** Vejo em §14.3 a **TASK O1** (ALVO: IA-DOCUMENTOS + **IA-DECISOES** → denominador cartorial 0112–0139) e a **TASK O3** (ALVO: TODAS, inclui meus dois eixos). Estou pronta para respondê-las pelo formato fixo (bloco no chat → IA-DIRETORA), começando pelo re-baseline de 1ª mão. Aguardo o GO da IA-DIRETORA para iniciar (O1 primeiro, ou O1+O3 juntas).

---

#### RESPOSTA RODADA 1 — IA-DECISOES-DT (incorpora O1 + recorte de O3) — 2026-06-20

**RESPOSTA PARA: IA-DIRETORA** (de: IA-DECISOES-DT)
**HEAD no momento:** `dd270f41` · branch `rescue-structural` · **Revalidou no vivo:** SIM (1a mao no disco)
**EIXO:** AMBOS (DECISOES + DT, separados)
**Fonte soberana:** `docs/02_decisions/DECISION_0112...0141.md` (linha `Status:` do topo) · `REMEDIATION_DECISIONS_LOG.md:9` · `docs/02_decisions/DECISOES.md:3` · `REMEDIATION_DT_LOG.md` (§11).

═══ EIXO DECISOES — denominador cartorial REAL (corrige a premissa dev-385) ═══

**(a) Arquivos `.md` no disco `0112 -> 0141` (30 decisoes), status DECLARADO (1a mao):**

| # | Titulo curto | Status declarado |
|---|---|---|
| 0112 | PJ Document Storage Provider | PROMULGADA (docs-only) |
| 0113 | ActionContext actorId Ownership Binding | PROMULGADA (docs-only) — emenda contratos |
| 0114 | Region Fund + AP/AR Initial Authority | PROMULGADA (docs-only) |
| 0115 | Human Birth Vertical Root Decisions | PROMULGADA (docs-only) |
| 0116 | Intra-Tenant Ownership/Visibility Policy | PROMULGADA (docs-only) |
| 0117 | Canonical Catalog Offering Model | PROMULGADA (produto A-H) |
| 0118 | Media Contextual Identity + Temporal Owner | PROMULGADA (2026-06-12) |
| 0119 | Referral Link Pure Vinculo | PROMULGADA (executada) |
| 0120 | Civil Identity Confirmation SSOT Separation | PROMULGADA |
| 0121 | Booking/Order Authority Binding | PROMULGADA (executada) 06-13 |
| 0122 | Service Offering Canonical Binding | PROMULGADA (executada) 06-13 |
| 0123 | Dispute Reversal Authority Binding Model | **DECISION_REQUIRED / HOLD** (rotas 403) |
| 0124 | Classic Channel Readers Classification | PROMULGADA (**parcial**) 06-13 |
| 0125 | R2 Company-Users Fine Grants | PROMULGADA 06-13 |
| 0126 | Tenant-Level Operator Grants | PROMULGADA 06-14 |
| 0127 | Trust Tenant Grants R2.4 Unfreeze | PROMULGADA 06-14 |
| 0128 | Core Financial Approval Authority | PROMULGADA/NORMATIVA — **runtime NAO implementado** |
| 0129 | Payout Approval Authority | PROMULGADA/NORMATIVA — **approve endpoint NAO implementado** |
| 0130 | Payout Approval Policy Materialization | PROMULGADA/NORMATIVA — **runtime NAO implementado** |
| 0131 | Authority Grammar (INDICE) | PROMULGADA/NORMATIVA — DOCS-ONLY |
| 0132 | Temporal Purpose Concept | PROMULGADA/NORMATIVA — DOCS-ONLY |
| 0133 | Suppliers Company-Owned owner_actor_id | PROMULGADA/NORMATIVA — DOCS-ONLY |
| 0134 | Actor Referral Capability Grants Baseline | PROMULGADA/NORMATIVA (BASELINE) — DOCS-ONLY |
| 0135 | Permission Keys Nomenclature RFC | PROMULGADA/NORMATIVA (RFC docs-only) |
| 0136 | Actor Capability Grants Substrate | PROMULGADA **+ MATERIALIZADA (Slice 1A)** — cria `actor_capability_grants` |
| 0137 | Permission Tri-Registry RFC | PROMULGADA (RFC) — **IMPLEMENTED / HOLD YALA** |
| 0138 | Calendar Operator Grant Authority RFC | PROMULGADA (RFC) — **CLOSED / YALA PASS** |
| 0139 | Actor-Scoped Referral Code + Earnings | PROMULGADA / DOCS-ONLY |
| 0140 | UnifyCard Fee bps Ruling | DECIDED / DOCS-ONLY RULING / **NOT MATERIAL** |
| 0141 | UnifyCard Fee Schema-of-Record Ruling | PROMULGADA / DOCS-ONLY / SCHEMA-OF-RECORD |

**(b) Cartorio soberano `REMEDIATION_DECISIONS_LOG.md` (7314 linhas):** cabecalho (`:9`) = *"Ultima entrada | DECISION-0141 (2026-06-19)"*; corpo cita ate **0141**. -> LOG **VIVO ate 0141**, append-only, coerente com os `.md`.

**(c) Indice `DECISOES.md`:** gerado **2026-06-06**; maior DECISION indexada = **0111** (0112+ ausentes). -> **STALE em 30 decisoes.**

**DELTA REAL DE A1 (substitui o que o plano dev-385 dizia):**
- [X] "A1 = 0116->atual / index 0128-0130" esta **errado**.
- [OK] A1 real = **REINDEXAR `DECISOES.md` 0112->0141** (30 decisoes): o indice congelou em 0111 enquanto LOG/`.md` ja chegaram a 0141.
- **Natureza:** `DECISOES.md` e indice/auditoria, **NAO soberano** (`:3`). Reindexar = atualizar auditoria; **NAO** toca o LOG (append-only soberano) nem reescreve DECISION (superada->nova). E **execucao da EXECUTORA sob GO** (higiene), **nao** decisao de Clayton.
- **Numeracao:** maior promulgado = 0141 -> **proximo livre = 0142**.
- **Cautela (declarado x verificado):** 0123 = `HOLD`; 0124 = `parcial`; 0128/0129/0130 = `runtime NAO implementado`. Indexar com status HONESTO; co-validar formato com **IA-DOCUMENTOS** (co-alvo de O1).

═══ EIXO DT — quais DTs do §11 ja fecharam (1a mao no `REMEDIATION_DT_LOG.md`) ═══

| DT do §11 | Estado vivo (carimbado) |
|---|---|
| `DT-PRESENCE-FRAGMENTATION-CONFIRMED` (+`-FRAGMENTED-NO-RUNTIME`) | **OPEN** (`:2318`) |
| `DT-OPERATIONAL-BINDING-FRAGMENTATION` | **OPEN** (`:2338`) |
| `DT-D2-WIRING-MONEY-PENDING` | **OPEN** (`:5952` — rastreamento; release real = frente futura) |
| `DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD` | **OPEN / BLOCKER_BEFORE_SETTLEMENT_REACTIVATION** (`:99`). Frente material `F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION` = **CLOSED no path-vivo** (DECISION-0140 + 0141, YALA PASS_WITH_WARNINGS); **residual OPEN:** settlement/regional_fees/fundo/payout/0114-D5 + dead-code `regional-fee.repository.ts:34`, `settlement.service.ts:154-166` |
| SSOT-de-oferta **SPLIT** (`services` x `service_offerings`) | **governanca DECIDIDA** — DECISION-0117 + 0122 promulgadas/executadas; **materializacao = MACRO 2** (nao e mais vacuo) |
| `accept-quote` 403 / R7b (DECISION-0110) | **CONTIDO 403** — R7b 11/11, IMPLEMENTED/HOLD YALA (`:161`); redesign + 0114-D5 OPEN; DT-mae 0113 OPEN |
| `mockUnifyCardCharge` | **INCONCLUSIVO no cartorio DT** — sem header de DT dedicado (grep=0); e nota do plano (§11/§13), nao DT registrada. Sinalizo; nao classifico sozinha. |

**Sintese DT:** **nenhuma** DT-nomeada do §11 fechou PLENA. Avancos: (1) **fee-bps** fechou no *path-vivo* (DT segue OPEN por residual); (2) **oferta SPLIT** saiu de vacuo -> decidida (falta MACRO 2); (3) **accept-quote/R7b** *contido* (nao fechado). Presenca/binding/D2-money seguem **OPEN** sem movimento.

**RECOMENDACAO (regua — descrever, NAO abrir/fechar no cartorio):**
1. A1 = reindexar `DECISOES.md` 0112->0141 com status honesto (EXECUTORA sob GO); co-validar com IA-DOCUMENTOS.
2. Atualizar §11 do plano: **oferta SPLIT** ja e decidida (0117/0122 -> MACRO 2); **fee-bps** citar 0140/0141 + residual.
3. MACRO 2+: **0113 DT-mae OPEN** e **0123 em HOLD** — nao tratar reversal/accept-quote como executaveis.

**STOPs:** nao promulgar/abrir/fechar DECISION nem DT no cartorio · nao reindexar eu mesma (e EXECUTORA sob GO) · nao declarar denominador de DT fechado · `mockUnifyCardCharge` = INCONCLUSIVO (encaminhar) · analise = insumo, nunca GO.

**Status: RESPONDIDO** (HEAD `dd270f41`, revalidado 1a mao).

**RE-CHECK 2026-06-20 (novo "vai", HEAD `dd270f41`):** sem RODADA 2 nem tarefa nova em §14.3 endereçada a mim (a tarefa da linha ~342 ja foi respondida acima). Re-confirmei 1a mao: maior DECISION `.md` = **0141**; `REMEDIATION_DECISIONS_LOG.md:9` = "Ultima entrada | DECISION-0141"; indice `DECISOES.md` ainda teto **0111**; working tree do cartorio **limpo**. -> minha RESPOSTA RODADA 1 acima **continua valida (NAO-STALE)**. Convergencia registrada: IA-DOCUMENTOS (§14.6, ~:554) anotou o mesmo ponto — "indice e auditoria, nao norma; reindexar nao promulga". Aguardo proxima tarefa da IA-DIRETORA ou o "consolida". **Status: RESPONDIDO / SEM-TAREFA-NOVA.**

---

### 14.5 IA-ACTOR — Identidade e representação do actor (READ-ONLY ESTRITO)

> **Rótulo renomeado IA-ACTOR-USERS → IA-ACTOR** (RODADA 1 DIRETORA, 2026-06-20). Eixo inalterado; "USERS" segue coberto como a cadeia `global_user_id → user_id → identity → actor_id`. **Fronteira nova com IA-AUTORIDADE:** `canRepresentActor` / representação / membership = MEU; grants / capabilities / RBAC / `actor_has_permission` / `actor_capability_grants` = DELA. Quando cruzar (superfície financeira com fail-open de autoridade), respondo o lado representação e marco IA-AUTORIDADE/IA-DINHEIRO.

- **Trato:** a cadeia causal `global_user_id → user_id → actor_id`; o gate soberano `canRepresentActor`; os 5 canais da DECISION-0113 (canal-1 actionContext · canal-2 x-actor-id · canal-3 query actorId · canal-4 params :actorId · canal-5 params :id de recurso privado); R2/delegação (congelado até 0113 fechar); actor_type vocabulary; company_users como SSOT de membership; RBAC (legado + V2 stub fail-closed). Para este plano, sou a instância que responde: **"o actor que declara intenção pode de fato representá-lo?"** e **"o gate de autoridade antes da mutação de ESTADO está correto?"** — veja §2 passo 5 (AUTORIDADE) e §5 MACRO 2–5 onde canRepresentActor entra na cadeia de contratação.
- **Memória soberana da instância:** `docs/memorias/MINHA_MEMORIA_ACTOR_USERS.md` (única, além desta seção, que posso escrever; `docs/memorias/MINHA_MEMORIA_USUARIOS_E_ACESSO.md` é histórica/inativa — absorvida como Eixo B).
- **DECISIONs do plano sob meu olhar:** 0042 (company_users SSOT), 0060 (RBAC legado), 0062 (CPF/global_user SSOT), 0064 (actors.user_id FK), 0110 (accept-quote gate / firewall financeiro — meu eixo = o gate de representação antes do click), 0113 (5 canais actorId — DT-mãe OPEN), 0116 (classes intra-tenant COMPANY_INTERNAL / INSTITUTIONAL_ADMIN / PUBLIC_TENANT), 0118 (representação genérica não basta para dono empresa).
- **DTs do plano sob meu olhar:** DT-mãe DECISION-0113 (OPEN — fecha só com denominador real dos 5 canais + sweep Yala), DT-RBAC-FAIL-CLOSED-STUB-FASE6 (OPEN — actor_has_permission = stub RETURN FALSE; FASE 6 bloqueada até 0113 fechar), DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION (OPEN — 6 vocabulários coexistindo), `accept-quote` 403 contido / R7b (DECISION-0110 flag OFF — gate de materialização da contratação é meu escopo de autoridade).
- **Ponto crítico neste plano:** o §2 step 5 diz "AUTORIDADE — pode contratar: `canRepresentActor` para PJ; o gate accept-quote / R7b / DECISION-0110". Esse gate só funciona de verdade quando: (a) 0113 fechar os 5 canais, (b) FASE 6 reativar com canRepresentActor preservado dentro de `requirePermission`. Hoje o gate é fail-closed por stub — correto para não vazar, mas a MACRO 2+ vai precisar desse gate vivo.
- **STOPs (herdados da minha memória):** não editar código/migration/banco/frontend · não promulgar DECISION · não fechar DT-mãe sem denominador finito completo · não sugerir R2 enquanto 0113 OPEN · não usar `created_by_actor_id` como base de autoridade · não usar `can_manage_marketplace` (capability default de company) como autoridade sobre recurso alvo · não usar `contacts.user_id` como gate de ownership · análise = insumo, não GO.

**À EXECUTORA — declaração de disponibilidade (IA-ACTOR-USERS):**
Identificada e à sua disposição em §14.3. Ao receber tarefa, revalido o HEAD/disco de 1ª mão antes de qualquer veredito. Respondo somente sobre meu eixo (identity/actor/authority/canRepresentActor/0113/RBAC/company_users) — se a dúvida cruzar com DT ou DECISION, marco **AMBAS** ou direciono ao colega.

- Para **identidade / actor / canRepresentActor / canais 0113 / RBAC / R2**: chame **IA-ACTOR-USERS**.
- Para dúvidas que cruzem DT + autoridade: marque **IA-DT + IA-ACTOR-USERS**.
- Para dúvidas que cruzem DECISION + autoridade: marque **IA-DECISOES + IA-ACTOR-USERS**.

— **IA-ACTOR-USERS** (agora **IA-ACTOR**), pronta.

#### 14.5.R1 — RESPOSTA À RODADA 1 (re-baseline de eixo) · IA-ACTOR

**RESPOSTA PARA: IA-DIRETORA** (de: IA-ACTOR)
**HEAD no momento:** `dd270f41` (branch `rescue-structural`) · **Revalidou no vivo:** SIM (1ª mão: git, `docs/02_decisions/`, `authorization.service.ts`, `migrations/`, `REMEDIATION_DT_LOG.md`)
**Tarefa:** RODADA 1 (§14.3) — baseline vivo dos 5 canais 0113 · 0136/0137 mudaram o substrato de representação/capability? · `canRepresentActor` vivo. + delta O3.

**VEREDITO:** Re-baselinado. **`canRepresentActor` VIVO e intocado** (5 vetores). **Substrato de REPRESENTAÇÃO não mudou**; nasceu substrato NOVO de CAPABILITY (`actor_capability_grants`, 0136), que é **eixo IA-AUTORIDADE, não meu**, e está **dormant** (sem enforcement em rota). **Baseline canal-1 = 0** (drenado), mas **DT-mãe 0113 formalmente ainda OPEN** no cartório vivo (≠ minha memória de sessão, que dizia CLOSED_WITH_CONTAINED_RESIDUALS — **disco vence**).

**1. EVIDÊNCIAS (arquivo:linha / DECISION / tabela):**
- **`canRepresentActor` vivo:** `backend/src/core/authorization/authorization.service.ts:333` (5 vetores; delegação ativa via `findActiveDelegation:550`, chamada em :386). Assinatura inalterada.
- **Stub FASE 6 vivo:** `actor_has_permission()` = `RETURN FALSE` (`migrations/20260422000100_actor_has_permission_fail_closed.sql:24`); mantido por decisão consciente (`20260530551000:32`). **FASE 6 segue desligada.**
- **5 canais 0113 — baseline canal-1 ZERO:** `DT-0113-CANAL1-ACTIONCONTEXT-UNBOUND-BASELINE` drenado **12→10→7→6→5→3→2→1→0** via R8H(AP/AR)→R8J→R8K→R8L→R8N(automation/human-mvp)→R8O(organizers)→R8P(services-discovery)→R8Q(unifycard-method) (`REMEDIATION_DT_LOG.md:117/123/128/134/140/155/167`). Cada superfície terminou **BOUND** (canRepresentActor/req.user server-side) ou **CONTAINED** (501/403 antes do sink). Gate "**baseline 0113 = 0**" confirmado na entrada de payout 2026-06-20 (`DT_LOG:68`).
- **DT-mãe 0113 (`DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED`):** marcada **OPEN** em TODAS as entradas R8 (ex.: `DT_LOG:162`); "CLOSED só no reseal pós-Yala PASS material". **Baseline vazio ≠ DT-mãe selada.**
- **0136 (PROMULGADA/MATERIALIZADA Slice 1A):** criou tabela `actor_capability_grants` + `hasCapabilityGrant` (`DECISION_0136...md:§1`). **Invariante §2.3 explícito:** "Representar ≠ ter capability. `canRepresentActor` = vestir o actor; `hasCapabilityGrant` = capability no escopo. **Eixos distintos.**" **Sem enforcement em rota** — "availability/calendar permanecem **owner-only** (DECISION-0113 canal-1 / 0118 D2 SELADOS)" (`:5`). Grant é **aditivo** (§2.4), nasce inexistente (§2.7).
- **0137 (RFC docs-only):** tri-registry de permissões (`permission-keys.ts` × `business-permissions.types.ts` × `rbac.types.ts`) — ZERO código/runtime/enforcement.
- **0138 (RFC docs-only, CLOSED/YALA PASS):** operador de agenda por grant — availability/calendar **owner-only no código** (sem enforcement).

**2. RISCOS (fail-open de representação / canal não-bound / GET cria actor):**
- **Nenhum canal-1 unbound vivo** (baseline 0). Risco residual = **re-flag**: business-audit/policy-engine/risk-command-center seguram-se na Forma C do recognizer central, sem guard dedicado (`DT_LOG:96`, OPEN/HYGIENE não-bloqueante) — se a prova de subject server-side sumir, voltam a flaggar.
- **Trap de FASE 6:** `actor_has_permission` stub fail-closed é load-bearing. Religar sem preservar `assertActorRepresentable` (canRepresentActor binding no rbac.plugin) ressuscitaria autoria spoofável globalmente.
- **Trap da capability nova (0136):** `actor_capability_grants` está dormant. Se um Slice 1C futuro ligar `hasCapabilityGrant` em rota **sem** manter `canRepresentActor` como gate de representação a montante, mistura os dois eixos → fail-open. Vigiar na MACRO 2+.
- **Canais 2-5:** não revalidei exaustivamente de 1ª mão nesta rodada (só canal-1 tem baseline-detector). **Declaro PARCIAL** (memória diz cobertos em R7; precisa sweep próprio para afirmar denominador finito).

**3. RECOMENDAÇÃO (régua — descrever, não codar):**
- **§2 passo 5 do plano** (AUTORIDADE — pode contratar): a régua viva HOJE é `canRepresentActor(tenantId, req.user.id, actorId-alvo)` server-side, fail-closed, **antes** de qualquer mutação de ESTADO/booking. Vivo e correto. O gate accept-quote/R7b permanece **contido** (DECISION-0110 flag OFF) — a MACRO 2+ precisará dele vivo, mas é decisão Clayton/IA-DINHEIRO, não carona da orquestração.
- **Não** depender de `actor_has_permission`/RBAC para a escada de contratação enquanto FASE 6 OFF — usar `canRepresentActor` direto (padrão R8P/services-discovery), o primitivo vivo.
- Capability de módulo (`hasCapabilityGrant`/`can_manage_marketplace`) **não** substitui representação sobre o actor-alvo. Manter eixos separados (invariante 0136 §2.3).

**4. FRONTEIRA (cruza com outra instância?):**
- **IA-AUTORIDADE:** `actor_capability_grants` (0136), tri-registry (0137), `actor_has_permission` stub, calendar-operator-grant (0138) = **eixo dela**. Confirmo só que **não tocam o substrato de representação**.
- **IA-DINHEIRO:** payout-hardening (`dd270f41` toctou / `cd697da7` db-role+RLS / `e0fe89b9` reseal) é eixo dela; cruza comigo só na cadeia `identity→kyc_status` (gate de debit bloqueia `KYC_PENDING`). **Não muda canRepresentActor nem os 5 canais.**
- **IA-DECISOES-DT / IA-DOCUMENTOS:** o **fechamento formal** da DT-mãe 0113 (baseline 0 → seal Yala → CLOSED) é cartório — não meu para declarar fechado.

**5. STOPs:**
- Não fecho a DT-mãe 0113 (baseline 0 **não** é seal; pende reseal Yala + sweep dos canais 2-5).
- Não sugiro R2/delegação enquanto 0113 formalmente OPEN (vetor 5 já existe no código, mas a frente R2 segue congelada).
- Não trato `actor_capability_grants`/`hasCapabilityGrant` como autoridade de representação (eixo IA-AUTORIDADE).
- Canais 2-5: PARCIAL — exigem sweep de 1ª mão antes de afirmar denominador finito.
- Análise = INSUMO para a IA-DIRETORA; não é GO.

**Delta dev 385/387 → `dd270f41` (O3, meu eixo):** (a) DECISIONs **0133–0141 promulgadas** — meu eixo: 0133 (suppliers `owner_actor_id`→page-actor), 0134/0139 (referral actor-scoped), **0136 (substrato capability `actor_capability_grants` materializado, dormant)**, 0137 (tri-registry RFC), 0138 (calendar-operator RFC). (b) Baseline canal-1 **drenado a 0**. (c) `canRepresentActor` e stub FASE 6 **inalterados**. → No §14.5 acima a linha "DT-mãe 0113 (OPEN)" segue válida; **acrescentar 0136/0137/0138 ao rol de DECISIONs sob meu olhar**. O ponto-crítico do plano (gate vivo só pós-0113+FASE6) **permanece verdadeiro**.

**Status: RESPONDIDO** (canais 2-5 = PARCIAL; DT-mãe 0113 = baseline 0 mas formalmente OPEN/pende seal Yala — disco venceu minha memória de sessão).

> **ACK 2ª ativação (2026-06-20, HEAD revalidado `dd270f41`):** gatilho "vai" recolado. Reli §14.0 + §14.3 de 1ª mão: a **única tarefa endereçada a IA-ACTOR** é a RODADA 1 (§14.3, "IA-ACTOR → baseline dos 5 canais 0113 + 0136/0137 + `canRepresentActor` vivo"), **já respondida acima em 14.5.R1** — e o delta da **TASK O3** (ALVO: TODAS) já está incorporado no parágrafo final da R1. **Não há tarefa nova** para meu eixo nesta ativação; não reprocesso para não duplicar. Aguardo o próximo pedido da IA-DIRETORA em §14.3 (ex.: sweep de 1ª mão dos canais 2-5, hoje declarados PARCIAL).

_(sem novas tarefas — RODADA 1 entregue em 14.5.R1; aguardando próximo pedido da IA-DIRETORA em §14.3)_

---

### 14.6 IA-DOCUMENTOS — Documentação, Cartório e Hierarquia Documental (READ-ONLY ESTRITO)

- **Trato:** hierarquia documental do projeto (`docs/01_normative/` → DECISIONs → DT_LOG → STATUS → memórias); classificação de documentos (norma soberana / índice / status / log / memória / histórico / autoral / stale); coerência entre o que é **declarado** e o que é **verificado** no disco; regras de não-reescrita histórica (append-only, superação por nova entrada); vocabulário normativo ("promulgado" vs "committado"; "GOVERNED/DECIDED ≠ CLOSED"; "denominador parcial vs exaustivo"); como registrar DT-mãe / artefato-mapa / consolidação sem que memória vire norma soberana acidental; divergências em índices/metadados (`DECISOES.md` stale, cabeçalho do DECISIONS_LOG); anti-padrão "denominador fechado" quando cobertura é parcial.
- **Memória soberana da instância:** `docs/memorias/MINHA_MEMORIA_DOCUMENTOS.md` (único arquivo, além desta seção, que posso escrever).
- **Eixos documentais do plano sob meu olhar:**
  - §9 Modelo de Governança (papéis das instâncias, regra anti-quebra, epistemologia "disco vence narrativa") — verifico coerência, não executo.
  - §11 Resíduos/DTs — verifico se estão corretamente classificados (DT vs DECISION) e se carregam critério de convergência; **não abro/fecho DT**.
  - §14.3 INBOX — verifico que cada resposta carrega carimbo HEAD + fonte soberana + status (RESPONDIDO/STALE) e que nenhuma consolida memória como norma.
  - DECISIONs citadas pelo plano (0070/0077/0092/0110/0117/0132) — verifico se existem no DECISIONS_LOG com número correto e se o estado declarado bate com o corpo do log; **não promulgo nem cito como GO**.
- **Serviço concreto para a EXECUTORA neste plano:**
  1. Dizer **onde** registrar algo (qual doc, qual seção, que carimbo) sem inventar exaustividade.
  2. Sinalizar quando uma entrada no §14.3 está em risco de virar norma acidental (sem carimbo, sem fonte, sem status).
  3. Mapear divergências entre o que o plano declara e o que está no disco/log (DECISIONs citadas × corpo real do log).
  4. Recomendar o formato correto de DT-mãe / artefato-mapa antes de a EXECUTORA escrever no log oficial, para não precisar corrigir depois.
  5. Ser consultada quando a EXECUTORA estiver em dúvida sobre vocabulário normativo (ex.: "isso é DT ou DECISION?", "preciso de frente documental ou ponteiro basta?", "como registrar cobertura parcial honestamente?").
- **STOPs:** não editar `REMEDIATION_DECISIONS_LOG.md` / `REMEDIATION_DT_LOG.md` / `STATUS_EXECUCAO_GLOBAL.md` / `opus.md` / `docs/01_normative/` / código / migration / banco / frontend · não promulgar nem abrir DECISION ou DT no cartório oficial · não criar norma por consolidação · não declarar denominador exaustivo quando cobertura for parcial · insumo, não GO · qualquer resposta carrega carimbo HEAD + fonte soberana + status.

**À EXECUTORA — declaração de disponibilidade (IA-DOCUMENTOS):**
Identificada e à sua disposição em §14.3. Ao receber tarefa, revalido o HEAD/disco de 1ª mão (DECISIONS_LOG, DT_LOG, STATUS, arquivos citados) antes de qualquer veredito. Respondo somente sobre meu eixo (documentação / hierarquia / cartório / coerência declarado×verificado) — se a dúvida cruzar com DT, DECISION ou identidade, marco **TODAS** as instâncias pertinentes.

- Para **onde e como registrar** algo (doc certo, carimbo, anti-stale, denominador parcial): chame **IA-DOCUMENTOS**.
- Para dúvidas que cruzem documentação + DT: marque **IA-DOCUMENTOS + IA-DT**.
- Para dúvidas que cruzem documentação + DECISION: marque **IA-DOCUMENTOS + IA-DECISOES**.

— **IA-DOCUMENTOS**, pronta.

#### 14.6.1 RESPOSTA À TASK O1 — denominador cartorial real (frente A1) · 2026-06-20

**RESPOSTA PARA: IA-DIRETORA** (de: IA-DOCUMENTOS) · ALVO da tarefa: IA-DOCUMENTOS + IA-DECISOES
**HEAD no momento:** `dd270f41` · branch `rescue-structural` · **Revalidou no vivo: SIM** (1ª mão, disco).
**Fonte soberana usada:** `docs/02_decisions/DECISION_*.md` (listagem de disco) · `REMEDIATION_DECISIONS_LOG.md:9` (header) + corpo L6730–7302 · `docs/02_decisions/DECISOES.md:1-3,95` (índice).

**VEREDITO:** A premissa do plano dev-385 ("A1 = 0116→atual / indexar 0128-0130") está **STALE e errada no alvo**. O disco mostra que **o cartório-fonte (`REMEDIATION_DECISIONS_LOG.md`) já está em dia** — header e corpo vão até **0141**. O que está defasado é **só o índice `DECISOES.md` (para em 0111)**. Logo **A1 real = reindexar 0112→0141 no `DECISOES.md`** (30 decisões), **não** tocar no LOG. Achado lateral: **0119 e 0120 têm `.md` mas não têm entrada própria no corpo do LOG** (só citadas dentro do índice da 0131) — divergência declarado×verificado a ressalvar.

**1. EVIDÊNCIAS (arquivo:linha / divergência declarado×verificado):**

- **(a) Arquivos `.md` no disco** — `docs/02_decisions/` tem DECISION_*.md contíguos de **0064 até 0141** (mais contratos `DECISION_CORE_*`/`GATE_ZERO_B`/`SAFETY_*`). Janela A1 (**0112→0141 = 30 arquivos**): **todos presentes**. Maior número vivo = **0141** (`DECISION_0141_UNIFYCARD_FEE_SCHEMA_OF_RECORD.md`). → o re-baseline que falava "até 0139" está **abaixo do disco**; disco vence: vai a **0141**.
- **(b) Header do `REMEDIATION_DECISIONS_LOG.md`** (`:9`): **"Última entrada | DECISION-0141 (2026-06-19)"** — **CORRENTE, não stale.** (Minha memória trazia "header preso em 0057/0116" — **envelheceu**; foi atualizado.) **Corpo do LOG** vai até **0141** (`## DECISION-0141` em L7302; total 5514 linhas). Cadeia 0100–0141 íntegra, com 1 exceção (abaixo). → **o LOG NÃO é o gargalo de A1.**
- **(c) Índice `DECISOES.md`** (`:3` "Gerado: 2026-06-06"; `:95`): **última linha da tabela-mestra = `0111`** (`DECISION_0111_SERVICE_RELEASE_CANCEL_DISPUTE_REFUND_POLICY`). Cobre 0064→0111; **ausentes 0112→0141 (30 decisões)**. → **este é o delta real de A1.** O próprio doc se declara "índice/auditoria operacional, NÃO fonte normativa soberana" (`:1-3`) e prevê correção por "frente documental própria" (`:item 5`).
- **Achado lateral (denominador honesto):** **0119 e 0120** existem como `.md` (`DECISION_0119_REFERRAL_LINK_PURE_VINCULO.md`, `DECISION_0120_CIVIL_IDENTITY_CONFIRMATION_SSOT_SEPARATION.md`) **mas não têm `## DECISION-0119/0120` próprios no corpo do LOG** — o corpo salta de 0118 (L6877) para 0121 (L6897). Aparecem **apenas citadas** dentro do índice da DECISION-0131 (L7084: "…0116/0119/0120/0121…"). Divergência **declarado×verificado**: arquivo-promulgado existe, entrada-de-log própria não. **Não decido se é gap ou promulgação-só-por-arquivo** — sinalizo para ruling de IA-DECISOES-DT.

**2. RISCOS:**
- **Denominador falso-fechado:** indexar 0112→0141 **não** resolve o achado 0119/0120 no LOG — se ficar fora, o denominador é **parcial**, não exaustivo. Marcar: "índice reindexado 0112–0141; pendência 0119/0120-no-LOG = item próprio".
- **Reescrita de cabeçalho histórico (proibida):** A1 **não** pode "consertar" entradas antigas do LOG nem reescrever o header (já correto em 0141). O LOG é append-only; mexer nele por causa do índice inverteria a hierarquia (índice ≠ soberania).
- **Índice virando norma acidental:** `DECISOES.md` é auditoria, não fonte. Reindexá-lo **não promulga** nada; status real de cada DECISION = `.md` + LOG + runtime. Não tratar o índice atualizado como "estado consolidado verdadeiro" sem o ⚠️ declarado×verificado que o próprio doc usa.
- **Vocabulário:** ao reindexar, manter a coluna "declarado × verificado" (DOCS-ONLY ≠ implementado; GOVERNED/DECIDED ≠ CLOSED). Copiar só o título sem o estado real recria a defasagem.

**3. RECOMENDAÇÃO (onde/como — descrever, NÃO escrever no cartório):**
- **Alvo de A1 = `docs/02_decisions/DECISOES.md`** (índice), **não** o `REMEDIATION_DECISIONS_LOG.md` (já em dia). Ação: **acrescentar 30 linhas** (0112→0141) à tabela-mestra, cada uma com: nº · arquivo `.md` · "natureza declarada" (cabeçalho da DECISION) · **estado verificado** (IMPLEMENTADO/PARCIAL/NÃO-IMPLEMENTADO/NÃO-AUDITADO) · evidência `migration/arquivo:linha`. O **estado verificado por DECISION é da IA-DECISOES-DT** + prova-viva da IA-BANCO onde for "isto está implementado?"; eu defino **forma e lugar**, não o conteúdo decisório.
- **Carimbo da reindexação:** atualizar o header do índice (`Gerado: 2026-06-06` → corte novo + HEAD `dd270f41`), preservando o disclaimer "índice/auditoria, não fonte soberana". É **edição do índice** (auditoria), legítima sob GO — **não** reescrever DECISION nem LOG.
- **0119/0120-no-LOG:** **não** emendar retroativamente o corpo do LOG. Se for gap real, a forma canônica é **nova entrada append-only** referenciando os `.md` (decisão de IA-DECISOES-DT + Clayton), **não** inserir `##` no meio do histórico. Registrar como **item A1-b separado**, com denominador honesto.
- **Sequência sugerida de A1:** (1) IA-DECISOES-DT fecha a coluna "natureza+estado" de 0112–0141; (2) IA-BANCO confirma "implementado?" onde aplicável; (3) executora reindexa `DECISOES.md` sob GO; (4) item A1-b (0119/0120-no-LOG) corre como ruling próprio. Tudo append/edição-de-índice — zero toque no LOG histórico.

**4. FRONTEIRA (cruza com outro dono):**
- **IA-DECISOES-DT** (co-alvo de O1): a **lista 0112→0141 com status declarado por DECISION** e o **ruling 0119/0120** são do eixo dela (o QUE foi decidido / é dívida). Eu entrego o **mapa cartorial** (arquivo ✓ / entrada-no-LOG ✓-✗ / no-índice ✗) e o **ONDE/COMO** registrar. Ver §14.4.
- **IA-BANCO-DE-DADOS:** "estado verificado = implementado?" por DECISION exige prova-viva de schema/runtime fora do meu alcance read-only → **INCONCLUSIVO no meu eixo**, encaminho.
- **Registro oficial** (editar `DECISOES.md` / abrir entrada no LOG) = **executora sob GO + Clayton**, nunca eu.

**5. STOPs:**
- NÃO editei `DECISOES.md`, `REMEDIATION_DECISIONS_LOG.md`, nem qualquer cartório — só **li**.
- NÃO reescrever header histórico do LOG (já correto em 0141); append-only.
- NÃO declarar A1 "fechado" só com a reindexação enquanto 0119/0120-no-LOG estiver pendente — denominador seria parcial.
- NÃO tratar `DECISOES.md` (índice) como fonte soberana; reindexar ≠ promulgar.
- Análise = **insumo** para a IA-DIRETORA; não é GO.

**Status: RESPONDIDO** (HEAD `dd270f41`, revalidado de 1ª mão no disco; minha memória estava stale no ponto "header do LOG" — corrigida pela leitura viva).

#### 14.6.2 RE-ATIVAÇÃO — confirmação (2026-06-20)
**HEAD no momento:** `dd270f41` · branch `rescue-structural` · **Revalidou no vivo: SIM** (git rev-parse + leitura do §14.3).
Re-ativada pelo gatilho da IA-DIRETORA. Reli §14.0 + §14.3 (inbox lines ~298–354): **a única tarefa endereçada a IA-DOCUMENTOS continua sendo a TASK O1, já RESPONDIDA em §14.6.1 acima** — não há tarefa nova no inbox para o meu eixo. HEAD inalterado desde a resposta; o veredito de §14.6.1 **permanece válido** (A1 real = reindexar `DECISOES.md` 0112→0141; LOG já em dia até 0141; pendência lateral 0119/0120-sem-entrada-própria-no-LOG). Nada a acrescentar até a IA-DIRETORA postar nova tarefa. **Status: RESPONDIDO (sem delta).**

_(sem outras tarefas abertas — aguardando próximos pedidos da IA-DIRETORA em §14.3)_

---

### 14.7 IA-DINHEIRO — Eixo Monetário (READ-ONLY ESTRITO)

- **Trato:** a causalidade do dinheiro (mutation → estado → dinheiro → evento) e o SSOT financeiro único `bank_ledger`. Domínio: UnifyBank / `bank_transactions` / `bank_accounts` / `bank_splits`, splits, payout, settlement, escrow, wallet (`actor_wallet`/`user_wallet`), recovery, refund, AP/AR, fundo regional, grupo-dinheiro, `economic_policy_engine` (fee/bps). Para este plano, sou a instância que responde: **"isto move/reserva/retém/debita/liquida/projeta dinheiro de verdade (toca `bank_ledger`) ou é substrato latente/comercial/projeção?"** e **"a fronteira do SSOT financeiro (§4.6: nada acede `bank_ledger` fora do Bank) e os invariantes do cofre estão preservados?"** — veja §2 passo 8 (FINANCEIRO diferido) e passo 6 (split/fee-bps), §4 precisão #1 (`price_cents` faturável), §5 MACRO 6+ (fiação financeira selada), §7 blindagem #3 (presença ≠ crédito).
- **Memória soberana da instância:** `docs/memorias/MINHA_MEMORIA_DINHEIRO.md` (única, além desta seção, que posso escrever; append-only, histórico nunca apagado).
- **Frase-guia:** O ledger é o cofre. Read model é vitrine. Saldo não se deduz. Split não se reescreve. Payout não confia em snapshot. Dinheiro sem gate é vazamento. Dinheiro sem ledger é mentira.
- **DECISIONs do plano sob meu olhar:** 0024 (ledger-only SSOT / cache deprecado), 0053 (`availableBalanceCents` = projeção de leitura, não autoriza saque), 0110 (firewall financeiro de serviço / accept-quote gate — meu eixo = o que toca `bank_ledger` atrás do gate), 0114 (autoridade inicial fundo regional + AP/AR latente + STOP), 0117 (`service_offerings.price_cents` BIGINT = preço faturável canônico), 0128/0130 (substrato de aprovação financeira — materializado, NÃO seedado, fail-closed por vazio), 0131 (índice/authority map — ver memória), 0132 (tempo no SSOT temporal — relevante só para "oferta sem tempo não fatura").
- **DTs do plano sob meu olhar (de §11):** `DT-D2-WIRING-MONEY-PENDING` (fio `escrow→actor_wallet`; `mockUnifyCardCharge` é o bloqueador de produção), `DT-SETTLEMENT-REGIONAL-FEE-BPS-DEAD-CODE-GUARD` (fee bps), `accept-quote` 403 contido / R7b (DECISION-0110 flag OFF — o que cai no Bank quando materializar é meu escopo). Da minha memória, ainda vivas e relevantes ao plano: `DT-RECOVERY-PAYOUT-GATE` (parcial; saque externo pendente), `DT-RECONCILIATION-OBSERVABILITY-WINDOWS B/C` (janelas async sem sweep), balance paralelo `regional_funds.total_balance_cents` (dual-truth latente, flag `USE_BANK_REGIONAL_FUND` default OFF).
- **Ponto crítico neste plano:** o §2 step 8 diz "Dinheiro só no/após contratar, via `bank_ledger` SSOT, lendo `service_offerings.price_cents`". Isso só é seguro porque: (a) o fluxo lê **sempre** `service_offerings.price_cents` BIGINT (faturável), nunca `services.price_cents` INTEGER (indicativo); (b) a fiação financeira está **diferida/selada** (MACRO 6+, `mockUnifyCardCharge` bloqueia produção); (c) **presença habilita, não credita** (§7 #3). Quando a MACRO 6+ acordar, cada touchpoint que tocar `bank_ledger` exige as **três paralelas** (A norma/autoridade · B schema/código/legado · C concorrência/gates/regressão) + E2E fail-first + 4 gates âncora + `money-live` + `canal3-money` + selo Yala. Nada de payout/escrow/split por carona da orquestração.
- **Fronteira de eixo:** autoridade/representabilidade da ação financeira (`canRepresentActor`, 5 canais 0113, KYB) = eixo **IA-ACTOR-USERS** → quando uma superfície financeira tem fail-open de autoridade, **ambas respondem, IA Diretora consolida** (eu sou dona de "isto está numa superfície que move dinheiro / latente vs `bank_ledger` real"). Registro formal de DT/DECISION = **IA-DT/IA-DECISOES** + Clayton. Onde/como registrar = **IA-DOCUMENTOS**. Prova-viva de runtime/deploy fora do meu alcance read-only (valor de env/flag, `\d` de coluna) → declaro **INCONCLUSIVO** e encaminho à IA-BANCO-DE-DADOS/infra.
- **STOPs (herdados da minha memória):** não executo · não refatoro · não crio/edito migration · não commito · não edito código/banco/frontend/`STATUS`/`opus`/`REMEDIATION_*`/outras memórias · não fecho/abro DT · não abro/promulgo DECISION · não rodo SQL destrutivo · não rodo suíte mutável em `unificard_dev` · não infiro saldo fora do Bank · não proponho gate isolado como "solução financeira completa" · não trato presença como crédito · não declaro fatia "fechada" sem três paralelas + E2E fail-first + gates + selo Yala · análise = insumo, **não GO**.

**À EXECUTORA — declaração de disponibilidade (IA-DINHEIRO):**
Identificada e à sua disposição em §14.3. Ao receber tarefa, revalido o HEAD/disco de 1ª mão antes de qualquer veredito. Respondo somente sobre meu eixo (dinheiro/`bank_ledger`/split/payout/settlement/escrow/wallet/recovery/refund/AP-AR/fundo regional/fee-bps/`price_cents` faturável) em bloco copiável com **VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · STOPs** — se a dúvida cruzar autoridade marco **IA-DINHEIRO + IA-ACTOR-USERS**; se cruzar DT/DECISION/registro direciono ao colega.

- Para **dinheiro / `bank_ledger` / split / payout / settlement / escrow / wallet / recovery / refund / AP-AR / fundo regional / fee-bps / `price_cents` faturável**: chame **IA-DINHEIRO**.
- Para dúvidas que cruzem dinheiro + autoridade: marque **IA-DINHEIRO + IA-ACTOR-USERS**.
- Para dúvidas que cruzem dinheiro + DT/DECISION: marque **IA-DINHEIRO + IA-DT** ou **IA-DINHEIRO + IA-DECISOES**.

— **IA-DINHEIRO**, pronta.

_(sem tarefas abertas — aguardando o primeiro pedido da EXECUTORA em §14.3)_

#### 14.7.1 DÚVIDAS DESTA INSTÂNCIA — IA-DINHEIRO (aguardando resposta)
1. **Âncora viva sob demanda (não sweep autônomo).** O plano cita touchpoints financeiros (`service_offerings.price_cents` BIGINT, `economic_policy_engine` bps, `escrow→actor_wallet`, `mockUnifyCardCharge`, accept-quote/DECISION-0110) sem carimbar HEAD/dev. Minha primeira ação ao receber tarefa será **revalidar essas âncoras contra o disco vivo**. Confirmo que devo fazê-lo **sob demanda da EXECUTORA** (por tarefa em §14.3) e **não** varrer o plano por conta própria agora. Se Clayton/EXECUTORA preferir um sweep inicial de âncora do eixo dinheiro, registrar como tarefa explícita.
2. **Limite de escrita.** Confirmo meu alcance de escrita = **somente** este documento (§14.7) + `docs/memorias/MINHA_MEMORIA_DINHEIRO.md`. Se algum veredito meu exigir registro fora disso (abrir DT no log oficial, alterar `opus.md`/`STATUS`), eu **paro e sinalizo** — o registro formal é da EXECUTORA/Clayton ou das instâncias donas (IA-DT/IA-DECISOES/IA-DOCUMENTOS).

#### 14.7.2 — RESPOSTA RODADA 1 / TASK O3 (re-baseline de eixo dinheiro) · IA-DINHEIRO

**RESPOSTA PARA:** IA-DIRETORA (de: IA-DINHEIRO) · **HEAD no momento:** `dd270f41` (branch `rescue-structural`) · **Revalidou no vivo:** sim (1ª mão: 3 commits, migration RLS, DECISIONs 0131/0140/0141, `ls migrations`) — **parcial** só na dimensão runtime-aplicado-no-dev (não rodo SQL em `unificard_dev`).

**VEREDITO:** o payout-hardening recente **NÃO adiantou B5/C3 do 0131 no sentido próprio** (os **6 planos de autoridade**). Endureceu um **conjunto vizinho money-cêntrico** (RLS nas **7 tabelas payout/approval/recovery**), com **interseção de apenas 1** dos 6 planos (`financial_approval_authorities`). O que avançou **materialmente** é o **endurecimento do eixo dinheiro** (toctou execute-time + role `NOSUPERUSER/NOBYPASSRLS` + RLS tenant-scoped do substrato payout) — mas **COMMITTED + PROVEN-EPHEMERAL + NOT LIVE IN DEV + PROD-FAIL-CLOSED**. Estado money no go-live inalterado: **payout NOT AUTHORIZED · PORTA-1 NOT SEEDED · worker default-off · HTTP 403**. **0140/0141 (fee-bps) = régua DOCS-ONLY, NÃO materializadas.**

**1. EVIDÊNCIAS** (`arquivo:linha` / DECISION / migration):
- **`dd270f41` (toctou):** `backend/src/modules/wallet/actor-wallet-payout.service.ts` (+48) — `executeActorWalletPayout` agora chama `requireFinancialRiskClearance(action='financial_payout', amountCents)` revalidando ATL→KYC→KYB→GUARDA com **envelope de payout** (antes: só `transfer` com envelope errado `maxTransfer`/nunca `maxPayout`) + bloqueio `recovery pending_approval` `FOR UPDATE`. Erros novos `PAYOUT_*_AT_EXECUTE`. Provas 5/5 efêmero; guard `audit-payout-toctou-safety.mjs` (77 OK/0 FAIL). **Axioma: execute-time nunca mais permissivo que approval-time.** → frente própria **F-PAYOUT-TOCTOU-SAFETY-HARDENING**, NÃO B5/C3.
- **`cd697da7` (db role/RLS):** `backend/migrations/20260620120000_db_role_rls_hardening.sql` — role `unificard_app` `NOSUPERUSER/NOBYPASSRLS` + `ENABLE`+`FORCE` RLS + policy tenant-scoped (`app.current_tenant`) + `infra_bypass TO unificard_infra` nas **7 tabelas** (migration:69-176): `actor_wallet_payout_requests`, `financial_approval_policies`, `financial_approval_authorities`, `financial_approval_policy_events`, `approval_requests`, `actor_wallet_recovery_obligations`, `actor_wallet_recovery_obligation_entries`. Preflight `db-role-rls-preflight.ts` wired no `BOOT.ts` (fail-closed prod). Objetivo: matar o "RLS theatre" (app conectava como superuser → bypassa RLS mesmo em FORCE).
- **B5/C3 (`PLANO-DEFINITIVO-0131-EXECUTORA.md:25,45,71`):** os **6 planos de autoridade** = `company_users` · `actor_delegations` · `financial_approval_authorities` · `tenant_operator_grants` · `reconciliation_disputes` · `reversals` — "**RLS = 0 em TODOS os 6**" (L25). C3 (L71) = `ENABLE`+`FORCE`+policy `tenant_id`, **gated B5 · depende de C1** (mapper de identidade). → **Interseção {7 endurecidas} ∩ {6 planos} = só `financial_approval_authorities`**. Os outros **5 planos seguem RLS-OFF**.
- **`e0fe89b9` (reseal Yala — WM1):** migration **COMMITADA** (395 `.sql`) mas **NÃO aplicada ao `unificard_dev`** (394 aplicadas; **7 tabelas RLS OFF em dev**). `role unificard_app` = objeto cluster-global criado em efêmero → não prova aplicação no dev. Selo = `CLOSED / MATERIAL / YALA PASS_WITH_WARNINGS / PROVEN-EPHEMERAL / PROD-FAIL-CLOSED / NOT LIVE IN DEV`. Ativação = passo **ops fora do repo** (aplicar migration · `ALTER ROLE … LOGIN PASSWORD` · repontar runtime · preflight); NÃO autoriza PORTA-1/worker/external/HTTP/go-live.
- **Disco (1ª mão):** 395 `.sql` migrations (= "395/395" dos commits); migration RLS presente no disco; **nenhuma migration contém `fee_rate_bps`**.
- **0140:** régua `fee_rate_bps INTEGER`/`feeRateBps` **DOCS-ONLY**; **implementação NOT DONE**; `DT-UNIFYCARD-METHOD-FEE-UNIT-BPS-MIGRATION` **OPEN/MATERIAL_REQUIRED**; trilho unifycard-method **CONTIDO 501**; bug **299¢ vs 3¢** latente (`/100`).
- **0141:** SSOT de fee/split = **`economic_policy_engine` / `economic_policy_lines.bps`** (âncora DECISION-0047); `payment_methods`/`unifycard_payment_methods` **NÃO** são SSOT; execução futura = **`gross_cents * fee_rate_bps / 10000`**; proibido `/100`. DOCS-ONLY.

**2. RISCOS** (do meu eixo):
- **C3 mascarado:** "RLS hardening feito" ≠ "B5/C3 avançados" — 5/6 planos de autoridade seguem RLS-OFF; o endurecido foi o **substrato payout/approval/recovery** (meu eixo).
- **RLS tenant-scoped ≠ ameaça intra-tenant:** `app.current_tenant` cobre cross-tenant, **não** actor-vs-actor no mesmo tenant (consistente com ponteiro SPR-RLS). Alinhado ao C3 (tenant-scoped), mas ameaça actor-scoped permanece (exigiria C1).
- **NOT LIVE:** provado só em efêmero; dev com 7 tabelas RLS OFF → defesa ainda "teatro" no dev. **Committed ≠ live.**
- **C1 não satisfeito:** C3 depende de C1 (mapper `user_id↔global_user_id↔actor_id`); migration entregou RLS tenant-scoped sem mapper (ok por ser tenant-scoped). Actor-scoped exigiria C1.
- **fee-bps latente:** `fee_rate_bps` não existe em migration; bug 299¢→3¢ dormente; DT OPEN. Não inferir resolvido.

**3. RECOMENDAÇÃO** (régua — descrever, NÃO codar):
- Re-baseline: payout-hardening avançou **endurecimento do eixo dinheiro** (toctou+role+RLS do substrato payout/approval/recovery), **NÃO B5/C3** (5/6 planos OFF e ABERTOS; donos = **IA-AUTORIDADE** + **IA-BANCO**).
- Carimbar `COMMITTED + PROVEN-EPHEMERAL + NOT LIVE IN DEV + PROD-FAIL-CLOSED`, nunca "fechado/live". Ativação = passo ops fora do repo.
- fee-bps (0140/0141): manter **régua DOCS-ONLY**; materialização exige Evidence Pack + 3 paralelas + E2E 299¢ + negative-proof `/100` + Yala reseal (per 0140). Sem carona.
- MACRO 6+ **diferida**; nada aqui destrava payout/escrow/fundo regional/cartão.

**4. FRONTEIRA:** **IA-AUTORIDADE** (RLS dos 6 planos é eixo dela; eu = interseção `financial_approval_*`/payout/recovery) + **IA-BANCO** (prova-viva runtime-aplicado-no-dev: migration RLS aplicada? RLS live? `unificard_app` com LOGIN? `economic_policy_lines.bps` materializado? — **INCONCLUSIVO**) + **IA-DECISOES-DT** (cartório B5/C3 + DTs fee-bps/payout).

**5. STOPs:** saldo só do `bank_ledger`; `availableBalanceCents` nunca autoriza saque; `amount_cents` BIGINT · presença habilita, não credita · money sem carona (3 paralelas + E2E + gates + money-live + canal3-money + Yala) · não declarar C3/B5 avançados (5/6 OFF) · committed ≠ live · fee só via `economic_policy_engine` em bps, nunca `/100` · PORTA-1 = ato soberano de Clayton · insumo, **não GO**.

**Status: RESPONDIDO** (runtime-aplicado-no-dev = **INCONCLUSIVO** → IA-BANCO).


---

### 14.8 IA-TEMPO — Tempo, Agenda e Disponibilidade (READ-ONLY ESTRITO)

- **Trato:** o eixo temporal soberano — agenda, disponibilidade, `unified_availability` (SSOT temporal) + `unified_bookings`, unified calendar (read-model), conflitos, slots, janelas, recorrência, evento-como-projeção, booking/compromisso. Para este plano, sou a instância que responde o **passo 4 da escada (§2 — TEMPO: "quando")** e as invariantes temporais que ele dispara: *"oferta sem tempo disponível não é oferta real"*, *"tempo no SSOT temporal, não duplicado na oferta"* (§4 precisão 2, §6), e o gate presença→completion da **MACRO 4** (`actual_start_at`/`actual_end_at`). Minha pergunta canônica neste documento: **"a interseção `service_offerings × unified_availability` é leitura escopada-a-actor, read-only, sem duplicar tempo e sem resolver conflito por heurística?"**
- **Memória soberana da instância:** `docs/memorias/MINHA_MEMORIA_TEMPO.md` (única, além desta seção, que posso escrever; append-only, histórico nunca apagado).
- **Frase-guia:** Tempo não é enfeite. Agenda é SSOT operacional. Disponibilidade privada não é vitrine. Evento é projeção, não causa primária. ActorId declarado é hint. Self vem do servidor. Conflito gera fato, nunca ação automática.
- **Autoridade canônica que me governa:** `CONSTITUICAO_UNIFICARD.md` (Art. II — Agenda como Verdade Única; conflito → fato → alerta → humano, nunca ação automática) → `CORE_IMUTAVEL.md` (Core Temporal Absoluto; "evento NÃO é agenda") → `CORE_TEMPORAL_CONTRACT.md` → `AGENDA_UNIVERSAL_CONTRACT.md` → `CORE_TEMPORAL_HARDENING_CONTRACT.md` (Gate Temporal bloqueante).
- **DECISIONs do plano sob meu olhar:** **0132** (tempo no SSOT temporal; disponibilidade da oferta vive em `unified_availability` com `owner_type='service_offering'` — meu eixo central neste plano), **0014** (C63 — eliminação de WRITE paths legados em `schedules`/`schedule_slots`), **0113** (5 canais actorId — incide na agenda: `actorId` declarado é HINT, exige `canRepresentActor` antes de ler/escrever availability), **0115 D4** (agenda do nascimento vertical G10 é self/`req.user`, server-side, sem depender de FASE 6).
- **DTs do plano sob meu olhar:** **C63** (CRITICAL, IN_PROGRESS via 0014 — SSOT temporal duplicado; REVOKE `20260428200000` pende prova-viva de aplicação), **DT-AVAILABILITY-CONFLICT-EFFECT-EMISSION-DRIFT** (`.toISOString()` sobre campo possivelmente `undefined` do SQL `detect_availability_conflicts`), **DT-PROFILE-AGENDA-CONFIRM-ACTIVATE-MISSING** (schedule declarativo sem mecanismo que gere slots reais — relevante quando a MACRO 2 semear offerings que precisem de disponibilidade real), **DT-READ-PATH-ENSUREUSERACTOR-DIFFUSE-CURE** (GET não pode criar actor — invariante §8 do meu eixo).
- **Pontos críticos neste plano:**
  1. **§2 passo 4 ("oferta sem tempo não é oferta real"):** correto e alinhado ao SSOT temporal. Guarda obrigatória — a discovery **lê** `unified_availability`; **nunca grava** tempo na oferta. `service_offerings` não pode ganhar coluna de disponibilidade (seria core temporal paralelo / C63-análogo).
  2. **Conflito é ALERTA, não exclusão automática que dispense humano.** O passo 4 diz "candidato ocupado cai fora" — coerente como *filtro de disponibilidade declarada* (janela livre × ocupada). Mas **detecção de conflito de agenda (`detectConflicts`) gera fato→alerta→humano (Constituição Art. II)**; não pode virar otimização/ranqueamento automático de horário. Distinguir "não tem janela livre" (filtro legítimo de oferta) de "resolver conflito" (proibido sem humano).
  3. **`owner_type='service_offering'` exige prova-viva.** Minha memória registra o enum `AvailabilityOwnerType` incluindo `service_offering` no HEAD `20fe30cc` (6/6 policy==enum, fail-closed). Antes de qualquer veredito de execução da MACRO 2/4, revalido o enum vivo + a policy de autoridade desse owner_type contra o disco do HEAD do momento.
  4. **MACRO 4 (presença→completion):** o gate `actual_start_at`/`actual_end_at` toca tempo de execução; mas **presença ≠ agenda** (Blindagem 3 do §7) e **presença ≠ crédito**. Quando a executora chegar aqui, audito se o bridge lê/escreve tempo no lugar certo sem criar scheduler paralelo nem mover dinheiro.
- **Fronteira de eixo:** autoridade sobre availability (`canRepresentActor`, 5 canais 0113 na agenda) = cruza com **IA-ACTOR-USERS**; booking↔dinheiro/split/escrow = **IA-DINHEIRO/IA-BANCO**; registro formal de DT/DECISION = **IA-DT/IA-DECISOES** + Clayton; onde/como registrar = **IA-DOCUMENTOS**. Prova-viva de runtime/deploy fora do meu alcance read-only (REVOKE aplicado, valor de flag, `\d` de enum) → declaro **INCONCLUSIVO** e encaminho à IA-BANCO-DE-DADOS/infra.
- **STOPs (herdados da minha memória):** não executo / não commito / não migro / não fecho DT / não abro DECISION / não toco Bank/ledger/frontend. Registro **STOP** quando: pedido implica WRITE em `schedules`/`schedule_slots` (C63) ou core temporal paralelo · resolução/bloqueio/otimização automática de conflito (viola Art. II) · persistir `schedule` declarativo como verdade · GET que cria actor (`ensureUserActor`) · `actorId` declarado tratado como autoridade sem `canRepresentActor` · ambiente local apresentado como exceção (HARDENING: "local não é exceção") · estado narrativo do pedido conflita com o HEAD vivo e não posso revalidar por leitura. Análise = insumo, não GO.

**À EXECUTORA — declaração de disponibilidade (IA-TEMPO):**
Identificada e à sua disposição em §14.3. Ao receber tarefa, revalido o HEAD/disco de 1ª mão antes de qualquer veredito (disco vence narrativa; minha memória e este plano podem estar stale). Respondo somente sobre meu eixo (tempo/agenda/disponibilidade/`unified_availability`/booking/conflito/evento-como-projeção) em bloco copiável: **VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · STOPs**.

- Para **tempo / agenda / disponibilidade / interseção oferta×availability / conflito / booking / `owner_type='service_offering'`**: chame **IA-TEMPO**.
- Para dúvidas que cruzem **autoridade sobre availability** (canRepresentActor na agenda, canais 0113): marque **IA-TEMPO + IA-ACTOR-USERS**.
- Para dúvidas que cruzem **booking↔dinheiro/split/escrow**: marque **IA-TEMPO + IA-DINHEIRO** (fora do meu eixo puro, encaminho).

— **IA-TEMPO**, pronta.

#### 14.8.1 DÚVIDAS DESTA INSTÂNCIA — IA-TEMPO (aguardando resposta)
1. **Âncora viva de 0132 (sob demanda, não sweep autônomo).** O plano fixa `unified_availability owner_type='service_offering'` (DECISION-0132) como ponto onde a oferta cruza com tempo, mas não carimba HEAD/dev. Ao receber tarefa revalido contra o disco vivo: (a) `service_offering` no enum `AvailabilityOwnerType` + policy em `OWNER_AUTHORITY_POLICIES`; (b) DECISION-0132 promulgada com esse conteúdo. Faço isso **sob demanda da EXECUTORA por tarefa em §14.3**; não varro o plano sozinha. Se Clayton preferir um sweep inicial de âncora temporal, registrar como tarefa explícita.
2. **Limite de escrita.** Confirmo meu alcance de escrita = **somente** este documento (§14.8) + `docs/memorias/MINHA_MEMORIA_TEMPO.md`. Qualquer registro fora disso (DT no log oficial, `opus.md`/`STATUS`) → **paro e sinalizo**; é da EXECUTORA/Clayton ou das instâncias donas.

#### 14.8.2 RESPOSTA — RODADA 1 (re-baseline de eixo) · IA-TEMPO

```
RESPOSTA PARA: IA-DIRETORA  (de: IA-TEMPO)
HEAD no momento: dd270f41 (branch rescue-structural) | Revalidou no vivo: SIM (git + disco de 1a mao)
Tarefa (14.3, linha 348): 0132 promulgada muda o passo 4 da escada? owner_type='service_offering'
vivo no enum? REVOKE C63 (20260428200000) aplicado?

VEREDITO: o passo 4 da escada esta VIVO e correto no disco — MAS ancorado na DECISION ERRADA no plano.
A 0132 NAO e a fonte de owner_type='service_offering'; a fonte e a DECISION-0117 D. A 0132 governa
OUTRA coisa (finalidade temporal). owner_type='service_offering' esta vivo no enum + policy + CHECK no
disco. Aplicacao no BANCO vivo (REVOKE C63, CHECK, coluna 0132) = INCONCLUSIVO -> IA-BANCO.

1. EVIDENCIAS (arquivo:linha / DECISION / migration):
   a) DECISION-0132 != owner_type. docs/02_decisions/DECISION_0132_TEMPORAL_PURPOSE_CONCEPT.md:1,21,35
      -> 0132 = "finalidade temporal da agenda pessoal como CONCEPT", persiste em
      availability.purpose_concept_id (4 slugs: trabalho/estudo/cuidados-pessoais/lazer). NAO menciona
      owner_type='service_offering' em ponto algum. => o plano (2 step 4, 4 tabela, 4 precisao #2, 6)
      e minha PROPRIA 14.8/14.8.1 atribuem 0132 ao owner_type — CITACAO ERRADA.
   b) Fonte REAL do owner_type='service_offering' = DECISION-0117 D. Enum vivo:
      backend/src/core/availability/unified-availability.types.ts:24
      -> SERVICE_OFFERING = 'service_offering' // owner_id = service_offerings.id — DECISION-0117 D.
      Enum completo (6): user . service . event . group . page . service_offering (linhas 19-24).
   c) Policy de autoridade do owner_type viva: availability-owner-authority.ts:53 (OWNER_AUTHORITY_POLICIES
      Record<AvailabilityOwnerType,...>) + linhas 71-74 -> service_offering resolve
      SELECT provider_actor_id FROM service_offerings... (DECISION-0117 D). 6/6 cobertos, fail-closed.
   d) CHECK fisico no disco: backend/migrations/20260612110000_availability_owner_type_check.sql:25,32
      (DECISION-0118 D2) -> CHECK (owner_type IN ('user','service','event','group','page','service_offering')),
      fail-closed, espelhado no enum (comentario linhas 13-14: "nao alterar um sem o outro").
   e) 0132 saiu do HOLD: o .md (3,10,11) diz "DOCS-ONLY / COMMIT 2 pendente", mas no DISCO a FATIA 2
      JA esta materializada -> backend/migrations/20260616120000_seed_concepts_temporal_purpose.sql +
      20260616120100_availability_purpose_concept_id.sql (ADD COLUMN purpose_concept_id) +
      backend/src/core/availability/temporal-purpose.ts + e2e validate-pipeline-e2e-temporal-purpose.ts.
      => estado DECLARADO da 0132 (.md) esta STALE vs disco. (Insumo p/ IA-DECISOES/IA-DOCUMENTOS.)
   f) REVOKE C63: arquivo existe -> backend/migrations/20260428200000_schedules_revoke_write.sql:4-5
      -> REVOKE INSERT,UPDATE ON schedules/schedule_slots FROM PUBLIC (ref DECISION-0014 / C63).

2. RISCOS:
   - Citacao 0132->owner_type (no plano e na minha 14.8 anterior): leva a executora a procurar a regra de
     owner_type na 0132 (nao acha) e a confundir FINALIDADE temporal (purpose_concept_id, privada do actor:
     trabalho/estudo/cuidados/lazer) com OWNER da oferta (service_offering). Sao camadas DISTINTAS. Risco de
     desenho: tratar purpose_concept_id como filtro de discovery de oferta — NAO e; e finalidade do tempo do
     actor, e o gate de booking da 0132 (4) torna estudo/cuidados/lazer NAO-bookaveis por padrao (isso SIM
     pode afetar "tempo bookavel", mas e camada distinta do owner_type do passo 4).
   - Tempo duplicado na oferta: a intersecao service_offerings x unified_availability deve ser JOIN READ-ONLY;
     service_offerings NAO pode ganhar coluna de tempo (core temporal paralelo / C63-analogo). Confirmar que a
     coluna NAO existe = estrutura -> IA-BANCO; a regra (nao duplicar) e minha e esta mantida.
   - C63 REVOKE nao-provado-aplicado: se nao estiver em schema_migrations/grants vivos, WRITE legado em
     schedules/schedule_slots continua fisicamente possivel. NAO afirmo nem nego por disco — INCONCLUSIVO.

3. RECOMENDACAO (descrever, NAO codar):
   - DIRETORA: corrigir a ancora no plano — passo 4 / 4 ("tempo nao duplica") = owner_type='service_offering'
     vem de DECISION-0117 D, nao 0132. Reservar 0132 para a camada FINALIDADE temporal (purpose_concept_id),
     que entra no GATE DE BOOKING (bookavel vs protegido), nao no owner_type da discovery.
   - Pedir prova-viva a IA-BANCO (3 itens): (i) chk_availability_owner_type aplicado e contem service_offering;
     (ii) REVOKE 20260428200000 em schema_migrations + \dp schedules/schedule_slots (grants vivos);
     (iii) coluna availability.purpose_concept_id existe viva (materializacao 0132 FATIA 2).
   - Encaminhar a IA-DECISOES/IA-DOCUMENTOS o delta DECLARADO x VERIFICADO da 0132 (.md "DOCS-ONLY/HOLD" x disco materializado).
   - RETRATACAO append-only da minha 14.8: onde escrevi "0132 ... owner_type='service_offering' — meu eixo central",
     leia-se "DECISION-0117 D"; 0132 permanece sob meu olhar como FINALIDADE temporal + gate de booking. (Historico nao apagado; corrijo aqui.)

4. FRONTEIRA:
   - IA-BANCO -> prova-viva DB (REVOKE aplicado, CHECK aplicado, coluna purpose_concept_id viva). [INCONCLUSIVO meu]
   - IA-DECISOES / IA-DOCUMENTOS -> estado declarado 0132 (.md) x disco materializado; correcao de citacao 0132->0117 no plano.
   - IA-OFERTA -> service_offering e a OFERTA cujo tempo eu cruzo (owner_id = service_offerings.id); price_cents/status e dela.
   - IA-ACTOR -> policy do owner_type le service_offerings.provider_actor_id (gate de representacao do prestador).

5. STOPs: nao executo/commito/migro . zero WRITE em schedules/schedule_slots (C63) . conflito = fato->alerta->humano
   (nunca automatico) . oferta nao armazena tempo . GET nao cria actor . actorId e HINT (exige canRepresentActor) .
   "local nao e excecao" . prova-viva de banco fora do meu alcance read-only -> INCONCLUSIVO -> IA-BANCO . analise = insumo, nao GO.

Status: RESPONDIDO (codigo/disco: enum/policy/CHECK-file/migrations existem) +
        INCONCLUSIVO (aplicacao no BANCO vivo: REVOKE C63, CHECK, coluna 0132 -> IA-BANCO).
```

#### 14.8.3 RE-VALIDACAO (gatilho "vai" reaplicado) - IA-TEMPO - HEAD dd270f41
Reabri o 14.0/14.3 e revalidei o disco de 1a mao: HEAD continua dd270f41 (branch rescue-structural), SEM delta desde a resposta 14.8.2. O 14.3 NAO tem tarefa nova para IA-TEMPO — a unica e a da RODADA 1 (linha 348), ja RESPONDIDA em 14.8.2. Mantenho aquele veredito (0132 != owner_type; fonte = DECISION-0117 D; enum/policy/CHECK vivos no disco; aplicacao no banco = INCONCLUSIVO -> IA-BANCO). Sem reescrever analise (append-only, evitando ruido). Aguardo a IA-DIRETORA postar novo bloco em 14.3 ou a consolidacao da rodada.
Status: RESPONDIDO (sem novo trabalho — re-baseline ja entregue em 14.8.2).

---

### 14.9 IA-BANCO-DE-DADOS — Schema, Migrations, Integridade e Runtime do Banco (READ-ONLY ESTRITO)

- **Trato:** o disco do banco — schema vivo / DDL (tabelas, colunas, **tipos**, FK, CHECK, UNIQUE, índices, triggers, RLS) · migrations (ordem, idempotência, forward-only, drift **disco × `schema_migrations`**) · integridade referencial · **atomicidade transacional** (BEGIN/COMMIT único, dual-write, rollback, estado parcial) · runtime do banco (`to_regclass`, `\d`, catálogo `pg_*`/`information_schema`) · **schema-ghost** (tabela ausente com caller vivo → `42P01`) vs **metadata-resident intencional**. Para este plano, sou a instância que responde: **"a estrutura existe no disco (não só na narrativa), o tipo/constraint/FK/índice sustenta a invariante, a migration é forward-only sem drift, e a mudança é atômica e isolada por tenant?"**
- **Memória soberana da instância:** `docs/memorias/MINHA_MEMORIA_BANCO_DE_DADOS.md` (única, além desta seção, que posso escrever; append-only, histórico nunca apagado). _Âncora atual da memória: HEAD `c41476f7`/dev **394** (2026-06-17); HEAD vivo no momento desta identificação = `dd270f41`/branch `rescue-structural` → memória levemente **stale**, revalido de 1ª mão sob demanda._
- **Frase-guia:** Disco vence narrativa. `to_regclass` NULL = a tabela não existe, ponto. `N .sql no disco` = `N rows em schema_migrations`, ou há **drift**. Tipo errado (INTEGER onde a verdade pede BIGINT) é dívida material. FK ausente = integridade fraca (uuid pendurado possível). **RLS existir ≠ RLS ativa** (inerte sob conexão `postgres`/superuser/bypassrls). Atomicidade ausente = estado parcial possível. `DEV vazio = inconclusivo, não limpo`.
- **Itens do plano sob meu olhar (schema / migration / integridade):**
  1. **U1 — widening `concept_relations` 3→6 (MACRO 1, primeiro executável):** é uma migration de **CHECK constraint** — meu núcleo. Verifico: o CHECK vivo atual; os **três pontos de verdade juntos** (CHECK do banco + `GraphRelationType` em `graph.adapter.ts:9` + `RELATION_TYPES` em `graph-governance.service.ts:9-17`); forward-only (0 rows afetadas); a forma segura da migration de CHECK (DROP+ADD ou `NOT VALID`+`VALIDATE`); e a **negative-proof** do trigger `0077` (seed sem `set_config('app.graph_governance','true')` → trigger **bloqueia**). Os 6 tipos normados, sem `suggests`.
  2. **§4 índice de oferta — DDL das 4 camadas:** `company_concept_publications`, `tenant_concept_offerings` (read-model), `services` (CREATE ~L9147 do dump; COMMENT "usada por descoberta"), `service_offerings` (CREATE ~L22494). Confirmo existência viva (`to_regclass`), a FK `service_offerings.service_id → services`, e materializo (ou não) o **guard de separação de fase** dos dois `status` — hoje provavelmente só app-level, não constraint.
  3. **§4 precisão #1 + §6 drift `price_cents`:** `service_offerings.price_cents` = **BIGINT NOT NULL** ✓ (faturável canônico) × `services.price_cents` = **INTEGER nullable** ✗ (drift 07 §4.7, campo não-autoritativo). MACRO 2 propõe INTEGER→BIGINT **ou depreciar**: migration de tipo de coluna lida por código exige auditar callers + tipo TS + overflow; depreciar exige provar **0 leituras financeiras**.
  4. **§4 precisão #2 + DECISION-0132:** disponibilidade **não duplicada** na oferta — do meu eixo, confirmar que `service_offerings` **não tem coluna de tempo** (senão é core temporal paralelo). A interseção `service_offerings × unified_availability (owner_type='service_offering')` é JOIN **read-only**. (Semântica temporal = IA-TEMPO; estrutura/coluna = minha.)
  5. **§5 MACRO 3 — fragmentação de presença (DT-PRESENCE):** schema puro, convergente com minha memória — `event_checkins` TOMBSTONE **vigente sem `checked_out_at`** (`checkOut()` quebra); `presence_rsvps`/`checkins`/`checkin_tokens`/`promo_benefits` = **SCHEMA-GHOST** (0 CREATE vigente, rotas montadas → `42P01`); `cultural_event_checkins` só em archive; `event_staff` CHECK `active/inactive/cancelled` **rejeita** `expected/checked_in` (incompatível com `OperationalCommitment`). A escolha **tabela `operational_commitments` nova × estender `event_staff`** é decisão de schema que dimensiono (DDL nova vs `ALTER … CHECK`) — **decido a forma, não a política** (a política é de Clayton/IA-DECISOES).
  6. **§5 track higiene + §6 drift `event_sessions`:** code drift `start_time`/`end_time` → `starts_at`/`ends_at` (07 §4.6) — confirmo os nomes reais das colunas vivas e a existência da tabela.
  7. **§2 step 8 / §4.6 fronteira financeira:** `bank_ledger`/`bank_transactions`/`bank_splits` **VIVOS** (confirmado em memória). **Assimetria RLS material:** `service_payment_requests` `rls=f` sem policy × `service_payment_executions` `rls=t` forçada — alerto, não corrijo. **acceptQuote = 5 writes NÃO-atômicos** (cada um em tx própria; estado parcial possível) — risco de integridade que mapeio quando a contratação materializar.
  8. **Drift global:** antes de qualquer veredito, `N .sql no disco` = `N em schema_migrations` (check:migrations GATE 3).
- **Serviço concreto para a EXECUTORA neste plano:**
  1. Provar **existência viva** de tabela/coluna/FK/CHECK/UNIQUE/índice/trigger/RLS antes de a executora assumir que existe.
  2. Dizer se a mudança é **code-only (sem migration)** ou **exige migration** — e, se migration, a **forma segura** (forward-only, idempotente, `NOT VALID`+`VALIDATE` p/ CHECK, DROP/ADD p/ FK).
  3. Mapear **drift** disco×`schema_migrations` e distinguir **schema-ghost** (caller vivo → `42P01`) de **metadata-resident intencional** (caller não espera tabela).
  4. Dimensionar **atomicidade/transação** de uma cadeia e o risco de **estado parcial**.
  5. Desenhar a **negative-proof** de constraint/trigger (ex.: seed sem governança → bloqueado) como evidência de gate vivo.
- **Fronteira de eixo:** *o que* a constraint/coluna **decide** (autoridade, regra de produto, dinheiro como verdade) **não é meu veredito** — schema/FK/CHECK/trigger que **cristaliza decisão nova = anti-padrão a sinalizar** para IA-DT/IA-DECISOES/Clayton, não a ratificar. Autoridade/representabilidade = **IA-ACTOR-USERS**; o que toca `bank_ledger` como dinheiro = **IA-DINHEIRO**; semântica temporal do `unified_availability` = **IA-TEMPO**; onde/como registrar DT/DECISION = **IA-DOCUMENTOS / IA-DT / IA-DECISOES** + Clayton. Eu sou dona de **"a estrutura existe, o tipo/FK/constraint sustenta, a migration é sã, é atômico e isolado por tenant"**.
- **STOPs (herdados da minha memória):** READ-ONLY estrito — só SELECT/catálogo (`to_regclass`/`pg_*`/`information_schema`) + `check:migrations` + Read/Grep · não crio/edito/rodo migration · não altero schema/banco · não rodo SQL destrutivo nem suíte mutável em `unificard_dev` · não commito · não edito código/frontend/`STATUS`/`opus`/`REMEDIATION_*`/outras memórias · não fecho/abro DT · não promulgo DECISION · **não ratifico constraint que cristaliza decisão nova** (sinalizo) · `DEV vazio = inconclusivo, não limpo` · prova-viva que exija conexão/deploy fora do meu alcance → declaro **INCONCLUSIVO** · análise = insumo, **não GO**. Edito só este documento (§14.9) + minha memória.

**À EXECUTORA — declaração de disponibilidade (IA-BANCO-DE-DADOS):**
Identificada e à sua disposição em §14.3. Ao receber tarefa, revalido o HEAD/disco de 1ª mão (`to_regclass`, catálogo, migrations count) antes de qualquer veredito — disco vence narrativa; minha memória (`c41476f7`/dev 394) e este plano podem estar stale. Respondo somente sobre meu eixo (schema/migrations/integridade/runtime do banco) em bloco copiável: **VEREDITO · EVIDÊNCIAS (`arquivo:linha` / migration / `to_regclass` / rowcount) · RISCOS · RECOMENDAÇÃO · STOPs**.

- Para **schema / migrations / integridade / DDL (tabela, coluna, tipo, FK, CHECK, UNIQUE, índice, trigger, RLS) / drift disco×`schema_migrations` / schema-ghost / INTEGER×BIGINT / atomicidade transacional / `to_regclass` / negative-proof de trigger**: chame **IA-BANCO-DE-DADOS**.
- Para dúvidas que cruzem **estrutura + dinheiro** (coluna/FK money-adjacent, `price_cents`, RLS do Bank): marque **IA-BANCO-DE-DADOS + IA-DINHEIRO**.
- Para dúvidas que cruzem **estrutura + tempo** (coluna de `unified_availability`/`service_offerings`, `owner_type`): marque **IA-BANCO-DE-DADOS + IA-TEMPO**.
- Para dúvidas que cruzem **estrutura + autoridade** (RLS, coluna de ownership/FK→actors): marque **IA-BANCO-DE-DADOS + IA-ACTOR-USERS**.

— **IA-BANCO-DE-DADOS**, pronta.

#### 14.9.1 DÚVIDAS DESTA INSTÂNCIA — IA-BANCO-DE-DADOS (aguardando resposta)
1. **Âncora viva sob demanda (não sweep autônomo).** O plano cita estruturas (`concept_relations` CHECK 3→6, `services`/`service_offerings` CREATEs e FK, `price_cents` INTEGER×BIGINT, `unified_availability owner_type='service_offering'`, trigger `0077`, cluster schema-ghost de presença) sem carimbar HEAD/dev. Ao receber tarefa revalido cada uma contra o disco vivo do HEAD do momento (`to_regclass`, `\d`, catálogo, `check:migrations`). Faço isso **sob demanda da EXECUTORA por tarefa em §14.3**; **não** varro o plano sozinha. Se Clayton/EXECUTORA preferir um **sweep inicial de âncora de schema** (existência viva + tipos + drift de tudo que o plano cita), registrar como tarefa explícita — é trabalho que entrego de bom grado, mas não inicio por conta própria.
2. **Limite de escrita.** Confirmo meu alcance de escrita = **somente** este documento (§14.9) + `docs/memorias/MINHA_MEMORIA_BANCO_DE_DADOS.md`. Qualquer estrutura que precise nascer/mudar (migration, ALTER, nova tabela/coluna/FK/CHECK) é da **EXECUTORA sob GO** — eu só desenho a forma segura e provo o estado; **paro e sinalizo** se um veredito meu exigir tocar disco.

#### 14.9.2 RESPOSTA — TASK O2 / RODADA 1 (re-baseline) · IA-BANCO

> **Rótulo atualizado pela DIRETORA (§14.0 roster):** `IA-BANCO-DE-DADOS` → **`IA-BANCO`**. Mesma instância, mesma memória soberana (`MINHA_MEMORIA_BANCO_DE_DADOS.md`), eixo ampliado (RUNTIME/INFRA + LOCALIZAÇÃO + **terminus da prova-viva**). GAP-B (registro no canal) **já fechado** nesta §14.9 — não precisei recriar.

```
RESPOSTA PARA: IA-DIRETORA  (de: IA-BANCO)
HEAD no momento: dd270f41 / branch rescue-structural
Revalidou no vivo: SIM (probe psql READ-ONLY descartável em unificard_dev + catálogo pg_* + leitura de migration/código; nada mutado)

VEREDITO: U1 (widening concept_relations 3->6) é, no DISCO HOJE, conformidade norma->código
viável e segura — os 3 pontos de verdade estão ALINHADOS em 3 tipos e o gate de governança
está VIVO. PORÉM: (a) NÃO encontrei DECISION promulgada que carimbe exatamente "os 6 tipos /
remoção de suggests" (frontier IA-SEMANTICA+IA-DECISOES); (b) o framing do plano sobre "remover
suggests" é VAZIO — suggests não existe em nenhum dos 3 pontos. Drift de migration disco×banco = 1
(não afeta concept_relations).

1. EVIDÊNCIAS (1ª mão):
   (Q1) CHECK vivo de concept_relations.relation_type =
        concept_relations_relation_type_check: CHECK (relation_type = ANY (ARRAY[
        'enables','evolves_to','related_to'])) -> 3 TIPOS no banco vivo (pg_constraint, HEAD dd270f41).
        - Coluna relation_type = TEXT puro (NÃO enum pg) -> widening é ALTER de CHECK, não ALTER TYPE.
        - Origem: migrations/0076_concept_relations.sql:18-22 (CHECK inline IN ('enables','evolves_to','related_to')).
        - Nenhuma migration posterior alargou o CHECK. 0092_global_semantic_graph.sql só REMOVEU
          tenant_id (linhas 91-123: dedupe + DROP COLUMN tenant_id + recriou UNIQUE sem tenant);
          não tocou o vocabulário. => CHECK aplicado HOJE = exatamente os 3 da 0076.
   (Q1-cross / drift schema×código — meu eixo) os 3 PONTOS DE VERDADE estão ALINHADOS em 3 tipos:
        - banco (CHECK acima) ........................ enables · evolves_to · related_to
        - graph.adapter.ts:9 (GraphRelationType) ..... 'enables' | 'evolves_to' | 'related_to'
        - graph-governance.service.ts:9-12 (RELATION_TYPES Set) .. enables · evolves_to · related_to
        -> ZERO drift schema×código hoje. U1 precisa alargar os TRÊS em lockstep
          (migration CHECK + type TS + Set), senão cria drift.
   (Q2) trigger graph-governance APLICADO e ATIVO:
        - trg_concept_relation_governance — BEFORE INSERT OR UPDATE ON concept_relations,
          tgenabled='O' (habilitado em operação normal), FOR EACH ROW EXECUTE
          enforce_concept_relation_governance() (pg_trigger, HEAD vivo).
        - função enforce_concept_relation_governance() EXISTE (pg_proc) e implementa o gate:
          IF current_setting('app.graph_governance', true) IS DISTINCT FROM 'true'
          THEN RAISE EXCEPTION ... ERRCODE=check_violation (migrations/0077_graph_relation_governance_trigger.sql).
        -> a BASE do negative-proof ("seed sem set_config('app.graph_governance','true') -> bloqueia")
          está MATERIALIZADA. (O negative-proof EM SI — INSERT sem set_config e ver o raise — é mutável;
          não executo em dev; a estrutura que o garante está provada presente.)
   (Q3) DECISION governando os 6 tipos / remoção de suggests — PONTEIRO, não veredito (frontier):
        - /!\ migration 0077 != DECISION-0077. DECISION-0077 no LOG = "Location Core geo enrichment"
          (REMEDIATION_DECISIONS_LOG.md:6290), tema NÃO relacionado. Não confundir nº de migration com nº de DECISION.
        - Âncora normativa mais próxima do vocabulário: SELO_DECISION_0097_ONTOLOGY_FULL_READ.md:31
          — "GRAPH (LAYER 6) ... relation_types (enables/requires/part_of/related_to/substitutes)" (§6,§10.3).
          São 5 tipos e NÃO batem com os 6 do plano: a 0097 OMITE 'evolves_to' (que está vivo no CHECK)
          e o plano ADICIONA 'evolves_to'. Lista do plano = enables,requires,evolves_to,related_to,part_of,substitutes.
        - NÃO achei DECISION .md que carimbe textualmente "6 tipos" nem "remoção de suggests".
   (Q4) GAP-B: já fechado — esta §14.9 existe desde a sessão de identificação; rótulo agora IA-BANCO.
   (migration count) disco = 395 .sql × schema_migrations = 394 -> DRIFT=1 pendente:
        20260620120000_db_role_rls_hardening.sql (não aplicada em dev; 0 órfãos). NÃO afeta concept_relations.

2. RISCOS / ALERTAS:
   - R1 (frontier, ALTO p/ enquadramento de U1): o plano trata U1 como "conformidade norma->código,
     decisão-independente". Materialmente NÃO localizei a NORMA que fixa os 6. A única âncora (0097)
     diverge (5 tipos, sem evolves_to). Se não houver DECISION/SSOT que liste os 6 EXATOS, U1 deixa de
     ser "conformidade" e vira DECISÃO de vocabulário — território IA-SEMANTICA/IA-DECISOES + Clayton.
     NÃO ratifico o widening como norma->código sem essa âncora (anti-padrão: constraint cristalizando decisão).
   - R2 (framing vazio): "remover suggests" não tem objeto — suggests não está no CHECK, nem no adapter,
     nem no service. Nada a remover; o plano deve corrigir essa premissa (§5 U1 / §6).
   - R3 (lockstep): widening em 1 ou 2 dos 3 pontos (sem o terceiro) cria drift schema×código —
     INSERT que o código permite e o CHECK rejeita (ou vice-versa). Migration CHECK + TS type + Set juntos.
   - R4 (DEV vazio = INCONCLUSIVO): concept_relations tem 0 linhas. NÃO concluo "grafo seguro/limpo";
     concluo apenas que CHECK+trigger estão presentes. Comportamento de seed real não foi exercitado.
   - R5 (drift de migration): dev está 1 atrás (db_role_rls_hardening pendente). Veredito sobre RLS/role
     hardening em dev = INCONCLUSIVO até aplicar; irrelevante para U1, mas trava prova de RLS.
   - Caveat permanente: conectei como postgres (superuser/bypassrls) => RLS inerte; CHECK/trigger não
     dependem disso (visíveis no catálogo), mas prova de RLS exige role app-level.

3. RECOMENDAÇÃO (descrever, NÃO codar/migrar):
   - Antes de promover U1, a DIRETORA deve obter de IA-SEMANTICA/IA-DECISOES o PONTEIRO normativo
     dos 6 tipos exatos (existe DECISION? a 0097 é norma ou só ontologia descritiva?). Resolver a
     divergência 0097(5,sem evolves_to) × plano(6,com evolves_to) ANTES de tocar o CHECK.
   - Quando houver âncora: a migration de widening é segura como CHECK forward-only — recriar o CHECK
     com os 6 valores (DROP CONSTRAINT concept_relations_relation_type_check + ADD CONSTRAINT ... CHECK,
     ou ADD ... NOT VALID + VALIDATE). 0 rows => VALIDATE trivial; nenhum dado viola. Casar com
     graph.adapter.ts:9 (union type) + graph-governance.service.ts:9 (Set) na MESMA fatia (lockstep).
   - Manter o trigger 0077 intocado (o gate de governança independe do vocabulário).
   - Corrigir no plano: "remover suggests" -> "suggests já ausente; nada a remover".

4. FRONTEIRA (quem decide a semântica):
   - QUAIS são os 6 tipos canônicos e se há norma promulgada -> IA-SEMANTICA (vocabulário) + IA-DECISOES
     (existe DECISION? cartório). Eu PROVO o estado aplicado (3 no banco/adapter/service), não decido os 6.
   - Aplicar a migration / mexer no CHECK -> EXECUTORA sob GO -> ChatGPT -> IA-YALA -> Clayton.
   - Eu (IA-BANCO) sou dona de: "o CHECK aplicado é X", "o trigger está vivo", "os 3 pontos (in)divergem",
     "a forma de migration é sã", "drift disco×schema_migrations".

5. STOPs: READ-ONLY honrado — só SELECT/catálogo (pg_constraint/pg_trigger/pg_proc/information_schema) +
   leitura de migration/código + git. Probe descartável; nenhum INSERT/UPDATE/DDL; nada aplicado/commitado.
   NÃO executei o negative-proof (seria escrita). NÃO ratifiquei o widening como norma (falta âncora).
   Editei só §14.9 (esta resposta) + minha memória. Análise = INSUMO, não GO.

Status: RESPONDIDO (com 1 frontier aberta p/ IA-SEMANTICA+IA-DECISOES: âncora normativa dos 6 tipos)
```

#### 14.9.3 RESPOSTA — RODADA 2 (prova-viva · alvo ÚNICO IA-BANCO) · 8 itens

```
RESPOSTA PARA: IA-DIRETORA  (de: IA-BANCO)
HEAD no momento: dd270f41 / branch rescue-structural
Revalidou no vivo: SIM (probe psql READ-ONLY descartável em unificard_dev — pg_class/pg_policy/pg_trigger/
pg_proc/pg_constraint/information_schema/schema_migrations; nada mutado; probe apagado)

VEREDITO: 8/8 itens provados de 1ª mão. Estruturas presentes; gates fail-closed vivos; 2 CORREÇÕES
materiais de premissa (tabela viva é `availability`, NÃO `unified_availability`; `rides_*` NÃO é greenfield).
RLS dos 6 planos de autoridade = OFF (0 policies) em TODOS — só app-level. Drift de migration = 1.
Onde DEV está vazio, marco INCONCLUSIVO p/ COMPORTAMENTO (a estrutura está provada presente).

1. EVIDÊNCIAS (item a item):
   ITEM 1 — Trigger 0077 graph-governance: APLICADO+ATIVO. trg_concept_relation_governance em
     concept_relations, tgenabled='O', função enforce_concept_relation_governance() existe (pg_proc).
     => base do negative-proof de U1 materializada. [confirma p/ IA-SEMANTICA]
   ITEM 2 — RLS 6 planos de autoridade (pg_class.relrowsecurity/relforcerowsecurity + pg_policy):
     TODAS as 6 EXISTEM, mas rls_on=f · forced=f · 0 policies em TODAS —
       company_users · actor_delegations · financial_approval_authorities ·
       tenant_operator_grants · reconciliation_disputes · reversals.
     => isolamento HOJE = só app-level (runQueryWithTenant WHERE tenant_id). ZERO RLS de tabela ativa.
     (relrowsecurity=f é verdade definitiva, independe da conexão; caveat superuser nem se aplica —
      não há policy a bypassar.) [p/ IA-AUTORIDADE + IA-DINHEIRO]
   ITEM 3 — REVOKE C63 + purpose_concept_id:
     (3a) 20260428200000_schedules_revoke_write.sql ESTÁ em schema_migrations => REVOKE C63 APLICADO. [p/ IA-TEMPO]
     (3b) purpose_concept_id (uuid, DECISION-0132) VIVO — na tabela `availability`.
     (3c) /!\ CORREÇÃO DE PREMISSA: to_regclass('unified_availability')=NULL (NÃO existe); a tabela viva
          é `availability`. Plano e IA-TEMPO citam `unified_availability`; o nome aplicado é `availability`.
          (owner_type='service_offering' não foi pedido neste item; reporto só o provado: coluna 0132 em `availability`.) [p/ IA-TEMPO]
   ITEM 4 — inventory_movements append-only:
     4 triggers não-internos, TODOS tgenabled='O' (HABILITADOS hoje): prevent_inventory_movements_update ·
     prevent_inventory_movements_delete · trigger_validate_movement_lot_variant · trg_inventory_movements_actor_tenant.
     => o DISABLE de backfill da 20260411120000 FOI reabilitado; proteção append-only ATIVA
        (sem trigger de INSERT — correto, append-only permite insert).
     contagem: movements=0 · balances=0 => sem drift de projeção, mas DEV vazio = INCONCLUSIVO p/ comportamento. [p/ IA-COMERCIO]
   ITEM 5 — rides_* (corrige "greenfield"):
     to_regclass('rides_rides')=rides_rides (EXISTE); 'rides'=NULL. 6 migrations rides_* APLICADAS
     (rides_core/requests/operational/referral/distribution + vehicles_concept_id_nullable).
     FK DIRETA: rides_rides_bank_transaction_id_fkey FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id).
     => substrato físico de mobilidade NÃO é greenfield; há ligação ESTRUTURAL corrida<->Bank. SE a conclusão
        da corrida dispara liquidação por essa FK = vetor "money-via-carona/evento-causa" — mas mediação é
        código, NÃO meu veredito. [p/ IA-LOGISTICA + IA-DINHEIRO]
   ITEM 6 — services/service_offerings/company_concept_publications:
     TODAS EXISTEM. rows: services=0 · service_offerings=0 · company_concept_publications=0 (DEV vazio => INCONCLUSIVO p/ comportamento).
     FKs de service_offerings:
       service_offerings_service_id_fkey: service_id -> services(service_id) ON DELETE SET NULL  (link LEGADO/projeção, fraco)
       service_offerings_canonical_service_id_fkey: canonical_service_id -> canonical_services(id) ON DELETE RESTRICT  (link CANÔNICO, forte)
     => a FK pedida (service_id->services) está VIVA, porém SET NULL (legado); a âncora forte é
        canonical_service_id->canonical_services(RESTRICT). Confirma "service_id permanece legado/projeção" do §4. [p/ IA-OFERTA]
   ITEM 7 — financial:
     (7a) financial_approval_authorities=0 · financial_approval_policies=0 · financial_approval_policy_events=0
          => 0/0/0 CONFIRMADO (substrato materializado, NÃO seedado; fail-closed por vazio).
     (7b) economic_policy_lines EXISTE; coluna bps (integer) MATERIALIZADA.
     (7c) assimetria RLS CONFIRMADA: service_payment_executions rls_on=t/forced=t ×
          service_payment_requests rls_on=f/forced=f. [p/ IA-DINHEIRO]
   ITEM 8 — baseline geral:
     (8a) actor_has_permission(p_tenant_id,p_actor_id,p_resource,p_action) = STUB FAIL-CLOSED: corpo `RETURN FALSE`
          (comentário cita AUTHORITY_PRECEDENCE.md §4.4; FASE 6 substituirá). [p/ IA-ACTOR/IA-AUTORIDADE]
     (8b) disco=395 .sql × schema_migrations=394 => DRIFT=1 pendente
          (20260620120000_db_role_rls_hardening.sql não aplicada; 0 órfãos).

2. RISCOS / ALERTAS:
   - RLS-OFF nos 6 planos de autoridade: nenhuma defesa de banco; um bug de WHERE tenant_id no app vaza
     cross-tenant sem rede de segurança. Fato de banco (política = IA-AUTORIDADE).
   - rides_rides<->bank_transactions (FK direta): vetor "money via carona" se a corrida disparar liquidação;
     exige prova de mediação (código/trigger) — IA-DINHEIRO.
   - Nome `unified_availability` (plano) != tabela viva `availability`: risco de doc/código apontando p/ nome
     inexistente; IA-TEMPO reconcilia.
   - DEV vazio (services/offerings/ccp/movements/balances/financial_approval = 0): NÃO concluir "limpo/seguro";
     só "estrutura presente". Comportamento de seed/fluxo NÃO exercitado.
   - Drift=1 é IRÔNICO: a migration pendente (db_role_rls_hardening) é justamente de RLS-hardening — enquanto
     não aplicada, o hardening que ela traz NÃO está vivo (o RLS-OFF do item 2 pode ser pré-hardening).

3. RECOMENDAÇÃO (descrever, NÃO codar/migrar):
   - Aplicar a migration pendente (20260620120000) em dev ANTES de veredito sobre RLS-hardening (executora sob GO):
     o estado de RLS lido hoje (tudo OFF) pode mudar após aplicar — reprovo após aplicação.
   - IA-TEMPO: reconciliar nome `availability` (vivo) × `unified_availability` (citado) no plano/código.
   - IA-OFERTA: tratar canonical_service_id como âncora canônica; service_id é SET NULL (legado).
   - Decisões de política (RLS dos 6, money-rides, seed do grafo) NÃO são minhas — devolvo o FATO provado.

4. FRONTEIRA (dono da semântica por item):
   item1->IA-SEMANTICA · item2->IA-AUTORIDADE/IA-DINHEIRO · item3->IA-TEMPO · item4->IA-COMERCIO ·
   item5->IA-LOGISTICA/IA-DINHEIRO · item6->IA-OFERTA · item7->IA-DINHEIRO/IA-AUTORIDADE · item8a->IA-ACTOR/IA-AUTORIDADE.
   Eu (IA-BANCO) provo existência/aplicação/contagem/flag; NÃO decido semântica/política.

5. STOPs: READ-ONLY honrado — só catálogo + schema_migrations + SELECT count; probe descartável apagado;
   nenhum INSERT/UPDATE/DDL; nada aplicado/commitado. Editei só §14.9 (esta resposta) + minha memória. INSUMO, não GO.

Status: RESPONDIDO (8/8 provados; 0 INCONCLUSIVO de BANCO — tudo que dependia de prova-viva foi provado;
restam só decisões de POLÍTICA dos donos de eixo + a migration pendente p/ executora)
```

---

### 14.10 IA-COMERCIO — Pedidos/Contratação e Estoque/Inventário (READ-ONLY ESTRITO)
- **Trato:** a camada ESTADO da escada, ENTRE oferta (descoberta) e dinheiro (liquidação). DOIS eixos nomeados e separados:
  - **EIXO PEDIDOS/CONTRATAÇÃO:** `orders` · `order_items` · `service_orders` · `service_booking_decisions` (escolha HUMANA explícita) · `bookings`. Registro do "o humano casou" (DECISION-0121/0122).
  - **EIXO ESTOQUE/INVENTÁRIO:** `product_variants` · `inventory_movements` (append-only via trigger = SSOT) · `inventory_balances` (PROJEÇÃO) · `inventory_lots` · `inventory_reservations` · `stock_transfers`/`stock_transfer_receipts` · `purchase_orders` · `fulfillment_orders`. Inventário é ACTOR_PRIVATE (DECISION-0116).
- **Memória soberana:** `docs/memorias/MINHA_MEMORIA_COMERCIO.md` (append-only; criar com os 2 eixos nomeados).
- **DECISIONs sob meu olhar:** 0116 (ownership/visibilidade intra-tenant; inventory ACTOR_PRIVATE) · 0121 (booking→decision→service_order authority binding) · 0122 (service_offering canonical) · 0110/0111 (lado financeiro do pedido = flag OFF).
- **STOPs:** `inventory_movements` é SSOT append-only e `inventory_balances` é PROJEÇÃO — estoque NÃO se deduz fora dos movimentos; NÃO tocar o trigger · o pedido NÃO toca `bank_ledger` (money = IA-DINHEIRO, a jusante) · gate `canRepresentActor` ANTES de criar/mutar pedido · `service_booking_decisions` = escolha humana, o sistema sugere/filtra NUNCA crava · inventário escopado por actor representável, sem vazar cross-actor · análise = INSUMO, nunca GO · edito só este documento (§14.10) + minha memória.

#### 14.10 — RESPOSTA À RODADA 1 (re-baseline de eixo)
**RESPOSTA PARA: IA-DIRETORA  (de: IA-COMERCIO)**
**HEAD no momento:** `dd270f41` · branch `rescue-structural` | **Revalidou no vivo:** sim (de 1ª mão, disco — `git rev-parse`, migrations e código-fonte; prova-viva de banco corrente declarada INCONCLUSIVO → IA-BANCO).

**VEREDITO:** o substrato dos 2 eixos está MATERIALIZADO no disco vivo e coerente com o eixo. Os STOPs estruturais (append-only + projeção + ACTOR_PRIVATE + binding canônico) estão presentes no schema, não só na narrativa. Nada do payout-hardening recente (`dd270f41`/`cd697da7`/`e0fe89b9`) tocou meus eixos — é frente IA-DINHEIRO.

**1. EVIDÊNCIAS (arquivo:linha / DECISION / tabela):**
- **ESTOQUE — append-only SSOT:** `backend/migrations/0102_inventory_movements.sql:66-84` — função `prevent_inventory_movement_modification()` + triggers `BEFORE UPDATE`/`BEFORE DELETE` que `RAISE EXCEPTION 'inventory_movements is immutable (append-only)'`. RLS por tenant em `:61-64`. Comentário `:86-87` "SSOT de quantidade; saldo derivado por soma".
- **ESTOQUE — projeção:** `0103_inventory_balances.sql:24-36` — `inventory_balances` PK `product_variant_id`; comentário `:41-45` "Read model... SSOT = movements; pode ser recalculado". No código, `inventory-balance.repository.ts:65-70` faz `INSERT ... ON CONFLICT DO UPDATE` (upsert de projeção), enquanto `inventory-movement.repository.ts:63,104` só faz `INSERT` (nenhum UPDATE/DELETE) → append-only respeitado também na camada de código.
- **ESTOQUE — ACTOR_PRIVATE (DECISION-0116):** `20260411120000_inventory_movements_actor_id.sql` materializa `inventory_movements.actor_id` = "unidade operacional (actor no tenant)", SSOT físico por `(tenant_id, actor_id, product_variant_id)`. Visualização consolidada da empresa = `20260610120000_add_company_users_can_view_consolidated_inventory.sql:21-23` (`can_view_consolidated_inventory` NOT NULL DEFAULT FALSE; "NÃO altera owner material do estoque").
- **PEDIDOS — escolha humana explícita:** `20260530494000_create_service_booking_decisions_and_payment_requests.sql:3-15` — `service_booking_decisions(decided_by_actor_id, status, ...)` UNIQUE(booking_id) = registro de 1 decisão humana por booking.
- **PEDIDOS — binding canônico booking→decision→service_order (DECISION-0121):** `20260613150000_booking_order_canonical_binding_integrity.sql` — FKs `service_orders_booking_id_fkey`, `service_orders_decision_id_fkey`, `bookings_requester_actor_id_fkey` + UNIQUE parcial `uidx_service_orders_booking_id` (≤1 service_order/booking). Header declara "NÃO toca Bank / ledger / splits / dinheiro".
- **PEDIDOS — substrato vivo:** `20260530555000_create_service_orders_substrate_with_f1.sql` (service_orders materializado pós-reset, status lowercase, settlement_flow discriminador) · `0117_evolve_orders.sql:18-24` (CHECK de status de `orders`).
- **GATE de autoridade:** `service-booking-decision.service.ts:111` chama `authorizationService.canRepresentActor(tenantId, userId, owner.authorityActorId)` ANTES de gravar a decisão; `canRepresentActor` presente em toda a família `service-order.*`/`service-offering.*`.

**2. RISCOS (do meu STOP-set — estado HOJE):**
- **Baixo/contido:** trigger append-only e projeção estão no schema; não vi no código de pedido nenhuma escrita em `bank_ledger` (binding 0613 é explicitamente não-financeiro). Gate `canRepresentActor` presente nos entrypoints de decisão/pedido.
- **A vigiar (não-bloqueante):** `service_orders.booking_id` foi NULLABLE sem FK até `20260613150000` — a FK agora existe, mas orders avulsas (createOrder sem booking) coexistem com `booking_id NULL` por desenho (UNIQUE é parcial). Não é vazamento; é a fronteira pedido-com-booking × pedido-avulso.
- **INCONCLUSIVO read-only:** se o trigger append-only está EFETIVAMENTE habilitado no banco corrente (a migration `20260411120000` faz `DISABLE TRIGGER ... prevent_inventory_movements_update` para backfill e deve reabilitar adiante) e a contagem `inventory_movements` vs `inventory_balances` (drift de projeção) — prova-viva que não alcanço read-only. → IA-BANCO.

**3. RECOMENDAÇÃO (régua/decisão — descrever, não codar):**
- Para os dois planos, meu eixo NÃO está stale no substrato: o que o plano dev-385 chamava de pendente (service_orders materializado, binding canônico) já está no disco a partir de `20260530555000`/`20260613150000`. A régua: tratar PEDIDOS/ESTOQUE como **substrato estável**; qualquer evolução entra pelo gate de autoridade e pelo append-only, nunca por edição de projeção.
- Encaminhar à IA-BANCO a prova-viva (trigger habilitado + drift movements×balances) antes de qualquer fatia que toque inventário.

**4. FRONTEIRA:** cruza com **IA-DINHEIRO** (pedido LÊ `service_offerings.price_cents` mas NÃO liquida; `service_payment_requests` é a borda de handoff, não ledger) · **IA-ACTOR/IA-AUTORIDADE** (gate `canRepresentActor` ANTES da mutação de estado) · **IA-OFERTA** (PRÉ-transação `services`/`service_offerings`; eu sou a mutação) · **IA-TEMPO** (disponibilidade do `bookings`/DECISION-0121) · **IA-BANCO** (prova-viva de trigger/contagem).

**5. STOPs:** não toquei trigger/banco/código/migration · não declarei denominador fechado · prova-viva de runtime → INCONCLUSIVO encaminhado · análise é insumo, não GO.

**Status: RESPONDIDO** (eixo ESTOQUE + eixo PEDIDOS cobertos; 1 item INCONCLUSIVO encaminhado à IA-BANCO).

#### 14.10.1 DÚVIDAS DESTA INSTÂNCIA — IA-COMERCIO (aguardando resposta)
1. **Âncora viva sob demanda (não sweep autônomo).** Revalidei de 1ª mão o substrato citado na minha tarefa (orders/service_orders/inventory_movements/inventory_balances). Demais touchpoints (reservations, lots, stock_transfers, sagas) revalido **sob demanda da EXECUTORA por tarefa em §14.3**, não varro o plano sozinha.
2. **Limite de escrita.** Confirmo alcance de escrita = **somente** §14.10 + `docs/memorias/MINHA_MEMORIA_COMERCIO.md`. Qualquer registro fora disso (DT/DECISION/LOG/STATUS/opus/código/migration/banco) é da EXECUTORA sob GO ou das instâncias donas — **paro e sinalizo**.

#### 14.10.2 — RE-CHECK DE ATIVAÇÃO · 2026-06-20 · HEAD `dd270f41`
Reativada ("vai"). Revalidei o HEAD vivo de 1ª mão (`git rev-parse` → `dd270f41`, branch `rescue-structural`, inalterado) e reli o §14.3. **Sem nova tarefa endereçada a IA-COMERCIO**: o §14.3 mantém apenas a **RODADA 1** (linha 350 — já respondida em §14.10) e a **TASK O3/TODAS** (delta já incorporado na minha resposta de Rodada 1). Não abro frente sozinha (especialista não varre o plano por conta própria). **Status: RESPONDIDO — em prontidão**, aguardando o próximo pedido da IA-DIRETORA em §14.3.

---

### 14.11 IA-AUTORIDADE — Autoridade, Permissões e Grants (READ-ONLY ESTRITO)

- **Trato:** "o que o actor **PODE**" — substrato de grants/capabilities (`actor_capability_grants` 0136 · `tenant_operator_grants` 0126 · `company_users.can_*`/R2 fine grants 0125 · `actor_delegations` · trust grants 0127); registro/nomenclatura de permissão (permission keys 0135 · tri-registry 0137); **APROVAÇÃO FINANCEIRA como autoridade, não como dinheiro** (`financial_approval_policies/authorities/events` 0128/0130 — quem solicita, quem aprova, segregação; "aprovar ≠ executar"); RBAC legado + V2 (`actor_has_permission()` = stub deny-all até FASE 6); operador de agenda por grant (0138). Pergunta canônica: **"esse actor TEM a permissão/grant/capability X? quem pode aprovar?"**
- **Memória soberana da instância:** `docs/memorias/MINHA_MEMORIA_AUTORIDADE.md` (a criar; única, além desta seção, que posso escrever; append-only).
- **Fronteiras:** IA-ACTOR = "esse actor é meu / represento" (`canRepresentActor`); EU = "esse actor tem o grant X". IA-DINHEIRO = o dinheiro que MOVE (`bank_ledger`); EU = a AUTORIDADE de aprovar/segregar. Superfície financeira com fail-open de autoridade → **IA-DINHEIRO + IA-AUTORIDADE**, IA-DIRETORA consolida. Prova-viva de runtime (RLS aplicada, `count(*)` de `financial_approval_*`, valor de flag/FASE 6, `\d`) que não alcanço read-only → declaro **INCONCLUSIVO** e encaminho à **IA-BANCO-DE-DADOS**.
- **DECISIONs sob meu olhar:** 0125 (company_users R2 fine grants), 0126 (`tenant_operator_grants`), 0127 (trust grants), 0128/0129/0130 (aprovação financeira — política/autoridade/eventos), 0134 (referral = lookup, NÃO autoridade), 0135 (permission key `domain:action`), 0136 (`actor_capability_grants` substrato), 0137 (tri-registry de permissões), 0138 (operador de agenda por grant — **RFC, não materializada**), 0013/0060 (RBAC legado + stub fail-closed), 0131 (gramática de autoridade — índice).
- **DTs sob meu olhar:** DT-RBAC-FAIL-CLOSED-STUB-FASE6 (OPEN — `actor_has_permission` = `RETURN FALSE`), DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION (OPEN — operador não-owner em agenda), e a fronteira "leak vivo × reactivation-trap" do FASE 6 (ligar lê 8 roles/76 perms legados).
- **STOPs INVIOLÁVEIS:** role/status/flag ≠ autoridade (AUTHORITY_LAW Art.17) · `actor_has_permission()` = stub `RETURN FALSE` NÃO-reativável sem reclass + reseal · `assertActorRepresentable` = invariante não-removível (única barreira anti-spoof se FASE 6 ligar) · `grant_origin`/cargo = proveniência IMUTÁVEL, nunca autoridade atual · aprovar ≠ executar · PORTA-1 (1ª row `financial_approval`)/PORTA-2 (swap do `RETURN FALSE`)/PORTA-3 (1ª delegação ativa) = ATO SOBERANO de Clayton, nunca migration casual · R2/delegação e FASE 6 congelados enquanto DECISION-0113 OPEN · não editar código/migration/banco/cartório · análise = insumo, **nunca GO**.

#### 14.11 — RESPOSTA À RODADA 1 (re-baseline do eixo AUTORIDADE)
**RESPOSTA PARA: IA-DIRETORA  (de: IA-AUTORIDADE)**
**HEAD no momento:** `dd270f41` · branch `rescue-structural` | **Revalidou no vivo:** sim (migrations + função SQL + caller, de 1ª mão via `git rev-parse`/Read/Grep; prova-viva de banco corrente → INCONCLUSIVO, IA-BANCO) | **Status: RESPONDIDO** (2 itens INCONCLUSIVOS encaminhados).

**1. O QUE ESTÁ MATERIALIZADO (substrato 0125–0138 — disco vivo `dd270f41`, 395 `.sql`):**

| Substrato | DECISION | Estado no disco | Evidência |
|---|---|---|---|
| `actor_capability_grants` | 0136 | **MATERIALIZADO — substrato puro, ZERO enforcement em rota** | `backend/migrations/20260616210000_create_actor_capability_grants.sql:29` |
| `tenant_operator_grants` | 0126 | MATERIALIZADO | `20260614120000_create_tenant_operator_grants.sql` |
| `actor_delegations` | (delegação) | MATERIALIZADO (PORTA-3 = 1ª ativa, soberana) | `20260530493000_create_actor_delegations.sql` |
| `company_users.can_*` / R2 fine grants | 0125 | MATERIALIZADO | `20260530520500_add_company_users_rbac_columns.sql` · `20260613170000_add_company_users_r2_fine_grants.sql` |
| trust grants | 0127 | MATERIALIZADO | `20260530450000_trust_tables.sql` · `20260530513000_create_authority_trust_levels.sql` · `20260614130000_add_tenant_trust_grants.sql` |
| `financial_approval_policies`/`authorities`/`policy_events` | 0128/0130 | **MATERIALIZADO — vazio por desenho (fail-closed)** | `20260614150000_financial_approval_policy_materialization.sql:15,42,66` |
| core de aprovação (`approval_requests`/`approval_votes`: idempotência + append-only + terminal congelado) | 0128 | MATERIALIZADO | `20260614140000_financial_approval_core_governance.sql` |
| permission keys / tri-registry | 0135/0137 | registro **em código**, não DB | `backend/src/core/authorization/permission-keys.ts` |
| operador de agenda por grant | 0138 | **NÃO materializado — RFC apenas** | `docs/02_decisions/DECISION_0138_CALENDAR_OPERATOR_GRANT_AUTHORITY_RFC.md`; sem migration; DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION OPEN |

> **`actor_capability_grants` (0136) — precisão crítica:** a tabela existe, MAS o cabeçalho da migration (`:7`) declara *"NENHUMA rota de negócio recebe enforcement neste Slice"* e a allowlist é **NÃO-FINANCEIRA por construção** (`CHECK chk_acg_capability_nonfinancial:65` — só `calendar:block/unblock`, `services:create/edit/disable`; financeiro proibido). grantee = `actor_id` server-side (nunca slug/referral — lookup ≠ authority); `scope_type='actor'` only; sem backfill permissivo. **Substrato pronto; autoridade ainda não liga em nenhuma superfície de negócio.**

**2. CONTAGEM `financial_approval_*` (0/0/0?):** **INCONCLUSIVO read-only** — `count(*)` exige SELECT no banco vivo, fora do meu alcance. **Por desenho deve ser 0/0/0:** a migration diz *"Sem backfill"*, *"SEM autoridade automática para owner/admin (D1/D11): toda authority é cadastrada explicitamente"*, *"approval_requests/approval_votes vazias"* → **fail-closed por vazio**. A 1ª row (PORTA-1) é **ato soberano de Clayton**, nunca migration casual. **Confirmação numérica → IA-BANCO-DE-DADOS.**

**3. RLS nos 6 planos de autoridade:** **INCONCLUSIVO read-only** — *RLS existir ≠ RLS ativa* (inerte sob conexão `postgres`/superuser/bypassrls); exige prova-viva no banco → **IA-BANCO-DE-DADOS.** Sinal adjacente já registrado pela IA-BANCO (§14.9 item 7): assimetria material `service_payment_requests rls=f` × `service_payment_executions rls=t` — fronteira **IA-DINHEIRO + IA-BANCO**, fora do meu núcleo de grant mas no mapa de autoridade financeira.

**4. STUB `actor_has_permission`:** **deny-all VIVO e correto.** `backend/migrations/20260422000100_actor_has_permission_fail_closed.sql:24` → `RETURN FALSE` incondicional (C47/DECISION-0013; *"FASE 6 substituirá esta função"*). Caller único vivo: `backend/src/core/rbac/rbac.service.ts:124` (RBAC V2, `SELECT actor_has_permission(...)`). **PORTA-2** (trocar o `RETURN FALSE`) = ato soberano; reativar a FASE 6 lê 8 roles/76 perms legados → **reactivation-trap**, não religar sem reclass + reseal. **Congelado enquanto DECISION-0113 OPEN.**

**5. RISCOS (do meu eixo, estado HOJE):** (a) `actor_capability_grants` materializado mas inerte pode ser lido como "autoridade já funciona" — **não funciona** (zero enforcement); (b) qualquer enforcement futuro que expanda a allowlist para key financeira = CRITICAL (3 paralelas), proibido por carona; (c) ligar FASE 6 sem preservar `assertActorRepresentable` = abre spoof; (d) tratar `grant_origin`/cargo como autoridade atual = violação Art.17.

**6. FRONTEIRA:** cruza com **IA-DINHEIRO** (aprovação financeira = autoridade; o dinheiro que move é dela) e **IA-ACTOR** (`canRepresentActor` é dela; grants são meus). Prova-viva 2 e 3 → **IA-BANCO-DE-DADOS**.

**7. DELTA vs planos dev-385/387 (re-baseline):** o eixo autoridade **avançou** desde dev-385 — `actor_capability_grants` (0136) e o substrato de aprovação financeira (0128/0130) foram **materializados** (migrations 0614/0616). Mas materializado ≠ ligado: enforcement de grant = ZERO; `financial_approval_*` = vazio fail-closed; FASE 6/stub = congelados (0113 OPEN). O que nos planos dizia "substrato de aprovação a desenhar" virou **STALE** (já existe no disco); o que dizia "FASE 6 bloqueada / R2 congelado" **permanece vivo**.

**STOPs desta resposta:** nada aqui é GO; PORTA-1/2/3 intactas; FASE 6/R2 congelados (0113 OPEN); não toquei código/banco/cartório.

— **IA-AUTORIDADE**, sob coordenação da IA-DIRETORA. _(Próximo: criar `docs/memorias/MINHA_MEMORIA_AUTORIDADE.md` espelhando este baseline.)_

#### 14.11.1 DÚVIDAS DESTA INSTÂNCIA — IA-AUTORIDADE (aguardando resposta)
1. **Âncora viva sob demanda (não sweep autônomo).** Revalidei de 1ª mão o substrato citado na minha tarefa (capability grants 0136, financial_approval 0128/0130, stub `actor_has_permission`). Demais touchpoints (tri-registry 0137 em código, trust grants 0127, delegação) revalido **sob demanda da EXECUTORA por tarefa em §14.3**; não varro o plano sozinha.
2. **Limite de escrita.** Confirmo alcance de escrita = **somente** §14.11 + `docs/memorias/MINHA_MEMORIA_AUTORIDADE.md`. Qualquer registro fora disso (DT/DECISION/LOG/STATUS/opus/código/migration/banco) é da EXECUTORA sob GO ou das instâncias donas — **paro e sinalizo**.

---

### 14.13 IA-LOGISTICA — Fluxo Transversal, Cascata e Viabilidade (READ-ONLY ESTRITO)

- **Trato:** o **encadeamento coordenado** de passos da escada (gatilho → próximo passo → … → faturamento) e a **viabilidade transversal** de cada passo. Sou a única instância que **não é dona de nenhum SSOT** — **leio vários e raciocino sobre o FLUXO** (o cérebro da cascata: lanche concluindo → encadeia transporte → conflui ao faturamento). Sou a especialista de domínio da futura **MACRO 5 (engine de orquestração)** — distinta da IA-DIRETORA (que **governa** o fluxo) e dos donos-de-substrato (que **possuem** a verdade). Para este plano, respondo: **"qual é o próximo passo coordenado — quem, quando, onde, em que ordem — e é factível dentro das blindagens?"** — veja §2 (a escada inteira), §3 (um substrato N verticais), §5 MACRO 5 (composição transversal por último), §7 blindagens 2 e 3.
- **Memória soberana da instância:** `docs/memorias/MINHA_MEMORIA_LOGISTICA.md` (única, além desta seção, que posso escrever; append-only — mapas de acoplamento, réguas de viabilidade, padrões de fluxo; **nunca substrato**).
- **Trava de coerência do meu eixo:** **"evento REGISTRA, nunca CAUSA"** — a cascata é mediada/governada: um módulo emite TRANSIÇÃO DE ESTADO → eu **LEIO e PROPONHO** o próximo passo dentro das blindagens → o **humano confirma** → só então muta estado e, depois, financeiro. **Presença HABILITA, não credita.** **Money não pega carona** (liquidação é da IA-DINHEIRO, a jusante). **Eu filtro/ordeno/sequencio/PROPONHO — nunca cravo o fornecedor final nem disparo mutação.**
- **STOPs:** não executo · não edito código/migration/banco/frontend/cartório/memória alheia/§14.3/documento-mestre · não cravo fornecedor final · não disparo mutação por evento · não trato recurso físico inexistente como existente · não "fecho" trabalho de recurso físico sem DECISION + macro próprias (gate-on-materialization) · não escrevo a verdade de outro eixo (leio, cito o dono) · análise = insumo, **não GO**.

---

**RESPOSTA À RODADA 1 (re-baseline de eixo) — formato fixo §6**

RESPOSTA PARA: IA-DIRETORA  (de: IA-LOGÍSTICA)
**HEAD no momento:** `dd270f41` · branch `rescue-structural` | **Revalidou no vivo:** sim (de 1ª mão: `git rev-parse`, Grep/Read sobre migrations e `backend/src`)

**VEREDITO: ⚠️ PREMISSA "GREENFIELD" DO PLANO ESTÁ STALE — substrato físico de transporte EXISTE no disco.**

**1. FLUXO PROPOSTO (sem mudança — só re-baseline):** Nenhum encadeamento novo proposto nesta rodada. Minha tarefa foi (a) confirmar o substrato físico greenfield e (b) mapear os SSOTs que meu raciocínio de fluxo lê. Resultado de (a) **inverte** a premissa do plano; (b) abaixo.

**2. VIABILIDADE / DELTA MATERIAL (o que mudou vs. o que o plano §2 declara):**
O plano afirma (§2, bloco "SUBSTRATO FÍSICO"): *"transporte/rotas/recursos/entrega = GREENFIELD (0 tabelas no disco hoje)"*. **O disco vivo contradiz.** Existe um domínio `rides` (mobilidade/transporte) **completo, no caminho de migrations vigente** (não-archive) e **runtime-wired**:
- **Schema (migrations `2026-05-30…`, forward path):**
  - `rides_drivers`, `rides_vehicles` — recursos físicos (motorista/veículo, categoria, capacidade, aprovação/verificação) — `backend/migrations/20260530350000_rides_core.sql:3,20`.
  - `rides_cities`, `rides_zones` (**`polygon JSONB` + `area_m2` = zona geográfica/roteamento**), `rides_service_types` (`base_fare_cents`/`price_per_km_cents`/`price_per_min_cents`) — `…20260530360000_rides_requests.sql:3,14,25`.
  - `rides_ride_requests` (**`origin`/`destination`/`stops` JSONB = rota**, `estimated_distance_m`/`estimated_duration_s`), `rides_rides` (**rota real + `fare_cents`/`driver_amount_cents`/`platform_amount_cents`/`fund_amount_cents` + `bank_transaction_id`→`bank_transactions`**) — `…20260530360000_rides_requests.sql:38,61`.
  - `rides_driver_locations`, `rides_driver_sessions`, `rides_pricing_config` — `…20260530370000_rides_operational.sql:3,14,26`.
  - `rides_distribution_rules`, `rides_ride_distributions` (**dispatch/distribuição automática de corrida**), `rides_referral_links`/`rides_referral_earnings` — `…20260530390000_rides_distribution.sql`, `…20260530380000_rides_referral.sql`.
- **Runtime (20 arquivos em `backend/src/modules/rides/**`):** `availability`, `demand`, `distribution`, `drivers`, `location`, `ride-requests`, `rides`, `zones`, `pricing`, `lifecycle`, `safety`, `analytics` + `core/city/city-readiness`.

→ **Logo, para o meu eixo:** o substrato físico **não é greenfield**; é um **vertical de mobilidade já materializado e silado**. Isso muda a postura do plano de *"não posso raciocinar sobre recurso físico porque não há tabela"* para *"há substrato físico, mas é de UM vertical (transporte de pessoas), não a engine transversal de rota/recurso/entrega da cascata"*. A MACRO 5, ao nascer, precisa decidir **convergir sobre `rides_*` ou tratá-lo como contexto** — e **NÃO criar um 4º/5º substrato físico paralelo** (mesma lei anti-fragmentação do §3).

**CAVEATS honestos (não exceder a evidência):**
- São **arquivos de migration no caminho vigente** — se estão **APLICADAS** no banco vivo (linha em `schema_migrations`) é **prova-viva de runtime que NÃO alcanço read-only → INCONCLUSIVO; encaminho à IA-BANCO-DE-DADOS** (`to_regclass('rides_rides')`, drift disco×`schema_migrations`).
- `rides` = transporte **de pessoas** (ride-hailing); **não** cobre entrega/logística-de-bens/booking-de-recurso genérico da cascata (ex.: "lanche concluído → transportar buffet ao evento"). Cobertura **parcial**, não total — declarar greenfield=0 é falso, mas declarar "logística resolvida" também seria.

**3. DEPENDÊNCIAS DE SSOT (o mapa que meu raciocínio de fluxo LÊ — e o dono de cada verdade):**

| Passo da escada | Pergunta | SSOT (lido, não possuído) | Dono (eixo) | Existência no disco |
|---|---|---|---|---|
| 1 SEMÂNTICA | do que a demanda precisa? | `concepts`, `concept_relations` | **IA-SEMANTICA** | `0069_concepts.sql:12`, `0076_concept_relations.sql:10` ✓ |
| 2 IDENTIDADE/DESCOBERTA | quem faz? | `services` | **IA-OFERTA** | `20260418120000_services_table_core.sql` ✓ |
| 3 CONTRATAÇÃO | qual pacote concreto? | `service_offerings` (+`company_concept_publications`, `tenant_concept_offerings` read-model) | **IA-OFERTA** | `20260611180000…` ✓; `20260604140000…:23` ✓; `0072…:9` ✓ |
| 4 TEMPO | quando/livre? | `unified_availability` (`owner_type='service_offering'`, DECISION-0132), `unified_bookings` | **IA-TEMPO** | ALTERs em `20260530509000…`/`20260616120100…` ✓ |
| 5 AUTORIDADE | pode contratar/representar? | `actors`, `canRepresentActor`, `actor_capability_grants`, gate accept-quote/R7b/0110 | **IA-ACTOR / IA-AUTORIDADE** | `0002_identity.sql:19` ✓; `20260616210000…:29` ✓ |
| 6 AFUNILAMENTO | raio/reputação/preço/fee? | reputação read-model; `economic_policy_engine` (fee bps); região | **IA-DINHEIRO / IA-BANCO** | `economic_policy*` ✓ (grep) |
| 7 ESTADO | humano escolhe | `service_booking_decisions` → booking/`service_order` | **IA-COMERCIO** | `20260530494000…:3` ✓; `20260530555000…` ✓ |
| 8 FINANCEIRO | liquida (a jusante) | `bank_ledger`, `bank_splits`, `bank_transactions` | **IA-DINHEIRO** | `0003_bank_core.sql:67,83` ✓ |
| 9 EVENTO | registra, não causa | feed/notificações (projeção) | IA-DIRETORA/eventos | (projeção) |
| ONDE/região | onde/jurisdição | `addresses`, `address_assignments`, `countries→…→neighborhoods` | **IA-BANCO/localização** | `20260530518000…` ✓ |
| FÍSICO (meu domínio futuro) | rota/recurso/entrega | **`rides_*` (existe!)** + entrega/recurso genérico (ausente) | (greenfield-per-plano → **revisar**) | `rides_*` ✓ no disco; aplicação=INCONCLUSIVO |

**4. RISCOS (do meu eixo — auto-causação / auto-escolha / recurso fantasma):**
- **🔴 Auto-escolha de fornecedor já EXISTE no disco e colide com a Blindagem 2 (§7):** `rides_distribution_rules` + `rides_ride_distributions` = **dispatch automático** (o sistema **escolhe o motorista**). Para mobilidade isso é convenção de mercado, mas é um **precedente vivo** contra *"o sistema filtra e ordena; nunca crava o fornecedor final"*. Se a MACRO 5 generalizar a partir de `rides`, herda a auto-escolha. **Sinalizo** (não decido): a engine transversal precisa de uma fronteira explícita "auto-dispatch é exceção de mobilidade, não padrão da cascata".
- **🟠 Verdade de preço/fee paralela:** `rides_service_types` carrega `base_fare/per_km/per_min_cents` **próprios** e `rides_rides` calcula `platform_amount`/`fund_amount` **sem passar por `economic_policy_engine`** (aparentemente). Possível **fee-truth paralela** → **encaminho à IA-DINHEIRO** (eixo dela; eu só sinalizo o acoplamento).
- **🟠 Money via carona / evento-causa:** `rides_rides.bank_transaction_id` liga corrida↔`bank_transactions` diretamente. Se a conclusão da corrida **dispara** liquidação, fere "evento REGISTRA, nunca CAUSA" + "money não pega carona". **Prova-viva (há mediação humana? trigger? service?) = INCONCLUSIVO → IA-DINHEIRO/IA-BANCO.**
- **🟡 Recurso físico tratado como existente:** o risco-clássico do meu eixo está **invertido** aqui — o plano assume 0 tabelas e eu acho substrato; o risco real agora é a **MACRO 5 criar um modelo de rota/recurso paralelo a `rides_*`** (fragmentação §3) por desconhecer o que já existe.

**5. STOPs:** Não cravo fornecedor (e sinalizo que `rides` já o faz) · não disparo mutação por evento · não fecho recurso físico sem DECISION+macro próprias (gate-on-materialization continua válido **mesmo com `rides` existindo**, porque é vertical-silado, não engine transversal decidida) · não escrevo verdade de IA-DINHEIRO/IA-TEMPO/IA-OFERTA — só cito o dono · análise = insumo, não GO.

**Status: RESPONDIDO** — com **1 ponto INCONCLUSIVO encaminhado** (aplicação real das migrations `rides_*` + se a liquidação é mediada → IA-BANCO-DE-DADOS / IA-DINHEIRO). **Recomendação à IA-DIRETORA:** corrigir a premissa "greenfield 0 tabelas" do §2 para "substrato físico parcial existe (`rides_*`, vertical de mobilidade silado); engine transversal de rota/recurso/entrega permanece não-decidida (MACRO 5) e deve convergir, não duplicar".

**À EXECUTORA — declaração de disponibilidade (IA-LOGÍSTICA):**
Identificada e à disposição em §14.3. Ao receber tarefa, revalido o HEAD/disco de 1ª mão antes de qualquer veredito (disco vence narrativa; plano/memória podem estar stale). Respondo no formato fixo §6 (FLUXO · VIABILIDADE · DEPENDÊNCIAS DE SSOT · RISCOS · STOPs), sempre **citando o dono** de cada verdade que leio.

- Para **encadeamento de passos / cascata / viabilidade transversal / ordem de execução / mapa de acoplamento de fluxo**: chame **IA-LOGÍSTICA**.
- Para dúvidas que cruzem **fluxo + tempo** (sequência depende de disponibilidade): **IA-LOGÍSTICA + IA-TEMPO**.
- Para dúvidas que cruzem **fluxo + dinheiro** (liquidação a jusante / fee na cascata): **IA-LOGÍSTICA + IA-DINHEIRO**.
- Para **substrato físico (rota/recurso/transporte/entrega)**: chame **IA-LOGÍSTICA**, mas o veredito final de schema é **IA-BANCO-DE-DADOS** e a decisão é de Clayton (gate-on-materialization).

— **IA-LOGÍSTICA**, pronta sob coordenação da IA-DIRETORA.

#### 14.13.1 DÚVIDAS DESTA INSTÂNCIA — IA-LOGÍSTICA (aguardando resposta)
1. **Status do vertical `rides`.** Achei `rides_*` no caminho de migrations vigente + 20 arquivos de runtime. Preciso saber da IA-DIRETORA/Clayton se `rides` é (a) vertical **vivo**, (b) **tombstone/parado**, ou (c) **protótipo** — isso muda se a MACRO 5 **converge sobre ele** ou o **isola**. Não investigo por conta própria (não abro frente sozinha); revalido sob tarefa explícita em §14.3.
2. **Âncora viva sob demanda.** Não varro o plano sozinha. Ao receber tarefa, revalido cada acoplamento de fluxo contra o disco do HEAD do momento. Se Clayton preferir um **mapa de acoplamento inicial completo** (todos os passos × SSOT × dono × estado vivo) como insumo para a MACRO 5, registrar como tarefa explícita — entrego de bom grado, mas não inicio por conta própria.
3. **Limite de escrita.** Confirmo: escrevo **somente** esta §14.13 + `docs/memorias/MINHA_MEMORIA_LOGISTICA.md`. Qualquer registro fora disso → paro e sinalizo.

**RE-CHECK 2026-06-20 (novo "vai", IA-LOGISTICA), HEAD `dd270f41`:** sem RODADA 2 nem tarefa nova em §14.3 endereçada a mim — a tarefa da linha ~351 (greenfield + mapa de SSOT) já está respondida acima nesta §14.13. Revalidei de 1ª mão: HEAD segue `dd270f41`; o substrato `rides_*` continua no caminho de migrations vigente (`ls backend/migrations/*rides*.sql` = 6 arquivos). → minha RESPOSTA RODADA 1 acima **continua válida (NÃO-STALE)**. Mantenho o INCONCLUSIVO encaminhado (aplicação real de `rides_*` no banco vivo → IA-BANCO-DE-DADOS) e a dúvida §14.13.1#1 (status vivo/tombstone/protótipo de `rides`). Aguardo a próxima tarefa da IA-DIRETORA ou o "consolida". **Status: RESPONDIDO / SEM-TAREFA-NOVA.**

---

*Documento de planejamento. Append-only recomendado. Verificado contra disco e normas em sessão READ-ONLY; nenhuma alteração de código/schema/SSOT produzida por este documento.*

### 14.12 IA-OFERTA — Descoberta e Oferta (services / service_offerings / publicação) (READ-ONLY ESTRITO)
> _Seção criada por IA-OFERTA em 2026-06-20. Anexada ao final por contenção de concorrência (múltiplas instâncias escrevendo o §14 simultaneamente; o bloco de rodapé do documento permanece acima por desenho de append atômico)._

- **Trato:** a camada PRÉ-transação da escada — "quem faz o quê" e "qual pacote concreto, agendável e contratável". Quatro representações, UMA SSOT por verdade:
  - **DESCOBERTA:** `services` (índice soberano de descoberta que o RFQ consulta) + `tenant_concept_offerings` (vitrine/read-model marketplace — NUNCA SSOT).
  - **CONTRATAÇÃO:** `service_offerings` (unidade soberana: preço/duração/modalidade/status; identidade via `canonical_service_id`).
  - **PUBLICAÇÃO PJ:** `company_concept_publications` (SSOT de publicação por conceito, KYB-gated; DECISION-0099/0100).
- **Memória soberana:** `docs/memorias/MINHA_MEMORIA_OFERTA.md` (append-only).
- **DECISIONs sob meu olhar:** 0117 (catálogo/oferta canônica) · 0099/0100 (publicação soberana KYB-gated) · 0106 (domain to N0) · 0108 (produto por ramo) · 0109 (trilho B bank-free) · 0122 (service_offering canonical binding) · 0133 (suppliers company-owned).
- **STOPs:** BLINDAGEM — o sistema FILTRA/ORDENA/PROPÕE candidatos, NUNCA crava o fornecedor (quem casa é o humano) · `tenant_concept_offerings` é read-model, NUNCA SSOT (uma SSOT por verdade) · preço faturável SEMPRE `service_offerings.price_cents` BIGINT; `services.price_cents` é só indicativo · a oferta NÃO armazena tempo (vive em `unified_availability`) · descoberta é read-only/sem autoridade, a CONTRATAÇÃO exige gate (`canRepresentActor`/accept-quote/0110) · análise = INSUMO, nunca GO · edito só este documento (§14.12) + minha memória.

#### 14.12 — RESPOSTA À RODADA 1 (re-baseline de eixo)
**RESPOSTA PARA: IA-DIRETORA  (de: IA-OFERTA)**
**HEAD no momento:** `dd270f41` · branch `rescue-structural` | **Revalidou no vivo:** parcial (disco de 1a mão SIM — `git rev-parse`, migrations e DECISIONs; banco corrente/rowcounts/`to_regclass` NÃO alcanço read-only → declarado INCONCLUSIVO → IA-BANCO).

**VEREDITO:** as 4 representações do meu eixo estão MATERIALIZADAS no disco vivo e coerentes com a norma. `service_offerings.price_cents` é **BIGINT NOT NULL** (faturável canônico) no disco; `services.price_cents` é **INTEGER nullable** (indicativo) — separação preço-faturável x preço-indicativo preservada. A SSOT de publicação PJ é `company_concept_publications`; `tenant_concept_offerings` permanece read-model. **Correção de precisão ao enquadramento do meu próprio prompt:** o pai/promessa canônico de `service_offerings` é **`canonical_services`** (`canonical_service_id` NOT NULL), NÃO `services` — `service_id` é vínculo legado/projeção, nullable e NUNCA populado na criação (DECISION-0122).

**1. EVIDÊNCIAS (arquivo:linha / DECISION / tabela):**
- **CONTRATAÇÃO — `service_offerings` (BIGINT vivo):** `backend/migrations/20260611180000_offerings_variant_sku_service.sql:66-84` — `price_cents bigint NOT NULL CHECK (price_cents >= 0)` (`:73`); identidade `canonical_service_id uuid NOT NULL REFERENCES canonical_services(id)` (`:69`); `provider_actor_id NOT NULL` (`:70`); `service_id uuid REFERENCES services(service_id) ON DELETE SET NULL` (`:72`, legado/nullable); `UNIQUE (provider_actor_id, canonical_service_id)` (`:83`). **Nenhuma coluna de tempo** (disponibilidade = Unified Availability, header `:14-16`). Nenhum ALTER posterior tocou `price_cents` (migrations que mexem em `service_offerings`: só `20260611180000` create + `20260613160000` que adiciona FK em OUTRAS tabelas).
- **DESCOBERTA — `services` (indicativo):** `backend/migrations/20260418120000_services_table_core.sql:6-32` — `price_cents INTEGER` nullable (`:19`), `CHECK (price_cents IS NULL OR price_cents >= 0)` (`:31`); COMMENT `:40-41` "usada por descoberta e por service_discovery_requests.service_id"; `UNIQUE (tenant_id, actor_id, slug)` (`:30`).
- **VITRINE — `tenant_concept_offerings` (read-model):** `backend/migrations/0072_tenant_concept_offerings.sql:9-23` — COMMENT `:22-23` "ofertas semânticas para discovery contextual (marketplace)". DECISION-0100 D10: read-model/compat, NÃO substituída pela publicação.
- **PUBLICAÇÃO PJ — `company_concept_publications` (SSOT):** `backend/migrations/20260604140000_create_company_concept_publications.sql:23-49` — SSOT de publicação company/page-actor x concept (DECISION-0099/0100); UNIQUE parcial 1 publicação ATIVA por `(company_id, concept_id)` (`:53-55`); writer (publish/unpublish) **KYB-gated + company_users** é frente própria, NÃO instalado nesta migration (header `:7-9`).
- **NORMA:** DECISION-0117 secao A `:32` ("Preço pertence à oferta") + secao D `:44-47` (`canonical_services`/`service_offerings`); DECISION-0122 `:9` ("service_id NUNCA é populado na criação ... vínculo é via canonical_service_id, não via service legado").

**2. RISCOS (do meu STOP-set — estado HOJE):**
- **Verdade dupla de preço — latente, contida por norma:** existem DUAS colunas `price_cents` (`services` INTEGER x `service_offerings` BIGINT). NÃO é double-SSOT porque `services.price_cents` é não-autoritativo/indicativo, mas a superfície existe — o drift de TIPO (INTEGER x BIGINT, 07 secao 4.7) é DT material que a IA-BANCO já mapeia (MACRO 2: migrar/depreciar). STOP ativo: faturável SEMPRE `service_offerings.price_cents`.
- **Read-model virando SSOT — NÃO observado no schema:** `tenant_concept_offerings` continua read-model; a SSOT de publicação é `company_concept_publications`. Sem inversão estrutural.
- **Oferta armazenando tempo — NÃO observado:** `service_offerings` sem coluna temporal; tempo vive em `unified_availability owner_type='service_offering'` (estrutura = IA-BANCO; semântica = IA-TEMPO).
- **Descoberta exigindo/ignorando autoridade:** descoberta (`services`/`tenant_concept_offerings`) é read-only sem autoridade [ok]; publicação tem writer KYB-gated (ainda frente própria); contratação a jusante exige `canRepresentActor` (eixo IA-COMERCIO/IA-AUTORIDADE).
- **Ranking que auto-escolhe fornecedor — fora do meu alcance read-only confirmar no runtime de descoberta** → INCONCLUSIVO; a régua de blindagem (propor/filtrar/ordenar, nunca cravar) precisa ser verificada no service de discovery quando uma fatia tocá-lo.

**3. RECOMENDAÇÃO (régua/decisão — descrever, NÃO codar):**
- Meu eixo NÃO está stale no substrato: as 4 camadas existem no disco. Tratar como **substrato estável**; régua canônica = preço faturável só em `service_offerings.price_cents`, vitrine nunca vira SSOT, oferta nunca guarda tempo, descoberta propõe/filtra/ordena mas o humano casa.
- A precisão "pai canônico = canonical_services, não services" deve ser carregada em qualquer GO que toque a oferta — o enquadramento "filha de services" induz erro de modelagem.
- Encaminhar à IA-BANCO a prova-viva (existência `to_regclass`, rowcounts de `service_offerings`/`company_concept_publications`, e drift de tipo `price_cents`) antes de qualquer fatia de oferta.

**4. FRONTEIRA:** cruza com **IA-SEMANTICA** (identidade vem do CONCEPT/canonical_services; a oferta CONSOME concept_id) · **IA-TEMPO** (oferta INTERSECTA unified_availability, nunca armazena tempo) · **IA-DINHEIRO** (oferta EXPÕE price_cents faturável, nunca liquida) · **IA-COMERCIO** (o PEDIDO/estado a jusante; binding service_offering_id em service_orders/service_booking_decisions via 20260613160000) · **IA-BANCO** (prova-viva de existência/tipo/contagem).

**5. STOPs:** não toquei código/banco/migration/cartório · não declarei denominador fechado · prova-viva de runtime (rowcounts/`to_regclass`/ranking de discovery) → INCONCLUSIVO encaminhado à IA-BANCO · análise é insumo, não GO · editei só §14.12 (criada agora); minha memória `MINHA_MEMORIA_OFERTA.md` será criada em passo próprio.

**Delta O3 (dev 385/387 -> `dd270f41`) no meu eixo:** (a) **DECISION-0122 PROMULGADA + migration `20260613160000` aplicada** = service_offering virou recurso canônico ligado à cadeia decision/order (FK em service_orders/service_booking_decisions) — material, mas a jusante (IA-COMERCIO); a oferta em si não mudou de forma. (b) **DECISION-0133 (suppliers company-owned)** = DOCS-ONLY, zero migration/schema, frente própria futura (F-SUPPLIERS-OWNER-ACTOR-SCHEMA-WIRING) — NÃO altera o substrato de oferta hoje. (c) Payout-hardening (`dd270f41`/`cd697da7`/`e0fe89b9`) = IA-DINHEIRO, NÃO toca meu eixo. Conclusão: nada do plano dev-385 ficou STALE no substrato de oferta; a única correção é de enquadramento (canonical_services é o pai, não services).

**Status: RESPONDIDO** (descoberta + contratação + publicação cobertos; price_cents BIGINT confirmado no disco; prova-viva de banco corrente declarada INCONCLUSIVO -> IA-BANCO).

#### 14.12.1 DÚVIDAS DESTA INSTÂNCIA — IA-OFERTA (aguardando resposta)
1. **Âncora viva sob demanda (não sweep autônomo).** Revalidei de 1a mão o substrato citado na minha tarefa (services/service_offerings/company_concept_publications/tenant_concept_offerings + price_cents). Discovery service runtime, ranking, e o writer KYB-gated de publicação revalido **sob demanda da EXECUTORA por tarefa em §14.3**; não varro o plano sozinha.
2. **Limite de escrita.** Confirmo alcance de escrita = **somente** §14.12 + `docs/memorias/MINHA_MEMORIA_OFERTA.md`. Qualquer registro fora disso (DT/DECISION/LOG/STATUS/opus/código/migration/banco/frontend) é da EXECUTORA sob GO ou das instâncias donas — **paro e sinalizo**.

— **IA-OFERTA**, sob coordenação da IA-DIRETORA.

---

### 14.14 IA-SEMANTICA — Semântica, Ontologia e Grafo de Concepts (READ-ONLY ESTRITO)
> _Seção criada por IA-SEMANTICA em 2026-06-20. Anexada ao final por contenção de concorrência (múltiplas instâncias escrevendo o §14 simultaneamente; §14.12/14.13 já tomadas por IA-OFERTA/IA-LOGISTICA — adotei a próxima livre, §14.14). O bloco de rodapé do documento permanece acima por desenho de append atômico._

- **Trato:** identidade semântica (`concepts` = SSOT, Lei 7) · `concept_relations` (o GRAFO, global por DECISION-0092) · `categories` (navegação/breadcrumb, NÃO identidade) · `concept_labels` (apresentação) · needs-graph (projeção read-only intent-concept → need-concepts) · governança do writer (trigger `0077` + `app.graph_governance='true'`). **Dona do U1** (widening `concept_relations` 3→6). DECISIONs sob meu olhar: 0070 · 0077 · 0092 · 0104 · 0105 · 0107 · 0117 · 0132.
- **Memória soberana da instância:** `docs/memorias/MINHA_MEMORIA_SEMANTICA.md` (única, além desta seção, que posso escrever; append-only).
- **Frase-guia:** Identidade vem de CONCEPT, nunca de `categories.concept_id`. Taxonomia não nasce de runtime/IA/frontend (0070). O grafo é GLOBAL (0092). Writer só pelo caminho governado. Os 6 tipos normados — sem `suggests`.
- **Fronteira de eixo:** IA-OFERTA = "quem faz / qual pacote" (consome `concept_id`); IA-BANCO = prova-viva do CHECK aplicado no banco vivo + trigger `0077` ativo + contagem de rows. Análise = insumo, **não GO**.

**À EXECUTORA — declaração de disponibilidade (IA-SEMANTICA):** Identificada e à sua disposição em §14.3. Revalido o HEAD/disco de 1ª mão antes de qualquer veredito. Respondo no meu eixo (concepts/relations/categories/labels/needs-graph/governança do grafo) no formato fixo (VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · FRONTEIRA · STOPs). Cruza oferta → **IA-SEMANTICA + IA-OFERTA**; cruza CHECK/trigger no banco vivo → **IA-SEMANTICA + IA-BANCO**.

#### 14.14.1 RODADA 1 — RE-BASELINE DO EIXO SEMÂNTICA / U1 (resposta à tarefa de §14.3)
**RESPOSTA PARA: IA-DIRETORA (de: IA-SEMANTICA)**
**HEAD no momento:** `dd270f41` · branch `rescue-structural` | **Revalidou no vivo:** sim (disco, 1ª mão) | **Status: RESPONDIDO** (1 ponto antes INCONCLUSIVO **RESOLVIDO** pela prova-viva da IA-BANCO em §14.9).

**VEREDITO:** Os **três pontos** confirmam hoje **exatamente 3 tipos** (`enables`, `evolves_to`, `related_to`) — e a **IA-BANCO confirmou no banco VIVO** o mesmo CHECK (3 tipos, `relation_type` = TEXT, não enum pg). A norma soberana já manda **6** — logo **U1 é conformidade NORMA→código, decisão-independente, e NÃO precisa de DECISION nova**. "Remoção de `suggests`" é **não-issue**: `suggests` não existe em nenhum dos 3 pontos nem na norma.

**1. EVIDÊNCIAS (arquivo:linha / norma):**
- **Ponto 1 — CHECK (disco + banco vivo):** `backend/migrations/0076_concept_relations.sql:18-24` → CHECK `relation_type IN ('enables','evolves_to','related_to')`. **Prova-viva IA-BANCO (§14.9):** `concept_relations_relation_type_check` no `pg_constraint` = mesmos 3 tipos; coluna `relation_type` = **TEXT puro** → o widening é **ALTER de CHECK, não ALTER TYPE**. *(Nota: o `0076.sql` ainda tem `tenant_id` + `UNIQUE(tenant_id,…)` = pré-0092; a forma viva pós-0092 é da IA-BANCO.)*
- **Ponto 2 — adapter (código):** `backend/src/core/semantic/graph.adapter.ts:9` → `type GraphRelationType = 'enables' | 'evolves_to' | 'related_to'`.
- **Ponto 3 — governança (código):** `backend/src/core/semantic/graph-governance.service.ts:9-13` → `RELATION_TYPES = new Set([...3 tipos])`. *(Drift de citação: o plano §5 L109 e §14.9 citam `:9-17`; o `Set` real é **L9-13**.)*
- **Norma soberana dos 6 tipos:** `docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md:510-517` (§6.2) → tabela com **exatamente 6**: `enables, requires, evolves_to, related_to, part_of, substitutes`. **Sem `suggests`.** §6.3: criação "via serviço central de graph (não direto em DB)".
- **DECISION governando os 6 tipos?** **Não há DECISION standalone** que promulgue o widening 3→6. Grep em `REMEDIATION_DECISIONS_LOG.md` (concept_relations/relation_type/widening) = nada material. A **autoridade é a própria norma** `18_DOMAIN_ONTOLOGY §6.2`, que precede DECISIONs. Corrobora: `docs/02_decisions/SELO_DECISION_0097_ONTOLOGY_FULL_READ.md:31` (full-read selado) ratifica a LAYER 6 GRAPH com `relation_types (enables/requires/part_of/related_to/substitutes)` por §6/§10.3 — confirma a fonte normativa, **não** é a promulgação do widening.
- **Delta concreto de U1:** adicionar `requires`, `part_of`, `substitutes` aos 3 pontos juntos. **Nada a remover.**

**2. RISCOS / STOPs do eixo:**
- **Widening sem os 3 pontos juntos** = drift (verdade paralela CHECK×código). Tem de mexer CHECK(0076) + adapter:9 + governance:9-13 na MESMA fatia.
- **Negative-proof que MORDE** obrigatória: seed sem `set_config('app.graph_governance','true')` → trigger `0077` bloqueia. Forward-only (0 rows). Prova-viva = IA-BANCO.
- **STOP DECISION-0070:** U1 amplia só o **vocabulário** (tipos permitidos); **NÃO semeia arestas**. Seed de árvore curada = **U1b**, depende de Clayton, writer governado. Não misturar.
- **STOP grafo GLOBAL (0092):** a migration do widening deve mirar a forma **pós-0092** (sem `tenant_id`); não reintroduzir `tenant_id`/override por tenant. O `0076.sql` no disco é pré-0092 — não usar como molde de forma.
- **STOP identidade:** writer permanece concept→concept governado; o fallback do adapter a `category_relations` projetado em `concept_id` é **leitura**, não fonte de identidade.

**3. RECOMENDAÇÃO (descrever, não codar):** Tratar U1 como **conformidade norma→código sem DECISION nova** (fonte = `18_DOMAIN_ONTOLOGY §6.2`). Fatia única tocando os 3 pontos para os 6 tipos normados; **ALTER de CHECK** (não ALTER TYPE — coluna é TEXT, confirmado pela IA-BANCO); reenquadrar "remoção de `suggests`" como **guard contra reintrodução** (não é tarefa, `suggests` não existe). Corrigir a citação `:9-17`→`:9-13`. Gate: 4 gates verdes + `architecture:strict critical_new=0` + negative-proof do trigger `0077` (IA-BANCO). Manter **U1b** (seed/projeção) separada e Clayton-gated.

**4. FRONTEIRA:** **IA-BANCO** (forma segura do ALTER de CHECK pós-0092 + trigger `0077` aplicado — TASK O2; prova-viva do CHECK vivo já entregue em §14.9). **IA-OFERTA** NÃO cruza neste U1 (vocabulário, não oferta). Registro de DT/forma = IA-DT/IA-DOCUMENTOS.

**5. INCONCLUSIVO restante:** estado do **trigger `0077`** aplicado no banco vivo (negative-proof) → IA-BANCO (já em curso na TASK O2). O CHECK vivo foi **resolvido** (IA-BANCO §14.9: 3 tipos).

**Status: RESPONDIDO** (CHECK vivo confirmado pela IA-BANCO; resta só prova-viva do trigger 0077).

#### 14.14.2 DÚVIDAS DESTA INSTÂNCIA — IA-SEMANTICA (aguardando resposta)
1. **Âncora viva sob demanda (não sweep autônomo).** Revalidei de 1ª mão os 3 pontos + a norma §6.2 da minha tarefa. Demais touchpoints (needs-graph, `concept_labels`, 0104/0105/0107/0132) revalido **sob demanda da EXECUTORA por tarefa em §14.3**; não varro o plano sozinha.
2. **Limite de escrita.** Confirmo alcance de escrita = **somente** §14.14 + `docs/memorias/MINHA_MEMORIA_SEMANTICA.md`. Qualquer registro fora disso (CHECK/migration/banco/DT/DECISION/LOG/STATUS/opus/código) é da EXECUTORA sob GO (banco vivo = IA-BANCO) ou das instâncias donas — **paro e sinalizo**.

— **IA-SEMANTICA**, sob coordenação da IA-DIRETORA.
