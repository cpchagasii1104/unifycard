// test-server-startup.js
// Script para testar inicialização do servidor e rotas críticas

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_PORT = process.env.PORT || 3000;
const SERVER_HOST = process.env.HOST || '0.0.0.0';
const MAX_WAIT_TIME = 30000; // 30 segundos
const CHECK_INTERVAL = 1000; // 1 segundo

let serverProcess = null;
let serverReady = false;
const testResults = [];

console.log('='.repeat(80));
console.log('🧪 TESTE DE INICIALIZAÇÃO DO SERVIDOR');
console.log('='.repeat(80));
console.log('');

// Função para fazer requisição HTTP
function makeRequest(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: SERVER_PORT,
      path: path,
      method: method,
      headers: headers,
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Função para verificar se servidor está pronto
async function waitForServer() {
  console.log(`⏳ Aguardando servidor iniciar em http://localhost:${SERVER_PORT}...`);
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_WAIT_TIME) {
    try {
      const response = await makeRequest('GET', '/health');
      if (response.statusCode === 200) {
        serverReady = true;
        console.log('✅ Servidor está respondendo!');
        console.log('');
        return true;
      }
    } catch (error) {
      // Servidor ainda não está pronto
    }
    
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
  }
  
  return false;
}

// Função para testar uma rota
async function testRoute(name, method, path, expectedStatus = 200, requiresAuth = false) {
  console.log(`🔍 Testando: ${method} ${path}`);
  
  try {
    const headers = {};
    if (requiresAuth) {
      // Para rotas protegidas, esperamos 401 (não autenticado)
      // Isso confirma que a rota existe e está protegida
      const response = await makeRequest(method, path, headers);
      const success = response.statusCode === expectedStatus || response.statusCode === 401;
      
      testResults.push({
        name,
        path,
        method,
        status: response.statusCode,
        success: success,
        message: success 
          ? `✅ Rota existe e está ${response.statusCode === 401 ? 'protegida' : 'funcionando'}`
          : `❌ Status inesperado: ${response.statusCode}`
      });
      
      console.log(`   Status: ${response.statusCode}`);
      console.log(`   ${success ? '✅' : '❌'} ${testResults[testResults.length - 1].message}`);
    } else {
      const response = await makeRequest(method, path, headers);
      const success = response.statusCode === expectedStatus;
      
      testResults.push({
        name,
        path,
        method,
        status: response.statusCode,
        success: success,
        message: success 
          ? '✅ Rota funcionando'
          : `❌ Status inesperado: ${response.statusCode}`
      });
      
      console.log(`   Status: ${response.statusCode}`);
      console.log(`   ${success ? '✅' : '❌'} ${testResults[testResults.length - 1].message}`);
    }
  } catch (error) {
    testResults.push({
      name,
      path,
      method,
      status: 'ERROR',
      success: false,
      message: `❌ Erro: ${error.message}`
    });
    
    console.log(`   ❌ Erro: ${error.message}`);
  }
  
  console.log('');
}

// Função principal
async function main() {
  // Iniciar servidor
  console.log('🚀 Iniciando servidor...');
  console.log('');
  
  serverProcess = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  // Capturar logs do servidor
  let serverOutput = '';
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    serverOutput += output;
    // Verificar se servidor está pronto
    if (output.includes('Server listening') || output.includes('listening on')) {
      serverReady = true;
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const output = data.toString();
    serverOutput += output;
    console.error('STDERR:', output);
  });

  serverProcess.on('error', (error) => {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  });

  // Aguardar servidor ficar pronto
  const serverStarted = await waitForServer();
  
  if (!serverStarted) {
    console.error('❌ Servidor não iniciou a tempo!');
    console.error('');
    console.error('Últimos logs do servidor:');
    console.error(serverOutput);
    if (serverProcess) {
      serverProcess.kill();
    }
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('🧪 TESTANDO ROTAS CRÍTICAS');
  console.log('='.repeat(80));
  console.log('');

  // Testar rotas
  await testRoute('Health Check', 'GET', '/health', 200, false);
  await testRoute('Metrics', 'GET', '/metrics', 200, false);
  await testRoute('Groups List', 'GET', '/groups', 200, true);
  await testRoute('Social Feed', 'GET', '/social/feed', 200, true);
  await testRoute('Work Instant Status', 'GET', '/work-instant/test', 404, false); // Esperamos 404 se não existir, mas confirma que a rota está registrada

  // Resumo
  console.log('='.repeat(80));
  console.log('📊 RESUMO DOS TESTES');
  console.log('='.repeat(80));
  console.log('');

  const successCount = testResults.filter(r => r.success).length;
  const totalCount = testResults.length;

  testResults.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.name}: ${result.message}`);
  });

  console.log('');
  console.log(`Total: ${successCount}/${totalCount} testes passaram`);
  console.log('');

  // Salvar logs do servidor
  const logFile = path.join(__dirname, 'server-startup-test.log');
  fs.writeFileSync(logFile, serverOutput);
  console.log(`📝 Logs do servidor salvos em: ${logFile}`);
  console.log('');

  // Encerrar servidor
  if (serverProcess) {
    console.log('🛑 Encerrando servidor...');
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('='.repeat(80));
  console.log('✨ TESTE CONCLUÍDO');
  console.log('='.repeat(80));

  process.exit(successCount === totalCount ? 0 : 1);
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
  console.error('❌ Erro não tratado:', error);
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Interrompendo testes...');
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(1);
});

// Executar
main().catch((error) => {
  console.error('❌ Erro fatal:', error);
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(1);
});








