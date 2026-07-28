# DECISION-0193 — LEI DE INSTRUÇÃO IA: ORIENTAÇÃO CANÔNICA NO PONTO DE USO

**Data:** 2026-07-27 · **Status:** 🔴 **CORRIGIDA após auditoria independente (2026-07-27) — AGUARDANDO RE-AUDITORIA.** NÃO-SELADA. SELF-SEAL NÃO PERMITIDO. **NÃO é autoridade até novo parecer.**
**Modo:** DOCS-ONLY · ZERO CÓDIGO/MIGRATION/GUARD/BANCO · não altera comportamento de runtime.
**Deriva de / subordinada a:** `docs/01_normative/00_AGENT_PROTOCOL.md` (documento que governa como agentes trabalham — é lá que esta lei se materializa) · Lei 7 (governança semântica) · Artigo XI (público, justificado, nunca silencioso).
**Origem:** decisão soberana direta de Clayton, 2026-07-27: *"este sistema é um cérebro vivo, onde deve ter uma lei de instrução IA que no início de cada arquivo a gente vá criando a orientação para que os acoplamentos, conexões e sinapses não se percam."*

---

## 0. NATUREZA E LIMITE

Docs-only. NÃO altera código, runtime, schema, guard ou comportamento. NÃO cria documento normativo novo — materializa-se como seção do `00_AGENT_PROTOCOL.md` quando houver GO material próprio. NÃO declara o próprio selo.

**Não inventa prática nova.** O repositório já pratica isto em **71 arquivos** (avisos anti-paralelo). Esta lei **formaliza, padroniza e torna fiscalizável** o que a casa já fazia de forma dispersa.

---

## D0 — O PROBLEMA

O conhecimento sobre *por que um arquivo é o que é* vive hoje em documentos que o agente **pode não ler**. Um agente competente e sem memória abre um arquivo, lê o código, e conclui — corretamente do ponto de vista técnico, e **erradamente** do ponto de vista institucional — que ali falta algo, que algo é lixo, ou que uma ideia nova cabe.

Cada instância de IA chega com capacidade total e **memória zero**. As normas existem para que o sistema não seja redecidido por quem chegou hoje — mas norma que não é encontrada no ponto de uso **não protege nada**.

**Caso material desta sessão (2026-07-27):** a direção esteve a um passo de reconstruir o modelo econômico de grupo que já era **LEI promulgada** (`CONTRATO_GRUPOS_V2.md`, maio/2026). O arquivo que a induziu ao erro — `user-group-allocation.service.ts` — anuncia-se como *"CONTINUOUS PRODUCTION"* estando **revogado por essa lei** e com a tabela **inexistente no banco**. O comentário não apenas faltava: **apontava para o lado errado**.

---

## D1 — A LEI

> **Todo arquivo que carrega decisão institucional deve declarar, no seu início, a orientação canônica que o governa.**

O arquivo passa a carregar **o ponteiro para a norma que o rege**, no ponto onde alguém vai tropeçar. O acoplamento entre código e decisão deixa de depender de o agente ter lido o documento certo antes.

**Alcance:** arquivos em domínio governado (financeiro, autoridade/permissão, identidade/ontologia, territorial, governança) e **todo** arquivo em estado não-óbvio (legado, dormente, contido, revogado). **NÃO** se aplica a todo arquivo do repositório — lei que exige o impossível é lei que se finge cumprida.

---

## D2 — FORMATO PADRONIZADO

```
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  <vocabulário fechado>
// ║ NORMA:   <caminho real do documento que governa, com seção>
// ║ NÃO:     <o que não fazer aqui>
// ║ EM VEZ:  <o caminho correto, nomeado>
// ╚════════════════════════════════════════════════════════════════
```

Abaixo do bloco, texto livre — a casa já escreve boas narrativas explicativas e **esta lei não as substitui**; ela apenas garante que os quatro campos existam antes.

**Vocabulário fechado de `STATUS`:** `CANÔNICO` · `LEGADO-CERCADO` · `DORMENTE` · `CONTIDO` · `REVOGADO`.

---

## D3 — O CAMPO `EM VEZ` É OBRIGATÓRIO

Um cabeçalho que diz apenas **"não faça"** é pior que nenhum: o agente descobre que o caminho está fechado, **não descobre qual é o aberto**, e **inventa um terceiro**. É exatamente assim que verdades paralelas nascem.

**Todo `NÃO` deve vir acompanhado do `EM VEZ`, nomeando o caminho canônico** (arquivo, função ou norma). Cabeçalho sem `EM VEZ` é considerado incompleto, não parcial.

---

## D4 — VERIFICABILIDADE (a lei precisa de dente)

**A prova de que comentário sem fiscalização apodrece está no próprio repositório:** `CONTINUOUS PRODUCTION` era rótulo verdadeiro na época de sprint e hoje **mente em pelo menos dois arquivos**, um deles o motor legado cercado por tripwire.

Portanto o enforcement é **estrutural, não documental** — guard em CI:
1. Se o cabeçalho existe, `STATUS` deve pertencer ao vocabulário fechado;
2. O caminho em `NORMA` deve **existir fisicamente** — norma apagada ou renomeada torna a suíte vermelha, e a sinapse rompida vira erro em vez de mentira silenciosa;
3. Arquivo em domínio governado sem cabeçalho entra em **inventário**, não em falha.

Sem (2), `ORIENTAÇÃO CANÔNICA` vira o próximo `CONTINUOUS PRODUCTION`.

---

## D5 — GRADUALISMO OBRIGATÓRIO

Aplicação é **incremental e por leva**, nunca big-bang. Ordem de prioridade:
1. Arquivos cujo comentário atual **mente** (dano ativo);
2. Arquivos `REVOGADO`/`CONTIDO`/`DORMENTE` sem aviso (armadilha);
3. Arquivos `LEGADO-CERCADO` (risco de religamento);
4. Arquivos `CANÔNICO` de domínio governado (orientação positiva).

O guard começa **inventariando** e só passa a **exigir** conforme a cobertura sobe. Vedado transformar esta lei em obrigação de massa que agentes cumpram por preenchimento cerimonial — **cabeçalho falso é pior que cabeçalho ausente**.

---

## D5.1 — TETO DE TAMANHO E ECONOMIA DE TOKENS (restrição soberana de Clayton, 2026-07-27)

> *"Sem também ficar criando uma forma de consumo de tokens infinitas."*

**O bloco tem TETO DE 5 LINHAS.** É ponteiro, não documento. Cabeçalho que vira ensaio (a) custa tokens em **toda** leitura do arquivo, (b) deixa de ser lido — que é exatamente a falha que ele existe para evitar. Narrativa longa vive **na norma apontada**, nunca no cabeçalho. O guard afere **teto**, não piso.

**Por que esta lei BARATEIA e não encarece — as camadas cobram onde faz sentido:**

| Camada | Quando custa | Tamanho obrigatório |
|---|---|---|
| `CLAUDE.md` (raiz) | **toda sessão** | mínimo — pergunta invertida + armadilhas mortais + roteamento |
| `00_AGENT_PROTOCOL.md` §7.1 | quando o domínio é tocado | completo |
| Cabeçalho no arquivo | **só ao abrir aquele arquivo** | ≤ 5 linhas |

O cabeçalho é a forma **mais barata** de conhecimento institucional que existe: cobra **uma vez, exatamente de quem precisa, no instante em que precisa**. A alternativa real não é "custo zero" — é **redescoberta**: na sessão que originou esta lei, cinco investigações read-only consumiram ordem de ~1 milhão de tokens, boa parte redescobrindo o que cinco linhas teriam dito. **A migalha não é o custo; é o que evita o custo.**

**Vedado** usar esta lei como pretexto para inflar `CLAUDE.md`, criar documento-índice novo, ou exigir cabeçalho em arquivo trivial.

---

## D5.2 — A REGRA DO ACESSO: anota-se ao tocar, nunca em campanha (decisão soberana de Clayton, 2026-07-27)

> *"Nos arquivos já existentes a gente pode ir inserindo a orientação na medida que eles forem acessados por necessidade."*

**Não existe frente de anotação.** Não se abre campanha, não se varre o repositório, não se orça esforço para isto. A regra é:

> **Tocou um arquivo em trabalho real e descobriu, no caminho, qual norma o governa? Deixa a migalha antes de sair.**

Consequências desejadas — todas gratuitas:
- **Custo dedicado zero.** A anotação viaja de carona num trabalho que já ia acontecer; nada é feito só para anotar.
- **Cobertura cresce pelos caminhos vivos.** Os arquivos mais tocados são os mais perigosos, e são os primeiros a ficar protegidos. Arquivo que ninguém abre há um ano não precisa de migalha — ninguém vai tropeçar nele.
- **Nunca se começa do zero.** O sistema se blinda em camadas, ao longo do tempo, sem que nenhuma sessão precise carregar o peso inteiro.

**🔴 TRAVA OBRIGATÓRIA — anota-se só o que se VERIFICOU.** Um agente que abriu o arquivo por motivo alheio e **não** apurou o estado institucional dele **NÃO escreve cabeçalho**. Escrever `STATUS` por dedução, ou `NORMA` por palpite, produz **cabeçalho falso — que D5 já declara pior que cabeçalho ausente**, porque a próxima IA vai confiar nele. Na dúvida: **não anota**, e registra a dúvida no cartório.

**Exceção que obriga:** encontrou cabeçalho ou comentário que **mente** (caso `CONTINUOUS PRODUCTION`)? Corrigir é **obrigatório**, não opcional — comentário errado causa dano ativo, e deixá-lo é escolher que a próxima instância erre.

---

## 🔴 D5.3 — CORREÇÕES PÓS-AUDITORIA (veredito B · 5 itens nomeados, 2026-07-27)

**B-1 · §0 ERA FALSO QUANDO ESCRITO — registrado como fato consumado, não normalizado.** §0 dizia que esta lei *"materializa-se como seção do `00_AGENT_PROTOCOL.md` **quando houver GO material próprio**"*. Cronologia real (`git log`): rascunho `44d6fc38f` (20:56) → **§7.1 escrito `e6bb48ee1` (20:58)** → `CLAUDE.md` propagado `c497f7702` (20:59). **Dois minutos.** O GO nunca ocorreu. **O rito da casa foi executado ao contrário: a norma entrou em vigor e a auditoria chegou depois, com o ônus de removê-la em vez de aprová-la.** Ação tomada: §7.1 marcado **PROVISÓRIO** no próprio protocolo, com veredito e pendências no texto. **Não normalizar: isto é falha de processo da direção, não precedente.**

**B-2 · O GUARD NÃO APANHA O CASO QUE FUNDA A LEI — D4 prometia dente que não tem.** As 3 checagens de D4 (STATUS no vocabulário · caminho de `NORMA` existe · ausência → inventário) aplicadas ao caso fundador (`user-group-allocation.service.ts` anunciando `CONTINUOUS PRODUCTION` estando revogado) resultam em **inventário, não falha** — porque não há bloco algum ali. **Declara-se expressamente: o guard prova EXISTÊNCIA DO ALVO, nunca VERACIDADE DA AFIRMAÇÃO.** `STATUS` mentiroso e `NORMA` apontando para o documento errado **passam**. Falsidade só é apanhada por revisão humana. A frase de D4 (*"sem (2), vira o próximo `CONTINUOUS PRODUCTION`"*) implicava que **com** (2) não viraria — **falso**, e corrigido aqui.

**B-3 · GRAMÁTICA DO CAMPO `NORMA` NÃO ESTAVA FIXADA.** D2 exige *"caminho real do documento, com seção"*, mas o único exemplar da casa usa `DECISION-0166 D3 · SSOT_REGISTRY_UNIFICARD.md §5.10-5.12 (…)` — **duas referências, uma delas sem caminho**. Fica fixado: o campo aceita **uma ou mais referências separadas por `·`**, cada uma sendo **um caminho relativo ao repo** (`docs/…`) **ou** um token `DECISION-NNNN` resolvível para `docs/02_decisions/DECISION_NNNN_*.md`. O guard valida **cada** referência. Parênteses explicativos são permitidos e ignorados pela validação.

**B-4 · 🔴 VOCABULÁRIO PARALELO — o pecado cardeal, cometido na lei criada para evitá-lo.** `docs/decisions/CODIGO_LATENTE_REGISTRY.md` **já** classifica estado institucional de arquivo (`Código Latente` · `ativo` · `morto` · `contaminado`), com proibições próprias, **e já é aplicado num campo `STATUS:` dentro do código** (`subscription-expiration.job.ts:2`). Esta lei instituiu **um segundo vocabulário fechado sobre o mesmo objeto, no campo de mesmo nome**, e §0 chegou a afirmar *"não inventa prática nova"* **sem citar o registro**. **Crosswalk obrigatório antes de qualquer selo:** `CÓDIGO LATENTE → DORMENTE`; `Código ativo → CANÔNICO`; `Código morto → REVOGADO`; `Código contaminado` **não tem correspondente** e `CONTIDO` **não tem origem** no registro — **as duas lacunas são reais e não devem ser resolvidas por dedução.** Pendente de ato soberano: o registro é **absorvido**, **mantido em paralelo com fronteira declarada**, ou **revogado**? E o `STATUS:` já escrito em `subscription-expiration.job.ts` fica hoje **fora** do vocabulário fechado — não pode ser tratado como erro até essa decisão.

**B-5 · D5.2 COLIDE COM BYTE-PIN SELADO e era silenciosa.** A obrigação *"achou comentário que mente? corrigir não é opcional"* incide sobre arquivos **pinados por sha256** (`service-payment-execution.service.ts`, `economic-policy-engine.service.ts`). Existe um caso real: os comentários `:56-58` e `:189-192` descrevem a resolução PF como `profile/RESIDENCE`, enquanto o código vivo `:252-257` declara **`PROIBIDO: profile/RESIDENCE`**. **Regra fixada: quando o arquivo que mente está pinado, PREVALECE O PIN.** A executora **registra no cartório e escala à direção** — **jamais edita em silêncio**. Reconciliar pin é ato de direção. *(Precedente material da mesma sessão: a direção recusou reconciliar um pin e achou um 4º caminho — declaração policiada por guard —, selado em `6ccdadf11`.)*

---

## D6 — O CABEÇALHO NÃO É VERDADE; A NORMA É

O cabeçalho é **ponteiro**, jamais fonte. Se contradisser `docs/01_normative/` ou `docs/02_decisions/`, **a norma vence e o cabeçalho é bug** — corrigir o cabeçalho, nunca a norma.

Consistente com a hierarquia epistemológica vigente: Constituição > DECISIONs > SSOT > código > runtime > IA. **Esta lei não cria uma nova camada de verdade** — ela cria um índice local para a verdade que já existe. Ler o cabeçalho **não dispensa** o `00_AGENT_PROTOCOL.md` §2.2.

---

## D7 — O QUE ESTA LEI NÃO FAZ

- Não altera comportamento de runtime, schema, guard existente ou dinheiro.
- Não cria documento normativo novo — materializa-se no `00_AGENT_PROTOCOL.md`.
- Não substitui o rito (GATE → GO → executora → verificação → auditoria → selo).
- Não autoriza aplicação em massa: cada leva é fatia própria, verificável e reversível.
- Não dispensa nenhum agente de ler a norma; **reduz a chance de ele não saber que ela existe**.

---

## D8 — POR QUE ISTO É INFRAESTRUTURA, NÃO ESTILO

O sistema acumula anos de causalidade e é operado por inteligências que **não a herdam**. Sem orientação no ponto de uso, cada sessão recomeça a arqueologia — e ocasionalmente **perde**, criando o paralelo que a casa gastou anos evitando.

Nas palavras de Clayton: *"um cérebro vivo… para que os acoplamentos, conexões e sinapses não se percam."* Traduzido para termos verificáveis: **cada arquivo carrega o ponteiro para a decisão que o rege, e o rompimento desse ponteiro é detectável por máquina.**
