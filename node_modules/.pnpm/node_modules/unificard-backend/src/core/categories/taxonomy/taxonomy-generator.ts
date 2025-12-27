// src/core/categories/taxonomy/taxonomy-generator.ts
// Script para gerar e importar taxonomia global do Unificard

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
export function generateCategoryPayloads(
  nodes: CategoryNode[],
  parentId: string | null = null
): CreateCategoryPayload[] {
  const payloads: CreateCategoryPayload[] = [];

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

function generateSlug(name: string): string {
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
export function generateSequentialCreationCommands() {
  const commands: Array<{
    endpoint: string;
    method: 'POST';
    payload: CreateCategoryPayload;
    parentSlug?: string;
  }> = [];

  function processNode(node: CategoryNode, parentSlug?: string) {
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

  for (const rootNode of taxonomyData.categories) {
    processNode(rootNode);
  }

  return commands;
}

export { taxonomyData };








