// F-GOVERNED-COMBOBOX-CASCADE (Clayton 2026-07-07): veículo em locação NÃO usa input de texto/número
// livre para marca/modelo/ano — só a cascata governada <VehicleFields> (combobox reabrível + ano via
// endpoint). Guard leve, protege a MATRIZ UI ATUAL; evoluir exige prova e atualizar este guard, nunca
// desligar. NÃO valida verdade (isso é do backend) — só impede reintrodução de campo livre no cliente.
import { readFileSync } from 'fs';
import { join } from 'path';

const FE = join(process.cwd(), '..', 'frontend', 'src');
const strip = (s) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
let fail = 0;
const check = (name, ok) => { console.log(`  ${ok ? 'OK ' : 'XX '} ${name}`); if (!ok) fail++; };

// 1) A locação renderiza <VehicleFields> (cascata governada) para o caminho de veículo.
const rental = strip(read(join(FE, 'pages', 'RentalResourceListPage.tsx')));
check('RentalResourceListPage usa <VehicleFields>', /<VehicleFields\b/.test(rental));

// 2) A locação NÃO reintroduz estado de texto livre de veículo (makeQuery/modelQuery/attrAno).
const hasFreeText = /\b(makeQuery|modelQuery|attrAno)\b/.test(rental);
check('RentalResourceListPage sem estado de texto livre (makeQuery/modelQuery/attrAno)', !hasFreeText);

// 3) VehicleFields existe e cada campo é <GovernedCombobox> (marca/modelo/ano), nunca <input>.
const vf = strip(read(join(FE, 'components', 'composer', 'VehicleFields.tsx')));
check('VehicleFields existe', vf.length > 0);
check('VehicleFields não tem <input> livre (só GovernedCombobox)', vf.length > 0 && !/<input\b/.test(vf) && /<GovernedCombobox\b/.test(vf));

// 4) O ano vem do endpoint governado (listVehicleModelYears), não de digitação.
check('Ano consome listVehicleModelYears (endpoint governado)', /listVehicleModelYears\(/.test(vf));

// 5) GovernedCombobox é genérico — não conhece veículo/marca/modelo/concept/actor (só UX).
const gcb = strip(read(join(FE, 'components', 'common', 'GovernedCombobox.tsx')));
const leaks = /(vehicle|make|model|concept|actor|marca|modelo)/i.test(gcb.replace(/loadOptions|getOption\w+/g, ''));
check('GovernedCombobox é genérico (não acopla domínio de veículo)', gcb.length > 0 && !leaks);

if (fail) { console.log(`\nVEHICLE-FIELDS-GOVERNED: FAIL (${fail})`); process.exit(1); }
console.log('\nVEHICLE-FIELDS-GOVERNED: OK');
