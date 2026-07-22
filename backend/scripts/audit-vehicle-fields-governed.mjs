// F-GOVERNED-COMBOBOX-CASCADE (Clayton 2026-07-07): veículo em locação NÃO usa input de texto/número
// livre para marca/modelo/ano — só a cascata governada <VehicleFields> (combobox reabrível + ano via
// endpoint). Guard leve, protege a MATRIZ UI ATUAL; evoluir exige prova e atualizar este guard, nunca
// desligar. NÃO valida verdade (isso é do backend) — só impede reintrodução de campo livre no cliente.
//
// ENDURECIDO (F-GUARD-HARDENING-MIGRATION-DDL-RECOGNITION, 2ª TRANCHE 2A) — achado de PRECISÃO no
// check 9 (money-adjacent): a busca da migration de preço usava `readdirSync(migDir).find(f =>
// f.includes('rental_resource_pricing_tiers'))` — SUBSTRING DE NOME DE ARQUIVO, não nome de tabela.
// Isso casava `20260708150000_rental_resource_pricing_tiers.sql`, cujo CREATE TABLE real é
// `rental_resource_pricing` (singular, SEM "_tiers" — tabela ÓRFÃ, zero referência em backend/src).
// A tabela de dinheiro VIVA `actor_asset_rental_pricing_tiers` — criada em
// `20260708400000_asset_rental_terms_substrate.sql`, nome de arquivo que NUNCA casa a substring — era
// 100% invisível ao check de tipo BIGINT: qualquer CREATE/ALTER errado na tabela real passava batido.
// Agora a migration-alvo é localizada por CONTEÚDO (createsTarget varrendo migrations/, não nome de
// arquivo). ADICIONALMENTE (mesma classe de precisão, mesmo alvo, mesmo arquivo): varre as DEMAIS
// migrations por `ALTER COLUMN price_cents TYPE <não-BIGINT>` na tabela viva — fecha o gap de drift
// pós-criação (achado já registrado no cartório como parte do MESMO achado de precisão).
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { stripSqlComments, maskStringLiterals, splitStatements, createsTarget, tokenPresent } from './lib/sql-shape.mjs';

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

// 6) Categoria (todos os tipos) usa <GovernedCombobox> reabrível — NÃO input+ul manual (bug do MVP).
check('Categoria usa <GovernedCombobox> (reabrível, não input+ul)', /<GovernedCombobox<RentalConceptOption>/.test(rental));

// 7) RFC-*-USE-AREAS-MVP: área de uso vem do backend (listEquipmentUseAreas), sem lista local. Proíbe
//    array hardcoded de áreas OU de equipamentos no frontend (os labels/codes governados no cliente).
check('Área de uso consome listEquipmentUseAreas (backend, sem lista local)', /listEquipmentUseAreas\(/.test(rental));
const AREA_CODES = ['construction_reform','cleaning_conservation','gardening_land','events_parties','audio_video_lighting','energy_support'];
const hardcodedAreas = AREA_CODES.filter((c) => rental.includes(`'${c}'`) || rental.includes(`"${c}"`)).length >= 2;
check('Sem lista local de códigos de área no frontend', !hardcodedAreas);
const EQUIP_SLUGS = ['furadeira','betoneira','lavadora-alta-pressao','motosserra','tenda','caixa-de-som'];
const hardcodedEquip = EQUIP_SLUGS.filter((s) => rental.includes(`'${s}'`) || rental.includes(`"${s}"`)).length >= 2;
check('Sem lista local de equipamentos no frontend', !hardcodedEquip);

// 8) F-RENTABLE-RESOURCE-LOCATION-MVP: localização é GOVERNADA (cities/addresses/address_assignments),
//    nunca city_name livre no recurso. O front resolve cidade no backend (searchCities), não texto.
const rentalPage = strip(read(join(FE, 'pages', 'RentalResourceListPage.tsx')));
// city_name snake = coluna/campo livre (proibido). cityName camelCase = projeção read-only do backend
// (legítima — nome da cidade vindo da SSOT). <input ... cidade> = campo de texto livre de cidade (proibido).
check('locação NÃO tem city_name livre nem input de texto de cidade', !/city_name|<input[^>]*cidade/i.test(rentalPage));
check('locação resolve cidade no backend (searchCities/GovernedCombobox)', /searchCities\(/.test(rentalPage));
const rentalRepo = strip(read(join(process.cwd(), 'src', 'modules', 'rentals', 'rentable-resource.repository.ts')));
// F-ASSET-MULTI-OFFER-FOUNDATION 2b-4: address PICKUP convergiu para owner_type='actor_asset' (owner_id=asset_id).
check('recurso vincula localização via address_assignments (padrão canônico, owner_type=actor_asset)', /address_assignments/.test(rentalRepo) && /owner_type\s*=?\s*.?actor_asset/.test(rentalRepo));
check('backend valida cidade na SSOT (cityExists sobre cities)', /cityExists/.test(rentalRepo) && /FROM cities/.test(rentalRepo));

// 9) F-RENTAL-PRICING-QUANTITY-GEO-MVP: dinheiro SEMPRE cents/BIGINT; faixas na SSOT; front envia cents.
// ENDURECIDO: localiza a migration que CRIA a tabela viva por CONTEÚDO (createsTarget), não por nome
// de arquivo — fecha o achado de precisão acima (arquivo errado era lido).
const PRICING_TABLE = 'actor_asset_rental_pricing_tiers';
const migDir = join(process.cwd(), 'migrations');
let pricingMigFile = null;
let pricingSql = '';
for (const f of readdirSync(migDir).filter((e) => e.endsWith('.sql'))) {
  const raw = read(join(migDir, f));
  if (!raw) continue;
  const clean = maskStringLiterals(stripSqlComments(raw), { maskDollarQuotes: false });
  if (createsTarget(clean, PRICING_TABLE).hit) { pricingMigFile = f; pricingSql = raw; break; }
}
check(`migration que CRIA ${PRICING_TABLE} localizada por conteúdo (não nome de arquivo): ${pricingMigFile || 'NÃO ENCONTRADA'}`, !!pricingMigFile);
check('faixa de preço usa price_cents BIGINT (nunca NUMERIC/DECIMAL/FLOAT)',
  /price_cents\s+BIGINT/i.test(pricingSql) && !/price[_a-z]*\s+(NUMERIC|DECIMAL|FLOAT|REAL|DOUBLE)/i.test(pricingSql));
// CHECK pode ser inline (`unit TEXT NOT NULL CHECK (...)`) OU table-level named (`CONSTRAINT x CHECK
// (unit IN (...))` separado) — a tabela viva usa a forma named; reconhecer as duas (nenhuma mais fraca).
{
  const unitTextNotNull = /\bunit\s+TEXT\s+NOT\s+NULL\b/i.test(pricingSql);
  const unitCheckInline = /\bunit\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(/i.test(pricingSql);
  const unitCheckNamed = /CONSTRAINT\s+\w+\s+CHECK\s*\(\s*unit\b/i.test(pricingSql);
  check('unidade de preço é vocabulário governado (CHECK inline ou named), não string solta',
    unitTextNotNull && (unitCheckInline || unitCheckNamed));
}

// drift pós-criação: nenhuma OUTRA migration altera price_cents para tipo não-BIGINT na tabela viva.
// Antes do endurecimento este gap era ainda mais amplo (a tabela real nem era lida); agora, mesmo já
// lendo a tabela certa, uma ALTER COLUMN TYPE futura continuaria invisível sem este scan dedicado.
let priceDrift = null;
for (const f of readdirSync(migDir).filter((e) => e.endsWith('.sql'))) {
  if (f === pricingMigFile) continue;
  const raw = read(join(migDir, f));
  if (!raw || !tokenPresent(stripSqlComments(raw), PRICING_TABLE)) continue;
  const clean = maskStringLiterals(stripSqlComments(raw), { maskDollarQuotes: false });
  for (const stmt of splitStatements(clean)) {
    const t = `(?:"?[A-Za-z_][\\w$]*"?\\s*\\.\\s*)?"?${PRICING_TABLE}"?`;
    const touches = new RegExp(`\\bALTER\\s+TABLE\\s+(?:ONLY\\s+)?${t}\\b`, 'i').test(stmt);
    if (!touches) continue;
    const m = /\bALTER\s+COLUMN\s+"?price_cents"?\s+TYPE\s+(?!BIGINT\b)([A-Za-z_][\w\s(),]*)/i.exec(stmt);
    if (m) { priceDrift = `migrations/${f}: ALTER COLUMN price_cents TYPE ${m[1].trim()} (não-BIGINT) na tabela viva ${PRICING_TABLE}.`; break; }
  }
  if (priceDrift) break;
}
check('nenhuma migration posterior altera price_cents para tipo não-BIGINT na tabela viva', !priceDrift, priceDrift || undefined);

const rentalRepo2 = strip(read(join(process.cwd(), 'src', 'modules', 'rentals', 'rentable-resource.repository.ts')));
// F-ASSET-MULTI-OFFER-FOUNDATION 2b-3: tiers convergiram para actor_asset_rental_pricing_tiers (por asset_id).
check('faixas gravam em actor_asset_rental_pricing_tiers (SSOT convergido), price_cents::bigint', /actor_asset_rental_pricing_tiers/.test(rentalRepo2) && /price_cents.*bigint|::bigint/.test(rentalRepo2));
check('frontend envia priceCents convertendo R$→cents (* 100), não reais', /priceCents/.test(rentalPage) && /Math\.round/.test(rentalPage) && /\*\s*100/.test(rentalPage) && /pricingTiers/.test(rentalPage));
check('quantidade só aparece para equipment no front', /resourceType === 'equipment'[^]*Quantidade/.test(rentalPage) || /Quantidade[^]*resourceType === 'equipment'/.test(rentalPage) || /resourceType === 'equipment' && \(/.test(rentalPage));

// 10) F-RENTAL Fases 4/5: localização governada + descoberta backend-first, vitrine sem endereço.
const rentalRepo3 = strip(read(join(process.cwd(), 'src', 'modules', 'rentals', 'rentable-resource.repository.ts')));
const discoverBlock = (rentalRepo3.split('discoverRentals')[1] || '').split('async updateStatus')[0];
check('descoberta calcula distância no backend (haversine_distance_km)', /haversine_distance_km/.test(discoverBlock));
check('descoberta NÃO seleciona rua/número/complemento (privacidade da vitrine)', !/ad\.street|ad\.number|ad\.complement|a\.street|a\.number/.test(discoverBlock));
check('CEP resolvido no backend via provider governado (não o front decide coord)', /getDefaultCepProvider|resolveCepGeo/.test(strip(read(join(process.cwd(), 'src', 'modules', 'rentals', 'rentable-resource.service.ts')))));
check('front busca via /discover backend (não filtra distância local)', /discoverRentals\(/.test(rentalPage) && !/haversine|Math\.acos|6371/.test(rentalPage));

if (fail) { console.log(`\nVEHICLE-FIELDS-GOVERNED: FAIL (${fail})`); process.exit(1); }
console.log('\nVEHICLE-FIELDS-GOVERNED: OK');
