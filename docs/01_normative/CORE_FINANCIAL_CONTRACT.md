Status: CORE
Domain: Financial
Governing Contract: CORE_IMUTAVEL.md
Authority Level: 1
Canonical Scope: Financial Governance

# CORE_FINANCIAL_CONTRACT.md
## Contrato Fundacional — Governança Financeira do UnifiCard

Este documento define a **governança financeira fundacional** do UnifiCard.

Ele estabelece **quem manda no dinheiro**, **quais são as fontes canônicas**, **como contratos financeiros se organizam** e **o que é proibido no domínio financeiro**.

Qualquer contrato, módulo, decisão ou implementação que toque dinheiro **DEVE** obedecer este documento.

---

## 1) Escopo do Contrato

Este contrato governa **todo o domínio financeiro**, incluindo:

- pagamentos
- splits de pagamento
- taxas e fees
- estornos e reversões
- saldos e ledger
- contas financeiras
- políticas financeiras
- auditoria e compliance
- integração com métodos de pagamento
- projeções financeiras (read-models)

📌 Este contrato **não implementa lógica financeira**.  
Ele **define autoridade, hierarquia e limites**.

---

## 2) Hierarquia Canônica Financeira

A hierarquia financeira é **fixa e não-negociável**:

CORE_IMUTAVEL.md
└── CORE_FINANCIAL_CONTRACT.md
├── CORE_SPLIT_PAGAMENTO_CANONICO.md
├── CORE_ESTORNOS_FINANCEIROS_CANONICO.md
├── CORE_PERMISSOES_FINANCEIRAS_CANONICO.md
└── (outros contratos financeiros CORE)

markdown
Copiar código

- `CORE_IMUTAVEL.md` define estruturas não duplicáveis
- Este contrato define a **governança financeira**
- Contratos subordinados definem **regras específicas**

Nenhum documento financeiro pode existir fora dessa árvore.

---

## 3) Fonte Única da Verdade Financeira

Regra absoluta:

> **Existe UMA e somente UMA fonte canônica de verdade financeira no UnifiCard.**

Essa fonte é definida pelos contratos subordinados, em especial:

- **UnifyBank**
- `bank_ledger` como fonte única de saldo
- `bank_splits` como fonte única de distribuição

Qualquer outra representação financeira é, por definição:
- derivada
- projetada
- informativa
- não-decisória

---

## 4) Separação Obrigatória de Responsabilidades

### Este contrato:
- define soberania financeira
- define fronteiras
- define hierarquia

### UnifyBank:
- calcula e persiste splits
- registra ledger
- gerencia contas financeiras
- resolve policies financeiras

### Métodos de pagamento (ex: UnifyCard):
- apenas processam pagamento
- criam transações
- **não** calculam split
- **não** mantêm saldo

### Outros domínios (Eventos, Serviços, Categorias, etc.):
- **não governam dinheiro**
- **não calculam valores**
- **não decidem distribuição**
- apenas fornecem contexto

---

## 5) Proibição de Core Financeiro Paralelo

É terminantemente proibido:

- criar tabelas paralelas de saldo ou split
- calcular valores financeiros fora do UnifyBank
- manter saldo calculado fora do ledger
- criar “engine financeiro” fora do domínio bancário
- decidir financeiramente por heurística
- usar categoria como fator financeiro

Se um comportamento toca dinheiro e **não passa pelo Core Financeiro**, ele é inválido.

---

## 6) Decisão Safety aplicada ao Financeiro

No domínio financeiro, o sistema:

### ❌ Não pode
- inferir valores implicitamente
- otimizar financeiramente por heurística
- misturar saldos entre Actors
- criar exceções temporárias
- “ajustar” valores fora de policy

### ✅ Pode
- aplicar policies explícitas
- usar defaults hardcoded apenas como fallback
- projetar dados financeiros para leitura
- simular cenários **sem executar**

---

## 7) Imutabilidade Financeira

Regras inquebráveis:

- Splits são **imutáveis**
- Ledger é **append-only**
- Saldos são **calculados, não armazenados**
- Estornos são **novas transações**, nunca edição

Se algo exige `UPDATE` financeiro → o modelo está errado.

---

## 8) Validade e Precedência

Este contrato é:

- **normativo**
- **fundacional**
- **não opcional**
- **precedente sobre qualquer outro documento financeiro**

Em caso de conflito entre:
- código
- documentação
- decisões de produto
- decisões de negócio
- sugestões de IA

👉 **Este contrato prevalece.**

---

## 9) Checklist de Conformidade Financeira

Antes de aprovar qualquer mudança financeira:

- [ ] Este contrato foi citado?
- [ ] Existe fonte única de verdade?
- [ ] Não há core paralelo?
- [ ] Não há inferência implícita?
- [ ] O ledger é respeitado?
- [ ] Os saldos permanecem separados por Actor?

Se alguma resposta for “não” → **bloquear**.

---

## 10) Frase Canônica Final

No UnifiCard:

> **Dinheiro é Core.  
> Core não negocia.**

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_ESTORNOS_FINANCEIROS_CANONICO.md
- CORE_IMUTAVEL.md
- CORE_PERMISSOES_FINANCEIRAS_CANONICO.md
- CORE_SPLIT_PAGAMENTO_CANONICO.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- CORE_APROVACAO_FINANCEIRA_CANONICO.md
- CORE_ESTORNOS_FINANCEIROS_CANONICO.md
- CORE_PERMISSOES_FINANCEIRAS_CANONICO.md
<!-- AUTO-GENERATED-END -->