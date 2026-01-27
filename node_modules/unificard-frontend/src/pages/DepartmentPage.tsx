// frontend/src/pages/DepartmentPage.tsx
// Department Page - Seleção de Branch (Products/Services)

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getCategoryById,
  getDepartmentBranches,
  getCategoryChildren,
  type MarketplaceCategory,
} from '../api/marketplace-categories';
import { showToast } from '../utils/toast';
import './DepartmentPage.css';

export default function DepartmentPage() {
  const { departmentId } = useParams<{ departmentId: string }>();
  const navigate = useNavigate();
  const [department, setDepartment] = useState<MarketplaceCategory | null>(null);
  const [branches, setBranches] = useState<MarketplaceCategory[]>([]);
  const [legacyCategories, setLegacyCategories] = useState<MarketplaceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLegacyMode, setIsLegacyMode] = useState(false);

  useEffect(() => {
    if (!departmentId) {
      navigate('/marketplace');
      return;
    }

    const loadDepartmentData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const departmentData = await getCategoryById(departmentId);
        setDepartment(departmentData);

        // REGRA: getCategoryChildren retorna todos os filhos ordenados (branches primeiro)
        const childrenData = await getCategoryChildren(departmentId);
        
        // Separar branches de categories
        const branchesData = childrenData.filter(
          (c) => c.metadata?.taxonomy === 'branch'
        );
        const categoriesData = childrenData.filter(
          (c) => c.metadata?.taxonomy !== 'branch'
        );

        if (branchesData.length > 0) {
          // Tem branches: mostrar selector
          setBranches(branchesData);
          setIsLegacyMode(false);
        } else {
          // Sem branches: mostrar categories direto
          setLegacyCategories(categoriesData);
          setIsLegacyMode(true);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar departamento');
        showToast('Erro ao carregar departamento', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadDepartmentData();
  }, [departmentId, navigate]);

  const handleBranchClick = (branch: MarketplaceCategory) => {
    const path = branch.path.join('/');
    navigate(`/marketplace/c/${path}`);
  };

  const handleLegacyCategoryClick = (category: MarketplaceCategory) => {
    const path = category.path.join('/');
    navigate(`/marketplace/c/${path}`);
  };

  if (isLoading) {
    return (
      <div className="department-page">
        <div className="page-loading">Carregando...</div>
      </div>
    );
  }

  if (error || !department) {
    return (
      <div className="department-page">
        <div className="page-error">{error || 'Departamento não encontrado'}</div>
        <Link to="/marketplace" className="back-link">
          ← Voltar ao Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="department-page">
      <div className="department-header">
        <Link to="/marketplace" className="back-link">
          ← Voltar ao Marketplace
        </Link>
        <div className="department-title-section">
          {department.icon && (
            <span className="department-icon">{department.icon}</span>
          )}
          <div>
            <h1 className="department-title">{department.name}</h1>
            {department.description && (
              <p className="department-description">{department.description}</p>
            )}
          </div>
        </div>
      </div>

      {isLegacyMode ? (
        <div className="categories-section">
          <h2 className="section-title">Categorias</h2>
          {legacyCategories.length === 0 ? (
            <div className="empty-state">
              <p>Nenhuma categoria disponível no momento</p>
            </div>
          ) : (
            <div className="categories-grid">
              {legacyCategories.map((category) => (
                <div
                  key={category.id}
                  className="category-card"
                  onClick={() => handleLegacyCategoryClick(category)}
                >
                  <div className="category-icon">
                    {category.icon ? (
                      <span className="icon-emoji">{category.icon}</span>
                    ) : (
                      <span className="icon-placeholder">📦</span>
                    )}
                  </div>
                  <div className="category-content">
                    <h3 className="category-name">{category.name}</h3>
                    {category.description && (
                      <p className="category-description">{category.description}</p>
                    )}
                  </div>
                  <div className="category-action">
                    <span className="explore-link">Explorar</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="branches-section">
          <h2 className="section-title">Escolha o que você procura</h2>
          {branches.length === 0 ? (
            <div className="empty-state">
              <p>Nenhuma opção disponível no momento</p>
            </div>
          ) : (
            <div className="branches-grid">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className="branch-card"
                  onClick={() => handleBranchClick(branch)}
                >
                  <div className="branch-icon">
                    {branch.metadata?.branch_type === 'products' ? '📦' : '🔧'}
                  </div>
                  <div className="branch-content">
                    <h3 className="branch-name">{branch.name}</h3>
                    {branch.description && (
                      <p className="branch-description">{branch.description}</p>
                    )}
                  </div>
                  <div className="branch-action">
                    <span className="explore-link">Explorar →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

