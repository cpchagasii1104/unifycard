# LOTE L6 — IDENTIDADE / CPF-SSOT / TENANCY · Pacote de decisão

> **Data:** 2026-07-06 · branch `rescue-structural` · **Read-first vivo feito HOJE** (cartório + banco + decisions).
> **A grande virada deste read-first:** o "único número que pede o Clayton" (modelo de tenancy) **JÁ FOI
> DECIDIDO** — DECISION-0115 D1-D5 estão TODAS promulgadas (30-05-2026). O que falta em L6 não é decisão
> nova, é **IMPLEMENTAÇÃO** de decisões já tomadas. Ou seja: boa parte de L6 é EXECUTÁVEL, não decision-gated.
> Por isso o relatório externo que chamou tenancy de "o número que pede você" estava desatualizado.

---

## Substrato vivo (medido hoje)

| Peça | Estado |
|---|---|
| `actors` | 12 total · **4 com `global_user_id IS NULL`** (backfill pendente — breach de 0062 D8) |
| `tenants` | 4 (1 DEV canônico + 3 históricos/teste) |
| Leitura CORE de CPF | ✅ migrada pra `identities.tax_id` (0062 F4 DONE, 2026-06-02) |
| Nascimento identidade/actor | ✅ atômico (0062 F3.1 v2 DONE) |
| Caches `user_profiles.cpf`/`profiles.cpf` | ⏳ ainda vivos (F5 dual-write adiada) |
| Modelo de tenant | `tenant-per-signup` (cada PF nasce numa ilha morta — 0115 D1 diz que é inválido) |

---

## O que JÁ está decidido (não precisa decidir — só implementar)

**DECISION-0115 (tenancy) — D1-D5 promulgadas por você em 30-05-2026:**
- **D1:** PF NÃO nasce destino final num tenant morto individual → aponta pra um **tenant inicial VIVO**
  (comunidade/piloto/institucional — o modelo soberano foi ratificado).
- **D2:** nascimento de identidade/actor deve ser GARANTIDO (atômico), não best-effort silencioso.
- **D3:** Gender 5-valores (já implementado, 2026-06-11).
- **DECISION-0062 (CPF SSOT):** F0-F4 DONE; F5 (deprecar caches) sequenciada por D9/D10 (precisa audit+backfill).

**Tradução:** a arquitetura de identidade/tenancy está DESENHADA E RATIFICADA. L6 é a frente onde a
implementação alcança a decisão — não onde a decisão falta.

---

## As decisões/GOs que REALMENTE faltam (poucas, e são de EXECUÇÃO, não de modelo)

## D1 — Autorizar a fatia "tenant inicial vivo" (materializar 0115 D1)?

**Estado:** o modelo está decidido (0115 D1); falta MATERIALIZAR qual é o tenant inicial vivo e apontar o
`register` pra ele (hoje ainda cria `tenant-per-signup`). É a raiz de que L3-discovery-cross-tenant e a
"vitrine onde o dev acha o Clayton" dependem.
- **(a) GO na fatia C1 "mundo inicial vivo"** — definir o tenant institucional inicial (ex.: "Comunidade
  Inicial Unificard"), apontar register pra ele, reconciliar o legado `tenant-per-signup` — **M** (toca
  auth.register + migration de reconciliação; é operação de tenant vivo, precisa do seu GO nominal)
- **(b) Adiar** — segue `tenant-per-signup` (ilhas isoladas; usuários não se acham cross-tenant) — **S**
- **Recomendação: (a) — mas é a decisão de maior peso do lote.** Destrava a descoberta cross-tenant (a
  "vitrine" da frente de visibilidade), que hoje é a razão de "tenants-silo impedem usuários de se acharem".
  Precisa do seu GO porque mexe no nascimento de toda PF e reconcilia dados de tenant vivos. **A única aqui
  que é decisão soberana de verdade** (as outras são higiene/execução).

## D2 — Autorizar o backfill de `global_user_id` nos 4 atores legados?

**Estado:** 4 de 12 atores têm `global_user_id IS NULL` (breach de 0062 D8; se tocados por payout/KYC,
falham). É pré-condição de F4 em produção. É EXECUÇÃO (auditoria + backfill), não decisão de modelo.
- **(a) GO na auditoria READ-ONLY + backfill** — mapear os 4, resolver o `global_user_id` correto de cada,
  backfill governado idempotente — **S/M** (read-only primeiro, ~2h; backfill sob confirmação)
- **(b) Adiar** — os 4 seguem em breach (dev-only hoje; risco real só se tocarem dinheiro/KYC) — **S**
- **Recomendação: (a) a auditoria READ-ONLY agora** (sem risco, esclarece se é resíduo de teste ou conta
  real), depois o backfill sob sua confirmação. Posso fazer a auditoria read-only autonomamente já.

## D3 — F5 (deprecar caches `user_profiles.cpf`): abrir a janela agora?

**Estado:** F4 (leitura CORE via `identities.tax_id`) está DONE. F5 remove os caches dual-write, mas 0062
D9/D10 exigem janela de observação comprovada antes. É sequência norm-blocked, não decisão de modelo.
- **(a) Abrir a janela de observação de F5** (instrumentar que nada lê mais o cache, depois deprecar) — **M**
- **(b) Manter F5 adiada** — o dual-write continua (custo: duas fontes de CPF coexistindo, mas F4 já fez a
  leitura canônica ser a de `identities`) — **S**
- **Recomendação: (b) por ora.** F4 já pôs a leitura na fonte canônica; o cache é redundância inofensiva.
  F5 é higiene de baixa urgência que compete com frentes de maior alavanca. Fazer quando L2/L3 assentarem.

---

## Itens que são frente própria (nomeados, não neste pacote)

- `DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION` — 10 valores coexistindo, CONTAINED/FROZEN (guard congela novos).
  Drenar 10→4 é frente própria; NÃO bloqueia identidade. Fica congelado.
- `DT-IDENTITY-TRIAD-AND-MISLABELED-FK` — parte (c) FK-que-mentia já CLOSED; o mapa canônico humano↔actor
  (a/b/d) segue norm-sequenced. Frente própria.

---

## Tabela-resumo

| # | Decisão/GO | Natureza | Recomendação | Custo |
|---|---|---|---|---|
| D1 | Tenant inicial vivo (0115 D1) | **Soberana** (nascimento de PF + reconciliação) | GO — destrava descoberta cross-tenant | M |
| D2 | Backfill `global_user_id` (4 atores) | Execução | Auditoria READ-ONLY já (autônoma); backfill sob GO | S/M |
| D3 | F5 deprecar caches CPF | Higiene norm-sequenced | Adiar; F4 já resolveu a leitura canônica | S/M |

**Leitura honesta:** L6 quase não tem decisão de MODELO pendente — 0115 já decidiu tudo. Tem **1 GO soberano
de peso** (D1, tenant inicial vivo — a raiz da descoberta cross-tenant) e **2 itens de execução** (backfill,
F5). A auditoria read-only do backfill (D2) eu posso fazer AGORA sem GO. O resto espera sua palavra no D1,
que é o item que mais destrava (a "vitrine onde o dev acha o Clayton" depende de sair do tenant-per-signup).
Tudo money-free; PORTA-1 HOLD.
