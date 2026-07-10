# DECISION-0166 — Fundação da Policy de Split Admin: origem regional do comprador, base=comissão, multi-nível territorial por FK, imutabilidade

- **Status:** RATIFICADA (docs-only) — habilita a frente `F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION`.
- **Data:** 2026-07-09
- **Autoridade:** Clayton (soberana), com GATE read-first da executora sobre HEAD `56565ebab`.
- **Escopo:** decisão de doutrina + contrato. **NÃO** autoriza código, migration, seed, saldo, policy ativa,
  split regional real, dashboard, voucher ou adquirente externo nesta fase.
- **Predecessora:** DECISION-0165 (pipeline financeiro canônico + fundo regional em sistema virgem). Esta
  decisão herda D1/D3/D6/D9 da 0165 e as materializa como contrato da policy admin.
- **Referências de substrato:** DECISION-0020 (Location Core — `countries→states→cities→neighborhoods`,
  `addresses`, `address_assignments`), DECISION-0049 (`regional_origin_basis` em `economic_policy_lines`),
  DECISION-0079 (proibição de uso territorial de texto livre de bairro), `economic_policies` /
  `economic_policy_lines` / `economic_policy_resolution_logs`, `bank_splits` / `bank_ledger`.

---

## 0. Contexto e problema (o que o GATE achou)

O sistema já tem o esqueleto da policy financeira versionada (`economic_policies` +
`economic_policy_lines` + resolver `economicPolicyEngineService` + trilha append-only
`economic_policy_resolution_logs`), e o dinheiro **sempre** permanece no Bank (`regional_fund` é conta
no `bank_ledger`, não há saldo fora do Bank). Referral, grupos e sistema/expansão já têm destino
(`referrer_actor_wallet`, `group_wallet`, `platform_fees`/`platform_revenue`).

Porém o GATE read-first (2026-07-09) provou **quatro lacunas** que impedem a distribuição regional que a
visão UnifiCard exige:

1. **Não há eixo de NÍVEL territorial.** Existe um único destino `regional_fund`. O
   `regional_origin_basis` (DECISION-0049) escolhe **de qual endereço** vem a região (payer_residence,
   receiver_residence, company_operational/hq, service/transaction_location, explicit_economic_region) —
   **não** o **nível** (planeta/país/estado/cidade/bairro). São eixos ortogonais: *basis* = de onde;
   *level* = para qual nível vai a fatia.
2. **Fundo chaveado por STRING.** `ensureRegionalFundBankAccountForRegion` resolve
   `system:regional_fund:{tenant}:{country}-{state}-{city}` — string, sem bairro, sem planeta, **sem FK**.
   Isso é o risco de "geografia paralela": `"SP"` vs `"São Paulo"` gerariam pools distintos.
3. **Base = gross/net, não comissão.** `economic_policy_lines.applies_to` só aceita `'gross'`/`'net'`.
   A redistribuição regional/indicação/grupo deve incidir sobre a **comissão UnifiCard** (DECISION-0165 D1).
4. **Policy editável in-place.** `economic_policies` só tem trigger de `updated_at`; a trilha append-only
   é do RESOLUTION_LOG, não da própria policy. Não há snapshot de jurisdição nem `policy_version_id` em
   `bank_splits`. Imutabilidade hoje é convenção, não trava de banco.

---

## 1. Princípio central

> A comissão que sai da base econômica do comprador **retorna** a essa base, fatiada por níveis
> territoriais governados, sem ser extraída para o local do gasto e sem inventar geografia paralela.
> O admin **configura** a policy; o admin **não move dinheiro**. O Bank executa transação, split e ledger.

**Estrutura territorial: macro→micro** (`planeta→país→estado→cidade→bairro`).
**Resolução da transação: micro→macro** (o comprador é resolvido no menor nível cadastrado e a árvore
sobe até o planeta). **Distribuição: conforme a policy**, por nível.

---

## 2. Decisões (D0–D6)

### D0 — Origem regional padrão = jurisdição cadastral do comprador
- A distribuição regional **padrão** da comissão UnifiCard usa a **jurisdição cadastral do comprador**.
  - **PF:** residência canônica (`address_assignments` role de residência).
  - **PJ:** endereço cadastral/fiscal canônico (HQ/fiscal).
- `transaction_location` (local do gasto) **pode** existir como *basis* opcional futuro, mas **não é o
  padrão**.
- **Motivo:** devolver parte da comissão à região de **origem econômica** do comprador, evitando extração
  de valor sem retorno comunitário. Exemplo: comprador cadastrado em Curitiba gasta na Itália → a parte
  regional volta para Terra→Brasil→Paraná→Curitiba(→bairro cadastrado), não para o local do gasto.
- Implementação futura: o *basis* padrão das linhas `regional_fund` = `payer_identity_residence` (PF) /
  endereço fiscal (PJ), reusando o vocabulário **já existente** de `regional_origin_basis` (DECISION-0049).
  **Não** criar vocabulário de origem novo.

### D1 — Base da distribuição = comissão UnifiCard (não gross/net da venda)
- A redistribuição **regional, indicação, grupos e sistema/expansão** incide sobre a **comissão UnifiCard**
  resolvida, não diretamente sobre o `gross` da venda — salvo policy explícita futura.
- Materialização (a escolher na Fase 4, ambas aceitáveis): estender `applies_to` com `'commission'`, **ou**
  formalizar `policy_type = COMMISSION_SPLIT` cuja base é a comissão resolvida. Preserva BPS inteiro e o
  pipeline canônico (economicPolicyEngine DECIDE → bank-transaction EXECUTA → bank_splits/ledger PERSISTE).

### D2 — Multi-nível territorial via `regional_level`
- Adicionar eixo **`regional_level`** às linhas `regional_fund`, **ortogonal** ao `regional_origin_basis`.
- Níveis governados em v1: **`planet`, `country`, `state`, `city`, `neighborhood`**.
- Uma policy pode ter **múltiplas** linhas `regional_fund`, **uma por nível**, cada uma com seus BPS sobre
  a comissão. O *basis* (D0) diz **de onde** resolver a árvore; o *level* diz **para qual nível** vai a fatia.

### D3 — Fundo regional por FK (nunca string solta)
- Criar/resolver `regional_fund_accounts` por **IDs territoriais canônicos** do Location Core
  (`country_id`/`state_id`/`city_id`/`neighborhood_id`, nullable conforme o nível) + `bank_account_id` +
  `UNIQUE` sobre o tuple (tenant, scope/level, ids). Resolver por FK, nunca por string concatenada.
- `owner_id` string, se existir, é **apenas rótulo técnico**, **não** fonte de verdade geográfica.
- Elimina o risco de geografia paralela (G2 do GATE).

### D4 — Bairro fica em HOLD no MVP (sem catálogo governado)
- Bairro **permanece parte da arquitetura**. Porém, se o catálogo `neighborhoods` estiver vazio ou não
  governado, o nível `neighborhood` fica **HOLD no MVP** — não bloqueia os outros 4 níveis.
- **Proibido** pagar fundo de bairro por **texto livre** (reafirma DECISION-0079): evita fundos
  duplicados/errados (`"Centro"` vs `"centro"` vs `"Bairro Centro"`).
- **MVP v1 = 4 níveis** (planet/country/state/city). Alternativa soberana futura: **semear o catálogo
  oficial de bairros ANTES** de ativar o nível `neighborhood` — decisão de sequência do Clayton.

### D5 — Imutabilidade da policy + snapshot de jurisdição
- Policy **ativa não é editada in-place**: alteração gera **nova versão** (trigger append-only em
  `economic_policies`/`economic_policy_lines`).
- `bank_splits` deve carregar **`policy_version_id`** (qual versão decidiu o split) e um **snapshot
  imutável da jurisdição resolvida** no momento da transação (os IDs territoriais + o *basis* usado).
- Materializa D9/D6 da DECISION-0165 como trava de banco, não convenção.

### D6 — Admin CRUD por último (depois das travas estruturais)
- Admin CRUD de policy **versionada** (criar/listar/ativar/desativar/nova-versão) atrás de
  `requireRole(['admin'])`, **somente depois** das travas D1–D5.
- **Admin configura policy; admin não move dinheiro.** O Bank executa transação, split e ledger.
- Não construir painel sobre base que ainda não garante a verdade territorial.

---

## 3. Sequência de fases recomendada (executar em frentes próprias, com GATE por fatia)

- **Fase 0 (esta):** DECISION-0166 docs-only ratificando D0–D6.
- **Fase 1:** imutabilidade append-only da policy + `policy_version_id` e snapshot de jurisdição em
  `bank_splits` (as **travas** primeiro).
- **Fase 2:** `regional_fund_accounts` (resolver por FK) + endereço PF/PJ resolvendo IDs canônicos (D0/D3).
- **Fase 3:** eixo `regional_level` nas linhas `regional_fund` + resolver de fundo por nível (4 níveis;
  bairro HOLD por D4).
- **Fase 4:** base = comissão (`applies_to='commission'` ou `policy_type=COMMISSION_SPLIT`) (D1).
- **Fase 5:** admin CRUD versionado (D6).

**Regra dura:** nenhum saldo semeado, nenhuma policy ativa criada com dinheiro real e nenhum split
regional real **antes** das Fases 1–2 seladas. A superfície admin (Fase 5) vem por último.

---

## 4. Escopo negativo (o que esta decisão NÃO faz)

- Não edita código, não cria migration, não semeia dado, não cria saldo.
- Não ativa split regional real, não cria dashboard, não toca voucher, não toca adquirente externo.
- Não fecha `bankSplitEngineService` legado (VIVO/HOLD para `group_contribution` — cutover é fatia própria
  desta frente, não desta decisão).
- Não altera o pipeline canônico já consolidado pela DECISION-0165.

---

## 5. Invariantes que esta decisão preserva

- Dinheiro **sempre** no Bank (regional_fund = conta no `bank_ledger`). Admin não move dinheiro.
- BPS inteiro; um só pipeline (policyEngine DECIDE → bank-transaction EXECUTA → splits/ledger PERSISTE).
- Frontend/admin **projeta e configura**, não cria verdade territorial nem geografia paralela.
- Geografia = FK do Location Core (DECISION-0020), nunca string.
- Origem econômica do comprador é o padrão (D0); local do gasto é opcional, não default.

---

## 6. ADENDO 2026-07-10 — D7 e D8 (ratificados por Clayton ANTES da Fase 3; docs-only)

Contexto: Fases 1 (imutabilidade+snapshot) e 2 (geografia por FK + excisão do trilho paralelo)
SELADAS. Antes de fatiar a comissão em níveis (Fase 3), Clayton cravou dois pontos que estavam
implícitos e precisam ser norma explícita: **imposto vem antes/à parte da distribuição social**,
e **o admin liga/desliga destinos e ajusta percentuais — sempre por policy versionada**.

### D7 — Fiscalidade / impostos ANTES da distribuição social
- O split deve contemplar **impostos, obrigações fiscais, retenções, taxas externas e reservas
  fiscais**. A ordem lógica do valor é:
  ```
  valor bruto da transação
  → taxas externas de pagamento (adquirente etc., quando existirem)
  → comissão UnifiCard bruta
  → reserva/obrigação fiscal
  → comissão DISTRIBUÍVEL
  → fundos regionais / grupos / indicação / sistema
  ```
- **Imposto NÃO é redirecionamento social.** É obrigação fiscal — linha própria/reserva fiscal
  versionada (vocabulário candidato: `tax_reserve` / `fiscal_obligation` / `tax_liability`;
  escolha exata na fatia que materializar), tratada ANTES da distribuição livre da comissão.
- A base distribuível pode ser **comissão bruta ou comissão líquida**, conforme policy
  **versionada** — nunca implícita.
- **Nenhum percentual regional/grupo/indicação/sistema pode assumir que 100% da comissão bruta
  está livre.**
- Detalhes fiscais concretos (alíquotas, regimes, retenções) dependem de contador/regra
  tributária aplicável e devem ser **parametrizados e versionados na policy — nunca hardcoded**.

### D8 — Admin: toggles de destino e percentuais, sempre por nova versão
- O painel admin deve permitir **ativar/desativar** redirecionamentos:
  planeta · país · estado · cidade · **bairro (quando governado — D4)** · indicação · grupos ·
  sistema/expansão · **reserva fiscal (quando aplicável — D7)**.
- O admin pode **ajustar percentuais dentro de limites governados** (tetos/pisos definidos por
  regra, ex.: teto máximo de comissão).
- **Toda alteração gera NOVA VERSÃO de policy** — policy ativa não é editada in-place (D5/F1-a,
  já é trava de banco).
- A **soma das linhas ativas precisa fechar corretamente** conforme a base definida (validação
  material, não convenção).
- **Linhas obrigatórias** (ex.: fiscalidade do D7, sistema mínimo) **não podem ser desligadas**
  se a policy/regra exigir — o toggle é governado, não absoluto.
- **Admin configura policy; Bank executa split e ledger. Admin não move dinheiro.**

### Escopo do adendo
Docs-only: sem código, sem migration, sem seed, sem saldo, sem ativar split real. D7 impacta o
desenho da Fase 3/4 (a base multi-nível NÃO é 100% da comissão bruta por default); D8 é o
contrato da Fase 5 (admin CRUD). A materialização de cada um exige GO próprio por fatia.
