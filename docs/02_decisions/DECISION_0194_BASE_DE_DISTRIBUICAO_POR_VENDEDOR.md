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

### 🔴 D1.2 — IMPOSTO **NÃO** É CUSTO OPERACIONAL. A NORMA JÁ RESOLVE (verificado, não inventado)

Clayton pediu para conferir na norma antes de modelar. **Já estava decidido, e em dois lugares.**

**DECISION-0166 D7** fixa a cascata do valor, e imposto vem **ANTES** da distribuição social:
```
valor bruto da transação
→ taxas externas de pagamento (adquirente etc.)
→ comissão UnifiCard bruta
→ reserva/obrigação fiscal
→ comissão DISTRIBUÍVEL          ← é ISTO que o painel reparte
```

**DECISION-0179** define `tax_reserve` com todas as negações necessárias: *"segregação interna de uma obrigação fiscal estimada… **decomposição interna de `commission_gross`**, nunca cobrança adicional; **NÃO é `economic_policy_line`; NÃO é policy configurável**; NÃO é imposto pago/recolhimento."* Equação vinculante já promulgada: **`commission_gross = tax_reserve + commission_distributable`**.

**Três consequências que esta decisão apenas REAFIRMA (não cria):**
1. **Imposto não é linha de policy e não deve ser configurável no painel.** Ele decorre da realidade fiscal, não de escolha do admin. Um percentual de imposto ajustável seria ficção contábil.
2. **Imposto ≠ custo operacional.** Custo operacional é linha **dentro** dos 100% distribuíveis (D1.1); imposto é dedução **anterior** que forma a base. Confundi-los faria o imposto competir com o fundo regional pelo mesmo bolo — e sair do bolo errado.
3. **Taxa de adquirente (maquininha/gateway) também é anterior**, e igualmente não é escolha: é o que o processador cobrou de fato.

**Portanto o painel reparte `commission_distributable`** — o que sobra depois de pagar quem entregou, o processador e o Fisco. Todo percentual que Clayton configurar mede **esse** bolo.

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

Portanto: **ajustável sim, versionado sim, auditável sim — na casa fiscal.** O painel de percentuais reparte `commission_distributable`, e todo número que Clayton configurar lá mede **lucro**.

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

Aritmeticamente o dinheiro até coincide (a comissão é 30%; 3/30 = 10%, 10/30 = 33,3%, 17/30 = 56,7% dessa comissão). **Mas a expressão está errada, e a expressão é o que Clayton configura.**

**🔴 ERRATA (auditoria independente, 2026-07-27) — a direção havia escrito o SENTIDO DO DANO INVERTIDO.** O texto original afirmava que a fatia do fundo ficaria *"três vezes menor"* que a pretendida. **É o contrário.** Com os números da própria policy semeada (comissão = 30% do bruto): pretendido = 10% da comissão = 0,10 × 0,30 = **3% do bruto**; real = **10% do bruto**. Real ÷ pretendido = **3,33× MAIOR**, não menor.

**Por que a inversão era grave e não editorial:** este artigo é o que ordena reexpressar os números herdados antes de qualquer ativação. Um implementador lendo *"o fundo recebe 3× menos"* **corrigiria PARA CIMA** uma fatia que já está 3,33× **acima** do pretendido — triplicando um erro que já era triplo, numa decisão sobre para onde vai dinheiro. Registrado sem atenuação: a direção comunicou o erro invertido também verbalmente a Clayton antes da auditoria o apanhar.

Portanto: os valores herdados (já marcados **NÃO RATIFICADOS**) devem ser **reexpressos em duas etapas** antes de qualquer ativação. **Nenhuma policy herdada deve ser ativada na forma atual.** Reexpressar não é ratificar — os números seguem sendo herança até Clayton publicar os seus.

---

## D6 — O QUE ESTA DECISÃO NÃO FAZ

- **Não emite** `GO RETOMAR MATERIAL FISCAL-4E`, não religa caller monetário, não expande reachability.
- Não altera o motor, o vocabulário `applies_to` (DECISION-0178 permanece íntegra), nem a regra de drift `K_pe_7` — apenas estabelece a condição de doutrina sob a qual ela volta a ser correta.
- Não ativa policy alguma (Artigo V — ativação é ato de Clayton).
- Não fixa **percentual** algum: a taxa de comissão e a distribuição continuam decisão soberana não tomada.
- Não decide quem é "a plataforma" como vendedora em termos de Actor — a materialização desse discriminador é frente própria, com GATE próprio.
