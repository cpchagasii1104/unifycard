# MÉTODO DE ORQUESTRAÇÃO — UnifiCard (canônico · DIRETORA · 2026-06-20)

**Barramento por arquivos.** Toda comunicação entre as instâncias acontece nesta pasta
`docs/orquestracao/`. **Não há relay humano** — Clayton apenas **ativa** cada sessão ("vai");
a IA lê/escreve os arquivos sozinha; a IA-DIRETORA lê tudo direto do disco.

## CARTA DE ACOPLAMENTO (disciplina vinculante — Clayton 2026-06-20)

> **Documentação aqui é MECANISMO DE ACOPLAMENTO, não narrativa.** Doc ruim descreve o sistema
> depois que virou bagunça; doc boa IMPEDE a bagunça antes do código nascer. Este método existe
> para o segundo papel. O papel central da IA-DIRETORA: **garantir que cada feature encaixe na
> engrenagem** — não "fazer features".

**A engrenagem (toda feature tem que encaixar nela):**
`intenção → o grafo entende as necessidades → o sistema encontra quem faz → a autoridade valida
quem pode agir → a agenda filtra quem pode naquele tempo → a oferta define o contratável → o
estado registra a escolha humana → o financeiro liquida pelo ledger → o valor retorna para
região/grupos/indicação.` (= a cadeia causal SEMÂNTICA→IDENTIDADE→AUTORIDADE→TEMPO→ESTADO→FINANCEIRO→EVENTO.)

**As 8 disciplinas (se relaxar, o sistema vira marketplace/CRM/ERP/banco/rede genéricos e desacoplados):**
1. Norma antes de opinião. 2. SSOT antes de tela. 3. Autoridade antes de ação. 4. Tempo antes de
oferta real. 5. Estado antes de dinheiro. 6. Ledger antes de qualquer saldo. 7. Documento como
contrato, não narrativa. 8. Código como materialização, não improviso.

**RISCO Nº 1 = VERDADE PARALELA.** O perigo agora não é falta de ideia — é o mesmo fato ganhar duas
respostas (perfil diz fotógrafo · PJ diz outra · services outra · service_offerings outra · agenda
outro owner · autoridade outra). Se isso acontecer, acaba a confiabilidade. **Toda rodada/fatia da
DIRETORA pergunta antes: isto cria verdade paralela? quem é o SSOT? isto é projeção ou decisão?**
Precedência em conflito: **ATL > KYC > guarda/sistemas > IA > PRODUTO** (produto é a camada mais fraca).

**Sucesso não é garantido** (pode falhar por execução/excesso de escopo/ansiedade/atalho/doc stale).
Mas a arquitetura é adequada e a chance sobe muito **se a disciplina não for traída**: sem atalho,
sem verdade paralela, sem produto passando por cima de autoridade, sem dinheiro fora do ledger, sem
oferta antes de capacidade, sem agenda fora do tempo canônico.

## Execução = CIRURGIA MACRO COM PREVISÃO (não folha-a-folha) — Clayton 2026-06-20

Mobilizar as instâncias + reconstruir contexto custa caro. **Não faz sentido auditar o macro e
depois corrigir só uma folha.** Logo:
- **A AUDITORIA mapeia a engrenagem INTEIRA + os passos futuros** (ex.: Rodada 7 inclui a sombra
  material da IA-COMERCIO de propósito).
- **A CONSOLIDAÇÃO vira BLUEPRINT MACRO:** a linha SSOT inteira + TODAS as verdades paralelas + os
  pontos de acoplamento futuro (presença, material/inventário) — frente desenhada **uma vez**, já
  encaixando o que vem, sem ter que re-auditar e reconstruir contexto depois.
- **A EXECUÇÃO age sobre o MACRO** (converge a coerência inteira, não patch de 1 tabela) e **LAÇA os
  slots** dos próximos passos (pré-acoplamento ARQUITETURAL — não fechar porta que vamos abrir depois).
- **LIMITE (não trai a CARTA nem os guards):** pré-acoplamento é de **DESENHO** (SSOT/contratos prontos
  para os próximos), **NÃO execução prematura**. Dinheiro/autoridade/presença materiais mantêm seu rigor
  **gated** (três paralelas/GO/ChatGPT/Yala) quando chegarem — **planejados dentro do macro**, nunca por
  carona/impulso. **Escopo grande = deliberado + ratificado, nunca improvisado.** A diferença entre
  "cirurgia macro" e "cowboy" é: a macro é mapeada, ratificada e resealada; o cowboy é improviso.

## Verificação BIDIRECIONAL (forward + reverse) — Clayton 2026-06-20

Toda auditoria/consolidação macro roda nos **dois sentidos**:
- **FORWARD (1→N):** dado o que existe, onde leva / o que está acoplado (cadeia causal SEMÂNTICA→…→EVENTO; ou quem-declara→oferta→autoridade→tempo→material→banco). Acha o que **É**.
- **REVERSE (N→1):** partir do **objetivo/end-state** e perguntar, camada por camada para trás, *"para o fim ser verdadeiro e confiável, o que a camada anterior PRECISA garantir — e garante?"*. Acha o que **FALTA** relativo à meta; **prioriza** os achados por impacto no fim (separa GOAL-BREAKER de detalhe); e o reverse das metas **futuras** revela **quais slots deixar prontos agora** (alimenta a "cirurgia macro com previsão").
**Notação de dependência (Clayton):** `1 < 2 < 3 < 4` — o `<` = "DEPENDE DE / é sustentado por". O 4 não é verdadeiro sem o 3; o 3 sem o 2; o 2 sem o 1. É **fundação load-bearing**: uma **rachadura numa camada inferior PROPAGA para cima e colapsa o topo**, mesmo que o topo pareça ok (ex.: capacidade declarada sem autoridade = rachadura na camada 2 → o "dinheiro/evento" da camada 4 fica construído sobre areia). Por isso uma falha de fundação é **GOAL-BREAKER/BLOCKER**, não cosmético: pela ordem do `<`, não se empilha as camadas de cima enquanto as de baixo não sustentam o peso.
**Regra:** o forward sozinho lista; o reverse decide a SEVERIDADE e a ORDEM (consertar a fundação ANTES de empilhar). Quanto mais dado cruzado, mais o reverse importa (um buraco passa se só se olha num sentido). A consolidação de toda rodada macro entrega as duas leituras.

## JANELA VIRGEM DE BAIXO CUSTO — correção PROVADA executa AGORA (Clayton 2026-06-20; ratificado ChatGPT 2026-06-21)

O sistema está **virgem**: sem usuários reais, sem dado real (estoque/dinheiro/empresas/transações). O custo de
uma cirurgia **ESTRUTURAL** é **BAIXO agora** (0 rows, sem backfill, sem ruptura) e **dispara** depois que dados/
usuários chegarem. São **"defeitos de planta-baixa, sem vítimas"** (registrado no G10) — barato de corrigir agora.
**A janela fecha uma vez só. MAS "barato" ≠ "executar tudo junto"** (guard ChatGPT): fatiar e ratificar. Termo
correto = **janela virgem de baixo custo**, nunca "grátis". Regra:
- Quando a auditoria **PROVA** que algo interligado está errado, a correção entra na **cirurgia MACRO agora** —
  **não se adia** para frente futura (que será cara). Reavaliar a cada resposta; já marcar o corrigível.
- **Não trai os guards:** a correção é **provada** (não impulso) + **ratificada** (ChatGPT) + **resealada** (Yala);
  dinheiro/autoridade seguem **gated** (três paralelas), mas **FEITOS agora** (virgem = barato), não deferidos.
  Muda o **escopo** (fundo, não folha) e o **timing** (agora), nunca a segurança. "Já corrigir" = escopar a
  correção provada no próximo executável; **nunca cowboy**.
- **O CUSTO de cada cirurgia = prova-viva da IA-BANCO** (rowcount): tabela vazia → **baixo custo** corrigir; com
  dados → mais cuidado, mas sem usuário real. A prova-viva decide se a janela está aberta para aquela correção.

## DISCIPLINA DE FECHAMENTO (regra dura — Clayton 2026-06-21)

Contra os 2 vícios (pinball de frentes · profundidade sem corte): **menos "descubra tudo", mais "pegue o elo, prove o bloqueador, corrija, teste, promulgue, próximo elo".**

**Todo ciclo termina em EXATAMENTE 1 de 4 resultados** (qualquer outra coisa = RUÍDO):
1. **FECHOU** bloqueador material. 2. **PROVOU que NÃO é** bloqueador. 3. **GEROU decisão pendente** para Clayton. 4. **PAROU por falta de evidência.**

**Profundidade tem corte:** auditar até o **bloqueador material**, não até a iluminação. A IA sempre acha mais (fóssil, cano, endpoint órfão de 2023) — o corte é no bloqueador, depois gate + promulga + segue.

**Gate de ABERTURA de frente** — nenhuma frente nova sem responder as 4:
- Que **fluxo real ponta-a-ponta** isto destrava? (se não aproxima, é dívida lateral, não frente)
- Que **risco material** reduz?
- Que **teste/gate** provará o fechamento?
- Que **arquivo/norma/SSOT** governa?

**PREFLIGHT obrigatória ANTES de abrir frente/fatia (Clayton 2026-06-21):** `git status --short` e classificar o dirty —
**NOSSO** (código/migration/guard/cartório/decisão da frente) sujo = **STOP** (resolver/commitar antes de abrir); **loose/
memórias/opus/PNGs/outputs de outras frentes** = declarar **FORA do escopo** (nunca arrastar; protegidos `clayton.md`/
`dividas.md`/`CRIACAO_DE_EMPRESAS.md`/`*.png` jamais tocados). Abrir só com NOSSO limpo.

**Selo final = EVIDÊNCIA, não consenso de IA.** "Outra IA concordou" é parecer. Selo = teste passou · guard passou · schema confere · runtime confere · fluxo real confere · norma confere · commit limpo.

**Contrato de saída rígido por instância:** ao ativar uma IA, ela recebe escopo · proibições · arquivos-alvo · critério PASS/FAIL · evidência obrigatória · o que NÃO pode fazer. Sem isso vira consultor tagarela (= dívida técnica em português bonito).

## MODOS DE EXECUÇÃO (pacote causal seguro) + PROMULGAÇÃO CONDICIONAL — Clayton 2026-06-21

A régua **não** é "uma coisinha por vez" — é **executar por PACOTE CAUSAL SEGURO**: tudo que pertence ao **mesmo
elo**, tem o **mesmo risco**, os **mesmos gates** e **não invade outro pilar** pode ir junto. O ping-pong fino foi
útil para acertar a espinha; agora acelera sem virar bagunça.

**3 modos (a IA-DIRETORA declara qual no GO; ChatGPT confirma):**
- **MODO A — CIRÚRGICO:** frente pequena/local → executa + YALA + commit material + commit cartorial em **um ciclo**. (ex.: conter rota ghost + guard.)
- **MODO B — PACOTE CAUSAL:** uma fatia **inteira do mesmo elo**, com checkpoints internos (PF+PJ+negative-proofs+guards+e2e juntos), desde que **não entre outro pilar**. (ex.: F-OFFER-2B runtime.)
- **MODO C — ALTO RISCO:** dinheiro/payout/recovery/presença/authority-grants/operador-delegado/service_order → decisão separada + YALA separada + **promulgação MANUAL** de Clayton. Ping-pong forte mantido.

**PROMULGAÇÃO CONDICIONAL (só MODO A/B; pré-autorizada por Clayton no GO — NÃO é auto-autorização):**
A executora commita (material + cartório de fechamento) **sem nova ida-e-volta** SE E SÓ SE, cumulativamente:
1. **IA-YALA = PASS**; 2. **staged = EXATAMENTE os arquivos autorizados no GO** (`git diff --cached --name-only` conferido); 3. **todos os gates do GO PASS**.
Se **qualquer** condição falhar → **STOP, não commita, volta a Clayton**. O commit cartorial de fechamento
(STATUS/CONSOLIDADO da própria fatia) entra sob a mesma pré-autorização. **MODO C nunca usa condicional — sempre manual.**

## Estrutura da pasta
```
docs/orquestracao/
  README.md        ← SISTEMA/ciclo de vida dos documentos (ler primeiro; etapa fechada → _arquivo).
  METODO.md        ← este protocolo. Só a IA-DIRETORA escreve.
  INBOX.md         ← tarefas/rodadas endereçadas. Só a IA-DIRETORA escreve.
  CONSOLIDADO.md   ← estado vivo consolidado. Só a IA-DIRETORA escreve.
  respostas/
    IA-BANCO.md · IA-ACTOR.md · IA-AUTORIDADE.md · IA-SEMANTICA.md · IA-TEMPO.md ·
    IA-OFERTA.md · IA-COMERCIO.md · IA-DINHEIRO.md · IA-LOGISTICA.md ·
    IA-DOCUMENTOS.md · IA-DECISOES-DT.md · IA-YALA.md
    → cada IA escreve SÓ no próprio arquivo (append-only). Cria se não existir.
  _arquivo/        ← rodadas fechadas (a IA-DIRETORA move para cá).
```

## Regra espacial (anti-bagunça — agora trava física)
- `INBOX.md` / `CONSOLIDADO.md` / `METODO.md` = **só a IA-DIRETORA**.
- `respostas/IA-<X>.md` = **só aquela IA**. Arquivos distintos → impossível colidir.
- Ninguém edita arquivo alheio, nem código/cartório.

## Papéis (13 instâncias)
- **IA-DIRETORA** (direção+execução): posta tarefas, consolida, monta GO, executa código sob ciclo.
- **11 especialistas READ-ONLY:** IA-ACTOR · IA-AUTORIDADE · IA-SEMANTICA · IA-TEMPO · IA-OFERTA ·
  IA-COMERCIO · IA-DINHEIRO · IA-LOGISTICA · IA-BANCO · IA-DOCUMENTOS · IA-DECISOES-DT.
  Mapeiam/classificam/alertam; escrevem só `respostas/IA-<X>.md` + a própria memória.
- **IA-YALA:** verificadora adversarial; resela o que a executora entrega.
- **Clayton:** promulga + ativa sessões. **ChatGPT:** ratifica o GO (independente).

## Ciclo de trabalho
1. IA-DIRETORA posta tarefa em `INBOX.md` (endereçada por nome).
2. Clayton ativa a sessão da IA: **"vai"**.
3. A IA: lê `METODO.md` + sua tarefa em `INBOX.md` → **revalida no disco** (HEAD vivo) →
   escreve o **resultado carimbado** em `respostas/IA-<X>.md`. **Não responde no chat.**
4. IA-DIRETORA lê os arquivos, atualiza `CONSOLIDADO.md`, decide o próximo passo.
5. **Execução de código:** IA-DIRETORA monta GO → **ChatGPT ratifica** → executora roda 1 fatia
   → **IA-YALA resela** → **Clayton promulga**. Nada executa fora desse ciclo.

## Ciclo ADAPTATIVO-SEQUENCIAL (DEFAULT para rodadas com dependência) — Clayton 2026-06-20
Quando uma rodada tem **múltiplas instâncias cujas análises se informam** (a resposta de uma afia a
pergunta da próxima), a IA-DIRETORA **NÃO** dispara os prompts todos de uma vez. Em vez disso:
1. Dispara **a 1ª instância** (a que reduz mais incerteza — ex.: quem declara antes de quem oferta;
   prova-viva de schema por último).
2. Clayton diz **"próximo"** = a instância anterior **já respondeu**.
3. A IA-DIRETORA **LÊ a resposta** dela e só então **escreve o prompt da próxima JÁ INFORMADO** pelos
   achados (cross-checks específicos: "a IA-X achou A e B — isto reconcilia ou cria verdade paralela?").
4. Repete pela cadeia; a última instância recebe o prompt mais cirúrgico (tudo que as anteriores
   sinalizaram). A IA-DIRETORA **consolida progressivamente**, não só no fim.
**Razão:** um sistema é lógica estruturada — a ordem da investigação segue a cadeia de dependência.
**Exceção:** rodadas de análise **genuinamente independente** (ex.: re-baseline por eixo, onde cada
um só mapeia o próprio domínio) podem ir em paralelo; a IA-DIRETORA declara quando uma rodada é
paralela-independente. Na dúvida → adaptativo-sequencial.

## Carimbo obrigatório em toda resposta (disco vence narrativa)
`HEAD no momento` · `revalidou no vivo (sim/não/parcial)` · `fonte (arquivo:linha/DECISION/tabela)`
· `Status (RESPONDIDO/STALE/INCONCLUSIVO)`.

## O que NÃO trafega aqui
Código, migration, banco, frontend, cartório oficial (`REMEDIATION_*`/`STATUS`/`opus`/
`docs/01_normative/`/`docs/02_decisions/`) — só a executora, **sob GO**; especialistas nunca.
Análise = **INSUMO**, nunca GO.

## Gatilho único (Clayton, do celular — colar na sessão da IA)
```
vai: leia docs/orquestracao/METODO.md e sua tarefa em docs/orquestracao/INBOX.md; revalide o HEAD VIVO no disco de 1ª mão (nunca confie em hash citado — pode estar stale); escreva sua resposta em docs/orquestracao/respostas/IA-<SEU-NOME>.md (crie se não existir; não no chat); carimbe o HEAD que você verificou.
```
**Vocabulário operacional (mobile-otimizado, Clayton 2026-06-20) — a quem cada palavra é dirigida:**
- **"vai"** → colado na sessão da **ESPECIALISTA** (ativa ela; ela lê INBOX + responde no arquivo).
- **"próximo"** → dito para a **IA-DIRETORA**: a instância anterior respondeu → a DIRETORA lê o
  `respostas/IA-<X>.md` e entrega o próximo prompt JÁ INFORMADO (ciclo adaptativo-sequencial).
- **"consolida"** → dito para a **IA-DIRETORA**: todas responderam → a DIRETORA monta a matriz final
  e decide GO ou HOLD.

> Histórico: a Rodada 1 (re-baseline) foi respondida no §14 de
> `PLANO_ORQUESTRACAO_SISTEMICA_UNIFICARD.md` e está consolidada em `CONSOLIDADO.md`.
> Da Rodada 2 em diante o barramento é esta pasta.
