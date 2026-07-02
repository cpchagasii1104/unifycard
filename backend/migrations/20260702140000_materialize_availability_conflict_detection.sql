-- ============================================================
-- 20260702140000: materializa detect_availability_conflicts()
-- (DT-AVAILABILITY-CONFLICT-DETECTION-STUB)
-- ============================================================
-- Achado (READ-FIRST PACK Slice 0, 2026-07-01, auditoria de segurança de booking):
-- detect_availability_conflicts(p_tenant_id, p_availability_id, p_actor_id) foi criada como STUB
-- vazio (BEGIN RETURN; END — migrations/20260530491000_create_unified_availability_tables.sql:61-78)
-- e NUNCA foi materializada. Efeito: sempre retorna zero linhas — AVAILABILITY_CONFLICT_DETECTED
-- (unified-availability.service.ts, bloco "Detectar conflitos APÓS criar booking") nunca dispara; o
-- comentário "trigger previne sobreposição" (unified-availability.repository.ts) era FALSO perante o
-- schema vivo — falsa sensação de guarda.
--
-- 🔴 NÃO é o guard de double-booking do prestador (esse já é REAL — advisory lock transacional em
-- confirmBookingWithProviderLock/confirmBookingWithResourceLock, DT-SERVICE-BOOKING-CONFIRM-BYPASSES-
-- LOCK, CLOSED 2026-07-01). Esta função é um AVISO PESSOAL, não-bloqueante: "esta pessoa (owner_type
-- ='user') já tem outra janela de disponibilidade que se sobrepõe a esta". A confirmação/decisão cabe
-- sempre ao usuário (unified-availability.repository.ts:820-823, comentário BLINDAGEM já correto:
-- "Esta função DETECTA conflitos, NÃO bloqueia").
--
-- Escopo: overlap padrão de intervalo (other.start < this.end AND other.end > this.start), restrito a
-- owner_type='user' AND owner_id=p_actor_id (mesmo escopo do ÚNICO caller — unified-availability.
-- service.ts só chama detectConflicts quando availability.ownerType==='user'), status='active', mesmo
-- tenant, excluindo a própria linha. Availability-alvo inexistente → RETURN vazio (fail-open honesto,
-- comportamento idêntico ao stub para esse caso — não regride nada).
--
-- Lei 2: forward-only. CREATE OR REPLACE preserva assinatura/RETURNS TABLE exatas do stub original —
-- zero mudança de contrato para o caller (unified-availability.repository.ts::detectConflicts).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION detect_availability_conflicts(
  p_tenant_id UUID,
  p_availability_id UUID,
  p_actor_id UUID
)
RETURNS TABLE (
  conflict_availability_id UUID,
  conflict_start_datetime TIMESTAMPTZ,
  conflict_end_datetime TIMESTAMPTZ,
  conflict_owner_type TEXT,
  conflict_owner_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT a.start_datetime, a.end_datetime INTO v_start, v_end
    FROM availability a
   WHERE a.availability_id = p_availability_id AND a.tenant_id = p_tenant_id;

  -- Availability-alvo inexistente: RETURN vazio (mesmo comportamento honesto do stub para esse caso).
  IF v_start IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.availability_id,
    a.start_datetime,
    a.end_datetime,
    a.owner_type::text,
    a.owner_id
    FROM availability a
   WHERE a.tenant_id = p_tenant_id
     AND a.owner_type = 'user'
     AND a.owner_id = p_actor_id
     AND a.availability_id <> p_availability_id
     AND a.status = 'active'
     AND a.start_datetime < v_end
     AND a.end_datetime > v_start;
END;
$$;

COMMENT ON FUNCTION detect_availability_conflicts(UUID, UUID, UUID) IS
  'Detecta sobreposição de agenda PESSOAL (owner_type=user) — aviso não-bloqueante, a confirmação '
  'cabe ao usuário. NÃO é o guard de double-booking do prestador (esse é o advisory lock transacional '
  'do confirm canônico). Materializada em 20260702140000 (DT-AVAILABILITY-CONFLICT-DETECTION-STUB) — '
  'antes era BEGIN RETURN; END (stub vazio, sempre zero linhas).';

COMMIT;
