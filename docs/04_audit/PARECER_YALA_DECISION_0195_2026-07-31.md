# PARECER YALA — DECISION-0195 (canal unificado de denúncia e disputa) · 2026-07-31

**Auditora:** YALA (independente, responde a Clayton) · **Modo:** guardião, read-only.
**Alvo:** `docs/02_decisions/DECISION_0195_CANAL_UNIFICADO_DE_DENUNCIA_E_DISPUTA.md` (NÃO-SELADA,
17 cláusulas, escrita inteira pela direção). Commits `3496f57d4`…`d4131e0e6`.
**Lido integralmente:** 0195 · `CONSTITUICAO_UNIFICARD.md` (XII artigos) · `REPORTING_CORE.md` ·
`REPORTING_DATA_MODEL.md` · pacote §8 (SSOT_EXCLUSIVE_BANK_RULE + PROHIBITED_STRUCTURES no
relevante) · `PORTA_HOLD_KEYS` vivo (company-policy-registry.ts:230-243).
**Ambiente das provas de banco:** `unificard_dev`.

---

## VEREDITO: **SELÁVEL COM CORREÇÕES** (6, numeradas ao final)

Nenhum dos quatro ataques que a direção temia derruba a decisão inteira. Mas o ataque que ela
**não** listou — Artigo VIII × o motor de risco que a 0195 promulga por atacado — encontra a
colisão constitucional mais séria do documento, e dois dos quatro eixos revelam promessas
estruturalmente insustentáveis (D4 "NUNCA sabe") ou buracos de autoridade (estorno; banimento).
O documento também ainda carrega a doença de numeração que o commit `d4131e0e6` alegou curar.

---

## OS QUATRO ATAQUES DO MANDATO

### ① ARTIGO VI × D1 (rotear é arbitrar?) — **DE PÉ**, com ressalva de autoridade
**O que ataquei:** li o Artigo VI na letra ("não arbitra disputas sociais; não determina
vencedores") contra D1.1 (roteamento do sistema) e D1.3 (escalonamento imediato). Tentei ler
roteamento como julgamento.
**Por que não caiu:** rotear por assunto **declarado pelo próprio usuário** (D1.4 fixa taxonomia
em primeira pessoa — ele escolhe "sofri agressão", o sistema não infere) não determina vencedor
nem resolve o conflito; entrega a um humano. A 0195 reafirma 2× que punição nunca é automática
(D9; REPORTING_CORE "nunca bloquear automaticamente no MVP"). Escalonar ≠ arbitrar.
**RESSALVA (correção 5):** o desfecho prometido da DENÚNCIA — *"remoção, suspensão,
**banimento**"* — pressupõe um poder de moderação sobre Actors que **nenhuma norma citada
concede**. Artigo I.4 proíbe "contas-deus, chaves-mestras ou bypass administrativos". O substrato
existe (`authority_roots.status`, `authority_trust_levels.atl_level` — verifiquei no código do
shadow-authorization) e `08_AUTORIDADE_CANONICA` cobre encerramento/revogação — mas a 0195 não
os nomeia. Sem esse vínculo, "banimento" é poder ex nihilo. **SUSPEITO→correção nomeável.**

### ② ARTIGO X × D4 — a escolha fica DE PÉ; a promessa absoluta é **DERRUBADA**
**O que ataquei:** (a) a exigência de identificação à plataforma; (b) a promessa *"o denunciado
NUNCA sabe quem denunciou"*.
**(a) DE PÉ.** Artigo X é sobre inferência a partir de agregados — não confere anonimato perante
a plataforma. A exclusão da denúncia anônima na v1 é **declarada, justificada (anti-abuso
5/hora·20/dia é por reporter — verifiquei `ReportingPolicy.ts:23,30`) e devolvida a Clayton**
como decisão futura. É escolha de produto legítima, honestamente registrada.
**(b) DERRUBADA POR CONSTRUÇÃO — PROVADO.** D3 ancora a denúncia na **operação concreta** (D3.2:
`target_id` carregado pela navegação). Uma operação 1:1 (corrida, pedido, serviço) tem **duas
partes**. Qualquer consequência visível ao denunciado (remoção, suspensão, resposta) após uma
denúncia ancorada na operação X identifica o denunciante **por eliminação** — é exatamente a
"identificação reversa" que o Artigo X.2 manda impedir **por limiares**, e a 0195 não estabelece
limiar nenhum. D3 e D4 são individualmente boas e **mutuamente contraditórias no caso 1:1**.
Uber/iFood convivem com isso — mas eles não têm um Artigo X. A 0195 não pode prometer "NUNCA".
→ **Correção 2.**

### ③ ARTIGO II × D1.3 (emergência = ação automática?) — **DE PÉ**
**O que ataquei:** li "escalonamento imediato" contra "conflito nunca gera ação automática" e
contra a proibição de "urgência algorítmica" (Artigo IV).
**Por que não caiu:** a cadeia do Artigo II é *conflito → fato → alerta → humano* — e D1.3 é
exatamente essa cadeia com latência mínima. Escalonar **é** "alerta vai para o humano"; a
proibição do Artigo II é resolver/bloquear automaticamente, o que D1.3 não faz. Artigo IV rege o
Inbox (read-model do usuário), não a fila interna de T&S. E a urgência não é algorítmica: decorre
da opção **explícita** do usuário (D1.4). Ressalva preventiva: se um dia a emergência for
inferida por NLP de texto livre em vez de seleção explícita, aí sim vira urgência algorítmica
sobre indivíduo — a redação atual não autoriza isso, e o GATE futuro deve manter assim.

### ④ D7 × PORTA-01 — D7 **DE PÉ** para o assistente; **INSUFICIENTE** para o destino DISPUTA
**O que ataquei (§8 lido antes):** procurei a brecha "compor operação canônica ainda dispara
efeito monetário sob autoridade de quem?".
**D7 em si não caiu:** "mesma rota, mesmo writer, mesmo gate, mesma PORTA" é a formulação certa —
o assistente que compõe herda TODAS as travas: as 7 `PORTA_HOLD_KEYS` (deny terminal estrutural,
inclusive self), o firewall do sink, o SSOT do Bank. Se a devolução está represada no fluxo
normal, está represada na ajuda. Confirmei que as chaves de payout/split/settlement estão em HOLD
terminal no código vivo.
**A brecha está ANTES do assistente — PROVADO na letra da Constituição:** D1 promete que DISPUTA
desemboca em *"estorno, refazer, cancelar, **mediação**"*. Artigo V: *"Não existe ajuste
administrativo"* (V.4) e *"**Reversão só pelo ator que executou**"* (V.6); DECISION-0166 D6:
*"admin NÃO move dinheiro"*. Logo, o desfecho "estorno" só é constitucionalmente executável
**pelo próprio ator** — se a contraparte recusar, a mediação **não tem como entregar o estorno**
sem violar V.4/V.6. A 0195 promete um desfecho cujo executor constitucional pode dizer não, e não
diz o que acontece então. Os LIMITES dizem "o mecanismo financeiro segue sob as travas" — isso
**adia**, não resolve: doutrina que promete desfecho sem executor legal é promessa vazia ou
pressão futura por bypass. → **Correção 4.**

---

## O ATAQUE QUE O MANDATO NÃO PEDIU — E É O MAIS GRAVE

### 🔴 ARTIGO VIII × a promulgação POR ATACADO do REPORTING_CORE — **COLISÃO CONSTITUCIONAL**
O cabeçalho da 0195 diz **"Promulga: REPORTING_CORE.md e REPORTING_DATA_MODEL.md"** (os documentos
inteiros); D2 promulga só **3 bullets** (núcleo único; 3 tabelas; denúncia-própria-de-módulo é
BUG). **As duas coisas são diferentes, e a diferença importa**, porque o REPORTING_CORE inteiro
contém:
- **Risk score POR ALVO INDIVIDUAL** (`risk_flags` com `risk_score INTEGER` por
  `target_type`+`target_id`, incluindo `USER`/`DRIVER`/`PROVIDER`) — Artigo VIII proíbe
  **"vigilância individual, ranking humano, score social"** e Artigo XII: *"Não ranqueará
  pessoas"*;
- **"Score do denunciante"** (credibilidade do reporter) — score social de pessoa, na letra;
- Cálculo **"on-write"** e **"priorizar fila manual"** — Artigo VIII.2 exige observações
  *"agregadas, retardadas no tempo, não acionáveis automaticamente"*; on-write não é retardado, e
  priorização automática de fila é ação automática derivada do score.
O caso "5 denúncias em 30 dias = 🚨" é defensável como **agregado de padrão** (contagem, não
inferência) — mas a 0195 não faz essa defesa, não separa o que promulga, e o cabeçalho arrasta o
pacote inteiro. **Se selar como está, o UnifiCard promulga score individual de pessoa no mesmo
repositório em que a Constituição o proíbe.** Grau: **PROVADO** (colisão textual). → **Correção 1.**

---

## INTEGRIDADE DO PRÓPRIO DOCUMENTO (a doença de numeração NÃO está curada)

Tudo abaixo **PROVADO por leitura direta** do arquivo em HEAD:
1. **D1 diz "três destinos" e a tabela tem QUATRO + autoatendimento** (DISPUTA, DENÚNCIA,
   EMERGÊNCIA, FEEDBACK). A frase "Por dentro, três destinos" (linha 70) contradiz a própria
   tabela 4 linhas abaixo. FEEDBACK foi acrescentado sem atualizar a frase.
2. **D11.1 e D11.2 vivem DENTRO da seção D10** (linhas 311-315), e existe um `## D11` separado
   depois. Ou são D10.1/D10.2, ou o D11 real tem 3 corpos. A "nota de numeração" só cobre o D5
   ausente — **não** cobre isto. A mesma classe de defeito que `d4131e0e6` alegou corrigir.
3. **A EMENDA 1 aponta para cláusulas erradas** (mapa pré-renumeração nunca atualizado):
   diz "EMERGÊNCIA → novo D6" (é **D1.3**; D6 é autoatendimento) · "D7 (autoatendimento)" (é D6) ·
   "D8 (assistente…)" (é D7) · "D9 (evidência)" (é D8) · "D10 (saída humana)" (é D11). **Cinco
   referências, cinco erradas.** Quem ler a emenda para navegar o documento erra sempre.
4. **D2.2 × D11 — o buraco do suporte:** D1 manda autoatendimento resolver *"sem abrir
   registro"*; D2.2 exclui `support_tickets` do núcleo e adia seu papel. Então **"preciso de um
   humano e não é disputa/denúncia/emergência/feedback"** (conta bugada, dúvida que a FAQ não
   resolve) não tem destino na taxonomia — enquanto D11 promete que *"a saída humana nunca
   desaparece"*. A promessa de D11 desemboca num destino que D2.2 deixou indefinido. Sobre a
   interpretação de *"englobar todos os módulos"* (Clayton): manter o SUBSTRATO de suporte
   separado é defensável (a porta é una; o substrato é interno) — mas a SUPERFÍCIE precisa da
   linha SUPORTE na tabela de D1, senão a porta única tem um vão.
5. **D3.1 (recusar a lista) — DE PÉ.** Ataquei como "buraco que empurra a decisão para quem
   implementar" e não caiu: a decisão nomeia o GATE (Sequência §1), proíbe enumerar de cabeça
   (anti-C1, lição já paga 2×), e o protocolo da casa exige exatamente isso. É disciplina.
6. **Base mercado × norma, por cláusula:** D1/D3/D6/D10/D11 são observação de mercado convertida
   em regra de produto — legítimo PARA DECISION (decisão cria norma), desde que não colida com a
   Constituição (colisões apontadas acima). D7 e D9 são os únicos que derivam de norma interna
   (PORTA-01/Artigo IX-XII). D4 deriva de anti-abuso implementado (verifiquei). Nenhuma cláusula
   cita regra inexistente — as subordinações do cabeçalho (Lei 7, 07_NOMENCLATURA, §2.2/§2.3.2,
   18_ONTOLOGY) existem todas.

## A TABELA DE EVIDÊNCIA DA 0195 — ATAQUEI E **RESISTIU** (registro a favor)

Conferi **cada linha** de 1ª mão: 4 substratos vivos com 0 linhas (query real) · `reports`/
`report_events`/`risk_flags` = `to_regclass` NULL · `/reports` registrado fora do `protectedScope`
(app.builder.ts ~256) · 401 garantido (`reporting.routes.ts:25-29`) · `module` =
`z.string().min(1)` (`:49`) · `chat_reports` INSERT (`chat-report.repository.ts:55`) · 5/hora e
20/dia (`ReportingPolicy.ts:23,30`) · motor de risco existe (`RiskScoringEngine.ts` é re-export de
`risk-scoring-engine.ts` — um motor, dois arquivos, não é duplicata) · `ModuleContext` em
`module-registry.ts:12` · projeção em `module-projection.routes.ts:4` · `actor_reputation`/
`trust_score_snapshots` existem; os 4 fantasmas de reputação não. **Zero divergência.** O D0 é o
pedaço mais sólido do documento.

---

## CORREÇÕES EXIGIDAS (para virar SELÁVEL)

1. **Escopo da promulgação (Artigo VIII).** Substituir o "Promulga: <os dois arquivos>" do
   cabeçalho por promulgação **cláusula a cláusula**: os 3 bullets de D2 + o modelo de dados
   ESTRUTURAL — e **excluir explicitamente** (ou submeter a emenda constitucional própria):
   risk score por indivíduo, score de denunciante, cálculo on-write e priorização automática de
   fila. Se o motor de risco for desejado, a decisão deve dizer COMO ele respeita "agregadas,
   retardadas, não acionáveis" — ou o Artigo VIII o mata no selo.
2. **D4:** trocar *"NUNCA sabe"* por limite honesto: em operação 1:1 a autoria é inferível por
   construção (Artigo X.2 exige limiares); declarar mitigação (ação retardada/agregada, aviso à
   vítima do risco de inferência) ou aceitar o risco por escrito — decisão de Clayton, não
   default silencioso.
3. **D1:** corrigir "três destinos" → quatro; **adicionar a linha SUPORTE** (ou declarar
   explicitamente onde cai "humano sem ser disputa/denúncia/emergência/feedback"), reconciliando
   com D2.2 e D11.
4. **D1/DISPUTA:** declarar sob **autoridade de quem** executa o estorno prometido (Artigo V.4/
   V.6, 0166 D6) — consentimento do ator executor, e o que acontece quando ele recusa — ou
   nomear a decisão futura que resolverá, admitindo que até lá o desfecho "estorno" é aspiração.
5. **DENÚNCIA/desfechos:** vincular "suspensão/banimento" ao substrato de autoridade existente
   (`authority_roots`/ATL, `08_AUTORIDADE_CANONICA`) — nada de poder de moderação ex nihilo
   (Artigo I.4).
6. **Numeração/consistência interna:** renumerar D11.1/D11.2 → D10.1/D10.2 (ou mover);
   **reescrever o mapa da EMENDA 1** com os números pós-renumeração (5 de 5 estão errados hoje).

## O QUE NÃO AUDITEI (declarado)
- Não li os 6 commits diff-a-diff (só `d4131e0e6` por alegação; os demais pelo estado final em HEAD).
- Não auditei `support_tickets`/`financial_disputes`/`reconciliation_disputes` por dentro (papel,
  reachability) — a própria 0195 os adia para GATE.
- Não validei as telas de Uber/iFood/ML (não tenho as imagens; tomei a descrição como dado).
- Não verifiquei se `AUTHORITY_PRECEDENCE.md §4.4` e `08_AUTORIDADE` cobrem suspensão de actor
  em detalhe — apontei o substrato, não a suficiência normativa dele.

---
*Read-only respeitado. Única escrita: este arquivo.*
