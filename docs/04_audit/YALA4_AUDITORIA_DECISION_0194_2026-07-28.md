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
