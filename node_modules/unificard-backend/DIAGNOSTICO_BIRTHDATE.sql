-- DIAGNÓSTICO: Problema de birthdate não persistir
-- Execute este arquivo para identificar a causa raiz

-- 1. Verificar últimos global_users atualizados
SELECT
  'ÚLTIMOS REGISTROS' as tipo,
  gu.global_user_id,
  gu.full_name,
  gu.birthdate,
  gu.created_at,
  gu.updated_at,
  (SELECT COUNT(*) FROM user_identity_links WHERE global_user_id = gu.global_user_id) as qtd_links
FROM global_users gu
ORDER BY gu.updated_at DESC
LIMIT 10;

-- 2. Verificar se há usuários com MÚLTIPLOS global_users (PROBLEMA!)
SELECT
  'MÚLTIPLOS GLOBAL_USERS' as tipo,
  u.user_id,
  u.email,
  u.global_user_id as global_user_id_na_tabela_users,
  COUNT(DISTINCT uil.global_user_id) as qtd_global_users_diferentes,
  ARRAY_AGG(DISTINCT uil.global_user_id) as todos_global_user_ids
FROM users u
LEFT JOIN user_identity_links uil ON u.user_id = uil.user_id
WHERE uil.global_user_id IS NOT NULL
GROUP BY u.user_id, u.email, u.global_user_id
HAVING COUNT(DISTINCT uil.global_user_id) > 1;

-- 3. Verificar se users.global_user_id está DESSINCRONIZADO com user_identity_links
SELECT
  'DESSINCRONIZAÇÃO' as tipo,
  u.user_id,
  u.email,
  u.global_user_id as global_id_na_users,
  uil.global_user_id as global_id_na_links,
  CASE
    WHEN u.global_user_id IS NULL THEN 'users.global_user_id está NULL'
    WHEN uil.global_user_id IS NULL THEN 'Sem link em user_identity_links'
    WHEN u.global_user_id != uil.global_user_id THEN 'DESSINCRONIZADO - IDs DIFERENTES!'
    ELSE 'OK'
  END as status
FROM users u
LEFT JOIN user_identity_links uil ON u.user_id = uil.user_id AND u.tenant_id = uil.tenant_id
WHERE u.global_user_id IS DISTINCT FROM uil.global_user_id
LIMIT 20;

-- 4. Verificar se há global_users SEM NENHUM link (órfãos)
SELECT
  'GLOBAL_USERS ÓRFÃOS' as tipo,
  gu.global_user_id,
  gu.full_name,
  gu.birthdate,
  gu.created_at,
  gu.updated_at,
  (SELECT COUNT(*) FROM user_identity_links WHERE global_user_id = gu.global_user_id) as qtd_links,
  (SELECT COUNT(*) FROM users WHERE global_user_id = gu.global_user_id) as qtd_users_diretos
FROM global_users gu
WHERE NOT EXISTS (
  SELECT 1 FROM user_identity_links uil WHERE uil.global_user_id = gu.global_user_id
)
ORDER BY gu.updated_at DESC
LIMIT 10;

-- 5. Para um usuário específico (substitua o email), ver TODOS os global_users associados
-- DESCOMENTAR E SUBSTITUIR O EMAIL PARA TESTAR:
-- SELECT
--   'HISTÓRICO DO USUÁRIO' as tipo,
--   u.user_id,
--   u.email,
--   u.global_user_id as global_id_direto,
--   uil.global_user_id as global_id_via_link,
--   gu.full_name,
--   gu.birthdate,
--   gu.created_at as global_user_criado_em,
--   gu.updated_at as global_user_atualizado_em,
--   uil.created_at as link_criado_em
-- FROM users u
-- LEFT JOIN user_identity_links uil ON u.user_id = uil.user_id
-- LEFT JOIN global_users gu ON uil.global_user_id = gu.global_user_id
-- WHERE u.email = 'SEU_EMAIL_AQUI@example.com'
-- ORDER BY gu.updated_at DESC;
