// Script para popular países básicos (idempotente)
// Executa: npx tsx scripts/seed-countries-basic.ts

import { pool } from '../src/core/database/pool';
import 'dotenv/config';

async function seedCountries() {
  console.log('🌍 Populando países básicos...\n');

  try {
    // Países principais (Brasil e alguns outros comuns)
    const countries = [
      { code: 'BR', name: 'Brasil', name_en: 'Brazil' },
      { code: 'US', name: 'Estados Unidos', name_en: 'United States' },
      { code: 'AR', name: 'Argentina', name_en: 'Argentina' },
      { code: 'CL', name: 'Chile', name_en: 'Chile' },
      { code: 'CO', name: 'Colômbia', name_en: 'Colombia' },
      { code: 'MX', name: 'México', name_en: 'Mexico' },
      { code: 'PT', name: 'Portugal', name_en: 'Portugal' },
      { code: 'ES', name: 'Espanha', name_en: 'Spain' },
      { code: 'FR', name: 'França', name_en: 'France' },
      { code: 'DE', name: 'Alemanha', name_en: 'Germany' },
      { code: 'IT', name: 'Itália', name_en: 'Italy' },
      { code: 'GB', name: 'Reino Unido', name_en: 'United Kingdom' },
      { code: 'CA', name: 'Canadá', name_en: 'Canada' },
      { code: 'AU', name: 'Austrália', name_en: 'Australia' },
      { code: 'JP', name: 'Japão', name_en: 'Japan' },
      { code: 'CN', name: 'China', name_en: 'China' },
    ];

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const country of countries) {
      const result = await pool.query<{ country_id: string; code: string; name: string }>(
        `
        INSERT INTO countries (code, name, name_en)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE SET 
          name = EXCLUDED.name,
          name_en = EXCLUDED.name_en
        RETURNING country_id as id, code, name
        `,
        [country.code, country.name, country.name_en]
      );

      if (result.rows.length > 0) {
        const existing = await pool.query(
          `SELECT country_id FROM countries WHERE code = $1 AND name = $2 AND name_en = $3`,
          [country.code, country.name, country.name_en]
        );
        
        if (existing.rows.length > 0 && existing.rows[0].country_id === result.rows[0].id) {
          // Foi inserido (não existia antes)
          inserted++;
          console.log(`✅ Inserido: ${country.name} (${country.code})`);
        } else {
          // Foi atualizado
          updated++;
          console.log(`🔄 Atualizado: ${country.name} (${country.code})`);
        }
      } else {
        skipped++;
      }
    }

    console.log(`\n📊 Resumo:`);
    console.log(`   - Inseridos: ${inserted}`);
    console.log(`   - Atualizados: ${updated}`);
    console.log(`   - Ignorados: ${skipped}`);

    // Verificar total
    const totalResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM countries`
    );
    console.log(`\n✅ Total de países no banco: ${totalResult.rows[0]?.count || '0'}`);

  } catch (error) {
    console.error('❌ Erro ao popular países:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedCountries()
  .then(() => {
    console.log('\n✅ Seed concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });







