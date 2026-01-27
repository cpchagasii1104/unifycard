// frontend/src/pages/CategoryNavigationPage.tsx
// Category Navigation - Navegação hierárquica de categorias
// 🔴 BLINDAGEM: Frontend apenas consome API, não calcula hierarquia

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getCategoryByPath,
  getCategoryChildren,
  getCategoryBreadcrumb,
  type MarketplaceCategory,
  type BreadcrumbItem,
} from '../api/marketplace-categories';
import {
  searchMarketplace,
  type MarketplaceSearchResult,
  type MarketplaceSearchFilters,
} from '../api/marketplace-search';
import SearchFiltersPanel from '../components/marketplace/SearchFiltersPanel';
import { showToast } from '../utils/toast';
import './CategoryNavigationPage.css';

export default function CategoryNavigationPage() {
  const { path: pathParam } = useParams<{ path: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<MarketplaceCategory | null>(null);
  const [children, setChildren] = useState<MarketplaceCategory[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [searchResults, setSearchResults] = useState<MarketplaceSearchResult[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros de busca
  const [filters, setFilters] = useState<MarketplaceSearchFilters>({
    categoryPath: [],
  });

  useEffect(() => {
    const path = pathParam ? pathParam.split('/').filter((p) => p) : [];

    if (path.length === 0) {
      navigate('/marketplace');
      return;
    }

    const loadCategoryData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const categoryData = await getCategoryByPath(path);
        setCategory(categoryData);

        const breadcrumbData = await getCategoryBreadcrumb(categoryData.id);
        setBreadcrumb(breadcrumbData);

        // Tentar carregar children com fallback automático
        let childrenData: MarketplaceCategory[] = [];
        try {
          childrenData = await getCategoryChildren(categoryData.id);
        } catch (err) {
          // Se falhar, tentar novamente (pode ser branch sem categories ainda)
          try {
            childrenData = await getCategoryChildren(categoryData.id);
          } catch (fallbackErr) {
            // Se ainda falhar, deixar vazio (será tratado no render)
            childrenData = [];
          }
        }
        setChildren(childrenData);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar categoria');
        showToast('Erro ao carregar categoria', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadCategoryData();
  }, [pathParam, navigate]);

  const handleSubcategoryClick = (subcategory: MarketplaceCategory) => {
    // Navegar para subcategoria usando path completo
    const newPath = subcategory.path.join('/');
    navigate(`/marketplace/c/${newPath}`);
  };

  const handleBreadcrumbClick = (item: BreadcrumbItem) => {
    // Navegar para categoria do breadcrumb
    navigate(`/marketplace/c${item.path}`);
  };

  const loadSearchResults = async () => {
    if (!category || !pathParam) return;

    // Parse path from URL
    const path = pathParam.split('/').filter((p) => p);
    if (path.length === 0) return;

    setIsSearchLoading(true);
    try {
      const response = await searchMarketplace({
        ...filters,
        categoryPath: path,
      });
      setSearchResults(response.results);
      setSearchTotal(response.total);
    } catch (err: any) {
      console.error('Erro ao buscar serviços:', err);
      showToast('Erro ao buscar serviços', 'error');
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleFilterChange = (newFilters: Partial<MarketplaceSearchFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  };

  const applyFilters = () => {
    loadSearchResults();
  };


  if (isLoading) {
    return (
      <div className="category-navigation-page">
        <div className="page-loading">Carregando categoria...</div>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="category-navigation-page">
        <div className="page-error">{error || 'Categoria não encontrada'}</div>
        <Link to="/marketplace" className="back-link">
          ← Voltar ao Marketplace
        </Link>
      </div>
    );
  }

  const isLeafCategory = children.length === 0;

  return (
    <div className="category-navigation-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav">
        <Link to="/marketplace" className="breadcrumb-item">
          Marketplace
        </Link>
        {breadcrumb.map((item, index) => (
          <span key={item.categoryId} className="breadcrumb-separator">
            /
          </span>
        ))}
        {breadcrumb.map((item, index) => {
          const isLast = index === breadcrumb.length - 1;
          return (
            <span key={item.categoryId}>
              {isLast ? (
                <span className="breadcrumb-item current">{item.name}</span>
              ) : (
                <button
                  className="breadcrumb-item clickable"
                  onClick={() => handleBreadcrumbClick(item)}
                >
                  {item.name}
                </button>
              )}
            </span>
          );
        })}
      </nav>

      {/* Cabeçalho da categoria */}
      <div className="category-header">
        <div className="category-icon-large">
          {category.icon ? (
            <span className="icon-emoji">{category.icon}</span>
          ) : (
            <span className="icon-placeholder">📦</span>
          )}
        </div>
        <div className="category-header-content">
          <h1 className="category-title">{category.name}</h1>
          {category.description && (
            <p className="category-description">{category.description}</p>
          )}
        </div>
      </div>

      {/* Subcategorias ou Branches */}
      {children.length === 0 ? (
        <div className="leaf-category-message">
          <p>Esta é uma categoria final. Os produtos e serviços serão exibidos aqui em breve.</p>
        </div>
      ) : (
        <div className="subcategories-section">
          <h2 className="section-title">
            {category.metadata?.taxonomy === 'branch' ? 'Categorias' : 'Subcategorias'}
          </h2>
          <div className="subcategories-grid">
            {children.map((subcategory) => (
              <div
                key={subcategory.id}
                className="subcategory-card"
                onClick={() => handleSubcategoryClick(subcategory)}
              >
                <div className="subcategory-icon">
                  {subcategory.icon ? (
                    <span className="icon-emoji">{subcategory.icon}</span>
                  ) : (
                    <span className="icon-placeholder">
                      {subcategory.metadata?.branch_type === 'products' ? '📦' : '🔧'}
                    </span>
                  )}
                </div>
                <div className="subcategory-content">
                  <h3 className="subcategory-name">{subcategory.name}</h3>
                  {subcategory.description && (
                    <p className="subcategory-description">{subcategory.description}</p>
                  )}
                </div>
                <div className="subcategory-action">
                  <button className="explore-button">Explorar →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Espaço reservado para futuras funcionalidades */}
      <div className="future-features-section">
        <div className="future-features-placeholder">
          {/* Espaço para:
            - Lista de serviços/produtos da categoria
            - Filtros laterais
            - Ordenação
            - Paginação
          */}
        </div>
      </div>
    </div>
  );
}

