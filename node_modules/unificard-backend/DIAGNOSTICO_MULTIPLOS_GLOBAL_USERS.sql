-- DIAGNOSTICO_MULTIPLOS_GLOBAL_USERS.sql
-- Script para detectar múltiplos global_users para o mesmo usuário
-- Execute este script para investigar dessincronização de identidade global

-- 1. Detectar usuários com múltiplos global_users
SELECT 
  u.user_id,
  u.email,
  u.tenant_id,
  COUNT(DISTINCT uil.global_user_id) as global_users_count,
  array_agg(DISTINCT uil.global_user_id) as global_user_ids,
  array_agg(DISTINCT uil.created_at ORDER BY uil.created_at DESC) as link_created_dates
FROM users u
LEFT JOIN user_identity_links uil ON u.user_id = uil.user_id AND u.tenant_id = uil.tenant_id
GROUP BY u.user_id, u.email, u.tenant_id
HAVING COUNT(DISTINCT uil.global_user_id) > 1
ORDER BY global_users_count DESC;

-- 2. Detectar dessincronização entre users.global_user_id e user_identity_links
SELECT 
  u.user_id,
  u.email,
  u.tenant_id,
  u.global_user_id as global_user_id_in_users,
  uil.global_user_id as global_user_id_in_links,
  uil.created_at as link_created_at,
  CASE 
    WHEN u.global_user_id IS NULL AND uil.global_user_id IS NOT NULL THEN 'users.global_user_id NULL mas link existe'
    WHEN u.global_user_id IS NOT NULL AND uil.global_user_id IS NULL THEN 'users.global_user_id existe mas link não existe'
    WHEN u.global_user_id != uil.global_user_id THEN 'DESSINCRONIZAÇÃO: IDs diferentes'
    ELSE 'OK'
  END as status
FROM users u
LEFT JOIN user_identity_links uil ON u.user_id = uil.user_id AND u.tenant_id = uil.tenant_id
WHERE 
  (u.global_user_id IS NULL AND uil.global_user_id IS NOT NULL)
  OR (u.global_user_id IS NOT NULL AND uil.global_user_id IS NULL)
  OR (u.global_user_id != uil.global_user_id)
ORDER BY u.user_id, uil.created_at DESC;

-- 3. Detectar global_users órfãos (sem link)
SELECT 
  gu.global_user_id,
  gu.full_name,
  gu.birthdate,
  gu.created_at,
  gu.updated_at,
  COUNT(uil.id) as links_count
FROM global_users gu
LEFT JOIN user_identity_links uil ON gu.global_user_id = uil.global_user_id
GROUP BY gu.global_user_id, gu.full_name, gu.birthdate, gu.created_at, gu.updated_at
HAVING COUNT(uil.id) = 0
ORDER BY gu.created_at DESC;

-- 4. Detectar links duplicados (mesmo user_id + tenant_id com diferentes global_user_id)
SELECT 
  uil1.user_id,
  uil1.tenant_id,
  COUNT(*) as duplicate_count,
  array_agg(DISTINCT uil1.global_user_id) as global_user_ids,
  array_agg(uil1.created_at ORDER BY uil1.created_at DESC) as created_dates
FROM user_identity_links uil1
GROUP BY uil1.user_id, uil1.tenant_id
HAVING COUNT(DISTINCT uil1.global_user_id) > 1
ORDER BY duplicate_count DESC;

-- 5. Verificar birthdate em múltiplos global_users do mesmo usuário
SELECT 
  u.user_id,
  u.email,
  uil.global_user_id,
  gu.birthdate,
  gu.full_name,
  gu.updated_at,
  uil.created_at as link_created_at,
  ROW_NUMBER() OVER (PARTITION BY u.user_id, u.tenant_id ORDER BY uil.created_at DESC) as link_order
FROM users u
JOIN user_identity_links uil ON u.user_id = uil.user_id AND u.tenant_id = uil.tenant_id
JOIN global_users gu ON uil.global_user_id = gu.global_user_id
WHERE u.user_id IN (
  SELECT user_id 
  FROM user_identity_links 
  GROUP BY user_id, tenant_id 
  HAVING COUNT(DISTINCT global_user_id) > 1
)
ORDER BY u.user_id, link_order;


