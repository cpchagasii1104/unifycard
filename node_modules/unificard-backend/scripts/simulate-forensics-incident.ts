#!/usr/bin/env ts-node
// backend/scripts/simulate-forensics-incident.ts
// Script para simular um incidente e gerar logs canônicos para dry-run de forensics

import { canonicalLogger } from '@core/logging/canonical-logger';
import { randomUUID } from 'crypto';

/**
 * Simula um incidente de segurança:
 * 1. Usuário tenta acessar recurso de outro tenant
 * 2. Permission denied
 * 3. Token invalidado
 */
async function simulateIncident() {
  console.log('🔴 SIMULANDO INCIDENTE DE SEGURANÇA\n');
  console.log('='.repeat(80));
  console.log('CENÁRIO:');
  console.log('  - Usuário user-123 do tenant tenant-A tenta acessar recurso do tenant-B');
  console.log('  - Permission denied');
  console.log('  - Token invalidado após tentativa suspeita');
  console.log('='.repeat(80));
  console.log('\n');

  // IDs do incidente
  const requestId = randomUUID();
  const correlationId = randomUUID();
  const tenantA = 'tenant-A';
  const tenantB = 'tenant-B';
  const userId = 'user-123';
  const actorId = 'actor-456';
  const resourceId = 'resource-789';

  // Mock request object
  const mockRequest = {
    headers: {
      'x-request-id': requestId,
      'x-correlation-id': correlationId,
      'x-tenant-id': tenantA,
    },
    tenant: { id: tenantA },
    user: { id: userId },
    actionContext: { actingActorId: actorId },
  } as any;

  console.log('📋 CONTEXTO DO INCIDENTE:');
  console.log(`  requestId: ${requestId}`);
  console.log(`  correlationId: ${correlationId}`);
  console.log(`  tenantId (usuário): ${tenantA}`);
  console.log(`  tenantId (recurso): ${tenantB}`);
  console.log(`  userId: ${userId}`);
  console.log(`  actorId: ${actorId}`);
  console.log(`  resourceId: ${resourceId}`);
  console.log('\n');

  // ============================================================
  // PASSO 1: Tentativa de acesso cross-tenant
  // ============================================================
  console.log('🔴 PASSO 1: Tentativa de acesso cross-tenant');
  console.log('-'.repeat(80));
  
  canonicalLogger.info(mockRequest, 'Tentativa de acesso a recurso', {
    resourceId,
    targetTenantId: tenantB,
  });

  // ============================================================
  // PASSO 2: Cross-tenant violation detectada
  // ============================================================
  console.log('\n🔴 PASSO 2: Cross-tenant violation detectada');
  console.log('-'.repeat(80));
  
  canonicalLogger.abuse(mockRequest, 'Cross-tenant violation: tenantId do token não corresponde ao recurso', {
    tenantIdFromToken: tenantA,
    tenantIdFromResource: tenantB,
    userId,
    actorId,
    resourceId,
  });

  // ============================================================
  // PASSO 3: Permission denied
  // ============================================================
  console.log('\n🔴 PASSO 3: Permission denied');
  console.log('-'.repeat(80));
  
  canonicalLogger.authzDeny(mockRequest, 'Permissão negada: Cross-tenant access attempt', {
    tenantId: tenantA,
    userId,
    actorId,
    permissionKey: 'resource:read',
    resourceId,
    targetTenantId: tenantB,
    reason: 'Cross-tenant access attempt blocked',
  });

  // ============================================================
  // PASSO 4: Token invalidation (após tentativa suspeita)
  // ============================================================
  console.log('\n🔴 PASSO 4: Token invalidation (após tentativa suspeita)');
  console.log('-'.repeat(80));
  
  const previousTokenVersion = 5;
  const newTokenVersion = 6;
  
  canonicalLogger.invalidation(mockRequest, 'Token invalidation: Tentativa suspeita detectada', {
    tenantId: tenantA,
    userId,
    previousTokenVersion,
    newTokenVersion,
    reason: 'Cross-tenant access attempt - security measure',
  });

  // ============================================================
  // PASSO 5: Login failure (token invalidado)
  // ============================================================
  console.log('\n🔴 PASSO 5: Login failure (token invalidado)');
  console.log('-'.repeat(80));
  
  canonicalLogger.warn(mockRequest, 'Login failure: Token invalidation detectada', {
    tenantId: tenantA,
    userId,
    tokenVersionFromToken: previousTokenVersion,
    tokenVersionFromDB: newTokenVersion,
    reason: 'Token foi invalidado após tentativa suspeita',
  });

  console.log('\n');
  console.log('='.repeat(80));
  console.log('✅ SIMULAÇÃO CONCLUÍDA');
  console.log('='.repeat(80));
  console.log('\n');
  console.log('📋 IDs PARA RECONSTRUÇÃO:');
  console.log(`  requestId: ${requestId}`);
  console.log(`  correlationId: ${correlationId}`);
  console.log(`  tenantId: ${tenantA}`);
  console.log(`  userId: ${userId}`);
  console.log(`  actorId: ${actorId}`);
  console.log('\n');
  console.log('💡 Use estes IDs para reconstruir o incidente usando apenas logs.');
  console.log('   Veja: docs/audit/INCIDENT-FORENSICS-GUIDE.md');
  console.log('\n');
}

// Executar simulação
simulateIncident().catch((error) => {
  console.error('❌ Erro ao simular incidente:', error);
  process.exit(1);
});



