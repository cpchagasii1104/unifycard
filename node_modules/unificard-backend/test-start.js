// Script simples para testar se o backend inicia
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Tentando iniciar o backend...\n');

const backendProcess = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname),
  shell: true,
  stdio: 'inherit'
});

let errorOutput = '';

backendProcess.stderr.on('data', (data) => {
  errorOutput += data.toString();
  process.stderr.write(data);
});

backendProcess.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  
  // Se ver sucesso, manter rodando
  if (output.includes('SERVIDOR INICIADO COM SUCESSO')) {
    console.log('\n✅ Backend iniciado com sucesso!');
    console.log('Mantenha esta janela aberta.\n');
  }
});

backendProcess.on('error', (error) => {
  console.error('❌ Erro ao iniciar:', error);
  process.exit(1);
});

backendProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error('\n❌ Backend encerrou com código:', code);
    if (errorOutput) {
      console.error('\nErros capturados:');
      console.error(errorOutput);
    }
  }
});

// Manter processo vivo
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando backend...');
  backendProcess.kill();
  process.exit(0);
});

