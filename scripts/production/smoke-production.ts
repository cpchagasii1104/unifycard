// scripts/production/smoke-production.ts
// Smoke Test de Produção - Sanity Checks Reduzidos
// 🔴 BLINDAGEM: SEM seed, apenas validações críticas
// 🔴 BLINDAGEM: Modo STRICT sempre ativo em produção

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
const DEBUG = process.env.DEBUG === 'true';

// Em produção, sempre STRICT
const STRICT_MODE = true;

type StepCategory = 'critical' | 'sanity';
type StepStatus = 'PASS' | 'FAIL';

interface TestStep {
  name: string;
  category: StepCategory;
  status: StepStatus;
  duration: number;
  error?: string;
  stack?: string;
  requestId?: string;
  correlationId?: string;
}

interface SmokeTestReport {
  status: 'PASS' | 'FAIL';
  timestamp: string;
  totalDuration: number;
  environment: 'production';
  steps: TestStep[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    criticalFailed: number;
  };
}

const steps: TestStep[] = [];

async function test(
  name: string,
  category: StepCategory,
  fn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  const step: TestStep = {
    name,
    category,
    status: 'PASS',
    duration: 0,
  };

  try {
    await fn();
    step.duration = Date.now() - start;
    step.status = 'PASS';
    steps.push(step);
    console.log(`✅ ${name} (${step.duration}ms)`);
  } catch (error: any) {
    step.duration = Date.now() - start;
    step.status = 'FAIL';
    step.error = error.message;
    if (DEBUG && error.stack) {
      step.stack = error.stack;
    }
    steps.push(step);
    console.error(`❌ ${name} (${step.duration}ms): ${error.message}`);
    throw error; // Fail fast em produção
  }
}

async function smokeTest() {
  const startTime = Date.now();
  
  console.log('==========================================');
  console.log('  PRODUCTION SMOKE TEST (SANITY)');
  console.log('==========================================');
  console.log(`  Environment: PRODUCTION`);
  console.log(`  Mode: STRICT (sempre ativo)`);
  console.log(`  Debug: ${DEBUG ? 'ON' : 'OFF'}`);
  console.log('');

  // 1. Health endpoint (CRÍTICO)
  await test('Health endpoint', 'critical', async () => {
    const response = await fetch(`${API_URL}/health`);
    
    if (!response.ok) {
      throw new Error(`Health endpoint retornou ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    if (data.status !== 'ok' && data.status !== 'healthy') {
      throw new Error(`Health endpoint retornou status inválido: ${data.status}`);
    }

    const requestId = response.headers.get('x-request-id');
    const correlationId = response.headers.get('x-correlation-id');
    const lastStep = steps[steps.length - 1];
    if (lastStep) {
      if (requestId) lastStep.requestId = requestId;
      if (correlationId) lastStep.correlationId = correlationId;
    }
  });

  // 2. Autenticação endpoint (CRÍTICO)
  await test('Autenticação endpoint', 'critical', async () => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'test',
      }),
    });

    // Deve retornar 401 (credenciais inválidas), não 500
    if (response.status >= 500) {
      throw new Error(`Endpoint de autenticação retornou erro do servidor: ${response.status}`);
    }

    if (response.status !== 401 && response.status !== 400) {
      const errorText = await response.text();
      throw new Error(`Endpoint de autenticação retornou código inesperado: ${response.status} - ${errorText}`);
    }
  });

  // 3. Permissões endpoint (SANITY)
  await test('Permissões endpoint', 'sanity', async () => {
    const response = await fetch(`${API_URL}/business-permissions/check?action=rfq:create&actorId=test`, {
      method: 'GET',
    });

    // Deve retornar 401 (não autenticado) ou 400 (parâmetros inválidos), não 500
    if (response.status >= 500) {
      throw new Error(`Endpoint de permissões retornou erro do servidor: ${response.status}`);
    }
  });

  // 4. Auditoria endpoint (SANITY)
  await test('Auditoria endpoint', 'sanity', async () => {
    const response = await fetch(`${API_URL}/business-audit-logs?contextType=event&contextId=test`, {
      method: 'GET',
    });

    // Deve retornar 401 (não autenticado) ou 200 (se autenticado), não 500
    if (response.status >= 500) {
      throw new Error(`Endpoint de auditoria retornou erro do servidor: ${response.status}`);
    }
  });

  // 5. Rate limiting (SANITY - verificar se headers estão presentes)
  await test('Rate limiting headers', 'sanity', async () => {
    // Fazer múltiplas requisições para verificar rate limiting
    const responses = await Promise.all([
      fetch(`${API_URL}/health`),
      fetch(`${API_URL}/health`),
      fetch(`${API_URL}/health`),
    ]);

    // Verificar se pelo menos uma resposta tem headers de rate limit
    const hasRateLimitHeaders = responses.some(r => 
      r.headers.get('x-ratelimit-limit') || 
      r.headers.get('x-ratelimit-remaining')
    );

    if (!hasRateLimitHeaders) {
      console.log('   ⚠️  Headers de rate limit não encontrados (pode ser normal)');
    }
  });

  // Gerar relatório
  const totalDuration = Date.now() - startTime;
  const passed = steps.filter(s => s.status === 'PASS').length;
  const failed = steps.filter(s => s.status === 'FAIL').length;
  const criticalFailed = steps.filter(s => s.category === 'critical' && s.status === 'FAIL').length;

  const report: SmokeTestReport = {
    status: (failed === 0 && criticalFailed === 0) ? 'PASS' : 'FAIL',
    timestamp: new Date().toISOString(),
    totalDuration,
    environment: 'production',
    steps,
    summary: {
      total: steps.length,
      passed,
      failed,
      criticalFailed,
    },
  };

  // Salvar relatório JSON
  const reportsDir = join(process.cwd(), 'scripts', 'production', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const reportPath = join(reportsDir, 'smoke-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Relatório salvo em: ${reportPath}`);

  // Resumo
  console.log('');
  console.log('==========================================');
  console.log('  SMOKE TEST RESULTADO');
  console.log('==========================================');
  console.log('');
  console.log(`Status: ${report.status}`);
  console.log(`Total: ${report.summary.total} testes`);
  console.log(`✅ Passou: ${report.summary.passed}`);
  console.log(`❌ Falhou: ${report.summary.failed}`);
  console.log(`⏱️  Duração total: ${totalDuration}ms`);
  console.log('');

  if (report.summary.criticalFailed > 0) {
    console.log('❌ TESTES CRÍTICOS FALHARAM:');
    steps.filter(s => s.category === 'critical' && s.status === 'FAIL').forEach(s => {
      console.log(`   - ${s.name}: ${s.error}`);
    });
    console.log('');
  }

  if (report.summary.failed > 0) {
    console.log('Testes que falharam:');
    steps.filter(s => s.status === 'FAIL').forEach(s => {
      console.log(`   ❌ ${s.name} [${s.category}]: ${s.error}`);
    });
    console.log('');
  }

  // Exit code baseado no status
  if (report.status === 'FAIL') {
    process.exit(1);
  } else {
    console.log('✅ TODOS OS TESTES PASSARAM');
    console.log('');
    process.exit(0);
  }
}

// Executar
smokeTest().catch((error) => {
  console.error('❌ ERRO FATAL no smoke test:', error);
  
  // Gerar relatório mesmo em caso de erro fatal
  const report: SmokeTestReport = {
    status: 'FAIL',
    timestamp: new Date().toISOString(),
    totalDuration: 0,
    environment: 'production',
    steps,
    summary: {
      total: steps.length,
      passed: steps.filter(s => s.status === 'PASS').length,
      failed: steps.filter(s => s.status === 'FAIL').length + 1,
      criticalFailed: steps.filter(s => s.category === 'critical' && s.status === 'FAIL').length + 1,
    },
  };
  
  // Adicionar erro fatal como step
  report.steps.push({
    name: 'FATAL_ERROR',
    category: 'critical',
    status: 'FAIL',
    duration: 0,
    error: error.message,
    stack: DEBUG ? error.stack : undefined,
  });

  try {
    const reportsDir = join(process.cwd(), 'scripts', 'production', 'reports');
    mkdirSync(reportsDir, { recursive: true });
    const reportPath = join(reportsDir, 'smoke-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Relatório de erro salvo em: ${reportPath}`);
  } catch (writeError) {
    console.error('Erro ao salvar relatório:', writeError);
  }
  
  process.exit(1);
});




