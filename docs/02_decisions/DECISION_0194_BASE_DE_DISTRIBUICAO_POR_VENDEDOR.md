# DECISION-0194 — BASE DA DISTRIBUIÇÃO É DETERMINADA POR QUEM VENDE (e nunca se mistura)

**Data:** 2026-07-27 · **Status:** ✅ **SELADA por Clayton em 2026-07-28** — auditoria independente adversarial (4 rodadas, modelo diferente da direção) declarou **SELÁVEL**; o selo é ato de Clayton, não da direção. **É AUTORIDADE CITÁVEL a partir desta data.**
**Histórico de pareceres:** 1ª (2026-07-27) = **C** · 2ª (2026-07-28) = **C, "piorou"** · 3ª (2026-07-28, código e estado) = derrubou 2 selos da direção · 4ª (2026-07-28, adversarial) = **B** → 7 correções → **ND-1/2/3** (defeitos introduzidos pela própria direção ao corrigir, um deles redefinindo termo selado) → C-8/9/10 → **ND-4** → C-11 → **SELÁVEL**. Parecer + 3 apêndices em `docs/04_audit/YALA4_AUDITORIA_DECISION_0194_2026-07-28.md`.

> ### ⚠️ O QUE ESTE SELO **NÃO** DIZ — leia antes de citar
> **Selar esta decisão tornou a DOUTRINA autoridade. NÃO significa que o sistema se comporta assim.** A decisão difere a materialização **por desenho próprio**, e as condições materiais seguem **ABERTAS**:
> - **D2 (base única)** é regra — e `assertPolicyLinesValid` **não tem trava de base única** (`economic-policy-write-validation.ts:158-179`).
> - **D4 (`applies_to` derivado do servidor)** é regra — e o motor **ignora o campo por completo** (zero ocorrências em `economic-policy-engine.service.ts`); o painel segue com `<select>` livre.
> - A **allowlist do Bank está VAZIA** (`fiscal-reserve-bank-composition.service.ts:17`) e o **agrupador multi-base segue vivo** (`fiscal-economic-policy-composition.service.ts:180,222-229`).
> - O gatilho **`GO RETOMAR MATERIAL FISCAL-4E` NÃO foi emitido** por este selo. Selar doutrina **não abre** fase material.
>
> **Quem ler "SELADA" e presumir conformidade do código estará repetindo o erro dos dois selos falsos de 2026-07-28.** A lei existe; a fiação, não. Cada item acima exige GATE e GO próprios.
**Modo:** DOCS-ONLY · ZERO CÓDIGO/MIGRATION/GUARD/BANCO · não abre PORTA-1 · **não emite o gatilho `GO RETOMAR MATERIAL FISCAL-4E`**.
**Deriva de / subordinada a:** [[DECISION-0166]] **D1** (base = comissão UnifiCard, *"salvo policy explícita futura"* — esta decisão É essa policy explícita) · [[DECISION-0165]] D1 · [[DECISION-0178]] (vocabulário `applies_to`: `gross_transaction` · `commission_gross` · `commission_distributable`) · [[DECISION-0192]] (sujeito territorial) · Lei 5 · Artigo V.
**Origem:** decisão soberana direta de Clayton, 2026-07-27, em resposta à pergunta doutrinária devolvida pelo STOP da executora (registrado no cartório em `874ac3a08`).

---

## 0. NATUREZA E LIMITE

Docs-only. NÃO altera código, migration, guard ou runtime. **NÃO autoriza religar caller monetário** — a fase 4e permanece represada sob o gatilho literal `GO RETOMAR MATERIAL FISCAL-4E`, **não emitido aqui**. Esta decisão responde à **pergunta de doutrina** que precede aquele gatilho; não o substitui.

---

## D0 — O PROBLEMA: "10% DE QUÊ?"

Numa venda de R$ 100 existem valores distintos: o **bruto** (R$ 100), a **comissão** da plataforma, e a comissão **após provisão fiscal**. Dizer *"10% vai para o fundo regional"* é ambíguo — 10% de cada um desses produz valores que diferem por **ordem de grandeza**.

O campo `applies_to` existe para declarar a base (DECISION-0178), mas **o motor vivo de cálculo não o lê** (verificado 2026-07-27: zero ocorrências em `economic-policy-engine.service.ts`). Hoje ele aplica todo bps sobre o valor recebido, que é o bruto. Coincide por acaso com as policies semeadas; **é arma carregada** para a primeira policy que use outra base.

**E a pergunta anterior a essa**, levantada pela executora ao recusar a religação: *uma policy pode misturar bases?* Se pudesse, `sum(bps) = 10000` deixaria de significar conservação — e o mecanismo de drift `K_pe_7`, desenhado **exclusivamente para resíduo de centavos**, absorveria silenciosamente a fatia pertencente a outra base (ex.: 30% do valor tratado como "sobra de arredondamento", sem erro).

---

## D1 — A REGRA (decisão soberana de Clayton, 2026-07-27)

> **A base da distribuição é determinada por QUEM VENDE.**

- **Vendedor EXTERNO** (Actor: PF, PJ, banda, artista, prestador): a redistribuição incide **exclusivamente sobre a comissão da plataforma**. O Actor recebe sua parte **antes**, e ela **não entra no split de distribuição**.
- **A própria PLATAFORMA é a vendedora/organizadora**: a redistribuição incide sobre o **bruto** da venda — porque não há prestador externo a remunerar. **Mas o bruto NÃO é sobra:** a plataforma teve **custo operacional** para entregar aquilo, e esse custo **sai ANTES da distribuição, como dedução pré-distributiva não-votável e visível** (D1.1) — **nunca** como fatia dentro do que se reparte. Faturamento não é lucro.

**Exemplo governante (palavras de Clayton):** *"Um Actor vende um produto ou ingresso por 100 reais e foi configurado que, para aquela cidade e categoria, a comissão é 20%. Ou seja, **somente os 20 reais entrarão para o split de divisão**. Se for a plataforma vendendo, o split entra sobre os 100 reais."*

Esta é exatamente a **"policy explícita futura"** que a DECISION-0166 D1 antecipou e deixou em aberto. Não há contradição: D1 permanece a regra do caso externo; esta decisão nomeia o caso em que a plataforma vende.

---

## D1.1 — CUSTO OPERACIONAL É DEDUÇÃO PRÉ-DISTRIBUTIVA, NÃO-VOTÁVEL E VISÍVEL (Clayton, 2026-07-27 · **EMENDA APLICADA 2026-07-28**)

> *"O custo operacional mantém o sistema vivo. Se estiver alto, a sociedade precisa entender e ver."*

**Faturamento não é lucro.** Quando a plataforma vende, o bruto **não é sobra**: houve custo para entregar aquilo (produto, logística, infraestrutura, operação). Esse custo **sai ANTES da distribuição**, junto do imposto e da taxa de adquirente — **forma a base, não compete por voto**:

```
Receita → − taxa de adquirente → − imposto (não votável, visível)
        → − custo operacional (não votável, VISÍVEL)
        → = EXCEDENTE DISTRIBUÍVEL   ← é ISTO que a votação reparte
```

**Regra unificada que emerge daqui — os dois casos de D1 são a MESMA regra:**

> **Distribui-se o que sobra depois de pagar quem entregou.**

- Vendedor externo → quem entregou é o **Actor**, e a parte dele sai antes (é a Etapa 1);
- Plataforma vendedora → quem entregou é a **própria plataforma**, e o custo dela sai **antes**, formando a base — não como fatia dentro dela.

Não são dois modelos: é um só, com dois nomes para "o que custou entregar" — e em **ambos** o que custou entregar sai **antes** do que se reparte.

### 🔴 RETRATAÇÃO — A REDAÇÃO ANTERIOR DESTA SEÇÃO ESTAVA ERRADA (registrada, não apagada)

A versão original afirmava que o custo operacional era **linha explícita DENTRO dos 100% distribuíveis**, justificando-a como mais transparente que uma dedução silenciosa. **Clayton corrigiu em 2026-07-27** (`REMEDIATION_DT_LOG.md:189-233`), e a correção é substantiva, não editorial:

> **Fatia dentro do bolo é fatia votável.** Uma votação poderia zerá-la e **matar a estrutura que gera o bolo**. Não é hipótese de má-fé: é aritmética de incentivo — o problema clássico da comunidade que vota o próprio orçamento e sufoca a infraestrutura.

**O erro da direção foi confundir *onde fica na cascata* com *se aparece*.** Sai antes **e** é publicado — as duas coisas são compatíveis, e a redação anterior tratava-as como excludentes.

**Precedente legal (não é invenção):** `Lei 5.764/71 art. 28` já obriga, em cooperativa, **Fundo de Reserva ≥10%** e **FATES ≥5%**, e **a assembleia não pode votar contra**. Os cooperados decidem o resto; não decidem extinguir o que sustenta a operação.

### 🛡️ O ANTICORPO OBRIGATÓRIO — a proteção não pode virar privilégio

Custo não-votável **cria um poder novo**: quem o define poderia declarar 90% e sufocar a comunidade. A proteção só é legítima acompanhada de **reconciliação publicada**:

> **Declarado × realizado.** Reservou 15%, gastou 8% → **a diferença aparece e RETORNA ao excedente.**

Fecha as duas pontas: o operador **não pode ser sufocado** (custo sai antes do voto) e **não pode abusar** (excesso é visível e volta).

**Publicar exige quatro coisas** (ver ≠ entender): (1) **decomposição** por item, nunca caixa-preta; (2) **reconciliação** declarado×realizado; (3) **trajetória** histórica — a curva descendo é o argumento; (4) **razão** em linguagem leiga.

**Manutenção e expansão não são a mesma linha.** Manutenção presta contas por **gasto**; expansão presta contas por **resultado** (investido + objetivo declarado + o que produziu). Fundir as duas esconde a expansão dentro do custo e nenhuma fica auditável — e *"expansão"* é o rótulo mais abusável de qualquer organização.

### ⚠️ DEPENDÊNCIA MATERIAL DECLARADA — ESTA SEÇÃO **NÃO** DESCREVE O PRESENTE

O anticorpo acima **não é cumprível hoje**: reconciliar declarado×realizado exige apuração de resultado, e o sistema **não tem conceito de período nem DRE** (`platform_ops` é nome sem fiação). Portanto esta seção é **prescrição**, não descrição: enquanto a frente de resultado não existir, **nenhum custo pré-distributivo pode ser declarado como não-votável**, porque a contrapartida que o legitima não pode ser prestada. A doutrina fica fixada; a autorização material depende de frente própria, com GATE e GO próprios.

### 🔴 D1.2 — IMPOSTO **NÃO** É CUSTO OPERACIONAL. A NORMA JÁ RESOLVE (verificado, não inventado)

Clayton pediu para conferir na norma antes de modelar. **A cascata já estava fixada; a escolha da base, não — e é esta decisão que a fecha.**

**DECISION-0166 D7** fixa a cascata do valor, e imposto vem **ANTES** da distribuição social — **estendida abaixo por ESTA decisão** nas duas últimas linhas (custo operacional e excedente), que **não** vêm de D7 e estão etiquetadas com a sua fonte real:
```
valor bruto da transação
→ taxas externas de pagamento (adquirente etc.)
→ comissão UnifiCard bruta
→ reserva/obrigação fiscal
→ comissão DISTRIBUÍVEL          (0179: commission_gross = tax_reserve + commission_distributable)
→ − custo operacional            (D1.1 — não-votável, VISÍVEL)
→ = EXCEDENTE DISTRIBUÍVEL       ← é ISTO que o painel reparte
```

**🔴 `commission_distributable` NÃO É REDEFINIDO POR ESTA DECISÃO — correção de defeito próprio (passe de confirmação, 2026-07-28).** Uma versão anterior desta cascata inseria o custo operacional **acima** da linha `comissão DISTRIBUÍVEL`, o que implicava `distributable = bruto − imposto − custo` e **colidia com a equação SELADA da `DECISION-0179`** citada logo abaixo. Era, na letra, uma segunda definição para um termo já promulgado — o erro que esta casa chama de mais caro, cometido pela direção no mesmo passe em que corrigia outros. **A equação da 0179 permanece intacta:** `commission_distributable` continua sendo `commission_gross − tax_reserve`, e nada mais. O custo operacional é deduzido **depois** dele, formando o **EXCEDENTE DISTRIBUÍVEL** — vocabulário do próprio Clayton na emenda (`REMEDIATION_DT_LOG.md:189-233`).

**⚠️ NÃO DECIDIDO AQUI:** qual valor concreto é entregue ao motor de policy no material (o `commission_distributable` do contexto fiscal, ou o excedente pós-custo) é **mapeamento material**, pertence à fase 4e e exige GATE e GO próprios. Esta decisão fixa a **cascata conceitual**; não fia campo nenhum, e quem materializar **não deve presumir** a equivalência.

**DECISION-0179** define `tax_reserve` com todas as negações necessárias: *"segregação interna de uma obrigação fiscal estimada… **decomposição interna de `commission_gross`**, nunca cobrança adicional; **NÃO é `economic_policy_line`; NÃO é policy configurável**; NÃO é imposto pago/recolhimento."* Equação vinculante já promulgada: **`commission_gross = tax_reserve + commission_distributable`**.

**Três consequências que esta decisão REAFIRMA (não cria):**
1. **Imposto não é linha de policy e não deve ser configurável no painel.** Ele decorre da realidade fiscal, não de escolha do admin. Um percentual de imposto ajustável seria ficção contábil.
2. **Imposto ≠ custo operacional — mas ambos são anteriores.** São deduções distintas (uma é obrigação legal, a outra é o que custou operar) e **nenhuma das duas compete no bolo distribuível**: imposto por `tax_reserve` (0179), custo operacional por D1.1 acima. Tratá-los como fatias faria qualquer um deles disputar o mesmo bolo do fundo regional — e sair do bolo errado.
3. **Taxa de adquirente (maquininha/gateway) também é anterior**, e igualmente não é escolha: é o que o processador cobrou de fato.

**🔴 O QUE ESTA DECISÃO FECHA (e que 0166 D7 deixara EXPRESSAMENTE em aberto):** o próprio D7 diz *"A base distribuível pode ser **comissão bruta ou comissão líquida**, conforme policy versionada — nunca implícita"* (`DECISION_0166…md:171-172`), e a allowlist de `DECISION-0179 D10` restringe *"no material 4e inicial"*, não para sempre. A escolha entre bruta e líquida era, portanto, **uma decisão em aberto — não uma coisa já decidida que bastasse verificar.**

**Esta decisão fecha a escolha de D7 em `commission_distributable`** (a líquida, não a bruta), em harmonia com a cascata D7, com a 0179 e com a allowlist D10 — exercendo exatamente a *"policy explícita futura"* que `DECISION-0166 D1` previa. **Este fechamento é ato DESTA decisão, não leitura de D7** — o D7 deixava as duas em aberto.

**Sobre esse bolo, D1.1 aplica ainda a dedução pré-distributiva do custo operacional.** Logo **o painel reparte o EXCEDENTE DISTRIBUÍVEL** — o que sobra depois de pagar quem entregou, o processador, o Fisco e o custo de operar. Todo percentual que Clayton configurar mede **esse** bolo. **`commission_distributable` segue com a definição selada da 0179** e não é sinônimo de excedente: são dois valores distintos, e confundi-los reintroduziria a segunda verdade corrigida acima.

### D1.3 — É AJUSTÁVEL, SIM — MAS EM OUTRO PAINEL, E A SEPARAÇÃO PROTEGE (Clayton, 2026-07-27)

> *"Isso precisa ser ajustável pelo painel admin, pois o mercado pode mudar, e estamos falando em redistribuição de LUCRO."*

**O enquadramento "redistribuição de LUCRO" passa a ser o frame governante desta decisão.** O que se reparte é **excedente**, nunca faturamento. Custo, adquirente e Fisco saem antes **porque não são lucro** — não por burocracia.

**E a exigência de ajustabilidade já está atendida — verificado, não presumido:**
- `actor_fiscal_profiles` (migration `20260710130000`) é a **casa canônica única do enquadramento fiscal**, ancorada em `fiscal_identities` (CNPJ+KYB, nunca texto solto). Regimes governados: `MEI · SIMPLES_NACIONAL · LUCRO_PRESUMIDO · LUCRO_REAL · OTHER`. **Versionada e imutável quando ativa — mudança = nova versão**, exatamente a mesma disciplina da policy econômica. Guarda `configured_by_actor_id` e `source` (nota do contador). Fail-closed explícito: *"o sistema NÃO inventa regime: sem perfil ativo = `fiscal_config_missing`"*.
- `tax_rules` (migration `20260710140000`, + modo de arredondamento governado em `20260715100000`) é onde vive a **alíquota**.
- **Estado real hoje (medido pela direção): 0 perfis fiscais, 0 regras fiscais.** A máquina está completa e **vazia** — por isso a camada fiscal está inerte e fail-closed.

**Por que NÃO no mesmo painel da distribuição — a separação é proteção, não burocracia:**
- O painel fiscal responde **"quanto devemos?"** — estimativa de obrigação legal.
- O painel de distribuição responde **"como repartimos o que é nosso?"** — escolha soberana.
- Se fossem a mesma tela e o mesmo bolo, **baixar a provisão fiscal pareceria aumentar o fundo regional**. Não aumenta: seria **subprovisionar** — a conta chega igual, e chega depois, contra um fundo que já foi distribuído. **Imposto não compete com a comunidade pelo mesmo bolo; ele forma o bolo.**

Portanto: **ajustável sim, versionado sim, auditável sim — na casa fiscal.** O painel de percentuais reparte o **EXCEDENTE DISTRIBUÍVEL** (D1.2); `commission_distributable` segue sendo o valor **selado da 0179** do qual o excedente deriva — e todo número que Clayton configurar lá mede **lucro**.

**⚠️ Verificar quando a fase 4e abrir (não decidido aqui):** a cascata D7 está escrita para o caso de **comissão**. No caso **plataforma vendedora** (D1), não há comissão — a receita é o próprio bruto. Presume-se que `tax_reserve` incida sobre essa receita, mas isso **não foi verificado nesta decisão** e não deve ser assumido por quem for materializar.

**⚠️ QUESTÃO ABERTA, NÃO DECIDIDA AQUI — custo é PERCENTUAL ou FATO?**
Uma linha de policy expressa **percentual**. Mas custo operacional pode ser **fato daquela transação** (a plataforma comprou o produto por R$ 60 e vendeu por R$ 100 → o custo é R$ 60, não "60%"). Percentual funciona para **rateio de overhead**; não funciona para **custo de mercadoria variável**. Se o UnifiCard vier a revender bens com custo unitário variável, o modelo de policy **sozinho não expressa isso** e será preciso decidir se o custo real entra como fato antes do split (reduzindo a base) ou se permanece rateio percentual. **Não resolver isto antes de vender com custo variável é criar o risco de distribuir dinheiro que não existe.** Registrado como decisão futura de Clayton, não como lacuna esquecida.

---

## D2 — UMA BASE POR POLICY. MISTURA É PROIBIDA.

**Todas as linhas de uma policy medem a MESMA base.** É vedado que uma policy contenha linhas com `applies_to` divergentes.

**Justificativa material, não estética:** com base única, `sum(bps) = 10000` volta a significar **conservação real** — 100% de **um** valor —, e o drift residual volta a ser o que sempre foi desenhado para ser: **centavos de arredondamento**. Sem essa trava, o drift confunde *"parcela de outra régua"* com *"sobra de centavo"* e corrompe dinheiro **sem lançar erro**.

Consequência: onde hoje se imaginaria uma policy mista, o desenho correto é **duas etapas encadeadas** (D3), cada uma fechando 100% do próprio bolo.

---

## D3 — O MODELO É DE DUAS ETAPAS

1. **Etapa 1 — repartição da venda:** define quanto fica com o vendedor externo e quanto é **comissão da plataforma** (ex.: 80% Actor / 20% comissão). A taxa de comissão **varia por cidade e categoria**, configurável no painel.
2. **Etapa 2 — distribuição do que é da plataforma:** reparte **100% daquele bolo** entre fundo regional (multinível, DECISION-0166 D2), indicação, grupos e reserva. Também varia por cidade e categoria. **Custo operacional e expansão NÃO entram nesta lista** — são dedução pré-distributiva (D1.1), já descontada antes de a Etapa 2 começar; incluí-los aqui seria contá-los duas vezes **e** devolvê-los ao alcance do voto.

Quando a **plataforma vende**, a Etapa 1 **não existe** (não há terceiro a remunerar) e a Etapa 2 opera sobre o bruto **após as deduções pré-distributivas de D1.1** (imposto, taxa de adquirente e custo operacional) — nunca sobre o bruto cru.

Isto é coerente com a ordem já ratificada em DECISION-0166 D7 (fiscal → comissão distribuível → fundos/grupos/indicação/sistema) e preserva a conservação em **cada** etapa.

---

## D4 — A BASE É DERIVADA, NÃO ESCOLHIDA LIVREMENTE

**`applies_to` não deve ser um campo de livre escolha do admin.** Ele **decorre** de quem vende. Deixá-lo livre é a própria fonte do perigo: um admin marcaria `gross_transaction` numa policy de vendedor externo e o motor repartiria **os R$ 100 inteiros** entre fundo/indicação/reserva — **zerando ou negativando a parte do Actor** no momento do pagamento real, não na configuração.

Enforcement futuro (sem GO aqui): a base deve ser **resolvida pelo servidor** a partir do tipo de vendedor, e qualquer divergência entre a base declarada e a base derivada é **fail-closed**, nunca correção silenciosa.

---

## D5 — OS NÚMEROS HERDADOS ESTÃO EXPRESSOS NA RÉGUA ERRADA

A policy semeada `legacy_baseline_event_ticket_curitiba` (70% organizador · 3% taxa · 10% fundo regional · 17% reserva, todas `gross_transaction`) **colapsa as duas etapas numa só**: trata destinos de Etapa 2 como percentuais do **bruto**.

Aritmeticamente o dinheiro até coincide (a comissão é 30%; 3/30 = 10%, 10/30 = 33,3%, 17/30 = 56,7% dessa comissão). **Mas a expressão está errada, e a expressão é o que Clayton configura.**

**🔴 ERRATA (auditoria independente, 2026-07-27) — a direção havia escrito o SENTIDO DO DANO INVERTIDO.** O texto original afirmava que a fatia do fundo ficaria *"três vezes menor"* que a pretendida. **É o contrário.** Com os números da própria policy semeada (comissão = 30% do bruto): pretendido = 10% da comissão = 0,10 × 0,30 = **3% do bruto**; real = **10% do bruto**. Real ÷ pretendido = **3,33× MAIOR**, não menor.

**Por que a inversão era grave e não editorial:** este artigo é o que ordena reexpressar os números herdados antes de qualquer ativação. Um implementador lendo *"o fundo recebe 3× menos"* **corrigiria PARA CIMA** uma fatia que já está 3,33× **acima** do pretendido — triplicando um erro que já era triplo, numa decisão sobre para onde vai dinheiro. Registrado sem atenuação: a direção comunicou o erro invertido também verbalmente a Clayton antes da auditoria o apanhar.

Portanto: os valores herdados (já marcados **NÃO RATIFICADOS**) devem ser **reexpressos em duas etapas** antes de qualquer ativação. **Nenhuma policy herdada deve ser ativada na forma atual.** Reexpressar não é ratificar — os números seguem sendo herança até Clayton publicar os seus.

---

## 🔴 D3.1 — QUEM ABSORVE A SOBRA DE CENTAVO NA ETAPA 2 (decisão soberana de Clayton, 2026-07-28)

> *"A sobra do centavo pode ir para a parte que trata dos custos do sistema."*

**Fecha o veredito C-4 da auditoria**, que provou que a Etapa 2 de D3 **não podia sequer ser gravada**: o writer selado exige ao menos uma linha `revenue_share` **sempre que a policy tiver alguma linha com `bps`** — a checagem está atrás de `if (hasBpsLine)` (`economic-policy-write-validation.ts:192`) e é aplicada em `:200-206`. Como a Etapa 2 (fundo · indicação · grupos · reserva) é expressa em percentual, a exigência **incide integralmente** sobre ela, e a Etapa 2 **não tinha nenhuma** linha `revenue_share`.

**Precisão de escopo (correção pós-4ª auditoria):** a exigência **não** vale para *"toda"* policy, como a redação anterior afirmava. Uma policy composta **só** de `fixedAmountCents` escapa da trava de escrita e é publicável **sem** `revenue_share` — falhando apenas em runtime, com `DRIFT_NO_REVENUE_SHARE`. **Isso não enfraquece a doutrina desta seção; é um buraco da validação de escrita**, registrado aqui como achado e não remediado por esta decisão.

A exigência não é burocracia — é **estrutural**: a primeira linha `revenue_share` é quem **absorve o drift de arredondamento** (`K_pe_7`, `economic-policy-engine.service.ts:274-296`). Sem absorvedor, o resto do centavo **não tem dono**, e o cálculo falha `DRIFT_NO_REVENUE_SHARE`.

**Decisão (mecanismo REESCRITO em 2026-07-28 após a 3ª auditoria — ver D3.1-BIS abaixo, que substitui o texto original desta seção).**

### 🔴 D3.1-BIS — O MECANISMO CORRETO: LINHA `revenue_share` COM **bps = 0** E DESTINO NA CONTA DE CUSTO

**A redação anterior desta seção estava errada em dois pontos graves, ambos apontados pela 3ª auditoria e aqui retratados sem atenuação:**
1. **Inventava um `line_type` `operational_cost` que não existe** — e criar valor de vocabulário exige DECISION nomeada (`DECISION-0179`).
2. **Emendava norma promulgada chamando de "consistência":** `CORE_SPLIT_PAGAMENTO_CANONICO.md:94` fixa *"drift para `revenue_share[0]`"*, e o texto original propunha "quem entregou naquela etapa" como se fosse a mesma regra. **Não era instância — era substituição**, exatamente o defeito de Artigo XI pelo qual a 0192 D5 já havia sido reprovada, reproduzido um documento adiante.

**O mecanismo correto usa a regra promulgada, não a substitui:**

> **Na Etapa 2, a sobra é absorvida por uma linha `lineType='revenue_share'` com `bps = 0` cujo `destinationType` aponta para a conta de custo/taxa da plataforma.**

`lineType` e `destinationType` são campos **independentes**. `revenue_share` é o tipo que a norma já elege como absorvedor do drift; o destino é para onde vai. Uma linha com **zero por cento do bolo** recebe **cem por cento do resto**.

**PROVA DE 1ª MÃO DA DIREÇÃO (motor real, não leitura de código):**
```
linha bps=0 · revenue_share · destino platform_fees   +   fundo 3333 bps   +   indicação 6667 bps
total=  100 → soma 100 ✓ | absorvedora recebeu 1
total=    7 → soma   7 ✓ | absorvedora recebeu 1
total=  999 → soma 999 ✓ | absorvedora recebeu 1
total=12345 → soma 12345 ✓ | absorvedora recebeu 1
```
E `assertPolicyLinesValid` **aceita `bps = 0`** — verificado. *(Erratum de método registrado: a primeira tentativa de prova da direção usou um valor que dividia exato e portanto não gerava sobra — teste inútil, refeito com valores que produzem resto.)*

**Custo institucional deste mecanismo: ZERO.** Nenhum `line_type` novo · nenhuma mudança no motor · **nenhum arquivo byte-pinado tocado** · nenhuma emenda a norma promulgada · nenhuma migration. Usa `platform_fees`, que já existe, já é provisionada e já está em `SUPPORTED_DESTINATION_TYPES` do PE-3.

**Reconcilia as duas decisões de Clayton sem contradição** — o ponto que a 3ª auditoria provou estar quebrado no texto anterior:
- **"O custo operacional sai ANTES, não é votável"** (emenda de 2026-07-27) → o custo **substantivo** é dedução pré-distributiva, fora do split, protegido do voto. **Intacto.**
- **"A sobra do centavo vai para a parte que trata dos custos"** (2026-07-28) → a linha absorvedora tem **bps = 0**, logo **não disputa o bolo** e **não conta custo duas vezes**; ela só roteia o resíduo para a mesma conta.

**FECHA O VEREDITO C-4 DE VERDADE** (a 3ª auditoria mandou não repetir a alegação falsa): C-4 era *"a Etapa 2 não pode ser gravada porque o writer exige uma linha `revenue_share`"*. Com este mecanismo a Etapa 2 **tem** uma linha `revenue_share` — e a validação de escrita **aceitou**, provado acima. **A impossibilidade material foi removida, não apenas respondida em doutrina.**

**Decisão de Clayton sobre a alternativa (registrada):** Clayton havia pedido uma **conta dedicada de sobras, movível só por ele**. A direção levantou o custo — destino novo exigiria **abrir o arquivo byte-pinado**, valor novo de vocabulário por DECISION, migration, e governança própria para um saldo de centavos — e Clayton, informado do preço, **confirmou a rota do custo** (*"o que é mais simples e que já funciona?"* → *"sim, confirmado"*). A conta dedicada permanece **legítima e possível**, como frente própria com decisão nomeada, não descartada.

**A regra normativa é UMA, e não é desta decisão:** `CORE_SPLIT_PAGAMENTO_CANONICO.md:94` — *drift para `revenue_share[0]`* — vale nas duas etapas, sem exceção e sem emenda. O que esta seção decide é **para onde aponta o `destinationType`** daquela linha na Etapa 2: a conta de custo/taxa da plataforma.

*(Glosa não-normativa, para leitura humana: o efeito prático é que a sobra de centavo fica com quem entregou naquela etapa — o Actor na Etapa 1, a plataforma na Etapa 2. Isto é **descrição do efeito**, não regra autônoma; a regra é a do `CORE:94`. A redação anterior enunciava esta glosa como se fosse regra unificada própria, e mandava a sobra para uma "linha de custo operacional" que, sob a D1.1 emendada, **não existe dentro do split**. Resíduo expurgado em 2026-07-28.)*

E **honesta na direção**: a plataforma fica com as migalhas do arredondamento, não a comunidade.

**⚠️ NOTA DE ESCOPO DA GARANTIA DE DESTINO (4ª auditoria, F7):** a promessa *"o centavo vai para a conta de custo"* vale no caminho **PE-3 / `service_execution`**, onde o roteamento é por `destinationType` (`service-payment-execution.service.ts:137-152`). O **segundo consumidor** do motor, `marketplace-fee-policy.ts:62-64`, classifica splits por `lineType` e contaria uma linha `revenue_share` bps=0 como parte **líquida do Actor**, não como custo da plataforma. Não afeta a Etapa 2 (`moduleContext` distinto, e aquele consumidor calcula taxa sem mover destino), mas **a garantia é por-consumidor, não universal** — quem materializar em outro caminho precisa verificar, não presumir.

**✅ VEREDITO C-5 RESOLVIDO — NÃO HÁ MAIS LACUNA DE VOCABULÁRIO.** A redação anterior declarava que faltava o `line_type` `operational_cost` em `EconomicPolicyLineType` (`economic-policy.types.ts:18-26`) e concluía que *"o absorvedor da Etapa 2 não existe até lá"*. **Ambas as afirmações caíram:** sob a D1.1 emendada **não existe linha de custo dentro do split**, logo `operational_cost` deixou de ser pré-requisito de qualquer coisa nesta decisão; e o absorvedor **existe hoje** — é a linha `revenue_share` bps=0, aceita pela validação de escrita e calculada pelo motor real, provado acima e re-provado de forma independente pela 4ª auditoria. **Nenhum valor novo de vocabulário é criado ou necessário aqui**, e permanece proibida a alternativa por omissão de usar `custom`.

---

## 🔴 D5.4 — DEMAIS CORREÇÕES PÓS-AUDITORIA (veredito C, 2026-07-27)

**C-2 · COLISÃO NÃO NOMEADA COM `DECISION-0179 D10` (allowlist selada).** D10 fixa: *"No material 4e inicial, **só entram no Bank**: `tax_reserve` e linhas originadas de **`commission_distributable`**. Linhas sobre `gross_transaction`/`commission_gross` **permanecem fora** até nova allowlist decidida"*; e **proíbe** *"qualquer `line_type` sobre `gross_transaction` materializado por conveniência"*. **D1 (plataforma vende → incide sobre o bruto) e a Etapa 1 de D3 são exatamente linhas sobre `gross_transaction`.** A redação original citava a 0179 apenas para `tax_reserve` e **nunca mencionou D10**. Pior: o estado material é ainda mais restritivo — **a allowlist está VAZIA** (`fiscal-reserve-bank-composition.service.ts:17`, DECISION-0183 D9), logo **nenhuma** linha de **nenhuma** base materializa no Bank hoje. **Correção:** fica declarado que o caso plataforma-vendedora e a Etapa 1 estão **fora da allowlist vigente**, e que sua materialização exige **decisão de allowlist própria** — que **não** é o GO 4e e **não** é emitida aqui.

**C-3 · D2 RESTRINGE O QUE CÓDIGO SELADO TORNA POSSÍVEL — e a direção tinha o fato à mão.** `fiscal-economic-policy-composition.service.ts:180,222-229` **agrupa linhas por base** e chama o motor **por grupo**, com comentário citando D12. Agravante registrado: o cartório da mesma sessão, dez linhas acima da redação, já registrava *"multi-base já é o desenho previsto"* — **redigiu-se com o fato disponível e omitiu-se**.

**🔴 CORREÇÃO DO ALVO (4ª auditoria, F3) — a redação anterior errava contra quem D2 diverge.** Ela declarava desacordo *"com 0178 D8"*. **Isso é textualmente falso**, e a 4ª auditoria verificou lendo o artigo: `DECISION_0178 D8:208` lista propriedades do `EconomicPolicyEvaluationContext`, e *"as mesmas **três** bases"* são os três **valores** do contrato (`grossTransactionCents` / `commissionGrossCents` / `commissionDistributableCents`) que viajam juntos no contexto — **não** um direito de a policy misturar bases nas suas linhas. **A 0178 é SILENTE sobre mistura intra-policy.**

**O desacordo REAL de D2 é com dois fatos materiais, não com norma selada:**
1. a **capacidade** multi-base do código selado (`fiscal-economic-policy-composition.service.ts:180,222-229`) — capacidade, não permissão promulgada;
2. a **ausência de trava de base única** em `assertPolicyLinesValid` (`economic-policy-write-validation.ts:158-179`), que hoje soma bps de todas as linhas sem olhar `applies_to`.

**Consequência:** D2 decide num espaço que a 0178 deixou aberto — é **restrição declarada em espaço não decidido**, não emenda vestida de leitura harmonizadora (o defeito pelo qual a 0192 D5 foi reprovada). Por isso `D6` (*"DECISION-0178 permanece íntegra"*) e este artigo **não se contradizem**: a 0178 segue íntegra, e o que fica dormente sob D2 é uma **capacidade de código**, não um artigo. O que acontece com o agrupamento por base — morre, vira defesa em profundidade, ou é religado por decisão futura — **não é decidido aqui** e é pré-requisito de qualquer materialização de D2.

**C-6 · D4 DESCREVIA COMO FUTURO O QUE JÁ ESTAVA NO AR.** D4 (*"`applies_to` não deve ser de livre escolha do admin"*) foi redigida como risco teórico. Estado material no mesmo dia: `EconomicPoliciesPage.tsx` **é um `<select>` por linha**, e o writer aceita qualquer das 3 bases graváveis, linha a linha, **com Clayton já possuindo acesso real** (Fatia 4 selada). **Correção:** o risco de D4 **é atual, não futuro**. Registra-se que, diferentemente do defeito irmão de `regionalOriginBasis` — **fechado em `6ccdadf11`** com declaração policiada por guard —, a livre escolha de `applies_to` **permanece aberta** e não foi remediada por esta decisão.

---

## D6 — O QUE ESTA DECISÃO NÃO FAZ

- **Não emite** `GO RETOMAR MATERIAL FISCAL-4E`, não religa caller monetário, não expande reachability.
- Não altera o motor, o vocabulário `applies_to` (DECISION-0178 permanece íntegra), nem a regra de drift `K_pe_7` — apenas estabelece a condição de doutrina sob a qual ela volta a ser correta.
- Não ativa policy alguma (Artigo V — ativação é ato de Clayton).
- Não fixa **percentual** algum: a taxa de comissão e a distribuição continuam decisão soberana não tomada.
- Não decide quem é "a plataforma" como vendedora em termos de Actor — a materialização desse discriminador é frente própria, com GATE próprio.
