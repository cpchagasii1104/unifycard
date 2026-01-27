// backend/src/modules/work/skills/skill.service.ts
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
import type {
  SkillRow,
  Skill,
  CreateSkillInput,
  UpdateSkillInput,
} from '../work.types';

class SkillService {
  private toSkill(row: SkillRow): Skill {
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

  async createSkill(
    tenantId: string,
    input: CreateSkillInput,
  ): Promise<Skill> {
    const row = await runQueryWithTenant<SkillRow>(
      tenantId,
      `
      INSERT INTO skills (tenant_id, name, category, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [tenantId, input.name, input.category, input.description ?? null],
    );

    if (!row) {
      throw new Error('Failed to create skill');
    }

    const skill = this.toSkill(row);

    await eventBus.publish({
      tenantId,
      type: 'work.skill.created',
      payload: { skillId: skill.skillId },
    });

    return skill;
  }

  async updateSkill(
    tenantId: string,
    skillId: string,
    input: UpdateSkillInput,
  ): Promise<Skill> {
    const row = await runQueryWithTenant<SkillRow>(
      tenantId,
      `
      UPDATE skills
      SET
        name = COALESCE($3, name),
        category = COALESCE($4, category),
        description = COALESCE($5, description),
        updated_at = now()
      WHERE tenant_id = $1 AND skill_id = $2
      RETURNING *
      `,
      [
        tenantId,
        skillId,
        input.name ?? null,
        input.category ?? null,
        input.description ?? null,
      ],
    );

    if (!row) {
      const err = new Error('Skill not found');
      (err as any).statusCode = 404;
      throw err;
    }

    await eventBus.publish({
      tenantId,
      type: 'work.skill.updated',
      payload: { skillId },
    });

    return this.toSkill(row);
  }

  async deleteSkill(
    tenantId: string,
    skillId: string,
  ): Promise<void> {
    const row = await runQueryWithTenant(
      tenantId,
      `
      DELETE FROM skills
      WHERE tenant_id = $1 AND skill_id = $2
      RETURNING skill_id
      `,
      [tenantId, skillId],
    );

    if (!row) {
      const err = new Error('Skill not found');
      (err as any).statusCode = 404;
      throw err;
    }

    await eventBus.publish({
      tenantId,
      type: 'work.skill.deleted',
      payload: { skillId },
    });
  }

  async getById(
    tenantId: string,
    skillId: string,
  ): Promise<Skill | null> {
    const row = await runQueryWithTenant<SkillRow>(
      tenantId,
      `
      SELECT * FROM skills
      WHERE tenant_id = $1 AND skill_id = $2
      `,
      [tenantId, skillId],
    );

    return row ? this.toSkill(row) : null;
  }

  async listSkills(
    tenantId: string,
    filters: { category?: string; search?: string; limit?: number; offset?: number } = {},
  ): Promise<{ skills: Skill[]; total: number }> {
    const { category, search, limit = 50, offset = 0 } = filters;
    const params: any[] = [tenantId];
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

    const rows = await runQueriesWithTenant<SkillRow>(
      tenantId,
      `
      SELECT * FROM skills
      WHERE ${whereSQL}
      ORDER BY name ASC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `,
      [...params, limit, offset],
    );

    const count = await runQueryWithTenant<{ total: string }>(
      tenantId,
      `
      SELECT COUNT(*) AS total
      FROM skills
      WHERE ${whereSQL}
      `,
      params,
    );

    return {
      skills: rows.map(row => this.toSkill(row)),
      total: count ? Number(count.total) : 0,
    };
  }
}

export const skillService = new SkillService();
