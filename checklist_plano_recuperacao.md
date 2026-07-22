# CHECKLIST_PLANO_RECUPERACAO.md

> Ponteiro de estado da direção — não é cartório (detalhe histórico = `REMEDIATION_DT_LOG.md`)
> nem registry de DT (= `dividatecnica.md`). Este arquivo é REESCRITO a cada mudança de estado
> (GO emitido, parecer recebido, selo, mudança de fase) — sem acumular histórico. Se precisar de
> detalhe, seguir os ponteiros abaixo, não duplicar aqui.

## Fase do PLANO_RECUPERACAO.md
Fase 2 (eixos soberanos) — Fase 1 auditabilidade com remediação crítica fechada
(AUDIT-004 C1/C2 selado em `285b30f10`).

## Frente ativa agora
**F-EVENTS-SPRINT76-ACTOR-AUTHORSHIP-CONTAINMENT** (backlog AUDIT-004, item events-sprint76)
- Instância: executora, Opus, esforço alto — modo GATE READ-ONLY
- Estado: GO GATE emitido, aguardando parecer de desenho
- HEAD base: `3afc258de`
- Alvo: `events-sprint76.routes.ts` handlers cancel (~L348) / checkin (~L378) / checkout (~L403)
  carimbam `actionContext.actorId` cru sem `canRepresentActor`; siblings create/publish (L79/271/311)
  já guardados. Natureza: forja de AUTORIA (a esclarecer no GATE) ≠ alavanca de acesso.
- ⚠️ Ponto crítico do GATE: RE-VERIFICAR do zero se `cancelTicket` (venda de ingresso) toca
  dinheiro/reembolso — se tocar e for alcançável com actor forjado → Trava B.8 (STOP, vira crítico).
- GATE retornou Veredito B → direção resolveu em A pela norma (checkin/checkout = modelo
  promulgado cultural-checkin-target-authority; cancel = representa buyerActorId). Bank-free
  confirmado. Aditivo (organizador/staff) deferido.
- Achado adjacente registrado: `DT-EVENTS-SPRINT76-TICKET-PAY-UNAUTHENTICATED-AUTHORITY`
  (money-write sem autoridade em /tickets/:id/pay) — GATE próprio futuro, sem GO.
- Próxima ação: emitir GO material (Opus, alto) da contenção normativa → material → Yala → selo.

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
