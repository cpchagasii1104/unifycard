// src/api/residenceAddress.ts
// F2 (DECISION-0074): client do endereço civil/residencial da PESSOA FÍSICA no Location Core canônico.
// Fala SOMENTE com GET/PUT /profile/residence-address. NÃO usa metadata. NÃO toca Companies/PJ.
//
// Opção A (CEP-âncora): o backend grava country=BR + postal_code/street/number/complement; city/state/
// neighborhood NÃO são persistidos canonicamente (FK; sem coluna texto) — voltam null daqui. A exibição de
// city/state na aba Pessoal continua vindo do core (GET /core/profile), que enriquece do blob na transição.

import { apiFetchJson } from './client';

export interface ResidenceAddressInput {
  cep?: string | null;
  address?: string | null; // logradouro
  address_number?: string | null;
  complement?: string | null;
  neighborhood?: string | null; // aceito; não persistido canônico (Opção A)
  city?: string | null;         // idem
  state?: string | null;        // idem
}

export interface ResidenceAddressDTO {
  addressId: string;
  cep: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  country: string;
  is_primary: boolean;
  source: string;
}

/** Lê a residência primária vigente da PF no Location Core. null se não houver. */
export async function getResidenceAddress(): Promise<ResidenceAddressDTO | null> {
  const result = await apiFetchJson<{ ok: boolean; data: ResidenceAddressDTO | null }>(
    '/profile/residence-address'
  );
  if (!result.ok) return null;
  return result.data ?? null;
}

/** Grava/atualiza a residência primária da PF no Location Core (source='UX_INPUT'). */
export async function putResidenceAddress(
  input: ResidenceAddressInput
): Promise<ResidenceAddressDTO> {
  const result = await apiFetchJson<{ ok: boolean; data: ResidenceAddressDTO; message?: string }>(
    '/profile/residence-address',
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );
  if (!result.ok || !result.data) {
    throw new Error(result.message || 'Erro ao salvar endereço residencial');
  }
  return result.data;
}
