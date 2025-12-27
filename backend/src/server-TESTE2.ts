// TESTE 2 - Verificar se startServer() é chamado e onde trava
console.log('🔵 TESTE 2: Verificando execução de startServer()');
console.log('🔵 PID:', process.pid);

// Simular imports (já sabemos que funcionam)
import Fastify from 'fastify';
import dotenv from 'dotenv';
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

console.log('🔵 TESTE 2: Imports concluídos');
console.log('🔵 TESTE 2: PORT:', PORT);
console.log('🔵 TESTE 2: HOST:', HOST);

// Simular buildApp (versão mínima)
async function buildAppTest() {
  console.log('🔵 TESTE 2: buildAppTest() chamado');
  const app = Fastify({ logger: false });
  console.log('🔵 TESTE 2: Fastify instance criada');
  return app;
}

// Simular startServer (versão mínima)
async function startServerTest() {
  console.log('🔵 TESTE 2: startServerTest() chamado');
  
  console.log('🔵 TESTE 2: BEFORE buildAppTest()');
  const app = await buildAppTest();
  console.log('🔵 TESTE 2: AFTER buildAppTest()');
  
  console.log('🔵 TESTE 2: BEFORE app.listen()');
  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log('🔵 TESTE 2: AFTER app.listen() - SUCESSO!');
    console.log('🔵 TESTE 2: Address:', address);
    console.log('🔵 TESTE 2: Servidor deveria estar rodando agora');
    
    // Manter vivo por 5 segundos
    setTimeout(() => {
      console.log('🔵 TESTE 2: Encerrando teste');
      process.exit(0);
    }, 5000);
  } catch (err) {
    console.error('🔵 TESTE 2: ERRO em app.listen():', err);
    process.exit(1);
  }
}

// Simular require.main === module
if (require.main === module) {
  console.log('🔵 TESTE 2: require.main === module = TRUE');
  console.log('🔵 TESTE 2: Chamando startServerTest()...');
  startServerTest().catch((err) => {
    console.error('🔵 TESTE 2: ERRO não tratado:', err);
    process.exit(1);
  });
} else {
  console.log('🔵 TESTE 2: require.main === module = FALSE');
  process.exit(0);
}













