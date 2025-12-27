/**
 * Script de Importação Automática da Taxonomia Global Unificard
 * 
 * Uso: node src/core/categories/taxonomy/import-taxonomy.js
 * 
 * Requer: Variável de ambiente API_BASE_URL (ex: http://localhost:3000)
 * Requer: Token de autenticação (configurar no código ou variável de ambiente)
 */

const taxonomy = {
  "servicos-automotivos": {
    root: { name: "Serviços Automotivos", slug: "servicos-automotivos", description: "Serviços relacionados a veículos automotores" },
    children: [
      {
        name: "Manutenção e Reparo",
        slug: "manutencao-reparo",
        description: "Serviços de manutenção e reparo de veículos",
        children: [
          { name: "Troca de Óleo", slug: "troca-oleo" },
          { name: "Alinhamento e Balanceamento", slug: "alinhamento-balanceamento" },
          { name: "Reparo de Motor", slug: "reparo-motor" },
          { name: "Reparo de Transmissão", slug: "reparo-transmissao" },
          { name: "Sistema de Freios", slug: "sistema-freios" },
          { name: "Sistema Elétrico", slug: "sistema-eletrico" },
          { name: "Ar Condicionado", slug: "ar-condicionado" },
          { name: "Suspensão", slug: "suspensao" }
        ]
      },
      {
        name: "Lavagem e Detalhamento",
        slug: "lavagem-detalhamento",
        description: "Serviços de limpeza e estética automotiva",
        children: [
          { name: "Lavagem Simples", slug: "lavagem-simples" },
          { name: "Lavagem Completa", slug: "lavagem-completa" },
          { name: "Detalhamento Premium", slug: "detalhamento-premium" },
          { name: "Enceramento", slug: "enceramento" },
          { name: "Hidratação de Couro", slug: "hidratacao-couro" },
          { name: "Polimento", slug: "polimento" }
        ]
      },
      {
        name: "Pneus e Rodas",
        slug: "pneus-rodas",
        description: "Serviços relacionados a pneus e rodas",
        children: [
          { name: "Venda de Pneus", slug: "venda-pneus" },
          { name: "Montagem de Pneus", slug: "montagem-pneus" },
          { name: "Calibragem", slug: "calibragem" },
          { name: "Recauchutagem", slug: "recauchutagem" },
          { name: "Venda de Rodas", slug: "venda-rodas" },
          { name: "Reforma de Rodas", slug: "reforma-rodas" }
        ]
      },
      {
        name: "Funilaria e Pintura",
        slug: "funilaria-pintura",
        description: "Serviços de funilaria e pintura automotiva",
        children: [
          { name: "Reparo de Amassados", slug: "reparo-amassados" },
          { name: "Pintura Completa", slug: "pintura-completa" },
          { name: "Pintura Parcial", slug: "pintura-parcial" },
          { name: "Envelopamento", slug: "envelopamento" },
          { name: "Remoção de Amassados", slug: "remocao-amassados" }
        ]
      },
      {
        name: "Vidros e Espelhos",
        slug: "vidros-espelhos",
        description: "Serviços relacionados a vidros e espelhos",
        children: [
          { name: "Troca de Para-brisa", slug: "troca-parabrisa" },
          { name: "Troca de Vidros Laterais", slug: "troca-vidros-laterais" },
          { name: "Pelicula de Proteção", slug: "pelicula-protecao" },
          { name: "Reparo de Vidros", slug: "reparo-vidros" },
          { name: "Espelhos Retrovisores", slug: "espelhos-retrovisores" }
        ]
      },
      {
        name: "Instalação de Acessórios",
        slug: "instalacao-acessorios",
        description: "Instalação de acessórios automotivos",
        children: [
          { name: "Sistema de Som", slug: "sistema-som" },
          { name: "Alarme e Rastreador", slug: "alarme-rastreador" },
          { name: "Central Multimídia", slug: "central-multimidia" },
          { name: "Iluminação LED", slug: "iluminacao-led" },
          { name: "Acessórios de Estética", slug: "acessorios-estetica" }
        ]
      },
      {
        name: "Inspeção e Vistoria",
        slug: "inspecao-vistoria",
        description: "Serviços de inspeção e vistoria veicular",
        children: [
          { name: "Vistoria Pré-Compra", slug: "vistoria-pre-compra" },
          { name: "Laudo Técnico", slug: "laudo-tecnico" },
          { name: "Inspeção Veicular", slug: "inspecao-veicular" },
          { name: "Avaliação de Veículo", slug: "avaliacao-veiculo" }
        ]
      },
      {
        name: "Despachante Automotivo",
        slug: "despachante-automotivo",
        description: "Serviços de despachante para veículos",
        children: [
          { name: "Transferência de Propriedade", slug: "transferencia-propriedade" },
          { name: "Licenciamento", slug: "licenciamento" },
          { name: "Emplacamento", slug: "emplacamento" },
          { name: "Segunda Via de Documentos", slug: "segunda-via-documentos" }
        ]
      }
    ]
  },
  "beleza-estetica": {
    root: { name: "Beleza & Estética", slug: "beleza-estetica", description: "Serviços de beleza, estética e cuidados pessoais" },
    children: [
      {
        name: "Cabelereiro e Barbeiro",
        slug: "cabelereiro-barbeiro",
        children: [
          { name: "Corte Masculino", slug: "corte-masculino" },
          { name: "Corte Feminino", slug: "corte-feminino" },
          { name: "Barba e Bigode", slug: "barba-bigode" },
          { name: "Coloração", slug: "coloracao" },
          { name: "Mechas e Luzes", slug: "mechas-luzes" },
          { name: "Tratamento Capilar", slug: "tratamento-capilar" },
          { name: "Escova e Penteado", slug: "escova-penteado" },
          { name: "Penteado para Festas", slug: "penteado-festas" }
        ]
      },
      {
        name: "Estética Facial",
        slug: "estetica-facial",
        children: [
          { name: "Limpeza de Pele", slug: "limpeza-pele" },
          { name: "Peeling Químico", slug: "peeling-quimico" },
          { name: "Hidratação Facial", slug: "hidratacao-facial" },
          { name: "Drenagem Linfática Facial", slug: "drenagem-linfatica-facial" },
          { name: "Tratamento Anti-Idade", slug: "tratamento-anti-idade" },
          { name: "Microagulhamento", slug: "microagulhamento" },
          { name: "Radiofrequência Facial", slug: "radiofrequencia-facial" }
        ]
      },
      {
        name: "Estética Corporal",
        slug: "estetica-corporal",
        children: [
          { name: "Massagem Relaxante", slug: "massagem-relaxante" },
          { name: "Drenagem Linfática", slug: "drenagem-linfatica" },
          { name: "Massagem Modeladora", slug: "massagem-modeladora" },
          { name: "Tratamento para Celulite", slug: "tratamento-celulite" },
          { name: "Redução de Medidas", slug: "reducao-medidas" },
          { name: "Criolipólise", slug: "criolipolise" },
          { name: "Radiofrequência Corporal", slug: "radiofrequencia-corporal" }
        ]
      },
      {
        name: "Depilação",
        slug: "depilacao",
        children: [
          { name: "Depilação a Laser", slug: "depilacao-laser" },
          { name: "Depilação com Cera", slug: "depilacao-cera" },
          { name: "Depilação Masculina", slug: "depilacao-masculina" },
          { name: "Depilação Íntima", slug: "depilacao-intima" }
        ]
      },
      {
        name: "Unhas e Mãos",
        slug: "unhas-maos",
        children: [
          { name: "Manicure", slug: "manicure" },
          { name: "Pedicure", slug: "pedicure" },
          { name: "Alongamento de Unhas", slug: "alongamento-unhas" },
          { name: "Unhas Decoradas", slug: "unhas-decoradas" },
          { name: "Esmaltação em Gel", slug: "esmaltacao-gel" }
        ]
      },
      {
        name: "Maquiagem",
        slug: "maquiagem",
        children: [
          { name: "Maquiagem Social", slug: "maquiagem-social" },
          { name: "Maquiagem para Eventos", slug: "maquiagem-eventos" },
          { name: "Maquiagem para Casamento", slug: "maquiagem-casamento" },
          { name: "Aulas de Maquiagem", slug: "aulas-maquiagem" }
        ]
      },
      {
        name: "Sobrancelhas",
        slug: "sobrancelhas",
        children: [
          { name: "Design de Sobrancelhas", slug: "design-sobrancelhas" },
          { name: "Micropigmentação", slug: "micropigmentacao" },
          { name: "Henna para Sobrancelhas", slug: "henna-sobrancelhas" }
        ]
      }
    ]
  }
};

// Função para fazer requisição HTTP
async function createCategory(endpoint, payload, authToken) {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken || ''}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Erro ao criar categoria ${payload.name}:`, error.message);
    throw error;
  }
}

// Função para buscar categoria por slug
async function findCategoryBySlug(slug, authToken) {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/categories/search?term=${slug}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${authToken || ''}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.categories.find(cat => cat.slug === slug);
  } catch (error) {
    return null;
  }
}

// Função recursiva para criar categorias
async function createCategoryTree(categoryData, parentId = null, authToken, level = 0) {
  const indent = '  '.repeat(level);
  console.log(`${indent}📁 Criando: ${categoryData.name} (${categoryData.slug})`);

  let createdCategory;
  
  try {
    if (parentId) {
      createdCategory = await createCategory(
        '/categories/create-child',
        {
          name: categoryData.name,
          slug: categoryData.slug,
          description: categoryData.description || null,
          parentId: parentId
        },
        authToken
      );
    } else {
      createdCategory = await createCategory(
        '/categories/create-root',
        {
          name: categoryData.name,
          slug: categoryData.slug,
          description: categoryData.description || null
        },
        authToken
      );
    }

    console.log(`${indent}✅ Criado: ${createdCategory.categoryId}`);

    // Processar filhos recursivamente
    if (categoryData.children && categoryData.children.length > 0) {
      for (const child of categoryData.children) {
        await createCategoryTree(child, createdCategory.categoryId, authToken, level + 1);
      }
    }

    return createdCategory;
  } catch (error) {
    console.error(`${indent}❌ Erro:`, error.message);
    throw error;
  }
}

// Função principal
async function importTaxonomy() {
  console.log('🚀 Iniciando importação da Taxonomia Global Unificard...\n');
  
  const authToken = process.env.AUTH_TOKEN || '';
  
  if (!authToken) {
    console.warn('⚠️  AUTH_TOKEN não configurado. Algumas requisições podem falhar.\n');
  }

  try {
    // Importar cada área principal
    for (const [key, area] of Object.entries(taxonomy)) {
      console.log(`\n📦 Processando: ${area.root.name}\n`);
      await createCategoryTree(area.root, null, authToken);
      
      if (area.children) {
        // Buscar o ID da categoria raiz criada
        await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1s
        const rootCategory = await findCategoryBySlug(area.root.slug, authToken);
        
        if (rootCategory) {
          for (const child of area.children) {
            await createCategoryTree(child, rootCategory.categoryId, authToken, 1);
          }
        }
      }
    }

    console.log('\n✅ Taxonomia importada com sucesso!');
  } catch (error) {
    console.error('\n❌ Erro durante importação:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  importTaxonomy();
}

module.exports = { importTaxonomy, taxonomy };








