/**
 * WRITER ÚNICO DE ACTORS — §4.8 LEI_COERENCIA_SISTEMICA_UNIFICARD
 *
 * Toda criação de actor passa por aqui.
 * Nenhum módulo de produto chama actor.repository diretamente para criar actors.
 *
 * Dívida técnica consciente: socialPortsRegistry permanece como engine —
 * acoplamento semântico com social a resolver em RFC futura.
 */
import { socialPortsRegistry } from '@core/social/ports-registry';

/**
 * Garante que existe um actor humano para este userId.
 * Idempotente — seguro chamar múltiplas vezes.
 * NÃO deve ser chamado dentro de transação ativa (usa runQueryWithTenant interno).
 */
export async function ensureUserActor(tenantId: string, userId: string) {
  const repo = socialPortsRegistry.getActorRepository();
  return repo.findOrCreateUserActor(tenantId, userId);
}

/**
 * Garante que existe um actor 'page' para esta empresa.
 * Idempotente — seguro chamar múltiplas vezes.
 * responsibleActorId: actor_id do humano (CPF) que criou a empresa.
 * OBRIGATÓRIO — nenhuma empresa existe sem âncora humana (§4.8.2).
 */
export async function ensurePageActor(
  tenantId: string,
  companyId: string,
  responsibleActorId: string
) {
  const repo = socialPortsRegistry.getActorRepository();
  return repo.findOrCreatePageActor(tenantId, companyId, responsibleActorId);
}