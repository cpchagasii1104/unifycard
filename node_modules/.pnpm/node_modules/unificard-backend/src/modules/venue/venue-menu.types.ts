// backend/src/modules/venue/venue-menu.types.ts
// SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

export interface Menu {
  id: string;
  tenantId: string;
  actorId: string;
  name: string;
  isActive: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface MenuItem {
  id: string;
  tenantId: string;
  menuId: string;
  productVariantId: string;
  displayName: string;
  description: string | null;
  isAvailable: boolean;
  sortOrder: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface CreateMenuInput {
  actorId: string;
  name: string;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface AddMenuItemInput {
  productVariantId: string;
  displayName: string;
  description?: string;
  isAvailable?: boolean;
  sortOrder?: number;
  metadata?: Record<string, any>;
}

export interface MenuWithItems extends Menu {
  items: MenuItem[];
}





