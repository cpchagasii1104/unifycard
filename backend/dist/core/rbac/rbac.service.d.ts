import type { Role, Permission, UserRole, RoleWithPermissions, UserWithRoles, PermissionString, PermissionCheck } from './rbac.types';
declare class RBACService {
    private toRole;
    private toPermission;
    /**
     * Verifica se um usuário tem uma permission específica
     */
    userHasPermission(tenantId: string, userId: string, permission: PermissionString): Promise<PermissionCheck>;
    /**
     * Verifica se usuário tem QUALQUER uma das permissions listadas
     */
    userHasAnyPermission(tenantId: string, userId: string, permissions: PermissionString[]): Promise<PermissionCheck>;
    /**
     * Verifica se usuário tem TODAS as permissions listadas
     */
    userHasAllPermissions(tenantId: string, userId: string, permissions: PermissionString[]): Promise<PermissionCheck>;
    /**
     * Busca todas as permissions de um usuário
     */
    getUserPermissions(tenantId: string, userId: string): Promise<Permission[]>;
    /**
     * Busca todas as roles de um usuário
     */
    getUserRoles(tenantId: string, userId: string): Promise<Role[]>;
    /**
     * Busca user com suas roles e permissions
     */
    getUserWithRoles(tenantId: string, userId: string): Promise<UserWithRoles>;
    /**
     * Verifica se usuário tem uma role específica
     */
    userHasRole(tenantId: string, userId: string, roleName: string): Promise<boolean>;
    /**
     * Verifica se usuário tem QUALQUER uma das roles listadas
     */
    userHasAnyRole(tenantId: string, userId: string, roleNames: string[]): Promise<boolean>;
    /**
     * Atribui uma role a um usuário
     */
    assignRoleToUser(tenantId: string, userId: string, roleId: string, assignedBy?: string): Promise<UserRole>;
    /**
     * Atribui uma role a um usuário (por nome da role)
     */
    assignRoleByName(tenantId: string, userId: string, roleName: string, assignedBy?: string): Promise<UserRole>;
    /**
     * Remove uma role de um usuário
     */
    removeRoleFromUser(tenantId: string, userId: string, roleId: string): Promise<void>;
    /**
     * Remove uma role de um usuário (por nome da role)
     */
    removeRoleByName(tenantId: string, userId: string, roleName: string): Promise<void>;
    /**
     * Busca role por ID
     */
    getRoleById(tenantId: string, roleId: string): Promise<Role | null>;
    /**
     * Busca role por nome
     */
    getRoleByName(tenantId: string, name: string): Promise<Role | null>;
    /**
     * Lista todas as roles
     */
    listRoles(tenantId: string): Promise<Role[]>;
    /**
     * Busca role com suas permissions
     */
    getRoleWithPermissions(tenantId: string, roleId: string): Promise<RoleWithPermissions | null>;
    /**
     * Inicializa RBAC padrão para um tenant
     * Cria roles e permissions padrão
     */
    seedDefaultRBAC(tenantId: string): Promise<void>;
}
export declare const rbacService: RBACService;
export {};
//# sourceMappingURL=rbac.service.d.ts.map