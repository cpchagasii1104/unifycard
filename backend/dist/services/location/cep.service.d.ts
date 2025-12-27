export interface CEPData {
    cep: string;
    logradouro: string;
    complemento: string;
    bairro: string;
    localidade: string;
    uf: string;
    erro?: boolean;
}
export declare class CEPService {
    /**
     * Busca endereço por CEP usando múltiplas APIs com fallback
     * @param cep CEP no formato 00000000 (apenas números)
     * @param retries Número de tentativas por API (padrão: 1)
     * @returns Dados do endereço ou null se não encontrado
     */
    fetchCEP(cep: string, retries?: number): Promise<CEPData | null>;
}
export declare const cepService: CEPService;
//# sourceMappingURL=cep.service.d.ts.map