# Teste Direto - Verificar se os dados estão sendo salvos

Execute estes comandos SQL diretamente no PostgreSQL para verificar:

## 1. Ver todos os global_users ordenados por data de atualização

```sql
SELECT 
  global_user_id,
  full_name,
  birthdate,
  updated_at,
  created_at
FROM global_users
ORDER BY updated_at DESC
LIMIT 10;
```

## 2. Ver links entre users e global_users

```sql
SELECT 
  u.user_id,
  u.email,
  u.global_user_id as users_global_user_id,
  uil.global_user_id as links_global_user_id,
  gu.full_name,
  gu.birthdate,
  gu.updated_at
FROM users u
LEFT JOIN user_identity_links uil ON u.user_id = uil.user_id
LEFT JOIN global_users gu ON COALESCE(u.global_user_id, uil.global_user_id) = gu.global_user_id
ORDER BY gu.updated_at DESC NULLS LAST
LIMIT 10;
```

## 3. Buscar um global_user específico por ID

Substitua `SEU_GLOBAL_USER_ID_AQUI` pelo ID que aparece nos logs do backend:

```sql
SELECT 
  global_user_id,
  full_name,
  birthdate,
  updated_at,
  created_at
FROM global_users
WHERE global_user_id = 'SEU_GLOBAL_USER_ID_AQUI';
```

## 4. Verificar qual global_user_id está associado ao seu usuário

Substitua `SEU_EMAIL_AQUI` pelo seu email:

```sql
SELECT 
  u.user_id,
  u.email,
  u.global_user_id as users_global_user_id,
  uil.global_user_id as links_global_user_id,
  gu.global_user_id,
  gu.full_name,
  gu.birthdate,
  gu.updated_at
FROM users u
LEFT JOIN user_identity_links uil ON u.user_id = uil.user_id
LEFT JOIN global_users gu ON COALESCE(u.global_user_id, uil.global_user_id) = gu.global_user_id
WHERE u.email = 'SEU_EMAIL_AQUI';
```













