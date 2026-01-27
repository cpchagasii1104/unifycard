# UX MARKETPLACE CHECKOUT MULTI-VENDOR — UNIFICARD

**Status:** CANÔNICO · VINCULANTE  
**Autoridade:** NÍVEL 3 (FEATURE DE PRODUTO)  
**Escopo:** Experiência de Usuário do Checkout Multi-Vendedor  
**Data de Criação:** 2026-01-XX  
**Validação:** IA Guardiã Institucional  

---

## 1. DECLARAÇÃO FORMAL

O UnifiCard declara formalmente a **UX CANÔNICA DA FEATURE DE PRODUTO "Checkout Multi-Vendedor"**.

Esta UX é:
- ✅ Classificada como **FEATURE DE PRODUTO (NÍVEL 3)**
- ✅ Não altera Core Financeiro
- ✅ Não cria nova fonte de verdade
- ✅ Não expõe estrutura interna do Core
- ✅ Respeita invariantes do marketplace multi-vendor

Este documento é vinculante para:
- todas as IAs (Guardiã, Executora, Gestora de Docs)
- todos os desenvolvedores
- todas as decisões futuras sobre UX de checkout multi-vendedor

---

## 2. CLASSIFICAÇÃO INSTITUCIONAL

### 2.1 Nível de Autoridade

**NÍVEL 3 (FEATURE DE PRODUTO)**

Conforme `HARDENING_CYCLE_CLOSURE.md`:
- Features de produto são permitidas após encerramento do hardening estrutural
- Features não alteram Core
- Features não criam novas fontes de verdade
- Features podem evoluir sem reabrir ciclos de hardening

### 2.2 Natureza da UX

**EXPERIÊNCIA DE USUÁRIO, NÃO LÓGICA FINANCEIRA**

A UX:
- Exibe informações derivadas do Core Financeiro
- Não calcula splits
- Não persiste transações
- Não registra ledger
- Não altera fluxo financeiro canônico

### 2.3 Dependências Obrigatórias

**MODELO CANÔNICO DO MARKETPLACE**

A UX **DEVE** respeitar exclusivamente:
- `FEATURE_MARKETPLACE_MULTI_VENDOR.md` — Modelo canônico do marketplace
- `CORE_SPLIT_PAGAMENTO_CANONICO.md` — Split canônico (para referência, não exposição)
- `CORE_ESTORNOS_FINANCEIROS_CANONICO.md` — Estornos canônicos (para referência, não exposição)

**PROIBIÇÃO ABSOLUTA:**
- Expor splits internos na UX
- Expor contas financeiras na UX
- Expor ledger na UX
- Alterar fluxo financeiro canônico via UX

---

## 3. PRINCÍPIOS DE UX (NÃO NEGOCIÁVEIS)

### 3.1 Transparência Financeira

**Regra:** O usuário deve entender claramente quanto está pagando e para quem.

**Aplicação:**
- Valores exibidos são claros e precisos
- Breakdown por vendedor é visível
- Total consolidado é destacado
- Sem valores ocultos ou surpresas

**Proibições:**
- Ocultar valores de produtos
- Ocultar valores de frete
- Ocultar taxas (se aplicáveis e visíveis)
- Adicionar valores não informados previamente

### 3.2 Previsibilidade

**Regra:** O usuário deve saber exatamente o que acontecerá ao confirmar o pagamento.

**Aplicação:**
- Total final é calculado antes da confirmação
- Frete é calculado e exibido antes da confirmação
- Estados de carregamento são claros
- Mensagens de erro são explicativas

**Proibições:**
- Alterar total após confirmação (sem aviso)
- Adicionar taxas não informadas
- Ocultar estados de processamento

### 3.3 Nenhuma Surpresa no Pagamento

**Regra:** O valor pago é exatamente o valor exibido no checkout.

**Aplicação:**
- Total exibido = valor debitado
- Sem taxas adicionais não informadas
- Sem ajustes automáticos não explicados
- Confirmação explícita antes do débito

**Proibições:**
- Debitar valor diferente do exibido
- Adicionar taxas não informadas
- Fazer ajustes automáticos sem consentimento

### 3.4 Um Checkout, Um Pagamento

**Regra:** Um checkout gera um único pagamento consolidado.

**Aplicação:**
- Checkout exibe total consolidado
- Pagamento é único (não múltiplos pagamentos)
- Confirmação é única
- Recibo é único

**Proibições:**
- Múltiplos pagamentos para um checkout
- Confirmações separadas por vendedor
- Recibos separados por vendedor

---

## 4. ESTRUTURA VISUAL DO CHECKOUT

### 4.1 Carrinho Único

**Modelo:** Um carrinho por usuário, visualmente agrupado por vendedor

**Estrutura Visual:**
- Carrinho exibe todos os itens
- Itens são agrupados visualmente por vendedor (store)
- Cada grupo de vendedor é claramente identificado
- Nome do vendedor é exibido para cada grupo

**Hierarquia Visual:**
```
Carrinho
├─ Vendedor A
│  ├─ Produto 1 (quantidade, preço unitário)
│  ├─ Produto 2 (quantidade, preço unitário)
│  └─ Subtotal Vendedor A
├─ Vendedor B
│  ├─ Produto 3 (quantidade, preço unitário)
│  └─ Subtotal Vendedor B
└─ Total Consolidado
```

**Regras:**
- Agrupamento visual por vendedor é obrigatório
- Nome do vendedor é obrigatório
- Subtotal por vendedor é obrigatório
- Total consolidado é obrigatório e destacado

**Proibições:**
- Itens sem identificação de vendedor
- Subtotal sem identificação de vendedor
- Total sem breakdown por vendedor

### 4.2 Agrupamento Visual por Vendedor

**Modelo:** Cada vendedor forma um bloco visual distinto

**Elementos Visuais:**
- Separador visual entre vendedores
- Cabeçalho do vendedor (nome, logo se disponível)
- Lista de produtos do vendedor
- Subtotal do vendedor
- Frete do vendedor (se aplicável)

**Regras:**
- Cada vendedor é um bloco visual distinto
- Blocos são claramente separados
- Ordem dos vendedores é consistente
- Identificação do vendedor é clara

**Proibições:**
- Misturar produtos de vendedores diferentes
- Ocultar identificação do vendedor
- Ordem inconsistente de vendedores

### 4.3 Subtotal por Vendedor

**Modelo:** Cada vendedor tem seu subtotal calculado e exibido

**Estrutura:**
- Subtotal = soma de (preço unitário × quantidade) para todos os produtos do vendedor
- Subtotal é exibido dentro do bloco do vendedor
- Subtotal é claramente identificado

**Regras:**
- Subtotal é obrigatório para cada vendedor
- Subtotal é calculado antes da exibição
- Subtotal é exibido de forma clara

**Proibições:**
- Subtotal sem identificação de vendedor
- Subtotal calculado incorretamente
- Subtotal oculto ou difícil de encontrar

### 4.4 Total Consolidado Final

**Modelo:** Total consolidado é a soma de todos os subtotais + frete total

**Estrutura:**
- Total consolidado = soma de todos os subtotais + frete total (se aplicável)
- Total consolidado é destacado visualmente
- Total consolidado é o valor que será debitado

**Regras:**
- Total consolidado é obrigatório
- Total consolidado é destacado
- Total consolidado é o valor final do pagamento

**Proibições:**
- Total sem breakdown
- Total diferente do valor debitado
- Total oculto ou difícil de encontrar

### 4.5 Separação Clara entre Produtos, Frete e Taxas

**Modelo:** Produtos, frete e taxas são visualmente separados

**Estrutura Visual:**
```
Checkout
├─ Produtos
│  ├─ Vendedor A: R$ X,XX
│  └─ Vendedor B: R$ Y,YY
├─ Frete
│  ├─ Vendedor A: R$ Z,ZZ
│  └─ Vendedor B: R$ W,WW
│  └─ Total Frete: R$ (Z+W)
├─ Taxas (se visíveis)
│  └─ Taxa da Plataforma: R$ T,TT
└─ Total Final: R$ (X+Y+Z+W+T)
```

**Regras:**
- Produtos são separados de frete
- Frete é separado de taxas
- Cada categoria é claramente identificada
- Total final consolida todas as categorias

**Proibições:**
- Misturar produtos com frete
- Misturar frete com taxas
- Ocultar categorias relevantes

---

## 5. BREAKDOWN FINANCEIRO (EXIBIÇÃO)

### 5.1 O Que o Usuário VÊ

**Valores por Vendedor:**
- Subtotal de produtos por vendedor
- Frete por vendedor (se aplicável)
- Total parcial por vendedor (produtos + frete)

**Total Final:**
- Total consolidado de todos os vendedores
- Total de frete consolidado
- Total final a ser debitado

**Regras:**
- Breakdown por vendedor é obrigatório
- Total consolidado é obrigatório
- Valores são claros e precisos

**Proibições:**
- Ocultar breakdown por vendedor
- Ocultar total consolidado
- Valores imprecisos ou arredondados incorretamente

### 5.2 O Que o Usuário NÃO VÊ

**Splits Internos:**
- Usuário não vê splits de revenue_share, fee, regional_fund, etc.
- Usuário não vê distribuição interna de valores
- Usuário não vê contas financeiras envolvidas

**Contas Financeiras:**
- Usuário não vê account_id
- Usuário não vê identificadores de contas
- Usuário não vê estrutura interna do Core

**Ledger:**
- Usuário não vê entradas do ledger
- Usuário não vê movimentações internas
- Usuário não vê estrutura de double-entry

**Regra Absoluta:**
> **UX nunca expõe estrutura interna do Core Financeiro.**

**Proibições:**
- Expor splits na UX
- Expor contas financeiras na UX
- Expor ledger na UX
- Expor qualquer estrutura interna do Core

### 5.3 Regra de Exposição

**Princípio:** UX expõe apenas o que o usuário precisa saber para tomar decisão de compra.

**Aplicação:**
- UX expõe: valores, vendedores, produtos, frete
- UX não expõe: splits, contas, ledger, estrutura interna

**Proibições:**
- Expor informações técnicas do Core
- Expor estrutura interna do sistema
- Expor detalhes de implementação

---

## 6. FRETE NA UX

### 6.1 Frete Exibido por Vendedor

**Modelo:** Frete é calculado e exibido por vendedor

**Estrutura Visual:**
- Cada vendedor tem seu próprio frete
- Frete é exibido dentro do bloco do vendedor
- Frete é claramente identificado

**Regras:**
- Frete por vendedor é obrigatório (se aplicável)
- Frete é calculado antes da exibição
- Frete é exibido de forma clara

**Proibições:**
- Frete sem identificação de vendedor
- Frete calculado incorretamente
- Frete oculto ou difícil de encontrar

### 6.2 Total de Frete Consolidado

**Modelo:** Total de frete é a soma de todos os fretes por vendedor

**Estrutura Visual:**
- Total de frete = soma de todos os fretes por vendedor
- Total de frete é exibido separadamente
- Total de frete é incluído no total final

**Regras:**
- Total de frete consolidado é obrigatório (se houver frete)
- Total de frete é claramente identificado
- Total de frete é incluído no total final

**Proibições:**
- Total de frete sem breakdown
- Total de frete não incluído no total final
- Total de frete oculto

### 6.3 Frete Nunca Misturado ao Preço do Produto

**Modelo:** Frete é sempre separado visualmente do preço do produto

**Estrutura Visual:**
- Produtos têm seu próprio subtotal
- Frete tem seu próprio subtotal
- Produtos e frete são visualmente separados

**Regras:**
- Frete nunca é incluído no preço do produto
- Frete sempre é exibido separadamente
- Frete sempre é identificado claramente

**Proibições:**
- Misturar frete ao preço do produto
- Ocultar frete no preço do produto
- Calcular frete como parte do produto

---

## 7. ESTORNO E PÓS-COMPRA (UX)

### 7.1 Estorno por Item

**Modelo:** Estorno é granular por item, visualmente associado ao vendedor

**Estrutura Visual:**
- Estorno é exibido por item
- Item estornado é visualmente associado ao vendedor
- Status do estorno é claramente exibido

**Regras:**
- Estorno por item é obrigatório
- Associação visual com vendedor é obrigatória
- Status do estorno é obrigatório

**Proibições:**
- Estorno sem identificação de item
- Estorno sem identificação de vendedor
- Estorno sem status claro

### 7.2 Visualmente Associado ao Vendedor

**Modelo:** Item estornado é exibido no contexto do vendedor

**Estrutura Visual:**
- Item estornado aparece no bloco do vendedor
- Vendedor é claramente identificado
- Associação item-vendedor é clara

**Regras:**
- Associação visual com vendedor é obrigatória
- Vendedor é claramente identificado
- Contexto do vendedor é preservado

**Proibições:**
- Estorno sem contexto de vendedor
- Estorno sem identificação de vendedor
- Estorno fora do contexto do vendedor

### 7.3 Linguagem Clara

**Modelo:** Linguagem é clara e não ambígua

**Termos Permitidos:**
- "Estorno solicitado"
- "Estorno processado"
- "Estorno em análise"
- "Estorno aprovado"
- "Estorno recusado"

**Termos Proibidos:**
- "Estorno garantido" (não há garantia automática)
- "Estorno instantâneo" (não há garantia de velocidade)
- "Estorno automático" (não há automação sem decisão humana)

**Regras:**
- Linguagem é clara e precisa
- Status é factual, não promissor
- Sem garantias não documentadas

**Proibições:**
- Linguagem ambígua
- Promessas não documentadas
- Garantias automáticas

### 7.4 UX Não Sugere Garantias Automáticas

**Modelo:** UX não promete estorno automático ou garantido

**Aplicação:**
- UX informa status do estorno
- UX não promete resultado
- UX não garante velocidade

**Regras:**
- UX é informativa, não promissora
- Status é factual
- Sem garantias não documentadas

**Proibições:**
- Prometer estorno automático
- Garantir velocidade de estorno
- Sugerir garantias não documentadas

---

## 8. NOTA FISCAL (UX)

### 8.1 UX Deixa Explícito: NF Emitida pelo Vendedor

**Modelo:** UX deixa claro que nota fiscal é emitida pelo vendedor

**Estrutura Visual:**
- Nota fiscal é associada ao vendedor
- Vendedor é claramente identificado como emissor
- Plataforma é identificada como intermediadora

**Linguagem:**
- "Nota fiscal emitida por [Nome do Vendedor]"
- "Plataforma atua como intermediadora"
- "NF disponível em [link]"

**Regras:**
- Vendedor é claramente identificado como emissor
- Plataforma é claramente identificada como intermediadora
- Linguagem é clara e não ambígua

**Proibições:**
- Linguagem ambígua sobre emissor
- Ocultar papel do vendedor
- Sugerir que plataforma emite NF dos produtos

### 8.2 Plataforma Atua como Intermediadora

**Modelo:** UX deixa claro que plataforma é intermediadora, não vendedora

**Estrutura Visual:**
- Plataforma é identificada como intermediadora
- Vendedor é identificado como vendedor
- Separação de papéis é clara

**Linguagem:**
- "Plataforma atua como intermediadora"
- "Vendedor: [Nome do Vendedor]"
- "Intermediação: UnifiCard"

**Regras:**
- Plataforma é claramente identificada como intermediadora
- Vendedor é claramente identificado como vendedor
- Separação de papéis é clara

**Proibições:**
- Linguagem que sugere que plataforma é vendedora
- Ocultar papel de intermediadora
- Misturar responsabilidades

### 8.3 Sem Linguagem Ambígua

**Modelo:** Linguagem é clara e não ambígua

**Termos Proibidos:**
- "Nós emitimos" (plataforma não emite NF dos produtos)
- "Garantimos" (sem contexto claro)
- "Responsáveis pela NF" (sem especificar papel)

**Termos Permitidos:**
- "NF emitida por [Vendedor]"
- "Plataforma atua como intermediadora"
- "NF disponível em [link]"

**Regras:**
- Linguagem é clara e precisa
- Papéis são explicitamente identificados
- Sem ambiguidade sobre responsabilidades

**Proibições:**
- Linguagem ambígua
- Ocultar responsabilidades
- Misturar papéis

---

## 9. ESTADOS E ERROS

### 9.1 Falha no Pagamento: Checkout Único Falha como um Todo

**Modelo:** Se pagamento falhar, todo o checkout falha

**Estrutura Visual:**
- Mensagem de erro clara
- Explicação do que aconteceu
- Opções de ação (retry, cancelar, contatar suporte)

**Regras:**
- Falha é exibida claramente
- Explicação é fornecida
- Opções de ação são oferecidas

**Proibições:**
- Falha silenciosa
- Mensagem de erro ambígua
- Sem opções de ação

### 9.2 UX Deve Explicar Claramente

**Modelo:** Mensagens de erro são claras e explicativas

**Estrutura:**
- Mensagem de erro é clara
- Explicação do problema é fornecida
- Próximos passos são sugeridos

**Regras:**
- Mensagem é clara e precisa
- Explicação é fornecida
- Próximos passos são sugeridos

**Proibições:**
- Mensagem técnica demais
- Mensagem ambígua
- Sem sugestão de próximos passos

### 9.3 Sem Retry Automático Invisível

**Modelo:** Retry não acontece automaticamente sem consentimento do usuário

**Estrutura:**
- Retry é explícito (botão "Tentar novamente")
- Usuário deve consentir com retry
- Retry não acontece automaticamente

**Regras:**
- Retry é explícito
- Consentimento do usuário é obrigatório
- Retry não é automático

**Proibições:**
- Retry automático invisível
- Retry sem consentimento
- Retry sem aviso

---

## 10. O QUE ESTE DOCUMENTO NÃO FAZ

### 10.1 Não Define Lógica Financeira

Este documento:
- Não define como splits são calculados
- Não define como transações são criadas
- Não define como ledger é registrado
- Define apenas como informações são exibidas

### 10.2 Não Altera Core

Este documento:
- Não altera `CORE_SPLIT_PAGAMENTO_CANONICO.md`
- Não altera `CORE_ESTORNOS_FINANCEIROS_CANONICO.md`
- Não altera `bank-split-engine.service.ts`
- Não altera `bank_splits`, `bank_ledger`, `bank_transactions`

### 10.3 Não Cria Permissões

Este documento:
- Não cria novas permissões
- Não altera `MAPA_CANONICO_PERMISSIONS_v1.md`
- Usa apenas permissões canônicas existentes

### 10.4 Não Define APIs

Este documento:
- Não define endpoints
- Não define contratos de API
- Não define estruturas de dados técnicas
- Define apenas experiência visual e interação

### 10.5 Não Autoriza Código Diretamente

Este documento:
- Não autoriza implementação específica
- Não define arquitetura técnica
- Não define estrutura de código
- Define apenas experiência de usuário

---

## 11. INVARIANTES DE UX

### 11.1 Invariantes de Exibição

**INVARIANTE 1: UX Nunca Expõe Estrutura Interna do Core**
- UX não expõe splits
- UX não expõe contas financeiras
- UX não expõe ledger
- UX expõe apenas valores e vendedores

**INVARIANTE 2: UX Respeita Modelo Canônico**
- UX exibe breakdown por vendedor
- UX exibe total consolidado
- UX não altera fluxo financeiro canônico

**INVARIANTE 3: UX Mantém Transparência**
- Valores são claros e precisos
- Breakdown é visível
- Total é destacado

### 11.2 Invariantes de Interação

**INVARIANTE 4: UX Não Altera Fluxo Financeiro**
- UX não calcula splits
- UX não persiste transações
- UX não registra ledger
- UX apenas exibe informações

**INVARIANTE 5: UX Mantém Previsibilidade**
- Total é calculado antes da confirmação
- Valor pago = valor exibido
- Sem surpresas no pagamento

**INVARIANTE 6: UX Mantém Um Checkout, Um Pagamento**
- Checkout exibe total consolidado
- Pagamento é único
- Confirmação é única

---

## 12. PRÓXIMOS PASSOS AUTORIZADOS

### 12.1 Implementação de UX

**Prioridade:** OPCIONAL

**Ação:**
- Implementar interface visual conforme este documento
- Validar conformidade com princípios de UX
- Testar experiência do usuário

**Critério de Aceite:**
- UX conforme princípios definidos
- Breakdown por vendedor visível
- Total consolidado destacado
- Sem exposição de estrutura interna do Core

### 12.2 Testes de Usabilidade

**Prioridade:** OPCIONAL

**Ação:**
- Testar experiência do usuário
- Validar clareza de informações
- Validar previsibilidade

**Critério de Aceite:**
- Usuários entendem breakdown
- Usuários entendem total consolidado
- Usuários não têm surpresas no pagamento

### 12.3 Evolução de UX

**Prioridade:** OPCIONAL

**Ação:**
- Melhorar experiência visual
- Adicionar elementos de UX (sem alterar lógica)
- Otimizar interações

**Critério de Aceite:**
- Melhorias não alteram Core
- Melhorias não alteram fluxo financeiro
- Melhorias respeitam invariantes de UX

---

## 13. AUTORIDADE DOCUMENTAL

### 13.1 Documentos que Autorizam Esta UX

- `HARDENING_CYCLE_CLOSURE.md` — Autoriza features de produto (NÍVEL 3)
- `FEATURE_MARKETPLACE_MULTI_VENDOR.md` — Modelo canônico do marketplace
- `CORE_VS_MODULOS_CONTRACT.md` — Marketplace é módulo, não Core

### 13.2 Documentos que Esta UX Respeita

- `FEATURE_MARKETPLACE_MULTI_VENDOR.md` — Modelo canônico do marketplace
- `CORE_SPLIT_PAGAMENTO_CANONICO.md` — Split canônico (para referência, não exposição)
- `CORE_ESTORNOS_FINANCEIROS_CANONICO.md` — Estornos canônicos (para referência, não exposição)
- `CORE_IMUTAVEL.md` — Core imutável

### 13.3 Documentos que Esta UX Não Altera

- `CORE_SPLIT_PAGAMENTO_CANONICO.md` — Não alterado
- `CORE_ESTORNOS_FINANCEIROS_CANONICO.md` — Não alterado
- `CORE_IMUTAVEL.md` — Não alterado
- `MAPA_CANONICO_PERMISSIONS_v1.md` — Não alterado

---

## 14. DECLARAÇÃO FINAL CANÔNICA

> **No UnifiCard, UX é experiência de usuário, não lógica financeira.**  
> **UX exibe informações, não calcula splits.**  
> **UX respeita Core, não o altera.**  
> **UX mantém transparência, não cria surpresas.**  
> **UX é produto, não Core.**

---

**FIM DO DOCUMENTO CANÔNICO DE UX DE CHECKOUT MULTI-VENDOR**


