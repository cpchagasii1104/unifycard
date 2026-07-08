// audit-audience-single-source.mjs — FONTE ÚNICA de plateia (Clayton 2026-07-07)
// A LISTA de opções de plateia ("Para quem é isso?") nasce SÓ do transversal /audience-options
// (backend deriva de PAIR_ALLOWED_LABELS). Nenhuma tela pode re-hardcodar a lista — Lei de Coerência
// (frontend nunca cria verdade). Este guard morde se aparecer lista local de labels típados fora da
// fonte única.
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FE = join(root, '..', 'frontend', 'src');
let fail = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '  OK ' : '  ❌ '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fail++;
};
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const strip = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

// 1) A fonte única existe no backend e deriva do SSOT.
const src = read(join(root, 'src/core/audience/audience-options.ts'));
check('fonte única buildAudienceOptions existe', /export function buildAudienceOptions/.test(src));
check('deriva de PAIR_ALLOWED_LABELS (não hardcode)', /PAIR_ALLOWED_LABELS/.test(src));
check('endpoint transversal /audience-options registrado', /\/audience-options/.test(read(join(root, 'src/core/audience/audience.routes.ts'))));

// 2) Os consumidores usam a fonte única (getAudienceOptions), não lista local.
const consumers = [
  'components/social/IntentComposer.tsx',
  'components/demands/DemandPublishForm.tsx',
  'components/events/guided-flow/Step0EventType.tsx',
  'pages/RentalResourceListPage.tsx',
];
for (const c of consumers) {
  const code = strip(read(join(FE, c)));
  check(`${c.split('/').pop()} consome getAudienceOptions`, /getAudienceOptions\(/.test(code));
}

// 3) Anti-regressão: nenhuma lista local de labels típados no cliente (o vazamento que matamos).
// Um objeto/array com >=2 labels típados literais em código vivo = lista paralela reintroduzida.
const TYPED = ['amigo', 'familiar', 'conhecido', 'cliente', 'colaborador', 'fornecedor', 'parceiro'];
for (const c of consumers) {
  const code = strip(read(join(FE, c)));
  // audienceTypes/types com array de labels literais = hardcode. Ex.: types: ['fornecedor']
  const hardcodedList = /(audienceTypes|audienceRelationshipTypes|types)\s*:\s*\[\s*['"](amigo|familiar|conhecido|cliente|colaborador|fornecedor|parceiro)['"]/.test(code);
  check(`${c.split('/').pop()} sem lista local de labels típados (anti-hardcode)`, !hardcodedList);
}

if (fail) { console.log(`\nAUDIENCE-SINGLE-SOURCE: FAIL (${fail})`); process.exit(1); }
console.log('\nAUDIENCE-SINGLE-SOURCE: OK');
