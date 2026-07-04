# MAPA DE FECHAMENTO — o que fechar antes de usuários reais

> **Propósito:** tabuleiro único de tudo que está ABERTO, para Clayton sequenciar com visibilidade
> total em vez de reagir achado a achado. Montado do disco (`REMEDIATION_DT_LOG.md`, 524 DTs) +
> auditoria forense 2026-07-04, verificado em 1ª pessoa. **Read-only — zero código por este doc.**
> **Data:** 2026-07-04 · HEAD `f875d931a` · branch `rescue-structural`.
>
> **A regra do momento (Clayton):** o projeto está só no computador dele, sem empresas/usuários
> reais → **janela barata**. Princípio: **fechar ESTRUTURA agora, construir SUPERFÍCIE depois.**
> Cada feature nova sobre um padrão não-fechado cria mais irmãos pra corrigir (foi assim que a
> "régua pela metade" nasceu). Fechar agora custa 1×; com usuários reais custa 10× (migração de
> dado vivo, downtime, confiança).

---

## 0. RETRATO DO CARTÓRIO (a notícia boa primeiro)

- **524 DTs registradas; a esmagadora maioria CLOSED.** A dívida VIVA é pequena e nomeada:
  **1 crítica**, **~10 médias/altas**, **3 parciais**, + um punhado de HOLD-PORTA-1 e
  parciais-mitigados antigos. Não há caos oculto — há uma lista curta.
- **Isolamento cross-tenant: SEM vazamento** (auditoria confirmou). A descoberta global (a vitrine)
  é porta única opt-in. O cofre (`bank_ledger`/RLS) está sólido.
- Portanto "fechar tudo" **não** é refazer o sistema — é drenar ~14 itens na ordem certa.

---

## 1. A PAREDE ANTES DA PORTA DO DINHEIRO (o mapa mental que organiza tudo)

```
        [ CLUSTER AUTORIDADE ]            [ CLUSTER DINHEIRO / PORTA-1 ]
        sem dinheiro — fechável já        contido só por LEDGER VAZIO
        ┌──────────────────────┐          ┌───────────────────────────────┐
        │ V1 eventos IDOR 🔴    │          │ V3 sink executePayment        │
        │ meta-vuln (guard)     │          │ resíduos move-money 0113       │
        │ delegação sem escopo  │          │ Core Aprovação fantasma (0128) │
        │ KYC âncora no CNPJ    │          │ split-stub                     │
        └──────────────────────┘          │ circuit-breaker fail-open      │
                                           └───────────────────────────────┘
                                           ⚠️ "uma corda só segurando N facas —
                                              PORTA-1 corta a corda de TODAS de uma vez"
```

**Consequência:** PORTA-1 (ligar dinheiro) **não é** "semear saldo" — é *fechar as facas antes*.
Por isso o cluster dinheiro é um **evento único de decisão soberana** (decision pack), não patches
avulsos.

---

## 2. CLUSTER AUTORIDADE / SEGURANÇA (sem dinheiro — barato, fechável já)

| Item | DT / origem | Severidade | Contido por | Custo de fechar |
|---|---|---|---|---|
| **V1 · IDOR lifecycle de eventos** | DT-AUTHORITY-REGUA-PELA-METADE | 🔴 CRÍTICA (explorável hoje) | nada — vivo | BAIXO (helper `userRepresentsActor` já existe; ~11 handlers + v2/economic) — Clayton escolheu **sessão dedicada** |
| **Meta-vuln: sem choke-point** | DT-AUTHORITY-REGUA + audit §7.4 | 🔴 ALTA (estrutural) | baseline `audit-actor-authority-boundary` que TOLERA infratores | MÉDIO — drenar baseline + guard do padrão "identidade cliente-controlada decide autoridade". **Mapeia TODOS os irmãos além de V1** |
| **Delegação descarta escopo** | audit §4 (`canRepresentActor:386`) | 🟠 MÉDIA (latente — 0 delegações ativas) | PORTA-3 não disparada | BAIXO — mas fechar ANTES de ativar delegação |
| **KYC da âncora ao criar CNPJ** | audit §4 (AUTHORITY_LAW Art.4.2) | 🟠 INDETERMINADO | — | Precisa checagem dedicada (não confirmado se há gate de `kyc_status` do criador) |
| **GrupoDetailPage autoridade client-side** | audit §4 | 🟠 MÉDIA (defense-in-depth) | backend re-valida? (a confirmar) | BAIXO se o backend já valida |
| V2 · confused-deputy public-profiles | DT-AUTHORITY-REGUA | ✅ **FECHADA** 2026-07-04 | — | — |

## 3. CLUSTER DINHEIRO / PORTA-1 (contido por ledger vazio — decisão soberana)

| Item | DT / origem | Contido por | Nota |
|---|---|---|---|
| **V3 · sink `executePayment` sem firewall** | DT-AUTHORITY-REGUA (V3) | ledger vazio | venue-público/subscriptions/automation herdam o furo; fix = assert NO SINK |
| **`service_payment_execution_repository` red** | DT-FINANCIAL-SSOT-RED-...-REPOSITORY | baseline | BLOCKS_NEXT_FINANCIAL_FRONT — dreno da dívida financeira |
| **Core de Aprovação Financeira fantasma** | DT-CORE-FINANCIAL-APPROVAL-MOTOR | schema sem runtime | DECISION-0128 exige p/ TODO movimento; MODEL existe, EXECUTION HOLD |
| **circuit-breaker fail-open sob RLS** | DT-CIRCUIT-BREAKER-RAW-POOL-... | tabela vazia + worker off | REVIVAL-RISK: `pool.query` cru → FORCE RLS devolve vazio = "sem breaker" silencioso |
| **raw-pool herda GUC stale sob RLS** | DT-RAW-POOL-RLS-ACCESS-... | — | mesma família do circuit-breaker |
| resíduos move-money 0113 (bank-http/payout) | histórico baseline 0113 | ledger vazio | descongelam junto |
| split-stub | — | ledger vazio | motor de split não materializado |

**→ Recomendação:** tratar TODO o §3 como **um decision pack PORTA-1 único**. Fechar antes de
semear saldo, não depois. IA-DINHEIRO + soberania Clayton.

## 4. CLUSTER DESCOBERTA (a frente viva desta sessão — construção, não dívida)

| Item | DT | Estado |
|---|---|---|
| Fase 1 vitrine cross-tenant | — | ✅ FECHADA (backend+frontend, E2E 8/8) |
| **Post visibility ignorada na leitura** | DT-SOCIAL-POST-VISIBILITY-NOT-ENFORCED-ON-READ | 🟠 MÉDIA — **precondição da Fase 2** (plateias FRIENDS/GROUP) |
| Página da plaquinha (destino do hit global) | — | 🔵 próxima fatia nomeada |
| Prompt na criação de empresa + convite 1ª troca Operar | — | 🔵 nomeada |
| Fase 2 plateias relacionais / Fase 3 escada | — | 🔵 depende da DT acima |

## 5. GOVERNADAS / LATENTES (não bloqueiam nada agora — fechar quando a frente própria abrir)

| Item | DT | Quando importa |
|---|---|---|
| `contacts.tax_id` fonte paralela de CPF/CNPJ | DT-CRM-CONTACTS-PARALLEL-IDENTITY-RISK | antes de tirar CRM do arquivo |
| Tríade CPF (user_id/global_user_id/actor_id) | DT-IDENTITY-TRIAD-...-FK | norm-blocked por 0062 D9/D10; exige banco vivo (F1 audit) |
| RFQ→opportunity-dispatch ghost | DT-EVENT-RFQ-OPPORTUNITY-DISPATCH-GHOST | quando matching de eventos entrar |
| reputation/locations ghost (eventos) | DT-EVENTS-REPUTATION-LOCATIONS-GHOST | frente reputação (GATED) |
| naming collision feed/serviço · registry route mismatch · bucket duplicado · orphan files | 4 DTs 🟠 service/company | higiene — fecham em sweep dedicado |
| malware-scan de doc PJ · lifecycle-status conflation · trust-module ungated · events-list visibility-floor | 4 DTs PARTIALLY MITIGATED | pré-produção real (não pré-teste local) |

## 6. O QUE **NÃO** FAZER AGORA (disciplina)

- **Não** construir descoberta Fase 2/3 nem novas features antes de fechar o cluster autoridade —
  seria empilhar superfície sobre "régua pela metade".
- **Não** tocar firewall de dinheiro (§3) fora do decision pack PORTA-1 — money é soberano.
- **Não** mexer nas exceções-declaradas (actor_type 10 valores = DECISION-0157 congelado,
  assintótico; não é bug).
- **Não** drenar a tríade CPF (§5) — norm-blocked por 0062, exige banco vivo.

---

## 7. SEQUÊNCIA RECOMENDADA (a defesa da diretora)

1. **Guard estrutural de autoridade** (§2 meta-vuln) — PRIMEIRO, porque *mede o tamanho real* da
   dívida de autoridade (quantos irmãos além de V1?) e vira a rede permanente. Barato, read-mostly.
2. **Sessão dedicada de eventos / V1+V4** (§2) — com o guard provando o fechamento handler-a-handler.
3. **Fechar as latentes de autoridade** (§2: delegação-escopo, KYC-âncora, grupo client-side) —
   rápidas, tiram o resto do cluster do caminho.
4. **Decision pack PORTA-1** (§3 inteiro) — o evento único do dinheiro. Só depois da parede de
   autoridade fechada. É a porta grande — abre a operação econômica real.
5. **Descoberta Fase 2** (§4) — quando autoridade e dinheiro estiverem fechados; começa fechando a
   DT do post-visibility.
6. **Higiene governada** (§5) — sweeps dedicados, sem pressa, cada um na sua frente.

**Por que essa ordem:** autoridade antes de dinheiro (a catraca protege o cofre); medir antes de
cortar (guard antes de patch); estrutura antes de superfície (a regra da janela barata). A
descoberta — a frente mais visível — vem por último de propósito: é a que mais se beneficia de um
chão de autoridade+dinheiro já sólido.

---

*Sequência = decisão soberana de Clayton. Este mapa dá o tabuleiro; a mão que move é dele.*
