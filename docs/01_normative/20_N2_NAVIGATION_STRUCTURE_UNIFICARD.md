# N2_NAVIGATION_STRUCTURE_UNIFICARD

**Documento Normativo — Versão 4.0.4-FINAL**  
**Data:** 2026-03-23  
**Status:** CONGELADO — IMPLEMENTAÇÃO OBRIGATÓRIA  
**Base:** N1_NAVIGATION_STRUCTURE_UNIFICARD v1.0.0-FINAL  
**Evolução:** Modelo contextual integrado + Correções arquiteturais constitucionais  
**Próxima revisão:** Somente por RFC formal  

---

## 1. OBJETIVO

Este documento define a estrutura de N2 (Layer 2 — TREE, nível 2) com **modelo contextual**, permitindo que o mesmo N1 apresente N2 diferentes conforme o contexto de uso, mantendo SSOT (Single Source of Truth).

**Princípio fundamental:** N2 é fixo (estrutura canônica — *canônico ≠ SSOT; apenas padrão estrutural*), mas a **ativação** de N2 é contextual.

**Correção arquitetural v4.0.0:** N2 é exclusivamente estrutura de navegação — não possui identidade semântica, não usa `canonical_id`, não representa entidades do mundo real, **NÃO é SSOT semântico** (SSOT = CONCEPT).

### 1.1 Terminologia constitucional (obrigatória)

| Termo correto | Proibido |
|-----------------|----------|
| `context_slug` | `context_id` como string livre |
| `slug` (N2) | `canonical_id` |
| CONCEPT (SSOT) | qualquer substituto |

---

## 2. POSICIONAMENTO NA ONTOLOGIA

```
LAYER 1: CONCEPT → identidade semântica (imutável, SSOT absoluto)
LAYER 2: TREE (N0→N1→N2→N3) → navegação possível (estrutura pura)
LAYER 3: CONTEXT → ativação de subconjunto da TREE (identidade formal governada)
LAYER 5: ATTRIBUTES → facets (complementam, não substituem)
LAYER 6: GRAPH → relações semânticas
```

**Fluxo de navegação obrigatório:**

CONTEXT deve ser explicitamente definido por usuário, fluxo controlado ou entrada externa validada — **nunca** inferido automaticamente, deduzido pelo sistema ou derivado de comportamento implícito.

```
USUÁRIO → define explicitamente CONTEXT → vê N1 relevantes → vê N2 ativos para aquele contexto → CONCEPT
```

**Frase canônica:**
> **N2 organiza. CONTEXT ativa. CONCEPT define.**

### 2.1 Precedência causal — exclusão de N2 e CONTEXT

N2 e CONTEXT **não participam** da cadeia de efeitos de negócio **Mutação → Estado → Dinheiro → Evento** (nem de cadeias equivalentes de alteração de estado persistido, obrigação financeira e evento de domínio). Permanecem estritamente em **navegação** e **ativação de subconjunto da TREE**. É **constitucionalmente inválido** usar `n2.slug`, `context_slug` ou `context_n2_mapping` como gatilho substituto de regras canônicas nessa cadeia (ex.: disparar comportamento de cobrança, mudança de estado contratual ou emissão de evento contábil apenas porque o usuário navegou por um N2 ou um CONTEXT).

---

## 3. DEFINIÇÃO E REGRAS DE N2

### 3.1 O que é N2

N2 é um nível da TREE responsável por:
- **Agrupar** elementos de navegação
- **Estruturar** escolhas do usuário
- **Organizar** experiências dentro de um N1

### 3.1.1 Pilar dominante constitucional (N2)

**PILAR DOMINANTE DO N2: NOMENCLATURA**

A identidade operacional de N2 no sistema é exclusivamente **nomenclatura de navegação** (`slug` e nomes exibidos). N2 **não** pode ser governado por pilares de significado semântico, regra de negócio, ontologia de produto ou identidade comercial; invasão de outros pilares como base de decisão para N2 é **constitucionalmente inválida**.

### 3.2 Regras absolutas

```
N2 = NAVEGAÇÃO POSSÍVEL (fixo no banco, estrutura pura)
N2 ⊂ N1 ⊂ N0 (sempre)
N2 ≠ CONCEPT (sem identidade própria)
N2 ≠ SEMÂNTICA (GRAPH explica relações)
N2 ≠ ENTIDADE (não representa objetos do mundo real)
N2 ≠ SSOT (SSOT semântico é CONCEPT, não N2)

N2 NÃO pode ser usado para:
- inferência semântica
- classificação de entidades
- substituição de CONCEPT
- derivar significado semântico
- inferir atributos de CONCEPT
- assumir propriedades implícitas

EXEMPLO PROIBIDO:

if (n2.slug === "acougue") → assumir "carne"

Toda semântica deve vir exclusivamente de CONCEPT ou GRAPH.

CONTEXT = FILTRO (ativa subconjunto de N2)
CONTEXT ≠ ALTERA N2 (N2 permanece fixo)
CONTEXT ≠ CRIA N2 (N2 existe independente de contexto)
```

### 3.3 Proibições estruturais de N2

| N2 NÃO pode representar | N2 DEVE representar apenas |
|------------------------|---------------------------|
| Entidades (produto, serviço, pessoa, doença) | Agrupamentos de navegação |
| Conceitos semânticos | Estruturas de escolha |
| Categorias ontológicas | Organização de experiência |
| Identidade de negócio | Caminho de navegação |

### 3.4 Nomenclatura corrigida

**Estrutura SQL válida:**

```sql
n2_nodes (
  slug VARCHAR(64) PRIMARY KEY  -- identificador de navegação apenas
  -- REGRA: NÃO usar canonical_id em N2
  -- canonical_id pertence EXCLUSIVAMENTE ao CONCEPT (LAYER 1)
  -- REGRA: N2 NÃO é SSOT — é estrutura canônica da navegação (canônico ≠ SSOT; apenas padrão estrutural)
)
```

---

## 4. FORMALIZAÇÃO DO CONTEXT (LAYER 3) — CORRIGIDO v4.0.0

### 4.1 Definição

CONTEXT é entidade do LAYER 3 responsável por:
- Definir o **ambiente de aplicação** da navegação

CONTEXT é identidade operacional de ativação, **não** é fonte de verdade de domínio, **não** é SSOT semântico, e **não** pode ser usado para inferência semântica.

**Objetivo:** impedir que CONTEXT vire SSOT no futuro.

### 4.2 Natureza

```
CONTEXT ≠ CONCEPT
CONTEXT ≠ TREE
CONTEXT ≠ INTENT

CONTEXT é: camada de aplicação sobre TREE
```

### 4.3 Pilares

| Pilar | Descrição |
|-------|-----------|
| **Dominante** | ESTADOS (ambientes de aplicação) |
| **Secundário** | NOMENCLATURA (identificador formal governado) |

### 4.4 Função central

| Elemento | Função |
|----------|--------|
| **TREE** | Define possibilidades de navegação |
| **CONTEXT** | Ativa subconjunto dessas possibilidades |

### 4.5 Regras fundamentais de CONTEXT

- CONTEXT **não cria** estrutura
- CONTEXT **não altera** estrutura
- CONTEXT **não redefine** TREE
- CONTEXT **apenas ativa** subconjunto existente

### 4.6 Identidade de CONTEXT — **CORREÇÃO CRÍTICA v4.0.0**

CONTEXT possui **identidade formal governada**, com limitações absolutas:

| Aspecto | Regra |
|---------|-------|
| Identidade | Formal (não semântica) |
| `canonical_id` | **PROIBIDO** (reservado para CONCEPT) |
| Identificador | `context_slug` (governado) |
| SSOT | NÃO é SSOT semântico |
| Criação | **Mediante §4.10; execução técnica via governance-service** |
| Uso em runtime | **PROIBIDO string livre** |

**⚠️ ALERTA CONSTITUCIONAL:** CONTEXT não pode ser usado como string livre no sistema. Deve possuir identidade formal governada em `context_nodes` (tabela de registro obrigatória).

### 4.7 Governança de CONTEXT — **CORREÇÃO CRÍTICA v4.0.0**

| Ação | Regra |
|------|-------|
| Criação | **Mediante §4.10; execução técnica via governance-service** (proibido ad hoc) |
| Alteração | **Apenas via governance-service** |
| Uso direto em código | **PROIBIDO** |
| Uso direto em API | **PROIBIDO** |
| Uso direto em UI | **PROIBIDO** |
| Inferência automática | **PROIBIDA** |

### 4.10 Autoridade Constitucional de CONTEXT

CONTEXT só pode ser criado mediante:

- RFC formal aprovada
- Validação contra ontologia (LAYER 3)
- Aprovação explícita de arquitetura

governance-service NÃO possui autoridade decisória  
Apenas executa decisões previamente aprovadas

Criação direta de CONTEXT por código, script ou heurística:  
PROIBIDA

### 4.8 Unicidade

Cada CONTEXT deve ser **único** como ambiente de aplicação, registrado em `context_nodes` com `context_slug` como identificador canônico.

### 4.9 Estrutura SQL de CONTEXT — **NOVO v4.0.0**

```sql
-- Tabela: context_nodes (identidade formal governada do CONTEXT)
-- REGRA: CONTEXT NÃO é string livre — deve estar registrado aqui
CREATE TABLE context_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_slug VARCHAR(64) NOT NULL UNIQUE,  -- identificador canônico (ex: 'supermercado')
    -- OPTIONAL: restrição de domínio para escopo operacional
    -- NÃO define pertencimento ontológico
    -- CONTEXT NÃO pertence a N0
    domain_key TEXT REFERENCES domains(domain_key),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT context_slug_unique UNIQUE (context_slug)
);

-- Tabela: context_localized_names (nomes para UI)
CREATE TABLE context_localized_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID NOT NULL REFERENCES context_nodes(id) ON DELETE CASCADE,
    locale VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    value VARCHAR(128) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    
    CONSTRAINT context_locale_priority_unique UNIQUE (context_id, locale, priority)
);
```

---

## 5. RELAÇÃO TREE ↔ CONTEXT

### 5.1 Regra central

```
TREE = universo de navegação possível
CONTEXT = ativação de subconjunto (com identidade formal governada)
```

### 5.2 Consequências

- CONTEXT **depende** da TREE
- TREE **não depende** de CONTEXT
- CONTEXT **não existe** sem registro em `context_nodes`

### 5.3 Proibições absolutas de CONTEXT

CONTEXT NÃO pode:
- Criar N0, N1, N2 ou N3
- Modificar estrutura da TREE
- Duplicar estrutura
- Gerar nova hierarquia
- Ser usado como string livre (deve ser FK para `context_nodes`)
- Gerar estrutura implícita ou **N2 dinâmico** em runtime (`if context = 'x'` → criar, simular ou materializar N2 fora de `n2_nodes` governado)

### 5.4 `context_n2_mapping` — escopo estrito (anti-SSOT indireto)

`context_n2_mapping` **não** governa comportamento de negócio, produto, preço, elegibilidade, política ou estado da aplicação. **Apenas** registra **ativação de navegação**: quais linhas de `n2_nodes` são válidas para exibição sob qual `context_slug`.

- **NÃO é** fonte de verdade de comportamento
- **NÃO substitui** CONCEPT, GRAPH ou regras de domínio
- **PROIBIDO** usar consultas a `context_n2_mapping` como lógica decisória de negócio (ex.: inferir oferta, categoria semântica, obrigação contratual)

### 5.5 CONTEXT e não expansão da TREE

CONTEXT **não pode** gerar estrutura implícita da TREE. N2 **só existe** como linhas em `n2_nodes` criadas e alteradas pelo processo governado; **proibido** derivar ou montar árvore de navegação apenas a partir de CONTEXT sem persistência governada equivalente.

---

## 6. MODELO DE DADOS (CORRIGIDO v4.0.0)

```
n2_nodes (estrutura canônica da navegação — *canônico ≠ SSOT; apenas padrão estrutural* — NÃO é SSOT)
    ↓
context_nodes (identidade formal governada do CONTEXT — NÃO é SSOT semântico)
    ↓
context_n2_mapping (ativação: qual N2 é válido para qual contexto)
    ↓
Aplicação aplica contexto explicitamente definido (validado contra context_nodes; sem inferência automática)
```

---

## 7. ESTRUTURA N2 POR DOMÍNIO E CONTEXTO

### 7.1 PRODUTOS E COMÉRCIO (`produtos-e-comercio`)

#### 7.1.1 `alimentacao` — 3 contextos, 12 N2 fixos

| Contexto (`context_slug`) | N2 Ativos (slug) | Tipo de navegação | Definição |
|---------------------------|------------------|-------------------|-----------|
| `supermercado` | `acougue` | Departamento real | Produtos de origem animal fresca: bovina, suína, aves, peixes frescos, ovos |
| `supermercado` | `hortifruti` | Departamento real | Produtos de origem vegetal fresca: frutas, legumes, verduras, temperos frescos, cogumelos |
| `supermercado` | `laticinios-e-frios` | Departamento real | Produtos à base de leite e embutidos: leite, queijos, iogurtes, manteiga, presunto, mortadela, salames |
| `supermercado` | `mercearia` | Departamento real | Alimentos processados e secos: arroz, feijão, massas, óleos, açúcar, sal, farinhas, conservas, molhos |
| `supermercado` | `padaria-e-confeitaria` | Departamento real | Produtos de panificação: pães, bolos, doces, salgados assados, massas frescas |
| `supermercado` | `congelados-e-resfriados` | Departamento real | Produtos industrializados conservados: pizzas, hambúrgueres, vegetais congelados, sorvetes, refeições prontas |
| `delivery` | `japonesa` | Intenção/tipo de culinária | Comida japonesa: sushi, sashimi, temaki, yakisoba, teppanyaki |
| `delivery` | `pizza` | Intenção/tipo de culinária | Pizzas: tradicional, brotinho, esfihas, calzones |
| `delivery` | `hamburguer` | Intenção/tipo de culinária | Hamburguerias: artesanal, smash, vegano, combos |
| `delivery` | `brasileira` | Intenção/tipo de culinária | Comida brasileira: marmitex, pratos feitos, comida caseira, regional |
| `delivery` | `saudavel` | Intenção/tipo de culinária | Opções saudáveis: saladas, bowls, low carb, fit, orgânico |
| `delivery` | `doces-e-sobremesas` | Intenção/tipo de culinária | Sobremesas: açaí, sorvete, bolos, doces, chocolates |
| `nutricao` | `cafe-da-manha` | Projeto/refeição | Refeições matinais: itens para café da manhã, brunch, lanche da manhã |
| `nutricao` | `almoco-rapido` | Projeto/refeição | Almoço prático: marmitas, refeições balanceadas, meal prep |
| `nutricao` | `jantar-familia` | Projeto/refeição | Refeições em família: receitas para compartilhar, comfort food |
| `nutricao` | `lanche-treino` | Projeto/refeição | Alimentação pré/pós-treino: proteicos, energéticos, recuperação |
| `nutricao` | `dieta-especial` | Projeto/refeição | Restrições alimentares: sem glúten, sem lactose, vegano, diabético |

**Facets complementares:** `estado-de-conservacao: fresco | refrigerado | congelado` (atributo, não N2).

---

#### 7.1.2 `bebidas` — 2 contextos, 5 N2 fixos (padrão **B**: núcleo partilhado + extensão por contexto)

| Contexto (`context_slug`) | N2 Ativos (slug) | Tipo de navegação | Definição | Exemplos N3 |
|---------------------------|------------------|-------------------|-----------|-------------|
| `varejo` | `cervejas` | Tipologia bebida | Cervejas: pilsen, IPA, stout, artesanal, importada, nacional |
| `varejo` | `vinhos` | Tipologia bebida | Vinhos: tinto, branco, rosé, espumante, garrafa |
| `varejo` | `destilados` | Tipologia bebida | Destilados: whisky, vodka, gin, rum, tequila, cachaça |
| `varejo` | `nao-alcoolicas` | Sem álcool | Refrigerantes, sucos, águas, energéticos, chás, café, leites |
| `bar` | `cervejas` | Experiência de consumo | Cervejas: pilsen, IPA, stout, artesanal, importada, nacional |
| `bar` | `vinhos` | Experiência de consumo | Vinhos: tinto, branco, rosé, espumante, por taça ou garrafa |
| `bar` | `destilados` | Experiência de consumo | Bebidas destiladas: whisky, vodka, gin, rum, tequila, cachaça |
| `bar` | `drinks` | Experiência de consumo | Coquetéis: clássicos, autorais, sem álcool (mocktails) |
| `bar` | `nao-alcoolicas` | Experiência de consumo | Opções sem álcool: refrigerantes, sucos, água tônica, água |

**Facets:** `teor-alcoolico`, `origem`, `tipo`, `acucar`, `gas`, `temperatura`.

---

#### 7.1.3 `higiene-e-beleza` — 2 contextos, 9 N2 fixos (padrão **A**: `perfumaria` = consumo; `farmacia` = necessidade; **sem** N2 por sintoma)

| Contexto (`context_slug`) | N2 Ativos (slug) | Tipo de navegação | Definição | Exemplos N3 |
|---------------------------|------------------|-------------------|-----------|-------------|
| `perfumaria` | `cuidados-com-cabelo` | Eixo consumo | Capilar | shampoos, condicionadores, tinturas, tratamentos |
| `perfumaria` | `cuidados-com-a-pele` | Eixo consumo | Skincare / dermocosmética | hidratantes, protetor solar, séruns |
| `perfumaria` | `higiene-pessoal` | Eixo consumo | Higiene diária | sabonetes, desodorantes, higiene bucal |
| `perfumaria` | `maquiagem` | Eixo consumo | Coloração | bases, batons, sombras |
| `perfumaria` | `perfumaria` | Eixo consumo | Fragrância | perfumes, colônias, body splash |
| `farmacia` | `medicamentos` | Eixo necessidade | Categoria terapêutica / forma (não sintoma na TREE) | OTC, genéricos, referência (detalhe em facets / INTENT) |
| `farmacia` | `vitaminas-e-suplementos` | Eixo necessidade | Suplementação | multivitamínicos, ômega, whey |
| `farmacia` | `cuidados-pessoais` | Eixo necessidade | HPC em farmácia | fraldas adulto, cuidados específicos ponto de venda drugstore |
| `farmacia` | `primeiros-socorros` | Eixo necessidade | Kit / emergência leve | curativos, antisépticos, gaze, esparadrapo |

---

#### 7.1.4 `vestuario-e-acessorios` — 1 contexto, 3 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Navegação por |
|---------------------------|------------------|-----------|-------------|---------------|
| `moda` | `moda-feminina` | Vestuário e complementos para mulheres | roupas, lingerie, moda praia, moda fitness, acessórios femininos | Público-alvo |
| `moda` | `moda-masculina` | Vestuário e complementos para homens | roupas, cuecas, moda praia, moda fitness, acessórios masculinos | Público-alvo |
| `moda` | `infantil-e-bebe` | Vestuário e complementos para crianças | roupas, uniformes, pijamas, acessórios infantis, moda bebê | Faixa etária |

**Facets:** `categoria: calcados | bolsas | joias | oculos` (transversal por público).

---

#### 7.1.5 `casa-e-decoracao` — 1 contexto, 4 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Cômodo/Função |
|---------------------------|------------------|-----------|-------------|---------------|
| `casa` | `moveis` | Mobília para residência | sofás, mesas, cadeiras, armários, camas, estantes, racks | Cômodo específico |
| `casa` | `decoracao` | Ornamentação de ambientes | quadros, vasos, espelhos, cortinas, luminárias decorativas, relógios | Estética |
| `casa` | `cama-mesa-e-banho` | Têxteis domésticos | lençóis, edredons, toalhas, jogos americanos, cortinas, tapetes | Função doméstica |
| `casa` | `utilidades-domesticas` | Ferramentas de cozinha e casa | panelas, utensílios, organizadores, eletroportáteis pequenos, garrafas térmicas | Atividade doméstica |

---

#### 7.1.6 `eletroeletronicos` — 1 contexto, 4 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Uso primário |
|---------------------------|------------------|-----------|-------------|--------------|
| `eletronicos` | `smartphones` | Telefonia móvel inteligente | android, ios, acessórios mobile, proteção, carregadores, cabos | Comunicação pessoal |
| `eletronicos` | `informatica` | Computação pessoal | notebooks, desktops, tablets, periféricos, componentes, monitores | Produtividade |
| `eletronicos` | `tv-e-video` | Entretenimento doméstico | smart tvs, projetores, streaming devices, receptores, conversores | Entretenimento coletivo |
| `eletronicos` | `audio` | Reprodução sonora | fones de ouvido, caixas de som, soundbars, microfones, instrumentos musicais, turntables | Experiência sonora |

---

#### 7.1.7 `materiais-de-construcao` — 1 contexto implementado (`reforma-casa`), 6 N2 fixos (padrão **C**); `loja-material` planejável em RFC futura

| Contexto (`context_slug`) | N2 Ativos (slug) | Tipo de navegação | Definição | Exemplos N3 |
|---------------------------|------------------|-------------------|-----------|-------------|
| `reforma-casa` | `pisos-e-revestimentos` | Eixo técnico / projeto | Pisos, porcelanatos, azulejos, rodapés | ambientes internos e externos |
| `reforma-casa` | `tintas-e-acabamentos` | Eixo técnico / projeto | Tintas, massas, texturas, impermeabilizantes | acabamento de superfície |
| `reforma-casa` | `eletrica` | Eixo técnico / projeto | Material elétrico (não serviço) | fios, cabos, disjuntores, tomadas, interruptores |
| `reforma-casa` | `hidraulica` | Eixo técnico / projeto | Material hidráulico (não serviço) | tubos, conexões, registros, metais |
| `reforma-casa` | `ferramentas` | Eixo técnico / projeto | Ferramentas manuais e elétricas | furadeiras, serras, medidores |
| `reforma-casa` | `iluminacao` | Eixo técnico / projeto | Luminárias e componentes de iluminação | spots, pendentes, LED |

---

#### 7.1.8 `veiculos` — 1 contexto, 3 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Regulação/Uso |
|---------------------------|------------------|-----------|-------------|---------------|
| `veiculos` | `automoveis-de-passeio` | Veículos leves para transporte pessoal | hatch, sedan, suv, pickup, elétricos, híbridos, conversíveis | CNH B |
| `veiculos` | `motocicletas` | Veículos de duas rodas | scooters, street, trail, esportivas, elétricas, custom | CNH A |
| `veiculos` | `utilitarios-e-comerciais` | Veículos de trabalho | vans, caminhões leves, ônibus micro, furgões, ambulâncias | CNH C/D/E |

---

#### 7.1.9 `pecas-e-acessorios-automotivos` — 1 contexto, 3 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Sistema do veículo |
|---------------------------|------------------|-----------|-------------|------------------|
| `autopecas` | `pecas-mecanicas` | Componentes de propulsão e segurança | motor, transmissão, suspensão, freios, direção, injeção eletrônica, embreagem | Mecânica |
| `autopecas` | `pecas-de-carroceria` | Componentes externos estruturais | para-choques, portas, capôs, faróis, lanternas, retrovisores, grade | Estética/estrutura |
| `autopecas` | `acessorios-e-conforto` | Complementos de cabine e conveniência | som, gps, capas, organizadores, alarmes, insulfilm, protetor de cárter | Conforto/segurança |

---

#### 7.1.10 `equipamentos-esportivos` — 1 contexto, 3 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Modalidade |
|---------------------------|------------------|-----------|-------------|------------|
| `esportes` | `fitness-e-musculacao` | Equipamentos para exercício indoor | esteiras, pesos, elásticos, bancos, roda de abdominal, aparelhos de ginástica, kettlebells | Academia/casa |
| `esportes` | `esportes-de-quadra-e-campo` | Equipamentos para esportes coletivos | bolas, redes, raquetes, tacos, proteção, tênis de mesa, futebol, vôlei, basquete, tênis | Coletivos |
| `esportes` | `esportes-de-aventura-e-outdoor` | Equipamentos para atividades outdoor | camping, escalada, natação, corrida, surf, trilha, pesca, caiaque, arvorismo | Natureza/aventura |

**Bicicletas removidas:** Conflita com N0 `mobilidade-e-logistica`. Solução: facet `uso: transporte | lazer | esporte` em `veiculos` ou N0 futuro.

---

#### 7.1.11 `produtos-para-animais` — 1 contexto, 7 N2 fixos (padrão **C**)

| Contexto (`context_slug`) | N2 Ativos (slug) | Tipo de navegação | Definição | Exemplos N3 |
|---------------------------|------------------|-------------------|-----------|-------------|
| `varejo` | `racoes` | Gôndola | Alimentação principal | cães, gatos, aves, peixes, roedores, répteis |
| `varejo` | `petiscos` | Gôndola | Snacks e premiação | ossinhos, bifinhos, dental sticks |
| `varejo` | `higiene-e-cuidados` | Gôndola | Banho e grooming | shampoos pet, escovas, lenços |
| `varejo` | `acessorios` | Gôndola | Uso e passeio | coleiras, guias, comedouros, transportadoras |
| `varejo` | `camas-e-descanso` | Gôndola | Conforto | caminhas, casinhas, mantas |
| `varejo` | `brinquedos-e-lazer` | Gôndola | Enriquecimento | mordedores, bolinhas, arranhadores |
| `varejo` | `saude-e-bem-estar` | Gôndola | Cuidados leves (sem sintoma na TREE) | antiparasitários, suplementos; detalhe em facets / INTENT |

**Facets transversais:** `tipo-de-animal: caes | gatos | aves | roedores | peixes | repteis` (não substitui N2 de gôndola).

---

#### 7.1.12 `papelaria` — 1 contexto, 5 N2 fixos (padrão **C**)

| Contexto (`context_slug`) | N2 Ativos (slug) | Tipo de navegação | Definição | Exemplos N3 |
|---------------------------|------------------|-------------------|-----------|-------------|
| `varejo` | `material-escolar` | Gôndola | Voltado a ensino | cadernos, lápis, mochilas escolares |
| `varejo` | `material-de-escritorio` | Gôndola | Uso profissional / home office | pastas, clips, organizadores de mesa |
| `varejo` | `organizacao-e-planejamento` | Gôndola | Planejamento temporal e tarefas | agendas, planners, calendários |
| `varejo` | `artigos-de-escrita` | Gôndola | Instrumentos de escrita | canetas, marcadores, grafites |
| `varejo` | `papel-e-impressao` | Gôndola | Suporte e consumíveis | resmas, etiquetas, cartuchos (quando produto físico) |

**Facets transversais:** `tipo-de-uso: escolar | corporativo | artistico | presentes`, `formato`, `material` (complementam N2).

---

#### 7.1.13 `mobiliario-e-equipamentos-de-escritorio` — 1 contexto, 5 N2 fixos (padrão **C**)

| Contexto (`context_slug`) | N2 Ativos (slug) | Tipo de navegação | Definição | Exemplos N3 |
|---------------------------|------------------|-------------------|-----------|-------------|
| `varejo` | `mesas-e-estacoes-de-trabalho` | Mobiliário trabalho | Superfícies de trabalho | mesas, estações, bancadas |
| `varejo` | `cadeiras-e-assentos` | Mobiliário trabalho | Assentos ergonômicos e fixos | cadeiras presidente, operacionais, banquetas |
| `varejo` | `armazenamento-e-organizacao` | Mobiliário trabalho | Guarda e arquivo | armários, gaveteiros, estantes |
| `varejo` | `equipamentos-de-escritorio` | Mobiliário trabalho | Máquinas e aparelhos | impressoras, encadernadoras, destruidores de papel |
| `varejo` | `acessorios-ergonomicos` | Mobiliário trabalho | Complementos de posto | apoios, suportes para monitor, footrest |

**Nota:** distinto de `casa-e-decoracao` / contexto `casa` (residencial).

---

### 7.2 SERVIÇOS (`servicos`)

#### 7.2.1 `manutencao-e-reformas` — 2 contextos normativos; **snapshot implementado:** `reforma-casa` com 6 N2 (padrão **C**)

| Contexto (`context_slug`) | N2 Ativos (slug) | Tipo de navegação | Definição | Exemplos N3 | Complexidade |
|---------------------------|------------------|-------------------|-----------|-------------|--------------|
| `app-servicos` | `reformas-leves` | Tipo de serviço | Alterações estéticas sem estrutura | pintura, papel de parede, troca de pisos laminados, decoração, envelopamento | Baixa (sem alvará) |
| `app-servicos` | `instalacoes-e-reparos` | Tipo de serviço | Sistemas hidráulicos, elétricos e reparos | encanamento, fiação, reparos gerais, troca de tomadas, desentupimento, reparo de telhados | Média (técnico especializado) |
| `app-servicos` | `marcenaria-e-serralheria` | Tipo de serviço | Fabricação sob medida de móveis e estruturas | móveis planejados, armários, grades, portões, estruturas metálicas, solda | Alta (projeto customizado) |
| `reforma-casa` | `instalacao-eletrica` | Serviço de obra | Execução / projeto elétrico residencial | quadros, eletrodutos, lógica (≠ material `eletrica` em produtos) | Média |
| `reforma-casa` | `instalacao-hidraulica` | Serviço de obra | Execução hidráulica | redes, pressão, vazamentos (≠ material `hidraulica` em produtos) | Média |
| `reforma-casa` | `pintura` | Serviço de obra | Pintura de ambientes | interna, externa, textura | Baixa/média |
| `reforma-casa` | `reformas-gerais` | Serviço de obra | Reforma integrada / gerenciamento | demolição leve, coordenação | Alta |
| `reforma-casa` | `manutencao-residencial` | Serviço de obra | Manutenção corretiva/preventiva | vistoria, pequenas intervenções | Baixa |
| `reforma-casa` | `pequenos-reparos` | Serviço de obra | Reparos pontuais | troca de acabamento, ajustes | Baixa |

---

#### 7.2.2 `servicos-domesticos` — 1 contexto, 2 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Facets | Frequência |
|---------------------------|------------------|-----------|--------|------------|
| `app-servicos` | `limpeza-e-organizacao` | Higienização e arrumação de ambientes residenciais | `tipo-de-limpeza: pesada | manutencao | pos-obra`, `frequencia: unica | semanal | quinzenal | mensal`, `tamanho-do-imovel: pequeno | medio | grande` | Recorrente |
| `app-servicos` | `jardinagem-e-manutencao-externa` | Cuidados com áreas externas e piscinas | `tipo-de-servico: poda | paisagismo | piscina | limpeza-externa`, `sazonalidade: primavera | verao | outono | inverno` | Sazonal/recorrente |

**Removido:** `cuidados-e-bem-estar-domestico` → vira facet `tipo-de-cuidado: pessoa | animal | planta` em serviços relevantes.

---

#### 7.2.3 `consultoria-e-assessoria` — 1 contexto, 4 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Objeto da consultoria |
|---------------------------|------------------|-----------|-------------|----------------------|
| `consultoria` | `consultoria-juridica` | Assessoria de direito | civil, trabalhista, empresarial, tributário, consumidor, família, imobiliário, penal (preventivo) | Ramo do direito |
| `consultoria` | `consultoria-contabil-e-financeira` | Gestão de obrigações fiscais e patrimoniais | contabilidade, planejamento tributário, auditoria, CFO externo, recuperação de crédito, due diligence | Obrigação fiscal |
| `consultoria` | `consultoria-de-negocios` | Estratégia empresarial | planejamento estratégico, gestão, inovação, transformação digital, M&A, governança corporativa, compliance | Crescimento/eficiência |
| `consultoria` | `assessoria-pessoal` | Consultoria para desenvolvimento individual | coaching, planejamento de carreira, imagem pessoal, organização pessoal, oratória, liderança pessoal | Desenvolvimento pessoal |

---

#### 7.2.4 `servicos-tecnicos-especializados` — 1 contexto, 3 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Certificação específica |
|---------------------------|------------------|-----------|-------------|------------------------|
| `tecnicos` | `tecnicos-de-informatica` | Suporte e infraestrutura de TI | reparo de hardware, redes, segurança digital, cabeamento estruturado, configuração de servidores, backup | TI/Telecom |
| `tecnicos` | `tecnicos-de-climatizacao` | Instalação e manutenção de ar-condicionado e refrigeração | instalação, manutenção, limpeza, refrigeração comercial, câmaras frias, exaustão | Refrigeração |
| `tecnicos` | `eletricistas-e-mecanicos` | Sistemas eletromecânicos | instalações elétricas residenciais/comerciais, reparo de eletrodomésticos, motores, bombas, manutenção predial | Eletricista profissional |

---

#### 7.2.5 `estetica-e-cuidados-pessoais` — 2 contextos, 5 N2 fixos

| Contexto (`context_slug`) | N2 Ativos (slug) | Tipo de navegação | Definição | Exemplos N3 | Experiência do usuário |
|---------------------------|------------------|-------------------|-----------|-------------|------------------------|
| `salao` | `beleza-e-estetica` | Tipo de experiência | Transformação e manutenção de aparência | cabelereiro, manicure, pedicure, design de sobrancelha, depilação, maquiagem, penteado | Resultado visual imediato (olha no espelho) |
| `salao` | `bem-estar-corporal` | Tipo de experiência | Relaxamento e tratamento corporal | massagem relaxante, modeladora, drenagem, shiatsu, banho de lua, envolvimento | Sensação corporal (sente no corpo) |
| `spa` | `massagens` | Serviço específico | Técnicas de manipulação corporal | sueca, terapêutica, esportiva, ayurvedica, hot stone, aromaterapia | Intensidade e técnica |
| `spa` | `tratamentos-corporais` | Serviço específico | Cuidados estéticos do corpo | esfoliação, hidratação, modelagem, redução de medidas, celulite | Resultado progressivo |
| `spa` | `tratamentos-faciais` | Serviço específico | Cuidados estéticos do rosto | limpeza de pele, peeling, hidratação, rejuvenescimento, acne | Resultado facial |

---

#### 7.2.6 `treinamento-corporativo` — 1 contexto, 2 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Formato de entrega |
|---------------------------|------------------|-----------|-------------|-------------------|
| `corporativo` | `capacitacao-in-company` | Treinamentos realizados na empresa contratante | workshops, palestras, treinamentos técnicos, desenvolvimento de equipes, team building, gamificação | Presencial na empresa |
| `corporativo` | `consultoria-em-educacao-corporativa` | Desenho de programas e universidades corporativas | análise de necessidades, curadoria de conteúdo, LMS, métricas de aprendizagem, universidade corporativa, compliance training | Estratégia de capacitação |

---

#### 7.2.7 `capacitacao-e-treinamentos` — 2 contextos, 4 N2 fixos

| Contexto (`context_slug`) | N2 Ativos (slug) | Tipo de navegação | Definição | Exemplos N3 | Objetivo do aluno |
|---------------------------|------------------|-------------------|-----------|-------------|-------------------|
| `edtech` | `formacao-profissional` | Objetivo do aluno | Capacitação para mercado de trabalho | cursos técnicos, profissionalizantes, certificações, idiomas para carreira, programação, design, marketing digital | Empregabilidade/renda |
| `edtech` | `hobbies-e-lazer-educativo` | Objetivo do aluno | Aprendizado para satisfação pessoal | culinária, fotografia, artesanato, música, dança, jardinagem, pintura, escrita criativa | Autodesenvolvimento/lazer |
| `corporativo` | `treinamento-corporativo` | Link para N1 específico | — | — | Redireciona para N1 `treinamento-corporativo` |

---

#### 7.2.8 `producao-e-realizacao-de-eventos` — 1 contexto, 4 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Função no evento |
|---------------------------|------------------|-----------|-------------|------------------|
| `eventos` | `registro-e-memoria` | Captura de imagem e som | fotografia, filmagem, drone, transmissão ao vivo, edição, álbum digital, making of | Documentação |
| `eventos` | `gastronomia-e-buffet` | Alimentação e bebida do evento | buffet, coffee break, open bar, bolo decorado, menu personalizado, finger food, coquetel | Experiência gastronômica |
| `eventos` | `ambientacao-e-decoracao` | Cenografia e atmosfera do espaço | decoração, iluminação cênica, mobiliário, flores, cenografia, backdrops, balões | Atmosfera visual |
| `eventos` | `animacao-e-entretenimento` | Performance e engajamento do público | DJ, banda, mestre de cerimônias, atrações infantis, artistas circenses, mágicos, caricaturistas, fotocabine | Entretenimento |

---

#### 7.2.9 `servicos-de-tecnologia` — 1 contexto, 3 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Tipo de entrega |
|---------------------------|------------------|-----------|-------------|---------------|
| `tech` | `desenvolvimento-de-software` | Programação e engenharia de software | apps, sites, sistemas, integrações, APIs, manutenção evolutiva, legado, mobile, web, desktop | Produto digital customizado |
| `tech` | `design-e-experiencia-digital` | Criação visual e interativa | identidade visual, UI/UX, motion design, prototipagem, design system, ilustração, 3D | Ativo gráfico/interativo |
| `tech` | `infraestrutura-e-suporte-de-ti` | Operação e manutenção de sistemas | cloud, redes, segurança da informação, help desk, monitoramento, backup, disaster recovery | Serviço contínuo de operação |

---

#### 7.2.10 `marketing-e-comunicacao` — 1 contexto, 6 N2 fixos (padrão **C**)

| Contexto (`context_slug`) | N2 Ativos (slug) | Tipo de navegação | Definição | Exemplos N3 |
|---------------------------|------------------|-------------------|-----------|-------------|
| `app-servicos` | `gestao-de-redes-sociais` | Entrega de serviço | Operação de canais | calendário editorial, community, relatórios |
| `app-servicos` | `criacao-de-conteudo` | Entrega de serviço | Texto e mídia | copy, blog, roteiros |
| `app-servicos` | `design-grafico` | Entrega de serviço | Peças visuais estáticas | identidade aplicada, peças digitais/impressas |
| `app-servicos` | `trafego-pago-e-midia` | Entrega de serviço | Mídia performance | ads search/social, remarketing |
| `app-servicos` | `branding-e-identidade` | Entrega de serviço | Posicionamento e manual | naming, guia de marca |
| `app-servicos` | `producao-audiovisual` | Entrega de serviço | Vídeo e áudio | institucional, reels, podcasts |

**Nota:** distinto de `servicos-de-tecnologia` / `tech` (engenharia de produto digital vs. oferta de marketing).

---

### 7.3 FINANÇAS E ECONOMIA (`financas-e-economia`)

**Contexto único:** `mercado-financeiro` (estrutura do mercado é padronizada)

#### 7.3.1 `pagamentos-e-transferencias` — 3 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Velocidade |
|---------------------------|------------------|-----------|-------------|------------|
| `mercado-financeiro` | `transferencias-imediatas` | Movimentação instantânea de valor | PIX, TED, transferências internacionais rápidas (Wise, Remessa Online), QR Code | < 1 minuto a 24 horas |
| `mercado-financeiro` | `agendamentos-e-programacoes` | Pagamento futuro programado | agendamento de transferência, débito automático, boletos agendados, recorrência | Futuro programado |
| `mercado-financeiro` | `pagamentos-de-contas-e-obrigacoes` | Liquidação de obrigações diversas | água, luz, impostos, boletos, IPVA, taxas governamentais, condomínio, mensalidades | Variável (vencimento) |

---

#### 7.3.2 `creditos-e-emprestimos` — 4 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Garantia |
|---------------------------|------------------|-----------|-------------|----------|
| `mercado-financeiro` | `creditos-pessoais` | Empréstimo sem destinação específica | pessoal, consignado, cheque especial, crédito rotativo, empréstimo online | Renda/FGTS |
| `mercado-financeiro` | `financiamentos` | Crédito para aquisição de bem | veículo, imóvel, maquinário, serviço (cirurgia, viagem, casamento), mobiliário | Alienação fiduciária |
| `mercado-financeiro` | `antecipacao-e-desconto-de-recebiveis` | Venda de recebíveis futuros | factoring, antecipação de recebíveis, duplicata, cheque desconto, cartão de crédito (antecipação) | Recebível futuro |
| `mercado-financeiro` | `credito-para-negocios` | Capital para empresa | microcrédito, capital de giro, equipamentos, conta garantida, CDC empresarial, fomento | Patrimônio empresarial |

---

#### 7.3.3 `investimentos-renda-fixa` — 3 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Emissor |
|---------------------------|------------------|-----------|-------------|---------|
| `mercado-financeiro` | `titulos-publicos-federais` | Dívida soberana brasileira | Tesouro Selic, Tesouro IPCA+, Tesouro Prefixado, Tesouro Educa+, Tesouro RendA+ | Governo federal |
| `mercado-financeiro` | `titulos-bancarios` | Dívida de instituições financeiras | CDB, LCI, LCA, LC, LF, depósito a prazo | Bancos/IFs |
| `mercado-financeiro` | `titulos-corporativos` | Dívida de empresas não-financeiras | Debêntures, CRI, CRA, Commercial Paper, notas promissórias | Empresas |

---

#### 7.3.4 `investimentos-renda-variavel` — 4 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Mercado |
|---------------------------|------------------|-----------|-------------|---------|
| `mercado-financeiro` | `acoes-e-bdrs` | Participação societária em empresas | Ações brasileiras (ON/PN), BDRs, Units, ETFs de ações, REITs internacionais | Bolsa (B3) |
| `mercado-financeiro` | `fundos-de-investimento` | Cotas de carteiras administradas | Fundos de ações, multimercado, cambial, imobiliário (FII), previdência, índice, ESG | Administrado por gestor |
| `mercado-financeiro` | `commodities-e-derivativos` | Contratos de commodities e futuros | Ouro, petróleo, agrícolas, mini contratos futuros (índice, dólar), opções | Commodities/derivativos |
| `mercado-financeiro` | `criptomoedas-e-ativos-digitais` | Ativos descentralizados e tokens | Bitcoin, Ethereum, tokens utility/security, NFTs, DeFi, staking | Cripto (regulado/emergente) |

---

#### 7.3.5 `seguros-e-previdencia` — 4 N2

| Contexto (`context_slug`) | N2 Ativos (slug) | Definição | Exemplos N3 | Risco coberto |
|---------------------------|------------------|-----------|-------------|---------------|
| `mercado-financeiro` | `seguros-de-vida-e-acidentes-pessoais` | Proteção contra invalidez e morte | Vida individual, vida em grupo, acidentes pessoais, doenças graves, invalidez | Vida/capacidade de trabalho |
| `mercado-financeiro` | `seguros-patrimoniais` | Proteção de bens materiais | Residencial (incêndio, roubo), veicular, empresarial, responsabilidade civil, equipamentos, carga | Dano ao patrimônio |
| `mercado-financeiro` | `seguros-de-saude-e-odonto` | Proteção de saúde (financeira) | Planos de saúde, odontológicos, seguros saúde (não plano), reembolso médico | Custo médico (produto financeiro, não serviço de saúde) |
| `mercado-financeiro` | `previdencia-privada` | Aposentadoria complementar | PGBL, VGBL, previdência aberta (FAPI), previdência fechada (entidade de classe), vida toda | Longevidade/renda futura |

**Nota:** `seguros-de-saude` é **produto financeiro** (contrato de seguro), não confunde com N0 `saude-e-bem-estar` (serviço de saúde). Dimensão `regulatorio: SUSEP` vs. `ANS`.

---

## 8. RESUMO ESTRUTURAL

| Domínio | N1 | N2 Total | Contextos | N1 sem N2 |
|---------|-----|----------|-----------|-----------|
| `produtos-e-comercio` | 13 | 63 | 10 | 0 |
| `servicos` | 10 | 44 | 6 | 0 |
| `financas-e-economia` | 7 | 18 | 1 | 0 |
| **TOTAL** | **30** | **125** | **17** | **0** |

---

## 9. MATRIZ DE VALIDAÇÃO

### 9.1 Anti-conflito N2 × N0

| N2 (slug) | N0 potencial | Resolução |
|-----------|--------------|-----------|
| `seguros-de-saude-e-odonto` | `saude-e-bem-estar` | Produto **financeiro** (contrato de seguro), não serviço de saúde. Dimensão `regulatorio: SUSEP` vs. `ANS`. |
| `acougue` | — | Departamento real do varejo, não confunde com N0. |
| `smartphones` | — | Produto, não serviço de telecom (que é infraestrutura). |
| `bicicletas` (removido) | `mobilidade-e-logistica` | Intencionalmente removido para evitar conflito. |

### 9.2 Anti-conflito N2 × N1

| N2 (slug) | N1 pai | Validação |
|-----------|--------|-----------|
| `formacao-profissional` | `capacitacao-e-treinamentos` | ≠ `treinamento-corporativo` (B2C individual vs. B2B organizacional) |
| `beleza-e-estetica` | `estetica-e-cuidados-pessoais` | ≠ `bem-estar-corporal` (resultado visual vs. sensação corporal) |
| `treinamento-corporativo` (em `capacitacao-e-treinamentos`) | `capacitacao-e-treinamentos` | Link para N1 específico, não duplicação |

### 9.3 Ortogonalidade interna (mesmo N1)

| Par N2 (slug) | Divisão de fronteira |
|---------------|----------------------|
| `cervejas` / `vinhos` / `destilados` vs `nao-alcoolicas` | Tipologia alcoólica granular vs opções sem álcool (varejo e bar alinhados; `drinks` só bar) |
| `formacao-profissional` vs `hobbies-e-lazer-educativo` | Intenção do aluno (emprego vs. satisfação pessoal) |
| `beleza-e-estetica` vs `bem-estar-corporal` | Experiência do usuário (ver no espelho vs. sentir no corpo) |
| `transferencias-imediatas` vs `agendamentos` | Tempo de liquidação |
| `acougue` vs `hortifruti` | Origem do produto (animal vs. vegetal) |
| `cozinha` (reforma) vs `cozinha` (delivery) | Contexto diferente (obra vs. refeição) |

---

## 10. ESPECIFICAÇÃO TÉCNICA

### 10.1 Schema SQL (corrigido v4.0.0)

```sql
-- ============================================================
-- LAYER 2: TREE (N2_nodes) — Estrutura canônica da navegação
-- CORREÇÃO v4.0.0: N2 usa slug, NÃO canonical_id
-- CORREÇÃO v4.0.0: N2 NÃO é SSOT — é estrutura de navegação
-- ============================================================
CREATE TABLE n2_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) NOT NULL,  -- identificador de navegação apenas
    n1_id UUID NOT NULL REFERENCES n1_nodes(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT n2_unique_per_n1 UNIQUE (slug, n1_id)
);

-- ============================================================
-- LAYER 3: CONTEXT — Identidade formal governada
-- CORREÇÃO v4.0.0: CONTEXT NÃO é string livre
-- CORREÇÃO v4.0.0: Deve estar registrado em context_nodes
-- ============================================================
CREATE TABLE context_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_slug VARCHAR(64) NOT NULL UNIQUE,  -- identificador canônico governado
    -- OPTIONAL: restrição de domínio para escopo operacional
    -- NÃO define pertencimento ontológico
    -- CONTEXT NÃO pertence a N0
    domain_key TEXT REFERENCES domains(domain_key),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT context_slug_unique UNIQUE (context_slug)
);

-- Nomes localizados para CONTEXT (UI)
CREATE TABLE context_localized_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID NOT NULL REFERENCES context_nodes(id) ON DELETE CASCADE,
    locale VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    value VARCHAR(128) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    
    CONSTRAINT context_locale_priority_unique UNIQUE (context_id, locale, priority)
);

-- ============================================================
-- MAPEAMENTO: CONTEXT ↔ N2 (ativação)
-- CORREÇÃO v4.0.0: FK para context_nodes (não string livre)
-- ============================================================
CREATE TABLE context_n2_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID NOT NULL REFERENCES context_nodes(id) ON DELETE CASCADE,  -- FK governada
    n2_id UUID NOT NULL REFERENCES n2_nodes(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT false, -- N2 padrão para esse contexto
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT unique_context_n2 UNIQUE (context_id, n2_id)
);

-- Nomes localizados para N2 (UI)
CREATE TABLE n2_localized_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    n2_id UUID NOT NULL REFERENCES n2_nodes(id) ON DELETE CASCADE,
    locale VARCHAR(10) NOT NULL DEFAULT 'pt-BR',
    value VARCHAR(128) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    
    CONSTRAINT n2_locale_priority_unique UNIQUE (n2_id, locale, priority)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_n2_n1 ON n2_nodes(n1_id);
CREATE INDEX idx_n2_active ON n2_nodes(is_active);
CREATE INDEX idx_n2_slug ON n2_nodes(slug);
CREATE INDEX idx_context_nodes_slug ON context_nodes(context_slug);
CREATE INDEX idx_context_mapping_context ON context_n2_mapping(context_id);
CREATE INDEX idx_context_mapping_n2 ON context_n2_mapping(n2_id);
```

### 10.2 Interface TypeScript (corrigida v4.0.0)

```typescript
// ============================================================
// LAYER 2: TREE — N2 (estrutura canônica, NÃO SSOT; canônico ≠ SSOT; apenas padrão estrutural)
// ============================================================
interface N2Node {
  id: string;                    // UUID
  slug: string;                  // identificador de navegação (ex: "acougue")
  // CORREÇÃO v4.0.0: NÃO possui canonical_id (reservado para CONCEPT)
  // CORREÇÃO v4.0.0: NÃO é SSOT semântico
  n1_id: string;                 // FK para N1
  display_names: LocalizedName[];
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================================
// LAYER 3: CONTEXT — Identidade formal governada
// ============================================================
interface ContextNode {
  id: string;                    // UUID
  context_slug: string;          // identificador canônico governado (ex: "supermercado")
  // CORREÇÃO v4.0.0: NÃO possui canonical_id (reservado para CONCEPT)
  // OPTIONAL: restrição de domínio para escopo operacional — NÃO define pertencimento ontológico; CONTEXT NÃO pertence a N0
  domain_key?: string;           // FK opcional para domains (N0); TEXT REFERENCES domains(domain_key)
  display_names: LocalizedName[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface LocalizedName {
  locale: string;               // "pt-BR", "en-US"
  value: string;                // "Açougue"
  priority: number;             // 1 = primário
  context?: string;             // "formal", "colloquial"
}

// ============================================================
// QUERIES E RESPONSES
// ============================================================
interface N2Query {
  n1_id: string;
  context_slug: string;         // 'supermercado', 'delivery', 'farmacia', etc. (governado)
  locale?: string;              // 'pt-BR', 'en-US'
}

interface N2Response {
  n2_nodes: N2Node[];
  context_applied: string;      // context_slug governado
  total_count: number;
}

// ============================================================
// REGRAS DE VALIDAÇÃO CONSTITUCIONAIS
// ============================================================
const N2_VALIDATION_RULES = {
  // N2 — estrutura canônica (canônico ≠ SSOT; apenas padrão estrutural)
  dominant_pillar_n2: "PILAR DOMINANTE DO N2: NOMENCLATURA",
  uniqueness: "slug deve ser único dentro do N1",
  no_canonical_id: "N2 NÃO usa canonical_id (reservado para CONCEPT)",
  no_semantic_identity: "N2 é estrutura pura, sem identidade semântica",
  not_ssot: "N2 NÃO é SSOT — SSOT é CONCEPT",
  
  // Anti-conflito
  no_n0_overlap: "N2.slug NÃO pode igualar qualquer N0.slug",
  no_n1_overlap: "N2.slug NÃO pode igualar outro N1.slug",
  no_context_overlap: "N2.slug NÃO pode igualar context_slug",
  
  // Qualidade
  orthogonality: "N2 dentro do mesmo N1 não pode ter sobreposição semântica",
  context_filter: "N2 é fixo; contexto explicitamente aplicado determina qual subconjunto é exibido",
  max_depth: "N3 só por RFC excepcional",
  stability: "N2 só altera via RFC formal",
  tree_independence: "TREE não depende de CONTEXT",
  
  // CONTEXT — identidade formal governada
  context_governed: "context_slug DEVE existir em context_nodes",
  context_no_free_string: "PROIBIDO uso de string livre para contexto",
  context_no_canonical_id: "CONTEXT NÃO usa canonical_id",
  context_governance_only: "Criação/alteração de CONTEXT: decisão §4.10; execução via governance-service",
  context_mapping_no_business_logic: "context_n2_mapping não governa comportamento; apenas ativação de navegação (anti-SSOT indireto)",
  no_implicit_tree_expansion: "CONTEXT não gera TREE implícita nem N2 dinâmico fora de n2_nodes governado",
  immutable_tree_ids: "slug/n1_id (n2), context_slug (context_nodes), chaves de junção (mapping) imutáveis conforme §11.8",
  causal_exclusion: "N2 e CONTEXT fora da cadeia Mutação → Estado → Dinheiro → Evento (§2.1)"
};
```

### 10.3 API (corrigida v4.0.0)

```typescript
// GET /api/v1/tree/n2?n1=alimentacao&context=delivery&locale=pt-BR
// CORREÇÃO v4.0.0: 'context' deve ser context_slug governado (validado contra context_nodes)

// Response
{
  "n1": "alimentacao",
  "context_applied": "delivery",  // context_slug governado
  "total_count": 6,
  "n2_nodes": [
    { 
      "id": "uuid-1",
      "slug": "japonesa",  // slug de navegação, NÃO canonical_id
      "display_names": [{ "locale": "pt-BR", "value": "Japonesa", "priority": 1 }],
      "sort_order": 1 
    },
    { 
      "id": "uuid-2",
      "slug": "pizza", 
      "display_names": [{ "locale": "pt-BR", "value": "Pizza", "priority": 1 }],
      "sort_order": 2 
    }
    // ... demais N2 ativos para o contexto
  ]
}
```

### 10.4 Seeder SQL (corrigido v4.0.0)

```sql
-- ============================================================
-- 1. REGISTRAR CONTEXTOS (governança obrigatória)
-- CORREÇÃO v4.0.0: CONTEXT deve existir em context_nodes antes de uso
-- ============================================================
INSERT INTO context_nodes (context_slug, domain_key) VALUES
('supermercado', NULL),
('delivery', NULL),
('nutricao', NULL),
('varejo', NULL),
('bar', NULL),
('perfumaria', NULL),
('farmacia', NULL),
('moda', NULL),
('casa', NULL),
('eletronicos', NULL),
('loja-material', NULL),
('reforma-casa', NULL),
('veiculos', NULL),
('autopecas', NULL),
('esportes', NULL),
('app-servicos', NULL),
('consultoria', NULL),
('tecnicos', NULL),
('salao', NULL),
('spa', NULL),
('corporativo', NULL),
('edtech', NULL),
('eventos', NULL),
('tech', NULL),
('mercado-financeiro', NULL);

-- ============================================================
-- 2. PRODUTOS: alimentacao — N2 para supermercado
-- ============================================================
INSERT INTO n2_nodes (slug, n1_id, sort_order) VALUES
('acougue', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 1),
('hortifruti', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 2),
('laticinios-e-frios', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 3),
('mercearia', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 4),
('padaria-e-confeitaria', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 5),
('congelados-e-resfriados', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 6);

-- Mapeamento: supermercado
INSERT INTO context_n2_mapping (context_id, n2_id, is_default, sort_order)
SELECT 
  (SELECT id FROM context_nodes WHERE context_slug = 'supermercado'),
  id, 
  true, 
  sort_order 
FROM n2_nodes 
WHERE n1_id = (SELECT id FROM n1_nodes WHERE slug = 'alimentacao');

-- ============================================================
-- 3. PRODUTOS: alimentacao — N2 adicionais para delivery
-- ============================================================
INSERT INTO n2_nodes (slug, n1_id, sort_order) VALUES
('japonesa', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 1),
('pizza', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 2),
('hamburguer', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 3),
('brasileira', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 4),
('saudavel', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 5),
('doces-e-sobremesas', (SELECT id FROM n1_nodes WHERE slug = 'alimentacao'), 6);

-- Mapeamento: delivery
INSERT INTO context_n2_mapping (context_id, n2_id, is_default, sort_order)
SELECT 
  (SELECT id FROM context_nodes WHERE context_slug = 'delivery'),
  id, 
  true, 
  sort_order 
FROM n2_nodes 
WHERE n1_id = (SELECT id FROM n1_nodes WHERE slug = 'alimentacao')
AND slug IN ('japonesa', 'pizza', 'hamburguer', 'brasileira', 'saudavel', 'doces-e-sobremesas');
```

---

## 11. GOVERNANÇA

### 11.1 Critério de criação de N2

```
PERGUNTAS DE VALIDAÇÃO:

1. É departamento real no varejo físico? [ ]
2. Ou: separa experiência de navegação distinta? [ ]
3. Ou: resolve problema/sintoma específico? [ ]
4. N1 tem >50 CONCEPTs ou diversidade justifica? [ ]
5. Estável por 24+ meses? [ ]
6. Não pode ser resolvido por facet? [ ]
7. NÃO representa entidade semântica? [ ]
8. NÃO carrega identidade de negócio? [ ]

→ 5+ SIM: N2 aprovado
→ 4 ou menos: usar facet
```

### 11.2 Critério de criação de CONTEXT — **CORREÇÃO v4.0.0**

```
PERGUNTAS DE VALIDAÇÃO:

1. Existe UX real diferente? [ ]
2. Mesmo N1 precisa de N2 diferentes? [ ]
3. Contexto é estável (não moda passageira)? [ ]
4. NÃO cria estrutura nova? [ ]
5. Apenas ativa subconjunto existente? [ ]

→ 4+ SIM: Contexto aprovado para RFC
→ Aprovação final: RFC + validação ontológica + arquitetura (ver §4.10); **governance-service** apenas executa
```

**⚠️ ALERTA:** CONTEXT só pode ser criado conforme **§4.10**; materialização técnica via **governance-service**. Uso direto em código/API/UI é **PROIBIDO**.

### 11.3 Alterações permitidas

| Tipo | Requer | Prazo |
|------|--------|-------|
| Bug (typo) | PR + arquitetura | Imediato |
| Locale | PR + review | 1 semana |
| Reordenação | PR | Imediato |
| Novo N2 | RFC + critério de existência | RFC cycle |
| Novo contexto | RFC + critério de contexto + governance-service | RFC cycle |
| Remoção | RFC formal | RFC cycle |

### 11.4 Limite de profundidade

```
N0 → N1 → N2 → [N3 excepcional por RFC]
Máximo: 4 níveis
Padrão: 3 níveis
```

### 11.5 Limitações globais (constitucionais) — **CORREÇÃO v4.0.0**

| Elemento | NÃO PODE |
|----------|----------|
| **N2** | Criar CONCEPT, carregar semântica, representar entidades reais, usar canonical_id, ser SSOT |
| **CONTEXT** | Criar N2, alterar N2, criar CONCEPT, se tornar SSOT paralelo, redefinir ontologia, ser string livre, gerar TREE implícita, usar `context_n2_mapping` como regra de negócio |

### 11.6 ENFORCEMENT

- Qualquer uso de CONTEXT fora de `context_nodes` é inválido
- Qualquer uso de string livre para contexto é inválido
- Qualquer inferência automática baseada em CONTEXT é inválida
- Violação implica quebra constitucional do sistema

### 11.7 Enforcement Estrutural (Banco de Dados)

As seguintes tabelas devem possuir enforcement **executável** no PostgreSQL (não apenas intenção normativa):

- `n2_nodes`
- `context_nodes`
- `context_n2_mapping`

**Contrato obrigatório (espelhar `concepts` / `concept_relations`):**

| Artefato | Especificação |
|----------|----------------|
| Função | `enforce_n2_tree_governance()` (nome fixado na migração), `RETURNS TRIGGER`, `LANGUAGE plpgsql`, `SET search_path = public` |
| Gatilho | `BEFORE INSERT OR UPDATE` em cada tabela acima, `FOR EACH ROW` |
| Condição de bloqueio | `current_setting('app.n2_governance', true) IS DISTINCT FROM 'true'` |
| Erro | `RAISE EXCEPTION` com mensagem explícita (ex.: operação bloqueada — usar governance autorizado), `USING ERRCODE = 'check_violation'` |
| Sessão | `set_config('app.n2_governance', 'true', true)` na transação autorizada (equivalente ao padrão `app.concept_governance` / `app.graph_governance`) |

Regras adicionais:

- INSERT/UPDATE somente com flag ativa na transação
- Escrita direta fora de governance-service: **PROIBIDA**
- Violação: operação **falha no banco** (não apenas log ou aviso)

Referência de implementação:

- `concepts` + `enforce_concept_governance`
- `concept_relations` + `enforce_concept_relation_governance`

### 11.8 Imutabilidade de identificadores críticos (TREE)

Alteração de identificadores estáveis quebra referências de navegação, cache e integrações. **Sem RFC formal + processo governado**, é **proibido** `UPDATE` que altere:

| Tabela | Campo(s) | Regra |
|--------|-----------|--------|
| `n2_nodes` | `slug`, `n1_id` | Imutáveis após criação (correção só via RFC + transação com flag §11.7 e rastreabilidade) |
| `context_nodes` | `context_slug`, `domain_key` (se preenchido) | `context_slug` imutável após criação; `domain_key` só por processo governado |
| `context_n2_mapping` | `context_id`, `n2_id` | Chaves de junção imutáveis; `sort_order` / `is_default` podem ajustar ordenação **sem** trocar identidade de contexto ou N2 |

**PROIBIDO:** `UPDATE n2_nodes SET slug = ...` ad hoc (quebra navegação e mapeamentos).

---

## 12. CONSISTÊNCIA COM ONTOLOGIA

### 12.1 Fluxo obrigatório

```
CONCEPT → TREE → CONTEXT → INTENT → ATTRIBUTES → GRAPH
```

### 12.2 Garantias arquiteturais

| Camada | Garantia |
|--------|----------|
| CONCEPT | Semântica isolada (SSOT absoluto) |
| TREE | Navegação isolada (estrutura canônica — *canônico ≠ SSOT; apenas padrão estrutural*) |
| CONTEXT | Aplicação isolada (identidade formal governada) |

---

## 13. CHECKLIST DE CONGELAMENTO — **CORRIGIDO v4.0.4**

- [x] Total N2: 101 (45 + 38 + 18)
- [x] Total contextos: 17 (todos registrados em `context_nodes`)
- [x] N2 fixo (estrutura canônica — *canônico ≠ SSOT; apenas padrão estrutural*), contexto como filtro
- [x] Múltiplos contextos por N1 onde necessário
- [x] N1 inalterado
- [x] Modelo simplificado (sem `navigation_type` explícito)
- [x] **Correção v4.0.0:** N2 usa `slug`, NÃO `canonical_id`
- [x] **Correção v4.0.0:** N2 é estrutura pura, sem identidade semântica, NÃO é SSOT
- [x] **Correção v4.0.0:** CONTEXT tem identidade formal governada (`context_slug` em `context_nodes`)
- [x] **Correção v4.0.0:** CONTEXT NÃO pode ser string livre (proibido uso direto em código/API/UI)
- [x] **Correção v4.0.0:** Governança de CONTEXT apenas via `governance-service`
- [x] **Correção v4.0.0:** Nomenclatura consistente (`context_slug`, não `context_id`)
- [x] **Correção v4.0.0:** Schema SQL completo com `context_nodes` (tabela obrigatória)
- [x] **Correção v4.0.0:** Interface TypeScript com `ContextNode` e validações
- [x] **Correção v4.0.0:** API valida `context_slug` contra `context_nodes`
- [x] **Correção v4.0.0:** Seeder SQL registra contextos antes de uso
- [x] Matriz de validação completa (anti-conflito N0, N1, interna)
- [x] Governança completa (critérios de criação de N2 e contexto)
- [x] Regras de validação em código
- [x] Frase canônica documentada
- [x] **Correção v4.0.1:** blindagem semântica CONTEXT (§4); ENFORCEMENT (§11.6); comentários `domain_id` em `context_nodes`; *canônico ≠ SSOT* onde estrutura canônica; §1.1 terminologia; proibições de uso de N2 para inferência/classificação/substituição de CONCEPT (§3.2)
- [x] **Correção v4.0.2:** SSOT N0 `domains(domain_key)`; §4.10 autoridade CONTEXT; semântica indireta via N2 (§3.2); CONTEXT explícito (§2, §6); §11.7 enforcement estrutural; linguagem "contexto explicitamente definido"
- [x] **Correção v4.0.3:** §3.1.1 pilar dominante N2 (NOMENCLATURA); §5.4–5.5 anti-SSOT `context_n2_mapping` + não expansão implícita da TREE; §11.7 contrato executável (função/trigger/erro); §11.8 imutabilidade de identificadores críticos
- [x] **Correção v4.0.4:** §2.1 precedência causal — N2 e CONTEXT fora da cadeia Mutação → Estado → Dinheiro → Evento

---

## 14. HISTÓRICO DE VERSÕES

| Versão | Mudanças | Data |
|--------|----------|------|
| 0.1.0 | Proposta inicial (produto-cêntrica) | 2026-03-23 |
| 0.2.0 | Auditoria ChatGPT (identificação de problemas) | 2026-03-23 |
| 1.0.0 | Correções estruturais aplicadas | 2026-03-23 |
| 1.1.0 | Versão completa (não contextual) | 2026-03-23 |
| 2.0.0 | Modelo contextual (simplificado) | 2026-03-23 |
| 2.1.0-FINAL | Versão completa com modelo contextual | 2026-03-23 |
| 3.0.0-FINAL | Correções arquiteturais constitucionais (N2 sem canonical_id) | 2026-03-23 |
| **4.0.0-FINAL** | **Blindagem completa do CONTEXT (identidade formal governada)** | **2026-03-23** |
| **4.0.1-FINAL** | **Blindagem semântica CONTEXT; ENFORCEMENT; domain_id comentado; canônico ≠ SSOT; terminologia** | **2026-03-23** |
| **4.0.2-FINAL** | **FK N0 → `domains(domain_key)`; §4.10 autoridade CONTEXT; anti-semântica N2; CONTEXT sem inferência; §11.7 enforcement BD; precisão linguagem** | **2026-03-23** |
| **4.0.3-FINAL** | **§3.1.1 pilar N2 NOMENCLATURA; §5.4–5.5 mapping ≠ comportamento; TREE sem expansão implícita; §11.7 contrato executável PL/pgSQL; §11.8 imutabilidade crítica** | **2026-03-23** |
| **4.0.4-FINAL** | **§2.1 precedência causal: N2 e CONTEXT excluídos da cadeia Mutação → Estado → Dinheiro → Evento** | **2026-03-23** |

**Mudanças principais v4.0.0:**
- **CRÍTICO:** CONTEXT agora possui identidade formal governada em `context_nodes`
- **CRÍTICO:** `context_id` (string livre) → `context_slug` (identificador canônico governado)
- **CRÍTICO:** PROIBIDO uso de string livre para contexto em código/API/UI
- **CRÍTICO:** Criação/alteração de CONTEXT apenas via `governance-service`
- **CRÍTICO:** N2 NÃO é SSOT (semântica isolada em CONCEPT)
- Adicionado: Tabela `context_nodes` obrigatória no schema SQL
- Adicionado: Interface `ContextNode` no TypeScript
- Adicionado: Validação de `context_slug` contra `context_nodes` na API
- Atualizado: Seeder SQL registra contextos antes de qualquer uso
- Atualizado: Toda nomenclatura de contexto para `context_slug`

**Mudanças principais v4.0.2:**
- **CRÍTICO:** FK opcional N0 em `context_nodes`: `domain_key TEXT REFERENCES domains(domain_key)` (SSOT N0; proibido `n0_nodes`)
- **CRÍTICO:** §4.10 autoridade de CONTEXT (RFC + ontologia + arquitetura; governance-service só executa)
- **CRÍTICO:** §3.2 bloqueio de semântica indireta via N2; §2 e §6 CONTEXT explícito (sem inferência automática)
- **CRÍTICO:** §11.7 enforcement estrutural no BD (`n2_nodes`, `context_nodes`, `context_n2_mapping`; padrão `concepts` / `concept_relations`)

**Mudanças principais v4.0.3:**
- **CRÍTICO:** §3.1.1 pilar dominante N2 = **NOMENCLATURA** (proibição de outros pilares como base de decisão)
- **CRÍTICO:** §5.4 `context_n2_mapping` não governa comportamento; apenas ativação de navegação (anti-SSOT indireto)
- **CRÍTICO:** §5.5 CONTEXT não gera estrutura implícita / N2 dinâmico fora de `n2_nodes` governado
- **CRÍTICO:** §11.7 contrato executável: função + trigger + `RAISE EXCEPTION` / `check_violation` (espelho `concepts` / `concept_relations`)
- **CRÍTICO:** §11.8 imutabilidade de `slug`, `n1_id`, `context_slug` e chaves de junção em `context_n2_mapping`

**Mudanças principais v4.0.4:**
- **CRÍTICO:** §2.1 precedência causal — N2 e CONTEXT **não** entram na cadeia Mutação → Estado → Dinheiro → Evento; proibido usar navegação como gatilho substituto de regras canônicas dessa cadeia

---

## 15. ASSINATURA DIGITAL

```
Documento: N2_NAVIGATION_STRUCTURE_UNIFICARD
Versão: 4.0.4-FINAL
Status: CONGELADO — BLINDADO CONSTITUCIONALMENTE
Base: N1 v1.0.0-FINAL

Total: 30 N1 → 101 N2 → 17 contextos (todos governados)
Profundidade: N2 (N3 excepcional por RFC)

Aprovado por:
- Arquitetura UnifiCard
- Auditoria: ChatGPT (identificação de problemas)
- Modelo contextual: Kimi
- Correções constitucionais: Clayton
- Blindagem CONTEXT v4.0.0: Kimi
- Consolidação final: Kimi v4.0.0

Próximo passo: Implementação em tree-navigation-service + governance-service
```

---

**FIM DO DOCUMENTO**

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->