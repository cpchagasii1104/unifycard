# ECOSYSTEM_UNDERSTANDING.md

## Propósito deste documento

Este documento define **o que o Unify é** e **o que ele NÃO é**, de forma estrutural e inequívoca.

Ele serve como **contexto permanente** para qualquer implementação no sistema.

**Leia este documento antes de escrever código.**

---

## 1. O que é o Unify (visão geral)

**Unify NÃO é um app.**
**Unify NÃO é um marketplace.**
**Unify NÃO é uma fintech.**

**Unify é um sistema operacional econômico regional, modular e evolutivo.**

### Características fundamentais:

- **Cresce por cidade**: Não existe "lançamento global"
- **Cresce por módulo**: Cada módulo é ativado independentemente
- **Cresce por maturidade econômica local**: Cidade precisa estar pronta

### Implicações:

- Nada assume contexto global
- Nada assume que todos os módulos estão ativos
- Nada assume que cidade está pronta sem verificação

---

## 2. UnifyCard (o que realmente é)

**UnifyCard NÃO é só um cartão físico.**

É a **identidade econômica do usuário** no sistema.

### Funções do UnifyCard:

- Autenticação e identidade
- Carteira financeira (via UnifyBank)
- Chave de acesso a todos os módulos
- Registro de participação econômica
- Interface de consumo + trabalho + serviços
- Cashback estrutural
- Participação em fundos regionais

### Regra fundamental:

**Tudo gira em torno do UnifyCard.**

Sem UnifyCard, usuário não existe no sistema.

---

## 3. UnifyBank (o que ele é e o que NÃO é)

**UnifyBank NÃO é um banco tradicional.**
**UnifyBank NÃO ganha com MDR.**
**UnifyBank NÃO vende crédito.**

### O que UnifyBank é:

- Infraestrutura financeira do sistema
- Ledger double-entry (contabilidade)
- Sistema de contas, splits, fundos regionais
- Liquidação, não especulação

### Propósito:

**Viabilizar o ecossistema econômico**, não ser o produto final.

UnifyBank existe para que os módulos funcionem, não para extrair valor.

---

## 4. Core (o "sistema nervoso")

O Core **não entrega produto ao usuário final**.

O Core **permite que tudo funcione sem acoplamento**.

### Componentes do Core:

#### Identidade e Segurança:
- Auth / Identity
- RBAC (Role-Based Access Control)
- Tenancy (multi-tenant)

#### Economia:
- Ledger (double-entry bookkeeping)
- Economy (contas, transações, splits)
- Fund (fundos regionais)

#### Observação e Decisão:
- Event Log (eventos do sistema)
- Canonical Orchestrator (traduz eventos para formato canônico)
- Policy Registry (políticas declarativas)
- Policy Resolution Engine (resolução dinâmica de políticas)
- Simulation Engine (simulações read-only)
- Insight Engine (geração de insights)
- Decision Log (registro de observações e decisões)

#### Diagnóstico:
- City Readiness (verifica se cidade está pronta para módulos)

### Regra fundamental:

**Sem Core, nenhum módulo funciona corretamente.**

---

## 5. Módulos de Negócio (capacidades ativáveis)

Os módulos **NÃO são apps separados**.

São **capacidades ativáveis por cidade**.

### Exemplos de módulos:

#### 🚗 Rides (Uber-like):
- Corridas
- Motoristas
- Zonas geográficas
- Preço dinâmico (simulado primeiro)
- Ativado apenas se cidade estiver pronta

#### 🍔 Work / Delivery / Marketplace (iFood-like):
- Pedidos
- Entregas
- Trabalho sob demanda
- Usa: UnifyCard, UnifyBank, Core, Catálogo + Oferta

#### 🏠 Hospedagem / Eventos (Airbnb-like):
- Oferta de ativos
- Reservas
- Agenda
- Pagamento
- Reputação

### O que todos os módulos compartilham:

- Identidade (UnifyCard)
- Economia (UnifyBank)
- Eventos (Event Log)
- Políticas (Policy Registry)
- Observação (Simulation, Insight, Decision Log)

### Regra fundamental:

**Módulos são ativados por cidade, não globalmente.**

---

## 6. Marketplace eShop (camadas separadas)

O Marketplace **NÃO é uma única coisa**.

É **separado em camadas observacionais**:

### 6.1. Canonical Product Catalog

- **Identidade única do produto**
- Exemplo: Coca-Cola 2L tem **1 produto canônico**
- GTIN / EAN (código de barras)
- Mesma foto, nome, atributos

**Regra:** Produto ≠ Quem vende

### 6.2. Offer Index

- **Quem vende o produto**
- **Onde vende** (cidade, localização)
- **Disponibilidade** (estoque, ativo)
- **Localização geográfica**

**Regra:** Offer = Produto + Merchant + Cidade

### 6.3. Product Demand Signal

- **Observa:**
  - Buscas do produto
  - Ofertas disponíveis
- **Calcula:**
  - `demandIndex` (0-1)
  - `supplyIndex` (0-1)
  - `demandSupplyRatio`
  - `confidence` (qualidade dos dados)
  - `sampleSize`
  - `dataWindowDays`

**Regra:** **Não decide nada. Apenas mede.**

### 6.4. Dynamic Pricing (simulação)

- **Simula** preço baseado em demanda vs oferta
- **Nunca altera preço real**
- Apenas gera observação no Decision Log

**Regra:** Simulação ≠ Execução

---

## 7. Rede Social (por que ela existe)

A rede social **NÃO é "postar foto"**.

Ela serve para:

- Reputação (prova social)
- Confiança (contexto econômico)
- Grupos regionais (organização coletiva)
- Contexto econômico (histórico de transações)

**Regra:** Ela **alimenta decisões econômicas**, não é entretenimento.

---

## 8. Ativação por cidade (regra fundamental)

**Nada assume contexto global.**

### Antes de ativar qualquer módulo:

1. **City Readiness** verifica:
   - Número de usuários
   - Maturidade econômica
   - Ofertas disponíveis
   - Infraestrutura mínima

2. Se cidade **não estiver pronta**:
   - Módulo não ativa
   - Simulações ainda podem existir (com `confidence: 'insufficient'`)
   - Observações continuam (mas marcadas como insuficientes)

### Regra fundamental:

**Nenhum módulo assume que cidade está pronta sem verificação.**

---

## 9. READ-ONLY FIRST (regra inviolável)

Toda funcionalidade nova segue esta ordem:

1. **Observa** (lê dados, mede)
2. **Simula** (calcula "e se...")
3. **Gera insight** (identifica padrões)
4. **Registra decisão** (no Decision Log)
5. **Só depois** (talvez) executa

### Estado atual do sistema:

- ✅ Observação: Implementada
- ✅ Simulação: Implementada
- ✅ Insight: Implementada
- ❌ Decisão: Registrada, não executada
- ❌ Execução: Não implementada

**Regra fundamental:**

**Isso é proposital. O sistema observa antes de agir.**

---

## 10. O papel do sistema (importante)

### O sistema NÃO faz:

- ❌ Não impõe decisões
- ❌ Não centraliza controle
- ❌ Não ajusta economia automaticamente
- ❌ Não assume causalidade (apenas observa correlação)

### O sistema faz:

- ✅ Mede (observa sinais)
- ✅ Explica (gera insights)
- ✅ Simula (calcula cenários)
- ✅ Registra (Decision Log)
- ✅ Prepara (City Readiness)

### Regra fundamental:

**A execução futura pode ser humana ou governada, mas nunca cega.**

---

## 11. Regra de ouro para implementação

Antes de escrever código, pergunte:

1. **Isso observa ou executa?**
   - Se executa: parar e pedir confirmação

2. **Isso é reversível?**
   - Se não: parar e pedir confirmação

3. **Isso assume contexto global?**
   - Se sim: parar e verificar City Readiness

4. **Isso escreve em produção?**
   - Se sim: parar e pedir confirmação

5. **Isso mistura regra com execução?**
   - Se sim: parar e separar responsabilidades

6. **Isso assume causalidade?**
   - Se sim: parar e tratar como correlação

### Se qualquer resposta for perigosa:

👉 **PARAR e pedir confirmação.**

---

## 12. Princípios estruturais (resumo)

1. **READ-ONLY FIRST**: Observar antes de executar
2. **Separação**: REGRA ≠ EXECUÇÃO ≠ DECISÃO ≠ AÇÃO
3. **Reversibilidade**: Todo código novo pode ser removido sem quebrar existente
4. **Ativação por cidade**: Nada assume contexto global
5. **Incerteza como dado**: `confidence` e `dataQuality` são obrigatórios
6. **Correlação ≠ Causalidade**: Observar, não assumir

---

## 13. Resumo em uma frase

> **Unify é um sistema operacional econômico regional, onde módulos de consumo, trabalho e serviços só existem quando a cidade está pronta, e onde o sistema observa, simula e explica antes de agir.**

---

## 14. Documentos relacionados

- `ARCHITECTURE_GUARDRAILS.md`: O que o sistema **NUNCA pode fazer**
- Este documento: O que o sistema **É**

**Leia ambos antes de implementar qualquer funcionalidade.**

---

**Este documento é obrigatório para qualquer implementação no sistema Unify.**



