-- ============================================================
-- 0008_profiles.sql
-- Pilar dominante: IDENTIDADE (read model de visualização)
-- Contrato superior: CORE_IMUTAVEL.md
-- Contrato específico: USER_PROFILE_CONTRACT.md
-- Identidade operacional: (tenant_id, actor_id)
-- MODO: Constitucional Rígido
-- HARD MODE: Sem IF NOT EXISTS
-- PK: Composta (tenant_id, actor_id) — sem surrogate
-- PRÉ-REQUISITO: set_updated_at() declarada em migration anterior (0007_system_functions.sql)
--
-- VIOLAÇÕES QUE INVALIDAM ESTA TABELA:
-- - Adicionar campo que influencia comportamento (flags, scores, tiers)
-- - Adicionar estrutura financeira (_cents, _bps)
-- - Adicionar CPF ou dados sensíveis de identidade
-- - Adicionar phone ou qualquer dado de contato
-- - Adicionar categorias sem evento versionado
-- - Usar como fonte de verdade para decisões
-- - Criar FK de outro domínio referenciando esta tabela
-- ============================================================

BEGIN;

CREATE TABLE profiles (
  tenant_id UUID NOT NULL,
  actor_id  UUID NOT NULL,

  -- NULL permitido: profile pode existir antes da projeção completa
  full_name VARCHAR(255),

  -- metadata puramente observacional
  -- NÃO pode conter permissões, scores, tiers ou flags decisórias
  metadata JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_profiles
    PRIMARY KEY (tenant_id, actor_id),

  -- actors: PK é apenas `id` (0002). FK composta (tenant_id,id)→actors exige UNIQUE nas
  -- colunas referenciadas → 42830. Escopo tamanho-2: tenant → tenants, ator → actors(id).
  CONSTRAINT fk_profiles_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id),

  CONSTRAINT fk_profiles_actor
    FOREIGN KEY (actor_id)
    REFERENCES actors(id)
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMIT;

BEGIN;

INSERT INTO schema_version (version) VALUES (8);

COMMIT;

-- ============================================================
-- FIM DA MIGRATION 0008
-- Se esta tabela começar a governar comportamento,
-- esta migration deve ser considerada inválida.
-- ============================================================
