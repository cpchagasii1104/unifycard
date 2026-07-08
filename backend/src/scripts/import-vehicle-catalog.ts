// IMPORTADOR de catálogo de veículo (GO Clayton 2026-07-08). Um CSV por vez → catálogo consolidado.
// Fluxo: lê CSV → valida cabeçalho EXATO → normaliza → staging (import_rows) → UPSERT idempotente por
// variant_id em make→model→year→spec → relatório (import_batch). NÃO roda no fluxo do usuário. Δbank=0.
// Uso: npm run import:vehicle-catalog -- <caminho/arquivo.csv>
import { readFileSync } from 'fs';
import { basename } from 'path';
import { pool } from '@core/database/pool';

const HEADER = ['vehicle_variant_id','categoria','marca','modelo','linha','geracao','ano_lancamento_brasil','ano_modelo','ano_fabricacao_inicio','ano_fabricacao_fim','versao','versao_nome','carroceria','numero_portas','numero_lugares','motor_nome','motor_codigo','motor_familia','cilindrada_cc','cilindros','valvulas_total','aspiracao','alimentacao','combustivel','potencia_cv','potencia_cv_gasolina','potencia_cv_etanol','potencia_rpm','torque_kgfm','torque_kgfm_gasolina','torque_kgfm_etanol','torque_rpm','tracao','cambio','codigo_cambio','numero_marchas','direcao','tanque_litros','porta_malas_litros','peso_kg','capacidade_carga_kg','comprimento_cm','largura_cm','altura_cm','entre_eixos_cm','pneus_diant','pneus_tras','rodas','freios_diant','freios_tras','suspensao_diant','suspensao_tras','abs','airbags','controle_estabilidade','start_stop','observacoes_fitment','source_url','source_confidence'];

// Parser CSV quote-aware: delimitador ';', campos entre aspas duplas podem conter ';' e quebras de linha.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let inQ = false;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ';') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); field = ''; if (row.some((c) => c !== '')) rows.push(row); row = []; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((c) => c !== '')) rows.push(row); }
  return rows;
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const asInt = (v: string) => { const n = parseInt((v ?? '').replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) ? n : null; };
const asNum = (v: string) => { const n = parseFloat((v ?? '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : null; };
const txt = (v: string) => { const t = (v ?? '').trim(); return t === '' ? null : t; };

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('Uso: import-vehicle-catalog <arquivo.csv>'); process.exit(1); }
  const rows = parseCsv(readFileSync(file, 'utf8'));
  if (rows.length < 2) { console.error('CSV vazio.'); process.exit(1); }

  // valida cabeçalho EXATO (contrato)
  const header = rows[0].map((h) => h.trim());
  if (header.length !== HEADER.length || HEADER.some((h, i) => h !== header[i])) {
    console.error('CABEÇALHO INVÁLIDO. Esperado (contrato):\n  ' + HEADER.join(';'));
    console.error('Recebido:\n  ' + header.join(';'));
    process.exit(1);
  }
  const col = (r: string[], name: string) => r[HEADER.indexOf(name)] ?? '';
  const dataRows = rows.slice(1);

  const client = await pool.connect();
  let inserted = 0, updated = 0, rejected = 0;
  const rowLog: Array<{ n: number; variant: string | null; status: string; error: string | null }> = [];
  try {
    await client.query('BEGIN');
    const concept = await client.query<{ concept_id: string }>(`SELECT concept_id::text FROM concepts WHERE slug='carro' LIMIT 1`);
    if (!concept.rows[0]) throw new Error("concept 'carro' não existe — categoria de veículo ausente.");
    const conceptId = concept.rows[0].concept_id;

    const batch = await client.query<{ id: string }>(
      `INSERT INTO vehicle_catalog_import_batches (source_filename, marca, modelo, rows_total, status) VALUES ($1,$2,$3,$4,'running') RETURNING id::text`,
      [basename(file), txt(col(dataRows[0], 'marca')), txt(col(dataRows[0], 'modelo')), dataRows.length]);
    const batchId = batch.rows[0].id;

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i]; const rowNum = i + 2; const variant = txt(col(r, 'vehicle_variant_id'));
      await client.query('SAVEPOINT row_sp'); // isola falha de linha (senão a TX inteira aborta)
      try {
        if (!variant) throw new Error('vehicle_variant_id vazio');
        const marca = txt(col(r, 'marca')); const modelo = txt(col(r, 'modelo')); const ano = asInt(col(r, 'ano_modelo'));
        if (!marca || !modelo || ano == null) throw new Error('marca/modelo/ano_modelo obrigatórios');

        // upsert make (SELECT-or-INSERT idempotente — sem cache em memória, seguro contra rollback de linha)
        const mkSlug = slug(marca);
        const mkEx = await client.query<{ id: string }>(`SELECT id::text FROM vehicle_makes WHERE slug=$1`, [mkSlug]);
        const makeId = mkEx.rows[0]?.id ?? (await client.query<{ id: string }>(`INSERT INTO vehicle_makes (slug,name) VALUES ($1,$2) RETURNING id::text`, [mkSlug, marca])).rows[0].id;
        // upsert model (make+concept+slug)
        const mdSlug = slug(modelo);
        const mdEx = await client.query<{ id: string }>(`SELECT id::text FROM vehicle_models WHERE make_id=$1::uuid AND concept_id=$2::uuid AND slug=$3`, [makeId, conceptId, mdSlug]);
        const modelId = mdEx.rows[0]?.id ?? (await client.query<{ id: string }>(`INSERT INTO vehicle_models (make_id,concept_id,slug,name) VALUES ($1::uuid,$2::uuid,$3,$4) RETURNING id::text`, [makeId, conceptId, mdSlug, modelo])).rows[0].id;
        // upsert model_year
        const yEx = await client.query(`SELECT 1 FROM vehicle_model_years WHERE model_id=$1::uuid AND year=$2`, [modelId, ano]);
        if (!yEx.rows.length) await client.query(`INSERT INTO vehicle_model_years (model_id,year) VALUES ($1::uuid,$2)`, [modelId, ano]);

        // upsert spec por variant_id (idempotente)
        const fields: Record<string, unknown> = {
          model_id: modelId, variant_id: variant, year: ano,
          version: txt(col(r, 'versao')), versao_nome: txt(col(r, 'versao_nome')),
          categoria: txt(col(r, 'categoria')), linha: txt(col(r, 'linha')), geracao: txt(col(r, 'geracao')),
          ano_lancamento_brasil: asInt(col(r, 'ano_lancamento_brasil')), ano_fabricacao_inicio: asInt(col(r, 'ano_fabricacao_inicio')), ano_fabricacao_fim: asInt(col(r, 'ano_fabricacao_fim')),
          carroceria: txt(col(r, 'carroceria')), num_portas: asInt(col(r, 'numero_portas')), numero_lugares: asInt(col(r, 'numero_lugares')),
          motor: txt(col(r, 'motor_nome')), motor_nome: txt(col(r, 'motor_nome')), motor_codigo: txt(col(r, 'motor_codigo')), motor_familia: txt(col(r, 'motor_familia')),
          cilindrada_cc: asInt(col(r, 'cilindrada_cc')), cilindros: asInt(col(r, 'cilindros')), valvulas_total: asInt(col(r, 'valvulas_total')),
          aspiracao: txt(col(r, 'aspiracao')), alimentacao: txt(col(r, 'alimentacao')), combustivel: txt(col(r, 'combustivel')),
          potencia_cv: asInt(col(r, 'potencia_cv')), potencia_cv_gasolina: asInt(col(r, 'potencia_cv_gasolina')), potencia_cv_etanol: asInt(col(r, 'potencia_cv_etanol')), potencia_rpm: asInt(col(r, 'potencia_rpm')),
          torque_kgfm: asNum(col(r, 'torque_kgfm')), torque_kgfm_gasolina: asNum(col(r, 'torque_kgfm_gasolina')), torque_kgfm_etanol: asNum(col(r, 'torque_kgfm_etanol')), torque_rpm: asInt(col(r, 'torque_rpm')),
          tracao: txt(col(r, 'tracao')), cambio: txt(col(r, 'cambio')), codigo_cambio: txt(col(r, 'codigo_cambio')), numero_marchas: txt(col(r, 'numero_marchas')), direcao: txt(col(r, 'direcao')),
          tanque_litros: asInt(col(r, 'tanque_litros')), porta_malas_litros: asInt(col(r, 'porta_malas_litros')),
          peso_kg: asInt(col(r, 'peso_kg')), capacidade_carga_kg: asInt(col(r, 'capacidade_carga_kg')),
          comprimento_cm: asNum(col(r, 'comprimento_cm')), largura_cm: asNum(col(r, 'largura_cm')), altura_cm: asNum(col(r, 'altura_cm')), entre_eixos_cm: asNum(col(r, 'entre_eixos_cm')),
          pneus: txt(col(r, 'pneus_diant')), pneus_diant: txt(col(r, 'pneus_diant')), pneus_tras: txt(col(r, 'pneus_tras')), rodas: txt(col(r, 'rodas')),
          freios_diant: txt(col(r, 'freios_diant')), freios_tras: txt(col(r, 'freios_tras')), suspensao_diant: txt(col(r, 'suspensao_diant')), suspensao_tras: txt(col(r, 'suspensao_tras')),
          abs: txt(col(r, 'abs')), airbags: asInt(col(r, 'airbags')), controle_estabilidade: txt(col(r, 'controle_estabilidade')), start_stop: txt(col(r, 'start_stop')),
          observacoes_fitment: txt(col(r, 'observacoes_fitment')), source_url: txt(col(r, 'source_url')), source_confidence: txt(col(r, 'source_confidence')),
        };
        const keys = Object.keys(fields);
        const ph = keys.map((_, k) => `$${k + 1}`).join(',');
        const upd = keys.filter((k) => k !== 'variant_id').map((k) => `${k}=EXCLUDED.${k}`).join(', ');
        const res = await client.query<{ inserted: boolean }>(
          `INSERT INTO vehicle_model_specs (${keys.join(',')}) VALUES (${ph})
           ON CONFLICT (variant_id) WHERE variant_id IS NOT NULL DO UPDATE SET ${upd}
           RETURNING (xmax = 0) AS inserted`, keys.map((k) => fields[k]));
        const wasInserted = res.rows[0].inserted;
        if (wasInserted) inserted++; else updated++;
        rowLog.push({ n: rowNum, variant, status: wasInserted ? 'inserted' : 'updated', error: null });
        await client.query('RELEASE SAVEPOINT row_sp');
      } catch (e: any) {
        await client.query('ROLLBACK TO SAVEPOINT row_sp'); // desfaz só a linha, TX segue viva
        rejected++; rowLog.push({ n: rowNum, variant, status: 'rejected', error: e.message });
      }
    }

    // grava staging + fecha batch
    for (const l of rowLog) {
      await client.query(`INSERT INTO vehicle_catalog_import_rows (batch_id,row_number,variant_id,status,error_message) VALUES ($1::uuid,$2,$3,$4,$5)`, [batchId, l.n, l.variant, l.status, l.error]);
    }
    await client.query(`UPDATE vehicle_catalog_import_batches SET rows_inserted=$2, rows_updated=$3, rows_rejected=$4, status='completed' WHERE id=$1::uuid`, [batchId, inserted, updated, rejected]);
    await client.query('COMMIT');

    console.log(`\n=== IMPORT: ${basename(file)} (batch ${batchId}) ===`);
    console.log(`  lidas: ${dataRows.length} · inseridas: ${inserted} · atualizadas: ${updated} · rejeitadas: ${rejected}`);
    for (const l of rowLog.filter((x) => x.status === 'rejected')) console.log(`  ❌ linha ${l.n} (${l.variant}): ${l.error}`);
    console.log(rejected === 0 ? '  🟢 sem rejeições' : `  🔴 ${rejected} rejeição(ões)`);
  } catch (e: any) {
    await client.query('ROLLBACK'); console.error('ROLLBACK —', e.message); process.exitCode = 1;
  } finally {
    client.release(); await pool.end();
  }
}
main();
