// src/components/marketplace/MarketplaceInventory.tsx
// Estoque: movimentações e lotes
import { useState, useEffect } from 'react';
import {
  listProducts,
  listVariants,
  getBalance,
  getMovements,
  addMovement,
  listLots,
  createLot,
  type ProductVariant,
  type InventoryBalance,
  type InventoryMovement,
  type InventoryLot,
} from '../../api/marketplace';
import { showToast } from '../common/Toast';

export default function MarketplaceInventory() {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [balance, setBalance] = useState<InventoryBalance | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showLotForm, setShowLotForm] = useState(false);

  useEffect(() => {
    loadVariants();
  }, []);

  useEffect(() => {
    if (selectedVariantId) {
      loadInventoryData(selectedVariantId);
    }
  }, [selectedVariantId]);

  const loadVariants = async () => {
    setIsLoading(true);
    try {
      // Buscar produtos e variantes (simplificado - em produção, teria endpoint específico)
      const prods = await listProducts();
      const allVariants: ProductVariant[] = [];
      for (const prod of prods) {
        const vars = await listVariants(prod.id);
        allVariants.push(...vars);
      }
      setVariants(allVariants);
    } catch (error: any) {
      showToast('Erro ao carregar variantes: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadInventoryData = async (variantId: string) => {
    try {
      const [bal, movs, lts] = await Promise.all([
        getBalance(variantId),
        getMovements(variantId),
        listLots(variantId),
      ]);
      setBalance(bal);
      setMovements(movs);
      setLots(lts);
    } catch (error: any) {
      showToast('Erro ao carregar dados de estoque: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleAddMovement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedVariantId) return;
    const formData = new FormData(e.currentTarget);
    try {
      await addMovement({
        productVariantId: selectedVariantId,
        movementType: formData.get('movementType') as 'IN' | 'OUT' | 'ADJUSTMENT',
        quantity: parseFloat(formData.get('quantity') as string),
        unit: formData.get('unit') as string || 'UN',
        reason: formData.get('reason') as string || undefined,
      });
      showToast('Movimentação registrada com sucesso', 'success');
      setShowMovementForm(false);
      loadInventoryData(selectedVariantId);
    } catch (error: any) {
      showToast('Erro ao registrar movimentação: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  const handleCreateLot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedVariantId) return;
    const formData = new FormData(e.currentTarget);
    try {
      await createLot({
        productVariantId: selectedVariantId,
        lotCode: formData.get('lotCode') as string,
        manufactureDate: formData.get('manufactureDate') as string || undefined,
        expirationDate: formData.get('expirationDate') as string || undefined,
      });
      showToast('Lote criado com sucesso', 'success');
      setShowLotForm(false);
      loadInventoryData(selectedVariantId);
    } catch (error: any) {
      showToast('Erro ao criar lote: ' + (error.message || 'Erro desconhecido'), 'error');
    }
  };

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="marketplace-inventory">
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Selecionar Variante:
          <select
            value={selectedVariantId || ''}
            onChange={(e) => setSelectedVariantId(e.target.value || null)}
            style={{ marginLeft: '0.5rem', padding: '0.5rem' }}
          >
            <option value="">-- Selecione --</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>{v.sku}</option>
            ))}
          </select>
        </label>
      </div>

      {selectedVariantId && (
        <>
          {balance && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
              <strong>Saldo Atual:</strong> {balance.currentQuantity} {balance.unit}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Movimentações */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Movimentações</h3>
                <button onClick={() => setShowMovementForm(!showMovementForm)}>
                  {showMovementForm ? 'Cancelar' : '+ Nova Movimentação'}
                </button>
              </div>

              {showMovementForm && (
                <form onSubmit={handleAddMovement} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label>Tipo: 
                      <select name="movementType" required>
                        <option value="IN">Entrada</option>
                        <option value="OUT">Saída</option>
                        <option value="ADJUSTMENT">Ajuste</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label>Quantidade: <input type="number" name="quantity" step="0.01" required /></label>
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label>Unidade: <input type="text" name="unit" defaultValue="UN" /></label>
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label>Motivo: <input type="text" name="reason" /></label>
                  </div>
                  <button type="submit">Registrar</button>
                </form>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Tipo</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Quantidade</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mov) => (
                    <tr key={mov.id}>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{mov.movementType}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{mov.quantity} {mov.unit}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{new Date(mov.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lotes */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Lotes</h3>
                <button onClick={() => setShowLotForm(!showLotForm)}>
                  {showLotForm ? 'Cancelar' : '+ Novo Lote'}
                </button>
              </div>

              {showLotForm && (
                <form onSubmit={handleCreateLot} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label>Código do Lote: <input type="text" name="lotCode" required /></label>
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label>Data de Fabricação: <input type="date" name="manufactureDate" /></label>
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label>Data de Validade: <input type="date" name="expirationDate" /></label>
                  </div>
                  <button type="submit">Criar</button>
                </form>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Código</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #ddd' }}>Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot) => (
                    <tr key={lot.id}>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{lot.lotCode}</td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{lot.expirationDate ? new Date(lot.expirationDate).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

