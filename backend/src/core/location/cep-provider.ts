// src/core/location/cep-provider.ts
// F-GEO-1a (DECISION-0077) + FASE B (RFC B1-D · D-J): adapters GOVERNADOS de provider postal.
//
// 🔴 Provider é adapter externo, NÃO autoridade territorial. Base URL FIXA (nunca vem do request),
//    resposta validada/sanitizada campo a campo, timeout explícito por tentativa, no máximo UMA
//    repetição governada (timeout/rede/429/5xx), backoff limitado com jitter injetável.
// 🔴 NENHUM log de payload externo/PII neste arquivo. Campos externos são não confiáveis:
//    comprimento limitado, markup/controle removidos.
// 🔴 Gates/testes NÃO podem depender de rede: sem CEP_PROVIDER explícito o runtime usa
//    NullCepProvider e a chain de adapters fica VAZIA (resolver responde provider_unavailable).
// 🔴 Privacidade (DECISION-0077 §3): lat/lng do provider são apenas transporte/evidência — quem
//    chama decide o que (não) persistir; coordenada de CEP nunca vira geo de residência.
// 🔴 FASE B: a criação de território a partir de provider foi ABOLIDA (sem findOrCreateCity/State,
//    sem createCityFromExternal). Estes adapters só produzem EVIDÊNCIA normalizada.

/** Resultado puro da resolução de CEP (contrato legado fail-open). Nenhuma escrita no banco. */
export interface CepResolution {
  postalCode: string;
  stateCode: string;                 // UF, ex. 'PR'
  cityName: string;
  cityExternalCode?: string | null;  // código IBGE do município (quando o provider trouxer)
  neighborhoodName?: string | null;  // texto (NÃO vira FK; exibição apenas)
  street?: string | null;
  lat?: number | null;               // transporte; NÃO persistido como geo de residência
  lng?: number | null;
  source: 'BRASIL_API' | 'VIA_CEP' | 'MOCK';
}

export interface CepProvider {
  resolvePostalCode(postalCode: string): Promise<CepResolution | null>;
}

/** Normaliza CEP BR para 8 dígitos (contrato legado). Retorna null se inválido. */
export function normalizePostalCode(cep: string | null | undefined): string | null {
  if (!cep) return null;
  const d = String(cep).replace(/\D/g, '');
  return d.length === 8 ? d : null;
}

// ── FASE B: contrato rico de adapter (outcomes distintos; sem fail-open mudo) ────────────────────

export type PostalProviderQueryOutcome = 'resolved' | 'not_found' | 'unavailable' | 'malformed';

/** Evidência externa normalizada e sanitizada. Texto de bairro é EXIBIÇÃO, nunca identidade. */
export interface PostalProviderAddressData {
  stateCode: string | null;
  cityName: string | null;
  officialCityCode: string | null;   // IBGE 7 dígitos quando o provider entrega; senão null
  neighborhoodText: string | null;
  street: string | null;
  lat: number | null;
  lng: number | null;
}

export interface PostalProviderQueryResult {
  outcome: PostalProviderQueryOutcome;
  data: PostalProviderAddressData | null;
}

export interface PostalProviderAdapter {
  readonly providerId: 'viacep' | 'brasilapi' | 'mock';
  query(postalCodeNormalized: string): Promise<PostalProviderQueryResult>;
}

/** Limite de comprimento de qualquer string vinda de provider externo. */
const MAX_EXTERNAL_FIELD_LENGTH = 120;

/** Sanitiza texto externo: remove controle/markup, colapsa espaços, limita comprimento. */
function sanitizeExternalText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const cleaned = v
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_EXTERNAL_FIELD_LENGTH);
}

/** UF sanitizada: exatamente 2 letras A-Z. */
function sanitizeUf(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const uf = v.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(uf) ? uf : null;
}

/** Código IBGE sanitizado: exatamente 7 dígitos. Qualquer outra coisa NÃO é identificador oficial. */
function sanitizeIbgeCode(v: unknown): string | null {
  return typeof v === 'string' && /^\d{7}$/.test(v) ? v : null;
}

/** Jitter injetável (determinístico em teste). */
export type BackoffJitterFn = () => number;
const defaultJitter: BackoffJitterFn = () => Math.floor(Math.random() * 100);

const RETRY_BACKOFF_BASE_MS = 150;
const MAX_ATTEMPTS = 2; // 1 tentativa + no máximo UMA repetição governada

/**
 * fetch governado: timeout por tentativa via AbortController; retry ÚNICO apenas para
 * timeout/falha de rede/429/5xx. 'not found' e payload malformado NUNCA são repetidos.
 */
async function governedFetch(
  url: string,
  timeoutMs: number,
  jitter: BackoffJitterFn
): Promise<{ kind: 'http'; res: Response } | { kind: 'unavailable' }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response | null = null;
    let transportFailure = false;
    try {
      res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    } catch {
      transportFailure = true; // timeout/abort/erro de rede
    } finally {
      clearTimeout(t);
    }
    if (!transportFailure && res && res.status !== 429 && res.status < 500) {
      return { kind: 'http', res };
    }
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_BASE_MS + jitter()));
    }
  }
  return { kind: 'unavailable' };
}

/** Provider nulo: nunca resolve. Default seguro (gates/runtime sem rede). */
export class NullCepProvider implements CepProvider {
  async resolvePostalCode(_postalCode: string): Promise<CepResolution | null> {
    return null;
  }
}

/**
 * ViaCEP — adapter governado. Base URL FIXA; URL construída somente com o CEP normalizado.
 * Entrega o código IBGE do município (`ibge`), a chave da resolução canônica por
 * (state_id, external_code). Sem lat/lng, sem payload bruto em log.
 */
export class ViaCepProvider implements CepProvider, PostalProviderAdapter {
  readonly providerId = 'viacep' as const;
  constructor(
    private readonly timeoutMs: number = 4000,
    private readonly jitter: BackoffJitterFn = defaultJitter
  ) {}

  async query(postalCodeNormalized: string): Promise<PostalProviderQueryResult> {
    if (!/^\d{8}$/.test(postalCodeNormalized)) return { outcome: 'malformed', data: null };
    const fetched = await governedFetch(
      `https://viacep.com.br/ws/${postalCodeNormalized}/json/`,
      this.timeoutMs,
      this.jitter
    );
    if (fetched.kind === 'unavailable') return { outcome: 'unavailable', data: null };
    const { res } = fetched;
    if (res.status === 404) return { outcome: 'not_found', data: null };
    if (!res.ok) return { outcome: 'unavailable', data: null };
    let data: any;
    try {
      data = await res.json();
    } catch {
      return { outcome: 'malformed', data: null };
    }
    if (!data || typeof data !== 'object') return { outcome: 'malformed', data: null };
    if (data.erro) return { outcome: 'not_found', data: null }; // ViaCEP sinaliza inexistente com { erro: true }
    const stateCode = sanitizeUf(data.uf);
    const cityName = sanitizeExternalText(data.localidade);
    if (!stateCode || !cityName) return { outcome: 'malformed', data: null };
    return {
      outcome: 'resolved',
      data: {
        stateCode,
        cityName,
        officialCityCode: sanitizeIbgeCode(data.ibge),
        neighborhoodText: sanitizeExternalText(data.bairro),
        street: sanitizeExternalText(data.logradouro),
        lat: null,
        lng: null,
      },
    };
  }

  async resolvePostalCode(postalCode: string): Promise<CepResolution | null> {
    const cep = normalizePostalCode(postalCode);
    if (!cep) return null;
    const r = await this.query(cep);
    if (r.outcome !== 'resolved' || !r.data || !r.data.stateCode || !r.data.cityName) return null;
    return {
      postalCode: cep,
      stateCode: r.data.stateCode,
      cityName: r.data.cityName,
      cityExternalCode: r.data.officialCityCode,
      neighborhoodName: r.data.neighborhoodText,
      street: r.data.street,
      lat: null,
      lng: null,
      source: 'VIA_CEP',
    };
  }
}

/**
 * BrasilAPI (CEP v2) — adapter governado de fallback. Base URL FIXA. Pode trazer coordenadas
 * (evidência de transporte; nunca persistida como residência). `city_ibge` nem sempre vem.
 */
export class BrasilApiCepProvider implements CepProvider, PostalProviderAdapter {
  readonly providerId = 'brasilapi' as const;
  constructor(
    private readonly timeoutMs: number = 4000,
    private readonly jitter: BackoffJitterFn = defaultJitter
  ) {}

  async query(postalCodeNormalized: string): Promise<PostalProviderQueryResult> {
    if (!/^\d{8}$/.test(postalCodeNormalized)) return { outcome: 'malformed', data: null };
    const fetched = await governedFetch(
      `https://brasilapi.com.br/api/cep/v2/${postalCodeNormalized}`,
      this.timeoutMs,
      this.jitter
    );
    if (fetched.kind === 'unavailable') return { outcome: 'unavailable', data: null };
    const { res } = fetched;
    if (res.status === 404) return { outcome: 'not_found', data: null };
    if (!res.ok) return { outcome: 'unavailable', data: null };
    let data: any;
    try {
      data = await res.json();
    } catch {
      return { outcome: 'malformed', data: null };
    }
    if (!data || typeof data !== 'object') return { outcome: 'malformed', data: null };
    const stateCode = sanitizeUf(data.state);
    const cityName = sanitizeExternalText(data.city);
    if (!stateCode || !cityName) return { outcome: 'malformed', data: null };
    const coords = data?.location?.coordinates ?? {};
    const lat = coords?.latitude != null ? Number(coords.latitude) : null;
    const lng = coords?.longitude != null ? Number(coords.longitude) : null;
    return {
      outcome: 'resolved',
      data: {
        stateCode,
        cityName,
        officialCityCode: sanitizeIbgeCode(data.city_ibge),
        neighborhoodText: sanitizeExternalText(data.neighborhood),
        street: sanitizeExternalText(data.street),
        lat: Number.isFinite(lat as number) ? (lat as number) : null,
        lng: Number.isFinite(lng as number) ? (lng as number) : null,
      },
    };
  }

  async resolvePostalCode(postalCode: string): Promise<CepResolution | null> {
    const cep = normalizePostalCode(postalCode);
    if (!cep) return null;
    const r = await this.query(cep);
    if (r.outcome !== 'resolved' || !r.data || !r.data.stateCode || !r.data.cityName) return null;
    return {
      postalCode: cep,
      stateCode: r.data.stateCode,
      cityName: r.data.cityName,
      cityExternalCode: r.data.officialCityCode,
      neighborhoodName: r.data.neighborhoodText,
      street: r.data.street,
      lat: r.data.lat,
      lng: r.data.lng,
      source: 'BRASIL_API',
    };
  }
}

/** Provider de teste (contrato legado): resolve a partir de um mapa fixo. SEM rede. */
export class MockCepProvider implements CepProvider {
  constructor(private readonly fixtures: Record<string, CepResolution>) {}
  async resolvePostalCode(postalCode: string): Promise<CepResolution | null> {
    const cep = normalizePostalCode(postalCode);
    if (!cep) return null;
    return this.fixtures[cep] ?? null;
  }
}

/** Adapter de teste (contrato rico): outcomes programáveis por CEP. SEM rede. */
export class MockPostalProviderAdapter implements PostalProviderAdapter {
  readonly providerId = 'mock' as const;
  constructor(private readonly fixtures: Record<string, PostalProviderQueryResult>) {}
  async query(postalCodeNormalized: string): Promise<PostalProviderQueryResult> {
    return this.fixtures[postalCodeNormalized] ?? { outcome: 'not_found', data: null };
  }
}

/**
 * Provider default do runtime (contrato legado): NULL a menos que CEP_PROVIDER opte (opt-in).
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

/**
 * FASE B (D-J/§9): chain governada de adapters do resolver canônico — escolha SERVER-SIDE (env),
 * nunca por request. ViaCEP é o primário (entrega IBGE → identidade oficial); BrasilAPI é o
 * fallback por INDISPONIBILIDADE governada. Sem opt-in de rede → chain vazia (o resolver
 * responde `provider_unavailable`; gates/testes seguem sem rede).
 */
export function getPostalProviderChain(): PostalProviderAdapter[] {
  switch (process.env.CEP_PROVIDER) {
    case 'viacep':
    case 'brasilapi':
      return [new ViaCepProvider(), new BrasilApiCepProvider()];
    default:
      return [];
  }
}
