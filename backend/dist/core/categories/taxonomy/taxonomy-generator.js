"use strict";
// src/core/categories/taxonomy/taxonomy-generator.ts
// Script para gerar e importar taxonomia global do Unificard
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taxonomyData = void 0;
exports.generateCategoryPayloads = generateCategoryPayloads;
exports.generateSequentialCreationCommands = generateSequentialCreationCommands;
const global_taxonomy_json_1 = __importDefault(require("./global-taxonomy.json"));
exports.taxonomyData = global_taxonomy_json_1.default;
/**
 * Gera payloads para criação de categorias de forma hierárquica
 */
function generateCategoryPayloads(nodes, parentId = null) {
    const payloads = [];
    for (const node of nodes) {
        const slug = node.slug || generateSlug(node.name);
        payloads.push({
            name: node.name,
            slug,
            description: node.description || null,
            parentId,
        });
        // Recursivamente processar filhos
        if (node.children && node.children.length > 0) {
            // Nota: parentId será atualizado após criar a categoria pai
            // Este é um placeholder - na prática, você precisaria criar sequencialmente
            const childPayloads = generateCategoryPayloads(node.children, null);
            payloads.push(...childPayloads);
        }
    }
    return payloads;
}
function generateSlug(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
/**
 * Gera comandos de criação sequencial (para uso com API)
 */
function generateSequentialCreationCommands() {
    const commands = [];
    function processNode(node, parentSlug) {
        const slug = node.slug || generateSlug(node.name);
        commands.push({
            endpoint: parentSlug ? '/categories/create-child' : '/categories/create-root',
            method: 'POST',
            payload: {
                name: node.name,
                slug,
                description: node.description || null,
                parentId: undefined, // Será resolvido pelo parentSlug
            },
            parentSlug,
        });
        if (node.children) {
            for (const child of node.children) {
                processNode(child, slug);
            }
        }
    }
    for (const rootNode of global_taxonomy_json_1.default.categories) {
        processNode(rootNode);
    }
    return commands;
}
//# sourceMappingURL=taxonomy-generator.js.map