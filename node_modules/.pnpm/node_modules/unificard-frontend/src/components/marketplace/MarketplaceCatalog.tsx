// src/components/marketplace/MarketplaceCatalog.tsx
// Catálogo: categorias e atributos
import { useState, useEffect } from 'react';
import {
  listCategories,
  createCategory,
  listAttributes,
  createAttribute,
  type ProductCategory,
  type ProductAttribute,
} from '../../api/marketplace';
import { showToast } from '../common/Toast';

export default function MarketplaceCatalog() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showAttributeForm, setShowAttributeForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cats, attrs] = await Promise.all([
        listCategories(),
        listAttributes(),
      ]);
      setCategories(cats);
      setAttributes(attrs);
    } catch (error: any) {
      showToast('Erro ao carregar catálogo: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await createCategory({
        name: formData.get('name') as string,
        slug: formData.get('slug') as string || undefined,
      });
      showToast('Categoria criada com sucesso', 'success');
      setShowCategoryForm(false);
      loadData();
    } catch (error: any) {
      showToast('Erro ao criar categoria: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleCreateAttribute = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await createAttribute({
        name: formData.get('name') as string,
        slug: formData.get('slug') as string || undefined,
        dataType: formData.get('dataType') as 'string' | 'number' | 'boolean' | 'enum',
        unit: formData.get('unit') as string || undefined,
        isRequired: formData.get('isRequired') === 'true',
      });
      showToast('Atributo criado com sucesso', 'success');
      setShowAttributeForm(false);
      loadData();
    } catch (error: any) {
      showToast('Erro ao criar atributo: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="marketplace-catalog">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Categorias */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Categorias</h2>
            <button onClick={() => setShowCategoryForm(!showCategoryForm)}>
              {showCategoryForm ? 'Cancelar' : '+ Nova Categoria'}
            </button>
          </div>

          {showCategoryForm && (
            <form onSubmit={handleCreateCategory} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Nome: <input type="text" name="name" required /></label>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Slug: <input type="text" name="slug" /></label>
              </div>
              <button type="submit">Criar</button>
            </form>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Nome</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Slug</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{cat.name}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{cat.slug}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{cat.isActive ? 'Ativo' : 'Inativo'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Atributos */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Atributos</h2>
            <button onClick={() => setShowAttributeForm(!showAttributeForm)}>
              {showAttributeForm ? 'Cancelar' : '+ Novo Atributo'}
            </button>
          </div>

          {showAttributeForm && (
            <form onSubmit={handleCreateAttribute} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Nome: <input type="text" name="name" required /></label>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Slug: <input type="text" name="slug" /></label>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Tipo: 
                  <select name="dataType" required>
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="enum">Enum</option>
                  </select>
                </label>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Unidade: <input type="text" name="unit" /></label>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label>Obrigatório: <input type="checkbox" name="isRequired" value="true" /></label>
              </div>
              <button type="submit">Criar</button>
            </form>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Nome</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Tipo</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Unidade</th>
              </tr>
            </thead>
            <tbody>
              {attributes.map((attr) => (
                <tr key={attr.id}>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{attr.name}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{attr.dataType}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{attr.unit || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}







