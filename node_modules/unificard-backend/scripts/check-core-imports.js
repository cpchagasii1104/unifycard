// backend/scripts/check-core-imports.js
// Script para verificar violações de Core → Modules imports
// Compatível com Windows, Linux e macOS

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src', 'core');
let violations = [];

/**
 * Escaneia recursivamente um diretório procurando por imports de @modules/
 */
function scan(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Ignorar node_modules e outros diretórios irrelevantes
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          scan(fullPath);
        }
      } else if (entry.isFile()) {
        // Verificar apenas arquivos TypeScript/JavaScript
        if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Procurar por imports que contenham @modules/
            // Padrões a detectar:
            // - import ... from '@modules/...'
            // - import ... from "@modules/..."
            // - from '@modules/...
            // - from "@modules/...
            // - require('@modules/...)
            // - require("@modules/...)
            // - import('@modules/...)
            // - import("@modules/...)
            const moduleImportPatterns = [
              /from\s+['"]@modules\//g,
              /require\s*\(\s*['"]@modules\//g,
              /import\s*\(\s*['"]@modules\//g,
              /import\s+.*\s+from\s+['"]@modules\//g,
            ];
            
            let hasViolation = false;
            const lines = content.split('\n');
            
            lines.forEach((line, index) => {
              moduleImportPatterns.forEach(pattern => {
                if (pattern.test(line)) {
                  hasViolation = true;
                  violations.push({
                    file: fullPath,
                    line: index + 1,
                    content: line.trim(),
                  });
                }
              });
            });
          } catch (err) {
            // Ignorar erros de leitura (arquivos binários, etc)
            if (err.code !== 'EISDIR') {
              console.warn(`⚠️  Aviso: Não foi possível ler ${fullPath}: ${err.message}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`❌ Erro ao escanear diretório ${dir}: ${err.message}`);
    process.exit(1);
  }
}

// Verificar se o diretório src/core existe
if (!fs.existsSync(root)) {
  console.error(`❌ Diretório não encontrado: ${root}`);
  process.exit(1);
}

console.log(`🔍 Escaneando ${root}...\n`);
scan(root);

// Remover duplicatas (mesma linha pode ter múltiplos padrões)
const uniqueViolations = [];
const seen = new Set();

violations.forEach(v => {
  const key = `${v.file}:${v.line}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueViolations.push(v);
  }
});

// Exibir resultados
if (uniqueViolations.length > 0) {
  console.log('❌ Core importing Modules detected:\n');
  
  // Agrupar por arquivo
  const byFile = {};
  uniqueViolations.forEach(v => {
    if (!byFile[v.file]) {
      byFile[v.file] = [];
    }
    byFile[v.file].push(v);
  });
  
  // Ordenar arquivos alfabeticamente
  const sortedFiles = Object.keys(byFile).sort();
  
  sortedFiles.forEach(file => {
    console.log(`📄 ${file}`);
    byFile[file].forEach(v => {
      console.log(`   Linha ${v.line}: ${v.content}`);
    });
    console.log('');
  });
  
  console.log(`\n❌ Total: ${uniqueViolations.length} violação(ões) encontrada(s)`);
  console.log('\n💡 Regra: Core NUNCA importa Modules (ver ARCHITECTURAL_SOURCE_OF_TRUTH.md)');
  process.exit(1);
} else {
  console.log('✅ Nenhuma violação encontrada: Core não está importando Modules');
  process.exit(0);
}

