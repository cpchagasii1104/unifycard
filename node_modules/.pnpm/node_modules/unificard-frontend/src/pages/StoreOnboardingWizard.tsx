// frontend/src/pages/StoreOnboardingWizard.tsx
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - NÃO resolve conflitos
// - NÃO bloqueia fluxos institucionais
// - Apenas coleta, exibe e orienta
//
// Arquétipo: Entity Declaration / Creation Page
// Declaração progressiva de loja (sem wizard obrigatório)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRootCategories, getCategoryChildren, type MarketplaceCategory } from '../api/marketplace-categories';
import {
  createStoreOnboarding,
  getCategoryProductStats,
  type StoreOnboardingInput,
} from '../api/store-onboarding';
import { showToast } from '../utils/toast';
import { useSession } from '../contexts/SessionProvider';
import './StoreOnboardingWizard.css';

export interface StoreDeclarationFormData {
  departmentCategoryId: string;
  selectedCategoryIds: string[];
  hasOwnProducts: boolean;
  defaultSalePrice: number | null;
  defaultStock: number | null;
}

const INITIAL_DATA: StoreDeclarationFormData = {
  departmentCategoryId: '',
  selectedCategoryIds: [],
  hasOwnProducts: false,
  defaultSalePrice: null,
  defaultStock: null,
};

export default function StoreOnboardingWizard() {
  const navigate = useNavigate();
  const { activeActor } = useSession();
  const actorId = activeActor?.actor_id || null;
  const [formData, setFormData] = useState<StoreDeclarationFormData>(INITIAL_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dados carregados
  const [departments, setDepartments] = useState<MarketplaceCategory[]>([]);
  const [subcategories, setSubcategories] = useState<MarketplaceCategory[]>([]);
  const [categoryStats, setCategoryStats] = useState<Record<string, number>>({});

  useEffect(() => {
    if (activeActor) {
      loadDepartments();
    }
  }, [activeActor]);

  useEffect(() => {
    if (formData.departmentCategoryId) {
      loadSubcategories(formData.departmentCategoryId);
    } else {
      setSubcategories([]);
      setFormData(prev => ({ ...prev, selectedCategoryIds: [] }));
    }
  }, [formData.departmentCategoryId]);

  useEffect(() => {
    if (formData.selectedCategoryIds.length > 0) {
      loadCategoryStats(formData.selectedCategoryIds);
    }
  }, [formData.selectedCategoryIds]);

  const loadDepartments = async () => {
    setIsLoading(true);
    try {
      const rootCategories = await getRootCategories();
      setDepartments(rootCategories);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar departamentos');
      showToast('Erro ao carregar departamentos', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubcategories = async (departmentId: string) => {
    setIsLoading(true);
    try {
      const children = await getCategoryChildren(departmentId);
      setSubcategories(children);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar subcategorias');
      showToast('Erro ao carregar subcategorias', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategoryStats = async (categoryIds: string[]) => {
    try {
      const stats = await getCategoryProductStats(categoryIds);
      const statsMap: Record<string, number> = {};
      stats.forEach((stat) => {
        statsMap[stat.categoryId] = stat.availableProductsCount;
      });
      setCategoryStats(statsMap);
    } catch (err: any) {
      console.error('Erro ao carregar estatísticas:', err);
    }
  };

  const updateFormData = (updates: Partial<StoreDeclarationFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setError(null);
  };

  const handleSaveDraft = async () => {
    if (!actorId) {
      setError('Selecione um perfil ou empresa para criar uma loja');
      return;
    }
    if (!formData.departmentCategoryId) {
      setError('Selecione um departamento para salvar como rascunho.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: StoreOnboardingInput = {
        actorId,
        departmentCategoryId: formData.departmentCategoryId,
        selectedCategoryIds: formData.selectedCategoryIds,
        hasOwnProducts: formData.hasOwnProducts,
        defaultSalePrice: formData.defaultSalePrice || undefined,
        defaultStock: formData.defaultStock || undefined,
      };

      const result = await createStoreOnboarding(input);

      showToast(
        `Rascunho salvo! ${result.importedProductsCount} produtos importados.`,
        'success'
      );

      // Redirecionar para a loja
      navigate(`/marketplace/store/${result.storeId}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar rascunho');
      showToast('Erro ao salvar rascunho', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateStore = async () => {
    if (!actorId) {
      setError('Selecione um perfil ou empresa para criar uma loja');
      return;
    }
    // Validação mínima para criação
    if (!formData.departmentCategoryId || formData.selectedCategoryIds.length === 0) {
      setError('Preencha o departamento e selecione pelo menos uma categoria antes de criar a loja.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: StoreOnboardingInput = {
        actorId,
        departmentCategoryId: formData.departmentCategoryId,
        selectedCategoryIds: formData.selectedCategoryIds,
        hasOwnProducts: formData.hasOwnProducts,
        defaultSalePrice: formData.defaultSalePrice || undefined,
        defaultStock: formData.defaultStock || undefined,
      };

      const result = await createStoreOnboarding(input);

      showToast(
        `Loja criada com sucesso! ${result.importedProductsCount} produtos importados.`,
        'success'
      );

      // Redirecionar para a loja
      navigate(`/marketplace/store/${result.storeId}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar loja');
      showToast('Erro ao criar loja', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeActor) {
    return (
      <div className="store-onboarding-wizard">
        <div className="wizard-error" style={{
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '0.5rem',
          margin: '2rem 0'
        }}>
          <p style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: '#92400e',
            marginBottom: '0.5rem'
          }}>
            Selecione um perfil ou empresa para criar uma loja
          </p>
          <p style={{
            fontSize: '0.875rem',
            color: '#78350f',
            marginTop: '0.5rem'
          }}>
            Você precisa selecionar um perfil ativo no menu superior para criar uma loja no Marketplace.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && departments.length === 0) {
    return (
      <div className="store-onboarding-wizard">
        <div className="wizard-loading">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="store-onboarding-wizard">
      <div className="wizard-header">
        <h1>Declarar Nova Loja</h1>
        <p className="wizard-subtitle">
          Preencha as informações da sua loja. Você pode salvar como rascunho a qualquer momento.
        </p>
      </div>

      <div className="wizard-content">
        {error && <div className="wizard-error">{error}</div>}

        {/* Seção 1: Departamento */}
        <section className="form-section">
          <h2>1. Departamento Principal</h2>
          <p className="section-description">
            Escolha o departamento que melhor descreve sua loja
          </p>
          <div className="departments-grid">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className={`department-card ${formData.departmentCategoryId === dept.id ? 'selected' : ''}`}
                onClick={() => updateFormData({ departmentCategoryId: dept.id })}
              >
                <div className="department-icon">
                  {dept.icon ? (
                    <span className="icon-emoji">{dept.icon}</span>
                  ) : (
                    <span className="icon-placeholder">📦</span>
                  )}
                </div>
                <h3 className="department-name">{dept.name}</h3>
                {dept.description && (
                  <p className="department-description">{dept.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Seção 2: Categorias */}
        {formData.departmentCategoryId && (
          <section className="form-section">
            <h2>2. Categorias</h2>
            <p className="section-description">
              Escolha as categorias que sua loja irá trabalhar. Produtos industrializados serão
              importados automaticamente do catálogo.
            </p>
            <div className="categories-list">
              {subcategories.map((category) => (
                <label key={category.id} className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.selectedCategoryIds.includes(category.id)}
                    onChange={() => {
                      const newCategories = formData.selectedCategoryIds.includes(category.id)
                        ? formData.selectedCategoryIds.filter(id => id !== category.id)
                        : [...formData.selectedCategoryIds, category.id];
                      updateFormData({ selectedCategoryIds: newCategories });
                    }}
                  />
                  <div className="checkbox-content">
                    <span className="category-name">{category.name}</span>
                    {categoryStats[category.id] !== undefined && (
                      <span className="category-stats">
                        {categoryStats[category.id]} produtos disponíveis
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </section>
        )}

        {/* Seção 3: Fabricação Própria */}
        <section className="form-section">
          <h2>3. Fabricação Própria</h2>
          <p className="section-description">
            Sua loja possui produtos de fabricação própria além dos produtos industrializados?
          </p>
          <div className="own-products-options">
            <label className="radio-option">
              <input
                type="radio"
                name="hasOwnProducts"
                checked={!formData.hasOwnProducts}
                onChange={() => updateFormData({ hasOwnProducts: false })}
              />
              <span>Apenas produtos industrializados</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="hasOwnProducts"
                checked={formData.hasOwnProducts}
                onChange={() => updateFormData({ hasOwnProducts: true })}
              />
              <span>Sim, também temos produtos próprios</span>
            </label>
          </div>
        </section>

        {/* Seção 4: Valores Padrão (Opcional) */}
        <section className="form-section">
          <h2>4. Valores Padrão (Opcional)</h2>
          <p className="section-description">
            Estes valores serão aplicados aos produtos importados. Você poderá ajustar
            individualmente depois.
          </p>
          <div className="default-values-section">
            <div className="form-group">
              <label>Preço de Venda Padrão (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.defaultSalePrice || ''}
                onChange={(e) => updateFormData({ defaultSalePrice: parseFloat(e.target.value) || null })}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Estoque Inicial Padrão</label>
              <input
                type="number"
                min="0"
                value={formData.defaultStock || ''}
                onChange={(e) => updateFormData({ defaultStock: parseInt(e.target.value) || null })}
                placeholder="0"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Ações */}
      <div className="wizard-actions">
        <button
          className="wizard-button secondary"
          onClick={handleSaveDraft}
          disabled={isSubmitting}
          type="button"
        >
          {isSubmitting ? 'Salvando...' : 'Salvar Rascunho'}
        </button>
        <button
          className="wizard-button primary"
          onClick={handleCreateStore}
          disabled={isSubmitting}
          type="button"
        >
          {isSubmitting ? 'Criando...' : 'Criar Loja'}
        </button>
      </div>
    </div>
  );
}
