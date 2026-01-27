# FEATURE MARKETPLACE MULTI-VENDOR — UNIFICARD

**Status:** CANÔNICO · VINCULANTE  
**Autoridade:** NÍVEL 3 (FEATURE DE PRODUTO)  
**Escopo:** Modelo Canônico de Marketplace Multi-Vendedor  
**Data de Criação:** 2026-01-XX  
**Validação:** IA Guardiã Institucional  

---

## 1. DECLARAÇÃO FORMAL

O UnifiCard declara formalmente o **MODELO CANÔNICO DA FEATURE DE PRODUTO "Marketplace Multi-Vendedor"**.

Esta feature é:
- ✅ Classificada como **FEATURE DE PRODUTO (NÍVEL 3)**
- ✅ Marketplace é **MÓDULO**, não Core
- ✅ Depende **OBRIGATORIAMENTE** do Core Financeiro existente
- ✅ Não altera Core Financeiro
- ✅ Não cria nova fonte de verdade
- ✅ Não reabre hardening estrutural

Este documento é vinculante para:
- todas as IAs (Guardiã, Executora, Gestora de Docs)
- todos os desenvolvedores
- todas as decisões futuras sobre marketplace multi-vendedor

---

## 2. CLASSIFICAÇÃO INSTITUCIONAL

### 2.1 Nível de Autoridade

**NÍVEL 3 (FEATURE DE PRODUTO)**

Conforme `HARDENING_CYCLE_CLOSURE.md`:
- Features de produto são permitidas após encerramento do hardening estrutural
- Features não alteram Core
- Features não criam novas fontes de verdade
- Features podem evoluir sem reabrir ciclos de hardening

### 2.2 Natureza do Marketplace

**MÓDULO, NÃO CORE**

Conforme `CORE_VS_MODULOS_CONTRACT.md`:
- Marketplace depende do Core para funcionar
- Marketplace não define verdade financeira
- Marketplace não cria regras universais
- Marketplace se conecta ao Core, não o substitui

### 2.3 Dependências Obrigatórias

**CORE FINANCEIRO EXISTENTE**

Marketplace multi-vendedor **DEVE** usar exclusivamente:
- `CORE_SPLIT_PAGAMENTO_CANONICO.md` — Split canônico via UnifyBank
- `CORE_ESTORNOS_FINANCEIROS_CANONICO.md` — Estornos financeiros canônicos
- `bank-split-engine.service.ts` — Engine canônico de split
- `bank_splits` — Tabela canônica de splits
- `bank_ledger` — Fonte única de verdade de saldo
- `bank_transactions` — Transações financeiras canônicas

**PROIBIÇÃO ABSOLUTA:**
- Criar engines paralelos de split
- Calcular splits inline
- Criar tabelas paralelas de split
- Misturar saldos contábeis

---

## 3. MODELO CANÔNICO DE MARKETPLACE MULTI-VENDOR

### 3.1 Princípios Fundamentais

1. **Carrinho Único**: Um carrinho por usuário, com agrupamento por vendedor
2. **Checkout Único**: Um checkout por carrinho, independente do número de vendedores
3. **Pagamento Único**: Um pagamento consolidado para todo o checkout
4. **Split Múltiplo**: Múltiplos splits via Core Financeiro (UnifyBank)
5. **Estorno por Item**: Estorno granular por item, via Core Financeiro
6. **Frete Separado**: Frete calculado por vendedor, nunca misturado ao split de produto
7. **Nota Fiscal por Vendedor**: Emissão individual por vendedor, plataforma como intermediadora

### 3.2 Carrinho Multi-Vendor

**Modelo:** Carrinho único com agrupamento por vendedor

**Estrutura Conceitual:**
- Um carrinho (`Cart`) por usuário
- Itens agrupados por `store_id` (vendedor)
- Cada item referencia:
  - `product_id` — produto específico
  - `store_id` — vendedor (Actor)
  - `quantity` — quantidade
  - `unit_price` — preço unitário
- Subtotal calculado por vendedor
- Total = soma de todos os subtotais

**Regras:**
- Carrinho pode conter itens de múltiplos vendedores
- Agrupamento por `store_id` é obrigatório
- Subtotal por vendedor é obrigatório
- Total consolidado é obrigatório

**Proibições:**
- Múltiplos carrinhos por usuário
- Carrinho sem agrupamento por vendedor
- Subtotal sem identificação de vendedor

### 3.3 Checkout Multi-Vendor

**Modelo:** Checkout único consolidado

**Estrutura Conceitual:**
- Um `CheckoutIntent` por carrinho
- `CheckoutIntent` agrupa itens por `store_id`
- Cada grupo representa uma "sub-order" por vendedor
- Total consolidado = soma de todos os subtotais

**Fluxo Canônico:**
1. Carrinho → `CheckoutIntent` (agrupamento por `store_id`)
2. `CheckoutIntent` calcula subtotais por vendedor
3. `CheckoutIntent` calcula total consolidado
4. Checkout exibe breakdown por vendedor (opcional, UX)

**Regras:**
- Um checkout por carrinho
- Agrupamento por `store_id` é obrigatório
- Total consolidado é obrigatório
- Breakdown por vendedor é opcional (read-model)

**Proibições:**
- Múltiplos checkouts para um carrinho
- Checkout sem agrupamento por vendedor
- Checkout sem total consolidado

### 3.4 Pagamento Multi-Vendor

**Modelo:** Pagamento único consolidado

**Estrutura Conceitual:**
- Um `bank_transaction` única com valor total consolidado
- Transação referencia `CheckoutIntent` via `metadata.checkout_id`
- Transação referencia múltiplos vendedores via `metadata.store_ids[]`

**Fluxo Canônico:**
1. `CheckoutIntent` confirmado → criar `bank_transaction` única
2. Valor da transação = total consolidado do checkout
3. Transação persiste em `bank_transactions`
4. Transação gera múltiplos splits via `bank-split-engine.service.ts`

**Regras:**
- Um pagamento por checkout
- Valor consolidado é obrigatório
- Referência a `CheckoutIntent` é obrigatória
- Referência a vendedores via metadata é obrigatória

**Proibições:**
- Múltiplos pagamentos para um checkout
- Pagamento sem valor consolidado
- Pagamento sem referência a checkout
- Pagamento sem splits

### 3.5 Split Multi-Vendor

**Modelo:** Uma transação, múltiplos splits via Core Financeiro

**Estrutura Conceitual:**
- Uma `bank_transaction` única
- Múltiplos `bank_splits` (um por vendedor + splits de sistema)
- Cada split referencia:
  - `transaction_id` — transação única
  - `target_account_id` — conta do vendedor ou sistema
  - `amount` — valor do split
  - `split_type` — tipo (revenue_share, fee, regional_fund, etc.)
  - `metadata.store_id` — vendedor (se aplicável)

**Fluxo Canônico:**
1. Criar `bank_transaction` única com valor total
2. Para cada vendedor no checkout:
   - Resolver `workerAccountId` = conta do vendedor (Actor da loja)
   - Chamar `bank-split-engine.service.ts.calculateSplits()` com contexto:
     - `source: 'marketplace'`
     - `metadata.store_id` = ID do vendedor
     - `metadata.checkout_id` = ID do checkout
     - `metadata.order_id` = ID do pedido (se aplicável)
     - `workerAccountId` = conta do vendedor
3. Engine calcula splits canônicos (revenue_share, fee, regional_fund, etc.)
4. Splits persistem em `bank_splits` via engine
5. Splits registram no `bank_ledger` via engine

**Regras:**
- Split é calculado exclusivamente via `bank-split-engine.service.ts`
- Split persiste exclusivamente em `bank_splits`
- Split registra no `bank_ledger` via engine
- Metadata obrigatória: `store_id`, `checkout_id`

**Proibições Absolutas:**
- Calcular splits inline (viola `CORE_SPLIT_PAGAMENTO_CANONICO.md` seção 12.1 item 2)
- Criar splits diretamente em `bank_splits` sem engine (viola seção 12.3 item 1)
- Criar engines paralelos de split (viola seção 12.1 item 3)
- Misturar saldos contábeis entre Actors (viola seção 12.2 item 2)

---

## 4. ESTRUTURA CONCEITUAL (SEM CÓDIGO)

### 4.1 Entidades Conceituais

**Order (Pedido)**
- Representa intenção de compra
- Pode conter itens de múltiplos vendedores
- Agrupamento por `store_id` é obrigatório
- Status: DRAFT → SUBMITTED → CONFIRMED → PAID → SHIPPED → DELIVERED

**CheckoutIntent (Intenção de Checkout)**
- Representa preparação para pagamento
- Agrupa itens por `store_id`
- Calcula subtotais por vendedor
- Calcula total consolidado
- Status: OPEN → CONFIRMED → PAID → INVOICED

**Item (Item do Pedido)**
- Representa produto específico no carrinho
- Referencia `product_id` e `store_id`
- Quantidade e preço unitário
- Subtotal = quantidade × preço unitário

**Vendedor (Store/Actor)**
- Representa vendedor no marketplace
- É um Actor (conforme `CORE_IMUTAVEL.md`)
- Possui conta financeira própria
- Recebe split via `revenue_share`

### 4.2 Vínculos Explícitos

**Item → Vendedor**
- Cada item referencia `store_id`
- `store_id` é Actor (vendedor)
- Vendedor possui conta financeira própria
- Vendedor recebe split via `revenue_share`

**Checkout → Pagamento**
- Um checkout gera um pagamento único
- Pagamento referencia `checkout_id` via metadata
- Valor do pagamento = total consolidado do checkout

**Pagamento → Splits**
- Um pagamento gera múltiplos splits
- Splits são calculados via `bank-split-engine.service.ts`
- Splits persistem em `bank_splits`
- Splits registram no `bank_ledger`

### 4.3 Sem Novas Entidades Core

**Proibição Absoluta:**
- Criar novas tabelas Core Financeiro
- Criar novas estruturas de split
- Criar novas fontes de verdade financeira

**Permitido:**
- Estruturas de módulo (Order, CheckoutIntent, Item)
- Read-models de visualização
- Metadata em estruturas existentes

---

## 5. REGRAS DE ESTORNO

### 5.1 Estorno por Item

**Modelo:** Estorno granular por item, via Core Financeiro

**Estrutura Conceitual:**
- Estorno pode ser parcial (por item) ou total (por checkout)
- Estorno referencia item específico via `metadata.item_id`
- Estorno referencia vendedor via `metadata.store_id`
- Estorno segue taxonomia canônica de `CORE_ESTORNOS_FINANCEIROS_CANONICO.md`

**Fluxo Canônico:**
1. Identificar item(s) a estornar
2. Calcular valor a estornar (subtotal do item ou proporcional)
3. Identificar splits originais relacionados ao item
4. Chamar `bank-split-engine.service.ts` para split reverso determinístico
5. Criar nova transação de reversão via Core Financeiro
6. Splits reversos persistem em `bank_splits`
7. Splits reversos registram no `bank_ledger`

**Regras:**
- Estorno segue taxonomia canônica (`external_reversal`, `internal_refund`, etc.)
- Split reverso é determinístico (espelha split original)
- Autoria obrigatória (conforme `CORE_AUTORIA_FINANCEIRA_IMPLEMENTACAO.md`)
- Aprovação obrigatória para estornos manuais (conforme `CORE_APROVACAO_FINANCEIRA_CANONICO.md`)

**Proibições:**
- Estorno manual fora do engine canônico
- Estorno sem split reverso determinístico
- Estorno sem autoria obrigatória
- Estorno sem aprovação (quando aplicável)

### 5.2 Reversão via Core Financeiro

**Modelo:** Estorno sempre via Core Financeiro, nunca inline

**Fluxo Canônico:**
1. Marketplace identifica necessidade de estorno
2. Marketplace chama Core Financeiro com contexto completo
3. Core Financeiro executa estorno via `bank-split-engine.service.ts`
4. Core Financeiro persiste splits reversos
5. Core Financeiro registra no ledger
6. Marketplace recebe confirmação de estorno

**Regras:**
- Estorno sempre via Core Financeiro
- Marketplace não calcula splits reversos
- Marketplace não persiste splits reversos
- Marketplace não registra no ledger

**Proibições:**
- Estorno inline no marketplace
- Cálculo manual de splits reversos
- Persistência direta de splits reversos

---

## 6. FRETE

### 6.1 Cálculo de Frete

**Modelo:** Frete calculado por vendedor, exibido de forma consolidada

**Estrutura Conceitual:**
- Frete é calculado por vendedor (cada vendedor tem seu próprio frete)
- Frete é exibido de forma consolidada no checkout (soma de todos os fretes)
- Frete nunca é misturado ao split de produto

**Fluxo Canônico:**
1. Para cada vendedor no checkout:
   - Calcular frete baseado em:
     - Localização do vendedor
     - Localização do comprador
     - Peso/volume dos itens do vendedor
     - Regras de frete do vendedor
2. Consolidar fretes (soma de todos os fretes)
3. Exibir frete consolidado no checkout (read-model)
4. Frete é adicionado ao total do checkout
5. Frete gera split separado via Core Financeiro (se aplicável)

**Regras:**
- Frete é calculado por vendedor
- Frete é exibido de forma consolidada
- Frete nunca é misturado ao split de produto
- Frete pode gerar split separado (se vendedor cobra frete)

**Proibições:**
- Misturar frete ao split de produto
- Calcular frete sem identificar vendedor
- Consolidar fretes sem identificar origem

### 6.2 Split de Frete

**Modelo:** Frete gera split separado, se aplicável

**Estrutura Conceitual:**
- Frete pode ser cobrado pelo vendedor (split para vendedor)
- Frete pode ser cobrado pela plataforma (split para plataforma)
- Frete pode ser gratuito (sem split)

**Fluxo Canônico:**
1. Identificar se frete é cobrado
2. Se cobrado, identificar quem recebe (vendedor ou plataforma)
3. Criar split separado para frete via Core Financeiro
4. Split de frete persiste em `bank_splits` com `split_type` apropriado
5. Split de frete registra no `bank_ledger`

**Regras:**
- Split de frete é separado do split de produto
- Split de frete segue mesmo fluxo canônico de split
- Split de frete persiste em `bank_splits`
- Split de frete registra no `bank_ledger`

**Proibições:**
- Misturar split de frete ao split de produto
- Calcular split de frete inline
- Criar split de frete sem passar pelo engine canônico

---

## 7. NOTA FISCAL

### 7.1 Emissão por Vendedor

**Modelo:** Nota fiscal emitida por vendedor, plataforma como intermediadora

**Estrutura Conceitual:**
- Cada vendedor emite sua própria nota fiscal
- Plataforma atua como intermediadora (marketplace)
- Nota fiscal referencia itens do vendedor específico
- Nota fiscal referencia checkout e pagamento

**Fluxo Canônico:**
1. Após pagamento confirmado, para cada vendedor:
   - Identificar itens do vendedor no checkout
   - Calcular valor da nota fiscal (subtotal do vendedor)
   - Emitir nota fiscal em nome do vendedor
   - Plataforma registra como intermediadora
2. Nota fiscal referencia:
   - `checkout_id` — checkout original
   - `transaction_id` — transação financeira
   - `store_id` — vendedor
   - `items[]` — itens do vendedor

**Regras:**
- Nota fiscal é emitida por vendedor
- Plataforma atua como intermediadora
- Nota fiscal referencia checkout e pagamento
- Nota fiscal referencia apenas itens do vendedor

**Proibições:**
- Consolidar nota fiscal da plataforma (viola modelo fiscal)
- Emitir nota fiscal sem identificar vendedor
- Misturar itens de múltiplos vendedores em uma nota

### 7.2 Plataforma como Intermediadora

**Modelo:** Plataforma registra como intermediadora, não como vendedora

**Estrutura Conceitual:**
- Plataforma não é vendedora dos produtos
- Plataforma é intermediadora (marketplace)
- Plataforma recebe taxa de intermediação (fee)
- Plataforma não emite nota fiscal dos produtos

**Regras:**
- Plataforma atua como intermediadora
- Plataforma recebe fee (split de `fee`)
- Plataforma não emite nota fiscal dos produtos
- Plataforma pode emitir nota fiscal da taxa (se aplicável)

**Proibições:**
- Consolidar nota fiscal da plataforma
- Emitir nota fiscal dos produtos em nome da plataforma
- Misturar responsabilidade fiscal

---

## 8. INVARIANTES INSTITUCIONAIS (CHECKLIST DURO)

### 8.1 Invariantes de Checkout e Pagamento

**INVARIANTE 1: Um Checkout → Um Pagamento**
- Um `CheckoutIntent` gera exatamente uma `bank_transaction`
- Não existe checkout sem pagamento
- Não existe múltiplos pagamentos para um checkout

**INVARIANTE 2: Um Pagamento → Múltiplos Splits**
- Uma `bank_transaction` gera múltiplos `bank_splits`
- Splits são calculados via `bank-split-engine.service.ts`
- Splits persistem em `bank_splits`
- Splits registram no `bank_ledger`

**INVARIANTE 3: Split Nunca é Calculado Fora do Core**
- Split é calculado exclusivamente via `bank-split-engine.service.ts`
- Proibido calcular splits inline
- Proibido criar engines paralelos de split
- Proibido persistir splits sem passar pelo engine

### 8.2 Invariantes de Categoria

**INVARIANTE 4: Categoria Nunca Decide Split, Preço ou Fluxo**
- Categoria é descritiva apenas (conforme `Category_System_Contract_UnifiCard.md`)
- Categoria não influencia cálculo de split
- Categoria não influencia preço
- Categoria não influencia fluxo de pagamento

**Proibições:**
- Usar categoria para decisão de split
- Usar categoria para decisão de preço
- Usar categoria para decisão de fluxo

### 8.3 Invariantes de Permissões

**INVARIANTE 5: Nenhuma Nova Permissão Criada Sem Mapa Canônico**
- Permissões devem existir em `MAPA_CANONICO_PERMISSIONS_v1.md`
- Proibido criar permissões ad-hoc
- Proibido usar permissões não canônicas

**Permissões Canônicas Existentes:**
- `marketplace_execute_payments` — Executar pagamentos
- `marketplace_manage_splits` — Gerenciar splits
- `marketplace_manage_orders` — Gerenciar pedidos

### 8.4 Invariantes de Core Financeiro

**INVARIANTE 6: Nenhuma Nova Fonte de Verdade Financeira**
- UnifyBank é a única fonte de verdade financeira
- `bank_splits` é a única tabela canônica de split
- `bank_ledger` é a única fonte de verdade de saldo
- `bank_transactions` é a única tabela canônica de transações

**Proibições:**
- Criar tabelas paralelas de split
- Criar tabelas paralelas de transações
- Criar fontes paralelas de saldo

**INVARIANTE 7: Nenhuma Mistura de Saldos Contábeis**
- Saldos são separados por Actor
- Não consolidar saldos contábeis por CPF
- Consolidar apenas em relatórios (read-model)

**Proibições:**
- Misturar saldos entre Actors
- Consolidar saldos contábeis por CPF
- Criar saldos paralelos

---

## 9. O QUE ESTE DOCUMENTO NÃO FAZ

### 9.1 Não Altera Core Financeiro

Este documento:
- Não altera `CORE_SPLIT_PAGAMENTO_CANONICO.md`
- Não altera `CORE_ESTORNOS_FINANCEIROS_CANONICO.md`
- Não altera `bank-split-engine.service.ts`
- Não altera `bank_splits`, `bank_ledger`, `bank_transactions`

### 9.2 Não Cria Permissões

Este documento:
- Não cria novas permissões
- Não altera `MAPA_CANONICO_PERMISSIONS_v1.md`
- Usa apenas permissões canônicas existentes

### 9.3 Não Define UX

Este documento:
- Não define interface de usuário
- Não define fluxo de UX
- Não define design visual
- Define apenas modelo conceitual e regras institucionais

### 9.4 Não Autoriza Código Diretamente

Este documento:
- Não autoriza implementação específica
- Não define arquitetura técnica
- Não define estrutura de código
- Define apenas modelo canônico e regras institucionais

---

## 10. PRÓXIMOS PASSOS AUTORIZADOS

### 10.1 Correção Técnica de Split (OBRIGATÓRIA)

**Prioridade:** BLOQUEANTE

**Ação:**
- Substituir cálculo inline de splits (atual violação) por chamada a `bank-split-engine.service.ts`
- Validar conformidade com `CORE_SPLIT_PAGAMENTO_CANONICO.md`

**Critério de Aceite:**
- Nenhum split calculado inline
- Todos os splits passam pelo engine canônico
- Todos os splits persistem em `bank_splits`
- Todos os splits registram no `bank_ledger`

### 10.2 Evolução de Order (Se Necessário)

**Prioridade:** OPCIONAL

**Ação:**
- Decidir se `Order` suporta múltiplos `store_id` ou mantém único
- Se múltiplos: evoluir estrutura sem quebrar compatibilidade
- Se único: manter agrupamento em `CheckoutIntent` (já existe)

**Critério de Aceite:**
- Estrutura suporta multi-vendor
- Compatibilidade mantida
- Agrupamento por vendedor funcional

### 10.3 UX e Fluxo de Usuário

**Prioridade:** OPCIONAL

**Ação:**
- Definir interface de usuário para carrinho multi-vendor
- Definir fluxo de checkout multi-vendor
- Definir exibição de breakdown por vendedor

**Critério de Aceite:**
- UX clara e intuitiva
- Breakdown por vendedor visível (opcional)
- Fluxo de checkout funcional

### 10.4 Execução e Implementação

**Prioridade:** APÓS CORREÇÃO TÉCNICA

**Ação:**
- Implementar modelo canônico definido neste documento
- Validar conformidade com todos os documentos canônicos
- Testar fluxo end-to-end

**Critério de Aceite:**
- Conformidade com todos os documentos canônicos
- Fluxo end-to-end funcional
- Nenhuma violação de Core identificada

---

## 11. AUTORIDADE DOCUMENTAL

### 11.1 Documentos que Autorizam Esta Feature

- `HARDENING_CYCLE_CLOSURE.md` — Autoriza features de produto (NÍVEL 3)
- `CORE_VS_MODULOS_CONTRACT.md` — Marketplace é módulo, não Core
- `FEATURE_CONSOLIDACAO_FINANCEIRA_CLOSURE.md` — Template de formato para features

### 11.2 Documentos que Esta Feature Respeita

- `CORE_SPLIT_PAGAMENTO_CANONICO.md` — Split canônico via UnifyBank
- `CORE_ESTORNOS_FINANCEIROS_CANONICO.md` — Estornos financeiros canônicos
- `CORE_APROVACAO_FINANCEIRA_CANONICO.md` — Aprovação financeira canônica
- `CORE_AUTORIA_FINANCEIRA_IMPLEMENTACAO.md` — Autoria financeira rastreável
- `Category_System_Contract_UnifiCard.md` — Categorias não decidem
- `MAPA_CANONICO_PERMISSIONS_v1.md` — Permissões canônicas
- `CORE_IMUTAVEL.md` — Core imutável
- `CHECK_DUPLICIDADE_OBRIGATORIO.md` — Anti-duplicação

### 11.3 Documentos que Esta Feature Não Altera

- `CORE_SPLIT_PAGAMENTO_CANONICO.md` — Não alterado
- `CORE_ESTORNOS_FINANCEIROS_CANONICO.md` — Não alterado
- `CORE_APROVACAO_FINANCEIRA_CANONICO.md` — Não alterado
- `CORE_AUTORIA_FINANCEIRA_IMPLEMENTACAO.md` — Não alterado
- `CORE_IMUTAVEL.md` — Não alterado

---

## 12. DECLARAÇÃO FINAL CANÔNICA

> **No UnifiCard, marketplace multi-vendor é feature de produto (NÍVEL 3).**  
> **Marketplace é módulo que usa Core, não o substitui.**  
> **Split é Core. Core não se calcula inline. Core não se duplica.**  
> **Categoria não decide. Permissão não é ad-hoc.**  
> **Saldos não se misturam. Verdade financeira é única.**

---

**FIM DO DOCUMENTO CANÔNICO DE MARKETPLACE MULTI-VENDOR**


