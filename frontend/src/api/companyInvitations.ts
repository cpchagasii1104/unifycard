// src/api/companyInvitations.ts
// DECISION-0189 (F5) — Client API do convite/aceite canônico de membership.
// O convite é o ÚNICO caminho (além do bootstrap) que cria membro ativo (R17).
// A UI NUNCA envia coluna/role como autoridade — só PermissionKeys do catálogo convidável;
// o servidor aplica os DOIS TETOS e revalida tudo no aceite. Token: exibido UMA vez,
// nunca armazenado em storage/analytics.

import { apiFetchJson } from './client';

/** Chaves CONVIDÁVEIS do catálogo v2 (espelho do backend; o servidor é a autoridade). */
export const INVITABLE_PERMISSION_KEYS = [
  { key: 'publish_feed', label: 'Publicar no feed da empresa' },
  { key: 'interact_feed', label: 'Reagir e comentar no feed da empresa' },
  { key: 'create_events', label: 'Criar eventos da empresa' },
  { key: 'view_financial', label: 'Ver saldo/extrato da empresa' },
  { key: 'company:manage_employees', label: 'Administrar operação de empregados' },
  { key: 'company:manage_services', label: 'Administrar catálogo de serviços' },
  { key: 'company:view_reports', label: 'Ver relatórios operacionais' },
] as const;

export interface CompanyInvitation {
  id: string;
  company_id: string;
  invitee_global_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  catalog_version: number;
  expires_at: string;
  created_at: string;
  permission_keys: string[];
}

export async function lookupInviteeByReferralCode(
  companyId: string,
  referralCode: string
): Promise<{ globalUserId: string; displayName: string | null }> {
  const res = await apiFetchJson<{ ok: boolean; data: { globalUserId: string; displayName: string | null } }>(
    `/companies/${companyId}/invitations/lookup`,
    { method: 'POST', body: JSON.stringify({ referralCode }) }
  );
  return res.data;
}

export async function createCompanyInvitation(
  companyId: string,
  input: { inviteeGlobalUserId: string; permissionKeys: string[] }
): Promise<{ invitationId: string; status: string; expiresAt: string; token: string | null; idempotentReplay: boolean }> {
  const res = await apiFetchJson<{ ok: boolean; data: { invitationId: string; status: string; expiresAt: string; token: string | null; idempotentReplay: boolean } }>(
    `/companies/${companyId}/invitations`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        // chave OPACA nova por intenção (R14) — replays de rede idempotentes via retry do fetch
        idempotencyKey: crypto.randomUUID(),
      }),
    }
  );
  return res.data;
}

export async function listCompanyInvitations(companyId: string): Promise<CompanyInvitation[]> {
  const res = await apiFetchJson<{ ok: boolean; data: CompanyInvitation[] }>(
    `/companies/${companyId}/invitations`
  );
  return res.data;
}

export async function revokeCompanyInvitation(companyId: string, invitationId: string): Promise<void> {
  await apiFetchJson(`/companies/${companyId}/invitations/${invitationId}/revoke`, { method: 'POST' });
}

export async function acceptCompanyInvitation(token: string): Promise<{ companyId: string; memberId: string; reentry: boolean; grantedKeys: string[] }> {
  const res = await apiFetchJson<{ ok: boolean; data: { companyId: string; memberId: string; reentry: boolean; grantedKeys: string[] } }>(
    '/invitations/accept',
    { method: 'POST', body: JSON.stringify({ token }) }
  );
  return res.data;
}

export async function declineCompanyInvitation(token: string): Promise<void> {
  await apiFetchJson('/invitations/decline', { method: 'POST', body: JSON.stringify({ token }) });
}
