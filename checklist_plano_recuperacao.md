# CHECKLIST_PLANO_RECUPERACAO.md

> Ponteiro de estado da direção — não é cartório (detalhe histórico = `REMEDIATION_DT_LOG.md`)
> nem registry de DT (= `dividatecnica.md`). Este arquivo é REESCRITO a cada mudança de estado
> (GO emitido, parecer recebido, selo, mudança de fase) — sem acumular histórico. Se precisar de
> detalhe, seguir os ponteiros abaixo, não duplicar aqui.

## Fase do PLANO_RECUPERACAO.md
Fase 2 (eixos soberanos) — Fase 1 auditabilidade com remediação crítica fechada
(AUDIT-004 C1/C2 selado em `285b30f10`).

## Frente ativa agora
**(nenhuma frente material aberta — F-EVENTS-SPRINT76 parada por blocker de drift; aguarda decisão de fate)**
- O GO material de contenção de autoria foi emitido; a executora aplicou o fix na forma
  (typecheck 0) mas PAROU e reverteu ao descobrir DRIFT DE SCHEMA: `ticket_sales` tem dois
  designs irreconciliáveis (schema vivo=compra paga vs repositório=reserva→pagamento).
  Runtime sprint76 ticketing MORTO (getSaleById estoura coluna-inexistente); forja NUNCA foi viva.
- Achados registrados em dividatecnica: `DT-EVENTS-SPRINT76-TICKET-SALE-REPOSITORY-SCHEMA-DRIFT`
  (🟠 estrutural, money-adjacent, módulo morto), forja reclassificada 🟠→⚪ (não-explorável),
  `DT-EVENTS-SPRINT76-TICKET-PAY-UNAUTHENTICATED-AUTHORITY` (money-adjacent, GATE próprio).
- Sem risco vivo (nada alcançável). HEAD `6f89a016d`, working tree limpo (material revertido).

## Descoberta que reframa a frente (2026-07-22)
Bilheteria de eventos NÃO existe funcional em lugar nenhum: schema real (event_tickets tipo +
ticket_sales compra bank-wired) + UI viva (EventCheckoutModal) + 3 backends TODOS mortos
(sprint76 repo drifted; checkout-ticket.service purchaseTicket/checkIn desativados com throw
pela remediação 2026-07-05; event-ticket.repository a classificar). Feature intencional nunca
construída ponta-a-ponta; remediação anterior "varreu p/ debaixo do tapete" desativando.
Registrado: `DT-EVENT-TICKETING-UNBUILT-FEATURE-FACADE` (🔴 estrutural, money).
Clayton NÃO quer varrer de novo → resolver.

## Frente ativa agora
**F-EVENT-TICKETING-CONVERGENCE** — feature multi-fatia · GATE Veredito A · plano em fatias fechado
- HEAD base: `37820871d`. GATE de convergência executado (Opus) e verificado pela direção.
- Verdade = schema migrado (event_tickets tipo + ticket_sales compra bank-wired + event_checkins);
  código drifted mira migrations_archive nunca aplicado. Dinheiro TODO fail-closed hoje.
- Correção da direção: "fachada desonesta" superdimensionada — EventCheckoutModal trata erro (403→
  "erro ao comprar", não sucesso falso). Fluxo exposto que sempre falha, não fake-success.
- PLANO: **espinha Bank-free F0→F1→F4 GO-ready** (F0 contenção honesta · F1 catálogo tipo governado ·
  F4 check-in modelo cultural, absorve a contenção de autoria sprint76). F2/F5 dinheiro e F3 modelo =
  RATIFICAÇÃO-GATED.
- Ratificações soberanas pendentes (só travam F2/F3/F5): 6.1 economia de ingresso (split? sem DECISION)
  · 6.2 firewall por PORTA · 6.3 modelo de ingresso emitido (agregado vs individual+QR; DB virgem) ·
  6.4 reembolso · 6.5 destino camadas mortas · 6.6 dois sistemas paralelos (cultural vs events-v2) unificar?

## Sequência decidida pela direção (Clayton delegou; respeitar SSOTs/tempo/dinheiro/autoridade)
**F1 (catálogo) → F4 (check-in, sela autoridade sprint76) → ratificar → F2/F3/F5.**
F0 (contenção) DOBRADA em cada fatia que reescreve a rota (sem conter-para-substituir redundante).
F1 começa por ser fundação real + paradigma-neutra (schema event_tickets serve cultural e events-v2,
não decide §6.6 cedo) + converge código→schema produtivamente. F1 = backend-only (UI do organizador
= fatia frontend futura).

## Frente ativa agora
**F-EVENT-TICKETING-CONVERGENCE · FATIA 1 ✅ SELADA (Yala Veredito A) — HEAD `02e6cbe1c`**
Composição: núcleo `4a6b50c6e` (catálogo governado) + addendum-1 `a5e5a06f8` (contenção 501 reserve/pay)
+ addendum-2 `02e6cbe1c` (fix falso-lock guard). Selo docs-only aplicado.

## Achado de dependência (direção, pós-F1): F4-real depende de F2
Check-in real = check-in de ingresso COMPRADO (alvo = portador de ticket_sales). Como ticket_sales
está drifted (motivo de reserve/pay contidos), NÃO dá para convergir check-in de verdade antes de F2
(compra → ticket_sales). Logo F4-real é POST-F2, não GO-ready independente (GATE foi otimista).

## ✅ Contenção cancel/checkin/checkout SELADA (Yala Veredito A, `86d675b83`) — HEAD atual
`DT-EVENTS-SPRINT76-ACTOR-HINT-AUTHORSHIP-FORGERY` FECHADA por contenção. Ciclo de ingresso sprint76
todo honesto: criar/editar tipo VIVO governado (F1); reserve/pay/cancel/checkin/checkout = 501 deferido.
Espinha Bank-free da bilheteria concluída.

## REFRAME (Clayton, 2026-07-22): motor de eventos único que ORQUESTRA tudo
A convergência de bilheteria virou o buildout do MOTOR DE EVENTOS (maior que Eventim; Actor-projetado;
orquestra descoberta→agenda→contratação→local→ingresso; economia→fundo regional). Mapa completo em
`EVENT_ENGINE_COUPLING_MAP.md` (6 descobertas read-only). ~70% do substrato JÁ existe — trabalho é ELOS,
não tijolos. Espinha reusável: oferta contratável (artista/banda/local) = service_offering c/ agenda.
Visões em memória: project_visao_motor_eventos_unico_ator_projetado + project_visao_bilheteria_grandes_promotores.

## GATE de acoplamento EXECUTADO · Veredito A (cross-validado com o mapa da direção)
Fatos decisivos verificados pela direção: UMA tabela `events` (20260525100000) com DOIS writers
(core/events governado × modules/events legado) — F0 = convergir o WRITER, não juntar stacks
(mais barato, product-neutral). "Estabelecimento" = tríade page+company VERIFIED+capability (0189),
não actor_type novo. `event_actors` só existe como TIPO (materializar o slot). Cultural PAC ghost =
CONVERGIR p/ C1+services+page/company, não reviver.

Roadmap refinado (todas Bank-free até PORTA-01): F0 motor único (writer convergence, GO-READY,
product-neutral) → F1 taxonomia ingresso+capacidade → F2 event_actors (line-up/elenco/equipe/local
declarativo) → F3 RFQ+descoberta acopladas → F4 vaquinha estado (ratif.) → F5 comissão/split→fundo
(ratif.) → F6 dinheiro PORTA-01. F0-F3 não dependem de ratificação.

## Frente material ativa: FATIA 0 — MOTOR ÚNICO (writer único de evento)
- Instância: executora, Opus, alto. GO material emitido, base `5acf0dae5`. Aguardando parecer.
- Escopo: `core/events/event.service` = writer único; conter/rotear o writer legado (modules/events);
  guard anti-revival do INSERT paralelo. É §2/§4.8 em ato. Bank-free, product-neutral.
- TRAVA: etapa 1 = mapear TODOS os writers/callers/frontends de criação de evento e PARAR se a
  convergência não for limpa/product-neutral ou quebrar criação viva.
- §4.9.8: converge autoridade tocada para a fachada authority.service (não novo uso direto).
- Próxima ação: parecer volta → direção verifica → Yala → selo → F1 (taxonomia ingresso+capacidade).

## Decisões §6 (trago quando a fatia chegar; não bloqueiam F0-F3)
emissão agregado×QR-individual · vaquinha (limiar/prazo/devolução) · comissão%→fundo regional/indicação/
grupo · multi-vendedor (artista vende na própria página) · capability estabelecimento (não actor_type) ·
venue/setores MVP-pula×materializa · abertura firewall/PORTA. Cultural PAC ghost = convergir p/ C1, não reviver.

## Parado / bloqueado (nada a retomar agora)
- (nenhum — 2A é a única frente material aberta no momento)

## Backlog registrado, SEM GO (detalhe → dividatecnica.md)
- `DT-EVENTS-SPRINT76-ACTOR-HINT-AUTHORSHIP-FORGERY` (🟠 forja de autoria, money-free)
- `DT-IDENTITY-KYB-ACTOR-HINT-PROVENANCE` (🟡 admin-gated, só proveniência)
- `DT-SERVICE-ORDER-CONFIRM-FINANCIAL-TERMS-UNBOUND-ACTOR` (⚪ contido por flag, vigilância)
- AUDIT-003 / AUDIT-005: nunca abertas
- AUDIT-006: bloqueada por ambiente (sem container runtime) — critério de aceitação de
  bloqueio permanente ainda NÃO definido
- Fase 4 (topologia viva): parcial · Fase 5 (migrations/banco): não iniciada ·
  Fase 6 (jornadas transversais): não iniciada

## Regras vivas (consultar antes de perguntar o que a norma já decide)
- Uma frente MATERIAL por vez; leitura/GATE pode paralelizar se domínio não sobrepõe.
- Executor não se autoriza — todo GO vem da direção; achado crítico vivo = STOP e prioridade
  sobre qualquer frente em andamento.
- Todo arco: GATE (read-only) → GO → material (executora) → Yala independente (nunca a
  mesma instância que executou) → selo docs-only (só a direção sela).
- Todo prompt ancorado para instância fresca leva o bootstrap normativo COMPLETO
  (00_AGENT_PROTOCOL + CONSTITUICAO + LEIS_OPERACIONAIS, lidos na íntegra) + prova de
  rastreabilidade (§2.2.2) como item de saída — nunca comprimir para citação de seção.
- Modelo por tarefa: Sonnet para reuso mecânico de padrão já selado; Opus para
  análise/design estrutural novo ou contenção de risco vivo; Fable não usado em execução.
