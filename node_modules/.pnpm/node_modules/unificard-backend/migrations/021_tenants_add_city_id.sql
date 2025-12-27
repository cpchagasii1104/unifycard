-- ================================================
-- UNIFICARD - MIGRATION 021
-- Adiciona localização (city_id) aos tenants
-- ================================================

-- Adiciona coluna city_id na tabela tenants
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(city_id) ON DELETE SET NULL;

-- Cria índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_tenants_city ON tenants (city_id) WHERE city_id IS NOT NULL;

-- Comentário
COMMENT ON COLUMN tenants.city_id IS 'Cidade onde o tenant está localizado (opcional)';








