# ERRATA / SUPERSESSÃO ESTREITA — FASE_6_2_PAGAMENTO_SANDBOX.md

**Append-only. NÃO reescreve o documento histórico `FASE_6_2_PAGAMENTO_SANDBOX.md` (03_technical e 06_technical, idênticas). Vinculada a: DECISION-0190.**

**Data:** 2026-07-20 · **Origem:** DECISION-0190 (EVENT ECONOMIC/V2 · HONEST SANDBOX & CONTAINMENT) · **Base:** HEAD `368eb72cd`.

---

## ALCANCE DA ERRATA

Esta errata **NÃO** revoga a FASE_6_2 inteira e **NÃO** apaga seu histórico. Ela registra a supersessão **estreita e exclusiva do PASSO 4** ("EXECUTAR PAGAMENTO (SANDBOX)") como método operacional vigente.

## O QUE PERMANECE VIGENTE

- O **princípio central**: sandbox sem risco real, "nenhum dinheiro real movimentado", operação identificada como sandbox e não apresentada como execução produtiva.
- PASSOS 1-3, pré-requisitos e o contrato de UX, no que não dependem do PASSO 4 como execução real.

## O QUE FICA SUPERSEDIDO (PROPOSTO · PENDENTE DE SELO)

**PASSO 4 SUPERSESSION PROPOSED · PENDING INDEPENDENT AUDIT AND SEAL.**

> O **PASSO 4** deste documento ("EXECUTAR PAGAMENTO (SANDBOX)" — `POST /events/:eventId/economic/v2/payment/execute` rodando o fluxo em sandbox) **é proposto para deixar de ser método operacional vigente**, por ausência do substrato financeiro sandbox que ele pressupôs. Após auditoria independente favorável e registro do selo de DECISION-0190, o PASSO 4 deixará de ser o método operacional vigente. Enquanto DECISION-0190 estiver REDIGIDA/NÃO-SELADA, o PASSO 4 permanece formalmente descrito neste documento histórico, apenas com esta supersessão proposta registrada em errata.
>
> **Causa-raiz canônica:** `SANDBOX FINANCIAL SUBSTRATE ASSUMED BUT NOT MATERIALIZED`. Na ausência de contas de teste + provedor de teste + isolamento financeiro de teste, "o mesmo fluxo da produção" alcança o writer real do Bank (`bank_ledger` real), hoje contido apenas pelo `BANK_TRANSACTION_SINK_FIREWALL` (default-off) com a PORTA-1 fechada. Provado por AUDIT-001 e sua falsificação independente (`PLANO_RECUPERACAO.md` §C.11/§C.13).
>
> O PASSO 4 **não pode ser retomado automaticamente** por mudança de env var, feature flag, remoção da contenção `501 EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED` ou remoção do firewall. Sua retomada exige, cumulativamente: novo GO institucional + substrato sandbox físico isolado + banco efêmero equivalente + contas sandbox + separação comprovada do ledger real + auditoria + provas de atomicidade/idempotência/concorrência/reversão + selo independente.

## ESTADO ATUAL DA FAMÍLIA economic/v2

Institucionalmente **não implementada e contida** até existir substrato sandbox real e provado. Ver DECISION-0190 §4 (contenção), §6 (defesa em profundidade), §9 (frente material futura), §10 (pré-condições de ativação).

**Status desta errata:** vinculada a decisão REDIGIDA, aguardando auditoria independente (Opus 4.8) e selo soberano. Não-selada.
