// backend/tests/integration/profile-education-companies.test.ts
// Testes de integração para educação e empresas do usuário
// FASE 2: Educação + Empresa (Unify Platform)

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../src/core/database/pool';
import { profileEducationCompaniesService } from '../../src/core/profile/profile-education-companies.service';
import { resolveGlobalUserId } from '../../src/core/identity/identity.utils';

describe('Profile Education & Companies - Integração', () => {
  const testTenantId = uuidv4();
  let testUserId: string;
  let testGlobalUserId: string;

  beforeAll(async () => {
    // Criar tenant de teste
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, city_id)
       VALUES ($1, 'Test Tenant', NULL)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [testTenantId]
    );

    // Criar usuário de teste
    testUserId = uuidv4();
    testGlobalUserId = uuidv4();

    await pool.query(
      `INSERT INTO global_users (global_user_id, full_name, created_at)
       VALUES ($1, 'Test User', now())
       ON CONFLICT (global_user_id) DO NOTHING`,
      [testGlobalUserId]
    );

    await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, global_user_id, created_at)
       VALUES ($1, $2, 'test@test.com', $3, now())
       ON CONFLICT (user_id) DO NOTHING`,
      [testUserId, testTenantId, testGlobalUserId]
    );
  });

  afterAll(async () => {
    // Limpar dados de teste
    try {
      await pool.query(`DELETE FROM user_education WHERE global_user_id = $1`, [testGlobalUserId]);
      await pool.query(`DELETE FROM user_companies WHERE global_user_id = $1`, [testGlobalUserId]);
      await pool.query(`DELETE FROM users WHERE tenant_id = $1`, [testTenantId]);
      await pool.query(`DELETE FROM tenants WHERE tenant_id = $1`, [testTenantId]);
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  describe('Educação', () => {
    describe('Formação válida', () => {
      it('deve adicionar formação válida com sucesso', async () => {
        const result = await profileEducationCompaniesService.addEducation(testTenantId, testUserId, {
          name: 'Engenharia de Software',
        });

        expect(result).toBeDefined();
        expect(result.globalUserId).toBe(testGlobalUserId);
        expect(result.categoryName).toBeDefined();
        expect(result.categoryId).toBeDefined();
      });

      it('deve adicionar múltiplas formações válidas', async () => {
        await profileEducationCompaniesService.addEducation(testTenantId, testUserId, {
          name: 'Administração',
        });

        await profileEducationCompaniesService.addEducation(testTenantId, testUserId, {
          name: 'MBA em Finanças',
        });

        const education = await profileEducationCompaniesService.listEducation(testGlobalUserId);
        expect(education.length).toBeGreaterThanOrEqual(3); // Pelo menos as 3 adicionadas
      });
    });

    describe('Validações de negócio', () => {
      it('deve rejeitar termo genérico ("faculdade")', async () => {
        await expect(
          profileEducationCompaniesService.addEducation(testTenantId, testUserId, {
            name: 'faculdade',
          })
        ).rejects.toThrow();
      });

      it('deve rejeitar termo genérico ("estudar")', async () => {
        await expect(
          profileEducationCompaniesService.addEducation(testTenantId, testUserId, {
            name: 'estudar',
          })
        ).rejects.toThrow();
      });

      it('deve rejeitar duplicata', async () => {
        const name = `Engenharia ${uuidv4()}`;
        
        // Primeira adição
        await profileEducationCompaniesService.addEducation(testTenantId, testUserId, {
          name,
        });

        // Segunda adição (deve falhar)
        await expect(
          profileEducationCompaniesService.addEducation(testTenantId, testUserId, {
            name,
          })
        ).rejects.toThrow('já adicionada');
      });

      it('deve rejeitar quando estourar limite (11ª formação)', async () => {
        // Adicionar até o limite (10)
        for (let i = 0; i < 10; i++) {
          try {
            await profileEducationCompaniesService.addEducation(testTenantId, testUserId, {
              name: `Formação ${i} ${uuidv4()}`,
            });
          } catch (error) {
            // Pode falhar se já existir, continuar
          }
        }

        // Tentar adicionar 11ª (deve falhar)
        await expect(
          profileEducationCompaniesService.addEducation(testTenantId, testUserId, {
            name: `Formação 11 ${uuidv4()}`,
          })
        ).rejects.toThrow('Limite');
      });

      it('deve rejeitar nome muito curto', async () => {
        await expect(
          profileEducationCompaniesService.addEducation(testTenantId, testUserId, {
            name: 'A',
          })
        ).rejects.toThrow();
      });
    });

    describe('Autenticação', () => {
      it('deve rejeitar usuário inexistente', async () => {
        const nonExistentUserId = uuidv4();
        await expect(
          profileEducationCompaniesService.addEducation(testTenantId, nonExistentUserId, {
            name: 'Engenharia',
          })
        ).rejects.toThrow('User not found');
      });
    });
  });

  describe('Empresas', () => {
    describe('Empresa válida', () => {
      it('deve adicionar empresa válida com sucesso', async () => {
        const result = await profileEducationCompaniesService.addCompany(testTenantId, testUserId, {
          name: 'Google',
        });

        expect(result).toBeDefined();
        expect(result.globalUserId).toBe(testGlobalUserId);
        expect(result.categoryName).toBeDefined();
        expect(result.categoryId).toBeDefined();
      });

      it('deve adicionar múltiplas empresas válidas', async () => {
        await profileEducationCompaniesService.addCompany(testTenantId, testUserId, {
          name: 'Microsoft',
        });

        await profileEducationCompaniesService.addCompany(testTenantId, testUserId, {
          name: 'Hospital São Lucas',
        });

        const companies = await profileEducationCompaniesService.listCompanies(testGlobalUserId);
        expect(companies.length).toBeGreaterThanOrEqual(3); // Pelo menos as 3 adicionadas
      });
    });

    describe('Validações de negócio', () => {
      it('deve rejeitar termo genérico ("empresa")', async () => {
        await expect(
          profileEducationCompaniesService.addCompany(testTenantId, testUserId, {
            name: 'empresa',
          })
        ).rejects.toThrow();
      });

      it('deve rejeitar termo genérico ("trabalhar")', async () => {
        await expect(
          profileEducationCompaniesService.addCompany(testTenantId, testUserId, {
            name: 'trabalhar',
          })
        ).rejects.toThrow();
      });

      it('deve rejeitar duplicata', async () => {
        const name = `Empresa ${uuidv4()}`;
        
        // Primeira adição
        await profileEducationCompaniesService.addCompany(testTenantId, testUserId, {
          name,
        });

        // Segunda adição (deve falhar)
        await expect(
          profileEducationCompaniesService.addCompany(testTenantId, testUserId, {
            name,
          })
        ).rejects.toThrow('já adicionada');
      });

      it('deve rejeitar quando estourar limite (11ª empresa)', async () => {
        // Adicionar até o limite (10)
        for (let i = 0; i < 10; i++) {
          try {
            await profileEducationCompaniesService.addCompany(testTenantId, testUserId, {
              name: `Empresa ${i} ${uuidv4()}`,
            });
          } catch (error) {
            // Pode falhar se já existir, continuar
          }
        }

        // Tentar adicionar 11ª (deve falhar)
        await expect(
          profileEducationCompaniesService.addCompany(testTenantId, testUserId, {
            name: `Empresa 11 ${uuidv4()}`,
          })
        ).rejects.toThrow('Limite');
      });

      it('deve rejeitar nome muito curto', async () => {
        await expect(
          profileEducationCompaniesService.addCompany(testTenantId, testUserId, {
            name: 'A',
          })
        ).rejects.toThrow();
      });
    });

    describe('Autenticação', () => {
      it('deve rejeitar usuário inexistente', async () => {
        const nonExistentUserId = uuidv4();
        await expect(
          profileEducationCompaniesService.addCompany(testTenantId, nonExistentUserId, {
            name: 'Google',
          })
        ).rejects.toThrow('User not found');
      });
    });
  });

  describe('Listagem', () => {
    it('deve listar formações do usuário', async () => {
      const education = await profileEducationCompaniesService.listEducation(testGlobalUserId);
      expect(Array.isArray(education)).toBe(true);
      education.forEach(edu => {
        expect(edu).toHaveProperty('id');
        expect(edu).toHaveProperty('globalUserId');
        expect(edu).toHaveProperty('categoryId');
        expect(edu).toHaveProperty('categoryName');
      });
    });

    it('deve listar empresas do usuário', async () => {
      const companies = await profileEducationCompaniesService.listCompanies(testGlobalUserId);
      expect(Array.isArray(companies)).toBe(true);
      companies.forEach(company => {
        expect(company).toHaveProperty('id');
        expect(company).toHaveProperty('globalUserId');
        expect(company).toHaveProperty('categoryId');
        expect(company).toHaveProperty('categoryName');
      });
    });
  });
});















