// backend/src/modules/venue/venue-menu.repository.ts
// SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Menu,
  MenuItem,
  CreateMenuInput,
  AddMenuItemInput,
} from './venue-menu.types';

interface MenuRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  name: string;
  is_active: boolean;
  metadata: any;
  createdAt: Date;
}

interface MenuItemRow {
  id: string;
  tenant_id: string;
  menu_id: string;
  product_variant_id: string;
  display_name: string;
  description: string | null;
  is_available: boolean;
  sort_order: number;
  metadata: any;
  createdAt: Date;
}

class VenueMenuRepository {
  private toMenu(row: MenuRow): Menu {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      name: row.name,
      isActive: row.is_active,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toMenuItem(row: MenuItemRow): MenuItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      menuId: row.menu_id,
      productVariantId: row.product_variant_id,
      displayName: row.display_name,
      description: row.description,
      isAvailable: row.is_available,
      sortOrder: row.sort_order,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
    };
  }

  async createMenu(tenantId: string, input: CreateMenuInput): Promise<Menu> {
    const row = await runQueryWithTenant<MenuRow>(
      tenantId,
      `
      INSERT INTO menus (tenant_id, actor_id, name, is_active, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id, tenant_id, actor_id, name, is_active, metadata, createdAt
      `,
      [
        tenantId,
        input.actorId,
        input.name,
        input.isActive !== undefined ? input.isActive : true,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar menu');
    }

    return this.toMenu(row);
  }

  async getMenuById(tenantId: string, menuId: string): Promise<Menu | null> {
    const row = await runQueryWithTenant<MenuRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, name, is_active, metadata, createdAt
      FROM menus
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, menuId]
    );

    return row ? this.toMenu(row) : null;
  }

  async getActiveMenuByActor(tenantId: string, actorId: string): Promise<Menu | null> {
    const row = await runQueryWithTenant<MenuRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, name, is_active, metadata, createdAt
      FROM menus
      WHERE tenant_id = $1 AND actor_id = $2 AND is_active = true
      ORDER BY createdAt DESC
      LIMIT 1
      `,
      [tenantId, actorId]
    );

    return row ? this.toMenu(row) : null;
  }

  async addMenuItem(tenantId: string, menuId: string, input: AddMenuItemInput): Promise<MenuItem> {
    const row = await runQueryWithTenant<MenuItemRow>(
      tenantId,
      `
      INSERT INTO menu_items (
        menu_id, product_variant_id, display_name, description,
        is_available, sort_order, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING id, tenant_id, menu_id, product_variant_id, display_name, description,
                is_available, sort_order, metadata, createdAt
      `,
      [
        menuId,
        input.productVariantId,
        input.displayName,
        input.description || null,
        input.isAvailable !== undefined ? input.isAvailable : true,
        input.sortOrder || 0,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao adicionar item ao menu');
    }

    return this.toMenuItem(row);
  }

  async getMenuItems(tenantId: string, menuId: string): Promise<MenuItem[]> {
    const rows = await runQueriesWithTenant<MenuItemRow>(
      tenantId,
      `
      SELECT id, tenant_id, menu_id, product_variant_id, display_name, description,
             is_available, sort_order, metadata, createdAt
      FROM menu_items
      WHERE tenant_id = $1 AND menu_id = $2
      ORDER BY sort_order ASC, createdAt ASC
      `,
      [tenantId, menuId]
    );

    return rows.map((row) => this.toMenuItem(row));
  }

  async updateItemAvailability(
    tenantId: string,
    itemId: string,
    isAvailable: boolean
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE menu_items
      SET is_available = $1
      WHERE tenant_id = $2 AND id = $3
      `,
      [isAvailable, tenantId, itemId]
    );
  }

  async getMenuItemById(tenantId: string, itemId: string): Promise<MenuItem | null> {
    const row = await runQueryWithTenant<MenuItemRow>(
      tenantId,
      `
      SELECT id, tenant_id, menu_id, product_variant_id, display_name, description,
             is_available, sort_order, metadata, createdAt
      FROM menu_items
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, itemId]
    );

    return row ? this.toMenuItem(row) : null;
  }
}

export const venueMenuRepository = new VenueMenuRepository();







