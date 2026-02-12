// src/core/audit/audit.service.ts
// Serviço de Auditoria & Alertas Anti-Abuso (FASE 13)
// REGRA: Alertar ≠ bloquear automaticamente (primeiro observar)

import { randomUUID } from 'crypto';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AuditSource = 'impact' | 'validation' | 'reputation' | 'social' | 'cultural_event_checkin' | 'penalty_service' | 'bank_limit' | 'automation';

export interface AuditEvent {
  id: string;
  tenant_id: string;
  event_type: string;
  severity: AuditSeverity;
  actor_id: string | null;
  actor_type: 'user' | 'page' | 'cultural_profile' | null;
  company_id: string | null;
  employee_id: string | null;
  source: AuditSource;
  context: Record<string, any>;
  createdAt: string;
  resolvedAt: string | null;
  resolution_note: string | null;
}

export interface AuditEventInput {
  event_type: string;
  severity: AuditSeverity;
  actor_id?: string;
  actor_type?: 'user' | 'page' | 'cultural_profile';
  company_id?: string;
  employee_id?: string;
  source: AuditSource;
  context: Record<string, any>;
}

class AuditService {
  /**
   * Registra evento de auditoria
   * REGRA: Não bloqueia fluxo principal - apenas registra
   */
  async record(tenantId: string, input: AuditEventInput): Promise<AuditEvent> {
    try {
      const result = await runQueriesWithTenant<{
        id: string;
        tenant_id: string;
        event_type: string;
        severity: string;
        actor_id: string | null;
        actor_type: string | null;
        company_id: string | null;
        employee_id: string | null;
        source: string;
        context: Record<string, any>;
        createdAt: string;
        resolvedAt: string | null;
        resolution_note: string | null;
      }>(
        tenantId,
        `
        INSERT INTO audit_events (
          tenant_id, event_type, severity, actor_id, actor_type,
          company_id, employee_id, source, context
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        RETURNING id, tenant_id, event_type, severity, actor_id, actor_type,
                  company_id, employee_id, source, context, createdAt,
                  resolvedAt, resolution_note
        `,
        [
          tenantId,
          input.event_type,
          input.severity,
          input.actor_id || null,
          input.actor_type || null,
          input.company_id || null,
          input.employee_id || null,
          input.source,
          JSON.stringify(input.context),
        ]
      );

      if (!result || result.length === 0) {
        throw new Error('Erro ao registrar evento de auditoria');
      }

      const row = result[0];
      const event: AuditEvent = {
        id: row.id,
        tenant_id: row.tenant_id,
        event_type: row.event_type,
        severity: row.severity as AuditSeverity,
        actor_id: row.actor_id,
        actor_type: row.actor_type as 'user' | 'page' | null,
        company_id: row.company_id,
        employee_id: row.employee_id,
        source: row.source as AuditSource,
        context: row.context,
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt,
        resolution_note: row.resolution_note,
      };

      // Emitir evento interno (para futuras integrações: email, webhook, etc)
      // Por enquanto, apenas log estruturado
      if (input.severity === 'critical' || input.severity === 'high') {
        console.warn('[AUDIT]', JSON.stringify({
          event_type: input.event_type,
          severity: input.severity,
          actor_id: input.actor_id,
          company_id: input.company_id,
          employee_id: input.employee_id,
          context: input.context,
        }));
      }

      return event;
    } catch (err) {
      // Não quebra fluxo principal se auditoria falhar
      console.error('Erro ao registrar evento de auditoria (não crítico):', err);
      throw err; // Mas propaga para que o chamador saiba
    }
  }

  /**
   * Avalia padrões de impacto e gera alertas se necessário
   * FASE 13: Heurística B - Empresa com impacto crescendo rápido demais
   */
  async evaluateImpactPatterns(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page',
    newBalance: number
  ): Promise<void> {
    try {
      // Buscar histórico de impacto nas últimas 24h
      const impactHistory = await runQueriesWithTenant<{
        impact_delta: number;
        createdAt: string;
      }>(
        tenantId,
        `
        SELECT impact_delta, createdAt
        FROM impact_ledger
        WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
          AND createdAt >= NOW() - INTERVAL '24 hours'
        ORDER BY createdAt DESC
        `,
        [tenantId, actorId, actorType]
      );

      if (!impactHistory || impactHistory.length === 0) return;

      // Calcular delta total nas últimas 24h
      const delta24h = impactHistory.reduce((sum, entry) => sum + entry.impact_delta, 0);

      // Heurística: PJ nova com +50 impacto em 24h é suspeito
      if (actorType === 'page' && delta24h >= 50) {
        // Verificar se empresa é nova (criada há menos de 7 dias)
        const company = await runQueriesWithTenant<{
          company_id: string;
          createdAt: string;
        }>(
          tenantId,
          `
          SELECT company_id, createdAt
          FROM companies c
          JOIN actors a ON a.company_id = c.company_id
          WHERE a.actor_id = $1 AND a.tenant_id = $2
          LIMIT 1
          `,
          [actorId, tenantId]
        );

        if (company && company.length > 0) {
          const companyAge = (Date.now() - new Date(company[0].createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (companyAge < 7) {
            await this.record(tenantId, {
              event_type: 'COMPANY_IMPACT_SPIKE',
              severity: 'medium',
              actor_id: actorId,
              actor_type: actorType,
              company_id: company[0].company_id,
              source: 'impact',
              context: {
                delta_24h: delta24h,
                window_hours: 24,
                company_age_days: Math.round(companyAge),
                baseline: 0,
              },
            });
          }
        }
      }
    } catch (err) {
      // Não quebra fluxo principal
      console.warn('Erro ao avaliar padrões de impacto (não crítico):', err);
    }
  }

  /**
   * Avalia padrões de validação e gera alertas se necessário
   * FASE 13: Heurística A - Funcionário validando demais
   */
  async evaluateValidationPatterns(
    tenantId: string,
    employeeId: string
  ): Promise<void> {
    try {
      // Contar validações nas últimas 24h
      const validations24h = await runQueryWithTenant<{ count: number }>(
        tenantId,
        `
        SELECT COUNT(*)::int as count
        FROM company_validations
        WHERE tenant_id = $1 AND validated_by_employee_id = $2
          AND validatedAt >= NOW() - INTERVAL '24 hours'
        `,
        [tenantId, employeeId]
      );

      const count24h = validations24h?.[0]?.count || 0;

      // Contar validações na última hora
      const validations1h = await runQueryWithTenant<{ count: number }>(
        tenantId,
        `
        SELECT COUNT(*)::int as count
        FROM company_validations
        WHERE tenant_id = $1 AND validated_by_employee_id = $2
          AND validatedAt >= NOW() - INTERVAL '1 hour'
        `,
        [tenantId, employeeId]
      );

      const count1h = validations1h?.[0]?.count || 0;

      // Buscar partner_id do funcionário
      const employee = await runQueryWithTenant<{ partner_id: string }>(
        tenantId,
        `
        SELECT partner_id
        FROM partner_employees
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [employeeId, tenantId]
      );

      const partnerId = employee?.[0]?.partner_id;

      // Heurística: > 20 validações/dia OU > 10 em 30 min
      if (count24h > 20 || count1h > 10) {
        await this.record(tenantId, {
          event_type: 'EMPLOYEE_VALIDATION_SPIKE',
          severity: 'high',
          employee_id: employeeId,
          source: 'validation',
          context: {
            count_24h: count24h,
            count_1h: count1h,
            partner_id: partnerId,
          },
        });
      }
    } catch (err) {
      console.warn('Erro ao avaliar padrões de validação (não crítico):', err);
    }
  }

  /**
   * Avalia padrões de reputação e gera alertas se necessário
   * FASE 13: Heurística D - Reputação subindo rápido demais
   */
  async evaluateReputationPatterns(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page',
    newLevel: number,
    activeDays: number
  ): Promise<void> {
    try {
      // Buscar nível anterior
      const previousReputation = await runQueriesWithTenant<{
        reputation_level: number;
        updatedAt: string;
      }>(
        tenantId,
        `
        SELECT reputation_level, updatedAt
        FROM actor_reputation
        WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
        LIMIT 1
        `,
        [tenantId, actorId, actorType]
      );

      if (!previousReputation || previousReputation.length === 0) return;

      const previousLevel = previousReputation[0].reputation_level;
      const levelJump = newLevel - previousLevel;

      // Heurística: Salto de nível sem cumprir janelas mínimas de tempo
      // Ex: nível 0 → 2 em menos de 10 dias ativos
      if (levelJump >= 2 && activeDays < 10) {
        await this.record(tenantId, {
          event_type: 'REPUTATION_ANOMALY',
          severity: 'MEDIUM',
          actor_id: actorId,
          actor_type: actorType,
          source: 'reputation',
          context: {
            from_level: previousLevel,
            to_level: newLevel,
            days_active: activeDays,
            level_jump: levelJump,
          },
        });
      }
    } catch (err) {
      console.warn('Erro ao avaliar padrões de reputação (não crítico):', err);
    }
  }

  /**
   * Avalia diversidade de ações e gera alertas se necessário
   * FASE 13: Heurística C - Ator com diversidade artificial
   */
  async evaluateActionDiversity(
    tenantId: string,
    actorId: string,
    actorType: 'user' | 'page'
  ): Promise<void> {
    try {
      // Buscar distribuição de eventos nas últimas 24h
      const eventDistribution = await runQueriesWithTenant<{
        event_type: string;
        count: number;
      }>(
        tenantId,
        `
        SELECT event_type, COUNT(*)::int as count
        FROM impact_ledger
        WHERE tenant_id = $1 AND actor_id = $2 AND actor_type = $3
          AND createdAt >= NOW() - INTERVAL '24 hours'
        GROUP BY event_type
        ORDER BY count DESC
        `,
        [tenantId, actorId, actorType]
      );

      if (!eventDistribution || eventDistribution.length === 0) return;

      const totalEvents = eventDistribution.reduce((sum, e) => sum + e.count, 0);
      const dominantEvent = eventDistribution[0];
      const dominantRatio = dominantEvent.count / totalEvents;

      // Heurística: > 80% das ações são do mesmo tipo (spam)
      if (dominantRatio > 0.8 && totalEvents >= 10) {
        await this.record(tenantId, {
          event_type: 'LOW_ACTION_DIVERSITY',
          severity: 'low',
          actor_id: actorId,
          actor_type: actorType,
          source: 'social',
          context: {
            dominant_event: dominantEvent.event_type,
            ratio: Math.round(dominantRatio * 100) / 100,
            total_events: totalEvents,
            distribution: eventDistribution,
          },
        });
      }
    } catch (err) {
      console.warn('Erro ao avaliar diversidade de ações (não crítico):', err);
    }
  }

  /**
   * Registra tentativa de abuso de validação
   * FASE 13: Heurística E - QR/Validação suspeita
   */
  async recordValidationAbuseAttempt(
    tenantId: string,
    companyId: string,
    deviceFingerprint?: string,
    reason?: string
  ): Promise<void> {
    try {
      await this.record(tenantId, {
        event_type: 'VALIDATION_ABUSE_ATTEMPT',
        severity: 'HIGH',
        company_id: companyId,
        source: 'validation',
        context: {
          attempts: 1,
          device_fingerprint: deviceFingerprint || null,
          reason: reason || 'Token inválido ou expirado',
        },
      });
    } catch (err) {
      console.warn('Erro ao registrar tentativa de abuso (não crítico):', err);
    }
  }

  /**
   * Busca alertas não resolvidos
   */
  async getUnresolvedAlerts(
    tenantId: string,
    severity?: AuditSeverity,
    limit: number = 50
  ): Promise<AuditEvent[]> {
    const result = await runQueriesWithTenant<{
      id: string;
      tenant_id: string;
      event_type: string;
      severity: string;
      actor_id: string | null;
      actor_type: string | null;
      company_id: string | null;
      employee_id: string | null;
      source: string;
      context: Record<string, any>;
      createdAt: string;
      resolvedAt: string | null;
      resolution_note: string | null;
    }>(
      tenantId,
      severity
        ? `
        SELECT id, tenant_id, event_type, severity, actor_id, actor_type,
               company_id, employee_id, source, context, createdAt,
               resolvedAt, resolution_note
        FROM audit_events
        WHERE tenant_id = $1 AND resolvedAt IS NULL AND severity = $2
        ORDER BY createdAt DESC
        LIMIT $3
        `
        : `
        SELECT id, tenant_id, event_type, severity, actor_id, actor_type,
               company_id, employee_id, source, context, createdAt,
               resolvedAt, resolution_note
        FROM audit_events
        WHERE tenant_id = $1 AND resolvedAt IS NULL
        ORDER BY severity DESC, createdAt DESC
        LIMIT $2
        `,
      severity ? [tenantId, severity, limit] : [tenantId, limit]
    );

    return (result || []).map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      event_type: row.event_type,
      severity: row.severity as AuditSeverity,
      actor_id: row.actor_id,
      actor_type: row.actor_type as 'user' | 'page' | null,
      company_id: row.company_id,
      employee_id: row.employee_id,
      source: row.source as AuditSource,
      context: row.context,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      resolution_note: row.resolution_note,
    }));
  }
}

export const auditService = new AuditService();





















