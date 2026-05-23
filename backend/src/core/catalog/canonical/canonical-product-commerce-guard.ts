import { BadRequestError } from '@core/errors';
import { canonicalProductService } from './canonical-product.service';

/**
 * Bloqueia uso comercial de `tenant_products` ligados a canónico INDUSTRIAL ainda não READY.
 * Não altera SSOT; reutiliza `operationalReady` do serviço canónico.
 */
export async function assertMarketplaceProductCanonicalOperationalReady(
  tenantId: string,
  product: { canonicalProductId?: string | null }
): Promise<void> {
  const cid = product.canonicalProductId;
  if (cid == null || String(cid).trim() === '') {
    return;
  }
  const cp = await canonicalProductService.findById(tenantId, String(cid).trim(), {
    includeNonReady: true,
  });
  if (!cp) {
    const err = new BadRequestError('Produto canónico associado não encontrado');
    (err as { code?: string }).code = 'CANONICAL_PRODUCT_NOT_FOUND';
    throw err;
  }
  if (!cp.operationalReady) {
    const err = new BadRequestError(
      'Produto canónico ainda não está operacionalmente pronto (conceito confirmado e campos mínimos).'
    );
    (err as { code?: string }).code = 'CANONICAL_NOT_OPERATIONALLY_READY';
    throw err;
  }
}