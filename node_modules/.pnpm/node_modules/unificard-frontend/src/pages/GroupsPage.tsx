// src/pages/GroupsPage.tsx
// Página de listagem de grupos

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyGroups, type Group } from '../api/groups';
import { getGroupCategories, type GroupCategory } from '../api/groups';
import './GroupsPage.css';

export function GroupsPage() {
  const navigate = useNavigate();
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<GroupCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Carregar grupos do usuário
      const myGroupsData = await getMyGroups();
      setMyGroups(myGroupsData.groups || []);

      // Carregar categorias para exibir nomes
      const categoriesData = await getGroupCategories();
      setCategories(categoriesData);
    } catch (err) {
      console.error('Erro ao carregar grupos:', err);
      setError('Erro ao carregar grupos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (categoryId?: string): string => {
    if (!categoryId) return 'Sem categoria';
    const category = categories.find(c => c.categoryId === categoryId);
    return category ? `${category.icon || ''} ${category.name}`.trim() : 'Sem categoria';
  };

  const handleAccessGroup = (groupId: string) => {
    navigate(`/grupos/${groupId}`);
  };

  if (loading) {
    return (
      <div className="groups-page">
        <div className="groups-container">
          <div className="groups-loading">
            <p>Carregando grupos...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="groups-page">
        <div className="groups-container">
          <div className="groups-error">
            <p>{error}</p>
            <button onClick={loadGroups} className="groups-retry-button">
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="groups-page">
      <div className="groups-container">
        <div className="groups-header">
          <h1>Grupos</h1>
          <button
            onClick={() => navigate('/grupos/novo')}
            className="groups-create-button"
          >
            + Criar Grupo
          </button>
        </div>

        {/* Seção: Meus Grupos */}
        <section className="groups-section">
          <h2>Meus Grupos</h2>
          {myGroups.length === 0 ? (
            <div className="groups-empty">
              <p>Você ainda não participa de nenhum grupo</p>
              <button
                onClick={() => navigate('/grupos/novo')}
                className="groups-create-button-secondary"
              >
                Criar meu primeiro grupo
              </button>
            </div>
          ) : (
            <div className="groups-grid">
              {myGroups.map((group) => (
                <div key={group.groupId} className="group-card">
                  <div className="group-card-header">
                    {group.avatarUrl ? (
                      <img
                        src={group.avatarUrl}
                        alt={group.name}
                        className="group-card-avatar"
                      />
                    ) : (
                      <div className="group-card-avatar-placeholder">
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="group-card-info">
                      <h3 className="group-card-name">{group.name}</h3>
                      <p className="group-card-category">
                        {getCategoryName(group.categoryId)}
                      </p>
                    </div>
                  </div>
                  
                  {group.description && (
                    <p className="group-card-description">
                      {group.description.length > 100
                        ? `${group.description.substring(0, 100)}...`
                        : group.description}
                    </p>
                  )}

                  <div className="group-card-footer">
                    <span className="group-card-members">
                      👥 {group.memberCount || 0} membro{group.memberCount !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => handleAccessGroup(group.groupId)}
                      className="group-card-access-button"
                    >
                      Acessar grupo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Seção: Descobrir Grupos (placeholder) */}
        <section className="groups-section">
          <h2>Descobrir Grupos</h2>
          <div className="groups-empty">
            <p>Em breve você poderá descobrir novos grupos aqui</p>
          </div>
        </section>
      </div>
    </div>
  );
}


