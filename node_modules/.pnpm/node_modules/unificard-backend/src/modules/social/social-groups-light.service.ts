// backend/src/modules/social/social-groups-light.service.ts
// Grupos sociais leves para targeting de compartilhamento
// Separado do sistema de grupos principal para simplicidade

export interface SocialGroup {
  group_id: string;
  owner_id: string;
  name: string;
  member_ids: string[];
  purpose: 'business' | 'friends' | 'mixed';
  createdAt: string;
}

export interface CreateSocialGroupInput {
  name: string;
  member_ids?: string[];
  purpose: 'business' | 'friends' | 'mixed';
}

export class SocialGroupsLightService {
  // Armazenamento in-memory (futuro: migrar para banco)
  private groups: Map<string, SocialGroup> = new Map();

  /**
   * Criar grupo social leve
   */
  createGroup(ownerId: string, input: CreateSocialGroupInput): SocialGroup {
    const groupId = `social-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const group: SocialGroup = {
      group_id: groupId,
      owner_id: ownerId,
      name: input.name,
      member_ids: input.member_ids || [],
      purpose: input.purpose,
      createdAt: new Date().toISOString(),
    };

    this.groups.set(groupId, group);
    return group;
  }

  /**
   * Buscar grupos de um usuário (como owner ou member)
   */
  getGroups(userId: string, purpose?: 'business' | 'friends' | 'mixed'): SocialGroup[] {
    let groups = Array.from(this.groups.values()).filter(
      g => g.owner_id === userId || g.member_ids.includes(userId)
    );

    if (purpose) {
      groups = groups.filter(g => g.purpose === purpose);
    }

    return groups;
  }

  /**
   * Buscar grupo por ID
   */
  getGroup(groupId: string): SocialGroup | null {
    return this.groups.get(groupId) || null;
  }

  /**
   * Adicionar membro ao grupo
   */
  addMember(groupId: string, userId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    if (!group.member_ids.includes(userId)) {
      group.member_ids.push(userId);
      this.groups.set(groupId, group);
    }

    return true;
  }

  /**
   * Remover membro do grupo
   */
  removeMember(groupId: string, userId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    group.member_ids = group.member_ids.filter(id => id !== userId);
    this.groups.set(groupId, group);
    return true;
  }

  /**
   * Verificar se usuário é membro do grupo
   */
  isMember(groupId: string, userId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    return group.owner_id === userId || group.member_ids.includes(userId);
  }
}

export const socialGroupsLightService = new SocialGroupsLightService();






