# DECISION-0193 — LEI DE INSTRUÇÃO IA: ORIENTAÇÃO CANÔNICA NO PONTO DE USO

**Data:** 2026-07-27 · **Status:** REDIGIDA — LEI DECIDIDA POR CLAYTON; AGUARDANDO AUDITORIA INDEPENDENTE ANTES DE ENFORCEMENT MATERIAL. **NÃO-SELADA. SELF-SEAL NÃO PERMITIDO.**
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
