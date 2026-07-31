// backend/src/modules/venue/venue-menu.service.ts
// SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

import { venueMenuRepository } from './venue-menu.repository';
import type {
  Menu,
  MenuItem,
  CreateMenuInput,
  AddMenuItemInput,
  MenuWithItems,
} from './venue-menu.types';

/**
 * Service para Menus de Estabelecimento
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Menu NÃO executa economia
 * - Menu apenas organiza produtos para exibição
 * - Disponibilidade usa pricing e estoque existentes
 */
class VenueMenuService {
  async createMenu(
    tenantId: string,
    actorId: string,
    input: CreateMenuInput
  ): Promise<Menu> {
    const menu = await venueMenuRepository.createMenu(tenantId, {
      ...input,
      actorId,
    });

    await this.recordAudit(tenantId, {
      eventType: 'MENU_CREATED',
      menuId: menu.id,
      actorId,
      name: menu.name,
    });

    return menu;
  }

  async addMenuItem(
    tenantId: string,
    menuId: string,
    input: AddMenuItemInput
  ): Promise<MenuItem> {
    // Validar menu existe
    const menu = await venueMenuRepository.getMenuById(tenantId, menuId);
    if (!menu) {
      throw new Error(`Menu não encontrado: ${menuId}`);
    }

    // Validar variante existe
    const { productVariantRepository } = await import('../marketplace/product-variant.repository');
    const variant = await productVariantRepository.getVariantById(tenantId, input.productVariantId);
    if (!variant) {
      throw new Error(`Variante não encontrada: ${input.productVariantId}`);
    }

    const item = await venueMenuRepository.addMenuItem(tenantId, menuId, input);

    await this.recordAudit(tenantId, {
      eventType: 'MENU_ITEM_ADDED',
      menuId,
      itemId: item.id,
      productVariantId: input.productVariantId,
    });

    return item;
  }

  async setItemAvailability(
    tenantId: string,
    itemId: string,
    isAvailable: boolean
  ): Promise<void> {
    const item = await venueMenuRepository.getMenuItemById(tenantId, itemId);
    if (!item) {
      throw new Error(`Item não encontrado: ${itemId}`);
    }

    await venueMenuRepository.updateItemAvailability(tenantId, itemId, isAvailable);

    await this.recordAudit(tenantId, {
      eventType: 'MENU_ITEM_AVAILABILITY_CHANGED',
      itemId,
      menuId: item.menuId,
      isAvailable,
    });
  }

  /**
   * Lista menu ativo com itens e informações de pricing/estoque
   */
  async listActiveMenu(tenantId: string, actorId: string): Promise<MenuWithItems> {
    const menu = await venueMenuRepository.getActiveMenuByActor(tenantId, actorId);
    if (!menu) {
      throw new Error(`Menu ativo não encontrado para actor: ${actorId}`);
    }

    const items = await venueMenuRepository.getMenuItems(tenantId, menu.id);

    return {
      ...menu,
      items,
    };
  }

  private async recordAudit(tenantId: string, data: Record<string, unknown>): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      const eventType = (typeof data.eventType === 'string' ? data.eventType : 'MENU_EVENT');
      const context: Record<string, unknown> = { ...data };
      const input: import('@core/audit/audit.service').AuditEventInput = {
        event_type: eventType,
        severity: 'INFO',
        source: 'impact',
        context,
      };
      if (typeof data.actorId === 'string') input.actor_id = data.actorId;
      await auditService.record(tenantId, input);
    } catch (error) {
      console.warn('[VenueMenuService] Erro ao registrar auditoria:', error);
    }
  }
}

export const venueMenuService = new VenueMenuService();





