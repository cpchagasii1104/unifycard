-- 20260729160000_auth_rate_limit_logs.sql
-- DT-AUTH-RATE-LIMIT-FAIL-OPEN-SUBSTRATE-AUSENTE: cria o substrato que
-- src/core/rate-limiting/auth-rate-limit.service.ts sempre esperou. A tabela nunca existiu
-- (0 linhas em pg_class, zero CREATE TABLE em migrations) — o serviço engolia o 42P01
-- resultante e devolvia allowed:true sempre (fail-open silencioso, ver Tarefa 2 no código).
-- Endpoints afetados (pré-autenticação, sem requirePermission na frente): auth.login,
-- auth.register, auth.check-cpf, auth.check-referral, auth.webauthn.verify, auth.refresh.

BEGIN;

CREATE TABLE IF NOT EXISTS auth_rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_type TEXT NOT NULL,
  action TEXT NOT NULL,
  key_value TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cobre exatamente o WHERE de countByKey (key_type = $1 AND action = $2 AND key_value = $3
-- AND attempted_at >= $4) — sem este índice, todo login vira full scan da tabela de logs.
CREATE INDEX IF NOT EXISTS idx_auth_rate_limit_logs_lookup
  ON auth_rate_limit_logs (key_type, action, key_value, attempted_at);

COMMENT ON TABLE auth_rate_limit_logs IS
  'Log de tentativas para rate limiting PRÉ-autenticação (brute force / spam / scraping em
   login, register, check-cpf, check-referral, webauthn.verify, refresh). SEM RLS — decisão
   deliberada, não esquecimento: (1) o serviço lê via pool.query cru, sem GUC de tenant
   (auth-rate-limit.service.ts countByKey/recordAttempt) — RLS aqui faria toda contagem
   voltar 0 e o fail-open continuaria idêntico, só que invisível, sem 42P01 para denunciar;
   seria conserto decorativo. (2) a tabela é chaveada por IP e e-mail, que existem ANTES de
   qualquer tenant resolvido — não há app.current_tenant no momento em que este código roda.
   Precedente no schema: users também não tem RLS. Se algum dia esta tabela ganhar RLS,
   confirme primeiro que countByKey passou a rodar sob tenant-context — do contrário o
   rate limit volta a ficar sempre aberto, silenciosamente.';

COMMIT;
