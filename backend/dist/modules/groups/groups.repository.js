"use strict";
// src/modules/groups/groups.repository.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupsRepository = void 0;
const pool_1 = require("@core/database/pool");
class GroupsRepository {
    toGroup(row) {
        return {
            groupId: row.group_id,
            tenantId: row.tenant_id,
            name: row.name,
            description: row.description || undefined,
            ownerUserId: row.owner_user_id,
            isActive: row.is_active,
            profitPercentage: row.profit_percentage ? parseFloat(row.profit_percentage.toString()) : 0,
            metadata: row.metadata || {},
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    toGroupMember(row) {
        return {
            groupId: row.group_id,
            userId: row.user_id,
            role: row.role,
            joinedAt: row.joined_at,
        };
    }
    async create(tenantId, ownerUserId, input) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO groups (tenant_id, name, description, owner_user_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING group_id, tenant_id, name, description, owner_user_id, is_active, profit_percentage, metadata, created_at, updated_at
      `, [tenantId, input.name, input.description || null, ownerUserId, JSON.stringify(input.metadata || {})]);
        if (!row) {
            throw new Error('Failed to create group');
        }
        // Adicionar owner como membro
        await this.addMember(tenantId, row.group_id, ownerUserId, 'owner');
        return this.toGroup(row);
    }
    async findById(tenantId, groupId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT group_id, tenant_id, name, description, owner_user_id, is_active, profit_percentage, metadata, created_at, updated_at
      FROM groups
      WHERE group_id = $1 AND tenant_id = $2
      `, [groupId, tenantId]);
        return row ? this.toGroup(row) : null;
    }
    async findAll(tenantId, filters) {
        let query = `
      SELECT group_id, tenant_id, name, description, owner_user_id, is_active, profit_percentage, metadata, created_at, updated_at
      FROM groups
      WHERE tenant_id = $1
    `;
        const params = [tenantId];
        if (filters?.isActive !== undefined) {
            query += ` AND is_active = $2`;
            params.push(filters.isActive);
        }
        query += ` ORDER BY created_at DESC`;
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, query, params);
        return rows.map((r) => this.toGroup(r));
    }
    async update(tenantId, groupId, input) {
        const updates = [];
        const params = [tenantId, groupId];
        let paramIndex = 3;
        if (input.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            params.push(input.name);
        }
        if (input.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            params.push(input.description || null);
        }
        if (input.isActive !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            params.push(input.isActive);
        }
        if (input.metadata !== undefined) {
            updates.push(`metadata = $${paramIndex++}`);
            params.push(JSON.stringify(input.metadata));
        }
        if (input.profit_percentage !== undefined) {
            updates.push(`profit_percentage = $${paramIndex++}`);
            params.push(input.profit_percentage);
        }
        if (updates.length === 0) {
            const existing = await this.findById(tenantId, groupId);
            if (!existing) {
                throw new Error('Group not found');
            }
            return existing;
        }
        updates.push(`updated_at = now()`);
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE groups
      SET ${updates.join(', ')}
      WHERE tenant_id = $1 AND group_id = $2
      RETURNING group_id, tenant_id, name, description, owner_user_id, is_active, profit_percentage, metadata, created_at, updated_at
      `, params);
        if (!row) {
            throw new Error('Group not found');
        }
        return this.toGroup(row);
    }
    async delete(tenantId, groupId) {
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE groups
      SET is_active = false, updated_at = now()
      WHERE tenant_id = $1 AND group_id = $2
      RETURNING group_id
      `, [tenantId, groupId]);
        return !!result;
    }
    // =========================================================
    // MEMBERS
    // =========================================================
    async addMember(tenantId, groupId, userId, role = 'member') {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO group_members (group_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role
      RETURNING group_id, user_id, role, joined_at
      `, [groupId, userId, role]);
        if (!row) {
            throw new Error('Failed to add member');
        }
        return this.toGroupMember(row);
    }
    async removeMember(tenantId, groupId, userId) {
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `
      DELETE FROM group_members
      WHERE group_id = $1 AND user_id = $2
      RETURNING group_id
      `, [groupId, userId]);
        return !!result;
    }
    async getMembers(tenantId, groupId) {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT gm.group_id, gm.user_id, gm.role, gm.joined_at
      FROM group_members gm
      INNER JOIN groups g ON g.group_id = gm.group_id
      WHERE gm.group_id = $1 AND g.tenant_id = $2
      ORDER BY gm.joined_at ASC
      `, [groupId, tenantId]);
        return rows.map((r) => this.toGroupMember(r));
    }
    async getUserGroups(tenantId, userId) {
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT g.group_id, g.tenant_id, g.name, g.description, g.owner_user_id, g.is_active, g.profit_percentage, g.metadata, g.created_at, g.updated_at
      FROM groups g
      INNER JOIN group_members gm ON g.group_id = gm.group_id
      WHERE g.tenant_id = $1 AND gm.user_id = $2 AND g.is_active = true
      ORDER BY gm.joined_at DESC
      `, [tenantId, userId]);
        return rows.map((r) => this.toGroup(r));
    }
    async getUserGroupCount(tenantId, userId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT COUNT(*) as count
      FROM group_members gm
      INNER JOIN groups g ON g.group_id = gm.group_id
      WHERE g.tenant_id = $1 AND gm.user_id = $2 AND g.is_active = true
      `, [tenantId, userId]);
        return row ? Number(row.count) : 0;
    }
    // =========================================================
    // ACCOUNTS
    // =========================================================
    async linkAccount(tenantId, groupId, accountId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO group_accounts (group_id, account_id)
      VALUES ($1, $2)
      ON CONFLICT (group_id, account_id) DO NOTHING
      RETURNING group_id, account_id, created_at
      `, [groupId, accountId]);
        if (!row) {
            // Já existe, buscar
            const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT group_id, account_id, created_at
        FROM group_accounts
        WHERE group_id = $1 AND account_id = $2
        `, [groupId, accountId]);
            if (existing) {
                return {
                    groupId: existing.group_id,
                    accountId: existing.account_id,
                    createdAt: existing.created_at,
                };
            }
            throw new Error('Failed to link account');
        }
        return {
            groupId: row.group_id,
            accountId: row.account_id,
            createdAt: row.created_at,
        };
    }
    async getGroupAccount(tenantId, groupId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT ga.group_id, ga.account_id, ga.created_at
      FROM group_accounts ga
      INNER JOIN groups g ON g.group_id = ga.group_id
      WHERE ga.group_id = $1 AND g.tenant_id = $2
      LIMIT 1
      `, [groupId, tenantId]);
        return row
            ? {
                groupId: row.group_id,
                accountId: row.account_id,
                createdAt: row.created_at,
            }
            : null;
    }
}
exports.groupsRepository = new GroupsRepository();
//# sourceMappingURL=groups.repository.js.map