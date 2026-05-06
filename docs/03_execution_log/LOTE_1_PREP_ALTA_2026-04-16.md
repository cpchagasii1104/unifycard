# Preparação LOTE 1 — prioridade ALTA (read-only)

**Actualização 2026-04-14:** a **PROPOSTA material** (`PROPOSTA_MATERIAL_LOTE_1_TENANT_9bdc.md`) está **pronta para execução em staging** — bloqueio documental (convidante/destinatário) **removido** via bootstrap temporário; ver PROPOSTA §1 e nota de topo. Este ficheiro continua só **read-only** / inventário de actores.

Gerado automaticamente — **nenhuma escrita em BD**.

## FASE 1 — Subdivisão ALTA (102 actores)

| Sub-fila | Critério | Contagem |
|----------|----------|----------|
| **CRÍTICA** | `bank_transactions` para o actor | 22 |
| **SECUNDÁRIA** | só `bank_accounts`, sem transação | 80 |
| **Total ALTA** | conta OU transação | 102 |

Soma sub-filas = total: **sim**

## FASE 2 — Por tenant (ordenado: transações primeiro)

| tenant_id | actors ALTA | com transação | só conta |
|-----------|-------------|----------------|----------|
| `9bdc68b6-c94e-43d4-bf4d-cfa00e9b5fc5` | 6 | 4 | 2 |
| `3fe3d29e-e7b3-4e30-9cb5-f6db556d8287` | 6 | 2 | 4 |
| `9fc14eee-ace4-41aa-a67a-112e9322b91a` | 6 | 2 | 4 |
| `1066bc56-f461-4d54-9b09-e73ba52ec12d` | 6 | 1 | 5 |
| `1d154fae-a849-403f-8334-9f4a106ebf76` | 6 | 1 | 5 |
| `25fae8ff-94cc-4de9-9a52-1dd12fa4147c` | 6 | 1 | 5 |
| `4eaa37af-0e9d-4fd2-aaaa-e03214436ee2` | 6 | 1 | 5 |
| `5803dd87-bc21-402b-aa5d-25fa99e85178` | 6 | 1 | 5 |
| `61c75b58-cabc-4757-b096-22f6ac887642` | 6 | 1 | 5 |
| `aaba83fd-9850-495a-a69e-60f2da32d905` | 6 | 1 | 5 |
| `c3af30f4-7b87-4c5a-978b-aef375385dad` | 6 | 1 | 5 |
| `c9d4f8d7-bb62-4e7b-8e39-f1b6bad48a10` | 6 | 1 | 5 |
| `d4ea8752-f60b-4ead-a57f-8e991fc4a051` | 6 | 1 | 5 |
| `e391a7b4-8448-49a0-b218-d8c5f03f5efb` | 6 | 1 | 5 |
| `f4d46281-20ff-4b57-8db1-3ee1dec24f91` | 6 | 1 | 5 |
| `f7969af4-1838-47b7-8c9b-be644dfa0ed2` | 6 | 1 | 5 |
| `fb08823f-15e0-41a7-82af-ea74909fe2cd` | 6 | 1 | 5 |

## FASE 3 — LOTE 1 proposto (4 actores — sub-fila CRÍTICA, um tenant)

- **Critério:** Primeiro tenant (ordenado por `com_transacao DESC`) com pelo menos 1 actor com `bank_transaction`; incluir **todos** os actores desse tenant que têm transação (limite 20).
- **Tenant:** `9bdc68b6-c94e-43d4-bf4d-cfa00e9b5fc5`
- **Nota:** Neste tenant existem exactamente **4** actores com `bank_transaction` (não 20). Os **22** com transação no total estão repartidos por vários tenants — para um piloto **10–20**, concatenar os próximos tenants por ordem da tabela FASE 2 (ex.: `3fe3d29e-…` +2, `9fc14eee-…` +2, …) até atingir o tamanho desejado, com **mesma disciplina** por tenant.

### actor_id (LOTE_1 mínimo — mesmo tenant, máximo risco transacional)

```text
ec75df56-5bb8-4afd-b945-5729ec0282a0
c9fca56e-9a2f-4841-b762-e6271dafe188
3e6e0ea1-871d-4f71-b357-4717e822b68f
5d0f2c4a-855e-498e-aea2-b383eb46da70
```

## FASE 4 — Plano de ativação (detalhe — não executar sem aprovação)

1. **Criar user:** apenas via fluxo real (convite/registo) com email verificado — **não** INSERT automático em massa sem decisão humana.
2. **Associar actor:** após `users` existir e `global_user_id` resolvido (Batch1 identities), `identity:batch2:link-actors` ou UPDATE documentado com `WHERE tenant_id` + PROPOSTA.
3. **Anti-duplicado:** respeitar UNIQUE `(tenant_id, email)` em `users`.
4. **CPF:** apenas dados reais em `identities`; proibido sintético.
5. **Log:** entrada em `docs/03_execution_log/` + linha CP-5 se alterar `actors`.

## FASE 5 — Check de segurança

- [ ] Nenhum user criado automaticamente neste documento (apenas preparação).
- [ ] Nenhum CPF inventado.
- [ ] Nenhuma escrita executada pelo script gerador.

**PROPOSTA material (primeiro write — não executada):** `docs/03_execution_log/PROPOSTA_MATERIAL_LOTE_1_TENANT_9bdc.md`

---
*Fim.*
