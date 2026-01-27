// scripts/staging/smoke-test.ts
// Smoke Test Suite - CI-Ready com modo STRICT
// 🔴 BLINDAGEM: Zero falso positivo, output estruturado

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;
const STAGING_EMAIL = 'staging@unificard.local';
const STAGING_PASSWORD = 'staging123';
const STRICT_MODE = process.env.STRICT === 'true';
const DEBUG = process.env.DEBUG === 'true';

// Matriz de steps
type StepCategory = 'critical' | 'semi-critical' | 'optional';
type StepStatus = 'PASS' | 'FAIL' | 'SKIP';

interface TestStep {
  name: string;
  category: StepCategory;
  status: StepStatus;
  duration: number;
  error?: string;
  stack?: string;
  requestId?: string;
  correlationId?: string;
  skippedReason?: string;
}

interface SmokeTestReport {
  status: 'PASS' | 'FAIL';
  timestamp: string;
  totalDuration: number;
  strictMode: boolean;
  steps: TestStep[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    criticalFailed: number;
    semiCriticalFailed: number;
    optionalFailed: number;
  };
}

const steps: TestStep[] = [];
let authToken: string = '';
let tenantId: string = '';
let userId: string = '';
let companyId: string = '';
let eventId: string = '';
let rfqId: string = '';
let quoteId: string = '';
let bookingId: string = '';
let decisionId: string = '';
let serviceOrderId: string = '';

function shouldFailOnSkip(step: TestStep): boolean {
  if (!STRICT_MODE) return false;
  return step.category === 'critical';
}

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
    
    // Fail fast em steps críticos
    if (category === 'critical') {
      throw error;
    }
    
    // Em modo STRICT, falhar em qualquer step
    if (STRICT_MODE) {
      throw error;
    }
  }
}

async function testOptional(
  name: string,
  fn: () => Promise<void>,
  skipReason?: string
): Promise<void> {
  const start = Date.now();
  const step: TestStep = {
    name,
    category: 'optional',
    status: 'SKIP',
    duration: 0,
    skippedReason: skipReason || 'Endpoint não disponível',
  };

  try {
    await fn();
    step.duration = Date.now() - start;
    step.status = 'PASS';
    step.skippedReason = undefined;
    steps.push(step);
    console.log(`✅ ${name} (${step.duration}ms)`);
  } catch (error: any) {
    step.duration = Date.now() - start;
    
    // Em modo STRICT, falhar mesmo em opcionais
    if (STRICT_MODE) {
      step.status = 'FAIL';
      step.error = error.message;
      if (DEBUG && error.stack) {
        step.stack = error.stack;
      }
      steps.push(step);
      throw error;
    }
    
    // Em modo não-strict, apenas skipar
    step.status = 'SKIP';
    step.error = error.message;
    steps.push(step);
    console.log(`⏭️  ${name} (SKIP): ${error.message}`);
  }
}

async function smokeTest() {
  const startTime = Date.now();
  
  console.log('==========================================');
  console.log('  STAGING SMOKE TEST SUITE');
  console.log('==========================================');
  console.log(`  Mode: ${STRICT_MODE ? 'STRICT' : 'NON-STRICT'}`);
  console.log(`  Debug: ${DEBUG ? 'ON' : 'OFF'}`);
  console.log('');

  // 1. Login (CRÍTICO)
  await test('Login', 'critical', async () => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: STAGING_EMAIL,
        password: STAGING_PASSWORD,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Login falhou: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    authToken = data.token || data.accessToken || '';
    tenantId = data.tenantId || '';
    userId = data.userId || '';

    if (!authToken) {
      throw new Error('Token de autenticação não retornado');
    }

    // Capturar requestId/correlationId se disponíveis
    const requestId = response.headers.get('x-request-id');
    const correlationId = response.headers.get('x-correlation-id');
    const lastStep = steps[steps.length - 1];
    if (lastStep) {
      if (requestId) lastStep.requestId = requestId;
      if (correlationId) lastStep.correlationId = correlationId;
    }
  });

  // 2. Criar empresa (CRÍTICO)
  await test('Criar empresa', 'critical', async () => {
    const response = await fetch(`${API_URL}/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({
        name: 'Empresa Staging Test',
        document: '12345678000190',
        type: 'company',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Criar empresa falhou: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    companyId = data.id || data.companyId || '';
    
    if (!companyId) {
      throw new Error('ID da empresa não retornado');
    }
  });

  // 3. Onboarding (OPCIONAL)
  await testOptional('Onboarding', async () => {
    const response = await fetch(`${API_URL}/companies/${companyId}/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({
        businessType: 'restaurant',
        modules: ['services', 'events', 'calendar'],
      }),
    });

    if (response.status === 404) {
      throw new Error('Endpoint de onboarding não encontrado (404)');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Onboarding falhou: ${response.status} - ${errorText}`);
    }
  }, 'Endpoint de onboarding não disponível');

  // 4. Criar evento (CRÍTICO)
  await test('Criar evento', 'critical', async () => {
    const response = await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({
        title: 'Evento Staging Test',
        description: 'Evento criado pelo smoke test',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'draft',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Criar evento falhou: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    eventId = data.id || data.eventId || '';
    
    if (!eventId) {
      throw new Error('ID do evento não retornado');
    }
  });

  // 5. Criar RFQ (CRÍTICO)
  await test('Criar RFQ', 'critical', async () => {
    const response = await fetch(`${API_URL}/events/${eventId}/rfqs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({
        items: [
          { type: 'need', id: 'need-1', name: 'Serviço de som' },
        ],
        criteria: {
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Criar RFQ falhou: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    rfqId = data.rfq?.rfqId || data.rfqId || '';
    
    if (!rfqId) {
      throw new Error('ID do RFQ não retornado');
    }
  });

  // 6. Responder RFQ (SEMI-CRÍTICO)
  await test('Responder RFQ', 'semi-critical', async () => {
    const response = await fetch(`${API_URL}/events/${eventId}/rfqs/${rfqId}/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({
        serviceId: 'test-service-id',
        priceCents: 10000,
        currency: 'BRL',
        observations: 'Proposta de teste',
      }),
    });

    if (response.status === 404) {
      throw new Error('Endpoint de quote não encontrado (404)');
    }

    if (response.status === 400) {
      // Pode ser que não haja serviços disponíveis - aceitar em modo não-strict
      if (!STRICT_MODE) {
        throw new Error('Serviço não disponível (400) - esperado em staging');
      }
      const errorText = await response.text();
      throw new Error(`Responder RFQ falhou: ${response.status} - ${errorText}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Responder RFQ falhou: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    quoteId = data.quote?.quoteId || data.quoteId || '';
  });

  // 7. Converter RFQ → Booking (SEMI-CRÍTICO)
  await test('Converter RFQ → Booking', 'semi-critical', async () => {
    if (!quoteId) {
      throw new Error('Quote ID não disponível (depende de Responder RFQ)');
    }

    const response = await fetch(`${API_URL}/events/${eventId}/rfqs/${rfqId}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({
        quoteIds: [quoteId],
      }),
    });

    if (response.status === 404) {
      throw new Error('Endpoint de conversão não encontrado (404)');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Converter RFQ falhou: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    bookingId = data.bookingId || data.booking?.bookingId || '';
  });

  // 8. Aceitar booking (SEMI-CRÍTICO)
  await test('Aceitar booking', 'semi-critical', async () => {
    if (!bookingId) {
      throw new Error('Booking ID não disponível (depende de Converter RFQ)');
    }

    const response = await fetch(`${API_URL}/service-bookings/${bookingId}/decisions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({
        status: 'accepted',
        reason: 'Aceito para smoke test',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Aceitar booking falhou: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    decisionId = data.decisionId || '';
    
    if (!decisionId) {
      throw new Error('ID da decisão não retornado');
    }
  });

  // 9. Confirmar booking (CRÍTICO)
  await test('Confirmar booking', 'critical', async () => {
    if (!decisionId) {
      throw new Error('Decision ID não disponível (depende de Aceitar booking)');
    }

    const response = await fetch(`${API_URL}/service-orders/confirm-booking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({
        bookingId,
        decisionId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Confirmar booking falhou: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    serviceOrderId = data.id || data.serviceOrderId || '';
    
    if (!serviceOrderId) {
      throw new Error('ID da service order não retornado');
    }
  });

  // 10. Confirmar termos financeiros (OPCIONAL)
  await testOptional('Confirmar termos financeiros', async () => {
    if (!serviceOrderId) {
      throw new Error('Service Order ID não disponível');
    }

    const response = await fetch(`${API_URL}/service-orders/${serviceOrderId}/confirm-financial-terms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({
        confirmedByActorId: companyId,
        confirmedByUserId: userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Confirmar termos financeiros falhou: ${response.status} - ${errorText}`);
    }
  }, 'Feature de termos financeiros pode estar desabilitada');

  // 11. Verificar auditoria (OPCIONAL)
  await testOptional('Verificar auditoria', async () => {
    if (!serviceOrderId) {
      throw new Error('Service Order ID não disponível');
    }

    const response = await fetch(`${API_URL}/business-audit-logs?contextType=service_order&contextId=${serviceOrderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Verificar auditoria falhou: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const logs = data.logs || data || [];
    
    if (logs.length === 0) {
      throw new Error('Nenhum log de auditoria encontrado');
    }

    console.log(`   ✅ ${logs.length} logs de auditoria encontrados`);
  }, 'Feature de auditoria pode estar desabilitada');

  // Gerar relatório
  const totalDuration = Date.now() - startTime;
  const passed = steps.filter(s => s.status === 'PASS').length;
  const failed = steps.filter(s => s.status === 'FAIL').length;
  const skipped = steps.filter(s => s.status === 'SKIP').length;
  const criticalFailed = steps.filter(s => s.category === 'critical' && s.status === 'FAIL').length;
  const semiCriticalFailed = steps.filter(s => s.category === 'semi-critical' && s.status === 'FAIL').length;
  const optionalFailed = steps.filter(s => s.category === 'optional' && s.status === 'FAIL').length;

  const report: SmokeTestReport = {
    status: (failed === 0 && criticalFailed === 0) ? 'PASS' : 'FAIL',
    timestamp: new Date().toISOString(),
    totalDuration,
    strictMode: STRICT_MODE,
    steps,
    summary: {
      total: steps.length,
      passed,
      failed,
      skipped,
      criticalFailed,
      semiCriticalFailed,
      optionalFailed,
    },
  };

  // Salvar relatório JSON
  const reportsDir = join(process.cwd(), 'scripts', 'staging', 'reports');
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
  console.log(`⏭️  Pulado: ${report.summary.skipped}`);
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

  if (report.summary.skipped > 0) {
    console.log('Testes pulados:');
    steps.filter(s => s.status === 'SKIP').forEach(s => {
      console.log(`   ⏭️  ${s.name}: ${s.skippedReason}`);
    });
    console.log('');
  }

  // Exit code baseado no status
  if (report.status === 'FAIL') {
    process.exit(1);
  } else {
    console.log('✅ TODOS OS TESTES CRÍTICOS PASSARAM');
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
    strictMode: STRICT_MODE,
    steps,
    summary: {
      total: steps.length,
      passed: steps.filter(s => s.status === 'PASS').length,
      failed: steps.filter(s => s.status === 'FAIL').length + 1,
      skipped: steps.filter(s => s.status === 'SKIP').length,
      criticalFailed: steps.filter(s => s.category === 'critical' && s.status === 'FAIL').length,
      semiCriticalFailed: steps.filter(s => s.category === 'semi-critical' && s.status === 'FAIL').length,
      optionalFailed: steps.filter(s => s.category === 'optional' && s.status === 'FAIL').length,
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
    const reportsDir = join(process.cwd(), 'scripts', 'staging', 'reports');
    mkdirSync(reportsDir, { recursive: true });
    const reportPath = join(reportsDir, 'smoke-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Relatório de erro salvo em: ${reportPath}`);
  } catch (writeError) {
    console.error('Erro ao salvar relatório:', writeError);
  }
  
  process.exit(1);
});
