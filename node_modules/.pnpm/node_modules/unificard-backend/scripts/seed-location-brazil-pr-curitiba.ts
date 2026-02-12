// Script para popular localização mínima: Brasil > Paraná > Curitiba + bairros
// Executa: npx tsx scripts/seed-location-brazil-pr-curitiba.ts

import { pool } from '../src/core/database/pool';
import 'dotenv/config';

async function seedLocationBrazilPRCuritiba() {
  console.log('🌍 Populando localização mínima: Brasil > Paraná > Curitiba...\n');

  try {
    // 1. Inserir ou buscar Brasil
    console.log('1️⃣ Inserindo/buscando Brasil...');
    const countryResult = await pool.query<{ country_id: string; code: string; name: string }>(
      `
      INSERT INTO countries (code, name, name_en)
      VALUES ('BR', 'Brasil', 'Brazil')
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, name_en = EXCLUDED.name_en
      RETURNING country_id as id, code, name
      `
    );
    const countryId = countryResult.rows[0].id;
    console.log(`   ✅ País: ${countryResult.rows[0].name} (${countryResult.rows[0].code}) - ID: ${countryId}`);

    // 2. Inserir ou buscar Paraná
    console.log('\n2️⃣ Inserindo/buscando Paraná...');
    const stateResult = await pool.query<{ state_id: string; code: string; name: string }>(
      `
      INSERT INTO states (country_id, code, name, name_en)
      VALUES ($1, 'PR', 'Paraná', 'Parana')
      ON CONFLICT (country_id, code) DO UPDATE SET name = EXCLUDED.name, name_en = EXCLUDED.name_en
      RETURNING state_id as id, code, name
      `,
      [countryId]
    );
    const stateId = stateResult.rows[0].id;
    console.log(`   ✅ Estado: ${stateResult.rows[0].name} (${stateResult.rows[0].code}) - ID: ${stateId}`);

    // 3. Inserir ou buscar Curitiba
    console.log('\n3️⃣ Inserindo/buscando Curitiba...');
    const cityResult = await pool.query<{ city_id: string; name: string }>(
      `
      INSERT INTO cities (state_id, name, name_en, latitude, longitude)
      VALUES ($1, 'Curitiba', 'Curitiba', -25.4284, -49.2733)
      ON CONFLICT (state_id, name) DO UPDATE SET name_en = EXCLUDED.name_en, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
      RETURNING city_id as id, name
      `,
      [stateId]
    );
    const cityId = cityResult.rows[0].id;
    console.log(`   ✅ Cidade: ${cityResult.rows[0].name} - ID: ${cityId}`);

    // 4. Verificar se tabela neighborhoods existe e inserir bairros de Curitiba
    console.log('\n4️⃣ Verificando tabela neighborhoods...');
    const neighborhoodsTableExists = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'neighborhoods')`
    );

    if (!neighborhoodsTableExists.rows[0]?.exists) {
      console.log('   ⚠️  Tabela neighborhoods não existe. Pulando inserção de bairros.');
      console.log('   💡 Execute a migration 115_location_core_neighborhoods.sql primeiro.');
    } else {
      console.log('   ✅ Tabela neighborhoods existe. Inserindo bairros de Curitiba...');
      const neighborhoods = [
        { name: 'Centro', name_en: 'Centro' },
        { name: 'Batel', name_en: 'Batel' },
        { name: 'Água Verde', name_en: 'Agua Verde' },
        { name: 'Boa Vista', name_en: 'Boa Vista' },
      ];

      let insertedNeighborhoods = 0;
      let existingNeighborhoods = 0;

      for (const neighborhood of neighborhoods) {
        const neighborhoodResult = await pool.query<{ neighborhood_id: string; name: string }>(
          `
          INSERT INTO neighborhoods (city_id, name, name_en)
          VALUES ($1, $2, $3)
          ON CONFLICT (city_id, name) DO UPDATE SET name_en = EXCLUDED.name_en
          RETURNING neighborhood_id as id, name
          `,
          [cityId, neighborhood.name, neighborhood.name_en]
        );

        if (neighborhoodResult.rows.length > 0) {
          // Verificar se foi inserido ou atualizado
          const checkResult = await pool.query(
            `SELECT neighborhood_id FROM neighborhoods WHERE city_id = $1 AND name = $2 AND name_en = $3`,
            [cityId, neighborhood.name, neighborhood.name_en]
          );
          
          if (checkResult.rows.length > 0 && checkResult.rows[0].neighborhood_id === neighborhoodResult.rows[0].id) {
            insertedNeighborhoods++;
            console.log(`   ✅ Inserido: ${neighborhood.name}`);
          } else {
            existingNeighborhoods++;
            console.log(`   🔄 Já existia: ${neighborhood.name}`);
          }
        }
      }

      console.log(`\n📊 Resumo de bairros:`);
      console.log(`   - Inseridos: ${insertedNeighborhoods}`);
      console.log(`   - Já existiam: ${existingNeighborhoods}`);
    }

    // 5. Verificar totais
    console.log('\n📊 Totais no banco:');
    const totalsQuery = `
      SELECT 'countries' as table_name, COUNT(*)::text as count FROM countries
      UNION ALL
      SELECT 'states', COUNT(*)::text FROM states
      UNION ALL
      SELECT 'cities', COUNT(*)::text FROM cities
    `;
    
    // Reutilizar verificação anterior da tabela neighborhoods
    const finalQuery = neighborhoodsTableExists.rows[0]?.exists
      ? `${totalsQuery} UNION ALL SELECT 'neighborhoods', COUNT(*)::text FROM neighborhoods`
      : totalsQuery;
    
    const totals = await pool.query<{ table_name: string; count: string }>(finalQuery);

    for (const row of totals.rows) {
      console.log(`   - ${row.table_name}: ${row.count}`);
    }

    // 6. Validar hierarquia
    console.log('\n✅ Validação da hierarquia:');
    
    // País
    const countryCheck = await pool.query<{ level: string; name: string; id: string }>(
      `SELECT 'País' as level, c.name, c.country_id::text as id FROM countries c WHERE c.code = 'BR'`
    );
    if (countryCheck.rows.length > 0) {
      console.log(`   ${countryCheck.rows[0].level}: ${countryCheck.rows[0].name} (${countryCheck.rows[0].id.substring(0, 8)}...)`);
    }
    
    // Estado
    const stateCheck = await pool.query<{ level: string; name: string; id: string }>(
      `SELECT 'Estado' as level, s.name, s.state_id::text as id FROM states s WHERE s.code = 'PR' AND s.country_id = (SELECT country_id FROM countries WHERE code = 'BR')`
    );
    if (stateCheck.rows.length > 0) {
      console.log(`   ${stateCheck.rows[0].level}: ${stateCheck.rows[0].name} (${stateCheck.rows[0].id.substring(0, 8)}...)`);
    }
    
    // Cidade
    const cityCheck = await pool.query<{ level: string; name: string; id: string }>(
      `SELECT 'Cidade' as level, ci.name, ci.city_id::text as id FROM cities ci WHERE ci.name = 'Curitiba' AND ci.state_id = (SELECT state_id FROM states WHERE code = 'PR' AND country_id = (SELECT country_id FROM countries WHERE code = 'BR'))`
    );
    if (cityCheck.rows.length > 0) {
      console.log(`   ${cityCheck.rows[0].level}: ${cityCheck.rows[0].name} (${cityCheck.rows[0].id.substring(0, 8)}...)`);
    }
    
    // Bairros (se a tabela existir)
    if (neighborhoodsTableExists.rows[0]?.exists) {
      const neighborhoodsCheck = await pool.query<{ level: string; name: string; id: string }>(
        `
        SELECT 
          'Bairro' as level,
          n.name,
          n.neighborhood_id::text as id
        FROM neighborhoods n
        WHERE n.city_id = (SELECT city_id FROM cities WHERE name = 'Curitiba' AND state_id = (SELECT state_id FROM states WHERE code = 'PR' AND country_id = (SELECT country_id FROM countries WHERE code = 'BR')))
        ORDER BY n.name
        `
      );
      
      for (const row of neighborhoodsCheck.rows) {
        console.log(`   ${row.level}: ${row.name} (${row.id.substring(0, 8)}...)`);
      }
    }

    console.log('\n✅ Seed concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao popular localização:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedLocationBrazilPRCuritiba()
  .then(() => {
    console.log('\n✅ Processo finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

