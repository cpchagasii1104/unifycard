// PIX Webhook — POST /gateway/pix/webhook
// Recebe webhook PIX e enfileira PaymentEvent via pix-adapter (idempotência DB-level).
// R4 (auditoria estrutural 2026-05-18): HMAC verification + fail-closed em produção.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { createHmac, timingSafeEqual } from 'crypto';
import { handlePixWebhook } from '../../adapters/pix/pix-adapter';
import { canonicalLogger } from '../../core/logging/canonical-logger';

const HMAC_SECRET_ENV = 'PIX_WEBHOOK_HMAC_SECRET';
const SIGNATURE_HEADER = 'x-pix-signature';

type HmacVerdict = 'valid' | 'invalid' | 'no_secret';

/**
 * Recupera raw body do request. Fastify por default NÃO preserva rawBody — em
 * produção real, exige contentTypeParser configurado para o provider PIX.
 * Fallback usa JSON.stringify(req.body) que pode divergir do payload original
 * (key ordering, espaços) — funcional em dev, frágil em prod sem rawBody parser.
 */
function getRawBody(req: FastifyRequest): string {
  const maybeRaw = (req as unknown as { rawBody?: string | Buffer }).rawBody;
  if (typeof maybeRaw === 'string') return maybeRaw;
  if (maybeRaw instanceof Buffer) return maybeRaw.toString('utf8');
  return JSON.stringify(req.body ?? {});
}

/**
 * Verifica HMAC SHA-256 do body com secret. Comparação timing-safe.
 *
 * Retornos:
 *  - 'valid'      → assinatura confere
 *  - 'invalid'    → assinatura ausente OU não confere
 *  - 'no_secret'  → secret não configurado no env (decisão de aceitar/rejeitar fica
 *                   a cargo do caller conforme NODE_ENV)
 */
function verifyHmac(
  rawBody: string,
  providedSig: string | undefined,
  secret: string | undefined
): HmacVerdict {
  if (!secret) return 'no_secret';
  if (!providedSig || providedSig.length === 0) return 'invalid';
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const provBuf = Buffer.from(providedSig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (provBuf.length !== expBuf.length) return 'invalid';
  return timingSafeEqual(provBuf, expBuf) ? 'valid' : 'invalid';
}

const pixWebhookController: FastifyPluginAsync = async (app) => {
  app.post('/pix/webhook', async (req, reply) => {
    // Política R4:
    // - secret presente + assinatura válida   → prossegue
    // - secret presente + assinatura inválida → 401 (sempre, mesmo em dev)
    // - secret ausente + NODE_ENV='production' → 503 fail-closed automático
    // - secret ausente + NODE_ENV != production → permissivo + log warning (dev)
    const secret = process.env[HMAC_SECRET_ENV];
    const sigHeader = req.headers[SIGNATURE_HEADER];
    const providedSig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    const rawBody = getRawBody(req);
    const verdict = verifyHmac(rawBody, providedSig, secret);

    if (verdict === 'no_secret') {
      if (process.env.NODE_ENV === 'production') {
        canonicalLogger.error(null, 'pix_webhook_rejected_no_secret_in_prod', {
          event: 'PIX_WEBHOOK_SECURITY',
          reason: 'PIX_WEBHOOK_HMAC_SECRET not configured in production',
        });
        return reply.status(503).send({
          status: 'rejected',
          error: 'PIX webhook misconfigured: HMAC secret missing in production',
        });
      }
      canonicalLogger.warn(null, 'pix_webhook_no_hmac_secret_in_dev', {
        event: 'PIX_WEBHOOK_SECURITY',
        env: process.env.NODE_ENV ?? 'undefined',
        message: 'Webhook aceito sem verificação HMAC (NODE_ENV != production).',
      });
    } else if (verdict === 'invalid') {
      canonicalLogger.warn(null, 'pix_webhook_invalid_signature', {
        event: 'PIX_WEBHOOK_SECURITY',
        env: process.env.NODE_ENV ?? 'undefined',
      });
      return reply.status(401).send({
        status: 'rejected',
        error: 'Invalid HMAC signature',
      });
    }

    try {
      await handlePixWebhook(req.body);
      return reply.status(200).send({
        status: 'accepted',
        event: 'PIX_PAYMENT_CONFIRMED',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({
        status: 'rejected',
        error: message,
      });
    }
  });
};

export default pixWebhookController;
