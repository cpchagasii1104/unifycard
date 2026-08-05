-- ============================================================
-- 20260804220000: materializa `notify_queue` — a casa que o código já esperava
-- ============================================================
-- GO de Clayton (2026-08-04), opção A, depois da pergunta dele:
--   *"enquanto o sistema estiver na minha máquina ele não tem acesso a servidor pra disparar
--     'esqueci minha senha' / 'confirmar e-mail'. A gente tem que deixar pronto, que nem a questão
--     do dinheiro. Qual a melhor solução?"*
--
-- ═══ ESTA TABELA NÃO É DESENHO NOVO ═══
-- `src/core/notify/` tem service, worker, processor, handlers, routes e provider — o pipeline
-- INTEIRO já existe e escreve aqui. Faltava só a casa. Medido em 2026-08-04:
--   to_regclass('notify_queue') → null
-- Ou seja: qualquer chamada ao pipeline morreria em 42P01. Isto é RELIGAR, não inventar.
--
-- A FORMA veio da QUERY, não de mim: colunas e defaults foram lidos de
-- `notify.service.ts` (INSERT das linhas 82-96) e o tipo de `notify.types.ts`
-- (`NotificationQueueRow`, `NotificationChannel`, `NotificationStatus`).
--
-- ═══ POR QUE ISTO RESOLVE "NÃO TEM SERVIDOR" ═══
-- A resposta certa não é fingir a entrega: é PERSISTIR A INTENÇÃO e o estado dizer a verdade
-- sobre si. A mensagem vira linha com status honesto; sem provider real ela fica `pending` —
-- porque ninguém entregou mesmo. Na máquina de Clayton a "caixa de entrada" é uma consulta: o
-- fluxo de confirmar e-mail / recuperar senha é exercitável ponta a ponta lendo o token da linha,
-- exatamente como um usuário leria do e-mail. Em produção, plugar SES/SendGrid drena a fila —
-- nenhum caminho de código muda. Mesma forma da resposta do dinheiro: mecanismo real, última
-- milha pendente, estado honesto.
--
-- ⚠️ `sent_at` só é preenchido por provider que CONFIRMOU entrega. Status `sent` sem `sent_at`
-- seria a mesma mentira do `return { success: true }` que este arco está consertando.
--
-- Nomenclatura (07_NOMENCLATURA_CANONICA): `_at` + TIMESTAMPTZ nos tempos; status em snake_case
-- MINÚSCULO (§4.11); sem dinheiro nenhum nesta tabela (não é assunto do Bank).
-- Lei 2: forward-only. RLS por tenant, como o resto do runtime.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.notify_queue (
  notification_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Destinatário interno quando existe. NULO é legítimo: convite/recuperação podem preceder o
  -- usuário (é justamente o caso de "confirmar e-mail" antes de haver conta confirmada).
  user_id          UUID NULL,
  channel          TEXT NOT NULL,
  template_name    TEXT NULL,
  -- Endereço de entrega (e-mail, telefone, URL de webhook) — depende do canal.
  target           TEXT NOT NULL,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  status           TEXT NOT NULL DEFAULT 'pending',
  retry_count      INTEGER NOT NULL DEFAULT 0,
  max_retries      INTEGER NOT NULL DEFAULT 5,
  scheduled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 🔴 Só preenchido por provider que CONFIRMOU. Ver o CHECK de coerência abaixo.
  sent_at          TIMESTAMPTZ NULL,
  last_error       TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Vocabulários LIDOS de notify.types.ts, não inventados aqui.
  CONSTRAINT chk_notify_queue_channel
    CHECK (channel IN ('email', 'sms', 'push', 'webhook', 'in_app')),
  CONSTRAINT chk_notify_queue_status
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'canceled')),
  -- 🔴 A TRAVA QUE IMPEDE A MENTIRA: `sent` exige `sent_at`. Não dá para marcar entregue sem
  -- registrar QUANDO — que é exatamente o que o provider stub fazia ao devolver success:true.
  CONSTRAINT chk_notify_queue_sent_requires_timestamp
    CHECK (status <> 'sent' OR sent_at IS NOT NULL),
  CONSTRAINT chk_notify_queue_retry_within_max
    CHECK (retry_count >= 0 AND retry_count <= max_retries)
);

-- O worker busca pendentes vencidas por tenant, em ordem de agendamento.
CREATE INDEX IF NOT EXISTS idx_notify_queue_pending
  ON public.notify_queue (tenant_id, status, scheduled_at)
  WHERE status IN ('pending', 'processing');

-- Consulta humana de desenvolvimento: "qual o último e-mail para este endereço?"
CREATE INDEX IF NOT EXISTS idx_notify_queue_target
  ON public.notify_queue (tenant_id, target, created_at DESC);

ALTER TABLE public.notify_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notify_queue FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notify_queue_tenant_isolation ON public.notify_queue;
CREATE POLICY notify_queue_tenant_isolation ON public.notify_queue
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMIT;
