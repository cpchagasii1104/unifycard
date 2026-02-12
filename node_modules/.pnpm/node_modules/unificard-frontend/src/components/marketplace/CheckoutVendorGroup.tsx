// frontend/src/components/marketplace/CheckoutVendorGroup.tsx
// UX CANÔNICA: Grupo visual de vendedor no checkout
// 🔴 BLINDAGEM: Apenas exibição, sem cálculos

import { type CheckoutOrder } from '../../api/marketplace';
import './CheckoutVendorGroup.css';

interface CheckoutVendorGroupProps {
  storeId: string;
  storeName: string;
  orders: CheckoutOrder[];
}

export default function CheckoutVendorGroup({
  storeId,
  storeName,
  orders,
}: CheckoutVendorGroupProps) {
  // Calcular subtotal por vendedor (soma dos subtotais dos orders)
  // NOTA: Este cálculo é apenas para exibição visual, não é fonte de verdade
  // A fonte de verdade é o backend que retorna os valores
  const vendorSubtotal = orders.reduce((sum, order) => sum + order.subtotal, 0);

  // Formatar valor em centavos para exibição
  const formatPrice = (cents: number): string => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="checkout-vendor-group">
      <div className="vendor-header">
        <h3>{storeName}</h3>
        <span className="vendor-id">ID: {storeId}</span>
      </div>

      {/* Lista de itens do vendedor */}
      <div className="vendor-items">
        {orders.map((order, orderIndex) => (
          <div key={`${order.store_id}-${orderIndex}`} className="vendor-order">
            {order.items.map((item, itemIndex) => (
              <div key={`${item.product_id}-${itemIndex}`} className="vendor-item">
                <div className="item-info">
                  {/* NOTA: Nome do produto virá da API quando disponível */}
                  {/* Por enquanto, exibimos apenas o ID (backend é fonte de verdade) */}
                  <span className="item-name">Produto: {item.product_id}</span>
                  <span className="item-quantity">Quantidade: {item.quantity}</span>
                </div>
                <div className="item-pricing">
                  <span className="item-unit-price">
                    {formatPrice(item.unit_price)} cada
                  </span>
                  <span className="item-subtotal">
                    {formatPrice(item.subtotal)}
                  </span>
                </div>
              </div>
            ))}
            <div className="order-subtotal">
              <span>Subtotal do pedido:</span>
              <strong>{formatPrice(order.subtotal)}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Subtotal do vendedor */}
      <div className="vendor-subtotal">
        <span>Subtotal {storeName}:</span>
        <strong>{formatPrice(vendorSubtotal)}</strong>
      </div>

      {/* Frete do vendedor (se aplicável) */}
      {/* NOTA: Frete será exibido quando a API retornar essa informação no CheckoutIntent */}
      {/* Conforme UX canônica: frete é separado por vendedor e nunca misturado ao preço do produto */}
      {/* Por enquanto, apenas exibimos o subtotal de produtos */}
    </div>
  );
}

