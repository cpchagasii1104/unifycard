import type { RootConfigRow, UpdateRootConfigInput } from './root-config.types';
export declare class RootConfigRepository {
    /**
     * Busca a configuração-raiz (só deve existir uma)
     */
    find(): Promise<RootConfigRow | undefined>;
    /**
     * Cria ou atualiza a configuração-raiz
     */
    upsert(input: UpdateRootConfigInput): Promise<RootConfigRow>;
}
//# sourceMappingURL=root-config.repository.d.ts.map