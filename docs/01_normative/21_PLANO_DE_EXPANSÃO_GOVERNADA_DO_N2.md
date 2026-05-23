# PLANO DE EXPANSÃO GOVERNADA DO N2

**Documento de Snapshot e Proposta — Versão v3.0.1**  
**Data:** 2026-03-23  
**Status:** APROVADO PARA EXECUÇÃO GOVERNADA  
**Base:** N2_NAVIGATION_STRUCTURE_UNIFICARD v4.0.4-FINAL  

---

## 1. PRINCÍPIO GOVERNADO

```text
N2 = conjunto evolutivo governado
NÃO há catálogo arbitrariamente congelado
NÃO há contagem global fixa como fonte de verdade
Há: snapshot validado atual (não fechado) + expansão governada + evolução sob RFC
```

---

## 2. SEPARAÇÃO ONTOLÓGICA OBRIGATÓRIA

| Camada | Papel | O que NÃO é |
|--------|--------|-------------|
| **N2** (LAYER 2 — TREE) | Navegação possível; nomenclatura de caminho | Semântica, negócio, decisão de fluxo financeiro |
| **CONTEXT** (LAYER 3) | Ativação de subconjunto da TREE (`context_slug` governado em `context_nodes`) | SSOT, inferência, criação de estrutura |
| **INTENT** (LAYER 4) | Comportamento / intenção do usuário no fluxo (quando modelado) | Substituto de CONCEPT ou de N2 |
| **ATTRIBUTES / facets** | Complemento não substitutivo | Classificação ontológica primária |

```text
N2 → navegação (TREE)
CONTEXT → ativação (LAYER 3)
INTENT → comportamento (LAYER 4), quando aplicável
```

**Decisão explícita — `nutricao`:** não é `context_slug` estrutural. Momentos/refeições/finalidades (ex.: café da manhã, refeição rápida) pertencem a **INTENT** e/ou **facets**, não a um CONTEXT dedicado. Ver §6 e YAML.

---

## 3. EXECUÇÃO OBRIGATÓRIA

```text
Este plano NÃO pode ser executado via SQL direto.

Fluxo obrigatório:

YAML → governance-service → database

Qualquer tentativa de inserção direta será bloqueada pelos triggers de governança (0080).
```

Escrita em `n2_nodes`, `context_nodes`, `context_n2_mapping`, `n2_localized_names` e `context_localized_names` exige `app.n2_governance = true` na transação autorizada, conforme `backend/src/core/navigation/n2-governance.service.ts` e migrações **0079** + **0080**.

---

## 4. ALINHAMENTO COM IMPLEMENTAÇÃO (BANCO)

| Artefato normativo | Tabela / colunas (PostgreSQL) |
|--------------------|-------------------------------|
| N2 | `n2_nodes` (`n2_id`, `slug`, `n1_id`, `sort_order`, `is_active`, …) |
| CONTEXT | `context_nodes` (`context_id`, `context_slug`, `domain_key` opcional, …) |
| Ativação | `context_n2_mapping` (`context_id`, `n2_id`, `is_default`, `sort_order`) |
| Nomes N2 | `n2_localized_names` (`n2_id`, `locale`, `value`, `priority`) |
| Nomes CONTEXT | `context_localized_names` (`context_id`, `locale`, `value`, `priority`) |

**Migrações:** `0079_n2_navigation.sql` (estrutura + seed parcial); `0080_n2_governance_hardening.sql` (mensagem, DELETE, imutabilidade em UPDATE).

---

## 5. SNAPSHOT ATUAL DE N2 (por N1)

> Fonte de referência para expansão governada: **snapshot validado atual (não fechado)** — sem totalização global.

**Mapeamento de padrões N2 (ativação por contexto):**

| Padrão | Definição |
|--------|-----------|
| **A** | Conjuntos N2 **disjuntos** por `context_slug` (sem o mesmo `slug` ativo em dois contextos do mesmo N1). Usar **somente** quando os contextos forem **incompatíveis** na leitura do utilizador. |
| **B** | **Mesmo núcleo** de slugs N2 em mais de um contexto, com extensões ou ordem distintas por contexto. |
| **C** | **Um** `context_slug` ativa a lista N2 do N1 (lista própria àquele contexto; sem modelo paralelo por canal). |

| N1 | Padrão |
|----|--------|
| `alimentacao` | **A** |
| `bebidas` | **B** |
| `higiene-e-beleza` | **A** |
| `materiais-de-construcao` | **C** |
| `manutencao-e-reformas` | **C** |
| `produtos-para-animais` | **C** |
| `papelaria` | **C** |
| `mobiliario-e-equipamentos-de-escritorio` | **C** |
| `marketing-e-comunicacao` | **C** |

### 5.1 PRODUTOS E COMÉRCIO

| N1 | N2 (slug) | Contexto | Status | Validação Estrutural |
|----|-----------|----------|--------|----------------------|
| `alimentacao` | `acougue` | `supermercado` | ✅ válido | Departamento real |
| `alimentacao` | `hortifruti` | `supermercado` | ✅ válido | Departamento real |
| `alimentacao` | `laticinios-e-frios` | `supermercado` | ✅ válido | Departamento real |
| `alimentacao` | `mercearia` | `supermercado` | ✅ válido | Departamento real |
| `alimentacao` | `padaria-e-confeitaria` | `supermercado` | ✅ válido | Departamento real |
| `alimentacao` | `congelados-e-resfriados` | `supermercado` | ✅ válido | Departamento real |
| `alimentacao` | `japonesa` | `delivery` | ✅ válido | Tipo culinária |
| `alimentacao` | `pizza` | `delivery` | ✅ válido | Tipo culinária |
| `alimentacao` | `hamburguer` | `delivery` | ✅ válido | Tipo culinária |
| `alimentacao` | `brasileira` | `delivery` | ✅ válido | Tipo culinária |
| `alimentacao` | `saudavel` | `delivery` | ✅ válido | Tipo culinária |
| `alimentacao` | `doces-e-sobremesas` | `delivery` | ✅ válido | Tipo culinária |
| `alimentacao` | `cafe-da-manha` | — | ✅ válido (não via CONTEXT) | Ativação: **INTENT** / facet (momento); **não** usar `context_slug` = `nutricao` |
| `alimentacao` | `almoco-rapido` | — | ✅ válido (não via CONTEXT) | Ativação: **INTENT** / facet (velocidade) |
| `alimentacao` | `jantar-familia` | — | ✅ válido (não via CONTEXT) | Ativação: **INTENT** / facet (social) |
| `alimentacao` | `lanche-treino` | — | ✅ válido (não via CONTEXT) | Ativação: **INTENT** / facet (finalidade) |
| `alimentacao` | `dieta-especial` | — | ✅ válido (não via CONTEXT) | Ativação: **INTENT** / facet (restrição) |
| `bebidas` | `cervejas` | `varejo` | ✅ válido | Tipologia bebida |
| `bebidas` | `vinhos` | `varejo` | ✅ válido | Tipologia bebida |
| `bebidas` | `destilados` | `varejo` | ✅ válido | Tipologia bebida |
| `bebidas` | `nao-alcoolicas` | `varejo` | ✅ válido | Sem álcool |
| `bebidas` | `cervejas` | `bar` | ✅ válido | Experiência consumo |
| `bebidas` | `vinhos` | `bar` | ✅ válido | Experiência consumo |
| `bebidas` | `destilados` | `bar` | ✅ válido | Experiência consumo |
| `bebidas` | `drinks` | `bar` | ✅ válido | Experiência consumo |
| `bebidas` | `nao-alcoolicas` | `bar` | ✅ válido | Experiência consumo |
| `higiene-e-beleza` | `cuidados-com-cabelo` | `perfumaria` | ✅ válido | Consumo — capilar |
| `higiene-e-beleza` | `cuidados-com-a-pele` | `perfumaria` | ✅ válido | Consumo — dermocosmética / skincare |
| `higiene-e-beleza` | `higiene-pessoal` | `perfumaria` | ✅ válido | Consumo — higiene diária |
| `higiene-e-beleza` | `maquiagem` | `perfumaria` | ✅ válido | Consumo — coloração |
| `higiene-e-beleza` | `perfumaria` | `perfumaria` | ✅ válido | Consumo — fragrância |
| `higiene-e-beleza` | `medicamentos` | `farmacia` | ✅ válido | Necessidade — OTC / referência (navegação por categoria, não sintoma) |
| `higiene-e-beleza` | `vitaminas-e-suplementos` | `farmacia` | ✅ válido | Necessidade — suplementação |
| `higiene-e-beleza` | `cuidados-pessoais` | `farmacia` | ✅ válido | Necessidade — HPC farmácia (≠ `perfumaria` consumo) |
| `higiene-e-beleza` | `primeiros-socorros` | `farmacia` | ✅ válido | Necessidade — kit / emergência leve |
| `vestuario-e-acessorios` | `moda-feminina` | `moda` | ✅ válido | Público-alvo |
| `vestuario-e-acessorios` | `moda-masculina` | `moda` | ✅ válido | Público-alvo |
| `vestuario-e-acessorios` | `infantil-e-bebe` | `moda` | ✅ válido | Faixa etária |
| `produtos-para-animais` | `racoes` | `varejo` | ✅ válido | Gôndola alimentar |
| `produtos-para-animais` | `petiscos` | `varejo` | ✅ válido | Snacks / premiação |
| `produtos-para-animais` | `higiene-e-cuidados` | `varejo` | ✅ válido | Banho / grooming |
| `produtos-para-animais` | `acessorios` | `varejo` | ✅ válido | Passeio / uso diário |
| `produtos-para-animais` | `camas-e-descanso` | `varejo` | ✅ válido | Conforto |
| `produtos-para-animais` | `brinquedos-e-lazer` | `varejo` | ✅ válido | Enriquecimento |
| `produtos-para-animais` | `saude-e-bem-estar` | `varejo` | ✅ válido | Antiparasitários / suplementos (sem sintoma na TREE) |
| `casa-e-decoracao` | `moveis` | `casa` | ✅ válido | Função |
| `casa-e-decoracao` | `decoracao` | `casa` | ✅ válido | Função |
| `casa-e-decoracao` | `cama-mesa-e-banho` | `casa` | ✅ válido | Função |
| `casa-e-decoracao` | `utilidades-domesticas` | `casa` | ✅ válido | Função |
| `eletroeletronicos` | `smartphones` | `eletronicos` | ✅ válido | Uso primário |
| `eletroeletronicos` | `informatica` | `eletronicos` | ✅ válido | Uso primário |
| `eletroeletronicos` | `tv-e-video` | `eletronicos` | ✅ válido | Uso primário |
| `eletroeletronicos` | `audio` | `eletronicos` | ✅ válido | Uso primário |
| `materiais-de-construcao` | `pisos-e-revestimentos` | `reforma-casa` | ✅ válido | Projeto reforma (material) |
| `materiais-de-construcao` | `tintas-e-acabamentos` | `reforma-casa` | ✅ válido | Projeto reforma (material) |
| `materiais-de-construcao` | `eletrica` | `reforma-casa` | ✅ válido | Projeto reforma (material) |
| `materiais-de-construcao` | `hidraulica` | `reforma-casa` | ✅ válido | Projeto reforma (material) |
| `materiais-de-construcao` | `ferramentas` | `reforma-casa` | ✅ válido | Projeto reforma (material) |
| `materiais-de-construcao` | `iluminacao` | `reforma-casa` | ✅ válido | Projeto reforma (material) |
| `veiculos` | `automoveis-de-passeio` | `veiculos` | ✅ válido | Regulação |
| `veiculos` | `motocicletas` | `veiculos` | ✅ válido | Regulação |
| `veiculos` | `utilitarios-e-comerciais` | `veiculos` | ✅ válido | Regulação |
| `pecas-e-acessorios-automotivos` | `pecas-mecanicas` | `autopecas` | ✅ válido | Sistema veículo |
| `pecas-e-acessorios-automotivos` | `pecas-de-carroceria` | `autopecas` | ✅ válido | Sistema veículo |
| `pecas-e-acessorios-automotivos` | `acessorios-e-conforto` | `autopecas` | ✅ válido | Sistema veículo |
| `equipamentos-esportivos` | `fitness-e-musculacao` | `esportes` | ✅ válido | Modalidade |
| `equipamentos-esportivos` | `esportes-de-quadra-e-campo` | `esportes` | ✅ válido | Modalidade |
| `equipamentos-esportivos` | `esportes-de-aventura-e-outdoor` | `esportes` | ✅ válido | Modalidade |
| `papelaria` | `material-escolar` | `varejo` | ✅ válido | Gôndola papelaria |
| `papelaria` | `material-de-escritorio` | `varejo` | ✅ válido | Gôndola papelaria |
| `papelaria` | `organizacao-e-planejamento` | `varejo` | ✅ válido | Gôndola papelaria |
| `papelaria` | `artigos-de-escrita` | `varejo` | ✅ válido | Gôndola papelaria |
| `papelaria` | `papel-e-impressao` | `varejo` | ✅ válido | Gôndola papelaria |
| `mobiliario-e-equipamentos-de-escritorio` | `mesas-e-estacoes-de-trabalho` | `varejo` | ✅ válido | Mobiliário trabalho |
| `mobiliario-e-equipamentos-de-escritorio` | `cadeiras-e-assentos` | `varejo` | ✅ válido | Mobiliário trabalho |
| `mobiliario-e-equipamentos-de-escritorio` | `armazenamento-e-organizacao` | `varejo` | ✅ válido | Mobiliário trabalho |
| `mobiliario-e-equipamentos-de-escritorio` | `equipamentos-de-escritorio` | `varejo` | ✅ válido | Mobiliário trabalho |
| `mobiliario-e-equipamentos-de-escritorio` | `acessorios-ergonomicos` | `varejo` | ✅ válido | Mobiliário trabalho |

### 5.2 SERVIÇOS

| N1 | N2 (slug) | Contexto | Status | Validação Estrutural |
|----|-----------|----------|--------|----------------------|
| `manutencao-e-reformas` | `reformas-leves` | `app-servicos` | ✅ válido | Tipo serviço |
| `manutencao-e-reformas` | `instalacoes-e-reparos` | `app-servicos` | ✅ válido | Tipo serviço |
| `manutencao-e-reformas` | `marcenaria-e-serralheria` | `app-servicos` | ✅ válido | Tipo serviço |
| `manutencao-e-reformas` | `instalacao-eletrica` | `reforma-casa` | ✅ válido | Serviço de obra (distinto de N2 material `eletrica`) |
| `manutencao-e-reformas` | `instalacao-hidraulica` | `reforma-casa` | ✅ válido | Serviço de obra (distinto de N2 material `hidraulica`) |
| `manutencao-e-reformas` | `pintura` | `reforma-casa` | ✅ válido | Serviço de obra |
| `manutencao-e-reformas` | `reformas-gerais` | `reforma-casa` | ✅ válido | Serviço de obra |
| `manutencao-e-reformas` | `manutencao-residencial` | `reforma-casa` | ✅ válido | Serviço de obra |
| `manutencao-e-reformas` | `pequenos-reparos` | `reforma-casa` | ✅ válido | Serviço de obra |
| `servicos-domesticos` | `limpeza-e-organizacao` | `app-servicos` | ✅ válido | Tipo serviço |
| `servicos-domesticos` | `jardinagem-e-manutencao-externa` | `app-servicos` | ✅ válido | Tipo serviço |
| `consultoria-e-assessoria` | `consultoria-juridica` | `consultoria` | ✅ válido | Ramo direito |
| `consultoria-e-assessoria` | `consultoria-contabil-e-financeira` | `consultoria` | ✅ válido | Ramo contábil |
| `consultoria-e-assessoria` | `consultoria-de-negocios` | `consultoria` | ✅ válido | Ramo negócios |
| `consultoria-e-assessoria` | `assessoria-pessoal` | `consultoria` | ✅ válido | Ramo pessoal |
| `servicos-tecnicos-especializados` | `tecnicos-de-informatica` | `tecnicos` | ✅ válido | Certificação |
| `servicos-tecnicos-especializados` | `tecnicos-de-climatizacao` | `tecnicos` | ✅ válido | Certificação |
| `servicos-tecnicos-especializados` | `eletricistas-e-mecanicos` | `tecnicos` | ✅ válido | Certificação |
| `estetica-e-cuidados-pessoais` | `beleza-e-estetica` | `salao` | ✅ válido | Experiência |
| `estetica-e-cuidados-pessoais` | `bem-estar-corporal` | `salao` | ✅ válido | Experiência |
| `estetica-e-cuidados-pessoais` | `massagens` | `spa` | ✅ válido | Serviço específico |
| `estetica-e-cuidados-pessoais` | `tratamentos-corporais` | `spa` | ✅ válido | Serviço específico |
| `estetica-e-cuidados-pessoais` | `tratamentos-faciais` | `spa` | ✅ válido | Serviço específico |
| `treinamento-corporativo` | `capacitacao-in-company` | `corporativo` | ✅ válido | Formato |
| `treinamento-corporativo` | `consultoria-em-educacao-corporativa` | `corporativo` | ✅ válido | Formato |
| `capacitacao-e-treinamentos` | `formacao-profissional` | `edtech` | ✅ válido | Objetivo aluno |
| `capacitacao-e-treinamentos` | `hobbies-e-lazer-educativo` | `edtech` | ✅ válido | Objetivo aluno |
| `producao-e-realizacao-de-eventos` | `registro-e-memoria` | `eventos` | ✅ válido | Função evento |
| `producao-e-realizacao-de-eventos` | `gastronomia-e-buffet` | `eventos` | ✅ válido | Função evento |
| `producao-e-realizacao-de-eventos` | `ambientacao-e-decoracao` | `eventos` | ✅ válido | Função evento |
| `producao-e-realizacao-de-eventos` | `animacao-e-entretenimento` | `eventos` | ✅ válido | Função evento |
| `servicos-de-tecnologia` | `desenvolvimento-de-software` | `tech` | ✅ válido | Tipo entrega |
| `servicos-de-tecnologia` | `design-e-experiencia-digital` | `tech` | ✅ válido | Tipo entrega |
| `servicos-de-tecnologia` | `infraestrutura-e-suporte-de-ti` | `tech` | ✅ válido | Tipo entrega |
| `marketing-e-comunicacao` | `gestao-de-redes-sociais` | `app-servicos` | ✅ válido | Entrega marketing |
| `marketing-e-comunicacao` | `criacao-de-conteudo` | `app-servicos` | ✅ válido | Entrega marketing |
| `marketing-e-comunicacao` | `design-grafico` | `app-servicos` | ✅ válido | Entrega marketing |
| `marketing-e-comunicacao` | `trafego-pago-e-midia` | `app-servicos` | ✅ válido | Entrega marketing |
| `marketing-e-comunicacao` | `branding-e-identidade` | `app-servicos` | ✅ válido | Entrega marketing |
| `marketing-e-comunicacao` | `producao-audiovisual` | `app-servicos` | ✅ válido | Entrega marketing |

### 5.3 FINANÇAS E ECONOMIA

| N1 | N2 (slug) | Contexto | Status | Validação Estrutural |
|----|-----------|----------|--------|----------------------|
| `pagamentos-e-transferencias` | `transferencias-imediatas` | `mercado-financeiro` | ✅ válido | Velocidade |
| `pagamentos-e-transferencias` | `agendamentos-e-programacoes` | `mercado-financeiro` | ✅ válido | Velocidade |
| `pagamentos-e-transferencias` | `pagamentos-de-contas-e-obrigacoes` | `mercado-financeiro` | ✅ válido | Velocidade |
| `creditos-e-emprestimos` | `creditos-pessoais` | `mercado-financeiro` | ✅ válido | Garantia |
| `creditos-e-emprestimos` | `financiamentos` | `mercado-financeiro` | ✅ válido | Garantia |
| `creditos-e-emprestimos` | `antecipacao-e-desconto-de-recebiveis` | `mercado-financeiro` | ✅ válido | Garantia |
| `creditos-e-emprestimos` | `credito-para-negocios` | `mercado-financeiro` | ✅ válido | Garantia |
| `investimentos-renda-fixa` | `titulos-publicos-federais` | `mercado-financeiro` | ✅ válido | Emissor |
| `investimentos-renda-fixa` | `titulos-bancarios` | `mercado-financeiro` | ✅ válido | Emissor |
| `investimentos-renda-fixa` | `titulos-corporativos` | `mercado-financeiro` | ✅ válido | Emissor |
| `investimentos-renda-variavel` | `acoes-e-bdrs` | `mercado-financeiro` | ✅ válido | Mercado |
| `investimentos-renda-variavel` | `fundos-de-investimento` | `mercado-financeiro` | ✅ válido | Mercado |
| `investimentos-renda-variavel` | `commodities-e-derivativos` | `mercado-financeiro` | ✅ válido | Mercado |
| `investimentos-renda-variavel` | `criptomoedas-e-ativos-digitais` | `mercado-financeiro` | ✅ válido | Mercado |
| `seguros-e-previdencia` | `seguros-de-vida-e-acidentes-pessoais` | `mercado-financeiro` | ✅ válido | Risco |
| `seguros-e-previdencia` | `seguros-patrimoniais` | `mercado-financeiro` | ✅ válido | Risco |
| `seguros-e-previdencia` | `seguros-de-saude-e-odonto` | `mercado-financeiro` | ✅ válido | Risco |
| `seguros-e-previdencia` | `previdencia-privada` | `mercado-financeiro` | ✅ válido | Risco |

---

## 6. SNAPSHOT DE CONTEXTOS

### 6.1 Tipologia (core vs especifico)

**Regra:** `core` = amplitude transversal no domínio indicado; `especifico` = escopo mais restrito (vertical ou experiência). Não há sobreposição semântica não explicada: cada `context_slug` tem um papel único na tabela.

**Removido do conjunto de CONTEXT:** `nutricao` — não é contexto estrutural; momentos e hábitos alimentares tratam-se em **INTENT** / **facets** (ver §2).

| Contexto (`context_slug`) | Tipo | Domínio(s) aplicável | Descrição |
|---------------------------|------|------------------------|-----------|
| `supermercado` | core | produtos-e-comercio | Varejo alimentar físico |
| `delivery` | core | produtos-e-comercio | Entrega de refeições |
| `varejo` | core | produtos-e-comercio | Varejo geral não-alimentar |
| `bar` | especifico | produtos-e-comercio | Experiência de consumo (bebidas) |
| `perfumaria` | especifico | produtos-e-comercio | Varejo H&B |
| `farmacia` | especifico | produtos-e-comercio | Varejo farmacêutico |
| `moda` | especifico | produtos-e-comercio | Varejo vestuário |
| `casa` | core | produtos-e-comercio | Decoração / mobília |
| `eletronicos` | core | produtos-e-comercio | Varejo eletrônicos |
| `loja-material` | especifico | produtos-e-comercio | Varejo materiais de construção |
| `reforma-casa` | core | produtos-e-comercio, servicos | Projeto de reforma (cross-domain) |
| `veiculos` | core | produtos-e-comercio | Veículos |
| `autopecas` | especifico | produtos-e-comercio | Peças e acessórios |
| `esportes` | core | produtos-e-comercio | Varejo esportivo |
| `app-servicos` | core | servicos | Contratação de serviços |
| `consultoria` | especifico | servicos | Consultoria |
| `tecnicos` | especifico | servicos | Serviços técnicos |
| `salao` | especifico | servicos | Salão |
| `spa` | especifico | servicos | Spa |
| `corporativo` | core | servicos | Corporativo |
| `edtech` | especifico | servicos | Educação tecnológica |
| `eventos` | core | servicos | Produção de eventos |
| `tech` | especifico | servicos | Tecnologia |
| `mercado-financeiro` | core | financas-e-economia | Operações financeiras |

**Contagem:** não constitui fonte de verdade — usar sempre **snapshot validado atual (não fechado)** neste documento e no repositório.

---

## 7. RESOLUÇÃO DE CONFLITOS

### 7.1 Slugs ambíguos entre N1 (resolvidos)

| Slug | N1 (1) | N1 (2) | Contexto | Resolução |
|------|--------|--------|----------|-----------|
| `cozinha` | `materiais-de-construcao` | `manutencao-e-reformas` | `reforma-casa` | Resolvido: slugs por técnica/serviço (`pisos-e-revestimentos`, `instalacao-eletrica`, …) — sem colisão nominal |
| `banheiro` | `materiais-de-construcao` | `manutencao-e-reformas` | `reforma-casa` | Idem |
| `quarto` | `materiais-de-construcao` | `manutencao-e-reformas` | `reforma-casa` | Idem |
| `sala` | `materiais-de-construcao` | `manutencao-e-reformas` | `reforma-casa` | Idem |
| `area-externa` | `materiais-de-construcao` | `manutencao-e-reformas` | `reforma-casa` | Idem |

**Estado:** slugs canônicos à esquerda na tabela §5.1 / §5.2; **nenhum** `slug` duplicado no mesmo `n1_id`; entre N1 distintos, material (`eletrica`, `hidraulica`, …) vs serviço (`instalacao-eletrica`, `instalacao-hidraulica`, …) elimina ambiguidade cross-domain.

### 7.2 N2 tratados via INTENT / facet (não como CONTEXT)

| N2 Original | Motivo | Reclassificação |
|-------------|--------|-----------------|
| `cafe-da-manha` | Momento/comportamento | `INTENT: momento=manha` + facet |
| `almoco-rapido` | Velocidade/comportamento | `INTENT: velocidade=rapido` + facet |
| `jantar-familia` | Social/comportamento | `INTENT: ocasiao=familia` + facet |
| `lanche-treino` | Finalidade/comportamento | `INTENT: finalidade=pre-treino` + facet |
| `dieta-especial` | Restrição/comportamento | `INTENT: restricao=especial` + facet |

---

## 8. YAML GOVERNADO (INPUT PARA GOVERNANCE-SERVICE)

```yaml
# GOVERNED INPUT — requires governance-service
# DO NOT execute directly
#
# n2_snapshot_2026-03-23.yaml — snapshot validado atual (não fechado)
# Input para governance-service apenas; bloqueado por triggers 0079/0080 se executado fora do serviço.

metadata:
  version: "3.0.1"
  date: "2026-03-23"
  type: "snapshot-validado"
  note: "Conjunto evolutivo, sujeito a RFCs futuras"
  
governance:
  approved_by: null  # preencher após review
  rfc_reference: null  # preencher se originado de RFC
  
contexts:
  # CORE — amplos, cross-domain
  - slug: supermercado
    type: core
    domains: [produtos-e-comercio]
    
  - slug: delivery
    type: core
    domains: [produtos-e-comercio]
    
  - slug: varejo
    type: core
    domains: [produtos-e-comercio]
    
  - slug: casa
    type: core
    domains: [produtos-e-comercio]
    
  - slug: eletronicos
    type: core
    domains: [produtos-e-comercio]
    
  - slug: reforma-casa
    type: core
    domains: [produtos-e-comercio, servicos]
    note: "Cross-domain: produtos e serviços"
    
  - slug: veiculos
    type: core
    domains: [produtos-e-comercio]
    
  - slug: esportes
    type: core
    domains: [produtos-e-comercio]
    
  - slug: app-servicos
    type: core
    domains: [servicos]
    
  - slug: corporativo
    type: core
    domains: [servicos]
    
  - slug: eventos
    type: core
    domains: [servicos]
    
  - slug: mercado-financeiro
    type: core
    domains: [financas-e-economia]
    
  # ESPECÍFICOS — domínio restrito
  - slug: bar
    type: especifico
    domains: [produtos-e-comercio]
    
  - slug: perfumaria
    type: especifico
    domains: [produtos-e-comercio]
    
  - slug: farmacia
    type: especifico
    domains: [produtos-e-comercio]
    
  - slug: moda
    type: especifico
    domains: [produtos-e-comercio]
    
  - slug: loja-material
    type: especifico
    domains: [produtos-e-comercio]
    
  - slug: autopecas
    type: especifico
    domains: [produtos-e-comercio]
    
  - slug: consultoria
    type: especifico
    domains: [servicos]
    
  - slug: tecnicos
    type: especifico
    domains: [servicos]
    
  - slug: salao
    type: especifico
    domains: [servicos]
    
  - slug: spa
    type: especifico
    domains: [servicos]
    
  - slug: edtech
    type: especifico
    domains: [servicos]
    
  - slug: tech
    type: especifico
    domains: [servicos]

n2_nodes:
  # PRODUTOS E COMÉRCIO — alimentacao
  - slug: acougue
    n1: alimentacao
    contexts: [supermercado]
    sort_order: 1
    
  - slug: hortifruti
    n1: alimentacao
    contexts: [supermercado]
    sort_order: 2
    
  - slug: laticinios-e-frios
    n1: alimentacao
    contexts: [supermercado]
    sort_order: 3
    
  - slug: mercearia
    n1: alimentacao
    contexts: [supermercado]
    sort_order: 4
    
  - slug: padaria-e-confeitaria
    n1: alimentacao
    contexts: [supermercado]
    sort_order: 5
    
  - slug: congelados-e-resfriados
    n1: alimentacao
    contexts: [supermercado]
    sort_order: 6
    
  - slug: japonesa
    n1: alimentacao
    contexts: [delivery]
    sort_order: 1
    
  - slug: pizza
    n1: alimentacao
    contexts: [delivery]
    sort_order: 2
    
  - slug: hamburguer
    n1: alimentacao
    contexts: [delivery]
    sort_order: 3
    
  - slug: brasileira
    n1: alimentacao
    contexts: [delivery]
    sort_order: 4
    
  - slug: saudavel
    n1: alimentacao
    contexts: [delivery]
    sort_order: 5
    
  - slug: doces-e-sobremesas
    n1: alimentacao
    contexts: [delivery]
    sort_order: 6
    
  # Alimentação — momentos/hábitos: N2 na TREE; sem `context_slug` dedicado (nutricao não é CONTEXT)
  - slug: cafe-da-manha
    n1: alimentacao
    contexts: []
    sort_order: 1
    note: "Ativação via INTENT/facet; não mapear a context_slug nutricao"
  - slug: almoco-rapido
    n1: alimentacao
    contexts: []
    sort_order: 2
    note: "Ativação via INTENT/facet"
  - slug: jantar-familia
    n1: alimentacao
    contexts: []
    sort_order: 3
    note: "Ativação via INTENT/facet"
  - slug: lanche-treino
    n1: alimentacao
    contexts: []
    sort_order: 4
    note: "Ativação via INTENT/facet"
  - slug: dieta-especial
    n1: alimentacao
    contexts: []
    sort_order: 5
    note: "Ativação via INTENT/facet"

  # PRODUTOS E COMÉRCIO — bebidas (padrão B)
  - slug: cervejas
    n1: bebidas
    contexts: [varejo, bar]
    sort_order: 1
    
  - slug: vinhos
    n1: bebidas
    contexts: [varejo, bar]
    sort_order: 2
    
  - slug: destilados
    n1: bebidas
    contexts: [varejo, bar]
    sort_order: 3
    
  - slug: drinks
    n1: bebidas
    contexts: [bar]
    sort_order: 4
    
  - slug: nao-alcoolicas
    n1: bebidas
    contexts: [varejo, bar]
    sort_order: 5
    
  # PRODUTOS E COMÉRCIO — higiene-e-beleza (padrão A: perfumaria consumo vs farmacia necessidade)
  - slug: cuidados-com-cabelo
    n1: higiene-e-beleza
    contexts: [perfumaria]
    sort_order: 1
    
  - slug: cuidados-com-a-pele
    n1: higiene-e-beleza
    contexts: [perfumaria]
    sort_order: 2
    
  - slug: higiene-pessoal
    n1: higiene-e-beleza
    contexts: [perfumaria]
    sort_order: 3
    
  - slug: maquiagem
    n1: higiene-e-beleza
    contexts: [perfumaria]
    sort_order: 4
    
  - slug: perfumaria
    n1: higiene-e-beleza
    contexts: [perfumaria]
    sort_order: 5
    
  - slug: medicamentos
    n1: higiene-e-beleza
    contexts: [farmacia]
    sort_order: 6
    
  - slug: vitaminas-e-suplementos
    n1: higiene-e-beleza
    contexts: [farmacia]
    sort_order: 7
    
  - slug: cuidados-pessoais
    n1: higiene-e-beleza
    contexts: [farmacia]
    sort_order: 8
    
  - slug: primeiros-socorros
    n1: higiene-e-beleza
    contexts: [farmacia]
    sort_order: 9
    
  # PRODUTOS E COMÉRCIO — produtos-para-animais (padrão C)
  - slug: racoes
    n1: produtos-para-animais
    contexts: [varejo]
    sort_order: 1
    
  - slug: petiscos
    n1: produtos-para-animais
    contexts: [varejo]
    sort_order: 2
    
  - slug: higiene-e-cuidados
    n1: produtos-para-animais
    contexts: [varejo]
    sort_order: 3
    
  - slug: acessorios
    n1: produtos-para-animais
    contexts: [varejo]
    sort_order: 4
    
  - slug: camas-e-descanso
    n1: produtos-para-animais
    contexts: [varejo]
    sort_order: 5
    
  - slug: brinquedos-e-lazer
    n1: produtos-para-animais
    contexts: [varejo]
    sort_order: 6
    
  - slug: saude-e-bem-estar
    n1: produtos-para-animais
    contexts: [varejo]
    sort_order: 7
    
  # PRODUTOS E COMÉRCIO — papelaria (padrão C)
  - slug: material-escolar
    n1: papelaria
    contexts: [varejo]
    sort_order: 1
    
  - slug: material-de-escritorio
    n1: papelaria
    contexts: [varejo]
    sort_order: 2
    
  - slug: organizacao-e-planejamento
    n1: papelaria
    contexts: [varejo]
    sort_order: 3
    
  - slug: artigos-de-escrita
    n1: papelaria
    contexts: [varejo]
    sort_order: 4
    
  - slug: papel-e-impressao
    n1: papelaria
    contexts: [varejo]
    sort_order: 5
    
  # PRODUTOS E COMÉRCIO — mobiliario-e-equipamentos-de-escritorio (padrão C)
  - slug: mesas-e-estacoes-de-trabalho
    n1: mobiliario-e-equipamentos-de-escritorio
    contexts: [varejo]
    sort_order: 1
    
  - slug: cadeiras-e-assentos
    n1: mobiliario-e-equipamentos-de-escritorio
    contexts: [varejo]
    sort_order: 2
    
  - slug: armazenamento-e-organizacao
    n1: mobiliario-e-equipamentos-de-escritorio
    contexts: [varejo]
    sort_order: 3
    
  - slug: equipamentos-de-escritorio
    n1: mobiliario-e-equipamentos-de-escritorio
    contexts: [varejo]
    sort_order: 4
    
  - slug: acessorios-ergonomicos
    n1: mobiliario-e-equipamentos-de-escritorio
    contexts: [varejo]
    sort_order: 5
    
  # Demais N2: replicar estrutura conforme §5.1–§5.3 (snapshot validado atual, não fechado).

  # Conflito slug reforma (resolvido — padrão C):
  - slug: pisos-e-revestimentos
    n1: materiais-de-construcao
    contexts: [reforma-casa]
    sort_order: 1
    
  - slug: tintas-e-acabamentos
    n1: materiais-de-construcao
    contexts: [reforma-casa]
    sort_order: 2
    
  - slug: eletrica
    n1: materiais-de-construcao
    contexts: [reforma-casa]
    sort_order: 3
    
  - slug: hidraulica
    n1: materiais-de-construcao
    contexts: [reforma-casa]
    sort_order: 4
    
  - slug: ferramentas
    n1: materiais-de-construcao
    contexts: [reforma-casa]
    sort_order: 5
    
  - slug: iluminacao
    n1: materiais-de-construcao
    contexts: [reforma-casa]
    sort_order: 6
    
  - slug: instalacao-eletrica
    n1: manutencao-e-reformas
    contexts: [reforma-casa]
    sort_order: 1
    
  - slug: instalacao-hidraulica
    n1: manutencao-e-reformas
    contexts: [reforma-casa]
    sort_order: 2
    
  - slug: pintura
    n1: manutencao-e-reformas
    contexts: [reforma-casa]
    sort_order: 3
    
  - slug: reformas-gerais
    n1: manutencao-e-reformas
    contexts: [reforma-casa]
    sort_order: 4
    
  - slug: manutencao-residencial
    n1: manutencao-e-reformas
    contexts: [reforma-casa]
    sort_order: 5
    
  - slug: pequenos-reparos
    n1: manutencao-e-reformas
    contexts: [reforma-casa]
    sort_order: 6
    
  # SERVIÇOS — marketing-e-comunicacao (padrão C)
  - slug: gestao-de-redes-sociais
    n1: marketing-e-comunicacao
    contexts: [app-servicos]
    sort_order: 1
    
  - slug: criacao-de-conteudo
    n1: marketing-e-comunicacao
    contexts: [app-servicos]
    sort_order: 2
    
  - slug: design-grafico
    n1: marketing-e-comunicacao
    contexts: [app-servicos]
    sort_order: 3
    
  - slug: trafego-pago-e-midia
    n1: marketing-e-comunicacao
    contexts: [app-servicos]
    sort_order: 4
    
  - slug: branding-e-identidade
    n1: marketing-e-comunicacao
    contexts: [app-servicos]
    sort_order: 5
    
  - slug: producao-audiovisual
    n1: marketing-e-comunicacao
    contexts: [app-servicos]
    sort_order: 6

localized_names:
  - slug: acougue
    locale: pt-BR
    value: "Açougue"
    
  - slug: pisos-e-revestimentos
    locale: pt-BR
    value: "Pisos e revestimentos"
    
  - slug: instalacao-eletrica
    locale: pt-BR
    value: "Instalação elétrica"
    
  - slug: cuidados-com-a-pele
    locale: pt-BR
    value: "Cuidados com a pele"
    
  - slug: higiene-pessoal
    locale: pt-BR
    value: "Higiene pessoal"
    
  - slug: medicamentos
    locale: pt-BR
    value: "Medicamentos"
    
  - slug: racoes
    locale: pt-BR
    value: "Rações"
    
  - slug: saude-e-bem-estar
    locale: pt-BR
    value: "Saúde e bem-estar"
    
  - slug: material-escolar
    locale: pt-BR
    value: "Material escolar"
    
  - slug: mesas-e-estacoes-de-trabalho
    locale: pt-BR
    value: "Mesas e estações de trabalho"
    
  - slug: gestao-de-redes-sociais
    locale: pt-BR
    value: "Gestão de redes sociais"
  # Demais localized_names: alinhar a cada n2_id em expansão governada.
```

---

## 9. RELATÓRIO DE CORREÇÕES

### 9.1 N2 com ativação por INTENT / facet (não por CONTEXT `nutricao`)

| Item | Motivo | Destino |
|------|--------|---------|
| `cafe-da-manha` | Comportamento momentâneo | LAYER 4 (INTENT) |
| `almoco-rapido` | Comportamento velocidade | LAYER 4 (INTENT) |
| `jantar-familia` | Comportamento social | LAYER 4 (INTENT) |
| `lanche-treino` | Comportamento finalidade | LAYER 4 (INTENT) |
| `dieta-especial` | Comportamento restrição | LAYER 4 (INTENT) |

### 9.2 Renomeados (resolução de conflito de slug entre N1)

| Original | Novo | N1 | Motivo |
|----------|------|-----|--------|
| `cozinha` | `pisos-e-revestimentos`, `tintas-e-acabamentos`, … | `materiais-de-construcao` | Eixo por técnica/projeto (padrão **C**); sem colisão com serviço |
| `cozinha` | `instalacao-eletrica`, `pintura`, … | `manutencao-e-reformas` | Eixo por tipo de serviço de obra (padrão **C**); sem colisão com produtos |
| `banheiro` | (mesma lógica de slugs distintos material vs serviço) | ambos | Conflito resolvido por nomenclatura não espelhada |
| `quarto` | (idem) | ambos | Idem |
| `sala` | (idem) | ambos | Idem |
| `area-externa` | (idem) | ambos | Idem |

### 9.3 Mantidos (validados no snapshot)

- Demais N2 conforme §5.1–§5.3 — **snapshot validado atual (não fechado)**; sem totalização global como SSOT.
- Estrutura de `context_slug` conforme §6.1 (sem `nutricao` como CONTEXT).
- Separação por `domain_key` onde aplicável.

### 9.4 CONTEXT `nutricao`

| Item | Decisão | Efeito |
|------|---------|--------|
| `nutricao` | **Removido** do conjunto de CONTEXT estruturais | Não usar como `context_slug` governado; momentos/refeições em **INTENT** / **facets** (§2). |

**Evolução de banco:** exclusão de linha `nutricao` em `context_nodes` (se existir em ambiente legado) segue apenas **RFC + governance-service** — sem SQL direto.

---

## 10. PRÓXIMOS PASSOS GOVERNADOS

| Ordem | Ação | Mecanismo | Validação |
|-------|------|-----------|-----------|
| 1 | Review deste snapshot | Architecture review | Aprovação formal |
| 2 | Expansão incremental de N2 / mappings | RFC quando alterar identificadores imutáveis | Aprovação formal |
| 3 | Submissão YAML | PR para `/config/n2/` | CI schema check |
| 4 | Processamento | `governance-service` | Audit log |
| 5 | Validação | Query counts, FK checks | Checklist |
| 6 | Deploy | Feature flag gradual | Monitoramento |

---

Documento alinhado com:

- Migration **0079** (estrutura N2 / CONTEXT / `context_n2_mapping` / localizados)
- Migration **0080** (governance hardening: mensagem, `DELETE`, imutabilidade em `UPDATE`)
- Modelo de governança **N1** / **N2** / **CONCEPT** / **GRAPH** (serviços e triggers correspondentes)

**FIM DO SNAPSHOT GOVERNADO**

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_AGENT_PROTOCOL.md
<!-- AUTO-GENERATED-END -->