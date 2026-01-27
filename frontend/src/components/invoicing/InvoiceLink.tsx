// frontend/src/components/invoicing/InvoiceLink.tsx
// Componente para exibir link para Invoice a partir de PayoutOrder
// 🔴 BLINDAGEM: Frontend apenas reflete backend

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoiceByPayoutOrderId, type Invoice } from '../../api/invoices';

interface InvoiceLinkProps {
  payoutOrderId: string;
}

export default function InvoiceLink({ payoutOrderId }: InvoiceLinkProps) {
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInvoice();
  }, [payoutOrderId]);

  const loadInvoice = async () => {
    setIsLoading(true);
    try {
      // Buscar invoice por payoutOrderId via API
      const invoices = await getInvoiceByPayoutOrderId(payoutOrderId);
      if (invoices && invoices.length > 0) {
        setInvoice(invoices[0]);
      } else {
        setInvoice(null);
      }
    } catch (err) {
      // Ignorar erro - invoice pode não existir ainda
      setInvoice(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <span className="info-value">Carregando...</span>;
  }

  if (!invoice) {
    return (
      <span className="info-value" style={{ color: '#6b7280', fontStyle: 'italic' }}>
        Nenhum invoice criado
      </span>
    );
  }

  return (
    <a
      href={`/invoices/${invoice.invoiceId}`}
      onClick={(e) => {
        e.preventDefault();
        navigate(`/invoices/${invoice.invoiceId}`);
      }}
      className="info-link"
    >
      Ver Invoice ({invoice.status})
    </a>
  );
}

