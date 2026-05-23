/**
 * Valores permitidos em `actors.actor_type` (migration 0064 + evoluções alinhadas ao DDL).
 * Manter sincronizado com o CHECK em `0064_add_user_id_to_actors.sql`.
 */
export type ActorTypeDb =
  | 'user'
  | 'page'
  | 'group'
  | 'channel'
  | 'actor_human'
  | 'actor_organizational'
  | 'actor_system'
  | 'person'
  | 'company'
  | 'system';