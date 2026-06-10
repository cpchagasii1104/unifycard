// Validação de elegibilidade do actor como unidade operacional de estoque (FASE E — modelo oficial).
import { runQueryWithTenant } from '@core/database/pool';

/**
 * Garante que o actor existe no tenant e pode ser usado como local de stock.
 * Critério: vínculo empresarial material (company_id) OU tipo legado 'company' OU
 * merchant em oferta OU loja em ativação OU participante de pedido no tenant.
 *
 * DECISION-0116 adendo (Decisão 2 Clayton 2026-06-10): o critério empresarial canônico é
 * actors.company_id IS NOT NULL — o page-actor da PJ é elegível pelo VÍNCULO material com
 * a empresa, não pelo rótulo do tipo. actor_type='page' isoladamente NÃO é critério
 * (páginas de grupo/evento sem company_id continuam inelegíveis). Tipo legado 'company'
 * preservado sem regressão; demais critérios comerciais mantidos para actors não empresariais.
 */
export async function assertInventoryUnitActorEligible(
  tenantId: string,
  actorId: string
): Promise<void> {
  const row = await runQueryWithTenant<{ ok: boolean }>(
    tenantId,
    `
    SELECT EXISTS (
      SELECT 1
      FROM actors a
      WHERE a.tenant_id = $1 AND a.id = $2
        AND (
          a.company_id IS NOT NULL
          OR a.actor_type = 'company'
          OR EXISTS (
            SELECT 1 FROM product_offers po
            WHERE po.tenant_id = a.tenant_id AND po.merchant_id = a.id
          )
          OR EXISTS (
            SELECT 1 FROM store_product_activations spa
            WHERE spa.tenant_id = a.tenant_id AND spa.store_id = a.id
          )
          OR EXISTS (
            SELECT 1 FROM orders o
            WHERE o.tenant_id = a.tenant_id
              AND (o.seller_actor_id = a.id OR o.buyer_actor_id = a.id)
          )
          OR EXISTS (
            SELECT 1 FROM purchase_orders po
            WHERE po.tenant_id = a.tenant_id AND po.created_by_actor_id = a.id
          )
          OR EXISTS (
            SELECT 1 FROM stock_transfers st
            WHERE st.tenant_id = a.tenant_id
              AND (st.from_actor_id = a.id OR st.to_actor_id = a.id)
          )
        )
    ) AS ok
    `,
    [tenantId, actorId]
  );

  if (!row?.ok) {
    throw new Error(
      `Actor não encontrado no tenant ou não elegível como unidade de estoque: ${actorId}`
    );
  }
}