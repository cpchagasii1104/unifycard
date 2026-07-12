#!/usr/bin/env tsx
// N2-F — provas runtime TS do mapper/assert territorial (sem DB). assertNeighborhoodRequiresCity:
// nb-sem-city → 400; caso permitido → sem erro. mapAddressTerritorialConstraintError: mapeia SÓ as 2
// constraints por nome exato; FK não-territorial e infra PROPAGAM intactas (nunca engolidas).
import { assertNeighborhoodRequiresCity, mapAddressTerritorialConstraintError } from '../src/core/location/address-territorial-errors';

let fails = 0;
const ok = (m: string) => console.log('   ✅ ' + m);
const bad = (m: string) => { console.log('   ❌ ' + m); fails++; };

// assert estrutural
try { assertNeighborhoodRequiresCity(null, 'nb-uuid'); bad('A1 nb sem city deveria lançar'); }
catch (e: any) { e?.statusCode === 400 ? ok('A1 nb sem city → 400') : bad(`A1 → ${e?.statusCode}`); }
try { assertNeighborhoodRequiresCity('city', 'nb'); ok('A2 par preenchido → sem erro'); } catch (e: any) { bad(`A2 lançou: ${e?.message}`); }
try { assertNeighborhoodRequiresCity('city', null); ok('A3 city sem nb → sem erro'); } catch (e: any) { bad(`A3 lançou: ${e?.message}`); }
try { assertNeighborhoodRequiresCity(null, null); ok('A4 NULL/NULL → sem erro'); } catch (e: any) { bad(`A4 lançou: ${e?.message}`); }

// mapper: CHECK territorial → 400
try { mapAddressTerritorialConstraintError({ constraint: 'ck_addresses_neighborhood_requires_city', code: '23514' }); bad('M1 deveria lançar'); }
catch (e: any) { e?.statusCode === 400 ? ok('M1 CHECK territorial → 400') : bad(`M1 → ${e?.statusCode}`); }
// mapper: FK composta → 409
try { mapAddressTerritorialConstraintError({ constraint: 'fk_addresses_city_neighborhood', code: '23503' }); bad('M2 deveria lançar'); }
catch (e: any) { e?.statusCode === 409 ? ok('M2 FK composta → 409 conflict') : bad(`M2 → ${e?.statusCode}`); }
// mapper: FK NÃO-territorial → PROPAGA intacta (mesmo objeto, não vira 4xx de domínio)
const infra = { constraint: 'addresses_country_id_fkey', code: '23503', message: 'infra' };
try { mapAddressTerritorialConstraintError(infra); bad('M3 deveria repropagar'); }
catch (e: any) { (e === infra) ? ok('M3 FK não-territorial PROPAGA intacta (não mascarada)') : bad(`M3 mascarou: sc=${e?.statusCode}`); }
// mapper: erro de infra genérico (sem constraint) → PROPAGA
const generic = new Error('connection reset');
try { mapAddressTerritorialConstraintError(generic); bad('M4 deveria repropagar'); }
catch (e: any) { (e === generic) ? ok('M4 infra genérica PROPAGA intacta') : bad(`M4 mascarou: ${e?.message}`); }

console.log(fails === 0 ? '\nTS RUNTIME OK — assert estrutural (nb-sem-city→400) e mapper (SÓ constraints territoriais por nome exato; resto PROPAGA).' : `\nTS RUNTIME FAIL (${fails}).`);
process.exit(fails ? 1 : 0);
