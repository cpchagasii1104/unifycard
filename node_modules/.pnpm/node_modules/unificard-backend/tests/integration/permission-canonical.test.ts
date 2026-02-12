// backend/tests/integration/permission-canonical.test.ts
// CONTINUOUS PRODUCTION: Sanity Tests para Mapa Canônico de Permissions
// Prova que código e documento estão sincronizados

import { describe, it, expect } from '@jest/globals';
import { getAllPermissionKeys, PERMISSION_CAPABILITIES, isValidPermissionKey, type PermissionKey } from '../../src/core/authorization/permission-keys';
import { requirePermission } from '../../src/core/authorization/require-permission.guard';

/**
 * Permissions definidas no MAPA_CANONICO_PERMISSIONS_v1.md
 * Este array DEVE estar sincronizado com o documento
 */
const MAP_PERMISSIONS: PermissionKey[] = [
  // FEED
  'publish_feed',
  'moderate_feed',
  
  // BANK
  'manage_financial',
  'receive_funds',
  'view_financial',
  
  // EVENTS
  'create_events',
  'manage_events',
  'manage_attendees',
  
  // GROUPS
  'create_groups',
  'manage_groups',
  'manage_members',
  
  // SERVICES
  'offer_services',
  'manage_bookings',
  
  // RIDES
  'request_ride',
  'accept_ride',
  'manage_ride',
  
  // COMPANIES
  'delegate',
  
  // VOTES
  'create_vote',
  'cast_vote',
  
  // INSTITUTIONAL
  'invite_pilot_user',
  
  // MARKETPLACE
  'marketplace_manage_catalog',
  'marketplace_manage_products',
  'marketplace_manage_inventory',
  'marketplace_manage_orders',
  'marketplace_execute_payments',
  'marketplace_manage_splits',
  'marketplace_execute_payouts',
  'marketplace_pdv_sell',
  'marketplace_pdv_manage_customers',
  'marketplace_pdv_view_customers',
  
  // REPORTS
  'view_consolidated_reports',
];

describe('Permission Canonical Map v1.3 - Sanity Tests', () => {
  describe('1. Todas as permissions do enum existem no mapa', () => {
    it('should have all enum permissions in the canonical map', () => {
      const enumPermissions = getAllPermissionKeys();
      
      // Verificar que cada permission do enum está no mapa
      for (const permission of enumPermissions) {
        expect(MAP_PERMISSIONS).toContain(permission);
      }
    });
  });

  describe('2. Nenhuma permission extra existe no enum', () => {
    it('should not have permissions outside the canonical map', () => {
      const enumPermissions = getAllPermissionKeys();
      
      // Verificar que não há permissions extras
      expect(enumPermissions.length).toBe(MAP_PERMISSIONS.length);
      
      // Verificar que todas as permissions do mapa estão no enum
      for (const permission of MAP_PERMISSIONS) {
        expect(enumPermissions).toContain(permission);
      }
    });
  });

  describe('3. Toda permission possui entry em PERMISSION_CAPABILITIES', () => {
    it('should have capability mapping for every permission', () => {
      const enumPermissions = getAllPermissionKeys();
      
      for (const permission of enumPermissions) {
        expect(PERMISSION_CAPABILITIES).toHaveProperty(permission);
        // Valor pode ser string (capability) ou null (ownership suficiente)
        const capability = PERMISSION_CAPABILITIES[permission];
        expect(capability === null || typeof capability === 'string').toBe(true);
      }
    });
  });

  describe('4. requirePermission rejeita permission inexistente', () => {
    it('should throw error for undefined permission', () => {
      expect(() => {
        requirePermission('undefined_permission' as any);
      }).toThrow('not defined in canonical map v1.3');
    });

    it('should throw error for typo in permission', () => {
      expect(() => {
        requirePermission('publish_feeds' as any); // typo: 'feeds' instead of 'feed'
      }).toThrow('not defined in canonical map v1.3');
    });
  });

  describe('5. isValidPermissionKey funciona corretamente', () => {
    it('should return true for valid permissions', () => {
      expect(isValidPermissionKey('publish_feed')).toBe(true);
      expect(isValidPermissionKey('manage_financial')).toBe(true);
      expect(isValidPermissionKey('create_events')).toBe(true);
    });

    it('should return false for invalid permissions', () => {
      expect(isValidPermissionKey('invalid_permission')).toBe(false);
      expect(isValidPermissionKey('publish_feeds')).toBe(false);
      expect(isValidPermissionKey('')).toBe(false);
    });
  });

  describe('6. PERMISSION_CAPABILITIES mapeia corretamente', () => {
    it('should map publish_feed to can_publish_feed', () => {
      expect(PERMISSION_CAPABILITIES.publish_feed).toBe('can_publish_feed');
    });

    it('should map manage_financial to can_hold_assets', () => {
      expect(PERMISSION_CAPABILITIES.manage_financial).toBe('can_hold_assets');
    });

    it('should map view_financial to null (ownership suficiente)', () => {
      expect(PERMISSION_CAPABILITIES.view_financial).toBeNull();
    });

    it('should map manage_members to can_delegate', () => {
      expect(PERMISSION_CAPABILITIES.manage_members).toBe('can_delegate');
    });

    it('should map delegate to can_delegate', () => {
      expect(PERMISSION_CAPABILITIES.delegate).toBe('can_delegate');
    });
  });

  describe('7. Total de permissions está correto', () => {
    it('should have exactly 32 permissions (v1.3)', () => {
      const enumPermissions = getAllPermissionKeys();
      expect(enumPermissions.length).toBe(32);
      expect(MAP_PERMISSIONS.length).toBe(32);
    });
  });

  describe('8. Distribuição por domínio está correta', () => {
    it('should have correct distribution', () => {
      const feed = ['publish_feed', 'moderate_feed'];
      const bank = ['manage_financial', 'receive_funds', 'view_financial'];
      const events = ['create_events', 'manage_events', 'manage_attendees'];
      const groups = ['create_groups', 'manage_groups', 'manage_members'];
      const services = ['offer_services', 'manage_bookings'];
      const rides = ['request_ride', 'accept_ride', 'manage_ride'];
      const companies = ['delegate']; // manage_members está em groups, mas também aplica a companies
      const votes = ['create_vote', 'cast_vote'];

      // Nota: manage_members é a mesma permission usada em groups e companies
      // O mapa lista ela em ambos os domínios, mas é a mesma permission
      const all = [...feed, ...bank, ...events, ...groups, ...services, ...rides, ...companies, ...votes];
      
      // Verificar total único (manage_members não deve ser contado duas vezes)
      const unique = new Set(all);
      expect(unique.size).toBe(20); // Total único de permissions
      
      expect(feed.length).toBe(2);
      expect(bank.length).toBe(3);
      expect(events.length).toBe(3);
      expect(groups.length).toBe(3);
      expect(services.length).toBe(2);
      expect(rides.length).toBe(3);
      expect(companies.length).toBe(1); // delegate (manage_members é compartilhada)
      expect(votes.length).toBe(2);
    });
  });

  describe('9. Capabilities válidas no mapa', () => {
    it('should only use capabilities from canonical map', () => {
      const validCapabilities = [
        'can_publish_feed',
        'can_receive_funds',
        'can_hold_assets',
        'can_delegate',
        'can_moderate_content',
      ];

      const allCapabilities = Object.values(PERMISSION_CAPABILITIES)
        .filter((cap): cap is string => cap !== null);

      for (const capability of allCapabilities) {
        expect(validCapabilities).toContain(capability);
      }
    });
  });
});




