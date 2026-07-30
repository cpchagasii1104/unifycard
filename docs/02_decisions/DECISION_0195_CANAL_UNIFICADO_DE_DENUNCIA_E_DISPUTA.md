# DECISION-0195 — CANAL UNIFICADO DE DENÚNCIA E DISPUTA (duas portas, um núcleo de moderação)

**Data:** 2026-07-30 · **Status:** ⚠️ **NÃO-SELADA — redigida pela direção, aguarda ratificação de Clayton.** Não é autoridade citável até o selo.
**Modo:** **DOCS-ONLY** · ZERO código, migration, guard ou banco. Não cria tabela, não conserta rota, não aposenta módulo.
**Origem:** diretiva de Clayton, 2026-07-30 — *"englobar todos os módulos pra dentro de um único canal unificado de denúncia… selecionar qual que é a questão específica pra poder abrir o chamado naquele serviço, naquela entrega, naquele produto"* + *"vamos adotar modelos de empresas Enterprise já conceituadas no mercado, como Uber, iFood, Mercado Livre"*.
**Promulga:** `docs/99_archive/to_review/REPORTING_CORE.md` e `REPORTING_DATA_MODEL.md` — redigidos, nunca promulgados.

> ### 📝 EMENDA 1 — 2026-07-30, mesma sessão, ANTES do selo
> Clayton mostrou à direção as telas reais de **Uber (app do motorista)**, **Mercado Livre** e
> **iFood**. A observação do mercado **derrubou três coisas que a direção tinha escrito** e
> revelou um destino que ela não havia enxergado. Registrado assim, e não reescrito em
> silêncio, porque **a correção veio do dono mostrando como o mercado resolve — não da direção
> ter percebido sozinha**:
> - **D1 estava errado na forma.** A direção escreveu "duas portas" como se o usuário
>   escolhesse entre disputa e denúncia. Nenhuma das três empresas pergunta isso. → reescrito.
> - **D3 tratava a âncora como campo.** É **contexto de navegação**. → corrigido.
> - **D3.2 colapsava dois eixos** num `module` só. → separado.
> - **Faltava um destino inteiro: EMERGÊNCIA.** → novo D6.
> - Novos por observação: **D7** (autoatendimento), **D8** (assistente sem autoridade
>   própria — o achado mais perigoso), **D9** (evidência), **D10** (saída humana sempre visível).
**Subordinada a:** Lei 7 (identidade semântica) · `07_NOMENCLATURA_CANONICA.md` · `00_AGENT_PROTOCOL §2.2/§2.3.2` · `18_DOMAIN_ONTOLOGY_UNIFICARD.md`.

---

## D0 — O PROBLEMA: cinco verdades sobre "o usuário reclamou", e nenhuma funciona

Verificado de 1ª mão pela direção em 2026-07-30, contra o `unificard_dev`:

| substrato | tabela | linhas | estado |
|---|---|---|---|
| `modules/support-tickets` | `support_tickets` | **0** | vivo |
| `modules/live-chat` | `chat_reports` | **0** | vivo |
| `modules/disputes` | `financial_disputes` | **0** | vivo |
| `modules/reconciliation` | `reconciliation_disputes` + `_events` | **0** | vivo |
| `core/reporting` | `reports` · `report_events` · `risk_flags` | — | **tabelas NÃO EXISTEM** |

E o núcleo que deveria reger tudo isso **está morto por dois motivos independentes**:

1. **Escopo.** `app.builder.ts:257` registra `/reports` **fora** do `protectedScope`. Os plugins que populam `req.user` e `req.tenant` são registrados **exclusivamente dentro** dele (`app.builder.ts:289-292`). O `preHandler` de `reporting.routes.ts:25-29` exige os dois campos → **todo request recebe 401**.
2. **Substrato.** As três tabelas não existem no banco e **não estão nem no manifesto do REBASE-03** (`MIGRATIONS_ARCHIVE_MANIFEST.md`) — nunca foram criadas em lugar nenhum.

🔴 **O canal de denúncia de fraude, abuso, assédio e falsidade ideológica do UnifiCard não funciona.** Falha FECHADA (401), portanto não é buraco de segurança — é funcionalidade de segurança **inexistente**.

### A regra já existia, e já foi violada

`REPORTING_CORE.md` estabelece, com todas as letras:

> *"Denúncia não pertence ao módulo denunciado. O módulo denunciado emite eventos para o Core de Denúncias."*
>
> *"Qualquer feature que crie 'denúncia própria do módulo' **viola este core e deve ser rejeitada**."*

`chat_reports` (`modules/live-chat/chat-report.repository.ts:55`) é exatamente a feature que a regra proíbe. A violação já aconteceu — mas o documento **nunca foi promulgado**, então não havia norma para invocar. Os dois arquivos trazem `Status: Ativo` no cabeçalho e vivem em `docs/99_archive/to_review/`: **o local contradiz o cabeçalho**, e prevaleceu o local.

### 🟢 A janela: todos os quatro estão em ZERO

**Nenhuma reclamação real foi registrada ainda.** Convergir hoje é reorganizar código vazio. Depois da primeira denúncia real, convergir significa **migrar prova de assédio e de fraude** entre substratos — o que carrega risco jurídico, de privacidade e de perda de evidência. **Esta decisão existe porque a janela está aberta e vai fechar sozinha.**

---

## D1 — UMA PORTA PARA O USUÁRIO, TRÊS DESTINOS PARA DENTRO

**O usuário nunca escolhe entre "disputa" e "denúncia". Ele diz que teve um problema, e o
sistema roteia.** Nenhuma das três empresas observadas pergunta isso — porque o usuário não
conhece, nem deve conhecer, a taxonomia interna da plataforma.

A superfície é **uma só: AJUDA.** É o nome nas três (Uber *"Ajuda"*, ML *"Como podemos te
ajudar?"*, iFood *"AJUDA"*). No iFood, *"Sofri uma agressão física"* e *"Valor foi cobrado
duas vezes"* vivem **no mesmo acordeão, na mesma tela do mesmo pedido**.

**Por dentro, três destinos — e eles não se misturam:**

| destino | o que é | desfecho | SLA |
|---|---|---|---|
| **DISPUTA** | problema na operação | dinheiro: estorno, refazer, cancelar, mediação | comercial |
| **DENÚNCIA** | conduta, conteúdo, identidade | moderação: remoção, suspensão, banimento | de segurança |
| 🔴 **EMERGÊNCIA** | risco à integridade física ou à vida | **escalonamento imediato — NÃO é fila** | imediato |

> **D1.1 — O roteamento é do SISTEMA, derivado do assunto e do alvo. Nunca é pergunta ao
> usuário.** Ele escolhe o que aconteceu com ele, em linguagem dele; a classificação interna é
> consequência.

> **D1.2 — Fundir os destinos é PROIBIDO.** Quem trata estorno não é quem trata assédio.
> Reclamação de atraso na fila de Trust & Safety atrasa resposta a caso de violência — é
> exatamente isso que a separação impede.

> ### 🔴 D1.3 — EMERGÊNCIA NÃO É TICKET
> Revelado pela tela *"Segurança e Emergência"* do iFood, que lista lado a lado
> *"sofri violência sexual"*, *"sofri agressão física"*, *"sofri ameaça"*, *"saúde ou acidente
> do entregador"*. **Isso não pode entrar numa fila com SLA comercial nem esperar triagem
> automática.** Emergência tem caminho próprio, prioridade absoluta e escalonamento humano
> imediato. Registrar e enfileirar um relato de violência é falha de produto com consequência
> real sobre uma pessoa.

> ### D1.4 — A TAXONOMIA É ESCRITA NA PRIMEIRA PESSOA DA VÍTIMA
> O iFood escreve *"Sofri uma agressão verbal"*, não *"Denunciar conduta inadequada"*.
> **Quem acabou de sofrer violência não procura a palavra "denúncia" num menu** — procura o
> que aconteceu com ela. A superfície fala a língua de quem chega; a classificação interna é
> problema da plataforma, não do usuário.

> **D1.5 — Uma operação pode gerar mais de um registro.** Uma corrida pode render disputa de
> valor **e** denúncia de conduta. São registros independentes: **cancelar a disputa nunca
> arquiva a denúncia**, e receber o estorno não encerra a apuração.

---

## D2 — O DESTINO DENÚNCIA TEM UM NÚCLEO ÚNICO, E MÓDULO NÃO CRIA O SEU

**O Reporting Core (`core/reporting`) é o SSOT de denúncia.** Fica promulgado o que `REPORTING_CORE.md` já dizia:

- Módulo denunciável **emite para o núcleo**. Não cria tabela própria, não cria fila própria, não cria status próprio.
- Toda denúncia, de qualquer módulo, nasce e vive em `reports` / `report_events` / `risk_flags`.
- **Qualquer PR que introduza denúncia própria de módulo é BUG por definição** e deve ser recusado na revisão.

**D2.1 — `chat_reports` é aposentado para dentro do núcleo.** É a violação nomeada em D0, tem **0 linhas**, e portanto o custo de aposentar é zero. ⚠️ A execução material da aposentadoria exige **autorização explícita de Clayton** (CLAUDE.md §5, deleção de módulo pré-existente) — **esta decisão não a concede**; declara o destino, não executa.

**D2.2 — `support_tickets` NÃO é denúncia e NÃO entra no núcleo.** Suporte é uma terceira coisa (*"como faço para…"*), que Uber e iFood também mantêm separada. Fundir suporte com Trust & Safety parece limpeza e é perda de papel. Seu papel próprio deve ser declarado em decisão própria; até lá permanece como está.

---

## D3 — A AJUDA ANCORA NA OPERAÇÃO, E O VOCABULÁRIO É COMPOSTO, NUNCA ENUMERADO

A extensão de Clayton sobre o desenho arquivado: o documento original ancora na **entidade** (`DRIVER`, `PROVIDER`, `COMPANY`), com `TRANSACTION` marcado *"(futuro)"*. **Fica decidido que a AJUDA ancora na OPERAÇÃO CONCRETA**, e a entidade é **derivada** dela.

Razão registrada — não é preferência estética:
- **A denúncia nasce com prova.** Ancorada na operação, carrega quem, quando, quanto, qual pedido. Ancorada na entidade, é palavra contra palavra.
- **Mata a denúncia genérica.** Selecionar qual corrida impede reclamar de alguém por antipatia.
- **O motor de risco melhora.** Correlação por operação revela padrão que correlação por entidade não vê.

> ### 🔴 D3.1 — O VOCABULÁRIO DE OPERAÇÕES É **COMPOSTO** DO QUE JÁ EXISTE
>
> **É PROIBIDO escrever à mão uma lista de tipos de operação.** Esse é exatamente o erro do C1 registrado em `dividatecnica.md` — *inventar vocabulário paralelo em vez de compor do governado*. O vocabulário de operações do UnifiCard já existe no schema vivo e nas normas; a lista canônica sai de **GATE read-only próprio**, não desta decisão e não da cabeça de quem implementar.
>
> **Esta decisão fixa a REGRA e recusa-se deliberadamente a fixar a LISTA.**

> ### D3.2 — A ÂNCORA É CONTEXTO DE NAVEGAÇÃO, NÃO CAMPO DE FORMULÁRIO
> O usuário **não digita** qual corrida. Ele **chega pela corrida**. Nas três empresas o alvo
> está fixo no topo da tela como contexto: Uber prende *"Viagem concluída: 15:51 · 21.61 km"*
> no topo do chat; iFood abre a Ajuda com o carrossel **"Últimos pedidos"**, cada card com
> **"Ajuda com este pedido"**. `target_id` é **carregado pela navegação**, nunca preenchido.
>
> Ajuda **sem** operação continua existindo (conta, privacidade, políticas) e cai nas
> categorias gerais.

**D3.3 — São DOIS EIXOS, e colapsá-los foi erro da direção.**

| eixo | o que é | quem entende | governança |
|---|---|---|---|
| `module` | origem interna do fato | plataforma | **enum governado**, composto no GATE de D3.1 |
| **assunto** | do que o usuário acha que se trata | usuário | **projeção**, não enum global |

Hoje `module` é `z.string().min(1)` (`reporting.routes.ts`) enquanto `REPORTING_DATA_MODEL.md`
manda ENUM: **texto livre nunca é identidade** (Lei 7). Isso se corrige no eixo interno.

Mas o eixo do usuário **não é enum estático**. As telas provam: a Uber do **motorista** mostra
*Ganhos · Parceria de veículos · Esqueci de terminar a viagem* — taxonomia que não existe para
o passageiro. O Mercado Livre chama de **"Atalhos personalizados"** e os deriva do estado
daquele usuário. **É projeção do contexto do Actor**, que já é doutrina deste projeto —
não é sistema novo a inventar.

> ### 🔴 D3.4 — MODO (CONSUMIR × OPERAR) É **DERIVADO**, NUNCA UM ENUM NOVO
> Diretiva de Clayton, 2026-07-30: *"o unificard vai ter que se adaptar de acordo com o Actor
> e modo consumir ou operar"*.
>
> Prova nas telas: o **mesmo produto** projeta a **mesma viagem** de formas diferentes. O card
> do motorista traz *"Viagem concluída 15:51 · Wait & Save · 21.61 km"* (métrica operacional);
> o card do passageiro traz *"Rua Carlos Amoretty Osório · 28 de jun · R$ 8,39"* (endereço e
> preço). Mesmo fato, projeções distintas — e taxonomias de ajuda distintas.
>
> **Verificado de 1ª mão pela direção antes de escrever esta cláusula:**
> - O eixo governado hoje é `ModuleContext = 'personal' | 'company'`
>   (`core/navigation/module-registry.ts:12`). **Não é este eixo** — consumir × operar é
>   **ortogonal** a PF × empresa: uma PF consome *e* pode operar.
> - Existe substrato de autoridade completo: `actor_capability_grants`
>   (`capability_key`, `scope_type`, `status`, `valid_from/until`, `authority_source`) +
>   `actor_capability_grant_events`.
>
> **FICA DECIDIDO — modo NÃO vira campo, flag nem terceiro enum:**
> - **CONSUMIR é o baseline.** Todo Actor consome; não precisa de concessão.
> - **OPERAR é DERIVADO** do que o Actor efetivamente tem — capability concedida, oferta ativa,
>   vínculo — e é **por vertical**, não global. O mesmo Actor pode operar em mobilidade e
>   apenas consumir em marketplace, e a Ajuda tem de refletir isso.
> - Criar `modo` como coluna ou enum é **PROIBIDO**: seria a quarta verdade sobre autoridade,
>   ao lado de `PermissionKey`, `capability` e `grant`, e divergiria em silêncio.

> ### 🔴 D3.5 — A AJUDA PROJETA DO MESMO REGISTRY QUE O MENU
> `core/navigation/module-projection.routes.ts:4` já promulga: *"O menu é **PROJEÇÃO, nunca
> autoridade**: considera contexto (PF/empresa), vínculo"*. Existe `MODULE_REGISTRY` com
> `contexts`, `ModuleStatus` (`LIVE`/`STUB`/`TOMBSTONE`) e `liveEntriesForContext()`.
>
> **A superfície de Ajuda é PROJEÇÃO DA MESMA FONTE.** Não se cria registry paralelo de
> tópicos.
>
> **Consequência dura, e é o ponto:** módulo que não está `LIVE` para o seu contexto **não
> aparece no menu E não aparece na Ajuda**. Se aparecesse, o usuário poderia abrir chamado
> sobre função que não existe para ele — e a plataforma estaria dizendo duas coisas
> diferentes sobre o mesmo sistema, na mesma sessão. **É a doença das duas verdades chegando
> na cara do usuário.**

---

## D4 — IDENTIFICADO PARA A PLATAFORMA, ANÔNIMO PARA O ACUSADO

Padrão de Uber, iFood e Mercado Livre, e resolve a tensão real entre proteção da vítima e anti-abuso:

- **Denúncia exige usuário autenticado.** Sem `reporter_user_id` não há anti-spam (a política de 5/hora e 20/dia de `policies/ReportingPolicy.ts` é por reporter), não há reputação de denunciante, e não há como agir juridicamente.
- **O denunciado NUNCA sabe quem denunciou.** Nem no ticket, nem na resposta, nem em metadado exposto. Anonimato é **em relação ao acusado**, não em relação à plataforma.
- Permanece valendo a regra de privacidade já escrita: *"CPF / endereço / dados pessoais nunca aparecem no ticket público"*.

⚠️ **Consequência aceita e declarada:** não existe denúncia anônima na v1. Se Clayton quiser canal anônimo para assédio grave, é **decisão própria futura** — e terá de resolver o anti-abuso por outro mecanismo, porque o atual depende da identidade do denunciante.

---

## D6 — AUTOATENDIMENTO ANTES DO CHAMADO

Ordem obrigatória na superfície, observada nas três: **busca → artigo/política → opção pronta
→ texto livre**. O ML lidera com campo de busca preditiva; a Uber com grade de categorias; o
iFood com o pedido recente e opções contextuais. Em todas, **texto livre é o último recurso**.

Isso **não é UX**: é a política anti-abuso agindo na entrada, e é o que torna o volume
tratável sem afrouxar nada. Opção pronta também **classifica sozinha**, eliminando triagem
manual do caso comum.

⚠️ **D6.1 — Autoatendimento NUNCA se aplica ao destino EMERGÊNCIA (D1.3).** Ninguém que
sofreu violência deve ser recebido por artigo de FAQ.

---

## D7 — 🔴 O ASSISTENTE NÃO TEM AUTORIDADE PRÓPRIA

O ML oferece **"Devolver uma compra"** dentro do assistente; o iFood oferece **"Habilitar
reembolso em Saldo iFood"** dentro da ajuda do pedido. **São operações de dinheiro executadas
de dentro do canal de ajuda.**

> **Um assistente que executa devolução está movimentando dinheiro. Se ganhar caminho próprio,
> a AJUDA vira BYPASS DA PORTA-01.**

É exatamente a classe de defeito que este repositório passou meses cercando: firewall no sink
de pagamento, tripwire no split-engine legado, deny estrutural de sete chaves em
`PORTA_HOLD_KEYS`. Um canal de ajuda com IA chegaria **por fora de tudo isso**, porque "é só
suporte".

**FICA DECIDIDO:** o assistente **COMPÕE** das operações canônicas existentes — mesma rota,
mesmo writer, mesmo gate, mesma PORTA. Se a devolução está represada no fluxo normal, está
represada na ajuda. **Zero caminho novo para dinheiro. Zero exceção "porque é suporte".**

---

## D8 — EVIDÊNCIA É NATIVA E MULTIMODAL

Foto e áudio no próprio campo de entrada (ML: câmera + microfone). Para disputa e denúncia é
decisivo — foto do produto avariado, print da conversa, áudio da ameaça.

Sujeito às regras de privacidade **já escritas** em `REPORTING_CORE.md`: evidência pertence ao
**caso**, nunca ao ticket visível ao denunciado; *"CPF / endereço / dados pessoais nunca
aparecem no ticket público"*.

---

## D9 — DISCLOSURE DE IA É OBRIGATÓRIO

O ML declara em texto fixo: *"Este assistente usa inteligência artificial para te responder."*
**Havendo triagem, sugestão ou resposta automática, o usuário é informado.** Vale também para o
motor de risco (`core/reporting/ai/risk-scoring-engine.ts`), coerente com a regra já escrita de
que **nenhuma denúncia gera punição automática**.

**D9.1 — A resposta automática é avaliável.** A Uber põe 👍/👎 em cada resposta do assistente.
Sem isso não há como medir se a triagem automática está ajudando ou empurrando o usuário para
o texto livre — e um assistente ruim que ninguém mede vira barreira de acesso ao suporte,
não atalho.

---

## D10 — A SAÍDA HUMANA NUNCA DESAPARECE

No iFood o ícone de fone de ouvido está **em todas as telas** de ajuda; no ML, *"Fale conosco"*
fica ao pé da página. Autoatendimento vem primeiro (D6), **mas o contato humano nunca fica
atrás de seis cliques nem some da tela**. Canal de segurança que esconde o humano deixa de ser
canal de segurança.

---

## 🚧 LIMITES — O QUE ESTA DECISÃO **NÃO** AUTORIZA

Docs-only, e o limite é duro:

- ❌ **Não cria tabela.** As três tabelas de `REPORTING_DATA_MODEL.md` seguem inexistentes até GATE + GO material próprios.
- ❌ **Não conserta o escopo** de `/reports`. O 401 permanece até fatia própria.
- ❌ **Não apaga `chat_reports`** nem nada. D2.1 declara destino; execução exige autorização explícita de Clayton.
- ❌ **Não fixa a lista de tipos de operação** (D3.1) nem o enum de `module` (D3.2) — ambos saem de GATE.
- ❌ **Não toca `support_tickets`**, `financial_disputes` nem `reconciliation_disputes`.
- ❌ **Não abre PORTA-1** e não movimenta dinheiro. O destino DISPUTA *desemboca* em estorno, mas o mecanismo financeiro segue sob as travas vigentes — e **D7 proíbe explicitamente** qualquer caminho novo.
- ❌ **Não cria assistente, não liga IA, não define fluxo de emergência.** D6 a D10 fixam **regras** para quando isso for construído; nenhuma delas autoriza construir.

---

## 🧾 EVIDÊNCIA — tudo verificado de 1ª mão pela direção, 2026-07-30

| afirmação | prova |
|---|---|
| 4 substratos vivos, todos vazios | query em `unificard_dev`: `support_tickets` 0 · `chat_reports` 0 · `financial_disputes` 0 · `reconciliation_disputes` 0 |
| `reports`/`report_events`/`risk_flags` não existem | `to_regclass` NULL nos três; ausentes do `MIGRATIONS_ARCHIVE_MANIFEST.md` |
| `/reports` fora do escopo protegido | `app.builder.ts:257` × `app.builder.ts:289-292` |
| 401 garantido | `reporting.routes.ts:25-29` exige `req.tenant?.id` e `req.user?.id` |
| `module` é texto livre | `reporting.routes.ts`, `z.string().min(1)` |
| denúncia própria de módulo já existe | `modules/live-chat/chat-report.repository.ts:55` |
| núcleo já tem política anti-abuso implementada | `core/reporting/policies/ReportingPolicy.ts` — 5/hora, 20/dia |
| núcleo já tem motor de risco | `core/reporting/ai/risk-scoring-engine.ts` |
| normas existiam e nunca foram promulgadas | `docs/99_archive/to_review/REPORTING_CORE.md` e `REPORTING_DATA_MODEL.md`, cabeçalho `Status: Ativo`, local `99_archive` |

---

## 🧭 SEQUÊNCIA APÓS O SELO (nenhum passo autorizado por esta decisão)

1. **GATE read-only** — vocabulário de operações (D3.1) e enum de `module` (D3.2), compostos do governado.
2. **GATE read-only** — reachability e destino de `chat_reports`; papel de `support_tickets`.
3. **GO material** de Clayton → migration relocada de `REPORTING_DATA_MODEL.md` (relocação, não autoria: colunas, enums e 6 índices já especificados).
4. **Fatia de escopo** — `/reports` passa a viver onde `req.user` e `req.tenant` existem.
5. **Guard** — anti-revival de denúncia própria de módulo, com prova vermelha.

⚠️ **Enquanto o selo não vier, isto é proposta.** Citar como autoridade antes disso repete o erro dos dois selos falsos de 2026-07-28.
