// src/scripts/fix-learning-scope.ts
// Script para corrigir o scope das categorias de aprendizado

import dotenv from 'dotenv';
import { join } from 'path';
import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

async function fixLearningScope() {
  console.log('🔧 Corrigindo scope das categorias de aprendizado...\n');

  try {
    // 1. Identificar categorias que foram criadas pelo seed de learning
    // Elas estão com scope='global' ou scope IS NULL mas têm nomes específicos de learning
    const learningRoots = [
      'Criatividade e Expressão',
      'Desenvolvimento Pessoal',
      'Tecnologia e Digital',
      'Idiomas e Comunicação',
      'Saúde e Bem-estar',
      'Finanças Pessoais',
      'Culinária e Gastronomia',
      'Música e Áudio',
      'Esportes e Movimento',
      'Natureza e Sustentabilidade',
    ];

    // 2. Atualizar scope para 'learning' nas categorias raiz
    for (const rootName of learningRoots) {
      const result = await pool.query(
        `UPDATE categories
         SET scope = 'learning'
         WHERE name = $1 AND level = 0
         RETURNING category_id, name`,
        [rootName]
      );

      if (result.rowCount && result.rowCount > 0) {
        console.log(`✅ Atualizado: ${rootName}`);

        // 3. Atualizar todas as categorias filhas (level 1 e 2)
        const rootId = result.rows[0].category_id;

        // Atualizar filhos diretos (level 1)
        const level1Result = await pool.query(
          `UPDATE categories
           SET scope = 'learning'
           WHERE parent_id = $1
           RETURNING category_id`,
          [rootId]
        );

        console.log(`   └─ ${level1Result.rowCount} subcategorias atualizadas`);

        // Atualizar netos (level 2)
        if (level1Result.rows.length > 0) {
          const level1Ids = level1Result.rows.map((r: any) => r.category_id);
          const level2Result = await pool.query(
            `UPDATE categories
             SET scope = 'learning'
             WHERE parent_id = ANY($1)
             RETURNING category_id`,
            [level1Ids]
          );

          console.log(`      └─ ${level2Result.rowCount} temas específicos atualizados`);
        }
      }
    }

    // 4. Verificar resultado
    const finalCheck = await pool.query<{ scope: string; count: string }>(
      `SELECT scope, COUNT(*) as count FROM categories GROUP BY scope ORDER BY scope`
    );

    console.log('\n📈 Resultado final por SCOPE:');
    finalCheck.rows.forEach((r) => {
      console.log(`   scope="${r.scope || 'NULL'}": ${r.count} categorias`);
    });

    console.log('\n✨ Correção concluída!');
    await pool.end();
  } catch (error) {
    console.error('❌ Erro:', error);
    await pool.end();
    process.exit(1);
  }
}

fixLearningScope();
