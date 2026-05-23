import type { FastifyReply } from 'fastify';
import { SemanticResolutionError } from './semantic.errors';

export function isSemanticResolutionError(err: unknown): err is SemanticResolutionError {
  return err instanceof SemanticResolutionError;
}

/**
 * Resposta HTTP para falha de resolução semântica (domínio/dados, não bug de sistema).
 * O serviço já regista o erro; não duplicar log na rota.
 */
export function replySemanticResolutionFailure(
  reply: FastifyReply,
  err: SemanticResolutionError
): FastifyReply {
  return reply.status(422).send({
    error: 'semantic_resolution_failed',
    code: err.type,
    message: 'Unable to resolve semantic relation for request',
    details: err.resolutionContext,
  });
}