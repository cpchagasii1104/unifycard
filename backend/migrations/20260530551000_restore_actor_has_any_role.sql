-- ============================================================
-- RESTAURAÇÃO: actor_has_any_role (RBAC V2)
-- ============================================================
-- Frente: A1 (Fatia A1) 2026-05-25
--
-- Contexto:
--   `actor_has_any_role(uuid, uuid, text[])` foi originalmente criada em
--   `300_add_actor_rbac_functions.sql` (commit `8f71fa34`, 2026-02-08, "feat(migrations): add
--   actor-based RBAC helper functions (RBAC V2)") e PERDIDA acidentalmente nos rebases
--   subsequentes (REBASE-02/03/04 + marco-zero `39ea7062`). Nunca foi recriada — o caller único
--   em `backend/src/core/rbac/rbac.service.ts:208` (`SELECT actor_has_any_role($1, $2, $3::text[])`)
--   passou a falhar em runtime com Postgres 42883 ("função não existe"), bloqueando 11 callsites
--   de `fastify.requireRole(...)` em 6 arquivos (companies admin x3, categories admin x3,
--   catalog/category-review x3, unifybank/test-currency x2, categories/ssot-admin x1).
--
-- Por que restaurar agora:
--   - RBAC_V2_CONTRACT.md §6.2 (status ATIVO/LEI DO SISTEMA) prescreve a função:
--     "Papéis são derivações estáticas de permissão... Papéis são avaliados dentro do RBAC."
--   - Auditoria material (read-only) confirmou: ZERO migrations posteriores tocam
--     `actor_has_any_role` (grep exaustivo em backend/migrations/). Sem substituto. Sem
--     decisão consciente que a tenha mantido fora. Pura perda acidental.
--   - Tabelas-dependência (`actors`, `user_roles`, `roles`) existem no schema vivo com dados
--     reais (77/1/4 rows).
--   - Disciplina `feedback_archive_nao_e_ssot.md` aplicada: confirmou-se materialmente que o
--     archive (commit 8f71fa34) É o substrato canônico vigente PARA ESTA função antes de
--     restaurar. Não confiou-se em "existia no passado" — auditou-se "é canônico hoje".
--   - Assinatura histórica `(uuid, uuid, text[])` bate LITERAL com o caller atual
--     (`rbac.service.ts:208-212` passa `[tenantId, actorId, roleNames]`).
--
-- O QUE ESTA MIGRATION NÃO TOCA (fronteira):
--   - `actor_has_permission(uuid, uuid, text, text)` — permanece intocada. Hoje retorna FALSE
--     (fail-closed, `20260422000100_actor_has_permission_fail_closed.sql`) por DECISÃO CONSCIENTE
--     ratificada por C47/DECISION-0013 + `AUTHORITY_PRECEDENCE.md §4.4` ("IA não cria autoridade;
--     ausência de política = bloqueio"). A FASE 6 substituirá pela implementação real
--     (RBAC + policy engine). Restaurar a versão histórica funcional desfaria essa decisão
--     constitucional sem reabri-la — escopo estritamente fora desta fatia.
--
-- Reversibilidade: ALTA (DROP FUNCTION IF EXISTS public.actor_has_any_role(UUID, UUID, TEXT[]);)
-- Blast: BAIXO (só destrava callsites em HTTP 500 hard; nenhum estado degradado por decisão é
--         afetado).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.actor_has_any_role(
  p_tenant_id  UUID,
  p_actor_id   UUID,
  p_role_names TEXT[]
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
      FROM public.actors a
      JOIN public.user_roles ur
        ON a.user_id   = ur.user_id
       AND ur.tenant_id = p_tenant_id
      JOIN public.roles r
        ON ur.role_id = r.role_id
     WHERE a.actor_id  = p_actor_id
       AND a.tenant_id = p_tenant_id
       AND r.name = ANY(p_role_names)
  );
END;
$$;

COMMENT ON FUNCTION public.actor_has_any_role(UUID, UUID, TEXT[]) IS
  'RBAC V2: verifica roles por actor_id. user_id é usado apenas internamente (compatibilidade transitória). Restaurada em 2026-05-25 após perda em rebase pós-8f71fa34.';

COMMIT;
