"use strict";
// src/services/location/cep.service.ts
// Serviço para buscar endereço por CEP (ViaCEP + BrasilAPI fallback) - Backend
Object.defineProperty(exports, "__esModule", { value: true });
exports.cepService = exports.CEPService = void 0;
class CEPService {
    /**
     * Busca endereço por CEP usando múltiplas APIs com fallback
     * @param cep CEP no formato 00000000 (apenas números)
     * @param retries Número de tentativas por API (padrão: 1)
     * @returns Dados do endereço ou null se não encontrado
     */
    async fetchCEP(cep, retries = 1) {
        // Remove caracteres não numéricos
        const cleanCEP = cep.replace(/\D/g, '');
        console.log('[CEPService] Buscando CEP:', cleanCEP);
        if (cleanCEP.length !== 8) {
            console.warn('[CEPService] CEP inválido, tamanho:', cleanCEP.length);
            return null;
        }
        // 🔴 OTIMIZAÇÃO: BrasilAPI primeiro (mais rápida e confiável), ViaCEP como fallback
        // Também reduzimos timeout para 5s por API (ao invés de 15s)
        const apis = [
            {
                name: 'BrasilAPI',
                url: `https://brasilapi.com.br/api/cep/v1/${cleanCEP}`,
                timeout: 5000, // 5 segundos (BrasilAPI é rápida)
                transform: (data) => {
                    if (!data.city && !data.state)
                        return null;
                    return {
                        cep: data.cep || cleanCEP,
                        logradouro: data.street || '',
                        complemento: '',
                        bairro: data.neighborhood || '',
                        localidade: data.city || '',
                        uf: (data.state || '').toUpperCase(),
                        erro: false,
                    };
                },
            },
            {
                name: 'ViaCEP',
                url: `https://viacep.com.br/ws/${cleanCEP}/json/`,
                timeout: 8000, // 8 segundos (ViaCEP pode ser mais lenta)
                transform: (data) => {
                    if (data.erro === true || data.erro === 'true' || (typeof data.erro === 'string' && data.erro.toLowerCase() === 'true')) {
                        return null;
                    }
                    if (!data.localidade && !data.uf)
                        return null;
                    return {
                        cep: data.cep || cleanCEP,
                        logradouro: data.logradouro || '',
                        complemento: data.complemento || '',
                        bairro: data.bairro || '',
                        localidade: data.localidade || '',
                        uf: (data.uf || '').toUpperCase(),
                        erro: false,
                    };
                },
            },
        ];
        let lastError = null;
        for (const api of apis) {
            try {
                console.log(`[CEPService] 🔍 Tentando ${api.name}:`, api.url);
                const controller = new AbortController();
                const timeoutMs = api.timeout || 5000; // Usar timeout específico da API ou 5s padrão
                const timeoutId = setTimeout(() => {
                    console.log(`[CEPService] ⏰ Timeout na ${api.name} (${timeoutMs}ms), abortando...`);
                    controller.abort();
                }, timeoutMs);
                let response;
                try {
                    console.log(`[CEPService] 📡 Chamando ${api.name}...`);
                    response = await fetch(api.url, {
                        method: 'GET',
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Unificard-Backend/1.0',
                        },
                        cache: 'no-store',
                    });
                    clearTimeout(timeoutId);
                    console.log(`[CEPService] ✅ ${api.name} respondeu com sucesso`);
                }
                catch (fetchError) {
                    clearTimeout(timeoutId);
                    console.error(`[CEPService] ❌ ERRO no fetch da ${api.name}:`, fetchError);
                    // Verificar se é erro de timeout ou conexão (incluindo UND_ERR_CONNECT_TIMEOUT)
                    const isTimeout = fetchError instanceof Error && (fetchError.name === 'AbortError' ||
                        fetchError.message.includes('aborted') ||
                        fetchError.message.includes('Timeout') ||
                        fetchError.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                        (fetchError.cause && fetchError.cause.code === 'UND_ERR_CONNECT_TIMEOUT'));
                    const isNetworkError = fetchError instanceof Error && (fetchError.message.includes('Failed to fetch') ||
                        fetchError.message.includes('NetworkError') ||
                        fetchError.message.includes('fetch failed') ||
                        fetchError.message.includes('ECONNREFUSED') ||
                        fetchError.message.includes('ENOTFOUND') ||
                        fetchError.message.includes('Connect Timeout'));
                    if (isTimeout || isNetworkError) {
                        const errorType = isTimeout ? 'Timeout' : 'Erro de rede';
                        console.error(`[CEPService] ❌ ${errorType} na ${api.name} - tentando próxima API...`);
                        lastError = new Error(`${errorType} ao buscar CEP na ${api.name}`);
                        continue; // Tentar próxima API
                    }
                    // Qualquer outro erro também tenta próxima API
                    lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
                    console.warn(`[CEPService] ⚠️ Erro inesperado na ${api.name} - tentando próxima API...`);
                    continue; // Tentar próxima API
                }
                console.log(`[CEPService] ✅ Resposta recebida da ${api.name}`);
                console.log(`[CEPService] Status:`, response.status, response.statusText);
                if (!response.ok) {
                    console.error(`[CEPService] ❌ ${api.name} retornou status não OK:`, response.status);
                    if (response.status === 404) {
                        // CEP não encontrado nesta API, tentar próxima
                        lastError = new Error(`CEP não encontrado na ${api.name}`);
                        continue;
                    }
                    if (response.status === 502 || response.status === 503) {
                        // Serviço indisponível, tentar próxima API
                        lastError = new Error(`${api.name} temporariamente indisponível`);
                        continue;
                    }
                    lastError = new Error(`${api.name} retornou erro ${response.status}`);
                    continue;
                }
                // Tentar parsear como JSON
                let data;
                let text;
                try {
                    console.log(`[CEPService] 📖 Lendo resposta da ${api.name}...`);
                    // 🔴 CRÍTICO: Garantir encoding UTF-8 correto
                    const buffer = await response.arrayBuffer();
                    text = new TextDecoder('utf-8').decode(buffer);
                    console.log(`[CEPService] ✅ Texto lido, tamanho:`, text.length, 'caracteres');
                    if (!text || text.trim().length === 0) {
                        console.error(`[CEPService] ❌ ${api.name} retornou resposta vazia`);
                        lastError = new Error(`${api.name} retornou resposta vazia`);
                        continue;
                    }
                    console.log(`[CEPService] 🔄 Parseando JSON da ${api.name}...`);
                    data = JSON.parse(text);
                    console.log(`[CEPService] ✅ JSON parseado com sucesso`);
                }
                catch (parseError) {
                    console.error(`[CEPService] ❌ Erro ao parsear JSON da ${api.name}:`, parseError);
                    lastError = parseError instanceof Error ? parseError : new Error(String(parseError));
                    continue; // Tentar próxima API
                }
                console.log(`[CEPService] 📦 Dados brutos da ${api.name}:`, JSON.stringify(data, null, 2));
                // Validar estrutura básica
                if (!data || typeof data !== 'object') {
                    console.warn(`[CEPService] ❌ ${api.name} retornou dados inválidos`);
                    lastError = new Error(`${api.name} retornou dados inválidos`);
                    continue;
                }
                // Transformar dados usando a função específica da API
                const cepData = api.transform(data);
                if (!cepData) {
                    console.warn(`[CEPService] ❌ ${api.name} não retornou dados válidos após transformação`);
                    lastError = new Error(`CEP não encontrado na ${api.name}`);
                    continue;
                }
                // Validar: precisa ter pelo menos localidade OU UF
                if (!cepData.localidade && !cepData.uf) {
                    console.warn(`[CEPService] ❌ ${api.name} retornou CEP sem localidade e sem UF`);
                    lastError = new Error(`CEP sem dados essenciais na ${api.name}`);
                    continue;
                }
                console.log(`[CEPService] 📦 Dados mapeados para retorno:`, JSON.stringify(cepData, null, 2));
                console.log(`[CEPService] ✅✅✅ CEP VÁLIDO E PRONTO PARA RETORNAR (via ${api.name}) ✅✅✅`);
                return cepData;
            }
            catch (apiError) {
                console.error(`[CEPService] ❌ Erro ao processar ${api.name}:`, apiError);
                lastError = apiError instanceof Error ? apiError : new Error(String(apiError));
                // Continuar para próxima API
                continue;
            }
        }
        // Se chegou aqui, todas as APIs falharam
        console.error('[CEPService] ❌ Todas as APIs falharam');
        if (lastError) {
            console.error('[CEPService] Último erro:', lastError.message);
            throw lastError;
        }
        return null;
    }
}
exports.CEPService = CEPService;
exports.cepService = new CEPService();
//# sourceMappingURL=cep.service.js.map