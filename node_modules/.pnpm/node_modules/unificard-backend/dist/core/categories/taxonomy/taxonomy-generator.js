"use strict";
// src/core/categories/taxonomy/taxonomy-generator.ts
// Script para gerar e importar taxonomia global do Unificard
// CORREÇÃO: geração SEQUENCIAL e CANÔNICA da árvore (sem parentId fictício, sem quebra de hierarquia)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taxonomyData = void 0;
exports.generateSequentialCreationCommands = generateSequentialCreationCommands;
const global_taxonomy_json_1 = __importDefault(require("./global-taxonomy.json"));
exports.taxonomyData = global_taxonomy_json_1.default;
/**
 * Gera comandos de criação SEQUENCIAL e CANÔNICA
 * - NÃO cria payload solto
 * - NÃO usa parentId placeholder
 * - NÃO quebra hierarquia
 * - Compatível com SSOT e Constituição da Árvore
 */
function generateSequentialCreationCommands() {
    const commands = [];
    function processNode(node, parentSlug) {
        const slug = node.slug ?? generateSlug(node.name);
        commands.push({
            endpoint: parentSlug ? '/categories/create-child' : '/categories/create-root',
            method: 'POST',
            payload: {
                name: node.name,
                slug,
                description: node.description ?? null,
                ...(parentSlug ? { parentSlug } : {}),
            },
        });
        if (node.children && node.children.length > 0) {
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
/**
 * Geração de slug CANÔNICA
 */
function generateSlug(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
