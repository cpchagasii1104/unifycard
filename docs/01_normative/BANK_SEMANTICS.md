# BANK SEMANTICS

Este documento define a semântica institucional do UnifyBank.

O sistema financeiro do UnifiCard possui um único SSOT financeiro:

bank_accounts  
bank_transactions  
bank_ledger  
bank_splits

Nenhuma outra estrutura pode:

- manter saldo
- calcular saldo
- replicar ledger
- registrar split financeiro

Saldo existe exclusivamente no bank_ledger.

Qualquer tentativa de criar:

accounts  
transactions  
ledger_entries  
payment_splits  
event_split_declarative  

constitui violação do SSOT financeiro.

Referências normativas:

SSOT_EXCLUSIVE_BANK_RULE.md  
SSOT_CONTRACT.md  
PROHIBITED_STRUCTURES.md

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- PROHIBITED_STRUCTURES.md
- SSOT_CONTRACT.md
- SSOT_EXCLUSIVE_BANK_RULE.md

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->