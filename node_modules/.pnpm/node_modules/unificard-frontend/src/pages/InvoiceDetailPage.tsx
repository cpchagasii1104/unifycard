// frontend/src/pages/InvoiceDetailPage.tsx
// Página de Detalhes do Invoice
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInvoice, issueInvoice, cancelInvoice, type Invoice, type IssueInvoiceInput, type CancelInvoiceInput } from '../api/invoices';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { showToast } from '../utils/toast';
import InvoiceIssueModal from '../components/invoicing/InvoiceIssueModal';
import InvoiceCancelModal from '../components/invoicing/InvoiceCancelModal';
import './InvoiceDetailPage.css';

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  const loadInvoice = async () => {
    if (!invoiceId) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await getInvoice(invoiceId);
      setInvoice(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar invoice');
      console.error('Erro ao carregar invoice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIssue = async (input: IssueInvoiceInput) => {
    if (!invoiceId || !activeActor) return;

    try {
      const updated = await issueInvoice(invoiceId, {
        ...input,
        issuedByActorId: activeActor.actor_id,
      });
      setInvoice(updated);
      setShowIssueModal(false);
      showToast('Invoice emitido com sucesso', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao emitir invoice', 'error');
    }
  };

  const handleCancel = async (input: CancelInvoiceInput) => {
    if (!invoiceId || !activeActor) return;

    try {
      const updated = await cancelInvoice(invoiceId, {
        ...input,
        cancelledByActorId: activeActor.actor_id,
      });
      setInvoice(updated);
      setShowCancelModal(false);
      showToast('Invoice cancelado com sucesso', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao cancelar invoice', 'error');
    }
  };

  const handleExportJSON = () => {
    if (!invoice) return;

    const exportData = {
      invoice,
      exportedAt: new Date().toISOString(),
      exportedBy: activeActor?.actor_id || 'unknown',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoice.invoiceId.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Invoice exportado em JSON', 'success');
  };

  const handleExportPDF = () => {
    // Placeholder técnico - em produção, isso chamaria um endpoint do backend
    showToast('Exportação PDF em desenvolvimento', 'info');
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
      SERVICE_PROVIDER: 'Prestador de Serviço',
      PLATFORM_FEE: 'Comissão da Plataforma',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="invoice-detail">
        <div className="invoice-loading">Carregando invoice...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="invoice-detail">
        <div className="invoice-error">{error || 'Invoice não encontrado'}</div>
      </div>
    );
  }

  return (
    <div className="invoice-detail">
      <div className="invoice-detail-header">
        <button className="btn-secondary btn-sm" onClick={() => navigate('/invoices')}>
          ← Voltar
        </button>
        <h1>Invoice: {invoice.invoiceId.substring(0, 8)}...</h1>
      </div>

      {/* Aviso Legal */}
      {invoice.status === 'ISSUED' && (
        <div className="invoice-legal-notice">
          <strong>⚠️ Documento Fiscal Imutável</strong>
          <p>Este invoice foi emitido e não pode ser alterado. Todas as alterações são registradas no Evidence Pack.</p>
        </div>
      )}

      {/* Status e Valores */}
      <div className="invoice-summary">
        <div className="summary-card">
          <div className="summary-label">Status</div>
          <div className={`summary-value status-badge ${getStatusBadgeClass(invoice.status)}`}>
            {getStatusLabel(invoice.status)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Tipo</div>
          <div className="summary-value">{getInvoiceTypeLabel(invoice.invoiceType)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Subtotal</div>
          <div className="summary-value">{formatPrice(invoice.subtotalCents, invoice.currency)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Impostos</div>
          <div className="summary-value">{formatPrice(invoice.taxesCents, invoice.currency)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total</div>
          <div className="summary-value total-value">{formatPrice(invoice.totalCents, invoice.currency)}</div>
        </div>
      </div>

      {/* Dados Fiscais */}
      <div className="invoice-section">
        <h2>Dados Fiscais</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Emissor:</label>
            <span className="info-value monospace">{invoice.actorId}</span>
          </div>
          <div className="info-item">
            <label>Destinatário:</label>
            <span className="info-value monospace">{invoice.recipientActorId}</span>
          </div>
          {invoice.fiscalMetadata && (
            <>
              {invoice.fiscalMetadata.cfop && (
                <div className="info-item">
                  <label>CFOP:</label>
                  <span className="info-value">{invoice.fiscalMetadata.cfop}</span>
                </div>
              )}
              {invoice.fiscalMetadata.cnae && (
                <div className="info-item">
                  <label>CNAE:</label>
                  <span className="info-value">{invoice.fiscalMetadata.cnae}</span>
                </div>
              )}
              {invoice.fiscalMetadata.nature && (
                <div className="info-item">
                  <label>Natureza:</label>
                  <span className="info-value">{invoice.fiscalMetadata.nature}</span>
                </div>
              )}
              {invoice.fiscalMetadata.issuerCNPJ && (
                <div className="info-item">
                  <label>CNPJ Emissor:</label>
                  <span className="info-value">{invoice.fiscalMetadata.issuerCNPJ}</span>
                </div>
              )}
              {invoice.fiscalMetadata.recipientCNPJ && (
                <div className="info-item">
                  <label>CNPJ Destinatário:</label>
                  <span className="info-value">{invoice.fiscalMetadata.recipientCNPJ}</span>
                </div>
              )}
              {invoice.fiscalMetadata.recipientCPF && (
                <div className="info-item">
                  <label>CPF Destinatário:</label>
                  <span className="info-value">{invoice.fiscalMetadata.recipientCPF}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Itens */}
      <div className="invoice-section">
        <h2>Itens Faturados ({invoice.items.length})</h2>
        <table className="invoice-items-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Quantidade</th>
              <th>Preço Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.itemId}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{formatPrice(item.unitPriceCents, invoice.currency)}</td>
                <td className="amount-cell">{formatPrice(item.totalCents, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Referências */}
      <div className="invoice-section">
        <h2>Referências</h2>
        <div className="info-grid">
          {invoice.serviceOrderId && (
            <div className="info-item">
              <label>Service Order ID:</label>
              <a
                href={`/service-orders/${invoice.serviceOrderId}`}
                className="info-link"
              >
                {invoice.serviceOrderId.substring(0, 8)}...
              </a>
            </div>
          )}
          <div className="info-item">
            <label>Payout Order ID:</label>
            <a
              href={`/payouts/orders/${invoice.payoutOrderId}`}
              className="info-link"
            >
              {invoice.payoutOrderId.substring(0, 8)}...
            </a>
          </div>
          <div className="info-item">
            <label>Ledger Entries:</label>
            <span className="info-value">{invoice.ledgerEntryIds.length} entrada(s)</span>
          </div>
          <div className="info-item">
            <label>Evidence Pack:</label>
            <a
              href={`/evidence/${invoice.evidencePackId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="info-link"
            >
              Ver Evidence Pack
            </a>
          </div>
        </div>
      </div>

      {/* Histórico */}
      <div className="invoice-section">
        <h2>Histórico</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Criado em:</label>
            <span className="info-value">{formatDate(invoice.createdAt)}</span>
          </div>
          {invoice.issuedAt && (
            <div className="info-item">
              <label>Emitido em:</label>
              <span className="info-value">{formatDate(invoice.issuedAt)}</span>
            </div>
          )}
          {invoice.cancelledAt && (
            <div className="info-item">
              <label>Cancelado em:</label>
              <span className="info-value">{formatDate(invoice.cancelledAt)}</span>
            </div>
          )}
          {invoice.cancellationReason && (
            <div className="info-item">
              <label>Motivo do Cancelamento:</label>
              <span className="info-value">{invoice.cancellationReason}</span>
            </div>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="invoice-actions">
        {invoice.status === 'DRAFT' && (
          <>
            <button
              className="btn-primary"
              onClick={() => setShowIssueModal(true)}
              disabled={!activeActor}
            >
              Emitir Invoice
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowCancelModal(true)}
              disabled={!activeActor}
            >
              Cancelar Invoice
            </button>
          </>
        )}
        <button
          className="btn-secondary"
          onClick={handleExportJSON}
        >
          Exportar JSON
        </button>
        <button
          className="btn-secondary"
          onClick={handleExportPDF}
        >
          Exportar PDF
        </button>
      </div>

      {showIssueModal && invoice && (
        <InvoiceIssueModal
          invoice={invoice}
          onClose={() => setShowIssueModal(false)}
          onIssue={handleIssue}
        />
      )}

      {showCancelModal && invoice && (
        <InvoiceCancelModal
          invoice={invoice}
          onClose={() => setShowCancelModal(false)}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}




