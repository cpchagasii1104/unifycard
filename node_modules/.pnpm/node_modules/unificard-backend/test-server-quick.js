// test-server-quick.js
// Script rápido para validar que o servidor pode ser importado sem erros

console.log('='.repeat(80));
console.log('🧪 TESTE RÁPIDO DE IMPORTS DO SERVIDOR');
console.log('='.repeat(80));
console.log('');

try {
  console.log('📦 Testando import do servidor...');
  
  // Tentar compilar o servidor
  const { execSync } = require('child_process');
  
  const result = execSync('npx tsc --noEmit src/server.ts', {
    encoding: 'utf-8',
    stdio: 'pipe',
    cwd: __dirname
  });
  
  console.log('✅ Servidor compila sem erros!');
  console.log('');
  
  // Verificar se work-instant está importado
  const serverContent = require('fs').readFileSync('src/server.ts', 'utf-8');
  
  if (serverContent.includes('work-instant')) {
    console.log('✅ Work-Instant está importado em server.ts');
  } else {
    console.log('❌ Work-Instant NÃO está importado em server.ts');
    process.exit(1);
  }
  
  if (serverContent.includes("prefix: '/work-instant'")) {
    console.log('✅ Work-Instant está registrado com prefixo /work-instant');
  } else {
    console.log('❌ Work-Instant NÃO está registrado com prefixo /work-instant');
    process.exit(1);
  }
  
  console.log('');
  console.log('='.repeat(80));
  console.log('✅ VALIDAÇÃO CONCLUÍDA');
  console.log('='.repeat(80));
  
} catch (error) {
  console.error('❌ Erro ao validar servidor:');
  console.error(error.message);
  if (error.stdout) {
    console.error('STDOUT:', error.stdout);
  }
  if (error.stderr) {
    console.error('STDERR:', error.stderr);
  }
  process.exit(1);
}







