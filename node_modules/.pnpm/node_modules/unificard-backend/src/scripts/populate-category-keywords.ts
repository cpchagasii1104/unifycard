// src/scripts/populate-category-keywords.ts
// Script para popular keywords/sinônimos nas categorias existentes

import { pool } from '@core/database/pool';
import dotenv from 'dotenv';

dotenv.config();

// Mapeamento de sinônimos comuns para categorias
const KEYWORDS_MAP: Record<string, string[]> = {
  // Marketing Digital
  'marketing digital': ['marketing digital', 'digital marketing', 'mkt digital', 'mktd', 'marketing online', 'marketing na internet', 'marketing web'],
  'marketing': ['marketing', 'mkt', 'publicidade', 'propaganda', 'comunicação'],
  
  // Tecnologia
  'programador': ['programador', 'desenvolvedor', 'dev', 'developer', 'codificador', 'programação'],
  'desenvolvedor': ['desenvolvedor', 'programador', 'dev', 'developer'],
  'designer': ['designer', 'design', 'desenhista', 'criador visual'],
  'design gráfico': ['design gráfico', 'design grafico', 'graphic design', 'design visual'],
  
  // Construção
  'pedreiro': ['pedreiro', 'alvenaria', 'construção', 'construcao', 'obra'],
  'eletricista': ['eletricista', 'instalação elétrica', 'instalacao eletrica', 'elétrica'],
  'encanador': ['encanador', 'encanamento', 'hidráulica', 'hidraulica', 'instalação hidráulica'],
  'pintor': ['pintor', 'pintura', 'pintor de parede', 'pintor residencial'],
  
  // Beleza
  'manicure': ['manicure', 'manicura', 'unhas', 'nail art', 'nail designer'],
  'cabeleireiro': ['cabeleireiro', 'cabeleireira', 'corte de cabelo', 'hair stylist', 'hair designer'],
  'esteticista': ['esteticista', 'estética', 'estetica', 'tratamento facial', 'skincare'],
  'barbeiro': ['barbeiro', 'barbearia', 'corte masculino', 'barber'],
  
  // Serviços Domésticos
  'faxineiro': ['faxineiro', 'faxineira', 'limpeza', 'diarista', 'empregada doméstica', 'empregada domestica'],
  'jardineiro': ['jardineiro', 'jardinagem', 'paisagismo', 'paisagista'],
  'cozinheiro': ['cozinheiro', 'cozinheira', 'chef', 'cook', 'culinária', 'culinaria'],
  
  // Transporte
  'motorista': ['motorista', 'motorista de aplicativo', 'uber', '99', 'taxi', 'chauffeur'],
  'entregador': ['entregador', 'delivery', 'entregas', 'motoboy', 'moto boy'],
  
  // Educação
  'professor': ['professor', 'professora', 'teacher', 'educador', 'educadora', 'instrutor'],
  'tutor': ['tutor', 'tutora', 'aulas particulares', 'reforço escolar'],
  
  // Saúde
  'personal trainer': ['personal trainer', 'personal', 'treinador', 'treinadora', 'fitness', 'academia'],
  'massagista': ['massagista', 'massagem', 'massoterapeuta', 'massage'],
  'nutricionista': ['nutricionista', 'nutrição', 'nutricao', 'dieta', 'alimentação'],
  
  // Outros
  'fotógrafo': ['fotógrafo', 'fotografo', 'photographer', 'fotografia', 'fotos'],
  'videomaker': ['videomaker', 'editor de vídeo', 'editor de video', 'video maker', 'produtor de vídeo'],
  'tradutor': ['tradutor', 'tradutora', 'tradução', 'traducao', 'translation'],
};

async function populateKeywords() {
  console.log('🌱 Iniciando população de keywords nas categorias...\n');

  try {
    // Buscar todas as categorias
    const categoriesResult = await pool.query<{
      category_id: string;
      name: string;
      keywords: string[] | null;
    }>(
      `
      SELECT category_id, name, keywords
      FROM categories
      ORDER BY name ASC
      `
    );

    const categories = categoriesResult.rows;
    console.log(`📋 Encontradas ${categories.length} categorias\n`);

    let updated = 0;
    let skipped = 0;

    for (const category of categories) {
      const categoryNameLower = category.name.toLowerCase().trim();
      
      // Procurar keywords no mapa
      let keywords: string[] = [];
      
      // Busca exata
      if (KEYWORDS_MAP[categoryNameLower]) {
        keywords = KEYWORDS_MAP[categoryNameLower];
      } else {
        // Busca parcial (se o nome da categoria contém uma chave do mapa)
        for (const [key, synonyms] of Object.entries(KEYWORDS_MAP)) {
          if (categoryNameLower.includes(key) || key.includes(categoryNameLower)) {
            keywords = synonyms;
            break;
          }
        }
      }

      // Se não encontrou, criar keywords básicas baseadas no nome
      if (keywords.length === 0) {
        // Adicionar variações básicas do nome
        keywords = [
          category.name.toLowerCase(),
          category.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), // sem acentos
        ];
        
        // Adicionar palavras individuais se houver mais de uma
        const words = category.name.toLowerCase().split(/\s+/);
        if (words.length > 1) {
          keywords.push(...words);
          // Adicionar combinação invertida (ex: "marketing digital" -> "digital marketing")
          keywords.push(words.reverse().join(' '));
        }
      }

      // Verificar se já tem keywords
      const existingKeywords = category.keywords && Array.isArray(category.keywords) 
        ? category.keywords 
        : [];
      
      // Mesclar keywords existentes com novas (sem duplicatas)
      const mergedKeywords = Array.from(new Set([...existingKeywords, ...keywords]));

      // Atualizar categoria
      await pool.query(
        `
        UPDATE categories
        SET keywords = $1::jsonb, updated_at = now()
        WHERE category_id = $2
        `,
        [JSON.stringify(mergedKeywords), category.category_id]
      );

      updated++;
      console.log(`✅ ${category.name}: ${mergedKeywords.length} keywords`);
    }

    console.log(`\n✨ Processo concluído!`);
    console.log(`   📊 Categorias atualizadas: ${updated}`);
    console.log(`   ⏭️  Categorias ignoradas: ${skipped}`);
  } catch (error) {
    console.error('❌ Erro ao popular keywords:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Executar
populateKeywords();


