// frontend/src/pages/InvoiceDashboardPage.tsx
// Dashboard de Invoice Management (Admin/Finance)
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listInvoices, type Invoice, type InvoiceStatus, type InvoiceType } from '../api/invoices';
import { showToast } from '../utils/toast';
import './InvoiceDashboardPage.css';

export default function InvoiceDashboardPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    status?: InvoiceStatus;
    invoiceType?: InvoiceType;
    startDate?: string;
    endDate?: string;
    actorId?: string;
  }>({});

  useEffect(() => {
    loadInvoices();
  }, [filters]);

  const loadInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listInvoices({
        status: filters.status,
        invoiceType: filters.invoiceType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        actorId: filters.actorId,
        limit: 100,
      });
      setInvoices(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar invoices');
      console.error('Erro ao carregar invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (cents: number, currency: string) => {
    const value = cents / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency || 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      DRAFT: 'status-draft',
      ISSUED: 'status-issued',
      CANCELLED: 'status-cancelled',
    };
    return classes[status] || 'status-default';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: 'Rascunho',
      ISSUED: 'Emitido',
      CANCELLED: 'Cancelado',
    };
    return labels[status] || status;
  };

  const getInvoiceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      SERVICE_PROVIDER: 'Prestador',
      PLATFORM_FEE: 'Comissão Plataforma',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="invoice-dashboard">
        <div className="invoice-loading">Carregando invoices...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="invoice-dashboard">
        <div className="invoice-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="invoice-dashboard">
      <div className="invoice-dashboard-header">
        <h1>Invoice Management</h1>
      </div>

      <div className="invoice-filters">
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as InvoiceStatus || undefined })}
          >
            <option value="">Todos</option>
            <option value="DRAFT">Rascunho</option>
            <option value="ISSUED">Emitido</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Tipo:</label>
          <select
            value={filters.invoiceType || ''}
            onChange={(e) => setFilters({ ...filters, invoiceType: e.target.value as InvoiceType || undefined })}
          >
            <option value="">Todos</option>
            <option value="SERVICE_PROVIDER">Prestador</option>
            <option value="PLATFORM_FEE">Comissão Plataforma</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Data Emissão Início:</label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
          />
        </div>
        <div className="filter-group">
          <label>Data Emissão Fim:</label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
          />
        </div>
      </div>

      <div className="invoice-list">
        {invoices.length === 0 ? (
          <div className="invoice-empty">Nenhum invoice encontrado.</div>
        ) : (
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Tipo</th>
                <th>Emissor</th>
                <th>Destinatário</th>
                <th>Total</th>
                <th>Status</th>
                <th>Emitido em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.invoiceId}>
                  <td className="invoice-id-cell">{invoice.invoiceId.substring(0, 8)}...</td>
                  <td>{getInvoiceTypeLabel(invoice.invoiceType)}</td>
                  <td className="monospace">{invoice.actorId.substring(0, 8)}...</td>
                  <td className="monospace">{invoice.recipientActorId.substring(0, 8)}...</td>
                  <td className="amount-cell">{formatPrice(invoice.totalCents, invoice.currency)}</td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(invoice.status)}`}>
                      {getStatusLabel(invoice.status)}
                    </span>
                  </td>
                  <td>{formatDate(invoice.issuedAt)}</td>
                  <td>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => navigate(`/invoices/${invoice.invoiceId}`)}
                    >
                      Ver Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}




