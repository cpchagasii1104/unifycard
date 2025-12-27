// src/config/auth.ts
// Gerenciamento de autenticação - localStorage simples

const TOKEN_KEY = 'unificard_access_token';
const TENANT_KEY = 'unificard_tenant_id';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TENANT_KEY);
}

export function getTenantId(): string | null {
  return localStorage.getItem(TENANT_KEY);
}

export function setTenantId(tenantId: string): void {
  localStorage.setItem(TENANT_KEY, tenantId);
}

export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}






