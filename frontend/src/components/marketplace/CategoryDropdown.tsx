// frontend/src/components/marketplace/CategoryDropdown.tsx
// Menu dropdown de categorias estilo Mercado Livre com Mega Menu

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketplaceCategory, getCategoryChildren, getDepartmentBranches, type MarketplaceDomain } from '../../api/marketplace-categories';
import './CategoryDropdown.css';

interface CategoryDropdownProps {
  categories: MarketplaceCategory[];
  isOpen: boolean;
  onClose: () => void;
  selectedDomain?: MarketplaceDomain;
}

export default function CategoryDropdown({ categories, isOpen, onClose, selectedDomain = 'market' }: CategoryDropdownProps) {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [hoveredCategory, setHoveredCategory] = useState<MarketplaceCategory | null>(null);
  const [subcategories, setSubcategories] = useState<MarketplaceCategory[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    // 🔴 REGRA: Segments NÃO têm subcategorias
    // Não carregar subcategorias para segments
    if (hoveredCategory && hoveredCategory.metadata?.category_type === 'segment') {
      setSubcategories([]);
    } else if (hoveredCategory) {
      // Fallback: apenas para compatibilidade com dados antigos
      loadSubcategories(hoveredCategory);
    } else {
      setSubcategories([]);
    }
  }, [hoveredCategory]);

  const loadSubcategories = async (category: MarketplaceCategory) => {
    // 🔴 REGRA: Este método não deveria ser usado para segments
    // Mantido apenas para compatibilidade
    setLoadingSubcategories(true);
    try {
      const children = await getCategoryChildren(category.id, { domain: selectedDomain });
      setSubcategories(children);
    } catch (err) {
      console.error('Erro ao carregar subcategorias:', err);
      setSubcategories([]);
    } finally {
      setLoadingSubcategories(false);
    }
  };

  const handleCategoryClick = (category: MarketplaceCategory) => {
    // 🔴 REGRA: Categories no dropdown são SEGMENTS (category_type='segment')
    // 🔴 REGRA: Navegar para /marketplace/:domain/:segment
    if (selectedDomain && category.metadata?.category_type === 'segment') {
      const domainPath = selectedDomain === 'real_estate' ? 'real-estate' : selectedDomain;
      navigate(`/marketplace/${domainPath}/${category.slug}`);
    } else {
      // Fallback: usar path se não for segment
      const path = category.path.join('/');
      navigate(`/marketplace/c/${path}`);
    }
    onClose();
  };

  const handleSubcategoryClick = (subcategory: MarketplaceCategory) => {
    // 🔴 REGRA: Segments NÃO têm subcategorias
    // Este handler não deveria ser chamado, mas mantido para compatibilidade
    if (selectedDomain && subcategory.metadata?.category_type === 'segment') {
      const domainPath = selectedDomain === 'real_estate' ? 'real-estate' : selectedDomain;
      navigate(`/marketplace/${domainPath}/${subcategory.slug}`);
    } else {
      const path = subcategory.path.join('/');
      navigate(`/marketplace/c/${path}`);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="category-dropdown-overlay" onClick={onClose} />
      <div className="category-dropdown-wrapper" ref={dropdownRef}>
        <div className="category-dropdown">
          <div className="category-dropdown-header">
            <h3>Categorias</h3>
            <button className="category-dropdown-close" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="category-dropdown-list">
            {categories.length === 0 ? (
              <div className="category-dropdown-empty">
                <p>Nenhum segmento disponível para este domínio</p>
              </div>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className={`category-dropdown-item ${hoveredCategory?.id === category.id ? 'active' : ''}`}
                  onMouseEnter={() => setHoveredCategory(category)}
                  onClick={() => handleCategoryClick(category)}
                >
                  <div className="category-dropdown-item-content">
                    {category.icon && (
                      <span className="category-dropdown-icon">{category.icon}</span>
                    )}
                    <span className="category-dropdown-name">{category.name}</span>
                  </div>
                  <span className="category-dropdown-arrow">→</span>
                </div>
              ))
            )}
          </div>
        </div>

        {hoveredCategory && hoveredCategory.metadata?.category_type !== 'segment' && (
          <div className="category-mega-menu">
            <div className="mega-menu-header">
              <h4>{hoveredCategory.name}</h4>
              {hoveredCategory.description && (
                <p className="mega-menu-description">{hoveredCategory.description}</p>
              )}
            </div>
            {loadingSubcategories ? (
              <div className="mega-menu-loading">
                <p>Carregando...</p>
              </div>
            ) : subcategories.length > 0 ? (
              <div className="mega-menu-content">
                {subcategories.map((subcategory) => (
                  <div
                    key={subcategory.id}
                    className="mega-menu-item"
                    onClick={() => handleSubcategoryClick(subcategory)}
                  >
                    {subcategory.icon && (
                      <span className="mega-menu-item-icon">{subcategory.icon}</span>
                    )}
                    <span className="mega-menu-item-name">{subcategory.name}</span>
                    {subcategory.metadata?.taxonomy === 'branch' && (
                      <span className="mega-menu-item-badge">→</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mega-menu-empty">
                <p>Carregando categorias...</p>
              </div>
            )}
          </div>
        )}
        {hoveredCategory && hoveredCategory.metadata?.category_type === 'segment' && (
          <div className="category-mega-menu">
            <div className="mega-menu-header">
              <h4>{hoveredCategory.name}</h4>
              {hoveredCategory.description && (
                <p className="mega-menu-description">{hoveredCategory.description}</p>
              )}
            </div>
            <div className="mega-menu-empty">
              <p>Clique para ver empresas deste segmento</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

