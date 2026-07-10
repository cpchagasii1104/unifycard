# DECISION-0167 — Motor de Provisão Fiscal: desenho normativo (Fase 4d-0 da F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION)

- **Status:** RATIFICADA (docs-only) — GO 4d-0 de Clayton em 2026-07-10. **NÃO autoriza implementação:**
  o motor material (4d-1+) permanece TRANCADO por GO próprio e separado (DECISION-0166 D9.7).
- **Data:** 2026-07-10
- **Autoridade:** Clayton (soberana), sobre base conceitual validada (padrões de sistemas de referência —
  ledger central, motor fiscal em 4 estágios, configuração versionada, classificação por catálogo,
  dois contribuintes de marketplace, provisão ≠ apuração).
- **Predecessoras:** DECISION-0166 D0–D9 (em especial D7 cascata do valor, D9 Lei do Contador, D9.5
  vocabulários, D9.7 governança) · DECISION-0165 (pipeline canônico) · Fases 4a/4b/4c SELADAS.
- **Substrato existente que esta decisão COMPÕE (nada novo é criado aqui):** `bank_ledger` (SSOT dinheiro) ·
  `economic_policies`/`economic_policy_lines` versionadas/imutáveis (F1) · `fiscal_identities` +
  `actor_fiscal_profiles` (casa do contribuinte, 4b) · `tax_types`/`tax_rules` + repository/resolução (4c) ·
  Location Core (DECISION-0020) · `concepts` (SSOT semântico) · `FISCAL_CONFIG_MISSING` (D9.2) ·
  guard `audit-fiscal-tax-catalog` (4c-3).

---

## §1 — O MOTOR NÃO É APURAÇÃO OFICIAL (reafirmação vinculante da Lei do Contador)

1. O UnifiCard **NÃO é Receita Federal**, prefeitura, estado nem autoridade fiscal de nenhum país.
2. O UnifiCard **NÃO substitui o contador**.
3. O motor 4d calcula **PROVISÃO INTERNA ESTIMADA**, derivada exclusivamente de configuração
   versionada feita por contribuinte/contador/admin autorizado (D9.1.4).
4. **Apuração, declaração e recolhimento oficial ficam FORA do sistema** — são do contribuinte e
   do contador dele.
5. Toda superfície que exibir provisão exibe RÓTULO de estimativa (§9); nenhum número do motor é
   "imposto oficial".

## §2 — EVENTO TRIBUTÁVEL CANÔNICO (`TaxableEvent`, contrato conceitual)

O motor só enxerga o mundo através de UM contrato: o evento econômico canônico. Campos mínimos:

| Campo | Fonte canônica |
|---|---|
| `tenant_id` | contexto multi-tenant obrigatório |
| `transaction_context` | contexto do pipeline (ex.: service_booking) — vocabulário existente |
| `seller_actor_id` | actors (identidade §4.8) |
| `buyer_actor_id?` | actors (quando houver comprador identificado) |
| `taxpayer_kind` | `'actor' \| 'platform'` (D9.3; mesmo vocabulário da 4c-1) |
| `fiscal_identity_id?` | fiscal_identities (quando aplicável — PJ) |
| `actor_fiscal_profile_id` + `version` | actor_fiscal_profiles ATIVO e vigente |
| `tax_regime` | derivado do perfil ativo (nunca declarado pelo caller) |
| `concept_id` | concepts — O QUE foi vendido/prestado (SSOT semântico) |
| `platform_revenue_stream?` | PLATFORM_REVENUE_STREAMS (só quando taxpayer_kind='platform') |
| `country_id` / `state_id?` / `city_id?` | Location Core por FK (jurisdição cadastral — D0) |
| `occurred_at` / `effective_at` | tempo do fato vs data de vigência a considerar |
| `gross_transaction_cents` | valor bruto (centavos inteiros) |
| `commission_gross_cents?` | comissão bruta resolvida (quando taxpayer_kind='platform') |
| `currency` | moeda |
| `source_module` + `source_reference_id` | rastreabilidade de origem (qual vertical, qual registro) |

**REGRA DE ACOPLAMENTO (a mais importante desta decisão):** NENHUMA vertical entende imposto.
Produto, serviço, PDV, marketplace, evento/ingresso, locação, corrida, entrega, logística **apenas
emitem o evento econômico canônico** e entregam ao pipeline único (policy engine DECIDE → Bank
EXECUTA → splits/ledger PERSISTEM). PDV não calcula imposto. Produto não guarda alíquota. Serviço
não guarda regra fiscal. Categoria/TREE não vira verdade fiscal. Vertical nova = zero código fiscal.
O caminho é sempre: **CONCEPT + actor_fiscal_profile + tax_rules + policy engine**.

## §3 — FONTES CANÔNICAS (allowlist fechada de leitura)

O motor SÓ PODE ler: `actor_fiscal_profiles` · `fiscal_identities` · `tax_types` · `tax_rules`
(via `taxCatalogRepository.resolveApplicableRules`/`resolveRuleOrMissing` — o resolver da 4c-2 é o
ÚNICO ponto de resolução de regra) · Location Core · `concepts` · policy econômica versionada ·
o `TaxableEvent`.

O motor NÃO PODE ler: categoria/TREE como identidade (§12 do protocolo) · campo solto de alíquota
em produto/serviço/oferta · configuração fiscal guardada em vertical · saldo/estado financeiro fora
do Bank (Lei de Coerência §4.6) · nenhuma fonte que não esteja na allowlist acima. Guard futuro (4f)
materializa esta allowlist.

## §4 — RESULTADO DO MOTOR (`TaxProvisionResult`, contrato conceitual)

O motor produz DECISÃO/PROPOSTA auditável — **na 4d v1 NÃO move dinheiro, NÃO cria ledger, NÃO
cria tax_reserve**. (A materialização em linha de split é a 4e — separação cravada por Clayton.)

| Campo | Semântica |
|---|---|
| `status` | `'found'` \| `'fiscal_config_missing'` \| `'not_applicable'` |
| `tax_rule_id` + `tax_rule_version` | QUAL regra decidiu (imutável — a regra ativa não é editável) |
| `tax_type_id` | qual tributo |
| `taxpayer_kind` | actor \| platform |
| `base_type` | `'gross_transaction'` \| `'commission_gross'` \| `'commission_distributable'` (§5) |
| `base_cents` | a base efetivamente usada (centavos inteiros) |
| `rate_bps` | a alíquota da regra (DADO, ecoado para auditoria) |
| `provision_cents` | o valor provisionado estimado |
| `rounding_mode` | o modo de arredondamento APLICADO (vem de configuração — §8) |
| `fiscal_snapshot` | snapshot imutável: perfil/versão, regime, jurisdição (IDs), concept, stream, datas |
| `source` | a fonte da regra (norma/contador/URL — ecoada) |
| `effective_from`/`effective_until` | vigência da regra usada |
| `warnings[]` | avisos não-bloqueantes (ex.: regra genérica usada por falta de específica) |

`fiscal_snapshot` espelha a doutrina de `policy_version_id`/`jurisdiction_snapshot` de `bank_splits`
(Fases 1–2): o que decidiu fica gravado para sempre, mesmo que a configuração mude amanhã.
`not_applicable` ≠ `fiscal_config_missing`: o primeiro é "este evento não atrai este tributo por
regra explícita"; o segundo é "não há configuração — o sistema não sabe e NÃO INVENTA".

## §5 — BASES DE CÁLCULO (materialização futura do applies_to D9.5.12)

Cascata do valor (D7, já norma): `bruto → taxas externas → comissão bruta → reserva fiscal →
comissão distribuível → fundos regionais/grupos/indicação/sistema`.

- `gross_transaction` — base para provisão do **actor** sobre a receita DELE (ex.: venda de produto/
  serviço/locação). Informativa/apoio ao contador; o recolhimento é do actor.
- `commission_gross` — base para provisão da **plataforma** sobre a comissão/receita própria (por
  `platform_revenue_stream`).
- `commission_distributable` — o que SOBRA após a reserva fiscal; é a base das distribuições
  sociais/regionais (D7: nenhum percentual social assume 100% da comissão bruta).
- **Nada disso altera Bank/schema na 4d-0.** A extensão material do CHECK de
  `economic_policy_lines.applies_to` é a fatia 4d-2, invertendo CONSCIENTEMENTE o guard da 4c-3
  (que hoje a proíbe de propósito).

## §6 — DOIS CONTRIBUINTES, DUAS PASSADAS, NUNCA A MESMA LINHA (D9.3)

**Actor/empresa:** provisão sobre a receita dele (venda de produto, serviço, PDV, locação, corrida…).
Finalidade: relatório, precificação, apoio ao contador do actor. Base típica: `gross_transaction`.

**Plataforma/UnifiCard:** provisão sobre as receitas próprias, por stream —
`marketplace_commission` · `advertising` · `own_tickets` · `acquiring_fees` · `physical_structures` ·
`other`. Base típica: `commission_gross`. A UnifiCard é "só mais um contribuinte" dentro da própria
infraestrutura — mesmas tabelas, mesmo motor.

**PROIBIDO:** misturar os dois contribuintes no mesmo cálculo, na mesma linha de resultado ou na
mesma linha de split futura. O motor roda como passadas independentes sobre o mesmo evento.

## §7 — `fiscal_config_missing`: TRÊS COMPORTAMENTOS (D9.2 operacionalizado)

1. **Contexto INFORMATIVO** (PDV, precificação, simulação, painel): NÃO bloqueia; mostra aviso
   honesto; NÃO inventa imposto; registra a ausência na trilha.
2. **Contexto OBRIGATÓRIO** (policy ativa exige provisão fiscal — futura linha `tax_reserve`):
   **fail-closed** — a transação NÃO fecha sem regra configurada. É design (D9.6.18), não bug.
3. **AUDITORIA SEMPRE:** toda resolução (achou ou não) registra em trilha auditável: qual regra foi
   buscada · por qual perfil fiscal/versão/regime · qual território (IDs) · qual concept · qual
   stream · e POR QUE não encontrou (dimensão faltante). Molde: `economic_policy_resolution_logs`
   (append-only, já existente para a policy). O contador enxerga exatamente o que falta configurar.

## §8 — ARREDONDAMENTO É CONFIGURAÇÃO FISCAL, NÃO DETALHE DE CÓDIGO

Cada jurisdição tem norma própria de arredondamento. Portanto: `rounding_mode` é atributo de
CONFIGURAÇÃO (da regra/jurisdição, com default governado explícito), ecoado no resultado.
**PROIBIDO hardcodar:** `Math.round`/`floor`/`ceil` decidindo arredondamento fiscal por conta
própria, centavos arbitrários, percentual literal (o guard 4c-3 já morde percentuais; o guard do
motor em 4f estende ao arredondamento).

## §9 — SUPERFÍCIE PARA EMPRESA/PDV (visão futura, SEM implementar aqui)

- Painel da empresa mostra **provisão estimada** com proveniência: regime, regra/versão, quem
  configurou, fonte, data.
- PDV mostra **imposto estimado** ou **pendência fiscal** — nunca silêncio, nunca número inventado.
- Precificação pode exibir margem considerando a provisão.
- Rótulo obrigatório: **"estimativa conforme configuração fiscal vigente"**.
- Sem configuração: **"fiscal_config_missing — fale com seu contador"** — e a empresa que NASCE
  dentro do sistema nasce com essa pendência HONESTA no checklist de onboarding (não com default
  silencioso).
- Exibição imposto-embutido vs imposto-adicionado ao preço = configuração de jurisdição/exibição;
  afeta display, nunca o ledger.
- Tudo isso é READ MODEL derivado (PROFILE/superfície nunca é fonte — protocolo §2.3.4).

## §10 — INTEGRAÇÃO FUTURA COM CONTADORES/SISTEMAS EXTERNOS (registrado como FUTURO, fora da v1)

Exportação de relatórios de provisão para o contador · integração com sistemas contábeis ·
possível módulo fiscal interno pago · eventual integração NF-e/NFC-e/SPED. **Tudo fora da 4d v1**;
cada item exigirá frente própria com GO. A DT-INVOICING-HARDCODED-TAX-RATE (OPEN) converge para cá:
quando o motor existir, invoice lê provisão do motor ou fica 0 + fiscal_config_missing — nunca 5%
inventado.

## §11 — GAPS DECLARADOS (fora da v1, cada um com lar futuro nomeado)

| Gap | Lar futuro |
|---|---|
| Identidade fiscal multi-país (além de CNPJ 14 dígitos) | evolução de `fiscal_identities` (frente própria) |
| Regimes fiscais por país como CATÁLOGO governado (não CHECK fixo BR) | evolução do vocabulário TaxRegime via governança; `OTHER` é a válvula honesta até lá |
| Retenção na fonte (quem RECOLHE ≠ quem DEVE) | dimensão nova em tax_rules + linha de split "reserva em nome de terceiro" (4e-avançado/4f) |
| Marketplace facilitator (plataforma recolhe pelo actor) | idem retenção |
| Mapeamento formal concept → NCM / LC116 / VAT category | tabela governada `concept_fiscal_classifications` quando um país exigir; `concept_id` direto basta na v1 |
| Emissão fiscal (NF-e/NFC-e) | frente própria invoicing/fiscal-document |
| Apuração oficial / recolhimento / integrações Receita-contador | FORA por doutrina (§1) — no máximo exportação |
| Substituição tributária | pós-retenção, com contador |
| Imposto por local de CONSUMO ≠ endereço cadastral | novo basis por tax_type (compõe do Location Core + vocabulário regional_origin_basis existente) |
| Regras específicas de PDV/NF-e (CFOP, CST etc.) | frente de emissão fiscal |

## §12 — SEQUÊNCIA FUTURA (registrada, NENHUMA aberta por esta decisão)

- **4d-1:** motor READ-ONLY — calcula/projeta provisão e LOGA o `TaxProvisionResult` em trilha
  auditável, **zero split, zero Bank** (dá para provar contra casos reais de contador sem mover
  um centavo).
- **4d-2:** materializar `applies_to` fiscal em `economic_policy_lines` (inversão CONSCIENTE do
  guard 4c-3 nessa fatia).
- **4e:** `tax_reserve` como linha de split/Bank (a provisão vira reserva DENTRO do ledger — conta
  Bank, molde regional_fund_accounts: FK para conta, ZERO saldo fora).
- **4f:** guards finais do motor/reserva (allowlist de fontes §3, anti-arredondamento-hardcoded,
  anti-mistura-de-contribuintes, snapshot obrigatório).
- **Cada fatia exige GO próprio de Clayton (D9.7). Esta decisão NÃO abre nenhuma.**

## §13 — ESCOPO NEGATIVO DESTA DECISÃO (4d-0)

Docs-only: zero código, zero motor, zero schema/migration, zero mudança em `applies_to`, zero
`tax_reserve`, zero toque em Bank/ledger/split/orders/checkout/payment_intents, zero correção de
invoicing, zero NF-e/NFC-e, zero admin/painel/rota HTTP. O guard `audit-fiscal-tax-catalog` (4c-3)
permanece intacto e vigente — inclusive as travas que ESTA decisão prevê inverter conscientemente
nas fatias 4d-2/4e.

---

## Invariantes que esta decisão preserva
- Dinheiro **sempre** no Bank; provisão v1 é DECISÃO/LOG, reserva (4e) é conta no ledger.
- UM pipeline (policy engine decide → Bank executa → splits/ledger persistem); o motor fiscal é
  ESTÁGIO do pipeline, nunca serviço avulso chamado por vertical.
- CONCEPT é a única identidade do que se vende; categoria/TREE nunca é verdade fiscal.
- Configuração fiscal é versionada, imutável-quando-ativa, com fonte e vigência — e é do
  CONTRIBUINTE/CONTADOR, nunca do sistema (Lei do Contador).
- Ausência de configuração = `fiscal_config_missing` honesto; silêncio nunca; invenção nunca;
  rastro sempre (D9.2).
