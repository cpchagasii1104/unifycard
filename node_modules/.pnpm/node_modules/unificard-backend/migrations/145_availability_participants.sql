-- ============================================================
-- UNIFICARD — AVAILABILITY PARTICIPANTS
-- Arquivo: 145_availability_participants.sql
-- Banco alvo: PostgreSQL 14+
--
-- OBJETIVO
-- Adicionar suporte a PARTICIPANTES de availability
-- Permitir que uma availability (empresa, banda, grupo, evento)
-- declare pessoas físicas (actors CPF) como participantes humanos
--
-- REGRAS CANÔNICAS:
-- * NÃO bloqueia automaticamente conflitos
-- * NÃO cria lógica de decisão automática
-- * Detecção de conflitos é ALERTA, não bloqueio
-- * A confirmação cabe ao usuário
--
-- ============================================================

BEGIN;

-- ============================================================
-- ENUMS CANÔNICOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participant_role') THEN
    CREATE TYPE participant_role AS ENUM (
      'executor',      -- Executor principal (ex: músico principal)
      'participante',  -- Participante (ex: membro da banda)
      'convidado'      -- Convidado (ex: convidado especial)
    );
  END IF;
END$$;

-- ============================================================
-- TABELA: AVAILABILITY_PARTICIPANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS availability_participants (
  participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Relacionamentos OBRIGATÓRIOS
  -- 🔴 BLINDAGEM: Participant é pessoa física (actor CPF) associada a uma availability
  availability_id UUID NOT NULL REFERENCES availability(availability_id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(actor_id) ON DELETE CASCADE, -- Actor participante (CPF)
  
  -- Role do participante
  role participant_role NOT NULL DEFAULT 'participante',
  
  -- Metadados e Extensibilidade
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  -- 🔴 BLINDAGEM: Apenas um participante por availability e actor
  CONSTRAINT availability_participants_unique_per_availability_actor 
    UNIQUE (availability_id, actor_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_availability_participants_availability_id 
  ON availability_participants(availability_id);
CREATE INDEX IF NOT EXISTS idx_availability_participants_actor_id 
  ON availability_participants(actor_id);
CREATE INDEX IF NOT EXISTS idx_availability_participants_tenant_id 
  ON availability_participants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_availability_participants_role 
  ON availability_participants(role);

-- Índice composto para busca de participantes por availability
CREATE INDEX IF NOT EXISTS idx_availability_participants_availability_role 
  ON availability_participants(availability_id, role);

-- ============================================================
-- TRIGGER: UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_availability_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_availability_participants_updated_at
  BEFORE UPDATE ON availability_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_availability_participants_updated_at();

-- ============================================================
-- FUNÇÃO: DETECTAR CONFLITOS DE HORÁRIO
-- ============================================================

-- 🔴 BLINDAGEM: Esta função DETECTA conflitos, NÃO bloqueia
-- 🔴 BLINDAGEM: A confirmação cabe ao usuário
-- Retorna lista de conflitos encontrados (apenas informação, não decisão)
CREATE OR REPLACE FUNCTION detect_availability_conflicts(
  p_tenant_id UUID,
  p_availability_id UUID,
  p_actor_id UUID
)
RETURNS TABLE (
  conflict_availability_id UUID,
  conflict_start_datetime TIMESTAMPTZ,
  conflict_end_datetime TIMESTAMPTZ,
  conflict_owner_type availability_owner_type,
  conflict_owner_id UUID
) AS $$
BEGIN
  -- Buscar a availability principal
  DECLARE
    main_availability RECORD;
  BEGIN
    SELECT 
      a.availability_id,
      a.start_datetime,
      a.end_datetime,
      a.owner_type,
      a.owner_id
    INTO main_availability
    FROM availability a
    WHERE a.availability_id = p_availability_id
      AND a.tenant_id = p_tenant_id;
    
    IF NOT FOUND THEN
      RETURN;
    END IF;
    
    -- Buscar conflitos: availability do actor participante que sobrepõe com a availability principal
    -- 🔴 BLINDAGEM: Apenas DETECTA, não bloqueia
    RETURN QUERY
    SELECT 
      a.availability_id,
      a.start_datetime,
      a.end_datetime,
      a.owner_type,
      a.owner_id
    FROM availability a
    WHERE a.tenant_id = p_tenant_id
      AND a.owner_type = 'user' -- Apenas availability de usuário (pessoa física)
      AND a.owner_id = p_actor_id
      AND a.status = 'active'
      AND a.availability_id != p_availability_id
      AND (
        -- Sobreposição: início ou fim dentro de outra janela
        (a.start_datetime >= main_availability.start_datetime AND a.start_datetime < main_availability.end_datetime)
        OR (a.end_datetime > main_availability.start_datetime AND a.end_datetime <= main_availability.end_datetime)
        OR (a.start_datetime <= main_availability.start_datetime AND a.end_datetime >= main_availability.end_datetime)
      );
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FIM 145_availability_participants.sql
-- ============================================================

COMMIT;

