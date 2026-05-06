# DOMAIN_ONTOLOGY_UNIFICARD

**Documento Normativo — Versão 1.0.6**  
**Data:** 2026-04-05  
**Status:** NORMATIVO — CONGELADO PARA IMPLEMENTAÇÃO  
**Próxima revisão:** Somente por RFC formal  

---

## 1. OBJETIVO

Este documento define a ontologia de domínios do sistema UnifiCard. Ele estabelece:

- Estrutura canônica de domínios (N0)
- Critério formal de promoção de domínio
- Separação entre domínios core e condicionais
- Regras de evolução futura com alterações raras e controladas
- Estrutura de relações semânticas (GRAPH)
- Sistema de dimensões transversais
- Governança operacional de CONCEPT

**Este documento é normativo. Desvios requerem justificativa técnica documentada e aprovação de arquitetura.**

---

## 2. PRINCÍPIOS FUNDAMENTAIS

### 2.1 Separação de responsabilidades

| Camada | Responsabilidade |
|--------|------------------|
| **Ontologia** | Classifica (o que é), estrutura (como se relaciona), parametriza (regras de negócio por domínio) |
| **Sistema financeiro** | Executa (transações, ledger), valida (invariantes financeiras), impõe (limites, compliance) |

*Ontologia nunca executa transações financeiras diretamente.*

### 2.2 Estabilidade estrutural com evolução controlada

A árvore N0 é **estável** — alterações são raras e exigem RFC formal. Expansões ocorrem via:
- Promoção de domínios condicionais (ativação controlada)
- Expansão de N1-N3 em domínios existentes

### 2.3 Evolução sem quebra estrutural

Garantias arquiteturais:
- Domínios condicionais têm **interfaces definidas** (contratos de API, eventos)
- **Contrato de schema** definido antes, **execução de schema** na ativação
- Ativação é toggle + migração de dados, não criação de schema do zero
- Referências entre domínios usam UUIDs estáveis desde concepção

#### 2.3.1 Contrato vs Execução de Schema

| Fase | O que existe | Status |
|------|-------------|--------|
| **Contrato** | Interface de API, eventos de domínio, atributos obrigatórios, versionamento semver | Definido no documento de fronteiras do domínio condicional |
| **Execução** | Tabelas físicas, índices, constraints, dados populados | Criado na ativação do domínio |

Versionamento do contrato segue semver independente de ativação operacional.

---

## 3. CRITÉRIO FORMAL DE DOMÍNIO N0

Um domínio é N0 se satisfaz pelo menos um dos critérios abaixo:

| Critério | Descrição | Exemplo |
|----------|-----------|---------|
| **1. Entidades próprias** | Possui entidades não redutíveis a composição de outros domínios | Evento (cultura-lazer) ≠ produto + data |
| **2. Invariantes únicas** | Possui regras que não podem ser modeladas como especialização de outro domínio | Ética médica, sigilo (saúde) |
| **3. Ciclo operacional próprio** | Possui estrutura de execução distinta (fases, estados, transições) | Projeto de construção (ART, medições) |

### 3.1 Ordem de aplicação (obrigatória)

```
Passo 1: Testar critério 1 (entidades)
         → Se passar: é N0
         → Se não passar: ir para Passo 2

Passo 2: Testar critério 2 (invariantes) OU critério 3 (ciclo)
         → Se passar em pelo menos um: é elegível a N0
         → Se não passar: não é domínio (vai para N1 de outro ou atributo)
```

*Nota: Passar no critério = elegível a N0. Ativação como N0 core = decisão estratégica de prioridade de sistema.*

Critério 1 tem prioridade para evitar que "ciclo genérico" vire justificativa de N0.

### 3.2 Nota sobre "invariantes únicas"

Invariantes de um domínio não podem ser **especialização direta** de invariantes de outro. Exemplo:
- `saúde`: sigilo médico é invariante **próprio** (não existe em `servicos`)
- `causas-sociais`: restrição de lucro é **especialização** de regime jurídico de organização → **não conta como único**

---

## 4. ESTRUTURA DE CAMADAS

```
LAYER 6: GRAPH (relações semânticas entre conceitos — ver Seção 6)
LAYER 5: ATTRIBUTES (metadados simples: tags, facets, valores planos)
LAYER 4: INTENT (ação do usuário: comprar, contratar, aprender)
LAYER 3: CONTEXT (perfil de uso: personal, professional, institutional)
LAYER 2: TREE (N0-N3, navegação hierárquica)
LAYER 1: CONCEPT (SSOT, entidades semânticas únicas — ver Seção 5)
LAYER 0: INFRA (persistência, cache, fila — transversal, não parte da ontologia)
```

Nota: LAYER 0 é infraestrutura técnica, abaixo da ontologia de negócio.

**Fluxo lógico:** `CONCEPT → TREE → CONTEXT → INTENT → ATTRIBUTES → GRAPH`

- TREE = navegação
- GRAPH = inteligência
- CONTEXT = aplicação
- INTENT = ação

### 4.1 DIMENSÕES TRANSVERSAIS

Dimensões são **atributos estruturais complexos** que atravessam múltiplos domínios. Diferem de atributos simples (LAYER 5) por possuírem schema próprio, regras de validação e semântica de negócio não trivial.

#### 4.1.1 Lista de dimensões

| Dimensão | Aplicação | Schema | Serviço responsável |
|----------|-----------|--------|---------------------|
| `impacto_social` | ONGs, projetos, doações, ESG | `ImpactDimension` | impact-service |
| `regulatorio` | Compliance, regulações setoriais | `RegulatoryDimension` | compliance-service |
| `reputacao` | Score, reviews, histórico | `ReputationDimension` | reputation-service |
| `sustentabilidade` | Métricas ambientais, carbono | `SustainabilityDimension` | sustainability-service |

#### 4.1.2 Estrutura: impacto_social

```typescript
interface ImpactDimension {
  type: 'social' | 'ambiental' | 'economico';

  metrics: {
    reach?: number;
    beneficiaries?: number;
    score?: number;
  };

  evaluation_model: 'quantitative' | 'qualitative' | 'hybrid';

  audit: {
    verified: boolean;
    source?: string;
  };
}
```

#### 4.1.3 Governança de dimensões

Cada dimensão é um **sistema próprio** com:

| Elemento | Definição |
|----------|-----------|
| Modelo de dados | Schema versionado, independente de domínios N0 |
| Serviço responsável | Microserviço ou bounded context definido |
| Fonte de verdade | Única, não replicada em domínios |
| Regras de validação | Centralizadas, aplicadas em ingestão |
| API de consulta | Unificada para todos os consumidores |

#### 4.1.4 Regras de dimensões

```
- Dimensões NÃO definem domínio
- Podem coexistir com qualquer domínio N0
- Não alteram execution_model
- Não alteram ontologia base
- São avaliadas em conjunto com domínio e contexto
- Fonte de verdade é o serviço da dimensão, não o domínio consumidor
```

#### 4.1.5 Exemplos de aplicação

| Caso | Domínio N0 | Dimensão aplicada |
|------|-----------|-------------------|
| ONG | `organizacoes-e-instituicoes` | `impacto_social` |
| Projeto social | `servicos` | `impacto_social` |
| Doação | `financas-e-economia` | `impacto_social` |
| Empresa ESG | `organizacoes-e-instituicoes` | `impacto_social` + `sustentabilidade` |
| Prestador de serviço | `servicos` | `reputacao` |
| Produto sustentável | `produtos-e-comercio` | `sustentabilidade` |

---

## 5. CONCEPT (SSOT)

### 5.1 Estrutura

CONCEPT é identificado por **canonical_id**, não por slug ou display_name.

```typescript
interface Concept {
  canonical_id: UUID;           // UUID v5: namespace + identificador semântico canônico
                                  // IMUTÁVEL após criação
  display_names: LocalizedName[]; // Nomes localizados (ver 5.2.3)
  slug: string;                   // Human-readable, não único, não identidade
  aliases: {                      // Mapeamento para domínios externos
    cnae?: string;
    google_taxonomy?: string;
    // ...
  };
  domain: Domain;                // Domínio N0 de pertencimento
  execution: ExecutionSpec;      // Modelo de execução (ver 5.3)
  pillars: ConceptPillars;       // Pilares impactados (ver 5.4)
  dimensions?: Dimension[];        // Dimensões transversais aplicáveis (opcional)
}
```

### 5.1.1 CANONICAL PRODUCTS — MATERIALIZAÇÃO OPERACIONAL (NÃO SEMÂNTICA)

Canonical Product é uma estrutura **operacional** de catálogo.

Ele **não** pertence à camada semântica.

Ele **não** define “o que algo é”.

Essa definição permanece **exclusivamente** em CONCEPT.

#### Papel no sistema

`canonical_product` existe para:

- permitir reutilização de produtos entre tenants;
- estabilizar identidade **operacional** de catálogo;
- servir de base para `product`, pricing e order.

#### Relação obrigatória com CONCEPT

- todo `canonical_product` **deve** ter `concept_id` válido;
- `canonical_product` **não pode** existir sem CONCEPT;
- `canonical_product` **não pode** alterar ou redefinir CONCEPT.

#### Limite de autoridade

CONCEPT define identidade semântica.  
`canonical_product` apenas **materializa** essa identidade no catálogo.

Se houver conflito:

→ **CONCEPT prevalece** (sempre).

#### O que canonical_product não é

`canonical_product` **não** é:

- identidade semântica;
- substituto de CONCEPT;
- classificação de categoria;
- entidade baseada em slug ou nome **como fonte de significado**.

#### Identidade operacional

`canonical_product` é determinado por:

- `concept_id` (obrigatório);
- atributos estruturais que distinguem instâncias comerciais;
- identificadores externos (ex.: GTIN), quando disponíveis.

#### GTIN

- GTIN é um identificador forte;
- **não** é obrigatório;
- **não** é suficiente sozinho para definir identidade **semântica** (continua ancorada em CONCEPT).

#### Versionamento

`canonical_product` é imutável do ponto de vista estrutural.

Mudanças geram nova entidade:

- nova linha;
- novo identificador;
- mesmo `concept_id`.

É proibido mutar identidade existente.

#### Proibições explícitas

É proibido:

- inferir CONCEPT a partir de `canonical_product`;
- usar `canonical_product` como fonte de semântica;
- derivar comportamento de negócio a partir de canonical **como se fosse** definição de significado;
- usar `categories` ou N2 para **definir** canonical em detrimento de CONCEPT;
- criar canonical sem validação semântica prévia (CONCEPT).

#### Regra de ouro

`canonical_product` **depende** de CONCEPT.

CONCEPT **não depende** de `canonical_product`.

*Alinhamento obrigatório com `07_NOMENCLATURA_CANONICA.md` e com `SSOT_REGISTRY_UNIFICARD.md` (catálogo).*

### 5.2 Unicidade e Canonicalização

#### 5.2.1 Regras de resolução

| Situação | Ação |
|----------|------|
| Mesmo `canonical_id` | Mesmo CONCEPT, independente de contexto ou display_name |
| Novo termo submetido | Passa por normalização antes de criação de CONCEPT |
| Sinônimos detectados | Convergem para mesmo `canonical_id` na ingestão |
| Colisão semântica | Resolvida por comitê de arquitetura, não automaticamente |

#### 5.2.2 Exemplo de canonicalização

```
Entrada: "fotografia", "foto", "serviço de fotografia", "fotógrafo"

Saída:
- canonical_id: UUIDv5("unificard:concept", "fotografia")
- display_names: [
    { value: "Fotografia", locale: "pt-BR", priority: 1 },
    { value: "Foto", locale: "pt-BR", priority: 2, context: "colloquial" },
    { value: "Photography", locale: "en-US", priority: 1 }
  ]
- slug: "fotografia"
- aliases: { cnae: "7420-2/00" }
```

#### 5.2.3 Localização de display_names

```typescript
interface LocalizedName {
  value: string;           // "Fotografia"
  locale: string;          // "pt-BR" (padrão: "pt-BR")
  priority: number;        // 1 = primário, 2+ = secundário
  context?: string;        // "formal", "colloquial", "technical" (opcional)
}

display_names: LocalizedName[]

Regras:
- Pelo menos um nome com priority 1 por locale suportado
- Locale padrão do sistema: "pt-BR"
- Fallback: nome priority 1 do locale padrão
- Contexto permite variações de registro (formal vs coloquial)
```

### 5.3 Execution Model

Definido no nível CONCEPT como discriminated union tipada:

```typescript
interface ExecutionSpec {
  kind: 'transactional' | 'continuous' | 'project' | 'batch';

  // Payload obrigatório conforme kind:
  payload: 
    | TransactionalPayload    // { metadata?: Record<string, any> }
    | ContinuousPayload       // { recurrence: RecurrenceRule }
    | ProjectPayload          // { phases: Phase[], risks: Risk[], timeline: Timeline }
    | BatchPayload;           // { schedule: Schedule, batchConfig: BatchConfig }
}
```

#### 5.3.1 Conexão execution_model e state_machine

Cada execution_model define estados válidos:

| execution_model | Estados típicos | Transições |
|-----------------|-----------------|------------|
| transactional | pending, completed, failed, refunded | linear com rollback |
| continuous | active, paused, cancelled, expired | ciclo de vida de assinatura |
| project | draft, planning, executing, reviewing, closed | fases com gates |
| batch | scheduled, processing, completed, error | pipeline de processamento |

**Regra fundamental:** `state_machine` é definida pelo `execution_model`, não independente.  
**Mudança de execution_model em runtime:** proibida (requer recriação de CONCEPT).

### 5.4 Pilares do Sistema

Todo CONCEPT deve declarar explicitamente quais pilares impacta.

#### 5.4.1 Estrutura

```typescript
interface ConceptPillars {
  // Pilares obrigatórios (sempre avaliados)
  money: boolean;      // afeta saldo, ledger, transação
  time: boolean;       // afeta agenda, recorrência, deadline

  // Pilares contextuais (avaliados conforme domínio)
  identity: boolean;   // afeta KYC, posse, titularidade
  state: boolean;        // afeta máquina de estados, lifecycle
  event: boolean;        // afeta notificação, log, audit
  authority: boolean;    // afeta permissão, compliance, regulação
}
```

#### 5.4.2 Pilares obrigatórios por domínio N0

| Domínio | Pilares obrigatórios |
|---------|---------------------|
| `financas-e-economia` | money, state |
| `saude-e-bem-estar` | time, identity, authority |
| `governanca-e-decisao` | authority, state |
| `mobilidade-e-logistica` | time, event, state |
| `educacao-e-conhecimento` | time, state |
| `cultura-lazer-e-eventos` | time, event, state |

#### 5.4.3 Exemplos de aplicação

| Concept | Pilares | Justificativa |
|---------|---------|---------------|
| pagamento | money, event, state | Transação financeira com estado (pendente, confirmado, estornado) |
| consulta médica | time, identity, authority | Agendamento, paciente identificado, regulação médica |
| fotografia | — | Serviço criativo sem impacto em pilares core (pode ter time se agendado) |
| contrato | authority, state, identity | Assinatura, estados do contrato, partes identificadas |
| entrega | time, event, state | Prazo, rastreamento, status de entrega |

#### 5.4.4 Limitação conhecida: granularidade de pilares

**Versão atual:** pilares são booleanos (impacta / não impacta).

**Futuro (documentado em RFC-001):** granularidade refinada:
- `'none'` → não impacta
- `'optional'` → pode impactar dependendo de contexto
- `'required'` → sempre impacta, invariante obrigatório

**Mudança requer:** migração de schema + reavaliação de todos os CONCEPTs.  
**Não planejado para 24 meses.**

### 5.5 Governança de Criação de CONCEPT

CONCEPT não pode ser criado livremente em runtime.

#### 5.5.1 Pipeline obrigatório

```
1. Ingestão → entrada de termo (API, dataset, input manual)
2. Normalização → limpeza, lematização, redução semântica
3. Deduplicação → matching com concepts existentes (embedding + regras)
4. Classificação → sugestão de domínio N0
5. Validação → automática + fallback humano
6. Criação → geração de canonical_id (UUID imutável)
```

#### 5.5.2 Regras obrigatórias

```
- canonical_id é imutável após criação
- slug NÃO define identidade
- sinônimos devem convergir antes da criação
- duplicação semântica é proibida
```

#### 5.5.3 Níveis de validação

| Tipo | Regra |
|------|-------|
| Automática | similaridade semântica + regras de domínio |
| Assistida | revisão humana em casos ambíguos |
| Arquitetural | necessário para conceitos críticos |

#### 5.5.4 Proibição explícita

```
É proibido criar CONCEPT diretamente em:
- serviços de aplicação
- handlers HTTP
- scripts de negócio

Toda criação deve passar pelo pipeline de governança.
```

#### 5.5.5 Responsável pela execução

O pipeline de criação de CONCEPT é executado por:

| Elemento | Definição |
|----------|-----------|
| Serviço | `concept-governance-service` |
| Bounded context | Ontologia (LAYER 1) |
| Interface | gRPC / REST interno (não exposto publicamente) |
| Autenticação | mTLS + service account (não usuário final) |

**Não é executado por:**
- APIs públicas
- Scripts de migração de dados (usam batch import com bypass documentado)
- Handlers de eventos de negócio

---

## 6. GRAPH LAYER (RELAÇÕES SEMÂNTICAS)

LAYER 6 armazena e gerencia relações entre CONCEPTs.

### 6.1 Estrutura de persistência

Graph é persistido como **triple store mínimo**:

```typescript
interface GraphTriple {
  subject_id: UUID;        // canonical_id do CONCEPT origem
  relation_type: RelationType;
  object_id: UUID;         // canonical_id do CONCEPT destino
  metadata?: JSONB;        // contexto da relação (opcional)
  created_at: Timestamp;
  updated_at: Timestamp;
  active: boolean;         // soft delete
}
```

### 6.2 Tipos de relação

| Tipo | Semântica | Uso típico |
|------|-----------|------------|
| `enables` | A habilita B | pagamento habilita entrega |
| `requires` | A requer B | assinatura requer cadastro |
| `evolves_to` | A evolui para B | lead evolui para cliente |
| `related_to` | A relaciona com B (genérico) | cross-selling |
| `part_of` | A é parte de B | módulo é parte de curso |
| `substitutes` | A substitui B | produto novo substitui obsoleto |

### 6.3 Governança

| Aspecto | Regra |
|---------|-------|
| Criação de relação | Via serviço central de graph (não direto em DB) |
| Validação | Ambos os CONCEPTs devem existir e estar ativos |
| Ciclo de vida | Relações podem ser ativadas/desativadas, não deletadas fisicamente |
| Query | GraphQL ou similar para navegação (não exposto diretamente como SQL) |
| Serviço responsável | `graph-service` — bounded context Graph (LAYER 6) |

### 6.4 Exemplos de relações

| Subject | Relation | Object | Contexto |
|---------|----------|--------|----------|
| `pagamento` | enables | `entrega` | e-commerce |
| `assinatura` | requires | `cadastro` | onboarding |
| `lead` | evolves_to | `cliente` | CRM |
| `produto-v1` | substitutes | `produto-v0` | migração |
| `modulo-1` | part_of | `curso-completo` | educação |

---

## 7. DOMÍNIOS N0 (CORE)

Lista fechada de 12 domínios, com justificativa por critério:

| # | Domínio | Critério | Fundamento |
|---|---------|----------|------------|
| 1 | `pessoas-e-identidades` | 1 | Entidade base irredutível (pessoa ≠ organização + atributo) |
| 2 | `organizacoes-e-instituicoes` | 1 | Entidade base irredutível (CNPJ, personalidade jurídica) |
| 3 | `comunidades-e-grupos` | 1 + 2 | Pertencimento não hierárquico; invariantes de moderação |
| 4 | `produtos-e-comercio` | 1 + 3 | SKU como entidade; ciclo de estoque/preço |
| 5 | `servicos` | 1 + 3 | Prestação como entidade; ciclos de execução variáveis |
| 6 | `ativos-corporativos` | 1 + 2 | Ativos de uso/controle operacional (FIPE, depreciação) ≠ instrumentos financeiros |
| 7 | `financas-e-economia` | 2 + 3 | Invariantes de liquidez; mark-to-market; ciclos de transação |
| 8 | `mobilidade-e-logistica` | 2 + 3 | Roteamento, deslocamento físico; estados de entrega |
| 9 | `cultura-lazer-e-eventos` | 1 + 3 | Evento como entidade; ciclo de agenda/capacidade/experiência |
| 10 | `saude-e-bem-estar` | 2 | Ética médica, sigilo, regulação CFM — invariantes únicas |
| 11 | `educacao-e-conhecimento` | 2 + 3 | Certificação, progressão; ciclo de aprendizado avaliado |
| 12 | `governanca-e-decisao` | 2 | Quórum, voto, assembleia — regras formais de decisão |

### 7.1 Definição operacional: ativos-corporativos

`ativos-corporativos` = ativos cujo **propósito primário é uso/controle operacional** (não liquidez, não valorização de curto prazo).

| Ativo | Propósito primário | Domínio |
|-------|-------------------|---------|
| Veículo empresa | Uso operacional | `ativos-corporativos` |
| Patente | Controle tecnológico | `ativos-corporativos` |
| Cripto tesouraria | Reserva de valor operacional | `ativos-corporativos` |
| Cripto trading | Valorização/liquidez | `financas-e-economia` |
| Ações controle societário | Controle operacional | `ativos-corporativos` |
| Ações especulativas | Valorização/liquidez | `financas-e-economia` |

**Nota sobre nomenclatura:** `ativos-corporativos` (anteriormente `patrimonio-e-ativos`) elimina ambiguidade com "ativos" de `financas-e-economia` (instrumentos financeiros).

**Nota sobre `mobilidade-e-logistica`:** Domínio unificado que abrange transporte (pessoas) e logística (bens). Separação em N1 forte pode ser necessária em escala futura (documentado em RFC-002).

---

## 8. DOMÍNIOS CONDICIONAIS

Domínios que satisfazem parcialmente o critério N0 ou dependem de escopo estratégico.

### 8.1 Lista atual

| # | Domínio | Critério parcial | Barreira de ativação | Contrato de interface |
|---|---------|-----------------|----------------------|----------------------|
| 13 | `construcao-e-infraestrutura` | 2 (ART) + 3 (ciclo de obra) | Operação de obra civil com ART ou marketplace de insumos | Definido em `docs/01_normative/interfaces/construcao.md` |

*Nota: Passa em critérios 2 e 3, mas não em critério 1 (entidades redutíveis a `servicos` + `ativos-corporativos`). Status: elegível a N0, não ativado.*

### 8.2 Nota sobre domínios removidos

**`causas-sociais-e-impacto`** foi removido da lista após aplicação rigorosa do critério formal:

| Teste | Resultado | Análise |
|-------|-----------|---------|
| Critério 1 (entidades) | ❌ | ONG = `organizacoes` + contexto; beneficiário = `pessoas` + contexto |
| Critério 2 (invariantes) | ❌ | Restrição de lucro, prestação de contas = **especialização** de regime jurídico de organização, não invariante único |
| Critério 3 (ciclo) | ❌ | Ciclo de programa social = ciclo de `servicos` com medição de impacto (atributo) |

**Classificação correta:** `organizacoes-e-instituicoes` + `contexto: filantropia` + `finalidade: impacto-social` + **dimensão** `impacto_social`.

**Status:** Removido de N0. Decisão estratégica, não ontológica absoluta. Semântica preservada via dimensão transversal. Sem plano de promoção.

### 8.3 Igualdade estrutural de condicionais

Domínios condicionais **não são hierarquicamente inferiores** aos core. Diferem apenas em:
- **Estado operacional:** inativo vs ativo
- **Maturidade de implementação:** contrato definido, execução pendente

Quando ativados, possuem **mesmo tratamento arquitetural, mesmo nível de governança, mesmos mecanismos de evolução** que domínios core.

---

## 9. REGRA DE PROMOÇÃO (para domínios condicionais restantes)

Promoção de condicional para N0 requer:

**VALIDAÇÃO ARQUITETURAL (todos obrigatórios):**
- Passa no critério formal (Seção 3) sem ressalvas
- Interfaces e contratos de integração definidos
- Evidência de necessidade de separação semântica

**EVIDÊNCIA DE NECESSIDADE (pelo menos um):**
- Volume de transações > 10.000/mês sustentado por 6 meses
- Receita direta do domínio > 5% do total do sistema
- Requisito regulatório que exija tratamento diferenciado
- Declaração estratégica de diferencial competitivo com roadmap aprovado

Processo: RFC → revisão de arquitetura → ativação via toggle + migração.

---

## 10. EXEMPLOS DE CLASSIFICAÇÃO

### 10.1 Casos simples

| Caso | Domínio | Nota |
|------|---------|------|
| Pintor, pedreiro | `servicos` → `manutencao-e-reformas` | Mão-de-obra sem ART |
| Tinta, cimento | `produtos-e-comercio` → `materiais` | Mercadoria |
| Prefeitura, Receita Federal | `organizacoes-e-instituicoes` | Entidade governamental |

### 10.2 Casos de fronteira (polêmicos resolvidos)

| Caso | Classificação | Justificativa |
|------|--------------|---------------|
| ONG | `organizacoes-e-instituicoes` + contexto: filantropia + dimensão: `impacto_social` | Redutível; invariantes são especialização de organização; impacto via dimensão |
| Evento de música | `cultura-lazer-e-eventos` | Entidade evento; ciclo de agenda/capacidade; não é produto |
| Reforma residencial | `servicos` → `reformas` | Sem ART; não altera estrutura; não gera bem novo |
| Construção de prédio | `construcao-e-infraestrutura` (se ativo) ou `servicos` | Com ART; alteração estrutural; cria bem patrimonial novo |
| Doação para ONG | `financas-e-economia` → `transferencias` + dimensão: `impacto_social` | Transação financeira; sem entidade própria de "causa"; impacto via dimensão |
| Projeto de software | `servicos` → `tecnologia` + execution: project | Prestação de serviço com modelo de execução project |
| Assinatura Netflix | `cultura-lazer-e-eventos` + execution: continuous | Entrega de conteúdo como experiência, não produto |
| Programa social governamental | `servicos` + contexto: publico + dimensão: `impacto_social` | Prestação de serviço com funding público; impacto via dimensão |
| Veículo corporativo | `ativos-corporativos` → `veiculos` | Ativo de uso com FIPE, seguro, depreciação |
| Ações para controle | `ativos-corporativos` | Propósito: controle operacional |
| Ações para trading | `financas-e-economia` | Propósito: liquidez/valorização |

### 10.3 Casos com GRAPH

| Subject | Relation | Object | Contexto |
|---------|----------|--------|----------|
| `pagamento` | enables | `entrega` | e-commerce |
| `assinatura-mensal` | requires | `cartao-credito` | billing |
| `lead` | evolves_to | `cliente-ativo` | CRM |
| `curso-intro` | part_of | `formacao-completa` | educação |

---

## 11. DECISÃO ESTRATÉGICA

A ativação de domínios condicionais é **decisão de produto**, não puramente ontológica.

Critério de decisão:

| Pergunta | Se SIM | Se NÃO |
|----------|--------|--------|
| O domínio é core do negócio em 24 meses? | Ativar como N0 | Manter condicional |
| Há recursos para implementar invariantes próprias? | Ativar como N0 | Adiar |
| A redução a outro domínio gera perda semântica crítica? | Ativar como N0 | Aceitar redução |

---

## 12. RFCS REFERENCIADOS

### RFC-001: Granularidade de Pilares

| Campo | Valor |
|-------|-------|
| Título | Granularidade refinada de pilares em CONCEPT |
| Status | Proposto |
| Resumo | Expandir pilares booleanos para enum: none \| optional \| required |
| Impacto | Migração de schema + reavaliação de todos os CONCEPTs |
| Timeline | Não planejado para 24 meses |
| Data | 2026-03-22 |

### RFC-002: Separação de Mobilidade e Logística

| Campo | Valor |
|-------|-------|
| Título | Separação de mobilidade-e-logistica em domínios distintos |
| Status | Proposto |
| Resumo | Avaliar split em N1 forte quando escala operacional justificar |
| Impacto | Nova navegação em TREE, migração de CONCEPTs existentes |
| Timeline | Não planejado para 24 meses |
| Data | 2026-03-22 |

### RFC-003: Time-Service (Ponto de Atenção Estrutural)

| Campo | Valor |
|-------|-------|
| Título | Time como SSOT próprio |
| Status | A criar (pré-requisito para agenda/reservas) |
| Resumo | Serviço dedicado para agenda global, reservas, eventos concorrentes, recorrência complexa |
| Impacto | Novo bounded context, integração com execution model |
| Timeline | Antes de implementar módulos de agenda/reservas |
| Data | 2026-03-22 |

---

## 13. PONTOS DE ATENÇÃO ESTRUTURAL (NÃO BLOQUEANTES)

### 13.1 Tempo como SSOT próprio

O pilar TIME está declarado e integrado ao execution model. Porém, quando entrar agenda global, reservas, eventos concorrentes e recorrência complexa, será necessário um `time-service` dedicado com SSOT próprio.

**Ação:** Criar RFC-003 antes de implementar módulos de agenda e reservas.

### 13.2 Context resolution engine

O CONTEXT atual é declarativo (`personal` \| `professional` \| `institutional`) sem regras de precedência. Quando o mesmo CONCEPT tiver comportamento diferente por contexto, será necessária uma regra explícita de qual contexto governa.

**Exemplo:**
```
"motorista"
- contexto pessoal
- contexto profissional  
- contexto plataforma (uber-like)
```

**Pergunta não respondida:** Quem governa o comportamento?

**Ação:** Definir context precedence rules no documento de N1 antes de implementar casos com contexto múltiplo.

---

## 14. STATUS E GOVERNANÇA

| Aspecto | Status |
|---------|--------|
| N0 core (1-12) | **ESTÁVEL** — alterações raras, exigem RFC excepcional |
| Critério formal (Seção 3) | **CONGELADO** — base de decisão imutável |
| Execution model (Seção 5.3) | **CONGELADO** — implementação obrigatória |
| State machine connection (5.3.1) | **CONGELADO** — regra de integração |
| Unicidade de CONCEPT (Seção 5.2) | **CONGELADO** — mecanismo anti-duplicação |
| Display names locale (5.2.3) | **CONGELADO** — estrutura de localização |
| Governança de CONCEPT (Seção 5.5) | **CONGELADO** — pipeline obrigatório |
| `canonical_product` vs CONCEPT (Seção 5.1.1) | **CONGELADO** — materialização operacional; CONCEPT prevalece |
| Pilares (Seção 5.4) | **CONGELADO** — estrutura e obrigatoriedade por domínio |
| Granularidade de pilares (5.4.4) | **DOCUMENTADO** — limitação conhecida, RFC-001 |
| Dimensões transversais (Seção 4.1) | **CONGELADO** — sistema de extensão semântica |
| GRAPH layer (Seção 6) | **CONGELADO** — estrutura e governança |
| Domínios condicionais (13) | **AGUARDANDO DECISÃO ESTRATÉGICA** |
| `causas-sociais` (removido) | **RESOLVIDO VIA DIMENSÃO** — decisão estratégica, não absoluta |
| `construcao` (condicional) | **ELEGÍVEL, NÃO ATIVADO** — não passa critério 1 |
| `mobilidade` separação futura | **DOCUMENTADO** — RFC-002, não planejado 24 meses |
| Estrutura de camadas (Seção 4) | **CONGELADO** |
| Time-service (RFC-003) | **PENDENTE** — ponto de atenção estrutural |
| Context precedence rules | **PENDENTE** — definir no N1 |

Alterações normativas requerem:
1. RFC técnico com análise de impacto
2. Revisão por comitê de arquitetura
3. Aprovação unânime para mudanças em itens congelados

---

## 15. PRÓXIMOS PASSOS — PLANO DE IMPLEMENTAÇÃO

Com o N0 congelado, a sequência correta de implementação é:

| Passo | Ação | Prioridade |
|-------|------|------------|
| 0 | **Implementado:** `domains` + `concepts.domain` = **somente** N0 (FK `domains`), migrações `0073` + `0074`; antes de `0074` preencher `n0_domain` com `pnpm backfill:n0-from-legacy` | FEITO |
| 0b | **Criação de CONCEPT:** trigger `0075_concept_governance` (INSERT só com `app.concept_governance`); serviço `concept-governance.service.ts` (`createConcept` / `createConceptWithClient`) | FEITO |
| 0c | **Escrita em GRAPH (`concept_relations`):** trigger `0077` (INSERT/UPDATE só com `app.graph_governance`); serviço `graph-governance.service.ts` (`createConceptRelation` / `createConceptRelationWithClient`) | FEITO |
| 1 | Documentar N1 dos 3 domínios críticos: `financas-e-economia`, `produtos-e-comercio`, `servicos` | IMEDIATO |
| 2 | Criar `concept-governance-service` | ALTA |
| 3 | Criar `graph-service` (evolução: tabela `concept_relations` + leitura em `graph.adapter` com fallback a `category_relations` — mig. `0076`) | EM CURSO (schema + adapter) |
| 4 | Migrar `categories` → `concept_id` | ALTA |
| 5 | Eliminar `categoryAffinities` | MÉDIA |
| 6 | Criar RFC-003 (`time-service`) | MÉDIA |
| 7 | Definir context precedence rules no N1 | MÉDIA |
| 8 | Ativar `construcao-e-infraestrutura` (quando critério estratégico atingido) | CONDICIONAL |

---

## 16. CONCLUSÃO

O sistema UnifiCard está arquitetado para:

- **Crescimento modular** — via domínios condicionais
- **Inclusão de novos mercados** — sem refatoração estrutural
- **Evolução controlada** — alterações raras, documentadas, aprovadas
- **Consistência semântica** — via canonicalização de CONCEPT
- **Extensibilidade sem quebra** — via dimensões transversais
- **Navegabilidade relacional** — via GRAPH layer
- **Execução previsível** — via execution model integrado a state machine
- **Separação por propósito** — via critério de propósito primário em ativos

Este documento encerra a definição ontológica base. Expansões futuras operam dentro deste framework.

---

## 17. HISTÓRICO DE VERSÕES

| Versão | Mudanças principais |
|--------|---------------------|
| 1.0.0 | Estrutura base, 14 domínios propostos |
| 1.0.1 | Critério formal ajustado (AND→OR), schema contrato vs execução, 13 domínios (1 removido) |
| 1.0.2 | Unicidade de CONCEPT (canonical_id), renomeação `ativos-corporativos`, igualdade estrutural de condicionais |
| 1.0.3 | Governança de criação de CONCEPT (pipeline), integração com pilares, dimensões transversais (impacto_social), pilares obrigatórios por domínio |
| 1.0.4 | GRAPH layer formalizado, sistema de dimensões com serviços, execution ↔ state machine, display names com locale, responsável do pipeline explícito, limitações documentadas |
| 1.0.5 | Definição `ativos-corporativos` por propósito primário, RFC-001 e RFC-002 criados, elegibilidade vs ativação formalizada, pontos de atenção estrutural documentados, plano de implementação sequencial |
| 1.0.6 | Seção 5.1.1: `canonical_product` como materialização operacional de catálogo (não semântica); dependência obrigatória de CONCEPT; proibições de inferência semântica a partir de canonical; alinhamento com `SSOT_REGISTRY_UNIFICARD.md` e `07_NOMENCLATURA_CANONICA.md` |

**Total de domínios:** 12 core + 1 condicional = 13 domínios ativos (1 removido, resolvido via dimensão; 1 documentado para possível separação futura).

---

## 18. VEREDITO DE AUDITORIA TÉCNICA (CONSOLIDADO)

### ✅ O QUE FICOU IRREPREENSÍVEL

1. **CONCEPT GOVERNANCE — INQUEBRÁVEL**
   - Pipeline obrigatório
   - canonical_id imutável
   - Proibição fora de governança
   - Serviço dedicado

   *Impacto: Matou duplicação semântica, drift de conceito, inconsistência entre módulos*

2. **CAMADAS — FINALMENTE COERENTES**
   - Nenhuma sobreposição
   - Arquitetura madura

3. **DIMENSÕES — AGORA SÃO DE VERDADE**
   - Schema, serviço, governança, SSOT por dimensão
   - `impacto_social` e `reputacao` não são mais gambiarras locais

4. **GRAPH — FINALMENTE É UM SISTEMA**
   - Triple store definido
   - Tipos de relação claros
   - `categoryAffinities` está oficialmente morto arquiteturalmente

5. **EXECUTION ↔ STATE — PERFEITO**
   - Não existe lifecycle paralelo
   - Não existe estado inconsistente

6. **DOMÍNIOS N0 — LIMPOS**
   - `ativos-corporativos` por propósito resolve 100% da ambiguidade com finanças
   - `causas-sociais` como dimensão está formalizado
   - `construcao` como condicional resolve elegível ≠ ativado

### ⚠️ PONTOS DE ATENÇÃO ESTRUTURAL (NÃO BLOQUEANTES)

1. **TEMPO AINDA NÃO É UM SISTEMA**
   - Quando entrar agenda global, reservas, eventos concorrentes, será necessário `time-service`
   - Não bloqueia agora, mas precisa virar RFC cedo (RFC-003)

2. **CONTEXT AINDA ESTÁ SUBDEFINIDO**
   - Falta regras de conflito (context precedence rules)
   - Mesmo CONCEPT em contextos diferentes → comportamento divergente não resolvido

### 🚨 RISCO REAL
```
BAIXO (quase zero)
```

### 🔒 DECISÃO FINAL
```
PODE CONGELAR COM SEGURANÇA
```

**Tradução final:** Você saiu de *"vamos organizar categorias"* para *"vamos definir o motor semântico universal do sistema"*.

Agora não é mais arquitetura. Agora é **EXECUÇÃO**.

---

**Assinatura digital:** [Arquitetura UnifiCard]  
**Hash de integridade:** [SHA-256 do documento]  
**Próxima revisão programada:** Nenhuma (somente por RFC)

---

**Documento completo — versão 1.0.5 — CONGELADO E PRONTO PARA IMPLEMENTAÇÃO**

---

## 19. SEPARAÇÃO DE CAMADAS

- **LAYER 1 — CONCEPT**: identidade semântica (SSOT).
- **LAYER 2 — TREE (`categories`)**: navegação operacional única.
- **N1_NODES (`n1_nodes`)**: navegação global governada por domínio N0; não redefine a árvore operacional.
- **PROFILE**: read model de consumo; não cria identidade.

## 20. REGRA DE IDENTIDADE SEMÂNTICA

- Somente **CONCEPT** define “o que algo é”.
- `slug`, `category_id`, nome e rótulos são artefatos de navegação/UX e não podem governar identidade.
- GRAPH relaciona CONCEPTs já identificados e não substitui a identificação semântica.

## 21. USO DE CATEGORIES

- O sistema mantém uma única árvore em `categories`.
- A mesma árvore pode ser consumida por contextos diferentes via `scope`/contexto, sem criar árvores paralelas.
- `categories` não é SSOT semântico; sua função é organização e descoberta.

## 22. PERFIL PROFISSIONAL — ESTADO ATUAL

- O fluxo profissional consome `categories` com `scope = 'professional'`.
- Skills no estado atual operam com `level <= 2`.
- `concept_id` é obrigatório para validade semântica.
- Leituras/escritas devem falhar em inconsistência (sem fallback silencioso).

## 23. ANTI-PATTERNS (PROIBIDO)

- Criar árvore paralela para perfil.
- Tratar `n1_nodes` como substituto de `categories`.
- Inferir semântica por `slug`.
- Conectar módulos por `category_id`/nome em vez de CONCEPT.
- Criar SSOT semântico concorrente ao CONCEPT.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 07_NOMENCLATURA_CANONICA.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- 22_RFC_N1_PESSOAS_E_IDENTIDADES.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
- VOCABULARIO_CANONICO_UNIFICARD.md
<!-- AUTO-GENERATED-END -->