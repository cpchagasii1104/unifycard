-- ============================================================
-- UNIFICARD - MIGRATION 165
-- SPRINT 37.1: MARKETPLACE CORE - Catálogo Canônico
-- Enum: product_types
-- ============================================================
--
-- OBJETIVO:
-- Criar enum de tipos de produto.
-- Tipos definem COMO o produto se comporta no estoque,
-- não como ele é vendido.
--
-- REGRAS ARQUITETURAIS (NON-NEGOTIABLE):
-- - Tipos são DECLARATIVOS (não executam regras)
-- - Definem comportamento no estoque (futuro)
-- - Nenhuma integração com venda/pedido/pagamento
-- ============================================================

-- ============================================================
-- ENUM: Tipo de produto
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_type') THEN
        CREATE TYPE product_type AS ENUM (
            'UNIT',    -- Unitário (ex: 1 unidade, 1 peça)
            'WEIGHT',  -- Pesável (ex: 1kg, 500g)
            'LOT'      -- Loteável / Perecível (ex: lote com validade)
        );
    END IF;
END $$;

-- ============================================================
-- COMENTÁRIOS
-- ============================================================
COMMENT ON TYPE product_type IS
    'Tipo de produto: define como o produto se comporta no estoque (não como é vendido).';







