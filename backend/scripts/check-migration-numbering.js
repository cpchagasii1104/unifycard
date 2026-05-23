// backend/scripts/check-migration-numbering.js
// GATE 3 — INTEGRIDADE DE MIGRAÇÕES
// Script que verifica numeração única e ausência de colisões

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, '../migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

let hasError = false;
const errors = [];

// Extrair números e sufixos
const migrationMap = new Map();
const suffixMap = new Map();

// Padrão: 4 dígitos + sufixo opcional (a-z) + underscore + nome_snake.sql
const NAME_PATTERN = /^(\d{4})([a-z]?)_([a-z0-9_]+)\.sql$/;

migrationFiles.forEach(file => {
  if (/^\d{14}_/.test(file) || /^\d{8}_/.test(file)) {
    return;
  }
  const match = file.match(NAME_PATTERN);
  if (!match) {
    errors.push(`❌ Formato inválido (esperado NNNN_name.sql ou NNNNa_name.sql): ${file}`);
    hasError = true;
    return;
  }

  const number = parseInt(match[1], 10);
  const suffix = match[2] || '';

  // Verificar numeração duplicada
  if (migrationMap.has(number)) {
    const existing = migrationMap.get(number);
    errors.push(`❌ Numeração duplicada: ${number} (${existing}, ${file})`);
    hasError = true;
  } else {
    migrationMap.set(number, file);
  }

  // Verificar sufixos duplicados por número
  const key = `${number}${suffix}`;
  if (suffix && suffixMap.has(key)) {
    errors.push(`❌ Sufixo duplicado: ${key} (${suffixMap.get(key)}, ${file})`);
    hasError = true;
  } else if (suffix) {
    suffixMap.set(key, file);
  }
});

// Verificar sufixos válidos (apenas para mesma posição lógica)
if (errors.length === 0) {
  const numbersWithSuffixes = Array.from(migrationMap.keys()).filter(num => {
    const files = migrationFiles.filter(f => f.startsWith(`${num.toString().padStart(4, '0')}`));
    return files.length > 1;
  });

  numbersWithSuffixes.forEach(num => {
    const files = migrationFiles.filter(f => f.startsWith(`${num.toString().padStart(4, '0')}`));
    const suffixes = files.map(f => {
      const match = f.match(/^\d{4}([a-z]?)_/);
      return match ? match[1] : '';
    }).filter(s => s);

    // Verificar se sufixos são sequenciais (a, b, c, ...)
    if (suffixes.length > 1) {
      const expected = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
      const sorted = [...suffixes].sort();
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] !== expected[i]) {
          errors.push(`❌ Sufixos não sequenciais para ${num}: ${sorted.join(', ')}`);
          hasError = true;
          break;
        }
      }
    }
  });
}

// Output
if (hasError) {
  console.error('='.repeat(80));
  console.error('❌ GATE 3 — INTEGRIDADE DE MIGRAÇÕES: FALHOU');
  console.error('='.repeat(80));
  errors.forEach(err => console.error(err));
  console.error('');
  process.exit(1);
} else {
  console.log('='.repeat(80));
  console.log('✅ GATE 3 — INTEGRIDADE DE MIGRAÇÕES: PASSOU');
  console.log('='.repeat(80));
  console.log(`📋 Total de migrations: ${migrationFiles.length}`);
  console.log(`✅ Numeração única: OK`);
  console.log(`✅ Sufixos válidos: OK`);
  console.log('');
  process.exit(0);
}

