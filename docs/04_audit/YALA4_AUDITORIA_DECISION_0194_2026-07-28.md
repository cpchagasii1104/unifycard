# YALA 4 — AUDITORIA INDEPENDENTE DA DECISION-0194 (4ª rodada) — 2026-07-28

**Auditora:** YALA (independente, read-only) · **Base:** `rescue-structural @ ed5540795`
**Alvo:** `docs/02_decisions/DECISION_0194_BASE_DE_DISTRIBUICAO_POR_VENDEDOR.md` (D0–D6, D1.1–D1.3, D2, D3, D3.1/D3.1-BIS, D4, D5, D5.4) **+ a reescrita da D3.1 no topo do cartório** (`REMEDIATION_DT_LOG.md:1-14`), auditada como parte do corpo submetido.
**Método:** leitura integral do documento e do cartório (`:1-260`), leitura de 1ª mão do código real com `arquivo:linha`, **execução do motor real** (`calculatePolicySplits`, função pura, zero escrita, zero banco) para reproduzir a prova da direção e para um ataque que a direção não fez. Nenhum arquivo além deste parecer foi escrito. Nenhuma escrita em banco.

---

## 1. VEREDITO: **B — SELÁVEL APÓS CORREÇÕES NOMEADAS (§6)**

A doutrina central da 0194 sobreviveu a todos os ataques materiais que executei — inclusive o mecanismo da D3.1-BIS, que reproduzi e estendi **no motor real, por conta própria**. O que impede o selo não é a doutrina: é que **o documento se contradiz internamente sobre a sua própria pergunta de primeira ordem** (onde vive o custo operacional — Achado F1), carrega **resíduo não-expurgado da reescrita** que afirma e nega a existência do absorvedor na mesma seção (F2), e o topo do cartório contém uma afirmação falsa sobre o estado dos vereditos (F4). Todas as correções têm conteúdo **já decidido por Clayton** — nenhuma exige doutrina nova. Não é C: nada no texto atual move dinheiro na direção errada (a aritmética está certa, o mecanismo está provado, as colisões estão nomeadas). Não é A: um documento que afirma simultaneamente "o custo é linha dentro dos 100%" e "o custo é dedução pré-distributiva fora do split" não pode virar lei como está.

---

## 2. O QUE EU ATAQUEI E NÃO CONSEGUI DERRUBAR

Sem esta seção o parecer é inválido; eis as cicatrizes, com o resultado de cada ataque.

**AT-1 · Reproduzi a prova da direção no motor real — bateu exata.** Executei `calculatePolicySplits` real (import de `economic-policy-engine.service.ts`, função pura, sem banco) com a policy do exemplo da D3.1-BIS (absorvedora `revenue_share` bps=0 destino `platform_fees` + 3333 + 6667):
`total=100 → soma=100, absorvedora=1` · `7 → 7, 1` · `999 → 999, 1` · `12345 → 12345, 1` · e adicionei `10000 → 10000, absorvedora=0` (divisão exata). Os quatro números publicados pela direção (`REMEDIATION_DT_LOG.md:8`; decisão `:167-173`) **reproduzem exatos**. `PROVADO`.

**AT-2 · `assertPolicyLinesValid` aceita bps=0 — confirmado no código.** `economic-policy-write-validation.ts:173` rejeita apenas `bps < 0 || bps > 10000`; bps=0 conta como linha-bps (`:163`), soma 0 ao total (`:179`), e marca `hasRevenueShare` (`:189`). A policy do exemplo passa nas duas checagens (`:192-207`). `PROVADO`.

**AT-3 · O filtro de zero do caller vivo NÃO engole a absorvedora.** `service-payment-execution.service.ts:623` descarta `amountCents === 0` **depois** de o drift já ter sido absorvido dentro de `calculatePolicySplits` (`economic-policy-engine.service.ts:278-286`). Drift>0 → absorvedora sai com `amountCents = drift ≥ 1` e sobrevive; drift=0 → sai com 0 e é corretamente descartada (o Bank rejeita linha 0; coerente com 0178 D10). `PROVADO`.

**AT-4 · Ataquei a metade que a prova da direção NÃO cobriu: o DESTINO.** A prova da direção rodou o motor (valores); não provou onde o centavo **cai**. Se o resolver de destino roteasse por `lineType`, uma linha `revenue_share` iria para escrow e o D-money a liberaria para o **Actor** — o centavo iria para o vendedor, não para a conta de custo, e a D3.1-BIS estaria quebrada. **Não é o caso:** `resolveSplitDestinationFromPolicy` roteia por `destinationType` (`service-payment-execution.service.ts:113-152`); `destinationType='platform_fees'` → conta system `platform_fees`, `splitType='fee'`, `releaseToActorWallet=false` (`:137-152`), independentemente do `lineType`. A alegação "lineType e destinationType são campos independentes" (`:164`) é verdadeira **no caminho vivo**. E `platform_fees` está de fato em `SUPPORTED_DESTINATION_TYPES` (`:48-62`). `PROVADO`. (Ressalva por consumidor: F7.)

**AT-5 · Drift NEGATIVO com a absorvedora como única `revenue_share` — executei o ataque no motor real.** Policy: absorvedora bps=0 + linhas bps somando 10000 + linha `fixedAmountCents=50`. Resultado: **`CALCULATION_INVALID: split revenue_share resultou em amountCents negativo`** — lançou, não corrompeu (`economic-policy-engine.service.ts:292-297`). Fail-closed. **Nota a favor do mecanismo:** com uma `revenue_share` gorda no lugar da absorvedora, esse mesmo cenário é a forma (b) da 3ª auditoria — o prestador perde o valor fixo **em silêncio**. Com a absorvedora bps=0, a mesma corrupção vira **erro explícito**. O mecanismo é mais duro que o status quo contra essa forma publicável. Em policy só-bps, drift é sempre ≥ 0 (floor com soma 10000), então o caso negativo nem nasce. `PROVADO` (execução própria).

**AT-6 · `CORE_SPLIT_PAGAMENTO_CANONICO.md:94` — instância ou substituição?** A norma promulga "drift para `revenue_share[0]`". Sob a D3.1-BIS, a absorvedora **É** a `revenue_share[0]` da Etapa 2 (única `revenue_share` da policy) — a regra promulgada é usada **literalmente, sem emenda**. A versão anterior substituía ("quem entregou"); esta **instancia**. A norma permanece byte-intacta. `PROVADO`. (O resíduo retórico da "regra unificada" em `:186-190` é outra história — F2.)

**AT-7 · A aritmética da errata de D5 (A6) — refiz a conta.** Policy semeada verificada no código: 70/3/10/17, todas `appliesTo='gross_transaction'`, escopada a Curitiba (`seed-economic-policies-legacy-baseline.ts:214-243`; comissão = 3+10+17 = 30% do bruto). Pretendido: 10% da comissão = 0,10×0,30 = **3% do bruto**. Real: **10% do bruto**. 10/3 = **3,33× MAIOR** — a errata está correta. As reexpressões de `:136` (3/30=10%, 10/30=33,3%, 17/30=56,7%) conferem. Varredura própria por passagem invertida remanescente ("vezes menor"/"3× menor"): só as 2 ocorrências que **citam** o erro corrigido (decisão `:138`, cartório `:162`). Nenhuma passagem viva com sentido invertido. `PROVADO`.

**AT-8 · As citações factuais de D5.4 — conferi cada uma.** C-2: a citação de 0179 D10 é fiel (`DECISION_0179...md:184` "só entram no Bank: tax_reserve e ... commission_distributable ... permanecem fora até nova allowlist"; `:188` proíbe ampliação sem DECISION) e a allowlist está de fato vazia (`backend/src/modules/bank/fiscal-reserve-bank-composition.service.ts:17-19` — nota: o arquivo vive em `modules/bank/`, não em `fiscal-policy-composition/` como o caminho curto sugere). C-3: o agrupador existe onde citado (`fiscal-economic-policy-composition.service.ts:180` `positiveGroups`, `:222-229` agrupa e chama o motor por grupo). C-6: `assertLineShapeValid` aceita qualquer uma das 3 bases graváveis por linha (`economic-policy-write-validation.ts:223-231`). `PROVADO`.

**AT-9 · A afirmação-fundamento de D0: "o motor vivo não lê `applies_to`".** Confirmado: zero ocorrências de `appliesTo` em `economic-policy-engine.service.ts` (arquivo lido integralmente); o único caller monetário vivo chama o motor **direto**, sem passar pela composição (`service-payment-execution.service.ts:594-615`). E o perigo descrito em D0 `:22` é real no código: `assertPolicyLinesValid` soma bps de TODAS as linhas sem olhar `applies_to` (`:158-179`) — uma policy mista passa na escrita; e a composição, se um dia religada, agruparia por base e despejaria a fatia da outra base como "drift" na `revenue_share` do grupo (`fiscal-economic-policy-composition.service.ts:222-229` + motor `:278-286`). A arma carregada que D0 descreve **existe como descrita**. `PROVADO`.

**AT-10 · Suspeitei de erro de sintaxe no seed (um `\` no lugar de `//` na saída do grep) — verifiquei de 1ª mão e era artefato de renderização do grep.** `seed-economic-policies-legacy-baseline.ts:187` tem `// Escopada...` correto. Ataque retirado antes de virar acusação falsa. `REFUTADO` (auto-refutação registrada de propósito: é o erro que esta sessão já cometeu duas vezes).

---

## 3. ACHADOS

### 🔴 F1 — O DOCUMENTO SE CONTRADIZ SOBRE ONDE VIVE O CUSTO OPERACIONAL — E A EMENDA DE CLAYTON SEGUE NÃO APLICADA
- **Alegação:** a 0194 contém **três posições incompatíveis** sobre o custo operacional: (a) **D1.1** (`:43`: "entre as fatias que somam 100% obrigatoriamente existe uma linha de custo operacional"; `:54`: parágrafo inteiro justificando linha explícita contra dedução silenciosa) e **D3** (`:116`: Etapa 2 reparte "...reserva e custo do projeto/expansão") — custo é **linha dentro** dos 100% distribuíveis; (b) **D3.1-BIS** (`:179`: "o custo substantivo é dedução **pré-distributiva, fora do split**, protegido do voto. **Intacto.**") — custo sai **antes**; (c) a **emenda pendente de Clayton** (`REMEDIATION_DT_LOG.md:189-233`), que declara (a) *"errado, e perigoso"* (fatia dentro do bolo é fatia votável) e fixa a cascata `Receita → −imposto → −custo → excedente distribuível`. A emenda dizia *"entra assim que o parecer voltar"*; **dois pareceres voltaram** (2ª e 3ª auditorias), a 2ª auditoria acusou nominalmente a não-entrada (`:52`), a D3.1 foi reescrita — **e a emenda continua fora de D1.1/D3**. A D3.1-BIS cita a emenda como vigente enquanto os artigos que ela revoga permanecem intactos no mesmo documento.
- **Evidência:** decisão `:43,:54,:116,:179`; cartório `:52,:189-233`.
- **Grau:** `PROVADO`. **Gravidade:** 🔴 alta — é a pergunta de primeira ordem da decisão (o que forma a base × o que compõe o bolo), e as duas respostas convivem no texto. Um implementador pode citar D1.1 ou D3.1-BIS e ambos "estão na lei". É o mesmo gênero de defeito (duas verdades) que a casa define como o erro mais caro.

### 🔴 F2 — RESÍDUO DA REESCRITA: A MESMA SEÇÃO AFIRMA E NEGA A EXISTÊNCIA DO ABSORVEDOR
- **Alegação:** a D3.1-BIS afirma "**Custo institucional deste mecanismo: ZERO** — nenhum `line_type` novo" (`:176`) e "**FECHA O VEREDITO C-4 DE VERDADE** — a impossibilidade material foi removida" (`:182`). Porém, na MESMA seção: `:188` (regra unificada) manda a sobra da Etapa 2 para "a **linha de custo operacional**" — linha que, sob a própria BIS, **não existe** dentro do split (o absorvedor é `revenue_share` bps=0 com **destino** de custo, não linha de custo); e `:192` conclui "**o absorvedor da Etapa 2 não existe até lá**" (até criar `operational_cost` por DECISION) — **falso sob a BIS e falso no código**: o absorvedor existe hoje, foi aceito pela validação (AT-2) e calculado pelo motor (AT-1). `:188` e `:192` são sobras do mecanismo antigo que a reescrita substituiu sem expurgar.
- **Evidência:** decisão `:176,:182,:188,:192`; contraprova material em AT-1/AT-2/AT-4.
- **Grau:** `PROVADO`. **Gravidade:** 🔴 média-alta — a 2ª auditoria já reprovou exatamente o padrão "abre com 'Fecha C-4' e se desmente no fim" (`cartório :57-58`); a reescrita reproduziu o padrão em espelho (agora o fim nega o que o meio provou).

### 🟠 F3 — D5.4 C-3 ERRA O ALVO DO DESACORDO: NÃO É COM 0178 D8, É COM O CÓDIGO SELADO E COM A VALIDAÇÃO
- **Alegação:** C-3 declara D2 "em desacordo declarado com `fiscal-economic-policy-composition.service.ts` **e com 0178 D8**" (`:200`), ecoando a 2ª auditoria ("0178 D8 pressupõe seleção de base por linha"). Li 0178 D8 (`DECISION_0178...md:208`): a frase "as mesmas **três bases**" está numa lista de campos do **contexto** (mesmo id · mesmo snapshot fiscal · mesma jurisdição · mesmos tempos · mesmas três bases · mesma moeda · mesma calculation_version) e corresponde aos três VALORES do contrato (`grossTransactionCents`/`commissionGrossCents`/`commissionDistributableCents`, `:200-203`) — plural = os três valores viajam juntos no contexto, **não** "cada linha escolhe livremente e a policy pode misturar". A 0178 é **silente** sobre mistura intra-policy; D2 decide num espaço que a 0178 deixou aberto. O desacordo REAL de D2 é com (i) a **capacidade** multi-base do código selado (`fiscal-economic-policy-composition.service.ts:180,222-229`) e (ii) a ausência de trava de base única em `assertPolicyLinesValid` (`economic-policy-write-validation.ts:158-179`). Agravo interno: D6 `:209` diz "(DECISION-0178 permanece íntegra)" no mesmo documento em que C-3 declara desacordo "com 0178 D8" — as duas frases não podem ser ambas exatas.
- **Evidência:** `DECISION_0178...md:184-211`; decisão `:200,:209`; código citado acima.
- **Grau:** `PROVADO` (textual) para a leitura de D8; `FORTEMENTE INDICADO` para a consequência (risco de alguém "emendar" 0178 D8 sem necessidade). **Gravidade:** 🟠 média — afirmar desacordo com artigo selado que textualmente não existe é o erro simétrico ao da versão original (que negava o desacordo real). Conservador na direção, mas ainda inexato sobre norma selada.

### 🟠 F4 — (A2) O TOPO DO CARTÓRIO CONTÉM A AFIRMAÇÃO FALSA: OS VEREDITOS C-2/C-3/C-6 **FORAM** FECHADOS
- Resolução completa em §4. **Grau:** `PROVADO`. **Gravidade:** 🟠 média — o topo do cartório é a primeira leitura da próxima instância.

### 🟡 F5 — ALEGAÇÃO FACTUAL IMPRECISA EM D3.1: "TODA policy" NÃO EXIGE `revenue_share`
- **Alegação:** `:150` afirma "o writer selado exige que **toda** policy tenha ao menos uma linha `revenue_share` (`economic-policy-write-validation.ts:191-197`)". Duas imprecisões: (i) a exigência é **condicional** a existir linha com bps (`if (hasBpsLine)`, `:192`) — policy só de `fixedAmountCents` é publicável **sem** `revenue_share` (forma (a) da 3ª auditoria, `cartório :27`) e falharia só em runtime (`DRIFT_NO_REVENUE_SHARE`); (ii) a checagem está em `:200-206`, não `:191-197`. Para a Etapa 2 (bps), a premissa vale integralmente — a doutrina não cai; a frase factual, como escrita, é falsa.
- **Grau:** `PROVADO`. **Gravidade:** 🟡 baixa-média (herdada da redação da 1ª auditoria, mas agora é texto da decisão).

### 🟡 F6 — D1.2 SOBRE-ALEGA "JÁ ESTAVA DECIDIDO": 0166 D7 DEIXAVA A ESCOLHA ABERTA
- **Alegação:** D1.2 (`:56-76`) apresenta "o painel reparte `commission_distributable`" como já decidido "em dois lugares". A cascata de 0166 D7 sustenta a leitura, **mas** o mesmo D7 diz explicitamente: *"A base distribuível pode ser **comissão bruta ou comissão líquida**, conforme policy versionada — nunca implícita"* (`DECISION_0166...md:171-172`) — escolha deixada aberta; e a allowlist de 0179 D10 restringe "**no material 4e inicial**" (`:184`), não para sempre. A 0194 **fecha** legitimamente essa escolha (ela é uma decisão, e é exatamente a "policy explícita futura" de 0166 D1 `:73`); descrever o fechamento como mera verificação de coisa decidida é sobre-alegação leve.
- **Grau:** `PROVADO` (textual). **Gravidade:** 🟡 baixa.

### 🟡 F7 — (A7) A PROMESSA DE DESTINO DA D3.1-BIS É POR-CONSUMIDOR: O 2º CONSUMIDOR DO PE-3 IGNORA `destinationType`
- **Alegação:** `marketplace-fee-policy.ts:62-64` classifica splits por `lineType`: tudo que é `revenue_share` conta como parte do **actor** (net), o resto como fee. Uma policy com absorvedora `revenue_share` bps=0 resolvida sob `moduleContext='marketplace_payment'` teria o centavo do drift contado como **net do actor** naquele resolvedor — não como custo da plataforma. Não quebra a Etapa 2 (moduleContext distinto; esse consumidor calcula fee, não move dinheiro com destinos), mas a garantia da D3.1-BIS ("destino = conta de custo") vale **somente** no caminho PE-3/`service_execution`; a decisão não anota isso.
- **Grau:** `FORTEMENTE INDICADO` (código lido; cenário hipotético). **Gravidade:** 🟡 baixa.

### 🟡 F8 — (A7, ADJACENTE, FORA DA 0194) COMENTÁRIO MENTIROSO EM ARQUIVO DE VOCABULÁRIO DE DINHEIRO
- **Alegação:** `economic-policy.types.ts:108-112` afirma *"Resolver dinâmico ainda NÃO implementado (frente futura). PE-3 continua FAIL-CLOSED em regional_fund"* — **falso hoje**: o resolver existe e resolve 4 basis (`resolveRegionalFundDestination`, `service-payment-execution.service.ts:228+`; `regional_fund` em `SUPPORTED_DESTINATION_TYPES` desde DECISION-0051, `:54-61`); o fail-closed restante é só para os 3 basis sem fonte material. O arquivo NÃO é byte-pinado (foi editado na frente F-REGIONAL-BASIS) e a casa obriga corrigir comentário que mente. Não é defeito da 0194; é achado de carona, no arquivo que a 0194 cita.
- **Grau:** `FORTEMENTE INDICADO` (li o docblock e o resolver; não descartei um sentido residual de "dinâmico" que eu não tenha visto). **Gravidade:** 🟡 baixa-média.

---

## 4. A2 RESOLVIDO — QUAL AFIRMAÇÃO DO CARTÓRIO É A FALSA

**A falsa é `REMEDIATION_DT_LOG.md:13`** ("os demais vereditos (C-2 allowlist vazia, C-3 colisão multi-base, C-6 livre escolha de `applies_to` viva) **permanecem abertos**").

Li o texto atual da decisão: **D5.4 contém as três correções que a 1ª auditoria exigiu** — C-2 nomeia 0179 D10 e declara plataforma-vendedora/Etapa 1 fora da allowlist vigente (`:198`, citação fiel a `0179:184,188`, allowlist vazia confirmada em `fiscal-reserve-bank-composition.service.ts:17-19`); C-3 declara o desacordo de D2 com o código agrupador e difere seu destino (`:200`); C-6 declara o risco de D4 como **atual**, com o `<select>` vivo e Clayton com acesso real (`:202`). A 2ª auditoria — independente — verificou e escreveu "C-2/C-3/C-6 da 0194 **fecharam com precisão**" (`:69`). Os vereditos eram defeitos **do texto**; o texto os fechou.

O que a linha `:13` provavelmente quis dizer — e é verdade — é que as **condições materiais subjacentes** seguem abertas: allowlist vazia, agrupador multi-base vivo, select de `applies_to` livre. Mas não foi o que escreveu: escreveu que os **vereditos** permanecem abertos, o que é falso, e o efeito é concreto — a próxima instância, lendo o topo com memória zero, concluiria que a 0194 ainda carece dessas três correções e as refaria (ou pior, as refaria diferente). Ressalva de precisão: o erro está na direção **conservadora** (subdeclara progresso, não sobredeclara), o que reduz o dano; não o elimina. (Correção nº 4.)

---

## 5. A1 RESOLVIDO — HÁ OU NÃO COLISÃO COM A 0178 SELADA

**Não há colisão normativa. Mas o texto da 0194 declara uma que não existe, no artigo errado — e é isso que precisa de correção (F3).**

Ataquei o raciocínio da direção nos três pontos, conforme mandado:

- **(i) "D8 fala do contexto, não de permissão de mistura" — SUSTENTA-SE.** `0178 D8 :208` lista propriedades do `EconomicPolicyEvaluationContext`; "as mesmas **três** bases" são os três valores `grossTransactionCents`/`commissionGrossCents`/`commissionDistributableCents` do contrato (`:200-203`). Gramática e contexto da lista são inequívocos: uniformidade do contexto, não direito de mistura. Se D8 quisesse impor OU permitir base por linha divergente, diria "a mesma base" (singular, proibindo) ou o diria expressamente (permitindo). Não diz nenhum dos dois.
- **(ii) "agrupador é capacidade, não permissão" — SUSTENTA-SE, com uma precisão.** Com policy de base única, `positiveGroups` tem 1 grupo e o código selado se comporta byte-identicamente (`fiscal-economic-policy-composition.service.ts:222-229` — a chave é `${base}:${cents}`; base única ⇒ chave única). D2 não exige tocar o código selado nem o guard. **Precisão:** a capacidade multi-base não é acidente — o cartório da própria sessão registra "multi-base já é o desenho previsto" (`:248`) — logo há **intenção de desenho** contrariada. Mas intenção de desenho não é norma promulgada nesta casa (hierarquia: DECISIONs > código), e nenhum artigo da 0178 promulga o direito de misturar. D2 decide num espaço **silente** da 0178. Isso é o oposto do defeito da 0192 D5 (que revertia texto RATIFICADO de 0166 D8 sem nomear): aqui não há texto selado revertido, e a tensão com o código está **declarada** no próprio documento (D5.4 C-3), com destino diferido. Não é emenda vestida — é restrição declarada em espaço não decidido.
- **(iii) "a 0194 se declara subordinada" — VERDADEIRO** (`:5`), e reforçado por D6 `:208-209`.

**Porém**: a própria 0194 escreve que D2 "está em desacordo declarado ... **com 0178 D8**" (`:200`) — concessão que a minha leitura textual de D8 não sustenta (é a leitura da 2ª auditoria, incorporada sem re-verificação). O documento não pode simultaneamente estar certo em (i) e em C-3 como redigido; e D6 `:209` ("0178 permanece íntegra") tensiona com C-3 na mesma página. O desacordo real é com o **código selado** (capacidade) e com a **validação** (que não trava base única — `economic-policy-write-validation.ts:158-179`). Correção nº 3 renomeia o alvo. Com ela, a resposta final de A1 é: **sem colisão com a 0178; com capacidade selada que fica dormente sob D2, destino declarado e diferido — legítimo.**

---

## 6. CORREÇÕES EXIGIDAS (condição do selo; todas docs-only; conteúdo já decidido, nada a redecidir)

1. **Aplicar a emenda pendente de Clayton (cartório `:189-233`) ao documento — F1.** (a) Reescrever **D1.1**: custo operacional sai **ANTES** da distribuição (junto de imposto e adquirente), **não-votável e VISÍVEL**, com a contrapartida obrigatória declarado×realizado (o excesso retorna ao excedente) e a nota de dependência material da frente de resultado (`cartório :233`); preservar como história a redação anterior com a retratação, no padrão já usado em D3.1/D3.1-BIS. (b) Em **D3** `:116`, remover "custo do projeto/expansão" da lista de fatias da Etapa 2 (ou reclassificar expressamente como dedução pré-distributiva que **não** é linha de policy). (c) Em **D1.2**, atualizar a cascata para incluir `− custo operacional` antes do distribuível, citando a emenda.
2. **Expurgar o resíduo da reescrita — F2.** (a) `:186-190`: reescrever a "regra unificada" sem a expressão "linha de custo operacional" — a sobra da Etapa 2 vai para "a linha absorvedora `revenue_share` bps=0 cujo destino é a conta de custo" (e, idealmente, rebaixar a "regra unificada" a glosa não-normativa: a regra promulgada é `CORE:94`, e basta). (b) `:192`: reescrever a lacuna C-5 — sob a emenda não existe linha de custo dentro do split, logo `operational_cost` deixa de ser pré-requisito de coisa alguma desta decisão; **remover** "o absorvedor da Etapa 2 não existe até lá" (falso: existe, provado em AT-1/AT-2/AT-4).
3. **Corrigir o alvo do desacordo em D5.4 C-3 — F3.** O desacordo de D2 é com a capacidade multi-base do código selado (`fiscal-economic-policy-composition.service.ts:180,222-229`) e com a ausência de trava de base única em `assertPolicyLinesValid` (`economic-policy-write-validation.ts:158-179`) — **não** com o texto de 0178 D8 (`:208`), que lista campos do contexto. Harmonizar com D6 `:209`. Manter diferido o destino do agrupador (correto como está).
4. **Corrigir `REMEDIATION_DT_LOG.md:13` — F4.** Os vereditos textuais C-2/C-3/C-6 **foram fechados** por D5.4 (2ª auditoria confirmou, `:69`; este parecer re-confirmou); o que permanece aberto são as **condições materiais** (allowlist vazia · agrupador multi-base vivo · select de `applies_to` livre), que a decisão difere por desenho.
5. **Precisar `:150` — F5.** A exigência de `revenue_share` é condicional a existir linha bps (`economic-policy-write-validation.ts:192,200-206`); para a Etapa 2 (bps) aplica-se integralmente; policy só-fixed escapa da trava de escrita e falha só em runtime.
6. **Precisar D1.2 — F6.** Registrar que 0166 D7 deixava "comissão bruta ou líquida" como escolha versionada em aberto (`0166:171-172`) e que **esta decisão a fecha** em `commission_distributable` (em harmonia com a cascata D7, 0179 e a allowlist D10) — em vez de "já estava decidido".
7. **(Recomendações, não-bloqueantes do selo, fora do corpo da 0194)** — F7: anotar na D3.1-BIS que a garantia de destino vale no caminho PE-3/`service_execution`; `marketplace-fee-policy.ts:62-64` classifica por `lineType` e contaria o centavo como net do actor. F8: corrigir o comentário desatualizado de `economic-policy.types.ts:108-112` (obrigação da casa sobre comentário que mente; arquivo não-pinado).

---

## 7. NÃO AUDITADO (declarado)

- **Estado do banco `unificard_dev`** — não executei nenhum SELECT; allowlist, seed e policies verificados por **código**, não por dado vivo. A afirmação de D1.3 "0 perfis fiscais, 0 regras fiscais" fica `NÃO AUDITADO` (aceita pelo registro da direção).
- **Runner de guards** — não rodei `validate:regression-guards`; contagens (225 etc.) aceitas do cartório, `NÃO AUDITADO`.
- **Byte-pins** — não recomputei os sha256; a 2ª auditoria recomputou (`:69`); só li os arquivos pinados, jamais editei.
- **Corpo integral de `resolveRegionalFundDestination`** (`service-payment-execution.service.ts:228+`) — li docblock e entrada; o interior do resolver regional não era necessário aos ataques.
- **DECISION-0192 e 0193** — fora do alvo; li apenas o que a 0194 e o cartório citam delas.
- **DECISION-0165, Artigo V/XI da Constituição, `CONTRATO_GRUPOS_V2`** — li as citações, não os documentos integrais.
- **GOs verbais de Clayton** (confirmação da rota do custo, `:184`) — inverificáveis por natureza; aceitos pelo registro do cartório, `NÃO AUDITADO`.
- **A prova E2E/HTTP da validação** (400/201 do publish) — aceita do cartório (`:93`); meu teste cobriu a função de validação e o motor, não a rota HTTP.

---

## 8. NOTA DE MÉTODO

Este parecer executou código real uma única vez, em função pura (`calculatePolicySplits`), com script em diretório temporário **fora do repositório**, zero conexão a banco (a mensagem "DATABASE_URL não está definida" na saída confirma que nenhuma conexão foi feita), zero escrita além deste arquivo. O único arquivo criado no repositório é este parecer. Nenhum documento de `docs/01_normative/` ou `docs/02_decisions/` foi tocado.

**VEREDITO FINAL: B — selável após as correções 1–6 (a 7 é recomendação). A doutrina resistiu; o documento, ainda não.**

---
---

# APÊNDICE — PASSE DE CONFIRMAÇÃO (RODADA 2, 2026-07-28, sobre `4edc91b09`)

**Escopo:** verificar se as 7 correções do §6 entraram corretamente. Não é auditoria nova; defeito NOVO introduzido pela correção é reportado (regra de sempre). Nada acima desta linha foi alterado.

## A. INTEGRIDADE DO PROCESSO (verificado antes de tudo)

- **Este parecer não foi editado pela direção:** `git diff 4edc91b09 -- <este arquivo>` = 0 linhas; as "133 inserções" do commit são a **criação** do arquivo (estava untracked). O texto committado contém o meu veredito literal. `PROVADO`.
- **Nenhum arquivo byte-pinado tocado:** o commit altera exatamente 4 arquivos (cartório · `economic-policy.types.ts` · a decisão · este parecer) — nenhum deles é `F.ENGINE`/`F.SPE`/`F.GUARD_BCITY`. E **reexecutei eu mesma** `audit-fiscal-economic-policy-composition.mjs`: **EXIT 0**, com os 3 sha256 de `BYTE_INTACT` (`:149-162`) **recomputados e batendo** ("3 arquivos B-CITY byte-intactos"). `economic-policy.types.ts` **não está** em `BYTE_INTACT` (`:159-161` — só engine/SPE/guard-bcity). `PROVADO` (por execução, não por alegação da direção).
- **O guard lexicamente frágil também reexecutado por mim:** `audit-regional-fund-resolvable-basis-declaration.mjs` → **EXIT 0**, 15/15 OK, extração lexical do resolver batendo com as constantes declaradas. A edição do comentário F8 não o quebrou. `PROVADO`.

## B. CONFIRMAÇÃO CORREÇÃO A CORREÇÃO

1. **CONFIRMADA (com 2 defeitos novos — ver §C).** D1.1 reescrita: pré-distributiva/não-votável/visível com cascata (`:44-50`), retratação preservada e não apagada (`:61-67`), precedente legal (`:69`), anticorpo declarado×realizado (`:71-77`), 4 requisitos de publicação (`:79`), manutenção≠expansão (`:81`). D3: custo/expansão fora da lista da Etapa 2, com a razão dupla — dupla contagem + retorno ao voto (`:150`). Cascata de D1.2 atualizada (`:97`) — **mas a atualização introduziu ND-1 (§C)**.
2. **CONFIRMADA.** Regra unificada rebaixada a glosa explicitamente não-normativa (`:224-226`: "a regra normativa é UMA, e não é desta decisão — `CORE:94`"; glosa marcada "descrição do efeito, não regra autônoma; resíduo expurgado"). C-5 declarado **RESOLVIDO** (`:232`): "o absorvedor da Etapa 2 não existe até lá" **saiu**; ambas as afirmações antigas retratadas; `custom` segue proibido.
3. **CONFIRMADA.** C-3 com alvo renomeado (`:242-248`): "textualmente falso" contra 0178 D8; desacordo real = capacidade do código selado (`fiscal-economic-policy-composition.service.ts:180,222-229`) + ausência de trava em `assertPolicyLinesValid` (`economic-policy-write-validation.ts:158-179`); harmonização explícita com D6 (`:248` "não se contradizem"). Título mudou de "PROÍBE O QUE CÓDIGO SELADO IMPLEMENTA" para "RESTRINGE O QUE CÓDIGO SELADO TORNA POSSÍVEL" — fiel ao meu §5.
4. **CONFIRMADA.** A linha falsa do cartório foi corrigida **no lugar** (`REMEDIATION_DT_LOG.md:50`): vereditos textuais fechados em D5.4; o que permanece aberto são as condições materiais (allowlist vazia · agrupador vivo · select livre), nomeadas uma a uma; o caráter conservador do erro e o dano à próxima instância registrados.
5. **CONFIRMADA.** `:184-186`: exigência condicional a `hasBpsLine` (`economic-policy-write-validation.ts:192`), checagem em `:200-206`, escape da policy só-`fixedAmountCents` documentado como buraco da validação, "registrado como achado e não remediado por esta decisão".
6. **CONFIRMADA.** `:108-110`: cita verbatim 0166 D7 `:171-172` ("bruta ou líquida... conforme policy versionada"), declara que a escolha estava **em aberto** e que **esta decisão a fecha**, exercendo a "policy explícita futura" de 0166 D1. A sobre-alegação saiu. *(O fecho de `:110` participa de ND-1 — ver §C.)*
7. **CONFIRMADA.** F7 anotado na D3.1-BIS (`:230` — garantia por-consumidor, `marketplace-fee-policy.ts:62-64` nomeado, "verificar, não presumir"). F8 corrigido em `economic-policy.types.ts:111-121` — a redação antiga preservada como registro do que mentia, a verdade nova com `arquivo:linha` corretos (`resolveRegionalFundDestination` em `:228`, chamado em `:201-202`; fail-closed **parcial**), e aponta para as constantes policiadas. Verifiquei as referências contra o código: exatas.

## C. DEFEITOS NOVOS INTRODUZIDOS/DEIXADOS PELO PASSE DE CORREÇÃO

### 🔴 ND-1 — A CASCATA NOVA DE D1.2 REDEFINE SILENCIOSAMENTE VOCABULÁRIO SELADO (0179/0178)
- **Alegação:** a inserção de "→ custo operacional (D1.1 — não-votável, visível)" **antes** de "comissão DISTRIBUÍVEL" na cascata de D1.2 (`:97-98`) implica `commission_distributable = commission_gross − tax_reserve − custo_operacional`. Isso colide com **duas normas seladas**, uma delas citada **duas linhas abaixo no próprio documento**: a equação vinculante da 0179, `commission_gross = tax_reserve + commission_distributable` (quotada em `:101`), e a definição da 0178 D4 (`DECISION_0178...md:134`: `commission_distributable = commission_gross − tax_reserve`, "derivada **exclusivamente** do resultado fiscal 4d-1"). As duas não sobrevivem a um `custo_op > 0` deduzido naquela posição. O fecho de `:110` consuma a redefinição: o painel reparte `commission_distributable`, "o que sobra depois de pagar ... o Fisco **e o custo de operar**" — o termo selado passa a incluir uma dedução que sua definição selada não contém. Agravos: (i) o bloco é apresentado sob "**DECISION-0166 D7** fixa a cascata do valor" (`:91`) e agora contém uma linha que 0166 D7 **não tem** (mitigado, não sanado, pelo marcador inline "(D1.1)"); (ii) a cascata de D1.1 (`:49`) chama o valor pós-custo de "**EXCEDENTE DISTRIBUÍVEL**" e a de D1.2 o chama de "comissão DISTRIBUÍVEL" — dois nomes para o mesmo bolo, um deles selado com outro significado.
- **Paternidade registrada sem atenuação:** a minha correção nº 1(c) pediu "atualizar a cascata para incluir − custo operacional **antes do distribuível**" — redação ambígua que induziu a colocação literal. O defeito é real independentemente da paternidade; a auditora o assina como parcialmente seu.
- **Grau:** `PROVADO` (textual, contra as duas normas seladas lidas de 1ª mão). **Gravidade:** 🔴 média-alta — redefinição silenciosa de termo selado em documento que decide "de que número se tira a porcentagem"; docs-only, nada vivo afetado hoje.
- **Correção C-8 (nomeada, acionável):** preservar `commission_distributable` com a definição selada (0179/0178 D4) e nomear o valor pós-custo com o nome que a emenda já deu — **excedente distribuível**: cascata `... → reserva/obrigação fiscal → comissão DISTRIBUÍVEL (0179) → − custo operacional (D1.1) → EXCEDENTE DISTRIBUÍVEL ← é ISTO que o painel reparte`; ajustar `:110` ("o painel reparte o excedente distribuível = `commission_distributable` − custo operacional; enquanto a dependência material de D1.1 não permitir declarar custo, os dois coincidem") e restaurar a fidelidade da citação de 0166 D7 (o que é de D7 fica como D7; a extensão é desta decisão e se declara como tal). Alternativa igualmente válida se Clayton restringir o custo pré-distributivo ao caso plataforma-vendedora: remover a linha da cascata de comissão. **Escolher entre as duas é doutrina; qualquer uma sana o defeito.**

### 🔴 ND-2 — SOBRA PRÉ-EMENDA NO ARTIGO D1: "LINHA EXPLÍCITA DENTRO DA DISTRIBUIÇÃO"
- **Alegação:** D1 (`:32`) ainda diz "esse custo é uma **linha explícita dentro da distribuição** (D1.1)" — a formulação **revogada**, citando D1.1 para o exato oposto do que D1.1 agora fixa (`:44` "sai ANTES da distribuição... forma a base"). Mesmo gênero dos meus F1/F2: o passe corrigiu a seção e esqueceu a referência no artigo governante.
- **Grau:** `PROVADO`. **Gravidade:** 🔴 média (uma linha, mas em D1 — o artigo-regra).
- **Correção C-9:** reescrever o trecho de `:32` para "esse custo sai **antes**, como dedução pré-distributiva visível (D1.1)".

### 🟡 ND-3 — MESMA FAMÍLIA, MENOR: D3 "A ETAPA 2 OPERA SOBRE O BRUTO"
- **Alegação:** `:152` mantém "a Etapa 2 opera sobre o bruto" no caso plataforma-vendedora; sob a D1.1 emendada, opera sobre o bruto **após** as deduções pré-distributivas (adquirente, imposto, custo) — o excedente.
- **Grau:** `PROVADO` (textual). **Gravidade:** 🟡 baixa. **Correção C-10:** acrescentar "após as deduções pré-distributivas de D1.1" (ou "sobre o excedente de D1.1").

## D. RESPOSTA AOS DOIS ATAQUES EXIGIDOS (a dependência material de D1.1, `:83-85`)

**(a) É fiel à emenda de Clayton, com uma precisão de paternidade que registro.** Metade do acréscimo **fui eu que pedi** — a correção nº 1(a) exigia "a nota de dependência material da frente de resultado (`cartório :233`)". O que vai além do pedido é a cláusula operativa *"enquanto a frente de resultado não existir, nenhum custo pré-distributivo pode ser declarado não-votável"*. Verifiquei sua derivação contra o registro: o anticorpo da própria emenda diz *"a proteção **só é legítima** acompanhada de reconciliação publicada"* (`cartório :209`) e a consequência de arquitetura diz *"reconciliar declarado×realizado é **impossível** sem apuração... não pode ser cumprida só com policy"* (`:233`). Proteção legítima só com reconciliação + reconciliação impossível hoje ⇒ proteção não-declarável hoje. É **modus tollens do texto registrado de Clayton**, não trava inventada — e falha fechada na direção certa (contra custo não-votável sem prestação de contas, nunca contra a comunidade). `PROVADO` (derivação textual).

**(b) NÃO esvazia a D1.1 — é o contrário do defeito A5.** O teste de A5 é: a decisão deixa **o núcleo** sem decidir enquanto se apresenta como decidida? Aqui o núcleo **está** decidido (custo é pré-distributivo, não-votável, visível, com anticorpo como **condição de legitimidade**); o que fica gateado é a **ativação material**, com pré-condição nomeada (frente de resultado, GATE/GO próprios) — o padrão de faseamento desta casa (4e dormente, B-CITY-2 bloqueada, N1 dormente). Sem a cláusula, a seção leria como descrição do presente sendo prescrição do futuro — o defeito **A4** que meu mandato original mandava caçar; a cláusula é o que o evita. E o custo de interinidade é zero **hoje**: nada distribui (zero policy ativa, allowlist vazia, 4 bloqueios independentes da 3ª auditoria), logo não existe janela em que um voto pudesse matar um custo ainda não-declarável. **A correção nº 1 fica de pé quanto a este ponto** — ela cai apenas em ND-1/ND-2, que são outra coisa.

## E. VEREDITO DO PASSE

**AINDA NÃO SELÁVEL.** As 7 correções entraram e 6 delas entraram **bem**; a nº 1 entrou com um efeito colateral que redefine termo selado (ND-1) e deixou uma sobra no artigo D1 (ND-2). Faltam, numeradas e acionáveis: **C-8** (cascata/nomenclatura do excedente — preservar a equação selada da 0179 e a definição da 0178 D4), **C-9** (D1 `:32`), **C-10** (D3 `:152`, menor). Nenhuma exige doutrina nova além da escolha binária declarada em C-8 — e a formulação mínima (nomear "excedente distribuível", nome que a emenda já usa) resolve sem redecidir nada. Após C-8/C-9/C-10, **não resta impedimento meu ao selo**.

## F. NÃO VERIFICADO NESTE PASSE

- **Runner completo** (`validate:regression-guards`, 225) e **typecheck** — não reexecutei; rodei apenas os 2 guards que leem o arquivo editado. A alegação "runner 225 OK / drift 0" da direção fica `NÃO AUDITADO`.
- **Estado de banco** — nenhum SELECT, como antes.
- **GOs de Clayton** (para auditoria e correção) — aceitos do cartório, inverificáveis por natureza.
- **O restante do repositório** por outros efeitos do commit — conferi os 4 arquivos do stat; não varri além deles.

**VEREDITO DO PASSE: AINDA NÃO — C-8, C-9, C-10. O resto está confirmado, por leitura e por execução.**

---
---

# APÊNDICE 2 — PASSE FINAL (RODADA 3, 2026-07-28, sobre `81de891ba`)

**Escopo estrito:** C-8, C-9, C-10 — mais a caça a defeito novo e a varredura de resíduo refeita por conceito, com critérios meus. Nada acima desta linha foi alterado.

## A. INTEGRIDADE (verificada, não presumida)

- Commit `81de891ba` toca **3 arquivos, todos docs** (cartório · decisão · este parecer) — nenhum código, nenhum pinado. O acréscimo a este parecer é o **meu Apêndice 1**, committado sem edição (`git diff 81de891ba -- <este arquivo>` = 0 linhas). `PROVADO`.
- `git diff --check` limpo. `PROVADO`.
- **"Excedente distribuível" NÃO foi fiado em código nem promovido a conceito de SSOT:** grep por `excedente` em `backend/src`, `frontend/src` e `packages` devolve apenas usos **pré-existentes e sem relação** (`asset.types.ts:34`, entrada de assets em `governed-vocabularies.manifest.ts:248`, `fiscal-identity-economic-activity.service.ts:46`, rentals). Nenhum campo novo, nenhum manifesto tocado (o commit é docs-only). O termo vive só na decisão e no cartório, como vocabulário da emenda de Clayton. `PROVADO`.
- Runner completo e typecheck: **não reexecutei** — o commit é docs-only e não pode afetar guard de código, mas a alegação "225 OK / drift 0" da direção segue como alegação. `NÃO AUDITADO`.

## B. AS TRÊS CORREÇÕES

- **C-8 — CONFIRMADA.** Cascata de D1.2 (`:92-100`): `… → comissão DISTRIBUÍVEL (0179: equação verbatim) → − custo operacional (D1.1) → = EXCEDENTE DISTRIBUÍVEL ← é ISTO que o painel reparte` — a equação selada preservada na letra, o custo deduzido **depois** dela, o excedente com o nome da emenda. Bloco `:102` nomeia o defeito contra a direção e declara `commission_distributable` **não redefinido**; `:115` declara o fechamento da escolha de D7 como **ato desta decisão**; `:117` fixa "o painel reparte o EXCEDENTE DISTRIBUÍVEL" e "não é sinônimo". A ressalva `:104` ("NÃO DECIDIDO AQUI: qual valor chega ao motor... não fia campo nenhum... não deve presumir a equivalência") é **suficiente** — nomeia a lacuna, atribui a fase (4e, GATE/GO) e proíbe a presunção. *Observação não-bloqueante:* o fence de `:92-100` ainda é introduzido por "`DECISION-0166 D7` fixa a cascata" (`:91`) contendo duas linhas que não são de D7 — cada uma **etiquetada** com a fonte real e desambiguada por `:102`/`:115`, logo nenhuma afirmação falsa resta; forma ideal seria "fixa a cascata (estendida abaixo por esta decisão, linhas marcadas)". Recomendação, não exigência.
- **C-9 — CONFIRMADA.** `D1:32`: "sai ANTES da distribuição, como dedução pré-distributiva não-votável e visível (D1.1) — nunca como fatia dentro do que se reparte". Cita D1.1 para o que D1.1 agora diz.
- **C-10 — CONFIRMADA.** `D3:159`: "opera sobre o bruto **após as deduções pré-distributivas de D1.1** (imposto, taxa de adquirente e custo operacional) — nunca sobre o bruto cru".

## C. A VIA (i) SEM CONSULTAR CLAYTON — JULGAMENTO EXPLÍCITO, PORQUE FOI PEDIDO

**Concordo: era determinado pela norma, não escolha da direção.** A via (ii) (restringir o custo pré-distributivo ao caso plataforma-vendedora) **estreitaria o alcance da emenda de Clayton**, cujas palavras são gerais (*"o custo operacional do sistema precisa manter ele vivo"*) e cuja cascata registrada não distingue caso — **isso sim** seria a direção decidindo doutrina. A via (i) não decide nada novo: preserva a equação selada da 0179 (que não admite segunda definição), preserva o alcance integral da emenda, e usa o **vocabulário do próprio Clayton** ("EXCEDENTE DISTRIBUÍVEL", cartório `:201`). Interseção de duas normas vigentes com um único ponto — executá-la é obediência, não deliberação. `PROVADO` (textual).

## D. VARREDURA DE RESÍDUO REFEITA POR CONTA PRÓPRIA (por conceito: *quem reparte o quê* · *sobre o bruto* · *dentro de/fatia* · *distribuível/excedente*)

Varri todas as ocorrências do conceito no documento: `:49` ✓ · `:57` ✓ · `:63-67` (retratação, histórica) ✓ · `:75` ✓ · `:92-100` ✓ · `:104` ✓ · `:110` ("bolo distribuível" genérico) ✓ · `:113-115` ✓ · `:117` ✓ · `:123` ("o que se reparte é excedente") ✓ · `:157` ✓ · `:159` ✓ · `:161` (cita a ordem de D7 sem inserção) ✓ · `:233`/`:239` ✓ · `:245` (quote de 0179 D10) ✓. **Uma sobreviveu à varredura da direção:**

### 🔴 ND-4 — `D1.3:135` AINDA DIZ "O PAINEL DE PERCENTUAIS REPARTE `commission_distributable`"
- **Alegação:** a frase de fechamento de D1.3 (`:135` — "O painel de percentuais reparte `commission_distributable`, e todo número que Clayton configurar lá mede lucro") contradiz frontalmente o `:117` novo ("o painel reparte o **EXCEDENTE DISTRIBUÍVEL** ... `commission_distributable` ... **não é sinônimo** de excedente"). Mesmo verbo, mesmo sujeito, objetos distintos, no mesmo documento — **exatamente a segunda verdade que C-8 existe para matar**, recriada 18 linhas abaixo da cura. É resíduo estale, não intenção: a própria D1.3 diz o certo em `:123`. E enquanto `:135` viver, a ressalva `:104` não basta — um implementador citando `:135` fiaria o painel em `commission_distributable` com respaldo textual.
- **Grau:** `PROVADO`. **Gravidade:** 🔴 média — uma linha, mas é a repetição do gênero ND-1/ND-2 no terceiro passe consecutivo.
- **Correção C-11 (uma linha):** reescrever `:135` para "O painel de percentuais reparte o **excedente distribuível** (D1.2); `commission_distributable` segue sendo o valor selado da 0179 do qual ele deriva — e todo número que Clayton configurar mede **lucro**."

**Nenhum outro defeito novo encontrado em C-8/C-9/C-10.** C-9 e C-10 são limpas; o bloco C-8 em si é limpo (afora a observação não-bloqueante do §B).

## E. VEREDITO DO PASSE FINAL

**AINDA NÃO SELÁVEL — por UMA linha: C-11 (`D1.3:135`).** Digo com todas as letras, como pedido: as três correções entraram e entraram **bem**; a via (i) era a única legal; o vocabulário novo não vazou para código nem virou SSOT; a ressalva de não-equivalência é suficiente **depois** de C-11. Mas esta casa acabou de registrar, no mesmo cartório, que "varredura de resíduo deve buscar o conceito, não a string" — e o conceito ainda tem uma ocorrência com o sentido velho, no fecho de uma seção governante. Selar com ela viva seria selar com verificação pela metade pela terceira vez. **Aplicada e confirmada C-11 — que é um diff de uma linha — não resta nenhum impedimento meu ao selo. A decisão, no mérito, está pronta; Clayton sela.**

## F. NÃO VERIFICADO NESTE PASSE

- Runner completo (225) e typecheck — commit docs-only, mas não reexecutei; alegação segue alegação.
- Estado de banco — zero SELECT, como nas rodadas anteriores.
- GOs de Clayton — aceitos do cartório.
- Fora do documento da decisão, do cartório (topo) e do grep de `excedente`, não varri o repositório por outros efeitos.

**VEREDITO: AINDA NÃO — somente C-11. Após C-11, selável, sem ressalvas minhas.**
