// Script para aplicar arquivamento de grupos e subgrupos (não são profissões)
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function applyArchive() {
  const client = await pool.connect();
  
  try {
    const sqlPath = path.join(__dirname, '../../docs/dev/sql/archive-non-professions.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error('❌ Arquivo SQL não encontrado:', sqlPath);
      console.log('💡 Execute primeiro: node scripts/audit-professional-categories.js');
      return;
    }
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📋 Aplicando arquivamento de grupos e subgrupos...');
    console.log('⚠️  ATENÇÃO: Isso arquivará grupos (level 0) e subgrupos (level 1)');
    console.log('⚠️  Eles são necessários para hierarquia, mas não são profissões\n');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log('✅ Arquivamento concluído!\n');
    
    // Verificar resultado
    const result = await client.query(`
      SELECT 
        level,
        status,
        COUNT(*) as total
      FROM categories
      GROUP BY level, status
      ORDER BY level, status
    `);
    
    console.log('=== RESULTADO ===');
    result.rows.forEach(row => {
      const levelLabel = row.level === 0 ? 'Grupos' : row.level === 1 ? 'Subgrupos' : row.level === 2 ? 'Profissões' : `Level ${row.level}`;
      console.log(`${levelLabel} (${row.status}): ${row.total}`);
    });
    
    // Contar profissões ativas
    const profissoes = await client.query(`
      SELECT COUNT(*) as total
      FROM categories
      WHERE level = 2 
        AND (SELECT COUNT(*) FROM categories WHERE parent_id = categories.category_id) = 0
        AND (status = 'active' OR status = 'auto_active')
    `);
    
    console.log(`\n✅ Profissões ativas (level 2, sem filhos): ${profissoes.rows[0].total}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyArchive().catch(console.error);















