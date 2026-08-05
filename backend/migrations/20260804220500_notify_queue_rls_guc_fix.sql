-- ============================================================
-- 20260804220500: corrige o GUC da policy de `notify_queue`
-- ============================================================
-- Sucessora de 20260804220000 (que JÁ FOI APLICADA — Lei 2 é forward-only; migration aplicada não
-- se reescreve, ganha sucessora).
--
-- ═══ O ERRO, E POR QUE ELE SERIA MUDO ═══
-- Escrevi a policy com `current_setting('app.current_tenant_id')`. O runtime seta
-- `app.current_tenant` (pool.ts:165 — `set_config('app.current_tenant', …)`). Nome errado ⇒ a
-- policy NUNCA casaria ⇒ toda leitura devolveria ZERO LINHAS, sem erro e sem log. A fila pareceria
-- vazia para sempre, e "não há notificação" é exatamente a afirmação falsa que este arco inteiro
-- existe para impedir.
--
-- Contagem que resolve a dúvida, não a memória: `app.current_tenant` aparece em 126 lugares nas
-- migrations; `app.current_tenant_id` em 7 (dívida) e `app.tenant_id` em 2. O canônico é o primeiro.
--
-- Pego pelo guard `audit-rls-policy-guc-canonical` ANTES de qualquer leitura acontecer — é o tipo
-- de defeito que só um guard pega, porque o sintoma (lista vazia) é indistinguível do normal.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS notify_queue_tenant_isolation ON public.notify_queue;

CREATE POLICY notify_queue_tenant_isolation ON public.notify_queue
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

COMMIT;
