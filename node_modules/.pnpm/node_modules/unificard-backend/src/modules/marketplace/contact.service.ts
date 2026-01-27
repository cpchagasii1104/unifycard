// backend/src/modules/marketplace/contact.service.ts
// SPRINT 0: CONTACTS / CLIENTES UNIFICADOS

import { contactRepository } from './contact.repository';
import { normalizeCpf, validateCpf } from '../../utils/cpf.validator';
import {
  validateTaxId,
  validateEmail,
  validatePhone,
} from '../../core/kyc/kyc.validators';
import type {
  Contact,
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
  KycStatus,
} from './contact.types';

/**
 * Service para Contacts
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Contact ≠ User
 * - Contact ≠ Actor
 * - Contact pode estar vinculado a User (opcional)
 * - Tax_id normalizado (só dígitos)
 * - Idempotência por tax_id (se já existe, retorna existente)
 */
class ContactService {
  /**
   * Normaliza tax_id (remove formatação, só dígitos)
   */
  private normalizeTaxId(taxId: string | null | undefined): string | null {
    if (!taxId) {
      return null;
    }
    return taxId.replace(/\D/g, '');
  }

  /**
   * Valida formato básico de CPF/CNPJ
   */
  private validateTaxIdFormat(taxId: string, type: 'PERSON' | 'COMPANY'): { valid: boolean; error?: string } {
    const normalized = this.normalizeTaxId(taxId);
    if (!normalized) {
      return { valid: false, error: 'Tax ID é obrigatório' };
    }

    if (type === 'PERSON') {
      // CPF deve ter 11 dígitos
      if (normalized.length !== 11) {
        return { valid: false, error: 'CPF deve ter 11 dígitos' };
      }
      // Validação básica de CPF (formato)
      if (!validateCpf(normalized)) {
        return { valid: false, error: 'CPF inválido' };
      }
    } else {
      // CNPJ deve ter 14 dígitos
      if (normalized.length !== 14) {
        return { valid: false, error: 'CNPJ deve ter 14 dígitos' };
      }
      // Verifica se todos os dígitos são iguais (formato inválido óbvio)
      if (/^(\d)\1+$/.test(normalized)) {
        return { valid: false, error: 'CNPJ inválido (todos os dígitos são iguais)' };
      }
      // Por enquanto, apenas validação de formato (sem dígitos verificadores)
    }

    return { valid: true };
  }

  /**
   * Valida email básico
   */
  private validateEmail(email: string | null | undefined): { valid: boolean; error?: string } {
    if (!email) {
      return { valid: true }; // Email é opcional
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Email inválido' };
    }
    return { valid: true };
  }

  /**
   * Valida telefone básico
   */
  private validatePhone(phone: string | null | undefined): { valid: boolean; error?: string } {
    if (!phone) {
      return { valid: true }; // Telefone é opcional
    }
    const phoneRegex = /^[\d\s\(\)\-\+]+$/;
    if (!phoneRegex.test(phone)) {
      return { valid: false, error: 'Telefone inválido' };
    }
    return { valid: true };
  }

  /**
   * Cria contato (com idempotência por tax_id)
   */
  async createContact(
    tenantId: string,
    input: CreateContactInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<Contact> {
    // Validar nome
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Nome é obrigatório');
    }

    // Normalizar e validar tax_id se fornecido
    let normalizedTaxId: string | null = null;
    if (input.taxId) {
      normalizedTaxId = this.normalizeTaxId(input.taxId);
      const taxIdValidation = this.validateTaxIdFormat(normalizedTaxId, input.type);
      if (!taxIdValidation.valid) {
        throw new Error(taxIdValidation.error || 'Tax ID inválido');
      }
    }

    // Validar email
    const emailValidation = this.validateEmail(input.email);
    if (!emailValidation.valid) {
      throw new Error(emailValidation.error || 'Email inválido');
    }

    // Validar telefone
    const phoneValidation = this.validatePhone(input.phone);
    if (!phoneValidation.valid) {
      throw new Error(phoneValidation.error || 'Telefone inválido');
    }

    // Idempotência: se tax_id já existe, retornar existente
    if (normalizedTaxId) {
      const existing = await contactRepository.getContactByTaxId(tenantId, normalizedTaxId);
      if (existing) {
        // Registrar auditoria de tentativa de duplicação
        await this.recordAudit(tenantId, {
          eventType: 'CONTACT_DUPLICATE_ATTEMPT',
          contactId: existing.id,
          taxId: normalizedTaxId,
          attemptedName: input.name,
        });
        return existing;
      }
    }

    // Criar contato
    const contact = await contactRepository.createContact(tenantId, {
      ...input,
      taxId: normalizedTaxId,
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'CONTACT_CREATED',
      contactId: contact.id,
      type: input.type,
      name: input.name,
      taxId: normalizedTaxId,
      createdByActorId,
      createdByUserId,
    });

    return contact;
  }

  /**
   * Atualiza contato
   */
  async updateContact(
    tenantId: string,
    contactId: string,
    input: UpdateContactInput,
    updatedByActorId: string,
    updatedByUserId?: string
  ): Promise<Contact> {
    // Validar nome se fornecido
    if (input.name !== undefined && input.name.trim().length === 0) {
      throw new Error('Nome não pode ser vazio');
    }

    // Validar email se fornecido
    if (input.email !== undefined) {
      const emailValidation = this.validateEmail(input.email);
      if (!emailValidation.valid) {
        throw new Error(emailValidation.error || 'Email inválido');
      }
    }

    // Validar telefone se fornecido
    if (input.phone !== undefined) {
      const phoneValidation = this.validatePhone(input.phone);
      if (!phoneValidation.valid) {
        throw new Error(phoneValidation.error || 'Telefone inválido');
      }
    }

    // Atualizar contato
    const contact = await contactRepository.updateContact(tenantId, contactId, input);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'CONTACT_UPDATED',
      contactId: contact.id,
      updatedByActorId,
      updatedByUserId,
    });

    return contact;
  }

  /**
   * Busca contato por ID
   */
  async getContactById(tenantId: string, contactId: string): Promise<Contact | null> {
    return contactRepository.getContactById(tenantId, contactId);
  }

  /**
   * Busca contato por tax_id
   */
  async getContactByTaxId(tenantId: string, taxId: string): Promise<Contact | null> {
    const normalized = this.normalizeTaxId(taxId);
    if (!normalized) {
      return null;
    }
    return contactRepository.getContactByTaxId(tenantId, normalized);
  }

  /**
   * Lista contatos com filtros
   */
  async listContacts(
    tenantId: string,
    filters: ContactFilters = {}
  ): Promise<Contact[]> {
    // Normalizar tax_id se fornecido
    if (filters.taxId) {
      filters.taxId = this.normalizeTaxId(filters.taxId) || undefined;
    }

    return contactRepository.listContacts(tenantId, filters);
  }

  /**
   * Vincula usuário a contato
   */
  async linkUserToContact(
    tenantId: string,
    contactId: string,
    userId: string,
    linkedByActorId: string,
    linkedByUserId?: string
  ): Promise<Contact> {
    const contact = await contactRepository.linkUserToContact(tenantId, contactId, userId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'CONTACT_USER_LINKED',
      contactId: contact.id,
      userId,
      linkedByActorId,
      linkedByUserId,
    });

    return contact;
  }

  /**
   * Registra auditoria
   */
  private async recordAudit(
    tenantId: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, data);
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[ContactService] Erro ao registrar auditoria:', error);
    }
  }
}

export const contactService = new ContactService();

