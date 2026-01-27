// frontend/src/pages/LoyaltyPage.tsx
// SPRINT 93: LOYALTY / FIDELIDADE

import { useState, useEffect } from 'react';
import {
  getLoyaltyAccount,
  listLoyaltyLedger,
  redeemPoints as redeemPointsApi,
  listLoyaltyVouchers,
  type LoyaltyAccount,
  type LoyaltyLedgerEntry,
  type LoyaltyVoucher,
} from '../api/loyalty';
import { listContacts, type Contact } from '../api/contacts';
import './LoyaltyPage.css';

export default function LoyaltyPage() {
  const [contactId, setContactId] = useState<string>('');
  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [ledger, setLedger] = useState<LoyaltyLedgerEntry[]>([]);
  const [vouchers, setVouchers] = useState<LoyaltyVoucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState<number>(0);
  const [redeemVoucherType, setRedeemVoucherType] = useState<'DISCOUNT_FIXED' | 'DISCOUNT_PERCENT' | 'BENEFIT_FLAG'>('DISCOUNT_FIXED');
  const [redeemValue, setRedeemValue] = useState<number>(0);

  useEffect(() => {
    loadContacts();
  }, [contactSearch]);

  const loadContacts = async () => {
    try {
      const filters = contactSearch ? { search: contactSearch } : undefined;
      const data = await listContacts(filters);
      setContacts(data);
    } catch (err: any) {
      console.error('Erro ao carregar contatos:', err);
    }
  };

  const handleSelectContact = async (contact: Contact) => {
    setSelectedContact(contact);
    setContactId(contact.id);
    await loadAccountData(contact.id);
  };

  const loadAccountData = async (cid: string) => {
    try {
      setLoading(true);
      setError(null);

      const [accountData, ledgerData, vouchersData] = await Promise.all([
        getLoyaltyAccount(cid),
        listLoyaltyLedger(cid, 50, 0),
        listLoyaltyVouchers(cid),
      ]);

      setAccount(accountData);
      setLedger(ledgerData);
      setVouchers(vouchersData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados de fidelidade');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!selectedContact || !account) {
      setError('Selecione um contato primeiro');
      return;
    }

    if (redeemPoints <= 0) {
      setError('Pontos devem ser maior que zero');
      return;
    }

    if (redeemPoints > account.pointsBalance) {
      setError(`Saldo insuficiente. Disponível: ${account.pointsBalance}`);
      return;
    }

    try {
      setError(null);
      await redeemPointsApi({
        contactId: selectedContact.id,
        points: redeemPoints,
        voucherType: redeemVoucherType,
        value: redeemVoucherType !== 'BENEFIT_FLAG' ? redeemValue : null,
        benefitCode: redeemVoucherType === 'BENEFIT_FLAG' ? `BENEFIT_${redeemPoints}` : null,
      });

      setShowRedeemModal(false);
      setRedeemPoints(0);
      setRedeemValue(0);
      await loadAccountData(selectedContact.id);
    } catch (err: any) {
      setError(err.message || 'Erro ao resgatar pontos');
    }
  };

  return (
    <div className="loyalty-page">
      <div className="loyalty-header">
        <h1>Fidelidade</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="loyalty-search">
        <input
          type="text"
          placeholder="Buscar contato por nome, email ou CPF/CNPJ..."
          value={contactSearch}
          onChange={(e) => setContactSearch(e.target.value)}
        />
        {contacts.length > 0 && (
          <div className="contacts-list">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="contact-item"
                onClick={() => handleSelectContact(contact)}
              >
                {contact.name} {contact.email && `(${contact.email})`}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedContact && account && (
        <div className="loyalty-account">
          <div className="account-summary">
            <h2>{selectedContact.name}</h2>
            <div className="account-stats">
              <div className="stat-item">
                <span className="stat-label">Saldo:</span>
                <span className="stat-value">{account.pointsBalance.toLocaleString('pt-BR')} pontos</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Ganhos totais:</span>
                <span className="stat-value">{account.lifetimeEarned.toLocaleString('pt-BR')} pontos</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Resgatados:</span>
                <span className="stat-value">{account.lifetimeRedeemed.toLocaleString('pt-BR')} pontos</span>
              </div>
            </div>
            <button className="btn-primary" onClick={() => setShowRedeemModal(true)}>
              Resgatar Pontos
            </button>
          </div>

          <div className="ledger-section">
            <h3>Histórico</h3>
            {ledger.length === 0 ? (
              <p>Nenhum registro ainda.</p>
            ) : (
              <div className="ledger-list">
                {ledger.map((entry) => (
                  <div key={entry.id} className={`ledger-entry ${entry.entryType.toLowerCase()}`}>
                    <div className="entry-info">
                      <span className="entry-type">{entry.entryType}</span>
                      <span className={`entry-points ${entry.entryType === 'EARN' ? 'positive' : 'negative'}`}>
                        {entry.entryType === 'EARN' ? '+' : '-'}{Math.abs(entry.points).toLocaleString('pt-BR')} pontos
                      </span>
                    </div>
                    {entry.description && <p className="entry-description">{entry.description}</p>}
                    <span className="entry-date">{new Date(entry.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="vouchers-section">
            <h3>Vouchers</h3>
            {vouchers.length === 0 ? (
              <p>Nenhum voucher ainda.</p>
            ) : (
              <div className="vouchers-list">
                {vouchers.map((voucher) => (
                  <div key={voucher.id} className={`voucher-card ${voucher.status.toLowerCase()}`}>
                    <div className="voucher-info">
                      <span className="voucher-type">{voucher.voucherType}</span>
                      <span className="voucher-status">{voucher.status}</span>
                    </div>
                    {voucher.value && <p>Valor: R$ {voucher.value.toFixed(2)}</p>}
                    {voucher.benefitCode && <p>Código: {voucher.benefitCode}</p>}
                    {voucher.expiresAt && (
                      <p>Expira em: {new Date(voucher.expiresAt).toLocaleDateString('pt-BR')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showRedeemModal && account && (
        <div className="redeem-modal">
          <div className="modal-content">
            <h3>Resgatar Pontos</h3>
            <div className="modal-form">
              <label>
                Pontos:
                <input
                  type="number"
                  min="1"
                  max={account.pointsBalance}
                  value={redeemPoints}
                  onChange={(e) => setRedeemPoints(parseInt(e.target.value, 10) || 0)}
                />
                <span className="hint">Disponível: {account.pointsBalance.toLocaleString('pt-BR')} pontos</span>
              </label>
              <label>
                Tipo de voucher:
                <select
                  value={redeemVoucherType}
                  onChange={(e) => setRedeemVoucherType(e.target.value as any)}
                >
                  <option value="DISCOUNT_FIXED">Desconto Fixo (R$)</option>
                  <option value="DISCOUNT_PERCENT">Desconto Percentual (%)</option>
                  <option value="BENEFIT_FLAG">Benefício (Flag)</option>
                </select>
              </label>
              {redeemVoucherType !== 'BENEFIT_FLAG' && (
                <label>
                  Valor:
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={redeemValue}
                    onChange={(e) => setRedeemValue(parseFloat(e.target.value) || 0)}
                  />
                </label>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleRedeem}>
                Resgatar
              </button>
              <button className="btn-secondary" onClick={() => setShowRedeemModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

