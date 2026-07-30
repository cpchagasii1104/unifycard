# DECISION-0195 — CANAL UNIFICADO DE DENÚNCIA E DISPUTA (duas portas, um núcleo de moderação)

**Data:** 2026-07-30 · **Status:** ⚠️ **NÃO-SELADA — redigida pela direção, aguarda ratificação de Clayton.** Não é autoridade citável até o selo.
**Modo:** **DOCS-ONLY** · ZERO código, migration, guard ou banco. Não cria tabela, não conserta rota, não aposenta módulo.
**Origem:** diretiva de Clayton, 2026-07-30 — *"englobar todos os módulos pra dentro de um único canal unificado de denúncia… selecionar qual que é a questão específica pra poder abrir o chamado naquele serviço, naquela entrega, naquele produto"* + *"vamos adotar modelos de empresas Enterprise já conceituadas no mercado, como Uber, iFood, Mercado Livre"*.
**Promulga:** `docs/99_archive/to_review/REPORTING_CORE.md` e `REPORTING_DATA_MODEL.md` — redigidos, nunca promulgados.
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

## D1 — SÃO DUAS PORTAS, E ELAS NÃO SE FUNDEM

Padrão convergente de Uber, iFood e Mercado Livre — adotado por diretiva de Clayton:

| | **PORTA A — DISPUTA** | **PORTA B — DENÚNCIA** |
|---|---|---|
| pergunta do usuário | *"deu problema no meu pedido"* | *"isto não deveria existir na plataforma"* |
| âncora | **a operação** (corrida, entrega, pedido, serviço) | conteúdo, perfil, anúncio, conduta |
| exige ter contratado? | **sim** — é sobre a sua operação | **não** |
| desfecho | dinheiro: estorno, refazer, cancelar, mediação | moderação: remoção, suspensão, banimento |
| SLA | comercial | **de segurança** |
| exemplo de mercado | iFood *"Ajuda com o pedido"* · Uber *"Get help with a trip"* · ML *"Abrir reclamação"* | ML *"Denunciar publicação"* · Uber safety report |

> **D1.1 — Fundir as duas é PROIBIDO.** Quem trata estorno não é quem trata assédio; as filas, os prazos e a autoridade de decisão são distintos. Uma reclamação de atraso de entrega numa fila de Trust & Safety atrasa a resposta a um caso de assédio, e é isso que a separação impede.

> **D1.2 — Uma operação pode gerar as duas.** Uma corrida pode render disputa de valor (A) **e** denúncia de conduta do motorista (B). São dois registros, com ciclos de vida independentes. **A existência de uma nunca condiciona a outra** — cancelar a disputa não arquiva a denúncia.

---

## D2 — PORTA B TEM UM NÚCLEO ÚNICO, E MÓDULO NÃO CRIA O SEU

**O Reporting Core (`core/reporting`) é o SSOT de denúncia.** Fica promulgado o que `REPORTING_CORE.md` já dizia:

- Módulo denunciável **emite para o núcleo**. Não cria tabela própria, não cria fila própria, não cria status próprio.
- Toda denúncia, de qualquer módulo, nasce e vive em `reports` / `report_events` / `risk_flags`.
- **Qualquer PR que introduza denúncia própria de módulo é BUG por definição** e deve ser recusado na revisão.

**D2.1 — `chat_reports` é aposentado para dentro do núcleo.** É a violação nomeada em D0, tem **0 linhas**, e portanto o custo de aposentar é zero. ⚠️ A execução material da aposentadoria exige **autorização explícita de Clayton** (CLAUDE.md §5, deleção de módulo pré-existente) — **esta decisão não a concede**; declara o destino, não executa.

**D2.2 — `support_tickets` NÃO é denúncia e NÃO entra no núcleo.** Suporte é uma terceira coisa (*"como faço para…"*), que Uber e iFood também mantêm separada. Fundir suporte com Trust & Safety parece limpeza e é perda de papel. Seu papel próprio deve ser declarado em decisão própria; até lá permanece como está.

---

## D3 — PORTA A ANCORA NA OPERAÇÃO, E O VOCABULÁRIO É COMPOSTO, NUNCA ENUMERADO

A extensão de Clayton sobre o desenho arquivado: o documento original ancora na **entidade** (`DRIVER`, `PROVIDER`, `COMPANY`), com `TRANSACTION` marcado *"(futuro)"*. **Fica decidido que a Porta A ancora na OPERAÇÃO CONCRETA**, e a entidade é **derivada** dela.

Razão registrada — não é preferência estética:
- **A denúncia nasce com prova.** Ancorada na operação, carrega quem, quando, quanto, qual pedido. Ancorada na entidade, é palavra contra palavra.
- **Mata a denúncia genérica.** Selecionar qual corrida impede reclamar de alguém por antipatia.
- **O motor de risco melhora.** Correlação por operação revela padrão que correlação por entidade não vê.

> ### 🔴 D3.1 — O VOCABULÁRIO DE OPERAÇÕES É **COMPOSTO** DO QUE JÁ EXISTE
>
> **É PROIBIDO escrever à mão uma lista de tipos de operação.** Esse é exatamente o erro do C1 registrado em `dividatecnica.md` — *inventar vocabulário paralelo em vez de compor do governado*. O vocabulário de operações do UnifiCard já existe no schema vivo e nas normas; a lista canônica sai de **GATE read-only próprio**, não desta decisão e não da cabeça de quem implementar.
>
> **Esta decisão fixa a REGRA e recusa-se deliberadamente a fixar a LISTA.**

**D3.2 — `module` deixa de ser texto livre.** Hoje é `z.string().min(1)` (`reporting.routes.ts`), enquanto `REPORTING_DATA_MODEL.md` especifica ENUM. **Texto livre nunca é identidade** (Lei 7). O enum é composto do vocabulário governado de módulos, no mesmo GATE de D3.1.

---

## D4 — IDENTIFICADO PARA A PLATAFORMA, ANÔNIMO PARA O ACUSADO

Padrão de Uber, iFood e Mercado Livre, e resolve a tensão real entre proteção da vítima e anti-abuso:

- **Denúncia exige usuário autenticado.** Sem `reporter_user_id` não há anti-spam (a política de 5/hora e 20/dia de `policies/ReportingPolicy.ts` é por reporter), não há reputação de denunciante, e não há como agir juridicamente.
- **O denunciado NUNCA sabe quem denunciou.** Nem no ticket, nem na resposta, nem em metadado exposto. Anonimato é **em relação ao acusado**, não em relação à plataforma.
- Permanece valendo a regra de privacidade já escrita: *"CPF / endereço / dados pessoais nunca aparecem no ticket público"*.

⚠️ **Consequência aceita e declarada:** não existe denúncia anônima na v1. Se Clayton quiser canal anônimo para assédio grave, é **decisão própria futura** — e terá de resolver o anti-abuso por outro mecanismo, porque o atual depende da identidade do denunciante.

---

## D5 — O QUE ESTA DECISÃO **NÃO** AUTORIZA

Docs-only, e o limite é duro:

- ❌ **Não cria tabela.** As três tabelas de `REPORTING_DATA_MODEL.md` seguem inexistentes até GATE + GO material próprios.
- ❌ **Não conserta o escopo** de `/reports`. O 401 permanece até fatia própria.
- ❌ **Não apaga `chat_reports`** nem nada. D2.1 declara destino; execução exige autorização explícita de Clayton.
- ❌ **Não fixa a lista de tipos de operação** (D3.1) nem o enum de `module` (D3.2) — ambos saem de GATE.
- ❌ **Não toca `support_tickets`**, `financial_disputes` nem `reconciliation_disputes`.
- ❌ **Não abre PORTA-1** e não movimenta dinheiro. A Porta A *desemboca* em estorno, mas o mecanismo financeiro segue sob as travas vigentes.

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
