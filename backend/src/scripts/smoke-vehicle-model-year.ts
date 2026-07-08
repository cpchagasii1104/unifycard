// F-VEHICLE-MODEL-YEAR — provas NEGATIVAS: combinação inválida marca→modelo→concept→ano = 400.
import { pool } from '@core/database/pool';
import { vehicleCatalogService } from '@core/catalog/vehicle-catalog.service';

async function main() {
  const q = (s: string, p: any[] = []) => pool.query(s, p);
  const carro = (await q(`SELECT concept_id::text FROM concepts WHERE slug='carro'`)).rows[0].concept_id;
  const moto = (await q(`SELECT concept_id::text FROM concepts WHERE slug='motocicleta'`)).rows[0].concept_id;
  const honda = (await q(`SELECT id::text FROM vehicle_makes WHERE slug='honda'`)).rows[0].id;
  const vw = (await q(`SELECT id::text FROM vehicle_makes WHERE slug='volkswagen'`)).rows[0].id;
  const civic = (await q(`SELECT id::text FROM vehicle_models WHERE slug='civic'`)).rows[0].id;    // Honda + carro
  const cg160 = (await q(`SELECT id::text FROM vehicle_models WHERE slug='cg-160'`)).rows[0].id;   // Honda + moto
  const fusca = (await q(`SELECT id::text FROM vehicle_models WHERE slug='fusca'`)).rows[0].id;    // VW + carro

  const ok = (name: string, cond: boolean) => console.log(`${cond ? '✅' : '❌'} ${name}`);
  const V = (i: any) => vehicleCatalogService.validateVehicleCombo(i);

  // POSITIVOS
  ok('Honda+Civic+carro+2020 → válido', (await V({ makeId: honda, modelId: civic, conceptId: carro, year: 2020 })).ok === true);
  ok('VW+Fusca+carro+1975 → válido (ano histórico governado)', (await V({ makeId: vw, modelId: fusca, conceptId: carro, year: 1975 })).ok === true);
  ok('Honda+Civic+carro SEM ano → válido (ano é opcional)', (await V({ makeId: honda, modelId: civic, conceptId: carro })).ok === true);

  // NEGATIVOS
  const n1 = await V({ makeId: vw, modelId: civic, conceptId: carro, year: 2020 });          // modelo de outra marca
  ok('Civic com marca VW → 400 (mismatch)', !n1.ok && n1.code === 'VEHICLE_MODEL_MAKE_CONCEPT_MISMATCH');
  const n2 = await V({ makeId: honda, modelId: cg160, conceptId: carro, year: 2020 });        // moto declarada como carro
  ok('CG160 com concept carro → 400 (mismatch)', !n2.ok && n2.code === 'VEHICLE_MODEL_MAKE_CONCEPT_MISMATCH');
  const n3 = await V({ makeId: vw, modelId: fusca, conceptId: carro, year: 1900 });           // ano fora do governado
  ok('Fusca 1900 → 400 (ano não governado)', !n3.ok && n3.code === 'VEHICLE_YEAR_NOT_GOVERNED_FOR_MODEL');
  const n4 = await V({ makeId: honda, modelId: '00000000-0000-0000-0000-000000000000', conceptId: carro, year: 2020 }); // UUID inexistente
  ok('modelId inexistente → 400', !n4.ok);
  const n5 = await V({ makeId: honda, modelId: null, conceptId: carro });                      // sem modelo
  ok('sem modelId → 400', !n5.ok && n5.code === 'VEHICLE_MODEL_REQUIRED');

  // years endpoint
  const yrs = await vehicleCatalogService.listModelYears(fusca);
  ok('listModelYears(Fusca) só anos governados (1970-1986)', yrs.length > 0 && Math.min(...yrs) === 1970 && Math.max(...yrs) === 1986);

  const bank = await q(`SELECT count(*)::int n FROM bank_ledger`);
  console.log('✅ Δbank check — linhas:', bank.rows[0].n);
  await pool.end();
}
main().catch(e => { console.error('SMOKE FAIL:', e.message); process.exit(1); });
