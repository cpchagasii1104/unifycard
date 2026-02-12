/*
Arquivo: 021_tenants_add_city_id.sql
Projeto: UnifyCard
Banco: PostgreSQL 14+
Escopo: Associação opcional de tenants com cidade

Objetivo:
- Permitir vincular um tenant a uma cidade
- Base para relatórios, geolocalização e regras regionais

Dependências:
- Tabela tenants (001_initial_schema.sql)
- Tabela cities (019_world_geography.sql)

Observações:
- Relação opcional (SET NULL)
- Não afeta multi-tenant nem RLS
*/

-- =========================================================
-- ADICIONAR COLUNA city_id
-- =========================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS city_id UUID
  REFERENCES cities(city_id)
  ON DELETE SET NULL;

-- =========================================================
-- ÍNDICE PARA CONSULTA
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_tenants_city
  ON tenants (city_id)
  WHERE city_id IS NOT NULL;

-- =========================================================
-- COMENTÁRIO
-- =========================================================

COMMENT ON COLUMN tenants.city_id IS
  'Cidade onde o tenant está localizado (opcional)';








