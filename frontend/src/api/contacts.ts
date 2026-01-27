// src/api/contacts.ts
// SPRINT 0: API de Contacts
import { apiFetch, apiFetchJson } from './client';

export interface Contact {
  id: string;
  tenantId: string;
  type: 'PERSON' | 'COMPANY';
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  userId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactInput {
  type: 'PERSON' | 'COMPANY';
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  userId?: string | null;
  metadata?: Record<string, any>;
}

export interface UpdateContactInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  metadata?: Record<string, any>;
}

export interface ContactFilters {
  type?: 'PERSON' | 'COMPANY';
  taxId?: string;
  email?: string;
  phone?: string;
  userId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listContacts(filters?: ContactFilters): Promise<Contact[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.append('type', filters.type);
  if (filters?.taxId) params.append('taxId', filters.taxId);
  if (filters?.email) params.append('email', filters.email);
  if (filters?.phone) params.append('phone', filters.phone);
  if (filters?.userId) params.append('userId', filters.userId);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const response = await apiFetch(`/marketplace/contacts?${params.toString()}`);
  const data = await response.json();
  return data.contacts || [];
}

export async function getContactById(contactId: string): Promise<Contact> {
  const response = await apiFetch(`/marketplace/contacts/${contactId}`);
  const data = await response.json();
  return data.contact;
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  return apiFetchJson('/marketplace/contacts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateContact(contactId: string, input: UpdateContactInput): Promise<Contact> {
  return apiFetchJson(`/marketplace/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function searchContacts(filters: { taxId?: string; email?: string; phone?: string }): Promise<Contact[]> {
  const params = new URLSearchParams();
  if (filters.taxId) params.append('taxId', filters.taxId);
  if (filters.email) params.append('email', filters.email);
  if (filters.phone) params.append('phone', filters.phone);

  const response = await apiFetch(`/marketplace/contacts/search?${params.toString()}`);
  const data = await response.json();
  return data.contacts || [];
}





