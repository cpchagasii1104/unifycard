import type { Role, CreateRoleInput, UpdateRoleInput } from './rbac.types';
declare class RoleService {
    private toRole;
    /**
     * Cria uma nova role
     */
    createRole(tenantId: string, input: CreateRoleInput): Promise<Role>;
    /**
     * Busca role por ID
     */
    getRoleById(tenantId: string, roleId: string): Promise<Role | null>;
    /**
     * Lista todas as roles
     */
    listRoles(tenantId: string): Promise<Role[]>;
    /**
     * Atualiza uma role
     */
    updateRole(tenantId: string, roleId: string, input: UpdateRoleInput): Promise<Role>;
    /**
     * Deleta uma role
     */
    deleteRole(tenantId: string, roleId: string): Promise<void>;
}
export declare const roleService: RoleService;
export {};
//# sourceMappingURL=role.service.d.ts.map