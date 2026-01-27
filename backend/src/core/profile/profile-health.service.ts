// src/core/profile/profile-health.service.ts
// Service para autodeclarações de saúde V3 (modelo relacional)
// TODO: DOMÍNIO ESPECIAL -> categories (core) - profileHealthTaxonomyRepository será substituído por adapter sobre categories core

import { profileHealthRepository } from './profile-health.repository';
import { profileHealthFactsRepository } from './profile-health-facts.repository';
import { profileHealthTaxonomyRepository } from './profile-health-taxonomy.repository';
import type { HealthDeclaration, CreateHealthDeclarationInput, HealthSection } from './profile-health.types';

class ProfileHealthService {
  /**
   * Busca todas as declarações de saúde de um actor
   * Opcionalmente filtra por seção
   */
  async getDeclarations(
    tenantId: string,
    actorId: string,
    section?: HealthSection | null
  ): Promise<HealthDeclaration[]> {
    return profileHealthRepository.findByActorId(tenantId, actorId, section);
  }

  /**
   * Cria nova declaração de saúde (V3: gera registros estruturados)
   * Valida consentimento obrigatório e cria fatos relacionais
   */
  async createDeclaration(
    tenantId: string,
    actorId: string,
    input: CreateHealthDeclarationInput
  ): Promise<HealthDeclaration> {
    // Validar consentimento obrigatório
    if (input.consent !== true) {
      throw new Error('Consentimento é obrigatório e deve ser true');
    }

    // Validar que pelo menos declarationText OU payload seja fornecido
    if (!input.declarationText && !input.payload) {
      throw new Error('É necessário fornecer declarationText ou payload');
    }

    // Se declarationText for fornecido, validar que não está vazio
    if (input.declarationText && input.declarationText.trim().length === 0 && !input.payload) {
      throw new Error('Texto da declaração não pode estar vazio se payload não for fornecido');
    }

    // Criar declaração (modelo atual)
    const declaration = await profileHealthRepository.create(tenantId, actorId, {
      declarationText: input.declarationText?.trim() || undefined,
      notes: input.notes || null,
      consent: input.consent,
      section: input.section || null,
      payload: input.payload || null,
      consentScope: input.consentScope || null,
    });

    // V3: Gerar registros estruturados em user_health_facts se payload for fornecido
    if (input.payload && input.section) {
      await this.generateHealthFactsFromPayload(
        tenantId,
        actorId,
        input.section,
        input.payload,
        declaration.id
      );
    }

    return declaration;
  }

  /**
   * Gera fatos relacionais a partir do payload estruturado
   * Mapeia campos do payload para taxonomias conhecidas
   */
  private async generateHealthFactsFromPayload(
    tenantId: string,
    actorId: string,
    section: HealthSection,
    payload: Record<string, any>,
    healthDeclarationId: string
  ): Promise<void> {
    // Mapeamento de campos do payload para slugs de taxonomia
    const fieldToTaxonomyMap: Record<string, Record<string, string>> = {
      vision: {
        usesGlasses: 'uso-oculos',
        usesContacts: 'uso-lentes-contato',
        conditions: 'condicoes-visuais',
        lastExam: 'ultimo-exame-visao',
      },
      dental: {
        usesBraces: 'uso-aparelho-ortodontico',
        lastDentalVisit: 'ultima-consulta-odontologica',
        conditions: 'condicoes-bucais',
        urgentCare: 'necessidades-urgentes-odontologia',
      },
      medications: {
        medications: 'medicamentos-continuos',
        dosage: 'dosagem-medicamentos',
        prescribedBy: 'prescrito-por',
      },
      mobility: {
        mobilityAids: 'auxiliares-mobilidade',
        accessibilityNeeds: 'necessidades-acessibilidade',
        conditions: 'condicoes-mobilidade',
      },
      mental: {
        therapy: 'acompanhamento-psicologico',
        conditions: 'condicoes-saude-mental',
        medications: 'medicamentos-psiquiatricos',
      },
      general: {
        conditions: 'condicoes-gerais',
        medicalFollowUp: 'acompanhamento-medico',
        lastCheckup: 'ultimo-checkup',
      },
    };

    const fieldMap = fieldToTaxonomyMap[section];
    if (!fieldMap) {
      return; // Seção não mapeada, não gera fatos
    }

    // Processar cada campo do payload
    for (const [fieldKey, taxonomySlug] of Object.entries(fieldMap)) {
      const fieldValue = payload[fieldKey];
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        continue; // Campo vazio, pular
      }

      // Buscar taxonomia por slug
      const taxonomy = await profileHealthTaxonomyRepository.findBySlug(tenantId, taxonomySlug);
      if (!taxonomy) {
        // Taxonomia não existe ainda, pular (será criada via seed)
        continue;
      }

      // Determinar tipo de valor baseado no tipo do campo
      let factInput: any = {
        taxonomyId: taxonomy.taxonomyId,
        healthDeclarationId,
        notes: null,
        metadata: {},
      };

      if (typeof fieldValue === 'boolean') {
        factInput.valueBoolean = fieldValue;
      } else if (typeof fieldValue === 'number') {
        factInput.valueNumber = fieldValue;
      } else if (fieldValue instanceof Date || (typeof fieldValue === 'string' && fieldValue.match(/^\d{4}-\d{2}-\d{2}/))) {
        factInput.valueDate = fieldValue;
      } else {
        factInput.valueText = String(fieldValue);
      }

      // Criar ou atualizar fato
      try {
        await profileHealthFactsRepository.upsert(tenantId, actorId, factInput);
      } catch (error) {
        // Log erro mas não quebra o fluxo (compatibilidade)
        console.warn(`[ProfileHealthService] Erro ao criar fato para ${taxonomySlug}:`, error);
      }
    }
  }

  /**
   * Remove declaração de saúde
   */
  async deleteDeclaration(tenantId: string, actorId: string, declarationId: string): Promise<void> {
    // Verificar que a declaração pertence ao actor
    const declaration = await profileHealthRepository.findById(tenantId, declarationId);
    if (!declaration) {
      throw new Error('Declaração de saúde não encontrada');
    }

    if (declaration.actorId !== actorId) {
      throw new Error('Não autorizado a remover esta declaração');
    }

    await profileHealthRepository.delete(tenantId, declarationId);
  }
}

export const profileHealthService = new ProfileHealthService();

