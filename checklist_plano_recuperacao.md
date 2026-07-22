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

## Próxima decisão da direção (fate de sprint76 ticketing — money-adjacent, soberana)
- (I) GATE de fate → quarentenar/remover o módulo morto (padrão da quarentena de frontend).
- (II) GATE de fate → reconciliar+reviver (decisão de produto+dinheiro: bilheteria paga é feature?).
- (III) Shelve como DT registrada (sem risco vivo) e seguir p/ próximo backlog AUDIT-004
  (`identity-kyb`) ou Fase 2 / abrir AUDIT-003/005. RECOMENDADO (não há fogo).

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
