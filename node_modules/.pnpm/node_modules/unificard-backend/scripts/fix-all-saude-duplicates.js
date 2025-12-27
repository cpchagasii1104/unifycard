// Script para consolidar TODAS as duplicatas de Saúde/Saúde e Bem-Estar
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixAllSaudeDuplicates() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Buscar TODAS as categorias relacionadas a Saúde (raízes)
    const result = await client.query(`
      SELECT 
        category_id,
        name,
        slug,
        created_at,
        (SELECT COUNT(*) FROM categories WHERE parent_id = c.category_id) as num_filhos
      FROM categories c
      WHERE (LOWER(name) LIKE '%saúde%' OR LOWER(name) LIKE '%saude%' OR LOWER(name) LIKE '%bem-estar%')
        AND parent_id IS NULL
      ORDER BY created_at ASC, num_filhos DESC
    `);
    
    console.log('=== CATEGORIAS ENCONTRADAS ===');
    result.rows.forEach(row => {
      console.log(`ID: ${row.category_id}, Nome: ${row.name}, Filhos: ${row.num_filhos}`);
    });
    
    if (result.rows.length === 0) {
      console.log('ℹ️ Nenhuma categoria encontrada');
      await client.query('COMMIT');
      return;
    }
    
    // 2. Escolher canônica: "Saúde e Bem-Estar" (mais específica) ou a mais antiga com mais filhos
    let canonId = null;
    let canonName = null;
    
    // Priorizar "Saúde e Bem-Estar"
    const saudeBemEstar = result.rows.find(r => 
      r.name.toLowerCase().includes('bem-estar') || r.slug === 'saude-e-bem-estar'
    );
    
    if (saudeBemEstar) {
      canonId = saudeBemEstar.category_id;
      canonName = saudeBemEstar.name;
      console.log(`\n✅ Canônica escolhida: "${canonName}" (${canonId})`);
    } else {
      // Se não existir, criar "Saúde e Bem-Estar"
      const insertResult = await client.query(`
        INSERT INTO categories (
          name, slug, description, parent_id, level, path, keywords,
          country_code, status, requires_review, created_by_ai, created_at, updated_at
        )
        VALUES (
          'Saúde e Bem-Estar',
          'saude-e-bem-estar',
          'Grupo consolidado: Saúde e Bem-Estar',
          NULL,
          0,
          ARRAY['saude-e-bem-estar'],
          '["saude", "bem-estar", "saúde"]'::jsonb,
          NULL,
          'active',
          false,
          false,
          NOW(),
          NOW()
        )
        RETURNING category_id, name
      `);
      canonId = insertResult.rows[0].category_id;
      canonName = insertResult.rows[0].name;
      console.log(`\n✅ Criada canônica: "${canonName}" (${canonId})`);
    }
    
    // 3. Para cada duplicata (exceto a canônica), migrar filhos e deletar
    for (const row of result.rows) {
      if (row.category_id === canonId) {
        continue; // Pular a canônica
      }
      
      console.log(`\n📦 Processando duplicata: "${row.name}" (${row.category_id})`);
      
      // Contar filhos
      const filhosResult = await client.query(`
        SELECT COUNT(*) as count
        FROM categories
        WHERE parent_id = $1
      `, [row.category_id]);
      const filhosCount = parseInt(filhosResult.rows[0].count);
      
      // Reapontar filhos
      if (filhosCount > 0) {
        const updateResult = await client.query(`
          UPDATE categories 
          SET parent_id = $1
          WHERE parent_id = $2
        `, [canonId, row.category_id]);
        console.log(`  ✅ Reapontados ${updateResult.rowCount} filhos para "${canonName}"`);
      }
      
      // Atualizar logs
      const logsResult = await client.query(`
        UPDATE category_ai_logs 
        SET category_id = $1
        WHERE category_id = $2
      `, [canonId, row.category_id]);
      console.log(`  ✅ Atualizados ${logsResult.rowCount} logs`);
      
      // Deletar duplicata
      await client.query(`
        DELETE FROM categories 
        WHERE category_id = $1
      `, [row.category_id]);
      console.log(`  ✅ Duplicata deletada`);
    }
    
    await client.query('COMMIT');
    console.log('\n✅✅✅ Consolidação completa!');
    
    // Verificar resultado final
    const finalResult = await client.query(`
      SELECT 
        category_id,
        name,
        slug,
        (SELECT COUNT(*) FROM categories WHERE parent_id = c.category_id) as num_filhos
      FROM categories c
      WHERE (LOWER(name) LIKE '%saúde%' OR LOWER(name) LIKE '%saude%' OR LOWER(name) LIKE '%bem-estar%')
        AND parent_id IS NULL
      ORDER BY name
    `);
    
    console.log('\n=== RESULTADO FINAL ===');
    if (finalResult.rows.length === 1) {
      console.log(`✅ Única categoria: "${finalResult.rows[0].name}" com ${finalResult.rows[0].num_filhos} filhos`);
    } else {
      finalResult.rows.forEach(row => {
        console.log(`⚠️ Ainda existe: "${row.name}" com ${row.num_filhos} filhos`);
      });
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixAllSaudeDuplicates().catch(console.error);















