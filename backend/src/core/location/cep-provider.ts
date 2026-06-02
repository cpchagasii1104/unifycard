// src/core/location/cep-provider.ts
// F-GEO-1a (DECISION-0077): port plugável de resolução de CEP → UF/cidade/IBGE/bairro.
//
// 🔴 Substrato COMPARTILHÁVEL (PF e PJ usam o mesmo trilho). NÃO é frente PJ/Perfil.
// 🔴 fail-open: o provider pode falhar/timeout — quem chama trata como "não resolvido" e segue.
// 🔴 Gates/testes NÃO podem depender de rede: o provider default é NULL a menos que CEP_PROVIDER opte;
//    testes injetam MockCepProvider.
// 🔴 Privacidade (DECISION-0077 §3): se o provider trouxer coordenada (nível CEP, potencialmente precisa
//    da residência), ela NÃO é persistida no endereço por esta fatia (geo coarse = centroide de cidade
//    via FK). Os campos lat/lng aqui são apenas transporte; o service decide o que persistir.

/** Resultado puro da resolução de CEP. Nenhuma escrita no banco. */
export interface CepResolution {
  postalCode: string;
  stateCode: string;                 // UF, ex. 'PR'
  cityName: string;
  cityExternalCode?: string | null;  // código IBGE do município (quando o provider trouxer)
  neighborhoodName?: string | null;  // texto (NÃO vira FK nesta frente)
  street?: string | null;
  lat?: number | null;               // transporte; NÃO persistido como geo de residência nesta fatia
  lng?: number | null;
  source: 'BRASIL_API' | 'VIA_CEP' | 'MOCK';
}

export interface CepProvider {
  resolvePostalCode(postalCode: string): Promise<CepResolution | null>;
}

/** Normaliza CEP para 8 dígitos. Retorna null se inválido. */
export function normalizePostalCode(cep: string | null | undefined): string | null {
  if (!cep) return null;
  const d = String(cep).replace(/\D/g, '');
  return d.length === 8 ? d : null;
}

/** Provider nulo: nunca resolve. Default seguro (gates/runtime sem rede). */
export class NullCepProvider implements CepProvider {
  async resolvePostalCode(_postalCode: string): Promise<CepResolution | null> {
    return null;
  }
}

/**
 * Provider real via BrasilAPI (CEP v2). fetch nativo (Node 22) + timeout via AbortController.
 * Mapeia UF/cidade/bairro/logradouro e, quando presente, código IBGE e coordenadas (transporte).
 * IBGE pode não vir no contrato — nesse caso `cityExternalCode=null` (sem inventar external_code).
 */
export class BrasilApiCepProvider implements CepProvider {
  constructor(private readonly timeoutMs: number = 4000) {}

  async resolvePostalCode(postalCode: string): Promise<CepResolution | null> {
    const cep = normalizePostalCode(postalCode);
    if (!cep) return null;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      const stateCode = typeof data?.state === 'string' ? data.state.toUpperCase() : null;
      const cityName = typeof data?.city === 'string' ? data.city : null;
      if (!stateCode || !cityName) return null;
      const coords = data?.location?.coordinates ?? {};
      const lat = coords?.latitude != null ? Number(coords.latitude) : null;
      const lng = coords?.longitude != null ? Number(coords.longitude) : null;
      return {
        postalCode: cep,
        stateCode,
        cityName,
        // BrasilAPI nem sempre traz IBGE; só usa se vier numérico de 7 dígitos.
        cityExternalCode:
          typeof data?.city_ibge === 'string' && /^\d{7}$/.test(data.city_ibge) ? data.city_ibge : null,
        neighborhoodName: typeof data?.neighborhood === 'string' ? data.neighborhood : null,
        street: typeof data?.street === 'string' ? data.street : null,
        lat: Number.isFinite(lat as number) ? (lat as number) : null,
        lng: Number.isFinite(lng as number) ? (lng as number) : null,
        source: 'BRASIL_API',
      };
    } catch {
      // fail-open: timeout/erro de rede → não resolvido.
      return null;
    } finally {
      clearTimeout(t);
    }
  }
}

/** Provider de teste: resolve a partir de um mapa fixo. SEM rede. */
export class MockCepProvider implements CepProvider {
  constructor(private readonly fixtures: Record<string, CepResolution>) {}
  async resolvePostalCode(postalCode: string): Promise<CepResolution | null> {
    const cep = normalizePostalCode(postalCode);
    if (!cep) return null;
    return this.fixtures[cep] ?? null;
  }
}

/**
 * F-GEO-2c (DECISION-0077/0078): Provider real via ViaCEP. fetch nativo + timeout. Retorna o código IBGE do
 * município (`ibge`) — o que permite resolver `city_id` canônico via `cities.external_code` (BrasilAPI v2 não
 * traz IBGE). Sem lat/lng, sem payload bruto, fail-open.
 */
export class ViaCepProvider implements CepProvider {
  constructor(private readonly timeoutMs: number = 4000) {}

  async resolvePostalCode(postalCode: string): Promise<CepResolution | null> {
    const cep = normalizePostalCode(postalCode);
    if (!cep) return null;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      if (data?.erro) return null; // ViaCEP sinaliza CEP inexistente com { erro: true }
      const stateCode = typeof data?.uf === 'string' ? data.uf.toUpperCase() : null;
      const cityName = typeof data?.localidade === 'string' ? data.localidade : null;
      if (!stateCode || !cityName) return null;
      return {
        postalCode: cep,
        stateCode,
        cityName,
        cityExternalCode:
          typeof data?.ibge === 'string' && /^\d{7}$/.test(data.ibge) ? data.ibge : null,
        neighborhoodName: typeof data?.bairro === 'string' && data.bairro ? data.bairro : null,
        street: typeof data?.logradouro === 'string' && data.logradouro ? data.logradouro : null,
        lat: null,
        lng: null,
        source: 'VIA_CEP',
      };
    } catch {
      return null; // fail-open
    } finally {
      clearTimeout(t);
    }
  }
}

/**
 * Provider default do runtime: NULL a menos que CEP_PROVIDER opte explicitamente (opt-in).
 *   CEP_PROVIDER=viacep    → ViaCEP (retorna IBGE → resolve city_id canônico) [preferido]
 *   CEP_PROVIDER=brasilapi → BrasilAPI (street/coords; v2 sem IBGE → tende a state-only)
 *   ausente / 'null'       → NullCepProvider (sem rede; seguro para gates/testes)
 * Garante que gates/testes não batem em rede sem configuração intencional.
 */
export function getDefaultCepProvider(): CepProvider {
  switch (process.env.CEP_PROVIDER) {
    case 'viacep':
      return new ViaCepProvider();
    case 'brasilapi':
      return new BrasilApiCepProvider();
    default:
      return new NullCepProvider();
  }
}
