// backend/src/modules/social/social-relationships.service.ts
// Sistema de Segmentação Social e Targeting de Compartilhamento
// Relacionamentos unilaterais para controle de visibilidade

export interface UserRelationship {
  relationship_id: string;
  user_id: string;
  target_user_id: string;
  category: 'business' | 'friend' | 'family' | 'entertainment';
  createdAt: string;
}

export interface CreateRelationshipInput {
  target_user_id: string;
  category: 'business' | 'friend' | 'family' | 'entertainment';
}

export class SocialRelationshipsService {
  // Armazenamento in-memory (futuro: migrar para banco)
  private relationships: Map<string, UserRelationship> = new Map();

  /**
   * Criar ou atualizar relacionamento unilateral
   * Relação é unilateral: A classifica B
   */
  createRelationship(userId: string, input: CreateRelationshipInput): UserRelationship {
    const relationshipId = `relationship-${userId}-${input.target_user_id}-${Date.now()}`;
    
    // Verificar se já existe relacionamento
    const existing = Array.from(this.relationships.values()).find(
      r => r.user_id === userId && r.target_user_id === input.target_user_id
    );

    if (existing) {
      // Atualizar categoria existente
      existing.category = input.category;
      this.relationships.set(existing.relationship_id, existing);
      return existing;
    }

    const relationship: UserRelationship = {
      relationship_id: relationshipId,
      user_id: userId,
      target_user_id: input.target_user_id,
      category: input.category,
      createdAt: new Date().toISOString(),
    };

    this.relationships.set(relationshipId, relationship);
    return relationship;
  }

  /**
   * Buscar relacionamentos de um usuário
   */
  getRelationships(userId: string, category?: 'business' | 'friend' | 'family' | 'entertainment'): UserRelationship[] {
    let relationships = Array.from(this.relationships.values()).filter(
      r => r.user_id === userId
    );

    if (category) {
      relationships = relationships.filter(r => r.category === category);
    }

    return relationships;
  }

  /**
   * Buscar relacionamentos onde o usuário é o target
   */
  getRelationshipsWhereTarget(userId: string): UserRelationship[] {
    return Array.from(this.relationships.values()).filter(
      r => r.target_user_id === userId
    );
  }

  /**
   * Verificar se usuário A tem relacionamento com usuário B em uma categoria específica
   */
  hasRelationship(userId: string, targetUserId: string, category?: 'business' | 'friend' | 'family' | 'entertainment'): boolean {
    const relationship = Array.from(this.relationships.values()).find(
      r => r.user_id === userId && r.target_user_id === targetUserId
    );

    if (!relationship) return false;
    if (category) return relationship.category === category;
    return true;
  }

  /**
   * Remover relacionamento
   */
  deleteRelationship(userId: string, targetUserId: string): boolean {
    const relationship = Array.from(this.relationships.values()).find(
      r => r.user_id === userId && r.target_user_id === targetUserId
    );

    if (relationship) {
      this.relationships.delete(relationship.relationship_id);
      return true;
    }

    return false;
  }
}

export const socialRelationshipsService = new SocialRelationshipsService();






