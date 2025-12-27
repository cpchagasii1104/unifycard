import taxonomyData from './global-taxonomy.json';
interface CategoryNode {
    name: string;
    slug?: string;
    description?: string;
    children?: CategoryNode[];
}
interface CreateCategoryPayload {
    name: string;
    slug?: string;
    description?: string | null;
    parentId?: string | null;
}
/**
 * Gera payloads para criação de categorias de forma hierárquica
 */
export declare function generateCategoryPayloads(nodes: CategoryNode[], parentId?: string | null): CreateCategoryPayload[];
/**
 * Gera comandos de criação sequencial (para uso com API)
 */
export declare function generateSequentialCreationCommands(): {
    endpoint: string;
    method: "POST";
    payload: CreateCategoryPayload;
    parentSlug?: string;
}[];
export { taxonomyData };
//# sourceMappingURL=taxonomy-generator.d.ts.map