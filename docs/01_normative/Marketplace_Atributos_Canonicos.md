Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# Marketplace — Catálogo de Atributos Canônicos

Este documento descreve os atributos **já suportados** pelo marketplace via modelo declarativo
(Atributos + Produto/Variante + Tipo de Produto).

## Princípios
- Atributos são **declarativos** (não executam regra).
- Valores vivem na **Variante**.
- Tipo do Produto define **comportamento físico**, não venda.

## Tipos de Produto
- UNIT — unitário (roupas, calçados)
- WEIGHT — pesável (frutas, carnes)
- LOT — loteável/perecível

## Atributos Padrão (exemplos recomendados)

### Vestuário
- tamanho (enum): PP, P, M, G, GG, XG
- genero (enum): masculino, feminino, unissex
- cor (string)
- material (string)

### Calçados
- numeracao (number): BR (ex: 34–45)
- genero (enum)
- cor (string)

### Alimentos — Pesáveis
- origem (string)
- categoria_alimento (enum): fruta, carne, vegetal
- unidade_preco (enum): kg
- validade (date — informativa)

### Lotes
- lote_codigo (string)
- data_fabricacao (date)
- data_validade (date)

## Unidades
- un (unidade)
- kg, g
- l, ml

## Observações
- Peso e quantidade são tratados via **movimentações de estoque**.
- PLU é opcional e restrito a WEIGHT quando aplicável.
- Nenhuma regra automática por validade.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->