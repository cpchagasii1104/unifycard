# N1_NAVIGATION_STRUCTURE_UNIFICARD

**Documento Normativo — Versão 1.0.2**  
**Data:** 2026-03-23  
**Status:** CONGELADO — IMPLEMENTAÇÃO OBRIGATÓRIA  
**Base:** DOMAIN_ONTOLOGY_UNIFICARD v1.0.5  
**Próxima revisão:** Somente por RFC formal  

---

## 1. OBJETIVO

Este documento define a estrutura de N1 (Layer 2 — TREE) para os 3 domínios críticos do sistema UnifiCard:

- `produtos-e-comercio`
- `servicos`
- `financas-e-economia`

**Escopo:** Navegação hierárquica (LAYER 2), não semântica (GRAPH) nem identidade (CONCEPT).

---

## 2. PRINCÍPIOS FUNDAMENTAIS

### 2.1 Separação de camadas

| Camada | Responsabilidade | O que N1 NÃO é |
|--------|------------------|----------------|
| LAYER 1 (CONCEPT) | Identidade única (canonical_id) | N1 ≠ identidade |
| LAYER 2 (TREE/N1) | Navegação hierárquica | N1 ≠ semântica |
| LAYER 3 (CONTEXT) | Perfil de aplicação | N1 ≠ comportamento |
| LAYER 6 (GRAPH) | Relações semânticas | N1 ≠ relacionamento |

### 2.2 Regras absolutas de N1

```
N1 = NAVEGAÇÃO (LAYER 2)
N1 ⊂ N0 (sempre)
N1 ≠ N0 (nunca contém outro N0)
N1 ≠ SEMÂNTICA (GRAPH explica)
N1 ≠ EXCEÇÃO (sem casos especiais)
```

### 2.3 Ortogonalidade interna

N1 dentro do mesmo N0 **não se sobrepõe semanticamente**.

### 2.4 Estabilidade

Alterações em N1 requerem **RFC formal** — mínimo 24 meses de estabilidade.

---

## 3. ESTRUTURA N1 POR DOMÍNIO

### 3.1 PRODUTOS E COMÉRCIO (`produtos-e-comercio`)

**Total: 13 N1**

| # | N1 Canônico | Definição | N2 Direcionais | Proteção anti-conflito |
|---|-------------|-----------|----------------|------------------------|
| 1 | `alimentacao` | Bens comestíveis para consumo | perecíveis, não-perecíveis, processados | Separado de `bebidas` (fronteira: estado físico) |
| 2 | `bebidas` | Líquidos para consumo humano | alcoólicas, não-alcoólicas, funcionais | Separado de `alimentação` (sopas = alimentação) |
| 3 | `higiene-e-beleza` | Produtos de uso corporal e estética | cuidados pessoais, maquiagem, perfumaria | Evita "bem-estar" (conflita com N0 saúde) |
| 4 | `vestuario-e-acessorios` | Artigos de vestir e complementos | roupas, calçados, bolsas, joias, óculos | — |
| 5 | `casa-e-decoracao` | Itens para residência | móveis, decoração, cama/mesa/banho, iluminação | — |
| 6 | `eletroeletronicos` | Aparelhos elétricos e eletrônicos | informática, telefonia, áudio, vídeo, eletrodomésticos | Unificado (evita fronteira geladeira inteligente) |
| 7 | `materiais-de-construcao` | Insumos para obra e reforma | acabamento, estrutura, ferramentas, tintas | "Materiais" = produto, não serviço (evita conflito futuro com N0 construção) |
| 8 | `veiculos` | Veículos automotores completos | automóveis, motocicletas, utilitários | Separado de peças (filtro: possui chassis) |
| 9 | `pecas-e-acessorios-automotivos` | Componentes e complementos para veículos | motor, suspensão, acessórios internos/externos | Separado de veículos (filtro: componente) |
| 10 | `produtos-para-animais` | Bens para animais de estimação | alimentação, higiene, acessórios, saúde animal | Evita "pet-shop" (nome de estabelecimento) |
| 11 | `papelaria` | Materiais de consumo para escrita/arte | papéis, escritura, arte, embalagens | Separado de mobiliário (consumo descartável vs. durável) |
| 12 | `mobiliario-e-equipamentos-de-escritorio` | Mobília e aparatos para ambiente corporativo | móveis, tecnologia de escritório, organização | Separado de papelaria (ativo durável vs. consumo) |
| 13 | `equipamentos-esportivos` | Bens para prática esportiva e atividade física | bicicletas, roupas técnicas, equipamentos de ginástica | Evita "artigos" (genérico); foca em equipamento material |

**Nota (`equipamentos-esportivos`):** Pode incluir mobilidade leve (ex.: bicicletas) sem conflitar com N0 `mobilidade-e-logistica`, pois o critério é **uso esportivo**, não transporte.

---

### 3.2 SERVIÇOS (`servicos`)

**Total: 10 N1**

| # | N1 Canônico | Definição | N2 Direcionais | Proteção anti-conflito |
|---|-------------|-----------|----------------|------------------------|
| 1 | `manutencao-e-reformas` | Reparos e pequenas obras sem ART | elétrica, hidráulica, pintura, consertos gerais | Sem ART = diferencia de N0 construção (condicional) |
| 2 | `servicos-domesticos` | Prestação de serviços no lar | limpeza, cuidados, cozinha, jardinagem | — |
| 3 | `consultoria-e-assessoria` | Expertise intelectual especializada | jurídica, contábil, financeira, gestão, RH | — |
| 4 | `servicos-tecnicos-especializados` | Mão-de-obra técnica certificada | eletricistas, mecânicos, TI, instalações | Diferente de consultoria (mão-de-obra vs. intelecto) |
| 5 | `estetica-e-cuidados-pessoais` | Serviços de aparência e conforto | estética, massagem, SPA, terapias complementares | Remove "bem-estar" (evita conflito com N0 saúde) |
| 6 | `treinamento-corporativo` | Capacitação organizacional B2B | in-company, workshops, palestras, desenvolvimento | Foco B2B organizacional, não acadêmico |
| 7 | `capacitacao-e-treinamentos` | Capacitação prática não-regulada B2C | cursos livres, aulas, oficinas, tutoria | "Capacitação" ≠ "educação" (evita conflito com N0 educação) |
| 8 | `producao-e-realizacao-de-eventos` | Prestação para execução de eventos | fotografia, filmagem, buffet, decoração, animação, som | Prestação de serviço ≠ evento em si (N0 cultura-lazer) |
| 9 | `servicos-de-tecnologia` | Desenvolvimento e suporte tecnológico | software, design digital, infraestrutura TI, suporte | Mais preciso que "tecnologia-e-digital" |
| 10 | `marketing-e-comunicacao` | Promoção e divulgação de marcas/produtos | publicidade, redes sociais, conteúdo, SEO, PR | — |

**Removidos (conflito com N0):**
- ~~`transporte-de-bens`~~ → vai para N0 `mobilidade-e-logistica`
- ~~`transporte-privado-de-pessoas`~~ → vai para N0 `mobilidade-e-logistica`
- ~~`realocacao-e-mudancas-residenciais`~~ → reabria exceção de transporte; removido completamente

---

### 3.3 FINANÇAS E ECONOMIA (`financas-e-economia`)

**Total: 7 N1**

| # | N1 Canônico | Definição | N2 Direcionais | Proteção anti-conflito |
|---|-------------|-----------|----------------|------------------------|
| 1 | `pagamentos-e-transferencias` | Movimentação imediata de valor | instantâneos, agendados, internacionais, boletos | Cobre doações via dimensão `impacto_social` |
| 2 | `creditos-e-emprestimos` | Operações de endividamento | pessoal, consignado, financiamento, factoring, hipoteca | — |
| 3 | `investimentos-renda-fixa` | Aplicações com retorno previsível | CDB, Tesouro, LCI/LCA, debêntures, LC, poupança | — |
| 4 | `investimentos-renda-variavel` | Aplicações com retorno incerto | ações, ETFs, fundos de ações, commodities, cripto-trading | Diferencia de ativos corporativos (propósito: liquidez) |
| 5 | `seguros-e-previdencia` | Proteção de risco e longo prazo | vida, acidentes, saúde suplementar, auto, residencial, previdência | — |
| 6 | `cambio-e-moedas` | Operações com moedas estrangeiras | turismo, comercial, hedge, remessas | — |
| 7 | `contas-e-relacionamento` | Serviços bancários de base | corrente, poupança, salário, cartões, cheque especial | — |

**Removido (reintroduzia domínio removido):**
- ~~`doacoes-e-filantropia`~~ → coberto por `pagamentos-e-transferencias` + dimensão `impacto_social`

---

## 4. MATRIZ DE VALIDAÇÃO

### 4.1 Anti-conflito N1 × N0

| N1 | N0 potencial | Resolução |
|----|--------------|-----------|
| `estetica-e-cuidados-pessoais` | `saude-e-bem-estar` | Removeu "bem-estar"; foca em aparência |
| `capacitacao-e-treinamentos` | `educacao-e-conhecimento` | "Capacitação" ≠ educação formal; "treinamentos" ≠ institucional |
| `treinamento-corporativo` | `educacao-e-conhecimento` | Foco B2B organizacional, não acadêmico |
| `producao-e-realizacao-de-eventos` | `cultura-lazer-e-eventos` | Prestação de serviço ≠ o evento em si |
| `materiais-de-construcao` | `construcao-e-infraestrutura` (condicional) | "Materiais" = produto; não serviço de obra |
| `eletroeletronicos` | — | Unificado para evitar fronteira ambígua |

### 4.2 Ortogonalidade interna (mesmo N0)

| Par N1 | Divisão de fronteira |
|--------|----------------------|
| `alimentacao` vs `bebidas` | Estado físico: sólido/semi-sólido vs. líquido primário |
| `veiculos` vs `pecas-e-acessorios-automotivos` | Filtro: possui chassis (sim/não) |
| `papelaria` vs `mobiliario-e-equipamentos-de-escritorio` | Ciclo de vida: consumo descartável vs. ativo durável |
| `treinamento-corporativo` vs `capacitacao-e-treinamentos` | Contexto: B2B organizacional vs. B2C individual |
| `consultoria-e-assessoria` vs `servicos-tecnicos-especializados` | Natureza: intelectual vs. mão-de-obra técnica |

---

## 5. ESPECIFICAÇÃO TÉCNICA

### 5.1 Schema de dados

SSOT de implementação: migration `backend/migrations/0078_n1_navigation.sql`. N0 em banco = `domains.domain_key` (TEXT), não `domains(id)`.

```sql
-- Tabela: n1_nodes
CREATE TABLE n1_nodes (
  n1_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(64) NOT NULL,
  domain_key TEXT NOT NULL REFERENCES domains(domain_key) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_n1_slug_per_domain UNIQUE (slug, domain_key)
);

-- Tabela: n1_localized_names (um display por locale por N1)
CREATE TABLE n1_localized_names (
  n1_id UUID NOT NULL REFERENCES n1_nodes(n1_id) ON DELETE CASCADE,
  locale VARCHAR(10) NOT NULL,
  display_name TEXT NOT NULL,
  PRIMARY KEY (n1_id, locale)
);

-- Associação categoria → N1 (1 categoria → 1 N1)
CREATE TABLE category_n1_mapping (
  category_id UUID PRIMARY KEY REFERENCES categories(category_id) ON DELETE CASCADE,
  n1_id UUID NOT NULL REFERENCES n1_nodes(n1_id) ON DELETE RESTRICT
);
```

Escrita após bootstrap: triggers exigem `app.n1_governance = true` na transação (`n1-governance.service.ts`), alinhado a CONCEPT/GRAPH.

### 5.2 Interface TypeScript

```typescript
interface N1Node {
  n1Id: string;
  slug: string;                  // navegação (ex: "alimentacao"); não é identidade CONCEPT
  domainKey: string;             // N0: domains.domain_key
  displayNames: LocalizedName[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface LocalizedName {
  locale: string;               // "pt-BR", "en-US"
  displayName: string;          // "Alimentação"
}

// Regras de validação obrigatórias
const N1_VALIDATION_RULES = {
  uniqueness: "slug N1 deve ser único por domínio (N0)",
  no_n0_overlap: "N1.slug NÃO pode igualar qualquer identificador de N0 (domain_key)",
  orthogonality: "N1 dentro do mesmo N0 não pode ter sobreposição semântica",
  stability: "N1 só altera via RFC formal",
  no_semantics: "N1 não contém campos de relacionamento (isso é GRAPH)",
  layer_separation: "N1 não define identidade de CONCEPT, apenas organiza sua descoberta"
};
```

### 5.3 Seeder (dados iniciais)

```sql
-- PRODUTOS E COMÉRCIO (13 N1) — domain_key = N0
INSERT INTO n1_nodes (slug, domain_key, sort_order) VALUES
('alimentacao', 'produtos-e-comercio', 1),
('bebidas', 'produtos-e-comercio', 2),
('higiene-e-beleza', 'produtos-e-comercio', 3),
('vestuario-e-acessorios', 'produtos-e-comercio', 4),
('casa-e-decoracao', 'produtos-e-comercio', 5),
('eletroeletronicos', 'produtos-e-comercio', 6),
('materiais-de-construcao', 'produtos-e-comercio', 7),
('veiculos', 'produtos-e-comercio', 8),
('pecas-e-acessorios-automotivos', 'produtos-e-comercio', 9),
('produtos-para-animais', 'produtos-e-comercio', 10),
('papelaria', 'produtos-e-comercio', 11),
('mobiliario-e-equipamentos-de-escritorio', 'produtos-e-comercio', 12),
('equipamentos-esportivos', 'produtos-e-comercio', 13);

-- SERVIÇOS (10 N1)
INSERT INTO n1_nodes (slug, domain_key, sort_order) VALUES
('manutencao-e-reformas', 'servicos', 1),
('servicos-domesticos', 'servicos', 2),
('consultoria-e-assessoria', 'servicos', 3),
('servicos-tecnicos-especializados', 'servicos', 4),
('estetica-e-cuidados-pessoais', 'servicos', 5),
('treinamento-corporativo', 'servicos', 6),
('capacitacao-e-treinamentos', 'servicos', 7),
('producao-e-realizacao-de-eventos', 'servicos', 8),
('servicos-de-tecnologia', 'servicos', 9),
('marketing-e-comunicacao', 'servicos', 10);

-- FINANÇAS E ECONOMIA (7 N1)
INSERT INTO n1_nodes (slug, domain_key, sort_order) VALUES
('pagamentos-e-transferencias', 'financas-e-economia', 1),
('creditos-e-emprestimos', 'financas-e-economia', 2),
('investimentos-renda-fixa', 'financas-e-economia', 3),
('investimentos-renda-variavel', 'financas-e-economia', 4),
('seguros-e-previdencia', 'financas-e-economia', 5),
('cambio-e-moedas', 'financas-e-economia', 6),
('contas-e-relacionamento', 'financas-e-economia', 7);
-- Nomes localizados: ver migration 0078 (ex.: pt-BR em n1_localized_names).
```

---

## 6. GOVERNANÇA

### 6.0 Pipeline de criação e modificação de N1

N1 deve ser criado **exclusivamente** via **`n1-governance-service`**.

Inserções diretas via SQL são permitidas **apenas** para **bootstrap controlado inicial**.

Após bootstrap, toda modificação deve seguir **pipeline de governança** (RFC + service).

Este padrão alinha N1 à governança de **CONCEPT** e de **GRAPH**: uma porta de entrada normativa, sem escritas ad hoc em produção.

### 6.1 Alterações permitidas

| Tipo | Requer | Prazo |
|------|--------|-------|
| Correção de bug (typo em display_name) | PR + aprovação de arquitetura | Imediato |
| Adição de locale/tradução | PR + review | 1 semana |
| Reordenação (sort_order) | PR | Imediato |
| **Nova N1** | **RFC formal** | **RFC cycle** |
| **Remoção de N1** | **RFC formal** | **RFC cycle** |
| **Alteração de slug (N1)** | **RFC excepcional** | **RFC cycle + migração** |

### 6.2 Processo de RFC para N1

```
1. RFC técnico com:
   - Justificativa de negócio
   - Análise de impacto em CONCEPTs existentes
   - Validação de ortogonalidade
   - Plano de migração (se necessário)

2. Revisão por comitê de arquitetura

3. Aprovação unânime para N1 em domínios críticos

4. Implementação via **n1-governance-service**
```

---

## 7. RELAÇÃO COM OUTRAS CAMADAS

### 7.1 Fluxo de navegação

```
USUÁRIO → seleciona N0 → seleciona N1 → seleciona N2 (futuro) → CONCEPT filtrado
                ↓              ↓
            CONTEXT aplica-se em cada nível
                ↓
            GRAPH sugere relações ("você também pode precisar de...")
```

### 7.2 Integração com CONCEPT

- N1 **não contém** CONCEPTs
- N1 **organiza a navegação** para descoberta de CONCEPTs
- Fluxo suportado: **N1 → `category_n1_mapping` → `categories.concept_id` → CONCEPT** (uma categoria mapeia no máximo um N1; um N1 pode cobrir muitas categorias)

### 7.3 Integração com GRAPH

- Semântica de "substitui", "complementa", "requer" vive em GRAPH (LAYER 6)
- N1 **nunca** carrega essas relações

---

## 8. CHECKLIST DE CONGELAMENTO

- [x] Total de N1: 30 (13 + 10 + 7)
- [x] Nenhum N1 duplica N0 existente
- [x] Nenhum N1 se sobrepõe semanticamente a outro no mesmo N0
- [x] Zero exceções de domínio (transporte removido completamente de serviços)
- [x] Nomes canônicos, padronizados (singular preferido)
- [x] Não carregam semântica de relação
- [x] Permitem variação por CONTEXT sem mudar identidade
- [x] Estáveis para 24+ meses sem alteração estrutural
- [x] Schema técnico especificado
- [x] Seeder SQL fornecido
- [x] Regras de governança definidas

---

## 9. HISTÓRICO DE VERSÕES

| Versão | Mudanças | Data |
|--------|----------|------|
| 0.1.0 | Proposta inicial (Kimi) | 2026-03-23 |
| 0.2.0 | Correções Claude (remoção de conflitos N0) | 2026-03-23 |
| 0.3.0 | Refinamentos Kimi (casos de fronteira) | 2026-03-23 |
| 0.4.0 | Remoção final de exceções (ChatGPT) | 2026-03-23 |
| **1.0.0-FINAL** | **Congelamento** | **2026-03-23** |
| **1.0.1** | Correções estruturais: coluna N1 `slug` (vs. `canonical_id` de CONCEPT); regra de camada N1↔CONCEPT; governança `n1-governance-service` + bootstrap SQL; nota `equipamentos-esportivos` | **2026-03-23** |

---

## 10. ASSINATURA DIGITAL

```
Documento: N1_NAVIGATION_STRUCTURE_UNIFICARD
Versão: 1.0.1
Status: CONGELADO
Hash: SHA-256 [a ser gerado na implementação]

Aprovado por:
- Arquitetura UnifiCard
- Kimi (análise estrutural)
- Claude (auditoria de conflitos)
- ChatGPT (validação final)

Próximo passo: Implementação em **n1-governance-service** (N1); CONCEPT e GRAPH permanecem nos seus serviços dedicados
```

---

**FIM DO DOCUMENTO**

---

## ANEXO A — SEPARAÇÃO DE CAMADAS

- `n1_nodes` é navegação global governada (LAYER 2 de navegação macro).
- `categories` é árvore operacional única usada por módulos e contextos.
- CONCEPT permanece SSOT semântico; N1 não define identidade.
- PROFILE permanece read model consumidor de camadas já definidas.

## ANEXO B — REGRA DE IDENTIDADE SEMÂNTICA

- É proibido usar `slug` de N1 ou `category_id` como identidade semântica.
- A conexão semântica válida é: `category_n1_mapping -> categories.concept_id -> CONCEPT`.
- N1 organiza descoberta; não determina significado.

## ANEXO C — USO DE CATEGORIES

- Não existem árvores operacionais paralelas por módulo.
- `categories` atende múltiplos contextos por recorte (scope/contexto), sem mudar seu papel estrutural.
- N1 não substitui nem duplica `categories`; atua como filtro de navegação global governado.

## ANEXO D — PERFIL PROFISSIONAL — ESTADO ATUAL

- Perfil profissional usa `categories` com `scope = 'professional'`.
- Skills válidas operam com `level <= 2`.
- `concept_id` obrigatório para consistência semântica.
- Regra operacional: validação estrita (sem fallback, sem retorno parcial).

## ANEXO E — ANTI-PATTERNS (PROIBIDO)

- Criar nova árvore para perfil profissional.
- Misturar responsabilidade de `n1_nodes` com árvore operacional.
- Usar `slug` como identidade.
- Duplicar semântica fora de CONCEPT.
- Criar SSOT paralelo.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- 22_RFC_N1_PESSOAS_E_IDENTIDADES.md
<!-- AUTO-GENERATED-END -->