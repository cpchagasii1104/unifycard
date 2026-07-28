# DECISION-0194 — BASE DA DISTRIBUIÇÃO É DETERMINADA POR QUEM VENDE (e nunca se mistura)

**Data:** 2026-07-27 · **Status:** REDIGIDA — DOUTRINA DECIDIDA POR CLAYTON; AGUARDANDO AUDITORIA INDEPENDENTE ANTES DE ENFORCEMENT MATERIAL. **NÃO-SELADA. SELF-SEAL NÃO PERMITIDO.**
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
- **A própria PLATAFORMA é a vendedora/organizadora**: a redistribuição incide sobre o **bruto** da venda — porque não há prestador externo a remunerar. **Mas o bruto NÃO é sobra:** a plataforma teve **custo operacional** para entregar aquilo, e esse custo é uma **linha explícita dentro da distribuição** (D1.1). Faturamento não é lucro.

**Exemplo governante (palavras de Clayton):** *"Um Actor vende um produto ou ingresso por 100 reais e foi configurado que, para aquela cidade e categoria, a comissão é 20%. Ou seja, **somente os 20 reais entrarão para o split de divisão**. Se for a plataforma vendendo, o split entra sobre os 100 reais."*

Esta é exatamente a **"policy explícita futura"** que a DECISION-0166 D1 antecipou e deixou em aberto. Não há contradição: D1 permanece a regra do caso externo; esta decisão nomeia o caso em que a plataforma vende.

---

## D1.1 — CUSTO OPERACIONAL É LINHA EXPLÍCITA, NUNCA PREMISSA (Clayton, 2026-07-27)

> *"Só que se for a plataforma, essa divisão entre os 100 reais terá o custo operacional."*

**Faturamento não é lucro.** Quando a plataforma vende, o bruto continua sendo a **base**, mas entre as fatias que somam 100% **obrigatoriamente existe uma linha de custo operacional** — o que custou entregar aquele valor (produto, logística, infraestrutura, operação).

**Regra unificada que emerge daqui — os dois casos de D1 são a MESMA regra:**

> **Distribui-se o que sobra depois de pagar quem entregou.**

- Vendedor externo → quem entregou é o **Actor**, e a parte dele sai antes (é a Etapa 1);
- Plataforma vendedora → quem entregou é a **própria plataforma**, e o custo dela sai como **linha de custo operacional** dentro da distribuição.

Não são dois modelos: é um só, com dois nomes para "o que custou entregar".

**Por que linha explícita e não dedução silenciosa:** um custo descontado antes, fora do split, é invisível — a comunidade veria "10% para o fundo regional" sem saber que a base já tinha sido reduzida em segredo. Como linha, ele aparece, é auditável, e permite dizer honestamente *"hoje X% cobre o custo do projeto; conforme escalar, isso cai e o fundo sobe"* — que é mais forte que esconder. Coerente com a exigência de transparência de Clayton (saldos visíveis) e com o Artigo XI.

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
2. **Etapa 2 — distribuição do que é da plataforma:** reparte **100% daquele bolo** entre fundo regional (multinível, DECISION-0166 D2), indicação, grupos, reserva e **custo do projeto/expansão**. Também varia por cidade e categoria.

Quando a **plataforma vende**, a Etapa 1 **não existe** (não há terceiro a remunerar) e a Etapa 2 opera sobre o bruto.

Isto é coerente com a ordem já ratificada em DECISION-0166 D7 (fiscal → comissão distribuível → fundos/grupos/indicação/sistema) e preserva a conservação em **cada** etapa.

---

## D4 — A BASE É DERIVADA, NÃO ESCOLHIDA LIVREMENTE

**`applies_to` não deve ser um campo de livre escolha do admin.** Ele **decorre** de quem vende. Deixá-lo livre é a própria fonte do perigo: um admin marcaria `gross_transaction` numa policy de vendedor externo e o motor repartiria **os R$ 100 inteiros** entre fundo/indicação/reserva — **zerando ou negativando a parte do Actor** no momento do pagamento real, não na configuração.

Enforcement futuro (sem GO aqui): a base deve ser **resolvida pelo servidor** a partir do tipo de vendedor, e qualquer divergência entre a base declarada e a base derivada é **fail-closed**, nunca correção silenciosa.

---

## D5 — OS NÚMEROS HERDADOS ESTÃO EXPRESSOS NA RÉGUA ERRADA

A policy semeada `legacy_baseline_event_ticket_curitiba` (70% organizador · 3% taxa · 10% fundo regional · 17% reserva, todas `gross_transaction`) **colapsa as duas etapas numa só**: trata destinos de Etapa 2 como percentuais do **bruto**.

Aritmeticamente o dinheiro até coincide (a comissão é 30%; 3/30 = 10%, 10/30 = 33,3%, 17/30 = 56,7% dessa comissão). **Mas a expressão está errada, e a expressão é o que Clayton configura.** Se ele definir "10% para o fundo" pensando em 10% da comissão, mas o número viver na régua do bruto, a fatia real do fundo fica **três vezes menor** que a pretendida.

Portanto: os valores herdados (já marcados **NÃO RATIFICADOS**) devem ser **reexpressos em duas etapas** antes de qualquer ativação. **Nenhuma policy herdada deve ser ativada na forma atual.** Reexpressar não é ratificar — os números seguem sendo herança até Clayton publicar os seus.

---

## D6 — O QUE ESTA DECISÃO NÃO FAZ

- **Não emite** `GO RETOMAR MATERIAL FISCAL-4E`, não religa caller monetário, não expande reachability.
- Não altera o motor, o vocabulário `applies_to` (DECISION-0178 permanece íntegra), nem a regra de drift `K_pe_7` — apenas estabelece a condição de doutrina sob a qual ela volta a ser correta.
- Não ativa policy alguma (Artigo V — ativação é ato de Clayton).
- Não fixa **percentual** algum: a taxa de comissão e a distribuição continuam decisão soberana não tomada.
- Não decide quem é "a plataforma" como vendedora em termos de Actor — a materialização desse discriminador é frente própria, com GATE próprio.
