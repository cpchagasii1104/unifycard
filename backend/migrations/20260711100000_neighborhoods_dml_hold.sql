-- 20260711100000_neighborhoods_dml_hold.sql
-- F-NEIGHBORHOOD-CANONICAL-IDENTITY · N2-pre — HOLD FÍSICO do catálogo de bairros.
-- DECISION-0172 P5 (vinculante): HOLD físico = trigger + REVOKE + guard. REVOKE sozinho é
-- insuficiente no ambiente atual (runtime dev usa role administrativa; o trigger é a barreira
-- material relevante nesse ambiente; o REVOKE é defesa em profundidade para o runtime-alvo
-- unificard_app).
--
-- O QUE ESTA MIGRATION FAZ (e SOMENTE isto):
--   1. função de trigger que NEGA incondicionalmente INSERT/UPDATE/DELETE em `neighborhoods`;
--   2. trigger BEFORE I/U/D FOR EACH STATEMENT + ENABLE ALWAYS (imune a session_replication_role);
--   3. REVOKE INSERT/UPDATE/DELETE de `unificard_app` (SELECT preservado).
--
-- O QUE ELA NÃO FAZ: nenhuma coluna/tabela/índice/seed; nenhum alias/sucessão/proveniência/
-- vigência; nenhum writer; nenhuma capability; nada de Social/Bank; os dois HOLDs 501 do nível
-- neighborhood no pipeline financeiro (DECISION-0166 D4) permanecem intocados.
--
-- NATUREZA DO HOLD: temporário e GOVERNADO. `neighborhoods` permanece read-only até a abertura
-- do writer canônico (fatia N2-E da DECISION-0172 §6). A substituição deste trigger só pode
-- acontecer JUNTO do writer canônico, com authority territorial (N2-D), alteração consciente do
-- guard e nova auditoria — nunca isoladamente.
--
-- Guard de regressão: backend/scripts/audit-neighborhood-dml-hold.mjs (exige trigger presente,
-- FOR EACH STATEMENT, ENABLE ALWAYS, função sem bypass, REVOKE presente e nenhuma reabertura
-- posterior).

BEGIN;

-- ── 1. Função do HOLD ────────────────────────────────────────────────────────────────────────
-- Nega TODO DML incondicionalmente. Sem consulta de sessão, sem GUC de bypass, sem exceção por
-- role/tenant/superuser (superuser deliberado ainda pode remover o trigger via DDL — por isso a
-- contenção completa é migration + guard + auditoria, nunca só o banco).
CREATE OR REPLACE FUNCTION enforce_neighborhoods_canonical_writer_hold()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION
    'NEIGHBORHOOD_CANONICAL_WRITER_HOLD: catálogo de bairros está em HOLD físico (DECISION-0172 P5). '
    'INSERT/UPDATE/DELETE proibidos até a abertura do writer canônico (N2-E), que exige authority '
    'territorial (N2-D) + alteração consciente do guard + nova auditoria. Identidade de bairro nunca '
    'nasce por texto livre (DECISION-0079 §6 / DECISION-0171).'
    USING ERRCODE = 'raise_exception';
  RETURN NULL; -- inalcançável; presente por forma
END;
$$;

COMMENT ON FUNCTION enforce_neighborhoods_canonical_writer_hold() IS
  'N2-pre (DECISION-0172 P5): HOLD temporário e governado — neighborhoods permanece read-only até o '
  'writer canônico N2-E. Substituição SOMENTE junto do writer, com authority (N2-D), guard consciente, '
  'provas e nova auditoria. Sem bypass por GUC/role/tenant/superuser como regra de produto.';

-- ── 2. Trigger ───────────────────────────────────────────────────────────────────────────────
-- FOR EACH STATEMENT (não FOR EACH ROW): a tabela está VAZIA — um trigger por row nunca
-- dispararia em UPDATE/DELETE que não atingissem linha alguma; o HOLD deve bloquear a TENTATIVA
-- de DML, não apenas a mutação efetiva (prova canônica: UPDATE ... WHERE false deve falhar).
DROP TRIGGER IF EXISTS trg_neighborhoods_canonical_writer_hold ON neighborhoods;
CREATE TRIGGER trg_neighborhoods_canonical_writer_hold
  BEFORE INSERT OR UPDATE OR DELETE ON neighborhoods
  FOR EACH STATEMENT
  EXECUTE FUNCTION enforce_neighborhoods_canonical_writer_hold();

-- ENABLE ALWAYS: trigger dispara inclusive sob session_replication_role='replica', impedindo
-- bypass acidental por sessão de replicação/manutenção. (1º uso de ENABLE ALWAYS no repo —
-- sintaxe padrão PostgreSQL; escolha deliberada da N2-pre, exigida pelo guard.)
ALTER TABLE neighborhoods ENABLE ALWAYS TRIGGER trg_neighborhoods_canonical_writer_hold;

-- ── 3. REVOKE (defesa em profundidade para o runtime-alvo) ───────────────────────────────────
-- SELECT permanece (readers legítimos: findNeighborhoodsByCity/findNeighborhoodById/validate).
-- Não toca CONNECT/USAGE/sequences/functions/default privileges (o grant histórico amplo de
-- 20260620120000 não é alterado; este REVOKE específico prevalece para esta tabela; reaberturas
-- posteriores são vigiadas pelo guard).
REVOKE INSERT, UPDATE, DELETE ON TABLE public.neighborhoods FROM unificard_app;

-- ── 4. Verificação fail-closed ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_enabled "char";
BEGIN
  SELECT tgenabled INTO v_enabled
  FROM pg_trigger
  WHERE tgrelid = 'public.neighborhoods'::regclass
    AND tgname = 'trg_neighborhoods_canonical_writer_hold';
  IF v_enabled IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: trigger trg_neighborhoods_canonical_writer_hold nao foi criado';
  END IF;
  IF v_enabled <> 'A' THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: trigger do HOLD nao esta ENABLE ALWAYS (tgenabled=%)', v_enabled;
  END IF;
  IF has_table_privilege('unificard_app', 'public.neighborhoods', 'INSERT')
     OR has_table_privilege('unificard_app', 'public.neighborhoods', 'UPDATE')
     OR has_table_privilege('unificard_app', 'public.neighborhoods', 'DELETE') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: unificard_app ainda possui DML em neighborhoods apos REVOKE';
  END IF;
  IF NOT has_table_privilege('unificard_app', 'public.neighborhoods', 'SELECT') THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: SELECT de unificard_app foi perdido — HOLD nao pode quebrar readers';
  END IF;
  IF (SELECT count(*) FROM neighborhoods) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: neighborhoods deveria estar vazia na N2-pre';
  END IF;
END $$;

COMMIT;
