"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/devtools/test-ai.ts
/// <reference path="../../types/fastify.d.ts" />
/// <reference path="../../types/fastify-ai.d.ts" />
const server_1 = require("../../server");
async function testAI() {
    console.log('🧪 Iniciando teste do AI Kernel...\n');
    try {
        // Construir app
        const app = await (0, server_1.buildApp)();
        // Teste 1: Prompt simples
        console.log('📝 Teste 1: Prompt simples');
        const test1 = await app.inject({
            method: 'POST',
            url: '/dev/ai/run',
            payload: {
                prompt: 'Analisar módulo work do sistema',
            },
        });
        console.log('Status:', test1.statusCode);
        console.log('Response:', JSON.stringify(JSON.parse(test1.body), null, 2));
        console.log('\n');
        // Teste 2: Prompt com payload
        console.log('📝 Teste 2: Prompt com payload');
        const test2 = await app.inject({
            method: 'POST',
            url: '/dev/ai/run',
            payload: {
                prompt: 'Validar proposta de arquitetura',
                payload: {
                    module: 'events',
                    type: 'module',
                },
            },
        });
        console.log('Status:', test2.statusCode);
        console.log('Response:', JSON.stringify(JSON.parse(test2.body), null, 2));
        console.log('\n');
        // Teste 3: Validação de erro (prompt vazio)
        console.log('📝 Teste 3: Validação de erro (prompt vazio)');
        const test3 = await app.inject({
            method: 'POST',
            url: '/dev/ai/run',
            payload: {
                prompt: '',
            },
        });
        console.log('Status:', test3.statusCode);
        console.log('Response:', JSON.stringify(JSON.parse(test3.body), null, 2));
        console.log('\n');
        // Teste 4: Acesso direto ao kernel
        console.log('📝 Teste 4: Acesso direto ao kernel via app.ai');
        const result = await app.ai.run('Teste de acesso direto ao kernel');
        console.log('Result:', JSON.stringify(result, null, 2));
        console.log('\n');
        console.log('✅ Todos os testes concluídos!');
        await app.close();
    }
    catch (error) {
        console.error('❌ Erro durante os testes:', error);
        process.exit(1);
    }
}
// Executar testes
void testAI();
//# sourceMappingURL=test-ai.js.map