// backend/src/core/ai/network/network.service.ts
import type { NetworkFetchResponse } from './network.types';

class NetworkService {
  private timeoutMs: number;
  private maxResponseChars: number;
  private allowedDomains: string[];
  private blockedHosts: string[];

  constructor() {
    this.timeoutMs = parseInt(process.env.AI_NETWORK_TIMEOUT_MS || '10000', 10);
    this.maxResponseChars = parseInt(process.env.AI_MAX_HTTP_CHARS || '100000', 10);
    
    // Whitelist de domínios permitidos
    this.allowedDomains = [
      'npmjs.com',
      'registry.npmjs.org',
      'github.com',
      'raw.githubusercontent.com',
      'developer.mozilla.org',
    ];

    // Hosts bloqueados
    this.blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
    ];
  }

  // Verificar se rede está habilitada
  private isNetworkAllowed(): boolean {
    return process.env.AI_ALLOW_NETWORK === 'true';
  }

  // Validar URL
  private validateUrl(url: string): URL {
    try {
      const parsedUrl = new URL(url);

      // Apenas HTTPS permitido
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('Apenas protocolo HTTPS é permitido');
      }

      // Bloquear hosts locais
      const hostname = parsedUrl.hostname.toLowerCase();
      for (const blocked of this.blockedHosts) {
        if (hostname === blocked || hostname.startsWith(blocked + '.')) {
          throw new Error('Acesso a localhost/IPs privados não permitido');
        }
      }

      // Verificar se é IP privado
      if (this.isPrivateIP(hostname)) {
        throw new Error('Acesso a IPs privados não permitido');
      }

      // Verificar whitelist de domínios
      let isAllowed = false;
      for (const allowed of this.allowedDomains) {
        if (hostname === allowed || hostname.endsWith('.' + allowed)) {
          isAllowed = true;
          break;
        }
      }

      if (!isAllowed) {
        throw new Error(`Domínio ${hostname} não está na whitelist permitida`);
      }

      return parsedUrl;
    } catch (error: any) {
      if (error instanceof TypeError) {
        throw new Error('URL inválida');
      }
      throw error;
    }
  }

  // Verificar se é IP privado (simplificado)
  private isPrivateIP(hostname: string): boolean {
    // Verificar padrões de IP privado
    const privatePatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^127\./,
    ];

    for (const pattern of privatePatterns) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    return false;
  }

  // Fazer requisição HTTP GET
  async fetch(url: string): Promise<NetworkFetchResponse> {
    const startTime = Date.now();

    try {
      // Verificar se rede está habilitada
      if (!this.isNetworkAllowed()) {
        throw new Error('Acesso à rede não está habilitado (AI_ALLOW_NETWORK !== "true")');
      }

      // Validar URL
      const parsedUrl = this.validateUrl(url);

      console.info(`[NETWORK] Iniciando requisição - URL: ${parsedUrl.hostname}`);

      // Criar AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.error(`[NETWORK] Timeout após ${this.timeoutMs}ms`);
      }, this.timeoutMs);

      try {
        // Fazer requisição GET
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Unificard-AI/1.0',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Ler corpo da resposta
        let body = await response.text();

        // Truncar se exceder limite
        let truncated = false;
        if (body.length > this.maxResponseChars) {
          body = body.substring(0, this.maxResponseChars);
          truncated = true;
        }

        // Converter headers para objeto simples
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const duration = Date.now() - startTime;
        console.info(`[NETWORK] Requisição concluída em ${duration}ms - Status: ${response.status}, Tamanho: ${body.length}`);

        return {
          status: response.status,
          headers,
          body,
          truncated,
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error(`Timeout: requisição cancelada após ${this.timeoutMs}ms`);
        }
        throw fetchError;
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[NETWORK] Erro após ${duration}ms: ${error.message || error}`);
      throw error;
    }
  }
}

export const networkService = new NetworkService();


