// src/scripts/complete-professional-level2.ts
// Script para completar categorias profissionais nível 2 (profissões) para todos os subsetores existentes

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';
import { categoriesService } from '../core/categories/categories.service';

dotenv.config({ path: join(process.cwd(), '.env') });

/**
 * Mapeamento de profissões (nível 2) por subsetor (nível 1)
 * Cada subsetor recebe um conjunto de profissões reais, específicas e reconhecíveis
 */
const PROFESSOES_POR_SUBSETOR: Record<string, Array<{ name: string; slug: string }>> = {
  // CONSTRUÇÃO E REFORMAS
  'obras-construcao': [
    { name: 'Pedreiro', slug: 'pedreiro' },
    { name: 'Mestre de Obras', slug: 'mestre-obras' },
    { name: 'Encarregado de Obra', slug: 'encarregado-obra' },
    { name: 'Ajudante de Pedreiro', slug: 'ajudante-pedreiro' },
    { name: 'Armador', slug: 'armador' },
    { name: 'Carpinteiro de Formas', slug: 'carpinteiro-formas' },
  ],
  'reformas-acabamentos': [
    { name: 'Pintor', slug: 'pintor' },
    { name: 'Gesseiro', slug: 'gesseiro' },
    { name: 'Azulejista', slug: 'azulejista' },
    { name: 'Marceneiro', slug: 'marceneiro' },
    { name: 'Serralheiro', slug: 'serralheiro' },
    { name: 'Instalador de Pisos', slug: 'instalador-pisos' },
    { name: 'Aplicador de Revestimentos', slug: 'aplicador-revestimentos' },
  ],
  'instalacoes-eletricas-hidraulicas': [
    { name: 'Eletricista', slug: 'eletricista' },
    { name: 'Eletricista Industrial', slug: 'eletricista-industrial' },
    { name: 'Encanador', slug: 'encanador' },
    { name: 'Instalador Hidráulico', slug: 'instalador-hidraulico' },
    { name: 'Técnico em Refrigeração', slug: 'tecnico-refrigeracao' },
  ],
  'coberturas-telhados': [
    { name: 'Telhador', slug: 'telhador' },
    { name: 'Carpinteiro', slug: 'carpinteiro' },
    { name: 'Instalador de Coberturas', slug: 'instalador-coberturas' },
    { name: 'Instalador de Forros', slug: 'instalador-forros' },
  ],

  // TECNOLOGIA E INFORMÁTICA
  'desenvolvimento-software': [
    { name: 'Programador', slug: 'programador' },
    { name: 'Desenvolvedor Web', slug: 'desenvolvedor-web' },
    { name: 'Desenvolvedor Mobile', slug: 'desenvolvedor-mobile' },
    { name: 'Desenvolvedor Full Stack', slug: 'desenvolvedor-fullstack' },
    { name: 'Analista de Sistemas', slug: 'analista-sistemas' },
    { name: 'Arquiteto de Software', slug: 'arquiteto-software' },
    { name: 'Desenvolvedor Backend', slug: 'desenvolvedor-backend' },
    { name: 'Desenvolvedor Frontend', slug: 'desenvolvedor-frontend' },
  ],
  'suporte-tecnico': [
    { name: 'Técnico em Informática', slug: 'tecnico-informatica' },
    { name: 'Técnico em Manutenção de Computadores', slug: 'tecnico-manutencao-computadores' },
    { name: 'Suporte Técnico Remoto', slug: 'suporte-tecnico-remoto' },
    { name: 'Instalador de Redes', slug: 'instalador-redes' },
    { name: 'Técnico em Impressoras', slug: 'tecnico-impressoras' },
  ],
  'design-multimidia': [
    { name: 'Designer Gráfico', slug: 'designer-grafico' },
    { name: 'Web Designer', slug: 'web-designer' },
    { name: 'Designer de UX/UI', slug: 'designer-ux-ui' },
    { name: 'Ilustrador Digital', slug: 'ilustrador-digital' },
    { name: 'Motion Designer', slug: 'motion-designer' },
  ],

  // SERVIÇOS DOMÉSTICOS
  'limpeza': [
    { name: 'Faxineira', slug: 'faxineira' },
    { name: 'Diarista', slug: 'diarista' },
    { name: 'Limpeza Pós-Obra', slug: 'limpeza-pos-obra' },
    { name: 'Organizador de Ambientes', slug: 'organizador-ambientes' },
    { name: 'Lavadeira', slug: 'lavadeira' },
    { name: 'Passadeira', slug: 'passadeira' },
  ],
  'jardinagem-paisagismo': [
    { name: 'Jardineiro', slug: 'jardineiro' },
    { name: 'Paisagista', slug: 'paisagista' },
    { name: 'Podador', slug: 'podador' },
    { name: 'Técnico em Irrigação', slug: 'tecnico-irrigacao' },
  ],
  'manutencao-residencial': [
    { name: 'Técnico em Ar Condicionado', slug: 'tecnico-ar-condicionado' },
    { name: 'Técnico em Refrigeração', slug: 'tecnico-refrigeracao' },
    { name: 'Técnico em Eletrodomésticos', slug: 'tecnico-eletrodomesticos' },
    { name: 'Chaveiro', slug: 'chaveiro' },
    { name: 'Técnico em Portões Automáticos', slug: 'tecnico-portoes-automaticos' },
  ],

  // BELEZA E ESTÉTICA
  'cuidados-cabelo': [
    { name: 'Cabeleireiro', slug: 'cabeleireiro' },
    { name: 'Barbeiro', slug: 'barbeiro' },
    { name: 'Colorista', slug: 'colorista' },
    { name: 'Tricologista', slug: 'tricologista' },
    { name: 'Especialista em Extensões', slug: 'especialista-extensoes' },
  ],
  'manicure-pedicure': [
    { name: 'Manicure', slug: 'manicure' },
    { name: 'Pedicure', slug: 'pedicure' },
    { name: 'Esmaltadora', slug: 'esmaltadora' },
    { name: 'Técnico em Unhas', slug: 'tecnico-unhas' },
  ],
  'estetica-facial-corporal': [
    { name: 'Esteticista', slug: 'esteticista' },
    { name: 'Massagista', slug: 'massagista' },
    { name: 'Depilador', slug: 'depilador' },
    { name: 'Técnico em Estética', slug: 'tecnico-estetica' },
  ],

  // SAÚDE E BEM-ESTAR
  'fisioterapia-reabilitacao': [
    { name: 'Fisioterapeuta', slug: 'fisioterapeuta' },
    { name: 'Massoterapeuta', slug: 'massoterapeuta' },
    { name: 'Quiropraxista', slug: 'quiropraxista' },
    { name: 'Terapeuta Ocupacional', slug: 'terapeuta-ocupacional' },
  ],
  'nutricao-alimentacao': [
    { name: 'Nutricionista', slug: 'nutricionista' },
    { name: 'Personal Chef', slug: 'personal-chef' },
    { name: 'Cozinheiro', slug: 'cozinheiro' },
    { name: 'Confeiteiro', slug: 'confeiteiro' },
  ],

  // TRANSPORTE E LOGÍSTICA
  'transporte-cargas': [
    { name: 'Motorista de Caminhão', slug: 'motorista-caminhao' },
    { name: 'Carreteiro', slug: 'carreteiro' },
    { name: 'Mudanças', slug: 'mudancas' },
    { name: 'Entregador', slug: 'entregador' },
    { name: 'Motorista de Van', slug: 'motorista-van' },
  ],
  'transporte-pessoas': [
    { name: 'Motorista de Aplicativo', slug: 'motorista-aplicativo' },
    { name: 'Motorista Particular', slug: 'motorista-particular' },
    { name: 'Taxista', slug: 'taxista' },
    { name: 'Motorista de Ônibus', slug: 'motorista-onibus' },
  ],

  // COMÉRCIO E VENDAS
  'vendas-atendimento': [
    { name: 'Vendedor', slug: 'vendedor' },
    { name: 'Atendente', slug: 'atendente' },
    { name: 'Representante Comercial', slug: 'representante-comercial' },
    { name: 'Promotor de Vendas', slug: 'promotor-vendas' },
    { name: 'Consultor de Vendas', slug: 'consultor-vendas' },
  ],
  'marketing-publicidade': [
    { name: 'Social Media', slug: 'social-media' },
    { name: 'Fotógrafo', slug: 'fotografo' },
    { name: 'Videomaker', slug: 'videomaker' },
    { name: 'Redator Publicitário', slug: 'redator-publicitario' },
  ],

  // EDUCAÇÃO E ENSINO
  'aulas-particulares': [
    { name: 'Professor Particular', slug: 'professor-particular' },
    { name: 'Instrutor de Idiomas', slug: 'instrutor-idiomas' },
    { name: 'Monitor de Estudos', slug: 'monitor-estudos' },
    { name: 'Tutor', slug: 'tutor' },
  ],
  'cursos-treinamentos': [
    { name: 'Instrutor de Cursos', slug: 'instrutor-cursos' },
    { name: 'Treinador', slug: 'treinador' },
    { name: 'Coach', slug: 'coach' },
  ],

  // CINEMA E AUDIOVISUAL
  'producao-audiovisual': [
    { name: 'Produtor Audiovisual', slug: 'produtor-audiovisual' },
    { name: 'Diretor de Produção', slug: 'diretor-producao' },
    { name: 'Assistente de Produção', slug: 'assistente-producao' },
  ],
  'captacao-imagem-som': [
    { name: 'Operador de Câmera', slug: 'operador-camera' },
    { name: 'Cinegrafista', slug: 'cinegrafista' },
    { name: 'Técnico de Som', slug: 'tecnico-som' },
  ],
  'pos-producao': [
    { name: 'Editor de Vídeo', slug: 'editor-video' },
    { name: 'Colorista', slug: 'colorista-video' },
    { name: 'Motion Graphics', slug: 'motion-graphics' },
  ],

  // ENTERTENIMENTO E JOGOS
  'criacao-conteudo': [
    { name: 'Criador de Conteúdo Gamer', slug: 'criador-conteudo-gamer' },
    { name: 'Streamer', slug: 'streamer' },
    { name: 'Youtuber', slug: 'youtuber' },
  ],

  // LEITURA E LITERATURA
  'criacao-literaria': [
    { name: 'Escritor', slug: 'escritor' },
    { name: 'Roteirista', slug: 'roteirista' },
  ],
  'producao-conteudo': [
    { name: 'Redator', slug: 'redator' },
    { name: 'Copywriter', slug: 'copywriter' },
    { name: 'Revisor de Texto', slug: 'revisor-texto' },
  ],
  'revisao-preparacao-texto': [
    { name: 'Revisor de Texto', slug: 'revisor-texto' },
    { name: 'Preparador de Texto', slug: 'preparador-texto' },
    { name: 'Tradutor', slug: 'tradutor' },
  ],
};

/**
 * Busca todas as categorias nível 1 (subsetores) profissionais existentes
 */
async function getSubsetoresExistentes(): Promise<Array<{ category_id: string; name: string; slug: string; parent_id: string }>> {
  const result = await pool.query(`
    SELECT 
      category_id,
      name,
      slug,
      parent_id
    FROM categories
    WHERE scope = 'professional'
      AND level = 1
      AND (status IN ('active', 'auto_active') OR status IS NULL)
    ORDER BY name ASC
  `);

  return result.rows;
}

/**
 * Verifica se uma profissão já existe como filho de um subsetor
 */
async function profissaoExiste(parentId: string, slug: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT category_id
    FROM categories
    WHERE parent_id = $1
      AND slug = $2
      AND scope = 'professional'
    LIMIT 1
  `, [parentId, slug]);

  return result.rows.length > 0;
}

/**
 * Cria profissões (nível 2) para um subsetor
 */
async function criarProfissoesParaSubsetor(
  subsetor: { category_id: string; name: string; slug: string },
  profissoes: Array<{ name: string; slug: string }>
): Promise<number> {
  let criadas = 0;

  for (const profissao of profissoes) {
    try {
      // Verificar se já existe
      const existe = await profissaoExiste(subsetor.category_id, profissao.slug);
      if (existe) {
        console.log(`     ⏭️  Já existe: ${profissao.name}`);
        continue;
      }

      // Criar profissão
      const categoria = await categoriesService.createCategory(
        {
          name: profissao.name,
          slug: profissao.slug,
          description: null,
          parentId: subsetor.category_id,
          allowActive: true,
          createdBy: {
            source: 'script',
          },
        },
        {
          validateAdmin: false,
          context: 'professional',
          skipGate: true, // Pular gate para scripts de seed
        }
      );

      // Garantir que o scope seja 'professional' (herda do parent, mas vamos garantir)
      await pool.query(
        `UPDATE categories SET scope = 'professional' WHERE category_id = $1 AND scope != 'professional'`,
        [categoria.categoryId]
      );

      criadas++;
      console.log(`     ✅ Criada: ${profissao.name} (${categoria.categoryId})`);
    } catch (error) {
      console.log(`     ⚠️  Erro ao criar ${profissao.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  return criadas;
}

/**
 * Função principal
 */
async function completarProfissoes() {
  // GOVERNANÇA: Validar ambiente
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    throw new Error('❌ ERRO CRÍTICO: Scripts de seed NÃO podem ser executados em produção!');
  }

  console.log('🌱 Iniciando completamento de profissões (nível 2)...\n');
  console.log('⚠️  AVISO: Este script cria categorias como ACTIVE (unsafe)\n');

  // Buscar todos os subsetores existentes
  const subsetores = await getSubsetoresExistentes();
  console.log(`📊 Encontrados ${subsetores.length} subsetores (nível 1)\n`);

  if (subsetores.length === 0) {
    console.log('⚠️  Nenhum subsetor encontrado. Execute primeiro o seed de categorias nível 0 e 1.');
    process.exit(0);
  }

  let totalCriadas = 0;
  let subsetoresProcessados = 0;
  let subsetoresSemMapeamento = 0;

  for (const subsetor of subsetores) {
    console.log(`📂 Processando: ${subsetor.name} (${subsetor.slug})`);

    // Buscar profissões para este subsetor
    const profissoes = PROFESSOES_POR_SUBSETOR[subsetor.slug];

    if (!profissoes || profissoes.length === 0) {
      console.log(`   ⚠️  Nenhuma profissão mapeada para este subsetor\n`);
      subsetoresSemMapeamento++;
      continue;
    }

    console.log(`   📋 ${profissoes.length} profissões definidas`);
    const criadas = await criarProfissoesParaSubsetor(subsetor, profissoes);
    totalCriadas += criadas;
    subsetoresProcessados++;

    console.log(`   ✅ ${criadas} profissões criadas para ${subsetor.name}\n`);
  }

  console.log('\n=== RESUMO ===');
  console.log(`📊 Subsetores processados: ${subsetoresProcessados}`);
  console.log(`⚠️  Subsetores sem mapeamento: ${subsetoresSemMapeamento}`);
  console.log(`✨ Total de profissões criadas: ${totalCriadas}`);
  console.log('\n💡 Nota: Profissões que já existiam foram ignoradas (idempotente)');

  if (subsetoresSemMapeamento > 0) {
    console.log(`\n⚠️  ATENÇÃO: ${subsetoresSemMapeamento} subsetores não têm profissões mapeadas.`);
    console.log('   Adicione mapeamentos em PROFESSOES_POR_SUBSETOR para completar.');
  }
}

// Executar
completarProfissoes()
  .then(() => {
    console.log('\n✅ Processo finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

