# SSOT CONTRACT

## STATUS: CANÔNICO · VIGENTE · OBRIGATÓRIO

---

## 1. DEFINIÇÃO

Este contrato estabelece, de forma **irrevogável**, as **Fontes Únicas de Verdade (SSOT)** do sistema UnifiCard.

Nenhuma decisão técnica, arquitetural ou de produto pode violar este contrato.

---

## 2. REGISTRO DE AUTORIDADES (SSOT)

**Nota DECISION-0021:** a coluna **Localização** indica onde a verdade está materializada ou exposta hoje. Ela **não** define, sozinha, soberania institucional. A soberania vem do conjunto: SSOT declarado, writer autorizado, enforcement e impossibilidade de contradição por consumidores.

| Domínio | Fonte Única de Verdade | Localização | Escritor Autorizado |
|-------|-----------------------|-------------|---------------------|
| Saldo | UnifyBank | `bank_accounts` + `bank_ledger` | `bankTransactionService` |
| Transação | UnifyBank | `bank_transactions` | `bankTransactionService` |
| Ledger | UnifyBank | `bank_ledger` | `bankLedgerRepository` |
| Split | UnifyBank | `bank_splits` | `bankSplitService` |
| Ator | Actor Registry | `actors` | `actorRegistryService` |
| Identidade | Identity | `users` + `actors` | `identityService` |
| KYC | KYC Registry | `actors.kyc_level` | `kycService` |
| Autoridade | Authority | `authority_trust_levels` | `atlService` |
| Permissões | RBAC | `rbac` | `rbacService` |

---

## 3. PROIBIÇÃO DE VERDADES PARALELAS

É **expressamente proibido** a qualquer módulo:

- Manter cópia local de saldo
- Calcular saldo fora do `bank_ledger`
- Decidir estado financeiro fora do UnifyBank
- Criar transações fora do `bank_transactions`
- Persistir valores financeiros fora do SSOT
- Criar mini-core clandestino para verdade já coberta por SSOT canônico

---

## 4. ESCRITA FINANCEIRA

Toda escrita financeira DEVE obedecer simultaneamente:

1. Passar pelo serviço autorizado
2. Ser registrada no UnifyBank
3. Ser auditável via ledger append-only
4. Respeitar KYC e ATL

Qualquer escrita que não cumpra estes critérios é **nula**.

---

## 5. INVALIDAÇÃO AUTOMÁTICA

Qualquer código que:

- viole este contrato
- crie SSOT paralelo
- contorne o UnifyBank
- derive saldo fora do ledger

é considerado **automaticamente inválido**, mesmo que funcione tecnicamente.

---

## 6. PRECEDÊNCIA

Este contrato tem precedência sobre:
- decisões técnicas
- implementações existentes
- convenções históricas
- documentação informal

---

## 7. REFERÊNCIA CRUZADA OBRIGATÓRIA

Este documento é citado e exigido por:

- `docs/01_normative/00_AGENT_PROTOCOL.md`
- `docs/01_normative/SSOT_EXCLUSIVE_BANK_RULE.md`
- `docs/01_normative/SSOT_PREFLIGHT.md`
- `PLANO_EXECUCAO_UNIFICARD_FINAL.md`

Violação desta referência invalida qualquer execução.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- BANK_SEMANTICS.md
<!-- AUTO-GENERATED-END -->
