"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillService = void 0;
// backend/src/modules/work/skills/skill.service.ts
const pool_1 = require("@core/database/pool");
const event_bus_1 = require("@core/events/event-bus");
class SkillService {
    toSkill(row) {
        return {
            skillId: row.skill_id,
            tenantId: row.tenant_id,
            name: row.name,
            category: row.category,
            description: row.description ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    async createSkill(tenantId, input) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO skills (tenant_id, name, category, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `, [tenantId, input.name, input.category, input.description ?? null]);
        if (!row) {
            throw new Error('Failed to create skill');
        }
        const skill = this.toSkill(row);
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'work.skill.created',
            payload: { skillId: skill.skillId },
        });
        return skill;
    }
    async updateSkill(tenantId, skillId, input) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE skills
      SET
        name = COALESCE($3, name),
        category = COALESCE($4, category),
        description = COALESCE($5, description),
        updated_at = now()
      WHERE tenant_id = $1 AND skill_id = $2
      RETURNING *
      `, [
            tenantId,
            skillId,
            input.name ?? null,
            input.category ?? null,
            input.description ?? null,
        ]);
        if (!row) {
            const err = new Error('Skill not found');
            err.statusCode = 404;
            throw err;
        }
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'work.skill.updated',
            payload: { skillId },
        });
        return this.toSkill(row);
    }
    async deleteSkill(tenantId, skillId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      DELETE FROM skills
      WHERE tenant_id = $1 AND skill_id = $2
      RETURNING skill_id
      `, [tenantId, skillId]);
        if (!row) {
            const err = new Error('Skill not found');
            err.statusCode = 404;
            throw err;
        }
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'work.skill.deleted',
            payload: { skillId },
        });
    }
    async getById(tenantId, skillId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT * FROM skills
      WHERE tenant_id = $1 AND skill_id = $2
      `, [tenantId, skillId]);
        return row ? this.toSkill(row) : null;
    }
    async listSkills(tenantId, filters = {}) {
        const { category, search, limit = 50, offset = 0 } = filters;
        const params = [tenantId];
        let paramIdx = 2;
        const whereClauses = [`tenant_id = $1`];
        if (category) {
            whereClauses.push(`category = $${paramIdx}`);
            params.push(category);
            paramIdx++;
        }
        if (search) {
            whereClauses.push(`name ILIKE $${paramIdx}`);
            params.push(`%${search}%`);
            paramIdx++;
        }
        const whereSQL = whereClauses.join(' AND ');
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT * FROM skills
      WHERE ${whereSQL}
      ORDER BY name ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `, [...params, limit, offset]);
        const count = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT COUNT(*) AS total
      FROM skills
      WHERE ${whereSQL}
      `, params);
        return {
            skills: rows.map(row => this.toSkill(row)),
            total: count ? Number(count.total) : 0,
        };
    }
}
exports.skillService = new SkillService();
//# sourceMappingURL=skill.service.js.map