// src/components/marketplace/MarketplaceProducts.tsx
// Produtos e variantes
import { useState, useEffect } from 'react';
import {
  listProducts,
  createProduct,
  listVariants,
  createVariant,
  type Product,
  type ProductVariant,
} from '../../api/marketplace';
import { showToast } from '../common/Toast';

export default function MarketplaceProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showVariantForm, setShowVariantForm] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      loadVariants(selectedProduct.id);
    }
  }, [selectedProduct]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const prods = await listProducts();
      setProducts(prods);
    } catch (error: any) {
      showToast('Erro ao carregar produtos: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadVariants = async (productId: string) => {
    try {
      const vars = await listVariants(productId);
      setVariants(vars);
    } catch (error: any) {
      showToast('Erro ao carregar variantes: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await createProduct({
        name: formData.get('name') as string,
        description: formData.get('description') as string || undefined,
        productType: formData.get('productType') as 'UNIT' | 'WEIGHT' | 'LOT',
      });
      showToast('Produto criado com sucesso', 'success');
      setShowProductForm(false);
      loadProducts();
    } catch (error: any) {
      showToast('Erro ao criar produto: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleCreateVariant = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const formData = new FormData(e.currentTarget);
    try {
      await createVariant(selectedProduct.id, {
        sku: formData.get('sku') as string,
        plu: formData.get('plu') as string || undefined,
      });
      showToast('Variante criada com sucesso', 'success');
      setShowVariantForm(false);
      loadVariants(selectedProduct.id);
    } catch (error: any) {
      showToast('Erro ao criar variante: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="marketplace-products">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Produtos</h2>
        <button onClick={() => setShowProductForm(!showProductForm)}>
          {showProductForm ? 'Cancelar' : '+ Novo Produto'}
        </button>
      </div>

      {showProductForm && (
        <form onSubmit={handleCreateProduct} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Nome: <input type="text" name="name" required /></label>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Descrição: <textarea name="description" /></label>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Tipo: 
              <select name="productType" required>
                <option value="UNIT">Unitário</option>
                <option value="WEIGHT">Peso</option>
                <option value="LOT">Lote</option>
              </select>
            </label>
          </div>
          <button type="submit">Criar</button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Lista de produtos */}
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Nome</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Tipo</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map((prod) => (
                <tr key={prod.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedProduct(prod)}>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{prod.name}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{prod.productType}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedProduct(prod); }}>Ver Variantes</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Variantes do produto selecionado */}
        {selectedProduct && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Variantes de {selectedProduct.name}</h3>
              <button onClick={() => setShowVariantForm(!showVariantForm)}>
                {showVariantForm ? 'Cancelar' : '+ Nova Variante'}
              </button>
            </div>

            {showVariantForm && (
              <form onSubmit={handleCreateVariant} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label>SKU: <input type="text" name="sku" required /></label>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <label>PLU: <input type="text" name="plu" /></label>
                </div>
                <button type="submit">Criar</button>
              </form>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>SKU</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>PLU</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => (
                  <tr key={variant.id}>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{variant.sku}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{variant.plu || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}







