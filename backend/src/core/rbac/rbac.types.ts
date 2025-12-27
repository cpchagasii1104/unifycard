// backend/src/core/rbac/rbac.types.ts

/**
 * Role representa um papel no sistema (admin, user, merchant, etc.)
 */
export interface Role {
  roleId: string;
  tenantId: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Permission representa uma permissão no formato resource:action
 */
export interface Permission {
  permissionId: string;
  tenantId: string;
  resource: string;
  action: string;
  description: string | null;
  isSystemPermission: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UserRole representa a associação de um usuário com uma role
 */
export interface UserRole {
  userRoleId: string;
  tenantId: string;
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy: string | null;
}

/**
 * RolePermission representa a associação de uma role com uma permission
 */
export interface RolePermission {
  rolePermissionId: string;
  tenantId: string;
  roleId: string;
  permissionId: string;
  grantedAt: Date;
  grantedBy: string | null;
}

/**
 * Input para criar uma role
 */
export interface CreateRoleInput {
  name: string;
  description?: string;
}

/**
 * Input para atualizar uma role
 */
export interface UpdateRoleInput {
  name?: string;
  description?: string;
}

/**
 * Input para criar uma permission
 */
export interface CreatePermissionInput {
  resource: string;
  action: string;
  description?: string;
}

/**
 * Input para atribuir role a um usuário
 */
export interface AssignRoleInput {
  userId: string;
  roleId: string;
}

/**
 * Input para atribuir permission a uma role
 */
export interface GrantPermissionInput {
  roleId: string;
  permissionId: string;
}

/**
 * Role com suas permissions carregadas
 */
export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

/**
 * User com suas roles e permissions carregadas
 */
export interface UserWithRoles {
  userId: string;
  roles: Role[];
  permissions: Permission[];
}

/**
 * Formato simplificado de permission (resource:action)
 */
export type PermissionString = `${string}:${string}`;

/**
 * Resultado de verificação de permission
 */
export interface PermissionCheck {
  hasPermission: boolean;
  userId: string;
  permission: PermissionString;
  reason?: string;
}