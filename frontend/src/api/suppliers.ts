// src/api/suppliers.ts
// F-CRM-PROJECTION-SUPPLIERS-RECONCILIATION (Fatia 7) — client do fornecedor VIVO (ERP), com a
// ponte pra actor (actorId, nullable). Quando actorId é null, o fornecedor é off-platform
// (registro digitado); quando setado, é o MESMO actor referenciado pela aresta de relação
// (actor_relationships label=fornecedor) — "um dado, N vistas".

import { apiFetchJson } from './client';

export type SupplierStatus = 'active' | 'inactive';

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  taxId: string | null;
  status: SupplierStatus;
  ownerActorId: string;
  actorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierInput {
  name: string;
  actorId?: string | null;
  email?: string;
  phone?: string;
  contactName?: string;
  taxId?: string;
}

export async function listSuppliers(filters?: { status?: SupplierStatus; search?: string }): Promise<Supplier[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);
  const q = params.toString();
  const res = await apiFetchJson<{ suppliers: Supplier[] }>(`/marketplace/suppliers${q ? `?${q}` : ''}`);
  return res.suppliers;
}

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  return apiFetchJson<Supplier>('/marketplace/suppliers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
