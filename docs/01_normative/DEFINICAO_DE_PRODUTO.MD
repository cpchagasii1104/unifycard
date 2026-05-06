Documento Mestre final, consolidado e completo, já com:

tempo ✔️
semântica ✔️
governança ✔️
inconsistência controlada ✔️
onboarding de empresa ✔️ (o que faltava)
hierarquia de verdade ✔️

Sem ruído. Só o que importa.

📘 Documento Mestre — Produto (UnifiCard)
1. Propósito

Este documento define, de forma unificada, o que é um produto no sistema, por que ele existe dessa forma, como ele evolui ao longo do tempo e como ele é utilizado operacionalmente.

Objetivo:

eliminar ambiguidade
centralizar entendimento
servir como referência única operacional
2. O Problema que o Sistema Resolve

O sistema existe porque:

O usuário NÃO sabe fornecer a identidade semântica correta de um produto no momento da criação.

Ou seja:

nomes são ambíguos
categorias são imprecisas
marcas são inconsistentes

Logo, o sistema precisa:

aceitar entrada imperfeita e convergir para uma identidade correta ao longo do tempo

3. Definição de Produto

Produto NÃO é uma entidade simples.

Produto é:

Uma hipótese operacional de item comercial que precisa convergir, ao longo do tempo, para uma identidade semântica única.

4. Componentes Fundamentais
4.1 CONCEPT (SSOT semântico)
define o que o produto é
identidade única e global
obrigatório no estado final
4.2 CATEGORY (estrutura operacional + domínio de restrição)
define onde o produto vive
garante navegação e funcionamento do sistema
NÃO define semântica

Mas:

define o conjunto de conceitos possíveis para aquele produto

Ou seja:

reduz o espaço de ambiguidade
ancora o sistema no momento da criação
4.3 CANONICAL_PRODUCT
registro operacional do produto
representa o estado atual da resolução

Contém:

name
brand
category_id
attributes
concept_id (quando resolvido)

4.4 AGREGADOR DE GRADE (NAVEGAÇÃO — canonical_product_groups)

Estrutura opcional que agrupa vários canonical_products para vitrine, busca e remanejamento (ex.: tamanhos 37/38/39).

LEI: não é SSOT de identidade, preço nem estoque. Nunca usar grupo como fonte de preço em checkout ou ledger. Identidade continua em CONCEPT + canonical + variant; ver §18.14 de 07_NOMENCLATURA_CANONICA.md (subsecção *Lei — Agregadores de catálogo*).

4.4.1 PRODUCT_VARIANT (execução, não identidade)

A variante **não define** identidade semântica. Define **execução**: SKU, atributos discriminantes, embalagem de venda, e ligação a **inventário** e movimentos via **`product_variant_id`**. Em fluxos transacionais, **`concept_ref`** resolve-se pelo encadeamento **variant → product → canonical (READY) → concept**, conforme `07_NOMENCLATURA_CANONICA.md` §18.14 e `LEIS_OPERACIONAIS_UNIFICARD.md`. **Proibido** usar variante como substituto de CONCEPT ou como fonte isolada de significado.

4.4.2 MATERIALIZAÇÃO TENANT — industrial

`products` com comportamento **industrial** (tipo persistido normalizado em **INDUSTRIAL**) são **projeções operacionais** de um **`canonical_products`** já **READY**; **devem** referenciar **`canonical_product_id`**. Sem esse vínculo, a linha é inválida no modelo SSOT para esse trilho — o sistema **bloqueia** persistência e execução (integridade SQL + gates de API e intent; ver mesma semântica em `LEIS_OPERACIONAIS_UNIFICARD.md`).

4.5 MARCA vs FABRICANTE (canônico)

Marca comercial e fabricante são distintos; não impor marca = fabricante. Campos concretos seguem o schema (ex.: brand TEXT; fabricante por RFC).

5. Natureza Temporal do Produto

O sistema é temporal por definição.

Produto não nasce pronto.

Ele evolui ao longo do tempo:

t0 → criação (sem semântica)
t1 → em resolução
t2 → confirmado

A verdade do produto é construída, não conhecida no início

6. Estados do Produto (State Machine)

Produto evolui obrigatoriamente pelos estados:

RAW
STRUCTURED
SEMANTIC_PENDING
SEMANTIC_CONFIRMED
OPERATIONAL_READY
7. Fluxo Completo
Entrada

Usuário fornece:

nome
marca
categoria

👉 entrada ambígua por natureza

Etapa 1 — Registro
produto é criado em canonical_products
ainda sem identidade semântica garantida

👉 estado estrutural, não semântico

Etapa 2 — Governança
produto entra na fila de resolução
sistema tenta:
matching automático
sugestão de conceito
validação humana (quando necessário)

👉 redução de ambiguidade

Etapa 3 — Resolução
concept_id é definido
status → confirmed

👉 identidade semântica estabelecida

Etapa 4 — Ready

Produto só é considerado válido quando:

concept_id confirmado
category_id presente
atributos mínimos válidos
8. Inconsistência Controlada

O sistema aceita inconsistência temporária por design

Isso significa:

produto pode existir sem semântica
produto pode ser duplicado temporariamente
produto pode estar incorreto no início

Mas:

TODO produto deve convergir para consistência

9. Regras Invioláveis
produto NÃO pode terminar sem concept_id
categoria NÃO define semântica
produto NÃO pode ser usado sem readiness
nome, slug ou categoria NÃO são identidade
10. Papel da Categoria

Categoria existe para:

estruturar catálogo
permitir navegação
limitar domínio de busca
reduzir ambiguidade inicial

Categoria NÃO existe para:

definir o que o produto é
11. Papel do Concept

Concept existe para:

resolver ambiguidade
garantir unicidade
permitir deduplicação real
definir identidade final
12. Deduplicação
antes do concept → probabilística
depois do concept → determinística

Regra:

Dois produtos são iguais se possuem o mesmo concept_id

13. Tipos de Produto
INDUSTRIAL
precisa de concept
passa por governança
identidade global
LOCAL
não precisa de concept global
contexto do lojista

Mas:

possui semântica implícita não normalizada

14. Operação Comercial

Produto só pode ser usado quando:

operational_ready = true

Caso contrário:

bloqueado
15. Categoria no Onboarding de Empresas

Categorias também definem o escopo operacional da empresa.

Fluxo:

empresa escolhe tipo (ex: mercado, açougue, peixaria)
isso define categorias disponíveis
essas categorias já estão conectadas ao catálogo global
produtos são automaticamente acessíveis

Regra:

A empresa NÃO cria o universo de produtos — ela herda um subconjunto do catálogo global

16. Insight Central

Produto não é estático.

Produto é:

Um processo temporal de convergência entre input humano e identidade semântica

17. Resumo Final
Produto nasce incompleto
Categoria ancora e limita
Sistema aceita erro inicial
Fila resolve ambiguidade
Concept define identidade
Ready valida uso
18. Hierarquia de Verdade (SSOT Temporal)

O sistema possui diferentes verdades ao longo do tempo:

t0 → canonical_products (estrutura)
t1 → estado transitório
t2 → concept_id (verdade semântica)

Regra:

A identidade final SEMPRE vem do concept_id

Implicações:

nome não define identidade
categoria não define identidade
qualquer conflito → concept vence
19. Conclusão

O sistema não modela apenas produtos.

Ele modela:

A transformação progressiva de dados ambíguos em entidades semanticamente consistentes

🧨 Na lata

👉 Agora você tem um documento que:

não deixa margem pra interpretação errada
explica o sistema inteiro
conecta produto + empresa + catálogo

Se você usar isso como lei:

👉 você para de duvidar
👉 e começa a construir com segurança