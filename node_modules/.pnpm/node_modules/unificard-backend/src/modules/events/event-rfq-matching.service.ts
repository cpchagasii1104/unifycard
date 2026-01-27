// backend/src/modules/events/event-rfq-matching.service.ts
// Service de SUGESTÃO de empresas compatíveis para RFQ
// ⚠️ REGRAS CANÔNICAS:
// - Retorna LISTA SIMPLES (não ordenada, não pontuada)
// - NÃO ordena por "melhor"
// - NÃO escolhe "melhor"
// - Apenas SUGESTÃO baseada em compatibilidade técnica
// - Organizador escolhe manualmente quais empresas notificar

import { runQueriesWithTenant } from '@core/database/pool';
import type { EventRFQ, RFQItem } from './event-rfq.types';

interface CompatibleCompany {
  actor_id: string;
  actor_type: string;
  company_name: string;
  service_categories: string[];
  city: string | null;
  state: string | null;
  // Capacidade (se disponível)
  min_capacity: number | null;
  max_capacity: number | null;
}

/**
 * Service de sugestão de empresas compatíveis
 * ⚠️ REGRAS: Apenas sugestão, não decisão
 */
class EventRFQMatchingService {
  /**
   * Encontra empresas compatíveis para um RFQ
   * ⚠️ REGRAS: Retorna lista simples, não ordenada, não pontuada
   * 
   * Filtros aplicados:
   * - Categoria de serviço (se RFQ item for 'service')
   * - Localização (cidade/estado)
   * - Capacidade (se disponível)
   * 
   * NÃO ordena, NÃO pontua, NÃO escolhe "melhor"
   */
  async findCompatibleCompaniesForRFQ(
    tenantId: string,
    rfq: EventRFQ
  ): Promise<CompatibleCompany[]> {
    // Extrair categorias de serviços do RFQ
    const serviceCategories: string[] = [];
    const serviceIds: string[] = [];

    for (const item of rfq.items) {
      if (item.type === 'service' && item.id) {
        serviceIds.push(item.id);
      } else if (item.type === 'need' && item.category) {
        // Mapear necessidade para categoria (descritivo apenas)
        serviceCategories.push(item.category);
      }
    }

    // Extrair localização do RFQ
    const location = rfq.criteria.location;
    const city = location ? this.extractCity(location) : null;
    const state = location ? this.extractState(location) : null;

    // Construir query para buscar empresas compatíveis
    // ⚠️ NOTA: Esta é uma query simplificada. Pode ser expandida conforme necessário.
    const conditions: string[] = [];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    // Filtrar por categorias de serviço (se houver)
    if (serviceCategories.length > 0) {
      // Buscar empresas que oferecem serviços nessas categorias
      conditions.push(`
        EXISTS (
          SELECT 1 FROM services s
          WHERE s.tenant_id = $1
            AND s.actor_id = a.actor_id
            AND s.category = ANY($${paramIndex}::text[])
        )
      `);
      params.push(serviceCategories);
      paramIndex++;
    }

    // Filtrar por serviceIds (se houver)
    if (serviceIds.length > 0) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM services s
          WHERE s.tenant_id = $1
            AND s.actor_id = a.actor_id
            AND s.service_id = ANY($${paramIndex}::text[])
        )
      `);
      params.push(serviceIds);
      paramIndex++;
    }

    // Filtrar por localização (se houver)
    if (city) {
      conditions.push(`a.city = $${paramIndex++}`);
      params.push(city);
    }
    if (state) {
      conditions.push(`a.state = $${paramIndex++}`);
      params.push(state);
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // ⚠️ NOTA: Esta query busca actors do tipo 'page' (empresas) que oferecem serviços
    // Ajustar conforme a estrutura real do banco (pode usar actors + services)
    // Por enquanto, retornar lista vazia se não houver estrutura adequada
    // ⚠️ IMPLEMENTAÇÃO STUB: A query real deve ser ajustada conforme schema do banco
    const query = `
      SELECT DISTINCT
        a.actor_id,
        a.actor_type,
        COALESCE(a.name, a.display_name, 'Empresa') as company_name,
        ARRAY_AGG(DISTINCT s.category) FILTER (WHERE s.category IS NOT NULL) as service_categories,
        a.city,
        a.state,
        NULL as min_capacity,
        NULL as max_capacity
      FROM actors a
      LEFT JOIN services s ON s.tenant_id = a.tenant_id AND s.actor_id = a.actor_id
      WHERE a.tenant_id = $1
        AND a.actor_type = 'page'
      ${whereClause}
      GROUP BY a.actor_id, a.actor_type, a.name, a.display_name, a.city, a.state
      LIMIT 100
    `;

    try {
      const results = await runQueriesWithTenant<CompatibleCompany>(tenantId, query, params);
      // ⚠️ NOTA: runQueriesWithTenant retorna T[], não precisa verificar result.rows
      return results;
    } catch (error: any) {
      // Se a query falhar (ex: tabela não existe), retornar lista vazia
      // ⚠️ NOTA: Isso permite que o sistema continue funcionando mesmo sem matching
      console.warn('[EventRFQMatching] Erro ao buscar empresas compatíveis (não bloqueante):', error.message);
      return [];
    }
  }

  /**
   * Extrai cidade de uma string de localização
   */
  private extractCity(location: string): string | null {
    // Implementação simplificada - pode ser melhorada
    const parts = location.split(',').map(p => p.trim());
    return parts[0] || null;
  }

  /**
   * Extrai estado de uma string de localização
   */
  private extractState(location: string): string | null {
    // Implementação simplificada - pode ser melhorada
    const parts = location.split(',').map(p => p.trim());
    return parts.length > 1 ? parts[parts.length - 1] : null;
  }
}

export const eventRFQMatchingService = new EventRFQMatchingService();

