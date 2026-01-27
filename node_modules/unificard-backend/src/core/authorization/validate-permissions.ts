// backend/src/core/authorization/validate-permissions.ts
// Validação de permissões no bootstrap
// Fail fast se permissões usadas não existem no mapa canônico

import { getAllPermissionKeys, PERMISSION_CAPABILITIES, type PermissionKey } from './permission-keys';

/**
 * Valida que todas as permissões usadas no código existem no mapa canônico
 * 
 * @throws Error se alguma permissão não existir
 */
export function validateCanonicalPermissions(): void {
  const canonicalVersion = 'v1.3';
  const allPermissions = getAllPermissionKeys();
  
  // Validar que PERMISSION_CAPABILITIES tem todas as permissões
  for (const permission of allPermissions) {
    if (!(permission in PERMISSION_CAPABILITIES)) {
      throw new Error(
        `[BOOT] ❌ ERRO FATAL: Permission "${permission}" existe no enum mas não está em PERMISSION_CAPABILITIES. ` +
        `Sincronize permission-keys.ts com MAPA_CANONICO_PERMISSIONS_v1.md (${canonicalVersion})`
      );
    }
  }
  
  // Validar que PERMISSION_CAPABILITIES não tem permissões extras
  const capabilitiesKeys = Object.keys(PERMISSION_CAPABILITIES) as PermissionKey[];
  for (const capabilityKey of capabilitiesKeys) {
    if (!allPermissions.includes(capabilityKey)) {
      throw new Error(
        `[BOOT] ❌ ERRO FATAL: PERMISSION_CAPABILITIES contém "${capabilityKey}" que não está no enum PermissionKey. ` +
        `Sincronize permission-keys.ts com MAPA_CANONICO_PERMISSIONS_v1.md (${canonicalVersion})`
      );
    }
  }
  
  console.log(`[BOOT] ✅ Validação de permissões canônicas: OK (${canonicalVersion}, ${allPermissions.length} permissions)`);
}





